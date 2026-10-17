# Nearley grammar for Python subset (Source Academy)
# Produces class-based AST nodes
#
# Naming convention:
#   Spec-traceable rules:     spec name (hyphens → underscores)
#                              (program, statement, block, expression, import_stmt, ...)
#   Statement variants:       statement + AST node name
#                              (statementAssign, statementReturn, statementDef, ...)
#   Precedence cascade:       expression + level suffix
#                              (expressionOr, expressionAnd, expressionNot, expressionCmp,
#                               expressionAdd, expressionMul, expressionUnary, expressionPow,
#                               expressionPost)
#   Operator sub-rules:       level + Op (expressionAddOp, expressionMulOp, expressionCmpOp)

@preprocessor esmodule


@{%
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
      case 'n': return '\n';
      case 't': return '\t';
      case 'r': return '\r';
      case '\\': return '\\';
      case "'": return "'";
      case '"': return '"';
      case '/': return '/';
      case 'b': return '\b';
      case 'f': return '\f';
      case 'a': return '\x07';
      case 'v': return '\x0B';
      case '0': return '\0';
      case 'x': return String.fromCharCode(parseInt(ch.slice(1), 16));
      case 'u': return String.fromCharCode(parseInt(ch.slice(1), 16));
      default: return '\\' + ch; // unrecognized escapes kept literally
    }
  });
}

// ── Leaf AST constructors (token → node) ────────────────────────────────
const astVariable   = ([t]: [moo.Token]) => { const k = toAstToken(t); return new ExprNS.Variable(k, k, k); };
const astBigInt     = ([t]: [moo.Token]) => { const k = toAstToken(t); return new ExprNS.BigIntLiteral(k, k, t.value); };
const astComplex    = ([t]: [moo.Token]) => { const k = toAstToken(t); return new ExprNS.Complex(k, k, t.value); };
const astNone       = ([t]: [moo.Token]) => { const k = toAstToken(t); return new ExprNS.None(k, k); };
const astString     = ([t]: [moo.Token]) => { const k = toAstToken(t); return new ExprNS.Literal(k, k, stripQuotes(t.value)); };
const astTrue       = ([t]: [moo.Token]) => { const k = toAstToken(t); return new ExprNS.Literal(k, k, true); };
const astFalse      = ([t]: [moo.Token]) => { const k = toAstToken(t); return new ExprNS.Literal(k, k, false); };

// ── Operator AST constructors (children → node) ────────────────────────
const astBinary     = ([l, op, r]: [ExprNS.Expr, Token, ExprNS.Expr]) => new ExprNS.Binary(l.startToken, r.endToken, l, op, r);
const astBinaryTok  = ([l, op, r]: [ExprNS.Expr, moo.Token, ExprNS.Expr]) => new ExprNS.Binary(l.startToken, r.endToken, l, toAstToken(op), r);
const astBoolOp     = ([l, op, r]: [ExprNS.Expr, moo.Token, ExprNS.Expr]) => new ExprNS.BoolOp(l.startToken, r.endToken, l, toAstToken(op), r);
const astUnary      = ([op, arg]: [moo.Token, ExprNS.Expr]) => new ExprNS.Unary(toAstToken(op), arg.endToken, toAstToken(op), arg);
const astCompare    = ([l, op, r]: [ExprNS.Expr, Token, ExprNS.Expr]) => new ExprNS.Compare(l.startToken, r.endToken, l, op, r);

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
      if (unpacked) throw syntaxError("iterable argument unpacking follows keyword argument unpacking", arg.startToken);
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
const tok           = ([t]: [moo.Token]) => toAstToken(t);
const tupleOf       = (elems: ExprNS.Expr[]) => new ExprNS.Tuple(elems[0].startToken, elems[elems.length - 1].endToken, elems);
const flatList      = <T>([first, rest]: [T, [unknown, T][]]): T[] => [first, ...rest.map(d => d[1])];
const tokList       = ([first, rest]: [moo.Token, [unknown, moo.Token][]]) => [toAstToken(first), ...rest.map(d => toAstToken(d[1]))];
%}

@lexer pythonLexer

# ============================================================================
# program ::= import-stmt ... block              [python_1_bnf.tex line 18]
#
# Enforces: imports come before statements.  An import after a statement
# is a parse error. A leading run of blank lines/comments before an import
# is not a statement and must not count as one (py-slang#393) — the lexer
# already collapses any blank lines/comments between two real tokens into
# a single `newline` token (see lexer.ts's processTokens), so each import
# only ever needs at most one such leading token. The optional leading
# `(%newline):*` is tied to (i.e. inside the same repetition as) its own
# import_stmt, rather than factored out as a separate top-level group,
# specifically so a bare leading newline with no import to follow can only
# ever be matched by the trailing `(statement | %newline):*` group — a
# factored-out version is ambiguous about which group consumes it.
# ============================================================================

program -> ((%newline):* import_stmt %newline):* (statement | %newline):*
  {% ([imports, stmts]: [[moo.Token[], StmtNS.FromImport, moo.Token][], ([StmtNS.Stmt] | [moo.Token])[]]) => {
       const importNodes = imports.map(d => d[1]);
       const stmtNodes = stmts.map(d => d[0]).filter(s => 'startToken' in s);
       const filtered = [...importNodes, ...stmtNodes];
       const start = filtered[0]
         ? filtered[0].startToken
         : toAstToken({type:'newline',value:'',line:1,col:1,offset:0});
       const end = filtered.length > 0
         ? filtered[filtered.length-1].endToken
         : start;
       return new StmtNS.FileInput(start, end, filtered, []);
     } %}

