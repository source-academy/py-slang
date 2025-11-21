# Nearley grammar for Python subset (Source Academy)
# Based on Grammar.gram but converted to Nearley syntax

@preprocessor esmodule

@{%
import { pythonLexer } from './lexer';
import { ExprNS, StmtNS } from '../ast-types';
import { Token as AstToken } from '../tokenizer/tokenizer';
import { TokenType } from '../tokens';

const tokenTypeMap: { [key: string]: TokenType } = {
  'identifier': TokenType.NAME,
  'float': TokenType.NUMBER,
  'bigint': TokenType.BIGINT,
  'complex': TokenType.COMPLEX,
  'stringTripleDouble': TokenType.STRING,
  'stringTripleSingle': TokenType.STRING,
  'stringDouble': TokenType.STRING,
  'stringSingle': TokenType.STRING,

  'kw_def': TokenType.DEF,
  'kw_if': TokenType.IF,
  'kw_elif': TokenType.ELIF,
  'kw_else': TokenType.ELSE,
  'kw_while': TokenType.WHILE,
  'kw_for': TokenType.FOR,
  'kw_in': TokenType.IN,
  'kw_return': TokenType.RETURN,
  'kw_pass': TokenType.PASS,
  'kw_break': TokenType.BREAK,
  'kw_continue': TokenType.CONTINUE,
  'kw_and': TokenType.AND,
  'kw_or': TokenType.OR,
  'kw_not': TokenType.NOT,
  'kw_is': TokenType.IS,
  'kw_lambda': TokenType.LAMBDA,
  'kw_from': TokenType.FROM,
  'kw_import': TokenType.IMPORT,
  'kw_global': TokenType.GLOBAL,
  'kw_nonlocal': TokenType.NONLOCAL,
  'kw_assert': TokenType.ASSERT,
  'kw_True': TokenType.TRUE,
  'kw_False': TokenType.FALSE,
  'kw_None': TokenType.NONE,

  'doublestar': TokenType.DOUBLESTAR,
  'doubleslash': TokenType.DOUBLESLASH,
  'doubleequal': TokenType.DOUBLEEQUAL,
  'notequal': TokenType.NOTEQUAL,
  'lessequal': TokenType.LESSEQUAL,
  'greaterequal': TokenType.GREATEREQUAL,
  'doublecolon': TokenType.DOUBLECOLON,
  'ellipsis': TokenType.ELLIPSIS,

  'lparen': TokenType.LPAR,
  'rparen': TokenType.RPAR,
  'lsqb': TokenType.LSQB,
  'rsqb': TokenType.RSQB,
  'colon': TokenType.COLON,
  'comma': TokenType.COMMA,
  'plus': TokenType.PLUS,
  'minus': TokenType.MINUS,
  'star': TokenType.STAR,
  'slash': TokenType.SLASH,
  'percent': TokenType.PERCENT,
  'less': TokenType.LESS,
  'greater': TokenType.GREATER,
  'equal': TokenType.EQUAL,
  'dot': TokenType.DOT,
  'semi': TokenType.SEMI,
  'lbrace': TokenType.LBRACE,
  'rbrace': TokenType.RBRACE,

  'INDENT': TokenType.INDENT,
  'DEDENT': TokenType.DEDENT,
  'newline': TokenType.NEWLINE,
  'EOF': TokenType.ENDMARKER,
  'NOTIN': TokenType.NOTIN,
  'ISNOT': TokenType.ISNOT,
};


// Helper to convert moo tokens to AST tokens
function toAstToken(token: any): AstToken {
  const type = tokenTypeMap[token.type] || TokenType.NAME;
  return new AstToken(
    type,
    token.value,
    token.line - 1 || 0,
    token.col || 0,
    token.offset || 0
  );
}

// Helper to get token type string
function tokenType(d: any, index: number): string {
  return d[index]?.type || '';
}
%}

@lexer pythonLexer

# Start symbol
file_input -> 
    _ statements _ %EOF {%
      (d) => {
        const startToken = d[1][0]?.startToken || toAstToken({ type: 'ENDMARKER', value: '', line: 0, col: 0, offset: 0 });
        const endToken = d[1][d[1].length - 1]?.endToken || startToken;
        return new StmtNS.FileInput(startToken, endToken, d[1], []);
      }
    %}

statements ->
    null {% () => [] %}
  | statements statement {% (d) => d[0].concat([d[1]]) %}
  | statements %newline {% (d) => d[0] %}

statement ->
    simple_stmt {% id %}
  | compound_stmt {% id %}

# Simple statements
simple_stmt ->
    small_stmt %newline {% (d) => d[0] %}

small_stmt ->
    assign_stmt {% id %}
  | pass_stmt {% id %}
  | flow_stmt {% id %}
  | import_stmt {% id %}
  | global_stmt {% id %}
  | nonlocal_stmt {% id %}
  | assert_stmt {% id %}
  | expr_stmt {% id %}

