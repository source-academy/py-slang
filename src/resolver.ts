import { StmtNS, ExprNS } from "./ast-types";
type Expr = ExprNS.Expr;
type Stmt = StmtNS.Stmt;
import { Token } from "./tokenizer";
import { TokenType } from "./tokens";
import { ResolverErrors } from "./errors";

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
        while (curr !== null) {
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
    lookupNameCurrentEnvWithError(identifier: Token) {
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
        while (curr !== null) {
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
    // change the environment to be suite scope as in python
    environment: Environment | null;
    functionScope: Environment | null;
    constructor(source: string, ast: Stmt) {
        this.source = source;
        this.ast = ast;
        // The global environment
        this.environment = new Environment(source, null, new Map([
            // misc library
            ["get_time", new Token(TokenType.NAME, "get_time", 0, 0, 0)],
            ["print", new Token(TokenType.NAME, "print", 0, 0, 0)],
            ["raw_print", new Token(TokenType.NAME, "raw_print", 0, 0, 0)],
            ["str", new Token(TokenType.NAME, "str", 0, 0, 0)],
            ["error", new Token(TokenType.NAME, "error", 0, 0, 0)],
            ["prompt", new Token(TokenType.NAME, "prompt", 0, 0, 0)],
            ["is_float", new Token(TokenType.NAME, "is_float", 0, 0, 0)],
            ["is_int", new Token(TokenType.NAME, "is_int", 0, 0, 0)],
            ["is_string", new Token(TokenType.NAME, "is_string", 0, 0, 0)],
            ["is_function", new Token(TokenType.NAME, "is_function", 0, 0, 0)],
            ["is_boolean", new Token(TokenType.NAME, "is_boolean", 0, 0, 0)],
            ["parse_int", new Token(TokenType.NAME, "parse_int", 0, 0, 0)],
            ["char_at", new Token(TokenType.NAME, "char_at", 0, 0, 0)],
            ["arity", new Token(TokenType.NAME, "arity", 0, 0, 0)],
            ["None", new Token(TokenType.NAME, "None", 0, 0, 0)],
            ["NaN", new Token(TokenType.NAME, "NaN", 0, 0, 0)],
            ["Infinity", new Token(TokenType.NAME, "Infinity", 0, 0, 0)],

            // math library
            ["math_abs", new Token(TokenType.NAME, "math_abs", 0, 0, 0)],
            ["math_acos", new Token(TokenType.NAME, "math_acos", 0, 0, 0)],
            ["math_acosh", new Token(TokenType.NAME, "math_acosh", 0, 0, 0)],
            ["math_asin", new Token(TokenType.NAME, "math_asin", 0, 0, 0)],
            ["math_asinh", new Token(TokenType.NAME, "math_asinh", 0, 0, 0)],
            ["math_atan", new Token(TokenType.NAME, "math_atan", 0, 0, 0)],
            ["math_atan2", new Token(TokenType.NAME, "math_atan2", 0, 0, 0)],
            ["math_atanh", new Token(TokenType.NAME, "math_atanh", 0, 0, 0)],
            ["math_cbrt", new Token(TokenType.NAME, "math_cbrt", 0, 0, 0)],
            ["math_ceil", new Token(TokenType.NAME, "math_ceil", 0, 0, 0)],
            ["math_clz32", new Token(TokenType.NAME, "math_clz32", 0, 0, 0)],
            ["math_cos", new Token(TokenType.NAME, "math_cos", 0, 0, 0)],
            ["math_cosh", new Token(TokenType.NAME, "math_cosh", 0, 0, 0)],
            ["math_exp", new Token(TokenType.NAME, "math_exp", 0, 0, 0)],
            ["math_expm1", new Token(TokenType.NAME, "math_expm1", 0, 0, 0)],
            ["math_floor", new Token(TokenType.NAME, "math_floor", 0, 0, 0)],
            ["math_fround", new Token(TokenType.NAME, "math_fround", 0, 0, 0)],
            ["math_hypot", new Token(TokenType.NAME, "math_hypot", 0, 0, 0)],
            ["math_imul", new Token(TokenType.NAME, "math_imul", 0, 0, 0)],
            ["math_log", new Token(TokenType.NAME, "math_log", 0, 0, 0)],
            ["math_log1p", new Token(TokenType.NAME, "math_log1p", 0, 0, 0)],
            ["math_log2", new Token(TokenType.NAME, "math_log2", 0, 0, 0)],
            ["math_log10", new Token(TokenType.NAME, "math_log10", 0, 0, 0)],
            ["math_max", new Token(TokenType.NAME, "math_max", 0, 0, 0)],
            ["math_min", new Token(TokenType.NAME, "math_min", 0, 0, 0)],
            ["math_pow", new Token(TokenType.NAME, "math_pow", 0, 0, 0)],
            ["math_random", new Token(TokenType.NAME, "math_random", 0, 0, 0)],
            ["math_round", new Token(TokenType.NAME, "math_round", 0, 0, 0)],
            ["math_sign", new Token(TokenType.NAME, "math_sign", 0, 0, 0)],
            ["math_sin", new Token(TokenType.NAME, "math_sin", 0, 0, 0)],
            ["math_sinh", new Token(TokenType.NAME, "math_sinh", 0, 0, 0)],
            ["math_sqrt", new Token(TokenType.NAME, "math_sqrt", 0, 0, 0)],
            ["math_tan", new Token(TokenType.NAME, "math_tan", 0, 0, 0)],
            ["math_tanh", new Token(TokenType.NAME, "math_tanh", 0, 0, 0)],
            ["math_trunc", new Token(TokenType.NAME, "math_trunc", 0, 0, 0)],
        ]));
        this.functionScope = null;
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

    functionVarConstraint(identifier: Token): void {
        if (this.functionScope == null) {
            return;
        }
        let curr = this.environment;
        while (curr !== this.functionScope) {
            if (curr !== null && curr.names.has(identifier.lexeme)) {
                const token = curr.names.get(identifier.lexeme);
                if (token === undefined) {
                    throw new Error("placeholder error")
                }
                throw new ResolverErrors.NameReassignmentError(identifier.line, identifier.col,
                    this.source,
                    identifier.indexInSource,
                    identifier.indexInSource + identifier.lexeme.length,
                    token);
            }
            curr = curr?.enclosing ?? null;
        }
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

    visitIndentCreation(stmt: StmtNS.Indent): void {
        // Create a new environment
        this.environment = new Environment(this.source, this.environment, new Map());
    }

    visitDedentCreation(stmt: StmtNS.Dedent): void {
        // Switch to the previous environment.
        if (this.environment?.enclosing !== undefined) {
            this.environment = this.environment.enclosing;
        }
    }

    visitFunctionDefStmt(stmt: StmtNS.FunctionDef) {
        this.environment?.declareName(stmt.name);
        this.environment?.functions.add(stmt.name.lexeme);
        // Create a new environment.
        // const oldEnv = this.environment;
        // Assign the parameters to the new environment.
        const newEnv = new Map(
            stmt.parameters.map(param => [param.lexeme, param])
        );
        this.environment = new Environment(this.source, this.environment, newEnv);
        // const params = new Map(
        //     stmt.parameters.map(param => [param.lexeme, param])
        // );
        // if (this.environment !== null) {
        //     this.environment.names = params;
        // }
        this.functionScope = this.environment;
        this.resolve(stmt.body);
        // Grab identifiers from that new environment. That are NOT functions.
        // stmt.varDecls = this.varDeclNames(this.environment.names)
        // Restore old environment
        // this.environment = oldEnv;
    }

    visitAnnAssignStmt(stmt: StmtNS.AnnAssign): void {
        this.resolve(stmt.ann);
        this.resolve(stmt.value);
        this.functionVarConstraint(stmt.name);
        this.environment?.declareName(stmt.name);
    }

    visitAssignStmt(stmt: StmtNS.Assign): void {
        this.resolve(stmt.value);
        this.functionVarConstraint(stmt.name);
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
    visitBigIntLiteralExpr(expr: ExprNS.BigIntLiteral): void {
    }

}