# ============================================================================
# import-stmt ::= from dotted-name import import-clause  [python_1_bnf.tex line 19]
# ============================================================================

import_stmt ->
    "from" relative_module "import" import_clause
      {% ([kw, mod,, names]: [moo.Token, { name: Token; level: number }, moo.Token, StmtNS.FromImport["names"]]) => {
           const last = names[names.length-1];
           const endTok = last.alias || last.name;
           return new StmtNS.FromImport(toAstToken(kw), endTok, mod.name, names, mod.level);
         } %}

# relative-module ::= "."... dotted-name   (leading dots address a local file
# relative to the importing file's own directory - one dot per directory
# level, mirroring CPython's relative-import syntax; a bare name with no
# leading dots (level 0) keeps meaning a Source Academy module, as today.)
relative_module -> ("."):* dotted_name
  {% ([dots, name]: [moo.Token[], Token]) => ({ level: dots.length, name }) %}

# dotted-name ::= name ( . name )...                     [python_1_bnf.tex line 20]
dotted_name -> %name ("." %name):*
  {% ([first, rest]: [moo.Token, [moo.Token, moo.Token][]]) => {
       const tok = toAstToken(first);
       for (const [, n] of rest) {
         const right = toAstToken(n);
         tok.lexeme = tok.lexeme + '.' + right.lexeme;
       }
       return tok;
     } %}

# import-clause ::= import-as-names | ( import-as-names ) [python_1_bnf.tex line 21-22]
import_clause ->
    import_as_names  {% id %}
  | "(" import_as_names ")"  {% ([, ns, ]: [moo.Token, StmtNS.FromImport["names"][number], moo.Token]) => ns %}

# import-as-names ::= import-as-name (, import-as-name)... [python_1_bnf.tex line 23]
import_as_names -> import_as_name ("," import_as_name):*
  {% flatList %}

# import-as-name ::= name [ as name ]                     [python_1_bnf.tex line 24]
import_as_name ->
    %name  {% ([t]: [moo.Token]) => ({ name: toAstToken(t), alias: null }) %}
  | %name "as" %name  {% ([t,, a]: [moo.Token, moo.Token, moo.Token]) => ({ name: toAstToken(t), alias: toAstToken(a) }) %}

# ============================================================================
# statement                                      [python_1_bnf.tex lines 25-29]
# ============================================================================

statement ->
    statementAssign %newline                     {% id %}
  | statementAnnAssign %newline                  {% id %}
  | statementSubscriptAssign %newline            {% id %}
  | statementTupleAssign %newline                {% id %}
  | statementRaise %newline                      {% id %}
  | statementAttributeAssign %newline            {% id %}
  | statementAugAssign %newline                  {% id %}
  | statementDel %newline                        {% id %}
  | statementImport %newline                     {% id %}
  | statementReturn %newline                     {% id %}
  | statementPass %newline                       {% id %}
  | statementBreak %newline                      {% id %}
  | statementContinue %newline                   {% id %}
  | statementGlobal %newline                     {% id %}
  | statementNonlocal %newline                   {% id %}
  | statementAssert %newline                     {% id %}
  | statementExpr %newline                       {% id %}
  | if_statement
      {% id %}
  | statementWhile
      {% id %}
  | statementFor
      {% id %}
  | statementDef
      {% id %}
  | statementForUnpack
      {% id %}
  | statementClass
      {% id %}
  | statementTry
      {% id %}
  | statementWith
      {% id %}
  | statementDecorated
      {% id %}

statementAssign -> %name "=" assign_rhs
  {% ([n,, v]: [moo.Token, moo.Token, ExprNS.Expr]) => { const tok = toAstToken(n); return new StmtNS.Assign(tok, v.endToken, new ExprNS.Variable(tok, tok, tok), v); } %}

statementAnnAssign ->
    %name ":" expression "=" expression
      {% ([n,, ann,, v]: [moo.Token, moo.Token, ExprNS.Expr, moo.Token, ExprNS.Expr]) => { const tok = toAstToken(n); return new StmtNS.AnnAssign(tok, v.endToken, new ExprNS.Variable(tok, tok, tok), v, ann); } %}
  | %name ":" expression
      {% ([n,, ann]: [moo.Token, moo.Token, ExprNS.Expr]) => {
           const nameTok = toAstToken(n);
           const dummyVal = new ExprNS.None(ann.endToken, ann.endToken);
           return new StmtNS.AnnAssign(nameTok, ann.endToken, new ExprNS.Variable(nameTok, nameTok, nameTok), dummyVal, ann);
         } %}

statementSubscriptAssign -> expressionPost %lsqb subscript_index %rsqb "=" assign_rhs
  {% function(d: [ExprNS.Expr, moo.Token, ExprNS.Expr, moo.Token, moo.Token, ExprNS.Expr]) {
       const obj = d[0], idx = d[2], rsqb = d[3], val = d[5];
       const sub = new ExprNS.Subscript(obj.startToken, toAstToken(rsqb), obj, idx);
       return new StmtNS.Assign(obj.startToken, val.endToken, sub, val);
     } %}

statementReturn ->
    "return" expression_list
      {% ([kw, expr]: [moo.Token, ExprNS.Expr]) => new StmtNS.Return(toAstToken(kw), expr.endToken, expr) %}
  | "return"
      {% ([t]: [moo.Token]) => { const tok = toAstToken(t); return new StmtNS.Return(tok, tok, null); } %}

statementPass -> "pass"
  {% ([t]: [moo.Token]) => { const tok = toAstToken(t); return new StmtNS.Pass(tok, tok); } %}

