/**
 * The values of the full e-stepper: Python's own, not the CSE machine's. The CSE machine's values and
 * operators encode the restrictions of the sublanguages (for example, a list index must be an integer
 * from 0 on, and `==` rejects booleans in Python §1 and §2); full Python has none of them, and its
 * operators have to behave as CPython's. See docs/full-e-stepper.md.
 *
 * Values that are objects with an identity (lists, function objects) point to a heap object; the
 * others are immutable and compared by value.
 */

import type { ExprNS, StmtNS } from "../../ast-types";
import { PyError } from "./errors";

export type PyValue =
  | { type: "int"; value: bigint }
  | { type: "float"; value: number }
  | { type: "bool"; value: boolean }
  | { type: "str"; value: string }
  | { type: "none" }
  | { type: "list"; obj: ListObj }
  | { type: "function"; obj: FunctionObj }
  | { type: "builtin"; name: string }
  | { type: "range"; start: bigint; stop: bigint; step: bigint };

export interface ListObj {
  kind: "list";
  elements: PyValue[];
}

/** What static analysis says about the names of a function body; see scope.ts. */
export interface ScopeInfo {
  /** Parameters, and the names that the body assigns (and is not told by `global`/`nonlocal`). */
  locals: Set<string>;
  globals: Set<string>;
  nonlocals: Set<string>;
}

export interface FunctionObj {
  kind: "function";
  /** `def`'s name, or `lambda`. */
  name: string;
  params: string[];
  src: StmtNS.FunctionDef | ExprNS.Lambda;
  /** The frame the function was defined in: the parent of every frame of a call. */
  closure: Frame;
  scope: ScopeInfo;
}

export type HeapObj = ListObj | FunctionObj;

/** A local that has been declared by static analysis and not assigned yet. */
export const UNASSIGNED = Symbol("unassigned");
export type Slot = PyValue | typeof UNASSIGNED;

/**
 * A frame. The module frame ("Global") grows as names are assigned; the frame of a call has all its
 * locals from the start (unassigned until assigned), as in the e-stepper for Python §3/§4. The
 * parent of a call's frame is the frame of the function's definition, and the parent of the module
 * frame is the frame of the built-ins.
 */
export interface Frame {
  id: number;
  name: string;
  parent: Frame | null;
  vars: Map<string, Slot>;
  /** For a call's frame: the scope of its function body. */
  scope: ScopeInfo | null;
  kind: "builtins" | "module" | "call";
}

export const NONE: PyValue = { type: "none" };
export const TRUE: PyValue = { type: "bool", value: true };
export const FALSE: PyValue = { type: "bool", value: false };

export const int = (value: bigint | number): PyValue => ({
  type: "int",
  value: BigInt(value),
});
export const float = (value: number): PyValue => ({ type: "float", value });
export const bool = (value: boolean): PyValue => (value ? TRUE : FALSE);
export const str = (value: string): PyValue => ({ type: "str", value });
export const list = (elements: PyValue[]): PyValue => ({
  type: "list",
  obj: { kind: "list", elements },
});

/** The name that CPython gives the type of a value, as in `type(x).__name__`. */
export function typeName(v: PyValue): string {
  switch (v.type) {
    case "int":
      return "int";
    case "float":
      return "float";
    case "bool":
      return "bool";
    case "str":
      return "str";
    case "none":
      return "NoneType";
    case "list":
      return "list";
    case "function":
      return "function";
    case "builtin":
      return "builtin_function_or_method";
    case "range":
      return "range";
  }
}

/** Python's truth value of a value. */
export function truthy(v: PyValue): boolean {
  switch (v.type) {
    case "int":
      return v.value !== 0n;
    case "float":
      return v.value !== 0;
    case "bool":
      return v.value;
    case "str":
      return v.value.length > 0;
    case "none":
      return false;
    case "list":
      return v.obj.elements.length > 0;
    case "range":
      return rangeLength(v) > 0n;
    case "function":
    case "builtin":
      return true;
  }
}

export function rangeLength(r: { start: bigint; stop: bigint; step: bigint }): bigint {
  if (r.step > 0n) return r.start < r.stop ? (r.stop - r.start + r.step - 1n) / r.step : 0n;
  return r.start > r.stop ? (r.start - r.stop - r.step - 1n) / -r.step : 0n;
}

/** The `index`th element of a range (0 ≤ index < length). */
export function rangeAt(r: { start: bigint; step: bigint }, index: bigint): bigint {
  return r.start + index * r.step;
}

/* -------------------------------------------------------------------------- */
/*                                  repr, str                                 */
/* -------------------------------------------------------------------------- */

/** CPython refuses to turn an int of more than this many decimal digits into a string. */
const MAX_INT_DIGITS = 4300;

function intRepr(value: bigint): string {
  const text = value.toString();
  if (text.replace("-", "").length > MAX_INT_DIGITS) {
    throw new PyError(
      "ValueError",
      `Exceeds the limit (${MAX_INT_DIGITS} digits) for integer string conversion`,
    );
  }
  return text;
}

/**
 * An int as a trace shows it: all digits, except for an int that `repr` refuses (the program may
 * hold such a number without ever converting it), which is shortened.
 */
function intDisplay(value: bigint): string {
  // TODO(#591): this converts every digit at every step of a trace; cache the display, or count
  // the digits from the bit length and take only the leading ones.
  const text = value.toString();
  const digits = text.replace("-", "").length;
  if (digits <= MAX_INT_DIGITS) return text;
  return `${text.slice(0, text.startsWith("-") ? 7 : 6)}…(${digits} digits)`;
}

