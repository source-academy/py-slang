import { BasicEvaluator } from "@sourceacademy/conductor/runner";
import { PVMLBoxType } from "../engines/pvml/types";
import { PVMLCompiler } from "../engines/pvml/pvml-compiler";
import { PVMLInterpreter } from "../engines/pvml/pvml-interpreter";
import { parse } from "../parser/parser-adapter";
import { analyzeWithEnvironments } from "../resolver";
import linkedList from "../stdlib/linked-list";
import list from "../stdlib/list";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import pairmutator from "../stdlib/pairmutator";
import stream from "../stdlib/stream";
import { Group } from "../stdlib/utils";
import { EvaluatorError } from "./errors";

const VARIANT = 4;
const GROUPS: Group[] = [misc, math, linkedList, list, pairmutator, stream];

function once<T>(fn: () => T): () => T {
  let value: T | undefined;
  let done = false;
  return () => {
    if (!done) {
      value = fn();
      done = true;
    }
    return value as T;
  };
}

/**
 * Compiles Python to PVML bytecode and runs it on PVMLInterpreter, a
 * pure-TypeScript bytecode VM (no WASM, no native binary — runs directly
 * wherever this evaluator is loaded, e.g. in the browser).
 *
 * Mirrors PyCseEvaluatorBase's persistence model (see PyCseEvaluator.ts) but
 * adapted to a compiled/bytecode pipeline instead of a tree-walking
 * interpreter: one persistent `globalEnv` (a dynamically-growable,
 * name-indexed global environment — see PVMLInterpreter's `globalEnv` field
 * and PVMLCompiler's `useGlobalMap` mode) survives across evaluateChunk()
 * calls, and each group's SICPy prelude source is compiled and run into it
 * exactly once, memoized via `once()` just like the CSE evaluator's
 * `ensurePreludesLoaded`. A later chunk sees every name — variable or
 * function — any earlier chunk (or the prelude) defined, the same way a
 * CSE-machine REPL chunk sees an earlier one's global bindings.
 */
export class PyPvmlEvaluator extends BasicEvaluator {
  private globalEnv = new Map<string, PVMLBoxType>();
  private readonly preludeText = GROUPS.map(g => g.prelude ?? "")
    .filter(p => p.trim())
    .join("\n");

  private readonly ensurePreludeLoaded = once(() => {
    if (this.preludeText.trim()) {
      this.runChunk(this.preludeText);
    }
  });

  /** Compiles and runs one chunk of SICPy source against the persistent
   * `globalEnv`, seeding the resolver with whatever names are already there
   * (from the prelude or earlier chunks) so this chunk can reference them. */
  private runChunk(script: string): PVMLBoxType {
    const source = script.endsWith("\n") ? script : script + "\n";
    const ast = parse(source);
    const { errors, environments } = analyzeWithEnvironments(
      ast,
      source,
      VARIANT,
      GROUPS,
      [],
      Array.from(this.globalEnv.keys()),
    );
    if (errors.length > 0) {
      throw errors[0];
    }
    const compiler = PVMLCompiler.fromProgram(ast, VARIANT, environments, true);
    const program = compiler.compileProgram(ast);
    const interpreter = new PVMLInterpreter(program, {
      sendOutput: msg => this.conductor.sendOutput(msg),
      globalEnv: this.globalEnv,
    });
    const result = interpreter.execute();
    this.globalEnv = interpreter.getGlobalEnv();
    return result;
  }

  evaluateChunk(chunk: string): Promise<void> {
    try {
      this.ensurePreludeLoaded();
      const returnValue = this.runChunk(chunk);
      this.conductor.sendResult(PVMLInterpreter.toJSValue(returnValue));
    } catch (e) {
      this.conductor.sendError(new EvaluatorError(e));
    }
    return Promise.resolve();
  }
}
