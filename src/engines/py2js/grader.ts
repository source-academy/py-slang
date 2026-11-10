/**
 * The entry that the Python autograder bundles (source-academy/grader, scripts/build-py2js-bundle.sh):
 * the py2js engine, and what grading Python §4 Typed needs besides.
 *
 * Grading Python §4 Typed has two steps, so that the type checker, which takes a while to start, is
 * started once for all the test cases and the programs run in throwaway workers as before:
 *
 * 1. {@link startNodeChecker} starts the checker (the worker script dist/TypedPy4Checker.js, which
 *    `yarn build:typecheck` builds) in a Node worker thread; `check(program)` gives its diagnostics.
 * 2. A program that has no type errors runs as Python §4: a `Py2JsSession(4, { beforeValidation:
 *    eraseTypesBeforeValidation })` checks the rules of Python §4 Typed on the annotations and erases
 *    the types.
 */
import { TypedPythonChecker, type ChunkChecker } from "../../typecheck";
import { typedBeforeValidationWithoutSession } from "../../conductor/typed";
import { opaqueTypeNames } from "../../typecheck/module-description";
import { temporaryDescriptions } from "../../typecheck/modules";
import { nodeWorkerFactory } from "../../typecheck/node-worker";
import type { Py2JsSessionOptions } from "./index";

export * from "./index";
export { TypedPythonChecker };
export type { TypeDiagnostic } from "../../typecheck";

/** Starts the checker from its worker script. Dispose of it when done. */
export function startNodeChecker(script: string): Promise<TypedPythonChecker> {
  return TypedPythonChecker.start(nodeWorkerFactory(script));
}

/**
 * What the erasure of types needs of a checker: the names that a module defines only as types (`Rune` of
 * `rune`), which a program imports to annotate and which the module does not export. The grader's own
 * checker has found no type errors by now, so `check` finds none.
 */
const erasingChecker: ChunkChecker = {
  proposeChunk: () => Promise.reject(new Error("the grader checks programs, not chunks")),
  check: () => Promise.resolve([]),
  typeNames(module) {
    const description = temporaryDescriptions(module);
    return description && description.module === module ? opaqueTypeNames(description) : undefined;
  },
};

/**
 * The `beforeValidation` of a session that runs a program that the checker has accepted: the rules on
 * the annotations are checked (the first violation is thrown), then the types are erased as in an
 * evaluator of Python §4 Typed (a type-only import is left out, and its use as a value is rejected).
 */
export const eraseTypesBeforeValidation: NonNullable<Py2JsSessionOptions["beforeValidation"]> =
  typedBeforeValidationWithoutSession(erasingChecker);
