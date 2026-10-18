/**
 * The built-in functions of the full e-stepper that the first slice has: `print`, `len`, `range`,
 * `abs`, `min`, `max`, `str`, `int`, `float`, `bool`, `list`. Their results and errors follow CPython.
 */

import { PyError } from "./errors";
import { binaryOp, codePoints, elementsOf } from "./operators";
import {
  FALSE,
  NONE,
  bool,
  float,
  int,
  list,
  rangeLength,
  repr,
  str,
  strRepr,
  toStr,
  truthy,
  typeName,
  type PyValue,
} from "./values";

export interface Output {
  write(text: string): void;
}

type Builtin = (args: PyValue[], out: Output) => PyValue;

function exactly(name: string, args: PyValue[], n: number): void {
  if (args.length !== n) {
    throw new PyError(
      "TypeError",
      n === 1
        ? `${name}() takes exactly one argument (${args.length} given)`
        : `${name}() takes exactly ${n} arguments (${args.length} given)`,
    );
  }
}

/** An int or a bool as a bigint, for the arguments that have to be integers. */
function asInteger(v: PyValue): bigint {
  if (v.type === "int") return v.value;
  if (v.type === "bool") return v.value ? 1n : 0n;
  throw new PyError("TypeError", `'${typeName(v)}' object cannot be interpreted as an integer`);
}

/**
 * The whitespace that the numeric conversions of Python skip. It is not JavaScript's (no U+FEFF), and
 * not that of `str.isspace()` (not the separators \\x1c to \\x1f).
 */
const PY_SPACE =
  "\\t\\n\\v\\f\\r \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const PY_STRIP = new RegExp(`^[${PY_SPACE}]+|[${PY_SPACE}]+$`, "g");
function pyStrip(text: string): string {
  return text.replace(PY_STRIP, "");
}

/** Python reads the decimal digits of every script (`int('١٢')` is 12); this turns them into ASCII. */
function asciiDigits(text: string): string {
  return text.replace(/\p{Nd}/gu, ch => {
    // The decimal digits come in runs of ten, starting at the zero.
    let zero = ch.codePointAt(0) as number;
    while (/^\p{Nd}$/u.test(String.fromCodePoint(zero - 1))) zero--;
    return String(((ch.codePointAt(0) as number) - zero) % 10);
  });
}

function intFromString(text: string): PyValue {
  const t = asciiDigits(pyStrip(text));
  if (/^[+-]?\d+(_\d+)*$/.test(t)) {
    const digits = t.replace(/[+\-_]/g, "").length;
    if (digits > 4300) {
      throw new PyError(
        "ValueError",
        `Exceeds the limit (4300 digits) for integer string conversion: value has ${digits} digits`,
      );
    }
    return int(BigInt(t.replace(/_/g, "")));
  }
  throw new PyError("ValueError", `invalid literal for int() with base 10: ${strRepr(text)}`);
}

/** `int(text, base)`: the base is 0 (the prefix decides) or 2 to 36; digits and letters, `_` between digits. */
function intWithBase(v: PyValue, baseValue: PyValue): PyValue {
  if (v.type !== "str") {
    throw new PyError("TypeError", "int() can't convert non-string with explicit base");
  }
  const base = Number(asInteger(baseValue));
  if (!(base === 0 || (base >= 2 && base <= 36))) {
    throw new PyError("ValueError", "int() base must be >= 2 and <= 36, or 0");
  }
  const invalid = () =>
    new PyError("ValueError", `invalid literal for int() with base ${base}: ${strRepr(v.value)}`);
  let t = asciiDigits(pyStrip(v.value));
  let negative = false;
  if (t.startsWith("-") || t.startsWith("+")) {
    negative = t[0] === "-";
    t = t.slice(1);
  }
  let radix = base;
  const prefix = /^0([xob])/i.exec(t);
  const prefixBase = prefix ? { x: 16, o: 8, b: 2 }[prefix[1].toLowerCase() as "x" | "o" | "b"] : 0;
  if (prefix && (base === 0 || base === prefixBase)) {
    radix = prefixBase;
    t = t.slice(2);
    if (t.startsWith("_")) t = t.slice(1);
  } else if (base === 0) {
    radix = 10;
    // No leading zeros without a prefix, except for zero itself.
    if (/^0[0-9_]*[1-9]/.test(t)) throw invalid();
  }
  if (t === "" || t.startsWith("_") || t.endsWith("_") || t.includes("__")) throw invalid();
  const digits = t.replace(/_/g, "");
  // Refuse too many digits before the work is done (a power of two as base has no limit).
  if ((radix & (radix - 1)) !== 0 && digits.length > 4300) {
    throw new PyError(
      "ValueError",
      `Exceeds the limit (4300 digits) for integer string conversion: value has ${digits.length} digits`,
    );
  }
  let value = 0n;
  for (const ch of digits) {
    const d = parseInt(ch, 36);
    if (Number.isNaN(d) || d >= radix) throw invalid();
    value = value * BigInt(radix) + BigInt(d);
  }
  return int(negative ? -value : value);
}

