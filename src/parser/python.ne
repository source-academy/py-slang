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
import { StmtNS, ExprNS } from '../ast-types';
import pythonLexer from './lexer';
import { toAstToken } from './token-bridge';

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
const astVariable   = ([t]) => { const k = toAstToken(t); return new ExprNS.Variable(k, k, k); };
const astBigInt     = ([t]) => { const k = toAstToken(t); return new ExprNS.BigIntLiteral(k, k, t.value); };
const astComplex    = ([t]) => { const k = toAstToken(t); return new ExprNS.Complex(k, k, t.value); };
const astNone       = ([t]) => { const k = toAstToken(t); return new ExprNS.None(k, k); };
const astString     = ([t]) => { const k = toAstToken(t); return new ExprNS.Literal(k, k, stripQuotes(t.value)); };
const astTrue       = ([t]) => { const k = toAstToken(t); return new ExprNS.Literal(k, k, true); };
const astFalse      = ([t]) => { const k = toAstToken(t); return new ExprNS.Literal(k, k, false); };

// ── Operator AST constructors (children → node) ────────────────────────
const astBinary     = ([l, op, r]) => new ExprNS.Binary(l.startToken, r.endToken, l, op, r);
const astBinaryTok  = ([l, op, r]) => new ExprNS.Binary(l.startToken, r.endToken, l, toAstToken(op), r);
const astBoolOp     = ([l, op, r]) => new ExprNS.BoolOp(l.startToken, r.endToken, l, toAstToken(op), r);
const astUnary      = ([op, arg]) => new ExprNS.Unary(toAstToken(op), arg.endToken, toAstToken(op), arg);
const astCompare    = ([l, op, r]) => new ExprNS.Compare(l.startToken, r.endToken, l, op, r);

// ── Token / list helpers ────────────────────────────────────────────────
const tok           = ([t]) => toAstToken(t);
const flatList      = ([first, rest]) => [first, ...rest.map(d => d[1])];
const tokList       = ([first, rest]) => [toAstToken(first), ...rest.map(d => toAstToken(d[1]))];
%}

@lexer pythonLexer

# ============================================================================
# program ::= import-stmt ... block              [python_1_bnf.tex line 18]
#
# Enforces: imports come before statements.  An import after a statement
# is a parse error.
# ============================================================================

