/*
* Translate our AST to estree AST (Source's AST)
* */

import {StmtNS, ExprNS} from "./ast-types";
type Expr = ExprNS.Expr;
type Stmt = StmtNS.Stmt;
import {Token} from "./tokenizer";
import {TokenType} from "./tokens";

import {
    ArrowFunctionExpression,
    AssignmentExpression,
    BaseNode, BinaryExpression, BinaryOperator,
    BlockStatement,
    BreakStatement,
    CallExpression, ConditionalExpression,
    ContinueStatement,
    EmptyStatement,
    Expression,
    ExpressionStatement,
    FunctionDeclaration,
    Identifier,
    IfStatement, LogicalExpression, LogicalOperator,
    Program,
    ReturnStatement, SimpleLiteral,
    Statement, UnaryExpression, UnaryOperator, VariableDeclaration, VariableDeclarator,
    WhileStatement
} from "estree";

export interface EstreePosition {
    line: number;
    column: number;
}

export interface EstreeLocation {
    source: string,
    start: EstreePosition;
    end: EstreePosition;
}

export class Translator implements StmtNS.Visitor<BaseNode>, ExprNS.Visitor<BaseNode> {
    constructor() {
    }

    // @TODO fix estree location

    resolve(stmt: Stmt | Expr | null): Statement | Expression {
        if (stmt === null) {
            return {
                type: 'EmptyStatement',
                // loc: this.toEstreeLocation(),
            };
        }
        return stmt.accept(this);
    }

    // Ugly, but just to support proper typing
    resolveStmt(stmt: Stmt | null) {
        if (stmt === null) {
            return {
                type: 'EmptyStatement',
                // loc: this.toEstreeLocation(),
            };
        }
        return stmt.accept(this);
    }
    resolveManyStmt(stmts: Stmt[] | null): Statement[]{
        if (stmts === null) {
            return [{
                type: 'EmptyStatement',
                // loc: this.toEstreeLocation(),
            }];
        }
        const res = [];
        for (const stmt of stmts) {
            res.push(this.resolveStmt(stmt))
        }
        return res;
    }
    resolveExpr(expr: Expr) {
        return expr.accept(this);
    }

    resolveManyExpr(exprs: Expr[] | null) {
        if (exprs === null) {
            return [{
                type: 'EmptyStatement',
                // loc: this.toEstreeLocation(),
            }];
        }
        const res = [];
        for (const expr of exprs) {
            res.push(this.resolveExpr(expr))
        }
        return res;
    }


    // Converts our internal identifier to estree identifier.
    private rawStringToIdentifier(name: string): Identifier {
        return {
            type: 'Identifier',
            name: name,
            // loc: this.toEstreeLocation(),
        };
    }
    // Token to estree identifier.
    private convertToIdentifier(name: Token): Identifier {
        return {
            type: 'Identifier',
            name: name.lexeme,
            // loc: this.toEstreeLocation(),
        };
    }

    private convertToIdentifiers(names: Token[]): Identifier[] {
        return names.map(name => this.convertToIdentifier(name));
    }

    private convertToExpressionStatement(expr: Expression): ExpressionStatement {
        return {
            type: 'ExpressionStatement',
            expression: expr,
            // loc: this.toEstreeLocation(),
        }
    }

    private converTokenstoDecls(varDecls: Token[]): VariableDeclaration {
        return {
            type: 'VariableDeclaration',
            declarations: varDecls?.map((token): VariableDeclarator => {
                return {
                    type: 'VariableDeclarator',
                    id: this.convertToIdentifier(token),
                    // loc: this.toEstreeLocation(),
                }
            }),
            kind: 'let',
            // loc: this.toEstreeLocation(),
        };
    }

    // Wraps an array of statements to a block.
    // WARNING: THIS CREATES A NEW BLOCK IN
    // JS AST. THIS ALSO MEANS A NEW NAMESPACE. BE CAREFUL!
    private wrapInBlock(stmts: StmtNS.Stmt[]): BlockStatement {
        return {
            type: 'BlockStatement',
            body: this.resolveManyStmt(stmts),
            // loc: this.toEstreeLocation(),
        };
    }

    //// STATEMENTS

    visitFileInputStmt(stmt: StmtNS.FileInput): Program {
        const newBody = this.resolveManyStmt(stmt.statements);
        if (stmt.varDecls !== null && stmt.varDecls.length > 0) {
            const decls = this.converTokenstoDecls(stmt.varDecls);
            newBody.unshift(decls);
        }
        return {
            type: 'Program',
            sourceType: 'module',
            body: newBody,
            // loc: this.toEstreeLocation(),
        };
    }

