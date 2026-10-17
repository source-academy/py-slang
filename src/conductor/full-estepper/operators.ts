/**
 * Python's operators on the values of the full e-stepper, with CPython's results and the kinds (and,
 * where stable across versions, the messages) of its errors.
 */

import { PyError, UnsupportedError } from "./errors";
import {
  bool,
  float,
  int,
  list,
  rangeAt,
  rangeLength,
  str,
  truthy,
  typeName,
  type PyValue,
} from "./values";

/** An int or a bool as an int, a float as a float, anything else as null. */
type Num = { float: false; i: bigint } | { float: true; f: number };

function asNum(v: PyValue): Num | null {
  switch (v.type) {
    case "int":
      return { float: false, i: v.value };
    case "bool":
      return { float: false, i: v.value ? 1n : 0n };
    case "float":
      return { float: true, f: v.value };
    default:
      return null;
  }
}

function toFloat(n: Num): number {
  if (n.float) return n.f;
  const f = Number(n.i);
  if (!Number.isFinite(f)) throw new PyError("OverflowError", "int too large to convert to float");
  return f;
}

function unsupported(op: string, a: PyValue, b: PyValue): PyError {
  const shown = op === "**" ? "** or pow()" : op;
  return new PyError(
    "TypeError",
    `unsupported operand type(s) for ${shown}: '${typeName(a)}' and '${typeName(b)}'`,
  );
}

const MAX_REPEAT = 100_000_000;

function repeatCount(n: bigint, unit: number): number {
  if (n <= 0n) return 0;
  if (n * BigInt(Math.max(unit, 1)) > BigInt(MAX_REPEAT)) {
    throw new PyError("MemoryError", "the result is too large");
  }
  return Number(n);
}

/* -------------------------------------------------------------------------- */
/*                                  Equality                                  */
/* -------------------------------------------------------------------------- */

export function pyEquals(a: PyValue, b: PyValue): boolean {
  const x = asNum(a);
  const y = asNum(b);
  if (x && y) {
    if (!x.float && !y.float) return x.i === y.i;
    if (x.float && y.float) return x.f === y.f;
    const f = x.float ? x.f : (y as { f: number }).f;
    const i = x.float ? (y as { i: bigint }).i : x.i;
    if (!Number.isFinite(f)) return false;
    return Number.isInteger(f) ? BigInt(f) === i : false;
  }
  if (a.type !== b.type) return false;
  switch (a.type) {
    case "str":
      return a.value === (b as typeof a).value;
    case "none":
      return true;
    case "list": {
      const other = (b as typeof a).obj;
      if (a.obj === other) return true;
      if (a.obj.elements.length !== other.elements.length) return false;
      return a.obj.elements.every((e, i) => pyEquals(e, other.elements[i]));
    }
    case "function":
      return a.obj === (b as typeof a).obj;
    case "builtin":
      return a.name === (b as typeof a).name;
    case "range": {
      const r = b as typeof a;
      const la = rangeLength(a);
      if (la !== rangeLength(r)) return false;
      return la === 0n || (a.start === r.start && (la === 1n || a.step === r.step));
    }
    default:
      return false;
  }
}

/** The `is` operator: identity for objects, equality for the immutable values. */
export function pyIs(a: PyValue, b: PyValue): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case "list":
      return a.obj === (b as typeof a).obj;
    case "function":
      return a.obj === (b as typeof a).obj;
    case "float":
      return Object.is(a.value, (b as typeof a).value);
    case "range":
      return a === b;
    default:
      return pyEquals(a, b);
  }
}

/* -------------------------------------------------------------------------- */
/*                                  Ordering                                  */
/* -------------------------------------------------------------------------- */

/** -1, 0 or 1 for numbers; null if either is NaN. */
function compareNum(x: Num, y: Num): number | null {
  if (!x.float && !y.float) return x.i < y.i ? -1 : x.i > y.i ? 1 : 0;
  const fx = x.float ? x.f : Number(x.i);
  const fy = y.float ? y.f : Number(y.i);
  if (Number.isNaN(fx) || Number.isNaN(fy)) return null;
  if (fx === fy && Number.isFinite(fx) && !(x.float && y.float)) {
    // An int and a float that are equal as doubles: compare exactly.
    const i = x.float ? (y as { i: bigint }).i : x.i;
    const f = x.float ? x.f : (y as { f: number }).f;
    if (Number.isInteger(f)) {
      const c = i < BigInt(f) ? -1 : i > BigInt(f) ? 1 : 0;
      return x.float ? -c : c;
    }
  }
  return fx < fy ? -1 : fx > fy ? 1 : 0;
}

