/**
 * The syntax that full Python has beyond Python §4: tuples (also as assignment targets),
 * dictionaries, keyword arguments and default values. The parser accepts it; every sublanguage
 * (§1–§4) rejects it with a FeatureNotSupportedError.
 */
import { ExprNS, StmtNS } from "../ast-types";
import { parse, ParseError } from "../parser/parser-adapter";
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
    ["attribute access", "a.b"],
    ["attribute assignment", "a.b = 1"],
    ["augmented assignment", "x += 1"],
    ["augmented assignment of a subscript", "xs[0] -= 1"],
    ["unpacking in a for loop", "for a, b in xs:\n    pass"],
    ["a chained comparison", "a < b < c"],
    ["a bitwise operator", "x = a & b"],
    ["a shift", "x = a << 1"],
    ["bitwise not", "x = ~a"],
    ["yield", "def f():\n    yield 1"],
    ["yield from", "def f():\n    yield from g()"],
    ["a list comprehension", "[x for x in xs]"],
    ["a set comprehension", "{x for x in xs}"],
    ["a dictionary comprehension", "{x: 1 for x in xs}"],
    ["a generator expression", "(x for x in xs)"],
    ["a generator expression as the argument", "f(x for x in xs)"],
    ["a slice", "xs[1:2]"],
    ["a set display", "{1, 2}"],
    ["dictionary unpacking in a display", "d = {**a}"],
    ["dictionary unpacking in a call", "f(**d)"],
    ["unpacking in a list display", "[*xs, 1]"],
    ["**kwargs in def", "def f(**kw):\n    return kw"],
    ["**kwargs in lambda", "g = lambda **kw: kw"],
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

    test("a bare except must be the last handler, and there is at most one", () => {
      expect(() => parse("try:\n    a()\nexcept:\n    b()\nexcept E:\n    c()\n")).toThrow();
      expect(() => parse("try:\n    a()\nexcept:\n    b()\nexcept:\n    c()\n")).toThrow();
      const last = first<StmtNS.Try>("try:\n    a()\nexcept E:\n    b()\nexcept:\n    c()");
      expect(last.handlers.map(h => h.type === null)).toEqual([false, true]);
      const only = first<StmtNS.Try>("try:\n    a()\nexcept:\n    b()\nelse:\n    c()");
      expect(only.handlers).toHaveLength(1);
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

  test("the resolver declares a decorated function or class, also for use inside itself", () => {
    const script =
      [
        "d = lambda x: x",
        "@d",
        "def f(n):",
        "    return f if n > 0 else 0",
        "@d",
        "class A:",
        "    pass",
        "def g():",
        "    return A",
        "f(1)",
        "A",
      ].join("\n") + "\n";
    const errors = analyze(parse(script), script, 4, [misc, math]);
    expect(errors.length).toBeGreaterThan(0);
    for (const e of errors) expect(e).toBeInstanceOf(FeatureNotSupportedError);
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

describe("expressions and targets of full Python", () => {
  const op = (e: ExprNS.Expr): string => (e as ExprNS.Binary).operator.lexeme;

  describe("attribute access", () => {
    test("a.b, chained, and on calls and subscripts", () => {
      const e = expression("a.b.c") as ExprNS.Attribute;
      expect(e).toBeInstanceOf(ExprNS.Attribute);
      expect(e.name.lexeme).toBe("c");
      expect((e.value as ExprNS.Attribute).name.lexeme).toBe("b");
      expect(expression("f(x).y")).toBeInstanceOf(ExprNS.Attribute);
      expect(expression("xs[0].y")).toBeInstanceOf(ExprNS.Attribute);
      expect(expression("a.b(1).c(2)")).toBeInstanceOf(ExprNS.Call);
    });

    test("a method call is a call of an attribute", () => {
      const c = expression("a.m(1)") as ExprNS.Call;
      expect(c.callee).toBeInstanceOf(ExprNS.Attribute);
    });

    test("a.b = e is an AttributeAssign, also for deeper targets", () => {
      const a = statements("a.b = 1")[0] as StmtNS.AttributeAssign;
      expect(a).toBeInstanceOf(StmtNS.AttributeAssign);
      expect(a.target.name.lexeme).toBe("b");
      const b = statements("xs[0].c.d = 1")[0] as StmtNS.AttributeAssign;
      expect(b.target.value).toBeInstanceOf(ExprNS.Attribute);
      expect(statements("a.b[0] = 1")[0]).toBeInstanceOf(StmtNS.Assign);
    });
  });

  describe("augmented assignment", () => {
    test.each(["+=", "-=", "*=", "/=", "//=", "%=", "**=", "&=", "|=", "^=", "<<=", ">>=", "@="])(
      "%s",
      operator => {
        const [stmt] = statements(`x ${operator} 1`) as [StmtNS.AugAssign];
        expect(stmt).toBeInstanceOf(StmtNS.AugAssign);
        expect(stmt.operator.lexeme).toBe(operator);
        expect(stmt.target).toBeInstanceOf(ExprNS.Variable);
      },
    );

    test("targets are names, subscripts and attributes", () => {
      const [a, b, c] = statements("x += 1\nxs[0] += 1\na.b += 1") as StmtNS.AugAssign[];
      expect(a.target).toBeInstanceOf(ExprNS.Variable);
      expect(b.target).toBeInstanceOf(ExprNS.Subscript);
      expect(c.target).toBeInstanceOf(ExprNS.Attribute);
    });

    test("the target may be in parentheses, but it is a single name, subscript or attribute", () => {
      const [a, b, c] = statements(
        "(x) += 1\n(obj.field) -= 1\n((items[0])) *= 2",
      ) as StmtNS.AugAssign[];
      expect(a.target).toBeInstanceOf(ExprNS.Variable);
      expect(b.target).toBeInstanceOf(ExprNS.Attribute);
      expect(c.target).toBeInstanceOf(ExprNS.Subscript);
      expect(() => parse("(x,) += 1\n")).toThrow();
      expect(() => parse("(a, b) += 1\n")).toThrow();
      expect(() => parse("a, b += 1\n")).toThrow();
    });

    test("@= is a matrix-multiplication assignment, which the sublanguages reject by name", () => {
      expect(errorsIn("matrix @= other", 4)[0].message).toContain("augmented assignment (@=)");
    });

    test("the operators do not change the arithmetic ones", () => {
      expect(op(expression("a ** b"))).toBe("**");
      expect(op(expression("a // b"))).toBe("//");
      expect((statements("x = a < b")[0] as StmtNS.Assign).value).toBeInstanceOf(ExprNS.Compare);
      expect(statements("x == 1")[0]).toBeInstanceOf(StmtNS.SimpleExpr);
    });

    test("may be the body of an inline block", () => {
      expect((statements("if c: x += 1")[0] as StmtNS.If).body[0]).toBeInstanceOf(StmtNS.AugAssign);
    });
  });

  describe("unpacking targets", () => {
    test("for a, b in xs", () => {
      const f = statements("for a, b in xs:\n    pass")[0] as StmtNS.ForUnpack;
      expect(f).toBeInstanceOf(StmtNS.ForUnpack);
      expect(f.target.elements).toHaveLength(2);
      expect(f.iter).toBeInstanceOf(ExprNS.Variable);
      expect(f.body).toHaveLength(1);
    });

    test("parenthesized, nested, starred, with attributes and subscripts", () => {
      const kinds = (src: string) =>
        (statements(src)[0] as StmtNS.ForUnpack).target.elements.map(e => e.constructor);
      expect(kinds("for (a, b) in xs:\n    pass")).toHaveLength(2);
      expect(kinds("for (a, b), c in xs:\n    pass")).toEqual([ExprNS.Tuple, ExprNS.Variable]);
      expect(kinds("for a, *b in xs:\n    pass")).toEqual([ExprNS.Variable, ExprNS.Starred]);
      expect(kinds("for a.x, b[0] in xs:\n    pass")).toEqual([ExprNS.Attribute, ExprNS.Subscript]);
      expect(kinds("for a, in xs:\n    pass")).toHaveLength(1);
    });

    test("a for loop over one name is still a For", () => {
      expect(statements("for x in xs:\n    pass")[0]).toBeInstanceOf(StmtNS.For);
    });

    test("starred targets in assignment", () => {
      const kinds = (src: string) =>
        (statements(src)[0] as StmtNS.TupleAssign).target.elements.map(e => e.constructor);
      expect(kinds("a, *b = xs")).toEqual([ExprNS.Variable, ExprNS.Starred]);
      expect(kinds("*a, b = xs")).toEqual([ExprNS.Starred, ExprNS.Variable]);
      expect(kinds("a, *b, c = xs")).toEqual([ExprNS.Variable, ExprNS.Starred, ExprNS.Variable]);
    });

    test("at most one starred target in each target list", () => {
      for (const src of [
        "a, *b, *c = xs",
        "*a, *b = xs",
        "*a, b, *c = xs",
        "for a, *b, *c in xs:\n    pass",
        "(*a, *b), c = xs",
        "*a = xs",
        "for *a in xs:\n    pass",
      ]) {
        expect(() => parse(src + "\n")).toThrow();
      }
      for (const src of [
        "*a, = xs",
        "*a, b = xs",
        "a, *b, = xs",
        "a, b, *c = xs",
        "(a, *b), *c = xs",
        "*a, (b, *c) = xs",
        "for *a, b in xs:\n    pass",
        "for (a, *b), *c in xs:\n    pass",
      ]) {
        expect(() => parse(src + "\n")).not.toThrow();
      }
      const t = statements("a, *b, c = xs")[0] as StmtNS.TupleAssign;
      expect(t.target.elements.map(e => e.constructor)).toEqual([
        ExprNS.Variable,
        ExprNS.Starred,
        ExprNS.Variable,
      ]);
    });

    test("attributes are targets of tuple assignment, del and with", () => {
      const t = statements("a.x, b[0] = 1, 2")[0] as StmtNS.TupleAssign;
      expect(t.target.elements.map(e => e.constructor)).toEqual([
        ExprNS.Attribute,
        ExprNS.Subscript,
      ]);
      expect((statements("del a.b")[0] as StmtNS.Del).targets[0]).toBeInstanceOf(ExprNS.Attribute);
      const w = statements("with f() as a.b:\n    pass")[0] as StmtNS.With;
      expect(w.items[0].target).toBeInstanceOf(ExprNS.Attribute);
    });
  });

  describe("bitwise operators", () => {
    test("precedence: | below ^ below & below shifts below +", () => {
      // a | b ^ c & d  ==  a | (b ^ (c & d))
      const e = expression("a | b ^ c & d") as ExprNS.Binary;
      expect(op(e)).toBe("|");
      expect(op(e.right)).toBe("^");
      expect(op((e.right as ExprNS.Binary).right)).toBe("&");
      // a + 1 << 2  ==  (a + 1) << 2
      const s = expression("a + 1 << 2") as ExprNS.Binary;
      expect(op(s)).toBe("<<");
      expect(op(s.left)).toBe("+");
    });

    test("they bind tighter than comparisons, and are left associative", () => {
      const c = expression("a | b < c & d") as ExprNS.Compare;
      expect(c).toBeInstanceOf(ExprNS.Compare);
      expect(op(c.left)).toBe("|");
      expect(op(c.right)).toBe("&");
      const l = expression("a << 1 >> 2") as ExprNS.Binary;
      expect(op(l)).toBe(">>");
      expect(op(l.left)).toBe("<<");
    });

    test("~ is a unary operator", () => {
      const e = expression("~~a") as ExprNS.Unary;
      expect(e).toBeInstanceOf(ExprNS.Unary);
      expect(e.operator.lexeme).toBe("~");
      expect(e.right).toBeInstanceOf(ExprNS.Unary);
    });
  });

  describe("chained comparisons", () => {
    test("a single comparison is still a Compare", () => {
      expect(expression("a < b")).toBeInstanceOf(ExprNS.Compare);
    });

    test("two or more operators make a CompareChain, in order", () => {
      const c = expression("a < b <= c") as ExprNS.CompareChain;
      expect(c).toBeInstanceOf(ExprNS.CompareChain);
      expect(c.operators.map(o => o.lexeme)).toEqual(["<", "<="]);
      expect(c.comparators).toHaveLength(2);
      const d = expression("1 < x <= 10 != y") as ExprNS.CompareChain;
      expect(d.operators.map(o => o.lexeme)).toEqual(["<", "<=", "!="]);
      expect(d.comparators).toHaveLength(3);
    });

    test("with in, not in, is and is not", () => {
      const c = expression("a in b not in c is d is not e") as ExprNS.CompareChain;
      expect(c.operators.map(o => o.lexeme)).toEqual(["in", "not in", "is", "is not"]);
    });

    test("the operands are not comparisons themselves", () => {
      const c = expression("a + 1 < b | 2 < c") as ExprNS.CompareChain;
      expect(c.left).toBeInstanceOf(ExprNS.Binary);
      expect(c.comparators[0]).toBeInstanceOf(ExprNS.Binary);
      expect(c.comparators[1]).toBeInstanceOf(ExprNS.Variable);
    });

    test("and/or combine chains, as before", () => {
      const e = expression("a < b < c and d < e") as ExprNS.BoolOp;
      expect(e.left).toBeInstanceOf(ExprNS.CompareChain);
      expect(e.right).toBeInstanceOf(ExprNS.Compare);
    });
  });

  describe("the sublanguages name the feature", () => {
    test.each([
      ["a.b", "attribute access"],
      ["a.b = 1", "assignment to attributes"],
      ["x += 1", "augmented assignment (+=)"],
      ["for a, b in xs:\n    pass", "unpacking in for loops"],
      ["a < b < c", "chained comparisons"],
      ["x = a | b", "bitwise operators (|)"],
      ["x = a << 1", "bitwise operators (<<)"],
      ["x = ~a", "bitwise operators (~)"],
    ])("%s", (program, feature) => {
      expect(errorsIn(program, 3)[0].message).toContain(feature);
    });
  });

  describe("consumers", () => {
    test("traverseAST visits what the new nodes contain", () => {
      const names: string[] = [];
      const src = [
        "obj.field = other",
        "total += step",
        "for key, value in items:",
        "    pass",
        "check = low < mid.size <= high",
      ].join("\n");
      traverseAST(parse(src + "\n"), node => {
        if (node instanceof ExprNS.Variable) names.push(node.name.lexeme);
      });
      for (const n of ["obj", "other", "total", "step", "items", "low", "mid", "high"]) {
        expect(names).toContain(n);
      }
    });

    test("parse() rejects them instead of dropping them or mis-naming them", () => {
      for (const src of [
        "a.b",
        "a.b = 1",
        "x += 1",
        "for a, b in xs:\n    pass",
        "a < b < c",
        "a & b",
        "a << 1",
        "~a",
      ]) {
        expect(() => transform(parse(src + "\n"), new Set())).toThrow();
      }
      expect(() => transform(parse("a | b\n"), new Set())).toThrow(
        "Bitwise operators are not supported in parse tree generation",
      );
    });

    test("the resolver declares the names that the new statements bind", () => {
      const script =
        [
          "xs = 1",
          "total = 0",
          "total += xs",
          "for key, value in xs:",
          "    key",
          "    value",
          "first, *rest = xs",
          "first",
          "rest",
        ].join("\n") + "\n";
      const errors = analyze(parse(script), script, 4, [misc, math]);
      expect(errors.length).toBeGreaterThan(0);
      for (const e of errors) expect(e).toBeInstanceOf(FeatureNotSupportedError);
    });
  });
});

describe("the rest of the expressions of full Python", () => {
  const first = <T extends StmtNS.Stmt>(src: string): T => statements(src)[0] as T;
  const comp = (src: string) => expression(src) as ExprNS.Comprehension;

  describe("yield", () => {
    const yielded = (src: string) =>
      (first<StmtNS.FunctionDef>(`def f():\n    ${src}`).body[0] as StmtNS.SimpleExpr)
        .expression as ExprNS.Yield;

    test("as a statement: bare, with a value, with several values, and from", () => {
      expect(yielded("yield")).toBeInstanceOf(ExprNS.Yield);
      expect(yielded("yield").value).toBeNull();
      expect(yielded("yield 1").value).toBeInstanceOf(ExprNS.BigIntLiteral);
      expect(yielded("yield 1, 2").value).toBeInstanceOf(ExprNS.Tuple);
      const from = yielded("yield from g()");
      expect(from.delegate).toBe(true);
      expect(from.value).toBeInstanceOf(ExprNS.Call);
      expect(yielded("yield 1").delegate).toBe(false);
    });

    test("as the right-hand side of an assignment, and in parentheses", () => {
      const body = (src: string) => first<StmtNS.FunctionDef>(`def f():\n    ${src}`).body[0];
      expect((body("x = yield 1") as StmtNS.Assign).value).toBeInstanceOf(ExprNS.Yield);
      expect((body("x += yield") as StmtNS.AugAssign).value).toBeInstanceOf(ExprNS.Yield);
      expect((body("a.b = yield") as StmtNS.AttributeAssign).value).toBeInstanceOf(ExprNS.Yield);
      expect((body("a, b = yield 1") as StmtNS.TupleAssign).value).toBeInstanceOf(ExprNS.Yield);
      const sum = (body("y = (yield 1) + 2") as StmtNS.Assign).value as ExprNS.Binary;
      expect((sum.left as ExprNS.Grouping).expression).toBeInstanceOf(ExprNS.Yield);
    });

    test("not after return, and not without a value to take", () => {
      expect(() => parse("def f():\n    return yield 1\n")).toThrow();
      expect(() => parse("def f():\n    x = yield from\n")).toThrow();
    });
  });

  describe("comprehensions", () => {
    test("list, set, dictionary and generator expression", () => {
      expect(comp("[x for x in xs]").variant).toBe("list");
      expect(comp("{x for x in xs}").variant).toBe("set");
      expect(comp("(x for x in xs)").variant).toBe("generator");
      const d = comp("{k: v * 2 for k, v in d.items()}");
      expect(d.variant).toBe("dict");
      expect(d.element).toBeInstanceOf(ExprNS.Variable);
      expect(d.value).toBeInstanceOf(ExprNS.Binary);
      expect(d.generators[0].target).toBeInstanceOf(ExprNS.Tuple);
    });

    test("several for clauses, each with its conditions", () => {
      const c = comp("[y for x in xs if a if b for y in x if c]");
      expect(c.generators).toHaveLength(2);
      expect(c.generators[0].conditions).toHaveLength(2);
      expect(c.generators[1].conditions).toHaveLength(1);
      expect(c.generators[1].iter).toBeInstanceOf(ExprNS.Variable);
    });

    test("the element may be a conditional expression, the iterable and conditions may not", () => {
      expect(comp("[a if c else d for x in xs]").element).toBeInstanceOf(ExprNS.Ternary);
      expect(comp("[x for x in a or b]").generators[0].iter).toBeInstanceOf(ExprNS.BoolOp);
      expect(() => parse("[x for x in a if b else c]\n")).toThrow();
    });

    test("targets: names, tuples, parenthesized tuples, attributes", () => {
      const kinds = (src: string) => comp(src).generators[0].target.constructor;
      expect(kinds("[x for x in xs]")).toBe(ExprNS.Variable);
      expect(kinds("[x for a, b in xs]")).toBe(ExprNS.Tuple);
      expect(kinds("[x for (a, b) in xs]")).toBe(ExprNS.Tuple);
      expect(kinds("[x for a.b in xs]")).toBe(ExprNS.Attribute);
      expect(kinds("[x for a, *b in xs]")).toBe(ExprNS.Tuple);
    });

    test("a generator expression as the only argument of a call, or in parentheses", () => {
      const call = expression("sum(x * x for x in xs)") as ExprNS.Call;
      expect(call.args).toHaveLength(1);
      expect((call.args[0] as ExprNS.Comprehension).variant).toBe("generator");
      expect(comp("o.m(x for x in xs)")).toBeInstanceOf(ExprNS.Call);
      const two = expression("f(a, (x for x in xs))") as ExprNS.Call;
      expect(two.args).toHaveLength(2);
    });

    test("they nest, and the displays that they resemble are unchanged", () => {
      expect(comp("[[y for y in x] for x in xs]").element).toBeInstanceOf(ExprNS.Comprehension);
      expect(expression("[x, y]")).toBeInstanceOf(ExprNS.List);
      expect(expression("(x)")).toBeInstanceOf(ExprNS.Grouping);
      expect(expression("{x: y}")).toBeInstanceOf(ExprNS.Dict);
    });

    test("malformed ones are syntax errors", () => {
      for (const src of [
        "[x for x in]",
        "[for x in xs]",
        "[x for in xs]",
        "[x, y for x in xs]",
        "[*a for a in b]",
      ]) {
        expect(() => parse(src + "\n")).toThrow();
      }
    });
  });

  describe("slices", () => {
    const index = (src: string) => (expression(src) as ExprNS.Subscript).index as ExprNS.Slice;
    const parts = (src: string) => {
      const s = index(src);
      return [s.lower, s.upper, s.step].map(p => p !== null);
    };

    test("every combination of lower, upper and step", () => {
      expect(parts("a[1:2]")).toEqual([true, true, false]);
      expect(parts("a[:]")).toEqual([false, false, false]);
      expect(parts("a[1:]")).toEqual([true, false, false]);
      expect(parts("a[:2]")).toEqual([false, true, false]);
      expect(parts("a[1:2:3]")).toEqual([true, true, true]);
      expect(parts("a[::2]")).toEqual([false, false, true]);
      expect(parts("a[1::2]")).toEqual([true, false, true]);
      expect(parts("a[::]")).toEqual([false, false, false]);
      expect(parts("a[1:2:]")).toEqual([true, true, false]);
      expect(parts("a[:2:3]")).toEqual([false, true, true]);
      expect(parts("a[1: :2]")).toEqual([true, false, true]);
    });

    test("the parts are expressions; a plain index is still an expression", () => {
      expect(index("a[i + 1:j - 1]").lower).toBeInstanceOf(ExprNS.Binary);
      expect(index("a[x if c else d:e]").lower).toBeInstanceOf(ExprNS.Ternary);
      expect((expression("a[1]") as ExprNS.Subscript).index).toBeInstanceOf(ExprNS.BigIntLiteral);
    });

    test("assignment to, deletion of and augmentation of a slice", () => {
      const a = first<StmtNS.Assign>("a[1:2] = b");
      expect((a.target as ExprNS.Subscript).index).toBeInstanceOf(ExprNS.Slice);
      expect(first<StmtNS.Del>("del a[1:2]").targets[0]).toBeInstanceOf(ExprNS.Subscript);
      expect(first<StmtNS.AugAssign>("a[1:2] += b").target).toBeInstanceOf(ExprNS.Subscript);
      expect(first<StmtNS.TupleAssign>("a[::2], b = c").target.elements[0]).toBeInstanceOf(
        ExprNS.Subscript,
      );
    });

    test("too many colons are a syntax error", () => {
      expect(() => parse("a[1:2:3:4]\n")).toThrow();
      expect(() => parse("a[]\n")).toThrow();
    });
  });

  describe("set displays, dictionary unpacking and unpacking in displays", () => {
    test("{1, 2} is a set, {} is a dictionary", () => {
      expect((expression("{1, 2,}") as ExprNS.Set).elements).toHaveLength(2);
      expect(expression("{1}")).toBeInstanceOf(ExprNS.Set);
      expect(expression("{}")).toBeInstanceOf(ExprNS.Dict);
    });

    test("**d in a dictionary display has a null key", () => {
      const d = expression("{'a': 1, **b, 'c': 2}") as ExprNS.Dict;
      expect(d.keys.map(k => k !== null)).toEqual([true, false, true]);
      expect(d.values[1]).toBeInstanceOf(ExprNS.Variable);
      expect((expression("{**a, **b}") as ExprNS.Dict).keys).toEqual([null, null]);
    });

    test("*xs in list, tuple and set displays", () => {
      const kinds = (src: string) =>
        (expression(src) as ExprNS.List | ExprNS.Tuple | ExprNS.Set).elements.map(
          e => e.constructor,
        );
      expect(kinds("[*a, b]")).toEqual([ExprNS.Starred, ExprNS.Variable]);
      expect(kinds("(a, *b)")).toEqual([ExprNS.Variable, ExprNS.Starred]);
      expect(kinds("{*a, 1}")).toEqual([ExprNS.Starred, ExprNS.BigIntLiteral]);
      expect(first<StmtNS.Assign>("x = *a, b").value).toBeInstanceOf(ExprNS.Tuple);
      expect(() => parse("(*a)\n")).toThrow();
      expect(() => parse("x = *a\n")).toThrow();
    });
  });

  describe("*args, **kwargs and **d", () => {
    test("**kwargs is the last parameter, after *args and defaults", () => {
      const def = first<StmtNS.FunctionDef>("def f(a, b=1, *args, c, **kw):\n    pass");
      expect(def.parameters.map(p => p.lexeme)).toEqual(["a", "b", "args", "c", "kw"]);
      expect(def.parameters.map(p => !!p.isDoubleStarred)).toEqual([
        false,
        false,
        false,
        false,
        true,
      ]);
      expect(def.parameters.map(p => p.isStarred)).toEqual([false, false, true, false, false]);
      const lam = expression("lambda a, **kw: kw") as ExprNS.Lambda;
      expect(lam.parameters[1].isDoubleStarred).toBe(true);
    });

    test("**kwargs must be last, and there is only one", () => {
      for (const src of [
        "def f(**kw, a):\n    pass",
        "def f(**a, **b):\n    pass",
        "def f(**kw,):\n    pass",
      ]) {
        expect(() => parse(src + "\n")).toThrow();
      }
    });

    test("**d among the arguments of a call and the bases of a class", () => {
      const call = expression("f(*a, **d, **e)") as ExprNS.Call;
      expect(call.args.map(a => a.constructor)).toEqual([
        ExprNS.Starred,
        ExprNS.DoubleStarred,
        ExprNS.DoubleStarred,
      ]);
      expect(first<StmtNS.Class>("class A(*bases, **kw):\n    pass").bases[1]).toBeInstanceOf(
        ExprNS.DoubleStarred,
      );
    });
  });

  describe("the order of arguments and of parameters", () => {
    const message = (src: string): string => {
      try {
        parse(src + "\n");
      } catch (e) {
        return (e as Error).message;
      }
      return "";
    };

    test("a positional argument cannot follow a keyword argument or **d", () => {
      expect(message("f(k=1, a)")).toBe("positional argument follows keyword argument");
      expect(message("f(k=1, a, b)")).toBe("positional argument follows keyword argument");
      expect(message("f(**d, a)")).toBe("positional argument follows keyword argument unpacking");
      expect(message("class A(k=1, B):\n    pass")).toBe(
        "positional argument follows keyword argument",
      );
      expect(message("f(**d, *a)")).toBe(
        "iterable argument unpacking follows keyword argument unpacking",
      );
    });

    test("what is allowed after keyword arguments", () => {
      for (const src of [
        "f(a, k=1)",
        "f(k=1, *a)",
        "f(k=1, **d)",
        "f(**a, **b)",
        "f(**a, k=1)",
        "f(*a, b, *c)",
      ]) {
        expect(() => parse(src + "\n")).not.toThrow();
      }
    });

    test("a parameter without a default cannot follow one with a default", () => {
      const msg = "parameter without a default follows parameter with a default";
      expect(message("def f(a=1, b):\n    pass")).toBe(msg);
      expect(message("def f(a, b=1, c):\n    pass")).toBe(msg);
      expect(message("lambda a=1, b: a")).toBe(msg);
      expect(message("lambda a, b=1, c: a")).toBe(msg);
    });

    test("what is allowed after defaults: more defaults, *args, keyword-only, **kwargs", () => {
      for (const src of [
        "def f(a=1, b=2):\n    pass",
        "def f(a, b=1, *args):\n    pass",
        "def f(a=1, *args, b):\n    pass",
        "def f(a, b=1, **kw):\n    pass",
        "lambda a=1, *rest, b: a",
      ]) {
        expect(() => parse(src + "\n")).not.toThrow();
      }
    });

    test("the errors have a position, and are ParseErrors", () => {
      try {
        parse("x = 1\nf(k=1, a)\n");
        throw new Error("did not throw");
      } catch (e) {
        expect(e).toBeInstanceOf(ParseError);
        expect((e as ParseError).line).toBe(2);
        expect((e as ParseError).source).toContain("f(k=1, a)");
      }
    });
  });

  describe("the sublanguages name the feature", () => {
    test.each([
      ["def f():\n    yield 1", "generators (yield)"],
      ["def f():\n    yield from g()", "generators (yield from)"],
      ["[x for x in xs]", "list comprehensions"],
      ["{x for x in xs}", "set comprehensions"],
      ["{k: v for k, v in d}", "dictionary comprehensions"],
      ["(x for x in xs)", "generator expressions"],
      ["xs[1:2]", "slices"],
      ["s = {1, 2}", "set displays"],
      ["f(**d)", "dictionary unpacking"],
      ["xs = [*a, 1]", "unpacking in list displays"],
      ["def f(**kw):\n    return kw", "keyword parameters (**kwargs)"],
      ["g = lambda a, **kw: a", "keyword parameters (**kwargs)"],
    ])("%s", (program, feature) => {
      expect(errorsIn(program, 3).some(e => e.message.includes(feature))).toBe(true);
    });
  });

  describe("consumers", () => {
    test("traverseAST visits what the new nodes contain", () => {
      const names: string[] = [];
      const src = [
        "def gen():",
        "    got = yield produced",
        "    yield from delegate",
        "squares = [elem + offset for elem in source if keep(elem)]",
        "table = {key: val for key, val in pairs}",
        "part = seq[low:high:stride]",
        "merged = {**left, 'k': right}",
        "call = f(*args, **options)",
        "uniq = {item for item in bag}",
        "lazy = (x for x in stream)",
      ].join("\n");
      traverseAST(parse(src + "\n"), node => {
        if (node instanceof ExprNS.Variable) names.push(node.name.lexeme);
      });
      for (const n of [
        "produced",
        "delegate",
        "offset",
        "source",
        "keep",
        "pairs",
        "seq",
        "low",
        "high",
        "stride",
        "left",
        "right",
        "args",
        "options",
        "bag",
        "stream",
      ]) {
        expect(names).toContain(n);
      }
    });

    test("parse() rejects them instead of dropping them", () => {
      for (const src of [
        "[x for x in xs]",
        "{1, 2}",
        "xs[1:2]",
        "def f():\n    yield 1",
        "f(**d)",
        "(x for x in xs)",
      ]) {
        expect(() => transform(parse(src + "\n"), new Set())).toThrow();
      }
      expect(() => transform(parse("def f(**kw):\n    pass\n"), new Set())).toThrow(
        "Keyword parameters are not supported in parse tree generation",
      );
    });

    test("the resolver gives a comprehension a scope of its own, and finds what it uses", () => {
      const script =
        [
          "xs = [1, 2]",
          "offset = 1",
          "ys = [x + offset for x in xs if x]",
          "zs = {k: v for k, v in xs}",
          "gen = (a for a in xs for b in xs if b)",
        ].join("\n") + "\n";
      const errors = analyze(parse(script), script, 4, [misc, math]);
      expect(errors.length).toBeGreaterThan(0);
      for (const e of errors) expect(e).toBeInstanceOf(FeatureNotSupportedError);
      // the loop variable is not visible outside of the comprehension
      const leak = "ys = [x for x in range(3)]\nz = x\n";
      const names = analyze(parse(leak), leak, 4, [misc, math]).filter(
        e => !(e instanceof FeatureNotSupportedError),
      );
      expect(names.length).toBeGreaterThan(0);
    });
  });
});
