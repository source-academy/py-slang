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

// ── Token / list helpers ────────────────────────────────────────────────
const tok           = ([t]: [moo.Token]) => toAstToken(t);
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
  | statementClass
      {% id %}
  | statementTry
      {% id %}
  | statementWith
      {% id %}
  | statementDecorated
      {% id %}

statementAssign -> %name "=" expression_list
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

statementSubscriptAssign -> expressionPost %lsqb expression %rsqb "=" expression_list
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
           new StmtNS.Class(toAstToken(kw), body[body.length - 1].endToken, toAstToken(name), bases, body) %}

statementTry ->
    "try" ":" block except_clause:+ ("else" ":" block):? ("finally" ":" block):?
      {% ([kw,, body, handlers, orElse, fin]: [moo.Token, moo.Token, StmtNS.Stmt[], StmtNS.Try["handlers"], [moo.Token, moo.Token, StmtNS.Stmt[]] | null, [moo.Token, moo.Token, StmtNS.Stmt[]] | null]) => {
           const last = fin ? fin[2] : orElse ? orElse[2] : handlers[handlers.length - 1].body;
           return new StmtNS.Try(toAstToken(kw), last[last.length - 1].endToken, body, handlers,
                                 orElse ? orElse[2] : null, fin ? fin[2] : null);
         } %}
  | "try" ":" block "finally" ":" block
      {% ([kw,, body,,, fin]: [moo.Token, moo.Token, StmtNS.Stmt[], moo.Token, moo.Token, StmtNS.Stmt[]]) =>
           new StmtNS.Try(toAstToken(kw), fin[fin.length - 1].endToken, body, [], null, fin) %}
except_clause ->
    "except" ":" block
      {% ([,, body]: [moo.Token, moo.Token, StmtNS.Stmt[]]) => ({ type: null, name: null, body }) %}
  | "except" expression ":" block
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

rest_names ->
    param
      {% ([p]: [FunctionParam]) => [p] %}
  | rest_names "," param
      {% ([params,, p]: [FunctionParam[], moo.Token, FunctionParam]) => [...params, p] %}

param ->
    %name
      {% ([t]: [moo.Token]) => toFunctionParam(t, false) %}
  | %name "=" expression
      {% ([t,, d]: [moo.Token, moo.Token, ExprNS.Expr]) => toFunctionParam(t, false, d) %}
  | "*" %name
      {% ([, t]: [moo.Token, moo.Token]) => toFunctionParam(t, true) %}

params ->
    "(" ")"                                   {% drop %}
  | "(" rest_names ")"                        {% ([, ps]: [moo.Token, FunctionParam[], moo.Token]) => ps %}

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
    expressionAdd expressionCmpOp expressionAdd  {% astCompare %}
  | expressionAdd                                  {% id %}

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
    %plus expressionUnary                        {% astUnary %}
  | %minus expressionUnary                       {% astUnary %}
  | expressionPow                                  {% id %}

expressionPow ->
    expressionPost %doublestar expressionUnary   {% astBinaryTok %}
  | expressionPost                                 {% id %}

