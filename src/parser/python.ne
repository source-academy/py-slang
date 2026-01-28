# Nearley grammar for Python subset (Source Academy)
# Produces plain tagged-union AST nodes

@preprocessor esmodule

@{%
import { pythonLexer } from './lexer';

// ============================================================================
// AST Node Factories - minimal tagged unions, no token tracking
// ============================================================================

const Expr = {
  literal:     (value) => ({ tag: 'Literal', value }),
  bigInt:      (value) => ({ tag: 'BigIntLiteral', value }),
  complex:     (value) => ({ tag: 'Complex', value }),
  variable:    (name) => ({ tag: 'Variable', name }),
  binary:      (left, op, right) => ({ tag: 'Binary', left, op, right }),
  compare:     (left, op, right) => ({ tag: 'Compare', left, op, right }),
  boolOp:      (left, op, right) => ({ tag: 'BoolOp', left, op, right }),
  unary:       (op, arg) => ({ tag: 'Unary', op, arg }),
  ternary:     (test, cons, alt) => ({ tag: 'Ternary', test, cons, alt }),
  lambda:      (params, body) => ({ tag: 'Lambda', params, body }),
  multiLambda: (params, body) => ({ tag: 'MultiLambda', params, body }),
  call:        (callee, args) => ({ tag: 'Call', callee, args }),
  group:       (expr) => ({ tag: 'Group', expr }),
  none:        () => ({ tag: 'None' }),
};

const Stmt = {
  pass:       () => ({ tag: 'Pass' }),
  break_:     () => ({ tag: 'Break' }),
  continue_:  () => ({ tag: 'Continue' }),
  return_:    (value) => ({ tag: 'Return', value }),
  assign:     (name, value) => ({ tag: 'Assign', name, value }),
  annAssign:  (name, ann, value) => ({ tag: 'AnnAssign', name, ann, value }),
  expr:       (expr) => ({ tag: 'Expr', expr }),
  if_:        (test, body, else_) => ({ tag: 'If', test, body, else: else_ }),
  while_:     (test, body) => ({ tag: 'While', test, body }),
  for_:       (target, iter, body) => ({ tag: 'For', target, iter, body }),
  funcDef:    (name, params, body) => ({ tag: 'FunctionDef', name, params, body }),
  fromImport: (module, names) => ({ tag: 'FromImport', module, names }),
  global:     (name) => ({ tag: 'Global', name }),
  nonlocal:   (name) => ({ tag: 'NonLocal', name }),
  assert:     (test) => ({ tag: 'Assert', test }),
  file:       (stmts) => ({ tag: 'File', stmts }),
};

// ============================================================================
// Helpers
// ============================================================================

const id = ([x]) => x;
const nil = () => null;
const val = ([t]) => t.value;
const list = ([x]) => [x];
const append = ([xs,,,, x]) => [...xs, x];
const cons = ([xs, x]) => [...xs, x];
const drop = () => [];
%}

@lexer pythonLexer

# ============================================================================
# Program
# ============================================================================

file -> _ stmts _ %EOF                        {% ([, stmts]) => Stmt.file(stmts) %}

stmts ->
    null                                      {% drop %}
  | stmts stmt                                {% cons %}
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

pass_stmt     -> %kw_pass                     {% () => Stmt.pass() %}
break_stmt    -> %kw_break                    {% () => Stmt.break_() %}
continue_stmt -> %kw_continue                 {% () => Stmt.continue_() %}

return_stmt ->
    %kw_return _ test                         {% ([,, expr]) => Stmt.return_(expr) %}
  | %kw_return                                {% () => Stmt.return_(null) %}

assign_stmt ->
    %identifier _ ":" _ test _ "=" _ test     {% ([n,,,, ann,,,, v]) => Stmt.annAssign(n.value, ann, v) %}
  | %identifier _ ":" _ test                  {% ([n,,,, ann]) => Stmt.annAssign(n.value, ann, null) %}
  | %identifier _ "=" _ test                  {% ([n,,,, v]) => Stmt.assign(n.value, v) %}

import_stmt ->
    %kw_from _ %identifier _ %kw_import _ import_names
                                              {% ([,, mod,,,, names]) => Stmt.fromImport(mod.value, names) %}

import_names ->
    %identifier                               {% ([t]) => [t.value] %}
  | "(" _ name_list _ ")"                     {% ([,, ns]) => ns %}

name_list ->
    %identifier                               {% ([t]) => [t.value] %}
  | name_list _ "," _ %identifier             {% ([ns,,,, t]) => [...ns, t.value] %}

global_stmt   -> %kw_global _ %identifier     {% ([,, n]) => Stmt.global(n.value) %}
nonlocal_stmt -> %kw_nonlocal _ %identifier   {% ([,, n]) => Stmt.nonlocal(n.value) %}
assert_stmt   -> %kw_assert _ test            {% ([,, e]) => Stmt.assert(e) %}
expr_stmt     -> test                         {% ([e]) => Stmt.expr(e) %}

# ============================================================================
# Compound statements
# ============================================================================

compound_stmt -> if_stmt {% id %} | while_stmt {% id %} | for_stmt {% id %} | funcdef {% id %}

if_stmt ->
    %kw_if _ test _ ":" _ suite elif_chain    {% ([,, test,,,, body, else_]) => Stmt.if_(test, body, else_) %}

elif_chain ->
    %kw_elif _ test _ ":" _ suite elif_chain  {% ([,, test,,,, body, else_]) => [Stmt.if_(test, body, else_)] %}
  | %kw_else _ ":" _ suite                    {% ([,,,, body]) => body %}
  | null                                      {% nil %}

