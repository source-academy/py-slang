/**
 * `math_nextafter` and `math_ulp` on IEEE 754 doubles, shared by the stdlib (CSE, py2js, WASM and the
 * e-stepper reach it through that) and the PVML interpreter, so that they cannot drift apart.
 *
 * Both follow CPython (3.12 and later, where `math.nextafter` takes `steps`).
 */

const view = new DataView(new ArrayBuffer(8));
const SIGN = 0x8000000000000000n;
const MAGNITUDE = 0x7fffffffffffffffn;

/**
 * The position of `x` in the order of all doubles, as an integer: neighbours differ by one, and +0 and -0 are both 0.
 * `x` must not be NaN.
 */
function position(x: number): bigint {
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  return bits & SIGN ? -(bits & MAGNITUDE) : bits;
}

function fromPosition(position: bigint): number {
  view.setBigUint64(0, position >= 0n ? position : -position | SIGN);
  return view.getFloat64(0);
}

/**
 * The double `steps` steps after `x` towards `y`; `y` itself when `x` is `y` or when fewer steps are needed to get there.
 * `steps` must not be negative.
 */
export function nextafter(x: number, y: number, steps: bigint): number {
  // No step is no step, even towards NaN (CPython: math.nextafter(1.0, nan, steps=0) is 1.0).
  if (steps === 0n) return x;
  if (Number.isNaN(x)) return x;
  if (Number.isNaN(y)) return y;
  if (x === y) return y;
  const from = position(x);
  const to = position(y);
  const distance = to > from ? to - from : from - to;
  if (steps >= distance) return y;
  const result = to > from ? from + steps : from - steps;
  // Reaching zero from below gives -0, as in CPython (and C): the sign is that of the side it came from.
  return result === 0n && from < 0n ? -0 : fromPosition(result);
}

/** The value of the least significant bit of `x`: the distance to the next double away from zero (NaN and infinity map to themselves). */
export function ulp(x: number): number {
  if (Number.isNaN(x)) return x;
  const magnitude = Math.abs(x);
  if (magnitude === Infinity) return magnitude;
  const next = nextafter(magnitude, Infinity, 1n);
  // The largest double has no next one: the distance to the previous one is used.
  return next === Infinity ? magnitude - nextafter(magnitude, 0, 1n) : next - magnitude;
}
