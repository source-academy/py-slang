/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  collectSnapshots,
  formatValue,
  instrDisplayText,
  serializeControlItem,
  serializeEnvChain,
  serializeValue,
} from "../conductor/plugins/PyCseMachinePlugin";
import { Context } from "../engines/cse/context";
import { Control } from "../engines/cse/control";
import type { Value } from "../engines/cse/stash";
import { Stash } from "../engines/cse/stash";
import { InstrType } from "../engines/cse/types";
import { parse } from "../parser/parser-adapter";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import { TokenType } from "../tokenizer";
import { PyComplexNumber } from "../types/value-types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const bigint = (v: bigint): Value => ({ type: "bigint", value: v });
const number = (v: number): Value => ({ type: "number", value: v });
const bool = (v: boolean): Value => ({ type: "bool", value: v });
const str = (v: string): Value => ({ type: "string", value: v });
const none = (): Value => ({ type: "none" });
const error = (msg: string): Value => ({ type: "error", message: msg });
const list = (...items: Value[]): Value => ({ type: "list", value: items });
const builtin = (name: string): Value => ({
  type: "builtin",
  name,
  func: () => undefined,
  minArgs: 0,
});

/** Minimal env frame for serializeEnvChain tests. */
function makeEnv(id: string, name: string, head: Record<string, Value> = {}, tail: any = null) {
  return { id, name, head, tail, closure: null } as any;
}

/** Run Python code through a fresh context and collect CSE snapshots. */
async function runAndCollect(code: string, variant = 3) {
  const ctx = new Context();
  for (const [name, val] of [...math.builtins, ...misc.builtins]) {
    ctx.nativeStorage.builtins.set(name, val);
  }
  const script = code + "\n";
  const ast = parse(script);
  const control = new Control(ast);
  const stash = new Stash();
  return collectSnapshots(ctx, control, stash, 100000, -1, variant, script);
}

// ── formatValue ───────────────────────────────────────────────────────────────

describe("formatValue", () => {
  it("formats bigint", () => {
    expect(formatValue(bigint(42n))).toBe("42");
  });

  it("formats negative bigint", () => {
    expect(formatValue(bigint(-7n))).toBe("-7");
  });

  it("formats integer float as Python float", () => {
    expect(formatValue(number(3))).toBe("3.0");
  });

  it("formats float with decimal", () => {
    expect(formatValue(number(3.14))).toBe("3.14");
  });

  it("formats True", () => {
    expect(formatValue(bool(true))).toBe("True");
  });

  it("formats False", () => {
    expect(formatValue(bool(false))).toBe("False");
  });

  it("formats string with double quotes", () => {
    expect(formatValue(str("hello"))).toBe('"hello"');
  });

  it("formats None value type", () => {
    expect(formatValue(none())).toBe("None");
  });

  it("formats null as None", () => {
    expect(formatValue(null as any)).toBe("None");
  });

  it("formats undefined as None", () => {
    expect(formatValue(undefined as any)).toBe("None");
  });

  it("formats error message", () => {
    expect(formatValue(error("division by zero"))).toBe("division by zero");
  });

  it("formats builtin function", () => {
    expect(formatValue(builtin("abs"))).toBe("<built-in function abs>");
  });

  it("formats short list", () => {
    expect(formatValue(list(bigint(1n), bigint(2n), bigint(3n)))).toBe("[1, 2, 3]");
  });

  it("formats long list with ellipsis after 4 elements", () => {
    const v = list(bigint(1n), bigint(2n), bigint(3n), bigint(4n), bigint(5n));
    expect(formatValue(v)).toBe("[1, 2, 3, 4, ...]");
  });

  it("formats empty list", () => {
    expect(formatValue(list())).toBe("[]");
  });

  it("formats complex number", () => {
    const complex: Value = { type: "complex", value: new PyComplexNumber(1, 2) };
    expect(formatValue(complex)).toBe(new PyComplexNumber(1, 2).toString());
  });
});

