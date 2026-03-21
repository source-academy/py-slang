import { StmtNS } from "../../ast-types";
import { ASTNode, FeatureValidator, FeatureNotSupportedError } from "../types";

export const NoRestParamsValidator: FeatureValidator = {
  validate(node: ASTNode): void {
    if (node instanceof StmtNS.FunctionDef) {
      for (const param of node.parameters) {
        if (param.isStarred) {
          throw new FeatureNotSupportedError("rest parameters (*name)", node);
        }
      }
    }
  },
};
