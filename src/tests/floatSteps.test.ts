import { nextafter, ulp } from "../stdlib/floatSteps";

// The expected values are those of CPython 3.14 (math.nextafter, math.ulp).
describe("nextafter", () => {
  test("steps from x towards y, and stops at y", () => {
    expect(nextafter(1, 2, 3n)).toBe(1.0000000000000007);
    expect(nextafter(1, 1.0000000000000004, 5n)).toBe(1.0000000000000004);
    expect(nextafter(1, 1, 4n)).toBe(1);
  });

  test("crosses zero through the denormals, in both directions", () => {
    expect(nextafter(0, -1, 2n)).toBe(-1e-323);
    expect(nextafter(-5e-324, 1, 2n)).toBe(5e-324);
    expect(nextafter(5e-324, -1, 3n)).toBe(-1e-323);
  });

  test("reaching zero gives the zero of the side it comes from", () => {
    expect(Object.is(nextafter(-5e-324, 1, 1n), -0)).toBe(true);
    expect(Object.is(nextafter(5e-324, -1, 1n), 0)).toBe(true);
    expect(Object.is(nextafter(-1e-323, 1, 2n), -0)).toBe(true);
    expect(nextafter(-1e-323, 1, 3n)).toBe(5e-324);
  });

  test("zero steps give x, whatever y is", () => {
    expect(nextafter(1, 2, 0n)).toBe(1);
    expect(Object.is(nextafter(-0, 1, 0n), -0)).toBe(true);
  });

  test("overflows to infinity only when y is infinite, and comes back from it", () => {
    expect(nextafter(1.7976931348623157e308, Infinity, 3n)).toBe(Infinity);
    expect(nextafter(Infinity, 0, 2n)).toBe(1.7976931348623155e308);
  });

  test("NaN in either argument gives NaN", () => {
    expect(nextafter(NaN, 1, 1n)).toBeNaN();
    expect(nextafter(1, NaN, 1n)).toBeNaN();
  });

  test("gives y with the sign of y when x equals y", () => {
    expect(Object.is(nextafter(0, -0, 1n), -0)).toBe(true);
  });
});

describe("ulp", () => {
  test("is the distance to the next double away from zero", () => {
    expect(ulp(1)).toBe(2.220446049250313e-16);
    expect(ulp(-1e308)).toBe(1.99584030953472e292);
  });

  test("of the largest double is the distance to its predecessor", () => {
    expect(ulp(1.7976931348623157e308)).toBe(1.99584030953472e292);
  });

  test("of zero and the denormals is the smallest denormal", () => {
    expect(ulp(0)).toBe(5e-324);
    expect(ulp(-0)).toBe(5e-324);
    expect(ulp(1e-310)).toBe(5e-324);
  });

  test("of infinity and NaN maps to themselves", () => {
    expect(ulp(Infinity)).toBe(Infinity);
    expect(ulp(-Infinity)).toBe(Infinity);
    expect(ulp(NaN)).toBeNaN();
  });
});