// ── serializeValue ────────────────────────────────────────────────────────────

describe("serializeValue", () => {
  it("serializes bigint with label", () => {
    const v = serializeValue(bigint(10n));
    expect(v.displayValue).toBe("10");
    expect(v.label).toBe("int");
  });

  it("serializes float", () => {
    const v = serializeValue(number(2.5));
    expect(v.displayValue).toBe("2.5");
    expect(v.label).toBe("float");
  });

  it("serializes bool", () => {
    const v = serializeValue(bool(true));
    expect(v.displayValue).toBe("True");
    expect(v.label).toBe("bool");
  });

  it("serializes string", () => {
    const v = serializeValue(str("hi"));
    expect(v.displayValue).toBe('"hi"');
    expect(v.label).toBe("str");
  });

  it("serializes None", () => {
    const v = serializeValue(none());
    expect(v.displayValue).toBe("None");
    expect(v.label).toBe("NoneType");
  });

  it("serializes null as NoneType", () => {
    const v = serializeValue(null as any);
    expect(v.displayValue).toBe("None");
    expect(v.label).toBe("NoneType");
  });

  it("serializes list with metadata id and elements", () => {
    const v = serializeValue(list(bigint(1n), bigint(2n)));
    expect(v.label).toBe("list");
    expect(v.metadata).toBeDefined();
    const meta = v.metadata as any;
    expect(typeof meta.id).toBe("number");
    expect(meta.elements).toHaveLength(2);
    expect(meta.elements[0].displayValue).toBe("1");
  });

  it("gives the same list the same id across two serializations", () => {
    const l: Value = list(bigint(1n));
    const v1 = serializeValue(l);
    const v2 = serializeValue(l);
    expect((v1.metadata as any).id).toBe((v2.metadata as any).id);
  });

  it("serializes builtin", () => {
    const v = serializeValue(builtin("print"));
    expect(v.displayValue).toBe("<built-in function print>");
  });
});

// ── instrDisplayText ──────────────────────────────────────────────────────────

describe("instrDisplayText", () => {
  it("RESET → 'return'", () => {
    expect(instrDisplayText({ instrType: InstrType.RESET })).toBe("return");
  });

  it("END_OF_FUNCTION_BODY → 'return None'", () => {
    expect(instrDisplayText({ instrType: InstrType.END_OF_FUNCTION_BODY })).toBe("return None");
  });

  it("POP → 'pop'", () => {
    expect(instrDisplayText({ instrType: InstrType.POP })).toBe("pop");
  });

  it("BRANCH → 'branch'", () => {
    expect(instrDisplayText({ instrType: InstrType.BRANCH })).toBe("branch");
  });

  it("WHILE → 'while'", () => {
    expect(instrDisplayText({ instrType: InstrType.WHILE })).toBe("while");
  });

  it("FOR → 'for'", () => {
    expect(instrDisplayText({ instrType: InstrType.FOR })).toBe("for");
  });

  it("BREAK → 'break'", () => {
    expect(instrDisplayText({ instrType: InstrType.BREAK })).toBe("break");
  });

  it("CONTINUE → 'continue'", () => {
    expect(instrDisplayText({ instrType: InstrType.CONTINUE })).toBe("continue");
  });

  it("CONTINUE_MARKER → 'mark'", () => {
    expect(instrDisplayText({ instrType: InstrType.CONTINUE_MARKER })).toBe("mark");
  });

  it("LIST_ACCESS → 'arr acc'", () => {
    expect(instrDisplayText({ instrType: InstrType.LIST_ACCESS })).toBe("arr acc");
  });

  it("LIST_ASSIGNMENT → 'arr asgn'", () => {
    expect(instrDisplayText({ instrType: InstrType.LIST_ASSIGNMENT })).toBe("arr asgn");
  });

  it("LIST with numOfElements", () => {
    expect(instrDisplayText({ instrType: InstrType.LIST, numOfElements: 3 })).toBe("arr lit 3");
  });

  it("APPLICATION with numOfArgs", () => {
    expect(instrDisplayText({ instrType: InstrType.APPLICATION, numOfArgs: 2 })).toBe("call 2");
  });

  it("ASSIGNMENT with symbol", () => {
    expect(instrDisplayText({ instrType: InstrType.ASSIGNMENT, symbol: "x" })).toBe("asgn x");
  });

  it("BINARY_OP with TokenType.PLUS → '+'", () => {
    expect(instrDisplayText({ instrType: InstrType.BINARY_OP, symbol: TokenType.PLUS })).toBe("+");
  });

  it("UNARY_OP with TokenType.MINUS → '-'", () => {
    expect(instrDisplayText({ instrType: InstrType.UNARY_OP, symbol: TokenType.MINUS })).toBe("-");
  });

  it("BOOL_OP with TokenType.AND → 'and'", () => {
    expect(instrDisplayText({ instrType: InstrType.BOOL_OP, symbol: TokenType.AND })).toBe("and");
  });
});