statementBreak -> "break"
  {% ([t]: [moo.Token]) => { const tok = toAstToken(t); return new StmtNS.Break(tok, tok); } %}

statementContinue -> "continue"
  {% ([t]: [moo.Token]) => { const tok = toAstToken(t); return new StmtNS.Continue(tok, tok); } %}

statementGlobal -> "global" names
  {% ([kw, ns]: [moo.Token, Token[]]) => new StmtNS.Global(toAstToken(kw), ns[ns.length - 1], ns) %}

statementNonlocal -> "nonlocal" names
  {% ([kw, ns]: [moo.Token, Token[]]) => new StmtNS.NonLocal(toAstToken(kw), ns[ns.length - 1], ns) %}

statementAssert -> "assert" expression ("," expression):?
  {% ([kw, e, msg]: [moo.Token, ExprNS.Expr, [moo.Token, ExprNS.Expr] | null]) =>
       new StmtNS.Assert(toAstToken(kw), (msg ? msg[1] : e).endToken, e, msg ? msg[1] : null) %}

statementExpr -> expression
  {% ([e]: [ExprNS.Expr]) => new StmtNS.SimpleExpr(e.startToken, e.endToken, e) %}
  | yield_expr
  {% ([e]: [ExprNS.Expr]) => new StmtNS.SimpleExpr(e.startToken, e.endToken, e) %}

statementWhile -> "while" expression ":" block
  {% ([kw, test,, body]: [moo.Token, ExprNS.Expr, moo.Token, StmtNS.Stmt[]]) =>
       new StmtNS.While(toAstToken(kw), body[body.length-1].endToken, test, body) %}

statementFor -> "for" %name "in" expression ":" block
  {% ([kw, target,, iter,, body]: [moo.Token, moo.Token, moo.Token, ExprNS.Expr, moo.Token, StmtNS.Stmt[]]) =>
       new StmtNS.For(toAstToken(kw), body[body.length-1].endToken, toAstToken(target), iter, body) %}

# ============================================================================
# Statements of full Python (the sublanguage validators reject them)
# ============================================================================

statementRaise ->
    "raise"
      {% ([t]: [moo.Token]) => { const k = toAstToken(t); return new StmtNS.Raise(k, k, null, null); } %}
  | "raise" expression
      {% ([kw, e]: [moo.Token, ExprNS.Expr]) => new StmtNS.Raise(toAstToken(kw), e.endToken, e, null) %}
  | "raise" expression "from" expression
      {% ([kw, e,, cause]: [moo.Token, ExprNS.Expr, moo.Token, ExprNS.Expr]) =>
           new StmtNS.Raise(toAstToken(kw), cause.endToken, e, cause) %}

statementDel -> "del" del_targets
  {% ([kw, ts]: [moo.Token, ExprNS.Expr[]]) => new StmtNS.Del(toAstToken(kw), ts[ts.length - 1].endToken, ts) %}
del_targets -> target ("," target):* (%comma):?  {% flatList %}

statementImport -> "import" import_names
  {% ([kw, names]: [moo.Token, StmtNS.Import["names"]]) => {
       const last = names[names.length - 1];
       return new StmtNS.Import(toAstToken(kw), last.alias || last.name, names);
     } %}
import_names -> import_name ("," import_name):*  {% flatList %}
import_name ->
    dotted_name  {% ([t]: [Token]) => ({ name: t, alias: null }) %}
  | dotted_name "as" %name  {% ([t,, a]: [Token, moo.Token, moo.Token]) => ({ name: t, alias: toAstToken(a) }) %}

statementClass ->
    "class" %name ":" block
      {% ([kw, name,, body]: [moo.Token, moo.Token, moo.Token, StmtNS.Stmt[]]) =>
           new StmtNS.Class(toAstToken(kw), body[body.length - 1].endToken, toAstToken(name), [], body) %}
  | "class" %name "(" ")" ":" block
      {% ([kw, name,,,, body]: [moo.Token, moo.Token, moo.Token, moo.Token, moo.Token, StmtNS.Stmt[]]) =>
           new StmtNS.Class(toAstToken(kw), body[body.length - 1].endToken, toAstToken(name), [], body) %}
  | "class" %name "(" spread_expressions ")" ":" block
      {% ([kw, name,, bases,,, body]: [moo.Token, moo.Token, moo.Token, ExprNS.Expr[], moo.Token, moo.Token, StmtNS.Stmt[]]) =>
           new StmtNS.Class(toAstToken(kw), body[body.length - 1].endToken, toAstToken(name), checkArguments(bases), body) %}

statementTry ->
    "try" ":" block except_clauses ("else" ":" block):? ("finally" ":" block):?
      {% ([kw,, body, handlers, orElse, fin]: [moo.Token, moo.Token, StmtNS.Stmt[], StmtNS.Try["handlers"], [moo.Token, moo.Token, StmtNS.Stmt[]] | null, [moo.Token, moo.Token, StmtNS.Stmt[]] | null]) => {
           const last = fin ? fin[2] : orElse ? orElse[2] : handlers[handlers.length - 1].body;
           return new StmtNS.Try(toAstToken(kw), last[last.length - 1].endToken, body, handlers,
                                 orElse ? orElse[2] : null, fin ? fin[2] : null);
         } %}
  | "try" ":" block "finally" ":" block
      {% ([kw,, body,,, fin]: [moo.Token, moo.Token, StmtNS.Stmt[], moo.Token, moo.Token, StmtNS.Stmt[]]) =>
           new StmtNS.Try(toAstToken(kw), fin[fin.length - 1].endToken, body, [], null, fin) %}
