import { StmtNS, ExprNS } from "../ast-types";
import { ASTNode } from "./types";

/**
 * Walks the AST via instanceof dispatch and calls fn on each node.
 *
 * NOTE: This is a standalone utility — the main validation pipeline does NOT
 * use this function. The Resolver runs validators inline during its own
 * accept()-based traversal (see resolver.ts:runValidators), which provides
 * the Environment parameter needed by scope-aware validators like
 * no-reassignment. Prefer the Resolver pipeline for production use.
 */
export function traverseAST(node: ASTNode, fn: (node: ASTNode) => void): void {
  fn(node);

  if (node instanceof StmtNS.FileInput) {
    node.statements.forEach(s => traverseAST(s, fn));
  } else if (node instanceof StmtNS.FunctionDef) {
    node.body.forEach(s => traverseAST(s, fn));
  } else if (node instanceof StmtNS.If) {
    traverseAST(node.condition, fn);
    node.body.forEach(s => traverseAST(s, fn));
    if (node.elseBlock) node.elseBlock.forEach(s => traverseAST(s, fn));
  } else if (node instanceof StmtNS.While) {
    traverseAST(node.condition, fn);
    node.body.forEach(s => traverseAST(s, fn));
  } else if (node instanceof StmtNS.For) {
    traverseAST(node.iter, fn);
    node.body.forEach(s => traverseAST(s, fn));
  } else if (node instanceof StmtNS.Assign) {
    traverseAST(node.target as ASTNode, fn);
    traverseAST(node.value, fn);
  } else if (node instanceof StmtNS.AnnAssign) {
    traverseAST(node.target, fn);
    traverseAST(node.value, fn);
    traverseAST(node.ann, fn);
  } else if (node instanceof StmtNS.Return) {
    if (node.value) traverseAST(node.value, fn);
  } else if (node instanceof StmtNS.Assert) {
    traverseAST(node.value, fn);
  } else if (node instanceof StmtNS.SimpleExpr) {
    traverseAST(node.expression, fn);
  } else if (node instanceof ExprNS.Binary) {
    traverseAST(node.left, fn);
    traverseAST(node.right, fn);
  } else if (node instanceof ExprNS.Compare) {
    traverseAST(node.left, fn);
    traverseAST(node.right, fn);
  } else if (node instanceof ExprNS.BoolOp) {
    traverseAST(node.left, fn);
    traverseAST(node.right, fn);
  } else if (node instanceof ExprNS.Unary) {
    traverseAST(node.right, fn);
  } else if (node instanceof ExprNS.Ternary) {
    traverseAST(node.predicate, fn);
    traverseAST(node.consequent, fn);
    traverseAST(node.alternative, fn);
  } else if (node instanceof ExprNS.Grouping) {
    traverseAST(node.expression, fn);
  } else if (node instanceof ExprNS.Call) {
    traverseAST(node.callee, fn);
    node.args.forEach(a => traverseAST(a, fn));
  } else if (node instanceof ExprNS.Lambda) {
    traverseAST(node.body, fn);
  } else if (node instanceof ExprNS.MultiLambda) {
    node.body.forEach(s => traverseAST(s, fn));
  } else if (node instanceof ExprNS.List) {
    node.elements.forEach(e => traverseAST(e, fn));
  } else if (node instanceof ExprNS.Subscript) {
    traverseAST(node.value, fn);
    traverseAST(node.index, fn);
  }
  // Leaf nodes: Literal, Variable, BigIntLiteral, Complex, None, Pass, Break, Continue,
  // FromImport, Global, NonLocal — no children to traverse.
}
