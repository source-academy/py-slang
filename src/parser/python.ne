# Nearley grammar for Python subset (Source Academy)
# Produces class-based AST nodes
#
# Naming convention:
#   Spec-traceable rules:     no prefix  (expression, statement, block, program, ...)
#   Implementation-internal:  _expr/_op suffix or compound name (or_expr, add_op, block_stmts, ...)
#   Whitespace helpers:       _, __, _nl

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
%}

@lexer pythonLexer

# ============================================================================
# program ::= import-stmt ... block              [python_1_bnf.tex line 18]
# ============================================================================

program -> program_stmts
  {% ([stmts]) => {
       const filtered = (stmts || []).filter(Boolean);
       const start = filtered[0]
         ? filtered[0].startToken
         : toAstToken({type:'newline',value:'',line:1,col:1,offset:0});
       const end = filtered.length > 0
         ? filtered[filtered.length-1].endToken
         : start;
       return new StmtNS.FileInput(start, end, filtered, []);
     } %}

program_stmts ->
    null                                      {% drop %}
  | program_stmts statement                  {% ([xs, x]) => x ? [...xs, x] : xs %}
  | program_stmts %newline                   {% id %}
  | program_stmts %ws                        {% id %}

# ============================================================================
# import-stmt ::= from dotted-name import import-clause  [python_1_bnf.tex line 19]
# ============================================================================

import_stmt ->
    "from" _ %name _ "import" _ import_names
      {% ([kw,, mod,,,, names]) => new StmtNS.FromImport(toAstToken(kw), names[names.length-1], toAstToken(mod), names) %}

import_names ->
    %name                                     {% ([t]) => [toAstToken(t)] %}
  | "(" _ name_list _ ")"                    {% ([,, ns]) => ns %}

name_list ->
    %name                                     {% ([t]) => [toAstToken(t)] %}
  | name_list _ "," _ %name                  {% ([ns,,,, t]) => [...ns, toAstToken(t)] %}

# ============================================================================
# statement ::= ...                              [python_1_bnf.tex lines 25-29]
#   [Ch3] additions                              [python_3_bnf.tex lines 29-32]
#   [Extension] additions
# ============================================================================

statement -> simple_statement {% id %} | compound_statement {% id %}

# ============================================================================
# Simple statements
# ============================================================================

simple_statement -> small_statement _ %newline  {% id %}

small_statement ->
    "pass"
      {% ([t]) => { const tok = toAstToken(t); return new StmtNS.Pass(tok, tok); } %}
  | "break"
      {% ([t]) => { const tok = toAstToken(t); return new StmtNS.Break(tok, tok); } %}
  | "continue"
      {% ([t]) => { const tok = toAstToken(t); return new StmtNS.Continue(tok, tok); } %}
  | "return" _ expression
      {% ([kw,, expr]) => new StmtNS.Return(toAstToken(kw), expr.endToken, expr) %}
  | "return"
      {% ([t]) => { const tok = toAstToken(t); return new StmtNS.Return(tok, tok, null); } %}
  | %name _ ":" _ expression _ "=" _ expression
      {% ([n,,,, ann,,,, v]) => { const tok = toAstToken(n); return new StmtNS.AnnAssign(tok, v.endToken, new ExprNS.Variable(tok, tok, tok), v, ann); } %}
  | %name _ ":" _ expression
      {% ([n,,,, ann]) => {
           const nameTok = toAstToken(n);
           const dummyVal = new ExprNS.None(ann.endToken, ann.endToken);
           return new StmtNS.AnnAssign(nameTok, ann.endToken, new ExprNS.Variable(nameTok, nameTok, nameTok), dummyVal, ann);
         } %}
  | %name _ "=" _ expression
      {% ([n,,,, v]) => { const tok = toAstToken(n); return new StmtNS.Assign(tok, v.endToken, new ExprNS.Variable(tok, tok, tok), v); } %}
  | import_stmt {% id %}
  | "global" _ %name
      {% ([kw,, n]) => new StmtNS.Global(toAstToken(kw), toAstToken(n), toAstToken(n)) %}
  | "nonlocal" _ %name
      {% ([kw,, n]) => new StmtNS.NonLocal(toAstToken(kw), toAstToken(n), toAstToken(n)) %}
  | "assert" _ expression
      {% ([kw,, e]) => new StmtNS.Assert(toAstToken(kw), e.endToken, e) %}
  | expression
      {% ([e]) => new StmtNS.SimpleExpr(e.startToken, e.endToken, e) %}

