import { StmtNS } from "../ast-types";
import { makeTypedChapter4Validators, traverseAST } from "../validator";
import { eraseTypes } from "./erase";

export { eraseTypes } from "./erase";
export { TypedPythonChecker, topLevelNames } from "./checker";
export { PyrightClient } from "./client";
export type { LspDiagnostic, WorkerFactory, WorkerLike } from "./client";
export { TYPED_PYTHON_4_CONFIG } from "./config";
export type { Severity, TypeDiagnostic } from "./diagnostics";

/**
 * Typed Python §4 (docs/typed-python-4.md), the part that the parser's AST takes: checks the rules
 * on the annotations (`makeTypedChapter4Validators`, which throws on the first violation), then
 * erases the types, in place. The result is a Python §4 program, which is resolved with
 * `makeChapter4Validators()` and run by any engine as usual.
 */
export function prepareTypedProgram<T extends StmtNS.Stmt>(program: T): T {
  const validators = makeTypedChapter4Validators();
  traverseAST(program, node => validators.forEach(v => v.validate(node)));
  return eraseTypes(program);
}
