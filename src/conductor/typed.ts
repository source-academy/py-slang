import type { StmtNS } from "../ast-types";
import { checkTypedChunk, type ChunkChecker } from "../typecheck";

/**
 * What every evaluator of Typed Python §4 does, whichever engine runs the program (py2js, the CSE
 * machine, the environment stepper): the chunk is parsed, then, as the first step of validating it,
 * {@link checkTypedChunk} rejects it or turns it into a chunk of Python §4. The engine then validates
 * and runs it as it always does. An evaluator of Python §4 takes this as the option
 * `beforeValidation`; errors are reported with ./staticTypeErrors.ts.
 */
export type BeforeValidation = (script: string, ast: StmtNS.FileInput) => Promise<void>;

export function typedBeforeValidation(checker: ChunkChecker): BeforeValidation {
  return (script, ast) => checkTypedChunk(script, ast, checker);
}
