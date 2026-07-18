import { RunError, runCode } from "../runner";

describe("runner.ts: runCode()", () => {
  describe("happy path", () => {
    test.each([1, 2, 3, 4])(
      "evaluates and captures print() output at variant %d",
      async variant => {
        const output = await runCode("print(1 + 1)", variant);
        expect(output).toBe("2\n");
      },
    );

    test("concatenates output from multiple print() calls", async () => {
      const output = await runCode("print(1)\nprint(2)\nprint(3)", 4);
      expect(output).toBe("1\n2\n3\n");
    });

    test("returns empty output for a program with no print() calls", async () => {
      const output = await runCode("x = 1 + 1", 4);
      expect(output).toBe("");
    });

    test("accepts code without a trailing newline", async () => {
      const output = await runCode("print(42)", 4);
      expect(output).toBe("42\n");
    });

    test("loads variant-appropriate prelude-defined builtins (pair/list at variant 2+)", async () => {
      const output = await runCode("print(pair(1, 2))", 2);
      expect(output).toBe("[1, 2]\n");
    });
  });

  describe("invalid variant", () => {
    test("rejects a variant outside 1-4 as a parse RunError", async () => {
      await expect(runCode("print(1)", 5)).rejects.toMatchObject({
        constructor: RunError,
        kind: "parse",
      });
    });
  });

  describe("parse errors", () => {
    test("a syntax error is thrown as a parse RunError, not a raw parser exception", async () => {
      let caught: unknown;
      try {
        await runCode("print(", 4);
        throw new Error("expected runCode to reject");
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(RunError);
      expect(caught).toBeInstanceOf(Error);
      expect((caught as RunError).kind).toBe("parse");
    });
  });

  describe("analysis errors", () => {
    test("an undeclared-name reference is thrown as an analysis RunError", async () => {
      let caught: unknown;
      try {
        await runCode("print(undefined_name)", 4);
        throw new Error("expected runCode to reject");
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(RunError);
      expect((caught as RunError).kind).toBe("analysis");
    });

    test("a sublanguage restriction violation is thrown as an analysis RunError (variant 1 rejects list literals)", async () => {
      let caught: unknown;
      try {
        await runCode("x = [1, 2, 3]", 1);
        throw new Error("expected runCode to reject");
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(RunError);
      expect((caught as RunError).kind).toBe("analysis");
    });
  });

  describe("runtime errors", () => {
    // Regression test for issue #272: handleRuntimeError (src/engines/cse/error.ts) throws the
    // raw, non-Error-extending RuntimeSourceError object the instant a runtime error occurs,
    // escaping straight out of collectSnapshots() -- past the context.errors-based RunError
    // conversion runCode() otherwise relies on, which only handled *collected*, not thrown,
    // errors. Before the fix, this reached callers (the CLI in src/repl.ts) as a bare object
    // that isn't `instanceof Error`, rendering as the literal string "[object Object]".
    test("a runtime type error is thrown as a runtime RunError with a readable message, not a raw object", async () => {
      let caught: unknown;
      try {
        await runCode('print(1 + "a")', 4);
        throw new Error("expected runCode to reject");
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(RunError);
      expect(caught).toBeInstanceOf(Error);
      expect((caught as RunError).kind).toBe("runtime");
      expect(String(caught)).not.toBe("[object Object]");
      expect((caught as RunError).message).toContain("unsupported operand type");
    });

    test("division by zero is thrown as a runtime RunError", async () => {
      let caught: unknown;
      try {
        await runCode("print(1 / 0)", 4);
        throw new Error("expected runCode to reject");
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(RunError);
      expect((caught as RunError).kind).toBe("runtime");
    });
  });

  describe("RunOptions", () => {
    // Not envSteps: generateCSEMachineStateStream's own envSteps check is commented out
    // (src/engines/cse/interpreter.ts, ~line 326) -- the parameter is accepted but does
    // nothing at the interpreter level today. stepLimit is the option that's actually wired
    // up (steps === stepLimit triggers StepLimitExceededError), so it's the one that can
    // actually stop a runaway loop here.
    test("stepLimit stops a runaway loop and is reported as a runtime RunError", async () => {
      await expect(
        runCode("x = 0\nwhile True:\n  x = x + 1", 4, { stepLimit: 50 }),
      ).rejects.toMatchObject({ constructor: RunError, kind: "runtime" });
    });

    test("a generous stepLimit still lets a normal program finish", async () => {
      const output = await runCode("x = 0\nfor i in range(10):\n  x = x + i\nprint(x)", 4, {
        stepLimit: 100000,
      });
      expect(output).toBe("45\n");
    });

    test("passing envSteps is accepted without affecting execution (see comment above)", async () => {
      const output = await runCode("print(1 + 1)", 4, { envSteps: 1 });
      expect(output).toBe("2\n");
    });
  });
});
