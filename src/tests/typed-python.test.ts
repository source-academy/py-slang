/**
 * Typed Python §4 (docs/typed-python-4.md), phase 1: the parser accepts type annotations, the plain
 * sublanguages reject them, the typed validators require them, and a program with its types erased
 * behaves exactly like the same program without them, on every engine.
 */
import { ExprNS, StmtNS } from "../ast-types";
import { runCodePy2Js } from "../engines/py2js";
import * as parserAdapter from "../parser/parser-adapter";
import { runCode } from "../runner";
import { eraseTypes, prepareTypedProgram } from "../typecheck";
import { runCodePvmlInterpreter } from "../pvml-runner";
import {
  FeatureNotSupportedError,
  makeChapter4Validators,
  MissingTypeAnnotationError,
} from "../validator";
import { Resolver } from "../resolver";
import { toPythonAst, toPythonAstAndResolve } from "./utils";

function statements(code: string): StmtNS.Stmt[] {
  return (toPythonAst(code) as StmtNS.FileInput).statements;
}

function functionDef(code: string): StmtNS.FunctionDef {
  const stmt = statements(code)[0];
  if (!(stmt instanceof StmtNS.FunctionDef)) throw new Error("not a function definition");
  return stmt;
}

describe("parsing type syntax", () => {
  test("annotations of parameters, a return annotation and type parameters", () => {
    const def = functionDef(
      "def f[A, B](x: int, *xs: LList[A], y: float = 2.0) -> Callable[[A], B]:\n    return x",
    );
    expect(def.typeParams.map(t => t.lexeme)).toEqual(["A", "B"]);
    expect(def.parameters.map(p => p.lexeme)).toEqual(["x", "xs", "y"]);
    expect(def.parameters.map(p => !!p.annotation)).toEqual([true, true, true]);
    expect(def.parameters.map(p => p.isStarred)).toEqual([false, true, false]);
    expect(def.parameters[2].default).toBeInstanceOf(ExprNS.Literal);
    expect(def.returns).toBeInstanceOf(ExprNS.Subscript);
  });

  test("a function without annotations has none", () => {
    const def = functionDef("def f(x, y):\n    return x");
    expect(def.returns).toBeNull();
    expect(def.typeParams).toEqual([]);
    expect(def.parameters.every(p => p.annotation === undefined)).toBe(true);
    // An unannotated parameter has no `annotation` field at all.
    expect("annotation" in def.parameters[0]).toBe(false);
  });

  test("a trailing comma in the type parameters and the parameters", () => {
    const def = functionDef("def f[A,](x: A,) -> A:\n    return x");
    expect(def.typeParams).toHaveLength(1);
    expect(def.parameters[0].trailingComma).toBe(true);
  });

  test("a type alias, with and without type parameters", () => {
    const [plain, generic] = statements(
      "type Rational = Pair[int, int]\ntype Tree[T] = Pair[T, LList[Tree[T]]]",
    ) as StmtNS.TypeAlias[];
    expect(plain).toBeInstanceOf(StmtNS.TypeAlias);
    expect(plain.name.lexeme).toBe("Rational");
    expect(plain.typeParams).toEqual([]);
    expect(generic.name.lexeme).toBe("Tree");
    expect(generic.typeParams.map(t => t.lexeme)).toEqual(["T"]);
  });

  test("a type alias is a statement of a block, also on one line", () => {
    const [stmt] = statements("if True:\n    type X = int\n") as StmtNS.If[];
    expect(stmt.body[0]).toBeInstanceOf(StmtNS.TypeAlias);
    const [inline] = statements("if True: type X = int\n") as StmtNS.If[];
    expect(inline.body[0]).toBeInstanceOf(StmtNS.TypeAlias);
  });

  test("`type` is a soft keyword: it is still an ordinary name", () => {
    const kinds = statements("type = 5\nprint(type + 1)\ntype += 1\nx = type\n").map(s => s.kind);
    expect(kinds).toEqual(["Assign", "SimpleExpr", "AugAssign", "Assign"]);
    // A name followed by another name is only a type alias if the first one is `type`.
    expect(() => toPythonAst("typo X = int")).toThrow();
  });

  test("a subscript with several items has a tuple as its index", () => {
    const [stmt] = statements("x: Pair[int, str] = None") as StmtNS.AnnAssign[];
    const index = (stmt.ann as ExprNS.Subscript).index;
    expect(index).toBeInstanceOf(ExprNS.Tuple);
    expect((index as ExprNS.Tuple).elements).toHaveLength(2);
    const [one] = statements("y = x[1,]") as StmtNS.Assign[];
    expect(((one.value as ExprNS.Subscript).index as ExprNS.Tuple).elements).toHaveLength(1);
  });

  test("the parameters of a lambda cannot be annotated", () => {
    expect(() => toPythonAst("f = lambda x: int: x")).toThrow();
    const [stmt] = statements("f = lambda x: x") as StmtNS.Assign[];
    expect((stmt.value as ExprNS.Lambda).parameters[0].annotation).toBeUndefined();
  });

  test("`->` is one token, and `-` followed by `>` still is not an operator", () => {
    expect(functionDef("def f() -> int:\n    return -1").returns).toBeInstanceOf(ExprNS.Variable);
    expect(() => toPythonAst("x = 1 -> 2")).toThrow();
    expect(statements("x = 1 - -2\ny = 3 -(-4)").map(s => s.kind)).toEqual(["Assign", "Assign"]);
  });
});

