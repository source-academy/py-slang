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

const COMPREHENSIONS = {
  list: "list comprehensions",
  set: "set comprehensions",
  dict: "dictionary comprehensions",
  generator: "generator expressions",
} as const;

function featureOf(node: ASTNode): string | undefined {
  if (node instanceof ExprNS.Set) return "set displays";
  if (node instanceof ExprNS.Comprehension) return COMPREHENSIONS[node.variant];
  if (node instanceof ExprNS.Yield)
    return node.delegate ? "generators (yield from)" : "generators (yield)";
  if (node instanceof ExprNS.Slice) return "slices (a[i:j])";
  if (node instanceof ExprNS.DoubleStarred) return "dictionary unpacking (**)";
  if (node instanceof ExprNS.List && node.elements.some(e => e instanceof ExprNS.Starred)) {
    return "unpacking in list displays ([*a, b])";
  }
  if (
    node instanceof StmtNS.FunctionDef ||
    node instanceof ExprNS.Lambda ||
    node instanceof ExprNS.MultiLambda
  ) {
    if (node.parameters.some(p => p.isDoubleStarred)) return "keyword parameters (**kwargs)";
    if (node.parameters.some(p => p.trailingComma))
      return "a trailing comma after the last parameter";
  }
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
