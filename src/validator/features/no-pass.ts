import { StmtNS } from "../../ast-types";
import { ASTNode, FeatureValidator, FeatureNotSupportedError } from "../types";

export const NoPassValidator: FeatureValidator = {
  validate(node: ASTNode): void {
    if (node instanceof StmtNS.Pass) {
      throw new FeatureNotSupportedError("pass statements", node);
    }
  },
};
