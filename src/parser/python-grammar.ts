// @ts-nocheck
// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
function id(x) {
  return x[0];
}

import { ExprNS, StmtNS } from "../ast-types";
import pythonLexer from "./lexer";
import { toAstToken } from "./token-bridge";

const nil = () => null;
const list = ([x]) => [x];
const drop = () => [];

/** Strip surrounding quotes and process escape sequences. */
function stripQuotes(s) {
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
const astVariable = ([t]) => {
  const k = toAstToken(t);
  return new ExprNS.Variable(k, k, k);
};
const astBigInt = ([t]) => {
  const k = toAstToken(t);
  return new ExprNS.BigIntLiteral(k, k, t.value);
};
const astComplex = ([t]) => {
  const k = toAstToken(t);
  return new ExprNS.Complex(k, k, t.value);
};
const astNone = ([t]) => {
  const k = toAstToken(t);
  return new ExprNS.None(k, k);
};
const astString = ([t]) => {
  const k = toAstToken(t);
  return new ExprNS.Literal(k, k, stripQuotes(t.value));
};
const astTrue = ([t]) => {
  const k = toAstToken(t);
  return new ExprNS.Literal(k, k, true);
};
const astFalse = ([t]) => {
  const k = toAstToken(t);
  return new ExprNS.Literal(k, k, false);
};

// ── Operator AST constructors (children → node) ────────────────────────
const astBinary = ([l, op, r]) => new ExprNS.Binary(l.startToken, r.endToken, l, op, r);
const astBinaryTok = ([l, op, r]) =>
  new ExprNS.Binary(l.startToken, r.endToken, l, toAstToken(op), r);
const astBoolOp = ([l, op, r]) => new ExprNS.BoolOp(l.startToken, r.endToken, l, toAstToken(op), r);
const astUnary = ([op, arg]) => new ExprNS.Unary(toAstToken(op), arg.endToken, toAstToken(op), arg);
const astCompare = ([l, op, r]) => new ExprNS.Compare(l.startToken, r.endToken, l, op, r);

// ── Token / list helpers ────────────────────────────────────────────────
const tok = ([t]) => toAstToken(t);
const flatList = ([first, rest]) => [first, ...rest.map(d => d[1])];
const tokList = ([first, rest]) => [toAstToken(first), ...rest.map(d => toAstToken(d[1]))];
let Lexer = pythonLexer;
let ParserRules = [
  { name: "program$ebnf$1", symbols: [] },
  {
    name: "program$ebnf$1$subexpression$1",
    symbols: ["import_stmt", pythonLexer.has("newline") ? { type: "newline" } : newline],
  },
  {
    name: "program$ebnf$1",
    symbols: ["program$ebnf$1", "program$ebnf$1$subexpression$1"],
    postprocess: function arrpush(d) {
      return d[0].concat([d[1]]);
    },
  },
  { name: "program$ebnf$2", symbols: [] },
  { name: "program$ebnf$2$subexpression$1", symbols: ["statement"] },
  {
    name: "program$ebnf$2$subexpression$1",
    symbols: [pythonLexer.has("newline") ? { type: "newline" } : newline],
  },
  {
    name: "program$ebnf$2",
    symbols: ["program$ebnf$2", "program$ebnf$2$subexpression$1"],
    postprocess: function arrpush(d) {
      return d[0].concat([d[1]]);
    },
  },
  {
    name: "program",
    symbols: ["program$ebnf$1", "program$ebnf$2"],
    postprocess: ([imports, stmts]) => {
      const importNodes = imports.map(d => d[0]);
      const stmtNodes = stmts.map(d => d[0]).filter(s => s && s.startToken !== undefined);
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
    postprocess: ([kw, mod, , names]) => {
      const last = names[names.length - 1];
      const endTok = last.alias || last.name;
      return new StmtNS.FromImport(toAstToken(kw), endTok, mod, names);
    },
  },
  { name: "dotted_name$ebnf$1", symbols: [] },
  {
    name: "dotted_name$ebnf$1$subexpression$1",
    symbols: [{ literal: "." }, pythonLexer.has("name") ? { type: "name" } : name],
  },
  {
    name: "dotted_name$ebnf$1",
    symbols: ["dotted_name$ebnf$1", "dotted_name$ebnf$1$subexpression$1"],
    postprocess: function arrpush(d) {
      return d[0].concat([d[1]]);
    },
  },
  {
    name: "dotted_name",
    symbols: [pythonLexer.has("name") ? { type: "name" } : name, "dotted_name$ebnf$1"],
    postprocess: ([first, rest]) => {
      let tok = toAstToken(first);
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
    postprocess: ([, ns]) => ns,
  },
  { name: "import_as_names$ebnf$1", symbols: [] },
  { name: "import_as_names$ebnf$1$subexpression$1", symbols: [{ literal: "," }, "import_as_name"] },
  {
    name: "import_as_names$ebnf$1",
    symbols: ["import_as_names$ebnf$1", "import_as_names$ebnf$1$subexpression$1"],
    postprocess: function arrpush(d) {
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
    symbols: [pythonLexer.has("name") ? { type: "name" } : name],
    postprocess: ([t]) => ({ name: toAstToken(t), alias: null }),
  },
  {
    name: "import_as_name",
    symbols: [
      pythonLexer.has("name") ? { type: "name" } : name,
      { literal: "as" },
      pythonLexer.has("name") ? { type: "name" } : name,
    ],
    postprocess: ([t, , a]) => ({ name: toAstToken(t), alias: toAstToken(a) }),
  },
  {
    name: "statement",
    symbols: ["statementAssign", pythonLexer.has("newline") ? { type: "newline" } : newline],
    postprocess: id,
  },
  {
    name: "statement",
    symbols: ["statementAnnAssign", pythonLexer.has("newline") ? { type: "newline" } : newline],
    postprocess: id,
  },
  {
    name: "statement",
    symbols: [
      "statementSubscriptAssign",
      pythonLexer.has("newline") ? { type: "newline" } : newline,
    ],
    postprocess: id,
  },
  {
    name: "statement",
    symbols: ["statementReturn", pythonLexer.has("newline") ? { type: "newline" } : newline],
    postprocess: id,
  },
  {
    name: "statement",
    symbols: ["statementPass", pythonLexer.has("newline") ? { type: "newline" } : newline],
    postprocess: id,
  },
  {
    name: "statement",
    symbols: ["statementBreak", pythonLexer.has("newline") ? { type: "newline" } : newline],
    postprocess: id,
  },
  {
    name: "statement",
    symbols: ["statementContinue", pythonLexer.has("newline") ? { type: "newline" } : newline],
    postprocess: id,
  },
  {
    name: "statement",
    symbols: ["statementGlobal", pythonLexer.has("newline") ? { type: "newline" } : newline],
    postprocess: id,
  },
  {
    name: "statement",
    symbols: ["statementNonlocal", pythonLexer.has("newline") ? { type: "newline" } : newline],
    postprocess: id,
  },
  {
    name: "statement",
    symbols: ["statementAssert", pythonLexer.has("newline") ? { type: "newline" } : newline],
    postprocess: id,
  },
  {
    name: "statement",
    symbols: ["statementExpr", pythonLexer.has("newline") ? { type: "newline" } : newline],
    postprocess: id,
  },
  { name: "statement", symbols: ["if_statement"], postprocess: id },
  { name: "statement", symbols: ["statementWhile"], postprocess: id },
  { name: "statement", symbols: ["statementFor"], postprocess: id },
  { name: "statement", symbols: ["statementDef"], postprocess: id },
  {
    name: "statementAssign",
    symbols: [pythonLexer.has("name") ? { type: "name" } : name, { literal: "=" }, "expression"],
    postprocess: ([n, , v]) => {
      const tok = toAstToken(n);
      return new StmtNS.Assign(tok, v.endToken, new ExprNS.Variable(tok, tok, tok), v);
    },
  },
  {
    name: "statementAnnAssign",
    symbols: [
      pythonLexer.has("name") ? { type: "name" } : name,
      { literal: ":" },
      "expression",
      { literal: "=" },
      "expression",
    ],
    postprocess: ([n, , ann, , v]) => {
      const tok = toAstToken(n);
      return new StmtNS.AnnAssign(tok, v.endToken, new ExprNS.Variable(tok, tok, tok), v, ann);
    },
  },
  {
    name: "statementAnnAssign",
    symbols: [pythonLexer.has("name") ? { type: "name" } : name, { literal: ":" }, "expression"],
    postprocess: ([n, , ann]) => {
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
      pythonLexer.has("lsqb") ? { type: "lsqb" } : lsqb,
      "expression",
      pythonLexer.has("rsqb") ? { type: "rsqb" } : rsqb,
      { literal: "=" },
      "expression",
    ],
    postprocess: function (d) {
      var obj = d[0],
        idx = d[2],
        rsqb = d[3],
        val = d[5];
      var sub = new ExprNS.Subscript(obj.startToken, toAstToken(rsqb), obj, idx);
      return new StmtNS.Assign(obj.startToken, val.endToken, sub, val);
    },
  },
  {
    name: "statementReturn",
    symbols: [{ literal: "return" }, "expression"],
    postprocess: ([kw, expr]) => new StmtNS.Return(toAstToken(kw), expr.endToken, expr),
  },
  {
    name: "statementReturn",
    symbols: [{ literal: "return" }],
    postprocess: ([t]) => {
      const tok = toAstToken(t);
      return new StmtNS.Return(tok, tok, null);
    },
  },
  {
    name: "statementPass",
    symbols: [{ literal: "pass" }],
    postprocess: ([t]) => {
      const tok = toAstToken(t);
      return new StmtNS.Pass(tok, tok);
    },
  },
  {
    name: "statementBreak",
    symbols: [{ literal: "break" }],
    postprocess: ([t]) => {
      const tok = toAstToken(t);
      return new StmtNS.Break(tok, tok);
    },
  },
  {
    name: "statementContinue",
    symbols: [{ literal: "continue" }],
    postprocess: ([t]) => {
      const tok = toAstToken(t);
      return new StmtNS.Continue(tok, tok);
    },
  },
  {
    name: "statementGlobal",
    symbols: [{ literal: "global" }, pythonLexer.has("name") ? { type: "name" } : name],
    postprocess: ([kw, n]) => new StmtNS.Global(toAstToken(kw), toAstToken(n), toAstToken(n)),
  },
  {
    name: "statementNonlocal",
    symbols: [{ literal: "nonlocal" }, pythonLexer.has("name") ? { type: "name" } : name],
    postprocess: ([kw, n]) => new StmtNS.NonLocal(toAstToken(kw), toAstToken(n), toAstToken(n)),
  },
  {
    name: "statementAssert",
    symbols: [{ literal: "assert" }, "expression"],
    postprocess: ([kw, e]) => new StmtNS.Assert(toAstToken(kw), e.endToken, e),
  },
  {
    name: "statementExpr",
    symbols: ["expression"],
    postprocess: ([e]) => new StmtNS.SimpleExpr(e.startToken, e.endToken, e),
  },
  {
    name: "statementWhile",
    symbols: [{ literal: "while" }, "expression", { literal: ":" }, "block"],
    postprocess: ([kw, test, , body]) =>
      new StmtNS.While(toAstToken(kw), body[body.length - 1].endToken, test, body),
  },
  {
    name: "statementFor",
    symbols: [
      { literal: "for" },
      pythonLexer.has("name") ? { type: "name" } : name,
      { literal: "in" },
      "expression",
      { literal: ":" },
      "block",
    ],
    postprocess: ([kw, target, , iter, , body]) =>
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
    symbols: [
      { literal: "def" },
      pythonLexer.has("name") ? { type: "name" } : name,
      "params",
      { literal: ":" },
      "block",
    ],
    postprocess: ([kw, name, params, , body]) =>
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
    postprocess: function arrpush(d) {
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
  {
    name: "if_statement$ebnf$2",
    symbols: [],
    postprocess: function (d) {
      return null;
    },
  },
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
    postprocess: ([kw, test, , body, elifs, elseBlock]) => {
      let else_ = elseBlock ? elseBlock[0][2] : null;
      for (let i = elifs.length - 1; i >= 0; i--) {
        const [ekw, etest, ecolon, ebody] = elifs[i];
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
  {
    name: "names$ebnf$1$subexpression$1",
    symbols: [{ literal: "," }, pythonLexer.has("name") ? { type: "name" } : name],
  },
  {
    name: "names$ebnf$1",
    symbols: ["names$ebnf$1", "names$ebnf$1$subexpression$1"],
    postprocess: function arrpush(d) {
      return d[0].concat([d[1]]);
    },
  },
  {
    name: "names",
    symbols: [pythonLexer.has("name") ? { type: "name" } : name, "names$ebnf$1"],
    postprocess: tokList,
  },
  {
    name: "block",
    symbols: ["blockInline", pythonLexer.has("newline") ? { type: "newline" } : newline],
    postprocess: list,
  },
  { name: "block$ebnf$1$subexpression$1", symbols: ["statement"] },
  {
    name: "block$ebnf$1$subexpression$1",
    symbols: [pythonLexer.has("newline") ? { type: "newline" } : newline],
  },
  { name: "block$ebnf$1", symbols: ["block$ebnf$1$subexpression$1"] },
  { name: "block$ebnf$1$subexpression$2", symbols: ["statement"] },
  {
    name: "block$ebnf$1$subexpression$2",
    symbols: [pythonLexer.has("newline") ? { type: "newline" } : newline],
  },
  {
    name: "block$ebnf$1",
    symbols: ["block$ebnf$1", "block$ebnf$1$subexpression$2"],
    postprocess: function arrpush(d) {
      return d[0].concat([d[1]]);
    },
  },
  {
    name: "block",
    symbols: [
      pythonLexer.has("newline") ? { type: "newline" } : newline,
      pythonLexer.has("indent") ? { type: "indent" } : indent,
      "block$ebnf$1",
      pythonLexer.has("dedent") ? { type: "dedent" } : dedent,
    ],
    postprocess: ([, , stmts]) => stmts.map(d => d[0]).filter(s => s && s.startToken !== undefined),
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
    symbols: [pythonLexer.has("name") ? { type: "name" } : name],
    postprocess: ([t]) => {
      const tok = toAstToken(t);
      tok.isStarred = false;
      return [tok];
    },
  },
  {
    name: "rest_names",
    symbols: [{ literal: "*" }, pythonLexer.has("name") ? { type: "name" } : name],
    postprocess: ([, t]) => {
      const tok = toAstToken(t);
      tok.isStarred = true;
      return [tok];
    },
  },
  {
    name: "rest_names",
    symbols: ["rest_names", { literal: "," }, pythonLexer.has("name") ? { type: "name" } : name],
    postprocess: ([params, , t]) => {
      const tok = toAstToken(t);
      tok.isStarred = false;
      return [...params, tok];
    },
  },
  {
    name: "rest_names",
    symbols: [
      "rest_names",
      { literal: "," },
      { literal: "*" },
      pythonLexer.has("name") ? { type: "name" } : name,
    ],
    postprocess: ([params, , , t]) => {
      const tok = toAstToken(t);
      tok.isStarred = true;
      return [...params, tok];
    },
  },
  { name: "params", symbols: [{ literal: "(" }, { literal: ")" }], postprocess: drop },
  {
    name: "params",
    symbols: [{ literal: "(" }, "rest_names", { literal: ")" }],
    postprocess: ([, ps]) => ps,
  },
  {
    name: "expression",
    symbols: ["expressionOr", { literal: "if" }, "expressionOr", { literal: "else" }, "expression"],
    postprocess: ([cons, , test, , alt]) =>
      new ExprNS.Ternary(cons.startToken, alt.endToken, test, cons, alt),
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
  {
    name: "expressionCmpOp",
    symbols: [pythonLexer.has("less") ? { type: "less" } : less],
    postprocess: tok,
  },
  {
    name: "expressionCmpOp",
    symbols: [pythonLexer.has("greater") ? { type: "greater" } : greater],
    postprocess: tok,
  },
  {
    name: "expressionCmpOp",
    symbols: [pythonLexer.has("doubleequal") ? { type: "doubleequal" } : doubleequal],
    postprocess: tok,
  },
  {
    name: "expressionCmpOp",
    symbols: [pythonLexer.has("greaterequal") ? { type: "greaterequal" } : greaterequal],
    postprocess: tok,
  },
  {
    name: "expressionCmpOp",
    symbols: [pythonLexer.has("lessequal") ? { type: "lessequal" } : lessequal],
    postprocess: tok,
  },
  {
    name: "expressionCmpOp",
    symbols: [pythonLexer.has("notequal") ? { type: "notequal" } : notequal],
    postprocess: tok,
  },
  { name: "expressionCmpOp", symbols: [{ literal: "in" }], postprocess: tok },
  {
    name: "expressionCmpOp",
    symbols: [{ literal: "not" }, { literal: "in" }],
    postprocess: ([t]) => {
      const tok = toAstToken(t);
      tok.lexeme = "not in";
      return tok;
    },
  },
  { name: "expressionCmpOp", symbols: [{ literal: "is" }], postprocess: tok },
  {
    name: "expressionCmpOp",
    symbols: [{ literal: "is" }, { literal: "not" }],
    postprocess: ([t]) => {
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
  {
    name: "expressionAddOp",
    symbols: [pythonLexer.has("plus") ? { type: "plus" } : plus],
    postprocess: tok,
  },
  {
    name: "expressionAddOp",
    symbols: [pythonLexer.has("minus") ? { type: "minus" } : minus],
    postprocess: tok,
  },
  {
    name: "expressionMul",
    symbols: ["expressionMul", "expressionMulOp", "expressionUnary"],
    postprocess: astBinary,
  },
  { name: "expressionMul", symbols: ["expressionUnary"], postprocess: id },
  {
    name: "expressionMulOp",
    symbols: [pythonLexer.has("star") ? { type: "star" } : star],
    postprocess: tok,
  },
  {
    name: "expressionMulOp",
    symbols: [pythonLexer.has("slash") ? { type: "slash" } : slash],
    postprocess: tok,
  },
  {
    name: "expressionMulOp",
    symbols: [pythonLexer.has("percent") ? { type: "percent" } : percent],
    postprocess: tok,
  },
  {
    name: "expressionMulOp",
    symbols: [pythonLexer.has("doubleslash") ? { type: "doubleslash" } : doubleslash],
    postprocess: tok,
  },
  {
    name: "expressionUnary",
    symbols: [pythonLexer.has("plus") ? { type: "plus" } : plus, "expressionUnary"],
    postprocess: astUnary,
  },
  {
    name: "expressionUnary",
    symbols: [pythonLexer.has("minus") ? { type: "minus" } : minus, "expressionUnary"],
    postprocess: astUnary,
  },
  { name: "expressionUnary", symbols: ["expressionPow"], postprocess: id },
  {
    name: "expressionPow",
    symbols: [
      "expressionPost",
      pythonLexer.has("doublestar") ? { type: "doublestar" } : doublestar,
      "expressionUnary",
    ],
    postprocess: astBinaryTok,
  },
  { name: "expressionPow", symbols: ["expressionPost"], postprocess: id },
  {
    name: "expressionPost",
    symbols: [
      "expressionPost",
      pythonLexer.has("lsqb") ? { type: "lsqb" } : lsqb,
      "expression",
      pythonLexer.has("rsqb") ? { type: "rsqb" } : rsqb,
    ],
    postprocess: ([obj, , idx, rsqb]) =>
      new ExprNS.Subscript(obj.startToken, toAstToken(rsqb), obj, idx),
  },
  {
    name: "expressionPost",
    symbols: ["expressionPost", { literal: "(" }, "expressions", { literal: ")" }],
    postprocess: ([callee, , args, rparen]) =>
      new ExprNS.Call(callee.startToken, toAstToken(rparen), callee, args),
  },
  {
    name: "expressionPost",
    symbols: ["expressionPost", { literal: "(" }, { literal: ")" }],
    postprocess: ([callee, , rparen]) =>
      new ExprNS.Call(callee.startToken, toAstToken(rparen), callee, []),
  },
  { name: "expressionPost", symbols: ["atom"], postprocess: id },
  {
    name: "atom",
    symbols: [{ literal: "(" }, "expression", { literal: ")" }],
    postprocess: ([, e]) => new ExprNS.Grouping(e.startToken, e.endToken, e),
  },
  {
    name: "atom",
    symbols: [
      pythonLexer.has("lsqb") ? { type: "lsqb" } : lsqb,
      pythonLexer.has("rsqb") ? { type: "rsqb" } : rsqb,
    ],
    postprocess: ([l, r]) => new ExprNS.List(toAstToken(l), toAstToken(r), []),
  },
  {
    name: "atom",
    symbols: [
      pythonLexer.has("lsqb") ? { type: "lsqb" } : lsqb,
      "expressions",
      pythonLexer.has("rsqb") ? { type: "rsqb" } : rsqb,
    ],
    postprocess: ([l, elems, r]) => new ExprNS.List(toAstToken(l), toAstToken(r), elems),
  },
  {
    name: "atom",
    symbols: [pythonLexer.has("name") ? { type: "name" } : name],
    postprocess: astVariable,
  },
  {
    name: "atom",
    symbols: [pythonLexer.has("number_float") ? { type: "number_float" } : number_float],
    postprocess: ([t]) => {
      const tok = toAstToken(t);
      return new ExprNS.Literal(tok, tok, parseFloat(t.value));
    },
  },
  {
    name: "atom",
    symbols: [pythonLexer.has("number_int") ? { type: "number_int" } : number_int],
    postprocess: astBigInt,
  },
  {
    name: "atom",
    symbols: [pythonLexer.has("number_hex") ? { type: "number_hex" } : number_hex],
    postprocess: astBigInt,
  },
  {
    name: "atom",
    symbols: [pythonLexer.has("number_oct") ? { type: "number_oct" } : number_oct],
    postprocess: astBigInt,
  },
  {
    name: "atom",
    symbols: [pythonLexer.has("number_bin") ? { type: "number_bin" } : number_bin],
    postprocess: astBigInt,
  },
  {
    name: "atom",
    symbols: [pythonLexer.has("number_complex") ? { type: "number_complex" } : number_complex],
    postprocess: astComplex,
  },
  { name: "atom", symbols: ["stringLit"], postprocess: id },
  { name: "atom", symbols: [{ literal: "None" }], postprocess: astNone },
  { name: "atom", symbols: [{ literal: "True" }], postprocess: astTrue },
  { name: "atom", symbols: [{ literal: "False" }], postprocess: astFalse },
  {
    name: "lambda_expr",
    symbols: [{ literal: "lambda" }, "names", { literal: ":" }, "expression"],
    postprocess: ([kw, params, , body]) =>
      new ExprNS.Lambda(toAstToken(kw), body.endToken, params, body),
  },
  {
    name: "lambda_expr",
    symbols: [
      { literal: "lambda" },
      "names",
      pythonLexer.has("doublecolon") ? { type: "doublecolon" } : doublecolon,
      "block",
    ],
    postprocess: ([kw, params, , body]) =>
      new ExprNS.MultiLambda(toAstToken(kw), body[body.length - 1].endToken, params, body, []),
  },
  {
    name: "lambda_expr",
    symbols: [{ literal: "lambda" }, { literal: ":" }, "expression"],
    postprocess: ([kw, , body]) => new ExprNS.Lambda(toAstToken(kw), body.endToken, [], body),
  },
  {
    name: "lambda_expr",
    symbols: [
      { literal: "lambda" },
      pythonLexer.has("doublecolon") ? { type: "doublecolon" } : doublecolon,
      "block",
    ],
    postprocess: ([kw, , body]) =>
      new ExprNS.MultiLambda(toAstToken(kw), body[body.length - 1].endToken, [], body, []),
  },
  { name: "expressions$ebnf$1", symbols: [] },
  { name: "expressions$ebnf$1$subexpression$1", symbols: [{ literal: "," }, "expression"] },
  {
    name: "expressions$ebnf$1",
    symbols: ["expressions$ebnf$1", "expressions$ebnf$1$subexpression$1"],
    postprocess: function arrpush(d) {
      return d[0].concat([d[1]]);
    },
  },
  { name: "expressions$ebnf$2$subexpression$1", symbols: [{ literal: "," }] },
  { name: "expressions$ebnf$2", symbols: ["expressions$ebnf$2$subexpression$1"], postprocess: id },
  {
    name: "expressions$ebnf$2",
    symbols: [],
    postprocess: function (d) {
      return null;
    },
  },
  {
    name: "expressions",
    symbols: ["expression", "expressions$ebnf$1", "expressions$ebnf$2"],
    postprocess: flatList,
  },
  {
    name: "stringLit",
    symbols: [
      pythonLexer.has("string_triple_double")
        ? { type: "string_triple_double" }
        : string_triple_double,
    ],
    postprocess: astString,
  },
  {
    name: "stringLit",
    symbols: [
      pythonLexer.has("string_triple_single")
        ? { type: "string_triple_single" }
        : string_triple_single,
    ],
    postprocess: astString,
  },
  {
    name: "stringLit",
    symbols: [pythonLexer.has("string_double") ? { type: "string_double" } : string_double],
    postprocess: astString,
  },
  {
    name: "stringLit",
    symbols: [pythonLexer.has("string_single") ? { type: "string_single" } : string_single],
    postprocess: astString,
  },
];
let ParserStart = "program";
export default { Lexer, ParserRules, ParserStart };
