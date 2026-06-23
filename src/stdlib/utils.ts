import { ExprNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { handleRuntimeError } from "../engines/cse/error";
import { Value } from "../engines/cse/stash";
import { MissingRequiredPositionalError, TooManyPositionalArgumentsError } from "../errors";
import { stringify } from "../utils/stringify";

export enum GroupName {
  MATH = "math",
  MISC = "misc",
  LINKED_LISTS = "linked-list",
  STREAMS = "stream",
  LIST = "list",
  PAIRMUTATORS = "pair-mutators",
  MCE = "mce",
}

/**
 * A Group represents a library of related built-in values (e.g., linked list library, stream library).
 * It consists of primitive built-in values implemented in TypeScript, as well as a prelude of non-primitive built-in values
 * evaluated in Python using the current evaluator
 */
export type Group = {
  name: GroupName;

  /**
   * The prelude is a string of code that defines the non-primitive built-in values in this group.
   * It is loaded before any user code is run, so that the built-in values are available to the user code.
   * The execution of functions is performed using the current evaluator, so the prelude can use other built-in values defined in other groups.
   */
  prelude: string;

  /**
   * The builtins are primitive built-in values implemented in TypeScript. They are to provide functionalities that are not easily implemented in the required sublanguage of Python,
   * such as variadic functions in Python §2 (e.g., `linked_list`)
   *
   * They are stored as a map from the name of the built-in value to its corresponding implementation.
   */
  builtins: Map<string, Value>;
};

export const minArgMap = new Map<string, number>();

export function Validate<T extends Value | undefined | Promise<Value | undefined>>(
  minArgs: number | null,
  maxArgs: number | null,
  functionName: string,
  strict: boolean,
) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<
      (args: Value[], source: string, command: ExprNS.Call, context: Context) => T
    >,
  ): void {
    const originalMethod = descriptor.value!;
    minArgMap.set(functionName, minArgs || 0);
    descriptor.value = function (
      args: Value[],
      source: string,
      command: ExprNS.Call,
      context: Context,
    ): T {
      if (minArgs !== null && args.length < minArgs) {
        handleRuntimeError(
          context,
          new MissingRequiredPositionalError(source, command, functionName, minArgs, args, strict),
        );
      }

      if (maxArgs !== null && args.length > maxArgs) {
        handleRuntimeError(
          context,
          new TooManyPositionalArgumentsError(source, command, functionName, maxArgs, args, strict),
        );
      }

      return originalMethod.call(this, args, source, command, context);
    };
  };
}

/**
 * Converts a number to a string that mimics Python's float formatting behavior.
 *
 * In Python, float values are printed in scientific notation when their absolute value
 * is ≥ 1e16 or < 1e-4. This differs from JavaScript/TypeScript's default behavior,
 * so we explicitly enforce these formatting thresholds.
 *
 * The logic here is based on Python's internal `format_float_short` implementation
 * in CPython's `pystrtod.c`:
 * https://github.com/python/cpython/blob/main/Python/pystrtod.c
 *
 * Special cases such as -0, Infinity, and NaN are also handled to ensure that
 * output matches Python’s display conventions.
 */
export function toPythonFloat(num: number): string {
  if (Object.is(num, -0)) {
    return "-0.0";
  }
  if (num === 0) {
    return "0.0";
  }

  if (num === Infinity) {
    return "inf";
  }
  if (num === -Infinity) {
    return "-inf";
  }

  if (Number.isNaN(num)) {
    return "nan";
  }

  if (Math.abs(num) >= 1e16 || (num !== 0 && Math.abs(num) < 1e-4)) {
    return num.toExponential().replace(/e([+-])(\d)$/, "e$10$2");
  }
  if (Number.isInteger(num)) {
    return num.toFixed(1).toString();
  }
  return num.toString();
}
function escape(str: string): string {
  let escaped = JSON.stringify(str);
  if (!(str.includes("'") && !str.includes('"'))) {
    escaped = `'${escaped.slice(1, -1).replace(/'/g, "\\'").replace(/\\"/g, '"')}'`;
  }
  return escaped;
}
function toPythonList(obj: Value): string {
  return stringify(obj);
}

export function toPythonString(obj: Value, repr: boolean = false): string {
  let ret: string = "";
  if (obj.type == "builtin") {
    return `<built-in function ${obj.name}>`;
  }
  if (obj.type === "bigint" || obj.type === "complex") {
    ret = obj.value.toString();
  } else if (obj.type === "number") {
    ret = toPythonFloat(obj.value);
  } else if (obj.type === "bool") {
    if (obj.value) {
      return "True";
    } else {
      return "False";
    }
  } else if (obj.type === "error") {
    return obj.message;
  } else if (obj.type === "closure") {
    if (obj.closure.node) {
      const funcName =
        obj.closure.node.kind === "FunctionDef" ? obj.closure.node.name.lexeme : "(anonymous)";
      return `<function ${funcName}>`;
    }
  } else if (obj.type === "none") {
    ret = "None";
  } else if (obj.type === "string") {
    ret = repr ? escape(obj.value) : obj.value;
  } else if (obj.type === "function") {
    const funcName = obj.name || "(anonymous)";
    ret = `<function ${funcName}>`;
  } else if (obj.type === "list") {
    ret = toPythonList(obj);
  } else {
    ret = `<${obj.type} object>`;
  }
  return ret;
}
