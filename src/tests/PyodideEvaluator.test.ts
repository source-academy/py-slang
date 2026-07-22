/**
 * Conductor-evaluator tests for pyodide (mirrors Py2JsEvaluator.test.ts).
 *
 * These load a real pyodide runtime, so they're slow on a cold cache (first
 * run downloads pyodide's assets into the OS temp dir — see
 * loadPyodide.ts); a generous per-test timeout accounts for that.
 */
import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import {
  PyodideEvaluator1,
  PyodideEvaluator3,
  PyodideEvaluatorFull,
} from "../conductor/PyodideEvaluator";

const PYODIDE_TIMEOUT = 60_000;

/** Minimal IRunnerPlugin mock — see Py2JsEvaluator.test.ts's identical stub
 * for why this is enough: the evaluator only calls sendResult/sendError/
 * sendOutput, and never registers a module-loader plugin (pyodide can't
 * reach conductor's module protocol at all — see PyodideEvaluator.ts). */
function makeMockConductor() {
  const results: unknown[] = [];
  const errors: { name: string; message: string }[] = [];
  const outputs: string[] = [];
  const conductor = {
    sendResult: (r: unknown) => results.push(r),
    sendError: (e: unknown) => errors.push(e as { name: string; message: string }),
    sendOutput: (m: string) => outputs.push(m),
    registerPlugin: () => undefined,
  } as unknown as IRunnerPlugin;
  return { conductor, results, errors, outputs };
}

describe("PyodideEvaluator1", () => {
  test(
    "runs a valid §1 chunk on real CPython and streams its output",
    async () => {
      const { conductor, results, errors, outputs } = makeMockConductor();
      const evaluator = new PyodideEvaluator1(conductor);

      await evaluator.evaluateChunk("print(1 + 2)\n");

      expect(errors).toEqual([]);
      expect(results).toEqual([undefined]);
      expect(outputs).toEqual(["3"]);
    },
    PYODIDE_TIMEOUT,
  );

  test(
    "rejects a chunk outside §1's feature set before ever reaching pyodide",
    async () => {
      const { conductor, errors, outputs } = makeMockConductor();
      const evaluator = new PyodideEvaluator1(conductor);

      // Lists aren't introduced until a later chapter.
      await evaluator.evaluateChunk("x = [1, 2, 3]\n");

      expect(errors).toHaveLength(1);
      expect(outputs).toEqual([]);
    },
    PYODIDE_TIMEOUT,
  );
});

describe("PyodideEvaluator3", () => {
  test(
    "accepts a chunk using lists, valid from §3 onward",
    async () => {
      const { conductor, errors, outputs } = makeMockConductor();
      const evaluator = new PyodideEvaluator3(conductor);

      await evaluator.evaluateChunk("x = [1, 2, 3]\nprint(len(x))\n");

      expect(errors).toEqual([]);
      expect(outputs).toEqual(["3"]);
    },
    PYODIDE_TIMEOUT,
  );
});

describe("PyodideEvaluatorFull", () => {
  test(
    "runs a construct no SICPy chapter allows, unmodified",
    async () => {
      const { conductor, errors, outputs } = makeMockConductor();
      const evaluator = new PyodideEvaluatorFull(conductor);

      await evaluator.evaluateChunk("class C:\n    pass\nprint([x * x for x in range(3)])\n");

      expect(errors).toEqual([]);
      expect(outputs).toEqual(["[0, 1, 4]"]);
    },
    PYODIDE_TIMEOUT,
  );

  test(
    "an erroring chunk reports through sendError and does not kill the evaluator",
    async () => {
      const { conductor, errors, outputs } = makeMockConductor();
      const evaluator = new PyodideEvaluatorFull(conductor);

      await evaluator.evaluateChunk("1 / 0\n");
      await evaluator.evaluateChunk("print('still alive')\n");

      expect(errors).toHaveLength(1);
      // pyodide surfaces every Python-side exception as a generic PythonError
      // (unlike py-slang's own interpreter, which throws typed classes named
      // after the Python exception) — the real exception type is only in the
      // traceback text, not `.name`.
      expect(errors[0].name).toBe("PythonError");
      expect(errors[0].message).toContain("ZeroDivisionError");
      expect(outputs).toEqual(["still alive"]);
    },
    PYODIDE_TIMEOUT,
  );
});
