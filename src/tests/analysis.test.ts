/**
 * Tests for the two-stage analysis pipeline:
 *   Stage 1 — NameResolver  (Resolver class)
 *   Stage 2 — FeatureGate   (chapter sublanguage validators)
 *
 * Accessed through the `analyze(ast, source, chapter)` entry point.
 */
import { ExprNS, StmtNS } from "../ast-types";
import { parse } from "../parser/parser-adapter";
import { analyze } from "../resolver";
import { FeatureNotSupportedError } from "../validator";
import { traverseAST } from "../validator/traverse";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseSource(src: string): StmtNS.FileInput {
  const script = src.endsWith("\n") ? src : src + "\n";
  return parse(script);
}

function analyzeOk(src: string, chapter = 4) {
  const script = src.endsWith("\n") ? src : src + "\n";
  const ast = parseSource(script);
  expect(analyze(ast, script, chapter)).toEqual([]);
}

function analyzeThrows(src: string, chapter = 4, errors: jest.Constructable[] = [Error]) {
  const script = src.endsWith("\n") ? src : src + "\n";
  const ast = parseSource(script);
  const analysisErrors = analyze(ast, script, chapter);
  expect(analysisErrors).toEqual(errors.map(ErrorConstructor => expect.any(ErrorConstructor)));
}

// ---------------------------------------------------------------------------
// Stage 1: Name resolver — basic scope checks
// ---------------------------------------------------------------------------
describe("NameResolver — scope analysis", () => {
  test("single variable usage after declaration passes", () => {
    analyzeOk("x = 1\nx");
  });

  test("function name is visible after definition", () => {
    analyzeOk("def f():\n    pass\nf()");
  });

  test("function parameter is visible inside body", () => {
    analyzeOk("def f(a):\n    a");
  });

  test("undeclared variable throws a resolver error", () => {
    analyzeThrows("y");
  });

  test("variable declared inside function not visible outside", () => {
    analyzeThrows("def f():\n    x = 1\nx");
  });

  test("global builtins (print, abs, etc.) are always in scope", () => {
    analyzeOk("print(abs(1))");
  });

  test("re-declaring the same name in the same scope throws in chapter 1", () => {
    analyzeThrows("x = 1\nx = 2", 1);
  });

  test("nested function can reference outer variable", () => {
    const src = `
def outer():
    x = 1
    def helper():
        x
`;
    analyzeOk(src);
  });

  test("lambda parameter is in scope in its body", () => {
    analyzeOk("f = lambda x: x");
  });

  test("from-import binds the imported name", () => {
    analyzeOk("from math import sqrt\nsqrt(4)");
  });
});

// ---------------------------------------------------------------------------
// Stage 2: FeatureGate — chapter restrictions
// ---------------------------------------------------------------------------

describe("Chapter 1 — most restrictive", () => {
  test("simple function definition passes", () => {
    analyzeOk("def f(x):\n    x", 1);
  });

  test("while loop is banned in chapter 1", () => {
    analyzeThrows("while True:\n    pass", 1, [FeatureNotSupportedError]);
  });

  test("for loop is banned in chapter 1", () => {
    // Feature gate runs after resolver; use a declared variable as iter
    // so the resolver passes and the feature gate can fire.
    analyzeThrows("xs = 1\nfor i in xs:\n    pass", 1, [FeatureNotSupportedError]);
  });

  test("lambda is allowed in chapter 1", () => {
    analyzeOk("f = lambda x: x", 1);
  });

  test("list literal is banned in chapter 1", () => {
    analyzeThrows("x = []", 1, [FeatureNotSupportedError]);
  });

  test("subscript assignment is banned in chapter 1", () => {
    // xs[0] = 3 uses ExprNS.Subscript — NoListsValidator should catch it.
    // Declare xs at chapter 4 level first, then try subscript assignment.
    analyzeThrows("xs = 1\nxs[0] = 3", 1, [FeatureNotSupportedError]);
  });

  test("reassignment is banned in chapter 1", () => {
    // Two assignments to the same name
    analyzeThrows("x = 1\nx = 2", 1);
  });

  test("break/continue are banned in chapter 1", () => {
    analyzeThrows("def f():\n    break", 1, [FeatureNotSupportedError]);
    analyzeThrows("def f():\n    continue", 1, [FeatureNotSupportedError]);
  });

  test("nonlocal is banned in chapter 1", () => {
    analyzeThrows("def f():\n    x = 1\n    def g():\n        nonlocal x", 1, [
      FeatureNotSupportedError,
    ]);
  });

  test("rest params are banned in chapter 1", () => {
    analyzeThrows("def f(*args):\n    pass", 1, [FeatureNotSupportedError]);
  });

  test("spread in call is banned in chapter 1", () => {
    analyzeThrows("def f(a):\n    pass\nf(*f)", 1, [FeatureNotSupportedError]);
  });

  test("lambda *args is banned in chapter 1", () => {
    analyzeThrows("f = lambda *args: args", 1, [FeatureNotSupportedError]);
  });
});

