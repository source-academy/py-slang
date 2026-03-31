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
# is a parse error.
# ============================================================================

program -> (import_stmt %newline):* (statement | %newline):*
  {% ([imports, stmts]: [[StmtNS.FromImport, moo.Token][], ([StmtNS.Stmt] | [moo.Token])[]]) => {
       const importNodes = imports.map(d => d[0]);
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
    "from" dotted_name "import" import_clause
      {% ([kw, mod,, names]: [moo.Token, Token, moo.Token, StmtNS.FromImport["names"]]) => {
           const last = names[names.length-1];
           const endTok = last.alias || last.name;
           return new StmtNS.FromImport(toAstToken(kw), endTok, mod, names);
         } %}

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

statementAssign -> %name "=" expression
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

statementSubscriptAssign -> expressionPost %lsqb expression %rsqb "=" expression
  {% function(d: [ExprNS.Expr, moo.Token, ExprNS.Expr, moo.Token, moo.Token, ExprNS.Expr]) {
       const obj = d[0], idx = d[2], rsqb = d[3], val = d[5];
       const sub = new ExprNS.Subscript(obj.startToken, toAstToken(rsqb), obj, idx);
       return new StmtNS.Assign(obj.startToken, val.endToken, sub, val);
     } %}

statementReturn ->
    "return" expression
      {% ([kw, expr]: [moo.Token, ExprNS.Expr]) => new StmtNS.Return(toAstToken(kw), expr.endToken, expr) %}
  | "return"
      {% ([t]: [moo.Token]) => { const tok = toAstToken(t); return new StmtNS.Return(tok, tok, null); } %}

statementPass -> "pass"
  {% ([t]: [moo.Token]) => { const tok = toAstToken(t); return new StmtNS.Pass(tok, tok); } %}

statementBreak -> "break"
  {% ([t]: [moo.Token]) => { const tok = toAstToken(t); return new StmtNS.Break(tok, tok); } %}

statementContinue -> "continue"
  {% ([t]: [moo.Token]) => { const tok = toAstToken(t); return new StmtNS.Continue(tok, tok); } %}

statementGlobal -> "global" %name
  {% ([kw, n]: [moo.Token, moo.Token]) => new StmtNS.Global(toAstToken(kw), toAstToken(n), toAstToken(n)) %}

statementNonlocal -> "nonlocal" %name
  {% ([kw, n]: [moo.Token, moo.Token]) => new StmtNS.NonLocal(toAstToken(kw), toAstToken(n), toAstToken(n)) %}

statementAssert -> "assert" expression
  {% ([kw, e]: [moo.Token, ExprNS.Expr]) => new StmtNS.Assert(toAstToken(kw), e.endToken, e) %}

statementExpr -> expression
  {% ([e]: [ExprNS.Expr]) => new StmtNS.SimpleExpr(e.startToken, e.endToken, e) %}

statementWhile -> "while" expression ":" block
  {% ([kw, test,, body]: [moo.Token, ExprNS.Expr, moo.Token, StmtNS.Stmt[]]) =>
       new StmtNS.While(toAstToken(kw), body[body.length-1].endToken, test, body) %}

statementFor -> "for" %name "in" expression ":" block
  {% ([kw, target,, iter,, body]: [moo.Token, moo.Token, moo.Token, ExprNS.Expr, moo.Token, StmtNS.Stmt[]]) =>
       new StmtNS.For(toAstToken(kw), body[body.length-1].endToken, toAstToken(target), iter, body) %}

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
    %name
      {% ([t]: [moo.Token]) => { const tok = toFunctionParam(t, false); return [tok]; } %}
  | "*" %name
      {% ([, t]: [moo.Token, moo.Token]) => { const tok = toFunctionParam(t, true); return [tok]; } %}
  | rest_names "," %name
      {% ([params,, t]: [FunctionParam[], moo.Token, moo.Token]) => { const tok = toFunctionParam(t, false); return [...params, tok]; } %}
  | rest_names "," "*" %name
      {% ([params,,, t]: [FunctionParam[], moo.Token, moo.Token, moo.Token]) => { const tok = toFunctionParam(t, true); return [...params, tok]; } %}

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

expressionCmp ->
    expressionCmp expressionCmpOp expressionAdd  {% astCompare %}
  | expressionAdd                                  {% id %}

expressionCmpOp ->
    %less             {% tok %}
  | %greater          {% tok %}
  | %doubleequal      {% tok %}
  | %greaterequal     {% tok %}
  | %lessequal        {% tok %}
  | %notequal         {% tok %}
  | "in"              {% tok %}
  | "not" "in"        {% ([t]: [moo.Token]) => { const tok = toAstToken(t); tok.lexeme = 'not in'; return tok; } %}
  | "is"              {% tok %}
  | "is" "not"        {% ([t]: [moo.Token]) => { const tok = toAstToken(t); tok.lexeme = 'is not'; return tok; } %}

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
      {% ([, e]: [moo.Token, ExprNS.Expr, moo.Token]) => new ExprNS.Grouping(e.startToken, e.endToken, e) %}
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

expressions -> expression ("," expression):* (%comma):?
  {% flatList %}

# ============================================================================
# spread-expressions ::= ...                     [python_3_bnf.tex lines 69-70]
# ============================================================================

spread_expressions -> spread_expression ("," spread_expression):* (%comma):?
  {% flatList %}

spread_expression ->
    expression                                   {% id %}
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

