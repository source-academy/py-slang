import type { StmtNS } from "../ast-types";
import { makeTypedChapter4Validators, traverseAST } from "../validator";
import type { TypeDiagnostic } from "./diagnostics";
import { eraseTypes } from "./erase";
import { StaticTypeErrors } from "./errors";

/** What the checker has to offer a program: `TypedPythonChecker`, or what loads it when needed. */
export interface ChunkChecker {
  checkChunk(source: string): Promise<TypeDiagnostic[]>;
}

/**
 * Typed Python §4 rules on the annotations (`makeTypedChapter4Validators`): the first violation
 * is thrown. The program is not changed.
 */
export function validateTypedProgram(program: StmtNS.Stmt): void {
  const validators = makeTypedChapter4Validators();
  traverseAST(program, node => validators.forEach(v => v.validate(node)));
}

/**
 * Turns a chunk of Typed Python §4 into a chunk of Python §4, or rejects it. In this order:
 *
 * 1. the rules of Typed Python §4 on the annotations: the first violation is thrown (they are quick,
 *    and what a student should fix first);
 * 2. the type checker, with the text as the student wrote it (`source`): all its errors are thrown
 *    together, as {@link StaticTypeErrors} (warnings and hints do not stop a program);
 * 3. the types are erased from `program`, in place, so that it is resolved with the validators of
 *    Python §4 and run by the engine as usual.
 *
 * (The Resolver, which rejects the names that Python §4 does not have, comes after.)
 */
export async function checkTypedChunk(
  source: string,
  program: StmtNS.Stmt,
  checker: ChunkChecker,
): Promise<void> {
  validateTypedProgram(program);
  const errors = (await checker.checkChunk(source)).filter(d => d.severity === "error");
  if (errors.length > 0) throw new StaticTypeErrors(errors);
  eraseTypes(program);
}
