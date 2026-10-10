import type {
  CseSnapshot,
  CseSerializedEnvFrame as SerializedEnvFrame,
  CseSerializedInstruction as SerializedInstruction,
  CseSerializedValue as SerializedValue,
} from "@sourceacademy/common-cse-machine";
import { Closure } from "../../engines/cse/closure";
import { Context } from "../../engines/cse/context";
import { Control } from "../../engines/cse/control";
import { Environment, UNASSIGNED } from "../../engines/cse/environment";
import { generateCSEMachineStateStream } from "../../engines/cse/interpreter";
import { Stash, Value } from "../../engines/cse/stash";
import { InstrType, operatorTranslator, typeTranslator } from "../../engines/cse/types";
import { toPythonFloat } from "../../stdlib/utils";
import { Token, TokenType } from "../../tokenizer";

/**
 * Headings for the frames whose names Python shares with JavaScript (the host would otherwise call
 * them "Program" and "Global"): the program's frame is Python's global (module) scope, and the
 * frame above it holds the builtins. They are told apart by structure, not by name alone, since a
 * function's frame is named after the function (`def programEnvironment(): ...`): the builtins
 * frame is the root, and the program's frame is the one named so that belongs to no call.
 */
function frameLabel(env: Environment): string | undefined {
  if (env.tail === null) return "Built-ins";
  if (env.closure === undefined && env.name === "programEnvironment") return "Global";
  return undefined;
}

type ControlStackItem = {
  instrType?: string;
  env?: Environment;
  kind?: string;
  startToken?: { indexInSource?: number; line?: number; lexeme?: string; synthetic?: boolean };
  endToken?: { indexInSource?: number; line?: number; lexeme?: string; synthetic?: boolean } | null;
  body?: Array<{ kind: string }> | { kind: string; body: Array<{ kind: string }> };
  syntheticLabel?: string;
  numOfArgs?: number;
  numOfElements?: number;
  symbol?: string | TokenType;
  value?: unknown;
};

// ── Value serialisation ───────────────────────────────────────────────────────

// Stable integer ID for each list VALUE object across all snapshots in a run.
// Using a WeakMap keyed on the actual Value object preserves identity: the same
// Python list referenced by multiple bindings gets the same id everywhere, which
// lets the frontend deduplicate it to one DataArray canvas box.
const _listIdMap = new WeakMap<object, number>();
let _listSeq = 0;
function getListId(v: object): number {
  if (!_listIdMap.has(v)) _listIdMap.set(v, ++_listSeq);
  return _listIdMap.get(v)!;
}

// `seen` holds the lists being formatted around `v`: a list that contains itself (`xs[0] = xs`)
// is shown as `[...]` where it recurs, as CPython's repr does.
function formatValue(v: Value, seen: Set<object> = new Set()): string {
  if (v === undefined || v === null) return "None";
  switch (v.type) {
    case "bigint":
      return v.value.toString();
    case "number":
      return toPythonFloat(v.value);
    case "bool":
      return v.value ? "True" : "False";
    case "string":
      return `"${v.value}"`;
    case "none":
      return "None";
    case "complex":
      return v.value.toString();
    case "closure": {
      const cl: Closure = v.closure;
      return cl.node.kind === "FunctionDef" ? cl.node.name.lexeme : "lambda";
    }
    case "function":
      return v.name || "function";
    case "multi_lambda":
      return "lambda";
    case "error":
      return v.message;
    case "list": {
      if (seen.has(v)) return "[...]";
      seen.add(v);
      const items = v.value.slice(0, 4).map(i => formatValue(i, seen));
      seen.delete(v);
      const suffix = v.value.length > 4 ? ", ..." : "";
      return `[${items.join(", ")}${suffix}]`;
    }
    case "builtin":
      // Matches CPython's repr() of a builtin, and what print(print) shows in the REPL.
      return `<built-in function ${v.name}>`;
    case "opaque":
      return `<opaque value>`;
    default:
      v satisfies never;
      return "?";
  }
}

