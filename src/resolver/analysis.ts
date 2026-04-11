import { StmtNS } from "../ast-types";
import { Group } from "../stdlib/utils";
import { makeValidatorsForChapter } from "../validator";
import { FunctionEnvironments, Resolver } from "./resolver";

/**
 * Full analysis pipeline (single-pass):
 *   1. NameResolver (scope analysis, name lookup)  — Resolver class
 *   2. FeatureGate  (chapter sublanguage restrictions) — validators run inline during resolution
 *
 * Analyzes the entire AST, returning an array of errors. If the array is empty, then the AST is valid.
 */
export function analyze(
  ast: StmtNS.FileInput,
  source: string,
  chapter: number = 4,
  groups: Group[] = [],
  preludeNames: string[] = [],
): Error[] {
  return new Resolver(source, ast, makeValidatorsForChapter(chapter), groups, preludeNames).resolve(
    ast,
  );
}

/**
 * Like analyze(), but also returns the resolved function environments so callers can
 * pass them directly to the compiler — avoiding a second resolver run.
 */
export function analyzeWithEnvironments(
  ast: StmtNS.FileInput,
  source: string,
  chapter: number = 4,
  groups: Group[] = [],
  preludeNames: string[] = [],
): { errors: Error[]; environments: FunctionEnvironments } {
  const resolver = new Resolver(
    source,
    ast,
    makeValidatorsForChapter(chapter),
    groups,
    preludeNames,
  );
  const errors = resolver.resolve(ast);
  return { errors, environments: resolver.functionEnvironments };
}