# ============================================================================
# names ::= ...                                  [python_1_bnf.tex line 30]
# ============================================================================

names ->
    %name                                     {% ([t]) => [toAstToken(t)] %}
  | names _nl "," _nl %name                  {% ([ps,,,, t]) => [...ps, toAstToken(t)] %}

# ============================================================================
# if-statement ::= ...                           [python_1_bnf.tex lines 31-33]
# ============================================================================

if_statement ->
    "if" _ expression _ ":" _ block elif_chain
      {% ([kw,, test,,,, body, else_]) =>
           new StmtNS.If(toAstToken(kw),
             (else_ && else_.length > 0) ? else_[else_.length-1].endToken : body[body.length-1].endToken,
             test, body, else_) %}

elif_chain ->
    _ "elif" _ expression _ ":" _ block elif_chain
      {% ([, kw,, test,,,, body, else_]) => [new StmtNS.If(toAstToken(kw),
           (else_ && else_.length > 0) ? else_[else_.length-1].endToken : body[body.length-1].endToken,
           test, body, else_)] %}
  | _ "else" _ ":" _ block                    {% ([,,,,, body]) => body %}
  | null                                      {% nil %}

# ============================================================================
# block ::= statement...                         [python_1_bnf.tex line 34]
# ============================================================================

block ->
    simple_statement                         {% list %}
  | %newline %indent block_stmts %dedent     {% ([,, stmts]) => stmts %}

block_stmts ->
    _ statement                               {% ([, s]) => [s] %}
  | block_stmts _ statement                  {% ([xs,, s]) => [...xs, s] %}
  | block_stmts _ %newline                   {% id %}

# ============================================================================
# Compound statements
#   [Ch3] additions                              [python_3_bnf.tex lines 29-32]
#   [Extension] additions
# ============================================================================

compound_statement ->
    if_statement {% id %}
  | "while" _ expression _ ":" _ block
      {% ([kw,, test,,,, body]) =>
           new StmtNS.While(toAstToken(kw), body[body.length-1].endToken, test, body) %}
  | "for" _ %name _ "in" _ expression _ ":" _ block
      {% ([kw,, target,,,, iter,,,, body]) =>
           new StmtNS.For(toAstToken(kw), body[body.length-1].endToken, toAstToken(target), iter, body) %}
  | "def" _ %name _ params _ ":" _ block
      {% ([kw,, name,, params,,,, body]) =>
           new StmtNS.FunctionDef(toAstToken(kw), body[body.length-1].endToken,
             toAstToken(name), params, body, []) %}

params ->
    "(" _nl ")"                               {% drop %}
  | "(" _nl names _nl ")"                    {% ([,, ps]) => ps %}

# ============================================================================
# expression ::= ...                             [python_1_bnf.tex lines 35-46]
#   [Ch3] additions                              [python_3_bnf.tex lines 55-57]
#   [Extension] additions
# ============================================================================

expression ->
    or_expr _ "if" _ or_expr _ "else" _ expression
      {% ([cons,,,, test,,,, alt]) => new ExprNS.Ternary(cons.startToken, alt.endToken, test, cons, alt) %}
  | or_expr                                       {% id %}
  | lambda_expr                               {% id %}