function orderError(op: string, a: PyValue, b: PyValue): PyError {
  return new PyError(
    "TypeError",
    `'${op}' not supported between instances of '${typeName(a)}' and '${typeName(b)}'`,
  );
}

/** The ordering of two values, null when unordered (NaN); throws if they cannot be compared. */
function order(op: string, a: PyValue, b: PyValue): number | null {
  const x = asNum(a);
  const y = asNum(b);
  if (x && y) return compareNum(x, y);
  if (a.type === "str" && b.type === "str") {
    return a.value < b.value ? -1 : a.value > b.value ? 1 : 0;
  }
  if (a.type === "list" && b.type === "list") {
    const xs = a.obj.elements;
    const ys = b.obj.elements;
    for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
      if (!pyEquals(xs[i], ys[i])) return order(op, xs[i], ys[i]);
    }
    return xs.length < ys.length ? -1 : xs.length > ys.length ? 1 : 0;
  }
  throw orderError(op, a, b);
}

/* -------------------------------------------------------------------------- */
/*                                 Membership                                 */
/* -------------------------------------------------------------------------- */

function contains(container: PyValue, item: PyValue): boolean {
  switch (container.type) {
    case "list":
      return container.obj.elements.some(e => pyIs(e, item) || pyEquals(e, item));
    case "str":
      if (item.type !== "str") {
        throw new PyError(
          "TypeError",
          `'in <string>' requires string as left operand, not ${typeName(item)}`,
        );
      }
      return container.value.includes(item.value);
    case "range": {
      const n = asNum(item);
      if (!n || n.float) {
        const length = rangeLength(container);
        for (let i = 0n; i < length; i++) {
          if (pyEquals(int(rangeAt(container, i)), item)) return true;
        }
        return false;
      }
      const offset = n.i - container.start;
      if (offset % container.step !== 0n) return false;
      const k = offset / container.step;
      return k >= 0n && k < rangeLength(container);
    }
    default:
      throw new PyError("TypeError", `argument of type '${typeName(container)}' is not iterable`);
  }
}

/* -------------------------------------------------------------------------- */
/*                                 Arithmetic                                 */
/* -------------------------------------------------------------------------- */

function floorDivInt(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new PyError("ZeroDivisionError", "integer division or modulo by zero");
  const q = a / b;
  return a % b !== 0n && a < 0n !== b < 0n ? q - 1n : q;
}

/** `a / b` for ints, correctly rounded as CPython does, also when the ints are too big for a float. */
function trueDivInt(a: bigint, b: bigint): number {
  if (b === 0n) throw new PyError("ZeroDivisionError", "division by zero");
  const limit = 1n << 53n;
  if (a > -limit && a < limit && b > -limit && b < limit) return Number(a) / Number(b);
  const negative = a < 0n !== b < 0n;
  const x = a < 0n ? -a : a;
  const y = b < 0n ? -b : b;
  const bits = (n: bigint) => n.toString(2).length;
  // Divide with 64 more bits than a double has, then scale.
  const shift = Math.max(0, 64 + bits(y) - bits(x));
  const q = (x << BigInt(shift)) / y;
  const result = Number(q) / 2 ** shift;
  if (!Number.isFinite(result)) {
    throw new PyError("OverflowError", "integer division result too large for a float");
  }
  return negative ? -result : result;
}

