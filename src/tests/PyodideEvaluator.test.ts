/**
 * Conductor-evaluator tests for pyodide (mirrors Py2JsEvaluator.test.ts).
 *
 * These load a real pyodide runtime, so they're slow on a cold cache (first
 * run downloads pyodide's assets into the OS temp dir — see
 * loadPyodide.ts); a generous per-test timeout accounts for that.
 */
import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import {
  chapterExpectedNames,
  PyodideEvaluator1,
  PyodideEvaluator2,
  PyodideEvaluator3,
  PyodideEvaluator4,
  PyodideEvaluatorFull,
} from "../conductor/PyodideEvaluator";

const PYODIDE_TIMEOUT = 60_000;
/** python/sicp/mce.py doesn't implement parse()/tokenize() yet (only
 * apply_in_underlying_python) — see issue #318 for why this isn't a quick
 * fix. Remove once that lands and bumps SICP_VERSION. */
const KNOWN_SICP_GAPS = new Set<string>(["parse", "tokenize"]);

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

describe("PyodideEvaluator2", () => {
  test(
    "SICPy vocabulary (pair/head/tail, plus a prelude-only name) actually runs, not just validates",
    async () => {
      const { conductor, errors, outputs } = makeMockConductor();
      const evaluator = new PyodideEvaluator2(conductor);

      // pair/head/tail/llist are native names; length is prelude-only (see
      // linked-list.prelude.ts) — neither is real CPython, so this only
      // works if sourceacademy-sicp was actually bridged in, not just
      // accepted by the Resolver.
      await evaluator.evaluateChunk("xs = llist(1, 2, 3)\nprint(head(xs))\nprint(length(xs))\n");

      expect(errors).toEqual([]);
      expect(outputs).toEqual(["1", "3"]);
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

describe("sourceacademy-sicp bridging — name parity", () => {
  // The bug this guards against: a name the Resolver accepts for a chapter
  // (native builtin or prelude-defined) that isn't actually bound in pyodide
  // after bridging — passes validation, NameErrors at runtime. Each expected
  // name gets its own evaluateChunk call (same evaluator instance, so the
  // bridging setup cost is paid once) — a bare expression statement resolves
  // a name without needing to know its arity/signature or exercising
  // anything beyond plain lookup, and one call per name means a NameError on
  // one name can't hide a second one further down, the way a single
  // newline-joined chunk would (that's what surfaced the mce gap below).
  test.each([1, 2, 3, 4])(
    "every name §%i's Resolver accepts is actually bound in pyodide after bridging",
    async chapter => {
      const { conductor, errors } = makeMockConductor();
      const Evaluator = [
        PyodideEvaluator1,
        PyodideEvaluator2,
        PyodideEvaluator3,
        PyodideEvaluator4,
      ][chapter - 1];
      const evaluator = new Evaluator(conductor);
      const names = chapterExpectedNames(chapter).filter(name => !KNOWN_SICP_GAPS.has(name));

      for (const name of names) {
        await evaluator.evaluateChunk(`${name}\n`);
      }

      expect(errors).toEqual([]);
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

  test(
    "a chunk that shadows the builtin `globals` name does not crash cross-chunk tracking",
    async () => {
      const { conductor, errors, outputs } = makeMockConductor();
      const evaluator = new PyodideEvaluatorFull(conductor);

      await evaluator.evaluateChunk("globals = 1\nx = 5\n");
      await evaluator.evaluateChunk("print(x)\n");

      expect(errors).toEqual([]);
      expect(outputs).toEqual(["5"]);
    },
    PYODIDE_TIMEOUT,
  );

  test(
    "an import nested inside a never-called function is not eagerly installed",
    async () => {
      const { conductor, errors, outputs } = makeMockConductor();
      const evaluator = new PyodideEvaluatorFull(conductor);

      // If this were eagerly micropip-installed (pre-fix behavior: ast.walk
      // finds imports nested in function bodies too), the install would fail
      // loudly since the package doesn't exist — even though f() is never
      // called and the import never actually runs.
      await evaluator.evaluateChunk(
        "def f():\n    import this_package_definitely_does_not_exist_xyz\n    return 1\nprint('ok')\n",
      );

      expect(errors).toEqual([]);
      expect(outputs).toEqual(["ok"]);
    },
    PYODIDE_TIMEOUT,
  );
});
