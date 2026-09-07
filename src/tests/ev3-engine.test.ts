import { EV3Engine } from "../engines/ev3";

async function runEV3(code: string) {
  const engine = new EV3Engine();
  return engine.execute(code.endsWith("\n") ? code : code + "\n");
}

describe("EV3 engine", () => {
  describe("parse and compile", () => {
    test("basic program compiles and returns PVML bytecode", async () => {
      const result = await runEV3("x = 1\ny = 2\nx + y\n");
      expect(result.status).toBe("finished");
      expect(result).toHaveProperty("output");
    });

    test("arithmetic program compiles successfully", async () => {
      const result = await runEV3("1 + 1\n");
      expect(result.status).toBe("finished");
    });

    test("for-loop program compiles successfully", async () => {
      const result = await runEV3("for i in range(3):\n    i\n");
      expect(result.status).toBe("finished");
    });

    test("function program compiles successfully", async () => {
      const result = await runEV3("def add(x, y):\n    return x + y\n\nadd(1, 2)\n");
      expect(result.status).toBe("finished");
    });

    test("returns a structured error for invalid syntax rather than throwing", async () => {
      const result = await runEV3("def invalid(:\n");
      expect(result.status).toBe("error");
      expect(result).toHaveProperty("error");
    });
  });

  // `ev3_*` names resolve during analysis (no NameError) because the `ev3` stdlib group is
  // registered with the resolver, but PVMLCompiler has no device-call (CALLV) emission yet — see
  // stdlib/ev3.ts's doc comment. getTokenAnnotation() throws for *any* root-level name it doesn't
  // recognise as a primitive/constant the moment that name is even loaded (not just called), so
  // today a program can't reference an `ev3_*` name at all, calling it or not — this locks in that
  // honest boundary with a clean, structured compile error rather than silently-wrong bytecode.
  // This test should start failing (in the good sense) once CALLV emission is implemented — that
  // failure is the signal to update it to assert successful compilation instead.
  describe("ev3_* device calls (not yet compilable — CALLV emission not implemented)", () => {
    test("merely referencing an ev3_* name fails to compile with a clear, structured error", async () => {
      const result = await runEV3("ev3_hello\n");
      expect(result.status).toBe("error");
      expect(result).toHaveProperty("error");
      if (result.status === "error") {
        expect(result.error).toMatch(/ev3_hello/);
      }
    });

    test("calling an ev3_* function fails to compile with a clear, structured error", async () => {
      const result = await runEV3("ev3_hello()\n");
      expect(result.status).toBe("error");
      expect(result).toHaveProperty("error");
      if (result.status === "error") {
        expect(result.error).toMatch(/ev3_hello/);
      }
    });
  });
});
