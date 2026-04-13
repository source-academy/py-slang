import { ExprNS, StmtNS } from "../ast-types";
import constants from "../stdlib/py_s1_constants.json";
import { Group } from "../stdlib/utils";
import { Token } from "../tokenizer/tokenizer";
import { TokenType } from "../tokens";
import { FeatureValidator } from "../validator/types";
import { ResolverErrors } from "./errors";
type Expr = ExprNS.Expr;
type Stmt = StmtNS.Stmt;

import levenshtein from "fast-levenshtein";
// const levenshtein = require('fast-levenshtein');

export type FunctionEnvironments = Map<
  StmtNS.FileInput | StmtNS.FunctionDef | ExprNS.Lambda | ExprNS.MultiLambda,
  Environment
>;

const RedefineableTokenSentinel = new Token(TokenType.AT, "", 0, 0, 0);

export class Environment {
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
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let curr: Environment | null = this;
    while (curr !== null) {
      if (curr.names.has(name)) {
        break;
      }
      distance += 1;
      curr = curr.enclosing;
    }
    return curr === null ? -1 : distance;
  }

  /**
   * Looks up the name in the environment chain.
   * Returns the Environment where the name is found, or null if not found.
   */
  lookupNameEnv(identifier: Token): Environment | null {
    if (this.names.has(identifier.lexeme)) {
      return this;
    }
    for (let curr = this.enclosing; curr !== null; curr = curr.enclosing) {
      if (curr.names.has(identifier.lexeme)) {
        return curr;
      }
    }
    return null;
  }

  /* Looks up the name but only for the current environment. */
  lookupNameCurrentEnv(identifier: Token): Token | undefined {
    return this.names.get(identifier.lexeme);
  }
  lookupNameCurrentEnvWithError(identifier: Token) {
    if (this.lookupName(identifier) < 0) {
      throw new ResolverErrors.NameNotFoundError(
        identifier.line,
        identifier.col,
        this.source,
        identifier.indexInSource,
        identifier.indexInSource + identifier.lexeme.length,
        this.suggestName(identifier),
      );
    }
  }
  lookupNameParentEnvWithError(identifier: Token) {
    const name = identifier.lexeme;
    const parent = this.enclosing;

    if (parent === null || !parent.names.has(name)) {
      throw new ResolverErrors.NameNotFoundError(
        identifier.line,
        identifier.col,
        this.source,
        identifier.indexInSource,
        identifier.indexInSource + name.length,
        this.suggestName(identifier),
      );
    }
  }
  declareName(identifier: Token) {
    this.names.set(identifier.lexeme, identifier);
    this.definedNames.add(identifier.lexeme);
  }
  // Same as declareName but allowed to re-declare later.
  declarePlaceholderName(identifier: Token) {
    const lookup = this.lookupNameCurrentEnv(identifier);
    if (lookup !== undefined) {
      throw new ResolverErrors.NameReassignmentError(
        identifier.line,
        identifier.col,
        this.source,
        identifier.indexInSource,
        identifier.indexInSource + identifier.lexeme.length,
        lookup,
      );
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
    // eslint-disable-next-line @typescript-eslint/no-this-alias
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
  environment: Environment | null;
  functionScope: Environment | null;
  errors: Error[];
  functionEnvironments: FunctionEnvironments;
  private validators: FeatureValidator[];

  constructor(
    source: string,
    ast: Stmt,
    validators: FeatureValidator[] = [],
    groups: Group[] = [],
    preludeNames: string[] = [],
  ) {
    this.source = source;
    this.ast = ast;
    this.source = source;
    this.ast = ast;
    this.validators = validators;
    this.errors = [];
    this.functionEnvironments = new Map();
    // The global environment
    this.environment = new Environment(
      source,
      null,
      new Map([
        // misc library
        ...constants.builtInFuncs.map(
          (name: string) => [name, new Token(TokenType.NAME, name, 0, 0, 0)] as [string, Token],
        ),
        ["range", new Token(TokenType.NAME, "range", 0, 0, 0)],
        ...constants.constants.map(
          (name: string) => [name, new Token(TokenType.NAME, name, 0, 0, 0)] as [string, Token],
        ),
        ...groups.flatMap(group =>
          Array.from(group.builtins.entries()).map(
            ([name]) => [name, new Token(TokenType.NAME, name, 0, 0, 0)] as [string, Token],
          ),
        ),
        ...preludeNames.map(
          name => [name, new Token(TokenType.NAME, name, 0, 0, 0)] as [string, Token],
        ),
      ]),
    );
    this.functionScope = null;
  }

  resolveEnvironments(program: StmtNS.FileInput): FunctionEnvironments {
    this.resolve(program);
    return this.functionEnvironments;
  }

  private runValidators(node: StmtNS.Stmt | ExprNS.Expr): void {
    try {
      for (const v of this.validators) v.validate(node, this.environment ?? undefined);
    } catch (e) {
      if (e instanceof Error) {
        this.errors.push(e);
        return;
      }
      throw e;
    }
  }

  resolve(stmt: Stmt[] | Stmt | Expr[] | Expr | null): Error[] {
    if (stmt === null) {
      return this.errors;
    }
    if (stmt instanceof Array) {
      // Resolve all top-level functions first. Python allows functions declared after
      // another function to be used in that function.
      for (const st of stmt) {
        if (st instanceof StmtNS.FunctionDef) {
          try {
            this.environment?.declarePlaceholderName(st.name);
          } catch (e) {
            if (e instanceof Error) {
              this.errors.push(e);
              continue;
            }
            throw e;
          }
        }
      }
      for (const st of stmt) {
        this.runValidators(st);
        st.accept(this);
      }
    } else {
      this.runValidators(stmt);
      stmt.accept(this);
    }
    return this.errors;
  }

  varDeclNames(names: Map<string, Token>): Token[] | null {
    const res = Array.from(names.values()).filter(
      name =>
        // Filter out functions and module bindings.
        // Those will be handled separately, so they don't
        // need to be hoisted.
        !this.environment?.functions.has(name.lexeme) &&
        !this.environment?.moduleBindings.has(name.lexeme),
    );
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
          this.errors.push(new Error("placeholder error"));
          return;
        }

        this.errors.push(
          new ResolverErrors.NameReassignmentError(
            identifier.line,
            identifier.col,
            this.source,
            identifier.indexInSource,
            identifier.indexInSource + identifier.lexeme.length,
            token,
          ),
        );
        return;
      }
      curr = curr?.enclosing ?? null;
    }
  }

  //// STATEMENTS
  visitFileInputStmt(stmt: StmtNS.FileInput): void {
    // Create a new environment.
    const oldEnv = this.environment;
    this.environment = new Environment(this.source, this.environment, new Map());
    this.functionEnvironments.set(stmt, this.environment);
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
    const newEnv = new Map(stmt.parameters.map(param => [param.lexeme, param]));
    this.environment = new Environment(this.source, this.environment, newEnv);
    this.functionEnvironments.set(stmt, this.environment);
    this.functionScope = this.environment;
    this.resolve(stmt.body);
    // Grab identifiers from that new environment. That are NOT functions.
    // stmt.varDecls = this.varDeclNames(this.environment.names)
    // Restore old environment
    this.functionScope = null;
    this.environment = oldEnv;
  }

  visitAnnAssignStmt(stmt: StmtNS.AnnAssign): void {
    this.resolve(stmt.ann);
    this.resolve(stmt.value);
    this.functionVarConstraint(stmt.target.name);
    this.environment?.declareName(stmt.target.name);
  }

  visitAssignStmt(stmt: StmtNS.Assign): void {
    const target = stmt.target;
    if (target instanceof ExprNS.Subscript) {
      this.resolve(target); // dispatches to visitSubscriptExpr
      this.resolve(stmt.value);
      return;
    }
    this.resolve(stmt.value);
    this.functionVarConstraint(target.name);
    this.environment?.declareName(target.name);
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
  visitGlobalStmt(_stmt: StmtNS.Global): void {
    // Do nothing because global can also be declared in our
    // own scope.
  }
  // @TODO nonlocals mean that any variable following that name in the current env
  // should not create a variable declaration, but instead point to an outer variable.
  visitNonLocalStmt(stmt: StmtNS.NonLocal): void {
    try {
      this.environment?.lookupNameParentEnvWithError(stmt.name);
    } catch (e) {
      if (e instanceof Error) {
        this.errors.push(e);
        return;
      }
      throw e;
    }
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
    for (const entry of stmt.names) {
      const binding = entry.alias ?? entry.name;
      this.environment?.declareName(binding);
      this.environment?.moduleBindings.add(binding.lexeme);
    }
  }

  visitContinueStmt(_stmt: StmtNS.Continue): void {}
  visitBreakStmt(_stmt: StmtNS.Break): void {}
  visitPassStmt(_stmt: StmtNS.Pass): void {}

  //// EXPRESSIONS
  visitVariableExpr(expr: ExprNS.Variable): void {
    try {
      this.environment?.lookupNameCurrentEnvWithError(expr.name);
    } catch (e) {
      if (e instanceof Error) {
        this.errors.push(e);
        return;
      }
      throw e;
    }
  }
  visitLambdaExpr(expr: ExprNS.Lambda): void {
    // Create a new environment.
    const oldEnv = this.environment;
    // Assign the parameters to the new environment.
    const newEnv = new Map(expr.parameters.map(param => [param.lexeme, param]));
    this.environment = new Environment(this.source, this.environment, newEnv);
    this.functionEnvironments.set(expr, this.environment);
    this.resolve(expr.body);
    // Restore old environment
    this.environment = oldEnv;
  }
  visitMultiLambdaExpr(expr: ExprNS.MultiLambda): void {
    // Create a new environment.
    const oldEnv = this.environment;
    // Assign the parameters to the new environment.
    const newEnv = new Map(expr.parameters.map(param => [param.lexeme, param]));
    this.environment = new Environment(this.source, this.environment, newEnv);
    this.functionEnvironments.set(expr, this.environment);
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
  visitStarredExpr(expr: ExprNS.Starred): void {
    this.resolve(expr.value);
  }
  visitTernaryExpr(expr: ExprNS.Ternary): void {
    this.resolve(expr.predicate);
    this.resolve(expr.consequent);
    this.resolve(expr.alternative);
  }
  visitNoneExpr(_expr: ExprNS.None): void {}
  visitLiteralExpr(_expr: ExprNS.Literal): void {}
  visitBigIntLiteralExpr(_expr: ExprNS.BigIntLiteral): void {}
  visitComplexExpr(_expr: ExprNS.Complex): void {}
  visitListExpr(expr: ExprNS.List): void {
    this.resolve(expr.elements);
  }
  visitSubscriptExpr(expr: ExprNS.Subscript): void {
    this.resolve(expr.value);
    this.resolve(expr.index);
  }
}
