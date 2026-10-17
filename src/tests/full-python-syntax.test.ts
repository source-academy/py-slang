/**
 * The syntax that full Python has beyond Python §4: tuples (also as assignment targets),
 * dictionaries, keyword arguments and default values. The parser accepts it; every sublanguage
 * (§1–§4) rejects it with a FeatureNotSupportedError.
 */
import { ExprNS, StmtNS } from "../ast-types";
import { parse } from "../parser/parser-adapter";
import { toFunctionParam } from "../parser/token-bridge";
import { analyze } from "../resolver";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import { transform } from "../stdlib/parser";
import { FeatureNotSupportedError } from "../validator";
import { traverseAST } from "../validator/traverse";

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
    ["a class", "class A:\n    pass"],
    ["a decorator", "@d\ndef f():\n    return 1"],
    ["try/except", "try:\n    f()\nexcept:\n    g()"],
    ["try/finally", "try:\n    f()\nfinally:\n    g()"],
    ["raise", "raise e"],
    ["with", "with a as b:\n    f()"],
    ["del", "del x"],
    ["import", "import math"],
    ["an assertion message", "assert x, 'message'"],
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

describe("consumers of the tree", () => {
  const visited = (src: string): string[] => {
    const names: string[] = [];
    traverseAST(parse(src + "\n"), node => {
      if (node instanceof ExprNS.Variable) names.push(node.name.lexeme);
    });
    return names;
  };

  test("traverseAST visits the default values of def and lambda", () => {
    expect(visited("def f(x=g(a)):\n    return x")).toEqual(expect.arrayContaining(["g", "a"]));
    expect(visited("h = lambda x=b: x")).toEqual(expect.arrayContaining(["b"]));
  });

  test("traverseAST visits the default values of a multi-line lambda", () => {
    // (Built by hand: a multi-line lambda cannot stand alone as a statement.)
    const c = expression("c") as ExprNS.Variable;
    const param = toFunctionParam(
      { type: "name", value: "x", line: 1, col: 1, offset: 0 },
      false,
      c,
    );
    const lambda = new ExprNS.MultiLambda(c.startToken, c.endToken, [param], [], []);
    const names: string[] = [];
    traverseAST(lambda, node => {
      if (node instanceof ExprNS.Variable) names.push(node.name.lexeme);
    });
    expect(names).toEqual(["c"]);
  });

  test("parse() rejects a default value instead of dropping it", () => {
    expect(() => transform(parse("def f(x=1):\n    return x\n"), new Set())).toThrow(
      "Default values of parameters are not supported in parse tree generation",
    );
    expect(() => transform(parse("lambda x=1: x\n"), new Set())).toThrow(
      "Default values of parameters are not supported in parse tree generation",
    );
  });

  test("parse() rejects the other new syntax too", () => {
    for (const src of ["(1, 2)", "{1: 2}", "f(k=1)", "a, b = 1, 2"]) {
      expect(() => transform(parse(src + "\n"), new Set())).toThrow();
    }
  });
});