/**
 * Ids for a snapshot's heap objects and frames. The CSE machine leaves both unset: objects are
 * unnamed (no `SerializedValue.objectId`) and frames keep their environments' ids. The e-stepper
 * gives both its own labels (`#3`, `E2`, `Global`), so a host drawing its snapshots can tell which
 * object or frame a reference or bracket in the program pane means. `undefined` falls back to the
 * default.
 */
export interface SnapshotIds {
  /** For `SerializedValue.objectId`: names a list (its Value) or a closure (its `Closure`). */
  objects?: (obj: object) => string | undefined;
  /** For a frame's `id`, and wherever it is referred to (parents, closures, lists). */
  frames?: (env: Environment) => string | undefined;
  /**
   * For a list's `metadata.envId`: the frame the list belongs to, where a host draws it. Without
   * it a list belongs to the frame whose binding is serialized first, so it moves from frame to
   * frame as the active frame changes. A host looks for a list's drawing next to a binding in
   * this frame, so it must be one of the frames serialized.
   */
  homes?: (list: object) => Environment | undefined;
  /**
   * The program's source, for a closure's `metadata.body`: the source of its body, which a host
   * shows when describing the function (otherwise it has only the name and parameters).
   */
  code?: string;
}

const frameId = (env: Environment, ids: SnapshotIds): string => ids.frames?.(env) ?? env.id;

/** The frame a list belongs to: its home if `ids` names one, else the frame being serialized. */
const homeId = (list: object, envId: string, ids: SnapshotIds): string => {
  const home = ids.homes?.(list);
  return home ? frameId(home, ids) : envId;
};

/**
 * The source each function (its AST node) was parsed from. A REPL session evaluates chunk after
 * chunk in one context, so a function defined in an earlier chunk has token positions in that
 * chunk's source, not in the one being evaluated now; `collectSnapshots` records each chunk's
 * functions here.
 */
const functionSources = new WeakMap<object, string>();

/** Records `code` as the source of every function in the AST under `root` (see `functionSources`). */
function recordFunctionSources(root: unknown, code: string): void {
  const seen = new Set<object>();
  const visit = (node: unknown): void => {
    if (typeof node !== "object" || node === null || seen.has(node)) return;
    seen.add(node);
    if (node instanceof Token) return;
    const kind = (node as { kind?: unknown }).kind;
    if (kind === "FunctionDef" || kind === "Lambda" || kind === "MultiLambda") {
      functionSources.set(node, code);
    }
    for (const value of Object.values(node)) visit(value);
  };
  visit(root);
}

type Positioned = { startToken?: Token; endToken?: Token };

/** The tokens in the AST under `root` that span several lines (multi-line strings). */
function multilineTokens(root: unknown): Token[] {
  const tokens = new Set<Token>();
  const seen = new Set<object>();
  const visit = (node: unknown): void => {
    if (typeof node !== "object" || node === null || seen.has(node)) return;
    seen.add(node);
    if (node instanceof Token) {
      if (node.lexeme.includes("\n")) tokens.add(node);
      return;
    }
    for (const value of Object.values(node)) visit(value);
  };
  visit(root);
  return [...tokens];
}

/**
 * The source of a function's body as written, dedented: a `def`'s statements, a lambda's
 * expression. `undefined` when the body has no real source position (e.g. a function the runtime
 * made up), or when its source is unknown (`code` does not hold the body's tokens).
 */
