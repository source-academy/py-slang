import { ExprNS } from "../../ast-types";
import { ASTNode, FeatureValidator, FeatureNotSupportedError } from "../types";

export const NoKeywordArgsValidator: FeatureValidator = {
  validate(node: ASTNode): void {
    if (node instanceof ExprNS.Keyword) {
      throw new FeatureNotSupportedError("keyword arguments (name=value)", node);
    }
  },
};
