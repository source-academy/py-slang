/**
 * The estree-shaped node model used by the Python substitution stepper.
 *
 * The stepper host plugin (`@sourceacademy/web-stepper`) renders steps with a language-agnostic
 * renderer that dispatches on a node's `type` string and reads estree-style field names
 * (`left`/`right`/`operator`, `test`/`consequent`/`alternate`, `callee`/`arguments`, ...). To reuse
 * that renderer unchanged, the Python stepper does not operate on py-slang's class-based AST
 * directly: it first {@link ./translate translates} the Python AST into these plain
 * estree-shaped objects, reduces them with the substitution model, and serializes the result.
 *
 * Nodes are intentionally plain, structured-clone-able objects (no methods, no class instances) so
 * they survive the runner→host channel and so reductions can rebuild trees cheaply.
 */

/** A single estree-shaped stepper node. Plain JSON: a `type` discriminator plus child fields. */
export interface StepNode {
  type: string;
  [key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/*                               Constructors                                 */
/* -------------------------------------------------------------------------- */

/** Builds a `Literal` whose displayed text is `raw` (so Python reprs like `True`/`None` survive). */
export function literal(value: unknown, raw: string, pyFloat = false): StepNode {
  return { type: "Literal", value, raw, pyFloat };
}

/** Python's textual form of a JS `number`: `inf`/`-inf`/`nan` for the specials, and a trailing `.0`
 * for an integer-valued float (so `4 / 2` reads `2.0`, like Python). Shared by the reducer and the
 * builtin library so all float results display consistently. */
export function numberRepr(n: number, pyFloat: boolean): string {
  if (Number.isNaN(n)) return "nan";
  if (n === Infinity) return "inf";
  if (n === -Infinity) return "-inf";
  return pyFloat && Number.isInteger(n) ? `${n}.0` : String(n);
}

/** Builds a numeric `Literal`, formatting its `raw` with {@link numberRepr}. */
export function numberLiteral(n: number, pyFloat: boolean): StepNode {
  return literal(n, numberRepr(n, pyFloat), pyFloat);
}

/**
 * A Python `complex` value: a plain `{real, imag}` pair, deliberately *not* a class instance (unlike
 * py-slang's own `PyComplexNumber`, which the real evaluator uses) — every {@link StepNode} must stay a
 * plain, structured-clone-able object with no methods (see the module doc comment), and {@link clone}
 * would silently strip a class instance's prototype (and so its methods) on the very first
 * substitution. Arithmetic on this shape lives in `reduce.ts` (mirroring how `intBinary`/`floatBinary`
 * sit there rather than in this module), next to the other binary-operator contractions.
 */
export interface ComplexValue {
  real: number;
  imag: number;
}

/** Whether `v` is a {@link ComplexValue} (a `Literal`'s `.value`, not a `StepNode` itself). */
export function isComplexValue(v: unknown): v is ComplexValue {
  return v !== null && typeof v === "object" && "real" in v && "imag" in v;
}

/** Python's `repr` for a single real/imaginary component: as {@link numberRepr}, but switching to
 * scientific notation past the thresholds CPython itself uses (1e-4 / 1e16) rather than JS's — see
 * `PyComplexNumber.toPythonComplexFloat` in `src/types/value-types.ts`, which this mirrors so the
 * stepper's complex display matches the real, non-stepper evaluator's. */
function complexComponentRepr(n: number): string {
  if (Number.isNaN(n)) return "nan";
  if (n === Infinity) return "inf";
  if (n === -Infinity) return "-inf";
  if (Math.abs(n) >= 1e16 || (n !== 0 && Math.abs(n) < 1e-4)) {
    return n.toExponential().replace(/e([+-])(\d)$/, "e$10$2");
  }
  return String(n);
}

/** Python's `repr` of a complex value: `1j` when the real part is zero (no redundant `(...)`/`.0`),
 * otherwise `(3-2j)`/`(1.5+0j)` — always parenthesised, with an explicit `+` before a non-negative
 * imaginary part. Mirrors `PyComplexNumber.toString`. */
export function complexRepr(c: ComplexValue): string {
  if (c.real === 0) return `${complexComponentRepr(c.imag)}j`;
  const sign = c.imag >= 0 ? "+" : "";
  return `(${complexComponentRepr(c.real)}${sign}${complexComponentRepr(c.imag)}j)`;
}

/** Builds a complex `Literal`, formatting its `raw` with {@link complexRepr}. */
export function complexLiteral(c: ComplexValue): StepNode {
  return literal(c, complexRepr(c));
}

/** Python `repr` of a string: CPython prefers single quotes, switching to double quotes when the
 * string contains a single quote but no double quote (so `"it's"` shows as `"it's"`, not `'it\'s'`).
 * Shared by `translate` (source literals), the reducer (string concatenation) and the builtin library
 * so every string displays the same way. */
export function pythonStringRepr(s: string): string {
  const escaped = s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
  if (s.includes("'") && !s.includes('"')) return `"${escaped}"`;
  return `'${escaped.replace(/'/g, "\\'")}'`;
}

/** Builds a string `Literal` whose value is `s`, displayed with {@link pythonStringRepr}. */
export function stringLiteral(s: string): StepNode {
  return literal(s, pythonStringRepr(s));
}

export function identifier(name: string): StepNode {
  return { type: "Identifier", name };
}

export function program(body: StepNode[]): StepNode {
  return { type: "Program", body };
}

export function expressionStatement(expression: StepNode): StepNode {
  return { type: "ExpressionStatement", expression };
}

/**
 * The empty linked list — Python's `None`. A linked list is built from pairs terminated by `None`, so
 * `None` doubles as both the `None` value and the empty-list terminator, exactly as Source's stepper
 * uses its `null` literal. Displayed as `None`.
 */
export function emptyList(): StepNode {
  return literal(null, "None");
}

/**
 * A pair `pair(head, tail)`. Following Source's stepper, a pair is a two-element `ArrayExpression`, so
 * it renders as `[head, tail]` (box-and-pointer notation) through the existing `ArrayExpression`
 * template — no Python-specific host rendering is needed. (Python §2 has no list-literal syntax, so an
 * `ArrayExpression` is unambiguously a pair.)
 */
export function pairNode(head: StepNode, tail: StepNode): StepNode {
  return { type: "ArrayExpression", elements: [head, tail] };
}

/* -------------------------------------------------------------------------- */
/*                                 Predicates                                  */
/* -------------------------------------------------------------------------- */

/**
 * Whether `node` is a fully-evaluated value (a normal form), i.e. cannot be reduced further on its
 * own. Identifiers count as values: within an expression they are atoms, and any binding for them is
 * resolved by substitution at the statement level (the substitution model), not by reduction here.
 */
export function isValue(node: StepNode): boolean {
  switch (node.type) {
    case "Literal":
    case "Identifier":
    case "ArrowFunctionExpression":
    case "FunctionDeclaration":
      return true;
    case "ArrayExpression":
      return (node.elements as StepNode[]).every(isValue);
    default:
      return false;
  }
}

/** A callable function value produced by a `lambda` or a single-`return` `def`. */
export function isFunctionValue(node: StepNode): boolean {
  return node.type === "ArrowFunctionExpression" || node.type === "FunctionDeclaration";
}

/**
 * Whether `node` is a *final result* — a normal form a program may legitimately end on. Unlike
 * {@link isValue} this excludes a bare `Identifier`: by the time evaluation finishes every binding has
 * been resolved by substitution, so a leftover name is unbound (a `NameError` in Python) and means
 * evaluation is **stuck**, not done. Used to tell "Evaluation complete" from "Evaluation stuck".
 */
export function isResultValue(node: StepNode): boolean {
  switch (node.type) {
    case "Literal":
    case "ArrowFunctionExpression":
    case "FunctionDeclaration":
      return true;
    case "ArrayExpression":
      return (node.elements as StepNode[]).every(isResultValue);
    default:
      return false;
  }
}

/** Whether `node` is a pair (a two-element `ArrayExpression`). See {@link pairNode}. */
export function isPairNode(node: StepNode): boolean {
  return node.type === "ArrayExpression" && (node.elements as StepNode[]).length === 2;
}

/** Whether `node` is the empty linked list `None`. See {@link emptyList}. */
export function isEmptyList(node: StepNode): boolean {
  return node.type === "Literal" && node.value === null;
}

/* -------------------------------------------------------------------------- */
/*                               Cloning                                       */
/* -------------------------------------------------------------------------- */

/**
 * Deep-clones a stepper node, producing fresh object identities throughout. Used when substituting a
 * value into several occurrences so that each occurrence is a distinct object (markers and node-id
 * assignment rely on the per-step AST being a proper tree).
 */
export function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clone) as unknown as T;
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      out[key] = clone((value as Record<string, unknown>)[key]);
    }
    return out as T;
  }
  return value;
}

