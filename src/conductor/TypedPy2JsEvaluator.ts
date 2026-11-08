import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { LazyChecker, StaticTypeErrors, type ChunkChecker } from "../typecheck";
import { Py2JsEvaluatorBase } from "./Py2JsEvaluator";
import { sendStaticTypeErrors } from "./staticTypeErrors";
import { typedBeforeValidation } from "./typed";

/**
 * Typed Python §4 (docs/typed-python-4.md): Python §4 with type annotations, checked before the
 * program runs, and run by the py2js engine with the types erased.
 *
 * Each chunk (the program, and then what is typed in the REPL) goes through
 * {@link checkTypedChunk} before it is resolved and compiled: the rules of Typed Python §4 on its
 * annotations, the type checker (pyright, in a worker of its own, which loads while the student
 * types), and the erasure of the types. A chunk with type errors is not run; every error is sent,
 * with its line and column, like the errors of any other evaluator. The checker keeps the chunks
 * that it accepted, as the session keeps their names: a chunk can use the names, and the types, of
 * the chunks before it.
 *
 * Everything else is the py2js evaluator's: modules, local imports, input(), the data visualizer.
 * (A module has no types for the checker until it has a stub: docs/typed-python-4.md, phase 4.)
 */
export abstract class TypedPy2JsEvaluatorBase extends Py2JsEvaluatorBase {
  protected constructor(conductor: IRunnerPlugin, variant: number, checker: ChunkChecker) {
    super(conductor, variant, {
      beforeValidation: typedBeforeValidation(checker),
    });
  }

  /** A program with type errors is not run: each error is reported, with its place. */
  protected override reportError(e: unknown): void {
    if (e instanceof StaticTypeErrors) {
      sendStaticTypeErrors(this.conductor, e.errors);
    } else {
      super.reportError(e);
    }
  }
}

export class TypedPy2JsEvaluator4 extends TypedPy2JsEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    const checker = new LazyChecker();
    super(conductor, 4, checker);
    // The checker is 4.7 MB (0.77 MB compressed): start loading it now, not at the first Run.
    checker.preload();
  }
}
