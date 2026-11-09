import { ExprNS, StmtNS } from "../ast-types";
import { ASTNode, traverseAST } from "../validator";

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
export function eraseTypes<T extends ASTNode>(
  program: T,
  /** The names that a module defines only as types: `rune` has `Rune`. */
  typeNames: (module: string) => ReadonlySet<string> | undefined = () => undefined,
): T {
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
  for (const body of bodies) {
    body.forEach((stmt, i) => {
      if (stmt instanceof StmtNS.AnnAssign) {
        body[i] = new StmtNS.Assign(stmt.startToken, stmt.endToken, stmt.target, stmt.value);
      } else if (stmt instanceof StmtNS.TypeAlias) {
        body[i] = new StmtNS.Pass(stmt.startToken, stmt.endToken);
      } else if (stmt instanceof StmtNS.FromImport && stmt.level === 0) {
        const types = typeNames(stmt.module.lexeme);
        if (!types) return;
        stmt.names = stmt.names.filter(({ name }) => !types.has(name.lexeme));
        if (stmt.names.length === 0) body[i] = new StmtNS.Pass(stmt.startToken, stmt.endToken);
      }
    });
  }
  return program;
}
