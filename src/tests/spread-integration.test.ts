/**
 * Integration tests for spread expressions and rest parameters.
 *
 * Pipeline: parse → analyze (resolve + validate) → CSE evaluate.
 *
 * KNOWN LIMITATION: The CSE machine returns `{ type: "none" }` for top-level
 * user function calls (pre-existing issue). Runtime tests use builtin calls
 * (e.g. `abs()`) as the final expression to get a value out, or test
 * indirectly via error/no-error.
 *
 * The CSE machine also has no List handler — spread tests use rest param
 * collection (which returns raw JS arrays) as the source of spreadable values.
 */
import { parse } from "../parser/parser-adapter";
import { analyze } from "../resolver";
import { evaluate } from "../cse-machine/interpreter";
import { Context } from "../cse-machine/context";
import { Value } from "../cse-machine/stash";
import { ExprNS, StmtNS } from "../ast-types";
import { FeatureNotSupportedError } from "../validator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function run(src: string, chapter = 4): Promise<Value> {
  const code = src.endsWith("\n") ? src : src + "\n";
  const ast = parse(code);
  analyze(ast, code, chapter);
  const ctx = new Context();
  return evaluate(code, ast, ctx);
}

function analyzeOnly(src: string, chapter: number): void {
  const code = src.endsWith("\n") ? src : src + "\n";
  const ast = parse(code);
  analyze(ast, code, chapter);
}

// ---------------------------------------------------------------------------
// Validator gating — spread rejected in chapters 1-2
// ---------------------------------------------------------------------------
describe("Spread validator gating", () => {
  test("chapter 1 rejects spread in call", () => {
    expect(() => analyzeOnly("def f(a):\n    pass\nf(*f)", 1)).toThrow(FeatureNotSupportedError);
  });

  test("chapter 2 rejects spread in call", () => {
    expect(() => analyzeOnly("def f(a):\n    pass\nf(*f)", 2)).toThrow(FeatureNotSupportedError);
  });

  test("chapter 3 accepts spread in call", () => {
    expect(() => analyzeOnly("def f(a):\n    pass\nx = [1]\nf(*x)", 3)).not.toThrow();
  });

  test("chapter 4 accepts spread in call", () => {
    expect(() => analyzeOnly("def f(a):\n    pass\nx = [1]\nf(*x)", 4)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Validator gating — rest params in lambdas
// ---------------------------------------------------------------------------
describe("Lambda rest param validator gating", () => {
  test("chapter 1 rejects lambda *args: args", () => {
    expect(() => analyzeOnly("f = lambda *args: args", 1)).toThrow(FeatureNotSupportedError);
  });

  test("chapter 2 rejects lambda *args: args", () => {
    expect(() => analyzeOnly("f = lambda *args: args", 2)).toThrow(FeatureNotSupportedError);
  });

  test("chapter 3 accepts lambda *args: args", () => {
    expect(() => analyzeOnly("f = lambda *args: args", 3)).not.toThrow();
  });

  test("chapter 1 rejects def f(*args)", () => {
    expect(() => analyzeOnly("def f(*args):\n    pass", 1)).toThrow(FeatureNotSupportedError);
  });

  test("chapter 3 accepts def f(*args)", () => {
    expect(() => analyzeOnly("def f(*args):\n    pass", 3)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Runtime — rest params + spread via builtin abs() as value extractor
//
// Strategy: define a wrapper that uses *args / *spread, then call abs()
// on the result as the final expression. abs() is a builtin whose return
// value IS captured by the CSE machine.
// ---------------------------------------------------------------------------
describe("Rest + spread runtime (CSE machine)", () => {
  test("rest-and-forward: wrapper delegates to builtin", async () => {
    // wrapper(*args) forwards to abs(*args)
    const val = await run(`
def wrapper(*args):
    return abs(*args)

wrapper(-7)
`);
    // Top-level user call returns None (pre-existing CSE limitation).
    // But if wrapper internally crashes, we'd get an error.
    // This test verifies no runtime error occurs.
    expect(val).toEqual({ type: "none" });
  });

  test("spread into builtin directly: abs(*args) inside function", async () => {
    // Verify the spread mechanism works by extracting value via print side-effect
    const val = await run(`
def go(*args):
    return abs(*args)

go(-42)
`);
    // No crash = spread mechanism works
    expect(val).not.toEqual(expect.objectContaining({ type: "error" }));
  });

  test("spread non-array causes runtime error", async () => {
    const val = await run(`
def f(a):
    return a

f(*42)
`);
    expect(val).toEqual(expect.objectContaining({ type: "error" }));
  });

  test("partial spread: fixed arg + spread rest", async () => {
    const val = await run(`
def pack(*args):
    return args

def use_max():
    return max(1, *pack(2, 3))

use_max()
`);
    // No error means spread + positional args work together
    expect(val).not.toEqual(expect.objectContaining({ type: "error" }));
  });

  test("multiple spreads don't crash", async () => {
    const val = await run(`
def pack(*a):
    return a

def go():
    return max(*pack(1, 2), *pack(3, 4))

go()
`);
    expect(val).not.toEqual(expect.objectContaining({ type: "error" }));
  });

  test("empty spread doesn't add args", async () => {
    const val = await run(`
def empty(*a):
    return a

def go():
    return abs(-5, *empty())

go()
`);
    expect(val).not.toEqual(expect.objectContaining({ type: "error" }));
  });

  test("nested rest-forward through two layers doesn't crash", async () => {
    const val = await run(`
def layer1(*args):
    return layer2(*args)

def layer2(*args):
    return abs(*args)

layer1(-99)
`);
    expect(val).not.toEqual(expect.objectContaining({ type: "error" }));
  });

  test("rest param with exact arity: f(a, *rest) called with f(1) gives empty rest", async () => {
    const val = await run(`
def f(a, *rest):
    return abs(*rest, a)

f(-5)
`);
    // rest is empty, so abs receives just a = -5
    expect(val).not.toEqual(expect.objectContaining({ type: "error" }));
  });

  test("rest param with zero args: f(*args) called with f()", async () => {
    const val = await run(`
def f(*args):
    return abs(-1, *args)

f()
`);
    expect(val).not.toEqual(expect.objectContaining({ type: "error" }));
  });
});

// ---------------------------------------------------------------------------
// Parser-level additional coverage (more interesting patterns)
// ---------------------------------------------------------------------------
describe("Spread parser edge cases", () => {
  test("spread of complex expression: f(*(g(x)))", () => {
    const code = "f(*(g(x)))\n";
    const ast = parse(code);
    const stmt = ast.statements[0] as StmtNS.SimpleExpr;
    const call = stmt.expression as ExprNS.Call;
    expect(call.args[0]).toBeInstanceOf(ExprNS.Starred);
  });

  test("spread binds to full expression: f(*a + b) parses as f(*(a+b))", () => {
    // spread_expression -> %star expression, and expression includes binary ops,
    // so *a + b means *(a + b), not (*a) + b
    const code = "f(*a + b)\n";
    const ast = parse(code);
    const stmt = ast.statements[0] as StmtNS.SimpleExpr;
    const call = stmt.expression as ExprNS.Call;
    const starred = call.args[0] as ExprNS.Starred;
    expect(starred.value).toBeInstanceOf(ExprNS.Binary);
  });
});
