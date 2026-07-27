import { ExprNS, StmtNS } from "../../ast-types";
import { ResolverErrors } from "../../resolver/errors";
import { Environment } from "../../resolver/resolver";
import { Token } from "../../tokenizer";
import { ASTNode, FeatureValidator } from "../types";

/**
 * Scope-aware validator that throws NameReassignmentError if a name is assigned more than once
 * within the same scope, or if a parameter of the enclosing function/lambda is assigned at all.
 * Uses a WeakMap keyed on Environment so nested scopes are isolated. Must be run inside the
 * Resolver (with env passed) to work correctly.
 */
export function createNoReassignmentValidator(): FeatureValidator {
  const declaredPerScope = new WeakMap<Environment, Set<string>>();
  return {
    validate(node: ASTNode, env?: Environment): void {
      if (!env) return;

      let target: Token | null = null;

      if (node instanceof StmtNS.Assign) {
        // Subscript assignment (e.g. xs[0] = 1) is not a name reassignment
        if (node.target instanceof ExprNS.Subscript) return;
        if (node.target instanceof ExprNS.Variable) {
          target = node.target.name;
        }
      } else if (node instanceof StmtNS.AnnAssign) {
        target = node.target.name;
      } else if (node instanceof StmtNS.FunctionDef) {
        target = node.name;
      } else {
        return;
      }

      if (!target) return;

      // Parameters are already "declared" the moment their scope is entered — a body statement
      // that assigns one is a reassignment, exactly like re-assigning a plain declared variable.
      let declared = declaredPerScope.get(env);
      if (!declared) {
        declared = new Set(env.parameters);
        declaredPerScope.set(env, declared);
      }
      const name = target.lexeme;
      if (declared.has(name)) {
        throw new ResolverErrors.NameReassignmentError(
          target.line,
          target.col,
          env.source,
          target.indexInSource,
          target.indexInSource + name.length,
          env.names.get(name)!,
        );
      }
      declared.add(name);
    },
  };
}

/** Stateless singleton for convenience — only use if you know names won't repeat across calls. */
export const NoReassignmentValidator: FeatureValidator = createNoReassignmentValidator();
