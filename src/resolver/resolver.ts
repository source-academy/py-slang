import { ExprNS, StmtNS } from "../ast-types";
import { Group } from "../stdlib/utils";
import { Token, TokenType } from "../tokenizer/tokenizer";
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
  // Names declared `global` in the current function body (reset on function entry/exit).
  private globalNamesInCurrentFunction: Set<string> = new Set();
  // Names declared `nonlocal` in the current function body (reset on function entry/exit).
  private nonlocalNamesInCurrentFunction: Set<string> = new Set();
  // Stack of enclosing FunctionDef nodes (innermost last), used to resolve `nonlocal`
  // against a whole-function-body scan rather than the incremental (textual-order)
  // environment, since a binding construct may appear anywhere in the enclosing
  // function — including nested in `if`/`while`/`for`, and even after the nested
  // `def` that declares it `nonlocal` (matches CPython's whole-function static scoping).
  private functionDefStack: StmtNS.FunctionDef[] = [];
  // Top-level module statements, set once by visitFileInputStmt. Used as the outermost
  // level of the whole-scope binding scan (see nameHasStaticBinding) — a module-level name
  // can legitimately be bound anywhere in the module body, not just textually before a
  // nested function that reads it.
  private moduleStatements: StmtNS.Stmt[] = [];

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
        ["range", new Token(TokenType.NAME, "range", 0, 0, 0)],
        ["__program__", new Token(TokenType.NAME, "__program__", 0, 0, 0)],
        ...groups.flatMap(group =>
          Array.from(group.builtins.entries()).map(
            ([name]) => [name, new Token(TokenType.NAME, name, 0, 0, 0)] as const,
          ),
        ),
        ...preludeNames.map(name => [name, new Token(TokenType.NAME, name, 0, 0, 0)] as const),
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
      for (const st of stmt) {
        if (st instanceof StmtNS.FunctionDef) {
          if (
            !this.globalNamesInCurrentFunction.has(st.name.lexeme) &&
            !this.nonlocalNamesInCurrentFunction.has(st.name.lexeme)
          ) {
            this.environment?.declareName(st.name);
          }
        }
        if (st instanceof StmtNS.Assign && st.target instanceof ExprNS.Variable) {
          if (
            !this.globalNamesInCurrentFunction.has(st.target.name.lexeme) &&
            !this.nonlocalNamesInCurrentFunction.has(st.target.name.lexeme)
          ) {
            this.environment?.declareName(st.target.name);
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
    // #181 also applies at module level: e.g. `i = 3` followed by `global i` is a
    // SyntaxError in real Python, even though `global` is otherwise a no-op there.
    this.checkDeclarationOrder(stmt.statements, true);
    this.moduleStatements = stmt.statements;
    this.resolve(stmt.statements);
    // Grab identifiers from that new environment. That are NOT functions.
    // stmt.varDecls = this.varDeclNames(this.environment.names)
    this.environment = oldEnv;
  }

  visitFunctionDefStmt(stmt: StmtNS.FunctionDef) {
    this.environment?.functions.add(stmt.name.lexeme);

    // Create a new environment.
    const oldEnv = this.environment;
    // Assign the parameters to the new environment.
    const newEnv = new Map(stmt.parameters.map(param => [param.lexeme, param]));
    this.environment = new Environment(this.source, this.environment, newEnv);
    this.functionEnvironments.set(stmt, this.environment);
    this.functionScope = this.environment;

    const oldGlobalNames = this.globalNamesInCurrentFunction;
    const oldNonlocalNames = this.nonlocalNamesInCurrentFunction;
    this.globalNamesInCurrentFunction = this.scanGlobalDeclarations(stmt.body);
    this.nonlocalNamesInCurrentFunction = this.scanNonlocalDeclarations(stmt.body);

    // Run scope conflict checks before resolving the body.
    this.checkFunctionScopeConflicts(stmt);

    // Declare global names in the outermost (module-level) environment so that
    // variable lookups within this function can find them via the chain walk.
    if (this.globalNamesInCurrentFunction.size > 0) {
      let globalEnv: Environment | null = this.environment;
      while (globalEnv?.enclosing !== null) {
        globalEnv = globalEnv?.enclosing ?? null;
      }
      if (globalEnv) {
        for (const name of this.globalNamesInCurrentFunction) {
          if (!globalEnv.names.has(name)) {
            // Use a sentinel token so the resolver accepts references to this name.
            globalEnv.names.set(name, new Token(TokenType.NAME, name, 0, 0, 0));
          }
        }
      }
    }

    this.functionDefStack.push(stmt);
    this.resolve(stmt.body);
    this.functionDefStack.pop();
    // Restore old environment
    this.globalNamesInCurrentFunction = oldGlobalNames;
    this.nonlocalNamesInCurrentFunction = oldNonlocalNames;
    this.functionScope = null;
    this.environment = oldEnv;
  }

  visitAnnAssignStmt(stmt: StmtNS.AnnAssign): void {
    this.resolve(stmt.ann);
    this.resolve(stmt.value);
    this.functionVarConstraint(stmt.target.name);
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
  }

  visitAssertStmt(stmt: StmtNS.Assert): void {
    this.resolve(stmt.value);
  }
  visitForStmt(stmt: StmtNS.For): void {
    if (
      !this.globalNamesInCurrentFunction.has(stmt.target.lexeme) &&
      !this.nonlocalNamesInCurrentFunction.has(stmt.target.lexeme)
    ) {
      this.environment?.declareName(stmt.target);
    }
    this.resolve(stmt.iter);
    this.resolve(stmt.body);
  }

  visitIfStmt(stmt: StmtNS.If): void {
    this.resolve(stmt.condition);
    this.resolve(stmt.body);
    this.resolve(stmt.elseBlock);
  }
  visitGlobalStmt(stmt: StmtNS.Global): void {
    // Function-level `global x` is handled entirely in visitFunctionDefStmt (scanning +
    // declaring in the outermost env). At module level `global x` is semantically a no-op
    // (the name is already module-scope) — but it still must make `x` a recognized name for
    // the *resolver*, exactly like a real assignment would, even though no value is bound
    // yet. Real Python defers to a runtime NameError if `x` is never actually assigned
    // before use; without this, py-slang would wrongly reject `global x` immediately.
    const env = this.environment;
    const isModuleLevel =
      env !== null && env.enclosing !== null && env.enclosing.enclosing === null;
    if (isModuleLevel && !env.names.has(stmt.name.lexeme)) {
      env.names.set(stmt.name.lexeme, new Token(TokenType.NAME, stmt.name.lexeme, 0, 0, 0));
    }
  }

  // Recursively collects names declared with `global` anywhere in the function body,
  // without descending into nested function/lambda definitions.
  private scanGlobalDeclarations(stmts: StmtNS.Stmt[]): Set<string> {
    const globals = new Set<string>();
    const scan = (stmts: StmtNS.Stmt[]) => {
      for (const stmt of stmts) {
        if (stmt instanceof StmtNS.Global) {
          globals.add(stmt.name.lexeme);
        } else if (stmt instanceof StmtNS.If) {
          scan(stmt.body);
          if (Array.isArray(stmt.elseBlock)) {
            scan(stmt.elseBlock);
          } else if (stmt.elseBlock) {
            scan([stmt.elseBlock]);
          }
        } else if (stmt instanceof StmtNS.While) {
          scan(stmt.body);
        } else if (stmt instanceof StmtNS.For) {
          scan(stmt.body);
        }
        // Do not recurse into FunctionDef or Lambda bodies.
      }
    };
    scan(stmts);
    return globals;
  }

  // Recursively collects names declared with `nonlocal` anywhere in the function body,
  // without descending into nested function/lambda definitions.
  private scanNonlocalDeclarations(stmts: StmtNS.Stmt[]): Set<string> {
    const nonlocals = new Set<string>();
    const scan = (stmts: StmtNS.Stmt[]) => {
      for (const stmt of stmts) {
        if (stmt instanceof StmtNS.NonLocal) {
          nonlocals.add(stmt.name.lexeme);
        } else if (stmt instanceof StmtNS.If) {
          scan(stmt.body);
          if (Array.isArray(stmt.elseBlock)) {
            scan(stmt.elseBlock);
          } else if (stmt.elseBlock) {
            scan([stmt.elseBlock]);
          }
        } else if (stmt instanceof StmtNS.While) {
          scan(stmt.body);
        } else if (stmt instanceof StmtNS.For) {
          scan(stmt.body);
        }
        // Do not recurse into FunctionDef or Lambda bodies.
      }
    };
    scan(stmts);
    return nonlocals;
  }

  // Checks scope conflicts within a FunctionDef for issues #178, #179, #180, #181.
  private checkFunctionScopeConflicts(stmt: StmtNS.FunctionDef): void {
    const globalTokens = this.scanScopeDeclarationTokens(stmt.body, "Global");
    const nonlocalTokens = this.scanScopeDeclarationTokens(stmt.body, "NonLocal");
    const paramNames = new Set(stmt.parameters.map(p => p.lexeme));

    // #178: name is both global and nonlocal in the same function
    for (const [name, token] of nonlocalTokens) {
      if (globalTokens.has(name)) {
        this.errors.push(
          new ResolverErrors.ScopeConflictError(
            token.line,
            token.col,
            this.source,
            token.indexInSource,
            token.indexInSource + name.length,
            `name '${name}' is nonlocal and global`,
          ),
        );
      }
    }

    // #179: parameter and nonlocal conflict
    for (const [name, token] of nonlocalTokens) {
      if (paramNames.has(name)) {
        this.errors.push(
          new ResolverErrors.ScopeConflictError(
            token.line,
            token.col,
            this.source,
            token.indexInSource,
            token.indexInSource + name.length,
            `name '${name}' is parameter and nonlocal`,
          ),
        );
      }
    }

    // #180: parameter and global conflict
    for (const [name, token] of globalTokens) {
      if (paramNames.has(name)) {
        this.errors.push(
          new ResolverErrors.ScopeConflictError(
            token.line,
            token.col,
            this.source,
            token.indexInSource,
            token.indexInSource + name.length,
            `name '${name}' is parameter and global`,
          ),
        );
      }
    }

    // #181: textual order — name used/assigned before its global/nonlocal declaration
    this.checkDeclarationOrder(stmt.body);
  }

  // Returns a map from name to its declaration token for all `global` or `nonlocal`
  // statements in the given body (without descending into nested functions).
  private scanScopeDeclarationTokens(
    stmts: StmtNS.Stmt[],
    kind: "Global" | "NonLocal",
  ): Map<string, Token> {
    const result = new Map<string, Token>();
    const scan = (stmts: StmtNS.Stmt[]) => {
      for (const stmt of stmts) {
        if (kind === "Global" && stmt instanceof StmtNS.Global) {
          result.set(stmt.name.lexeme, stmt.name);
        } else if (kind === "NonLocal" && stmt instanceof StmtNS.NonLocal) {
          result.set(stmt.name.lexeme, stmt.name);
        } else if (stmt instanceof StmtNS.If) {
          scan(stmt.body);
          if (Array.isArray(stmt.elseBlock)) {
            scan(stmt.elseBlock);
          } else if (stmt.elseBlock) {
            scan([stmt.elseBlock]);
          }
        } else if (stmt instanceof StmtNS.While) {
          scan(stmt.body);
        } else if (stmt instanceof StmtNS.For) {
          scan(stmt.body);
        }
        // Do not recurse into FunctionDef or Lambda bodies.
      }
    };
    scan(stmts);
    return result;
  }

  // Checks that no name is used or assigned before its `global`/`nonlocal` declaration
  // in the function body (#181). Traverses in textual order.
  // `isModuleLevel` additionally rejects bare `nonlocal` declarations (nonlocal is never
  // valid at module scope, matching CPython's `SyntaxError: nonlocal declaration not
  // allowed at module level` — but only once declaration-order has been ruled out, since
  // CPython itself prioritises the order error when both apply).
  private checkDeclarationOrder(body: StmtNS.Stmt[], isModuleLevel: boolean = false): void {
    const seen = new Map<string, { kind: "used" | "assigned"; token: Token }>();

    const recordUse = (token: Token) => {
      if (!seen.has(token.lexeme)) {
        seen.set(token.lexeme, { kind: "used", token });
      }
    };
    const recordAssign = (token: Token) => {
      if (!seen.has(token.lexeme)) {
        seen.set(token.lexeme, { kind: "assigned", token });
      }
    };

    const collectExpr = (expr: ExprNS.Expr | null | undefined) => {
      if (!expr) return;
      if (expr instanceof ExprNS.Variable) {
        recordUse(expr.name);
      } else if (expr instanceof ExprNS.Binary || expr instanceof ExprNS.Compare) {
        collectExpr(expr.left);
        collectExpr(expr.right);
      } else if (expr instanceof ExprNS.Unary) {
        collectExpr(expr.right);
      } else if (expr instanceof ExprNS.BoolOp) {
        collectExpr(expr.left);
        collectExpr(expr.right);
      } else if (expr instanceof ExprNS.Call) {
        collectExpr(expr.callee);
        expr.args.forEach(collectExpr);
      } else if (expr instanceof ExprNS.Grouping) {
        collectExpr(expr.expression);
      } else if (expr instanceof ExprNS.Ternary) {
        collectExpr(expr.predicate);
        collectExpr(expr.consequent);
        collectExpr(expr.alternative);
      } else if (expr instanceof ExprNS.List) {
        expr.elements.forEach(collectExpr);
      } else if (expr instanceof ExprNS.Subscript) {
        collectExpr(expr.value);
        collectExpr(expr.index);
      } else if (expr instanceof ExprNS.Starred) {
        collectExpr(expr.value);
      }
      // Literal, BigIntLiteral, None, Complex, Lambda: no outer-scope variable references
    };

    const scanBody = (stmts: StmtNS.Stmt[]) => {
      for (const stmt of stmts) {
        if (stmt instanceof StmtNS.Global || stmt instanceof StmtNS.NonLocal) {
          const name = stmt.name.lexeme;
          const prior = seen.get(name);
          if (prior) {
            const declKind = stmt instanceof StmtNS.Global ? "global" : "nonlocal";
            const msg =
              prior.kind === "assigned"
                ? `name '${name}' is assigned to before ${declKind} declaration`
                : `name '${name}' is used prior to ${declKind} declaration`;
            this.errors.push(
              new ResolverErrors.ScopeConflictError(
                stmt.name.line,
                stmt.name.col,
                this.source,
                stmt.name.indexInSource,
                stmt.name.indexInSource + name.length,
                msg,
              ),
            );
          } else if (isModuleLevel && stmt instanceof StmtNS.NonLocal) {
            this.errors.push(
              new ResolverErrors.ScopeConflictError(
                stmt.name.line,
                stmt.name.col,
                this.source,
                stmt.name.indexInSource,
                stmt.name.indexInSource + name.length,
                "nonlocal declaration not allowed at module level",
              ),
            );
          }
        } else if (stmt instanceof StmtNS.FunctionDef) {
          // Record the function name as an assignment; don't recurse into its body.
          recordAssign(stmt.name);
        } else if (stmt instanceof StmtNS.Assign) {
          collectExpr(stmt.value);
          if (stmt.target instanceof ExprNS.Variable) {
            recordAssign(stmt.target.name);
          } else {
            collectExpr(stmt.target);
          }
        } else if (stmt instanceof StmtNS.SimpleExpr) {
          collectExpr(stmt.expression);
        } else if (stmt instanceof StmtNS.Return) {
          if (stmt.value) collectExpr(stmt.value);
        } else if (stmt instanceof StmtNS.If) {
          collectExpr(stmt.condition);
          scanBody(stmt.body);
          if (Array.isArray(stmt.elseBlock)) scanBody(stmt.elseBlock);
          else if (stmt.elseBlock) scanBody([stmt.elseBlock]);
        } else if (stmt instanceof StmtNS.While) {
          collectExpr(stmt.condition);
          scanBody(stmt.body);
        } else if (stmt instanceof StmtNS.For) {
          collectExpr(stmt.iter);
          recordAssign(stmt.target);
          scanBody(stmt.body);
        } else if (stmt instanceof StmtNS.Assert) {
          collectExpr(stmt.value);
        }
        // Pass, Break, Continue: no variable references
      }
    };

    scanBody(body);
  }

  // Recursively checks whether `name` has a binding construct (assignment, `def`, or
  // `for` target) anywhere in the given statement list, without descending into nested
  // function/lambda bodies (they introduce their own scope). Mirrors scanGlobalDeclarations
  // / scanNonlocalDeclarations, but collects "is this name bound here at all" instead.
  private hasBindingConstruct(stmts: StmtNS.Stmt[], name: string): boolean {
    for (const stmt of stmts) {
      if (
        stmt instanceof StmtNS.Assign &&
        stmt.target instanceof ExprNS.Variable &&
        stmt.target.name.lexeme === name
      ) {
        return true;
      } else if (stmt instanceof StmtNS.FunctionDef && stmt.name.lexeme === name) {
        return true;
      } else if (stmt instanceof StmtNS.For) {
        if (stmt.target.lexeme === name || this.hasBindingConstruct(stmt.body, name)) {
          return true;
        }
      } else if (stmt instanceof StmtNS.If) {
        if (this.hasBindingConstruct(stmt.body, name)) return true;
        if (Array.isArray(stmt.elseBlock)) {
          if (this.hasBindingConstruct(stmt.elseBlock, name)) return true;
        } else if (stmt.elseBlock && this.hasBindingConstruct([stmt.elseBlock], name)) {
          return true;
        }
      } else if (stmt instanceof StmtNS.While) {
        if (this.hasBindingConstruct(stmt.body, name)) return true;
      }
      // Do not recurse into nested FunctionDef or Lambda bodies.
    }
    return false;
  }

  // Checks whether `name` has a binding construct (parameter, assignment, def, or `for`
  // target) in the enclosing function at functionDefStack[startIndex], or in any function
  // further out, stopping at (but not entering) module scope. Shared by visitNonLocalStmt
  // (which starts one level out, since nonlocal never refers to the current function) and
  // nameHasStaticBinding (which starts at the current function, inclusive).
  private hasEnclosingFunctionBinding(name: string, startIndex: number): boolean {
    for (let i = startIndex; i >= 0; i--) {
      const fn = this.functionDefStack[i];
      if (fn.parameters.some(p => p.lexeme === name)) {
        return true;
      }
      const fnGlobals = this.scanGlobalDeclarations(fn.body);
      if (fnGlobals.has(name)) {
        // `x` is explicitly global in this function — it is not a local binding here,
        // and CPython does not skip past it to look further out.
        return false;
      }
      const fnNonlocals = this.scanNonlocalDeclarations(fn.body);
      if (fnNonlocals.has(name)) {
        // `x` is itself nonlocal in this function — defer to whatever that resolves to
        // further out (already separately validated for `fn`).
        continue;
      }
      if (this.hasBindingConstruct(fn.body, name)) {
        return true;
      }
      // Not mentioned in this function at all — keep searching further out.
    }
    return false;
  }

  // Whole-scope-chain check for whether `name` can resolve at all: the current function
  // (if any), each enclosing function, and finally module scope — each scanned as a whole
  // body rather than relying on the incremental (textual-order) environment. This mirrors
  // CPython's static LEGB classification: a binding construct may appear anywhere in its
  // owning scope's body, not just textually before the point of reference (e.g. nested in
  // `if`/`while`/`for`, or after a nested `def` that reads/writes it).
  private nameHasStaticBinding(name: string): boolean {
    if (this.hasEnclosingFunctionBinding(name, this.functionDefStack.length - 1)) {
      return true;
    }
    return this.hasBindingConstruct(this.moduleStatements, name);
  }

  visitNonLocalStmt(stmt: StmtNS.NonLocal): void {
    const name = stmt.name.lexeme;
    // Search enclosing FUNCTION scopes (never the module scope), innermost first,
    // skipping the current function itself (nonlocal can never bind to it).
    const found = this.hasEnclosingFunctionBinding(name, this.functionDefStack.length - 2);
    if (!found) {
      this.errors.push(
        new ResolverErrors.NameNotFoundError(
          stmt.name.line,
          stmt.name.col,
          this.source,
          stmt.name.indexInSource,
          stmt.name.indexInSource + stmt.name.lexeme.length,
          this.environment?.suggestName(stmt.name) ?? null,
        ),
      );
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
        // The incremental (textual-order) environment didn't find it — but the name may
        // still have a legitimate binding construct somewhere in the current function, an
        // enclosing function, or the module, just not yet registered because the resolver
        // hasn't visited that part of the tree (e.g. it's nested in an `if`/`while`/`for`,
        // or in a `def` that appears later in the same body). Real Python only fails at
        // *runtime* (UnboundLocalError / NameError) for such forward references — it never
        // rejects them statically — so accept here and let the interpreter's own dynamic
        // checks (which already do a correct whole-function scan) catch genuine misuse.
        if (this.nameHasStaticBinding(expr.name.lexeme)) {
          return;
        }
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
