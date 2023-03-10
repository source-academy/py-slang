import {StmtNS, ExprNS} from "./ast-types";
type Expr = ExprNS.Expr;
type Stmt = StmtNS.Stmt;
import {Token} from "./tokenizer";
import {TokenType} from "./tokens";
import {ResolverErrors} from "./errors";

const levenshtein = require('fast-levenshtein');

class Environment {
    source: string;
    // The parent of this environment
    enclosing: Environment | null;
    names: Map<string, Token>;
    // Function names in the environment.
    functions: Set<string>;
    // Names that are from import bindings, like 'y' in `from x import y`.
    // This only set at the top level environment. Child environments do not
    // copy this field.
    moduleBindings: Set<string>;
    constructor(source: string, enclosing: Environment | null, names: Map<string, Token>) {
        this.source = source;
        this.enclosing = enclosing;
        this.names = names;
        this.functions = new Set();
        this.moduleBindings = new Set();
    }

    /*
    * Does a full lookup up the environment chain for a name.
    * Returns the distance of the name from the current environment.
    * If name isn't found, return -1.
    * */
    lookupName(identifier: Token): number {
        const name = identifier.lexeme;
        let distance = 0;
        let curr: Environment | null = this;
        while(curr !== null) {
            if (curr.names.has(name)) {
                break;
            }
            distance += 1;
            curr = curr.enclosing;
        }
        return (curr === null) ? -1 : distance;
    }

    /* Looks up the name but only for the current environment. */
    lookupNameCurrentEnv(identifier: Token): Token | undefined {
        return this.names.get(identifier.lexeme);
    }
    lookupNameCurrentEnvWithError(identifier: Token){
        if (this.lookupName(identifier) < 0) {
            throw new ResolverErrors.NameNotFoundError(identifier.line, identifier.col,
                this.source,
                identifier.indexInSource,
                identifier.indexInSource + identifier.lexeme.length,
                this.suggestName(identifier));
        }
    }
    lookupNameParentEnvWithError(identifier: Token) {
        const name = identifier.lexeme;
        let parent = this.enclosing;
        if (parent === null || !parent.names.has(name)) {
            throw new ResolverErrors.NameNotFoundError(identifier.line, identifier.col,
                this.source,
                identifier.indexInSource,
                identifier.indexInSource + name.length,
                this.suggestName(identifier));
        }

    }
    declareName(identifier: Token) {
        const lookup = this.lookupNameCurrentEnv(identifier);
        if (lookup !== undefined) {
            throw new ResolverErrors.NameReassignmentError(identifier.line, identifier.col,
                this.source,
                identifier.indexInSource,
                identifier.indexInSource + identifier.lexeme.length,
                lookup);

        }
        this.names.set(identifier.lexeme, identifier);
    }
    suggestNameCurrentEnv(identifier: Token): string | null {
        const name = identifier.lexeme;
        let minDistance = Infinity;
        let minName = null;
        for (const declName of this.names.keys()) {
            const dist = levenshtein.get(name, declName);
            if (dist < minDistance) {
                minDistance = dist;
                minName = declName;
            }
        }
        return minName;
    }
    /*
    * Finds name closest to name in all environments up to builtin environment.
    * Calculated using min levenshtein distance.
    * */
    suggestName(identifier: Token): string | null {
        const name = identifier.lexeme;
        let minDistance = Infinity;
        let minName = null;
        let curr: Environment | null = this;
        while(curr !== null) {
            for (const declName of curr.names.keys()) {
                const dist = levenshtein.get(name, declName);
                if (dist < minDistance) {
                    minDistance = dist;
                    minName = declName;
                }
            }
            curr = curr.enclosing;
        }
        if (minDistance >= 4) {
            // This is pretty far, so just return null
            return null;
        }
        return minName;
    }

}
export class Resolver implements StmtNS.Visitor<void>, ExprNS.Visitor<void> {
    source: string;
    ast: Stmt;
    environment: Environment | null;
    constructor(source: string, ast: Stmt) {
        this.source = source;
        this.ast = ast;
        // The global environment
        this.environment = new Environment(source,null, new Map([
            ["range", new Token(TokenType.NAME, "range", 0, 0, 0)],
            ["display", new Token(TokenType.NAME, "display", 0, 0, 0)],
            ["stringify", new Token(TokenType.NAME, "stringify", 0, 0, 0)],
            // @TODO add all the source pre-declared names here
        ]));
    }
    resolve(stmt: Stmt[] | Stmt | Expr[] | Expr | null) {
        if (stmt === null) {
            return;
        }
        if (stmt instanceof Array) {
            for (const st of stmt) {
                st.accept(this);
            }
        } else {
            stmt.accept(this);
        }
    }

    varDeclNames(names: Map<string, Token>): Token[] | null {
        const res = Array.from(names.values())
            .filter(name => (
                // Filter out functions and module bindings.
                // Those will be handled separately, so they don't
                // need to be hoisted.
                !this.environment?.functions.has(name.lexeme)
                && !this.environment?.moduleBindings.has(name.lexeme)
            ));
        return res.length === 0 ? null : res;
    }

