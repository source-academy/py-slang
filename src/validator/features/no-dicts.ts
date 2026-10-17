import { ExprNS } from "../../ast-types";
import { ASTNode, FeatureValidator, FeatureNotSupportedError } from "../types";

export const NoDictsValidator: FeatureValidator = {
  validate(node: ASTNode): void {
    if (node instanceof ExprNS.Dict) {
      // `{**d}` has a null key; name what is more special about it.
      const unpacks = node.keys.some(k => k === null);
      throw new FeatureNotSupportedError(
        unpacks ? "dictionary unpacking (**)" : "dictionaries",
        node,
      );
    }
  },
};