# ============================================================================
# Precedence cascade (or_expr, and_expr, not_expr, cmp_expr, add_expr, mul_expr, unary_expr, pow_expr, post_expr)
# ============================================================================

or_expr ->
    or_expr _ "or" _ and_expr
      {% ([left,, op,, right]) => new ExprNS.BoolOp(left.startToken, right.endToken, left, toAstToken(op), right) %}
  | and_expr                                      {% id %}

and_expr ->
    and_expr _ "and" _ not_expr
      {% ([left,, op,, right]) => new ExprNS.BoolOp(left.startToken, right.endToken, left, toAstToken(op), right) %}
  | not_expr                                      {% id %}

not_expr ->
    "not" _ not_expr
      {% ([op,, arg]) => new ExprNS.Unary(toAstToken(op), arg.endToken, toAstToken(op), arg) %}
  | cmp_expr                                      {% id %}

cmp_expr ->
    cmp_expr _ cmp_op _ add_expr
      {% ([left,, op,, right]) => new ExprNS.Compare(left.startToken, right.endToken, left, op, right) %}
  | add_expr                                      {% id %}

cmp_op ->
    %less             {% ([t]) => toAstToken(t) %}
  | %greater          {% ([t]) => toAstToken(t) %}
  | %doubleequal      {% ([t]) => toAstToken(t) %}
  | %greaterequal     {% ([t]) => toAstToken(t) %}
  | %lessequal        {% ([t]) => toAstToken(t) %}
  | %notequal         {% ([t]) => toAstToken(t) %}
  | "in"              {% ([t]) => toAstToken(t) %}
  | "not" _ "in"      {% ([t,,]) => { const tok = toAstToken(t); tok.lexeme = 'not in'; return tok; } %}
  | "is"              {% ([t]) => toAstToken(t) %}
  | "is" _ "not"      {% ([t,,]) => { const tok = toAstToken(t); tok.lexeme = 'is not'; return tok; } %}

add_expr ->
    add_expr _ add_op _ mul_expr
      {% ([left,, op,, right]) => new ExprNS.Binary(left.startToken, right.endToken, left, op, right) %}
  | mul_expr                                      {% id %}

add_op -> %plus {% ([t]) => toAstToken(t) %} | %minus {% ([t]) => toAstToken(t) %}

mul_expr ->
    mul_expr _ mul_op _ unary_expr
      {% ([left,, op,, right]) => new ExprNS.Binary(left.startToken, right.endToken, left, op, right) %}
  | unary_expr                                    {% id %}

mul_op ->
    %star        {% ([t]) => toAstToken(t) %}
  | %slash       {% ([t]) => toAstToken(t) %}
  | %percent     {% ([t]) => toAstToken(t) %}
  | %doubleslash {% ([t]) => toAstToken(t) %}

unary_expr ->
    %plus _ unary_expr
      {% ([op,, arg]) => new ExprNS.Unary(toAstToken(op), arg.endToken, toAstToken(op), arg) %}
  | %minus _ unary_expr
      {% ([op,, arg]) => new ExprNS.Unary(toAstToken(op), arg.endToken, toAstToken(op), arg) %}
  | pow_expr                                      {% id %}

pow_expr ->
    post_expr _ %doublestar _ unary_expr
      {% ([left,, op,, right]) => new ExprNS.Binary(left.startToken, right.endToken, left, toAstToken(op), right) %}
  | post_expr                                     {% id %}

post_expr ->
    post_expr %lsqb _ expression _ %rsqb
      {% ([obj, ,, idx,, rsqb]) => new ExprNS.Subscript(obj.startToken, toAstToken(rsqb), obj, idx) %}
  | post_expr "(" _ expressions _ ")"
      {% ([callee,,, args,, rparen]) => new ExprNS.Call(callee.startToken, toAstToken(rparen), callee, args) %}
  | post_expr "(" _ ")"
      {% ([callee,,, rparen]) => new ExprNS.Call(callee.startToken, toAstToken(rparen), callee, []) %}
  | atom                                      {% id %}