// ── serializeControlItem ──────────────────────────────────────────────────────

describe("serializeControlItem", () => {
  const code = "x = 1 + 2\n";

  it("unknown item → '<unknown>'", () => {
    expect(serializeControlItem({}, code).displayText).toBe("<unknown>");
  });

  it("RESET instruction has displayText 'return' and instrType metadata", () => {
    const result = serializeControlItem({ instrType: InstrType.RESET }, code);
    expect(result.displayText).toBe("return");
    expect((result.metadata as any)?.instrType).toBe("Reset");
  });

  it("APPLICATION carries numOfArgs in metadata", () => {
    const result = serializeControlItem({ instrType: InstrType.APPLICATION, numOfArgs: 1 }, code);
    expect((result.metadata as any)?.numOfArgs).toBe(1);
    expect((result.metadata as any)?.instrType).toBe("Application");
  });

  it("ASSIGNMENT carries symbol in metadata", () => {
    const result = serializeControlItem({ instrType: InstrType.ASSIGNMENT, symbol: "y" }, code);
    expect((result.metadata as any)?.symbol).toBe("y");
    expect((result.metadata as any)?.instrType).toBe("Assignment");
  });

  it("BINARY_OP translates symbol to operator string in metadata", () => {
    const result = serializeControlItem(
      { instrType: InstrType.BINARY_OP, symbol: TokenType.PLUS },
      code,
    );
    expect((result.metadata as any)?.symbol).toBe("+");
    expect((result.metadata as any)?.instrType).toBe("BinaryOperation");
  });

  it("BOOL_OP maps to BinaryOperation instrType", () => {
    const result = serializeControlItem(
      { instrType: InstrType.BOOL_OP, symbol: TokenType.OR },
      code,
    );
    expect((result.metadata as any)?.instrType).toBe("BinaryOperation");
    expect((result.metadata as any)?.symbol).toBe("or");
  });

  it("UNARY_OP translates symbol", () => {
    const result = serializeControlItem(
      { instrType: InstrType.UNARY_OP, symbol: TokenType.NOT },
      code,
    );
    expect((result.metadata as any)?.symbol).toBe("not");
  });

  it("LIST carries arity in metadata", () => {
    const result = serializeControlItem({ instrType: InstrType.LIST, numOfElements: 2 }, code);
    expect((result.metadata as any)?.arity).toBe(2);
    expect((result.metadata as any)?.instrType).toBe("ArrayLiteral");
  });

  it("ENVIRONMENT instruction carries envId in metadata", () => {
    const env = { id: "e42" } as any;
    const result = serializeControlItem({ instrType: InstrType.ENVIRONMENT, env }, code);
    expect(result.displayText).toBe("ENVIRONMENT");
    expect((result.metadata as any)?.envId).toBe("e42");
  });

  it("AST node with real source tokens slices displayText from code", () => {
    // indexInSource 4 → 'x = 1 + 2' starts at 4 in 'x = 1 + 2\n'
    const result = serializeControlItem(
      {
        kind: "Assign",
        startToken: { indexInSource: 0, line: 1 },
        endToken: { indexInSource: 9, line: 1, lexeme: "" },
      },
      code,
    );
    expect(result.displayText).toBe("x = 1 + 2");
  });

  it("AST node with no source tokens falls back to KIND_LABELS", () => {
    const result = serializeControlItem({ kind: "While" }, code);
    expect(result.displayText).toBe("while");
  });

  it("unknown AST kind falls back to '<KindName>'", () => {
    const result = serializeControlItem({ kind: "UnknownKind" }, code);
    expect(result.displayText).toBe("<UnknownKind>");
  });

  it("syntheticLabel overrides displayText", () => {
    const result = serializeControlItem({ kind: "While", syntheticLabel: "my-while" }, code);
    expect(result.displayText).toBe("my-while");
  });

  it("synthetic BigIntLiteral shows its value", () => {
    const result = serializeControlItem({ kind: "BigIntLiteral", value: 99n }, code);
    expect(result.displayText).toBe("99");
  });

  it("FunctionDef node maps to FunctionDeclaration nodeType and carries bodyLength", () => {
    const result = serializeControlItem(
      {
        kind: "FunctionDef",
        body: [{ kind: "Return" }, { kind: "Assign" }],
      },
      code,
    );
    expect((result.metadata as any)?.nodeType).toBe("FunctionDeclaration");
    expect((result.metadata as any)?.bodyLength).toBe(2);
  });

  it("Lambda node with nested Lambda body unwraps body correctly", () => {
    const result = serializeControlItem(
      {
        kind: "Lambda",
        body: { kind: "Lambda", body: [{ kind: "Return" }] },
      },
      code,
    );
    expect((result.metadata as any)?.nodeType).toBe("ArrowFunctionExpression");
    expect((result.metadata as any)?.bodyLength).toBe(1);
    expect((result.metadata as any)?.bodyNodeTypes).toEqual(["ArrowFunctionExpression"]);
  });

  it("FileInput node with StatementSequence body unwraps body correctly", () => {
    const result = serializeControlItem(
      {
        kind: "FileInput",
        body: { kind: "StatementSequence", body: [{ kind: "Assign" }, { kind: "Return" }] },
      },
      code,
    );
    expect((result.metadata as any)?.bodyLength).toBe(2);
    expect((result.metadata as any)?.nodeType).toBe("StatementSequence");
  });

  it("startLine and endLine are set when source tokens have line numbers", () => {
    const result = serializeControlItem(
      {
        kind: "Assign",
        startToken: { indexInSource: 0, line: 3 },
        endToken: { indexInSource: 9, line: 3, lexeme: "" },
      },
      code,
    );
    expect((result.metadata as any)?.startLine).toBe(3);
    expect((result.metadata as any)?.endLine).toBe(3);
  });
});

