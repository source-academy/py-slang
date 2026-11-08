import type { StmtNS } from "../ast-types";
import { checkTypedChunk, checkTypedProgram, type ChunkChecker } from "../typecheck";

/**
 * What every evaluator of Typed Python §4 does, whichever engine runs the program (py2js, the CSE
 * machine, the environment stepper): the chunk is parsed, then, as the first step of validating it,
 * the types are checked: the chunk is rejected, or it is turned into a chunk of Python §4. The engine
 * then validates and runs it as it always does. An evaluator of Python §4 takes this as the option
 * `beforeValidation`; errors are reported with ./staticTypeErrors.ts.
 *
 * It may return a function: the engine calls it when the chunk has passed its own validation, which
 * is when the chunk is part of the session (see `checkTypedChunk`).
 */
export type BeforeValidation = (
  script: string,
  ast: StmtNS.FileInput,
) => Promise<void | (() => void)>;

/** For an engine that keeps a session of chunks (py2js, the CSE machine). */
export function typedBeforeValidation(checker: ChunkChecker): BeforeValidation {
  return (script, ast) => checkTypedChunk(script, ast, checker);
}

/** For an engine in which every program stands on its own (the environment stepper). */
export function typedBeforeValidationWithoutSession(checker: ChunkChecker): BeforeValidation {
  return (script, ast) => checkTypedProgram(script, ast, checker);
}