# The `except` clauses of a `try`: clauses with a type, then at most one bare `except:`, which
# Python requires to be the last one.
except_clauses ->
    except_clause:+ except_bare:?
      {% ([typed, bare]: [StmtNS.Try["handlers"], StmtNS.Try["handlers"][number] | null]) => bare ? [...typed, bare] : typed %}
  | except_bare  {% ([bare]: [StmtNS.Try["handlers"][number]]) => [bare] %}
except_bare ->
    "except" ":" block
      {% ([,, body]: [moo.Token, moo.Token, StmtNS.Stmt[]]) => ({ type: null, name: null, body }) %}
except_clause ->
    "except" expression ":" block
      {% ([, type,, body]: [moo.Token, ExprNS.Expr, moo.Token, StmtNS.Stmt[]]) => ({ type, name: null, body }) %}
  | "except" expression "as" %name ":" block
      {% ([, type,, name,, body]: [moo.Token, ExprNS.Expr, moo.Token, moo.Token, moo.Token, StmtNS.Stmt[]]) =>
           ({ type, name: toAstToken(name), body }) %}

statementWith -> "with" with_item ("," with_item):* ":" block
  {% ([kw, first, rest,, body]: [moo.Token, StmtNS.With["items"][number], [moo.Token, StmtNS.With["items"][number]][], moo.Token, StmtNS.Stmt[]]) =>
       new StmtNS.With(toAstToken(kw), body[body.length - 1].endToken, [first, ...rest.map(r => r[1])], body) %}
with_item ->
    expression  {% ([e]: [ExprNS.Expr]) => ({ context: e, target: null }) %}
  | expression "as" target  {% ([e,, t]: [ExprNS.Expr, moo.Token, ExprNS.Expr]) => ({ context: e, target: t }) %}

statementDecorated -> decorator:+ (statementDef | statementClass)
  {% ([decorators, [definition]]: [ExprNS.Expr[], [StmtNS.Stmt]]) =>
       new StmtNS.Decorated(decorators[0].startToken, definition.endToken, decorators, definition) %}
decorator -> "@" expression %newline  {% ([, e]: [moo.Token, ExprNS.Expr, moo.Token]) => e %}

statementDef -> "def" %name params ":" block
  {% ([kw, name, params,, body]: [moo.Token, moo.Token, FunctionParam[], moo.Token, StmtNS.Stmt[]]) =>
       new StmtNS.FunctionDef(toAstToken(kw), body[body.length-1].endToken,
         toAstToken(name), params, body, []) %}

# ============================================================================
# if-statement with EBNF                         [python_1_bnf.tex lines 31-33]
# ============================================================================

if_statement -> "if" expression ":" block ("elif" expression ":" block):* ("else" ":" block):?
  {% ([kw, test,, body, elifs, elseBlock]: [moo.Token, ExprNS.Expr, moo.Token, StmtNS.Stmt[], [moo.Token, ExprNS.Expr, moo.Token, StmtNS.Stmt[]][], [moo.Token, moo.Token, StmtNS.Stmt[]]]) => {
       let else_ = elseBlock ? elseBlock[2] : null;
       for (let i = elifs.length - 1; i >= 0; i--) {
         const [ekw, etest,, ebody] = elifs[i];
         const endTok = else_ && else_.length > 0 ? else_[else_.length-1].endToken : ebody[ebody.length-1].endToken;
         else_ = [new StmtNS.If(toAstToken(ekw), endTok, etest, ebody, else_)];
       }
       const endTok = (else_ && else_.length > 0) ? else_[else_.length-1].endToken : body[body.length-1].endToken;
       return new StmtNS.If(toAstToken(kw), endTok, test, body, else_);
     } %}

# ============================================================================
# names ::= ...                                  [python_1_bnf.tex line 30]
# ============================================================================

names -> %name ("," %name):*
  {% tokList %}

# ============================================================================
# block ::= statement...                         [python_1_bnf.tex line 34]
# ============================================================================

block ->
    blockInline %newline                         {% list %}
  | %newline %indent (statement | %newline):+ %dedent
      {% ([,, stmts]: [moo.Token, moo.Token, ([StmtNS.Stmt] | [moo.Token])[]]) => stmts.map(d => d[0]).filter(s => s && 'startToken' in s) %}

blockInline ->
    statementAssign       {% id %}
  | statementAnnAssign    {% id %}
  | statementSubscriptAssign {% id %}
  | statementTupleAssign  {% id %}
  | statementRaise        {% id %}
  | statementAttributeAssign {% id %}
  | statementAugAssign    {% id %}
  | statementDel          {% id %}
  | statementImport       {% id %}
  | statementReturn       {% id %}
  | statementPass         {% id %}
  | statementBreak        {% id %}
  | statementContinue     {% id %}
  | statementGlobal       {% id %}
  | statementNonlocal     {% id %}
  | statementAssert       {% id %}
  | statementExpr         {% id %}

# ============================================================================
# rest-names ::= ε | *name | name (, name)... [, *name]  [python_3_bnf.tex line 37-38]
# ============================================================================

# The parameters of a function: `*args` and defaults, then at most one `**kwargs`, which is last.
# (The order of the parameters is checked where a parameter list is complete, after its closing
# parenthesis or before the colon of a lambda: Earley completes rules on prefixes of the input too,
# which a later token may rule out.)
# A trailing comma is allowed, as in Python (the last parameter then has `trailingComma`; the
# sublanguages reject it).
rest_names ->
    plain_params (%comma):?
      {% ([ps, comma]: [FunctionParam[], moo.Token | null]) => withTrailingComma(ps, comma) %}
  | plain_params "," kw_param (%comma):?
      {% ([ps,, kw, comma]: [FunctionParam[], moo.Token, FunctionParam, moo.Token | null]) => withTrailingComma([...ps, kw], comma) %}
  | kw_param (%comma):?
      {% ([kw, comma]: [FunctionParam, moo.Token | null]) => withTrailingComma([kw], comma) %}
