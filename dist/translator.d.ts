import { StmtNS, ExprNS } from "./ast-types";
type Expr = ExprNS.Expr;
type Stmt = StmtNS.Stmt;
import { ArrowFunctionExpression, AssignmentExpression, BaseNode, BigIntLiteral, BinaryExpression, BreakStatement, CallExpression, ConditionalExpression, ContinueStatement, EmptyStatement, Expression, ExpressionStatement, FunctionDeclaration, Identifier, IfStatement, ImportDeclaration, LogicalExpression, Program, ReturnStatement, SimpleLiteral, Statement, UnaryExpression, VariableDeclaration, WhileStatement } from "estree";
import { ComplexLiteral, None } from "./types";
export interface EstreePosition {
    line: number;
    column: number;
}
export interface EstreeLocation {
    source: string;
    start: EstreePosition;
    end: EstreePosition;
}
export declare class Translator implements StmtNS.Visitor<BaseNode>, ExprNS.Visitor<BaseNode> {
    private readonly source;
    constructor(source: string);
    private tokenToEstreeLocation;
    private toEstreeLocation;
    resolve(stmt: Stmt | Expr): Statement | Expression;
    resolveStmt(stmt: Stmt): any;
    resolveManyStmt(stmts: Stmt[]): Statement[];
    resolveExpr(expr: Expr): any;
    resolveManyExpr(exprs: Expr[]): any[];
    private rawStringToIdentifier;
    private convertToIdentifier;
    private convertToIdentifiers;
    private wrapInBlock;
    visitFileInputStmt(stmt: StmtNS.FileInput): Program;
    visitIndentCreation(stmt: StmtNS.Indent): EmptyStatement;
    visitDedentCreation(stmt: StmtNS.Dedent): EmptyStatement;
    visitFunctionDefStmt(stmt: StmtNS.FunctionDef): FunctionDeclaration;
    visitAnnAssignStmt(stmt: StmtNS.AnnAssign): AssignmentExpression;
    visitAssignStmt(stmt: StmtNS.Assign): VariableDeclaration;
    visitAssertStmt(stmt: StmtNS.Assert): CallExpression;
    visitForStmt(stmt: StmtNS.For): EmptyStatement;
    visitIfStmt(stmt: StmtNS.If): IfStatement;
    visitGlobalStmt(stmt: StmtNS.Global): EmptyStatement;
    visitNonLocalStmt(stmt: StmtNS.NonLocal): EmptyStatement;
    visitReturnStmt(stmt: StmtNS.Return): ReturnStatement;
    visitWhileStmt(stmt: StmtNS.While): WhileStatement;
    visitSimpleExprStmt(stmt: StmtNS.SimpleExpr): ExpressionStatement;
    visitFromImportStmt(stmt: StmtNS.FromImport): ImportDeclaration;
    visitContinueStmt(stmt: StmtNS.Continue): ContinueStatement;
    visitBreakStmt(stmt: StmtNS.Break): BreakStatement;
    visitPassStmt(stmt: StmtNS.Pass): EmptyStatement;
    visitVariableExpr(expr: ExprNS.Variable): Identifier;
    visitLambdaExpr(expr: ExprNS.Lambda): ArrowFunctionExpression;
    visitMultiLambdaExpr(expr: ExprNS.MultiLambda): EmptyStatement;
    visitUnaryExpr(expr: ExprNS.Unary): UnaryExpression | CallExpression;
    visitGroupingExpr(expr: ExprNS.Grouping): Expression;
    visitBinaryExpr(expr: ExprNS.Binary): CallExpression;
    visitCompareExpr(expr: ExprNS.Compare): BinaryExpression;
    visitBoolOpExpr(expr: ExprNS.BoolOp): LogicalExpression;
    visitCallExpr(expr: ExprNS.Call): CallExpression;
    visitTernaryExpr(expr: ExprNS.Ternary): ConditionalExpression;
    visitLiteralExpr(expr: ExprNS.Literal): SimpleLiteral;
    visitBigIntLiteralExpr(expr: ExprNS.BigIntLiteral): BigIntLiteral;
    visitNoneExpr(expr: ExprNS.None): None;
    visitComplexExpr(expr: ExprNS.Complex): ComplexLiteral;
}
export {};
