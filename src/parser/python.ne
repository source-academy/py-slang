# Nearley grammar for Python subset (Source Academy)
# Produces class-based AST nodes

@preprocessor esmodule

@{%
import { StmtNS, ExprNS } from '../ast-types';
import pythonLexer from './lexer';
import { toAstToken } from './token-bridge';

const nil = () => null;
const list = ([x]) => [x];
const cons = ([xs, x]) => [...xs, x];
const drop = () => [];
%}

@lexer pythonLexer

# ============================================================================
# Program
# ============================================================================

file -> stmts
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

stmts ->
    null                                      {% drop %}
  | stmts stmt                                {% ([xs, x]) => x ? [...xs, x] : xs %}
  | stmts %newline                            {% id %}

stmt -> simple_stmt {% id %} | compound_stmt {% id %}

# ============================================================================
# Simple statements
# ============================================================================

simple_stmt -> small_stmt %newline            {% id %}

small_stmt ->
    pass_stmt     {% id %}
  | break_stmt    {% id %}
  | continue_stmt {% id %}
  | return_stmt   {% id %}
  | assign_stmt   {% id %}
  | import_stmt   {% id %}
  | global_stmt   {% id %}
  | nonlocal_stmt {% id %}
  | assert_stmt   {% id %}
  | expr_stmt     {% id %}

pass_stmt -> %kw_pass
  {% ([t]) => { const tok = toAstToken(t); return new StmtNS.Pass(tok, tok); } %}

break_stmt -> %kw_break
  {% ([t]) => { const tok = toAstToken(t); return new StmtNS.Break(tok, tok); } %}

continue_stmt -> %kw_continue
  {% ([t]) => { const tok = toAstToken(t); return new StmtNS.Continue(tok, tok); } %}

return_stmt ->
    %kw_return _ test
      {% ([kw,, expr]) => new StmtNS.Return(toAstToken(kw), expr.endToken, expr) %}
  | %kw_return
      {% ([t]) => { const tok = toAstToken(t); return new StmtNS.Return(tok, tok, null); } %}

assign_stmt ->
    %identifier _ ":" _ test _ "=" _ test
      {% ([n,,,, ann,,,, v]) => new StmtNS.AnnAssign(toAstToken(n), v.endToken, toAstToken(n), v, ann) %}
  | %identifier _ ":" _ test
      {% ([n,,,, ann]) => {
           const nameTok = toAstToken(n);
           const dummyVal = new ExprNS.None(ann.endToken, ann.endToken);
           return new StmtNS.AnnAssign(nameTok, ann.endToken, nameTok, dummyVal, ann);
         } %}
  | %identifier _ "=" _ test
      {% ([n,,,, v]) => new StmtNS.Assign(toAstToken(n), v.endToken, toAstToken(n), v) %}

import_stmt ->
    %kw_from _ %identifier _ %kw_import _ import_names
      {% ([kw,, mod,,,, names]) => new StmtNS.FromImport(toAstToken(kw), names[names.length-1], toAstToken(mod), names) %}

import_names ->
    %identifier                               {% ([t]) => [toAstToken(t)] %}
  | "(" _ name_list _ ")"                    {% ([,, ns]) => ns %}

name_list ->
    %identifier                               {% ([t]) => [toAstToken(t)] %}
  | name_list _ "," _ %identifier            {% ([ns,,,, t]) => [...ns, toAstToken(t)] %}

global_stmt -> %kw_global _ %identifier
  {% ([kw,, n]) => new StmtNS.Global(toAstToken(kw), toAstToken(n), toAstToken(n)) %}

nonlocal_stmt -> %kw_nonlocal _ %identifier
  {% ([kw,, n]) => new StmtNS.NonLocal(toAstToken(kw), toAstToken(n), toAstToken(n)) %}

assert_stmt -> %kw_assert _ test
  {% ([kw,, e]) => new StmtNS.Assert(toAstToken(kw), e.endToken, e) %}

expr_stmt -> test
  {% ([e]) => new StmtNS.SimpleExpr(e.startToken, e.endToken, e) %}

# ============================================================================
# Compound statements
# ============================================================================

compound_stmt -> if_stmt {% id %} | while_stmt {% id %} | for_stmt {% id %} | funcdef {% id %}