const pointCache = new Map<string, string[]>();
let cachedPoints = 0;
/** The most characters the cache keeps (it is emptied at the end of each run as well). */
const MAX_CACHED_POINTS = 8_000_000;

/** Strings too long for the cache above, kept while a traversal of them may be going on. */
const largeCache = new Map<string, string[]>();
const MAX_LARGE_STRINGS = 4;

export function clearStringCache(): void {
  pointCache.clear();
  cachedPoints = 0;
  largeCache.clear();
}

/** The characters of a string, by code point; a few strings are kept, for nested loops over them. */
export function codePoints(text: string): string[] {
  let points = pointCache.get(text);
  if (points) return points;
  points = largeCache.get(text);
  if (points) return points;
  points = Array.from(text);
  if (points.length > MAX_CACHED_POINTS) {
    // Too long for the cache, but a traversal of it needs it for as long as it lasts (and loops
    // may be nested: the last few are kept).
    if (largeCache.size >= MAX_LARGE_STRINGS) {
      largeCache.delete(largeCache.keys().next().value as string);
    }
    largeCache.set(text, points);
    return points;
  }
  while (pointCache.size > 0 && cachedPoints + points.length > MAX_CACHED_POINTS) {
    const oldest = pointCache.keys().next().value as string;
    cachedPoints -= (pointCache.get(oldest) as string[]).length;
    pointCache.delete(oldest);
  }
  pointCache.set(text, points);
  cachedPoints += points.length;
  return points;
}

/** A string as a trace shows it: all of it, unless it is long (the trace shows it at every step). */
function strDisplay(text: string): string {
  if (text.length <= 200) return strRepr(text);
  const points = codePoints(text);
  if (points.length <= 200) return strRepr(text);
  return `${strRepr(points.slice(0, 100).join(""))}…(${points.length} characters)`;
}

/** `repr` of a float, as CPython writes it (`1e-05`, `1e+16`, `3.0`, `inf`, `nan`). */
export function floatRepr(x: number): string {
  if (Number.isNaN(x)) return "nan";
  if (x === Infinity) return "inf";
  if (x === -Infinity) return "-inf";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  // The shortest digits that read back as x, and the decimal exponent, from JavaScript's own.
  const [mantissa, exponentText] = x.toExponential().split("e");
  const negative = mantissa.startsWith("-");
  const digits = mantissa.replace("-", "").replace(".", "");
  const exponent = Number(exponentText);
  let text: string;
  if (exponent < -4 || exponent >= 16) {
    const fraction = digits.length > 1 ? `.${digits.slice(1)}` : "";
    const sign = exponent < 0 ? "-" : "+";
    text = `${digits[0]}${fraction}e${sign}${String(Math.abs(exponent)).padStart(2, "0")}`;
  } else if (exponent < 0) {
    text = `0.${"0".repeat(-exponent - 1)}${digits}`;
  } else if (digits.length <= exponent + 1) {
    text = `${digits}${"0".repeat(exponent + 1 - digits.length)}.0`;
  } else {
    text = `${digits.slice(0, exponent + 1)}.${digits.slice(exponent + 1)}`;
  }
  return negative ? `-${text}` : text;
}

/** The characters that Python's `repr` escapes: control, format, surrogate, private-use, unassigned, and separators other than the space. */
const NOT_PRINTABLE = /^[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}\p{Zs}]$/u;

function escapeChar(code: number): string {
  if (code < 0x100) return `\\x${code.toString(16).padStart(2, "0")}`;
  if (code < 0x10000) return `\\u${code.toString(16).padStart(4, "0")}`;
  return `\\U${code.toString(16).padStart(8, "0")}`;
}

/** `repr` of a string: single quotes, unless the string has a single quote and no double quote. */
export function strRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = quote;
  for (const ch of s) {
    const code = ch.codePointAt(0) as number;
    if (ch === quote || ch === "\\") out += `\\${ch}`;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (code < 0x20 || code === 0x7f || (ch !== " " && NOT_PRINTABLE.test(ch)))
      out += escapeChar(code);
    else out += ch;
  }
  return out + quote;
}

/** `repr(v)`; the elements of a list are shown by their `repr`, a list that contains itself as `[...]`. */
export function repr(v: PyValue, seen: Set<ListObj> = new Set(), display = false): string {
  switch (v.type) {
    case "int":
      return display ? intDisplay(v.value) : intRepr(v.value);
    case "float":
      return floatRepr(v.value);
    case "bool":
      return v.value ? "True" : "False";
    case "str":
      return display ? strDisplay(v.value) : strRepr(v.value);
    case "none":
      return "None";
    case "list": {
      if (seen.has(v.obj)) return "[...]";
      seen.add(v.obj);
      const text = `[${v.obj.elements.map(e => repr(e, seen, display)).join(", ")}]`;
      seen.delete(v.obj);
      return text;
    }
    case "function":
      return `<function ${v.obj.name}>`;
    case "builtin":
      return `<built-in function ${v.name}>`;
    case "range": {
      const n = (i: bigint): string => (display ? intDisplay(i) : intRepr(i));
      return v.step === 1n
        ? `range(${n(v.start)}, ${n(v.stop)})`
        : `range(${n(v.start)}, ${n(v.stop)}, ${n(v.step)})`;
    }
  }
}

/** `str(v)`: a string is itself, anything else as its `repr`. */
export function toStr(v: PyValue): string {
  return v.type === "str" ? v.value : repr(v);
}