/* -------------------------------------------------------------------------- */
/*                               Substitution                                 */
/* -------------------------------------------------------------------------- */

function mapValue(value: unknown, fn: (node: StepNode) => StepNode): unknown {
  if (Array.isArray(value)) return value.map(v => mapValue(v, fn));
  if (value !== null && typeof value === "object" && typeof (value as StepNode).type === "string") {
    return fn(value as StepNode);
  }
  return value;
}

function mapChildren(node: StepNode, fn: (node: StepNode) => StepNode): StepNode {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(node)) out[key] = mapValue(node[key], fn);
  return out as StepNode;
}

/** The parameter names of a `lambda`/`def` node. */
export function paramNames(node: StepNode): string[] {
  return ((node.params as StepNode[]) ?? []).map(p => String(p.name));
}

/**
 * Capture-avoiding-by-shadowing substitution of `name` with `value` throughout `node`. Substitution
 * does not descend into a function that binds `name` as a parameter (or, for a named `def`, as its
 * own name), so inner bindings correctly shadow the outer one. Shared by the reducer (function
 * application, statement-level bindings) and the linked-list library (binding a library function's
 * parameters to its value arguments).
 */
export function substitute(node: StepNode, name: string, value: StepNode): StepNode {
  switch (node.type) {
    case "Identifier":
      return node.name === name ? clone(value) : node;
    case "ArrowFunctionExpression":
      if (paramNames(node).includes(name)) return node;
      return { ...node, body: substitute(node.body as StepNode, name, value) };
    case "FunctionDeclaration":
      if ((node.id as StepNode).name === name || paramNames(node).includes(name)) return node;
      return { ...node, body: substitute(node.body as StepNode, name, value) };
    case "VariableDeclarator":
      return { ...node, init: substitute(node.init as StepNode, name, value) };
    default:
      return mapChildren(node, child => substitute(child, name, value));
  }
}

