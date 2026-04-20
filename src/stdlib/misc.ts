import { ExprNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { ControlItem } from "../engines/cse/control";
import { handleRuntimeError } from "../engines/cse/error";
import { isFalsy } from "../engines/cse/operators";
import {
  BigIntValue,
  BoolValue,
  BuiltinValue,
  ComplexValue,
  NumberValue,
  StringValue,
  Value,
} from "../engines/cse/stash";
import { displayOutput, receiveInput } from "../engines/cse/streams";
import { isNumeric } from "../engines/cse/utils";
import { MissingRequiredPositionalError, TypeError, UserError, ValueError } from "../errors";
import { PyComplexNumber } from "../types";
import { GroupName, minArgMap, toPythonString, Validate } from "./utils";

const miscBuiltins = new Map<string, BuiltinValue>();

export class MiscBuiltins {
  @Validate(1, 1, "arity", true)
  static arity(args: Value[], source: string, command: ExprNS.Call, context: Context): BigIntValue {
    const func = args[0];
    if (func.type !== "builtin" && func.type !== "closure") {
      handleRuntimeError(context, new TypeError(source, command, context, func.type, "function"));
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

  @Validate(null, 2, "int", true)
  static int(args: Value[], source: string, command: ExprNS.Call, context: Context): BigIntValue {
    if (args.length === 0) {
      return { type: "bigint", value: BigInt(0) };
    }
    const arg = args[0];
    if (!isNumeric(arg) && arg.type !== "string" && arg.type !== "bool") {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, arg.type, "str, int, float or bool"),
      );
    }

    if (args.length === 1) {
      if (arg.type === "number") {
        const truncated = Math.trunc(arg.value);
        return { type: "bigint", value: BigInt(truncated) };
      }
      if (arg.type === "bigint") {
        return { type: "bigint", value: arg.value };
      }
      if (arg.type === "string") {
        const str = arg.value.trim().replace(/_/g, "");
        if (!/^[+-]?\d+$/.test(str)) {
          handleRuntimeError(context, new ValueError(source, command, context, "int"));
        }
        return { type: "bigint", value: BigInt(str) };
      }
      return { type: "bigint", value: arg.value ? BigInt(1) : BigInt(0) };
    }
    const baseArg = args[1];
    if (arg.type !== "string") {
      handleRuntimeError(context, new TypeError(source, command, context, arg.type, "string"));
    }
    if (baseArg.type !== "bigint") {
      handleRuntimeError(context, new TypeError(source, command, context, baseArg.type, "int"));
    }

    let base = Number(baseArg.value);
    let str = arg.value.trim().replace(/_/g, "");

    const sign = str.startsWith("-") ? -1 : 1;
    if (str.startsWith("+") || str.startsWith("-")) {
      str = str.substring(1);
    }

    if (base === 0) {
      if (str.startsWith("0x") || str.startsWith("0X")) {
        base = 16;
        str = str.substring(2);
      } else if (str.startsWith("0o") || str.startsWith("0O")) {
        base = 8;
        str = str.substring(2);
      } else if (str.startsWith("0b") || str.startsWith("0B")) {
        base = 2;
        str = str.substring(2);
      } else {
        base = 10;
      }
    }

    if (base < 2 || base > 36) {
      handleRuntimeError(context, new ValueError(source, command, context, "int"));
    }

    const validChars = "0123456789abcdefghijklmnopqrstuvwxyz".substring(0, base);
    const regex = new RegExp(`^[${validChars}]+$`, "i");
    if (!regex.test(str)) {
      handleRuntimeError(context, new ValueError(source, command, context, "int"));
    }

    let res = BigInt(0);
    for (const char of str) {
      res = res * BigInt(base) + BigInt(validChars.indexOf(char.toLowerCase()));
    }
    return { type: "bigint", value: BigInt(sign) * res };
  }

  @Validate(null, 1, "float", true)
  static float(args: Value[], source: string, command: ExprNS.Call, context: Context): NumberValue {
    if (args.length === 0) {
      return { type: "number", value: 0 };
    }
    const val = args[0];
    if (val.type === "bigint") {
      return { type: "number", value: Number(val.value) };
    } else if (val.type === "number") {
      return { type: "number", value: val.value };
    } else if (val.type === "bool") {
      return { type: "number", value: val.value ? 1 : 0 };
    } else if (val.type === "string") {
      const str = val.value.trim().replace(/_/g, "").toLowerCase();
      const mappings = {
        inf: Infinity,
        "+inf": Infinity,
        "-inf": -Infinity,
        infinity: Infinity,
        "+infinity": Infinity,
        "-infinity": -Infinity,
        nan: NaN,
        "+nan": NaN,
        "-nan": NaN,
      };
      if (str in mappings) {
        return { type: "number", value: mappings[str as keyof typeof mappings] };
      }
      const num = Number(str);
      if (isNaN(num)) {
        handleRuntimeError(context, new ValueError(source, command, context, "float"));
      }
      return { type: "number", value: num };
    }
    handleRuntimeError(
      context,
      new TypeError(source, command, context, val.type, "'float', 'int', 'bool' or 'str'"),
    );
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
        handleRuntimeError(context, new TypeError(source, command, context, val.type, "complex"));
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
      handleRuntimeError(
        context,
        new TypeError(
          source,
          command,
          context,
          invalidType[0].type,
          "'int', 'float', 'bool' or 'complex'",
        ),
      );
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
      handleRuntimeError(context, new TypeError(source, command, context, val.type, "complex"));
    }
    return { type: "number", value: val.value.real };
  }

  @Validate(1, 1, "imag", true)
  static imag(args: Value[], source: string, command: ExprNS.Call, context: Context): NumberValue {
    const val = args[0];
    if (val.type !== "complex") {
      handleRuntimeError(context, new TypeError(source, command, context, val.type, "complex"));
    }
    return { type: "number", value: val.value.imag };
  }

  @Validate(null, 1, "bool", true)
  static bool(args: Value[], _source: string, _command: ControlItem, _context: Context): BoolValue {
    if (args.length === 0) {
      return { type: "bool", value: false };
    }
    const val = args[0];
    return { type: "bool", value: !isFalsy(val) };
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
        const modulus = Math.sqrt(real * real + imag * imag);
        return { type: "number", value: modulus };
      }
      default:
        handleRuntimeError(
          context,
          new TypeError(source, command, context, args[0].type, "float', 'int' or 'complex"),
        );
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
    handleRuntimeError(
      context,
      new TypeError(source, command, context, val.type, "object with length"),
    );
  }

  static error(args: Value[], _source: string, command: ExprNS.Call, context: Context): Value {
    const output = "Error: " + args.map(arg => toPythonString(arg)).join(" ") + "\n";
    handleRuntimeError(context, new UserError(output, command));
  }

  @Validate(2, null, "max", true)
  static max(args: Value[], source: string, command: ExprNS.Call, context: Context): Value {
    const numericTypes = ["bigint", "number"];
    const firstType = args[0].type;
    const isNumericValue = numericTypes.includes(firstType);
    const isString = firstType === "string";

    for (let i = 1; i < args.length; i++) {
      const t = args[i].type;
      if (isNumericValue && !numericTypes.includes(t)) {
        handleRuntimeError(
          context,
          new TypeError(source, command, context, args[i].type, "float' or 'int"),
        );
      }
      if (isString && t !== "string") {
        handleRuntimeError(
          context,
          new TypeError(source, command, context, args[i].type, "string"),
        );
      }
    }

    let useFloat = false;
    if (isNumericValue) {
      for (const arg of args) {
        if (arg.type === "number") {
          useFloat = true;
          break;
        }
      }
    }

    let maxIndex = 0;
    if (isNumericValue) {
      if (useFloat) {
        if (args[0].type !== "number" && args[0].type !== "bigint") {
          handleRuntimeError(
            context,
            new TypeError(source, command, context, args[0].type, "float' or 'int"),
          );
        }
        let maxVal: number = Number(args[0].value);
        for (let i = 1; i < args.length; i++) {
          const arg = args[i];
          if (!isNumeric(arg)) {
            handleRuntimeError(
              context,
              new TypeError(source, command, context, arg.type, "float' or 'int"),
            );
          }
          const curr: number = Number(arg.value);
          if (curr > maxVal) {
            maxVal = curr;
            maxIndex = i;
          }
        }
      } else {
        if (args[0].type !== "bigint") {
          handleRuntimeError(context, new TypeError(source, command, context, args[0].type, "int"));
        }
        let maxVal: bigint = args[0].value;
        for (let i = 1; i < args.length; i++) {
          const arg = args[i];
          if (arg.type !== "bigint") {
            handleRuntimeError(context, new TypeError(source, command, context, arg.type, "int"));
          }
          const curr: bigint = arg.value;
          if (curr > maxVal) {
            maxVal = curr;
            maxIndex = i;
          }
        }
      }
    } else if (isString) {
      if (args[0].type !== "string") {
        handleRuntimeError(
          context,
          new TypeError(source, command, context, args[0].type, "string"),
        );
      }
      let maxVal = args[0].value;
      for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg.type !== "string") {
          handleRuntimeError(context, new TypeError(source, command, context, arg.type, "string"));
        }
        const curr = arg.value;
        if (curr > maxVal) {
          maxVal = curr;
          maxIndex = i;
        }
      }
    } else {
      // Won't happen
      throw new Error(`max: unsupported type ${firstType}`);
    }

    return args[maxIndex];
  }

  @Validate(2, null, "min", true)
  static min(args: Value[], source: string, command: ExprNS.Call, context: Context): Value {
    if (args.length < 2) {
      handleRuntimeError(
        context,
        new MissingRequiredPositionalError(source, command, "min", Number(2), args, true),
      );
    }

    const numericTypes = ["bigint", "number"];
    const firstType = args[0].type;
    const isNumericValue = numericTypes.includes(firstType);
    const isString = firstType === "string";

    for (let i = 1; i < args.length; i++) {
      const t = args[i].type;
      if (isNumericValue && !numericTypes.includes(t)) {
        handleRuntimeError(
          context,
          new TypeError(source, command, context, args[i].type, "float' or 'int"),
        );
      }
      if (isString && t !== "string") {
        handleRuntimeError(
          context,
          new TypeError(source, command, context, args[i].type, "string"),
        );
      }
    }

    let useFloat = false;
    if (isNumericValue) {
      for (const arg of args) {
        if (arg.type === "number") {
          useFloat = true;
          break;
        }
      }
    }

    let maxIndex = 0;
    if (isNumericValue) {
      if (useFloat) {
        if (args[0].type !== "number" && args[0].type !== "bigint") {
          handleRuntimeError(
            context,
            new TypeError(source, command, context, args[0].type, "float' or 'int"),
          );
        }
        let maxVal: number = Number(args[0].value);
        for (let i = 1; i < args.length; i++) {
          const arg = args[i];
          if (!isNumeric(arg)) {
            handleRuntimeError(
              context,
              new TypeError(source, command, context, arg.type, "float' or 'int"),
            );
          }
          const curr: number = Number(arg.value);
          if (curr < maxVal) {
            maxVal = curr;
            maxIndex = i;
          }
        }
      } else {
        if (args[0].type !== "bigint") {
          handleRuntimeError(context, new TypeError(source, command, context, args[0].type, "int"));
        }
        let maxVal: bigint = args[0].value;
        for (let i = 1; i < args.length; i++) {
          const arg = args[i];
          if (arg.type !== "bigint") {
            handleRuntimeError(context, new TypeError(source, command, context, arg.type, "int"));
          }
          const curr: bigint = arg.value;
          if (curr < maxVal) {
            maxVal = curr;
            maxIndex = i;
          }
        }
      }
    } else if (isString) {
      if (args[0].type !== "string") {
        handleRuntimeError(
          context,
          new TypeError(source, command, context, args[0].type, "string"),
        );
      }
      let maxVal = args[0].value;
      for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg.type !== "string") {
          handleRuntimeError(context, new TypeError(source, command, context, arg.type, "string"));
        }
        const curr = arg.value;
        if (curr < maxVal) {
          maxVal = curr;
          maxIndex = i;
        }
      }
    } else {
      // Won't happen
      throw new Error(`min: unsupported type ${firstType}`);
    }

    return args[maxIndex];
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
      handleRuntimeError(
        context,
        new TypeError(source, command, context, numArg.type, "float' or 'int"),
      );
    }

    let ndigitsArg: BigIntValue = { type: "bigint", value: BigInt(0) };
    if (args.length === 2 && args[1].type !== "none") {
      if (args[1].type !== "bigint") {
        handleRuntimeError(context, new TypeError(source, command, context, args[1].type, "int"));
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
    const currentTime = Date.now();
    return { type: "number", value: currentTime };
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

  @Validate(1, 1, "is_int", true)
  static is_int(
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

  static async input(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    context: Context,
  ): Promise<Value> {
    const userInput = await receiveInput(context);
    return { type: "string", value: userInput };
  }

  static async print(
    args: Value[],
    _source: string,
    _command: ExprNS.Call,
    context: Context,
  ): Promise<Value> {
    const output = args.map(arg => toPythonString(arg)).join(" ");
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
