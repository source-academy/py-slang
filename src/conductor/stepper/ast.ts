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
  /** Set by `translate.ts` when the source statement was flagged by `markBreakpoints` (a gutter
   * click resolved to its closest enclosing statement — see `../../breakpoints.ts`). Checked by
   * `reduce.ts` alongside its existing `breakpoint()`-call detection. */
  hasBreakpoint?: boolean;
  [key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/*                               Constructors                                 */
/* -------------------------------------------------------------------------- */

/** Builds a `Literal` whose displayed text is `raw` (so Python reprs like `True`/`None` survive). */
export function literal(value: unknown, raw: string, pyFloat = false): StepNode {
  return { type: "Literal", value, raw, pyFloat };
}

/**
 * An opaque value from an imported module (e.g. a `rune` `Rune`) whose payload has no representation
 * in the stepper's value model — unlike every other {@link StepNode} value it is never inspected or
 * decomposed, only ever substituted around and passed to further calls (including back into another
 * module call — see `moduleInterop.ts`'s `stepNodeToModule`, which reads `handle` back out for exactly
 * that). `label` is a short display name (ideally the underlying payload's own constructor name, e.g.
 * `"Rune"`; `"opaque"` if that isn't available) shown as `<label>` — see {@link unparse}'s `"Opaque"`
 * case. `handle` is the underlying `TypedValue<DataType.OPAQUE>` (kept as `unknown` here so `ast.ts`
 * stays free of any conductor-specific type — `moduleInterop.ts` does the casting). `dataUrl` is an
 * optional rendered thumbnail a module may supply (see `moduleInterop.ts`'s `renderThumbnail`, and
 * source-academy/modules's `docs/src/modules/5-advanced/conductor-interop/6-opaque-thumbnails.md`);
 * absent when the payload carries no thumbnail hook, or the hook produced nothing. `syntaxProfile.ts`'s
 * `"Opaque"` template renders it as an inline image when present, falling back to `<label>` otherwise.
 */
export function opaqueValue(label: string, handle: unknown, dataUrl?: string): StepNode {
  const node: StepNode = { type: "Opaque", label, handle };
  if (dataUrl !== undefined) node.dataUrl = dataUrl;
  return node;
}

/**
 * A callable exported by an imported module (e.g. `rune`'s `circle`) — the stepper's analogue of a
 * `def`/`lambda` value, but with no Python body to substitute into: calling it (see `reduce.ts`'s
 * `contractCall`) round-trips through the module via `closure` instead. `closure` is the underlying
 * `TypedValue<DataType.CLOSURE>` handle (kept as `unknown` for the same reason as `opaqueValue`'s
 * `handle`); `minArgs` backs the `arity()` built-in exactly like a `def`/`lambda`'s parameter count,
 * and (together with `isVararg`) the arity check `contractCall` runs before actually placing a call —
 * `isVararg: false` means `minArgs` is an exact count (like a built-in's `min === max`), `true` means
 * it's only a lower bound (extra arguments are collected by the module's own closure). Substituted
 * into the program in place of the imported name before stepping begins (see `getSteps.ts`'s
 * `resolveImports`), exactly like a built-in constant or a bound `def` — never looked up by name at
 * call time, so nothing needs threading through the reducer beyond the one `evaluator` parameter
 * `contractCall` needs to actually place the call.
 */
export function moduleFunction(
  name: string,
  closure: unknown,
  minArgs: number,
  isVararg: boolean,
): StepNode {
  return { type: "ModuleFunction", name, closure, minArgs, isVararg };
}

/** Whether `node` is an opaque module value. See {@link opaqueValue}. */
export function isOpaqueNode(node: StepNode): boolean {
  return node.type === "Opaque";
}

/** Whether `node` is a callable imported from a module. See {@link moduleFunction}. */
export function isModuleFunctionNode(node: StepNode): boolean {
  return node.type === "ModuleFunction";
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
    case "Opaque":
    case "ModuleFunction":
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
    case "Opaque":
    case "ModuleFunction":
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

/**
 * Python truthiness. Used both by `if`/ternary conditions in `reduce.ts` (which, unlike `and`/`or`/
 * `not`, are never type-restricted to `bool`) and by the explicit `bool()` conversion in `builtins.ts`
 * — a single shared implementation so the two can't drift apart.
 */
export function isTruthy(node: StepNode): boolean {
  if (node.type === "ArrayExpression") return (node.elements as StepNode[]).length > 0;
  if (node.type !== "Literal") return true; // function values are truthy
  const v = node.value;
  if (v === null || v === false) return false;
  if (v === true) return true;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "bigint") return v !== 0n;
  if (typeof v === "string") return v.length > 0;
  if (isComplexValue(v)) return v.real !== 0 || v.imag !== 0;
  return true;
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

/** The relabeled tree plus a lookup from every node in the *original* tree to its counterpart in `ast`
 * (identity, for a node {@link markBuiltins} didn't need to change). See {@link markBuiltins}'s doc
 * comment for why `getSteps.ts` needs `correspondence` at all. */
export interface MarkedBuiltins {
  ast: StepNode;
  correspondence: Map<StepNode, StepNode>;
}

/** Whether `node` is a named-value-able function shape — the two cases `functionValues`
 * (`syntaxProfile.ts`) already knows how to collapse to a mu-term with a hover popover. */
function isFunctionValueShape(node: StepNode): boolean {
  return node.type === "ArrowFunctionExpression" || node.type === "FunctionDeclaration";
}

/**
 * Relabels every bare `Identifier` node whose name is a built-in value (per `resolveDisplayValue` — the
 * stepper's own `resolveBuiltinDisplayValue`, injected rather than imported to avoid a cycle with
 * `builtins.ts`, which already imports from this module) with whatever it should display as, so the
 * host has something to hang a hover popover off. Two different outcomes, both driven entirely by what
 * `resolveDisplayValue` returns for a given name:
 *  - A §2 pre-declared list-library function (`map`, `_map`, `llist_ref`, …) resolves to its own real
 *    `lambda`/`def` template (see `lists.ts`'s `library`): this walk tags it with a `name` marker and
 *    recurses into *its* body too (own params/name added to `bound`, exactly like the
 *    `ArrowFunctionExpression`/`FunctionDeclaration` cases below), so it collapses to a mu-term with the
 *    same "Function definition" hover popover a user-defined function gets, and any *other* library name
 *    it references becomes its own, independently hoverable, nested mu-term the same way (py-slang#405).
 *  - Anything else built-in (`print`, `abs`, `is_function`, …) resolves to a `Builtin` node instead —
 *    there's no body to walk into, so it's returned as-is (py-slang#404).
 *
 * Reduction (`reduce.ts`) never sees any of this — it keeps reducing every built-in/library name as a
 * plain `Identifier` throughout, dispatching by name exactly as it does today; this is purely a final,
 * display-facing relabeling `getSteps.ts` applies to each step's tree just before serialization.
 *
 * Unlike `substitute` — which runs *before* a contraction's `preRedex`/`postRedex` are ever captured, so
 * those markers are drawn from the already-substituted tree and match it by construction — this runs
 * *after*: it retroactively relabels a step's tree whose markers were already captured against — and so
 * reference by identity — the very objects being walked here (`mapChildren`'s unconditional fresh copy
 * at every level means even an untouched ancestor gets a new object). So this returns not just the
 * relabeled tree but a `correspondence` map from every original node to its counterpart in that tree,
 * including the redex itself when *it* is what got relabeled (e.g. `breakpoint()`'s own callee is both
 * the highlighted redex and a builtin). `getSteps.ts` looks a marker's `redex` up in `correspondence`
 * before assigning its `redexId`, so the highlight still lands on the right (now relabeled) node instead
 * of silently failing to resolve.
 *
 * `bound` mirrors `substitute`'s own shadowing check — the parameters and own name of every enclosing,
 * not-yet-invoked function value the student actually wrote — so a name that will resolve to a
 * *recursive self-reference* once that function is actually called is never mislabelled a builtin/
 * library value just because it currently still reads the same as one. This matters specifically for a
 * function value's own body: unlike the rest of a step's tree (already fully resolved by live
 * substitution before any step is ever displayed — see the module doc comment on `getSteps.ts`), a
 * function value's body is opaque, un-substituted cargo until the function is actually called, so a name
 * shadowed there is not yet resolved away the way a top-level binding already is. Leaving such an
 * occurrence as a plain `Identifier` also lets the host's own existing recursive-mu-term rendering
 * (matching an `Identifier` inside a popover's content against the enclosing function's own name) keep
 * working unchanged, instead of competing with a second, independent mu-term.
 *
 * The same forward-looking care applies *within* a single, still-unreduced statement list: at the very
 * first ("Start of evaluation") step, `def print(x): ...\nprint(1)` has not been touched by any
 * substitution yet, so nothing has *removed* the later `print(1)` from view the way it eventually will.
 * A generic child-by-child walk (as `mapChildren`'s default case does for every other node type) would
 * treat that `print` exactly like any free `Identifier`, unaware that the sibling statement two lines up
 * is about to shadow it — the same walk correctly leaves the *def's own* self-reference alone (that's
 * `bound`, above) but has no way to know a *sibling* statement changes anything, since siblings are
 * mapped independently. `Program`/`BlockStatement` are special-cased below to walk their `body` array
 * left to right, adding each statement's own declared name (a `def`'s name, or a `x = ...` target) to
 * `bound` *before* walking the statements after it — simulating, for display, the same shadowing
 * `stepHead`'s actual declare-and-substitute step will produce once reduction actually gets there.
 *
 * A resolved library template's own body is walked with a **fresh** `bound` (just its own params/name),
 * never the caller's — `libraryPath` (a *separate* set, tracking only library names currently being
 * expanded on this path) is what it inherits instead. A library template is a global definition,
 * lexically independent of whatever local scope happened to be in effect at the call site that
 * referenced it — a strict lexical reading of `def f(_map): return is_function(map)`, for instance,
 * still means the very same global `_map` cross-referenced *inside* `map`'s own body once resolved, not
 * `f`'s unrelated parameter of the same name; letting `f`'s `bound` leak in would wrongly leave that
 * `_map` an un-relabelled `Identifier`, denying it a popup it should have. `libraryPath` exists so a
 * library template that (perhaps only indirectly, via some future addition) calls back into one of its
 * own ancestors on this path still terminates instead of expanding forever.
 */
export function markBuiltins(
  node: StepNode,
  resolveDisplayValue: (name: string) => StepNode | undefined,
): MarkedBuiltins {
  const correspondence = new Map<StepNode, StepNode>();

  // The bound-name set for descending into a *student-written* named function value's own body: its own
  // parameters, plus its own name (a `FunctionDeclaration`'s `id.name`; an `ArrowFunctionExpression`'s
  // `.name` marker, if bound to one) — more conservative than `substitute`'s identical check, which
  // skips `.name` entirely; see the doc comment above.
  const innerBound = (
    fn: StepNode,
    ownName: string | undefined,
    bound: ReadonlySet<string>,
  ): Set<string> => {
    const inner = new Set(bound);
    paramNames(fn).forEach(p => inner.add(p));
    if (ownName !== undefined) inner.add(ownName);
    return inner;
  };

  const walk = (
    node: StepNode,
    bound: ReadonlySet<string>,
    libraryPath: ReadonlySet<string>,
  ): StepNode => {
    const record = (result: StepNode): StepNode => {
      correspondence.set(node, result);
      return result;
    };
    switch (node.type) {
      case "Identifier": {
        const name = String(node.name);
        if (bound.has(name) || libraryPath.has(name)) return record(node);
        const resolved = resolveDisplayValue(name);
        if (resolved === undefined) return record(node);
        if (!isFunctionValueShape(resolved)) return record(resolved);
        // See the doc comment above: a library template's own body starts a fresh lexical scope (just
        // its own params/name, not the caller's `bound`), inheriting only the library recursion guard.
        const inner = innerBound(resolved, name, new Set());
        const innerLibraryPath = new Set(libraryPath);
        innerLibraryPath.add(name);
        const body = walk(resolved.body as StepNode, inner, innerLibraryPath);
        return record({ ...resolved, name, body });
      }
      case "ArrowFunctionExpression": {
        const inner = innerBound(
          node,
          typeof node.name === "string" ? node.name : undefined,
          bound,
        );
        const body = walk(node.body as StepNode, inner, libraryPath);
        return record(body === node.body ? node : { ...node, body });
      }
      case "FunctionDeclaration": {
        const inner = innerBound(node, String((node.id as StepNode).name), bound);
        const body = walk(node.body as StepNode, inner, libraryPath);
        return record(body === node.body ? node : { ...node, body });
      }
      case "VariableDeclaration": {
        // Mirrors `substitute`'s own "VariableDeclarator" case: only `init` is a reference position —
        // `id` is the declaration's own target, never something to relabel (matching how a
        // `FunctionDeclaration`'s `id` is likewise never walked, just above).
        const decl = (node.declarations as StepNode[])[0];
        const init = walk(decl.init as StepNode, bound, libraryPath);
        if (init === decl.init) return record(node);
        return record({ ...node, declarations: [{ ...decl, init }] });
      }
      case "Program":
      case "BlockStatement": {
        const scoped = new Set(bound);
        let changed = false;
        const newBody = (node.body as StepNode[]).map(stmt => {
          const walked = walk(stmt, scoped, libraryPath);
          if (walked !== stmt) changed = true;
          const declared = declaredNameOf(stmt);
          if (declared !== undefined) scoped.add(declared);
          return walked;
        });
        return record(changed ? { ...node, body: newBody } : node);
      }
      default:
        return record(mapChildren(node, child => walk(child, bound, libraryPath)));
    }
  };

  return { ast: walk(node, new Set(), new Set()), correspondence };
}

/** The name a statement introduces that becomes visible to *later* statements in the same
 * `Program`/`BlockStatement` — a `def`'s own name, or a `x = ...` assignment's target — for
 * {@link markBuiltins}'s `Program`/`BlockStatement` case. `undefined` for anything else (an expression
 * statement, `if`, `pass`, `return`, `import` — an import is already fully resolved throughout the whole
 * program before stepping begins, see `getSteps.ts`'s `resolveImports`, so it never reaches here). */
function declaredNameOf(stmt: StepNode): string | undefined {
  if (stmt.type === "FunctionDeclaration") return String((stmt.id as StepNode).name);
  if (stmt.type === "VariableDeclaration") {
    const id = (stmt.declarations as StepNode[])[0].id as StepNode;
    if (id.type === "Identifier") return String(id.name);
  }
  return undefined;
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
    case "Opaque":
      return `<${node.label}>`;
    case "ModuleFunction":
      return String(node.name);
    default:
      return `<${node.type}>`;
  }
}
