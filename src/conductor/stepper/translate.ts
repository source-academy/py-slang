/**
 * Translates py-slang's class-based Python AST into the estree-shaped {@link StepNode} tree the
 * substitution stepper reduces and the host renders.
 *
 * Only the subset meaningful to a substitution stepper is translated faithfully (expressions,
 * assignments, single-`return` function definitions, `if`). Anything outside that subset becomes an
 * inert placeholder identifier so the stepper degrades gracefully (it simply stops reducing there)
 * instead of failing the whole run.
 */

import { ExprNS, StmtNS, type FunctionParam } from "../../ast-types";
import {
  type StepNode,
  complexLiteral,
  identifier,
  literal,
  numberRepr,
  program,
  pythonStringRepr,
} from "./ast";

/** Python `repr` for a float: integers print with a trailing `.0` (e.g. `2.0`), matching Python. */
function floatRepr(n: number): string {
  return numberRepr(n, true);
}

/** Python `repr` for a string (CPython quote preference), shared with the reducer and builtins. */
const stringRepr = pythonStringRepr;

function param(p: FunctionParam): StepNode {
  return identifier(p.lexeme);
}

function translateExpr(expr: ExprNS.Expr): StepNode {
  switch (expr.kind) {
    case "BigIntLiteral": {
      const e = expr as ExprNS.BigIntLiteral;
      return literal(BigInt(e.value), e.value, false);
    }
    case "Literal": {
      const value = (expr as ExprNS.Literal).value;
      if (value === true || value === false) return literal(value, value ? "True" : "False");
      if (typeof value === "number") return literal(value, floatRepr(value), true);
      return literal(value, stringRepr(String(value)));
    }
    case "Complex": {
      // The parser already combines a whole `<real>±<imag>j` literal into one `PyComplexNumber`
      // (e.g. `2+3j` is one token, not `2` `+` `3j`); lift its two fields into the stepper's own
      // plain-object `ComplexValue` rather than keeping py-slang's class instance (see `ComplexValue`'s
      // doc comment in `./ast` for why a class instance can't safely be a `StepNode` value).
      const value = (expr as ExprNS.Complex).value;
      return complexLiteral({ real: value.real, imag: value.imag });
    }
    case "None":
      return literal(null, "None");
    case "Variable":
      return identifier((expr as ExprNS.Variable).name.lexeme);
    case "Binary": {
      const e = expr as ExprNS.Binary;
      return {
        type: "BinaryExpression",
        operator: e.operator.lexeme,
        left: translateExpr(e.left),
        right: translateExpr(e.right),
      };
    }
    case "Compare": {
      const e = expr as ExprNS.Compare;
      return {
        type: "BinaryExpression",
        operator: e.operator.lexeme,
        left: translateExpr(e.left),
        right: translateExpr(e.right),
      };
    }
    case "BoolOp": {
      const e = expr as ExprNS.BoolOp;
      return {
        type: "LogicalExpression",
        operator: e.operator.lexeme,
        left: translateExpr(e.left),
        right: translateExpr(e.right),
      };
    }
    case "Unary": {
      const e = expr as ExprNS.Unary;
      // `not` needs a trailing space so it reads `not x`; symbolic operators like `-` do not.
      const operator = e.operator.lexeme === "not" ? "not " : e.operator.lexeme;
      return { type: "UnaryExpression", operator, argument: translateExpr(e.right) };
    }
    case "Grouping":
      // Parentheses are reintroduced by the host renderer's precedence logic, so unwrap them.
      return translateExpr((expr as ExprNS.Grouping).expression);
    case "Ternary": {
      const e = expr as ExprNS.Ternary;
      return {
        type: "ConditionalExpression",
        test: translateExpr(e.predicate),
        consequent: translateExpr(e.consequent),
        alternate: translateExpr(e.alternative),
      };
    }
    case "Lambda": {
      const e = expr as ExprNS.Lambda;
      return {
        type: "ArrowFunctionExpression",
        params: e.parameters.map(param),
        body: translateExpr(e.body),
      };
    }
    case "Call": {
      const e = expr as ExprNS.Call;
      return {
        type: "CallExpression",
        callee: translateExpr(e.callee),
        arguments: e.args.map(translateExpr),
      };
    }
    case "List": {
      const e = expr as ExprNS.List;
      return { type: "ArrayExpression", elements: e.elements.map(translateExpr) };
    }
    default:
      // Inert placeholder: renders as plain text and never reduces.
      return identifier(`<${expr.kind}>`);
  }
}

function block(statements: StmtNS.Stmt[]): StepNode {
  return { type: "BlockStatement", body: statements.map(translateStmt) };
}

function translateStmt(stmt: StmtNS.Stmt): StepNode {
  switch (stmt.kind) {
    case "SimpleExpr": {
      const expr = (stmt as StmtNS.SimpleExpr).expression;
      // Python's `breakpoint()` plays the role of JavaScript's `debugger;`: for evaluation it is a
      // no-op (like `pass`), but it marks a step the host's breakpoint navigation can jump to. Its
      // statement form — a no-arg call to the built-in name `breakpoint` — becomes a dedicated
      // `DebuggerStatement`, the shared language-agnostic node type the host already recognises for
      // breakpoints (see `reduce.ts` and the host's `stepNextBreakpoint`), so no per-language host code
      // is needed. Used as an expression (e.g. `x = breakpoint()`) it stays an ordinary built-in call.
      if (
        expr.kind === "Call" &&
        (expr as ExprNS.Call).callee.kind === "Variable" &&
        ((expr as ExprNS.Call).callee as ExprNS.Variable).name.lexeme === "breakpoint" &&
        (expr as ExprNS.Call).args.length === 0
      ) {
        return { type: "DebuggerStatement" };
      }
      return { type: "ExpressionStatement", expression: translateExpr(expr) };
    }
    case "Assign": {
      const s = stmt as StmtNS.Assign;
      if (s.target.kind === "Variable") {
        return {
          type: "VariableDeclaration",
          kind: "",
          declarations: [
            {
              type: "VariableDeclarator",
              id: identifier(s.target.name.lexeme),
              init: translateExpr(s.value),
            },
          ],
        };
      }
      return { type: "ExpressionStatement", expression: identifier("<Assign>") };
    }
    case "FunctionDef": {
      const s = stmt as StmtNS.FunctionDef;
      return {
        type: "FunctionDeclaration",
        id: identifier(s.name.lexeme),
        params: s.parameters.map(param),
        body: block(s.body),
      };
    }
    case "Return": {
      const s = stmt as StmtNS.Return;
      return {
        type: "ReturnStatement",
        argument: s.value ? translateExpr(s.value) : null,
      };
    }
    case "If": {
      const s = stmt as StmtNS.If;
      return {
        type: "IfStatement",
        test: translateExpr(s.condition),
        consequent: block(s.body),
        alternate: s.elseBlock ? block(s.elseBlock) : null,
      };
    }
    case "Pass":
      return { type: "PassStatement" };
    default:
      return { type: "ExpressionStatement", expression: identifier(`<${stmt.kind}>`) };
  }
}

/** Translates a parsed Python file into the estree-shaped {@link program} root the stepper reduces. */
export function translateProgram(fileInput: StmtNS.FileInput): StepNode {
  return program(fileInput.statements.map(translateStmt));
}
