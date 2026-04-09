import type { SVMLBoxType } from "./types";
import { isSVMLObject } from "./types";

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

/**
 * Execute a primitive function
 * This is called by the TypeScript interpreter for primitive operations
 */
export function executePrimitive(
  primitiveIndex: number,
  args: SVMLBoxType[],
  sendOutput: (message: string) => void,
): SVMLBoxType {
  // Math primitives receive numeric args at runtime; cast at the boundary
  const numArgs = args as number[];
  switch (primitiveIndex) {
    case 5: // print/display
      sendOutput(args.join(" "));
      return undefined;

    case 10: // abs
      if (args.length !== 1) throw new Error("abs expects 1 argument");
      return Math.abs(numArgs[0]);

    case 20: // min
      if (args.length === 0) throw new Error("min expects at least 1 argument");
      return Math.min(...numArgs);

    case 21: // max
      if (args.length === 0) throw new Error("max expects at least 1 argument");
      return Math.max(...numArgs);

    case 22: // pow
      if (args.length !== 2) throw new Error("pow expects 2 arguments");
      return Math.pow(numArgs[0], numArgs[1]);

    case 23: // sqrt
      if (args.length !== 1) throw new Error("sqrt expects 1 argument");
      return Math.sqrt(numArgs[0]);

    case 24: // floor
      if (args.length !== 1) throw new Error("floor expects 1 argument");
      return Math.floor(numArgs[0]);

    case 25: // ceil
      if (args.length !== 1) throw new Error("ceil expects 1 argument");
      return Math.ceil(numArgs[0]);

    case 26: // round
      if (args.length !== 1) throw new Error("round expects 1 argument");
      return Math.round(numArgs[0]);

    case 30: {
      // range
      const [a, b, c] = numArgs;
      const [start, stop, step] =
        args.length === 1 ? [0, a, 1] : args.length === 2 ? [a, b, 1] : [a, b, c];
      return { type: "iterator", kind: "range", current: start, stop, step };
    }

    case 31: {
      // len
      const v = args[0];
      if (isSVMLObject(v) && v.type === "array") return v.elements.length;
      throw new Error("len() requires a list");
    }

    default:
      throw new Error(`Unknown primitive function index: ${primitiveIndex}`);
  }
}