describe("the sublanguages without types reject type syntax", () => {
  const cases: [string, string][] = [
    ["a parameter annotation", "def f(x: int):\n    return x"],
    ["a return annotation", "def f(x) -> int:\n    return x"],
    ["type parameters", "def f[A](x):\n    return x"],
    ["a type alias", "type X = int"],
    ["an annotated assignment", "x: int = 1"],
  ];
  for (const variant of [1, 2, 3, 4]) {
    describe(`Python §${variant}`, () => {
      test.each(cases)("%s", (_what, code) => {
        expect(() => toPythonAstAndResolve(code, variant)).toThrow(FeatureNotSupportedError);
      });
    });
  }

  test("the message names the feature", () => {
    expect(() => toPythonAstAndResolve("def f(x: int):\n    return x", 4)).toThrow(
      /type annotations/,
    );
    expect(() => toPythonAstAndResolve("type X = int", 4)).toThrow(/type statements/);
    expect(() => toPythonAstAndResolve("def f[A](x):\n    return x", 4)).toThrow(/type parameters/);
  });

  test("a program that is annotated does not run on the plain engines", async () => {
    await expect(runCode("def f(x: int) -> int:\n    return x\nprint(f(1))", 4)).rejects.toThrow(
      /type annotations/,
    );
  });
});

describe("Typed Python §4 requires annotations on every def", () => {
  const prepare = (code: string) => prepareTypedProgram(toPythonAst(code));

  test("an annotated program is accepted", () => {
    expect(() =>
      prepare(
        "def f(x: int, *ys: int) -> int:\n    return x\ng: int = 1\ntype T = int\nh = lambda a: a",
      ),
    ).not.toThrow();
  });

  test("a parameter without annotation", () => {
    expect(() => prepare("def f(x: int, y) -> int:\n    return x")).toThrow(
      MissingTypeAnnotationError,
    );
    expect(() => prepare("def f(x: int, y) -> int:\n    return x")).toThrow(
      /parameter 'y' of function 'f' needs a type/,
    );
  });

  test("a function without return annotation", () => {
    expect(() => prepare("def f(x: int):\n    return x")).toThrow(
      /function 'f' needs a return type/,
    );
  });

  test("also a function inside another one", () => {
    expect(() => prepare("def f() -> int:\n    def g(x):\n        return x\n    return 1")).toThrow(
      /parameter 'x' of function 'g'/,
    );
  });

  test("the error has a location", () => {
    expect(() => prepare("x = 1\ndef f(a: int, b) -> int:\n    return a")).toThrow(/line 2/);
  });

  test("a declaration without a value is rejected, one with the value None is not", () => {
    expect(() => prepare("x: int")).toThrow(FeatureNotSupportedError);
    expect(() => prepare("x: int")).toThrow(/declarations without a value/);
    expect(() => prepare("x: None = None")).not.toThrow();
    expect(() => prepare("x: int = None")).not.toThrow();
  });
});

