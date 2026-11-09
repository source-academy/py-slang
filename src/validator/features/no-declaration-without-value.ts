import { ExprNS, StmtNS } from "../../ast-types";
import { ASTNode, FeatureNotSupportedError, FeatureValidator } from "../types";

/**
 * Python §4 Typed: a name is declared by an assignment, `x: int = 0`. A declaration without a value,
 * `x: int`, does not bind the name in Python, but the parser represents it as an assignment of None
 * (the parser gives that None the end token of the annotation), which would differ at run time.
 */
export const NoDeclarationWithoutValueValidator: FeatureValidator = {
  validate(node: ASTNode): void {
    if (
      node instanceof StmtNS.AnnAssign &&
      node.value instanceof ExprNS.None &&
      node.value.startToken === node.ann.endToken
    ) {
      throw new FeatureNotSupportedError("declarations without a value", node);
    }
  },
};
