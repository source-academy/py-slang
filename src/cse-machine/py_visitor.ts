import { ExprNS, StmtNS } from "../ast-types";
import { Context } from "./context";
// TODO: setup py_operators
import { evaluateBinaryExpression, evaluateUnaryExpression } from "./py_operators";
import { TokenType } from "../tokens";
import { Token } from "../tokenizer";
import { Value } from "./stash";
import { PyComplexNumber } from "../types";

type Stmt = StmtNS.Stmt;
type Expr = ExprNS.Expr;

// TODO: type 'any' to be changed to node type for replacement of es.Node
export class PyVisitor implements ExprNS.Visitor<Value>, StmtNS.Visitor<Value> {
    private code: string;
    private context: Context;
    
    constructor(code: string, context: Context) {
        this.code = code;
        this.context = context;
    }

    // Main entry point
    visit(node: Stmt | Expr): any {
        return node.accept(this);
    }

    private mapOperatorToPyOperator(operatorToken: Token): TokenType | string {
        switch (operatorToken.type) {
            // return string names that py_operators expect
            case TokenType.PLUS:
                return '__py_adder';
            case TokenType.MINUS:
                return '__py_minuser';
            case TokenType.STAR:
                return '__py_multiplier';
            case TokenType.SLASH:
                return '__py_divider';
            case TokenType.PERCENT:
                return '__py_modder';
            case TokenType.DOUBLESTAR:
                return '__py_powerer';
            case TokenType.DOUBLESLASH:
                return '__py_floorer';
            
            // pass TokenType for comparisons and unary
            case TokenType.GREATER: return TokenType.GREATER;
            case TokenType.GREATEREQUAL: return TokenType.GREATEREQUAL;
            case TokenType.LESS: return TokenType.LESS;
            case TokenType.LESSEQUAL: return TokenType.LESSEQUAL;
            case TokenType.DOUBLEEQUAL: return TokenType.DOUBLEEQUAL;
            case TokenType.NOTEQUAL: return TokenType.NOTEQUAL;
            case TokenType.NOT: return TokenType.NOT;
            default:
                throw new Error(`Unsupported operator token type for mapping: ${TokenType[operatorToken.type]}`);
        }
    }

    // Expression Visitors
    visitLiteralExpr(expr: ExprNS.Literal): Value {
        const value = expr.value;
        if (typeof value == 'number') {
            return { type: 'number', value: value };
        } else if (typeof value == 'boolean') {
            return { type: 'bool', value: value};
        } else if (typeof value == 'string') {
            return { type: 'string', value: value};
        }
        // TODO to handle null, representing null as UndefinedValue
        return { type: 'undefined'};
    }

    visitUnaryExpr(expr: ExprNS.Unary): any {
        const argumentValue = this.visit(expr.right);
        return evaluateUnaryExpression(expr.operator.type, argumentValue, expr, this.context);
    }

    visitBinaryExpr(expr: ExprNS.Binary): any {
        const leftValue = this.visit(expr.left);
        const rightValue = this.visit(expr.right);
        const operatorForPyOperators = this.mapOperatorToPyOperator(expr.operator);

        return evaluateBinaryExpression(
            this.code,
            expr,
            this.context,
            operatorForPyOperators,
            leftValue,
            rightValue,
        )
    }

    visitBigIntLiteralExpr(expr: ExprNS.BigIntLiteral): any {
        return {
            type: 'bigint',
            value: BigInt(expr.value)
        };
    }

    // Placeholder for TODO expr visitors
    visitCompareExpr(expr: ExprNS.Compare): any { /* TODO */ }
    visitBoolOpExpr(expr: ExprNS.BoolOp): any { /* TODO */ }
    visitGroupingExpr(expr: ExprNS.Grouping): any { return this.visit(expr.expression);}
    visitTernaryExpr(expr: ExprNS.Ternary): any { /* TODO */ }
    visitLambdaExpr(expr: ExprNS.Lambda): any { /* TODO */ }
    visitMultiLambdaExpr(expr: ExprNS.MultiLambda): any { /* TODO */ }
    visitVariableExpr(expr: ExprNS.Variable): any { /* TODO */ }
    visitCallExpr(expr: ExprNS.Call): any { /* TODO */ }
    visitComplexExpr(expr: ExprNS.Complex): Value { 
        return {
            type: 'complex',
            value: new PyComplexNumber(expr.value.real, expr.value.imag)
        };
    }
    visitNoneExpr(expr: ExprNS.None): any { /* TODO */ }

    // Statement Visitors
    visitFileInputStmt(stmt: StmtNS.FileInput): any {
        let lastValue: any;
        for (const statement of stmt.statements) {
            lastValue = this.visit(statement);
        }
        return lastValue;
    }

    visitSimpleExprStmt(stmt: StmtNS.SimpleExpr): any {
        return this.visit(stmt.expression);
    }


    // Placeholder for TODO stmt visitors
    visitIndentCreation(stmt: StmtNS.Indent): any { /* TODO */ }
    visitDedentCreation(stmt: StmtNS.Dedent): any { /* TODO */ }
    visitPassStmt(stmt: StmtNS.Pass): any { /* TODO */ }
    visitAssignStmt(stmt: StmtNS.Assign): any { /* TODO */ }
    visitAnnAssignStmt(stmt: StmtNS.AnnAssign): any { /* TODO */ }
    visitBreakStmt(stmt: StmtNS.Break): any { /* TODO */ }
    visitContinueStmt(stmt: StmtNS.Continue): any { /* TODO */ }
    visitReturnStmt(stmt: StmtNS.Return): any { /* TODO */ }
    visitFromImportStmt(stmt: StmtNS.FromImport): any { /* TODO */ }
    visitGlobalStmt(stmt: StmtNS.Global): any { /* TODO */ }
    visitNonLocalStmt(stmt: StmtNS.NonLocal): any { /* TODO */ }
    visitAssertStmt(stmt: StmtNS.Assert): any { /* TODO */ }
    visitIfStmt(stmt: StmtNS.If): any { /* TODO */ }
    visitWhileStmt(stmt: StmtNS.While): any { /* TODO */ }
    visitForStmt(stmt: StmtNS.For): any { /* TODO */ }
    visitFunctionDefStmt(stmt: StmtNS.FunctionDef): any { /* TODO */ }
    


}