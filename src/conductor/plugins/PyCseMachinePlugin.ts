import { IChannel, IConduit, IPlugin } from "@sourceacademy/conductor/conduit";
import { Context } from "../../engines/cse/context";
import { Control } from "../../engines/cse/control";
import { generateCSEMachineStateStream } from "../../engines/cse/interpreter";
import { Stash, Value } from "../../engines/cse/stash";
import { InstrType, operatorTranslator, typeTranslator } from "../../engines/cse/types";
import { Environment } from "../../engines/cse/environment";
import { Closure } from "../../engines/cse/closure";
import {
  CSE_CHANNEL,
  CSE_MESSAGE_TYPE_SNAPSHOTS,
  CseSnapshot,
  CseSnapshotMessage,
  SerializedBinding,
  SerializedEnvFrame,
  SerializedInstruction,
  SerializedValue,
} from "./CseSnapshot";

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

function formatValue(v: Value, depth = 0): string {
  if (depth > 2) return "...";
  switch (v.type) {
    case "bigint":
      return v.value.toString();
    case "number":
      return String(v.value);
    case "bool":
      return v.value ? "True" : "False";
    case "string":
      return `"${v.value}"`;
    case "none":
      return "None";
    case "complex":
      return `${v.value.real}+${v.value.imag}j`;
    case "closure": {
      const cl: Closure = v.closure;
      const name = cl.node.kind === "FunctionDef" ? cl.node.name.lexeme : "lambda";
      const params = cl.node.parameters.map(p => p.lexeme).join(", ");
      return `${name}(${params})`;
    }
    case "list": {
      const items = v.value.slice(0, 4).map(i => formatValue(i, depth + 1));
      const suffix = v.value.length > 4 ? ", ..." : "";
      return `[${items.join(", ")}${suffix}]`;
    }
    case "builtin":
      return `<builtin ${v.name}>`;
    default:
      return String((v as any).value ?? "?");
  }
}

function serializeValue(v: Value, envId = ""): SerializedValue {
  const base = { displayValue: formatValue(v), label: typeTranslator(v.type) };
  if (v.type === "closure") {
    const cl = v.closure;
    const funcName = cl.node.kind === "FunctionDef" ? cl.node.name.lexeme : "lambda";
    const params = cl.node.parameters.map((p: any) => p.lexeme);
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

function instrDisplayText(item: any): string {
  switch (item.instrType as InstrType) {
    case InstrType.RESET:
      return "return";
    case InstrType.END_OF_FUNCTION_BODY:
      return "end fn body";
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
      return operatorTranslator(item.symbol);
    default:
      return String(item.instrType);
  }
}

function serializeControlItem(item: any, code: string): SerializedInstruction {
  // Instructions have 'instrType'.
  if (item.instrType !== undefined) {
    if (item.instrType === InstrType.ENVIRONMENT && item.env?.id !== undefined) {
      return { displayText: "ENVIRONMENT", metadata: { envId: item.env.id as string } };
    }
    return { displayText: instrDisplayText(item) };
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
      displayText = item.syntheticLabel as string;
    }
    return loc ? { displayText, metadata: loc } : { displayText };
  }

  return { displayText: "<unknown>" };
}

// ── Environment serialisation ─────────────────────────────────────────────────

function serializeEnvChain(
  environments: Environment[],
  stashValues: Value[],
  controlItems: any[],
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
      if ((val as any)?.type === "closure") visit((val as any).closure?.environment);
    }
  };

  for (const env of environments) visit(env);

  // Also follow closures sitting on the stash whose environments may not be on the active stack
  for (const item of stashValues) {
    if (item.type === "closure") visit(item.closure.environment);
  }

  // ENV instructions on the control stack keep frames alive that are not on the
  // call stack right now (e.g. h's frame while g(x) is executing inside h).
  // Without this seed, those frames die and then "resurrect" when control returns —
  // violating the invariant that dead frames never come back.
  for (const item of controlItems) {
    if ((item as any)?.instrType === "environment" && (item as any)?.env) {
      visit((item as any).env as Environment);
    }
  }

  const callStackIds = new Set(environments.map(e => e.id));

  return queue.map(env => ({
    id: env.id,
    name: env.name,
    parentId: env.tail?.id ?? null,
    closureFrameId: env.closure?.environment?.id,
    bindings: Object.entries(env.head).map(([name, val]) => ({
      name,
      value: serializeValue(val as Value, env.id),
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
): Promise<CseSnapshot[]> {
  const snapshots: CseSnapshot[] = [];

  const stream = generateCSEMachineStateStream(
    code,
    context,
    control,
    stash,
    envSteps,
    stepLimit,
    variant,
    false,
  );

  for await (const { stash: s, control: c, steps } of stream) {
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

    snapshots.push({
      stepIndex: steps - 1,
      control: controlItems,
      stash: stashItems,
      environments,
    });
  }

  return snapshots;
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export class PyCseMachinePlugin implements IPlugin {
  readonly id = "__cse_runner";

  private readonly __cseChannel: IChannel<CseSnapshotMessage>;

  sendSnapshots(snapshots: CseSnapshot[]): void {
    this.__cseChannel.send({
      type: CSE_MESSAGE_TYPE_SNAPSHOTS,
      snapshots,
      totalSteps: snapshots.length,
    });
  }

  static readonly channelAttach = [CSE_CHANNEL];
  constructor(_conduit: IConduit, [cseChannel]: IChannel<any>[]) {
    this.__cseChannel = cseChannel;
  }
}
