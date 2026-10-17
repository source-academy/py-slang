// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
function id(x: unknown[]) {
  return x[0];
}

import { ExprNS, FunctionParam, StmtNS } from "../ast-types";
import { Token, TokenType } from "../tokenizer";
import pythonLexer from "./lexer";
import { ParseError } from "./parse-error";
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

// A `for` clause of a comprehension, with the token that ends it (for the node's position).
type Clause = { target: ExprNS.Expr; iter: ExprNS.Expr; conditions: ExprNS.Expr[]; end: Token };
const generators = (clauses: Clause[]) =>
  clauses.map(({ target, iter, conditions }) => ({ target, iter, conditions }));

// ── Checks that the grammar cannot express (CPython reports them as syntax errors) ──────
const syntaxError = (message: string, at: Token) => new ParseError(message, at.line, at.col, "");

/** Order of the arguments of a call (or the bases of a class): positional arguments, then keyword
 * arguments, where `*xs` may follow keyword arguments but not `**d`. */
function checkArguments(args: ExprNS.Expr[]): ExprNS.Expr[] {
  let keyword = false;
  let unpacked = false;
  for (const arg of args) {
    if (arg instanceof ExprNS.Keyword) keyword = true;
    else if (arg instanceof ExprNS.DoubleStarred) unpacked = true;
    else if (arg instanceof ExprNS.Starred) {
      if (unpacked)
        throw syntaxError(
          "iterable argument unpacking follows keyword argument unpacking",
          arg.startToken,
        );
    } else if (unpacked) {
      throw syntaxError("positional argument follows keyword argument unpacking", arg.startToken);
    } else if (keyword) {
      throw syntaxError("positional argument follows keyword argument", arg.startToken);
    }
  }
  return args;
}

// (A copy: Earley shares the parameters between the branches that it follows, and a branch that
// has this comma may be ruled out by the next token, as in `def f(a, b, c)`.)
const withTrailingComma = (params: FunctionParam[], comma: unknown): FunctionParam[] => {
  if (!comma) return params;
  const last = params[params.length - 1];
  const flagged = Object.assign(Object.create(Object.getPrototypeOf(last)), last, {
    trailingComma: true,
  }) as FunctionParam;
  return [...params.slice(0, -1), flagged];
};

/** A parameter without a default may not follow one with a default, unless `*args` came between
 * (then it is keyword-only). */
function checkParameters(params: FunctionParam[]): FunctionParam[] {
  let defaulted = false;
  let starred = false;
  for (const param of params) {
    if (param.isDoubleStarred) continue;
    if (param.isStarred) starred = true;
    else if (param.default) defaulted = true;
    else if (defaulted && !starred) {
      throw syntaxError("parameter without a default follows parameter with a default", param);
    }
  }
  return params;
}

// ── Token / list helpers ────────────────────────────────────────────────
const tok = ([t]: [moo.Token]) => toAstToken(t);
const tupleOf = (elems: ExprNS.Expr[]) =>
  new ExprNS.Tuple(elems[0].startToken, elems[elems.length - 1].endToken, elems);
