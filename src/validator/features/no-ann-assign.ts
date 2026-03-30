import { StmtNS } from "../../ast-types";
import { ASTNode, FeatureNotSupportedError, FeatureValidator } from "../types";

export const NoAnnAssignValidator: FeatureValidator = {
  validate(node: ASTNode): void {
    if (node instanceof StmtNS.AnnAssign) {
      throw new FeatureNotSupportedError("annotated assignment statements", node);
    }
  },
};
