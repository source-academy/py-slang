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
 *
 * A `from X import Y` binding is a declaration exactly like `Y = ...`/`def Y(): ...`, both when it's
 * the *earlier* half of a collision and the *later* half (py-slang#413): chapters 1-2 (the only
 * chapters this validator runs for — see `sublanguages.ts`) are deliberately single-assignment so
 * that substitution alone is a *complete* explanation of what a program does, with no
 * environment/mutation model needed. A later `def red` silently shadowing an earlier
 * `from rune import red` would violate exactly that guarantee, the same as two modules both
 * declaring `red` would — every one of these is a reassignment, and every one is rejected here,
 * rather than left for the substitution stepper to (at best) shadow correctly or (at worst, before
 * that was fixed) crash on.
 */
export function createNoReassignmentValidator(): FeatureValidator {
  const declaredPerScope = new WeakMap<Environment, Set<string>>();

  function declaredNamesFor(env: Environment): Set<string> {
    // Parameters are already "declared" the moment their scope is entered — a body statement that
    // assigns one is a reassignment, exactly like re-assigning a plain declared variable.
    let declared = declaredPerScope.get(env);
    if (!declared) {
      declared = new Set(env.parameters);
      declaredPerScope.set(env, declared);
    }
    return declared;
  }

  function declareOrThrow(env: Environment, target: Token): void {
    const declared = declaredNamesFor(env);
    const name = target.lexeme;
    if (declared.has(name)) {
      throw new ResolverErrors.NameReassignmentError(
        target.line,
        target.col,
        env.source,
        target.indexInSource,
        target.indexInSource + name.length,
      );
    }
    declared.add(name);
  }

  return {
    validate(node: ASTNode, env?: Environment): void {
      if (!env) return;

      if (node instanceof StmtNS.FromImport) {
        for (const spec of node.names) declareOrThrow(env, spec.alias ?? spec.name);
        return;
      }

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
      declareOrThrow(env, target);
    },
  };
}

/** Stateless singleton for convenience — only use if you know names won't repeat across calls. */
export const NoReassignmentValidator: FeatureValidator = createNoReassignmentValidator();