describe("Chapter 2 — loops and reassignment still banned", () => {
  test("reassignment is banned in chapter 2", () => {
    analyzeThrows("x = 1\nx = 2", 2);
  });

  test("while loop is banned in chapter 2", () => {
    analyzeThrows("while True:\n    pass", 2, [FeatureNotSupportedError]);
  });

  test("for loop is banned in chapter 2", () => {
    analyzeThrows("xs = 1\nfor i in xs:\n    pass", 2, [FeatureNotSupportedError]);
  });

  test("list literal is banned in chapter 2", () => {
    analyzeThrows("x = []", 2, [FeatureNotSupportedError]);
  });

  test("nonlocal is banned in chapter 2", () => {
    analyzeThrows("def f():\n    x = 1\n    def g():\n        nonlocal x", 2, [
      FeatureNotSupportedError,
    ]);
  });

  test("rest params are banned in chapter 2", () => {
    analyzeThrows("def f(*args):\n    pass", 2, [FeatureNotSupportedError]);
  });

  test("spread in call is banned in chapter 2", () => {
    analyzeThrows("def f(a):\n    pass\nf(*f)", 2, [FeatureNotSupportedError]);
  });

  test("lambda *args is banned in chapter 2", () => {
    analyzeThrows("f = lambda *args: args", 2, [FeatureNotSupportedError]);
  });
});

describe("Chapter 3 — loops and lists allowed", () => {
  test("while loop is allowed in chapter 3", () => {
    analyzeOk("while True:\n    pass", 3);
  });

  test("list literal is allowed in chapter 3", () => {
    analyzeOk("x = []", 3);
  });

  test("nonlocal is allowed in chapter 3", () => {
    analyzeOk("def f():\n    x = 1\n    def g():\n        nonlocal x", 3);
  });
  test("for with range() is allowed in chapter 3", () => {
    analyzeOk("for i in range(10):\n    pass", 3);
  });

  test("for with range(start, stop) is allowed in chapter 3", () => {
    analyzeOk("for i in range(0, 10):\n    pass", 3);
  });

  test("for with range(start, stop, step) is allowed in chapter 3", () => {
    analyzeOk("for i in range(0, 10, 2):\n    pass", 3);
  });

  test("for without range() is banned in chapter 3", () => {
    analyzeThrows("xs = 1\nfor i in xs:\n    pass", 3, [FeatureNotSupportedError]);
  });

  test("for without range() is allowed in chapter 4", () => {
    analyzeOk("xs = 1\nfor i in xs:\n    pass", 4);
  });

  test("subscript assignment resolves in chapter 3", () => {
    analyzeOk("xs = [1, 2]\nxs[0] = 3", 3);
  });

  test("rest params are allowed in chapter 3", () => {
    analyzeOk("def f(*args):\n    pass", 3);
  });

  test("spread in call is allowed in chapter 3", () => {
    analyzeOk("def f(a):\n    pass\nx = [1]\nf(*x)", 3);
  });

  test("lambda *args is allowed in chapter 3", () => {
    analyzeOk("f = lambda *args: args", 3);
  });
});

describe("Chapter 4 — no restrictions", () => {
  test("while loop is allowed", () => {
    analyzeOk("while True:\n    pass", 4);
  });

  test("list literal is allowed", () => {
    analyzeOk("x = [1, 2, 3]", 4);
  });

  test("lambda is allowed", () => {
    analyzeOk("f = lambda x: x", 4);
  });

  test("annotated assignment is not allowed", () => {
    analyzeThrows("x: abs = 5", 4, [FeatureNotSupportedError]);
  });

  test("annotated assignment is not allowed after normal assignment (Assign -> AnnAssign)", () => {
    analyzeThrows("x = 5\nx: abs = 10", 4, [FeatureNotSupportedError]);
  });

  test("spread in call is allowed in chapter 4", () => {
    analyzeOk("def f(a):\n    pass\nx = [1]\nf(*x)", 4);
  });
});

// ---------------------------------------------------------------------------
// Combined pipeline: resolver runs before feature gate
// ---------------------------------------------------------------------------
describe("Pipeline ordering", () => {
  test("resolver error is thrown even at chapter 4", () => {
    // undeclared name — resolver should catch this regardless of chapter
    analyzeThrows("undeclared_variable", 4);
  });

  test("feature error is thrown after resolver passes", () => {
    // [1, 2] — name resolution is fine, but chapter 1 bans lists
    analyzeThrows("[1, 2]", 1, [FeatureNotSupportedError]);
  });
});

describe("traverseAST — target visitation", () => {
  test("traverses Assign target (Variable)", () => {
    const ast = parseSource("x = 1\n");
    const visited: string[] = [];
    traverseAST(ast, node => {
      if (node instanceof ExprNS.Variable) visited.push(node.name.lexeme);
    });
    expect(visited).toContain("x");
  });
});

