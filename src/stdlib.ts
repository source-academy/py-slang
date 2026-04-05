import {
  BigIntValue,
  BoolValue,
  BuiltinValue,
  ComplexValue,
  NumberValue,
  StringValue,
  Value,
} from "./engines/cse/stash";
// npm install mathjs
import { erf, gamma, lgamma } from "mathjs";
import { Context } from "./engines/cse/context";
import { ControlItem } from "./engines/cse/control";
import { handleRuntimeError } from "./engines/cse/error";
import { displayOutput, receiveInput } from "./engines/cse/streams";
import { stringify } from "./utils/stringify";
import {
  MissingRequiredPositionalError,
  TooManyPositionalArgumentsError,
  TypeError,
  UserError,
  ValueError,
} from "./errors/errors";

export const minArgMap = new Map<string, number>();

export function Validate<T extends Value | Promise<Value>>(
  minArgs: number | null,
  maxArgs: number | null,
  functionName: string,
  strict: boolean,
) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<
      (args: Value[], source: string, command: ControlItem, context: Context) => T
    >,
  ): void {
    const originalMethod = descriptor.value!;
    minArgMap.set(functionName, minArgs || 0);
    descriptor.value = function (
      args: Value[],
      source: string,
      command: ControlItem,
      context: Context,
    ): T {
      if (minArgs !== null && args.length < minArgs) {
        handleRuntimeError(
          context,
          new MissingRequiredPositionalError(
            source,
            command as ExprNS.Expr,
            functionName,
            minArgs,
            args,
            strict,
          ),
        );
      }

      if (maxArgs !== null && args.length > maxArgs) {
        handleRuntimeError(
          context,
          new TooManyPositionalArgumentsError(
            source,
            command as ExprNS.Expr,
            functionName,
            maxArgs,
            args,
            strict,
          ),
        );
      }

      return originalMethod.call(this, args, source, command, context);
    };
  };
}