assign_stmt ->
    %identifier _ ":" _ test _ "=" _ test {%
      (d) => {
        const name = toAstToken(d[0]);
        const value = d[8];
        const ann = d[4];
        return new StmtNS.AnnAssign(name, value.endToken, name, value, ann);
      }
    %}
  | %identifier _ ":" _ test {%
      (d) => {
        const name = toAstToken(d[0]);
        const ann = d[4];
        const value = new ExprNS.None(name, name, "None");
        return new StmtNS.AnnAssign(name, ann.endToken, name, value, ann);
      }
    %}
  | %identifier _ "=" _ test {%
      (d) => {
        const name = toAstToken(d[0]);
        const value = d[4];
        return new StmtNS.Assign(name, value.endToken, name, value);
      }
    %}

pass_stmt ->
    %kw_pass {%
      (d) => {
        const token = toAstToken(d[0]);
        return new StmtNS.Pass(token, token);
      }
    %}

flow_stmt ->
    break_stmt {% id %}
  | continue_stmt {% id %}
  | return_stmt {% id %}

break_stmt ->
    %kw_break {%
      (d) => {
        const token = toAstToken(d[0]);
        return new StmtNS.Break(token, token);
      }
    %}

continue_stmt ->
    %kw_continue {%
      (d) => {
        const token = toAstToken(d[0]);
        return new StmtNS.Continue(token, token);
      }
    %}

return_stmt ->
    %kw_return _ test {%
      (d) => {
        const token = toAstToken(d[0]);
        return new StmtNS.Return(token, d[2].endToken, d[2]);
      }
    %}
  | %kw_return {%
      (d) => {
        const token = toAstToken(d[0]);
        return new StmtNS.Return(token, token, null);
      }
    %}

import_stmt ->
    %kw_from _ %identifier _ %kw_import _ import_names {%
      (d) => {
        const fromToken = toAstToken(d[0]);
        const module = toAstToken(d[2]);
        const names = d[6];
        return new StmtNS.FromImport(fromToken, names[names.length - 1], module, names);
      }
    %}

import_names ->
    %identifier {% (d) => [toAstToken(d[0])] %}
  | "(" _ name_list _ ")" {% (d) => d[2] %}

name_list ->
    %identifier {% (d) => [toAstToken(d[0])] %}
  | name_list _ "," _ %identifier {% (d) => d[0].concat([toAstToken(d[4])]) %}

global_stmt ->
    %kw_global _ %identifier {%
      (d) => {
        const token = toAstToken(d[0]);
        const name = toAstToken(d[2]);
        return new StmtNS.Global(token, name, name);
      }
    %}

nonlocal_stmt ->
    %kw_nonlocal _ %identifier {%
      (d) => {
        const token = toAstToken(d[0]);
        const name = toAstToken(d[2]);
        return new StmtNS.NonLocal(token, name, name);
      }
    %}

assert_stmt ->
    %kw_assert _ test {%
      (d) => {
        const token = toAstToken(d[0]);
        return new StmtNS.Assert(token, d[2].endToken, d[2]);
      }
    %}

expr_stmt ->
    test {%
      (d) => {
        const expr = d[0];
        return new StmtNS.SimpleExpr(expr.startToken, expr.endToken, expr);
      }
    %}

# Compound statements
compound_stmt ->
    if_stmt {% id %}
  | while_stmt {% id %}
  | for_stmt {% id %}
  | funcdef {% id %}

if_stmt ->
    %kw_if _ test _ ":" _ suite elif_chain {%
      (d) => {
        const ifToken = toAstToken(d[0]);
        const condition = d[2];
        const body = d[6];
        const elseBlock = d[7];
        const endToken = elseBlock ? elseBlock[elseBlock.length - 1]?.endToken : body[body.length - 1]?.endToken;
        return new StmtNS.If(ifToken, endToken, condition, body, elseBlock);
      }
    %}

elif_chain ->
    %kw_elif _ test _ ":" _ suite elif_chain {%
      (d) => {
        const elifToken = toAstToken(d[0]);
        const condition = d[2];
        const body = d[6];
        const elseBlock = d[7];
        const endToken = elseBlock ? elseBlock[elseBlock.length - 1]?.endToken : body[body.length - 1]?.endToken;
        return [new StmtNS.If(elifToken, endToken, condition, body, elseBlock)];
      }
    %}
  | %kw_else _ ":" _ suite {%
      (d) => d[4]
    %}
  | null {% () => null %}

while_stmt ->
    %kw_while _ test _ ":" _ suite {%
      (d) => {
        const whileToken = toAstToken(d[0]);
        const condition = d[2];
        const body = d[6];
        const endToken = body[body.length - 1]?.endToken || whileToken;
        return new StmtNS.While(whileToken, endToken, condition, body);
      }
    %}

