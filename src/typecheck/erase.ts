import { ExprNS, StmtNS, type FunctionParam } from "../ast-types";
import type { Token } from "../tokenizer";
import { ASTNode, traverseAST } from "../validator";

/**
 * The names that a function (or lambda) binds in its own scope: its parameters, and what its body
 * assigns, defines, imports or loops over (except what it declares `global`).
 */
function localNames(params: FunctionParam[], body: StmtNS.Stmt[]): Set<string> {
  const names = new Set(params.map(param => param.lexeme));
  const globals = new Set<string>();
  const walk = (statements: StmtNS.Stmt[]) => {
    for (const stmt of statements) {
      if (stmt instanceof StmtNS.Assign) {
        if (stmt.target instanceof ExprNS.Variable) names.add(stmt.target.name.lexeme);
      } else if (stmt instanceof StmtNS.FunctionDef) names.add(stmt.name.lexeme);
      else if (stmt instanceof StmtNS.FromImport)
        for (const { name, alias } of stmt.names) names.add((alias ?? name).lexeme);
      else if (stmt instanceof StmtNS.Global) stmt.names.forEach(name => globals.add(name.lexeme));
      else if (stmt instanceof StmtNS.For) {
        names.add(stmt.target.lexeme);
        walk(stmt.body);
      } else if (stmt instanceof StmtNS.If) {
        walk(stmt.body);
        if (stmt.elseBlock) walk(stmt.elseBlock);
      } else if (stmt instanceof StmtNS.While) walk(stmt.body);
    }
  };
  walk(body);
  globals.forEach(name => names.delete(name));
  return names;
}

/**
 * The uses of the `types` names that refer to a local binding of the function that they are in
 * (`def f(Rune: int): print(Rune)`), not to the type: the function's own scope hides the type's name.
 */
function shadowedUses(program: ASTNode, types: ReadonlySet<string>): Set<ExprNS.Variable> {
  const shadowed = new Set<ExprNS.Variable>();
  const hide = (names: Set<string>, inside: ASTNode[]) => {
    for (const name of names) {
      if (!types.has(name)) continue;
      for (const root of inside)
        traverseAST(root, node => {
          if (node instanceof ExprNS.Variable && node.name.lexeme === name) shadowed.add(node);
        });
    }
  };
  traverseAST(program, node => {
    if (node instanceof StmtNS.FunctionDef || node instanceof ExprNS.MultiLambda)
      hide(localNames(node.parameters, node.body), node.body);
    else if (node instanceof ExprNS.Lambda) hide(localNames(node.parameters, []), [node.body]);
  });
  return shadowed;
}

export interface EraseOptions {
  /** The names that a module defines only as types: `rune` has `Rune`. */
  typeNames?: (module: string) => ReadonlySet<string> | undefined;
  /** The names that earlier chunks of a session bound only as types (`from rune import Rune`). */
  sessionTypeBindings?: ReadonlySet<string>;
  /** Every name that this program binds at its top level (`topLevelNames`): a name that it binds as a value is not a type here. */
  boundNames?: ReadonlySet<string>;
  /**
   * Called with the token of each use, as a value, of a name that is bound only as a type
   * (`print(Rune)`): such a name is not bound in the program that runs. (An annotation is not a use: it
   * is erased first.)
   */
  onValueUse?: (name: Token) => void;
  /** Called with the names that this program binds only as types (the alias if there is one). */
  onTypeBindings?: (bound: ReadonlySet<string>) => void;
}

/**
 * Erases the types of a Python §4 Typed program, in place, so that it is a Python §4 program, which
 * every engine runs:
 *
 * - parameter annotations, return annotations and type parameters of every `def` are removed,
 * - an annotated assignment `x: T = v` becomes the assignment `x = v`,
 * - a `type X = T` statement becomes `pass`,
 * - the names that a program imports from a module only as types (`from rune import Rune`: the opaque
 *   types of a module's description) are left out of the import, which becomes `pass` if no name is
 *   left: the module has no such export at run time.
 *
 * Types never change what a program does; the type checker only accepts or rejects it. Only run
 * this on a program that the typed validators accepted (`makeTypedChapter4Validators`): a
 * declaration without a value, `x: int`, would become the assignment `x = None`.
 *
 * The statements of `class`, `try`, `with` and `for a, b in` blocks are not rewritten: the
 * sublanguages that Python §4 Typed builds on do not have those statements.
 */
export function eraseTypes<T extends ASTNode>(program: T, options: EraseOptions = {}): T {
  const { typeNames = () => undefined } = options;
  // The arrays of statements to rewrite, found first: replacing statements while the tree is walked
  // would have the walk visit the new ones.
  const bodies: StmtNS.Stmt[][] = [];
  traverseAST(program, node => {
    if (node instanceof StmtNS.FileInput) bodies.push(node.statements);
    else if (node instanceof StmtNS.FunctionDef) {
      bodies.push(node.body);
      for (const param of node.parameters) delete param.annotation;
      node.returns = null;
      node.typeParams = [];
    } else if (node instanceof StmtNS.If) {
      bodies.push(node.body);
      if (node.elseBlock) bodies.push(node.elseBlock);
    } else if (node instanceof StmtNS.While || node instanceof StmtNS.For) bodies.push(node.body);
    else if (node instanceof ExprNS.MultiLambda) bodies.push(node.body);
  });
  const typeImports = new Set<string>();
  for (const body of bodies) {
    body.forEach((stmt, i) => {
      if (stmt instanceof StmtNS.AnnAssign) {
        body[i] = new StmtNS.Assign(stmt.startToken, stmt.endToken, stmt.target, stmt.value);
      } else if (stmt instanceof StmtNS.TypeAlias) {
        body[i] = new StmtNS.Pass(stmt.startToken, stmt.endToken);
      } else if (stmt instanceof StmtNS.FromImport && stmt.level === 0) {
        const types = typeNames(stmt.module.lexeme);
        if (!types) return;
        for (const { name, alias } of stmt.names)
          if (types.has(name.lexeme)) typeImports.add((alias ?? name).lexeme);
        stmt.names = stmt.names.filter(({ name }) => !types.has(name.lexeme));
        if (stmt.names.length === 0) body[i] = new StmtNS.Pass(stmt.startToken, stmt.endToken);
      }
    });
  }
  options.onTypeBindings?.(typeImports);
  const {
    onValueUse,
    sessionTypeBindings = new Set<string>(),
    boundNames = new Set<string>(),
  } = options;
  // A name that this program binds as a value, and not as a type, is a value here.
  const types = new Set(
    [...typeImports, ...sessionTypeBindings].filter(
      name => typeImports.has(name) || !boundNames.has(name),
    ),
  );
  if (onValueUse && types.size > 0) {
    const shadowed = shadowedUses(program, types);
    traverseAST(program, node => {
      if (node instanceof ExprNS.Variable && types.has(node.name.lexeme) && !shadowed.has(node))
        onValueUse(node.name);
    });
  }
  return program;
}
