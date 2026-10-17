import { ExprNS, StmtNS } from "../../ast-types";
import { ASTNode, FeatureValidator, FeatureNotSupportedError } from "../types";

export const NoDefaultValuesValidator: FeatureValidator = {
  validate(node: ASTNode): void {
    const hasParameters =
      node instanceof StmtNS.FunctionDef ||
      node instanceof ExprNS.Lambda ||
      node instanceof ExprNS.MultiLambda;

    if (hasParameters) {
      for (const param of node.parameters) {
        if (param.default) {
          throw new FeatureNotSupportedError("default values of parameters (name=value)", node);
        }
      }
    }
  },
};
