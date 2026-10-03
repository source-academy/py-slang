import { EV3Engine } from "../engines/ev3";
import { compileScriptToWasmBinary } from "../engines/wasm/compiler";
import { runCodePy2Js } from "../engines/py2js";
import { runCodePvmlInterpreter } from "../pvml-runner";
import { runCode } from "../runner";
import { ResolverErrors } from "../resolver/errors";
import linkedList from "../stdlib/linked-list";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import { toPythonAstAndResolve } from "./utils";

/** Uses of `range` that are not the callee of a for-loop header. */
const MISUSES: [string, string][] = [
  ["assigning a call", "x = range(3)"],
  ["assigning the name", "f = range"],
  ["printing a call", "print(range(3))"],
  ["passing it to a function", "print(len(range(3)))"],
  ["a bare expression statement", "range(3)"],
  ["a bare name", "range"],
  ["inside a function", "def f(n):\n    return range(n)"],
  ["inside a list", "xs = [range(3)]"],
  ["inside a for-loop body", "for i in range(2):\n    x = range(i)"],
  ["nested in a for-loop header", "for i in range(range(3)):\n    pass"],
];

/** Uses that must keep working. */
const LEGAL: [string, string][] = [
  ["a for loop", "for i in range(3):\n    pass"],
  ["with a start", "for i in range(1, 4):\n    pass"],
  ["with a step", "for i in range(10, 0, -2):\n    pass"],
  ["inside a function", "def f(n):\n    for i in range(n):\n        print(i)"],
  ["nested loops", "for i in range(2):\n    for j in range(i):\n        print(j)"],
  ["a computed bound", "xs = [1, 2, 3]\nfor i in range(len(xs)):\n    print(xs[i])"],
  [
    "names that merely contain range",
    "ranges = 1\nrange_ = 2\nmy_range = 3\nranges + range_ + my_range",
  ],
];

describe("range is only allowed in a for-loop header", () => {
  describe.each([3, 4])("chapter %i", chapter => {
    test.each(MISUSES)("rejects %s", (_label, code) => {
      expect(() => toPythonAstAndResolve(code, chapter)).toThrow(
        ResolverErrors.RangeOutsideForHeaderError,
      );
    });

    test.each(LEGAL)("allows %s", (_label, code) => {
      expect(() => toPythonAstAndResolve(code, chapter)).not.toThrow();
    });

    test("the message says what is allowed, and the caret underlines the name", () => {
      let error: Error | undefined;
      try {
        toPythonAstAndResolve("x = 1\ny = range(3)", chapter);
      } catch (e) {
        error = e as Error;
      }
      const lines = error!.message.split("\n");
      expect(lines[0]).toMatch(/^SyntaxError at line 2/);
      expect(lines[2]).toBe("y = range(3)");
      expect(lines[3].indexOf("^")).toBe(lines[2].indexOf("range"));
      expect(lines[3]).toContain("can only be used in a for-loop header");
    });
  });

  // No for loops there, so `range` is just an unknown name. (Lists are rejected earlier still in
  // these chapters, so the list case doesn't reach this check.)
  describe.each([1, 2])("chapter %i", chapter => {
    test.each(MISUSES.filter(([, code]) => !code.includes("for ") && !code.includes("[")))(
      "reports %s as an unknown name",
      (_label, code) => {
        expect(() => toPythonAstAndResolve(code, chapter)).toThrow(
          ResolverErrors.NameNotFoundError,
        );
      },
    );
  });

  describe("every implementation rejects it", () => {
    const MISUSE = "x = range(3)\nprint(1)";

    test("the CSE machine", async () => {
      await expect(runCode(MISUSE, 3)).rejects.toThrow(/can only be used in a for-loop header/);
    });

    test("PVML (headless): no iterator value", async () => {
      await expect(runCodePvmlInterpreter(MISUSE, 3)).rejects.toThrow(
        /can only be used in a for-loop header/,
      );
    });

    test("py2js: a clear message, not a ReferenceError", () => {
      expect(() => runCodePy2Js(MISUSE, 3)).toThrow(/can only be used in a for-loop header/);
    });

    test("wasm", async () => {
      const result = await compileScriptToWasmBinary(MISUSE + "\n", false, { chapter: 3 }, [
        misc,
        math,
        linkedList,
      ]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0]).toBeInstanceOf(ResolverErrors.RangeOutsideForHeaderError);
      }
    });

    test("EV3 (which compiles as Python §3)", async () => {
      const result = await new EV3Engine().execute(MISUSE + "\n");
      expect(result.status).toBe("error");
      expect(result).toHaveProperty(
        "error",
        expect.stringContaining("can only be used in a for-loop header"),
      );
    });

    test.each([
      ["the CSE machine", (code: string) => runCode(code, 3)],
      ["PVML", (code: string) => runCodePvmlInterpreter(code, 3)],
      ["py2js", (code: string) => Promise.resolve(runCodePy2Js(code, 3).output)],
    ])("%s still runs a for loop over range", async (_name, run) => {
      expect(await run("for i in range(3):\n    print(i)")).toBe("0\n1\n2\n");
    });
  });
});
