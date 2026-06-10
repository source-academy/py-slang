/**
 * Translates py-slang's class-based Python AST into the estree-shaped {@link StepNode} tree the
 * substitution stepper reduces and the host renders.
 *
 * Only the subset meaningful to a substitution stepper is translated faithfully (expressions,
 * assignments, single-`return` function definitions, `if`). Anything outside that subset becomes an
 * inert placeholder identifier so the stepper degrades gracefully (it simply stops reducing there)
 * instead of failing the whole run.
 */

import { ExprNS, StmtNS, type FunctionParam } from '../../ast-types';
import { type StepNode, identifier, literal, program } from './ast';

/** Python `repr` for a float: integers print with a trailing `.0` (e.g. `2.0`), matching Python. */
function floatRepr(n: number): string {
  return Number.isInteger(n) ? `${n}.0` : String(n);
}

/** Python `repr` for a string: single-quoted with the common escapes. */
function stringRepr(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

function param(p: FunctionParam): StepNode {
  return identifier(p.lexeme);
}

function translateExpr(expr: ExprNS.Expr): StepNode {
  switch (expr.kind) {
    case 'BigIntLiteral': {
      // Python ints are arbitrary-precision; the stepper computes in JS `number`, which is exact for
      // the small integers used in teaching examples.
      const e = expr as ExprNS.BigIntLiteral;
      return literal(Number(e.value), e.value, false);
    }
    case 'Literal': {
      const value = (expr as ExprNS.Literal).value;
      if (value === true || value === false) return literal(value, value ? 'True' : 'False');
      if (typeof value === 'number') return literal(value, floatRepr(value), true);
      return literal(value, stringRepr(String(value)));
    }
    case 'Complex': {
      const value = (expr as ExprNS.Complex).value;
      return literal(String(value), String(value));
    }
    case 'None':
      return literal(null, 'None');
    case 'Variable':
      return identifier((expr as ExprNS.Variable).name.lexeme);
    case 'Binary': {
      const e = expr as ExprNS.Binary;
      return {
        type: 'BinaryExpression',
        operator: e.operator.lexeme,
        left: translateExpr(e.left),
        right: translateExpr(e.right),
      };
    }
    case 'Compare': {
      const e = expr as ExprNS.Compare;
      return {
        type: 'BinaryExpression',
        operator: e.operator.lexeme,
        left: translateExpr(e.left),
        right: translateExpr(e.right),
      };
    }
    case 'BoolOp': {
      const e = expr as ExprNS.BoolOp;
      return {
        type: 'LogicalExpression',
        operator: e.operator.lexeme,
        left: translateExpr(e.left),
        right: translateExpr(e.right),
      };
    }
    case 'Unary': {
      const e = expr as ExprNS.Unary;
      // `not` needs a trailing space so it reads `not x`; symbolic operators like `-` do not.
      const operator = e.operator.lexeme === 'not' ? 'not ' : e.operator.lexeme;
      return { type: 'UnaryExpression', operator, argument: translateExpr(e.right) };
    }
    case 'Grouping':
      // Parentheses are reintroduced by the host renderer's precedence logic, so unwrap them.
      return translateExpr((expr as ExprNS.Grouping).expression);
    case 'Ternary': {
      const e = expr as ExprNS.Ternary;
      return {
        type: 'ConditionalExpression',
        test: translateExpr(e.predicate),
        consequent: translateExpr(e.consequent),
        alternate: translateExpr(e.alternative),
      };
    }
    case 'Lambda': {
      const e = expr as ExprNS.Lambda;
      return {
        type: 'ArrowFunctionExpression',
        params: e.parameters.map(param),
        body: translateExpr(e.body),
      };
    }
    case 'Call': {
      const e = expr as ExprNS.Call;
      return {
        type: 'CallExpression',
        callee: translateExpr(e.callee),
        arguments: e.args.map(translateExpr),
      };
    }
    case 'List': {
      const e = expr as ExprNS.List;
      return { type: 'ArrayExpression', elements: e.elements.map(translateExpr) };
    }
    default:
      // Inert placeholder: renders as plain text and never reduces.
      return identifier(`<${expr.kind}>`);
  }
}

function block(statements: StmtNS.Stmt[]): StepNode {
  return { type: 'BlockStatement', body: statements.map(translateStmt) };
}

function translateStmt(stmt: StmtNS.Stmt): StepNode {
  switch (stmt.kind) {
    case 'SimpleExpr':
      return { type: 'ExpressionStatement', expression: translateExpr((stmt as StmtNS.SimpleExpr).expression) };
    case 'Assign': {
      const s = stmt as StmtNS.Assign;
      if (s.target.kind === 'Variable') {
        return {
          type: 'VariableDeclaration',
          kind: '',
          declarations: [
            {
              type: 'VariableDeclarator',
              id: identifier((s.target as ExprNS.Variable).name.lexeme),
              init: translateExpr(s.value),
            },
          ],
        };
      }
      return { type: 'ExpressionStatement', expression: identifier('<Assign>') };
    }
    case 'FunctionDef': {
      const s = stmt as StmtNS.FunctionDef;
      return {
        type: 'FunctionDeclaration',
        id: identifier(s.name.lexeme),
        params: s.parameters.map(param),
        body: block(s.body),
      };
    }
    case 'Return': {
      const s = stmt as StmtNS.Return;
      return {
        type: 'ReturnStatement',
        argument: s.value ? translateExpr(s.value) : null,
      };
    }
    case 'If': {
      const s = stmt as StmtNS.If;
      return {
        type: 'IfStatement',
        test: translateExpr(s.condition),
        consequent: block(s.body),
        alternate: s.elseBlock ? block(s.elseBlock) : null,
      };
    }
    case 'Pass':
      return { type: 'ExpressionStatement', expression: identifier('pass') };
    default:
      return { type: 'ExpressionStatement', expression: identifier(`<${stmt.kind}>`) };
  }
}

/** Translates a parsed Python file into the estree-shaped {@link program} root the stepper reduces. */
export function translateProgram(fileInput: StmtNS.FileInput): StepNode {
  return program(fileInput.statements.map(translateStmt));
}
