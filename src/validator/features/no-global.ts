import { StmtNS } from "../../ast-types";
import { ASTNode, FeatureNotSupportedError, FeatureValidator } from "../types";

export const NoGlobalValidator: FeatureValidator = {
  validate(node: ASTNode): void {
    if (node instanceof StmtNS.Global) {
      throw new FeatureNotSupportedError("global statements", node);
    }
  },
};