// ── serializeEnvChain ─────────────────────────────────────────────────────────

describe("serializeEnvChain", () => {
  it("serializes a single global frame", () => {
    const globalEnv = makeEnv("g", "global", { x: bigint(1n) });
    const frames = serializeEnvChain([globalEnv], [], [], globalEnv);
    expect(frames).toHaveLength(1);
    expect(frames[0].id).toBe("g");
    expect(frames[0].isActive).toBe(true);
    expect(frames[0].parentId).toBeNull();
    expect(frames[0].bindings).toHaveLength(1);
    expect(frames[0].bindings[0].name).toBe("x");
  });

  it("filters out the prelude frame", () => {
    const prelude = makeEnv("p", "prelude");
    const global = makeEnv("g", "global", {}, prelude);
    const frames = serializeEnvChain([global], [], [], global);
    expect(frames.every(f => f.name !== "prelude")).toBe(true);
  });

  it("sets parentId to null when the only parent is prelude", () => {
    const prelude = makeEnv("p", "prelude");
    const global = makeEnv("g", "global", {}, prelude);
    const frames = serializeEnvChain([global], [], [], global);
    const globalFrame = frames.find(f => f.id === "g")!;
    expect(globalFrame.parentId).toBeNull();
  });

  it("sets isOnCallStack correctly", () => {
    const globalEnv = makeEnv("g", "global");
    const frames = serializeEnvChain([globalEnv], [], [], globalEnv);
    expect(frames[0].isOnCallStack).toBe(true);
  });

  it("filters __program__ from bindings", () => {
    const globalEnv = makeEnv("g", "global", { __program__: none(), x: bigint(5n) });
    const frames = serializeEnvChain([globalEnv], [], [], globalEnv);
    expect(frames[0].bindings.map(b => b.name)).not.toContain("__program__");
    expect(frames[0].bindings.map(b => b.name)).toContain("x");
  });

  it("visits closure environments reachable from bindings", () => {
    const closureEnv = makeEnv("c", "f");
    const closure: Value = {
      type: "closure",
      closure: { environment: closureEnv, node: { kind: "Lambda", parameters: [] } } as any,
    };
    const globalEnv = makeEnv("g", "global", { fn: closure });
    const frames = serializeEnvChain([globalEnv], [], [], globalEnv);
    const ids = frames.map(f => f.id);
    expect(ids).toContain("c");
  });

  it("does not duplicate frames when same env is reachable via multiple paths", () => {
    const globalEnv = makeEnv("g", "global", { x: bigint(1n) });
    const frames = serializeEnvChain([globalEnv, globalEnv], [], [], globalEnv);
    expect(frames.filter(f => f.id === "g")).toHaveLength(1);
  });
});

