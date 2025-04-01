/*
* Translate our AST to estree AST (Source's AST)
* */

import { StmtNS, ExprNS } from "./ast-types";

type Expr = ExprNS.Expr;
type Stmt = StmtNS.Stmt;
import { Token } from "./tokenizer";
import { TokenType } from "./tokens";

import {
    ArrowFunctionExpression,
    AssignmentExpression,
    BaseNode,
    BigIntLiteral,
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
import { TranslatorErrors } from "./errors";
import { ComplexLiteral, None } from "./types";
// import { isEmpty } from "lodash";

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
        return { source, start, end };
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
        return { source, start, end };
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
        const keywords = new Set<String>(['abstract', 'arguments', 'await', 'boolean', 'byte',
            'case', 'catch', 'char', 'const', 'debugger', 'default', 'delete', 'do', 'double', 'enum',
            'eval', 'export', 'extends', 'false', 'final', 'float', 'function', 'goto', 'implements',
            'instanceof', 'int', 'interface', 'let', 'long', 'native', 'new', 'null', 'package',
            'private', 'protected', 'public', 'short', 'static', 'super', 'switch', 'synchronized', 'this',
            'throw', 'throws', 'transient', 'true', 'typeof', 'var', 'void', 'volatile'])

        return {
            type: 'Identifier',
            name: keywords.has(name) ? '$' + name : name,
            loc: this.toEstreeLocation(stmtOrExpr),
        };
    }

    // Token to estree identifier.
    private convertToIdentifier(name: Token): Identifier {
        const keywords = new Set<String>(['abstract', 'arguments', 'await', 'boolean', 'byte',
            'case', 'catch', 'char', 'const', 'debugger', 'default', 'delete', 'do', 'double', 'enum',
            'eval', 'export', 'extends', 'false', 'final', 'float', 'function', 'goto', 'implements',
            'instanceof', 'int', 'interface', 'let', 'long', 'native', 'new', 'null', 'package',
            'private', 'protected', 'public', 'short', 'static', 'super', 'switch', 'synchronized', 'this',
            'throw', 'throws', 'transient', 'true', 'typeof', 'var', 'void', 'volatile'])

        return {
            type: 'Identifier',
            name: keywords.has(name.lexeme) ? '$' + name.lexeme : name.lexeme,
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

    visitIndentCreation(stmt: StmtNS.Indent): EmptyStatement {
        return {
            type: 'EmptyStatement',
            loc: this.toEstreeLocation(stmt),
        };
    }

    visitDedentCreation(stmt: StmtNS.Dedent): EmptyStatement {
        return {
            type: 'EmptyStatement',
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
            },
            attributes: []
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

    visitUnaryExpr(expr: ExprNS.Unary): UnaryExpression | CallExpression {
        const op = expr.operator.type;
        let res: UnaryOperator = '-';
        let plus = false;
        switch (op) {
            case TokenType.NOT:
                res = '!'
                break;
            case TokenType.PLUS:
                res = '+';
                plus = true;
                break;
            case TokenType.MINUS:
                res = '-'
                break;
            default:
                throw new Error("Unreachable code path in translator");
        }
        if (plus) {
            return {
                type: 'CallExpression',
                optional: false,
                callee: {
                    type: 'Identifier',
                    name: '__py_unary_plus',
                    loc: this.toEstreeLocation(expr),
                },
                arguments: [this.resolveExpr(expr.right)],
                loc: this.toEstreeLocation(expr),
            }
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

    visitBinaryExpr(expr: ExprNS.Binary): CallExpression {
        const op = expr.operator.type;
        let res = '';
        // To make the type checker happy.
        switch (op) {
            case TokenType.PLUS:
                res = '__py_adder';
                break;
            case TokenType.MINUS:
                res = '__py_minuser';
                break;
            case TokenType.STAR:
                res = '__py_multiplier';
                break;
            case TokenType.SLASH:
                res = '__py_divider';
                break;
            case TokenType.PERCENT:
                res = '__py_modder';
                break;
            // @TODO double slash and power needs to convert to math exponent/floor divide
            case TokenType.DOUBLESLASH:
                res = '__py_floorer';
                break;
            case TokenType.DOUBLESTAR:
                res = '__py_powerer';
                break;
            default:
                throw new Error("Unreachable binary code path in translator");
        }
        return {
            type: 'CallExpression',
            optional: false,
            callee: {
                type: 'Identifier',
                name: res,
                loc: this.toEstreeLocation(expr),
            },
            arguments: [this.resolveExpr(expr.left), this.resolveExpr(expr.right)],
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

    visitBigIntLiteralExpr(expr: ExprNS.BigIntLiteral): BigIntLiteral {
        return {
            type: 'Literal',
            bigint: expr.value,
            loc: this.toEstreeLocation(expr),
        }
    }

    visitNoneExpr(expr: ExprNS.None): None {
        return {
            type: 'NoneType',
            loc: this.toEstreeLocation(expr)
        }
    }

    visitComplexExpr(expr: ExprNS.Complex): ComplexLiteral {
        return {
            // 你可以复用 "Literal"，也可以用别的 type 标记
            // 这里保持和 BigInt 的风格一致
            type: 'Literal',
    
            // 和 visitBigIntLiteralExpr 类似，这里用一个字段来保存复数内容
            // 比如把它叫做 "complex"
            // expr.value 是一个 PyComplexNumber, 你可以用 toString(), 或者直接存 real/imag
            complex: {
                real: expr.value.real,
                imag: expr.value.imag
            },
    
            // 和其它 literal 一样，加上位置信息
            loc: this.toEstreeLocation(expr),
        }
    }
    
}