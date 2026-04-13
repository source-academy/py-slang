import { StmtNS } from "../../ast-types";
import { Environment } from "../../resolver/resolver";
import { ASTNode, BreakContinueOutsideLoopError, FeatureValidator } from "../types";

export function createBreakContinueValidator(): FeatureValidator {
  const depthPerScope = new WeakMap<Environment, number>();
  return {
    validate(node: ASTNode, env?: Environment): void {
      if (!env) return;
      if (node instanceof StmtNS.For || node instanceof StmtNS.While) {
        if (env.enclosing) {
          depthPerScope.set(env, (depthPerScope.get(env.enclosing) ?? 0) + 1);
        } else {
          depthPerScope.set(env, 1);
        }
        return;
      } else if (node instanceof StmtNS.Break || node instanceof StmtNS.Continue) {
        if ((depthPerScope.get(env) ?? 0) === 0) {
          throw new BreakContinueOutsideLoopError(node);
        }
      }
    },
  };
}

/** Stateless singleton for convenience — only use if you know names won't repeat across calls. */
export const BreakContinueValidator: FeatureValidator = createBreakContinueValidator();