function functionBodySource(node: Closure["node"], fallbackCode: string): string | undefined {
  const code = functionSources.get(node) ?? fallbackCode;
  const body = (node as { body: unknown }).body as Positioned[] | Positioned;
  const parts = Array.isArray(body) ? body : [body];
  const first = parts[0]?.startToken;
  const last = parts[parts.length - 1]?.endToken;
  if (!first || !last || first.synthetic || last.synthetic) return undefined;
  const start = first.indexInSource;
  const end = last.indexInSource + last.lexeme.length;
  if (start < 0 || end <= start || end > code.length) return undefined;
  // Positions from another source (see `functionSources`) would give some unrelated text.
  if (!code.startsWith(first.lexeme, start) || !code.startsWith(last.lexeme, last.indexInSource)) {
    return undefined;
  }
  // The body's first line starts at its first statement; the others still carry the indentation
  // of the body, which is removed — except on lines inside a multi-line string, whose leading
  // whitespace belongs to the string.
  const inString = multilineTokens(body).map(t => [
    t.indexInSource,
    t.indexInSource + t.lexeme.length,
  ]);
  const indent = start - (code.lastIndexOf("\n", start - 1) + 1);
  let offset = start;
  return code
    .slice(start, end)
    .split("\n")
    .map((line, i) => {
      const lineStart = offset;
      offset += line.length + 1;
      if (i === 0 || inString.some(([from, to]) => lineStart > from && lineStart < to)) {
        return line;
      }
      return line.slice(Math.min(indent, line.length - line.trimStart().length));
    })
    .join("\n");
}

/**
 * `path` holds the lists being serialized around `v`. A list that contains itself
 * (`xs[0] = xs`) is serialized once; where it recurs, it is a back reference: the same list `id`,
 * no elements, `backReference: true`. (Hosts look lists up by `id`, so they resolve it to the
 * list itself.)
 */
function serializeValue(
  v: Value | typeof UNASSIGNED,
  envId = "",
  ids: SnapshotIds = {},
  path: Set<object> = new Set(),
): SerializedValue {
  // A local that createEnvironment preallocated at CALL time but that hasn't been
  // assigned yet — mirrors js-slang's uninitialized-`const`/`let` placeholder rendering.
  if (v === UNASSIGNED) return { displayValue: "", label: "unassigned" };
  if (v === undefined || v === null) return { displayValue: "None", label: "NoneType" };
  const base = { displayValue: formatValue(v), label: typeTranslator(v.type) };
  if (v.type === "closure") {
    const cl = v.closure;
    const funcName = cl.node.kind === "FunctionDef" ? cl.node.name.lexeme : "lambda";
    const params = cl.node.parameters.map((p: { lexeme: string }) => p.lexeme);
    const body = ids.code === undefined ? undefined : functionBodySource(cl.node, ids.code);
    return withObjectId(
      {
        ...base,
        metadata: { closureFrameId: frameId(cl.environment, ids), params, funcName, body },
      },
      ids.objects?.(cl),
    );
  }
  if (v.type === "list") {
    if (path.has(v)) {
      return withObjectId(
        {
          displayValue: "[...]",
          label: "list",
          metadata: {
            id: getListId(v),
            envId: homeId(v, envId, ids),
            elements: [],
            backReference: true,
          },
        },
        ids.objects?.(v),
      );
    }
    path.add(v);
    const elements = v.value.map((el: Value) => serializeValue(el, envId, ids, path));
    path.delete(v);
    return withObjectId(
      {
        displayValue: formatValue(v),
        label: "list",
        metadata: { id: getListId(v), envId: homeId(v, envId, ids), elements },
      },
      ids.objects?.(v),
    );
  }
  return base;
}

function withObjectId(value: SerializedValue, objectId: string | undefined): SerializedValue {
  return objectId === undefined ? value : { ...value, objectId };
}

// ── Control serialisation ─────────────────────────────────────────────────────

// Friendly fallback labels for AST node kinds that have no source tokens.
const KIND_LABELS: Record<string, string> = {
  FileInput: "program",
  FunctionDef: "def",
  Lambda: "lambda",
  Assign: "assign",
  Return: "return",
  SimpleExpr: "expr",
  If: "if",
  While: "while",
  For: "for",
  Binary: "bin op",
  Unary: "unary op",
  Compare: "cmp",
  BoolOp: "bool op",
  Ternary: "ternary",
  Call: "call",
  Variable: "var",
  Literal: "literal",
  BigIntLiteral: "int",
  None: "None",
  List: "list",
  Subscript: "index",
  Starred: "starred",
  StatementSequence: "stmts",
  Grouping: "group",
  FromImport: "import",
  Pass: "pass",
  Break: "break",
  Continue: "continue",
};

