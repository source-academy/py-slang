import { ExprNS } from "../../ast-types";
import { ASTNode, FeatureValidator, FeatureNotSupportedError } from "../types";

export const NoListsValidator: FeatureValidator = {
  validate(node: ASTNode): void {
    if (node instanceof ExprNS.List) {
      throw new FeatureNotSupportedError("list literals", node);
    }
    if (node instanceof ExprNS.Subscript) {
      throw new FeatureNotSupportedError("subscript expressions", node);
    }
  },
};
