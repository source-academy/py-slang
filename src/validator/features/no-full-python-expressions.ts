import { ExprNS, StmtNS } from "../../ast-types";
import { TokenType } from "../../tokenizer/tokenizer";
import { ASTNode, FeatureValidator, FeatureNotSupportedError } from "../types";

const BITWISE_BINARY = new Set<TokenType>([
  TokenType.AMPER,
  TokenType.VBAR,
  TokenType.CIRCUMFLEX,
  TokenType.LEFTSHIFT,
  TokenType.RIGHTSHIFT,
]);

/** The expressions and statements on names that only full Python has (§1–§4 reject them). */
export const NoFullPythonExpressionsValidator: FeatureValidator = {
  validate(node: ASTNode): void {
    const feature = featureOf(node);
    if (feature) throw new FeatureNotSupportedError(feature, node);
  },
};

function featureOf(node: ASTNode): string | undefined {
  if (node instanceof ExprNS.Attribute) return "attribute access (a.b)";
  if (node instanceof ExprNS.CompareChain) return "chained comparisons (a < b < c)";
  if (node instanceof ExprNS.Binary && BITWISE_BINARY.has(node.operator.type)) {
    return `bitwise operators (${node.operator.lexeme})`;
  }
  if (node instanceof ExprNS.Unary && node.operator.type === TokenType.TILDE) {
    return "bitwise operators (~)";
  }
  if (node instanceof StmtNS.AugAssign) {
    return `augmented assignment (${node.operator.lexeme})`;
  }
  if (node instanceof StmtNS.AttributeAssign) return "assignment to attributes (a.b = ...)";
  if (node instanceof StmtNS.ForUnpack) return "unpacking in for loops (for a, b in ...)";
  return undefined;
}
