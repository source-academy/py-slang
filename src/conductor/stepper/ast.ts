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
  return { type: 'Literal', value, raw, pyFloat };
}

export function identifier(name: string): StepNode {
  return { type: 'Identifier', name };
}

export function program(body: StepNode[]): StepNode {
  return { type: 'Program', body };
}

export function expressionStatement(expression: StepNode): StepNode {
  return { type: 'ExpressionStatement', expression };
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
    case 'Literal':
    case 'Identifier':
    case 'ArrowFunctionExpression':
    case 'FunctionDeclaration':
      return true;
    case 'ArrayExpression':
      return (node.elements as StepNode[]).every(isValue);
    default:
      return false;
  }
}

/** A callable function value produced by a `lambda` or a single-`return` `def`. */
export function isFunctionValue(node: StepNode): boolean {
  return node.type === 'ArrowFunctionExpression' || node.type === 'FunctionDeclaration';
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
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      out[key] = clone((value as Record<string, unknown>)[key]);
    }
    return out as T;
  }
  return value;
}

/* -------------------------------------------------------------------------- */
/*                              Unparsing                                      */
/* -------------------------------------------------------------------------- */

/**
 * Renders a node back to compact source-ish text. Only used to build human-readable explanations
 * (e.g. `"1 + 2"`); the host does the real rendering, so this need not be perfectly faithful.
 */
export function unparse(node: StepNode | null | undefined): string {
  if (!node) return '';
  switch (node.type) {
    case 'Literal':
      return String(node.raw ?? node.value);
    case 'Identifier':
      return String(node.name);
    case 'BinaryExpression':
    case 'LogicalExpression':
      return `${unparse(node.left as StepNode)} ${node.operator} ${unparse(node.right as StepNode)}`;
    case 'UnaryExpression':
      return `${node.operator}${unparse(node.argument as StepNode)}`;
    case 'ConditionalExpression':
      return `${unparse(node.consequent as StepNode)} if ${unparse(node.test as StepNode)} else ${unparse(node.alternate as StepNode)}`;
    case 'CallExpression':
      return `${unparse(node.callee as StepNode)}(${(node.arguments as StepNode[]).map(unparse).join(', ')})`;
    case 'ArrowFunctionExpression':
      return node.name
        ? String(node.name)
        : `lambda ${(node.params as StepNode[]).map(unparse).join(', ')}: ${unparse(node.body as StepNode)}`;
    case 'FunctionDeclaration':
      return String((node.id as StepNode).name);
    case 'ArrayExpression':
      return `[${(node.elements as StepNode[]).map(unparse).join(', ')}]`;
    default:
      return `<${node.type}>`;
  }
}