// ---------------------------------------------------------------------------
// if / elif / else — scope analysis
// ---------------------------------------------------------------------------
describe("if/elif/else — scope analysis", () => {
  test("if condition can reference outer variable", () => {
    analyzeOk("x = 1\nif x:\n    pass");
  });

  test("variable declared in if body is visible after the block (no block scope)", () => {
    // Python has no block scope — x leaks out of the if branch.
    analyzeOk("if True:\n    x = 1\nx");
  });

  test("variable declared in else body is visible after the block", () => {
    analyzeOk("if True:\n    pass\nelse:\n    x = 1\nx");
  });

  test("elif condition can reference outer variable", () => {
    analyzeOk("x = 1\ny = 2\nif x:\n    pass\nelif y:\n    pass");
  });

  test("variable declared inside elif body is visible after the block", () => {
    analyzeOk("x = 1\nif x:\n    pass\nelif True:\n    z = 2\nz");
  });

  test("undeclared variable used in if condition throws", () => {
    analyzeThrows("if undeclared:\n    pass");
  });

  test("undeclared variable used in elif condition throws", () => {
    analyzeThrows("x = 1\nif x:\n    pass\nelif undeclared:\n    pass");
  });

  test("nested if can reference enclosing scope variable", () => {
    analyzeOk("x = 1\nif True:\n    if x:\n        pass");
  });

  test("if/elif/else inside function can reference function parameter", () => {
    analyzeOk("def f(x):\n    if x:\n        pass\n    elif x:\n        pass\n    else:\n        pass");
  });
});

// ---------------------------------------------------------------------------
// if / elif / else — runtime (CSE machine integration)
// ---------------------------------------------------------------------------
// The CSE machine pops expression-statement values from the stash before returning,
// so run() always returns { type: "none" } for well-formed scripts. Runtime tests
// verify branch selection by checking whether a runtime error occurs: a branch that
// would call f(*42) (invalid spread) produces { type: "error" }; the safe branch does not.
describe("if/elif/else runtime (CSE machine)", () => {
  test("if branch executes when condition is true (else branch would error)", async () => {
    // If the else branch ran, f(*42) would produce a runtime error.
    const val = await run(`
def f(a):
    return a

if True:
    pass
else:
    f(*42)
`);
    expect(val).not.toEqual(expect.objectContaining({ type: "error" }));
  });

  test("else branch executes when condition is false (if branch would error)", async () => {
    const val = await run(`
def f(a):
    return a

if False:
    f(*42)
else:
    pass
`);
    expect(val).not.toEqual(expect.objectContaining({ type: "error" }));
  });

  test("elif branch executes: first condition false, elif condition true", async () => {
    // If the if branch ran, f(*42) would error. If else ran, g(*42) would error.
    const val = await run(`
def f(a):
    return a

def g(a):
    return a

if False:
    f(*42)
elif True:
    pass
else:
    g(*42)
`);
    expect(val).not.toEqual(expect.objectContaining({ type: "error" }));
  });

  test("else branch executes when all elif conditions are false", async () => {
    const val = await run(`
def f(a):
    return a

if False:
    f(*42)
elif False:
    f(*42)
else:
    pass
`);
    expect(val).not.toEqual(expect.objectContaining({ type: "error" }));
  });

  test("if without else: skipped when condition is false, no error", async () => {
    const val = await run(`
def f(a):
    return a

if False:
    f(*42)
`);
    expect(val).not.toEqual(expect.objectContaining({ type: "error" }));
  });

  test("multiple elif: first matching branch is taken, later branches skipped", async () => {
    // elif True is taken; the subsequent elif would error if reached.
    const val = await run(`
def f(a):
    return a

if False:
    f(*42)
elif True:
    pass
elif True:
    f(*42)
else:
    f(*42)
`);
    expect(val).not.toEqual(expect.objectContaining({ type: "error" }));
  });

  test("nested if/else: correct inner branch is taken", async () => {
    const val = await run(`
def f(a):
    return a

if True:
    if False:
        f(*42)
    else:
        pass
else:
    f(*42)
`);
    expect(val).not.toEqual(expect.objectContaining({ type: "error" }));
  });
});

// ---------------------------------------------------------------------------
// Rest + spread runtime (CSE machine integration)
// ---------------------------------------------------------------------------
import { Context } from "../engines/cse/context";
import { evaluate } from "../engines/cse/interpreter";
import { Value } from "../engines/cse/stash";

async function run(src: string, chapter = 4): Promise<Value> {
  const code = src.endsWith("\n") ? src : src + "\n";
  const ast = parse(code);
  analyze(ast, code, chapter);
  const ctx = new Context();
  return evaluate(code, ast, ctx);
}

describe("Rest + spread runtime (CSE machine)", () => {
  test("rest-and-forward: wrapper delegates to builtin", async () => {
    const val = await run(`
def wrapper(*args):
    return abs(*args)

wrapper(-7)
`);
    expect(val).toEqual({ type: "none" });
  });

  test("spread into builtin directly: abs(*args) inside function", async () => {
    const val = await run(`
def go(*args):
    return abs(*args)

go(-42)
`);
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