if_stmt ->
    %kw_if _ test _ ":" _ suite elif_chain
      {% ([kw,, test,,,, body, else_]) =>
           new StmtNS.If(toAstToken(kw),
             (else_ && else_.length > 0) ? else_[else_.length-1].endToken : body[body.length-1].endToken,
             test, body, else_) %}

elif_chain ->
    %kw_elif _ test _ ":" _ suite elif_chain
      {% ([kw,, test,,,, body, else_]) => [new StmtNS.If(toAstToken(kw),
           (else_ && else_.length > 0) ? else_[else_.length-1].endToken : body[body.length-1].endToken,
           test, body, else_)] %}
  | %kw_else _ ":" _ suite                   {% ([,,,, body]) => body %}
  | null                                      {% nil %}

while_stmt ->
    %kw_while _ test _ ":" _ suite
      {% ([kw,, test,,,, body]) =>
           new StmtNS.While(toAstToken(kw), body[body.length-1].endToken, test, body) %}

for_stmt ->
    %kw_for _ %identifier _ %kw_in _ test _ ":" _ suite
      {% ([kw,, target,,,, iter,,,, body]) =>
           new StmtNS.For(toAstToken(kw), body[body.length-1].endToken, toAstToken(target), iter, body) %}

funcdef ->
    %kw_def _ %identifier _ params _ ":" _ suite
      {% ([kw,, name,, params,,,, body]) =>
           new StmtNS.FunctionDef(toAstToken(kw), body[body.length-1].endToken,
             toAstToken(name), params, body, []) %}

params ->
    "(" _ ")"                                 {% drop %}
  | "(" _ param_list _ ")"                    {% ([,, ps]) => ps %}

param_list ->
    %identifier                               {% ([t]) => [toAstToken(t)] %}
  | param_list _ "," _ %identifier            {% ([ps,,,, t]) => [...ps, toAstToken(t)] %}

suite ->
    simple_stmt                               {% list %}
  | %newline %indent suite_stmts %dedent      {% ([,, stmts]) => stmts %}

suite_stmts ->
    _ stmt                          {% ([, s]) => [s] %}
  | suite_stmts _ stmt              {% ([xs,, s]) => [...xs, s] %}
  | suite_stmts %newline            {% id %}

# ============================================================================
# Expressions
# ============================================================================

test ->
    or_test _ %kw_if _ or_test _ %kw_else _ test
      {% ([cons,,,, test,,,, alt]) => new ExprNS.Ternary(cons.startToken, alt.endToken, test, cons, alt) %}
  | or_test                                   {% id %}
  | lambdef                                   {% id %}

lambdef ->
    %kw_lambda _ param_list _ ":" _ test
      {% ([kw,, params,,,, body]) => new ExprNS.Lambda(toAstToken(kw), body.endToken, params, body) %}
  | %kw_lambda _ param_list _ "::" _ suite
      {% ([kw,, params,,,, body]) =>
           new ExprNS.MultiLambda(toAstToken(kw), body[body.length-1].endToken, params, body, []) %}
  | %kw_lambda _ ":" _ test
      {% ([kw,,,, body]) => new ExprNS.Lambda(toAstToken(kw), body.endToken, [], body) %}
  | %kw_lambda _ "::" _ suite
      {% ([kw,,,, body]) =>
           new ExprNS.MultiLambda(toAstToken(kw), body[body.length-1].endToken, [], body, []) %}

or_test ->
    and_test _ %kw_or _ or_test
      {% ([left,, op,, right]) => new ExprNS.BoolOp(left.startToken, right.endToken, left, toAstToken(op), right) %}
  | and_test                                  {% id %}

and_test ->
    not_test _ %kw_and _ and_test
      {% ([left,, op,, right]) => new ExprNS.BoolOp(left.startToken, right.endToken, left, toAstToken(op), right) %}
  | not_test                                  {% id %}

not_test ->
    %kw_not _ not_test
      {% ([op,, arg]) => new ExprNS.Unary(toAstToken(op), arg.endToken, toAstToken(op), arg) %}
  | comparison                                {% id %}

comparison ->
    arith _ comp_op _ comparison
      {% ([left,, op,, right]) => new ExprNS.Compare(left.startToken, right.endToken, left, op, right) %}
  | arith                                     {% id %}

