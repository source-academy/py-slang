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
%}

@lexer pythonLexer

# ============================================================================
# program ::= import-stmt ... block              [python_1_bnf.tex line 18]
#
# Enforces: imports come before statements.  An import after a statement
# is a parse error.
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

# program_stmts: single list of imports and statements.
# import_stmt is NOT a statement alternative, so it can only appear here.
# The postprocessor enforces imports-before-statements ordering.
program_stmts ->
    null                                          {% drop %}
  | program_stmts import_stmt %newline           {% ([xs, imp]) => {
       // Enforce: no imports after statements
       if (xs && xs.some(s => !(s instanceof StmtNS.FromImport))) {
         throw new Error('Import statements must appear before other statements');
       }
       return [...xs, imp];
     } %}
  | program_stmts statement                      {% ([xs, x]) => x ? [...xs, x] : xs %}
  | program_stmts %newline                       {% id %}

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
dotted_name -> %name
  {% ([t]) => toAstToken(t) %}
  | dotted_name "." %name
  {% ([left,, right]) => {
       const tok = toAstToken(right);
       tok.lexeme = left.lexeme + '.' + tok.lexeme;
       tok.col = left.col;
       tok.indexInSource = left.indexInSource;
       return tok;
     } %}

# import-clause ::= import-as-names | ( import-as-names ) [python_1_bnf.tex line 21-22]
import_clause ->
    import_as_names  {% id %}
  | "(" _nl import_as_names _nl ")"  {% ([,, ns]) => ns %}

# import-as-names ::= import-as-name (, import-as-name)... [python_1_bnf.tex line 23]
import_as_names ->
    import_as_name  {% ([t]) => [t] %}
  | import_as_names "," import_as_name  {% ([ns,, t]) => [...ns, t] %}

# import-as-name ::= name [ as name ]                     [python_1_bnf.tex line 24]
import_as_name ->
    %name  {% ([t]) => ({ name: toAstToken(t), alias: null }) %}
  | %name "as" %name  {% ([t,, a]) => ({ name: toAstToken(t), alias: toAstToken(a) }) %}

# ============================================================================
# statement                                      [python_1_bnf.tex lines 25-29]
# ============================================================================

statement ->
    statementLine %newline                       {% id %}
  | "if" expression ":" block elif_chain
      {% ([kw, test,, body, else_]) =>
           new StmtNS.If(toAstToken(kw),
             (else_ && else_.length > 0) ? else_[else_.length-1].endToken : body[body.length-1].endToken,
             test, body, else_) %}
  | "while" expression ":" block
      {% ([kw, test,, body]) =>
           new StmtNS.While(toAstToken(kw), body[body.length-1].endToken, test, body) %}
  | "for" %name "in" expression ":" block
      {% ([kw, target,, iter,, body]) =>
           new StmtNS.For(toAstToken(kw), body[body.length-1].endToken, toAstToken(target), iter, body) %}
  | "def" %name params ":" block
      {% ([kw, name, params,, body]) =>
           new StmtNS.FunctionDef(toAstToken(kw), body[body.length-1].endToken,
             toAstToken(name), params, body, []) %}

# statementLine — simple statements that need a trailing newline
statementLine ->
    "pass"
      {% ([t]) => { const tok = toAstToken(t); return new StmtNS.Pass(tok, tok); } %}
  | "break"
      {% ([t]) => { const tok = toAstToken(t); return new StmtNS.Break(tok, tok); } %}
  | "continue"
      {% ([t]) => { const tok = toAstToken(t); return new StmtNS.Continue(tok, tok); } %}
  | "return" expression
      {% ([kw, expr]) => new StmtNS.Return(toAstToken(kw), expr.endToken, expr) %}
  | "return"
      {% ([t]) => { const tok = toAstToken(t); return new StmtNS.Return(tok, tok, null); } %}
  | %name ":" expression "=" expression
      {% ([n,, ann,, v]) => { const tok = toAstToken(n); return new StmtNS.AnnAssign(tok, v.endToken, new ExprNS.Variable(tok, tok, tok), v, ann); } %}
  | %name ":" expression
      {% ([n,, ann]) => {
           const nameTok = toAstToken(n);
           const dummyVal = new ExprNS.None(ann.endToken, ann.endToken);
           return new StmtNS.AnnAssign(nameTok, ann.endToken, new ExprNS.Variable(nameTok, nameTok, nameTok), dummyVal, ann);
         } %}
  | %name "=" expression
      {% ([n,, v]) => { const tok = toAstToken(n); return new StmtNS.Assign(tok, v.endToken, new ExprNS.Variable(tok, tok, tok), v); } %}
  | expressionPost %lsqb expression %rsqb "=" expression
      {% function(d) {
           var obj = d[0], idx = d[2], rsqb = d[3], val = d[5];
           var sub = new ExprNS.Subscript(obj.startToken, toAstToken(rsqb), obj, idx);
           return new StmtNS.Assign(obj.startToken, val.endToken, sub, val);
         } %}
  | "global" %name
      {% ([kw, n]) => new StmtNS.Global(toAstToken(kw), toAstToken(n), toAstToken(n)) %}
  | "nonlocal" %name
      {% ([kw, n]) => new StmtNS.NonLocal(toAstToken(kw), toAstToken(n), toAstToken(n)) %}
  | "assert" expression
      {% ([kw, e]) => new StmtNS.Assert(toAstToken(kw), e.endToken, e) %}
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