describe("erasing types", () => {
  test("annotations, return types and type parameters of every def are removed", () => {
    const ast = prepareTypedProgram(
      toPythonAst(
        "def f[A](x: A) -> A:\n    def g(y: int, *zs: int) -> int:\n        return y\n    return x",
      ),
    ) as StmtNS.FileInput;
    const f = ast.statements[0] as StmtNS.FunctionDef;
    const g = f.body[0] as StmtNS.FunctionDef;
    for (const def of [f, g]) {
      expect(def.returns).toBeNull();
      expect(def.typeParams).toEqual([]);
      expect(def.parameters.every(p => p.annotation === undefined)).toBe(true);
    }
  });

  test("an annotated assignment becomes an assignment, a type statement becomes pass", () => {
    const ast = prepareTypedProgram(
      toPythonAst("x: int = 1\ntype T = int\nif True:\n    y: int = 2\n    type U = int"),
    ) as StmtNS.FileInput;
    expect(ast.statements.map(s => s.kind)).toEqual(["Assign", "Pass", "If"]);
    const body = (ast.statements[2] as StmtNS.If).body;
    expect(body.map(s => s.kind)).toEqual(["Assign", "Pass"]);
    // The assignment keeps its target, its value and its position.
    const assign = ast.statements[0] as StmtNS.Assign;
    expect((assign.target as ExprNS.Variable).name.lexeme).toBe("x");
    expect(assign.startToken.line).toBe(1);
  });

  test("in every kind of block: else branch, while, for, function", () => {
    const ast = eraseTypes(
      toPythonAst(
        [
          "if True:\n    pass\nelse:\n    a: int = 1",
          "while False:\n    b: int = 2",
          "for i in range(2):\n    c: int = 3",
          "def f() -> None:\n    d: int = 4",
        ].join("\n"),
      ),
    ) as StmtNS.FileInput;
    const kinds = (stmts: StmtNS.Stmt[]) => stmts.map(s => s.kind);
    const [ifStmt, whileStmt, forStmt, def] = ast.statements;
    expect(kinds((ifStmt as StmtNS.If).elseBlock!)).toEqual(["Assign"]);
    expect(kinds((whileStmt as StmtNS.While).body)).toEqual(["Assign"]);
    expect(kinds((forStmt as StmtNS.For).body)).toEqual(["Assign"]);
    expect(kinds((def as StmtNS.FunctionDef).body)).toEqual(["Assign"]);
  });

  test("in the body of a multi-statement lambda", () => {
    // `lambda x :: block` cannot be written as a one-line statement, so the tree is put together:
    // `g = <lambda>`, where the lambda's body is `e: int = 5`.
    const [assign] = statements("g = 0") as StmtNS.Assign[];
    const [annotated] = statements("e: int = 5");
    const lambda = new ExprNS.MultiLambda(
      assign.value.startToken,
      assign.value.endToken,
      [],
      [annotated],
      [],
    );
    assign.value = lambda;
    eraseTypes(assign);
    expect(lambda.body.map(s => s.kind)).toEqual(["Assign"]);
  });

  test("the result is a Python §4 program: it resolves with the validators of §4", () => {
    const code = "def f(x: int) -> int:\n    y: int = x\n    return y\ntype T = int\nprint(f(1))";
    const ast = prepareTypedProgram(toPythonAst(code)) as StmtNS.FileInput;
    const errors = new Resolver(code + "\n", ast, makeChapter4Validators(), []).resolve(ast);
    // Only the names of the (not loaded) library are unknown: no error about types.
    expect(errors.map(e => e.message).join("\n")).not.toMatch(/annotation|type statements/);
  });

  test("names in types are not looked up: types are not values", () => {
    const code = "def f(x: LList[Thing]) -> Callable[[int], Unknown]:\n    return x";
    const ast = prepareTypedProgram(toPythonAst(code)) as StmtNS.FileInput;
    const errors = new Resolver(code + "\n", ast, makeChapter4Validators(), []).resolve(ast);
    expect(errors).toEqual([]);
  });
});

