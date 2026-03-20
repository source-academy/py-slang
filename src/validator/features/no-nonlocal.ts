import { StmtNS } from "../../ast-types";
import { ASTNode, FeatureValidator, FeatureNotSupportedError } from "../types";

export const NoNonlocalValidator: FeatureValidator = {
  validate(node: ASTNode): void {
    if (node instanceof StmtNS.NonLocal) {
      throw new FeatureNotSupportedError("nonlocal statements", node);
    }
  },
};
