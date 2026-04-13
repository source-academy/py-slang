import { ExprNS } from "../../ast-types";
import { TokenType } from "../../tokenizer";
import { ASTNode, FeatureNotSupportedError, FeatureValidator } from "../types";

export const NoIsOperatorValidator: FeatureValidator = {
  validate(node: ASTNode): void {
    if (node instanceof ExprNS.Binary && node.operator.type === TokenType.IS) {
      throw new FeatureNotSupportedError("is operator", node);
    }
  },
};
