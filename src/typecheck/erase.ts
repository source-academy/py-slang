import { ExprNS, StmtNS } from "../ast-types";
import { ASTNode, traverseAST } from "../validator";

/**
 * Erases the types of a Typed Python §4 program, in place, so that it is a Python §4 program, which
 * every engine runs:
 *
 * - parameter annotations, return annotations and type parameters of every `def` are removed,
 * - an annotated assignment `x: T = v` becomes the assignment `x = v`,
 * - a `type X = T` statement becomes `pass`.
 *
 * Types never change what a program does; the type checker only accepts or rejects it. Only run
 * this on a program that the typed validators accepted (`makeTypedChapter4Validators`): a
 * declaration without a value, `x: int`, would become the assignment `x = None`.
 *
 * The statements of `class`, `try`, `with` and `for a, b in` blocks are not rewritten: the
 * sublanguages that Typed Python §4 builds on do not have those statements.
 */
export function eraseTypes<T extends ASTNode>(program: T): T {
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
      }
    });
  }
  return program;
}
