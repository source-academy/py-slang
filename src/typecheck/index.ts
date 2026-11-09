import { StmtNS } from "../ast-types";
import { makeTypedChapter4Validators, traverseAST } from "../validator";
import { eraseTypes } from "./erase";

export { eraseTypes } from "./erase";
export { TypedPythonChecker, topLevelNames } from "./checker";
export type { ProposedChunk } from "./checker";
export { PyrightClient } from "./client";
export type { LspDiagnostic, WorkerFactory, WorkerLike } from "./client";
export { TYPED_PYTHON_4_CONFIG } from "./config";
export { LazyChecker, startBrowserChecker, TYPED_PY4_CHECKER_URL } from "./loader";
export { toStub, MODULE_DESCRIPTION_VERSION, UnknownDescriptionError } from "./module-description";
export type { ModuleDescription, TypeDescription } from "./module-description";
export type { DescriptionSource } from "./modules";
export { StaticTypeError, StaticTypeErrors, TypeCheckerUnavailableError } from "./errors";
export { checkTypedChunk, checkTypedProgram, validateTypedProgram } from "./typed-chunk";
export type { ChunkChecker } from "./typed-chunk";
export type { Severity, TypeDiagnostic } from "./diagnostics";

/**
 * Python §4 Typed (docs/typed-python-4.md), the part that the parser's AST takes: checks the rules
 * on the annotations (`makeTypedChapter4Validators`, which throws on the first violation), then
 * erases the types, in place. The result is a Python §4 program, which is resolved with
 * `makeChapter4Validators()` and run by any engine as usual.
 */
export function prepareTypedProgram<T extends StmtNS.Stmt>(program: T): T {
  const validators = makeTypedChapter4Validators();
  traverseAST(program, node => validators.forEach(v => v.validate(node)));
  return eraseTypes(program);
}