program -> (import_stmt %newline):* (statement | %newline):*
  {% ([imports, stmts]) => {
       const importNodes = imports.map(d => d[0]);
       const stmtNodes = stmts.map(d => d[0]).filter(s => s && s.startToken !== undefined);
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
      {% ([kw, mod,, names]) => {
           const last = names[names.length-1];
           const endTok = last.alias || last.name;
           return new StmtNS.FromImport(toAstToken(kw), endTok, mod, names);
         } %}

# dotted-name ::= name ( . name )...                     [python_1_bnf.tex line 20]
dotted_name -> %name ("." %name):*
  {% ([first, rest]) => {
       let tok = toAstToken(first);
       for (const [, n] of rest) {
         const right = toAstToken(n);
         tok.lexeme = tok.lexeme + '.' + right.lexeme;
       }
       return tok;
     } %}

# import-clause ::= import-as-names | ( import-as-names ) [python_1_bnf.tex line 21-22]
import_clause ->
    import_as_names  {% id %}
  | "(" _nl import_as_names _nl ")"  {% ([,, ns]) => ns %}

# import-as-names ::= import-as-name (, import-as-name)... [python_1_bnf.tex line 23]
import_as_names -> import_as_name ("," import_as_name):*
  {% flatList %}

# import-as-name ::= name [ as name ]                     [python_1_bnf.tex line 24]
import_as_name ->
    %name  {% ([t]) => ({ name: toAstToken(t), alias: null }) %}
  | %name "as" %name  {% ([t,, a]) => ({ name: toAstToken(t), alias: toAstToken(a) }) %}

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
  {% ([n,, v]) => { const tok = toAstToken(n); return new StmtNS.Assign(tok, v.endToken, new ExprNS.Variable(tok, tok, tok), v); } %}

statementAnnAssign ->
    %name ":" expression "=" expression
      {% ([n,, ann,, v]) => { const tok = toAstToken(n); return new StmtNS.AnnAssign(tok, v.endToken, new ExprNS.Variable(tok, tok, tok), v, ann); } %}
  | %name ":" expression
      {% ([n,, ann]) => {
           const nameTok = toAstToken(n);
           const dummyVal = new ExprNS.None(ann.endToken, ann.endToken);
           return new StmtNS.AnnAssign(nameTok, ann.endToken, new ExprNS.Variable(nameTok, nameTok, nameTok), dummyVal, ann);
         } %}

statementSubscriptAssign -> expressionPost %lsqb expression %rsqb "=" expression
  {% function(d) {
       var obj = d[0], idx = d[2], rsqb = d[3], val = d[5];
       var sub = new ExprNS.Subscript(obj.startToken, toAstToken(rsqb), obj, idx);
       return new StmtNS.Assign(obj.startToken, val.endToken, sub, val);
     } %}

statementReturn ->
    "return" expression
      {% ([kw, expr]) => new StmtNS.Return(toAstToken(kw), expr.endToken, expr) %}
  | "return"
      {% ([t]) => { const tok = toAstToken(t); return new StmtNS.Return(tok, tok, null); } %}

statementPass -> "pass"
  {% ([t]) => { const tok = toAstToken(t); return new StmtNS.Pass(tok, tok); } %}

statementBreak -> "break"
  {% ([t]) => { const tok = toAstToken(t); return new StmtNS.Break(tok, tok); } %}

statementContinue -> "continue"
  {% ([t]) => { const tok = toAstToken(t); return new StmtNS.Continue(tok, tok); } %}

statementGlobal -> "global" %name
  {% ([kw, n]) => new StmtNS.Global(toAstToken(kw), toAstToken(n), toAstToken(n)) %}

statementNonlocal -> "nonlocal" %name
  {% ([kw, n]) => new StmtNS.NonLocal(toAstToken(kw), toAstToken(n), toAstToken(n)) %}

statementAssert -> "assert" expression
  {% ([kw, e]) => new StmtNS.Assert(toAstToken(kw), e.endToken, e) %}

statementExpr -> expression
  {% ([e]) => new StmtNS.SimpleExpr(e.startToken, e.endToken, e) %}

statementWhile -> "while" expression ":" block
  {% ([kw, test,, body]) =>
       new StmtNS.While(toAstToken(kw), body[body.length-1].endToken, test, body) %}

statementFor -> "for" %name "in" expression ":" block
  {% ([kw, target,, iter,, body]) =>
       new StmtNS.For(toAstToken(kw), body[body.length-1].endToken, toAstToken(target), iter, body) %}

statementDef -> "def" %name params ":" block
  {% ([kw, name, params,, body]) =>
       new StmtNS.FunctionDef(toAstToken(kw), body[body.length-1].endToken,
         toAstToken(name), params, body, []) %}

# ============================================================================
# if-statement with EBNF                         [python_1_bnf.tex lines 31-33]
# ============================================================================

if_statement -> "if" expression ":" block ("elif" expression ":" block):* ("else" ":" block):?
  {% ([kw, test,, body, elifs, elseBlock]) => {
       let else_ = elseBlock ? elseBlock[0][2] : null;
       for (let i = elifs.length - 1; i >= 0; i--) {
         const [ekw, etest, ecolon, ebody] = elifs[i];
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
      {% ([,, stmts]) => stmts.map(d => d[0]).filter(s => s && s.startToken !== undefined) %}

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
      {% ([t]) => { const tok = toAstToken(t); tok.isStarred = false; return [tok]; } %}
  | "*" %name
      {% ([, t]) => { const tok = toAstToken(t); tok.isStarred = true; return [tok]; } %}
  | rest_names _nl "," _nl %name
      {% ([params,,,, t]) => { const tok = toAstToken(t); tok.isStarred = false; return [...params, tok]; } %}
  | rest_names _nl "," _nl "*" %name
      {% ([params,,,,, t]) => { const tok = toAstToken(t); tok.isStarred = true; return [...params, tok]; } %}

params ->
    "(" _nl ")"                               {% drop %}
  | "(" _nl rest_names _nl ")"               {% ([,, ps]) => ps %}

# ============================================================================
# expression ::= ...                             [python_1_bnf.tex lines 35-46]
# ============================================================================

expression -> expressionOr "if" expressionOr "else" expression {% ([cons, , test,, alt]) => new ExprNS.Ternary(cons.startToken, alt.endToken, test, cons, alt) %}
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
  | "not" "in"        {% ([t]) => { const tok = toAstToken(t); tok.lexeme = 'not in'; return tok; } %}
  | "is"              {% tok %}
  | "is" "not"        {% ([t]) => { const tok = toAstToken(t); tok.lexeme = 'is not'; return tok; } %}

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
    expressionPost %lsqb _nl expression _nl %rsqb
      {% ([obj, ,, idx,, rsqb]) => new ExprNS.Subscript(obj.startToken, toAstToken(rsqb), obj, idx) %}
  | expressionPost "(" _nl expressions _nl ")"
      {% ([callee,,, args,, rparen]) => new ExprNS.Call(callee.startToken, toAstToken(rparen), callee, args) %}
  | expressionPost "(" _nl ")"
      {% ([callee,,, rparen]) => new ExprNS.Call(callee.startToken, toAstToken(rparen), callee, []) %}
  | atom                                       {% id %}

# ============================================================================
# atom (literals, variables, grouping, lists)
# ============================================================================

atom ->
    "(" _nl expression _nl ")"
      {% ([,, e]) => new ExprNS.Grouping(e.startToken, e.endToken, e) %}
  | %lsqb _nl %rsqb
      {% ([l,, r]) => new ExprNS.List(toAstToken(l), toAstToken(r), []) %}
  | %lsqb _nl expressions _nl %rsqb
      {% ([l,, elems,, r]) => new ExprNS.List(toAstToken(l), toAstToken(r), elems) %}
  | %name                                        {% astVariable %}
  | %number_float
      {% ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, parseFloat(t.value)); } %}
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
    "lambda" names ":" expression
      {% ([kw, params,, body]) => new ExprNS.Lambda(toAstToken(kw), body.endToken, params, body) %}
  | "lambda" names %doublecolon block
      {% ([kw, params,, body]) =>
           new ExprNS.MultiLambda(toAstToken(kw), body[body.length-1].endToken, params, body, []) %}
  | "lambda" ":" expression
      {% ([kw,, body]) => new ExprNS.Lambda(toAstToken(kw), body.endToken, [], body) %}
  | "lambda" %doublecolon block
      {% ([kw,, body]) =>
           new ExprNS.MultiLambda(toAstToken(kw), body[body.length-1].endToken, [], body, []) %}

# ============================================================================
# expressions ::= ...                            [python_1_bnf.tex line 51]
# ============================================================================

expressions -> expression ("," expression):* (","):?
  {% flatList %}

# ============================================================================
# stringLit — string literals
# ============================================================================

stringLit ->
    %string_triple_double  {% astString %}
  | %string_triple_single  {% astString %}
  | %string_double         {% astString %}
  | %string_single         {% astString %}

# ============================================================================
# Whitespace rules — only _nl (for inside parens/brackets)
# No _ or __ rules needed — lexer strips %ws tokens
# ============================================================================

_nl -> null          {% id %}
  | _nl %newline     {% id %}
  | _nl %indent      {% id %}
  | _nl %dedent      {% id %}
