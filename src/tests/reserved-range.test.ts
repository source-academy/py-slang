import { compileScriptToWasmBinary } from "../engines/wasm/compiler";
import { parse } from "../parser/parser-adapter";
import { analyzeWithEnvironments } from "../resolver";
import { ResolverErrors } from "../resolver/errors";
import { preprocessPython } from "../conductor/stepper/preprocess";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import {
  EvaluatorEngine,
  makeEvaluatorTestHarness,
  resetEvaluatorTestModules,
} from "./evaluatorTestHarness";
import { toPythonAstAndResolve } from "./utils";

/** Every way a program can bind the name `range`. */
const REDECLARATIONS: [string, string][] = [
  ["assignment", "range = 5"],
  ["assignment in a function", "def f():\n    range = 1\n    return range"],
  ["function definition", "def range(n):\n    return n"],
  ["nested function definition", "def f():\n    def range(n):\n        return n\n    return 1"],
  ["parameter", "def f(range):\n    return range"],
  ["second parameter", "def f(a, range):\n    return a"],
  ["lambda parameter", "f = lambda range: range"],
  ["for-loop target", "for range in range(3):\n    pass"],
  ["import", "from m import range"],
  ["aliased import", "from m import foo as range"],
];

/** Programs that mention `range` or similar names without binding it. */
const LEGAL = [
  ["for-loop header", "for i in range(3):\n    pass"],
  ["range-like names", "ranges = 1\nrange_ = 2\nmy_range = 3\nranges + range_ + my_range"],
  ["aliasing away an import", "from m import range as r"],
];

describe("range is reserved in chapters 3 and 4", () => {
  describe.each([3, 4])("chapter %i resolver", chapter => {
    test.each(REDECLARATIONS)("rejects %s", (_label, code) => {
      expect(() => toPythonAstAndResolve(code, chapter)).toThrow(ResolverErrors.ReservedNameError);
    });

    test("reports the name and where it was bound", () => {
      expect(() => toPythonAstAndResolve("x = 1\nrange = 5", chapter)).toThrow(
        /SyntaxError at line 2[\s\S]*range = 5[\s\S]*\^+ 'range' is reserved and cannot be redefined/,
      );
    });

    test.each(LEGAL)("accepts %s", (_label, code) => {
      expect(() => toPythonAstAndResolve(code, chapter)).not.toThrow(
        ResolverErrors.ReservedNameError,
      );
    });
  });

  test.each([1, 2])("chapter %i, where range does not exist, does not reserve it", chapter => {
    expect(() => toPythonAstAndResolve("range = 5", chapter)).not.toThrow(
      ResolverErrors.ReservedNameError,
    );
  });

  describe("every implementation rejects it", () => {
    afterEach(resetEvaluatorTestModules);

    // CSE machine and py2js, through the real conductor evaluators.
    describe.each<EvaluatorEngine>(["pycse", "py2js"])("%s", engine => {
      describe.each([3, 4])("chapter %i", chapter => {
        test.each(REDECLARATIONS)("rejects %s", async (_label, code) => {
          const harness = makeEvaluatorTestHarness(engine, chapter);
          await harness.evaluate(code + "\n");
          expect(harness.errors).toHaveLength(1);
          expect(harness.errors[0].message).toContain("'range' is reserved");
        });

        test("still runs for-loops over range", async () => {
          const harness = makeEvaluatorTestHarness(engine, chapter);
          await harness.evaluate("for i in range(3):\n    print(i)\n");
          expect(harness.errors).toEqual([]);
          expect(harness.outputs.join("")).toContain("2");
        });
      });
    });

    // Substitution stepper.
    describe.each([3, 4])("stepper, chapter %i", chapter => {
      test.each(REDECLARATIONS)("rejects %s", (_label, code) => {
        const script = code + "\n";
        expect(preprocessPython(parse(script), script, chapter)).toContain("'range' is reserved");
      });
    });

    // PVML in the browser (variant 3/4) and native Pynter (chapter 3) both run this
    // analysis before compiling.
    describe.each([3, 4])("PVML / Pynter analysis, chapter %i", chapter => {
      test.each(REDECLARATIONS)("rejects %s", (_label, code) => {
        const script = code + "\n";
        const { errors } = analyzeWithEnvironments(parse(script), script, chapter, [misc, math]);
        expect(errors[0]).toBeInstanceOf(ResolverErrors.ReservedNameError);
      });
    });

    // WebAssembly compiler.
    describe.each([3, 4])("wasm, chapter %i", chapter => {
      test.each(REDECLARATIONS)("rejects %s", async (_label, code) => {
        const result = await compileScriptToWasmBinary(code + "\n", false, { chapter }, [
          misc,
          math,
        ]);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.errors[0]).toBeInstanceOf(ResolverErrors.ReservedNameError);
        }
      });
    });
  });
});
