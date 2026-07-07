import { ExprNS } from "../../ast-types";
import { TokenType } from "../../tokenizer";
import { ASTNode, FeatureNotSupportedError, FeatureValidator } from "../types";

export const NoIsOperatorValidator: FeatureValidator = {
  validate(node: ASTNode): void {
    // `is` and `is not` parse as ExprNS.Compare nodes
    if (
      node instanceof ExprNS.Compare &&
      (node.operator.type === TokenType.IS || node.operator.type === TokenType.ISNOT)
    ) {
      throw new FeatureNotSupportedError("is operator", node);
    }
  },
};
