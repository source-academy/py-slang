import { ExprNS } from "../../ast-types";
import { ASTNode, FeatureValidator, FeatureNotSupportedError } from "../types";

export const NoSpreadValidator: FeatureValidator = {
  validate(node: ASTNode): void {
    if (node instanceof ExprNS.Starred) {
      throw new FeatureNotSupportedError("spread expressions (*expr)", node);
    }
  },
};
