import { Context } from "../../engines/cse/context";
import { Control } from "../../engines/cse/control";
import { generateCSEMachineStateStream } from "../../engines/cse/interpreter";
import { Stash, Value } from "../../engines/cse/stash";
import { InstrType, operatorTranslator, typeTranslator } from "../../engines/cse/types";
import { toPythonFloat } from "../../stdlib/utils";
import { Environment } from "../../engines/cse/environment";
import { Closure } from "../../engines/cse/closure";
import type {
  CseSnapshot,
  CseSerializedEnvFrame as SerializedEnvFrame,
  CseSerializedInstruction as SerializedInstruction,
  CseSerializedValue as SerializedValue,
} from "@sourceacademy/common-cse-machine";

type ControlStackItem = {
  instrType?: string;
  env?: Environment;
  kind?: string;
  startToken?: { indexInSource?: number; line?: number; lexeme?: string };
  endToken?: { indexInSource?: number; line?: number; lexeme?: string } | null;
  body?: Array<{ kind: string }>;
  syntheticLabel?: string;
  numOfArgs?: number;
  numOfElements?: number;
  symbol?: string;
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

function formatValue(v: Value): string {
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
      const items = v.value.slice(0, 4).map(i => formatValue(i));
      const suffix = v.value.length > 4 ? ", ..." : "";
      return `[${items.join(", ")}${suffix}]`;
    }
    case "builtin":
      return `<built-in function ${v.name}>`;
    default:
      v satisfies never;
      return "?";
  }
}

function serializeValue(v: Value, envId = ""): SerializedValue {
  if (v === undefined || v === null) return { displayValue: "None", label: "NoneType" };
  const base = { displayValue: formatValue(v), label: typeTranslator(v.type) };
  if (v.type === "closure") {
    const cl = v.closure;
    const funcName = cl.node.kind === "FunctionDef" ? cl.node.name.lexeme : "lambda";
    const params = cl.node.parameters.map((p: { lexeme: string }) => p.lexeme);
    return { ...base, metadata: { closureFrameId: cl.environment.id, params, funcName } };
  }
  if (v.type === "list") {
    return {
      displayValue: formatValue(v),
      label: "list",
      metadata: {
        id: getListId(v),
        envId,
        elements: v.value.map((el: Value) => serializeValue(el, envId)),
      },
    };
  }
  return base;
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
  [InstrType.RESET]: "Reset",
  [InstrType.LIST]: "ArrayLiteral", // py: "ListLiteral" → js: "ArrayLiteral"
  [InstrType.LIST_ACCESS]: "ArrayAccess", // py: "ListAccess"  → js: "ArrayAccess"
  [InstrType.LIST_ASSIGNMENT]: "ArrayAssignment", // py: "ListAssignment" → js: "ArrayAssignment"
  [InstrType.CONTINUE_MARKER]: "ContinueMarker", // py: "continueMarker" → js: "ContinueMarker"
  [InstrType.BREAK]: "Break", // py: "BreakInstr"  → js: "Break"
  [InstrType.CONTINUE]: "Continue", // py: "ContinueInstr" → js: "Continue"
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
    case InstrType.RESET:
      return "return";
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
    const end: number = endTok != null ? endTok.indexInSource + (endTok.lexeme?.length ?? 0) : -1;
    // Synthetic nodes generated at runtime (e.g. loop range BigIntLiterals) have both
    // tokens pinned to position 0. Require start > 0 OR end token at a real position
    // to guard against slicing the wrong source text.
    const isRealSourceNode = start > 0 || (endTok?.indexInSource ?? 0) > 0;
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
      jsNodeType === "StatementSequence" ||
      jsNodeType === "FunctionDeclaration" ||
      jsNodeType === "ArrowFunctionExpression"
    ) {
      const body = Array.isArray(item.body) ? item.body : [];
      nodeMeta.bodyLength = body.length;
      nodeMeta.bodyNodeTypes = body.map(n => PY_TO_JS_NODE_TYPE[n.kind] ?? "Identifier");
    }

    return Object.keys(nodeMeta).length > 0 ? { displayText, metadata: nodeMeta } : { displayText };
  }

  return { displayText: "<unknown>" };
}

// ── Environment serialisation ─────────────────────────────────────────────────

function serializeEnvChain(
  environments: Environment[],
  stashValues: Value[],
  controlItems: ControlStackItem[],
  activeEnv: Environment,
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
      if (val && val.type === "closure") visit(val.closure?.environment);
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
      if (cur.name !== "prelude") return cur.id;
      cur = cur.tail;
    }
    return null;
  };

  return queue
    .filter(env => env.name !== "prelude")
    .map(env => ({
      id: env.id,
      name: env.name,
      parentId: visibleParentId(env),
      closureFrameId: env.closure?.environment?.id,
      bindings: Object.entries(env.head)
        .filter(([name]) => name !== "__program__")
        .map(([name, val]) => ({
          name,
          value: serializeValue(val, env.id),
        })),
      isActive: env.id === activeEnv.id,
      isOnCallStack: callStackIds.has(env.id),
    }));
}

// ── Snapshot collection ───────────────────────────────────────────────────────

export async function collectSnapshots(
  context: Context,
  control: Control,
  stash: Stash,
  envSteps: number,
  stepLimit: number,
  variant: number,
  code: string,
  maxSnapshots: number = 1000,
): Promise<CseSnapshot[]> {
  const snapshots: CseSnapshot[] = [];

  const stream = generateCSEMachineStateStream(
    code,
    context,
    control,
    stash,
    envSteps,
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
    const rawControlStack = c.getStack();
    const controlItems = rawControlStack
      .slice()
      .reverse()
      .map(item => serializeControlItem(item, code));
    const stashItems = s
      .getStack()
      .slice()
      .reverse()
      .map(sv => serializeValue(sv, activeEnv.id));
    const environments = serializeEnvChain(
      context.runtime.environments,
      s.getStack(),
      rawControlStack,
      activeEnv,
    );

    // The node most recently evaluated at this step. Mirrors the non-conductor CSE
    // machine's updateInspector, which reads context.runtime.nodes[0] for the blue
    // "current line" highlight. py-slang nodes carry a 1-based startToken.line.
    const currentNode = context.runtime.nodes[0] as { startToken?: { line?: number } } | undefined;
    const currentLine: number | undefined = currentNode?.startToken?.line;

    snapshots.push({
      stepIndex: steps - 1,
      control: controlItems,
      stash: stashItems,
      environments,
      currentLine,
    });
  }

  return snapshots;
}

// The runner-side plugin that transports these snapshots now lives in
// @sourceacademy/runner-cse-machine (CseMachinePlugin). This module only owns the
// Python-specific serialization of control/stash/environment into CseSnapshots.