    visitFunctionDefStmt(stmt: StmtNS.FunctionDef): FunctionDeclaration {
        const newBody = this.resolveManyStmt(stmt.body);
        if (stmt.varDecls !== null && stmt.varDecls.length > 0) {
            const decls = this.converTokenstoDecls(stmt.varDecls);
            newBody.unshift(decls);
        }
        return {
            type: 'FunctionDeclaration',
            id: this.convertToIdentifier(stmt.name),
            params: this.convertToIdentifiers(stmt.parameters),
            body: {
                type: 'BlockStatement',
                body: newBody,
            },
            // loc: this.toEstreeLocation(),
        };
    }

    visitAnnAssignStmt(stmt: StmtNS.AnnAssign): AssignmentExpression {
        return {
            type: 'AssignmentExpression',
            // We only have one type of assignment in restricted Python.
            operator: '=',
            left: this.convertToIdentifier(stmt.name),
            right: this.resolveExpr(stmt.value),
            // loc: this.toEstreeLocation(),
        };
    }

    // Note: assignments are expressions in JS.
    visitAssignStmt(stmt: StmtNS.Assign): ExpressionStatement {
        return this.convertToExpressionStatement({
            type: 'AssignmentExpression',
            // We only have one type of assignment in restricted Python.
            operator: '=',
            left: this.convertToIdentifier(stmt.name),
            right: this.resolveExpr(stmt.value),
            // loc: this.toEstreeLocation(),
        })
    }

    // Convert to source's built-in assert function.
    visitAssertStmt(stmt: StmtNS.Assert): CallExpression {
        return {
            type: 'CallExpression',
            optional: false,
            callee: this.rawStringToIdentifier('assert'),
            arguments: [this.resolveExpr(stmt.value)],
            // loc: this.toEstreeLocation(),
        }
    }

    // @TODO decide how to do for loops
    // For now, empty block
    visitForStmt(stmt: StmtNS.For): EmptyStatement {
        return {
            type: 'EmptyStatement',
            // loc: this.toEstreeLocation(),
        };
    }

    visitIfStmt(stmt: StmtNS.If): IfStatement {
        return {
            type: 'IfStatement',
            test: this.resolveExpr(stmt.condition),
            consequent: this.wrapInBlock(stmt.body),
            alternate: stmt.elseBlock !== null ? this.wrapInBlock(stmt.elseBlock) : null,
            // loc: this.toEstreeLocation(),
        };
    }
    visitGlobalStmt(stmt: StmtNS.Global): EmptyStatement {
        return {
            type: 'EmptyStatement',
            // loc: this.toEstreeLocation(),
        };
    }
    visitNonLocalStmt(stmt: StmtNS.NonLocal): EmptyStatement {
        return {
            type: 'EmptyStatement',
            // loc: this.toEstreeLocation(),
        };
    }
    visitReturnStmt(stmt: StmtNS.Return): ReturnStatement {
        return {
            type: 'ReturnStatement',
            argument: stmt.value == null ? null : this.resolveExpr(stmt.value),
            // loc: this.toEstreeLocation(),
        };
    }
    visitWhileStmt(stmt: StmtNS.While): WhileStatement {
        return {
            type: 'WhileStatement',
            test: this.resolveExpr(stmt.condition),
            body: this.wrapInBlock(stmt.body),
            // loc: this.toEstreeLocation(),
        }
    }
    visitSimpleExprStmt(stmt: StmtNS.SimpleExpr): ExpressionStatement {
        return {
            type: 'ExpressionStatement',
            expression: this.resolveExpr(stmt.expression),
            // loc: this.toEstreeLocation(),
        }
    }
    // @TODO
    visitFromImportStmt(stmt: StmtNS.FromImport): EmptyStatement {
        return {
            type: 'EmptyStatement',
            // loc: this.toEstreeLocation(),
        }
    }
    visitContinueStmt(stmt: StmtNS.Continue): ContinueStatement {
        return {
            type: 'ContinueStatement',
            // loc: this.toEstreeLocation(),
        }
    }
    visitBreakStmt(stmt: StmtNS.Break): BreakStatement {
        return {
            type: 'BreakStatement',
            // loc: this.toEstreeLocation(),
        }
    }

    visitPassStmt(stmt: StmtNS.Pass): EmptyStatement {
        return {
            type: 'EmptyStatement',
            // loc: this.toEstreeLocation(),
        }
    }


    //// EXPRESSIONS
    visitVariableExpr(expr: ExprNS.Variable): Identifier {
        return this.convertToIdentifier(expr.name);
    }

