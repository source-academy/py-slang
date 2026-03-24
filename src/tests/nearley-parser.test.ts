/**
 * Tests for the Nearley-based parser producing class-based AST nodes.
 *
 * These tests bypass the old tokenizer+Parser pipeline entirely and call
 * parse() from parser-adapter directly, asserting that the returned nodes
 * are instanceof the class-based ExprNS/StmtNS classes.
 */
import { parse } from "../parser/parser-adapter";
import { ExprNS, StmtNS } from "../ast-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseStmts(src: string): StmtNS.Stmt[] {
  const result = parse(src + "\n");
  expect(result).toBeInstanceOf(StmtNS.FileInput);
  return result.statements;
}

function parseExpr(src: string): ExprNS.Expr {
  const stmts = parseStmts(src);
  expect(stmts[0]).toBeInstanceOf(StmtNS.SimpleExpr);
  return (stmts[0] as StmtNS.SimpleExpr).expression;
}

// ---------------------------------------------------------------------------
// FileInput wrapper
// ---------------------------------------------------------------------------
describe("FileInput", () => {
  test("empty program returns FileInput with no statements", () => {
    const result = parse("\n");
    expect(result).toBeInstanceOf(StmtNS.FileInput);
    expect(result.statements).toHaveLength(0);
  });

  test("FileInput has startToken and endToken", () => {
    const result = parse("x = 1\n");
    expect(result.startToken).toBeDefined();
    expect(result.endToken).toBeDefined();
  });

  test("multi-statement script", () => {
    const text = `\
from x import (y)
x = 1 if 2 else 3

1 is not 2
3 not in 4
y = lambda a:a

def z(a, b, c, d):
    pass

while x:
    pass

for _ in range(10):
    pass

if x:
    pass
elif y:
    pass
elif z:
    pass
else:
    pass
`;
    const ast = parse(text);
    expect(ast).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Literals
// ---------------------------------------------------------------------------
describe("Literal expressions", () => {
  test("integer produces BigIntLiteral with bigint value", () => {
    const expr = parseExpr("42");
    expect(expr).toBeInstanceOf(ExprNS.BigIntLiteral);
    expect((expr as ExprNS.BigIntLiteral).value).toBe("42");
  });

  test("float produces Literal with float value", () => {
    const expr = parseExpr("3.14");
    expect(expr).toBeInstanceOf(ExprNS.Literal);
    expect((expr as ExprNS.Literal).value).toBeCloseTo(3.14);
  });

  test("True produces Literal(true)", () => {
    const expr = parseExpr("True");
    expect(expr).toBeInstanceOf(ExprNS.Literal);
    expect((expr as ExprNS.Literal).value).toBe(true);
  });

  test("False produces Literal(false)", () => {
    const expr = parseExpr("False");
    expect(expr).toBeInstanceOf(ExprNS.Literal);
    expect((expr as ExprNS.Literal).value).toBe(false);
  });

  test("None produces None node", () => {
    const expr = parseExpr("None");
    expect(expr).toBeInstanceOf(ExprNS.None);
  });

  test("string literal produces Literal", () => {
    const expr = parseExpr('"hello"');
    expect(expr).toBeInstanceOf(ExprNS.Literal);
  });

  test("triple-double-quoted string", () => {
    const expr = parseExpr('"""hello"""');
    expect(expr).toBeInstanceOf(ExprNS.Literal);
    expect((expr as ExprNS.Literal).value).toBe("hello");
  });

  test("triple-double-quoted string with embedded single quote", () => {
    const expr = parseExpr('"""a"b"""');
    expect(expr).toBeInstanceOf(ExprNS.Literal);
    expect((expr as ExprNS.Literal).value).toBe('a"b');
  });

  test("triple-double-quoted string with embedded double quotes", () => {
    const expr = parseExpr('"""a""b"""');
    expect(expr).toBeInstanceOf(ExprNS.Literal);
    expect((expr as ExprNS.Literal).value).toBe('a""b');
  });

  test("triple-single-quoted string", () => {
    const expr = parseExpr("'''hello'''");
    expect(expr).toBeInstanceOf(ExprNS.Literal);
    expect((expr as ExprNS.Literal).value).toBe("hello");
  });

  test("triple-single-quoted string with embedded single quote", () => {
    const expr = parseExpr("'''it's'''");
    expect(expr).toBeInstanceOf(ExprNS.Literal);
    expect((expr as ExprNS.Literal).value).toBe("it's");
  });

  test("triple-quoted string with escape sequence", () => {
    const expr = parseExpr('"""line1\\nline2"""');
    expect(expr).toBeInstanceOf(ExprNS.Literal);
    expect((expr as ExprNS.Literal).value).toBe("line1\nline2");
  });

  test("complex literal produces Complex node", () => {
    const expr = parseExpr("3j");
    expect(expr).toBeInstanceOf(ExprNS.Complex);
    expect((expr as ExprNS.Complex).value.real).toBe(0);
    expect((expr as ExprNS.Complex).value.imag).toBe(3);
  });

  test("large integer produces BigIntLiteral", () => {
    const expr = parseExpr("1000000000");
    expect(expr).toBeInstanceOf(ExprNS.BigIntLiteral);
  });

  test("binary number 0b101010", () => {
    const expr = parseExpr("0b101010");
    expect(expr).toBeInstanceOf(ExprNS.BigIntLiteral);
  });

  test("octal number 0o1234567", () => {
    const expr = parseExpr("0o1234567");
    expect(expr).toBeInstanceOf(ExprNS.BigIntLiteral);
  });

  test("hexadecimal number 0xabcdef", () => {
    const expr = parseExpr("0xabcdef");
    expect(expr).toBeInstanceOf(ExprNS.BigIntLiteral);
  });
});

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------
describe("Variable", () => {
  test("identifier produces Variable with Token", () => {
    const expr = parseExpr("foo");
    expect(expr).toBeInstanceOf(ExprNS.Variable);
    const v = expr as ExprNS.Variable;
    expect(v.name.lexeme).toBe("foo");
  });
});

// ---------------------------------------------------------------------------
// Binary arithmetic
// ---------------------------------------------------------------------------
describe("Binary expressions", () => {
  test("addition: 1 + 2", () => {
    const expr = parseExpr("1 + 2");
    expect(expr).toBeInstanceOf(ExprNS.Binary);
    const b = expr as ExprNS.Binary;
    expect((b.left as ExprNS.BigIntLiteral).value).toBe("1");
    expect((b.right as ExprNS.BigIntLiteral).value).toBe("2");
  });

  test("subtraction: 5 - 3", () => {
    const expr = parseExpr("5 - 3");
    expect(expr).toBeInstanceOf(ExprNS.Binary);
  });

  test("multiplication: 2 * 3", () => {
    const expr = parseExpr("2 * 3");
    expect(expr).toBeInstanceOf(ExprNS.Binary);
  });

  test("division: 1 / 1", () => {
    const expr = parseExpr("1 / 1");
    expect(expr).toBeInstanceOf(ExprNS.Binary);
  });

  test("floor division: 7 // 2", () => {
    const expr = parseExpr("7 // 2");
    expect(expr).toBeInstanceOf(ExprNS.Binary);
  });

  test("modulus: 1 % 1", () => {
    const expr = parseExpr("1 % 1");
    expect(expr).toBeInstanceOf(ExprNS.Binary);
  });

  test("power: 2 ** 10", () => {
    const expr = parseExpr("2 ** 10");
    expect(expr).toBeInstanceOf(ExprNS.Binary);
  });

  test("operator token has correct lexeme", () => {
    const expr = parseExpr("1 + 2") as ExprNS.Binary;
    expect(expr.operator.lexeme).toBe("+");
  });

  test("parenthesized: (1 + 2) * 3", () => {
    const expr = parseExpr("(1 + 2) * 3");
    expect(expr).toBeInstanceOf(ExprNS.Binary);
    const b = expr as ExprNS.Binary;
    expect(b.left).toBeInstanceOf(ExprNS.Grouping);
  });

  test("large exponentiation: 100000000 ** 100000000 + 1", () => {
    const expr = parseExpr("100000000 ** 100000000 + 1");
    expect(expr).toBeInstanceOf(ExprNS.Binary);
  });
});

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------
describe("Compare expressions", () => {
  test("x == y", () => {
    const expr = parseExpr("x == y");
    expect(expr).toBeInstanceOf(ExprNS.Compare);
  });

  test("x < y", () => {
    const expr = parseExpr("x < y");
    expect(expr).toBeInstanceOf(ExprNS.Compare);
    expect((expr as ExprNS.Compare).operator.lexeme).toBe("<");
  });

  test("x > y", () => {
    const expr = parseExpr("x > y");
    expect(expr).toBeInstanceOf(ExprNS.Compare);
  });

  test("x <= y", () => {
    const expr = parseExpr("x <= y");
    expect(expr).toBeInstanceOf(ExprNS.Compare);
  });

  test("x >= y", () => {
    const expr = parseExpr("x >= y");
    expect(expr).toBeInstanceOf(ExprNS.Compare);
  });

  test("x != y", () => {
    const expr = parseExpr("x != y");
    expect(expr).toBeInstanceOf(ExprNS.Compare);
  });

  test("x is y", () => {
    const expr = parseExpr("1 is not 2");
    expect(expr).toBeInstanceOf(ExprNS.Compare);
  });

  test("x not in y", () => {
    const expr = parseExpr("3 not in 4");
    expect(expr).toBeInstanceOf(ExprNS.Compare);
  });
});

// ---------------------------------------------------------------------------
// Unary
// ---------------------------------------------------------------------------
describe("Unary expressions", () => {
  test("negation: -x", () => {
    const expr = parseExpr("-x");
    expect(expr).toBeInstanceOf(ExprNS.Unary);
  });

  test("negation: -1", () => {
    const expr = parseExpr("-1");
    expect(expr).toBeInstanceOf(ExprNS.Unary);
  });

  test("not: not True", () => {
    const expr = parseExpr("not True");
    expect(expr).toBeInstanceOf(ExprNS.Unary);
    expect((expr as ExprNS.Unary).operator.lexeme).toBe("not");
  });

  test("not: not 1", () => {
    const expr = parseExpr("not 1");
    expect(expr).toBeInstanceOf(ExprNS.Unary);
  });
});

// ---------------------------------------------------------------------------
// BoolOp
// ---------------------------------------------------------------------------
describe("BoolOp expressions", () => {
  test("x and y", () => {
    const expr = parseExpr("x and y");
    expect(expr).toBeInstanceOf(ExprNS.BoolOp);
    expect((expr as ExprNS.BoolOp).operator.lexeme).toBe("and");
  });

  test("x or y", () => {
    const expr = parseExpr("x or y");
    expect(expr).toBeInstanceOf(ExprNS.BoolOp);
    expect((expr as ExprNS.BoolOp).operator.lexeme).toBe("or");
  });

  test("1 and 2", () => {
    const expr = parseExpr("1 and 2");
    expect(expr).toBeInstanceOf(ExprNS.BoolOp);
  });

  test("1 or 2", () => {
    const expr = parseExpr("1 or 2");
    expect(expr).toBeInstanceOf(ExprNS.BoolOp);
  });
});

// ---------------------------------------------------------------------------
// Ternary
// ---------------------------------------------------------------------------
describe("Ternary expressions", () => {
  test("1 if True else 2", () => {
    const expr = parseExpr("1 if True else 2");
    expect(expr).toBeInstanceOf(ExprNS.Ternary);
    const t = expr as ExprNS.Ternary;
    expect(t.predicate).toBeInstanceOf(ExprNS.Literal);
    expect(t.consequent).toBeInstanceOf(ExprNS.BigIntLiteral);
    expect(t.alternative).toBeInstanceOf(ExprNS.BigIntLiteral);
  });

  test("x if y else 1", () => {
    const expr = parseExpr("x if y else 1");
    expect(expr).toBeInstanceOf(ExprNS.Ternary);
  });

  test("nested ternary: 1 if a else 2 if b else 3", () => {
    const expr = parseExpr("1 if a else 2 if b else 3");
    expect(expr).toBeInstanceOf(ExprNS.Ternary);
    const t = expr as ExprNS.Ternary;
    expect(t.alternative).toBeInstanceOf(ExprNS.Ternary);
  });

  test("assignment with ternary: x = 1 if 2 else 3", () => {
    const stmts = parseStmts("x = 1 if 2 else 3");
    expect(stmts[0]).toBeInstanceOf(StmtNS.Assign);
    const a = stmts[0] as StmtNS.Assign;
    expect(a.value).toBeInstanceOf(ExprNS.Ternary);
  });
});

// ---------------------------------------------------------------------------
// Call
// ---------------------------------------------------------------------------
describe("Call expressions", () => {
  test("f() produces Call with empty args", () => {
    const expr = parseExpr("f()");
    expect(expr).toBeInstanceOf(ExprNS.Call);
    expect((expr as ExprNS.Call).args).toHaveLength(0);
  });

  test("f(1, 2) produces Call with two args", () => {
    const expr = parseExpr("f(1, 2)");
    expect(expr).toBeInstanceOf(ExprNS.Call);
    expect((expr as ExprNS.Call).args).toHaveLength(2);
  });

  test("callee is a Variable", () => {
    const expr = parseExpr("print(x)") as ExprNS.Call;
    expect(expr.callee).toBeInstanceOf(ExprNS.Variable);
    expect((expr.callee as ExprNS.Variable).name.lexeme).toBe("print");
  });

  test("nested call: f(g(1))", () => {
    const expr = parseExpr("f(g(1))") as ExprNS.Call;
    expect(expr.args[0]).toBeInstanceOf(ExprNS.Call);
  });
});

// ---------------------------------------------------------------------------
// List and Subscript
// ---------------------------------------------------------------------------
describe("List expressions", () => {
  test("empty list []", () => {
    const expr = parseExpr("[]");
    expect(expr).toBeInstanceOf(ExprNS.List);
    expect((expr as ExprNS.List).elements).toHaveLength(0);
  });

  test("[1, 2, 3] has three elements", () => {
    const expr = parseExpr("[1, 2, 3]");
    expect(expr).toBeInstanceOf(ExprNS.List);
    expect((expr as ExprNS.List).elements).toHaveLength(3);
  });
});

describe("Subscript expressions", () => {
  test("xs[0] produces Subscript", () => {
    const expr = parseExpr("xs[0]");
    expect(expr).toBeInstanceOf(ExprNS.Subscript);
    const s = expr as ExprNS.Subscript;
    expect(s.value).toBeInstanceOf(ExprNS.Variable);
    expect(s.index).toBeInstanceOf(ExprNS.BigIntLiteral);
  });
});

// ---------------------------------------------------------------------------
// Lambda
// ---------------------------------------------------------------------------
describe("Lambda expressions", () => {
  test("lambda x: x produces Lambda with one param", () => {
    const expr = parseExpr("lambda x: x");
    expect(expr).toBeInstanceOf(ExprNS.Lambda);
    const l = expr as ExprNS.Lambda;
    expect(l.parameters).toHaveLength(1);
    expect(l.parameters[0].lexeme).toBe("x");
  });

  test("lambda: 1 produces Lambda with no params", () => {
    const expr = parseExpr("lambda: 1");
    expect(expr).toBeInstanceOf(ExprNS.Lambda);
    expect((expr as ExprNS.Lambda).parameters).toHaveLength(0);
  });

  test("nested lambda: lambda a: lambda b: b + a", () => {
    const expr = parseExpr("lambda a: lambda b: b + a");
    expect(expr).toBeInstanceOf(ExprNS.Lambda);
    expect((expr as ExprNS.Lambda).body).toBeInstanceOf(ExprNS.Lambda);
  });

  test("complex lambda: increment_repeater", () => {
    const expr = parseExpr("lambda repeater: lambda f: lambda x: f(repeater(f)(x))");
    expect(expr).toBeInstanceOf(ExprNS.Lambda);
  });

  test("lambda assigned to variable", () => {
    const stmts = parseStmts("y = lambda a:a");
    expect(stmts[0]).toBeInstanceOf(StmtNS.Assign);
    expect((stmts[0] as StmtNS.Assign).value).toBeInstanceOf(ExprNS.Lambda);
  });
});

// ---------------------------------------------------------------------------
// Assignment statements
// ---------------------------------------------------------------------------
describe("Assignment statements", () => {
  test("x = 1 produces Assign with Variable target", () => {
    const stmts = parseStmts("x = 1");
    expect(stmts[0]).toBeInstanceOf(StmtNS.Assign);
    const a = stmts[0] as StmtNS.Assign;
    expect(a.target).toBeInstanceOf(ExprNS.Variable);
    expect((a.target as ExprNS.Variable).name.lexeme).toBe("x");
    expect(a.value).toBeInstanceOf(ExprNS.BigIntLiteral);
  });

  test("x: num = 1 produces AnnAssign", () => {
    const stmts = parseStmts("x: num = 1");
    expect(stmts[0]).toBeInstanceOf(StmtNS.AnnAssign);
  });
});

// ---------------------------------------------------------------------------
// Control flow statements
// ---------------------------------------------------------------------------
describe("Control flow statements", () => {
  test("pass produces Pass", () => {
    const stmts = parseStmts("pass");
    expect(stmts[0]).toBeInstanceOf(StmtNS.Pass);
  });

  test("break produces Break", () => {
    const stmts = parseStmts("def f():\n    break");
    const body = (stmts[0] as StmtNS.FunctionDef).body;
    expect(body[0]).toBeInstanceOf(StmtNS.Break);
  });

  test("continue produces Continue", () => {
    const stmts = parseStmts("def f():\n    continue");
    const body = (stmts[0] as StmtNS.FunctionDef).body;
    expect(body[0]).toBeInstanceOf(StmtNS.Continue);
  });

  test("return 42 produces Return with BigIntLiteral", () => {
    const stmts = parseStmts("def f():\n    return 42");
    const body = (stmts[0] as StmtNS.FunctionDef).body;
    expect(body[0]).toBeInstanceOf(StmtNS.Return);
    expect((body[0] as StmtNS.Return).value).toBeInstanceOf(ExprNS.BigIntLiteral);
  });

  test("return without value produces Return(null)", () => {
    const stmts = parseStmts("def f():\n    return");
    const body = (stmts[0] as StmtNS.FunctionDef).body;
    expect((body[0] as StmtNS.Return).value).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// If statement
// ---------------------------------------------------------------------------
describe("If statement", () => {
  test("if/else produces If with elseBlock", () => {
    const stmts = parseStmts("if True:\n    pass\nelse:\n    pass");
    expect(stmts[0]).toBeInstanceOf(StmtNS.If);
    const ifStmt = stmts[0] as StmtNS.If;
    expect(ifStmt.body).toHaveLength(1);
    expect(ifStmt.elseBlock).not.toBeNull();
  });

  test("if without else has null elseBlock", () => {
    const stmts = parseStmts("if True:\n    pass");
    const ifStmt = stmts[0] as StmtNS.If;
    expect(ifStmt.elseBlock).toBeNull();
  });

  test("elif chain is nested If nodes", () => {
    const src = "if x:\n    pass\nelif y:\n    pass\nelse:\n    pass";
    const stmts = parseStmts(src);
    const ifStmt = stmts[0] as StmtNS.If;
    expect(ifStmt.elseBlock![0]).toBeInstanceOf(StmtNS.If);
  });

  test("if-elif-else with expressions", () => {
    const src = `\
if x > 10:
    print("x is greater than 10")
elif x == 10:
    print("x is equal to 10")
else:
    print("x is less than 10")`;
    const stmts = parseStmts(src);
    expect(stmts[0]).toBeInstanceOf(StmtNS.If);
  });

  test("nested if/else", () => {
    const src = `\
if True:
    if True:
        x = 1
    else:
        x = 2
else:
    x = 3`;
    const stmts = parseStmts(src);
    const outer = stmts[0] as StmtNS.If;
    expect(outer.body[0]).toBeInstanceOf(StmtNS.If);
    expect(outer.elseBlock).not.toBeNull();
    const inner = outer.body[0] as StmtNS.If;
    expect(inner.elseBlock).not.toBeNull();
  });

  test("nested if without inner else", () => {
    const src = `\
if True:
    if True:
        x = 1
    y = 2
z = 3`;
    const stmts = parseStmts(src);
    expect(stmts).toHaveLength(2); // if + z = 3
    const outer = stmts[0] as StmtNS.If;
    expect(outer.body).toHaveLength(2); // inner if + y = 2
  });

  test("inner if with else inside outer if", () => {
    const src = `\
if True:
    if True:
        x = 1
    else:
        x = 2`;
    const stmts = parseStmts(src);
    const outer = stmts[0] as StmtNS.If;
    const inner = outer.body[0] as StmtNS.If;
    expect(inner.elseBlock).not.toBeNull();
  });

  test("deeply nested if/else (branch_test pattern)", () => {
    const src = `\
def branch_test(a, b, c):
    if a > 0:
        if b < 0:
            if c > 0:
                return -3
            else:
                return -2
        else:
            if c > 0:
                return -1
            else:
                return 0
    else:
        if b < 0:
            if c > 0:
                return 1
            else:
                return 2
        else:
            if c > 0:
                return 3
            else:
                return 4`;
    const stmts = parseStmts(src);
    expect(stmts[0]).toBeInstanceOf(StmtNS.FunctionDef);
    const fn = stmts[0] as StmtNS.FunctionDef;
    const topIf = fn.body[0] as StmtNS.If;
    expect(topIf).toBeInstanceOf(StmtNS.If);
    expect(topIf.elseBlock).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// While statement
// ---------------------------------------------------------------------------
describe("While statement", () => {
  test("while True: pass", () => {
    const stmts = parseStmts("while True:\n    pass");
    expect(stmts[0]).toBeInstanceOf(StmtNS.While);
    const w = stmts[0] as StmtNS.While;
    expect(w.condition).toBeInstanceOf(ExprNS.Literal);
    expect(w.body[0]).toBeInstanceOf(StmtNS.Pass);
  });

  test("while x: pass", () => {
    const stmts = parseStmts("while x:\n    pass");
    expect(stmts[0]).toBeInstanceOf(StmtNS.While);
  });
});

// ---------------------------------------------------------------------------
// For statement
// ---------------------------------------------------------------------------
describe("For statement", () => {
  test("for i in xs: pass", () => {
    const stmts = parseStmts("for i in xs:\n    pass");
    expect(stmts[0]).toBeInstanceOf(StmtNS.For);
    const f = stmts[0] as StmtNS.For;
    expect(f.target.lexeme).toBe("i");
  });

  test("for _ in range(10): pass", () => {
    const stmts = parseStmts("for _ in range(10):\n    pass");
    expect(stmts[0]).toBeInstanceOf(StmtNS.For);
  });
});

// ---------------------------------------------------------------------------
// FunctionDef statement
// ---------------------------------------------------------------------------
describe("FunctionDef statement", () => {
  test("def f(): pass produces FunctionDef", () => {
    const stmts = parseStmts("def f():\n    pass");
    expect(stmts[0]).toBeInstanceOf(StmtNS.FunctionDef);
    const fn = stmts[0] as StmtNS.FunctionDef;
    expect(fn.name.lexeme).toBe("f");
    expect(fn.parameters).toHaveLength(0);
  });

  test("def add(a, b): return a + b has two parameters", () => {
    const stmts = parseStmts("def add(a, b):\n    return a + b");
    const fn = stmts[0] as StmtNS.FunctionDef;
    expect(fn.parameters).toHaveLength(2);
    expect(fn.parameters[0].lexeme).toBe("a");
    expect(fn.parameters[1].lexeme).toBe("b");
  });

  test("def with multiple statements in body", () => {
    const src = `\
def y(a, b, c):
    pass
    pass`;
    const stmts = parseStmts(src);
    const fn = stmts[0] as StmtNS.FunctionDef;
    expect(fn.body).toHaveLength(2);
  });

  test("nested function definition", () => {
    const src = `\
def y(a, b, c):
    def z(d):
        x = 2
        return a + b + c + d
    return z`;
    const stmts = parseStmts(src);
    const outer = stmts[0] as StmtNS.FunctionDef;
    expect(outer.body[0]).toBeInstanceOf(StmtNS.FunctionDef);
  });

  test("nested function calls", () => {
    const src = `\
def f1(x, y):
    return 1

def f2(x, y):
    return y

f1(f2(1, 2), 2)`;
    const stmts = parseStmts(src);
    expect(stmts).toHaveLength(3);
    expect(stmts[2]).toBeInstanceOf(StmtNS.SimpleExpr);
  });
});

// ---------------------------------------------------------------------------
// Import statement
// ---------------------------------------------------------------------------
describe("Import statement", () => {
  test("from math import sqrt produces FromImport", () => {
    const stmts = parseStmts("from math import sqrt");
    expect(stmts[0]).toBeInstanceOf(StmtNS.FromImport);
    const imp = stmts[0] as StmtNS.FromImport;
    expect(imp.module.lexeme).toBe("math");
    expect(imp.names[0].name.lexeme).toBe("sqrt");
    expect(imp.names[0].alias).toBeNull();
  });

  test("from x import (a, b, c) produces FromImport with multiple names", () => {
    const stmts = parseStmts("from x import (a, b, c)");
    expect(stmts[0]).toBeInstanceOf(StmtNS.FromImport);
    const imp = stmts[0] as StmtNS.FromImport;
    expect(imp.names).toHaveLength(3);
  });

  test("dotted import: from foo.bar import baz", () => {
    const stmts = parseStmts("from foo.bar import baz");
    expect(stmts[0]).toBeInstanceOf(StmtNS.FromImport);
    const imp = stmts[0] as StmtNS.FromImport;
    expect(imp.module.lexeme).toBe("foo.bar");
    expect(imp.names).toHaveLength(1);
    expect(imp.names[0].name.lexeme).toBe("baz");
    expect(imp.names[0].alias).toBeNull();
  });

  test("import with alias: from foo import bar as baz", () => {
    const stmts = parseStmts("from foo import bar as baz");
    expect(stmts[0]).toBeInstanceOf(StmtNS.FromImport);
    const imp = stmts[0] as StmtNS.FromImport;
    expect(imp.names).toHaveLength(1);
    expect(imp.names[0].name.lexeme).toBe("bar");
    expect(imp.names[0].alias!.lexeme).toBe("baz");
  });

  test("dotted import with parenthesized names", () => {
    const stmts = parseStmts("from foo.bar import (baz, qux)");
    expect(stmts[0]).toBeInstanceOf(StmtNS.FromImport);
    const imp = stmts[0] as StmtNS.FromImport;
    expect(imp.module.lexeme).toBe("foo.bar");
    expect(imp.names).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Assert statement
// ---------------------------------------------------------------------------
describe("Assert statement", () => {
  test("assert True produces Assert", () => {
    const stmts = parseStmts("assert True");
    expect(stmts[0]).toBeInstanceOf(StmtNS.Assert);
  });
});

// ---------------------------------------------------------------------------
// Token tracking
// ---------------------------------------------------------------------------
describe("Token tracking", () => {
  test("every node has startToken and endToken", () => {
    const result = parse("x = 1 + 2\n");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function check(node: any) {
      expect(node.startToken).toBeDefined();
      expect(node.endToken).toBeDefined();
    }
    const assign = result.statements[0] as StmtNS.Assign;
    check(assign);
    check(assign.value); // Binary
    check((assign.value as ExprNS.Binary).left);
    check((assign.value as ExprNS.Binary).right);
  });

  test("startToken.lexeme is the first token of the expression", () => {
    const expr = parseExpr("1 + 2") as ExprNS.Binary;
    expect(expr.startToken.lexeme).toBe("1");
  });
});

// ---------------------------------------------------------------------------
// Left-associativity
// ---------------------------------------------------------------------------
describe("Left-associativity", () => {
  test("subtraction is left-associative: 10 - 3 - 2 = (10 - 3) - 2", () => {
    const expr = parseExpr("10 - 3 - 2") as ExprNS.Binary;
    // outer: (10 - 3) - 2
    expect(expr.operator.lexeme).toBe("-");
    expect(expr.right).toBeInstanceOf(ExprNS.BigIntLiteral);
    expect((expr.right as ExprNS.BigIntLiteral).value).toBe("2");
    // inner left: 10 - 3
    expect(expr.left).toBeInstanceOf(ExprNS.Binary);
    const inner = expr.left as ExprNS.Binary;
    expect(inner.operator.lexeme).toBe("-");
    expect((inner.left as ExprNS.BigIntLiteral).value).toBe("10");
    expect((inner.right as ExprNS.BigIntLiteral).value).toBe("3");
  });

  test("division is left-associative: 24 / 4 / 2 = (24 / 4) / 2", () => {
    const expr = parseExpr("24 / 4 / 2") as ExprNS.Binary;
    expect(expr.operator.lexeme).toBe("/");
    expect(expr.left).toBeInstanceOf(ExprNS.Binary);
    const inner = expr.left as ExprNS.Binary;
    expect(inner.operator.lexeme).toBe("/");
  });

  test("floor division is left-associative: 100 // 7 // 2", () => {
    const expr = parseExpr("100 // 7 // 2") as ExprNS.Binary;
    expect(expr.operator.lexeme).toBe("//");
    expect(expr.left).toBeInstanceOf(ExprNS.Binary);
  });

  test("multiplication is left-associative: 2 * 3 * 4 = (2 * 3) * 4", () => {
    const expr = parseExpr("2 * 3 * 4") as ExprNS.Binary;
    expect(expr.operator.lexeme).toBe("*");
    expect(expr.left).toBeInstanceOf(ExprNS.Binary);
  });

  test("addition is left-associative: 1 + 2 + 3 = (1 + 2) + 3", () => {
    const expr = parseExpr("1 + 2 + 3") as ExprNS.Binary;
    expect(expr.operator.lexeme).toBe("+");
    expect(expr.left).toBeInstanceOf(ExprNS.Binary);
  });

  test("comparison is left-associative: 1 < 2 < 3 = (1 < 2) < 3", () => {
    const expr = parseExpr("1 < 2 < 3") as ExprNS.Compare;
    expect(expr.operator.lexeme).toBe("<");
    expect(expr.left).toBeInstanceOf(ExprNS.Compare);
  });

  test("mixed operators: 10 - 3 + 2 = (10 - 3) + 2", () => {
    const expr = parseExpr("10 - 3 + 2") as ExprNS.Binary;
    expect(expr.operator.lexeme).toBe("+");
    expect(expr.left).toBeInstanceOf(ExprNS.Binary);
    const inner = expr.left as ExprNS.Binary;
    expect(inner.operator.lexeme).toBe("-");
  });
});

// ---------------------------------------------------------------------------
// Compound comparison operators
// ---------------------------------------------------------------------------
describe("Compound comparison operators", () => {
  test('"not in" produces correct lexeme', () => {
    const expr = parseExpr("1 not in [2, 3]") as ExprNS.Compare;
    expect(expr).toBeInstanceOf(ExprNS.Compare);
    expect(expr.operator.lexeme).toBe("not in");
  });

  test('"is not" produces correct lexeme', () => {
    const expr = parseExpr("x is not None") as ExprNS.Compare;
    expect(expr).toBeInstanceOf(ExprNS.Compare);
    expect(expr.operator.lexeme).toBe("is not");
  });

  test('"in" produces correct lexeme', () => {
    const expr = parseExpr("1 in [1, 2]") as ExprNS.Compare;
    expect(expr).toBeInstanceOf(ExprNS.Compare);
    expect(expr.operator.lexeme).toBe("in");
  });

  test('"is" produces correct lexeme', () => {
    const expr = parseExpr("x is None") as ExprNS.Compare;
    expect(expr).toBeInstanceOf(ExprNS.Compare);
    expect(expr.operator.lexeme).toBe("is");
  });
});

// ---------------------------------------------------------------------------
// Boolean operator associativity
// ---------------------------------------------------------------------------
describe("Boolean operator associativity", () => {
  test('"or" is left-associative: a or b or c = (a or b) or c', () => {
    const expr = parseExpr("a or b or c") as ExprNS.BoolOp;
    expect(expr).toBeInstanceOf(ExprNS.BoolOp);
    expect(expr.operator.lexeme).toBe("or");
    expect(expr.right).toBeInstanceOf(ExprNS.Variable);
    expect((expr.right as ExprNS.Variable).name.lexeme).toBe("c");
    expect(expr.left).toBeInstanceOf(ExprNS.BoolOp);
  });

  test('"and" is left-associative: a and b and c = (a and b) and c', () => {
    const expr = parseExpr("a and b and c") as ExprNS.BoolOp;
    expect(expr).toBeInstanceOf(ExprNS.BoolOp);
    expect(expr.operator.lexeme).toBe("and");
    expect(expr.right).toBeInstanceOf(ExprNS.Variable);
    expect((expr.right as ExprNS.Variable).name.lexeme).toBe("c");
    expect(expr.left).toBeInstanceOf(ExprNS.BoolOp);
  });
});

// ---------------------------------------------------------------------------
// Power operator right-associativity
// ---------------------------------------------------------------------------
describe("Power operator", () => {
  test("** is right-associative: 2 ** 3 ** 2 = 2 ** (3 ** 2)", () => {
    const expr = parseExpr("2 ** 3 ** 2") as ExprNS.Binary;
    expect(expr).toBeInstanceOf(ExprNS.Binary);
    expect(expr.operator.lexeme).toBe("**");
    expect(expr.left).toBeInstanceOf(ExprNS.BigIntLiteral);
    expect((expr.left as ExprNS.BigIntLiteral).value).toBe("2");
    expect(expr.right).toBeInstanceOf(ExprNS.Binary);
  });
});

// ---------------------------------------------------------------------------
// String escape sequences
// ---------------------------------------------------------------------------
describe("String escape sequences", () => {
  test("newline escape \\n is processed", () => {
    const expr = parseExpr('"hello\\nworld"') as ExprNS.Literal;
    expect(expr.value).toBe("hello\nworld");
  });

  test("tab escape \\t is processed", () => {
    const expr = parseExpr('"col1\\tcol2"') as ExprNS.Literal;
    expect(expr.value).toBe("col1\tcol2");
  });

  test("backslash escape \\\\ is processed", () => {
    const expr = parseExpr('"path\\\\to"') as ExprNS.Literal;
    expect(expr.value).toBe("path\\to");
  });

  test("hex escape \\x41 is processed", () => {
    const expr = parseExpr('"\\x41"') as ExprNS.Literal;
    expect(expr.value).toBe("A");
  });

  test("null escape \\0 is processed", () => {
    const expr = parseExpr('"a\\0b"') as ExprNS.Literal;
    expect(expr.value).toBe("a\0b");
  });

  test("unrecognized escape is kept literally", () => {
    const expr = parseExpr('"\\q"') as ExprNS.Literal;
    expect(expr.value).toBe("\\q");
  });
});

// ---------------------------------------------------------------------------
// Missing statement coverage
// ---------------------------------------------------------------------------
describe("Global and nonlocal statements", () => {
  test("global statement", () => {
    const stmts = parseStmts("global x");
    expect(stmts[0]).toBeInstanceOf(StmtNS.Global);
  });

  test("nonlocal statement", () => {
    const stmts = parseStmts("def f():\n  nonlocal x\n  x = 1");
    const body = (stmts[0] as StmtNS.FunctionDef).body;
    expect(body[0]).toBeInstanceOf(StmtNS.NonLocal);
  });
});

describe("Pass, break, continue", () => {
  test("pass in function", () => {
    const stmts = parseStmts("def f():\n  pass");
    const body = (stmts[0] as StmtNS.FunctionDef).body;
    expect(body[0]).toBeInstanceOf(StmtNS.Pass);
  });

  test("break in while", () => {
    const stmts = parseStmts("while True:\n  break");
    const body = (stmts[0] as StmtNS.While).body;
    expect(body[0]).toBeInstanceOf(StmtNS.Break);
  });

  test("continue in for", () => {
    const stmts = parseStmts("for x in [1]:\n  continue");
    const body = (stmts[0] as StmtNS.For).body;
    expect(body[0]).toBeInstanceOf(StmtNS.Continue);
  });
});

describe("Annotated assignment", () => {
  test("annotation with value: x: int = 5", () => {
    const stmts = parseStmts("x: int = 5");
    expect(stmts[0]).toBeInstanceOf(StmtNS.AnnAssign);
    const ann = stmts[0] as StmtNS.AnnAssign;
    expect(ann.ann).toBeInstanceOf(ExprNS.Variable);
    expect(ann.value).toBeInstanceOf(ExprNS.BigIntLiteral);
  });

  test("annotation without value: x: int", () => {
    const stmts = parseStmts("x: int");
    expect(stmts[0]).toBeInstanceOf(StmtNS.AnnAssign);
  });
});

describe("Assert statement", () => {
  test("assert with simple expression", () => {
    const stmts = parseStmts("assert True");
    expect(stmts[0]).toBeInstanceOf(StmtNS.Assert);
  });

  test("assert with complex expression", () => {
    const stmts = parseStmts("assert 1 + 2 == 3");
    expect(stmts[0]).toBeInstanceOf(StmtNS.Assert);
  });
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------
describe("Comments in various positions", () => {
  test("inline comment after statement", () => {
    const stmts = parseStmts("x = 1  # comment");
    expect(stmts).toHaveLength(1);
    expect(stmts[0]).toBeInstanceOf(StmtNS.Assign);
  });

  test("comment after code on first line", () => {
    const stmts = parseStmts("x = 1  # first line comment\ny = 2");
    expect(stmts).toHaveLength(2);
  });

  test("inline comment inside function body", () => {
    const stmts = parseStmts("def f():\n  x = 1  # comment\n  return x");
    const body = (stmts[0] as StmtNS.FunctionDef).body;
    expect(body).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Nested and complex expressions (ambiguity stress tests)
// ---------------------------------------------------------------------------
describe("Complex expressions (no ambiguity)", () => {
  test("deeply nested arithmetic: 1 + 2 * 3 - 4 / 2", () => {
    const expr = parseExpr("1 + 2 * 3 - 4 / 2");
    expect(expr).toBeInstanceOf(ExprNS.Binary);
  });

  test("chained comparisons: 1 < 2 < 3 < 4", () => {
    const expr = parseExpr("1 < 2 < 3 < 4") as ExprNS.Compare;
    expect(expr).toBeInstanceOf(ExprNS.Compare);
    expect(expr.left).toBeInstanceOf(ExprNS.Compare);
  });

  test("mixed bool ops: a and b or c and d", () => {
    const expr = parseExpr("a and b or c and d") as ExprNS.BoolOp;
    expect(expr).toBeInstanceOf(ExprNS.BoolOp);
    expect(expr.operator.lexeme).toBe("or");
  });

  test("nested function calls: f(g(x), h(y, z))", () => {
    const expr = parseExpr("f(g(x), h(y, z))") as ExprNS.Call;
    expect(expr).toBeInstanceOf(ExprNS.Call);
    expect(expr.args).toHaveLength(2);
    expect(expr.args[0]).toBeInstanceOf(ExprNS.Call);
    expect(expr.args[1]).toBeInstanceOf(ExprNS.Call);
  });

  test("ternary inside assignment", () => {
    const stmts = parseStmts("x = 1 if True else 2");
    const assign = stmts[0] as StmtNS.Assign;
    expect(assign.value).toBeInstanceOf(ExprNS.Ternary);
  });

  test("list with nested operations", () => {
    const expr = parseExpr("[1 + 2, 3 * 4, f(x)]") as ExprNS.List;
    expect(expr).toBeInstanceOf(ExprNS.List);
    expect(expr.elements).toHaveLength(3);
  });

  test("subscript with expression index", () => {
    const expr = parseExpr("a[1 + 2]") as ExprNS.Subscript;
    expect(expr).toBeInstanceOf(ExprNS.Subscript);
    expect(expr.index).toBeInstanceOf(ExprNS.Binary);
  });

  test("complex precedence: not a and b or c", () => {
    // not a and b or c = ((not a) and b) or c
    const expr = parseExpr("not a and b or c") as ExprNS.BoolOp;
    expect(expr.operator.lexeme).toBe("or");
    const left = expr.left as ExprNS.BoolOp;
    expect(left.operator.lexeme).toBe("and");
    expect(left.left).toBeInstanceOf(ExprNS.Unary);
  });

  test("unary minus with power: -2 ** 3", () => {
    // Python: -2 ** 3 = -(2**3) = -8 (unary minus binds looser than **)
    const expr = parseExpr("-2 ** 3") as ExprNS.Unary;
    expect(expr).toBeInstanceOf(ExprNS.Unary);
    expect(expr.right).toBeInstanceOf(ExprNS.Binary);
  });

  test("multiple statements in function body", () => {
    const src = "def f(x):\n  y = x + 1\n  z = y * 2\n  return z";
    const stmts = parseStmts(src);
    const body = (stmts[0] as StmtNS.FunctionDef).body;
    expect(body).toHaveLength(3);
  });

  test("nested if-elif-else", () => {
    const src = "if a:\n  x = 1\nelif b:\n  x = 2\nelse:\n  x = 3";
    const stmts = parseStmts(src);
    const ifStmt = stmts[0] as StmtNS.If;
    expect(ifStmt).toBeInstanceOf(StmtNS.If);
    expect(ifStmt.elseBlock).toHaveLength(1);
    expect(ifStmt.elseBlock![0]).toBeInstanceOf(StmtNS.If);
  });
});

// ---------------------------------------------------------------------------
// Parse error cases
// ---------------------------------------------------------------------------
describe("Subscript assignment", () => {
  test("subscript assignment: xs[0] = 1", () => {
    const stmts = parseStmts("xs[0] = 1");
    expect(stmts[0]).toBeInstanceOf(StmtNS.Assign);
    const assign = stmts[0] as StmtNS.Assign;
    expect(assign.target).toBeInstanceOf(ExprNS.Subscript);
  });
});

describe("Parse errors", () => {
  test("unclosed parenthesis", () => {
    expect(() => parseStmts("f(1, 2")).toThrow();
  });

  test("missing colon after def", () => {
    expect(() => parseStmts("def f()\n  pass")).toThrow();
  });

  test("expression without context", () => {
    expect(() => parseStmts("= 5")).toThrow();
  });

  test("empty input produces empty FileInput", () => {
    const result = parse("\n");
    expect(result.statements).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rest parameters
// ---------------------------------------------------------------------------
describe("Rest parameters", () => {
  test("def f(*args) parses with starred param", () => {
    const stmts = parseStmts("def f(*args):\n    pass");
    expect(stmts[0]).toBeInstanceOf(StmtNS.FunctionDef);
    const func = stmts[0] as StmtNS.FunctionDef;
    expect(func.parameters).toHaveLength(1);
    expect(func.parameters[0].isStarred).toBe(true);
    expect(func.parameters[0].lexeme).toBe("args");
  });

  test("def f(a, b, *rest) parses mixed params", () => {
    const stmts = parseStmts("def f(a, b, *rest):\n    pass");
    const func = stmts[0] as StmtNS.FunctionDef;
    expect(func.parameters).toHaveLength(3);
    expect(func.parameters[0].isStarred).toBe(false);
    expect(func.parameters[1].isStarred).toBe(false);
    expect(func.parameters[2].isStarred).toBe(true);
    expect(func.parameters[2].lexeme).toBe("rest");
  });
});

// ---------------------------------------------------------------------------
// Negative cases — spec restrictions
// ---------------------------------------------------------------------------
describe("Negative cases — spec restrictions", () => {
  test("import after statement is rejected", () => {
    expect(() => parseStmts("x = 1\nfrom math import sqrt")).toThrow();
  });

  test("import inside function body is rejected", () => {
    expect(() => parseStmts("def f():\n    from math import sqrt")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Indentation tests
// ---------------------------------------------------------------------------
describe("Indentation handling", () => {
  test("single indented block", () => {
    const stmts = parseStmts("if True:\n    pass");
    expect(stmts[0]).toBeInstanceOf(StmtNS.If);
    const ifStmt = stmts[0] as StmtNS.If;
    expect(ifStmt.body[0]).toBeInstanceOf(StmtNS.Pass);
  });

  test("nested indentation", () => {
    const src = `\
if True:
    if True:
        pass`;
    const stmts = parseStmts(src);
    const outer = stmts[0] as StmtNS.If;
    expect(outer.body[0]).toBeInstanceOf(StmtNS.If);
    const inner = outer.body[0] as StmtNS.If;
    expect(inner.body[0]).toBeInstanceOf(StmtNS.Pass);
  });

  test("dedent to outer level", () => {
    const src = `\
if True:
    x = 1
y = 2`;
    const stmts = parseStmts(src);
    expect(stmts).toHaveLength(2);
    expect(stmts[1]).toBeInstanceOf(StmtNS.Assign);
  });

  test("multiple dedents at once", () => {
    const src = `\
if True:
    if True:
        if True:
            x = 1
y = 2`;
    const stmts = parseStmts(src);
    expect(stmts).toHaveLength(2);
    expect(stmts[1]).toBeInstanceOf(StmtNS.Assign);
  });

  test("blank lines inside block", () => {
    const src = `\
def f():
    x = 1

    y = 2
    return x`;
    const stmts = parseStmts(src);
    const fn = stmts[0] as StmtNS.FunctionDef;
    expect(fn.body).toHaveLength(3);
  });

  test("blank lines between top-level statements", () => {
    const src = `\
x = 1

y = 2

z = 3`;
    const stmts = parseStmts(src);
    expect(stmts).toHaveLength(3);
  });

  test("comment-only lines don't affect indentation", () => {
    const src = `\
def f():
    x = 1
    # this is a comment
    y = 2
    return x`;
    const stmts = parseStmts(src);
    const fn = stmts[0] as StmtNS.FunctionDef;
    expect(fn.body).toHaveLength(3);
  });

  test("deeply nested then fully dedented", () => {
    const src = `\
def f():
    if True:
        if True:
            x = 1
    return x`;
    const stmts = parseStmts(src);
    const fn = stmts[0] as StmtNS.FunctionDef;
    expect(fn.body).toHaveLength(2);
    expect(fn.body[1]).toBeInstanceOf(StmtNS.Return);
  });

  test("tab indentation", () => {
    const src = "if True:\n\tpass";
    const stmts = parseStmts(src);
    expect(stmts[0]).toBeInstanceOf(StmtNS.If);
    const ifStmt = stmts[0] as StmtNS.If;
    expect(ifStmt.body[0]).toBeInstanceOf(StmtNS.Pass);
  });
});

// ---------------------------------------------------------------------------
// Multi-line expression (enclosure) tests
// ---------------------------------------------------------------------------
describe("Multi-line expressions (enclosures)", () => {
  test("function call spanning lines", () => {
    const expr = parseExpr("f(\n  1,\n  2\n)");
    expect(expr).toBeInstanceOf(ExprNS.Call);
    expect((expr as ExprNS.Call).args).toHaveLength(2);
  });

  test("list literal spanning lines", () => {
    const expr = parseExpr("[\n  1,\n  2,\n  3\n]");
    expect(expr).toBeInstanceOf(ExprNS.List);
    expect((expr as ExprNS.List).elements).toHaveLength(3);
  });

  test("function params spanning lines", () => {
    const src = `\
def f(
    a,
    b
):
    pass`;
    const stmts = parseStmts(src);
    const fn = stmts[0] as StmtNS.FunctionDef;
    expect(fn.parameters).toHaveLength(2);
    expect(fn.parameters[0].lexeme).toBe("a");
    expect(fn.parameters[1].lexeme).toBe("b");
  });

  test("nested enclosures spanning lines", () => {
    const expr = parseExpr("f(\n  g(\n    1\n  )\n)");
    expect(expr).toBeInstanceOf(ExprNS.Call);
    const outer = expr as ExprNS.Call;
    expect(outer.args[0]).toBeInstanceOf(ExprNS.Call);
  });

  test("empty parens with newline", () => {
    const expr = parseExpr("f(\n)");
    expect(expr).toBeInstanceOf(ExprNS.Call);
    expect((expr as ExprNS.Call).args).toHaveLength(0);
  });

  test("subscript spanning lines", () => {
    const expr = parseExpr("a[\n  0\n]");
    expect(expr).toBeInstanceOf(ExprNS.Subscript);
  });

  test("indentation inside parens doesn't create indent tokens", () => {
    const src = `\
x = f(
    1,
    2
)`;
    const stmts = parseStmts(src);
    expect(stmts).toHaveLength(1);
    expect(stmts[0]).toBeInstanceOf(StmtNS.Assign);
    const assign = stmts[0] as StmtNS.Assign;
    expect(assign.value).toBeInstanceOf(ExprNS.Call);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe("Edge cases", () => {
  test("empty program", () => {
    const result = parse("\n");
    expect(result).toBeInstanceOf(StmtNS.FileInput);
    expect(result.statements).toHaveLength(0);
  });

  test("program with only comments", () => {
    const result = parse("# just a comment\n");
    expect(result).toBeInstanceOf(StmtNS.FileInput);
    expect(result.statements).toHaveLength(0);
  });

  test("trailing whitespace on blank line", () => {
    const src = "x = 1\n   \ny = 2";
    const stmts = parseStmts(src);
    expect(stmts).toHaveLength(2);
  });

  test("comment between indented statements", () => {
    const src = `\
def f():
    x = 1
    # a comment
    y = 2
    return y`;
    const stmts = parseStmts(src);
    const fn = stmts[0] as StmtNS.FunctionDef;
    expect(fn.body).toHaveLength(3);
  });
});
