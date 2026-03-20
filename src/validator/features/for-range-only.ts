import { ExprNS, StmtNS } from "../../ast-types";
import { ASTNode, FeatureValidator, FeatureNotSupportedError } from "../types";

export const ForRangeOnlyValidator: FeatureValidator = {
  validate(node: ASTNode): void {
    if (!(node instanceof StmtNS.For)) return;

    const iter = node.iter;
    if (
      iter instanceof ExprNS.Call &&
      iter.callee instanceof ExprNS.Variable &&
      iter.callee.name.lexeme === "range" &&
      iter.args.length >= 1 &&
      iter.args.length <= 3
    ) {
      return; // Valid: for x in range(...)
    }

    throw new FeatureNotSupportedError(
      "for loops must use range() — e.g. for i in range(n)",
      node,
    );
  },
};
