/**
 * Tests for the two-stage analysis pipeline:
 *   Stage 1 — NameResolver  (Resolver class)
 *   Stage 2 — FeatureGate   (chapter sublanguage validators)
 *
 * Accessed through the `analyze(ast, source, chapter)` entry point.
 */
import { parse } from "../parser/parser-adapter";
import { analyze } from "../resolver";
import { StmtNS, ExprNS } from "../ast-types";
import { FeatureNotSupportedError } from "../validator";
import { ResolverErrors } from "../resolver/errors";
import { traverseAST } from "../validator/traverse";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseSource(src: string): StmtNS.FileInput {
  const script = src.endsWith("\n") ? src : src + "\n";
  return parse(script);
}

function analyzeOk(src: string, chapter = 4): void {
  const script = src.endsWith("\n") ? src : src + "\n";
  const ast = parseSource(script);
  analyze(ast, script, chapter);
}

function analyzeThrows(src: string, chapter = 4): void {
  const script = src.endsWith("\n") ? src : src + "\n";
  const ast = parseSource(script);
  expect(() => analyze(ast, script, chapter)).toThrow();
}

// ---------------------------------------------------------------------------
// Stage 1: Name resolver — basic scope checks
// ---------------------------------------------------------------------------
describe("NameResolver — scope analysis", () => {
  test("single variable usage after declaration passes", () => {
    expect(() => analyzeOk("x = 1\nx")).not.toThrow();
  });

  test("function name is visible after definition", () => {
    expect(() => analyzeOk("def f():\n    pass\nf()")).not.toThrow();
  });

  test("function parameter is visible inside body", () => {
    expect(() => analyzeOk("def f(a):\n    a")).not.toThrow();
  });

  test("undeclared variable throws a resolver error", () => {
    analyzeThrows("y");
  });

  test("variable declared inside function not visible outside", () => {
    analyzeThrows("def f():\n    x = 1\nx");
  });

  test("global builtins (print, abs, etc.) are always in scope", () => {
    expect(() => analyzeOk("print(abs(1))")).not.toThrow();
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
    expect(() => analyzeOk(src)).not.toThrow();
  });

  test("lambda parameter is in scope in its body", () => {
    expect(() => analyzeOk("f = lambda x: x")).not.toThrow();
  });

  test("from-import binds the imported name", () => {
    expect(() => analyzeOk("from math import sqrt\nsqrt(4)")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Stage 2: FeatureGate — chapter restrictions
// ---------------------------------------------------------------------------

describe("Chapter 1 — most restrictive", () => {
  test("simple function definition passes", () => {
    expect(() => analyzeOk("def f(x):\n    x", 1)).not.toThrow();
  });

  test("while loop is banned in chapter 1", () => {
    expect(() => analyzeOk("while True:\n    pass", 1)).toThrow(FeatureNotSupportedError);
  });

  test("for loop is banned in chapter 1", () => {
    // Feature gate runs after resolver; use a declared variable as iter
    // so the resolver passes and the feature gate can fire.
    expect(() => analyzeOk("xs = 1\nfor i in xs:\n    pass", 1)).toThrow(FeatureNotSupportedError);
  });

  test("lambda is allowed in chapter 1", () => {
    expect(() => analyzeOk("f = lambda x: x", 1)).not.toThrow();
  });

  test("list literal is banned in chapter 1", () => {
    expect(() => analyzeOk("x = []", 1)).toThrow(FeatureNotSupportedError);
  });

  test("subscript assignment is banned in chapter 1", () => {
    // xs[0] = 3 uses ExprNS.Subscript — NoListsValidator should catch it.
    // Declare xs at chapter 4 level first, then try subscript assignment.
    expect(() => analyzeOk("xs = 1\nxs[0] = 3", 1)).toThrow(FeatureNotSupportedError);
  });

  test("reassignment is banned in chapter 1", () => {
    // Two assignments to the same name
    expect(() => analyzeOk("x = 1\nx = 2", 1)).toThrow();
  });

  test("annotated reassignment is banned in chapter 1 (AnnAssign then AnnAssign)", () => {
    // Use 'abs' (a global builtin) as the annotation so the resolver doesn't
    // throw NameNotFoundError on the annotation itself.
    expect(() => analyzeOk("x: abs = 1\nx: abs = 2", 1)).toThrow(
      ResolverErrors.NameReassignmentError,
    );
  });

  test("annotated then plain reassignment is banned in chapter 1 (AnnAssign then Assign)", () => {
    expect(() => analyzeOk("x: abs = 1\nx = 2", 1)).toThrow(ResolverErrors.NameReassignmentError);
  });

  test("plain then annotated reassignment is banned in chapter 1 (Assign then AnnAssign)", () => {
    expect(() => analyzeOk("x = 1\nx: abs = 2", 1)).toThrow(ResolverErrors.NameReassignmentError);
  });

  test("break/continue are banned in chapter 1", () => {
    expect(() => analyzeOk("def f():\n    break", 1)).toThrow(FeatureNotSupportedError);
    expect(() => analyzeOk("def f():\n    continue", 1)).toThrow(FeatureNotSupportedError);
  });

  test("nonlocal is banned in chapter 1", () => {
    expect(() => analyzeOk("def f():\n    x = 1\n    def g():\n        nonlocal x", 1)).toThrow(
      FeatureNotSupportedError,
    );
  });

  test("rest params are banned in chapter 1", () => {
    expect(() => analyzeOk("def f(*args):\n    pass", 1)).toThrow(FeatureNotSupportedError);
  });
});

describe("Chapter 2 — loops and reassignment still banned", () => {
  test("reassignment is banned in chapter 2", () => {
    expect(() => analyzeOk("x = 1\nx = 2", 2)).toThrow();
  });

  test("while loop is banned in chapter 2", () => {
    expect(() => analyzeOk("while True:\n    pass", 2)).toThrow(FeatureNotSupportedError);
  });

  test("for loop is banned in chapter 2", () => {
    expect(() => analyzeOk("xs = 1\nfor i in xs:\n    pass", 2)).toThrow(FeatureNotSupportedError);
  });

  test("list literal is banned in chapter 2", () => {
    expect(() => analyzeOk("x = []", 2)).toThrow(FeatureNotSupportedError);
  });

  test("nonlocal is banned in chapter 2", () => {
    expect(() => analyzeOk("def f():\n    x = 1\n    def g():\n        nonlocal x", 2)).toThrow(
      FeatureNotSupportedError,
    );
  });

  test("rest params are banned in chapter 2", () => {
    expect(() => analyzeOk("def f(*args):\n    pass", 2)).toThrow(FeatureNotSupportedError);
  });
});

describe("Chapter 3 — loops and lists allowed", () => {
  test("while loop is allowed in chapter 3", () => {
    expect(() => analyzeOk("while True:\n    pass", 3)).not.toThrow();
  });

  test("list literal is allowed in chapter 3", () => {
    expect(() => analyzeOk("x = []", 3)).not.toThrow();
  });

  test("nonlocal is allowed in chapter 3", () => {
    expect(() =>
      analyzeOk("def f():\n    x = 1\n    def g():\n        nonlocal x", 3),
    ).not.toThrow();
  });

  test("for with range() is allowed in chapter 3", () => {
    expect(() => analyzeOk("for i in range(10):\n    pass", 3)).not.toThrow();
  });

  test("for with range(start, stop) is allowed in chapter 3", () => {
    expect(() => analyzeOk("for i in range(0, 10):\n    pass", 3)).not.toThrow();
  });

  test("for with range(start, stop, step) is allowed in chapter 3", () => {
    expect(() => analyzeOk("for i in range(0, 10, 2):\n    pass", 3)).not.toThrow();
  });

  test("for without range() is banned in chapter 3", () => {
    expect(() => analyzeOk("xs = 1\nfor i in xs:\n    pass", 3)).toThrow(FeatureNotSupportedError);
  });

  test("for without range() is allowed in chapter 4", () => {
    expect(() => analyzeOk("xs = 1\nfor i in xs:\n    pass", 4)).not.toThrow();
  });

  test("subscript assignment resolves in chapter 3", () => {
    expect(() => analyzeOk("xs = [1, 2]\nxs[0] = 3", 3)).not.toThrow();
  });

  test("rest params are allowed in chapter 3", () => {
    expect(() => analyzeOk("def f(*args):\n    pass", 3)).not.toThrow();
  });
});

describe("Chapter 4 — no restrictions", () => {
  test("while loop is allowed", () => {
    expect(() => analyzeOk("while True:\n    pass", 4)).not.toThrow();
  });

  test("list literal is allowed", () => {
    expect(() => analyzeOk("x = [1, 2, 3]", 4)).not.toThrow();
  });

  test("lambda is allowed", () => {
    expect(() => analyzeOk("f = lambda x: x", 4)).not.toThrow();
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
    expect(() => analyzeOk("[1, 2]", 1)).toThrow(FeatureNotSupportedError);
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

  test("traverses AnnAssign target (Variable)", () => {
    const ast = parseSource("x: abs = 1\n");
    const visited: string[] = [];
    traverseAST(ast, node => {
      if (node instanceof ExprNS.Variable) visited.push(node.name.lexeme);
    });
    expect(visited).toContain("x");
  });
});