    //// STATEMENTS
    visitFileInputStmt(stmt: StmtNS.FileInput): void {
        // Create a new environment.
        const oldEnv = this.environment;
        this.environment = new Environment(this.source, this.environment, new Map());
        this.resolve(stmt.statements);
        // Grab identifiers from that new environment. That are NOT functions.
        // stmt.varDecls = this.varDeclNames(this.environment.names)
        this.environment = oldEnv;
    }

    visitFunctionDefStmt(stmt: StmtNS.FunctionDef) {
        this.environment?.declareName(stmt.name);
        this.environment?.functions.add(stmt.name.lexeme);
        // Create a new environment.
        const oldEnv = this.environment;
        // Assign the parameters to the new environment.
        const newEnv = new Map(
            stmt.parameters.map(param => [param.lexeme, param])
        );
        this.environment = new Environment(this.source, this.environment, newEnv);
        this.resolve(stmt.body);
        // Grab identifiers from that new environment. That are NOT functions.
        // stmt.varDecls = this.varDeclNames(this.environment.names)
        // Restore old environment
        this.environment = oldEnv;
    }

    visitAnnAssignStmt(stmt: StmtNS.AnnAssign): void {
        this.resolve(stmt.ann);
        this.resolve(stmt.value);
        this.environment?.declareName(stmt.name);
    }

    visitAssignStmt(stmt: StmtNS.Assign): void {
        this.resolve(stmt.value);
        this.environment?.declareName(stmt.name);
    }

    visitAssertStmt(stmt: StmtNS.Assert): void {
        this.resolve(stmt.value);
    }
    visitForStmt(stmt: StmtNS.For): void {
        this.environment?.declareName(stmt.target);
        this.resolve(stmt.iter);
        this.resolve(stmt.body);
    }

    visitIfStmt(stmt: StmtNS.If): void {
        this.resolve(stmt.condition);
        this.resolve(stmt.body);
        this.resolve(stmt.elseBlock);
    }
    // @TODO we need to treat all global statements as variable declarations in the global
    // scope.
    visitGlobalStmt(stmt: StmtNS.Global): void {
        // Do nothing because global can also be declared in our
        // own scope.
    }
    // @TODO nonlocals mean that any variable following that name in the current env
    // should not create a variable declaration, but instead point to an outer variable.
    visitNonLocalStmt(stmt: StmtNS.NonLocal): void {
        this.environment?.lookupNameParentEnvWithError(stmt.name);
    }

    visitReturnStmt(stmt: StmtNS.Return): void {
        if (stmt.value !== null) {
            this.resolve(stmt.value);
        }
    }

    visitWhileStmt(stmt: StmtNS.While): void {
        this.resolve(stmt.condition);
        this.resolve(stmt.body);
    }
    visitSimpleExprStmt(stmt: StmtNS.SimpleExpr): void {
        this.resolve(stmt.expression);
    }

    visitFromImportStmt(stmt: StmtNS.FromImport): void {
        for (const name of stmt.names) {
            this.environment?.declareName(name);
            this.environment?.moduleBindings.add(name.lexeme);
        }
    }

    visitContinueStmt(stmt: StmtNS.Continue): void {
    }
    visitBreakStmt(stmt: StmtNS.Break): void {
    }
    visitPassStmt(stmt: StmtNS.Pass): void {
    }





    //// EXPRESSIONS
    visitVariableExpr(expr: ExprNS.Variable): void {
        this.environment?.lookupNameCurrentEnvWithError(expr.name);
    }
    visitLambdaExpr(expr: ExprNS.Lambda): void {
        // Create a new environment.
        const oldEnv = this.environment;
        // Assign the parameters to the new environment.
        const newEnv = new Map(
            expr.parameters.map(param => [param.lexeme, param])
        );
        this.environment = new Environment(this.source, this.environment, newEnv);
        this.resolve(expr.body);
        // Restore old environment
        this.environment = oldEnv;
    }
    visitMultiLambdaExpr(expr: ExprNS.MultiLambda): void {
        // Create a new environment.
        const oldEnv = this.environment;
        // Assign the parameters to the new environment.
        const newEnv = new Map(
            expr.parameters.map(param => [param.lexeme, param])
        );
        this.environment = new Environment(this.source, this.environment, newEnv);
        this.resolve(expr.body);
        // Grab identifiers from that new environment.
        expr.varDecls = Array.from(this.environment.names.values());
        // Restore old environment
        this.environment = oldEnv;
    }
    visitUnaryExpr(expr: ExprNS.Unary): void {
        this.resolve(expr.right);
    }
    visitGroupingExpr(expr: ExprNS.Grouping): void {
        this.resolve(expr.expression);
    }
    visitBinaryExpr(expr: ExprNS.Binary): void {
        this.resolve(expr.left);
        this.resolve(expr.right);
    }
    visitBoolOpExpr(expr: ExprNS.BoolOp): void {
        this.resolve(expr.left);
        this.resolve(expr.right);
    }
    visitCompareExpr(expr: ExprNS.Compare): void {
        this.resolve(expr.left);
        this.resolve(expr.right);
    }

    visitCallExpr(expr: ExprNS.Call): void {
        this.resolve(expr.callee);
        this.resolve(expr.args);
    }
    visitTernaryExpr(expr: ExprNS.Ternary): void {
        this.resolve(expr.predicate);
        this.resolve(expr.consequent);
        this.resolve(expr.alternative);
    }
    visitLiteralExpr(expr: ExprNS.Literal): void {
    }


}