// Map py-slang InstrType string values → js-slang InstrType string values so the
// frontend animation system can dispatch on the correct type.  Values that differ
// between the two enum declarations are listed; identical values fall through.
const PY_TO_JS_INSTR_TYPE: Partial<Record<InstrType, string>> = {
  [InstrType.APPLICATION]: "Application",
  [InstrType.ASSIGNMENT]: "Assignment",
  [InstrType.BINARY_OP]: "BinaryOperation",
  [InstrType.BOOL_OP]: "BinaryOperation", // no separate BoolOp in js-slang
  [InstrType.UNARY_OP]: "UnaryOperation",
  [InstrType.POP]: "Pop",
  [InstrType.BRANCH]: "Branch",
  [InstrType.WHILE]: "While", // py: "WhileInstr" → js: "While"
  [InstrType.FOR]: "For", // py: "ForInstr"   → js: "For"
  [InstrType.LIST]: "ArrayLiteral", // py: "ListLiteral" → js: "ArrayLiteral"
  [InstrType.LIST_ACCESS]: "ArrayAccess", // py: "ListAccess"  → js: "ArrayAccess"
  [InstrType.LIST_ASSIGNMENT]: "ArrayAssignment", // py: "ListAssignment" → js: "ArrayAssignment"
  [InstrType.CONTINUE_MARKER]: "ContinueMarker", // py: "continueMarker" → js: "ContinueMarker"
  [InstrType.BREAK]: "Break", // py: "BreakInstr"  → js: "Break"
  [InstrType.CONTINUE]: "Continue", // py: "ContinueInstr" → js: "Continue"
  [InstrType.MODULE_FUNCTION_CALL]: "ModuleFunctionCall",
};

// Map py-slang AST node kinds → js-slang ESTree node type names so the animation
// system dispatches the right animation (ControlExpansionAnimation, LookupAnimation, etc.).
const PY_TO_JS_NODE_TYPE: Record<string, string> = {
  FileInput: "StatementSequence",
  StatementSequence: "StatementSequence",
  FunctionDef: "FunctionDeclaration",
  Lambda: "ArrowFunctionExpression",
  Return: "ReturnStatement",
  Assign: "VariableDeclaration",
  If: "IfStatement",
  While: "WhileStatement",
  For: "ForStatement",
  Binary: "BinaryExpression",
  Compare: "BinaryExpression",
  BoolOp: "BinaryExpression",
  Unary: "UnaryExpression",
  Call: "CallExpression",
  Variable: "Identifier",
  Literal: "Literal",
  BigIntLiteral: "Literal",
  None: "Literal",
  List: "ArrayExpression",
  Subscript: "MemberExpression",
  Ternary: "ConditionalExpression",
  SimpleExpr: "ExpressionStatement",
  Grouping: "ExpressionStatement",
};

function instrDisplayText(item: ControlStackItem): string {
  switch (item.instrType as InstrType) {
    case InstrType.END_OF_FUNCTION_BODY:
      return "return None";
    case InstrType.POP:
      return "pop";
    case InstrType.CONTINUE_MARKER:
      return "mark";
    case InstrType.CONTINUE:
      return "continue";
    case InstrType.BREAK:
      return "break";
    case InstrType.BRANCH:
      return "branch";
    case InstrType.WHILE:
      return "while";
    case InstrType.FOR:
      return "for";
    case InstrType.LIST:
      return `arr lit ${item.numOfElements}`;
    case InstrType.LIST_ACCESS:
      return "arr acc";
    case InstrType.LIST_ASSIGNMENT:
      return "arr asgn";
    case InstrType.ASSIGNMENT:
      return `asgn ${item.symbol}`;
    case InstrType.APPLICATION:
      return `call ${item.numOfArgs}`;
    case InstrType.UNARY_OP:
    case InstrType.BINARY_OP:
    case InstrType.BOOL_OP:
      return operatorTranslator(item.symbol!);
    case InstrType.MODULE_FUNCTION_CALL:
      return `mod call ${item.numOfArgs}`;
    default:
      return String(item.instrType);
  }
}

