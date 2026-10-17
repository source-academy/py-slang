import { ExprNS, StmtNS } from "../../ast-types";
import { ASTNode, FeatureValidator, FeatureNotSupportedError } from "../types";

export const NoTuplesValidator: FeatureValidator = {
  validate(node: ASTNode): void {
    if (node instanceof ExprNS.Tuple) {
      throw new FeatureNotSupportedError("tuples", node);
    }
    if (node instanceof StmtNS.TupleAssign) {
      throw new FeatureNotSupportedError("assignment to several names (a, b = ...)", node);
    }
  },
};