const flatList = <T>([first, rest]: [T, [unknown, T][]]): T[] => [first, ...rest.map(d => d[1])];
const tokList = ([first, rest]: [moo.Token, [unknown, moo.Token][]]) => [
  toAstToken(first),
  ...rest.map(d => toAstToken(d[1])),
];
const Lexer = pythonLexer;
const ParserRules = [
  { name: "program$ebnf$1", symbols: [] },
  { name: "program$ebnf$1$subexpression$1$ebnf$1", symbols: [] },
  { name: "program$ebnf$1$subexpression$1$ebnf$1$subexpression$1", symbols: [{ type: "newline" }] },
  {
    name: "program$ebnf$1$subexpression$1$ebnf$1",
    symbols: [
      "program$ebnf$1$subexpression$1$ebnf$1",
      "program$ebnf$1$subexpression$1$ebnf$1$subexpression$1",
    ],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  {
    name: "program$ebnf$1$subexpression$1",
    symbols: ["program$ebnf$1$subexpression$1$ebnf$1", "import_stmt", { type: "newline" }],
  },
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
      [moo.Token[], StmtNS.FromImport, moo.Token][],
      ([StmtNS.Stmt] | [moo.Token])[],
    ]) => {
      const importNodes = imports.map(d => d[1]);
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
    symbols: [{ literal: "from" }, "relative_module", { literal: "import" }, "import_clause"],
    postprocess: ([kw, mod, , names]: [
      moo.Token,
      { name: Token; level: number },
      moo.Token,
      StmtNS.FromImport["names"],
    ]) => {
      const last = names[names.length - 1];
      const endTok = last.alias || last.name;
      return new StmtNS.FromImport(toAstToken(kw), endTok, mod.name, names, mod.level);
    },
  },
  { name: "relative_module$ebnf$1", symbols: [] },
  { name: "relative_module$ebnf$1$subexpression$1", symbols: [{ literal: "." }] },
  {
    name: "relative_module$ebnf$1",
    symbols: ["relative_module$ebnf$1", "relative_module$ebnf$1$subexpression$1"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  {
    name: "relative_module",
    symbols: ["relative_module$ebnf$1", "dotted_name"],
    postprocess: ([dots, name]: [moo.Token[], Token]) => ({ level: dots.length, name }),
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
  { name: "statement", symbols: ["statementTupleAssign", { type: "newline" }], postprocess: id },
  { name: "statement", symbols: ["statementRaise", { type: "newline" }], postprocess: id },
  {
    name: "statement",
    symbols: ["statementAttributeAssign", { type: "newline" }],
    postprocess: id,
  },
  { name: "statement", symbols: ["statementAugAssign", { type: "newline" }], postprocess: id },
  { name: "statement", symbols: ["statementDel", { type: "newline" }], postprocess: id },
  { name: "statement", symbols: ["statementImport", { type: "newline" }], postprocess: id },
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
  { name: "statement", symbols: ["statementForUnpack"], postprocess: id },
  { name: "statement", symbols: ["statementClass"], postprocess: id },
  { name: "statement", symbols: ["statementTry"], postprocess: id },
  { name: "statement", symbols: ["statementWith"], postprocess: id },
  { name: "statement", symbols: ["statementDecorated"], postprocess: id },
  {
    name: "statementAssign",
    symbols: [{ type: "name" }, { literal: "=" }, "assign_rhs"],
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
      "subscript_index",
      { type: "rsqb" },
      { literal: "=" },
      "assign_rhs",
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
    symbols: [{ literal: "return" }, "expression_list"],
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
    symbols: [{ literal: "global" }, "names"],
    postprocess: ([kw, ns]: [moo.Token, Token[]]) =>
      new StmtNS.Global(toAstToken(kw), ns[ns.length - 1], ns),
  },
  {
    name: "statementNonlocal",
    symbols: [{ literal: "nonlocal" }, "names"],
    postprocess: ([kw, ns]: [moo.Token, Token[]]) =>
      new StmtNS.NonLocal(toAstToken(kw), ns[ns.length - 1], ns),
  },
  { name: "statementAssert$ebnf$1$subexpression$1", symbols: [{ literal: "," }, "expression"] },
  {
    name: "statementAssert$ebnf$1",
    symbols: ["statementAssert$ebnf$1$subexpression$1"],
    postprocess: id,
  },
  { name: "statementAssert$ebnf$1", symbols: [], postprocess: () => null },
  {
    name: "statementAssert",
    symbols: [{ literal: "assert" }, "expression", "statementAssert$ebnf$1"],
    postprocess: ([kw, e, msg]: [moo.Token, ExprNS.Expr, [moo.Token, ExprNS.Expr] | null]) =>
      new StmtNS.Assert(toAstToken(kw), (msg ? msg[1] : e).endToken, e, msg ? msg[1] : null),
  },
  {
    name: "statementExpr",
    symbols: ["expression"],
    postprocess: ([e]: [ExprNS.Expr]) => new StmtNS.SimpleExpr(e.startToken, e.endToken, e),
  },
  {
    name: "statementExpr",
    symbols: ["yield_expr"],
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
    name: "statementRaise",
    symbols: [{ literal: "raise" }],
    postprocess: ([t]: [moo.Token]) => {
      const k = toAstToken(t);
      return new StmtNS.Raise(k, k, null, null);
    },
  },
  {
    name: "statementRaise",
    symbols: [{ literal: "raise" }, "expression"],
    postprocess: ([kw, e]: [moo.Token, ExprNS.Expr]) =>
      new StmtNS.Raise(toAstToken(kw), e.endToken, e, null),
  },
  {
    name: "statementRaise",
    symbols: [{ literal: "raise" }, "expression", { literal: "from" }, "expression"],
    postprocess: ([kw, e, , cause]: [moo.Token, ExprNS.Expr, moo.Token, ExprNS.Expr]) =>
      new StmtNS.Raise(toAstToken(kw), cause.endToken, e, cause),
  },
  {
    name: "statementDel",
    symbols: [{ literal: "del" }, "del_targets"],
    postprocess: ([kw, ts]: [moo.Token, ExprNS.Expr[]]) =>
      new StmtNS.Del(toAstToken(kw), ts[ts.length - 1].endToken, ts),
  },
  { name: "del_targets$ebnf$1", symbols: [] },
  { name: "del_targets$ebnf$1$subexpression$1", symbols: [{ literal: "," }, "target"] },
  {
    name: "del_targets$ebnf$1",
    symbols: ["del_targets$ebnf$1", "del_targets$ebnf$1$subexpression$1"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  { name: "del_targets$ebnf$2$subexpression$1", symbols: [{ type: "comma" }] },
  { name: "del_targets$ebnf$2", symbols: ["del_targets$ebnf$2$subexpression$1"], postprocess: id },
  { name: "del_targets$ebnf$2", symbols: [], postprocess: () => null },
  {
    name: "del_targets",
    symbols: ["target", "del_targets$ebnf$1", "del_targets$ebnf$2"],
    postprocess: flatList,
  },
  {
    name: "statementImport",
    symbols: [{ literal: "import" }, "import_names"],
    postprocess: ([kw, names]: [moo.Token, StmtNS.Import["names"]]) => {
      const last = names[names.length - 1];
      return new StmtNS.Import(toAstToken(kw), last.alias || last.name, names);
    },
  },
  { name: "import_names$ebnf$1", symbols: [] },
  { name: "import_names$ebnf$1$subexpression$1", symbols: [{ literal: "," }, "import_name"] },
  {
    name: "import_names$ebnf$1",
    symbols: ["import_names$ebnf$1", "import_names$ebnf$1$subexpression$1"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  { name: "import_names", symbols: ["import_name", "import_names$ebnf$1"], postprocess: flatList },
  {
    name: "import_name",
    symbols: ["dotted_name"],
    postprocess: ([t]: [Token]) => ({ name: t, alias: null }),
  },
  {
    name: "import_name",
    symbols: ["dotted_name", { literal: "as" }, { type: "name" }],
    postprocess: ([t, , a]: [Token, moo.Token, moo.Token]) => ({ name: t, alias: toAstToken(a) }),
  },
  {
    name: "statementClass",
    symbols: [{ literal: "class" }, { type: "name" }, { literal: ":" }, "block"],
    postprocess: ([kw, name, , body]: [moo.Token, moo.Token, moo.Token, StmtNS.Stmt[]]) =>
      new StmtNS.Class(toAstToken(kw), body[body.length - 1].endToken, toAstToken(name), [], body),
  },
  {
    name: "statementClass",
    symbols: [
      { literal: "class" },
      { type: "name" },
      { literal: "(" },
      { literal: ")" },
      { literal: ":" },
      "block",
    ],
    postprocess: ([kw, name, , , , body]: [
      moo.Token,
      moo.Token,
      moo.Token,
      moo.Token,
      moo.Token,
      StmtNS.Stmt[],
    ]) =>
      new StmtNS.Class(toAstToken(kw), body[body.length - 1].endToken, toAstToken(name), [], body),
  },
  {
    name: "statementClass",
    symbols: [
      { literal: "class" },
      { type: "name" },
      { literal: "(" },
      "spread_expressions",
      { literal: ")" },
      { literal: ":" },
      "block",
    ],
    postprocess: ([kw, name, , bases, , , body]: [
      moo.Token,
      moo.Token,
      moo.Token,
      ExprNS.Expr[],
      moo.Token,
      moo.Token,
      StmtNS.Stmt[],
    ]) =>
      new StmtNS.Class(
        toAstToken(kw),
        body[body.length - 1].endToken,
        toAstToken(name),
        checkArguments(bases),
        body,
      ),
  },
  {
    name: "statementTry$ebnf$1$subexpression$1",
    symbols: [{ literal: "else" }, { literal: ":" }, "block"],
  },
  {
    name: "statementTry$ebnf$1",
    symbols: ["statementTry$ebnf$1$subexpression$1"],
    postprocess: id,
  },
  { name: "statementTry$ebnf$1", symbols: [], postprocess: () => null },
  {
    name: "statementTry$ebnf$2$subexpression$1",
    symbols: [{ literal: "finally" }, { literal: ":" }, "block"],
  },
  {
    name: "statementTry$ebnf$2",
    symbols: ["statementTry$ebnf$2$subexpression$1"],
    postprocess: id,
  },
  { name: "statementTry$ebnf$2", symbols: [], postprocess: () => null },
  {
    name: "statementTry",
    symbols: [
      { literal: "try" },
      { literal: ":" },
      "block",
      "except_clauses",
      "statementTry$ebnf$1",
      "statementTry$ebnf$2",
    ],
    postprocess: ([kw, , body, handlers, orElse, fin]: [
      moo.Token,
      moo.Token,
      StmtNS.Stmt[],
      StmtNS.Try["handlers"],
      [moo.Token, moo.Token, StmtNS.Stmt[]] | null,
      [moo.Token, moo.Token, StmtNS.Stmt[]] | null,
    ]) => {
      const last = fin ? fin[2] : orElse ? orElse[2] : handlers[handlers.length - 1].body;
      return new StmtNS.Try(
        toAstToken(kw),
        last[last.length - 1].endToken,
        body,
        handlers,
        orElse ? orElse[2] : null,
        fin ? fin[2] : null,
      );
    },
  },
  {
    name: "statementTry",
    symbols: [
      { literal: "try" },
      { literal: ":" },
      "block",
      { literal: "finally" },
      { literal: ":" },
      "block",
    ],
    postprocess: ([kw, , body, , , fin]: [
      moo.Token,
      moo.Token,
      StmtNS.Stmt[],
      moo.Token,
      moo.Token,
      StmtNS.Stmt[],
    ]) => new StmtNS.Try(toAstToken(kw), fin[fin.length - 1].endToken, body, [], null, fin),
  },
  { name: "except_clauses$ebnf$1", symbols: ["except_clause"] },
  {
    name: "except_clauses$ebnf$1",
    symbols: ["except_clauses$ebnf$1", "except_clause"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  { name: "except_clauses$ebnf$2", symbols: ["except_bare"], postprocess: id },
  { name: "except_clauses$ebnf$2", symbols: [], postprocess: () => null },
  {
    name: "except_clauses",
    symbols: ["except_clauses$ebnf$1", "except_clauses$ebnf$2"],
    postprocess: ([typed, bare]: [
      StmtNS.Try["handlers"],
      StmtNS.Try["handlers"][number] | null,
    ]) => (bare ? [...typed, bare] : typed),
  },
  {
    name: "except_clauses",
    symbols: ["except_bare"],
    postprocess: ([bare]: [StmtNS.Try["handlers"][number]]) => [bare],
  },
  {
    name: "except_bare",
    symbols: [{ literal: "except" }, { literal: ":" }, "block"],
    postprocess: ([, , body]: [moo.Token, moo.Token, StmtNS.Stmt[]]) => ({
      type: null,
      name: null,
      body,
    }),
  },
  {
    name: "except_clause",
    symbols: [{ literal: "except" }, "expression", { literal: ":" }, "block"],
    postprocess: ([, type, , body]: [moo.Token, ExprNS.Expr, moo.Token, StmtNS.Stmt[]]) => ({
      type,
      name: null,
      body,
    }),
  },
  {
    name: "except_clause",
    symbols: [
      { literal: "except" },
      "expression",
      { literal: "as" },
      { type: "name" },
      { literal: ":" },
      "block",
    ],
    postprocess: ([, type, , name, , body]: [
      moo.Token,
      ExprNS.Expr,
      moo.Token,
      moo.Token,
      moo.Token,
      StmtNS.Stmt[],
    ]) => ({ type, name: toAstToken(name), body }),
  },
  { name: "statementWith$ebnf$1", symbols: [] },
  { name: "statementWith$ebnf$1$subexpression$1", symbols: [{ literal: "," }, "with_item"] },
  {
    name: "statementWith$ebnf$1",
    symbols: ["statementWith$ebnf$1", "statementWith$ebnf$1$subexpression$1"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  {
    name: "statementWith",
    symbols: [{ literal: "with" }, "with_item", "statementWith$ebnf$1", { literal: ":" }, "block"],
    postprocess: ([kw, first, rest, , body]: [
      moo.Token,
      StmtNS.With["items"][number],
      [moo.Token, StmtNS.With["items"][number]][],
      moo.Token,
      StmtNS.Stmt[],
    ]) =>
      new StmtNS.With(
        toAstToken(kw),
        body[body.length - 1].endToken,
        [first, ...rest.map(r => r[1])],
        body,
      ),
  },
  {
    name: "with_item",
    symbols: ["expression"],
    postprocess: ([e]: [ExprNS.Expr]) => ({ context: e, target: null }),
  },
  {
    name: "with_item",
    symbols: ["expression", { literal: "as" }, "target"],
    postprocess: ([e, , t]: [ExprNS.Expr, moo.Token, ExprNS.Expr]) => ({ context: e, target: t }),
  },
  { name: "statementDecorated$ebnf$1", symbols: ["decorator"] },
  {
    name: "statementDecorated$ebnf$1",
    symbols: ["statementDecorated$ebnf$1", "decorator"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  { name: "statementDecorated$subexpression$1", symbols: ["statementDef"] },
  { name: "statementDecorated$subexpression$1", symbols: ["statementClass"] },
  {
    name: "statementDecorated",
    symbols: ["statementDecorated$ebnf$1", "statementDecorated$subexpression$1"],
    postprocess: ([decorators, [definition]]: [ExprNS.Expr[], [StmtNS.Stmt]]) =>
      new StmtNS.Decorated(decorators[0].startToken, definition.endToken, decorators, definition),
  },
  {
    name: "decorator",
    symbols: [{ literal: "@" }, "expression", { type: "newline" }],
    postprocess: ([, e]: [moo.Token, ExprNS.Expr, moo.Token]) => e,
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
  { name: "blockInline", symbols: ["statementTupleAssign"], postprocess: id },
  { name: "blockInline", symbols: ["statementRaise"], postprocess: id },
  { name: "blockInline", symbols: ["statementAttributeAssign"], postprocess: id },
  { name: "blockInline", symbols: ["statementAugAssign"], postprocess: id },
  { name: "blockInline", symbols: ["statementDel"], postprocess: id },
  { name: "blockInline", symbols: ["statementImport"], postprocess: id },
  { name: "blockInline", symbols: ["statementReturn"], postprocess: id },
  { name: "blockInline", symbols: ["statementPass"], postprocess: id },
  { name: "blockInline", symbols: ["statementBreak"], postprocess: id },
  { name: "blockInline", symbols: ["statementContinue"], postprocess: id },
  { name: "blockInline", symbols: ["statementGlobal"], postprocess: id },
  { name: "blockInline", symbols: ["statementNonlocal"], postprocess: id },
  { name: "blockInline", symbols: ["statementAssert"], postprocess: id },
  { name: "blockInline", symbols: ["statementExpr"], postprocess: id },
  { name: "rest_names$ebnf$1$subexpression$1", symbols: [{ type: "comma" }] },
  { name: "rest_names$ebnf$1", symbols: ["rest_names$ebnf$1$subexpression$1"], postprocess: id },
  { name: "rest_names$ebnf$1", symbols: [], postprocess: () => null },
  {
    name: "rest_names",
    symbols: ["plain_params", "rest_names$ebnf$1"],
    postprocess: ([ps, comma]: [FunctionParam[], moo.Token | null]) => withTrailingComma(ps, comma),
  },
  { name: "rest_names$ebnf$2$subexpression$1", symbols: [{ type: "comma" }] },
  { name: "rest_names$ebnf$2", symbols: ["rest_names$ebnf$2$subexpression$1"], postprocess: id },
  { name: "rest_names$ebnf$2", symbols: [], postprocess: () => null },
  {
    name: "rest_names",
    symbols: ["plain_params", { literal: "," }, "kw_param", "rest_names$ebnf$2"],
    postprocess: ([ps, , kw, comma]: [
      FunctionParam[],
      moo.Token,
      FunctionParam,
      moo.Token | null,
    ]) => withTrailingComma([...ps, kw], comma),
  },
  { name: "rest_names$ebnf$3$subexpression$1", symbols: [{ type: "comma" }] },
  { name: "rest_names$ebnf$3", symbols: ["rest_names$ebnf$3$subexpression$1"], postprocess: id },
  { name: "rest_names$ebnf$3", symbols: [], postprocess: () => null },
  {
    name: "rest_names",
    symbols: ["kw_param", "rest_names$ebnf$3"],
    postprocess: ([kw, comma]: [FunctionParam, moo.Token | null]) => withTrailingComma([kw], comma),
  },
  { name: "plain_params", symbols: ["param"], postprocess: ([p]: [FunctionParam]) => [p] },
  {
    name: "plain_params",
    symbols: ["plain_params", { literal: "," }, "param"],
    postprocess: ([params, , p]: [FunctionParam[], moo.Token, FunctionParam]) => [...params, p],
  },
  {
    name: "kw_param",
    symbols: [{ literal: "**" }, { type: "name" }],
    postprocess: ([, t]: [moo.Token, moo.Token]) => toFunctionParam(t, false, undefined, true),
  },
  {
    name: "param",
    symbols: [{ type: "name" }],
    postprocess: ([t]: [moo.Token]) => toFunctionParam(t, false),
  },
  {
    name: "param",
    symbols: [{ type: "name" }, { literal: "=" }, "expression"],
    postprocess: ([t, , d]: [moo.Token, moo.Token, ExprNS.Expr]) => toFunctionParam(t, false, d),
  },
  {
    name: "param",
    symbols: [{ literal: "*" }, { type: "name" }],
    postprocess: ([, t]: [moo.Token, moo.Token]) => toFunctionParam(t, true),
  },
  { name: "params", symbols: [{ literal: "(" }, { literal: ")" }], postprocess: drop },
  {
    name: "params",
    symbols: [{ literal: "(" }, "rest_names", { literal: ")" }],
    postprocess: ([, ps]: [moo.Token, FunctionParam[], moo.Token]) => checkParameters(ps),
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
    symbols: ["expressionBitOr", "expressionCmpOp", "expressionBitOr"],
    postprocess: astCompare,
  },
  { name: "expressionCmp$ebnf$1$subexpression$1", symbols: ["expressionCmpOp", "expressionBitOr"] },
  { name: "expressionCmp$ebnf$1", symbols: ["expressionCmp$ebnf$1$subexpression$1"] },
  { name: "expressionCmp$ebnf$1$subexpression$2", symbols: ["expressionCmpOp", "expressionBitOr"] },
  {
    name: "expressionCmp$ebnf$1",
    symbols: ["expressionCmp$ebnf$1", "expressionCmp$ebnf$1$subexpression$2"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  {
    name: "expressionCmp",
    symbols: ["expressionBitOr", "expressionCmpOp", "expressionBitOr", "expressionCmp$ebnf$1"],
    postprocess: ([left, op, right, rest]: [
      ExprNS.Expr,
      Token,
      ExprNS.Expr,
      [Token, ExprNS.Expr][],
    ]) => {
      const comparators = [right, ...rest.map(r => r[1])];
      return new ExprNS.CompareChain(
        left.startToken,
        comparators[comparators.length - 1].endToken,
        left,
        [op, ...rest.map(r => r[0])],
        comparators,
      );
    },
  },
  { name: "expressionCmp", symbols: ["expressionBitOr"], postprocess: id },
  {
    name: "expressionBitOr",
    symbols: ["expressionBitOr", { type: "vbar" }, "expressionBitXor"],
    postprocess: astBinaryTok,
  },
  { name: "expressionBitOr", symbols: ["expressionBitXor"], postprocess: id },
  {
    name: "expressionBitXor",
    symbols: ["expressionBitXor", { type: "circumflex" }, "expressionBitAnd"],
    postprocess: astBinaryTok,
  },
  { name: "expressionBitXor", symbols: ["expressionBitAnd"], postprocess: id },
  {
    name: "expressionBitAnd",
    symbols: ["expressionBitAnd", { type: "amper" }, "expressionShift"],
    postprocess: astBinaryTok,
  },
  { name: "expressionBitAnd", symbols: ["expressionShift"], postprocess: id },
  {
    name: "expressionShift",
    symbols: ["expressionShift", "expressionShiftOp", "expressionAdd"],
    postprocess: astBinary,
  },
  { name: "expressionShift", symbols: ["expressionAdd"], postprocess: id },
  { name: "expressionShiftOp", symbols: [{ type: "leftshift" }], postprocess: tok },
  { name: "expressionShiftOp", symbols: [{ type: "rightshift" }], postprocess: tok },
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
      tok.type = TokenType.NOTIN;
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
      tok.type = TokenType.ISNOT;
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
    symbols: [{ type: "tilde" }, "expressionUnary"],
    postprocess: astUnary,
  },
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
    symbols: ["expressionPost", { type: "lsqb" }, "subscript_index", { type: "rsqb" }],
    postprocess: ([obj, , idx, rsqb]: [ExprNS.Expr, moo.Token, ExprNS.Expr, moo.Token]) =>
      new ExprNS.Subscript(obj.startToken, toAstToken(rsqb), obj, idx),
  },
  {
    name: "expressionPost",
    symbols: ["expressionPost", { literal: "(" }, "spread_expressions", { literal: ")" }],
    postprocess: ([callee, , args, rparen]: [ExprNS.Expr, moo.Token, ExprNS.Expr[], moo.Token]) =>
      new ExprNS.Call(callee.startToken, toAstToken(rparen), callee, checkArguments(args)),
  },
  { name: "expressionPost$ebnf$1", symbols: ["comp_for"] },
  {
    name: "expressionPost$ebnf$1",
    symbols: ["expressionPost$ebnf$1", "comp_for"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  {
    name: "expressionPost",
    symbols: [
      "expressionPost",
      { literal: "(" },
      "expression",
      "expressionPost$ebnf$1",
      { literal: ")" },
    ],
    postprocess: ([callee, , element, clauses, rparen]: [
      ExprNS.Expr,
      moo.Token,
      ExprNS.Expr,
      Clause[],
      moo.Token,
    ]) =>
      new ExprNS.Call(callee.startToken, toAstToken(rparen), callee, [
        new ExprNS.Comprehension(
          element.startToken,
          clauses[clauses.length - 1].end,
          "generator",
          element,
          null,
          generators(clauses),
        ),
      ]),
  },
  {
    name: "expressionPost",
    symbols: ["expressionPost", { literal: "." }, { type: "name" }],
    postprocess: ([obj, , name]: [ExprNS.Expr, moo.Token, moo.Token]) =>
      new ExprNS.Attribute(obj.startToken, toAstToken(name), obj, toAstToken(name)),
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
    postprocess: ([lparen, e, rparen]: [moo.Token, ExprNS.Expr, moo.Token]) =>
      new ExprNS.Grouping(toAstToken(lparen), toAstToken(rparen), e),
  },
  {
    name: "atom",
    symbols: [{ literal: "(" }, "yield_expr", { literal: ")" }],
    postprocess: ([lparen, e, rparen]: [moo.Token, ExprNS.Expr, moo.Token]) =>
      new ExprNS.Grouping(toAstToken(lparen), toAstToken(rparen), e),
  },
  { name: "atom$ebnf$1", symbols: ["comp_for"] },
  {
    name: "atom$ebnf$1",
    symbols: ["atom$ebnf$1", "comp_for"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  {
    name: "atom",
    symbols: [{ literal: "(" }, "expression", "atom$ebnf$1", { literal: ")" }],
    postprocess: ([l, element, clauses, r]: [moo.Token, ExprNS.Expr, Clause[], moo.Token]) =>
      new ExprNS.Comprehension(
        toAstToken(l),
        toAstToken(r),
        "generator",
        element,
        null,
        generators(clauses),
      ),
  },
  {
    name: "atom",
    symbols: [{ literal: "(" }, { literal: ")" }],
    postprocess: ([l, r]: [moo.Token, moo.Token]) =>
      new ExprNS.Tuple(toAstToken(l), toAstToken(r), []),
  },
  {
    name: "atom",
    symbols: [{ literal: "(" }, "tuple_elements", { literal: ")" }],
    postprocess: ([l, elems, r]: [moo.Token, ExprNS.Expr[], moo.Token]) =>
      new ExprNS.Tuple(toAstToken(l), toAstToken(r), elems),
  },
  {
    name: "atom",
    symbols: [{ type: "lbrace" }, { type: "rbrace" }],
    postprocess: ([l, r]: [moo.Token, moo.Token]) =>
      new ExprNS.Dict(toAstToken(l), toAstToken(r), [], []),
  },
  {
    name: "atom",
    symbols: [{ type: "lbrace" }, "dict_items", { type: "rbrace" }],
    postprocess: ([l, items, r]: [moo.Token, [ExprNS.Expr | null, ExprNS.Expr][], moo.Token]) =>
      new ExprNS.Dict(
        toAstToken(l),
        toAstToken(r),
        items.map(i => i[0]),
        items.map(i => i[1]),
      ),
  },
  {
    name: "atom",
    symbols: [{ type: "lbrace" }, "set_items", { type: "rbrace" }],
    postprocess: ([l, elems, r]: [moo.Token, ExprNS.Expr[], moo.Token]) =>
      new ExprNS.Set(toAstToken(l), toAstToken(r), elems),
  },
  { name: "atom$ebnf$2", symbols: ["comp_for"] },
  {
    name: "atom$ebnf$2",
    symbols: ["atom$ebnf$2", "comp_for"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  {
    name: "atom",
    symbols: [{ type: "lbrace" }, "expression", "atom$ebnf$2", { type: "rbrace" }],
    postprocess: ([l, element, clauses, r]: [moo.Token, ExprNS.Expr, Clause[], moo.Token]) =>
      new ExprNS.Comprehension(
        toAstToken(l),
        toAstToken(r),
        "set",
        element,
        null,
        generators(clauses),
      ),
  },
  { name: "atom$ebnf$3", symbols: ["comp_for"] },
  {
    name: "atom$ebnf$3",
    symbols: ["atom$ebnf$3", "comp_for"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  {
    name: "atom",
    symbols: [
      { type: "lbrace" },
      "expression",
      { literal: ":" },
      "expression",
      "atom$ebnf$3",
      { type: "rbrace" },
    ],
    postprocess: ([l, key, , value, clauses, r]: [
      moo.Token,
      ExprNS.Expr,
      moo.Token,
      ExprNS.Expr,
      Clause[],
      moo.Token,
    ]) =>
      new ExprNS.Comprehension(
        toAstToken(l),
        toAstToken(r),
        "dict",
        key,
        value,
        generators(clauses),
      ),
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
  { name: "atom$ebnf$4", symbols: ["comp_for"] },
  {
    name: "atom$ebnf$4",
    symbols: ["atom$ebnf$4", "comp_for"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  {
    name: "atom",
    symbols: [{ type: "lsqb" }, "expression", "atom$ebnf$4", { type: "rsqb" }],
    postprocess: ([l, element, clauses, r]: [moo.Token, ExprNS.Expr, Clause[], moo.Token]) =>
      new ExprNS.Comprehension(
        toAstToken(l),
        toAstToken(r),
        "list",
        element,
        null,
        generators(clauses),
      ),
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
    symbols: [{ literal: "lambda" }, "rest_names", { literal: ":" }, "expression"],
    postprocess: ([kw, params, , body]: [moo.Token, FunctionParam[], moo.Token, ExprNS.Expr]) =>
      new ExprNS.Lambda(toAstToken(kw), body.endToken, checkParameters(params), body),
  },
  {
    name: "lambda_expr",
    symbols: [{ literal: "lambda" }, "rest_names", { type: "doublecolon" }, "block"],
    postprocess: ([kw, params, , body]: [moo.Token, FunctionParam[], moo.Token, StmtNS.Stmt[]]) =>
      new ExprNS.MultiLambda(
        toAstToken(kw),
        body[body.length - 1].endToken,
        checkParameters(params),
        body,
        [],
      ),
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
  {
    name: "tuple_elements",
    symbols: ["star_expression", { literal: "," }],
    postprocess: ([e]: [ExprNS.Expr]) => [e],
  },
  { name: "tuple_elements$ebnf$1$subexpression$1", symbols: [{ literal: "," }, "star_expression"] },
  { name: "tuple_elements$ebnf$1", symbols: ["tuple_elements$ebnf$1$subexpression$1"] },
  { name: "tuple_elements$ebnf$1$subexpression$2", symbols: [{ literal: "," }, "star_expression"] },
  {
    name: "tuple_elements$ebnf$1",
    symbols: ["tuple_elements$ebnf$1", "tuple_elements$ebnf$1$subexpression$2"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  { name: "tuple_elements$ebnf$2$subexpression$1", symbols: [{ type: "comma" }] },
  {
    name: "tuple_elements$ebnf$2",
    symbols: ["tuple_elements$ebnf$2$subexpression$1"],
    postprocess: id,
  },
  { name: "tuple_elements$ebnf$2", symbols: [], postprocess: () => null },
  {
    name: "tuple_elements",
    symbols: ["star_expression", "tuple_elements$ebnf$1", "tuple_elements$ebnf$2"],
    postprocess: flatList,
  },
  { name: "expression_list", symbols: ["expression"], postprocess: id },
  {
    name: "expression_list",
    symbols: ["tuple_elements"],
    postprocess: ([elems]: [ExprNS.Expr[]]) =>
      new ExprNS.Tuple(elems[0].startToken, elems[elems.length - 1].endToken, elems),
  },
  { name: "dict_items$ebnf$1", symbols: [] },
  { name: "dict_items$ebnf$1$subexpression$1", symbols: [{ literal: "," }, "dict_item"] },
  {
    name: "dict_items$ebnf$1",
    symbols: ["dict_items$ebnf$1", "dict_items$ebnf$1$subexpression$1"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  { name: "dict_items$ebnf$2$subexpression$1", symbols: [{ type: "comma" }] },
  { name: "dict_items$ebnf$2", symbols: ["dict_items$ebnf$2$subexpression$1"], postprocess: id },
  { name: "dict_items$ebnf$2", symbols: [], postprocess: () => null },
  {
    name: "dict_items",
    symbols: ["dict_item", "dict_items$ebnf$1", "dict_items$ebnf$2"],
    postprocess: flatList,
  },
  {
    name: "dict_item",
    symbols: ["expression", { literal: ":" }, "expression"],
    postprocess: ([k, , v]: [ExprNS.Expr, moo.Token, ExprNS.Expr]) => [k, v],
  },
  {
    name: "dict_item",
    symbols: [{ type: "doublestar" }, "expressionBitOr"],
    postprocess: ([, v]: [moo.Token, ExprNS.Expr]) => [null, v],
  },
  {
    name: "statementTupleAssign",
    symbols: ["tuple_target", { literal: "=" }, "assign_rhs"],
    postprocess: ([t, , v]: [ExprNS.Tuple, moo.Token, ExprNS.Expr]) =>
      new StmtNS.TupleAssign(t.startToken, v.endToken, t, v),
  },
  { name: "tuple_target", symbols: ["target_list"], postprocess: id },
  {
    name: "tuple_target",
    symbols: [{ literal: "(" }, "target_list", { literal: ")" }],
    postprocess: ([l, t, r]: [moo.Token, ExprNS.Tuple, moo.Token]) =>
      new ExprNS.Tuple(toAstToken(l), toAstToken(r), t.elements),
  },
  {
    name: "target_list",
    symbols: ["target", { literal: "," }],
    postprocess: ([t]: [ExprNS.Expr]) => new ExprNS.Tuple(t.startToken, t.endToken, [t]),
  },
  { name: "target_list$ebnf$1$subexpression$1", symbols: [{ literal: "," }, "target"] },
  { name: "target_list$ebnf$1", symbols: ["target_list$ebnf$1$subexpression$1"] },
  { name: "target_list$ebnf$1$subexpression$2", symbols: [{ literal: "," }, "target"] },
  {
    name: "target_list$ebnf$1",
    symbols: ["target_list$ebnf$1", "target_list$ebnf$1$subexpression$2"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  { name: "target_list$ebnf$2$subexpression$1", symbols: [{ type: "comma" }] },
  { name: "target_list$ebnf$2", symbols: ["target_list$ebnf$2$subexpression$1"], postprocess: id },
  { name: "target_list$ebnf$2", symbols: [], postprocess: () => null },
  {
    name: "target_list",
    symbols: ["target", "target_list$ebnf$1", "target_list$ebnf$2"],
    postprocess: ([first, rest]: [ExprNS.Expr, [unknown, ExprNS.Expr][]]) => {
      const elems = flatList([first, rest]);
      return new ExprNS.Tuple(elems[0].startToken, elems[elems.length - 1].endToken, elems);
    },
  },
  { name: "target_list$ebnf$3$subexpression$1", symbols: ["target", { literal: "," }] },
  { name: "target_list$ebnf$3", symbols: ["target_list$ebnf$3$subexpression$1"] },
  { name: "target_list$ebnf$3$subexpression$2", symbols: ["target", { literal: "," }] },
  {
    name: "target_list$ebnf$3",
    symbols: ["target_list$ebnf$3", "target_list$ebnf$3$subexpression$2"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  { name: "target_list$ebnf$4", symbols: [] },
  { name: "target_list$ebnf$4$subexpression$1", symbols: [{ literal: "," }, "target"] },
  {
    name: "target_list$ebnf$4",
    symbols: ["target_list$ebnf$4", "target_list$ebnf$4$subexpression$1"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  { name: "target_list$ebnf$5$subexpression$1", symbols: [{ type: "comma" }] },
  { name: "target_list$ebnf$5", symbols: ["target_list$ebnf$5$subexpression$1"], postprocess: id },
  { name: "target_list$ebnf$5", symbols: [], postprocess: () => null },
  {
    name: "target_list",
    symbols: ["target_list$ebnf$3", "star_target", "target_list$ebnf$4", "target_list$ebnf$5"],
    postprocess: ([before, star, after]: [
      [ExprNS.Expr, moo.Token][],
      ExprNS.Expr,
      [unknown, ExprNS.Expr][],
    ]) => tupleOf([...before.map(b => b[0]), star, ...after.map(a => a[1])]),
  },
  { name: "target_list$ebnf$6$subexpression$1", symbols: [{ literal: "," }, "target"] },
  { name: "target_list$ebnf$6", symbols: ["target_list$ebnf$6$subexpression$1"] },
  { name: "target_list$ebnf$6$subexpression$2", symbols: [{ literal: "," }, "target"] },
  {
    name: "target_list$ebnf$6",
    symbols: ["target_list$ebnf$6", "target_list$ebnf$6$subexpression$2"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  { name: "target_list$ebnf$7$subexpression$1", symbols: [{ type: "comma" }] },
  { name: "target_list$ebnf$7", symbols: ["target_list$ebnf$7$subexpression$1"], postprocess: id },
  { name: "target_list$ebnf$7", symbols: [], postprocess: () => null },
  {
    name: "target_list",
    symbols: ["star_target", "target_list$ebnf$6", "target_list$ebnf$7"],
    postprocess: ([star, after]: [ExprNS.Expr, [unknown, ExprNS.Expr][]]) =>
      tupleOf([star, ...after.map(a => a[1])]),
  },
  {
    name: "target_list",
    symbols: ["star_target", { literal: "," }],
    postprocess: ([star]: [ExprNS.Expr]) => tupleOf([star]),
  },
  {
    name: "star_target",
    symbols: [{ literal: "*" }, "target"],
    postprocess: ([star, t]: [moo.Token, ExprNS.Expr]) =>
      new ExprNS.Starred(toAstToken(star), t.endToken, t),
  },
  { name: "simple_target", symbols: [{ type: "name" }], postprocess: astVariable },
  {
    name: "simple_target",
    symbols: ["expressionPost", { type: "lsqb" }, "subscript_index", { type: "rsqb" }],
    postprocess: ([obj, , idx, rsqb]: [ExprNS.Expr, moo.Token, ExprNS.Expr, moo.Token]) =>
      new ExprNS.Subscript(obj.startToken, toAstToken(rsqb), obj, idx),
  },
  {
    name: "simple_target",
    symbols: ["expressionPost", { literal: "." }, { type: "name" }],
    postprocess: ([obj, , name]: [ExprNS.Expr, moo.Token, moo.Token]) =>
      new ExprNS.Attribute(obj.startToken, toAstToken(name), obj, toAstToken(name)),
  },
  { name: "target", symbols: ["simple_target"], postprocess: id },
  {
    name: "target",
    symbols: [{ literal: "(" }, "target_list", { literal: ")" }],
    postprocess: ([, t]: [moo.Token, ExprNS.Tuple, moo.Token]) => t,
  },
  {
    name: "statementAttributeAssign",
    symbols: ["expressionPost", { literal: "." }, { type: "name" }, { literal: "=" }, "assign_rhs"],
    postprocess: ([obj, , name, , v]: [
      ExprNS.Expr,
      moo.Token,
      moo.Token,
      moo.Token,
      ExprNS.Expr,
    ]) => {
      const attr = new ExprNS.Attribute(obj.startToken, toAstToken(name), obj, toAstToken(name));
      return new StmtNS.AttributeAssign(obj.startToken, v.endToken, attr, v);
    },
  },
  {
    name: "statementAugAssign",
    symbols: ["augassign_target", "augassign_op", "assign_rhs"],
    postprocess: ([t, op, v]: [ExprNS.Expr, Token, ExprNS.Expr]) =>
      new StmtNS.AugAssign(t.startToken, v.endToken, t, op, v),
  },
  { name: "augassign_target", symbols: ["simple_target"], postprocess: id },
  {
    name: "augassign_target",
    symbols: [{ literal: "(" }, "augassign_target", { literal: ")" }],
    postprocess: ([, t]: [moo.Token, ExprNS.Expr, moo.Token]) => t,
  },
  { name: "augassign_op", symbols: [{ type: "pluseq" }], postprocess: tok },
  { name: "augassign_op", symbols: [{ type: "minuseq" }], postprocess: tok },
  { name: "augassign_op", symbols: [{ type: "stareq" }], postprocess: tok },
  { name: "augassign_op", symbols: [{ type: "slasheq" }], postprocess: tok },
  { name: "augassign_op", symbols: [{ type: "doubleslasheq" }], postprocess: tok },
  { name: "augassign_op", symbols: [{ type: "percenteq" }], postprocess: tok },
  { name: "augassign_op", symbols: [{ type: "doublestareq" }], postprocess: tok },
  { name: "augassign_op", symbols: [{ type: "ampereq" }], postprocess: tok },
  { name: "augassign_op", symbols: [{ type: "vbareq" }], postprocess: tok },
  { name: "augassign_op", symbols: [{ type: "circumflexeq" }], postprocess: tok },
  { name: "augassign_op", symbols: [{ type: "leftshifteq" }], postprocess: tok },
  { name: "augassign_op", symbols: [{ type: "rightshifteq" }], postprocess: tok },
  { name: "augassign_op", symbols: [{ type: "ateq" }], postprocess: tok },
  {
    name: "statementForUnpack",
    symbols: [
      { literal: "for" },
      "tuple_target",
      { literal: "in" },
      "expression",
      { literal: ":" },
      "block",
    ],
    postprocess: ([kw, target, , iter, , body]: [
      moo.Token,
      ExprNS.Tuple,
      moo.Token,
      ExprNS.Expr,
      moo.Token,
      StmtNS.Stmt[],
    ]) => new StmtNS.ForUnpack(toAstToken(kw), body[body.length - 1].endToken, target, iter, body),
  },
  { name: "expressions$ebnf$1", symbols: [] },
  { name: "expressions$ebnf$1$subexpression$1", symbols: [{ literal: "," }, "star_expression"] },
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
    symbols: ["star_expression", "expressions$ebnf$1", "expressions$ebnf$2"],
    postprocess: flatList,
  },
  { name: "star_expression", symbols: ["expression"], postprocess: id },
  {
    name: "star_expression",
    symbols: [{ type: "star" }, "expressionBitOr"],
    postprocess: ([star, e]: [moo.Token, ExprNS.Expr]) =>
      new ExprNS.Starred(toAstToken(star), e.endToken, e),
  },
  { name: "set_items$ebnf$1", symbols: [] },
  { name: "set_items$ebnf$1$subexpression$1", symbols: [{ literal: "," }, "star_expression"] },
  {
    name: "set_items$ebnf$1",
    symbols: ["set_items$ebnf$1", "set_items$ebnf$1$subexpression$1"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  { name: "set_items$ebnf$2$subexpression$1", symbols: [{ type: "comma" }] },
  { name: "set_items$ebnf$2", symbols: ["set_items$ebnf$2$subexpression$1"], postprocess: id },
  { name: "set_items$ebnf$2", symbols: [], postprocess: () => null },
  {
    name: "set_items",
    symbols: ["star_expression", "set_items$ebnf$1", "set_items$ebnf$2"],
    postprocess: flatList,
  },
  { name: "comp_for$ebnf$1", symbols: [] },
  {
    name: "comp_for$ebnf$1",
    symbols: ["comp_for$ebnf$1", "comp_if"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  {
    name: "comp_for",
    symbols: [
      { literal: "for" },
      "comp_target",
      { literal: "in" },
      "expressionOr",
      "comp_for$ebnf$1",
    ],
    postprocess: ([kw, target, , iter, conditions]: [
      moo.Token,
      ExprNS.Expr,
      moo.Token,
      ExprNS.Expr,
      ExprNS.Expr[],
    ]) => ({
      target,
      iter,
      conditions,
      end: conditions.length > 0 ? conditions[conditions.length - 1].endToken : iter.endToken,
    }),
  },
  {
    name: "comp_if",
    symbols: [{ literal: "if" }, "expressionOr"],
    postprocess: ([, c]: [moo.Token, ExprNS.Expr]) => c,
  },
  { name: "comp_target", symbols: ["target_list"], postprocess: id },
  { name: "comp_target", symbols: ["target"], postprocess: id },
  { name: "subscript_index", symbols: ["expression"], postprocess: id },
  { name: "subscript_index", symbols: ["slice_expr"], postprocess: id },
  { name: "slice_expr$ebnf$1", symbols: ["expression"], postprocess: id },
  { name: "slice_expr$ebnf$1", symbols: [], postprocess: () => null },
  { name: "slice_expr$ebnf$2", symbols: ["expression"], postprocess: id },
  { name: "slice_expr$ebnf$2", symbols: [], postprocess: () => null },
  { name: "slice_expr$ebnf$3$subexpression$1$ebnf$1", symbols: ["expression"], postprocess: id },
  { name: "slice_expr$ebnf$3$subexpression$1$ebnf$1", symbols: [], postprocess: () => null },
  {
    name: "slice_expr$ebnf$3$subexpression$1",
    symbols: [{ literal: ":" }, "slice_expr$ebnf$3$subexpression$1$ebnf$1"],
  },
  { name: "slice_expr$ebnf$3", symbols: ["slice_expr$ebnf$3$subexpression$1"], postprocess: id },
  { name: "slice_expr$ebnf$3", symbols: [], postprocess: () => null },
  {
    name: "slice_expr",
    symbols: ["slice_expr$ebnf$1", { literal: ":" }, "slice_expr$ebnf$2", "slice_expr$ebnf$3"],
    postprocess: ([lower, colon, upper, rest]: [
      ExprNS.Expr | null,
      moo.Token,
      ExprNS.Expr | null,
      [moo.Token, ExprNS.Expr | null] | null,
    ]) => {
      const step = rest ? rest[1] : null;
      const first = lower ? lower.startToken : toAstToken(colon);
      const last = step
        ? step.endToken
        : upper
          ? upper.endToken
          : toAstToken(rest ? rest[0] : colon);
      return new ExprNS.Slice(first, last, lower, upper, step);
    },
  },
  { name: "slice_expr$ebnf$4", symbols: ["expression"], postprocess: id },
  { name: "slice_expr$ebnf$4", symbols: [], postprocess: () => null },
  { name: "slice_expr$ebnf$5", symbols: ["expression"], postprocess: id },
  { name: "slice_expr$ebnf$5", symbols: [], postprocess: () => null },
  {
    name: "slice_expr",
    symbols: ["slice_expr$ebnf$4", { type: "doublecolon" }, "slice_expr$ebnf$5"],
    postprocess: ([lower, colon, step]: [ExprNS.Expr | null, moo.Token, ExprNS.Expr | null]) =>
      new ExprNS.Slice(
        lower ? lower.startToken : toAstToken(colon),
        step ? step.endToken : toAstToken(colon),
        lower,
        null,
        step,
      ),
  },
  {
    name: "yield_expr",
    symbols: [{ literal: "yield" }],
    postprocess: ([t]: [moo.Token]) => {
      const k = toAstToken(t);
      return new ExprNS.Yield(k, k, null, false);
    },
  },
  {
    name: "yield_expr",
    symbols: [{ literal: "yield" }, "expression_list"],
    postprocess: ([kw, v]: [moo.Token, ExprNS.Expr]) =>
      new ExprNS.Yield(toAstToken(kw), v.endToken, v, false),
  },
  {
    name: "yield_expr",
    symbols: [{ literal: "yield" }, { literal: "from" }, "expression"],
    postprocess: ([kw, , v]: [moo.Token, moo.Token, ExprNS.Expr]) =>
      new ExprNS.Yield(toAstToken(kw), v.endToken, v, true),
  },
  { name: "assign_rhs", symbols: ["expression_list"], postprocess: id },
  { name: "assign_rhs", symbols: ["yield_expr"], postprocess: id },
  { name: "spread_expressions$ebnf$1", symbols: [] },
  {
    name: "spread_expressions$ebnf$1$subexpression$1",
    symbols: [{ literal: "," }, "spread_expression"],
  },
  {
    name: "spread_expressions$ebnf$1",
    symbols: ["spread_expressions$ebnf$1", "spread_expressions$ebnf$1$subexpression$1"],
    postprocess: function arrpush<T>(d: [T[], T]) {
      return d[0].concat([d[1]]);
    },
  },
  { name: "spread_expressions$ebnf$2$subexpression$1", symbols: [{ type: "comma" }] },
  {
    name: "spread_expressions$ebnf$2",
    symbols: ["spread_expressions$ebnf$2$subexpression$1"],
    postprocess: id,
  },
  { name: "spread_expressions$ebnf$2", symbols: [], postprocess: () => null },
  {
    name: "spread_expressions",
    symbols: ["spread_expression", "spread_expressions$ebnf$1", "spread_expressions$ebnf$2"],
    postprocess: flatList,
  },
  { name: "spread_expression", symbols: ["expression"], postprocess: id },
  {
    name: "spread_expression",
    symbols: [{ type: "name" }, { literal: "=" }, "expression"],
    postprocess: ([n, , v]: [moo.Token, moo.Token, ExprNS.Expr]) => {
      const k = toAstToken(n);
      return new ExprNS.Keyword(k, v.endToken, k, v);
    },
  },
  {
    name: "spread_expression",
    symbols: [{ type: "star" }, "expression"],
    postprocess: ([star, expr]: [moo.Token, ExprNS.Expr]) =>
      new ExprNS.Starred(toAstToken(star), expr.endToken, expr),
  },
  {
    name: "spread_expression",
    symbols: [{ type: "doublestar" }, "expression"],
    postprocess: ([star, expr]: [moo.Token, ExprNS.Expr]) =>
      new ExprNS.DoubleStarred(toAstToken(star), expr.endToken, expr),
  },
  { name: "stringLit", symbols: [{ type: "string_triple_double" }], postprocess: astString },
  { name: "stringLit", symbols: [{ type: "string_triple_single" }], postprocess: astString },
  { name: "stringLit", symbols: [{ type: "string_double" }], postprocess: astString },
  { name: "stringLit", symbols: [{ type: "string_single" }], postprocess: astString },
];
const ParserStart = "program";
export default { Lexer, ParserRules, ParserStart };
