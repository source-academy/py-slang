/**
 * #284: complex magnitudes must be computed with Math.hypot, which scales
 * internally — sqrt(re² + im²) overflows to inf (or underflows to 0) when a
 * component's square leaves the float range even though the true modulus is
 * representable. CPython uses hypot for abs(complex) too.
 *
 * Covers the three sites the issue lists: the CSE machine's abs
 * (stdlib/misc.ts), the PVML interpreter's abs (engines/pvml/builtins.ts),
 * and PyComplexNumber.pow's magnitude (types/value-types.ts, shared by every
 * engine).
 */
import { runCodePvmlInterpreter } from "../pvml-runner";
import { runCode } from "../runner";
import { PyComplexNumber } from "../types";

const ABS_EXTREME = `print(abs(complex(1e200, 0)))`;

test("CSE abs(complex) survives components whose squares overflow", async () => {
  expect(await runCode(ABS_EXTREME, 1)).toBe("1e+200\n");
});

test("PVML abs(complex) survives components whose squares overflow", async () => {
  expect(await runCodePvmlInterpreter(ABS_EXTREME, 1)).toBe("1e+200\n");
});

test("PyComplexNumber.pow magnitude survives components whose squares overflow", () => {
  // (1e200+0j) ** 0.5 = 1e100 — representable, but the old sqrt-of-squares
  // magnitude overflowed to inf on the way there.
  const result = new PyComplexNumber(1e200, 0).pow(new PyComplexNumber(0.5, 0));
  expect(result.real / 1e100).toBeCloseTo(1, 10);
  expect(result.imag).toBe(0);
});

test("abs(complex) of an ordinary value is unchanged", async () => {
  expect(await runCode(`print(abs(complex(3, 4)))`, 1)).toBe("5.0\n");
});