while_stmt ->
    %kw_while _ test _ ":" _ suite            {% ([,, test,,,, body]) => Stmt.while_(test, body) %}

for_stmt ->
    %kw_for _ %identifier _ %kw_in _ test _ ":" _ suite
                                              {% ([,, target,,,, iter,,,, body]) => Stmt.for_(target.value, iter, body) %}

funcdef ->
    %kw_def _ %identifier _ params _ ":" _ suite
                                              {% ([,, name,, params,,,, body]) => Stmt.funcDef(name.value, params, body) %}

params ->
    "(" _ ")"                                 {% drop %}
  | "(" _ param_list _ ")"                    {% ([,, ps]) => ps %}

param_list ->
    %identifier                               {% ([t]) => [t.value] %}
  | param_list _ "," _ %identifier            {% ([ps,,,, t]) => [...ps, t.value] %}

suite ->
    simple_stmt                               {% list %}
  | %newline %INDENT suite_stmts %DEDENT      {% ([, , stmts]) => stmts %}

suite_stmts ->
    stmt                                      {% list %}
  | suite_stmts stmt                          {% cons %}
  | suite_stmts %newline                      {% id %}

# ============================================================================
# Expressions
# ============================================================================

test ->
    or_test _ %kw_if _ or_test _ %kw_else _ test
                                              {% ([cons,,,, test,,,, alt]) => Expr.ternary(test, cons, alt) %}
  | or_test                                   {% id %}
  | lambdef                                   {% id %}

lambdef ->
    %kw_lambda _ param_list _ ":" _ test      {% ([,, params,,,, body]) => Expr.lambda(params, body) %}
  | %kw_lambda _ param_list _ "::" _ suite    {% ([,, params,,,, body]) => Expr.multiLambda(params, body) %}
  | %kw_lambda _ ":" _ test                   {% ([,,,, body]) => Expr.lambda([], body) %}
  | %kw_lambda _ "::" _ suite                 {% ([,,,, body]) => Expr.multiLambda([], body) %}

or_test ->
    and_test _ %kw_or _ or_test               {% ([left,, op,, right]) => Expr.boolOp(left, 'or', right) %}
  | and_test                                  {% id %}

and_test ->
    not_test _ %kw_and _ and_test             {% ([left,, op,, right]) => Expr.boolOp(left, 'and', right) %}
  | not_test                                  {% id %}

not_test ->
    %kw_not _ not_test                        {% ([,, arg]) => Expr.unary('not', arg) %}
  | comparison                                {% id %}

comparison ->
    arith _ comp_op _ comparison              {% ([left,, op,, right]) => Expr.compare(left, op, right) %}
  | arith                                     {% id %}

comp_op ->
    %less             {% () => '<' %}
  | %greater          {% () => '>' %}
  | %doubleequal      {% () => '==' %}
  | %greaterequal     {% () => '>=' %}
  | %lessequal        {% () => '<=' %}
  | %notequal         {% () => '!=' %}
  | %kw_in            {% () => 'in' %}
  | %kw_not _ %kw_in  {% () => 'not in' %}
  | %kw_is            {% () => 'is' %}
  | %kw_is _ %kw_not  {% () => 'is not' %}

arith ->
    term _ arith_op _ arith                   {% ([left,, op,, right]) => Expr.binary(left, op, right) %}
  | term                                      {% id %}

arith_op -> %plus {% () => '+' %} | %minus {% () => '-' %}

term ->
    factor _ term_op _ term                   {% ([left,, op,, right]) => Expr.binary(left, op, right) %}
  | factor                                    {% id %}

term_op ->
    %star        {% () => '*' %}
  | %slash       {% () => '/' %}
  | %percent     {% () => '%' %}
  | %doubleslash {% () => '//' %}

factor ->
    %plus _ factor                            {% ([,, arg]) => Expr.unary('+', arg) %}
  | %minus _ factor                           {% ([,, arg]) => Expr.unary('-', arg) %}
  | power                                     {% id %}

power ->
    atom_expr _ %doublestar _ factor          {% ([left,,,, right]) => Expr.binary(left, '**', right) %}
  | atom_expr                                 {% id %}

atom_expr ->
    atom "(" _ args _ ")"                     {% ([callee,, , args]) => Expr.call(callee, args) %}
  | atom "(" _ ")"                            {% ([callee]) => Expr.call(callee, []) %}
  | atom                                      {% id %}

args ->
    test                                      {% list %}
  | args _ "," _ test                         {% ([as,,,, a]) => [...as, a] %}
  | test _ ","                                {% list %}

atom ->
    "(" _ test _ ")"                          {% ([,, e]) => Expr.group(e) %}
  | %identifier                               {% ([t]) => Expr.variable(t.value) %}
  | %float                                    {% ([t]) => Expr.literal(parseFloat(t.value)) %}
  | %bigint                                   {% ([t]) => Expr.bigInt(t.value) %}
  | %complex                                  {% ([t]) => Expr.complex(t.value) %}
  | string                                    {% id %}
  | %kw_None                                  {% () => Expr.none() %}
  | %kw_True                                  {% () => Expr.literal(true) %}
  | %kw_False                                 {% () => Expr.literal(false) %}

string ->
    %stringTripleDouble                       {% ([t]) => Expr.literal(t.value) %}
  | %stringTripleSingle                       {% ([t]) => Expr.literal(t.value) %}
  | %stringDouble                             {% ([t]) => Expr.literal(t.value) %}
  | %stringSingle                             {% ([t]) => Expr.literal(t.value) %}

# Whitespace
_ -> null | %ws
__ -> %ws