plain_params ->
    param
      {% ([p]: [FunctionParam]) => [p] %}
  | plain_params "," param
      {% ([params,, p]: [FunctionParam[], moo.Token, FunctionParam]) => [...params, p] %}
kw_param -> "**" %name
  {% ([, t]: [moo.Token, moo.Token]) => toFunctionParam(t, false, undefined, true) %}

param ->
    %name
      {% ([t]: [moo.Token]) => toFunctionParam(t, false) %}
  | %name "=" expression
      {% ([t,, d]: [moo.Token, moo.Token, ExprNS.Expr]) => toFunctionParam(t, false, d) %}
  | "*" %name
      {% ([, t]: [moo.Token, moo.Token]) => toFunctionParam(t, true) %}

params ->
    "(" ")"                                   {% drop %}
  | "(" rest_names ")"                        {% ([, ps]: [moo.Token, FunctionParam[], moo.Token]) => checkParameters(ps) %}

# ============================================================================
# expression ::= ...                             [python_1_bnf.tex lines 35-46]
# ============================================================================

expression -> expressionOr "if" expressionOr "else" expression {% ([cons, , test,, alt] : [ExprNS.Expr, moo.Token, ExprNS.Expr, moo.Token, ExprNS.Expr]) => new ExprNS.Ternary(cons.startToken, alt.endToken, test, cons, alt) %}
  | expressionOr                                   {% id %}
  | lambda_expr                                {% id %}

# ============================================================================
# Precedence cascade
#   expressionOr > expressionAnd > expressionNot > expressionCmp >
#   expressionAdd > expressionMul > expressionUnary > expressionPow >
#   expressionPost > atom
# ============================================================================

expressionOr ->
    expressionOr "or" expressionAnd              {% astBoolOp %}
  | expressionAnd                                  {% id %}

expressionAnd ->
    expressionAnd "and" expressionNot            {% astBoolOp %}
  | expressionNot                                  {% id %}

expressionNot ->
    "not" expressionNot                          {% astUnary %}
  | expressionCmp                                  {% id %}


# Non-associative: unlike full Python (where x < y < z is sugar for
# x < y and y < z, evaluating y once and short-circuiting before z), this
# grammar treats comparison/membership/identity operators as taking exactly
# two operands. `expressionAdd` (not `expressionCmp`) on both sides means
# `x < y < z` cannot be built at all - it's a syntax error, not a silently
# different parse. See docs/specs/python_precedence.tex.
expressionCmp ->
    expressionBitOr expressionCmpOp expressionBitOr  {% astCompare %}
  | expressionBitOr expressionCmpOp expressionBitOr (expressionCmpOp expressionBitOr):+
      {% ([left, op, right, rest]: [ExprNS.Expr, Token, ExprNS.Expr, [Token, ExprNS.Expr][]]) => {
           const comparators = [right, ...rest.map(r => r[1])];
           return new ExprNS.CompareChain(left.startToken, comparators[comparators.length - 1].endToken,
                                          left, [op, ...rest.map(r => r[0])], comparators);
         } %}
  | expressionBitOr                                  {% id %}

# Bitwise operators (full Python only), between the comparisons and the arithmetic operators
expressionBitOr ->
    expressionBitOr %vbar expressionBitXor       {% astBinaryTok %}
  | expressionBitXor                               {% id %}
expressionBitXor ->
    expressionBitXor %circumflex expressionBitAnd {% astBinaryTok %}
  | expressionBitAnd                               {% id %}
expressionBitAnd ->
    expressionBitAnd %amper expressionShift      {% astBinaryTok %}
  | expressionShift                                {% id %}
expressionShift ->
    expressionShift expressionShiftOp expressionAdd {% astBinary %}
  | expressionAdd                                  {% id %}
expressionShiftOp -> %leftshift {% tok %} | %rightshift {% tok %}

expressionCmpOp ->
    %less             {% tok %}
  | %greater          {% tok %}
  | %doubleequal      {% tok %}
  | %greaterequal     {% tok %}
  | %lessequal        {% tok %}
  | %notequal         {% tok %}
  | "in"              {% tok %}
  | "not" "in"        {% ([t]: [moo.Token]) => { const tok = toAstToken(t); tok.lexeme = 'not in'; tok.type = TokenType.NOTIN; return tok; } %}
  | "is"              {% tok %}
  | "is" "not"        {% ([t]: [moo.Token]) => { const tok = toAstToken(t); tok.lexeme = 'is not'; tok.type = TokenType.ISNOT; return tok; } %}

expressionAdd ->
    expressionAdd expressionAddOp expressionMul  {% astBinary %}
  | expressionMul                                  {% id %}

expressionAddOp -> %plus {% tok %} | %minus {% tok %}

expressionMul ->
    expressionMul expressionMulOp expressionUnary {% astBinary %}
  | expressionUnary                                {% id %}

expressionMulOp ->
    %star        {% tok %}
  | %slash       {% tok %}
  | %percent     {% tok %}
  | %doubleslash {% tok %}

expressionUnary ->
    %tilde expressionUnary                       {% astUnary %}
  | %plus expressionUnary                        {% astUnary %}
  | %minus expressionUnary                       {% astUnary %}
  | expressionPow                                  {% id %}

