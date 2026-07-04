/**
 * Static pre-checks run before the stepper is allowed to start.
 *
 * Python reports an undefined name as a runtime `NameError`, but a substitution stepper has no global
 * environment to fault against mid-reduction — a free name simply stops reducing. So, like Source's
 * `checkProgramForUndefinedVariables`, we detect undefined variables up front as a *preprocessing*
 * error: the evaluator reports it and does not run the stepper at all (see `PyStepperEvaluator`).
 *
 * Name resolution and chapter feature-gating are delegated to py-slang's own analyzer — the very same
 * {@link analyze} pass the default (CSE) evaluator runs — rather than to a bespoke scope walk. We hand
 * it the stepper's curated built-in vocabulary ({@link getAvailableBuiltinNames}) as the set of
 * predefined names, so the analyzer's scope rules (hoisting, nested functions, `global`/`nonlocal`)
 * and per-chapter restrictions are applied canonically and stay in lockstep with the real evaluator.
 * A §2 list-library name used in a §1 program is simply not in the §1 vocabulary, so it surfaces as an
 * unknown name — the same `NameError` a student would get for a genuine typo.
 *
 * The only stepper-specific check that remains here is the unsupported-operator rejection: identity
 * (`is`, `is not`) and membership (`in`, `not in`) are valid Python the analyzer accepts, but the
 * substitution model has no rule for them, so we reject them up front rather than letting a program get
 * silently "stuck".
 */

import type { StmtNS } from "../../ast-types";
import { analyze } from "../../resolver/analysis";
import { ResolverErrors } from "../../resolver/errors";
import type { StepNode } from "./ast";
import { getAvailableBuiltinNames } from "./builtins";
import { translateProgram } from "./translate";

/**
 * Comparison operators Python accepts but the substitution stepper does not model: identity (`is`,
 * `is not`) and membership (`in`, `not in`). They parse fine, but the reducer has no rule for them,
 * so a program using one would otherwise silently get "stuck" mid-reduction. We reject them up front
 * as a preprocessing error instead — mirroring Source's `noUnspecifiedOperator` rule.
 */
const UNSUPPORTED_OPERATORS = new Set(["is", "is not", "in", "not in"]);

/** Walks `program` (already translated) and returns the first unsupported operator used (see
 * {@link UNSUPPORTED_OPERATORS}), or `null` if none appears. */
export function findUnsupportedOperator(program: StepNode): string | null {
  let found: string | null = null;

  const visit = (value: unknown): void => {
    if (found !== null) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (
      value !== null &&
      typeof value === "object" &&
      typeof (value as StepNode).type === "string"
    ) {
      const node = value as StepNode;
      if (node.type === "BinaryExpression" && UNSUPPORTED_OPERATORS.has(String(node.operator))) {
        found = String(node.operator);
        return;
      }
      for (const key of Object.keys(node)) {
        if (key === "type") continue;
        visit(node[key]);
      }
    }
  };

  visit(program);
  return found;
}

/**
 * The stepper's preprocessing pass for a parsed Python program: returns an error message if it must
 * not run — an unsupported operator (`is`/`is not`/`in`/`not in`), an undefined name, or a feature the
 * selected chapter forbids — or `null` if it is clear to step. `source` is the program text (needed by
 * the analyzer for diagnostics); `chapter` is the selected SICPy sublanguage (1–4), which both gates
 * the available built-ins and selects the feature validators, so e.g. a §2 list-library name used in a
 * §1 program does not resolve and is reported as a `NameError`.
 */
export function preprocessPython(
  fileInput: StmtNS.FileInput,
  source: string,
  chapter: number,
): string | null {
  // Stepper-specific: reject identity/membership operators the substitution model cannot represent.
  // Run first so this construct is reported regardless of its operands' definedness.
  const operator = findUnsupportedOperator(translateProgram(fileInput));
  if (operator !== null) return `Operator '${operator}' is not allowed.`;

  // Delegate name resolution + chapter feature-gating to the canonical analyzer. No stdlib groups are
  // passed: the stepper supplies its own curated vocabulary as the prelude instead of the full library.
  const errors = analyze(fileInput, source, chapter, [], getAvailableBuiltinNames(chapter));
  if (errors.length === 0) return null;

  // Keep the CPython-style `NameError` for an unresolved name (what a Python student expects, and what
  // the stepper has always reported). Any other analyzer error — a chapter feature-gate, a forbidden
  // reassignment — surfaces with its own diagnostic.
  const nameError = errors.find(e => e instanceof ResolverErrors.NameNotFoundError);
  if (nameError !== undefined) {
    return `NameError: name '${nameError.varName}' is not defined`;
  }
  return errors[0].message;
}