    visitLambdaExpr(expr: ExprNS.Lambda): ArrowFunctionExpression {
        return {
            type: 'ArrowFunctionExpression',
            expression: true,
            params: this.convertToIdentifiers(expr.parameters),
            body: this.resolveExpr(expr.body),
            // loc: this.toEstreeLocation(),
        }
    }
    // disabled for now
    visitMultiLambdaExpr(expr: ExprNS.MultiLambda): EmptyStatement {
        return {
            type: 'EmptyStatement',
            // loc: this.toEstreeLocation(),
        }
    }
    visitUnaryExpr(expr: ExprNS.Unary): UnaryExpression {
        const op = expr.operator.type;
        let res: UnaryOperator = '-';
        switch(op) {
            case TokenType.NOT:
                res = '!'
                break;
            case TokenType.PLUS:
                res = '+'
                break;
            case TokenType.MINUS:
                res = '-'
                break;
            default:
                throw new Error("Unreachable code path in translator");
        }
        return {
            type: 'UnaryExpression',
            // To satisfy the type checker.
            operator: res,
            prefix: true,
            argument: this.resolveExpr(expr.right),
            // loc: this.toEstreeLocation(),
        }
    }
    visitGroupingExpr(expr: ExprNS.Grouping): Expression {
        return this.resolveExpr(expr.expression);
    }
    visitBinaryExpr(expr: ExprNS.Binary): BinaryExpression {
        const op = expr.operator.type;
        let res: BinaryOperator = '+';
        // To make the type checker happy.
        switch(op) {
            case TokenType.PLUS:
                res = '+';
                break;
            case TokenType.MINUS:
                res = '-';
                break;
            case TokenType.STAR:
                res = '*';
                break;
            case TokenType.SLASH:
                res = '/';
                break;
            case TokenType.PERCENT:
                res = '%';
                break;
            // @TODO double slash and power needs to convert to math exponent/floor divide
            case TokenType.DOUBLESLASH:
            case TokenType.DOUBLESTAR:
                throw new Error("This operator is not yet supported");
            default:
                throw new Error("Unreachable binary code path in translator");
        }
        return {
            type: 'BinaryExpression',
            operator: res,
            left: this.resolveExpr(expr.left),
            right: this.resolveExpr(expr.right),
            // loc: this.toEstreeLocation(),
        }
    }
    visitCompareExpr(expr: ExprNS.Compare): BinaryExpression {
        const op = expr.operator.type;
        let res: BinaryOperator = '+';
        // To make the type checker happy.
        switch(op) {
            case TokenType.LESS:
                res = '<';
                break;
            case TokenType.GREATER:
                res = '>';
                break;
            case TokenType.DOUBLEEQUAL:
                res = '===';
                break;
            case TokenType.GREATEREQUAL:
                res = '>=';
                break;
            case TokenType.LESSEQUAL:
                res = '<=';
                break;
            case TokenType.NOTEQUAL:
                res = '!==';
                break;
            // @TODO we need to convert these to builtin function applications.
            case TokenType.IS:
            case TokenType.ISNOT:
            case TokenType.IN:
            case TokenType.NOTIN:
                throw new Error("This operator is not yet supported");
            default:
                throw new Error("Unreachable binary code path in translator");
        }
        return {
            type: 'BinaryExpression',
            operator: res,
            left: this.resolveExpr(expr.left),
            right: this.resolveExpr(expr.right),
            // loc: this.toEstreeLocation(),
        }
    }
    visitBoolOpExpr(expr: ExprNS.BoolOp): LogicalExpression {
        const op = expr.operator.type;
        let res: LogicalOperator = '||';
        // To make the type checker happy.
        switch(op) {
            case TokenType.AND:
                res = '&&';
                break;
            case TokenType.OR:
                res = '||';
                break;
            default:
                throw new Error("Unreachable binary code path in translator");
        }
        return {
            type: 'LogicalExpression',
            operator: res,
            left: this.resolveExpr(expr.left),
            right: this.resolveExpr(expr.right),
            // loc: this.toEstreeLocation(),
        }
    }

    visitCallExpr(expr: ExprNS.Call): CallExpression {
        return {
            type: 'CallExpression',
            optional: false,
            callee: this.resolveExpr(expr.callee),
            arguments: this.resolveManyExpr(expr.args),
            // loc: this.toEstreeLocation(),
        }
    }

    visitTernaryExpr(expr: ExprNS.Ternary): ConditionalExpression {
        return {
            type: 'ConditionalExpression',
            test: this.resolveExpr(expr.predicate),
            alternate: this.resolveExpr(expr.alternative),
            consequent: this.resolveExpr(expr.consequent),
            // loc: this.toEstreeLocation(),
        }
    }

    visitLiteralExpr(expr: ExprNS.Literal): SimpleLiteral {
        return {
            type: 'Literal',
            value: expr.value,
            // loc: this.toEstreeLocation(),
        }
    }
}