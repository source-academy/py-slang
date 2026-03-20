import { StmtNS } from "../ast-types";
import { Resolver } from "./resolver";
import { makeValidatorsForChapter } from "../validator";

/**
 * Full analysis pipeline (single-pass):
 *   1. NameResolver (scope analysis, name lookup)  — Resolver class
 *   2. FeatureGate  (chapter sublanguage restrictions) — validators run inline during resolution
 *
 * Throws on first violation found.
 */
export function analyze(ast: StmtNS.FileInput, source: string, chapter: number = 4): void {
  new Resolver(source, ast, makeValidatorsForChapter(chapter)).resolve(ast);
}