function serializeControlItem(item: ControlStackItem, code: string): SerializedInstruction {
  // Instructions have 'instrType'.
  if (item.instrType !== undefined) {
    if (item.instrType === InstrType.ENVIRONMENT && item.env?.id !== undefined) {
      return { displayText: "ENVIRONMENT", metadata: { envId: item.env.id } };
    }
    const jsInstrType = PY_TO_JS_INSTR_TYPE[item.instrType as InstrType];
    const meta: Record<string, unknown> = {};
    if (jsInstrType !== undefined) {
      meta.instrType = jsInstrType;
    }
    // Extra fields consumed by specific animations.
    if (item.instrType === InstrType.APPLICATION && item.numOfArgs !== undefined) {
      meta.numOfArgs = item.numOfArgs;
    }
    if (item.instrType === InstrType.MODULE_FUNCTION_CALL && item.numOfArgs !== undefined) {
      meta.numOfArgs = item.numOfArgs;
    }
    if (item.instrType === InstrType.ASSIGNMENT && item.symbol !== undefined) {
      meta.symbol = item.symbol;
    }
    if (
      (item.instrType === InstrType.BINARY_OP ||
        item.instrType === InstrType.BOOL_OP ||
        item.instrType === InstrType.UNARY_OP) &&
      item.symbol !== undefined
    ) {
      meta.symbol = operatorTranslator(item.symbol);
    }
    if (item.instrType === InstrType.LIST && item.numOfElements !== undefined) {
      meta.arity = item.numOfElements;
    }
    return Object.keys(meta).length > 0
      ? { displayText: instrDisplayText(item), metadata: meta }
      : { displayText: instrDisplayText(item) };
  }

  // AST nodes have 'kind' and startToken/endToken with source positions.
  if (item.kind !== undefined) {
    const start: number = item.startToken?.indexInSource ?? -1;
    const endTok = item.endToken;
    const end: number =
      endTok != null && endTok.indexInSource !== undefined
        ? endTok.indexInSource + (endTok.lexeme?.length ?? 0)
        : -1;
    // Synthetic nodes generated at runtime (e.g. loop range BigIntLiterals) carry tokens
    // explicitly marked `synthetic` — they don't correspond to real source text, even
    // when their indexInSource coincides with a genuine position (e.g. 0, the very first
    // token of the file). Do not infer syntheticness from position alone.
    const isRealSourceNode = !item.startToken?.synthetic && !endTok?.synthetic;
    let displayText: string;
    let loc: { startLine: number; endLine: number } | undefined;
    if (start >= 0 && end > start && end <= code.length && isRealSourceNode) {
      displayText = code.slice(start, end).trim();
      // Token.line is 1-based (matches ESTree convention expected by ControlStack).
      const startLine: number | undefined = item.startToken?.line;
      const endLine: number | undefined = endTok?.line;
      if (startLine !== undefined) {
        loc = { startLine, endLine: endLine ?? startLine };
      }
    } else if (item.kind === "BigIntLiteral" && item.value !== undefined) {
      // Synthetic BigIntLiteral (implicit range start/step) — show its value.
      displayText = String(item.value);
    } else {
      displayText = KIND_LABELS[item.kind] ?? `<${item.kind}>`;
    }
    if (item.syntheticLabel) {
      displayText = item.syntheticLabel;
    }

    const jsNodeType = PY_TO_JS_NODE_TYPE[item.kind];
    const nodeMeta: Record<string, unknown> = {};
    if (loc) {
      nodeMeta.startLine = loc.startLine;
      nodeMeta.endLine = loc.endLine;
    }
    if (jsNodeType !== undefined) {
      nodeMeta.nodeType = jsNodeType;
    }
    // For block-like nodes pass body length and child types so the adapter can build
    // stub body arrays (used by ControlExpansionAnimation / StatementSequence handling).
    if (
      (jsNodeType === "StatementSequence" ||
        jsNodeType === "FunctionDeclaration" ||
        jsNodeType === "ArrowFunctionExpression") &&
      item.body !== undefined
    ) {
      const body =
        item.body !== undefined &&
        item.body !== null &&
        "body" in item.body &&
        jsNodeType === "StatementSequence"
          ? item.body.body
          : item.body;
      const bodyArray = Array.isArray(body) ? body : [body];
      nodeMeta.bodyLength = bodyArray.length;
      nodeMeta.bodyNodeTypes = bodyArray.map(n => PY_TO_JS_NODE_TYPE[n.kind] ?? "Identifier");
    }

    // Expression statements ("1 + 2" as a bare statement) are indistinguishable from a
    // plain sub-expression once pushed — the machine only reveals it was a statement
    // later, when the "pop" instruction that discards its value appears (issue #270).
    // Tag it so the visualizer can mark it distinctly (e.g. a different color) up front.
    const tag = item.kind === "SimpleExpr" ? "expressionStatement" : undefined;

    const result: SerializedInstruction = { displayText };
    if (Object.keys(nodeMeta).length > 0) result.metadata = nodeMeta;
    if (tag) result.tag = tag;
    return result;
  }

  return { displayText: "<unknown>" };
}

