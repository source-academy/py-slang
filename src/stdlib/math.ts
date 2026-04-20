import { erf, gamma, lgamma } from "mathjs";
import { ExprNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { handleRuntimeError } from "../engines/cse/error";
import { BigIntValue, BoolValue, BuiltinValue, NumberValue, Value } from "../engines/cse/stash";
import { isNumeric } from "../engines/cse/utils";
import { TypeError, ValueError } from "../errors";
import { GroupName, minArgMap, Validate } from "./utils";

const mathBuiltins = new Map<string, Value>();

const constantMap = {
  math_e: { type: "number", value: Math.E },
  math_inf: { type: "number", value: Infinity },
  math_nan: { type: "number", value: NaN },
  math_pi: { type: "number", value: Math.PI },
  math_tau: { type: "number", value: 2 * Math.PI },
} as const;

export class MathBuiltins {
  @Validate(1, 1, "math_acos", false)
  static math_acos(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, x.type, "float' or 'int"),
      );
    }

    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    if (num < -1 || num > 1) {
      handleRuntimeError(context, new ValueError(source, command, context, "math_acos"));
    }

    const result = Math.acos(num);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_acosh", false)
  static math_acosh(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const x = args[0];

    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, x.type, "float' or 'int"),
      );
    }

    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    if (num < 1) {
      handleRuntimeError(context, new ValueError(source, command, context, "math_acosh"));
    }

    const result = Math.acosh(num);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_asin", false)
  static math_asin(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, x.type, "float' or 'int"),
      );
    }

    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    if (num < -1 || num > 1) {
      handleRuntimeError(context, new ValueError(source, command, context, "math_asin"));
    }

    const result = Math.asin(num);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_asinh", false)
  static math_asinh(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, x.type, "float' or 'int"),
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
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, x.type, "float' or 'int"),
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
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const y = args[0];
    const x = args[1];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, x.type, "float' or 'int"),
      );
    } else if (!isNumeric(y)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, y.type, "float' or 'int"),
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
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, x.type, "float' or 'int"),
      );
    }

    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    if (num <= -1 || num >= 1) {
      handleRuntimeError(context, new ValueError(source, command, context, "math_atanh"));
    }

    const result = Math.atanh(num);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_cos", false)
  static math_cos(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, x.type, "float' or 'int"),
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
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, x.type, "float' or 'int"),
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
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, x.type, "float' or 'int"),
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
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, x.type, "float' or 'int"),
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
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, x.type, "float' or 'int"),
      );
    }

    const erfc = 1 - MathBuiltins.math_erf([args[0]], source, command, context).value;

    return { type: "number", value: erfc };
  }

  @Validate(2, 2, "math_comb", false)
  static math_comb(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): BigIntValue {
    const n = args[0];
    const k = args[1];

    if (n.type !== "bigint") {
      handleRuntimeError(context, new TypeError(source, command, context, n.type, "int"));
    } else if (k.type !== "bigint") {
      handleRuntimeError(context, new TypeError(source, command, context, k.type, "int"));
    }

    const nVal = BigInt(n.value);
    const kVal = BigInt(k.value);

    if (nVal < 0 || kVal < 0) {
      handleRuntimeError(context, new ValueError(source, command, context, "math_comb"));
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
    command: ExprNS.Call,
    context: Context,
  ): BigIntValue {
    const n = args[0];

    if (n.type !== "bigint") {
      handleRuntimeError(context, new TypeError(source, command, context, n.type, "int"));
    }

    const nVal = BigInt(n.value);

    if (nVal < 0) {
      handleRuntimeError(context, new ValueError(source, command, context, "math_factorial"));
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
    command: ExprNS.Call,
    context: Context,
  ): BigIntValue {
    if (args.length === 0) {
      return { type: "bigint", value: BigInt(0) };
    }

    const values = args.map(v => {
      if (v.type !== "bigint") {
        handleRuntimeError(context, new TypeError(source, command, context, v.type, "int"));
      }
      return BigInt(v.value);
    });

    const allZero = values.every(val => val === BigInt(0));
    if (allZero) {
      return { type: "bigint", value: BigInt(0) };
    }

    let currentGcd: bigint = values[0] < 0 ? -values[0] : values[0];
    for (let i = 1; i < values.length; i++) {
      currentGcd = MathBuiltins._gcdOfTwo(currentGcd, values[i] < 0 ? -values[i] : values[i]);
      if (currentGcd === BigInt(1)) {
        break;
      }
    }

    return { type: "bigint", value: currentGcd };
  }

  static _gcdOfTwo(a: bigint, b: bigint): bigint {
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
    command: ExprNS.Call,
    context: Context,
  ): BigIntValue {
    const nValObj = args[0];
    if (nValObj.type !== "bigint") {
      handleRuntimeError(context, new TypeError(source, command, context, nValObj.type, "int"));
    }

    const n: bigint = nValObj.value;

    if (n < 0) {
      handleRuntimeError(context, new ValueError(source, command, context, "math_isqrt"));
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
    command: ExprNS.Call,
    context: Context,
  ): BigIntValue {
    if (args.length === 0) {
      return { type: "bigint", value: BigInt(1) };
    }

    const values = args.map(val => {
      if (val.type !== "bigint") {
        handleRuntimeError(context, new TypeError(source, command, context, val.type, "int"));
      }
      return BigInt(val.value);
    });

    if (values.some(v => v === BigInt(0))) {
      return { type: "bigint", value: BigInt(0) };
    }

    let currentLcm: bigint = MathBuiltins._absBigInt(values[0]);
    for (let i = 1; i < values.length; i++) {
      currentLcm = MathBuiltins._lcmOfTwo(currentLcm, MathBuiltins._absBigInt(values[i]));
      if (currentLcm === BigInt(0)) {
        break;
      }
    }

    return { type: "bigint", value: currentLcm };
  }

  static _lcmOfTwo(a: bigint, b: bigint): bigint {
    const gcdVal: bigint = MathBuiltins._gcdOfTwo(a, b);
    return BigInt((a / gcdVal) * b);
  }

  static _absBigInt(x: bigint): bigint {
    return x < 0 ? -x : x;
  }

  @Validate(1, 2, "math_perm", true)
  static math_perm(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): BigIntValue {
    const nValObj = args[0];
    if (nValObj.type !== "bigint") {
      handleRuntimeError(context, new TypeError(source, command, context, nValObj.type, "int"));
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
          new TypeError(source, command, context, kValObj.type, "int' or 'None"),
        );
      }
    }

    if (n < 0 || k < 0) {
      handleRuntimeError(context, new ValueError(source, command, context, "math_perm"));
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
    command: ExprNS.Call,
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

    handleRuntimeError(context, new TypeError(source, command, context, x.type, "float' or 'int"));
  }

  @Validate(1, 1, "math_fabs", false)
  static math_fabs(
    args: Value[],
    source: string,
    command: ExprNS.Call,
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
          new TypeError(source, command, context, x.type, "float' or 'int"),
        );
      }
      const absVal: number = Math.abs(numVal);
      return { type: "number", value: absVal };
    }

    handleRuntimeError(context, new TypeError(source, command, context, x.type, "float' or 'int"));
  }

  @Validate(1, 1, "math_floor", false)
  static math_floor(
    args: Value[],
    source: string,
    command: ExprNS.Call,
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
          new TypeError(source, command, context, x.type, "float' or 'int"),
        );
      }
      const floored: bigint = BigInt(Math.floor(numVal));
      return { type: "bigint", value: floored };
    }

    handleRuntimeError(context, new TypeError(source, command, context, x.type, "float' or 'int"));
  }

  // Computes the product of a and b along with the rounding error using Dekker's algorithm.
  static _twoProd(a: number, b: number): { prod: number; err: number } {
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
  static _twoSum(a: number, b: number): { sum: number; err: number } {
    const sum = a + b;
    const v = sum - a;
    const err = a - (sum - v) + (b - v);
    return { sum, err };
  }

  // Performs a fused multiply-add operation: computes (x * y) + z with a single rounding.
  static _fusedMultiplyAdd(x: number, y: number, z: number): number {
    const { prod, err: prodErr } = MathBuiltins._twoProd(x, y);
    const { sum, err: sumErr } = MathBuiltins._twoSum(prod, z);
    const result = sum + (prodErr + sumErr);
    return result;
  }

  static _toNumber(val: Value, source: string, command: ExprNS.Call, context: Context): number {
    if (val.type === "bigint") {
      return Number(val.value);
    } else if (val.type === "number") {
      return val.value;
    } else {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, val.type, "float' or 'int"),
      );
    }
  }

  @Validate(3, 3, "math_fma", false)
  static math_fma(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const xVal = MathBuiltins._toNumber(args[0], source, command, context);
    const yVal = MathBuiltins._toNumber(args[1], source, command, context);
    const zVal = MathBuiltins._toNumber(args[2], source, command, context);

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

    const result = MathBuiltins._fusedMultiplyAdd(xVal, yVal, zVal);
    return { type: "number", value: result };
  }

  @Validate(2, 2, "math_fmod", false)
  static math_fmod(args: Value[], source: string, command: ExprNS.Call, context: Context): Value {
    // Convert inputs to numbers
    const xVal = MathBuiltins._toNumber(args[0], source, command, context);
    const yVal = MathBuiltins._toNumber(args[1], source, command, context);

    // Divisor cannot be zero
    if (yVal === 0) {
      handleRuntimeError(context, new ValueError(source, command, context, "math_fmod"));
    }

    // JavaScript's % operator behaves similarly to C's fmod
    // in that the sign of the result is the same as the sign of x.
    // For corner cases (NaN, Infinity), JavaScript remainder
    // yields results consistent with typical C library fmod behavior.
    const remainder = xVal % yVal;

    return { type: "number", value: remainder };
  }

  static _roundToEven(num: number): number {
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
    command: ExprNS.Call,
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
        new TypeError(source, command, context, x.type, "float' or 'int"),
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
        new TypeError(source, command, context, y.type, "float' or 'int"),
      );
    }

    if (yValue === 0) {
      handleRuntimeError(context, new ValueError(source, command, context, "math_remainder"));
    }

    const quotient = xValue / yValue;
    const n = MathBuiltins._roundToEven(quotient);
    const remainder = xValue - n * yValue;

    return { type: "number", value: remainder };
  }

  @Validate(1, 1, "math_trunc", false)
  static math_trunc(args: Value[], source: string, command: ExprNS.Call, context: Context): Value {
    const x = args[0];

    if (x.type === "bigint") {
      return x;
    }

    if (x.type === "number") {
      const numVal: number = x.value;
      if (typeof numVal !== "number") {
        handleRuntimeError(
          context,
          new TypeError(source, command, context, x.type, "float' or 'int"),
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

    handleRuntimeError(context, new TypeError(source, command, context, x.type, "float' or 'int"));
  }

  @Validate(2, 2, "math_copysign", false)
  static math_copysign(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const [x, y] = args;

    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, x.type, "float' or 'int"),
      );
    } else if (!isNumeric(y)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, y.type, "float' or 'int"),
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
    command: ExprNS.Call,
    context: Context,
  ): BoolValue {
    const xValObj = args[0];
    if (!isNumeric(xValObj)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, xValObj.type, "float' or 'int"),
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
    command: ExprNS.Call,
    context: Context,
  ): BoolValue {
    const xValObj = args[0];
    if (!isNumeric(xValObj)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, xValObj.type, "float' or 'int"),
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
    command: ExprNS.Call,
    context: Context,
  ): BoolValue {
    const xValObj = args[0];
    if (!isNumeric(xValObj)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, xValObj.type, "float' or 'int"),
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
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const xVal = MathBuiltins._toNumber(args[0], source, command, context);

    if (args[1].type !== "bigint") {
      handleRuntimeError(context, new TypeError(source, command, context, args[1].type, "int"));
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
    _command: ExprNS.Call,
    _context: Context,
  ): Value {
    // TODO: Implement math_nextafter using proper bit-level manipulation and handling special cases (NaN, Infinity, steps, etc.)
    throw new Error("math_nextafter not implemented");
  }

  @Validate(1, 1, "math_ulp", false)
  static math_ulp(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): Value {
    // TODO: Implement math_ulp to return the unit in the last place (ULP) of the given floating-point number.
    throw new Error("math_ulp not implemented");
  }

  @Validate(1, 1, "math_cbrt", false)
  static math_cbrt(
    args: Value[],
    source: string,
    command: ExprNS.Call,
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
          new TypeError(source, command, context, xVal.type, "float' or 'int"),
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
    command: ExprNS.Call,
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
          new TypeError(source, command, context, xVal.type, "float' or 'int"),
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
    command: ExprNS.Call,
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
          new TypeError(source, command, context, xVal.type, "float' or 'int"),
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
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, x.type, "float' or 'int"),
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
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, x.type, "float' or 'int"),
      );
    }

    const z = MathBuiltins._toNumber(x, source, command, context);
    const result = gamma(z);

    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_lgamma", false)
  static math_lgamma(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, x.type, "float' or 'int"),
      );
    }

    const z = MathBuiltins._toNumber(x, source, command, context);
    const result = lgamma(z);

    return { type: "number", value: result };
  }

  @Validate(1, 2, "math_log", true)
  static math_log(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, x.type, "float' or 'int"),
      );
    }
    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    if (num <= 0) {
      handleRuntimeError(context, new ValueError(source, command, context, "math_log"));
    }

    if (args.length === 1) {
      return { type: "number", value: Math.log(num) };
    }

    const baseArg = args[1];
    if (!isNumeric(baseArg)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, baseArg.type, "float' or 'int"),
      );
    }
    let baseNum: number;
    if (baseArg.type === "number") {
      baseNum = baseArg.value;
    } else {
      baseNum = Number(baseArg.value);
    }
    if (baseNum <= 0) {
      handleRuntimeError(context, new ValueError(source, command, context, "math_log"));
    }

    const result = Math.log(num) / Math.log(baseNum);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_log10", false)
  static math_log10(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, args[0].type, "float' or 'int"),
      );
    }
    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }
    if (num <= 0) {
      handleRuntimeError(context, new ValueError(source, command, context, "math_log10"));
    }

    const result = Math.log10(num);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_log1p", false)
  static math_log1p(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, args[0].type, "float' or 'int"),
      );
    }
    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }
    if (1 + num <= 0) {
      handleRuntimeError(context, new ValueError(source, command, context, "math_log1p"));
    }

    const result = Math.log1p(num);
    return { type: "number", value: result };
  }

  @Validate(1, 1, "math_log2", false)
  static math_log2(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, args[0].type, "float' or 'int"),
      );
    }
    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }
    if (num <= 0) {
      handleRuntimeError(context, new ValueError(source, command, context, "math_log2"));
    }

    const result = Math.log2(num);
    return { type: "number", value: result };
  }

  @Validate(2, 2, "math_pow", false)
  static math_pow(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const base = args[0];
    const exp = args[1];

    if (!isNumeric(base)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, base.type, "float' or 'int"),
      );
    } else if (!isNumeric(exp)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, exp.type, "float' or 'int"),
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
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, x.type, "float' or 'int"),
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
  static math_sin(args: Value[], source: string, command: ExprNS.Call, context: Context): Value {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, x.type, "float' or 'int"),
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
  static math_sinh(args: Value[], source: string, command: ExprNS.Call, context: Context): Value {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, x.type, "float' or 'int"),
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
  static math_tan(args: Value[], source: string, command: ExprNS.Call, context: Context): Value {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, x.type, "float' or 'int"),
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
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, x.type, "float' or 'int"),
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
    command: ExprNS.Call,
    context: Context,
  ): NumberValue {
    const x = args[0];
    if (!isNumeric(x)) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, x.type, "float' or 'int"),
      );
    }

    let num: number;
    if (x.type === "number") {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    if (num < 0) {
      handleRuntimeError(context, new ValueError(source, command, context, "math_sqrt"));
    }

    const result = Math.sqrt(num);
    return { type: "number", value: result };
  }
}

for (const builtin of Object.getOwnPropertyNames(MathBuiltins)) {
  if (
    typeof MathBuiltins[builtin as keyof typeof MathBuiltins] === "function" &&
    !builtin.startsWith("_")
  ) {
    mathBuiltins.set(builtin, {
      type: "builtin",
      func: MathBuiltins[builtin as keyof typeof MathBuiltins] as BuiltinValue["func"],
      name: builtin,
      minArgs: minArgMap.get(builtin) || 0,
    });
  }
}
for (const [name, info] of Object.entries(constantMap)) {
  mathBuiltins.set(name, info);
}

export default {
  name: GroupName.MATH,
  prelude: "",
  builtins: mathBuiltins,
};