expressionPow ->
    expressionPost %doublestar expressionUnary   {% astBinaryTok %}
  | expressionPost                                 {% id %}

expressionPost ->
    expressionPost %lsqb subscript_index %rsqb
      {% ([obj, , idx, rsqb]: [ExprNS.Expr, moo.Token, ExprNS.Expr, moo.Token]) => new ExprNS.Subscript(obj.startToken, toAstToken(rsqb), obj, idx) %}
  | expressionPost "(" spread_expressions ")"
      {% ([callee,, args, rparen]: [ExprNS.Expr, moo.Token, ExprNS.Expr[], moo.Token])  => new ExprNS.Call(callee.startToken, toAstToken(rparen), callee, checkArguments(args)) %}
  | expressionPost "(" expression comp_for:+ ")"
      {% ([callee,, element, clauses, rparen]: [ExprNS.Expr, moo.Token, ExprNS.Expr, Clause[], moo.Token]) =>
           new ExprNS.Call(callee.startToken, toAstToken(rparen), callee,
             [new ExprNS.Comprehension(element.startToken, clauses[clauses.length - 1].end, "generator", element, null, generators(clauses))]) %}
  | expressionPost "." %name
      {% ([obj,, name]: [ExprNS.Expr, moo.Token, moo.Token]) => new ExprNS.Attribute(obj.startToken, toAstToken(name), obj, toAstToken(name)) %}
  | expressionPost "(" ")"
      {% ([callee,, rparen]: [ExprNS.Expr, moo.Token, moo.Token]) => new ExprNS.Call(callee.startToken, toAstToken(rparen), callee, []) %}
  | atom                                       {% id %}

# ============================================================================
# atom (literals, variables, grouping, lists)
# ============================================================================

atom ->
    "(" expression ")"
      {% ([lparen, e, rparen]: [moo.Token, ExprNS.Expr, moo.Token]) =>
           new ExprNS.Grouping(toAstToken(lparen), toAstToken(rparen), e) %}
  | "(" yield_expr ")"
      {% ([lparen, e, rparen]: [moo.Token, ExprNS.Expr, moo.Token]) =>
           new ExprNS.Grouping(toAstToken(lparen), toAstToken(rparen), e) %}
  | "(" expression comp_for:+ ")"
      {% ([l, element, clauses, r]: [moo.Token, ExprNS.Expr, Clause[], moo.Token]) =>
           new ExprNS.Comprehension(toAstToken(l), toAstToken(r), "generator", element, null, generators(clauses)) %}
  | "(" ")"
      {% ([l, r]: [moo.Token, moo.Token]) => new ExprNS.Tuple(toAstToken(l), toAstToken(r), []) %}
  | "(" tuple_elements ")"
      {% ([l, elems, r]: [moo.Token, ExprNS.Expr[], moo.Token]) =>
           new ExprNS.Tuple(toAstToken(l), toAstToken(r), elems) %}
  | %lbrace %rbrace
      {% ([l, r]: [moo.Token, moo.Token]) => new ExprNS.Dict(toAstToken(l), toAstToken(r), [], []) %}
  | %lbrace dict_items %rbrace
      {% ([l, items, r]: [moo.Token, [ExprNS.Expr | null, ExprNS.Expr][], moo.Token]) =>
           new ExprNS.Dict(toAstToken(l), toAstToken(r), items.map(i => i[0]), items.map(i => i[1])) %}
  | %lbrace set_items %rbrace
      {% ([l, elems, r]: [moo.Token, ExprNS.Expr[], moo.Token]) => new ExprNS.Set(toAstToken(l), toAstToken(r), elems) %}
  | %lbrace expression comp_for:+ %rbrace
      {% ([l, element, clauses, r]: [moo.Token, ExprNS.Expr, Clause[], moo.Token]) =>
           new ExprNS.Comprehension(toAstToken(l), toAstToken(r), "set", element, null, generators(clauses)) %}
  | %lbrace expression ":" expression comp_for:+ %rbrace
      {% ([l, key,, value, clauses, r]: [moo.Token, ExprNS.Expr, moo.Token, ExprNS.Expr, Clause[], moo.Token]) =>
           new ExprNS.Comprehension(toAstToken(l), toAstToken(r), "dict", key, value, generators(clauses)) %}
  | %lsqb %rsqb
      {% ([l, r]: [moo.Token, moo.Token]) => new ExprNS.List(toAstToken(l), toAstToken(r), []) %}
  | %lsqb expressions %rsqb
      {% ([l, elems, r]: [moo.Token, ExprNS.Expr[], moo.Token]) => new ExprNS.List(toAstToken(l), toAstToken(r), elems) %}
  | %lsqb expression comp_for:+ %rsqb
      {% ([l, element, clauses, r]: [moo.Token, ExprNS.Expr, Clause[], moo.Token]) =>
           new ExprNS.Comprehension(toAstToken(l), toAstToken(r), "list", element, null, generators(clauses)) %}
  | %name                                        {% astVariable %}
  | %number_float
      {% ([t]: [moo.Token]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, parseFloat(t.value)); } %}
  | %number_int                                  {% astBigInt %}
  | %number_hex                                  {% astBigInt %}
  | %number_oct                                  {% astBigInt %}
  | %number_bin                                  {% astBigInt %}
  | %number_complex                              {% astComplex %}
  | stringLit                                    {% id %}
  | "None"                                       {% astNone %}
  | "True"                                       {% astTrue %}
  | "False"                                      {% astFalse %}

# ============================================================================
# lambda_expr                                    [python_1_bnf.tex line 44]
# ============================================================================

