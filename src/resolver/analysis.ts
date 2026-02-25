import { StmtNS } from '../ast-types';
import { Resolver } from './resolver';
import { runValidators, makeValidatorsForChapter } from '../validator';

/**
 * Full analysis pipeline:
 *   1. NameResolver (scope analysis, name lookup)  — Resolver class
 *   2. FeatureGate  (chapter sublanguage restrictions) — validator feature flags
 *
 * Throws on first violation found.
 */
export function analyze(ast: StmtNS.FileInput, source: string, chapter: number = 4): void {
    new Resolver(source, ast).resolve(ast);
    runValidators(ast, makeValidatorsForChapter(chapter));
}