describe("statements of full Python", () => {
  const first = <T extends StmtNS.Stmt>(src: string): T => statements(src)[0] as T;

  describe("class", () => {
    test("without bases", () => {
      const c = first<StmtNS.Class>("class A:\n    x = 1\n    y = 2");
      expect(c).toBeInstanceOf(StmtNS.Class);
      expect(c.name.lexeme).toBe("A");
      expect(c.bases).toHaveLength(0);
      expect(c.body).toHaveLength(2);
    });

    test("with empty parentheses, or with bases and keywords", () => {
      expect(first<StmtNS.Class>("class A():\n    pass").bases).toHaveLength(0);
      const c = first<StmtNS.Class>("class A(B, C, metaclass=M):\n    pass");
      expect(c.bases.map(b => b.constructor)).toEqual([
        ExprNS.Variable,
        ExprNS.Variable,
        ExprNS.Keyword,
      ]);
    });

    test("methods are function definitions in the body", () => {
      const c = first<StmtNS.Class>("class A:\n    def f(self):\n        return 1");
      expect(c.body[0]).toBeInstanceOf(StmtNS.FunctionDef);
    });
  });

  describe("try", () => {
    test("with except clauses, else and finally", () => {
      const t = first<StmtNS.Try>(
        [
          "try:",
          "    a()",
          "except E:",
          "    b()",
          "except (F, G) as e:",
          "    c()",
          "except:",
          "    d()",
          "else:",
          "    e1()",
          "finally:",
          "    f()",
        ].join("\n"),
      );
      expect(t).toBeInstanceOf(StmtNS.Try);
      expect(t.handlers).toHaveLength(3);
      expect(t.handlers[0].type).toBeInstanceOf(ExprNS.Variable);
      expect(t.handlers[0].name).toBeNull();
      expect(t.handlers[1].type).toBeInstanceOf(ExprNS.Tuple);
      expect(t.handlers[1].name?.lexeme).toBe("e");
      expect(t.handlers[2].type).toBeNull();
      expect(t.orElse).toHaveLength(1);
      expect(t.finalBody).toHaveLength(1);
    });

    test("try/finally without an except clause", () => {
      const t = first<StmtNS.Try>("try:\n    a()\nfinally:\n    b()");
      expect(t.handlers).toHaveLength(0);
      expect(t.orElse).toBeNull();
      expect(t.finalBody).toHaveLength(1);
    });

    test("a try without except or finally is a syntax error", () => {
      expect(() => parse("try:\n    a()\n")).toThrow();
    });
  });

  describe("raise", () => {
    test("bare, with a value, and with a cause", () => {
      const [a, b, c] = statements("raise\nraise E\nraise E from F") as StmtNS.Raise[];
      expect([a.value, a.cause]).toEqual([null, null]);
      expect(b.value).toBeInstanceOf(ExprNS.Variable);
      expect(b.cause).toBeNull();
      expect(c.cause).toBeInstanceOf(ExprNS.Variable);
    });
  });

  describe("with", () => {
    test("with and without as, and with several items", () => {
      const w = first<StmtNS.With>("with a as b, c:\n    f()");
      expect(w.items).toHaveLength(2);
      expect(w.items[0].target).toBeInstanceOf(ExprNS.Variable);
      expect(w.items[1].target).toBeNull();
      expect(w.body).toHaveLength(1);
    });
  });

  describe("del", () => {
    test("names, subscripts and several targets", () => {
      const d = first<StmtNS.Del>("del x, ys[0]");
      expect(d.targets.map(t => t.constructor)).toEqual([ExprNS.Variable, ExprNS.Subscript]);
    });
  });

  describe("import", () => {
    test("a name, a dotted name, an alias, several names", () => {
      const i = first<StmtNS.Import>("import a, b.c as d, e.f");
      expect(i.names.map(n => [n.name.lexeme, n.alias?.lexeme ?? null])).toEqual([
        ["a", null],
        ["b.c", "d"],
        ["e.f", null],
      ]);
    });

    test("from ... import at the start of the program still comes first", () => {
      const stmts = statements("from a import b\nimport c\n");
      expect(stmts.map(s => s.constructor)).toEqual([StmtNS.FromImport, StmtNS.Import]);
    });
  });

  describe("decorators", () => {
    test("on a function and on a class, several of them", () => {
      const [f, c] = statements(
        "@d\n@e(1)\ndef f():\n    return 1\n@d\nclass A:\n    pass",
      ) as StmtNS.Decorated[];
      expect(f).toBeInstanceOf(StmtNS.Decorated);
      expect(f.decorators).toHaveLength(2);
      expect(f.definition).toBeInstanceOf(StmtNS.FunctionDef);
      expect(c.definition).toBeInstanceOf(StmtNS.Class);
    });

    test("a decorator before anything else is a syntax error", () => {
      expect(() => parse("@d\nx = 1\n")).toThrow();
    });
  });

  describe("assert", () => {
    test("with and without a message", () => {
      const [a, b] = statements("assert x\nassert x, 'm'") as StmtNS.Assert[];
      expect(a.message).toBeNull();
      expect(b.message).toBeInstanceOf(ExprNS.Literal);
    });
  });

  test("the former keywords are keywords now, not names", () => {
    for (const word of ["class", "try", "except", "finally", "raise", "with", "del"]) {
      expect(() => parse(`${word} = 1\n`)).toThrow();
    }
  });

  test("simple statements may be the body of an inline block", () => {
    expect(first<StmtNS.If>("if x: raise E").body[0]).toBeInstanceOf(StmtNS.Raise);
    expect(first<StmtNS.If>("if x: del y").body[0]).toBeInstanceOf(StmtNS.Del);
  });
});

describe("consumers of the statements", () => {
  test("traverseAST visits what the statements contain", () => {
    const names: string[] = [];
    const src = [
      "@deco",
      "class A(Base):",
      "    try:",
      "        x = body_call()",
      "    except Err as e:",
      "        raise Wrapped from cause",
      "    else:",
      "        pass",
      "    finally:",
      "        with ctx as target:",
      "            del gone",
      "assert check, message",
    ].join("\n");
    traverseAST(parse(src + "\n"), node => {
      if (node instanceof ExprNS.Variable) names.push(node.name.lexeme);
    });
    for (const n of [
      "deco",
      "Base",
      "body_call",
      "Err",
      "Wrapped",
      "cause",
      "ctx",
      "target",
      "gone",
      "check",
      "message",
    ]) {
      expect(names).toContain(n);
    }
  });

  test("parse() rejects them instead of dropping them", () => {
    for (const src of [
      "class A:\n    pass",
      "try:\n    f()\nfinally:\n    g()",
      "raise E",
      "del x",
      "import m",
    ]) {
      expect(() => transform(parse(src + "\n"), new Set())).toThrow();
    }
    expect(() => transform(parse("assert x, 'm'\n"), new Set())).toThrow(
      "Assertion messages are not supported in parse tree generation",
    );
  });

  test("the resolver declares the names that the statements bind", () => {
    const script =
      [
        "f = 1",
        "E = 2",
        "ctx = 3",
        "class A:",
        "    pass",
        "import m.n as p",
        "try:",
        "    f",
        "except E as err:",
        "    err",
        "with ctx as c:",
        "    c",
        "a, b = 1, 2",
        "A",
        "p",
        "a",
        "b",
      ].join("\n") + "\n";
    const errors = analyze(parse(script), script, 4, [misc, math]);
    // The statements are rejected as features; no name of the program is reported undefined.
    expect(errors.length).toBeGreaterThan(0);
    for (const e of errors) expect(e).toBeInstanceOf(FeatureNotSupportedError);
  });
});