lambda_expr ->
    "lambda" rest_names ":" expression
      {% ([kw, params,, body]: [moo.Token, FunctionParam[], moo.Token, ExprNS.Expr]) => new ExprNS.Lambda(toAstToken(kw), body.endToken, checkParameters(params), body) %}
  | "lambda" rest_names %doublecolon block
      {% ([kw, params,, body]: [moo.Token, FunctionParam[], moo.Token, StmtNS.Stmt[]]) =>
           new ExprNS.MultiLambda(toAstToken(kw), body[body.length-1].endToken, checkParameters(params), body, []) %}
  | "lambda" ":" expression
      {% ([kw,, body]: [moo.Token, moo.Token, ExprNS.Expr]) => new ExprNS.Lambda(toAstToken(kw), body.endToken, [], body) %}
  | "lambda" %doublecolon block
      {% ([kw,, body]: [moo.Token, moo.Token, StmtNS.Stmt[]]) =>
           new ExprNS.MultiLambda(toAstToken(kw), body[body.length-1].endToken, [], body, []) %}

# ============================================================================
# expressions ::= ...                            [python_1_bnf.tex line 51]
# ============================================================================

# A tuple's elements: at least one comma, so `(e)` stays a grouping and `(e,)` is a 1-tuple.
tuple_elements ->
    star_expression "," {% ([e]: [ExprNS.Expr]) => [e] %}
  | star_expression ("," star_expression):+ (%comma):? {% flatList %}

# The right-hand side of an assignment and the operand of `return`: an expression, or a tuple
# written without parentheses (`a, b`, `1,`).
expression_list ->
    expression  {% id %}
  | tuple_elements
      {% ([elems]: [ExprNS.Expr[]]) => new ExprNS.Tuple(elems[0].startToken, elems[elems.length - 1].endToken, elems) %}

# `{k: v, ...}`
dict_items -> dict_item ("," dict_item):* (%comma):?  {% flatList %}
dict_item ->
    expression ":" expression  {% ([k,, v]: [ExprNS.Expr, moo.Token, ExprNS.Expr]) => [k, v] %}
  | %doublestar expressionBitOr  {% ([, v]: [moo.Token, ExprNS.Expr]) => [null, v] %}

# `a, b = value`, `(a, b), c = value`, `x[0], y = value`
statementTupleAssign -> tuple_target "=" assign_rhs
  {% ([t,, v]: [ExprNS.Tuple, moo.Token, ExprNS.Expr]) => new StmtNS.TupleAssign(t.startToken, v.endToken, t, v) %}
tuple_target ->
    target_list  {% id %}
  | "(" target_list ")"  {% ([l, t, r]: [moo.Token, ExprNS.Tuple, moo.Token]) => new ExprNS.Tuple(toAstToken(l), toAstToken(r), t.elements) %}
# The targets of an unpacking: at least one comma (so `a` is not one), and at most one starred
# target (`a, *b, c`), which may not stand alone (`*a = xs` is an error, `*a, = xs` is not).
# Each parenthesized target list inside has its own.
target_list ->
    target "," {% ([t]: [ExprNS.Expr]) => new ExprNS.Tuple(t.startToken, t.endToken, [t]) %}
  | target ("," target):+ (%comma):?
      {% ([first, rest]: [ExprNS.Expr, [unknown, ExprNS.Expr][]]) => {
           const elems = flatList([first, rest]);
           return new ExprNS.Tuple(elems[0].startToken, elems[elems.length - 1].endToken, elems);
         } %}
  | (target ","):+ star_target ("," target):* (%comma):?
      {% ([before, star, after]: [[ExprNS.Expr, moo.Token][], ExprNS.Expr, [unknown, ExprNS.Expr][]]) =>
           tupleOf([...before.map(b => b[0]), star, ...after.map(a => a[1])]) %}
  | star_target ("," target):+ (%comma):?
      {% ([star, after]: [ExprNS.Expr, [unknown, ExprNS.Expr][]]) =>
           tupleOf([star, ...after.map(a => a[1])]) %}
  | star_target ","
      {% ([star]: [ExprNS.Expr]) => tupleOf([star]) %}
star_target ->
  "*" target  {% ([star, t]: [moo.Token, ExprNS.Expr]) => new ExprNS.Starred(toAstToken(star), t.endToken, t) %}
# a name, a subscript or an attribute: what `x op= e` can change
simple_target ->
    %name  {% astVariable %}
  | expressionPost %lsqb subscript_index %rsqb
      {% ([obj,, idx, rsqb]: [ExprNS.Expr, moo.Token, ExprNS.Expr, moo.Token]) => new ExprNS.Subscript(obj.startToken, toAstToken(rsqb), obj, idx) %}
  | expressionPost "." %name
      {% ([obj,, name]: [ExprNS.Expr, moo.Token, moo.Token]) => new ExprNS.Attribute(obj.startToken, toAstToken(name), obj, toAstToken(name)) %}
target ->
    simple_target  {% id %}
  | "(" target_list ")"  {% ([, t]: [moo.Token, ExprNS.Tuple, moo.Token]) => t %}

# `a.b = value`
statementAttributeAssign -> expressionPost "." %name "=" assign_rhs
  {% ([obj,, name,, v]: [ExprNS.Expr, moo.Token, moo.Token, moo.Token, ExprNS.Expr]) => {
       const attr = new ExprNS.Attribute(obj.startToken, toAstToken(name), obj, toAstToken(name));
       return new StmtNS.AttributeAssign(obj.startToken, v.endToken, attr, v);
     } %}

