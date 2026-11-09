import type { StmtNS } from "../ast-types";
import { makeTypedChapter4Validators, traverseAST } from "../validator";
import type { ProposedChunk } from "./checker";
import type { TypeDiagnostic } from "./diagnostics";
import { eraseTypes } from "./erase";
import { StaticTypeErrors } from "./errors";

/** What the checker has to offer an engine: `TypedPythonChecker`, or what loads it when needed. */
export interface ChunkChecker {
  /** Checks a chunk of a session, which is part of it only when it is accepted. */
  proposeChunk(source: string): Promise<ProposedChunk>;
  /** Checks a program that is not part of a session. */
  check(source: string): Promise<TypeDiagnostic[]>;
  /**
   * The names that a module defines only as types (`Rune` of `rune`): a program imports them to annotate,
   * and they are left out of the program that runs, as the module does not export them.
   */
  typeNames?(module: string): ReadonlySet<string> | undefined;
}

/**
 * Erases the types of a program that the checker accepted, and rejects the use as a value of a name that
 * is only a type (`print(Rune)` after `from rune import Rune`): it is left out of the program that runs.
 */
function erase(program: StmtNS.Stmt, checker: ChunkChecker): void {
  const uses: TypeDiagnostic[] = [];
  eraseTypes(
    program,
    module => checker.typeNames?.(module),
    name => {
      const message = `${name.lexeme} is a type: use it to annotate, not as a value`;
      uses.push({
        severity: "error",
        message,
        original: message,
        line: name.line,
        column: name.col,
        endLine: name.line,
        endColumn: name.col + name.lexeme.length,
      });
    },
  );
  rejectErrors(uses);
}

/**
 * Python §4 Typed rules on the annotations (`makeTypedChapter4Validators`): the first violation
 * is thrown. The program is not changed.
 */
export function validateTypedProgram(program: StmtNS.Stmt): void {
  const validators = makeTypedChapter4Validators();
  traverseAST(program, node => validators.forEach(v => v.validate(node)));
}

/** Warnings and hints do not stop a program; errors do, all of them together. */
function rejectErrors(diagnostics: TypeDiagnostic[]): void {
  const errors = diagnostics.filter(d => d.severity === "error");
  if (errors.length > 0) throw new StaticTypeErrors(errors);
}

/**
 * Turns a chunk of Python §4 Typed into a chunk of Python §4, or rejects it, for an engine that keeps
 * a session (py2js, the CSE machine): the chunk can use the names, and the types, of the chunks before
 * it. In this order:
 *
 * 1. the rules of Python §4 Typed on the annotations: the first violation is thrown (they are quick,
 *    and what a student should fix first);
 * 2. the type checker, with the text as the student wrote it (`source`): all its errors are thrown
 *    together, as {@link StaticTypeErrors};
 * 3. the types are erased from `program`, in place, so that it is validated with the rules of
 *    Python §4 and run by the engine as usual.
 *
 * The result says that the chunk is accepted. **The engine calls it when the chunk has passed its own
 * validation** (the Resolver, which rejects the names that Python §4 does not have, comes after the
 * types): a chunk that is not run is not part of the session.
 */
export async function checkTypedChunk(
  source: string,
  program: StmtNS.Stmt,
  checker: ChunkChecker,
): Promise<() => void> {
  validateTypedProgram(program);
  const proposed = await checker.proposeChunk(source);
  rejectErrors(proposed.diagnostics);
  erase(program, checker);
  return proposed.accept;
}

/**
 * The same for an engine that has no session: every program is a program of its own (the
 * environment stepper, which steps a program from the start each time).
 */
export async function checkTypedProgram(
  source: string,
  program: StmtNS.Stmt,
  checker: ChunkChecker,
): Promise<void> {
  validateTypedProgram(program);
  rejectErrors(await checker.check(source));
  erase(program, checker);
}
