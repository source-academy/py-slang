import { ExprNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { handleRuntimeError } from "../engines/cse/error";
import { Value } from "../engines/cse/stash";
import { ValueError, ZeroDivisionError } from "../errors";
import { ModuleFunctions } from "../modules/moduleTypes";

export class CSEBreak {}

export class PyComplexNumber {
  public real: number;
  public imag: number;

  constructor(real: number, imag: number) {
    this.real = real;
    this.imag = imag;
  }

  public static fromNumber(value: number): PyComplexNumber {
    return new PyComplexNumber(value, 0);
  }

  public static fromBigInt(value: bigint): PyComplexNumber {
    return new PyComplexNumber(Number(value), 0);
  }

  public static fromString(str: string): PyComplexNumber {
    const originalStr = str;
    str = str.trim().replace(/_/g, "").toLowerCase();

    const parts = str.split(/(?<!e)(?=[+-])/, 2).filter(part => part !== "");
    const mappings = {
      infinity: Infinity,
      "+infinity": Infinity,
      "-infinity": -Infinity,
      inf: Infinity,
      "+inf": Infinity,
      "-inf": -Infinity,
      nan: NaN,
      "+nan": NaN,
      "-nan": NaN,
    };
    if (parts.length === 0) {
      throw new Error(`Invalid complex string: ${originalStr}`);
    }
    if (parts.length === 1) {
      const isImag = str.endsWith("j");
      if (str.endsWith("j")) {
        str = str.slice(0, -1);
        if (str == "" || str === "+" || str === "-") {
          return new PyComplexNumber(0, str === "-" ? -1 : 1);
        }
      }
      if (str in mappings) {
        const val = mappings[str as keyof typeof mappings];
        return new PyComplexNumber(isImag ? 0 : val, isImag ? val : 0);
      }
      const num = Number(str);
      if (isNaN(num)) {
        throw new Error(`Invalid complex string: ${originalStr}`);
      }
      return new PyComplexNumber(isImag ? 0 : num, isImag ? num : 0);
    }
    const [realPart, imagPart] = parts;
    const imagStr = imagPart.slice(0, -1);
    if (!imagPart.endsWith("j")) {
      throw new Error(`Invalid complex string: ${originalStr}`);
    }
    if (!(realPart in mappings) && isNaN(Number(realPart))) {
      throw new Error(`Invalid complex string: ${originalStr}`);
    }
    if (!(imagStr in mappings) && !["+", "-", ""].includes(imagStr) && isNaN(Number(imagStr))) {
      throw new Error(`Invalid complex string: ${originalStr}`);
    }
    const real =
      realPart in mappings ? mappings[realPart as keyof typeof mappings] : Number(realPart);
    const imag =
      imagStr in mappings
        ? mappings[imagStr as keyof typeof mappings]
        : imagStr === "+" || imagStr === ""
          ? 1
          : imagStr === "-"
            ? -1
            : Number(imagStr);
    return new PyComplexNumber(real, imag);
  }

  public static fromValue(
    context: Context,
    source: string,
    node: ExprNS.Expr,

    value: number | bigint | string | PyComplexNumber | boolean,
  ): PyComplexNumber {
    if (value instanceof PyComplexNumber) {
      return new PyComplexNumber(value.real, value.imag);
    }
    if (typeof value === "boolean") {
      return new PyComplexNumber(value ? 1 : 0, 0);
    }
    if (typeof value === "number") {
      return PyComplexNumber.fromNumber(value);
    }
    if (typeof value === "bigint") {
      return PyComplexNumber.fromBigInt(value);
    }
    try {
      return PyComplexNumber.fromString(value);
    } catch {
      handleRuntimeError(context, new ValueError(source, node, context, "complex"));
    }
  }

  /**
   * operations
   */
  public add(other: PyComplexNumber): PyComplexNumber {
    return new PyComplexNumber(this.real + other.real, this.imag + other.imag);
  }

  public sub(other: PyComplexNumber): PyComplexNumber {
    return new PyComplexNumber(this.real - other.real, this.imag - other.imag);
  }

  public mul(other: PyComplexNumber): PyComplexNumber {
    // (a+bi)*(c+di) = (ac - bd) + (bc + ad)i
    const realPart = this.real * other.real - this.imag * other.imag;
    const imagPart = this.real * other.imag + this.imag * other.real;
    return new PyComplexNumber(realPart, imagPart);
  }

  // https://github.com/python/cpython/blob/main/Objects/complexobject.c#L986
  // In the CPython source code, a branch algorithm is used for complex division.
  // It first compares the magnitudes of the dividend and divisor, and if some components are too large or too small,
  // appropriate scaling is applied before performing the operation.
  // This approach can significantly reduce overflow or underflow, thereby ensuring that the results remain more consistent with Python.
  public div(
    source: string,
    node: ExprNS.Binary,
    context: Context,
    other: PyComplexNumber,
  ): PyComplexNumber {
    // (a+bi)/(c+di) = ((a+bi)*(c-di)) / (c^2 + d^2)
    const denominator = other.real * other.real + other.imag * other.imag;
    if (denominator === 0) {
      handleRuntimeError(context, new ZeroDivisionError(source, node));
    }

    const a = this.real;
    const b = this.imag;
    const c = other.real;
    const d = other.imag;

    const absC = Math.abs(c);
    const absD = Math.abs(d);

    let real: number;
    let imag: number;
    if (absD < absC) {
      const ratio = d / c;
      const denom = c + d * ratio; // c + d*(d/c) = c + d^2/c
      real = (a + b * ratio) / denom;
      imag = (b - a * ratio) / denom;
    } else {
      const ratio = c / d;
      const denom = d + c * ratio; // d + c*(c/d) = d + c^2/d
      real = (a * ratio + b) / denom;
      imag = (b * ratio - a) / denom;
    }

    return new PyComplexNumber(real, imag);

    //const numerator = this.mul(new PyComplexNumber(other.real, -other.imag));
    //return new PyComplexNumber(numerator.real / denominator, numerator.imag / denominator);
  }

  public pow(other: PyComplexNumber): PyComplexNumber {
    // z = this (a+bi), w = other (A+Bi)
    const a = this.real;
    const b = this.imag;
    const A = other.real;
    const B = other.imag;

    const r = Math.sqrt(a * a + b * b);
    const theta = Math.atan2(b, a);

    if (r === 0) {
      // In Python, raising 0 to a negative or complex power raises an error.
      // For example, 0**(1j) in CPython directly raises ValueError: complex power.
      if (A < 0 || B !== 0) {
        throw new Error("0 cannot be raised to a negative or complex power");
      }
      // Otherwise, 0**(positive number) = 0.
      return new PyComplexNumber(0, 0);
    }

    const logR = Math.log(r);

    // realExpPart = A*ln(r) - B*theta
    // imagExpPart = B*ln(r) + A*theta
    const realExpPart = A * logR - B * theta;
    const imagExpPart = B * logR + A * theta;

    // e^(x + i y) = e^x [cos(y) + i sin(y)]
    const expOfReal = Math.exp(realExpPart);
    const c = expOfReal * Math.cos(imagExpPart);
    const d = expOfReal * Math.sin(imagExpPart);

    return new PyComplexNumber(c, d);
  }

  public toString(): string {
    if (this.real === 0) {
      return `${this.imag}j`;
    }
    // if (this.imag === 0) {
    //     return `${this.real}`;
    // }

    const sign = this.imag >= 0 ? "+" : "";

    // return `(${this.real}${sign}${this.imag}j)`;
    return `(${this.toPythonComplexFloat(this.real)}${sign}${this.toPythonComplexFloat(this.imag)}j)`;
  }

  /*
   * This function converts the real and imaginary parts of a complex number into strings.
   * In Python, float values (used for the real and imaginary parts) are formatted using scientific
   * notation when their absolute value is less than 1e-4 or at least 1e16. TypeScript's default
   * formatting thresholds differ, so here we explicitly enforce Python's behavior.
   *
   * The chosen bounds (1e-4 and 1e16) are derived from Python's internal formatting logic
   * (refer to the `format_float_short` function in CPython's pystrtod.c
   * (https://github.com/python/cpython/blob/main/Python/pystrtod.c)). This ensures that the
   * output of py-slang more closely matches that of native Python.
   */
  private toPythonComplexFloat(num: number) {
    if (num === Infinity) {
      return "inf";
    }
    if (num === -Infinity) {
      return "-inf";
    }

    // Force scientific notation for values < 1e-4 or ≥ 1e16 to mimic Python's float formatting behavior.
    if (Math.abs(num) >= 1e16 || (num !== 0 && Math.abs(num) < 1e-4)) {
      return num.toExponential().replace(/e([+-])(\d)$/, "e$10$2");
    }
    return num.toString();
  }

  public equals(other: PyComplexNumber): boolean {
    return Number(this.real) === Number(other.real) && Number(this.imag) === Number(other.imag);
  }
}

/**
 * Helper type to recursively make properties that are also objects
 * partial
 *
 * By default, `Partial<Array<T>>` is equivalent to `Array<T | undefined>`. For this type, `Array<T>` will be
 * transformed to Array<Partial<T>> instead
 */
export type RecursivePartial<T> =
  T extends Array<infer U>
    ? Array<RecursivePartial<U>>
    : T extends object
      ? Partial<{
          [K in keyof T]: RecursivePartial<T[K]>;
        }>
      : T;

// The CSE machine either finishes evaluating (to an error or a result) or it has a suspended evaluation.
export type Result = Finished | SuspendedCseEval;

export interface SuspendedCseEval {
  status: "suspended-cse-eval";
  context: Context;
}

export interface Finished {
  status: "finished";
  context: Context;
  value: Value;
}

export interface NativeStorage {
  builtins: Map<string, Value>;
  maxExecTime: number;
  loadedModules: Record<string, ModuleFunctions>;
  loadedModuleTypes: Record<string, Record<string, string>>;
}

export interface ModuleContext {
  state: null | unknown;
  tabs: null | unknown[];
}
