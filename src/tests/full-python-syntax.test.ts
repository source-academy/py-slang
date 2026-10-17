/**
 * The syntax that full Python has beyond Python §4: tuples (also as assignment targets),
 * dictionaries, keyword arguments and default values. The parser accepts it; every sublanguage
 * (§1–§4) rejects it with a FeatureNotSupportedError.
 */
import { ExprNS, StmtNS } from "../ast-types";
import { parse } from "../parser/parser-adapter";
import { analyze } from "../resolver";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import { FeatureNotSupportedError } from "../validator";

function statements(src: string): StmtNS.Stmt[] {
  const result = parse(src + "\n");
  expect(result).toBeInstanceOf(StmtNS.FileInput);
  return result.statements;
}

function expression(src: string): ExprNS.Expr {
  const stmt = statements(src)[0];
  expect(stmt).toBeInstanceOf(StmtNS.SimpleExpr);
  return (stmt as StmtNS.SimpleExpr).expression;
}

function errorsIn(src: string, chapter: number): Error[] {
  const script = src + "\n";
  return analyze(parse(script), script, chapter, [misc, math]);
}

describe("tuples", () => {
  test("() is the empty tuple", () => {
    const e = expression("()");
    expect(e).toBeInstanceOf(ExprNS.Tuple);
    expect((e as ExprNS.Tuple).elements).toHaveLength(0);
  });

  test("(e) is a grouping, (e,) a tuple with one element", () => {
    expect(expression("(1)")).toBeInstanceOf(ExprNS.Grouping);
    const e = expression("(1,)") as ExprNS.Tuple;
    expect(e).toBeInstanceOf(ExprNS.Tuple);
    expect(e.elements).toHaveLength(1);
  });

  test("elements are separated by commas, with an optional trailing comma", () => {
    expect((expression("(1, 2, 3)") as ExprNS.Tuple).elements).toHaveLength(3);
    expect((expression("(1, 2, 3,)") as ExprNS.Tuple).elements).toHaveLength(3);
  });

  test("tuples nest, and may hold lists and calls", () => {
    const e = expression("((1, 2), [3], f(4))") as ExprNS.Tuple;
    expect(e.elements.map(x => x.constructor)).toEqual([ExprNS.Tuple, ExprNS.List, ExprNS.Call]);
  });

  test("a tuple without parentheses is the right-hand side of an assignment or a return", () => {
    const [assign, ret] = statements("x = 1, 2\nreturn 3, 4") as [StmtNS.Assign, StmtNS.Return];
    expect(assign.value).toBeInstanceOf(ExprNS.Tuple);
    expect((assign.value as ExprNS.Tuple).elements).toHaveLength(2);
    expect(ret.value).toBeInstanceOf(ExprNS.Tuple);
  });

  test("a tuple does not change what a call's arguments or a list's elements are", () => {
    expect((expression("f(1, 2)") as ExprNS.Call).args).toHaveLength(2);
    expect((expression("[1, 2]") as ExprNS.List).elements).toHaveLength(2);
  });

  test("a, b = e assigns to several names", () => {
    const [stmt] = statements("a, b = 1, 2") as [StmtNS.TupleAssign];
    expect(stmt).toBeInstanceOf(StmtNS.TupleAssign);
    expect(stmt.target.elements.map(x => x.constructor)).toEqual([
      ExprNS.Variable,
      ExprNS.Variable,
    ]);
    expect(stmt.value).toBeInstanceOf(ExprNS.Tuple);
  });

  test("targets may be subscripts, nested, parenthesized or end in a comma", () => {
    const [a, b, c, d] = statements("x[0], y = p\n(a, b), c = q\n(m, n) = r\nk, = s") as [
      StmtNS.TupleAssign,
      StmtNS.TupleAssign,
      StmtNS.TupleAssign,
      StmtNS.TupleAssign,
    ];
    expect(a.target.elements.map(x => x.constructor)).toEqual([ExprNS.Subscript, ExprNS.Variable]);
    expect(b.target.elements.map(x => x.constructor)).toEqual([ExprNS.Tuple, ExprNS.Variable]);
    expect(c.target.elements).toHaveLength(2);
    expect(d.target.elements).toHaveLength(1);
  });

  test("a tuple assignment may be the body of an inline block", () => {
    const [stmt] = statements("if True: a, b = 1, 2") as [StmtNS.If];
    expect(stmt.body[0]).toBeInstanceOf(StmtNS.TupleAssign);
  });
});

