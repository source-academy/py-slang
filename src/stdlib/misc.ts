import { ExprNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { handleRuntimeError } from "../engines/cse/error";
import {
  BigIntValue,
  BoolValue,
  BuiltinValue,
  ComplexValue,
  NoneValue,
  NumberValue,
  StringValue,
  Value,
} from "../engines/cse/stash";
import { displayOutput, receiveInput } from "../engines/cse/streams";
import { isNumeric } from "../engines/cse/utils";
import { TypeError, UserError } from "../errors";
import { PyComplexNumber } from "../types";
import { GroupName, minArgMap, toPythonString, Validate } from "./utils";

const miscBuiltins = new Map<string, BuiltinValue>();

export class MiscBuiltins {
  @Validate(1, 1, "arity", true)
  static arity(args: Value[], source: string, command: ExprNS.Call, context: Context): BigIntValue {
    const func = args[0];
    if (func.type !== "builtin" && func.type !== "closure") {
      handleRuntimeError(context, new TypeError(source, command, context, func.type));
    }
    if (func.type === "closure") {
      const variadicInstance = func.closure.node.parameters.findIndex(param => param.isStarred);
      if (variadicInstance !== -1) {
        return { type: "bigint", value: BigInt(variadicInstance) };
      }
      return { type: "bigint", value: BigInt(func.closure.node.parameters.length) };
    }
    return { type: "bigint", value: BigInt(func.minArgs) };
  }

  @Validate(null, 2, "complex", true)
  static complex(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): ComplexValue {
    if (args.length === 0) {
      return { type: "complex", value: new PyComplexNumber(0, 0) };
    }
    if (args.length == 1) {
      const val = args[0];
      if (
        val.type !== "bigint" &&
        val.type !== "number" &&
        val.type !== "bool" &&
        val.type !== "string" &&
        val.type !== "complex"
      ) {
        handleRuntimeError(context, new TypeError(source, command, context, val.type));
      }
      return {
        type: "complex",
        value: PyComplexNumber.fromValue(context, source, command, val.value),
      };
    }
    const invalidType = args.filter(
      val =>
        val.type !== "bigint" &&
        val.type !== "number" &&
        val.type !== "bool" &&
        val.type !== "complex",
    );
    if (invalidType.length > 0) {
      handleRuntimeError(context, new TypeError(source, command, context, invalidType[0].type));
    }
    const [real, imag] = args as (BigIntValue | NumberValue | BoolValue | ComplexValue)[];
    const realPart = PyComplexNumber.fromValue(context, source, command, real.value);
    const imagPart = PyComplexNumber.fromValue(context, source, command, imag.value);
    return { type: "complex", value: realPart.add(imagPart.mul(new PyComplexNumber(0, 1))) };
  }

  @Validate(1, 1, "real", true)
  static real(args: Value[], source: string, command: ExprNS.Call, context: Context): NumberValue {
    const val = args[0];
    if (val.type !== "complex") {
      handleRuntimeError(context, new TypeError(source, command, context, val.type));
    }
    return { type: "number", value: val.value.real };
  }

  @Validate(1, 1, "imag", true)
  static imag(args: Value[], source: string, command: ExprNS.Call, context: Context): NumberValue {
    const val = args[0];
    if (val.type !== "complex") {
      handleRuntimeError(context, new TypeError(source, command, context, val.type));
    }
    return { type: "number", value: val.value.imag };
  }

  @Validate(1, 1, "abs", false)
  static abs(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): BigIntValue | NumberValue {
    const x = args[0];
    switch (x.type) {
      case "bigint": {
        const intVal = x.value;
        const result: bigint = intVal < 0 ? -intVal : intVal;
        return { type: "bigint", value: result };
      }
      case "number": {
        return { type: "number", value: Math.abs(x.value) };
      }
      case "complex": {
        // Calculate the modulus (absolute value) of a complex number.
        const real = x.value.real;
        const imag = x.value.imag;
        const modulus = Math.hypot(real, imag);
        return { type: "number", value: modulus };
      }
      default:
        handleRuntimeError(context, new TypeError(source, command, context, args[0].type));
    }
  }

  @Validate(1, 1, "len", true)
  static len(args: Value[], source: string, command: ExprNS.Call, context: Context): BigIntValue {
    const val = args[0];
    if (val.type === "string" || val.type === "list") {
      // The spread operator is used to count the number of Unicode code points
      // in the string
      return { type: "bigint", value: BigInt([...val.value].length) };
    }
    handleRuntimeError(context, new TypeError(source, command, context, val.type));
  }

  static error(args: Value[], _source: string, command: ExprNS.Call, context: Context): Value {
    const output = "Error: " + args.map(arg => toPythonString(arg)).join(" ") + "\n";
    handleRuntimeError(context, new UserError(output, command));
  }

  @Validate(2, null, "max", true)
  static max(args: Value[], source: string, command: ExprNS.Call, context: Context): Value {
    if (args.every(isNumeric) || args.every(arg => arg.type === "string")) {
      let maxIndex = 0;
      for (let i = 1; i < args.length; i++) {
        if (args[i].value > args[maxIndex].value) {
          maxIndex = i;
        }
      }
      return args[maxIndex];
    }
    if (isNumeric(args[0])) {
      const invalidType = args.find(arg => !isNumeric(arg))!;
      handleRuntimeError(context, new TypeError(source, command, context, invalidType.type));
    } else if (args[0].type === "string") {
      const invalidType = args.find(arg => arg.type !== "string")!;
      handleRuntimeError(context, new TypeError(source, command, context, invalidType.type));
    } else {
      handleRuntimeError(context, new TypeError(source, command, context, args[0].type));
    }
  }

  @Validate(2, null, "min", true)
  static min(args: Value[], source: string, command: ExprNS.Call, context: Context): Value {
    if (args.every(isNumeric) || args.every(arg => arg.type === "string")) {
      let minIndex = 0;
      for (let i = 1; i < args.length; i++) {
        if (args[i].value < args[minIndex].value) {
          minIndex = i;
        }
      }
      return args[minIndex];
    }
    if (isNumeric(args[0])) {
      const invalidType = args.find(arg => !isNumeric(arg))!;
      handleRuntimeError(context, new TypeError(source, command, context, invalidType.type));
    } else if (args[0].type === "string") {
      const invalidType = args.find(arg => arg.type !== "string")!;
      handleRuntimeError(context, new TypeError(source, command, context, invalidType.type));
    } else {
      handleRuntimeError(context, new TypeError(source, command, context, args[0].type));
    }
  }

  @Validate(null, 0, "random_random", true)
  static random_random(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NumberValue {
    const result = Math.random();
    return { type: "number", value: result };
  }

  @Validate(1, 2, "round", true)
  static round(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): NumberValue | BigIntValue {
    const numArg = args[0];
    if (!isNumeric(numArg)) {
      handleRuntimeError(context, new TypeError(source, command, context, numArg.type));
    }

    let ndigitsArg: BigIntValue = { type: "bigint", value: BigInt(0) };
    if (args.length === 2 && args[1].type !== "none") {
      if (args[1].type !== "bigint") {
        handleRuntimeError(context, new TypeError(source, command, context, args[1].type));
      }
      ndigitsArg = args[1];
    } else {
      const shifted = Intl.NumberFormat("en-US", {
        roundingMode: "halfEven",
        useGrouping: false,
        maximumFractionDigits: 0,
      } as Intl.NumberFormatOptions).format(numArg.value);
      return { type: "bigint", value: BigInt(shifted) };
    }

    if (numArg.type === "number") {
      const numberValue: number = numArg.value;
      if (ndigitsArg.value >= 0) {
        const shifted = Intl.NumberFormat("en-US", {
          roundingMode: "halfEven",
          useGrouping: false,
          maximumFractionDigits: Number(ndigitsArg.value),
        } as Intl.NumberFormatOptions).format(numberValue);
        return { type: "number", value: Number(shifted) };
      } else {
        const shifted = Intl.NumberFormat("en-US", {
          roundingMode: "halfEven",
          useGrouping: false,
          maximumFractionDigits: 0,
        } as Intl.NumberFormatOptions).format(numArg.value / 10 ** -Number(ndigitsArg.value));
        return { type: "number", value: Number(shifted) * 10 ** -Number(ndigitsArg.value) };
      }
    } else {
      if (ndigitsArg.value >= 0) {
        return numArg;
      } else {
        const shifted = Intl.NumberFormat("en-US", {
          roundingMode: "halfEven",
          useGrouping: false,
          maximumFractionDigits: 0,
        } as Intl.NumberFormatOptions).format(
          Number(numArg.value) / 10 ** -Number(ndigitsArg.value),
        );
        return { type: "bigint", value: BigInt(shifted) * 10n ** -ndigitsArg.value };
      }
    }
  }

  @Validate(null, 0, "time_time", true)
  static time_time(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NumberValue {
    // Python's time.time() is documented as seconds since the epoch, not milliseconds — divide
    // Date.now()'s milliseconds down to match.
    return { type: "number", value: Date.now() / 1000 };
  }

  @Validate(1, 1, "is_none", true)
  static is_none(
    args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): BoolValue {
    const obj = args[0];
    return { type: "bool", value: obj.type === "none" };
  }

  @Validate(1, 1, "is_float", true)
  static is_float(
    args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): BoolValue {
    const obj = args[0];
    return { type: "bool", value: obj.type === "number" };
  }

  @Validate(1, 1, "is_string", true)
  static is_string(
    args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): BoolValue {
    const obj = args[0];
    return { type: "bool", value: obj.type === "string" };
  }

  @Validate(1, 1, "is_boolean", true)
  static is_boolean(
    args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): BoolValue {
    const obj = args[0];
    return { type: "bool", value: obj.type === "bool" };
  }

  @Validate(1, 1, "is_complex", true)
  static is_complex(
    args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): BoolValue {
    const obj = args[0];
    return { type: "bool", value: obj.type === "complex" };
  }

  @Validate(1, 1, "is_number", true)
  static is_number(
    args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): BoolValue {
    // Mirrors Scheme's `number?`: true for any number in the numeric tower
    // (integer, float or complex), but not for booleans.
    const obj = args[0];
    return {
      type: "bool",
      value: obj.type === "bigint" || obj.type === "number" || obj.type === "complex",
    };
  }

  @Validate(1, 1, "is_integer", true)
  static is_integer(
    args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): BoolValue {
    const obj = args[0];
    return { type: "bool", value: obj.type === "bigint" };
  }

  @Validate(1, 1, "is_function", true)
  static is_function(
    args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): BoolValue {
    const obj = args[0];
    return {
      type: "bool",
      value: obj.type === "function" || obj.type === "closure" || obj.type === "builtin",
    };
  }

  @Validate(0, 1, "input", true)
  static async input(
    args: Value[],
    _source: string,
    _command: ExprNS.Call,
    context: Context,
  ): Promise<Value> {
    const prompt = args.length > 0 ? toPythonString(args[0]) : undefined;
    if (prompt !== undefined) {
      // Matches CPython: input(prompt) writes the prompt to stdout (no trailing newline)
      // before blocking on stdin.
      await displayOutput(context, prompt);
    }
    const userInput = await receiveInput(context, prompt);
    return { type: "string", value: userInput };
  }

  static async print(
    args: Value[],
    _source: string,
    _command: ExprNS.Call,
    context: Context,
  ): Promise<Value> {
    const output = args.map(arg => toPythonString(arg)).join(" ") + "\n";
    await displayOutput(context, output);
    return { type: "none" };
  }
  static str(
    args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): StringValue {
    if (args.length === 0) {
      return { type: "string", value: "" };
    }
    const obj = args[0];
    const result = toPythonString(obj);
    return { type: "string", value: result };
  }
  @Validate(1, 1, "repr", true)
  static repr(
    args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): StringValue {
    const obj = args[0];
    const result = toPythonString(obj, true);
    return { type: "string", value: result };
  }

  // Python's `breakpoint()` drops into a debugger; the CSE machine has no interactive debugger,
  // so as a value it is simply a no-op that yields `None`. A zero-arg call resolving to this
  // builtin is recognised by the CSE machine's step generator (interpreter.ts) as a breakpoint —
  // it records the step so the host's breakpoint-navigation controls can jump to it, then this
  // entry runs like any other builtin call. This mirrors the stepper's `breakpoint` entry
  // (src/conductor/stepper/builtins.ts), which does the analogous thing for the substitution model.
  static breakpoint(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  // set_timeout(f, t): schedules f to be called with no arguments after t
  // milliseconds, without blocking the calling code (source-academy/py-slang#311).
  // Mirrors the sound_matrix module's existing JS set_timeout(f, t) (same
  // signature and units), moved into the language itself rather than staying
  // module-gated, since it's a capability of the evaluator, not of any one
  // module.
  //
  // Not yet implemented on the CSE machine: f must still be callable when the
  // real timer fires, which may be well after this evaluate() run has
  // finished and context.control/context.stash have been torn down — the CSE
  // machine has no way to resume a closure call from cold today (unlike
  // PVML's invokeValueAsync, built for sound_matrix's own set_timeout, or
  // py2js, where a compiled Python function already is a plain JS closure and
  // needs no re-entry machinery at all — see
  // src/engines/py2js/runtime.ts). Implemented only by py2js for now; this
  // entry exists so the name resolves consistently across engines.
  @Validate(2, 2, "set_timeout", true)
  static set_timeout(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    throw new Error("set_timeout is not yet supported by the CSE machine");
  }

  // clear_all_timeout(): cancels every pending set_timeout callback scheduled
  // so far. See set_timeout above for why this is CSE-unsupported for now.
  @Validate(0, 0, "clear_all_timeout", true)
  static clear_all_timeout(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    throw new Error("clear_all_timeout is not yet supported by the CSE machine");
  }
}
for (const builtin of Object.getOwnPropertyNames(MiscBuiltins)) {
  if (
    typeof MiscBuiltins[builtin as keyof typeof MiscBuiltins] === "function" &&
    !builtin.startsWith("_")
  ) {
    miscBuiltins.set(builtin, {
      type: "builtin",
      func: MiscBuiltins[builtin as keyof typeof MiscBuiltins] as BuiltinValue["func"],
      name: builtin,
      minArgs: minArgMap.get(builtin) || 0,
    });
  }
}

export default {
  name: GroupName.MISC,
  prelude: "",
  builtins: miscBuiltins,
};
