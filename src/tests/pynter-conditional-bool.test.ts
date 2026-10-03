/**
 * docs/specs/python_typing.tex: "Following if and elif, Python §x only allows boolean
 * expressions." py-slang#438 asked whether native Pynter's BR_T/BR_F handling (the compiled form of
 * every if/elif condition, while-loop condition, and conditional-expression/ternary test) already
 * enforces this the same way the in-browser PVML interpreter's branchIfTrue/branchIfFalse do
 * (pinned by pvml.test.ts's "if 1:\n    10\nelse:\n    20" case). It does, and has since the VM's
 * original implementation (see pynter's vm.c, op_br_t/op_br_f) — this file is the missing native-
 * Pynter-specific regression coverage for that, mirroring py2js-conditional-bool.test.ts's shape.
 *
 * Unlike py2js-conditional-bool.test.ts, this does not compare against the CSE machine: the CSE
 * machine's BRANCH instruction does not enforce this yet (py-slang#436), so using it as the
 * "expected" reference here would pin the wrong behavior for native Pynter.
 *
 * Opt-in: set PYNTER_RUNNER_PATH to a built `runner` binary, same as every other native Pynter
 * suite. Skipped entirely otherwise.
 */
import { runCodePvml } from "../pvml-runner";
import { RunError } from "../runner";

const pynterPath = process.env.PYNTER_RUNNER_PATH;
const describeBlock = pynterPath ? describe : describe.skip;

async function pynterOutcome(code: string): Promise<{ error: string } | { output: string }> {
  try {
    return { output: await runCodePvml(code, 3, { pynterPath: pynterPath! }) };
  } catch (e) {
    if (e instanceof RunError) return { error: e.message };
    throw e;
  }
}

describeBlock("Native Pynter: if/elif/while/ternary conditions must be bool", () => {
  test.each([
    "if 1:\n    print(1)\nelse:\n    print(2)",
    "if 0.0:\n    print(1)\nelse:\n    print(2)",
    "if 'yes':\n    print(1)\nelse:\n    print(2)",
    "if None:\n    print(1)\nelse:\n    print(2)",
  ])("a non-bool if condition is a runtime type error: %s", async code => {
    const outcome = await pynterOutcome(code);
    expect(outcome).toHaveProperty("error");
    expect((outcome as { error: string }).error).toContain("type error");
  });

  test("a non-bool elif condition is also a type error", async () => {
    const outcome = await pynterOutcome(
      "if False:\n    print(1)\nelif 5:\n    print(2)\nelse:\n    print(3)",
    );
    expect(outcome).toHaveProperty("error");
    expect((outcome as { error: string }).error).toContain("type error");
  });

  test("a non-bool while condition is also a type error", async () => {
    const outcome = await pynterOutcome("x = 1\nwhile x:\n    x = 0\n");
    expect(outcome).toHaveProperty("error");
    expect((outcome as { error: string }).error).toContain("type error");
  });

  test("a non-bool conditional-expression (ternary) condition is also a type error", async () => {
    const outcome = await pynterOutcome("print(1 if 5 else 2)");
    expect(outcome).toHaveProperty("error");
    expect((outcome as { error: string }).error).toContain("type error");
  });

  test.each([
    ["if True:\n    print('yes')\nelse:\n    print('no')", "yes\n"],
    ["if False:\n    print('yes')\nelse:\n    print('no')", "no\n"],
    ["print(1 if True else 2)", "1\n"],
    ["print(1 if False else 2)", "2\n"],
  ])("a bool condition still behaves normally: %s", async (code, expected) => {
    expect(await pynterOutcome(code)).toEqual({ output: expected });
  });
});