// ── Environment serialisation ─────────────────────────────────────────────────

function serializeEnvChain(
  environments: Environment[],
  stashValues: Value[],
  controlItems: ControlStackItem[],
  activeEnv: Environment,
  ids: SnapshotIds = {},
): SerializedEnvFrame[] {
  const seen = new Set<string>();
  const queue: Environment[] = [];

  // BFS — visit env + its tail chain, then recursively follow any closure environments
  // found in its head bindings. This ensures closure environments that have already
  // returned (and are no longer on the active call stack) still appear in the snapshot.
  const visit = (env: Environment | null | undefined) => {
    if (!env || seen.has(env.id)) return;
    seen.add(env.id);
    queue.push(env);
    visit(env.tail);
    for (const val of Object.values(env.head)) {
      if (val && val !== UNASSIGNED && val.type === "closure") visit(val.closure?.environment);
    }
  };

  for (const env of environments) visit(env);

  // Also follow closures sitting on the stash whose environments may not be on the active stack
  for (const item of stashValues) {
    if (item && item.type === "closure") visit(item.closure.environment);
  }

  // ENV instructions on the control stack keep frames alive that are not on the
  // call stack right now (e.g. h's frame while g(x) is executing inside h).
  // Without this seed, those frames die and then "resurrect" when control returns —
  // violating the invariant that dead frames never come back.
  for (const item of controlItems) {
    if (item.instrType === "environment" && item.env) {
      visit(item.env);
    }
  }

  const callStackIds = new Set(environments.map(e => e.id));

  // Walk up the tail chain skipping any filtered frames to find the visible parent.
  const visibleParentId = (env: Environment): string | null => {
    let cur = env.tail;
    while (cur) {
      if (cur.name !== "prelude") return frameId(cur, ids);
      cur = cur.tail;
    }
    return null;
  };

  return queue
    .filter(env => env.name !== "prelude")
    .map(
      (env): SerializedEnvFrame => ({
        id: frameId(env, ids),
        name: env.name,
        label: frameLabel(env),
        parentId: visibleParentId(env),
        closureFrameId: env.closure?.environment
          ? frameId(env.closure.environment, ids)
          : undefined,
        bindings: Object.entries(env.head)
          .filter(([name]) => name !== "__program__")
          .map(([name, val]) => ({
            name,
            value: serializeValue(val, frameId(env, ids), ids),
          })),
        isActive: env.id === activeEnv.id,
        isOnCallStack: callStackIds.has(env.id),
        globalNames: env.closure?.globalVariables.size
          ? [...env.closure.globalVariables]
          : undefined,
      }),
    );
}

