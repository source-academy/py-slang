// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
function id(x: unknown[]) {
  return x[0];
}

import { ExprNS, FunctionParam, StmtNS } from "../ast-types";
import { Token } from "../tokenizer";
import pythonLexer from "./lexer";
import { toAstToken, toFunctionParam } from "./token-bridge";

const list = <T>([x]: [T]) => [x];
const drop = () => [];

/** Strip surrounding quotes and process escape sequences. */
function stripQuotes(s: string) {
  let inner;
  if (s.startsWith('"""') || s.startsWith("'''")) inner = s.slice(3, -3);
  else if (s.startsWith('"') || s.startsWith("'")) inner = s.slice(1, -1);
  else return s;
  return inner.replace(/\\(["'\\\/bfnrtav0]|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|.)/g, (_, ch) => {
    switch (ch[0]) {
      case "n":
        return "\n";
      case "t":
        return "\t";
      case "r":
        return "\r";
      case "\\":
        return "\\";
      case "'":
        return "'";
      case '"':
        return '"';
      case "/":
        return "/";
      case "b":
        return "\b";
      case "f":
        return "\f";
      case "a":
        return "\x07";
      case "v":
        return "\x0B";
      case "0":
        return "\0";
      case "x":
        return String.fromCharCode(parseInt(ch.slice(1), 16));
      case "u":
        return String.fromCharCode(parseInt(ch.slice(1), 16));
      default:
        return "\\" + ch; // unrecognized escapes kept literally
    }
  });
}

// ── Leaf AST constructors (token → node) ────────────────────────────────
const astVariable = ([t]: [moo.Token]) => {
  const k = toAstToken(t);
  return new ExprNS.Variable(k, k, k);
};
const astBigInt = ([t]: [moo.Token]) => {
  const k = toAstToken(t);
  return new ExprNS.BigIntLiteral(k, k, t.value);
};
const astComplex = ([t]: [moo.Token]) => {
  const k = toAstToken(t);
  return new ExprNS.Complex(k, k, t.value);
};
const astNone = ([t]: [moo.Token]) => {
  const k = toAstToken(t);
  return new ExprNS.None(k, k);
};
const astString = ([t]: [moo.Token]) => {
  const k = toAstToken(t);
  return new ExprNS.Literal(k, k, stripQuotes(t.value));
};
const astTrue = ([t]: [moo.Token]) => {
  const k = toAstToken(t);
  return new ExprNS.Literal(k, k, true);
};
const astFalse = ([t]: [moo.Token]) => {
  const k = toAstToken(t);
  return new ExprNS.Literal(k, k, false);
};

// ── Operator AST constructors (children → node) ────────────────────────
const astBinary = ([l, op, r]: [ExprNS.Expr, Token, ExprNS.Expr]) =>
  new ExprNS.Binary(l.startToken, r.endToken, l, op, r);
const astBinaryTok = ([l, op, r]: [ExprNS.Expr, moo.Token, ExprNS.Expr]) =>
  new ExprNS.Binary(l.startToken, r.endToken, l, toAstToken(op), r);
const astBoolOp = ([l, op, r]: [ExprNS.Expr, moo.Token, ExprNS.Expr]) =>
  new ExprNS.BoolOp(l.startToken, r.endToken, l, toAstToken(op), r);
const astUnary = ([op, arg]: [moo.Token, ExprNS.Expr]) =>
  new ExprNS.Unary(toAstToken(op), arg.endToken, toAstToken(op), arg);
const astCompare = ([l, op, r]: [ExprNS.Expr, Token, ExprNS.Expr]) =>
  new ExprNS.Compare(l.startToken, r.endToken, l, op, r);

// ── Token / list helpers ────────────────────────────────────────────────
const tok = ([t]: [moo.Token]) => toAstToken(t);
const flatList = <T>([first, rest]: [T, [unknown, T][]]): T[] => [first, ...rest.map(d => d[1])];
const tokList = ([first, rest]: [moo.Token, [unknown, moo.Token][]]) => [
  toAstToken(first),
  ...rest.map(d => toAstToken(d[1])),
];
const Lexer = pythonLexer;
const ParserRules = [
  { name: "program$ebnf$1", symbols: [] },
  { name: "program$ebnf$1$subexpression$1", symbols: ["import_stmt", { type: "newline" }] },
  {
    name: "program$ebnf$1",
    symbols: ["program$ebnf$1", "program$ebnf$1$subexpression$1"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  { name: "program$ebnf$2", symbols: [] },
  { name: "program$ebnf$2$subexpression$1", symbols: ["statement"] },
  { name: "program$ebnf$2$subexpression$1", symbols: [{ type: "newline" }] },
  {
    name: "program$ebnf$2",
    symbols: ["program$ebnf$2", "program$ebnf$2$subexpression$1"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  {
    name: "program",
    symbols: ["program$ebnf$1", "program$ebnf$2"],
    postprocess: ([imports, stmts]: [
      [StmtNS.FromImport, moo.Token][],
      ([StmtNS.Stmt] | [moo.Token])[],
    ]) => {
      const importNodes = imports.map(d => d[0]);
      const stmtNodes = stmts.map(d => d[0]).filter(s => "startToken" in s);
      const filtered = [...importNodes, ...stmtNodes];
      const start = filtered[0]
        ? filtered[0].startToken
        : toAstToken({ type: "newline", value: "", line: 1, col: 1, offset: 0 });
      const end = filtered.length > 0 ? filtered[filtered.length - 1].endToken : start;
      return new StmtNS.FileInput(start, end, filtered, []);
    },
  },
  {
    name: "import_stmt",
    symbols: [{ literal: "from" }, "dotted_name", { literal: "import" }, "import_clause"],
    postprocess: ([kw, mod, , names]: [
      moo.Token,
      Token,
      moo.Token,
      StmtNS.FromImport["names"],
    ]) => {
      const last = names[names.length - 1];
      const endTok = last.alias || last.name;
      return new StmtNS.FromImport(toAstToken(kw), endTok, mod, names);
    },
  },
  { name: "dotted_name$ebnf$1", symbols: [] },
  { name: "dotted_name$ebnf$1$subexpression$1", symbols: [{ literal: "." }, { type: "name" }] },
  {
    name: "dotted_name$ebnf$1",
    symbols: ["dotted_name$ebnf$1", "dotted_name$ebnf$1$subexpression$1"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  {
    name: "dotted_name",
    symbols: [{ type: "name" }, "dotted_name$ebnf$1"],
    postprocess: ([first, rest]: [moo.Token, [moo.Token, moo.Token][]]) => {
      const tok = toAstToken(first);
      for (const [, n] of rest) {
        const right = toAstToken(n);
        tok.lexeme = tok.lexeme + "." + right.lexeme;
      }
      return tok;
    },
  },
  { name: "import_clause", symbols: ["import_as_names"], postprocess: id },
  {
    name: "import_clause",
    symbols: [{ literal: "(" }, "import_as_names", { literal: ")" }],
    postprocess: ([, ns]: [moo.Token, StmtNS.FromImport["names"][number], moo.Token]) => ns,
  },
  { name: "import_as_names$ebnf$1", symbols: [] },
  { name: "import_as_names$ebnf$1$subexpression$1", symbols: [{ literal: "," }, "import_as_name"] },
  {
    name: "import_as_names$ebnf$1",
    symbols: ["import_as_names$ebnf$1", "import_as_names$ebnf$1$subexpression$1"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  {
    name: "import_as_names",
    symbols: ["import_as_name", "import_as_names$ebnf$1"],
    postprocess: flatList,
  },
  {
    name: "import_as_name",
    symbols: [{ type: "name" }],
    postprocess: ([t]: [moo.Token]) => ({ name: toAstToken(t), alias: null }),
  },
  {
    name: "import_as_name",
    symbols: [{ type: "name" }, { literal: "as" }, { type: "name" }],
    postprocess: ([t, , a]: [moo.Token, moo.Token, moo.Token]) => ({
      name: toAstToken(t),
      alias: toAstToken(a),
    }),
  },
  { name: "statement", symbols: ["statementAssign", { type: "newline" }], postprocess: id },
  { name: "statement", symbols: ["statementAnnAssign", { type: "newline" }], postprocess: id },
  {
    name: "statement",
    symbols: ["statementSubscriptAssign", { type: "newline" }],
    postprocess: id,
  },
  { name: "statement", symbols: ["statementReturn", { type: "newline" }], postprocess: id },
  { name: "statement", symbols: ["statementPass", { type: "newline" }], postprocess: id },
  { name: "statement", symbols: ["statementBreak", { type: "newline" }], postprocess: id },
  { name: "statement", symbols: ["statementContinue", { type: "newline" }], postprocess: id },
  { name: "statement", symbols: ["statementGlobal", { type: "newline" }], postprocess: id },
  { name: "statement", symbols: ["statementNonlocal", { type: "newline" }], postprocess: id },
  { name: "statement", symbols: ["statementAssert", { type: "newline" }], postprocess: id },
  { name: "statement", symbols: ["statementExpr", { type: "newline" }], postprocess: id },
  { name: "statement", symbols: ["if_statement"], postprocess: id },
  { name: "statement", symbols: ["statementWhile"], postprocess: id },
  { name: "statement", symbols: ["statementFor"], postprocess: id },
  { name: "statement", symbols: ["statementDef"], postprocess: id },
  {
    name: "statementAssign",
    symbols: [{ type: "name" }, { literal: "=" }, "expression"],
    postprocess: ([n, , v]: [moo.Token, moo.Token, ExprNS.Expr]) => {
      const tok = toAstToken(n);
      return new StmtNS.Assign(tok, v.endToken, new ExprNS.Variable(tok, tok, tok), v);
    },
  },
  {
    name: "statementAnnAssign",
    symbols: [{ type: "name" }, { literal: ":" }, "expression", { literal: "=" }, "expression"],
    postprocess: ([n, , ann, , v]: [moo.Token, moo.Token, ExprNS.Expr, moo.Token, ExprNS.Expr]) => {
      const tok = toAstToken(n);
      return new StmtNS.AnnAssign(tok, v.endToken, new ExprNS.Variable(tok, tok, tok), v, ann);
    },
  },
  {
    name: "statementAnnAssign",
    symbols: [{ type: "name" }, { literal: ":" }, "expression"],
    postprocess: ([n, , ann]: [moo.Token, moo.Token, ExprNS.Expr]) => {
      const nameTok = toAstToken(n);
      const dummyVal = new ExprNS.None(ann.endToken, ann.endToken);
      return new StmtNS.AnnAssign(
        nameTok,
        ann.endToken,
        new ExprNS.Variable(nameTok, nameTok, nameTok),
        dummyVal,
        ann,
      );
    },
  },
  {
    name: "statementSubscriptAssign",
    symbols: [
      "expressionPost",
      { type: "lsqb" },
      "expression",
      { type: "rsqb" },
      { literal: "=" },
      "expression",
    ],
    postprocess: function (
      d: [ExprNS.Expr, moo.Token, ExprNS.Expr, moo.Token, moo.Token, ExprNS.Expr],
    ) {
      const obj = d[0],
        idx = d[2],
        rsqb = d[3],
        val = d[5];
      const sub = new ExprNS.Subscript(obj.startToken, toAstToken(rsqb), obj, idx);
      return new StmtNS.Assign(obj.startToken, val.endToken, sub, val);
    },
  },
  {
    name: "statementReturn",
    symbols: [{ literal: "return" }, "expression"],
    postprocess: ([kw, expr]: [moo.Token, ExprNS.Expr]) =>
      new StmtNS.Return(toAstToken(kw), expr.endToken, expr),
  },
  {
    name: "statementReturn",
    symbols: [{ literal: "return" }],
    postprocess: ([t]: [moo.Token]) => {
      const tok = toAstToken(t);
      return new StmtNS.Return(tok, tok, null);
    },
  },
  {
    name: "statementPass",
    symbols: [{ literal: "pass" }],
    postprocess: ([t]: [moo.Token]) => {
      const tok = toAstToken(t);
      return new StmtNS.Pass(tok, tok);
    },
  },
  {
    name: "statementBreak",
    symbols: [{ literal: "break" }],
    postprocess: ([t]: [moo.Token]) => {
      const tok = toAstToken(t);
      return new StmtNS.Break(tok, tok);
    },
  },
  {
    name: "statementContinue",
    symbols: [{ literal: "continue" }],
    postprocess: ([t]: [moo.Token]) => {
      const tok = toAstToken(t);
      return new StmtNS.Continue(tok, tok);
    },
  },
  {
    name: "statementGlobal",
    symbols: [{ literal: "global" }, { type: "name" }],
    postprocess: ([kw, n]: [moo.Token, moo.Token]) =>
      new StmtNS.Global(toAstToken(kw), toAstToken(n), toAstToken(n)),
  },
  {
    name: "statementNonlocal",
    symbols: [{ literal: "nonlocal" }, { type: "name" }],
    postprocess: ([kw, n]: [moo.Token, moo.Token]) =>
      new StmtNS.NonLocal(toAstToken(kw), toAstToken(n), toAstToken(n)),
  },
  {
    name: "statementAssert",
    symbols: [{ literal: "assert" }, "expression"],
    postprocess: ([kw, e]: [moo.Token, ExprNS.Expr]) =>
      new StmtNS.Assert(toAstToken(kw), e.endToken, e),
  },
  {
    name: "statementExpr",
    symbols: ["expression"],
    postprocess: ([e]: [ExprNS.Expr]) => new StmtNS.SimpleExpr(e.startToken, e.endToken, e),
  },
  {
    name: "statementWhile",
    symbols: [{ literal: "while" }, "expression", { literal: ":" }, "block"],
    postprocess: ([kw, test, , body]: [moo.Token, ExprNS.Expr, moo.Token, StmtNS.Stmt[]]) =>
      new StmtNS.While(toAstToken(kw), body[body.length - 1].endToken, test, body),
  },
  {
    name: "statementFor",
    symbols: [
      { literal: "for" },
      { type: "name" },
      { literal: "in" },
      "expression",
      { literal: ":" },
      "block",
    ],
    postprocess: ([kw, target, , iter, , body]: [
      moo.Token,
      moo.Token,
      moo.Token,
      ExprNS.Expr,
      moo.Token,
      StmtNS.Stmt[],
    ]) =>
      new StmtNS.For(
        toAstToken(kw),
        body[body.length - 1].endToken,
        toAstToken(target),
        iter,
        body,
      ),
  },
  {
    name: "statementDef",
    symbols: [{ literal: "def" }, { type: "name" }, "params", { literal: ":" }, "block"],
    postprocess: ([kw, name, params, , body]: [
      moo.Token,
      moo.Token,
      FunctionParam[],
      moo.Token,
      StmtNS.Stmt[],
    ]) =>
      new StmtNS.FunctionDef(
        toAstToken(kw),
        body[body.length - 1].endToken,
        toAstToken(name),
        params,
        body,
        [],
      ),
  },
  { name: "if_statement$ebnf$1", symbols: [] },
  {
    name: "if_statement$ebnf$1$subexpression$1",
    symbols: [{ literal: "elif" }, "expression", { literal: ":" }, "block"],
  },
  {
    name: "if_statement$ebnf$1",
    symbols: ["if_statement$ebnf$1", "if_statement$ebnf$1$subexpression$1"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  {
    name: "if_statement$ebnf$2$subexpression$1",
    symbols: [{ literal: "else" }, { literal: ":" }, "block"],
  },
  {
    name: "if_statement$ebnf$2",
    symbols: ["if_statement$ebnf$2$subexpression$1"],
    postprocess: id,
  },
  { name: "if_statement$ebnf$2", symbols: [], postprocess: () => null },
  {
    name: "if_statement",
    symbols: [
      { literal: "if" },
      "expression",
      { literal: ":" },
      "block",
      "if_statement$ebnf$1",
      "if_statement$ebnf$2",
    ],
    postprocess: ([kw, test, , body, elifs, elseBlock]: [
      moo.Token,
      ExprNS.Expr,
      moo.Token,
      StmtNS.Stmt[],
      [moo.Token, ExprNS.Expr, moo.Token, StmtNS.Stmt[]][],
      [moo.Token, moo.Token, StmtNS.Stmt[]],
    ]) => {
      let else_ = elseBlock ? elseBlock[2] : null;
      for (let i = elifs.length - 1; i >= 0; i--) {
        const [ekw, etest, , ebody] = elifs[i];
        const endTok =
          else_ && else_.length > 0
            ? else_[else_.length - 1].endToken
            : ebody[ebody.length - 1].endToken;
        else_ = [new StmtNS.If(toAstToken(ekw), endTok, etest, ebody, else_)];
      }
      const endTok =
        else_ && else_.length > 0
          ? else_[else_.length - 1].endToken
          : body[body.length - 1].endToken;
      return new StmtNS.If(toAstToken(kw), endTok, test, body, else_);
    },
  },
  { name: "names$ebnf$1", symbols: [] },
  { name: "names$ebnf$1$subexpression$1", symbols: [{ literal: "," }, { type: "name" }] },
  {
    name: "names$ebnf$1",
    symbols: ["names$ebnf$1", "names$ebnf$1$subexpression$1"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  { name: "names", symbols: [{ type: "name" }, "names$ebnf$1"], postprocess: tokList },
  { name: "block", symbols: ["blockInline", { type: "newline" }], postprocess: list },
  { name: "block$ebnf$1$subexpression$1", symbols: ["statement"] },
  { name: "block$ebnf$1$subexpression$1", symbols: [{ type: "newline" }] },
  { name: "block$ebnf$1", symbols: ["block$ebnf$1$subexpression$1"] },
  { name: "block$ebnf$1$subexpression$2", symbols: ["statement"] },
  { name: "block$ebnf$1$subexpression$2", symbols: [{ type: "newline" }] },
  {
    name: "block$ebnf$1",
    symbols: ["block$ebnf$1", "block$ebnf$1$subexpression$2"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  {
    name: "block",
    symbols: [{ type: "newline" }, { type: "indent" }, "block$ebnf$1", { type: "dedent" }],
    postprocess: ([, , stmts]: [moo.Token, moo.Token, ([StmtNS.Stmt] | [moo.Token])[]]) =>
      stmts.map(d => d[0]).filter(s => s && "startToken" in s),
  },
  { name: "blockInline", symbols: ["statementAssign"], postprocess: id },
  { name: "blockInline", symbols: ["statementAnnAssign"], postprocess: id },
  { name: "blockInline", symbols: ["statementSubscriptAssign"], postprocess: id },
  { name: "blockInline", symbols: ["statementReturn"], postprocess: id },
  { name: "blockInline", symbols: ["statementPass"], postprocess: id },
  { name: "blockInline", symbols: ["statementBreak"], postprocess: id },
  { name: "blockInline", symbols: ["statementContinue"], postprocess: id },
  { name: "blockInline", symbols: ["statementGlobal"], postprocess: id },
  { name: "blockInline", symbols: ["statementNonlocal"], postprocess: id },
  { name: "blockInline", symbols: ["statementAssert"], postprocess: id },
  { name: "blockInline", symbols: ["statementExpr"], postprocess: id },
  {
    name: "rest_names",
    symbols: [{ type: "name" }],
    postprocess: ([t]: [moo.Token]) => {
      const tok = toFunctionParam(t, false);
      return [tok];
    },
  },
  {
    name: "rest_names",
    symbols: [{ literal: "*" }, { type: "name" }],
    postprocess: ([, t]: [moo.Token, moo.Token]) => {
      const tok = toFunctionParam(t, true);
      return [tok];
    },
  },
  {
    name: "rest_names",
    symbols: ["rest_names", { literal: "," }, { type: "name" }],
    postprocess: ([params, , t]: [FunctionParam[], moo.Token, moo.Token]) => {
      const tok = toFunctionParam(t, false);
      return [...params, tok];
    },
  },
  {
    name: "rest_names",
    symbols: ["rest_names", { literal: "," }, { literal: "*" }, { type: "name" }],
    postprocess: ([params, , , t]: [FunctionParam[], moo.Token, moo.Token, moo.Token]) => {
      const tok = toFunctionParam(t, true);
      return [...params, tok];
    },
  },
  { name: "params", symbols: [{ literal: "(" }, { literal: ")" }], postprocess: drop },
  {
    name: "params",
    symbols: [{ literal: "(" }, "rest_names", { literal: ")" }],
    postprocess: ([, ps]: [moo.Token, FunctionParam[], moo.Token]) => ps,
  },
  {
    name: "expression",
    symbols: ["expressionOr", { literal: "if" }, "expressionOr", { literal: "else" }, "expression"],
    postprocess: ([cons, , test, , alt]: [
      ExprNS.Expr,
      moo.Token,
      ExprNS.Expr,
      moo.Token,
      ExprNS.Expr,
    ]) => new ExprNS.Ternary(cons.startToken, alt.endToken, test, cons, alt),
  },
  { name: "expression", symbols: ["expressionOr"], postprocess: id },
  { name: "expression", symbols: ["lambda_expr"], postprocess: id },
  {
    name: "expressionOr",
    symbols: ["expressionOr", { literal: "or" }, "expressionAnd"],
    postprocess: astBoolOp,
  },
  { name: "expressionOr", symbols: ["expressionAnd"], postprocess: id },
  {
    name: "expressionAnd",
    symbols: ["expressionAnd", { literal: "and" }, "expressionNot"],
    postprocess: astBoolOp,
  },
  { name: "expressionAnd", symbols: ["expressionNot"], postprocess: id },
  { name: "expressionNot", symbols: [{ literal: "not" }, "expressionNot"], postprocess: astUnary },
  { name: "expressionNot", symbols: ["expressionCmp"], postprocess: id },
  {
    name: "expressionCmp",
    symbols: ["expressionCmp", "expressionCmpOp", "expressionAdd"],
    postprocess: astCompare,
  },
  { name: "expressionCmp", symbols: ["expressionAdd"], postprocess: id },
  { name: "expressionCmpOp", symbols: [{ type: "less" }], postprocess: tok },
  { name: "expressionCmpOp", symbols: [{ type: "greater" }], postprocess: tok },
  { name: "expressionCmpOp", symbols: [{ type: "doubleequal" }], postprocess: tok },
  { name: "expressionCmpOp", symbols: [{ type: "greaterequal" }], postprocess: tok },
  { name: "expressionCmpOp", symbols: [{ type: "lessequal" }], postprocess: tok },
  { name: "expressionCmpOp", symbols: [{ type: "notequal" }], postprocess: tok },
  { name: "expressionCmpOp", symbols: [{ literal: "in" }], postprocess: tok },
  {
    name: "expressionCmpOp",
    symbols: [{ literal: "not" }, { literal: "in" }],
    postprocess: ([t]: [moo.Token]) => {
      const tok = toAstToken(t);
      tok.lexeme = "not in";
      return tok;
    },
  },
  { name: "expressionCmpOp", symbols: [{ literal: "is" }], postprocess: tok },
  {
    name: "expressionCmpOp",
    symbols: [{ literal: "is" }, { literal: "not" }],
    postprocess: ([t]: [moo.Token]) => {
      const tok = toAstToken(t);
      tok.lexeme = "is not";
      return tok;
    },
  },
  {
    name: "expressionAdd",
    symbols: ["expressionAdd", "expressionAddOp", "expressionMul"],
    postprocess: astBinary,
  },
  { name: "expressionAdd", symbols: ["expressionMul"], postprocess: id },
  { name: "expressionAddOp", symbols: [{ type: "plus" }], postprocess: tok },
  { name: "expressionAddOp", symbols: [{ type: "minus" }], postprocess: tok },
  {
    name: "expressionMul",
    symbols: ["expressionMul", "expressionMulOp", "expressionUnary"],
    postprocess: astBinary,
  },
  { name: "expressionMul", symbols: ["expressionUnary"], postprocess: id },
  { name: "expressionMulOp", symbols: [{ type: "star" }], postprocess: tok },
  { name: "expressionMulOp", symbols: [{ type: "slash" }], postprocess: tok },
  { name: "expressionMulOp", symbols: [{ type: "percent" }], postprocess: tok },
  { name: "expressionMulOp", symbols: [{ type: "doubleslash" }], postprocess: tok },
  {
    name: "expressionUnary",
    symbols: [{ type: "plus" }, "expressionUnary"],
    postprocess: astUnary,
  },
  {
    name: "expressionUnary",
    symbols: [{ type: "minus" }, "expressionUnary"],
    postprocess: astUnary,
  },
  { name: "expressionUnary", symbols: ["expressionPow"], postprocess: id },
  {
    name: "expressionPow",
    symbols: ["expressionPost", { type: "doublestar" }, "expressionUnary"],
    postprocess: astBinaryTok,
  },
  { name: "expressionPow", symbols: ["expressionPost"], postprocess: id },
  {
    name: "expressionPost",
    symbols: ["expressionPost", { type: "lsqb" }, "expression", { type: "rsqb" }],
    postprocess: ([obj, , idx, rsqb]: [ExprNS.Expr, moo.Token, ExprNS.Expr, moo.Token]) =>
      new ExprNS.Subscript(obj.startToken, toAstToken(rsqb), obj, idx),
  },
  {
    name: "expressionPost",
    symbols: ["expressionPost", { literal: "(" }, "expressions", { literal: ")" }],
    postprocess: ([callee, , args, rparen]: [ExprNS.Expr, moo.Token, ExprNS.Expr[], moo.Token]) =>
      new ExprNS.Call(callee.startToken, toAstToken(rparen), callee, args),
  },
  {
    name: "expressionPost",
    symbols: ["expressionPost", { literal: "(" }, { literal: ")" }],
    postprocess: ([callee, , rparen]: [ExprNS.Expr, moo.Token, moo.Token]) =>
      new ExprNS.Call(callee.startToken, toAstToken(rparen), callee, []),
  },
  { name: "expressionPost", symbols: ["atom"], postprocess: id },
  {
    name: "atom",
    symbols: [{ literal: "(" }, "expression", { literal: ")" }],
    postprocess: ([, e]: [moo.Token, ExprNS.Expr, moo.Token]) =>
      new ExprNS.Grouping(e.startToken, e.endToken, e),
  },
  {
    name: "atom",
    symbols: [{ type: "lsqb" }, { type: "rsqb" }],
    postprocess: ([l, r]: [moo.Token, moo.Token]) =>
      new ExprNS.List(toAstToken(l), toAstToken(r), []),
  },
  {
    name: "atom",
    symbols: [{ type: "lsqb" }, "expressions", { type: "rsqb" }],
    postprocess: ([l, elems, r]: [moo.Token, ExprNS.Expr[], moo.Token]) =>
      new ExprNS.List(toAstToken(l), toAstToken(r), elems),
  },
  { name: "atom", symbols: [{ type: "name" }], postprocess: astVariable },
  {
    name: "atom",
    symbols: [{ type: "number_float" }],
    postprocess: ([t]: [moo.Token]) => {
      const tok = toAstToken(t);
      return new ExprNS.Literal(tok, tok, parseFloat(t.value));
    },
  },
  { name: "atom", symbols: [{ type: "number_int" }], postprocess: astBigInt },
  { name: "atom", symbols: [{ type: "number_hex" }], postprocess: astBigInt },
  { name: "atom", symbols: [{ type: "number_oct" }], postprocess: astBigInt },
  { name: "atom", symbols: [{ type: "number_bin" }], postprocess: astBigInt },
  { name: "atom", symbols: [{ type: "number_complex" }], postprocess: astComplex },
  { name: "atom", symbols: ["stringLit"], postprocess: id },
  { name: "atom", symbols: [{ literal: "None" }], postprocess: astNone },
  { name: "atom", symbols: [{ literal: "True" }], postprocess: astTrue },
  { name: "atom", symbols: [{ literal: "False" }], postprocess: astFalse },
  {
    name: "lambda_expr",
    symbols: [{ literal: "lambda" }, "names", { literal: ":" }, "expression"],
    postprocess: ([kw, params, , body]: [moo.Token, FunctionParam[], moo.Token, ExprNS.Expr]) =>
      new ExprNS.Lambda(toAstToken(kw), body.endToken, params, body),
  },
  {
    name: "lambda_expr",
    symbols: [{ literal: "lambda" }, "names", { type: "doublecolon" }, "block"],
    postprocess: ([kw, params, , body]: [moo.Token, FunctionParam[], moo.Token, StmtNS.Stmt[]]) =>
      new ExprNS.MultiLambda(toAstToken(kw), body[body.length - 1].endToken, params, body, []),
  },
  {
    name: "lambda_expr",
    symbols: [{ literal: "lambda" }, { literal: ":" }, "expression"],
    postprocess: ([kw, , body]: [moo.Token, moo.Token, ExprNS.Expr]) =>
      new ExprNS.Lambda(toAstToken(kw), body.endToken, [], body),
  },
  {
    name: "lambda_expr",
    symbols: [{ literal: "lambda" }, { type: "doublecolon" }, "block"],
    postprocess: ([kw, , body]: [moo.Token, moo.Token, StmtNS.Stmt[]]) =>
      new ExprNS.MultiLambda(toAstToken(kw), body[body.length - 1].endToken, [], body, []),
  },
  { name: "expressions$ebnf$1", symbols: [] },
  { name: "expressions$ebnf$1$subexpression$1", symbols: [{ literal: "," }, "expression"] },
  {
    name: "expressions$ebnf$1",
    symbols: ["expressions$ebnf$1", "expressions$ebnf$1$subexpression$1"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  { name: "expressions$ebnf$2$subexpression$1", symbols: [{ type: "comma" }] },
  { name: "expressions$ebnf$2", symbols: ["expressions$ebnf$2$subexpression$1"], postprocess: id },
  { name: "expressions$ebnf$2", symbols: [], postprocess: () => null },
  {
    name: "expressions",
    symbols: ["expression", "expressions$ebnf$1", "expressions$ebnf$2"],
    postprocess: flatList,
  },
  { name: "stringLit", symbols: [{ type: "string_triple_double" }], postprocess: astString },
  { name: "stringLit", symbols: [{ type: "string_triple_single" }], postprocess: astString },
  { name: "stringLit", symbols: [{ type: "string_double" }], postprocess: astString },
  { name: "stringLit", symbols: [{ type: "string_single" }], postprocess: astString },
];
const ParserStart = "program";
export default { Lexer, ParserRules, ParserStart };