/** `a // b` for floats, as CPython computes it (`1 // 0.1` is `9.0`). */
function floorDivFloat(a: number, b: number): number {
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

function modInt(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new PyError("ZeroDivisionError", "integer modulo by zero");
  const r = a % b;
  return r !== 0n && r < 0n !== b < 0n ? r + b : r;
}

function modFloat(a: number, b: number): number {
  if (b === 0) throw new PyError("ZeroDivisionError", "float modulo");
  const r = a % b;
  // A zero result takes the sign of the divisor (`5 % -2.5` is `-0.0`).
  if (r === 0) return b < 0 ? -0 : 0;
  return r < 0 !== b < 0 ? r + b : r;
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

function power(x: Num, y: Num): PyValue {
  if (!x.float && !y.float) {
    if (y.i >= 0n) {
      if (y.i > 100_000n && x.i !== 0n && x.i !== 1n && x.i !== -1n) {
        throw new PyError("MemoryError", "the result is too large");
      }
      return int(x.i ** y.i);
    }
    if (x.i === 0n) {
      throw new PyError("ZeroDivisionError", "0.0 cannot be raised to a negative power");
    }
    const base = toFloat(x);
    return base === 0 || y.i < -MAX_EXACT_EXPONENT
      ? float(base ** Number(y.i))
      : checkedPow(floatPowInt(base, y.i), base, Number(y.i));
  }
  const base = toFloat(x);
  const exponent = toFloat(y);
  if (base !== 0 && Number.isFinite(base) && Number.isInteger(exponent)) {
    const n = BigInt(exponent);
    if (n >= -MAX_EXACT_EXPONENT && n <= MAX_EXACT_EXPONENT) {
      return checkedPow(floatPowInt(base, n), base, exponent);
    }
  }
  if (exponent === 0.5 && base > 0) return float(Math.sqrt(base));
  if (base === 0 && exponent < 0) {
    throw new PyError("ZeroDivisionError", "0.0 cannot be raised to a negative power");
  }
  if (base < 0 && Number.isFinite(exponent) && !Number.isInteger(exponent)) {
    throw new UnsupportedError("complex numbers (a negative number to a fractional power)");
  }
  return checkedPow(base ** exponent, base, exponent);
}

/** A float result of `**`; CPython raises an OverflowError where JavaScript gives infinity. */
function checkedPow(result: number, base: number, exponent: number): PyValue {
  if (!Number.isFinite(result) && Number.isFinite(base) && Number.isFinite(exponent)) {
    throw new PyError("OverflowError", "(34, 'Numerical result out of range')");
  }
  return float(result);
}

function arithmetic(op: string, a: PyValue, b: PyValue): PyValue {
  const x = asNum(a);
  const y = asNum(b);
  if (x && y) {
    const anyFloat = x.float || y.float;
    switch (op) {
      case "+":
        return anyFloat
          ? float(toFloat(x) + toFloat(y))
          : int((x as { i: bigint }).i + (y as { i: bigint }).i);
      case "-":
        return anyFloat
          ? float(toFloat(x) - toFloat(y))
          : int((x as { i: bigint }).i - (y as { i: bigint }).i);
      case "*":
        return anyFloat
          ? float(toFloat(x) * toFloat(y))
          : int((x as { i: bigint }).i * (y as { i: bigint }).i);
      case "/": {
        if (!anyFloat) return float(trueDivInt((x as { i: bigint }).i, (y as { i: bigint }).i));
        const d = toFloat(y);
        if (d === 0) throw new PyError("ZeroDivisionError", "division by zero");
        return float(toFloat(x) / d);
      }
      case "//": {
        if (!anyFloat) return int(floorDivInt((x as { i: bigint }).i, (y as { i: bigint }).i));
        const d = toFloat(y);
        if (d === 0) throw new PyError("ZeroDivisionError", "float floor division by zero");
        return float(floorDivFloat(toFloat(x), d));
      }
      case "%":
        return anyFloat
          ? float(modFloat(toFloat(x), toFloat(y)))
          : int(modInt((x as { i: bigint }).i, (y as { i: bigint }).i));
      case "**":
        return power(x, y);
    }
  }
  if (op === "+") {
    if (a.type === "str" && b.type === "str") return str(a.value + b.value);
    if (a.type === "list" && b.type === "list") {
      return list([...a.obj.elements, ...b.obj.elements]);
    }
  }
  if (op === "*") {
    const [seq, count] = a.type === "str" || a.type === "list" ? [a, b] : [b, a];
    const n = asNum(count);
    if ((seq.type === "str" || seq.type === "list") && n && !n.float) {
      if (seq.type === "str") return str(seq.value.repeat(repeatCount(n.i, seq.value.length)));
      const times = repeatCount(n.i, seq.obj.elements.length);
      const elements: PyValue[] = [];
      for (let k = 0; k < times; k++) elements.push(...seq.obj.elements);
      return list(elements);
    }
  }
  if (op === "%" && a.type === "str") throw new UnsupportedError("formatting a string with %");
  throw unsupported(op, a, b);
}

export function binaryOp(op: string, a: PyValue, b: PyValue): PyValue {
  switch (op) {
    case "+":
    case "-":
    case "*":
    case "/":
    case "//":
    case "%":
    case "**":
      return arithmetic(op, a, b);
    case "==":
      return bool(pyEquals(a, b));
    case "!=":
      return bool(!pyEquals(a, b));
    case "<":
    case "<=":
    case ">":
    case ">=": {
      const c = order(op, a, b);
      if (c === null) return bool(false);
      return bool(op === "<" ? c < 0 : op === "<=" ? c <= 0 : op === ">" ? c > 0 : c >= 0);
    }
    case "is":
      return bool(pyIs(a, b));
    case "is not":
      return bool(!pyIs(a, b));
    case "in":
      return bool(contains(b, a));
    case "not in":
      return bool(!contains(b, a));
    default:
      throw new UnsupportedError(`the operator ${op}`);
  }
}

export function unaryOp(op: string, a: PyValue): PyValue {
  if (op === "not") return bool(!truthy(a));
  const n = asNum(a);
  if (op === "-" && n) return n.float ? float(-n.f) : int(-n.i);
  if (op === "+" && n) return n.float ? float(n.f) : int(n.i);
  if (op === "~" && n && !n.float) return int(-n.i - 1n);
  throw new PyError("TypeError", `bad operand type for unary ${op}: '${typeName(a)}'`);
}

/* -------------------------------------------------------------------------- */
/*                              Subscripts, iteration                         */
/* -------------------------------------------------------------------------- */

function indexOf(container: PyValue, index: PyValue, noun: string): bigint {
  const n = asNum(index);
  if (!n || n.float) {
    throw new PyError(
      "TypeError",
      `${noun} indices must be integers or slices, not ${typeName(index)}`,
    );
  }
  return n.i;
}

export function getItem(container: PyValue, index: PyValue): PyValue {
  switch (container.type) {
    case "list": {
      const items = container.obj.elements;
      let i = indexOf(container, index, "list");
      if (i < 0n) i += BigInt(items.length);
      if (i < 0n || i >= BigInt(items.length))
        throw new PyError("IndexError", "list index out of range");
      return items[Number(i)];
    }
    case "str": {
      const chars = Array.from(container.value);
      let i = indexOf(container, index, "string");
      if (i < 0n) i += BigInt(chars.length);
      if (i < 0n || i >= BigInt(chars.length))
        throw new PyError("IndexError", "string index out of range");
      return str(chars[Number(i)]);
    }
    case "range": {
      const length = rangeLength(container);
      let i = indexOf(container, index, "range");
      if (i < 0n) i += length;
      if (i < 0n || i >= length) throw new PyError("IndexError", "range object index out of range");
      return int(rangeAt(container, i));
    }
    default:
      throw new PyError("TypeError", `'${typeName(container)}' object is not subscriptable`);
  }
}

export function setItem(container: PyValue, index: PyValue, value: PyValue): void {
  if (container.type !== "list") {
    throw new PyError(
      "TypeError",
      `'${typeName(container)}' object does not support item assignment`,
    );
  }
  const items = container.obj.elements;
  let i = indexOf(container, index, "list");
  if (i < 0n) i += BigInt(items.length);
  if (i < 0n || i >= BigInt(items.length)) {
    throw new PyError("IndexError", "list assignment index out of range");
  }
  items[Number(i)] = value;
}

/** The `pos`th element that iterating over `v` gives, or undefined at its end. A list is read live. */
export function iterAt(v: PyValue, pos: number): PyValue | undefined {
  switch (v.type) {
    case "list":
      return pos < v.obj.elements.length ? v.obj.elements[pos] : undefined;
    case "str": {
      const chars = Array.from(v.value);
      return pos < chars.length ? str(chars[pos]) : undefined;
    }
    case "range":
      return BigInt(pos) < rangeLength(v) ? int(rangeAt(v, BigInt(pos))) : undefined;
    default:
      throw new PyError("TypeError", `'${typeName(v)}' object is not iterable`);
  }
}

/** All the elements of an iterable. */
export function elementsOf(v: PyValue): PyValue[] {
  const out: PyValue[] = [];
  for (let pos = 0; ; pos++) {
    const e = iterAt(v, pos);
    if (e === undefined) return out;
    out.push(e);
  }
}

/**
 * `a op= b`: like the operator, except that a list is changed in place by `+=` (which takes any
 * iterable) and `*=`, and stays the same object.
 */
export function inplaceOp(op: string, a: PyValue, b: PyValue): PyValue {
  if (a.type === "list" && op === "+") {
    const added = elementsOf(b);
    a.obj.elements.push(...added);
    return a;
  }
  if (a.type === "list" && op === "*") {
    const n = asNum(b);
    if (n && !n.float) {
      const times = repeatCount(n.i, a.obj.elements.length);
      const copy = [...a.obj.elements];
      a.obj.elements.length = 0;
      for (let k = 0; k < times; k++) a.obj.elements.push(...copy);
      return a;
    }
  }
  return binaryOp(op, a, b);
}
