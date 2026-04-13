import { ExprNS, StmtNS } from "../ast-types";
import { Environment } from "../resolver/resolver";

export type ASTNode = StmtNS.Stmt | ExprNS.Expr;

export interface FeatureValidator {
  validate(node: ASTNode, env?: Environment): void;
}

export class FeatureNotSupportedError extends Error {
  node: ASTNode;
  feature: string;

  constructor(feature: string, node: ASTNode) {
    const tok = node.startToken;
    super(
      `Feature not supported in this sublanguage: ${feature} (line ${tok.line}, col ${tok.col})`,
    );
    this.name = "FeatureNotSupportedError";
    this.feature = feature;
    this.node = node;
  }
}

export class BreakContinueOutsideLoopError extends Error {
  node: ASTNode;

  constructor(node: ASTNode) {
    const tok = node.startToken;
    super(`Break or continue statement not within a loop (line ${tok.line}, col ${tok.col})`);
    this.name = "BreakContinueOutsideLoopError";
    this.node = node;
  }
}