expressionPost ->
    expressionPost %lsqb expression %rsqb
      {% ([obj, , idx, rsqb]: [ExprNS.Expr, moo.Token, ExprNS.Expr, moo.Token]) => new ExprNS.Subscript(obj.startToken, toAstToken(rsqb), obj, idx) %}
  | expressionPost "(" spread_expressions ")"
      {% ([callee,, args, rparen]: [ExprNS.Expr, moo.Token, ExprNS.Expr[], moo.Token])  => new ExprNS.Call(callee.startToken, toAstToken(rparen), callee, args) %}
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
  | "(" ")"
      {% ([l, r]: [moo.Token, moo.Token]) => new ExprNS.Tuple(toAstToken(l), toAstToken(r), []) %}
  | "(" tuple_elements ")"
      {% ([l, elems, r]: [moo.Token, ExprNS.Expr[], moo.Token]) =>
           new ExprNS.Tuple(toAstToken(l), toAstToken(r), elems) %}
  | %lbrace %rbrace
      {% ([l, r]: [moo.Token, moo.Token]) => new ExprNS.Dict(toAstToken(l), toAstToken(r), [], []) %}
  | %lbrace dict_items %rbrace
      {% ([l, items, r]: [moo.Token, [ExprNS.Expr, ExprNS.Expr][], moo.Token]) =>
           new ExprNS.Dict(toAstToken(l), toAstToken(r), items.map(i => i[0]), items.map(i => i[1])) %}
  | %lsqb %rsqb
      {% ([l, r]: [moo.Token, moo.Token]) => new ExprNS.List(toAstToken(l), toAstToken(r), []) %}
  | %lsqb expressions %rsqb
      {% ([l, elems, r]: [moo.Token, ExprNS.Expr[], moo.Token]) => new ExprNS.List(toAstToken(l), toAstToken(r), elems) %}
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
      {% ([kw, params,, body]: [moo.Token, FunctionParam[], moo.Token, ExprNS.Expr]) => new ExprNS.Lambda(toAstToken(kw), body.endToken, params, body) %}
  | "lambda" rest_names %doublecolon block
      {% ([kw, params,, body]: [moo.Token, FunctionParam[], moo.Token, StmtNS.Stmt[]]) =>
           new ExprNS.MultiLambda(toAstToken(kw), body[body.length-1].endToken, params, body, []) %}
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
    expression "," {% ([e]: [ExprNS.Expr]) => [e] %}
  | expression ("," expression):+ (%comma):? {% flatList %}

# The right-hand side of an assignment and the operand of `return`: an expression, or a tuple
# written without parentheses (`a, b`, `1,`).
expression_list ->
    expression  {% id %}
  | tuple_elements
      {% ([elems]: [ExprNS.Expr[]]) => new ExprNS.Tuple(elems[0].startToken, elems[elems.length - 1].endToken, elems) %}

# `{k: v, ...}`
dict_items -> dict_item ("," dict_item):* (%comma):?  {% flatList %}
dict_item -> expression ":" expression  {% ([k,, v]: [ExprNS.Expr, moo.Token, ExprNS.Expr]) => [k, v] %}

# `a, b = value`, `(a, b), c = value`, `x[0], y = value`
statementTupleAssign -> tuple_target "=" expression_list
  {% ([t,, v]: [ExprNS.Tuple, moo.Token, ExprNS.Expr]) => new StmtNS.TupleAssign(t.startToken, v.endToken, t, v) %}
tuple_target ->
    target_list  {% id %}
  | "(" target_list ")"  {% ([l, t, r]: [moo.Token, ExprNS.Tuple, moo.Token]) => new ExprNS.Tuple(toAstToken(l), toAstToken(r), t.elements) %}
target_list ->
    target "," {% ([t]: [ExprNS.Expr]) => new ExprNS.Tuple(t.startToken, t.endToken, [t]) %}
  | target ("," target):+ (%comma):?
      {% ([first, rest]: [ExprNS.Expr, [unknown, ExprNS.Expr][]]) => {
           const elems = flatList([first, rest]);
           return new ExprNS.Tuple(elems[0].startToken, elems[elems.length - 1].endToken, elems);
         } %}
target ->
    %name  {% astVariable %}
  | expressionPost %lsqb expression %rsqb
      {% ([obj,, idx, rsqb]: [ExprNS.Expr, moo.Token, ExprNS.Expr, moo.Token]) => new ExprNS.Subscript(obj.startToken, toAstToken(rsqb), obj, idx) %}
  | "(" target_list ")"  {% ([, t]: [moo.Token, ExprNS.Tuple, moo.Token]) => t %}

expressions -> expression ("," expression):* (%comma):?
  {% flatList %}

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

# ============================================================================
# stringLit — string literals
# ============================================================================

stringLit ->
    %string_triple_double  {% astString %}
  | %string_triple_single  {% astString %}
  | %string_double         {% astString %}
  | %string_single         {% astString %}