/* -------------------------------------------------------------------------- */
/*                              Unparsing                                      */
/* -------------------------------------------------------------------------- */

/**
 * Renders a node back to compact source-ish text. Only used to build human-readable explanations
 * (e.g. `"1 + 2"`); the host does the real rendering, so this need not be perfectly faithful.
 */
export function unparse(node: StepNode | null | undefined): string {
  if (!node) return "";
  switch (node.type) {
    case "Literal":
      return String(node.raw ?? node.value);
    case "Identifier":
      return String(node.name);
    case "BinaryExpression":
    case "LogicalExpression":
      return `${unparse(node.left as StepNode)} ${node.operator} ${unparse(node.right as StepNode)}`;
    case "UnaryExpression":
      return `${node.operator}${unparse(node.argument as StepNode)}`;
    case "ConditionalExpression":
      return `${unparse(node.consequent as StepNode)} if ${unparse(node.test as StepNode)} else ${unparse(node.alternate as StepNode)}`;
    case "CallExpression":
      return `${unparse(node.callee as StepNode)}(${(node.arguments as StepNode[]).map(unparse).join(", ")})`;
    case "ArrowFunctionExpression":
      return node.name
        ? String(node.name)
        : `lambda ${(node.params as StepNode[]).map(unparse).join(", ")}: ${unparse(node.body as StepNode)}`;
    case "FunctionDeclaration":
      return String((node.id as StepNode).name);
    case "ArrayExpression":
      return `[${(node.elements as StepNode[]).map(unparse).join(", ")}]`;
    default:
      return `<${node.type}>`;
  }
}