describe("dictionaries", () => {
  test("{} is the empty dictionary", () => {
    const e = expression("{}") as ExprNS.Dict;
    expect(e).toBeInstanceOf(ExprNS.Dict);
    expect(e.keys).toHaveLength(0);
  });

  test("keys and values are in order, with an optional trailing comma", () => {
    const e = expression("{1: 'a', 'b': [2], (3, 4): None,}") as ExprNS.Dict;
    expect(e.keys).toHaveLength(3);
    expect(e.values).toHaveLength(3);
    expect(e.keys[2]).toBeInstanceOf(ExprNS.Tuple);
  });

  test("a dictionary may be written over several lines", () => {
    const e = expression("{\n  1: 2,\n  3: 4\n}") as ExprNS.Dict;
    expect(e.keys).toHaveLength(2);
  });

  test("a dictionary's values are subscripted and assigned to as before", () => {
    expect(statements("d[1] = 2")[0]).toBeInstanceOf(StmtNS.Assign);
    expect(expression("d[1]")).toBeInstanceOf(ExprNS.Subscript);
  });
});

describe("keyword arguments", () => {
  test("name=value is a Keyword among the arguments, in order", () => {
    const e = expression("f(1, *xs, k=2, m=3)") as ExprNS.Call;
    expect(e.args.map(x => x.constructor)).toEqual([
      ExprNS.BigIntLiteral,
      ExprNS.Starred,
      ExprNS.Keyword,
      ExprNS.Keyword,
    ]);
    expect((e.args[2] as ExprNS.Keyword).name.lexeme).toBe("k");
    expect((e.args[3] as ExprNS.Keyword).value).toBeInstanceOf(ExprNS.BigIntLiteral);
  });

  test("a comparison is not a keyword argument", () => {
    const e = expression("f(k == 2)") as ExprNS.Call;
    expect(e.args[0]).toBeInstanceOf(ExprNS.Compare);
  });
});

describe("default values", () => {
  test("a parameter of def may have a default", () => {
    const [def] = statements("def f(a, b=1, *c):\n    return a") as [StmtNS.FunctionDef];
    expect(def.parameters.map(p => p.lexeme)).toEqual(["a", "b", "c"]);
    expect(def.parameters.map(p => p.default !== undefined)).toEqual([false, true, false]);
    expect(def.parameters.map(p => p.isStarred)).toEqual([false, false, true]);
  });

  test("a parameter of a lambda may have a default", () => {
    const e = expression("lambda x, y=2: x + y") as ExprNS.Lambda;
    expect(e.parameters.map(p => p.default !== undefined)).toEqual([false, true]);
  });

  test("a default is an expression, which may be a lambda or a conditional", () => {
    const [def] = statements("def f(a=lambda: 1, b=2 if True else 3):\n    return a") as [
      StmtNS.FunctionDef,
    ];
    expect(def.parameters[0].default).toBeInstanceOf(ExprNS.Lambda);
    expect(def.parameters[1].default).toBeInstanceOf(ExprNS.Ternary);
  });
});

describe("the sublanguages reject what full Python adds", () => {
  const programs: [string, string][] = [
    ["a tuple", "x = (1, 2)"],
    ["an empty tuple", "x = ()"],
    ["a tuple without parentheses", "x = 1, 2"],
    ["assignment to several names", "a, b = 1, 2"],
    ["a dictionary", "d = {1: 2}"],
    ["an empty dictionary", "d = {}"],
    ["a keyword argument", "f(k=1)"],
    ["a default value in def", "def f(x=1):\n    return x"],
    ["a default value in lambda", "g = lambda x=1: x"],
  ];

  for (const chapter of [1, 2, 3, 4]) {
    describe(`Python §${chapter}`, () => {
      test.each(programs)("%s", (_, program) => {
        // `f` and `d` need not exist: the validators and the resolver both report, and the
        // feature error is among them.
        const errors = errorsIn(program, chapter);
        expect(errors.some(e => e instanceof FeatureNotSupportedError)).toBe(true);
      });
    });
  }

  test("the message names the feature", () => {
    const errors = errorsIn("x = (1, 2)", 4);
    expect(errors[0].message).toContain("tuples");
    expect(errors[0].message).toContain("Feature not supported in this sublanguage");
  });

  test("programs without them are unaffected", () => {
    expect(errorsIn("def f(a, b):\n    return [a, b]\nf(1, 2)", 4)).toEqual([]);
  });
});