/** Programs of Typed Python §4, each with the Python §4 program that it is without its types. */
const programs: Record<string, { typed: string; plain: string; output: string }> = {
  recursion: {
    typed: [
      "def factorial(n: int) -> int:",
      "    return 1 if n == 0 else n * factorial(n - 1)",
      "",
      "def fib(n: int) -> int:",
      "    if n <= 1:",
      "        return n",
      "    else:",
      "        return fib(n - 1) + fib(n - 2)",
      "",
      "print(factorial(10))",
      "print(fib(15))",
    ].join("\n"),
    plain: [
      "def factorial(n):",
      "    return 1 if n == 0 else n * factorial(n - 1)",
      "",
      "def fib(n):",
      "    if n <= 1:",
      "        return n",
      "    else:",
      "        return fib(n - 1) + fib(n - 2)",
      "",
      "print(factorial(10))",
      "print(fib(15))",
    ].join("\n"),
    output: "3628800\n610\n",
  },
  "linked lists, generic functions and aliases": {
    typed: [
      "type IntList = LList[int]",
      "",
      "def sum_llist(xs: IntList) -> int:",
      "    return 0 if is_none(xs) else head(xs) + sum_llist(tail(xs))",
      "",
      "def map_llist[A, B](f: Callable[[A], B], xs: LList[A]) -> LList[B]:",
      "    return None if is_none(xs) else pair(f(head(xs)), map_llist(f, tail(xs)))",
      "",
      "xs: IntList = llist(1, 2, 3)",
      "print(sum_llist(map_llist(lambda x: x * 2, xs)))",
    ].join("\n"),
    plain: [
      "def sum_llist(xs):",
      "    return 0 if is_none(xs) else head(xs) + sum_llist(tail(xs))",
      "",
      "def map_llist(f, xs):",
      "    return None if is_none(xs) else pair(f(head(xs)), map_llist(f, tail(xs)))",
      "",
      "xs = llist(1, 2, 3)",
      "print(sum_llist(map_llist(lambda x: x * 2, xs)))",
    ].join("\n"),
    output: "12\n",
  },
  "closures and nonlocal": {
    typed: [
      "def make_counter() -> Callable[[], int]:",
      "    count: int = 0",
      "    def inc() -> int:",
      "        nonlocal count",
      "        count = count + 1",
      "        return count",
      "    return inc",
      "",
      "c = make_counter()",
      "c()",
      "print(c())",
    ].join("\n"),
    plain: [
      "def make_counter():",
      "    count = 0",
      "    def inc():",
      "        nonlocal count",
      "        count = count + 1",
      "        return count",
      "    return inc",
      "",
      "c = make_counter()",
      "c()",
      "print(c())",
    ].join("\n"),
    output: "2\n",
  },
  "loops and lists": {
    typed: [
      "def sum_to(n: int) -> int:",
      "    total: int = 0",
      "    for i in range(n + 1):",
      "        total = total + i",
      "    return total",
      "",
      "xs: list[int] = [3, 1, 2]",
      "i: int = 0",
      "while i < 3:",
      "    xs[i] = xs[i] * 2",
      "    i = i + 1",
      "print(sum_to(10))",
      "print(xs)",
    ].join("\n"),
    plain: [
      "def sum_to(n):",
      "    total = 0",
      "    for i in range(n + 1):",
      "        total = total + i",
      "    return total",
      "",
      "xs = [3, 1, 2]",
      "i = 0",
      "while i < 3:",
      "    xs[i] = xs[i] * 2",
      "    i = i + 1",
      "print(sum_to(10))",
      "print(xs)",
    ].join("\n"),
    output: "55\n[6, 2, 4]\n",
  },
  "and and or": {
    typed: [
      "def is_even(n: int) -> bool:",
      "    return n == 0 or is_odd(n - 1)",
      "",
      "def is_odd(n: int) -> bool:",
      "    return n != 0 and is_even(n - 1)",
      "",
      "print(is_even(10))",
      "print(is_odd(10))",
    ].join("\n"),
    plain: [
      "def is_even(n):",
      "    return n == 0 or is_odd(n - 1)",
      "",
      "def is_odd(n):",
      "    return n != 0 and is_even(n - 1)",
      "",
      "print(is_even(10))",
      "print(is_odd(10))",
    ].join("\n"),
    output: "True\nFalse\n",
  },
};

describe("a program behaves the same with its types erased, on every engine", () => {
  const realParse = parserAdapter.parse;

  beforeAll(() => {
    // The engines parse the source text that they are given. Erase the types of what they parse, as
    // the Typed Python §4 evaluator will do before it hands the program on (a plain program has no
    // types to erase).
    jest
      .spyOn(parserAdapter, "parse")
      .mockImplementation((source: string) => eraseTypes(realParse(source)));
  });
  afterAll(() => {
    jest.restoreAllMocks();
  });

  const engines: [string, (code: string) => Promise<string>][] = [
    ["CSE machine", code => runCode(code, 4)],
    ["py2js", code => Promise.resolve(runCodePy2Js(code, 4).output)],
    ["PVML in the browser", code => runCodePvmlInterpreter(code, 4)],
  ];

  describe.each(engines)("%s", (_engine, run) => {
    test.each(Object.entries(programs))("%s", async (_name, { typed, plain, output }) => {
      const plainOutput = await run(plain);
      expect(plainOutput).toBe(output);
      expect(await run(typed)).toBe(plainOutput);
    });
  });
});
