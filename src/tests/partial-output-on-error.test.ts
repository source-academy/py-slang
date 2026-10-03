import { runCodePy2Js } from "../engines/py2js";
import { runCodePvmlInterpreter } from "../pvml-runner";
import { runCode } from "../runner";

// Issue #491: whatever a program printed before a runtime error must still
// reach the user, so the headless runners attach it to the error they throw.
const program = "print(1)\nprint(2)\nprint(1 / 0)\n";

describe("print output before a runtime error", () => {
  it("CSE", async () => {
    const e = await runCode(program, 1).catch(e => e);
    expect(e.output).toBe("1\n2\n");
  });

  it("py2js", () => {
    let error: { output?: string } | undefined;
    try {
      runCodePy2Js(program, 1);
    } catch (e) {
      error = e as { output?: string };
    }
    expect(error?.output).toBe("1\n2\n");
  });

  it("PVML interpreter", async () => {
    const e = await runCodePvmlInterpreter(program, 1).catch(e => e);
    expect(e.output).toBe("1\n2\n");
  });
});