function floatFromString(text: string): PyValue {
  const t = asciiDigits(pyStrip(text)).toLowerCase();
  const special = /^([+-]?)(inf|infinity|nan)$/.exec(t);
  if (special) {
    if (special[2] === "nan") return float(NaN);
    return float(special[1] === "-" ? -Infinity : Infinity);
  }
  const digits = "\\d+(?:_\\d+)*";
  const pattern = new RegExp(
    `^[+-]?(?:${digits}(?:\\.(?:${digits})?)?|\\.${digits})(?:e[+-]?${digits})?$`,
  );
  if (pattern.test(t)) return float(Number(t.replace(/_/g, "")));
  throw new PyError("ValueError", `could not convert string to float: '${text}'`);
}

const BUILTINS: Record<string, Builtin> = {
  print(args, out) {
    // Python writes the arguments one by one, so what comes before a failing conversion is out.
    args.forEach((arg, i) => {
      if (i > 0) out.write(" ");
      out.write(toStr(arg));
    });
    out.write("\n");
    return NONE;
  },

  len(args) {
    exactly("len", args, 1);
    const [v] = args;
    switch (v.type) {
      case "list":
        return int(v.obj.elements.length);
      case "str":
        return int(codePoints(v.value).length);
      case "range": {
        const length = rangeLength(v);
        if (length > 9223372036854775807n) {
          throw new PyError("OverflowError", "Python int too large to convert to C ssize_t");
        }
        return int(length);
      }
      default:
        throw new PyError("TypeError", `object of type '${typeName(v)}' has no len()`);
    }
  },

  range(args) {
    if (args.length === 0)
      throw new PyError("TypeError", "range expected at least 1 argument, got 0");
    if (args.length > 3) {
      throw new PyError("TypeError", `range expected at most 3 arguments, got ${args.length}`);
    }
    const ints = args.map(asInteger);
    const [start, stop, step] =
      ints.length === 1 ? [0n, ints[0], 1n] : [ints[0], ints[1], ints[2] ?? 1n];
    if (step === 0n) throw new PyError("ValueError", "range() arg 3 must not be zero");
    return { type: "range", start, stop, step };
  },

  abs(args) {
    exactly("abs", args, 1);
    const [v] = args;
    if (v.type === "int") return int(v.value < 0n ? -v.value : v.value);
    if (v.type === "bool") return int(v.value ? 1n : 0n);
    if (v.type === "float") return float(Math.abs(v.value));
    throw new PyError("TypeError", `bad operand type for abs(): '${typeName(v)}'`);
  },

  str(args) {
    if (args.length > 1)
      throw new PyError("TypeError", `str() takes at most 3 arguments (${args.length} given)`);
    return str(args.length === 0 ? "" : toStr(args[0]));
  },

  int(args) {
    if (args.length === 0) return int(0);
    if (args.length > 2)
      throw new PyError("TypeError", `int() takes at most 2 arguments (${args.length} given)`);
    if (args.length === 2) return intWithBase(args[0], args[1]);
    const [v] = args;
    switch (v.type) {
      case "int":
        return v;
      case "bool":
        return int(v.value ? 1 : 0);
      case "float":
        if (Number.isNaN(v.value))
          throw new PyError("ValueError", "cannot convert float NaN to integer");
        if (!Number.isFinite(v.value)) {
          throw new PyError("OverflowError", "cannot convert float infinity to integer");
        }
        return int(BigInt(Math.trunc(v.value)));
      case "str":
        return intFromString(v.value);
      default:
        throw new PyError(
          "TypeError",
          `int() argument must be a string, a bytes-like object or a real number, not '${typeName(v)}'`,
        );
    }
  },

  float(args) {
    if (args.length === 0) return float(0);
    if (args.length > 1)
      throw new PyError("TypeError", `float expected at most 1 argument, got ${args.length}`);
    const [v] = args;
    switch (v.type) {
      case "float":
        return v;
      case "int": {
        const f = Number(v.value);
        if (!Number.isFinite(f))
          throw new PyError("OverflowError", "int too large to convert to float");
        return float(f);
      }
      case "bool":
        return float(v.value ? 1 : 0);
      case "str":
        return floatFromString(v.value);
      default:
        throw new PyError(
          "TypeError",
          `float() argument must be a string or a real number, not '${typeName(v)}'`,
        );
    }
  },

  repr(args) {
    exactly("repr", args, 1);
    return str(repr(args[0]));
  },

  bool(args) {
    if (args.length > 1)
      throw new PyError("TypeError", `bool expected at most 1 argument, got ${args.length}`);
    return args.length === 0 ? FALSE : bool(truthy(args[0]));
  },

  list(args) {
    if (args.length > 1)
      throw new PyError("TypeError", `list expected at most 1 argument, got ${args.length}`);
    return list(args.length === 0 ? [] : elementsOf(args[0]));
  },

  min: args => extremum("min", "<", args),
  max: args => extremum("max", ">", args),
};

function extremum(name: string, better: "<" | ">", args: PyValue[]): PyValue {
  if (args.length === 0)
    throw new PyError("TypeError", `${name} expected at least 1 argument, got 0`);
  const candidates = args.length === 1 ? elementsOf(args[0]) : args;
  if (candidates.length === 0)
    throw new PyError("ValueError", `${name}() arg is an empty sequence`);
  let best = candidates[0];
  for (const c of candidates.slice(1)) {
    if (truthy(binaryOp(better, c, best))) best = c;
  }
  return best;
}

export const BUILTIN_NAMES: string[] = Object.keys(BUILTINS);

export function callBuiltin(name: string, args: PyValue[], out: Output): PyValue {
  const impl = BUILTINS[name];
  if (!impl) throw new PyError("NameError", `name '${name}' is not defined`);
  return impl(args, out);
}
