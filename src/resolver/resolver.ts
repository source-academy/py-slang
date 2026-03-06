import { StmtNS, ExprNS } from "../ast-types";
import { Group } from "../stdlib/utils";
type Expr = ExprNS.Expr;
type Stmt = StmtNS.Stmt;
import { Token } from "../tokenizer/tokenizer";
import { TokenType } from "../tokens";
import { ResolverErrors } from "./errors";

import levenshtein from 'fast-levenshtein';
import constants from '../stdlib/py_s1_constants.json'
// const levenshtein = require('fast-levenshtein');

const RedefineableTokenSentinel = new Token(TokenType.AT, "", 0, 0, 0);

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
    definedNames: Set<string>;
    constructor(source: string, enclosing: Environment | null, names: Map<string, Token>) {
        this.source = source;
        this.enclosing = enclosing;
        this.names = names;
        this.functions = new Set();
        this.moduleBindings = new Set();
        this.definedNames = new Set();
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
        // if (lookup !== undefined && this.definedNames.has(identifier.lexeme)) { 
        //     throw new ResolverErrors.NameReassignmentError(identifier.line, identifier.col,
        //         this.source,
        //         identifier.indexInSource,
        //         identifier.indexInSource + identifier.lexeme.length,
        //         lookup);
        // }
        // if (lookup !== undefined && lookup !== RedefineableTokenSentinel) {
        //     throw new ResolverErrors.NameReassignmentError(identifier.line, identifier.col,
        //         this.source,
        //         identifier.indexInSource,
        //         identifier.indexInSource + identifier.lexeme.length,
        //         lookup);

        // }
        this.names.set(identifier.lexeme, identifier);
        this.definedNames.add(identifier.lexeme);
    }
    // Same as declareName but allowed to re-declare later.
    declarePlaceholderName(identifier: Token) {
        const lookup = this.lookupNameCurrentEnv(identifier);
        if (lookup !== undefined) {
            throw new ResolverErrors.NameReassignmentError(identifier.line, identifier.col,
                this.source,
                identifier.indexInSource,
                identifier.indexInSource + identifier.lexeme.length,
                lookup);

        }
        this.names.set(identifier.lexeme, RedefineableTokenSentinel);
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
    variant: number;
    environment: Environment | null;
    functionScope: Environment | null;
    loopDepth: number = 0;
    constructor(source: string, ast: Stmt, variant: number, groups: Group[] = [], preludeNames: string[] = []) {
        
        this.source = source;
        this.ast = ast;
        this.variant = variant;
        // The global environment
        this.environment = new Environment(source, null, new Map([
            // misc library
            ...constants.builtInFuncs.map((name: string) => [name, new Token(TokenType.NAME, name, 0, 0, 0)] as [string, Token]),
            ...constants.constants.map((name: string) => [name, new Token(TokenType.NAME, name, 0, 0, 0)] as [string, Token]),
            ...groups.flatMap(group => Array.from(group.builtins.entries()).map(([name, value]) => [name, new Token(TokenType.NAME, name, 0, 0, 0)] as [string, Token])),
            ...preludeNames.map(name => [name, new Token(TokenType.NAME, name, 0, 0, 0)] as [string, Token])
        ]));
        this.functionScope = null;
    }
    
    resolve(stmt: Stmt[] | Stmt | Expr[] | Expr | null) {
        if (stmt === null) {
            return;
        }
        if (stmt instanceof Array) {
            // Resolve all top-level functions first. Python allows functions declared after
            // another function to be used in that function.
            for (const st of stmt) {
                if (st instanceof StmtNS.FunctionDef) {
                    this.environment?.declarePlaceholderName(st.name);
                }
            }
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
        const oldEnv = this.environment;
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
        this.functionScope = null;
        this.environment = oldEnv;
    }

    visitAnnAssignStmt(stmt: StmtNS.AnnAssign): void {
        if (this.variant <= 4) { // Only supported in a future sublanguage
            throw new ResolverErrors.UnsupportedFeatureError(stmt.startToken.line, stmt.startToken.col, this.source, stmt.startToken.indexInSource, stmt.startToken.indexInSource + stmt.startToken.lexeme.length);
        }
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

    _declareForTargetNames(target: Expr): void {
        if (target instanceof ExprNS.Variable) {
            this.environment?.declareName(target.name);
        } else if (target instanceof ExprNS.Tuple) { 
            for (const element of target.elements) {
                this._declareForTargetNames(element);
            }
        } else {
            throw new ResolverErrors.InvalidSyntaxError(target.startToken.line, target.startToken.col, this.source, target.startToken.indexInSource, target.startToken.indexInSource + target.startToken.lexeme.length, "Invalid assignment target.");
        }
    }
    visitForStmt(stmt: StmtNS.For): void {
        this._declareForTargetNames(stmt.target);
        this.resolve(stmt.iter);
        this.loopDepth += 1;
        this.resolve(stmt.body);
        this.loopDepth -= 1;
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
        this.loopDepth += 1;
        this.resolve(stmt.body);
        this.loopDepth -= 1;
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
        if (this.loopDepth === 0) {
            throw new ResolverErrors.InvalidSyntaxError(stmt.startToken.line, stmt.startToken.col, this.source, stmt.startToken.indexInSource, stmt.startToken.indexInSource + stmt.startToken.lexeme.length, "'continue' outside of loop");
        }
    }
    visitBreakStmt(stmt: StmtNS.Break): void {
        if (this.loopDepth === 0) {
            throw new ResolverErrors.InvalidSyntaxError(stmt.startToken.line, stmt.startToken.col, this.source, stmt.startToken.indexInSource, stmt.startToken.indexInSource + stmt.startToken.lexeme.length, "'break' outside of loop");
        }
    }
    visitPassStmt(stmt: StmtNS.Pass): void {}





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
    visitNoneExpr(expr: ExprNS.None): void {
    }
    visitLiteralExpr(expr: ExprNS.Literal): void {
    }
    visitBigIntLiteralExpr(expr: ExprNS.BigIntLiteral): void {
    }
    visitComplexExpr(expr: ExprNS.Complex): void {
    }

    visitListExpr(expr: ExprNS.List): void {
        if (this.variant < 3) {
            throw new ResolverErrors.UnsupportedFeatureError(expr.startToken.line, expr.startToken.col, this.source, expr.startToken.indexInSource, expr.startToken.indexInSource + expr.startToken.lexeme.length);
        }
        this.resolve(expr.elements);
    }
    visitSubscriptExpr(expr: ExprNS.Subscript): void {
        if (this.variant < 3) {
            throw new ResolverErrors.UnsupportedFeatureError(expr.startToken.line, expr.startToken.col, this.source, expr.startToken.indexInSource, expr.startToken.indexInSource + expr.startToken.lexeme.length);
        }
        this.resolve(expr.value);
        this.resolve(expr.index);
    }
    visitTupleExpr(expr: ExprNS.Tuple): void {
        if (this.variant <= 4) {
            throw new ResolverErrors.UnsupportedFeatureError(expr.startToken.line, expr.startToken.col, this.source, expr.startToken.indexInSource, expr.startToken.indexInSource + expr.startToken.lexeme.length);
        }
        for (const element of expr.elements) {
            this.resolve(element);
        }
    }
}
