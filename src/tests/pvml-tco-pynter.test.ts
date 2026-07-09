/**
 * Confirms tail-call optimization actually reaches, and works on, the real
 * native Pynter `runner` binary — not just PVMLInterpreter (the TS
 * pathway). Native Pynter's own C VM (vm.c's op_call/op_call_t handler)
 * has always correctly implemented CALLT (it destroys the caller's stack
 * frame before creating the callee's, exactly like a proper TCO'd VM
 * should); the gap was entirely on the PVMLCompiler side, which never
 * actually emitted CALLT/CALLTP/CALLTA for any real tail call until
 * PVMLCompiler.compileTail was added — see its doc comment. This file pins
 * that fix against the real VM, since PVMLInterpreter (the TS pathway)
 * reimplements the same frame-reuse logic independently and passing there
 * doesn't guarantee native Pynter's own C implementation agrees.
 *
 * Opt-in: set PYNTER_RUNNER_PATH to a built `runner` binary, same as every
 * other native Pynter suite. Skipped entirely otherwise.
 */
import { runCodePvmlDetailed } from "../pvml-runner";

const pynterPath = process.env.PYNTER_RUNNER_PATH;
const describeBlock = pynterPath ? describe : describe.skip;

describeBlock("[pvml/pynter] Tail-call optimization on the real native runner", () => {
  test("deep tail recursion (if/else branches) succeeds, well past what a growing call stack could survive", async () => {
    const code =
      "def loop(n, acc):\n" +
      "    if n == 0:\n" +
      "        return acc\n" +
      "    return loop(n - 1, acc + 1)\n" +
      "loop(50000, 0)\n";
    const result = await runCodePvmlDetailed(code, 3, { pynterPath: pynterPath! });
    expect(result.resultType).toBe("integer");
    expect(result.resultValue).toBe("50000");
  });

  test("deep tail recursion via ternary (both branches) succeeds", async () => {
    const code =
      "def loop(n, acc):\n" +
      "    return acc if n == 0 else loop(n - 1, acc + 1)\n" +
      "loop(50000, 0)\n";
    const result = await runCodePvmlDetailed(code, 3, { pynterPath: pynterPath! });
    expect(result.resultType).toBe("integer");
    expect(result.resultValue).toBe("50000");
  });

  test("mutual tail recursion succeeds", async () => {
    const code =
      "def is_even(n):\n" +
      "    if n == 0:\n" +
      "        return True\n" +
      "    return is_odd(n - 1)\n" +
      "def is_odd(n):\n" +
      "    if n == 0:\n" +
      "        return False\n" +
      "    return is_even(n - 1)\n" +
      "is_even(50000)\n";
    const result = await runCodePvmlDetailed(code, 3, { pynterPath: pynterPath! });
    expect(result.resultType).toBe("boolean");
    expect(result.resultValue).toBe("true");
  });

  // Sanity check: a genuinely non-tail-recursive function (`n +` is still
  // pending after the recursive call returns) must NOT be silently treated
  // as a tail call — it should still exhaust the real VM's stack/heap, same
  // as before this fix. Confirms the fix is selective, not a blanket
  // "reuse the frame for every call" change.
  test("non-tail recursion at the same depth still faults on the real VM", async () => {
    const code =
      "def sumto(n):\n" +
      "    if n == 0:\n" +
      "        return 0\n" +
      "    return n + sumto(n - 1)\n" +
      "sumto(50000)\n";
    // runCodePvmlDetailed throws a RunError whenever the native trailer's
    // fault isn't "no fault" (see its implementation) -- a growing,
    // non-tail-call stack at this depth reliably exhausts Pynter's VM.
    await expect(runCodePvmlDetailed(code, 3, { pynterPath: pynterPath! })).rejects.toThrow();
  });
});