for_stmt ->
    %kw_for _ %identifier _ %kw_in _ test _ ":" _ suite {%
      (d) => {
        const forToken = toAstToken(d[0]);
        const target = toAstToken(d[2]);
        const iter = d[6];
        const body = d[10];
        const endToken = body[body.length - 1]?.endToken || forToken;
        return new StmtNS.For(forToken, endToken, target, iter, body);
      }
    %}

funcdef ->
    %kw_def _ %identifier _ parameters _ ":" _ suite {%
      (d) => {
        const defToken = toAstToken(d[0]);
        const name = toAstToken(d[2]);
        const params = d[4];
        const body = d[8];
        const endToken = body[body.length - 1]?.endToken || name;
        return new StmtNS.FunctionDef(defToken, endToken, name, params, body, []);
      }
    %}

parameters ->
    "(" _ ")" {% () => [] %}
  | "(" _ varargslist _ ")" {% (d) => d[2] %}

varargslist ->
    %identifier {% (d) => [toAstToken(d[0])] %}
  | varargslist _ "," _ %identifier {% (d) => d[0].concat([toAstToken(d[4])]) %}

suite ->
    simple_stmt {% (d) => [d[0]] %}
  | %newline %INDENT suite_stmts %DEDENT {% (d) => d[2] %}

suite_stmts ->
    statement {% (d) => [d[0]] %}
  | suite_stmts statement {% (d) => d[0].concat([d[1]]) %}
  | suite_stmts %newline {% (d) => d[0] %}

# Expressions (following precedence)
test ->
    or_test _ %kw_if _ or_test _ %kw_else _ test {%
      (d) => {
        const consequent = d[0];
        const predicate = d[4];
        const alternative = d[8];
        return new ExprNS.Ternary(consequent.startToken, alternative.endToken, predicate, consequent, alternative);
      }
    %}
  | or_test {% id %}
  | lambdef {% id %}

lambdef ->
    %kw_lambda _ varargslist _ ":" _ test {%
      (d) => {
        const lambdaToken = toAstToken(d[0]);
        const params = d[2];
        const body = d[6];
        return new ExprNS.Lambda(lambdaToken, body.endToken, params, body);
      }
    %}
  | %kw_lambda _ varargslist _ "::" _ suite {%
      (d) => {
        const lambdaToken = toAstToken(d[0]);
        const params = d[2];
        const body = d[6];
        const endToken = body[body.length - 1]?.endToken || lambdaToken;
        return new ExprNS.MultiLambda(lambdaToken, endToken, params, body, []);
      }
    %}
  | %kw_lambda _ ":" _ test {%
      (d) => {
        const lambdaToken = toAstToken(d[0]);
        const body = d[4];
        return new ExprNS.Lambda(lambdaToken, body.endToken, [], body);
      }
    %}
  | %kw_lambda _ "::" _ suite {%
      (d) => {
        const lambdaToken = toAstToken(d[0]);
        const body = d[4];
        const endToken = body[body.length - 1]?.endToken || lambdaToken;
        return new ExprNS.MultiLambda(lambdaToken, endToken, [], body, []);
      }
    %}

or_test ->
    and_test _ %kw_or _ or_test {%
      (d) => {
        const left = d[0];
        const operator = toAstToken(d[2]);
        const right = d[4];
        return new ExprNS.BoolOp(left.startToken, right.endToken, left, operator, right);
      }
    %}
  | and_test {% id %}

and_test ->
    not_test _ %kw_and _ and_test {%
      (d) => {
        const left = d[0];
        const operator = toAstToken(d[2]);
        const right = d[4];
        return new ExprNS.BoolOp(left.startToken, right.endToken, left, operator, right);
      }
    %}
  | not_test {% id %}

not_test ->
    %kw_not _ not_test {%
      (d) => {
        const operator = toAstToken(d[0]);
        const right = d[2];
        return new ExprNS.Unary(operator, right.endToken, operator, right);
      }
    %}
  | comparison {% id %}

comparison ->
    arith_expr _ comp_op _ comparison {%
      (d) => {
        const left = d[0];
        const operator = d[2];
        const right = d[4];
        return new ExprNS.Compare(left.startToken, right.endToken, left, operator, right);
      }
    %}
  | arith_expr {% id %}

