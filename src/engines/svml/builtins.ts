import type { SVMLBoxType } from "./types";
import { isSVMLObject } from "./types";
import { MissingRequiredPositionalError, SVMLInterpreterError } from "./errors";

// Map Python builtin names to SVML primitive opcode indices
export const PRIMITIVE_FUNCTIONS: Map<string, number> = new Map([
  ["print", 5],
  ["display", 5], // Alias for print
  ["abs", 10],
  ["min", 20],
  ["max", 21],
  ["pow", 22],
  ["sqrt", 23],
  ["floor", 24],
  ["ceil", 25],
  ["round", 26],
  ["range", 30],
  ["len", 31],
]);

function assertNumericArgs(args: SVMLBoxType[], fn: string): number[] {
  if (!args.every(a => typeof a === "number"))
    throw new SVMLInterpreterError(`TypeError: ${fn}() requires numeric arguments`);
  return args;
}

/**
 * Execute a primitive function.
 * Called by the TypeScript interpreter for primitive operations.
 */
export function executePrimitive(
  primitiveIndex: number,
  args: SVMLBoxType[],
  sendOutput: (message: string) => void,
): SVMLBoxType {
  switch (primitiveIndex) {
    case 5: // print/display
      sendOutput(args.join(" "));
      return undefined;

    case 10: {
      // abs
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("abs() takes exactly 1 argument");
      const [x] = assertNumericArgs(args, "abs");
      return Math.abs(x);
    }

    case 20: {
      // min
      if (args.length === 0)
        throw new MissingRequiredPositionalError("min() requires at least 1 argument");
      return Math.min(...assertNumericArgs(args, "min"));
    }

    case 21: {
      // max
      if (args.length === 0)
        throw new MissingRequiredPositionalError("max() requires at least 1 argument");
      return Math.max(...assertNumericArgs(args, "max"));
    }

    case 22: {
      // pow
      if (args.length !== 2)
        throw new MissingRequiredPositionalError("pow() takes exactly 2 arguments");
      const [base, exp] = assertNumericArgs(args, "pow");
      return Math.pow(base, exp);
    }

    case 23: {
      // sqrt
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("sqrt() takes exactly 1 argument");
      const [n] = assertNumericArgs(args, "sqrt");
      return Math.sqrt(n);
    }

    case 24: {
      // floor
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("floor() takes exactly 1 argument");
      const [n] = assertNumericArgs(args, "floor");
      return Math.floor(n);
    }

    case 25: {
      // ceil
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("ceil() takes exactly 1 argument");
      const [n] = assertNumericArgs(args, "ceil");
      return Math.ceil(n);
    }

    case 26: {
      // round
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("round() takes exactly 1 argument");
      const [n] = assertNumericArgs(args, "round");
      return Math.round(n);
    }

    case 30: {
      // range
      const [a, b, c] = assertNumericArgs(args, "range");
      const [start, stop, step] =
        args.length === 1 ? [0, a, 1] : args.length === 2 ? [a, b, 1] : [a, b, c];
      return { type: "iterator", kind: "range", current: start, stop, step };
    }

    case 31: {
      // len
      const v = args[0];
      if (isSVMLObject(v) && v.type === "array") return v.elements.length;
      throw new SVMLInterpreterError("TypeError: object of type is not subscriptable");
    }

    default:
      throw new SVMLInterpreterError(`Unknown primitive function index: ${primitiveIndex}`);
  }
}
