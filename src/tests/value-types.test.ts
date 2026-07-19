import { PyComplexNumber } from "../types/value-types";

describe("PyComplexNumber", () => {
  test("pow keeps a representable result when a component's square overflows", () => {
    const result = new PyComplexNumber(1e200, 0).pow(new PyComplexNumber(0.5, 0));

    // Before the Math.hypot fix, r = sqrt(1e200**2) overflowed to Infinity and
    // the whole result degraded to (Infinity, NaN). The exp/log path still has
    // its usual relative rounding (as in CPython), so compare relatively.
    expect(Number.isFinite(result.real)).toBe(true);
    expect(result.real / 1e100).toBeCloseTo(1, 10);
    expect(result.imag).toBe(0);
  });
});