comp_op ->
    %less {% (d) => toAstToken(d[0]) %}
  | %greater {% (d) => toAstToken(d[0]) %}
  | %doubleequal {% (d) => toAstToken(d[0]) %}
  | %greaterequal {% (d) => toAstToken(d[0]) %}
  | %lessequal {% (d) => toAstToken(d[0]) %}
  | %notequal {% (d) => toAstToken(d[0]) %}
  | %kw_in {% (d) => toAstToken(d[0]) %}
  | %kw_not _ %kw_in {%
      (d) => {
        const token = toAstToken(d[0]);
        token.type = 'NOTIN';
        return token;
      }
    %}
  | %kw_is {%
      (d) => toAstToken(d[0])
    %}
  | %kw_is _ %kw_not {%
      (d) => {
        const token = toAstToken(d[0]);
        token.type = 'ISNOT';
        return token;
      }
    %}

arith_expr ->
    term _ arith_op _ arith_expr {%
      (d) => {
        const left = d[0];
        const operator = d[2];
        const right = d[4];
        return new ExprNS.Binary(left.startToken, right.endToken, left, operator, right);
      }
    %}
  | term {% id %}

arith_op ->
    %plus {% (d) => toAstToken(d[0]) %}
  | %minus {% (d) => toAstToken(d[0]) %}

term ->
    factor _ term_op _ term {%
      (d) => {
        const left = d[0];
        const operator = d[2];
        const right = d[4];
        return new ExprNS.Binary(left.startToken, right.endToken, left, operator, right);
      }
    %}
  | factor {% id %}

term_op ->
    %star {% (d) => toAstToken(d[0]) %}
  | %slash {% (d) => toAstToken(d[0]) %}
  | %percent {% (d) => toAstToken(d[0]) %}
  | %doubleslash {% (d) => toAstToken(d[0]) %}

factor ->
    unary_op _ factor {%
      (d) => {
        const operator = d[0];
        const right = d[2];
        return new ExprNS.Unary(operator, right.endToken, operator, right);
      }
    %}
  | power {% id %}

unary_op ->
    %plus {% (d) => toAstToken(d[0]) %}
  | %minus {% (d) => toAstToken(d[0]) %}

power ->
    atom_expr _ %doublestar _ factor {%
      (d) => {
        const left = d[0];
        const operator = toAstToken(d[2]);
        const right = d[4];
        return new ExprNS.Binary(left.startToken, right.endToken, left, operator, right);
      }
    %}
  | atom_expr {% id %}

atom_expr ->
    atom "(" _ test_list _ ")" {%
      (d) => {
        const callee = d[0];
        const args = d[3];
        const endToken = args.length > 0 ? args[args.length - 1].endToken : callee.endToken;
        return new ExprNS.Call(callee.startToken, endToken, callee, args);
      }
    %}
  | atom "(" _ ")" {%
      (d) => {
        const callee = d[0];
        return new ExprNS.Call(callee.startToken, callee.endToken, callee, []);
      }
    %}
  | atom {% id %}

test_list ->
    test {% (d) => [d[0]] %}
  | test_list _ "," _ test {% (d) => d[0].concat([d[4]]) %}
  | test _ "," {% (d) => [d[0]] %}

atom ->
    "(" _ test _ ")" {%
      (d) => {
        const lparen = toAstToken({ type: 'LPAREN', value: '(', line: 0, col: 0, offset: 0 });
        const rparen = toAstToken({ type: 'RPAREN', value: ')', line: 0, col: 0, offset: 0 });
        return new ExprNS.Grouping(lparen, rparen, d[2]);
      }
    %}
  | %identifier {%
      (d) => {
        const token = toAstToken(d[0]);
        return new ExprNS.Variable(token, token, token);
      }
    %}
  | %float {%
      (d) => {
        const token = toAstToken(d[0]);
        return new ExprNS.Literal(token, token, parseFloat(token.lexeme));
      }
    %}
  | %bigint {%
      (d) => {
        const token = toAstToken(d[0]);
        return new ExprNS.BigIntLiteral(token, token, token.lexeme);
      }
    %}
  | %complex {%
      (d) => {
        const token = toAstToken(d[0]);
        return new ExprNS.Complex(token, token, token.lexeme);
      }
    %}
  | string_literal {%
      (d) => {
        const token = d[0];
        return new ExprNS.Literal(token, token, token.lexeme);
      }
    %}
  | %kw_None {%
      (d) => {
        const token = toAstToken(d[0]);
        return new ExprNS.None(token, token, "None");
      }
    %}
  | %kw_True {%
      (d) => {
        const token = toAstToken(d[0]);
        return new ExprNS.Literal(token, token, true);
      }
    %}
  | %kw_False {%
      (d) => {
        const token = toAstToken(d[0]);
        return new ExprNS.Literal(token, token, false);
      }
    %}

string_literal ->
    %stringTripleDouble {% (d) => toAstToken(d[0]) %}
  | %stringTripleSingle {% (d) => toAstToken(d[0]) %}
  | %stringDouble {% (d) => toAstToken(d[0]) %}
  | %stringSingle {% (d) => toAstToken(d[0]) %}

# Whitespace (optional)
_ -> null | %ws
__ -> %ws

