import { StmtNS } from "../ast-types";
import { Group } from "../stdlib/utils";
import { makeValidatorsForChapter } from "../validator";
import { Resolver } from "./resolver";

/**
 * Full analysis pipeline (single-pass):
 *   1. NameResolver (scope analysis, name lookup)  — Resolver class
 *   2. FeatureGate  (chapter sublanguage restrictions) — validators run inline during resolution
 *
 * Throws on first violation found.
 */
export function analyze(ast: StmtNS.FileInput, source: string, chapter: number = 4, groups: Group[] = [], preludeNames: string[] = []): void {
  new Resolver(source, ast, groups, makeValidatorsForChapter(chapter), preludeNames).resolve(ast);
}
