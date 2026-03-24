import { StmtNS } from "../../ast-types";
import { ASTNode, FeatureValidator, FeatureNotSupportedError } from "../types";

export const NoLoopsValidator: FeatureValidator = {
  validate(node: ASTNode): void {
    if (node instanceof StmtNS.While) {
      throw new FeatureNotSupportedError("while loops", node);
    }
    if (node instanceof StmtNS.For) {
      throw new FeatureNotSupportedError("for loops", node);
    }
  },
};
