import { StmtNS } from "../../ast-types";
import { ASTNode, FeatureNotSupportedError, FeatureValidator } from "../types";

/**
 * The annotations of Python §4 Typed on a `def` (parameter and return annotations, type parameters)
 * and its `type` statements. The parser accepts them; every sublanguage but the typed ones rejects
 * them. (Annotated assignments have their own validator, no-ann-assign.)
 */
export const NoTypeAnnotationsValidator: FeatureValidator = {
  validate(node: ASTNode): void {
    if (node instanceof StmtNS.FunctionDef) {
      for (const param of node.parameters) {
        if (param.annotation)
          throw new FeatureNotSupportedError("type annotations", param.annotation);
      }
      if (node.returns) throw new FeatureNotSupportedError("type annotations", node.returns);
      if (node.typeParams.length > 0) throw new FeatureNotSupportedError("type parameters", node);
    }
    if (node instanceof StmtNS.TypeAlias) {
      throw new FeatureNotSupportedError("type statements", node);
    }
  },
};