export class BuiltInFunctions {
  @Validate(1, 1, "arity", true)
  static arity(args: Value[], source: string, command: ControlItem, context: Context): BigIntValue {
    const func = args[0];
    if (func.type !== "builtin" && func.type !== "closure") {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, func.type, "function"),
      );
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
  static int(args: Value[], source: string, command: ControlItem, context: Context): BigIntValue {
    if (args.length === 0) {
      return { type: "bigint", value: BigInt(0) };
    }
    const arg = args[0];
    if (!isNumeric(arg) && arg.type !== "string" && arg.type !== "bool") {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, arg.type, "str, int, float or bool"),
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
          handleRuntimeError(
            context,
            new ValueError(source, command as ExprNS.Expr, context, "int"),
          );
        }
        return { type: "bigint", value: BigInt(str) };
      }
      return { type: "bigint", value: arg.value ? BigInt(1) : BigInt(0) };
    }
    const baseArg = args[1];
    if (arg.type !== "string") {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, arg.type, "string"),
      );
    }
    if (baseArg.type !== "bigint") {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, baseArg.type, "int"),
      );
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
      handleRuntimeError(context, new ValueError(source, command as ExprNS.Expr, context, "int"));
    }

    const validChars = "0123456789abcdefghijklmnopqrstuvwxyz".substring(0, base);
    const regex = new RegExp(`^[${validChars}]+$`, "i");
    if (!regex.test(str)) {
      handleRuntimeError(context, new ValueError(source, command as ExprNS.Expr, context, "int"));
    }

    let res = BigInt(0);
    for (const char of str) {
      res = res * BigInt(base) + BigInt(validChars.indexOf(char.toLowerCase()));
    }
    return { type: "bigint", value: BigInt(sign) * res };
  }

  @Validate(null, 1, "float", true)
  static float(args: Value[], source: string, command: ControlItem, context: Context): NumberValue {
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
        handleRuntimeError(
          context,
          new ValueError(source, command as ExprNS.Expr, context, "float"),
        );
      }
      return { type: "number", value: num };
    }
    handleRuntimeError(
      context,
      new TypeError(
        source,
        command as ExprNS.Expr,
        context,
        val.type,
        "'float', 'int', 'bool' or 'str'",
      ),
    );
  }

  @Validate(null, 2, "complex", true)
  static complex(
    args: Value[],
    source: string,
    command: ControlItem,
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
        handleRuntimeError(
          context,
          new TypeError(source, command as ExprNS.Expr, context, val.type, "complex"),
        );
      }
      return {
        type: "complex",
        value: PyComplexNumber.fromValue(context, source, command as ExprNS.Expr, val.value),
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
        new TypeError(source, command as ExprNS.Expr, context, invalidType[0].type, "complex"),
      );
    }
    const [real, imag] = args as (BigIntValue | NumberValue | BoolValue | ComplexValue)[];
    const realPart = PyComplexNumber.fromValue(context, source, command as ExprNS.Expr, real.value);
    const imagPart = PyComplexNumber.fromValue(context, source, command as ExprNS.Expr, imag.value);
    return { type: "complex", value: realPart.add(imagPart.mul(new PyComplexNumber(0, 1))) };
  }

  @Validate(1, 1, "real", true)
  static real(args: Value[], source: string, command: ControlItem, context: Context): NumberValue {
    const val = args[0];
    if (val.type !== "complex") {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, val.type, "complex"),
      );
    }
    return { type: "number", value: val.value.real };
  }

  @Validate(1, 1, "imag", true)
  static imag(args: Value[], source: string, command: ControlItem, context: Context): NumberValue {
    const val = args[0];
    if (val.type !== "complex") {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, val.type, "complex"),
      );
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
    command: ControlItem,
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
          new TypeError(
            source,
            command as ExprNS.Expr,
            context,
            args[0].type,
            "float', 'int' or 'complex",
          ),
        );
    }
  }

  @Validate(1, 1, "len", true)
  static len(args: Value[], source: string, command: ControlItem, context: Context): BigIntValue {
    const val = args[0];
    if (val.type === "string" || val.type === "list") {
      // The spread operator is used to count the number of Unicode code points
      // in the string
      return { type: "bigint", value: BigInt([...val.value].length) };
    }
    handleRuntimeError(
      context,
      new TypeError(source, command as ExprNS.Expr, context, val.type, "object with length"),
    );
  }

  static toStr(val: Value): string {
    return toPythonString(val);
  }

  static error(args: Value[], _source: string, command: ControlItem, context: Context): Value {
    const output = "Error: " + args.map(arg => BuiltInFunctions.toStr(arg)).join(" ") + "\n";
    handleRuntimeError(context, new UserError(output, command as ExprNS.Expr));
  }

  @Validate(1, 1, "math_acos", false)
  static math_acos(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
      );
    }

    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    if (num < -1 || num > 1) {
      handleRuntimeError(
        context,
        new ValueError(source, command as ExprNS.Expr, context, "math_acos"),
      );
    }

    const result = Math.acos(num);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_acosh", false)
  static math_acosh(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const x = args[0];

    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
      );
    }

    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    if (num < 1) {
      handleRuntimeError(
        context,
        new ValueError(source, command as ExprNS.Expr, context, "math_acosh"),
      );
    }

    const result = Math.acosh(num);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_asin", false)
  static math_asin(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
      );
    }

    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    if (num < -1 || num > 1) {
      handleRuntimeError(
        context,
        new ValueError(source, command as ExprNS.Expr, context, "math_asin"),
      );
    }

    const result = Math.asin(num);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_asinh", false)
  static math_asinh(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
      );
    }

    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    const result = Math.asinh(num);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_atan", false)
  static math_atan(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
      );
    }

    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    const result = Math.atan(num);
    return { type: "number", value: result };
  }

  @Validate(2, 2, "math_atan2", false)
  static math_atan2(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const y = args[0];
    const x = args[1];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
      );
    } else if (!isNumeric(y)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, y.type, "float' or 'int"),
      );
    }

    let yNum: number, xNum: number;
    if (y.type === "number") {
      yNum = y.value;
    } else {
      yNum = Number(y.value);
    }

    if (x.type === "number") {
      xNum = x.value;
    } else {
      xNum = Number(x.value);
    }

    const result = Math.atan2(yNum, xNum);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_atanh", false)
  static math_atanh(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
      );
    }

    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    if (num <= -1 || num >= 1) {
      handleRuntimeError(
        context,
        new ValueError(source, command as ExprNS.Expr, context, "math_atanh"),
      );
    }

    const result = Math.atanh(num);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_cos", false)
  static math_cos(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
      );
    }

    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    const result = Math.cos(num);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_cosh", false)
  static math_cosh(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
      );
    }

    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    const result = Math.cosh(num);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_degrees", false)
  static math_degrees(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
      );
    }

    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    const result = (num * 180) / Math.PI;
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_erf", false)
  static math_erf(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
      );
    }

    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    const erfnum = erf(num);

    return { type: "number", value: erfnum };
  }

  @Validate(1, 1, "math_erfc", false)
  static math_erfc(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
      );
    }

    const erfc = 1 - BuiltInFunctions.math_erf([args[0]], source, command, context).value;

    return { type: "number", value: erfc };
  }

  @Validate(2, 2, "math_comb", false)
  static math_comb(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): BigIntValue {
    const n = args[0];
    const k = args[1];

    if (n.type !== "bigint") {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, n.type, "int"),
      );
    } else if (k.type !== "bigint") {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, k.type, "int"),
      );
    }

    const nVal = BigInt(n.value);
    const kVal = BigInt(k.value);

    if (nVal < 0 || kVal < 0) {
      handleRuntimeError(
        context,
        new ValueError(source, command as ExprNS.Expr, context, "math_comb"),
      );
    }

    if (kVal > nVal) {
      return { type: "bigint", value: BigInt(0) };
    }

    let result: bigint = BigInt(1);
    const kk = kVal > nVal - kVal ? nVal - kVal : kVal;

    for (let i: bigint = BigInt(0); i < kk; i++) {
      result = (result * (nVal - i)) / (i + BigInt(1));
    }

    return { type: "bigint", value: result };
  }

  @Validate(1, 1, "math_factorial", false)
  static math_factorial(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): BigIntValue {
    const n = args[0];

    if (n.type !== "bigint") {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, n.type, "int"),
      );
    }

    const nVal = BigInt(n.value);

    if (nVal < 0) {
      handleRuntimeError(
        context,
        new ValueError(source, command as ExprNS.Expr, context, "math_factorial"),
      );
    }

    // 0! = 1
    if (nVal === BigInt(0)) {
      return { type: "bigint", value: BigInt(1) };
    }

    let result: bigint = BigInt(1);
    for (let i: bigint = BigInt(1); i <= nVal; i++) {
      result *= i;
    }

    return { type: "bigint", value: result };
  }

  static math_gcd(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): BigIntValue {
    if (args.length === 0) {
      return { type: "bigint", value: BigInt(0) };
    }

    const values = args.map(v => {
      if (v.type !== "bigint") {
        handleRuntimeError(
          context,
          new TypeError(source, command as ExprNS.Expr, context, v.type, "int"),
        );
      }
      return BigInt(v.value);
    });

    const allZero = values.every(val => val === BigInt(0));
    if (allZero) {
      return { type: "bigint", value: BigInt(0) };
    }

    let currentGcd: bigint = values[0] < 0 ? -values[0] : values[0];
    for (let i = 1; i < values.length; i++) {
      currentGcd = BuiltInFunctions.gcdOfTwo(currentGcd, values[i] < 0 ? -values[i] : values[i]);
      if (currentGcd === BigInt(1)) {
        break;
      }
    }

    return { type: "bigint", value: currentGcd };
  }

  static gcdOfTwo(a: bigint, b: bigint): bigint {
    let x: bigint = a;
    let y: bigint = b;
    while (y !== BigInt(0)) {
      const temp = x % y;
      x = y;
      y = temp;
    }
    return x < 0 ? -x : x;
  }

  @Validate(1, 1, "math_isqrt", false)
  static math_isqrt(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): BigIntValue {
    const nValObj = args[0];
    if (nValObj.type !== "bigint") {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, nValObj.type, "int"),
      );
    }

    const n: bigint = nValObj.value;

    if (n < 0) {
      handleRuntimeError(
        context,
        new ValueError(source, command as ExprNS.Expr, context, "math_isqrt"),
      );
    }

    if (n < 2) {
      return { type: "bigint", value: n };
    }

    let low: bigint = BigInt(1);
    let high: bigint = n;

    while (low < high) {
      const mid = (low + high + BigInt(1)) >> BigInt(1);
      const sq = mid * mid;
      if (sq <= n) {
        low = mid;
      } else {
        high = mid - BigInt(1);
      }
    }

    return { type: "bigint", value: low };
  }

  static math_lcm(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): BigIntValue {
    if (args.length === 0) {
      return { type: "bigint", value: BigInt(1) };
    }

    const values = args.map(val => {
      if (val.type !== "bigint") {
        handleRuntimeError(
          context,
          new TypeError(source, command as ExprNS.Expr, context, val.type, "int"),
        );
      }
      return BigInt(val.value);
    });

    if (values.some(v => v === BigInt(0))) {
      return { type: "bigint", value: BigInt(0) };
    }

    let currentLcm: bigint = BuiltInFunctions.absBigInt(values[0]);
    for (let i = 1; i < values.length; i++) {
      currentLcm = BuiltInFunctions.lcmOfTwo(currentLcm, BuiltInFunctions.absBigInt(values[i]));
      if (currentLcm === BigInt(0)) {
        break;
      }
    }

    return { type: "bigint", value: currentLcm };
  }

  static lcmOfTwo(a: bigint, b: bigint): bigint {
    const gcdVal: bigint = BuiltInFunctions.gcdOfTwo(a, b);
    return BigInt((a / gcdVal) * b);
  }

  static absBigInt(x: bigint): bigint {
    return x < 0 ? -x : x;
  }

  @Validate(1, 2, "math_perm", true)
  static math_perm(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): BigIntValue {
    const nValObj = args[0];
    if (nValObj.type !== "bigint") {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, nValObj.type, "int"),
      );
    }
    const n = BigInt(nValObj.value);

    let k = n;
    if (args.length === 2) {
      const kValObj = args[1];
      if (kValObj.type === "none") {
        k = n;
      } else if (kValObj.type === "bigint") {
        k = BigInt(kValObj.value);
      } else {
        handleRuntimeError(
          context,
          new TypeError(source, command as ExprNS.Expr, context, kValObj.type, "int' or 'None"),
        );
      }
    }

    if (n < 0 || k < 0) {
      handleRuntimeError(
        context,
        new ValueError(source, command as ExprNS.Expr, context, "math_perm"),
      );
    }

    if (k > n) {
      return { type: "bigint", value: BigInt(0) };
    }

    let result: bigint = BigInt(1);
    for (let i: bigint = BigInt(0); i < k; i++) {
      result *= n - i;
    }

    return { type: "bigint", value: result };
  }

  @Validate(1, 1, "math_ceil", false)
  static math_ceil(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): BigIntValue {
    const x = args[0];

    if (x.type === "bigint") {
      return x;
    }

    if (x.type === "number") {
      const numVal = x.value;
      const ceiled: bigint = BigInt(Math.ceil(numVal));
      return { type: "bigint", value: ceiled };
    }

    handleRuntimeError(
      context,
      new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
    );
  }

  @Validate(1, 1, "math_fabs", false)
  static math_fabs(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const x = args[0];

    if (x.type === "bigint") {
      const bigVal: bigint = BigInt(x.value);
      const absVal: number = bigVal < 0 ? -Number(bigVal) : Number(bigVal);
      return { type: "number", value: absVal };
    }

    if (x.type === "number") {
      const numVal: number = x.value;
      if (typeof numVal !== "number") {
        handleRuntimeError(
          context,
          new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
        );
      }
      const absVal: number = Math.abs(numVal);
      return { type: "number", value: absVal };
    }

    handleRuntimeError(
      context,
      new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
    );
  }

  @Validate(1, 1, "math_floor", false)
  static math_floor(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): BigIntValue {
    const x = args[0];

    if (x.type === "bigint") {
      return x;
    }

    if (x.type === "number") {
      const numVal: number = x.value;
      if (typeof numVal !== "number") {
        handleRuntimeError(
          context,
          new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
        );
      }
      const floored: bigint = BigInt(Math.floor(numVal));
      return { type: "bigint", value: floored };
    }

    handleRuntimeError(
      context,
      new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
    );
  }

  // Computes the product of a and b along with the rounding error using Dekker's algorithm.
  static twoProd(a: number, b: number): { prod: number; err: number } {
    const prod = a * b;
    const c = 134217729; // 2^27 + 1
    const a_hi = a * c - (a * c - a);
    const a_lo = a - a_hi;
    const b_hi = b * c - (b * c - b);
    const b_lo = b - b_hi;
    const err = a_lo * b_lo - (prod - a_hi * b_hi - a_lo * b_hi - a_hi * b_lo);
    return { prod, err };
  }

  // Computes the sum of a and b along with the rounding error using Fast TwoSum.
  static twoSum(a: number, b: number): { sum: number; err: number } {
    const sum = a + b;
    const v = sum - a;
    const err = a - (sum - v) + (b - v);
    return { sum, err };
  }

  // Performs a fused multiply-add operation: computes (x * y) + z with a single rounding.
  static fusedMultiplyAdd(x: number, y: number, z: number): number {
    const { prod, err: prodErr } = BuiltInFunctions.twoProd(x, y);
    const { sum, err: sumErr } = BuiltInFunctions.twoSum(prod, z);
    const result = sum + (prodErr + sumErr);
    return result;
  }

  static toNumber(val: Value, source: string, command: ControlItem, context: Context): number {
    if (val.type === "bigint") {
      return Number(val.value);
    } else if (val.type === "number") {
      return val.value;
    } else {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, val.type, "float' or 'int"),
      );
    }
  }

  @Validate(3, 3, "math_fma", false)
  static math_fma(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const xVal = BuiltInFunctions.toNumber(args[0], source, command, context);
    const yVal = BuiltInFunctions.toNumber(args[1], source, command, context);
    const zVal = BuiltInFunctions.toNumber(args[2], source, command, context);

    // Special-case handling: According to the IEEE 754 standard, fma(0, inf, nan)
    // and fma(inf, 0, nan) should return NaN.
    if (isNaN(xVal) || isNaN(yVal) || isNaN(zVal)) {
      return { type: "number", value: NaN };
    }
    if (xVal === 0 && !isFinite(yVal) && isNaN(zVal)) {
      return { type: "number", value: NaN };
    }
    if (yVal === 0 && !isFinite(xVal) && isNaN(zVal)) {
      return { type: "number", value: NaN };
    }

    const result = BuiltInFunctions.fusedMultiplyAdd(xVal, yVal, zVal);
    return { type: "number", value: result };
  }

  @Validate(2, 2, "math_fmod", false)
  static math_fmod(args: Value[], source: string, command: ControlItem, context: Context): Value {
    // Convert inputs to numbers
    const xVal = BuiltInFunctions.toNumber(args[0], source, command, context);
    const yVal = BuiltInFunctions.toNumber(args[1], source, command, context);

    // Divisor cannot be zero
    if (yVal === 0) {
      handleRuntimeError(
        context,
        new ValueError(source, command as ExprNS.Expr, context, "math_fmod"),
      );
    }

    // JavaScript's % operator behaves similarly to C's fmod
    // in that the sign of the result is the same as the sign of x.
    // For corner cases (NaN, Infinity), JavaScript remainder
    // yields results consistent with typical C library fmod behavior.
    const remainder = xVal % yVal;

    return { type: "number", value: remainder };
  }

  static roundToEven(num: number): number {
    //uses Banker's Rounding as per Python's Round() function
    const floorVal = Math.floor(num);
    const ceilVal = Math.ceil(num);
    const diffFloor = num - floorVal;
    const diffCeil = ceilVal - num;
    if (diffFloor < diffCeil) {
      return floorVal;
    } else if (diffCeil < diffFloor) {
      return ceilVal;
    } else {
      return floorVal % 2 === 0 ? floorVal : ceilVal;
    }
  }

  @Validate(2, 2, "math_remainder", false)
  static math_remainder(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const x = args[0];
    const y = args[1];

    let xValue: number;
    if (x.type === "bigint") {
      xValue = Number(x.value);
    } else if (x.type === "number") {
      xValue = x.value;
    } else {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
      );
    }

    let yValue: number;
    if (y.type === "bigint") {
      yValue = Number(y.value);
    } else if (y.type === "number") {
      yValue = y.value;
    } else {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, y.type, "float' or 'int"),
      );
    }

    if (yValue === 0) {
      handleRuntimeError(
        context,
        new ValueError(source, command as ExprNS.Expr, context, "math_remainder"),
      );
    }

    const quotient = xValue / yValue;
    const n = BuiltInFunctions.roundToEven(quotient);
    const remainder = xValue - n * yValue;

    return { type: "number", value: remainder };
  }

  @Validate(1, 1, "math_trunc", false)
  static math_trunc(args: Value[], source: string, command: ControlItem, context: Context): Value {
    const x = args[0];

    if (x.type === "bigint") {
      return x;
    }

    if (x.type === "number") {
      const numVal: number = x.value;
      if (typeof numVal !== "number") {
        handleRuntimeError(
          context,
          new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
        );
      }
      let truncated: number;
      if (numVal === 0) {
        truncated = 0;
      } else if (numVal < 0) {
        truncated = Math.ceil(numVal);
      } else {
        truncated = Math.floor(numVal);
      }
      return { type: "bigint", value: BigInt(truncated) };
    }

    handleRuntimeError(
      context,
      new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
    );
  }

  @Validate(2, 2, "math_copysign", false)
  static math_copysign(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const [x, y] = args;

    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
      );
    } else if (!isNumeric(y)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, y.type, "float' or 'int"),
      );
    }

    const xVal = Number(x.value);
    const yVal = Number(y.value);

    const absVal = Math.abs(xVal);
    const isNegative = yVal < 0 || Object.is(yVal, -0);
    const result = isNegative ? -absVal : absVal;

    return { type: "number", value: Number(result) };
  }

  @Validate(1, 1, "math_isfinite", false)
  static math_isfinite(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): BoolValue {
    const xValObj = args[0];
    if (!isNumeric(xValObj)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, xValObj.type, "float' or 'int"),
      );
    }

    const x = Number(xValObj.value);
    const result: boolean = Number.isFinite(x);

    return { type: "bool", value: result };
  }

  @Validate(1, 1, "math_isinf", false)
  static math_isinf(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): BoolValue {
    const xValObj = args[0];
    if (!isNumeric(xValObj)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, xValObj.type, "float' or 'int"),
      );
    }

    const x = Number(xValObj.value);
    const result: boolean = x === Infinity || x === -Infinity;

    return { type: "bool", value: result };
  }

  @Validate(1, 1, "math_isnan", false)
  static math_isnan(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): BoolValue {
    const xValObj = args[0];
    if (!isNumeric(xValObj)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, xValObj.type, "float' or 'int"),
      );
    }

    const x = Number(xValObj.value);
    const result: boolean = Number.isNaN(x);

    return { type: "bool", value: result };
  }

  @Validate(2, 2, "math_ldexp", false)
  static math_ldexp(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const xVal = BuiltInFunctions.toNumber(args[0], source, command, context);

    if (args[1].type !== "bigint") {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, args[1].type, "int"),
      );
    }
    const expVal = args[1].value;

    // Perform x * 2^expVal
    // In JavaScript, 2**expVal may overflow or underflow, yielding Infinity or 0 respectively.
    // That behavior parallels typical C library rules for ldexp.
    const result = xVal * Math.pow(2, Number(expVal));

    return { type: "number", value: result };
  }

  @Validate(2, 2, "math_nextafter", false)
  static math_nextafter(
    _args: Value[],
    _source: string,
    _command: ControlItem,
    _context: Context,
  ): Value {
    // TODO: Implement math_nextafter using proper bit-level manipulation and handling special cases (NaN, Infinity, steps, etc.)
    throw new Error("math_nextafter not implemented");
  }

  @Validate(1, 1, "math_ulp", false)
  static math_ulp(
    _args: Value[],
    _source: string,
    _command: ControlItem,
    _context: Context,
  ): Value {
    // TODO: Implement math_ulp to return the unit in the last place (ULP) of the given floating-point number.
    throw new Error("math_ulp not implemented");
  }

  @Validate(1, 1, "math_cbrt", false)
  static math_cbrt(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const xVal = args[0];
    let x: number;

    if (xVal.type !== "number") {
      if (xVal.type === "bigint") {
        x = Number(xVal.value);
      } else {
        handleRuntimeError(
          context,
          new TypeError(source, command as ExprNS.Expr, context, xVal.type, "float' or 'int"),
        );
      }
    } else {
      x = xVal.value;
    }

    const result = Math.cbrt(x);

    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_exp", false)
  static math_exp(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const xVal = args[0];
    let x: number;

    if (xVal.type !== "number") {
      if (xVal.type === "bigint") {
        x = Number(xVal.value);
      } else {
        handleRuntimeError(
          context,
          new TypeError(source, command as ExprNS.Expr, context, xVal.type, "float' or 'int"),
        );
      }
    } else {
      x = xVal.value;
    }

    const result = Math.exp(x);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_exp2", false)
  static math_exp2(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const xVal = args[0];
    let x: number;

    if (xVal.type !== "number") {
      if (xVal.type === "bigint") {
        x = Number(xVal.value);
      } else {
        handleRuntimeError(
          context,
          new TypeError(source, command as ExprNS.Expr, context, xVal.type, "float' or 'int"),
        );
      }
    } else {
      x = xVal.value;
    }

    const result = Math.pow(2, x);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_expm1", false)
  static math_expm1(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
      );
    }

    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    const result = Math.expm1(num);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_gamma", false)
  static math_gamma(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
      );
    }

    const z = BuiltInFunctions.toNumber(x, source, command, context);
    const result = gamma(z);

    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_lgamma", false)
  static math_lgamma(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
      );
    }

    const z = BuiltInFunctions.toNumber(x, source, command, context);
    const result = lgamma(z);

    return { type: "number", value: result };
  }

  @Validate(1, 2, "math_log", true)
  static math_log(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
      );
    }
    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    if (num <= 0) {
      handleRuntimeError(
        context,
        new ValueError(source, command as ExprNS.Expr, context, "math_log"),
      );
    }

    if (args.length === 1) {
      return { type: "number", value: Math.log(num) };
    }

    const baseArg = args[1];
    if (!isNumeric(baseArg)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, baseArg.type, "float' or 'int"),
      );
    }
    let baseNum: number;
    if (baseArg.type === "number") {
      baseNum = baseArg.value;
    } else {
      baseNum = Number(baseArg.value);
    }
    if (baseNum <= 0) {
      handleRuntimeError(
        context,
        new ValueError(source, command as ExprNS.Expr, context, "math_log"),
      );
    }

    const result = Math.log(num) / Math.log(baseNum);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_log10", false)
  static math_log10(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, args[0].type, "float' or 'int"),
      );
    }
    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }
    if (num <= 0) {
      handleRuntimeError(
        context,
        new ValueError(source, command as ExprNS.Expr, context, "math_log10"),
      );
    }

    const result = Math.log10(num);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_log1p", false)
  static math_log1p(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, args[0].type, "float' or 'int"),
      );
    }
    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }
    if (1 + num <= 0) {
      handleRuntimeError(
        context,
        new ValueError(source, command as ExprNS.Expr, context, "math_log1p"),
      );
    }

    const result = Math.log1p(num);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_log2", false)
  static math_log2(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, args[0].type, "float' or 'int"),
      );
    }
    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }
    if (num <= 0) {
      handleRuntimeError(
        context,
        new ValueError(source, command as ExprNS.Expr, context, "math_log2"),
      );
    }

    const result = Math.log2(num);
    return { type: "number", value: result };
  }

  @Validate(2, 2, "math_pow", false)
  static math_pow(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const base = args[0];
    const exp = args[1];

    if (!isNumeric(base)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, base.type, "float' or 'int"),
      );
    } else if (!isNumeric(exp)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, exp.type, "float' or 'int"),
      );
    }

    let baseNum: number;
    if (base.type === "number") {
      baseNum = base.value;
    } else {
      baseNum = Number(base.value);
    }

    let expNum: number;
    if (exp.type === "number") {
      expNum = exp.value;
    } else {
      expNum = Number(exp.value);
    }

    const result = Math.pow(baseNum, expNum);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_radians", false)
  static math_radians(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
      );
    }

    let deg: number;
    if (x.type === "number") {
      deg = x.value;
    } else {
      deg = Number(x.value);
    }

    const radians = (deg * Math.PI) / 180;
    return { type: "number", value: radians };
  }

  @Validate(1, 1, "math_sin", false)
  static math_sin(args: Value[], source: string, command: ControlItem, context: Context): Value {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
      );
    }

    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    const result = Math.sin(num);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_sinh", false)
  static math_sinh(args: Value[], source: string, command: ControlItem, context: Context): Value {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
      );
    }

    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    const result = Math.sinh(num);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_tan", false)
  static math_tan(args: Value[], source: string, command: ControlItem, context: Context): Value {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
      );
    }

    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    const result = Math.tan(num);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_tanh", false)
  static math_tanh(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
      );
    }

    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    const result = Math.tanh(num);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_sqrt", false)
  static math_sqrt(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, x.type, "float' or 'int"),
      );
    }

    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    if (num < 0) {
      handleRuntimeError(
        context,
        new ValueError(source, command as ExprNS.Expr, context, "math_sqrt"),
      );
    }

    const result = Math.sqrt(num);
    return { type: "number", value: result };
  }

  @Validate(2, null, "max", true)
  static max(args: Value[], source: string, command: ControlItem, context: Context): Value {
    const numericTypes = ["bigint", "number"];
    const firstType = args[0].type;
    const isNumericValue = numericTypes.includes(firstType);
    const isString = firstType === "string";

    for (let i = 1; i < args.length; i++) {
      const t = args[i].type;
      if (isNumericValue && !numericTypes.includes(t)) {
        handleRuntimeError(
          context,
          new TypeError(source, command as ExprNS.Expr, context, args[i].type, "float' or 'int"),
        );
      }
      if (isString && t !== "string") {
        handleRuntimeError(
          context,
          new TypeError(source, command as ExprNS.Expr, context, args[i].type, "string"),
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
            new TypeError(source, command as ExprNS.Expr, context, args[0].type, "float' or 'int"),
          );
        }
        let maxVal: number = Number(args[0].value);
        for (let i = 1; i < args.length; i++) {
          const arg = args[i];
          if (!isNumeric(arg)) {
            handleRuntimeError(
              context,
              new TypeError(source, command as ExprNS.Expr, context, arg.type, "float' or 'int"),
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
          handleRuntimeError(
            context,
            new TypeError(source, command as ExprNS.Expr, context, args[0].type, "int"),
          );
        }
        let maxVal: bigint = args[0].value;
        for (let i = 1; i < args.length; i++) {
          const arg = args[i];
          if (arg.type !== "bigint") {
            handleRuntimeError(
              context,
              new TypeError(source, command as ExprNS.Expr, context, arg.type, "int"),
            );
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
          new TypeError(source, command as ExprNS.Expr, context, args[0].type, "string"),
        );
      }
      let maxVal = args[0].value;
      for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg.type !== "string") {
          handleRuntimeError(
            context,
            new TypeError(source, command as ExprNS.Expr, context, arg.type, "string"),
          );
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
  static min(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 2) {
      handleRuntimeError(
        context,
        new MissingRequiredPositionalError(
          source,
          command as ExprNS.Expr,
          "min",
          Number(2),
          args,
          true,
        ),
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
          new TypeError(source, command as ExprNS.Expr, context, args[i].type, "float' or 'int"),
        );
      }
      if (isString && t !== "string") {
        handleRuntimeError(
          context,
          new TypeError(source, command as ExprNS.Expr, context, args[i].type, "string"),
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
            new TypeError(source, command as ExprNS.Expr, context, args[0].type, "float' or 'int"),
          );
        }
        let maxVal: number = Number(args[0].value);
        for (let i = 1; i < args.length; i++) {
          const arg = args[i];
          if (!isNumeric(arg)) {
            handleRuntimeError(
              context,
              new TypeError(source, command as ExprNS.Expr, context, arg.type, "float' or 'int"),
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
          handleRuntimeError(
            context,
            new TypeError(source, command as ExprNS.Expr, context, args[0].type, "int"),
          );
        }
        let maxVal: bigint = args[0].value;
        for (let i = 1; i < args.length; i++) {
          const arg = args[i];
          if (arg.type !== "bigint") {
            handleRuntimeError(
              context,
              new TypeError(source, command as ExprNS.Expr, context, arg.type, "int"),
            );
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
          new TypeError(source, command as ExprNS.Expr, context, args[0].type, "string"),
        );
      }
      let maxVal = args[0].value;
      for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg.type !== "string") {
          handleRuntimeError(
            context,
            new TypeError(source, command as ExprNS.Expr, context, arg.type, "string"),
          );
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
    _command: ControlItem,
    _context: Context,
  ): NumberValue {
    const result = Math.random();
    return { type: "number", value: result };
  }

  @Validate(1, 2, "round", true)
  static round(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
  ): NumberValue | BigIntValue {
    const numArg = args[0];
    if (!isNumeric(numArg)) {
      handleRuntimeError(
        context,
        new TypeError(source, command as ExprNS.Expr, context, numArg.type, "float' or 'int"),
      );
    }

    let ndigitsArg: BigIntValue = { type: "bigint", value: BigInt(0) };
    if (args.length === 2 && args[1].type !== "none") {
      if (args[1].type !== "bigint") {
        handleRuntimeError(
          context,
          new TypeError(source, command as ExprNS.Expr, context, args[1].type, "int"),
        );
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
    _command: ControlItem,
    _context: Context,
  ): NumberValue {
    const currentTime = Date.now();
    return { type: "number", value: currentTime };
  }

  @Validate(1, 1, "is_none", true)
  static is_none(
    args: Value[],
    _source: string,
    _command: ControlItem,
    _context: Context,
  ): BoolValue {
    const obj = args[0];
    return { type: "bool", value: obj.type === "none" };
  }

  @Validate(1, 1, "is_float", true)
  static is_float(
    args: Value[],
    _source: string,
    _command: ControlItem,
    _context: Context,
  ): BoolValue {
    const obj = args[0];
    return { type: "bool", value: obj.type === "number" };
  }

  @Validate(1, 1, "is_string", true)
  static is_string(
    args: Value[],
    _source: string,
    _command: ControlItem,
    _context: Context,
  ): BoolValue {
    const obj = args[0];
    return { type: "bool", value: obj.type === "string" };
  }

  @Validate(1, 1, "is_boolean", true)
  static is_boolean(
    args: Value[],
    _source: string,
    _command: ControlItem,
    _context: Context,
  ): BoolValue {
    const obj = args[0];
    return { type: "bool", value: obj.type === "bool" };
  }

  @Validate(1, 1, "is_complex", true)
  static is_complex(
    args: Value[],
    _source: string,
    _command: ControlItem,
    _context: Context,
  ): BoolValue {
    const obj = args[0];
    return { type: "bool", value: obj.type === "complex" };
  }

  @Validate(1, 1, "is_int", true)
  static is_int(
    args: Value[],
    _source: string,
    _command: ControlItem,
    _context: Context,
  ): BoolValue {
    const obj = args[0];
    return { type: "bool", value: obj.type === "bigint" };
  }

  @Validate(1, 1, "is_function", true)
  static is_function(
    args: Value[],
    _source: string,
    _command: ControlItem,
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
    _command: ControlItem,
    context: Context,
  ): Promise<Value> {
    const userInput = await receiveInput(context);
    return { type: "string", value: userInput };
  }

  static async print(
    args: Value[],
    _source: string,
    _command: ControlItem,
    context: Context,
  ): Promise<Value> {
    const output = args.map(arg => toPythonString(arg)).join(" ");
    await displayOutput(context, output);
    return { type: "none" };
  }
  static str(
    args: Value[],
    _source: string,
    _command: ControlItem,
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
    _command: ControlItem,
    _context: Context,
  ): StringValue {
    const obj = args[0];
    const result = toPythonString(obj, true);
    return { type: "string", value: result };
  }
}

import { ExprNS } from "./ast-types";
import { isFalsy } from "./engines/cse/operators";
import { isNumeric } from "./engines/cse/utils";
import py_s1_constants from "./stdlib/py_s1_constants.json";
import { PyComplexNumber } from "./types";

// NOTE: If we ever switch to another Python “chapter” (e.g. py_s2_constants),
//       just change the variable below to switch to the set.
const constants = py_s1_constants;

/*
    Create a map to hold built-in constants.
    Each constant is stored with a string key and its corresponding value object.
*/
export const builtInConstants = new Map<string, Value>();

const constantMap = {
  math_e: { type: "number", value: Math.E },
  math_inf: { type: "number", value: Infinity },
  math_nan: { type: "number", value: NaN },
  math_pi: { type: "number", value: Math.PI },
  math_tau: { type: "number", value: 2 * Math.PI },
} as const;

for (const name of constants.constants) {
  const valueObj = constantMap[name as keyof typeof constantMap];
  if (!valueObj) {
    throw new Error(`Constant '${name}' is not implemented`);
  }
  builtInConstants.set(name, valueObj);
}

/*
    Create a map to hold built-in functions.
    The keys are strings (function names) and the values are functions that can take any arguments.
*/
export const builtIns = new Map<string, BuiltinValue>();
for (const name of constants.builtInFuncs) {
  const impl = BuiltInFunctions[name as keyof BuiltInFunctions];
  if (typeof impl !== "function") {
    throw new Error(`BuiltInFunctions.${name} is not implemented`);
  }
  const builtinName = name.startsWith("_") ? name.substring(1) : name;
  builtIns.set(name, {
    type: "builtin",
    name: builtinName,
    func: impl,
    minArgs: minArgMap.get(name) || 0,
  });
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