// ── Snapshot collection ───────────────────────────────────────────────────────

export async function collectSnapshots(
  context: Context,
  control: Control,
  stash: Stash,
  stepLimit: number,
  variant: number,
  code: string,
  maxSnapshots: number = 1000,
): Promise<{ snapshots: CseSnapshot[]; breakpointSteps: number[] }> {
  const snapshots: CseSnapshot[] = [];
  // Runtime-fabricated nodes (e.g. implicit range() bounds, the for-loop increment —
  // see utils.ts's evaluateForIterator/generateForIncrement) carry tokens pinned to
  // line 0, since they don't correspond to any line the user actually wrote. Real
  // tokens are always 1-based (see parser/token-bridge.ts), so line 0 is an
  // unambiguous "not a real line" signal. Keep showing the last real line instead of
  // flickering to 0 while these synthetic nodes are being evaluated.
  let lastKnownLine: number | undefined;

  // This chunk's functions keep this chunk's source, for their bodies in later chunks' snapshots.
  recordFunctionSources(control.getStack(), code);

  const stream = generateCSEMachineStateStream(
    code,
    context,
    control,
    stash,
    stepLimit,
    1024,
    variant,
    false,
  );

  for await (const { stash: s, control: c, steps } of stream) {
    // maxSnapshots === 0 → run the program to completion (for stdout/errors) but
    // collect nothing. Used for chapters where the CSE machine is disabled.
    if (maxSnapshots === 0) continue;
    if (snapshots.length >= maxSnapshots) break;

    const activeEnv = context.runtime.environments[0];
    const rawControlStack = c.getStack() as unknown as ControlStackItem[];
    const controlItems = rawControlStack
      .slice()
      .reverse()
      .map(item => serializeControlItem(item, code));
    const stashItems = s
      .getStack()
      .slice()
      .reverse()
      .map(sv => serializeValue(sv, activeEnv.id, { code }));
    const environments = serializeEnvChain(
      context.runtime.environments,
      s.getStack(),
      rawControlStack,
      activeEnv,
      { code },
    );

    // The node most recently evaluated at this step. Mirrors the non-conductor CSE
    // machine's updateInspector, which reads context.runtime.nodes[0] for the blue
    // "current line" highlight. py-slang nodes carry a 1-based startToken.line.
    const currentNode = context.runtime.nodes[0] as { startToken?: { line?: number } } | undefined;
    const rawLine = currentNode?.startToken?.line;
    if (rawLine) {
      lastKnownLine = rawLine;
    }

    snapshots.push({
      stepIndex: steps - 1,
      control: controlItems,
      stash: stashItems,
      environments,
      currentLine: lastKnownLine,
    });
  }

  // context.runtime.breakpointSteps is recorded by the interpreter regardless of the
  // maxSnapshots cutoff above; filter out any indices past what was actually collected so the
  // host never gets pointed at a step with no corresponding snapshot.
  const breakpointSteps = context.runtime.breakpointSteps.filter(step => step < snapshots.length);

  return { snapshots, breakpointSteps };
}

// The runner-side plugin that transports these snapshots now lives in
// @sourceacademy/runner-cse-machine (CseMachinePlugin). This module only owns the
// Python-specific serialization of control/stash/environment into CseSnapshots.

// Exported for unit testing only — not part of the public API.
export { formatValue, instrDisplayText, serializeControlItem, serializeEnvChain, serializeValue };