# ============================================================================
# atom (literals, variables, grouping, lists)
# ============================================================================

atom ->
    "(" _ expression _ ")"
      {% ([,, e]) => new ExprNS.Grouping(e.startToken, e.endToken, e) %}
  | %lsqb _ %rsqb
      {% ([l,, r]) => new ExprNS.List(toAstToken(l), toAstToken(r), []) %}
  | %lsqb _ expressions _ %rsqb
      {% ([l,, elems,, r]) => new ExprNS.List(toAstToken(l), toAstToken(r), elems) %}
  | %name
      {% ([t]) => { const tok = toAstToken(t); return new ExprNS.Variable(tok, tok, tok); } %}
  | %number_float
      {% ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, parseFloat(t.value)); } %}
  | %number_int
      {% ([t]) => { const tok = toAstToken(t); return new ExprNS.BigIntLiteral(tok, tok, t.value); } %}
  | %number_hex
      {% ([t]) => { const tok = toAstToken(t); return new ExprNS.BigIntLiteral(tok, tok, t.value); } %}
  | %number_oct
      {% ([t]) => { const tok = toAstToken(t); return new ExprNS.BigIntLiteral(tok, tok, t.value); } %}
  | %number_bin
      {% ([t]) => { const tok = toAstToken(t); return new ExprNS.BigIntLiteral(tok, tok, t.value); } %}
  | %number_complex
      {% ([t]) => { const tok = toAstToken(t); return new ExprNS.Complex(tok, tok, t.value); } %}
  | string_lit                                   {% id %}
  | "None"
      {% ([t]) => { const tok = toAstToken(t); return new ExprNS.None(tok, tok); } %}
  | "True"
      {% ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, true); } %}
  | "False"
      {% ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, false); } %}

# ============================================================================
# lambda_expr                                    [python_1_bnf.tex line 44]
# ============================================================================

lambda_expr ->
    "lambda" _ names _ ":" _ expression
      {% ([kw,, params,,,, body]) => new ExprNS.Lambda(toAstToken(kw), body.endToken, params, body) %}
  | "lambda" _ names _ %doublecolon _ block
      {% ([kw,, params,,,, body]) =>
           new ExprNS.MultiLambda(toAstToken(kw), body[body.length-1].endToken, params, body, []) %}
  | "lambda" _ ":" _ expression
      {% ([kw,,,, body]) => new ExprNS.Lambda(toAstToken(kw), body.endToken, [], body) %}
  | "lambda" _ %doublecolon _ block
      {% ([kw,,,, body]) =>
           new ExprNS.MultiLambda(toAstToken(kw), body[body.length-1].endToken, [], body, []) %}

# ============================================================================
# binary-operator, unary-operator, binary-logical [python_1_bnf.tex lines 47-50]
# (handled inline in the precedence cascade above)
# ============================================================================

# ============================================================================
# expressions ::= ...                            [python_1_bnf.tex line 51]
# ============================================================================

expressions ->
    expression                                {% list %}
  | expressions _ "," _ expression            {% ([as,,,, a]) => [...as, a] %}
  | expression _ ","                          {% list %}

# ============================================================================
# string_lit — string literals
# ============================================================================

string_lit ->
    %string_triple_double  {% ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, stripQuotes(t.value)); } %}
  | %string_triple_single  {% ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, stripQuotes(t.value)); } %}
  | %string_double         {% ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, stripQuotes(t.value)); } %}
  | %string_single         {% ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, stripQuotes(t.value)); } %}

# ============================================================================
# Whitespace rules
# ============================================================================

_ -> null | %ws
__ -> %ws

# Whitespace including newlines, indents, dedents (for inside parentheses)
_nl -> null          {% id %}
  | _nl %ws          {% id %}
  | _nl %newline     {% id %}
  | _nl %indent      {% id %}
  | _nl %dedent      {% id %}
