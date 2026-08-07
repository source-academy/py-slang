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
 * A `from X import Y` binding now also counts toward a *later* `Y = ...`/`def Y(): ...` being flagged
 * as a reassignment (py-slang#413): chapters 1-2 (the only chapters this validator runs for — see
 * `sublanguages.ts`) are deliberately single-assignment so that substitution alone is a *complete*
 * explanation of what a program does, with no environment/mutation model needed. A later `def red`
 * silently shadowing an earlier `from rune import red` would violate exactly that guarantee, so it
 * must be rejected here — the same as reassigning any other name — rather than left for the
 * substitution stepper to (at best) shadow correctly or (at worst, before that was fixed) crash on.
 *
 * An import binding a name is itself never rejected for colliding with an *earlier* one, though
 * (`declared.add` directly, not `declareOrThrow`) — unlike `Assign`/`FunctionDef`/etc., which check
 * before adding. Two imports binding the same name (even from two different modules) is a real,
 * separately-tested, intentional feature — `moduleInterop.ts`'s `resolveImports` binds them in source
 * order with "last one wins" semantics, exactly like plain reassignment elsewhere in Python, and
 * `src/tests/py2js-from-import.test.ts` exercises this deliberately even under chapter 1. This is safe
 * to treat asymmetrically from `Assign`/`FunctionDef`: the grammar itself (`python.ne`'s `program`
 * rule) enforces that every import precedes every other statement, so an import can never be the
 * *later* half of a collision with a `def`/`=` — only the earlier half, which this validator still
 * correctly protects by having every import add its name(s) before any later statement is checked.
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
        const declared = declaredNamesFor(env);
        for (const spec of node.names) declared.add((spec.alias ?? spec.name).lexeme);
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
