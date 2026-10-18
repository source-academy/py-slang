/**
 * Python's arithmetic on ints (`bigint`) and floats (`number`) with CPython's results, shared by the
 * engines (py-slang#580). JavaScript's operators differ from CPython's in places:
 *
 * - `Math.floor(a / b)` is not float `//`, which CPython computes from `fmod` (`1 // 0.1` is `9.0`);
 * - the sign of a zero result of `%` is that of the divisor (`5 % -2.5` is `-0.0`);
 * - `Number(a) / Number(b)` overflows for ints beyond about 1e308 (`10**400 / 10**399` is `10.0`);
 * - `**` differs from the C library's `pow` in the last digit for some integer exponents
 *   (`7 ** -2`), and gives `Infinity` where CPython raises an OverflowError;
 * - converting a huge int to a float is an OverflowError, not `Infinity`.
 *
 * The callers check for a zero divisor first, with the message and the error class of their engine
 * (these functions raise a {@link PyArithError} for it as well, as a safety net).
 */

export type PyNum = number | bigint;

/** An error of Python's arithmetic that the calling engine turns into its own error. */
export class PyArithError extends Error {
  constructor(
    readonly kind: "OverflowError" | "ZeroDivisionError",
    message: string,
  ) {
    super(message);
    this.name = kind;
  }
}

/** An int as a float; an OverflowError when it is too big, as in CPython. */
export function toFloat(n: PyNum): number {
  if (typeof n === "number") return n;
  const f = Number(n);
  if (!Number.isFinite(f)) {
    throw new PyArithError("OverflowError", "int too large to convert to float");
  }
  return f;
}

const bitLength = (n: bigint): number => n.toString(2).length;

/** `x` as `m * 2 ** e` with an integer `m`, for a finite, positive x. */
function decompose(x: number): { m: bigint; e: number } {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  const exponent = Number((bits >> 52n) & 0x7ffn);
  const fraction = bits & 0xfffffffffffffn;
  return exponent === 0
    ? { m: fraction, e: -1074 }
    : { m: fraction | (1n << 52n), e: exponent - 1075 };
}

/**
 * `num / den * 2 ** k` as a double, rounded once (to nearest, ties to even): the quotient is taken
 * with 66 bits and a sticky bit, which a conversion to a double then rounds correctly.
 */
function scaledQuotient(num: bigint, den: bigint, k: number): number {
  const shift = 66 + bitLength(den) - bitLength(num);
  const [n, d] = shift >= 0 ? [num << BigInt(shift), den] : [num, den << BigInt(-shift)];
  const quotient = n / d;
  let result = Number(n % d === 0n ? quotient : quotient | 1n);
  let e = k - shift;
  while (e > 1023) {
    result *= 2 ** 1023;
    e -= 1023;
  }
  while (e < -1022) {
    result *= 2 ** -1022;
    e += 1022;
  }
  return result * 2 ** e;
}

/** `a / b` for ints, correctly rounded as CPython does, also when the ints are too big for a float. */
export function trueDivideInts(a: bigint, b: bigint): number {
  if (b === 0n) throw new PyArithError("ZeroDivisionError", "division by zero");
  const limit = 1n << 53n;
  if (a > -limit && a < limit && b > -limit && b < limit) return Number(a) / Number(b);
  const negative = a < 0n !== b < 0n;
  const x = a < 0n ? -a : a;
  const y = b < 0n ? -b : b;
  const result = scaledQuotient(x, y, 0);
  if (!Number.isFinite(result)) {
    throw new PyArithError("OverflowError", "integer division result too large for a float");
  }
  return negative ? -result : result;
}

/** `a // b` for floats, as CPython computes it (`1 // 0.1` is `9.0`). */
export function floorDivideFloats(a: number, b: number): number {
  if (b === 0) throw new PyArithError("ZeroDivisionError", "float floor division by zero");
  const mod = a % b;
  let div = (a - mod) / b;
  if (mod !== 0) {
    if (b < 0 !== mod < 0) div -= 1;
  }
  if (div === 0) {
    // The sign of a zero result is that of the quotient (copysign(0.0, a / b)).
    const sign = a / b;
    return sign < 0 || Object.is(sign, -0) ? -0 : 0;
  }
  const floored = Math.floor(div);
  return div - floored > 0.5 ? floored + 1 : floored;
}

/** `a % b` for floats: a zero result takes the sign of the divisor (`5 % -2.5` is `-0.0`). */
export function moduloFloats(a: number, b: number): number {
  if (b === 0) throw new PyArithError("ZeroDivisionError", "float modulo");
  const r = a % b;
  if (r === 0) return b < 0 ? -0 : 0;
  return r < 0 !== b < 0 ? r + b : r;
}

/** Exponents of floats up to this size are computed exactly (above it, with `**`). */
const MAX_EXACT_EXPONENT = 5000n;

/**
 * `x ** n` for a float and an integer exponent, correctly rounded as the C library that CPython uses
 * is (JavaScript's `**` is not: `7 ** -2` differs from CPython's in the last digit).
 */
function floatPowInt(x: number, n: bigint): number {
  const negative = x < 0 && n % 2n !== 0n;
  const { m, e } = decompose(Math.abs(x));
  const count = n < 0n ? -n : n;
  const exact = m ** count;
  const result =
    n >= 0n
      ? scaledQuotient(exact, 1n, e * Number(count))
      : scaledQuotient(1n, exact, -e * Number(count));
  return negative ? -result : result;
}

/** A float result of `**`; CPython raises an OverflowError where JavaScript gives infinity. */
function checkedPow(result: number, base: number, exponent: number): number {
  // (A NaN result is not an overflow: a negative base with a fractional exponent is a complex
  // number in Python, and NaN here.)
  if (Math.abs(result) === Infinity && Number.isFinite(base) && Number.isFinite(exponent)) {
    throw new PyArithError("OverflowError", "(34, 'Numerical result out of range')");
  }
  return result;
}

/** `base ** exponent` for an int base and a negative int exponent: a float, as in CPython. */
export function powerIntNegative(base: bigint, exponent: bigint): number {
  if (base === 0n) {
    throw new PyArithError("ZeroDivisionError", "0.0 cannot be raised to a negative power");
  }
  const x = toFloat(base);
  return exponent < -MAX_EXACT_EXPONENT
    ? x ** Number(exponent)
    : checkedPow(floatPowInt(x, exponent), x, Number(exponent));
}

/** `base ** exponent` for floats, with the special cases of the C library's `pow`. */
export function powerFloats(base: number, exponent: number): number {
  if (exponent === 0 || base === 1) return 1;
  if (Number.isNaN(base) || Number.isNaN(exponent)) return NaN;
  if (!Number.isFinite(exponent)) {
    const size = Math.abs(base);
    if (size === 1) return 1;
    return exponent > 0 === size > 1 ? Infinity : 0;
  }
  if (base === 0 && exponent < 0) {
    throw new PyArithError("ZeroDivisionError", "0.0 cannot be raised to a negative power");
  }
  if (base !== 0 && Number.isFinite(base) && Number.isInteger(exponent)) {
    const n = BigInt(exponent);
    if (n >= -MAX_EXACT_EXPONENT && n <= MAX_EXACT_EXPONENT) {
      return checkedPow(floatPowInt(base, n), base, exponent);
    }
  }
  if (exponent === 0.5 && base > 0) return Math.sqrt(base);
  return checkedPow(base ** exponent, base, exponent);
}