comp_op ->
    %less             {% ([t]) => toAstToken(t) %}
  | %greater          {% ([t]) => toAstToken(t) %}
  | %doubleequal      {% ([t]) => toAstToken(t) %}
  | %greaterequal     {% ([t]) => toAstToken(t) %}
  | %lessequal        {% ([t]) => toAstToken(t) %}
  | %notequal         {% ([t]) => toAstToken(t) %}
  | %kw_in            {% ([t]) => toAstToken(t) %}
  | %kw_not _ %kw_in  {% ([t]) => toAstToken(t) %}
  | %kw_is            {% ([t]) => toAstToken(t) %}
  | %kw_is _ %kw_not  {% ([t]) => toAstToken(t) %}

arith ->
    term _ arith_op _ arith
      {% ([left,, op,, right]) => new ExprNS.Binary(left.startToken, right.endToken, left, op, right) %}
  | term                                      {% id %}

arith_op -> %plus {% ([t]) => toAstToken(t) %} | %minus {% ([t]) => toAstToken(t) %}

term ->
    factor _ term_op _ term
      {% ([left,, op,, right]) => new ExprNS.Binary(left.startToken, right.endToken, left, op, right) %}
  | factor                                    {% id %}

term_op ->
    %star        {% ([t]) => toAstToken(t) %}
  | %slash       {% ([t]) => toAstToken(t) %}
  | %percent     {% ([t]) => toAstToken(t) %}
  | %doubleslash {% ([t]) => toAstToken(t) %}

factor ->
    %plus _ factor
      {% ([op,, arg]) => new ExprNS.Unary(toAstToken(op), arg.endToken, toAstToken(op), arg) %}
  | %minus _ factor
      {% ([op,, arg]) => new ExprNS.Unary(toAstToken(op), arg.endToken, toAstToken(op), arg) %}
  | power                                     {% id %}

power ->
    atom_expr _ %doublestar _ factor
      {% ([left,, op,, right]) => new ExprNS.Binary(left.startToken, right.endToken, left, toAstToken(op), right) %}
  | atom_expr                                 {% id %}

atom_expr ->
    atom_expr %lsqb _ test _ %rsqb
      {% ([obj, ,, idx,, rsqb]) => new ExprNS.Subscript(obj.startToken, toAstToken(rsqb), obj, idx) %}
  | atom "(" _ args _ ")"
      {% ([callee,,,  args,, rparen]) => new ExprNS.Call(callee.startToken, toAstToken(rparen), callee, args) %}
  | atom "(" _ ")"
      {% ([callee,,, rparen]) => new ExprNS.Call(callee.startToken, toAstToken(rparen), callee, []) %}
  | atom                                      {% id %}

args ->
    test                                      {% list %}
  | args _ "," _ test                         {% ([as,,,, a]) => [...as, a] %}
  | test _ ","                                {% list %}

atom ->
    "(" _ test _ ")"
      {% ([,, e]) => new ExprNS.Grouping(e.startToken, e.endToken, e) %}
  | %lsqb _ %rsqb
      {% ([l,, r]) => new ExprNS.List(toAstToken(l), toAstToken(r), []) %}
  | %lsqb _ args _ %rsqb
      {% ([l,, elems,, r]) => new ExprNS.List(toAstToken(l), toAstToken(r), elems) %}
  | %identifier
      {% ([t]) => { const tok = toAstToken(t); return new ExprNS.Variable(tok, tok, tok); } %}
  | %float
      {% ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, parseFloat(t.value)); } %}
  | %bigint
      {% ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, parseInt(t.value, 10)); } %}
  | %complex
      {% ([t]) => { const tok = toAstToken(t); return new ExprNS.Complex(tok, tok, t.value); } %}
  | string                                    {% id %}
  | %kw_None
      {% ([t]) => { const tok = toAstToken(t); return new ExprNS.None(tok, tok); } %}
  | %kw_True
      {% ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, true); } %}
  | %kw_False
      {% ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, false); } %}

string ->
    %stringTripleDouble  {% ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, t.value); } %}
  | %stringTripleSingle  {% ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, t.value); } %}
  | %stringDouble        {% ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, t.value); } %}
  | %stringSingle        {% ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, t.value); } %}

# Whitespace
_ -> null | %ws
__ -> %ws