// ── collectSnapshots integration ──────────────────────────────────────────────

describe("collectSnapshots", () => {
  it("returns an empty array when maxSnapshots is 0", async () => {
    const ctx = new Context();
    const ast = parse("x = 1\n");
    const snapshots = await collectSnapshots(
      ctx,
      new Control(ast),
      new Stash(),
      100000,
      -1,
      3,
      "x = 1\n",
      0,
    );
    expect(snapshots).toHaveLength(0);
  });

  it("produces snapshots for a simple assignment", async () => {
    const snapshots = await runAndCollect("x = 1");
    expect(snapshots.length).toBeGreaterThan(0);
    expect(snapshots[0].stepIndex).toBe(0);
  });

  it("stepIndex increments monotonically", async () => {
    const snapshots = await runAndCollect("x = 1 + 2");
    for (let i = 1; i < snapshots.length; i++) {
      expect(snapshots[i].stepIndex).toBeGreaterThan(snapshots[i - 1].stepIndex);
    }
  });

  it("each snapshot has control, stash, and environments arrays", async () => {
    const snapshots = await runAndCollect("x = 1");
    for (const snap of snapshots) {
      expect(Array.isArray(snap.control)).toBe(true);
      expect(Array.isArray(snap.stash)).toBe(true);
      expect(Array.isArray(snap.environments)).toBe(true);
    }
  });

  it("respects maxSnapshots cap", async () => {
    const ctx = new Context();
    const script = "x = 1 + 2 + 3\n";
    const ast = parse(script);
    const snapshots = await collectSnapshots(
      ctx,
      new Control(ast),
      new Stash(),
      100000,
      -1,
      3,
      script,
      2,
    );
    expect(snapshots.length).toBeLessThanOrEqual(2);
  });

  it("final snapshot environments contain the global frame", async () => {
    const snapshots = await runAndCollect("x = 42");
    const last = snapshots[snapshots.length - 1];
    expect(last.environments.some(e => e.name === "global")).toBe(true);
  });

  it("currentLine is a positive integer when set", async () => {
    const snapshots = await runAndCollect("x = 1");
    const withLine = snapshots.filter(s => s.currentLine !== undefined);
    for (const snap of withLine) {
      expect(snap.currentLine).toBeGreaterThan(0);
    }
  });
});
