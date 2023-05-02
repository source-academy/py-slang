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
    BaseNode,
    BinaryExpression,
    BinaryOperator,
    BlockStatement,
    BreakStatement,
    CallExpression,
    ConditionalExpression,
    ContinueStatement,
    EmptyStatement,
    Expression,
    ExpressionStatement,
    FunctionDeclaration,
    Identifier,
    IfStatement,
    ImportDeclaration, ImportSpecifier,
    LogicalExpression,
    LogicalOperator,
    Program,
    ReturnStatement,
    SimpleLiteral,
    Statement,
    UnaryExpression,
    UnaryOperator,
    VariableDeclaration,
    VariableDeclarator,
    WhileStatement
} from "estree";
import {TranslatorErrors} from "./errors";

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
    private readonly source: string

    constructor(source: string) {
        this.source = source;
    }

    private tokenToEstreeLocation(token: Token): EstreeLocation {
        // Convert zero-based to one-based.
        const line = token.line + 1;
        const start: EstreePosition = {
            line,
            column: token.col - token.lexeme.length
        };
        const end: EstreePosition = {
            line,
            column: token.col
        }
        const source: string = token.lexeme;
        return {source, start, end};
    }

    private toEstreeLocation(stmt: Stmt | Expr): EstreeLocation {
        const start: EstreePosition = {
            // Convert zero-based to one-based.
            line: stmt.startToken.line + 1,
            column: stmt.startToken.col - stmt.startToken.lexeme.length
        };
        const end: EstreePosition = {
            // Convert zero-based to one-based.
            line: stmt.endToken.line + 1,
            column: stmt.endToken.col
        }
        const source: string = this.source.slice(stmt.startToken.indexInSource,
            stmt.endToken.indexInSource + stmt.endToken.lexeme.length);
        return {source, start, end};
    }

    resolve(stmt: Stmt | Expr): Statement | Expression {
        return stmt.accept(this);
    }

    // Ugly, but just to support proper typing
    resolveStmt(stmt: Stmt) {
        return stmt.accept(this);
    }

    resolveManyStmt(stmts: Stmt[]): Statement[] {
        const res = [];
        for (const stmt of stmts) {
            res.push(this.resolveStmt(stmt))
        }
        return res;
    }

    resolveExpr(expr: Expr) {
        return expr.accept(this);
    }

    resolveManyExpr(exprs: Expr[]) {
        const res = [];
        for (const expr of exprs) {
            res.push(this.resolveExpr(expr))
        }
        return res;
    }


    // Converts our internal identifier to estree identifier.
    private rawStringToIdentifier(name: string, stmtOrExpr: Stmt | Expr): Identifier {
        return {
            type: 'Identifier',
            name: name,
            loc: this.toEstreeLocation(stmtOrExpr),
        };
    }

    // Token to estree identifier.
    private convertToIdentifier(name: Token): Identifier {
        return {
            type: 'Identifier',
            name: name.lexeme,
            loc: this.tokenToEstreeLocation(name),
        };
    }

    private convertToIdentifiers(names: Token[]): Identifier[] {
        return names.map(name => this.convertToIdentifier(name));
    }

    // private convertToExpressionStatement(expr: Expression): ExpressionStatement {
    //     return {
    //         type: 'ExpressionStatement',
    //         expression: expr,
    //         // loc: this.toEstreeLocation(),
    //     }
    // }

    // private converTokenstoDecls(varDecls: Token[]): VariableDeclaration {
    //     return {
    //         type: 'VariableDeclaration',
    //         declarations: varDecls?.map((token): VariableDeclarator => {
    //             return {
    //                 type: 'VariableDeclarator',
    //                 id: this.convertToIdentifier(token),
    //                 loc: this.tokenToEstreeLocation(token),
    //             }
    //         }),
    //         kind: 'var',
    //         loc: this.toEstreeLocation(),
    //     };
    // }

    // Wraps an array of statements to a block.
    // WARNING: THIS CREATES A NEW BLOCK IN
    // JS AST. THIS ALSO MEANS A NEW NAMESPACE. BE CAREFUL!
    private wrapInBlock(stmt: Stmt, stmts: StmtNS.Stmt[]): BlockStatement {
        return {
            type: 'BlockStatement',
            body: this.resolveManyStmt(stmts),
            loc: this.toEstreeLocation(stmt),
        };
    }

    //// STATEMENTS

    visitFileInputStmt(stmt: StmtNS.FileInput): Program {
        const newBody = this.resolveManyStmt(stmt.statements);
        // if (stmt.varDecls !== null && stmt.varDecls.length > 0) {
        //     const decls = this.converTokenstoDecls(stmt.varDecls);
        //     newBody.unshift(decls);
        // }
        return {
            type: 'Program',
            sourceType: 'module',
            body: newBody,
            loc: this.toEstreeLocation(stmt),
        };
    }

    visitFunctionDefStmt(stmt: StmtNS.FunctionDef): FunctionDeclaration {
        const newBody = this.resolveManyStmt(stmt.body);
        // if (stmt.varDecls !== null && stmt.varDecls.length > 0) {
        //     const decls = this.converTokenstoDecls(stmt.varDecls);
        //     newBody.unshift(decls);
        // }
        return {
            type: 'FunctionDeclaration',
            id: this.convertToIdentifier(stmt.name),
            params: this.convertToIdentifiers(stmt.parameters),
            body: {
                type: 'BlockStatement',
                body: newBody,
            },
            loc: this.toEstreeLocation(stmt),
        };
    }

    visitAnnAssignStmt(stmt: StmtNS.AnnAssign): AssignmentExpression {
        return {
            type: 'AssignmentExpression',
            // We only have one type of assignment in restricted Python.
            operator: '=',
            left: this.convertToIdentifier(stmt.name),
            right: this.resolveExpr(stmt.value),
            loc: this.toEstreeLocation(stmt),
        };
    }

    // Note: assignments are expressions in JS.
    visitAssignStmt(stmt: StmtNS.Assign): VariableDeclaration {
        // return this.convertToExpressionStatement({
        //     type: 'AssignmentExpression',
        //     // We only have one type of assignment in restricted Python.
        //     operator: '=',
        //     left: this.convertToIdentifier(stmt.name),
        //     right: this.resolveExpr(stmt.value),
        //     loc: this.toEstreeLocation(stmt),
        // })
        const declaration: VariableDeclarator = {
            type: 'VariableDeclarator',
            id: this.convertToIdentifier(stmt.name),
            loc: this.tokenToEstreeLocation(stmt.name),
            init: this.resolveExpr(stmt.value),
        }
        return {
            type: 'VariableDeclaration',
            declarations: [declaration],
            // Note: we abuse the fact that var is function and module scoped
            // which is exactly the same as how Python assignments are scoped!
            kind: 'var',
            loc: this.toEstreeLocation(stmt),
        };
    }

    // Convert to source's built-in assert function.
    visitAssertStmt(stmt: StmtNS.Assert): CallExpression {
        return {
            type: 'CallExpression',
            optional: false,
            callee: this.rawStringToIdentifier('assert', stmt),
            arguments: [this.resolveExpr(stmt.value)],
            // @TODO, this needs to come after callee
            loc: this.toEstreeLocation(stmt),
        }
    }

    // @TODO decide how to do for loops
    // For now, empty block
    visitForStmt(stmt: StmtNS.For): EmptyStatement {
        return {
            type: 'EmptyStatement',
            loc: this.toEstreeLocation(stmt),
        };
    }

    visitIfStmt(stmt: StmtNS.If): IfStatement {
        return {
            type: 'IfStatement',
            test: this.resolveExpr(stmt.condition),
            consequent: this.wrapInBlock(stmt, stmt.body),
            alternate: stmt.elseBlock !== null ? this.wrapInBlock(stmt, stmt.elseBlock) : null,
            loc: this.toEstreeLocation(stmt),
        };
    }

    visitGlobalStmt(stmt: StmtNS.Global): EmptyStatement {
        return {
            type: 'EmptyStatement',
            loc: this.toEstreeLocation(stmt),
        };
    }

    visitNonLocalStmt(stmt: StmtNS.NonLocal): EmptyStatement {
        return {
            type: 'EmptyStatement',
            loc: this.toEstreeLocation(stmt),
        };
    }

    visitReturnStmt(stmt: StmtNS.Return): ReturnStatement {
        return {
            type: 'ReturnStatement',
            argument: stmt.value == null ? null : this.resolveExpr(stmt.value),
            loc: this.toEstreeLocation(stmt),
        };
    }

    visitWhileStmt(stmt: StmtNS.While): WhileStatement {
        return {
            type: 'WhileStatement',
            test: this.resolveExpr(stmt.condition),
            body: this.wrapInBlock(stmt, stmt.body),
            loc: this.toEstreeLocation(stmt),
        }
    }

    visitSimpleExprStmt(stmt: StmtNS.SimpleExpr): ExpressionStatement {
        return {
            type: 'ExpressionStatement',
            expression: this.resolveExpr(stmt.expression),
            loc: this.toEstreeLocation(stmt),
        }
    }

    // @TODO
    visitFromImportStmt(stmt: StmtNS.FromImport): ImportDeclaration {
        const specifiers: ImportSpecifier[] = stmt.names.map(name => {
            const ident = this.convertToIdentifier(name);
            return {
                type: 'ImportSpecifier',
                imported: ident,
                local: ident,
            }
        });
        return {
            type: 'ImportDeclaration',
            specifiers: specifiers,
            source: {
                type: 'Literal',
                value: stmt.module.lexeme,
                loc: this.tokenToEstreeLocation(stmt.module)
            }
        }
    }

    visitContinueStmt(stmt: StmtNS.Continue): ContinueStatement {
        return {
            type: 'ContinueStatement',
            loc: this.toEstreeLocation(stmt),
        }
    }

    visitBreakStmt(stmt: StmtNS.Break): BreakStatement {
        return {
            type: 'BreakStatement',
            loc: this.toEstreeLocation(stmt),
        }
    }

    visitPassStmt(stmt: StmtNS.Pass): EmptyStatement {
        return {
            type: 'EmptyStatement',
            loc: this.toEstreeLocation(stmt),
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
            loc: this.toEstreeLocation(expr),
        }
    }

    // disabled for now
    visitMultiLambdaExpr(expr: ExprNS.MultiLambda): EmptyStatement {
        return {
            type: 'EmptyStatement',
            loc: this.toEstreeLocation(expr),
        }
    }

    visitUnaryExpr(expr: ExprNS.Unary): UnaryExpression {
        const op = expr.operator.type;
        let res: UnaryOperator = '-';
        switch (op) {
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
            loc: this.toEstreeLocation(expr),
        }
    }

    visitGroupingExpr(expr: ExprNS.Grouping): Expression {
        return this.resolveExpr(expr.expression);
    }

    visitBinaryExpr(expr: ExprNS.Binary): BinaryExpression {
        const op = expr.operator.type;
        let res: BinaryOperator = '+';
        // To make the type checker happy.
        switch (op) {
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
                throw new TranslatorErrors.UnsupportedOperator(expr.operator.line, expr.operator.col, this.source, expr.operator.indexInSource);
            default:
                throw new Error("Unreachable binary code path in translator");
        }
        return {
            type: 'BinaryExpression',
            operator: res,
            left: this.resolveExpr(expr.left),
            right: this.resolveExpr(expr.right),
            loc: this.toEstreeLocation(expr),
        }
    }

    visitCompareExpr(expr: ExprNS.Compare): BinaryExpression {
        const op = expr.operator.type;
        let res: BinaryOperator = '+';
        // To make the type checker happy.
        switch (op) {
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
                throw new TranslatorErrors.UnsupportedOperator(expr.operator.line, expr.operator.col, this.source, expr.operator.indexInSource);
            default:
                throw new Error("Unreachable binary code path in translator");
        }
        return {
            type: 'BinaryExpression',
            operator: res,
            left: this.resolveExpr(expr.left),
            right: this.resolveExpr(expr.right),
            loc: this.toEstreeLocation(expr),
        }
    }

    visitBoolOpExpr(expr: ExprNS.BoolOp): LogicalExpression {
        const op = expr.operator.type;
        let res: LogicalOperator = '||';
        // To make the type checker happy.
        switch (op) {
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
            loc: this.toEstreeLocation(expr),
        }
    }

    visitCallExpr(expr: ExprNS.Call): CallExpression {
        return {
            type: 'CallExpression',
            optional: false,
            callee: this.resolveExpr(expr.callee),
            arguments: this.resolveManyExpr(expr.args),
            loc: this.toEstreeLocation(expr),
        }
    }

    visitTernaryExpr(expr: ExprNS.Ternary): ConditionalExpression {
        return {
            type: 'ConditionalExpression',
            test: this.resolveExpr(expr.predicate),
            alternate: this.resolveExpr(expr.alternative),
            consequent: this.resolveExpr(expr.consequent),
            loc: this.toEstreeLocation(expr),
        }
    }

    visitLiteralExpr(expr: ExprNS.Literal): SimpleLiteral {
        return {
            type: 'Literal',
            value: expr.value,
            loc: this.toEstreeLocation(expr),
        }
    }
}