elif_chain ->
    "elif" expression ":" block elif_chain
      {% ([kw, test,, body, else_]) => [new StmtNS.If(toAstToken(kw),
           (else_ && else_.length > 0) ? else_[else_.length-1].endToken : body[body.length-1].endToken,
           test, body, else_)] %}
  | "else" ":" block                            {% ([,, body]) => body %}
  | null                                        {% nil %}

# ============================================================================
# block ::= statement...                         [python_1_bnf.tex line 34]
# ============================================================================

block ->
    statementLine %newline                   {% list %}
  | %newline %indent blockStmts %dedent      {% ([,, stmts]) => stmts %}

blockStmts ->
    statement                                 {% ([s]) => [s] %}
  | blockStmts statement                     {% ([xs, s]) => [...xs, s] %}
  | blockStmts %newline                      {% id %}

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
    expressionOr "or" expressionAnd
      {% ([left, op, right]) => new ExprNS.BoolOp(left.startToken, right.endToken, left, toAstToken(op), right) %}
  | expressionAnd                                  {% id %}

expressionAnd ->
    expressionAnd "and" expressionNot
      {% ([left, op, right]) => new ExprNS.BoolOp(left.startToken, right.endToken, left, toAstToken(op), right) %}
  | expressionNot                                  {% id %}

expressionNot ->
    "not" expressionNot
      {% ([op, arg]) => new ExprNS.Unary(toAstToken(op), arg.endToken, toAstToken(op), arg) %}
  | expressionCmp                                  {% id %}

expressionCmp ->
    expressionCmp expressionCmpOp expressionAdd
      {% ([left, op, right]) => new ExprNS.Compare(left.startToken, right.endToken, left, op, right) %}
  | expressionAdd                                  {% id %}

expressionCmpOp ->
    %less             {% ([t]) => toAstToken(t) %}
  | %greater          {% ([t]) => toAstToken(t) %}
  | %doubleequal      {% ([t]) => toAstToken(t) %}
  | %greaterequal     {% ([t]) => toAstToken(t) %}
  | %lessequal        {% ([t]) => toAstToken(t) %}
  | %notequal         {% ([t]) => toAstToken(t) %}
  | "in"              {% ([t]) => toAstToken(t) %}
  | "not" "in"        {% ([t]) => { const tok = toAstToken(t); tok.lexeme = 'not in'; return tok; } %}
  | "is"              {% ([t]) => toAstToken(t) %}
  | "is" "not"        {% ([t]) => { const tok = toAstToken(t); tok.lexeme = 'is not'; return tok; } %}

expressionAdd ->
    expressionAdd expressionAddOp expressionMul
      {% ([left, op, right]) => new ExprNS.Binary(left.startToken, right.endToken, left, op, right) %}
  | expressionMul                                  {% id %}

expressionAddOp -> %plus {% ([t]) => toAstToken(t) %} | %minus {% ([t]) => toAstToken(t) %}

expressionMul ->
    expressionMul expressionMulOp expressionUnary
      {% ([left, op, right]) => new ExprNS.Binary(left.startToken, right.endToken, left, op, right) %}
  | expressionUnary                                {% id %}

expressionMulOp ->
    %star        {% ([t]) => toAstToken(t) %}
  | %slash       {% ([t]) => toAstToken(t) %}
  | %percent     {% ([t]) => toAstToken(t) %}
  | %doubleslash {% ([t]) => toAstToken(t) %}

expressionUnary ->
    %plus expressionUnary
      {% ([op, arg]) => new ExprNS.Unary(toAstToken(op), arg.endToken, toAstToken(op), arg) %}
  | %minus expressionUnary
      {% ([op, arg]) => new ExprNS.Unary(toAstToken(op), arg.endToken, toAstToken(op), arg) %}
  | expressionPow                                  {% id %}

expressionPow ->
    expressionPost %doublestar expressionUnary
      {% ([left, op, right]) => new ExprNS.Binary(left.startToken, right.endToken, left, toAstToken(op), right) %}
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

expressions ->
    expression                                {% list %}
  | expressions "," expression                {% ([as,, a]) => [...as, a] %}
  | expression ","                            {% list %}

# ============================================================================
# string_lit — string literals
# ============================================================================

string_lit ->
    %string_triple_double  {% ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, stripQuotes(t.value)); } %}
  | %string_triple_single  {% ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, stripQuotes(t.value)); } %}
  | %string_double         {% ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, stripQuotes(t.value)); } %}
  | %string_single         {% ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, stripQuotes(t.value)); } %}

# ============================================================================
# Whitespace rules — only _nl (for inside parens/brackets)
# No _ or __ rules needed — lexer strips %ws tokens
# ============================================================================

_nl -> null          {% id %}
  | _nl %newline     {% id %}
  | _nl %indent      {% id %}
  | _nl %dedent      {% id %}
