import { StmtNS } from "../ast-types";
import { Group } from "../stdlib/utils";
import { makeValidatorsForChapter } from "../validator";
import { Resolver } from "./resolver";

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
