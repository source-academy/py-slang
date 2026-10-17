import { ExprNS } from "../../ast-types";
import { ASTNode, FeatureValidator, FeatureNotSupportedError } from "../types";

export const NoDictsValidator: FeatureValidator = {
  validate(node: ASTNode): void {
    if (node instanceof ExprNS.Dict) {
      throw new FeatureNotSupportedError("dictionaries", node);
    }
  },
};
