import { Token } from "./tokenizer";
import { PyComplexNumber } from "./types";
export declare namespace ExprNS {
    interface Visitor<T> {
        visitBigIntLiteralExpr(expr: BigIntLiteral): T;
        visitBinaryExpr(expr: Binary): T;
        visitCompareExpr(expr: Compare): T;
        visitBoolOpExpr(expr: BoolOp): T;
        visitGroupingExpr(expr: Grouping): T;
        visitLiteralExpr(expr: Literal): T;
        visitUnaryExpr(expr: Unary): T;
        visitTernaryExpr(expr: Ternary): T;
        visitLambdaExpr(expr: Lambda): T;
        visitMultiLambdaExpr(expr: MultiLambda): T;
        visitVariableExpr(expr: Variable): T;
        visitCallExpr(expr: Call): T;
        visitComplexExpr(expr: Complex): T;
        visitNoneExpr(expr: None): T;
    }
    abstract class Expr {
        startToken: Token;
        endToken: Token;
        protected constructor(startToken: Token, endToken: Token);
        abstract accept(visitor: Visitor<any>): any;
    }
    class None extends Expr {
        constructor(startToken: Token, endToken: Token, value?: string);
        accept(visitor: Visitor<any>): any;
    }
    class BigIntLiteral extends Expr {
        value: string;
        constructor(startToken: Token, endToken: Token, value: string);
        accept(visitor: Visitor<any>): any;
    }
    class Complex extends Expr {
        value: PyComplexNumber;
        constructor(startToken: Token, endToken: Token, value: string);
        accept<T>(visitor: Visitor<T>): T;
    }
    class Binary extends Expr {
        left: Expr;
        operator: Token;
        right: Expr;
        constructor(startToken: Token, endToken: Token, left: Expr, operator: Token, right: Expr);
        accept(visitor: Visitor<any>): any;
    }
    class Compare extends Expr {
        left: Expr;
        operator: Token;
        right: Expr;
        constructor(startToken: Token, endToken: Token, left: Expr, operator: Token, right: Expr);
        accept(visitor: Visitor<any>): any;
    }
    class BoolOp extends Expr {
        left: Expr;
        operator: Token;
        right: Expr;
        constructor(startToken: Token, endToken: Token, left: Expr, operator: Token, right: Expr);
        accept(visitor: Visitor<any>): any;
    }
    class Grouping extends Expr {
        expression: Expr;
        constructor(startToken: Token, endToken: Token, expression: Expr);
        accept(visitor: Visitor<any>): any;
    }
    class Literal extends Expr {
        value: true | false | number | string;
        constructor(startToken: Token, endToken: Token, value: true | false | number | string);
        accept(visitor: Visitor<any>): any;
    }
    class Unary extends Expr {
        operator: Token;
        right: Expr;
        constructor(startToken: Token, endToken: Token, operator: Token, right: Expr);
        accept(visitor: Visitor<any>): any;
    }
    class Ternary extends Expr {
        predicate: Expr;
        consequent: Expr;
        alternative: Expr;
        constructor(startToken: Token, endToken: Token, predicate: Expr, consequent: Expr, alternative: Expr);
        accept(visitor: Visitor<any>): any;
    }
    class Lambda extends Expr {
        parameters: Token[];
        body: Expr;
        constructor(startToken: Token, endToken: Token, parameters: Token[], body: Expr);
        accept(visitor: Visitor<any>): any;
    }
    class MultiLambda extends Expr {
        parameters: Token[];
        body: StmtNS.Stmt[];
        varDecls: Token[];
        constructor(startToken: Token, endToken: Token, parameters: Token[], body: StmtNS.Stmt[], varDecls: Token[]);
        accept(visitor: Visitor<any>): any;
    }
    class Variable extends Expr {
        name: Token;
        constructor(startToken: Token, endToken: Token, name: Token);
        accept(visitor: Visitor<any>): any;
    }
    class Call extends Expr {
        callee: Expr;
        args: Expr[];
        constructor(startToken: Token, endToken: Token, callee: Expr, args: Expr[]);
        accept(visitor: Visitor<any>): any;
    }
}
export declare namespace StmtNS {
    interface Visitor<T> {
        visitIndentCreation(stmt: Indent): T;
        visitDedentCreation(stmt: Dedent): T;
        visitPassStmt(stmt: Pass): T;
        visitAssignStmt(stmt: Assign): T;
        visitAnnAssignStmt(stmt: AnnAssign): T;
        visitBreakStmt(stmt: Break): T;
        visitContinueStmt(stmt: Continue): T;
        visitReturnStmt(stmt: Return): T;
        visitFromImportStmt(stmt: FromImport): T;
        visitGlobalStmt(stmt: Global): T;
        visitNonLocalStmt(stmt: NonLocal): T;
        visitAssertStmt(stmt: Assert): T;
        visitIfStmt(stmt: If): T;
        visitWhileStmt(stmt: While): T;
        visitForStmt(stmt: For): T;
        visitFunctionDefStmt(stmt: FunctionDef): T;
        visitSimpleExprStmt(stmt: SimpleExpr): T;
        visitFileInputStmt(stmt: FileInput): T;
    }
    abstract class Stmt {
        startToken: Token;
        endToken: Token;
        protected constructor(startToken: Token, endToken: Token);
        abstract accept(visitor: Visitor<any>): any;
    }
    class Indent extends Stmt {
        constructor(startToken: Token, endToken: Token);
        accept(visitor: Visitor<any>): any;
    }
    class Dedent extends Stmt {
        constructor(startToken: Token, endToken: Token);
        accept(visitor: Visitor<any>): any;
    }
    class Pass extends Stmt {
        constructor(startToken: Token, endToken: Token);
        accept(visitor: Visitor<any>): any;
    }
    class Assign extends Stmt {
        name: Token;
        value: ExprNS.Expr;
        constructor(startToken: Token, endToken: Token, name: Token, value: ExprNS.Expr);
        accept(visitor: Visitor<any>): any;
    }
    class AnnAssign extends Stmt {
        name: Token;
        value: ExprNS.Expr;
        ann: ExprNS.Expr;
        constructor(startToken: Token, endToken: Token, name: Token, value: ExprNS.Expr, ann: ExprNS.Expr);
        accept(visitor: Visitor<any>): any;
    }
    class Break extends Stmt {
        constructor(startToken: Token, endToken: Token);
        accept(visitor: Visitor<any>): any;
    }
    class Continue extends Stmt {
        constructor(startToken: Token, endToken: Token);
        accept(visitor: Visitor<any>): any;
    }
    class Return extends Stmt {
        value: ExprNS.Expr | null;
        constructor(startToken: Token, endToken: Token, value: ExprNS.Expr | null);
        accept(visitor: Visitor<any>): any;
    }
    class FromImport extends Stmt {
        module: Token;
        names: Token[];
        constructor(startToken: Token, endToken: Token, module: Token, names: Token[]);
        accept(visitor: Visitor<any>): any;
    }
    class Global extends Stmt {
        name: Token;
        constructor(startToken: Token, endToken: Token, name: Token);
        accept(visitor: Visitor<any>): any;
    }
    class NonLocal extends Stmt {
        name: Token;
        constructor(startToken: Token, endToken: Token, name: Token);
        accept(visitor: Visitor<any>): any;
    }
    class Assert extends Stmt {
        value: ExprNS.Expr;
        constructor(startToken: Token, endToken: Token, value: ExprNS.Expr);
        accept(visitor: Visitor<any>): any;
    }
    class If extends Stmt {
        condition: ExprNS.Expr;
        body: Stmt[];
        elseBlock: Stmt[] | null;
        constructor(startToken: Token, endToken: Token, condition: ExprNS.Expr, body: Stmt[], elseBlock: Stmt[] | null);
        accept(visitor: Visitor<any>): any;
    }
    class While extends Stmt {
        condition: ExprNS.Expr;
        body: Stmt[];
        constructor(startToken: Token, endToken: Token, condition: ExprNS.Expr, body: Stmt[]);
        accept(visitor: Visitor<any>): any;
    }
    class For extends Stmt {
        target: Token;
        iter: ExprNS.Expr;
        body: Stmt[];
        constructor(startToken: Token, endToken: Token, target: Token, iter: ExprNS.Expr, body: Stmt[]);
        accept(visitor: Visitor<any>): any;
    }
    class FunctionDef extends Stmt {
        name: Token;
        parameters: Token[];
        body: Stmt[];
        varDecls: Token[];
        constructor(startToken: Token, endToken: Token, name: Token, parameters: Token[], body: Stmt[], varDecls: Token[]);
        accept(visitor: Visitor<any>): any;
    }
    class SimpleExpr extends Stmt {
        expression: ExprNS.Expr;
        constructor(startToken: Token, endToken: Token, expression: ExprNS.Expr);
        accept(visitor: Visitor<any>): any;
    }
    class FileInput extends Stmt {
        statements: Stmt[];
        varDecls: Token[];
        constructor(startToken: Token, endToken: Token, statements: Stmt[], varDecls: Token[]);
        accept(visitor: Visitor<any>): any;
    }
}