# `x += e`, ...
statementAugAssign -> augassign_target augassign_op assign_rhs
  {% ([t, op, v]: [ExprNS.Expr, Token, ExprNS.Expr]) => new StmtNS.AugAssign(t.startToken, v.endToken, t, op, v) %}
# the target of `x op= e` may be in parentheses, but it is a single name, subscript or attribute
augassign_target ->
    simple_target  {% id %}
  | "(" augassign_target ")"  {% ([, t]: [moo.Token, ExprNS.Expr, moo.Token]) => t %}
augassign_op ->
    %pluseq {% tok %} | %minuseq {% tok %} | %stareq {% tok %} | %slasheq {% tok %}
  | %doubleslasheq {% tok %} | %percenteq {% tok %} | %doublestareq {% tok %}
  | %ampereq {% tok %} | %vbareq {% tok %} | %circumflexeq {% tok %}
  | %leftshifteq {% tok %} | %rightshifteq {% tok %} | %ateq {% tok %}

# `for a, b in iter:` (`for x in iter:` with a single name is statementFor)
statementForUnpack -> "for" tuple_target "in" expression ":" block
  {% ([kw, target,, iter,, body]: [moo.Token, ExprNS.Tuple, moo.Token, ExprNS.Expr, moo.Token, StmtNS.Stmt[]]) =>
       new StmtNS.ForUnpack(toAstToken(kw), body[body.length - 1].endToken, target, iter, body) %}

expressions -> star_expression ("," star_expression):* (%comma):?
  {% flatList %}

# An element of a list, tuple or set display: an expression, or `*iterable` (unpacked in place),
# where an unparenthesized iterable is a bitwise-or expression (`[*(a if c else b)]`, not
# `[*a if c else b]`), as in Python.
star_expression ->
    expression  {% id %}
  | %star expressionBitOr
      {% ([star, e]: [moo.Token, ExprNS.Expr]) => new ExprNS.Starred(toAstToken(star), e.endToken, e) %}

# `{1, 2}`: a set display (`{}` is an empty dictionary)
set_items -> star_expression ("," star_expression):* (%comma):?  {% flatList %}

# `for x in xs if c if d`: a clause of a comprehension. The iterable and the conditions are
# or-expressions (a conditional expression or a lambda needs parentheses there), as in Python.
comp_for -> "for" comp_target "in" expressionOr comp_if:*
  {% ([kw, target,, iter, conditions]: [moo.Token, ExprNS.Expr, moo.Token, ExprNS.Expr, ExprNS.Expr[]]) => ({
       target, iter, conditions,
       end: conditions.length > 0 ? conditions[conditions.length - 1].endToken : iter.endToken }) %}
comp_if -> "if" expressionOr  {% ([, c]: [moo.Token, ExprNS.Expr]) => c %}
comp_target ->
    target_list  {% id %}
  | target       {% id %}

# The index of a subscript: an expression or a slice
subscript_index ->
    expression  {% id %}
  | slice_expr  {% id %}
slice_expr ->
    expression:? ":" expression:? (":" expression:?):?
      {% ([lower, colon, upper, rest]: [ExprNS.Expr | null, moo.Token, ExprNS.Expr | null, [moo.Token, ExprNS.Expr | null] | null]) => {
           const step = rest ? rest[1] : null;
           const first = lower ? lower.startToken : toAstToken(colon);
           const last = step ? step.endToken : upper ? upper.endToken : toAstToken(rest ? rest[0] : colon);
           return new ExprNS.Slice(first, last, lower, upper, step);
         } %}
  | expression:? %doublecolon expression:?
      {% ([lower, colon, step]: [ExprNS.Expr | null, moo.Token, ExprNS.Expr | null]) =>
           new ExprNS.Slice(lower ? lower.startToken : toAstToken(colon), step ? step.endToken : toAstToken(colon), lower, null, step) %}

# `yield`, `yield v`, `yield from v`; allowed as a statement, as the right-hand side of an
# assignment and in parentheses
yield_expr ->
    "yield"
      {% ([t]: [moo.Token]) => { const k = toAstToken(t); return new ExprNS.Yield(k, k, null, false); } %}
  | "yield" expression_list
      {% ([kw, v]: [moo.Token, ExprNS.Expr]) => new ExprNS.Yield(toAstToken(kw), v.endToken, v, false) %}
  | "yield" "from" expression
      {% ([kw,, v]: [moo.Token, moo.Token, ExprNS.Expr]) => new ExprNS.Yield(toAstToken(kw), v.endToken, v, true) %}
assign_rhs ->
    expression_list  {% id %}
  | yield_expr       {% id %}

# ============================================================================
# spread-expressions ::= ...                     [python_3_bnf.tex lines 69-70]
# ============================================================================

spread_expressions -> spread_expression ("," spread_expression):* (%comma):?
  {% flatList %}

spread_expression ->
    expression                                   {% id %}
  | %name "=" expression
      {% ([n,, v]: [moo.Token, moo.Token, ExprNS.Expr]) => { const k = toAstToken(n); return new ExprNS.Keyword(k, v.endToken, k, v); } %}
  | %star expression
      {% ([star, expr]: [moo.Token, ExprNS.Expr]) =>
           new ExprNS.Starred(toAstToken(star), expr.endToken, expr) %}
  | %doublestar expression
      {% ([star, expr]: [moo.Token, ExprNS.Expr]) =>
           new ExprNS.DoubleStarred(toAstToken(star), expr.endToken, expr) %}

# ============================================================================
# stringLit — string literals
# ============================================================================

stringLit ->
    %string_triple_double  {% astString %}
  | %string_triple_single  {% astString %}
  | %string_double         {% astString %}
  | %string_single         {% astString %}

