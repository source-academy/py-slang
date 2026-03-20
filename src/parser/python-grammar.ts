/* eslint-disable */
// @ts-nocheck
// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
function id(x) {
  return x[0];
}

import { StmtNS, ExprNS } from "../ast-types";
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
let Lexer = pythonLexer;
let ParserRules = [
  {
    name: "program",
    symbols: ["program_stmts"],
    postprocess: ([stmts]) => {
      const filtered = (stmts || []).filter(Boolean);
      const start = filtered[0]
        ? filtered[0].startToken
        : toAstToken({ type: "newline", value: "", line: 1, col: 1, offset: 0 });
      const end = filtered.length > 0 ? filtered[filtered.length - 1].endToken : start;
      return new StmtNS.FileInput(start, end, filtered, []);
    },
  },
  { name: "program_stmts", symbols: [], postprocess: drop },
  {
    name: "program_stmts",
    symbols: ["program_stmts", "statement"],
    postprocess: ([xs, x]) => (x ? [...xs, x] : xs),
  },
  {
    name: "program_stmts",
    symbols: ["program_stmts", pythonLexer.has("newline") ? { type: "newline" } : newline],
    postprocess: id,
  },
  {
    name: "program_stmts",
    symbols: ["program_stmts", pythonLexer.has("ws") ? { type: "ws" } : ws],
    postprocess: id,
  },
  {
    name: "import_stmt",
    symbols: [
      { literal: "from" },
      "_",
      "dotted_name",
      "_",
      { literal: "import" },
      "_",
      "import_clause",
    ],
    postprocess: ([kw, , mod, , , , names]) => {
      const last = names[names.length - 1];
      const endTok = last.alias || last.name;
      return new StmtNS.FromImport(toAstToken(kw), endTok, mod, names);
    },
  },
  {
    name: "dotted_name",
    symbols: [pythonLexer.has("name") ? { type: "name" } : name],
    postprocess: ([t]) => toAstToken(t),
  },
  {
    name: "dotted_name",
    symbols: ["dotted_name", { literal: "." }, pythonLexer.has("name") ? { type: "name" } : name],
    postprocess: ([left, , right]) => {
      const tok = toAstToken(right);
      tok.lexeme = left.lexeme + "." + tok.lexeme;
      tok.col = left.col;
      tok.indexInSource = left.indexInSource;
      return tok;
    },
  },
  { name: "import_clause", symbols: ["import_as_names"], postprocess: id },
  {
    name: "import_clause",
    symbols: [{ literal: "(" }, "_", "import_as_names", "_", { literal: ")" }],
    postprocess: ([, , ns]) => ns,
  },
  { name: "import_as_names", symbols: ["import_as_name"], postprocess: ([t]) => [t] },
  {
    name: "import_as_names",
    symbols: ["import_as_names", "_", { literal: "," }, "_", "import_as_name"],
    postprocess: ([ns, , , , t]) => [...ns, t],
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
      "_",
      { literal: "as" },
      "_",
      pythonLexer.has("name") ? { type: "name" } : name,
    ],
    postprocess: ([t, , , , a]) => ({ name: toAstToken(t), alias: toAstToken(a) }),
  },
  { name: "statement", symbols: ["simple_statement"], postprocess: id },
  { name: "statement", symbols: ["compound_statement"], postprocess: id },
  {
    name: "simple_statement",
    symbols: ["small_statement", "_", pythonLexer.has("newline") ? { type: "newline" } : newline],
    postprocess: id,
  },
  {
    name: "small_statement",
    symbols: [{ literal: "pass" }],
    postprocess: ([t]) => {
      const tok = toAstToken(t);
      return new StmtNS.Pass(tok, tok);
    },
  },
  {
    name: "small_statement",
    symbols: [{ literal: "break" }],
    postprocess: ([t]) => {
      const tok = toAstToken(t);
      return new StmtNS.Break(tok, tok);
    },
  },
  {
    name: "small_statement",
    symbols: [{ literal: "continue" }],
    postprocess: ([t]) => {
      const tok = toAstToken(t);
      return new StmtNS.Continue(tok, tok);
    },
  },
  {
    name: "small_statement",
    symbols: [{ literal: "return" }, "_", "expression"],
    postprocess: ([kw, , expr]) => new StmtNS.Return(toAstToken(kw), expr.endToken, expr),
  },
  {
    name: "small_statement",
    symbols: [{ literal: "return" }],
    postprocess: ([t]) => {
      const tok = toAstToken(t);
      return new StmtNS.Return(tok, tok, null);
    },
  },
  {
    name: "small_statement",
    symbols: [
      pythonLexer.has("name") ? { type: "name" } : name,
      "_",
      { literal: ":" },
      "_",
      "expression",
      "_",
      { literal: "=" },
      "_",
      "expression",
    ],
    postprocess: ([n, , , , ann, , , , v]) => {
      const tok = toAstToken(n);
      return new StmtNS.AnnAssign(tok, v.endToken, new ExprNS.Variable(tok, tok, tok), v, ann);
    },
  },
  {
    name: "small_statement",
    symbols: [
      pythonLexer.has("name") ? { type: "name" } : name,
      "_",
      { literal: ":" },
      "_",
      "expression",
    ],
    postprocess: ([n, , , , ann]) => {
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
    name: "small_statement",
    symbols: [
      pythonLexer.has("name") ? { type: "name" } : name,
      "_",
      { literal: "=" },
      "_",
      "expression",
    ],
    postprocess: ([n, , , , v]) => {
      const tok = toAstToken(n);
      return new StmtNS.Assign(tok, v.endToken, new ExprNS.Variable(tok, tok, tok), v);
    },
  },
  {
    name: "small_statement",
    symbols: [
      "post_expr",
      pythonLexer.has("lsqb") ? { type: "lsqb" } : lsqb,
      "_",
      "expression",
      "_",
      pythonLexer.has("rsqb") ? { type: "rsqb" } : rsqb,
      "_",
      { literal: "=" },
      "_",
      "expression",
    ],
    postprocess: function (d) {
      var obj = d[0],
        idx = d[3],
        rsqb = d[5],
        val = d[9];
      var sub = new ExprNS.Subscript(obj.startToken, toAstToken(rsqb), obj, idx);
      return new StmtNS.Assign(obj.startToken, val.endToken, sub, val);
    },
  },
  { name: "small_statement", symbols: ["import_stmt"], postprocess: id },
  {
    name: "small_statement",
    symbols: [{ literal: "global" }, "_", pythonLexer.has("name") ? { type: "name" } : name],
    postprocess: ([kw, , n]) => new StmtNS.Global(toAstToken(kw), toAstToken(n), toAstToken(n)),
  },
  {
    name: "small_statement",
    symbols: [{ literal: "nonlocal" }, "_", pythonLexer.has("name") ? { type: "name" } : name],
    postprocess: ([kw, , n]) => new StmtNS.NonLocal(toAstToken(kw), toAstToken(n), toAstToken(n)),
  },
  {
    name: "small_statement",
    symbols: [{ literal: "assert" }, "_", "expression"],
    postprocess: ([kw, , e]) => new StmtNS.Assert(toAstToken(kw), e.endToken, e),
  },
  {
    name: "small_statement",
    symbols: ["expression"],
    postprocess: ([e]) => new StmtNS.SimpleExpr(e.startToken, e.endToken, e),
  },
  {
    name: "names",
    symbols: [pythonLexer.has("name") ? { type: "name" } : name],
    postprocess: ([t]) => [toAstToken(t)],
  },
  {
    name: "names",
    symbols: [
      "names",
      "_nl",
      { literal: "," },
      "_nl",
      pythonLexer.has("name") ? { type: "name" } : name,
    ],
    postprocess: ([ps, , , , t]) => [...ps, toAstToken(t)],
  },
  {
    name: "if_statement",
    symbols: [
      { literal: "if" },
      "_",
      "expression",
      "_",
      { literal: ":" },
      "_",
      "block",
      "elif_chain",
    ],
    postprocess: ([kw, , test, , , , body, else_]) =>
      new StmtNS.If(
        toAstToken(kw),
        else_ && else_.length > 0
          ? else_[else_.length - 1].endToken
          : body[body.length - 1].endToken,
        test,
        body,
        else_,
      ),
  },
  {
    name: "elif_chain",
    symbols: [
      "_",
      { literal: "elif" },
      "_",
      "expression",
      "_",
      { literal: ":" },
      "_",
      "block",
      "elif_chain",
    ],
    postprocess: ([, kw, , test, , , , body, else_]) => [
      new StmtNS.If(
        toAstToken(kw),
        else_ && else_.length > 0
          ? else_[else_.length - 1].endToken
          : body[body.length - 1].endToken,
        test,
        body,
        else_,
      ),
    ],
  },
  {
    name: "elif_chain",
    symbols: ["_", { literal: "else" }, "_", { literal: ":" }, "_", "block"],
    postprocess: ([, , , , , body]) => body,
  },
  { name: "elif_chain", symbols: [], postprocess: nil },
  { name: "block", symbols: ["simple_statement"], postprocess: list },
  {
    name: "block",
    symbols: [
      pythonLexer.has("newline") ? { type: "newline" } : newline,
      pythonLexer.has("indent") ? { type: "indent" } : indent,
      "block_stmts",
      pythonLexer.has("dedent") ? { type: "dedent" } : dedent,
    ],
    postprocess: ([, , stmts]) => stmts,
  },
  { name: "block_stmts", symbols: ["_", "statement"], postprocess: ([, s]) => [s] },
  {
    name: "block_stmts",
    symbols: ["block_stmts", "_", "statement"],
    postprocess: ([xs, , s]) => [...xs, s],
  },
  {
    name: "block_stmts",
    symbols: ["block_stmts", "_", pythonLexer.has("newline") ? { type: "newline" } : newline],
    postprocess: id,
  },
  { name: "compound_statement", symbols: ["if_statement"], postprocess: id },
  {
    name: "compound_statement",
    symbols: [{ literal: "while" }, "_", "expression", "_", { literal: ":" }, "_", "block"],
    postprocess: ([kw, , test, , , , body]) =>
      new StmtNS.While(toAstToken(kw), body[body.length - 1].endToken, test, body),
  },
  {
    name: "compound_statement",
    symbols: [
      { literal: "for" },
      "_",
      pythonLexer.has("name") ? { type: "name" } : name,
      "_",
      { literal: "in" },
      "_",
      "expression",
      "_",
      { literal: ":" },
      "_",
      "block",
    ],
    postprocess: ([kw, , target, , , , iter, , , , body]) =>
      new StmtNS.For(
        toAstToken(kw),
        body[body.length - 1].endToken,
        toAstToken(target),
        iter,
        body,
      ),
  },
  {
    name: "compound_statement",
    symbols: [
      { literal: "def" },
      "_",
      pythonLexer.has("name") ? { type: "name" } : name,
      "_",
      "params",
      "_",
      { literal: ":" },
      "_",
      "block",
    ],
    postprocess: ([kw, , name, , params, , , , body]) =>
      new StmtNS.FunctionDef(
        toAstToken(kw),
        body[body.length - 1].endToken,
        toAstToken(name),
        params,
        body,
        [],
      ),
  },
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
    symbols: [
      "rest_names",
      "_nl",
      { literal: "," },
      "_nl",
      pythonLexer.has("name") ? { type: "name" } : name,
    ],
    postprocess: ([params, , , , t]) => {
      const tok = toAstToken(t);
      tok.isStarred = false;
      return [...params, tok];
    },
  },
  {
    name: "rest_names",
    symbols: [
      "rest_names",
      "_nl",
      { literal: "," },
      "_nl",
      { literal: "*" },
      pythonLexer.has("name") ? { type: "name" } : name,
    ],
    postprocess: ([params, , , , , t]) => {
      const tok = toAstToken(t);
      tok.isStarred = true;
      return [...params, tok];
    },
  },
  { name: "params", symbols: [{ literal: "(" }, "_nl", { literal: ")" }], postprocess: drop },
  {
    name: "params",
    symbols: [{ literal: "(" }, "_nl", "rest_names", "_nl", { literal: ")" }],
    postprocess: ([, , ps]) => ps,
  },
  {
    name: "expression",
    symbols: [
      "or_expr",
      "_",
      { literal: "if" },
      "_",
      "or_expr",
      "_",
      { literal: "else" },
      "_",
      "expression",
    ],
    postprocess: ([cons, , , , test, , , , alt]) =>
      new ExprNS.Ternary(cons.startToken, alt.endToken, test, cons, alt),
  },
  { name: "expression", symbols: ["or_expr"], postprocess: id },
  { name: "expression", symbols: ["lambda_expr"], postprocess: id },
  {
    name: "or_expr",
    symbols: ["or_expr", "_", { literal: "or" }, "_", "and_expr"],
    postprocess: ([left, , op, , right]) =>
      new ExprNS.BoolOp(left.startToken, right.endToken, left, toAstToken(op), right),
  },
  { name: "or_expr", symbols: ["and_expr"], postprocess: id },
  {
    name: "and_expr",
    symbols: ["and_expr", "_", { literal: "and" }, "_", "not_expr"],
    postprocess: ([left, , op, , right]) =>
      new ExprNS.BoolOp(left.startToken, right.endToken, left, toAstToken(op), right),
  },
  { name: "and_expr", symbols: ["not_expr"], postprocess: id },
  {
    name: "not_expr",
    symbols: [{ literal: "not" }, "_", "not_expr"],
    postprocess: ([op, , arg]) =>
      new ExprNS.Unary(toAstToken(op), arg.endToken, toAstToken(op), arg),
  },
  { name: "not_expr", symbols: ["cmp_expr"], postprocess: id },
  {
    name: "cmp_expr",
    symbols: ["cmp_expr", "_", "cmp_op", "_", "add_expr"],
    postprocess: ([left, , op, , right]) =>
      new ExprNS.Compare(left.startToken, right.endToken, left, op, right),
  },
  { name: "cmp_expr", symbols: ["add_expr"], postprocess: id },
  {
    name: "cmp_op",
    symbols: [pythonLexer.has("less") ? { type: "less" } : less],
    postprocess: ([t]) => toAstToken(t),
  },
  {
    name: "cmp_op",
    symbols: [pythonLexer.has("greater") ? { type: "greater" } : greater],
    postprocess: ([t]) => toAstToken(t),
  },
  {
    name: "cmp_op",
    symbols: [pythonLexer.has("doubleequal") ? { type: "doubleequal" } : doubleequal],
    postprocess: ([t]) => toAstToken(t),
  },
  {
    name: "cmp_op",
    symbols: [pythonLexer.has("greaterequal") ? { type: "greaterequal" } : greaterequal],
    postprocess: ([t]) => toAstToken(t),
  },
  {
    name: "cmp_op",
    symbols: [pythonLexer.has("lessequal") ? { type: "lessequal" } : lessequal],
    postprocess: ([t]) => toAstToken(t),
  },
  {
    name: "cmp_op",
    symbols: [pythonLexer.has("notequal") ? { type: "notequal" } : notequal],
    postprocess: ([t]) => toAstToken(t),
  },
  { name: "cmp_op", symbols: [{ literal: "in" }], postprocess: ([t]) => toAstToken(t) },
  {
    name: "cmp_op",
    symbols: [{ literal: "not" }, "_", { literal: "in" }],
    postprocess: ([t, ,]) => {
      const tok = toAstToken(t);
      tok.lexeme = "not in";
      return tok;
    },
  },
  { name: "cmp_op", symbols: [{ literal: "is" }], postprocess: ([t]) => toAstToken(t) },
  {
    name: "cmp_op",
    symbols: [{ literal: "is" }, "_", { literal: "not" }],
    postprocess: ([t, ,]) => {
      const tok = toAstToken(t);
      tok.lexeme = "is not";
      return tok;
    },
  },
  {
    name: "add_expr",
    symbols: ["add_expr", "_", "add_op", "_", "mul_expr"],
    postprocess: ([left, , op, , right]) =>
      new ExprNS.Binary(left.startToken, right.endToken, left, op, right),
  },
  { name: "add_expr", symbols: ["mul_expr"], postprocess: id },
  {
    name: "add_op",
    symbols: [pythonLexer.has("plus") ? { type: "plus" } : plus],
    postprocess: ([t]) => toAstToken(t),
  },
  {
    name: "add_op",
    symbols: [pythonLexer.has("minus") ? { type: "minus" } : minus],
    postprocess: ([t]) => toAstToken(t),
  },
  {
    name: "mul_expr",
    symbols: ["mul_expr", "_", "mul_op", "_", "unary_expr"],
    postprocess: ([left, , op, , right]) =>
      new ExprNS.Binary(left.startToken, right.endToken, left, op, right),
  },
  { name: "mul_expr", symbols: ["unary_expr"], postprocess: id },
  {
    name: "mul_op",
    symbols: [pythonLexer.has("star") ? { type: "star" } : star],
    postprocess: ([t]) => toAstToken(t),
  },
  {
    name: "mul_op",
    symbols: [pythonLexer.has("slash") ? { type: "slash" } : slash],
    postprocess: ([t]) => toAstToken(t),
  },
  {
    name: "mul_op",
    symbols: [pythonLexer.has("percent") ? { type: "percent" } : percent],
    postprocess: ([t]) => toAstToken(t),
  },
  {
    name: "mul_op",
    symbols: [pythonLexer.has("doubleslash") ? { type: "doubleslash" } : doubleslash],
    postprocess: ([t]) => toAstToken(t),
  },
  {
    name: "unary_expr",
    symbols: [pythonLexer.has("plus") ? { type: "plus" } : plus, "_", "unary_expr"],
    postprocess: ([op, , arg]) =>
      new ExprNS.Unary(toAstToken(op), arg.endToken, toAstToken(op), arg),
  },
  {
    name: "unary_expr",
    symbols: [pythonLexer.has("minus") ? { type: "minus" } : minus, "_", "unary_expr"],
    postprocess: ([op, , arg]) =>
      new ExprNS.Unary(toAstToken(op), arg.endToken, toAstToken(op), arg),
  },
  { name: "unary_expr", symbols: ["pow_expr"], postprocess: id },
  {
    name: "pow_expr",
    symbols: [
      "post_expr",
      "_",
      pythonLexer.has("doublestar") ? { type: "doublestar" } : doublestar,
      "_",
      "unary_expr",
    ],
    postprocess: ([left, , op, , right]) =>
      new ExprNS.Binary(left.startToken, right.endToken, left, toAstToken(op), right),
  },
  { name: "pow_expr", symbols: ["post_expr"], postprocess: id },
  {
    name: "post_expr",
    symbols: [
      "post_expr",
      pythonLexer.has("lsqb") ? { type: "lsqb" } : lsqb,
      "_",
      "expression",
      "_",
      pythonLexer.has("rsqb") ? { type: "rsqb" } : rsqb,
    ],
    postprocess: ([obj, , , idx, , rsqb]) =>
      new ExprNS.Subscript(obj.startToken, toAstToken(rsqb), obj, idx),
  },
  {
    name: "post_expr",
    symbols: ["post_expr", { literal: "(" }, "_", "expressions", "_", { literal: ")" }],
    postprocess: ([callee, , , args, , rparen]) =>
      new ExprNS.Call(callee.startToken, toAstToken(rparen), callee, args),
  },
  {
    name: "post_expr",
    symbols: ["post_expr", { literal: "(" }, "_", { literal: ")" }],
    postprocess: ([callee, , , rparen]) =>
      new ExprNS.Call(callee.startToken, toAstToken(rparen), callee, []),
  },
  { name: "post_expr", symbols: ["atom"], postprocess: id },
  {
    name: "atom",
    symbols: [{ literal: "(" }, "_", "expression", "_", { literal: ")" }],
    postprocess: ([, , e]) => new ExprNS.Grouping(e.startToken, e.endToken, e),
  },
  {
    name: "atom",
    symbols: [
      pythonLexer.has("lsqb") ? { type: "lsqb" } : lsqb,
      "_",
      pythonLexer.has("rsqb") ? { type: "rsqb" } : rsqb,
    ],
    postprocess: ([l, , r]) => new ExprNS.List(toAstToken(l), toAstToken(r), []),
  },
  {
    name: "atom",
    symbols: [
      pythonLexer.has("lsqb") ? { type: "lsqb" } : lsqb,
      "_",
      "expressions",
      "_",
      pythonLexer.has("rsqb") ? { type: "rsqb" } : rsqb,
    ],
    postprocess: ([l, , elems, , r]) => new ExprNS.List(toAstToken(l), toAstToken(r), elems),
  },
  {
    name: "atom",
    symbols: [pythonLexer.has("name") ? { type: "name" } : name],
    postprocess: ([t]) => {
      const tok = toAstToken(t);
      return new ExprNS.Variable(tok, tok, tok);
    },
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
    postprocess: ([t]) => {
      const tok = toAstToken(t);
      return new ExprNS.BigIntLiteral(tok, tok, t.value);
    },
  },
  {
    name: "atom",
    symbols: [pythonLexer.has("number_hex") ? { type: "number_hex" } : number_hex],
    postprocess: ([t]) => {
      const tok = toAstToken(t);
      return new ExprNS.BigIntLiteral(tok, tok, t.value);
    },
  },
  {
    name: "atom",
    symbols: [pythonLexer.has("number_oct") ? { type: "number_oct" } : number_oct],
    postprocess: ([t]) => {
      const tok = toAstToken(t);
      return new ExprNS.BigIntLiteral(tok, tok, t.value);
    },
  },
  {
    name: "atom",
    symbols: [pythonLexer.has("number_bin") ? { type: "number_bin" } : number_bin],
    postprocess: ([t]) => {
      const tok = toAstToken(t);
      return new ExprNS.BigIntLiteral(tok, tok, t.value);
    },
  },
  {
    name: "atom",
    symbols: [pythonLexer.has("number_complex") ? { type: "number_complex" } : number_complex],
    postprocess: ([t]) => {
      const tok = toAstToken(t);
      return new ExprNS.Complex(tok, tok, t.value);
    },
  },
  { name: "atom", symbols: ["string_lit"], postprocess: id },
  {
    name: "atom",
    symbols: [{ literal: "None" }],
    postprocess: ([t]) => {
      const tok = toAstToken(t);
      return new ExprNS.None(tok, tok);
    },
  },
  {
    name: "atom",
    symbols: [{ literal: "True" }],
    postprocess: ([t]) => {
      const tok = toAstToken(t);
      return new ExprNS.Literal(tok, tok, true);
    },
  },
  {
    name: "atom",
    symbols: [{ literal: "False" }],
    postprocess: ([t]) => {
      const tok = toAstToken(t);
      return new ExprNS.Literal(tok, tok, false);
    },
  },
  {
    name: "lambda_expr",
    symbols: [{ literal: "lambda" }, "_", "names", "_", { literal: ":" }, "_", "expression"],
    postprocess: ([kw, , params, , , , body]) =>
      new ExprNS.Lambda(toAstToken(kw), body.endToken, params, body),
  },
  {
    name: "lambda_expr",
    symbols: [
      { literal: "lambda" },
      "_",
      "names",
      "_",
      pythonLexer.has("doublecolon") ? { type: "doublecolon" } : doublecolon,
      "_",
      "block",
    ],
    postprocess: ([kw, , params, , , , body]) =>
      new ExprNS.MultiLambda(toAstToken(kw), body[body.length - 1].endToken, params, body, []),
  },
  {
    name: "lambda_expr",
    symbols: [{ literal: "lambda" }, "_", { literal: ":" }, "_", "expression"],
    postprocess: ([kw, , , , body]) => new ExprNS.Lambda(toAstToken(kw), body.endToken, [], body),
  },
  {
    name: "lambda_expr",
    symbols: [
      { literal: "lambda" },
      "_",
      pythonLexer.has("doublecolon") ? { type: "doublecolon" } : doublecolon,
      "_",
      "block",
    ],
    postprocess: ([kw, , , , body]) =>
      new ExprNS.MultiLambda(toAstToken(kw), body[body.length - 1].endToken, [], body, []),
  },
  { name: "expressions", symbols: ["expression"], postprocess: list },
  {
    name: "expressions",
    symbols: ["expressions", "_", { literal: "," }, "_", "expression"],
    postprocess: ([as, , , , a]) => [...as, a],
  },
  { name: "expressions", symbols: ["expression", "_", { literal: "," }], postprocess: list },
  {
    name: "string_lit",
    symbols: [
      pythonLexer.has("string_triple_double")
        ? { type: "string_triple_double" }
        : string_triple_double,
    ],
    postprocess: ([t]) => {
      const tok = toAstToken(t);
      return new ExprNS.Literal(tok, tok, stripQuotes(t.value));
    },
  },
  {
    name: "string_lit",
    symbols: [
      pythonLexer.has("string_triple_single")
        ? { type: "string_triple_single" }
        : string_triple_single,
    ],
    postprocess: ([t]) => {
      const tok = toAstToken(t);
      return new ExprNS.Literal(tok, tok, stripQuotes(t.value));
    },
  },
  {
    name: "string_lit",
    symbols: [pythonLexer.has("string_double") ? { type: "string_double" } : string_double],
    postprocess: ([t]) => {
      const tok = toAstToken(t);
      return new ExprNS.Literal(tok, tok, stripQuotes(t.value));
    },
  },
  {
    name: "string_lit",
    symbols: [pythonLexer.has("string_single") ? { type: "string_single" } : string_single],
    postprocess: ([t]) => {
      const tok = toAstToken(t);
      return new ExprNS.Literal(tok, tok, stripQuotes(t.value));
    },
  },
  { name: "_", symbols: [] },
  { name: "_", symbols: [pythonLexer.has("ws") ? { type: "ws" } : ws] },
  { name: "__", symbols: [pythonLexer.has("ws") ? { type: "ws" } : ws] },
  { name: "_nl", symbols: [], postprocess: id },
  { name: "_nl", symbols: ["_nl", pythonLexer.has("ws") ? { type: "ws" } : ws], postprocess: id },
  {
    name: "_nl",
    symbols: ["_nl", pythonLexer.has("newline") ? { type: "newline" } : newline],
    postprocess: id,
  },
  {
    name: "_nl",
    symbols: ["_nl", pythonLexer.has("indent") ? { type: "indent" } : indent],
    postprocess: id,
  },
  {
    name: "_nl",
    symbols: ["_nl", pythonLexer.has("dedent") ? { type: "dedent" } : dedent],
    postprocess: id,
  },
];
let ParserStart = "program";
export default { Lexer, ParserRules, ParserStart };
