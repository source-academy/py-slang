import { ExprNS } from "../../ast-types";
import { UnsupportedOperandTypeError, ZeroDivisionError } from "../../errors/errors";
import { TokenType } from "../../tokenizer";
import { PyComplexNumber } from "../../types";
import { Context } from "./context";
import { handleRuntimeError } from "./error";
import { BigIntValue, NumberValue, Value } from "./stash";
import { operatorTranslator } from "./types";
import { isCoercedComplex, isNumeric, pythonMod } from "./utils";

export type BinaryOperator =
  | "=="
  | "!="
  | "==="
  | "!=="
  | "<"
  | "<="
  | ">"
  | ">="
  | "<<"
  | ">>"
  | ">>>"
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "**"
  | "|"
  | "^"
  | "&"
  | "in"
  | "instanceof";

/**
 * Evaluates a unary expression with the given operator and operand value, following Python semantics.
 * @param code The original source code being evaluated
 * @param command The AST node corresponding to the unary expression
 * @param context The global context state
 * @param operator The operator of the unary expression (e.g., TokenType.MINUS for negation)
 * @param value The operand value to apply the unary operator to
 * @returns The result of the unary operation
 */
export function evaluateUnaryExpression(
  code: string,
  command: ExprNS.Unary,
  context: Context,
  operator: TokenType,
  value: Value,
): Value {
  switch (operator) {
    case TokenType.NOT:
      // The `not` operator can only be applied to booleans
      if (value.type === "bool") {
        return { type: "bool", value: isFalsy(value) };
      }
      handleRuntimeError(
        context,
        new UnsupportedOperandTypeError(
          code,
          command,
          value.type,
          "",
          operatorTranslator(operator),
        ),
      );

    case TokenType.MINUS:
      switch (value.type) {
        case "number":
          return { type: "number", value: -value.value };
        case "bigint":
          return { type: "bigint", value: -value.value };
        case "complex":
          return {
            type: "complex",
            value: new PyComplexNumber(-value.value.real, -value.value.imag),
          };
        default:
          handleRuntimeError(
            context,
            new UnsupportedOperandTypeError(
              code,
              command,
              value.type,
              "",
              operatorTranslator(operator),
            ),
          );
      }
    case TokenType.PLUS:
      switch (value.type) {
        case "number":
        case "bigint":
        case "complex":
          return value;
        default:
          handleRuntimeError(
            context,
            new UnsupportedOperandTypeError(
              code,
              command,
              value.type,
              "",
              operatorTranslator(operator),
            ),
          );
      }
    default:
      handleRuntimeError(
        context,
        new UnsupportedOperandTypeError(
          code,
          command,
          value.type,
          "",
          operatorTranslator(operator),
        ),
      );
  }
}

/**
 * Handles equality and inequality comparisons between any two non-list values, following Python §3 semantics.
 * This compares to the logic for Python §1 and §2 where equality and inequality for non-list values only applied to values of the same type.
 *
 * @param code The original source code being evaluated
 * @param command The AST node corresponding to the binary expression
 * @param context The global context state
 * @param operator The operator of the binary expression (either TokenType.DOUBLEEQUAL for equality or TokenType.NOTEQUAL for inequality)
 * @param left The left operand value
 * @param right The right operand value
 * @returns The result of the equality comparison
 */
export function handleExpandedEquality(
  code: string,
  command: ExprNS.Binary,
  context: Context,
  operator: TokenType,
  left: Value,
  right: Value,
): Value {
  // List equality is not supported via the equality operators, only via `is`.
  if (left.type == "list" && right.type == "list") {
    handleRuntimeError(
      context,
      new UnsupportedOperandTypeError(
        code,
        command,
        left.type,
        right.type,
        operatorTranslator(operator),
      ),
    );
  }

  // Handle complex number equality
  if (left.type == "complex" || right.type == "complex") {
    if (!isCoercedComplex(left) || !isCoercedComplex(right)) {
      return { type: "bool", value: operator == TokenType.NOTEQUAL };
    }
    return {
      type: "bool",
      value:
        (operator == TokenType.NOTEQUAL) !==
        PyComplexNumber.fromValue(context, code, command, left.value).equals(
          PyComplexNumber.fromValue(context, code, command, right.value),
        ),
    };
  }

  // Handle ints and floats
  if (isNumeric(left) && isNumeric(right)) {
    return {
      type: "bool",
      value: (operator == TokenType.NOTEQUAL) !== (pyCompare(left, right) === 0),
    };
  }

  // If two types are different, they are not equal
  if (left.type != right.type) {
    return { type: "bool", value: operator == TokenType.NOTEQUAL };
  }

  // Some types have value-based equality (e.g. strings), while others have reference-based equality (e.g. lists).
  if ("value" in left && "value" in right) {
    return { type: "bool", value: (left.value === right.value) !== (operator == TokenType.NOTEQUAL) };
    
  }
  return { type: "bool", value: (operator == TokenType.NOTEQUAL) !== (left == right) };
}

/**
 * The main function for evaluating a binary expression, which dispatches to the appropriate logic based on the operator and operand types.
 * This includes handling of complex numbers, string concatenation and comparison, numeric operations, and expanded equality semantics for Python §3.
 * @param code The original source code being evaluated
 * @param command The AST node corresponding to the binary expression
 * @param context The global context state
 * @param operator The operator of the binary expression (e.g., TokenType.PLUS for addition)
 * @param left The left operand value
 * @param right The right operand value
 * @param variant The Python variant being evaluated (1, 2, 3 or 4), which may affect the semantics of certain operators (e.g., equality)
 * @returns The result of the binary operation
 */
export function evaluateBinaryExpression(
  code: string,
  command: ExprNS.Binary,
  context: Context,
  operator: TokenType,
  left: Value,
  right: Value,
  variant: number,
): Value {
  // Handle expanded equality semantics for Python §3,
  // where equality and inequality comparisons between non-list values of different types are allowed
  if ((operator == TokenType.DOUBLEEQUAL || operator == TokenType.NOTEQUAL) && variant >= 3) {
    return handleExpandedEquality(code, command, context, operator, left, right);
  }

  // Handle Complex numbers
  if (left.type === "complex" || right.type === "complex") {
    if (!isCoercedComplex(right) || !isCoercedComplex(left)) {
      handleRuntimeError(
        context,
        new UnsupportedOperandTypeError(
          code,
          command,
          left.type,
          right.type,
          operatorTranslator(operator),
        ),
      );
    }
    const leftComplex = PyComplexNumber.fromValue(context, code, command, left.value);
    const rightComplex = PyComplexNumber.fromValue(context, code, command, right.value);
    let result: PyComplexNumber;

    switch (operator) {
      case TokenType.PLUS:
        result = leftComplex.add(rightComplex);
        break;
      case TokenType.MINUS:
        result = leftComplex.sub(rightComplex);
        break;
      case TokenType.STAR:
        result = leftComplex.mul(rightComplex);
        break;
      case TokenType.SLASH:
        result = leftComplex.div(code, command, context, rightComplex);
        break;
      case TokenType.DOUBLESTAR:
        result = leftComplex.pow(rightComplex);
        break;
      case TokenType.DOUBLEEQUAL:
        return { type: "bool", value: leftComplex.equals(rightComplex) };
      case TokenType.NOTEQUAL:
        return { type: "bool", value: !leftComplex.equals(rightComplex) };
      default:
        handleRuntimeError(
          context,
          new UnsupportedOperandTypeError(
            code,
            command,
            left.type,
            right.type,
            operatorTranslator(operator),
          ),
        );
    }
    return { type: "complex", value: result };
  }

  // Handle comparisons with None (represented as 'none' type)
  if (left.type === "none" || right.type === "none") {
    handleRuntimeError(
      context,
      new UnsupportedOperandTypeError(
        code,
        command,
        left.type,
        right.type,
        operatorTranslator(operator),
      ),
    );
  }

  // Handle list operations (only referential equality)
  if (left.type == "list" || right.type == "list") {
    if (operator == TokenType.IS && right.type === "list" && left.type === "list") {
      return { type: "bool", value: left === right };
    }
    handleRuntimeError(
      context,
      new UnsupportedOperandTypeError(
        code,
        command,
        left.type,
        right.type,
        operatorTranslator(operator),
      ),
    );
  }

  // Handle string operations
  if (left.type === "string" || right.type === "string") {
    if (operator === TokenType.PLUS) {
      if (left.type === "string" && right.type === "string") {
        return { type: "string", value: left.value + right.value };
      } else {
        handleRuntimeError(
          context,
          new UnsupportedOperandTypeError(
            code,
            command,
            left.type,
            right.type,
            operatorTranslator(operator),
          ),
        );
      }
    }
    if (left.type === "string" && right.type === "string") {
      switch (operator) {
        case TokenType.DOUBLEEQUAL:
          return { type: "bool", value: left.value === right.value };
        case TokenType.NOTEQUAL:
          return { type: "bool", value: left.value !== right.value };
        case TokenType.LESS:
          return { type: "bool", value: left.value < right.value };
        case TokenType.LESSEQUAL:
          return { type: "bool", value: left.value <= right.value };
        case TokenType.GREATER:
          return { type: "bool", value: left.value > right.value };
        case TokenType.GREATEREQUAL:
          return { type: "bool", value: left.value >= right.value };
      }
    }
    // TypeError: Reached if one is a string and the other is not
    handleRuntimeError(
      context,
      new UnsupportedOperandTypeError(
        code,
        command,
        left.type,
        right.type,
        operatorTranslator(operator),
      ),
    );
  }

  if (!isNumeric(left) || !isNumeric(right)) {
    handleRuntimeError(
      context,
      new UnsupportedOperandTypeError(
        code,
        command,
        left.type,
        right.type,
        operatorTranslator(operator),
      ),
    );
  }

  // Numeric Operations (number or bigint)
  switch (operator) {
    case TokenType.PLUS:
    case TokenType.MINUS:
    case TokenType.STAR:
    case TokenType.SLASH:
    case TokenType.DOUBLESLASH:
    case TokenType.PERCENT:
    case TokenType.DOUBLESTAR:
      // If either operand is a number, perform the operation with numbers (with potential loss of precision for bigints),
      // otherwise perform the operation using bigints if both operands are bigints. This mimics Python's behavior of coercing to float for mixed int/float operations,
      // while allowing for arbitrary precision with bigints.
      if (left.type === "number" || right.type === "number") {
        const l = Number(left.value);
        const r = Number(right.value);
        switch (operator) {
          case TokenType.PLUS:
            return { type: "number", value: l + r };
          case TokenType.MINUS:
            return { type: "number", value: l - r };
          case TokenType.STAR:
            return { type: "number", value: l * r };
          case TokenType.SLASH:
            if (r === 0) {
              handleRuntimeError(context, new ZeroDivisionError(code, command));
            }
            return { type: "number", value: l / r };
          case TokenType.DOUBLESLASH:
            if (r === 0) {
              handleRuntimeError(context, new ZeroDivisionError(code, command));
            }
            return { type: "number", value: Math.floor(l / r) };
          case TokenType.PERCENT:
            if (r === 0) {
              handleRuntimeError(context, new ZeroDivisionError(code, command));
            }
            const mod = pythonMod(l, r);
            if (typeof mod === "bigint") {
              return { type: "bigint", value: mod };
            }
            return { type: "number", value: mod };
          case TokenType.DOUBLESTAR:
            if (l === 0 && r < 0) {
              handleRuntimeError(context, new ZeroDivisionError(code, command));
            }
            return { type: "number", value: l ** r };
        }
      }
      if (left.type === "bigint" && right.type === "bigint") {
        const l = left.value;
        const r = right.value;
        switch (operator) {
          case TokenType.PLUS:
            return { type: "bigint", value: l + r };
          case TokenType.MINUS:
            return { type: "bigint", value: l - r };
          case TokenType.STAR:
            return { type: "bigint", value: l * r };
          case TokenType.SLASH:
            if (r === 0n) {
              handleRuntimeError(context, new ZeroDivisionError(code, command));
            }
            return { type: "number", value: Number(l) / Number(r) };
          case TokenType.DOUBLESLASH:
            if (r === 0n) {
              handleRuntimeError(context, new ZeroDivisionError(code, command));
            }
            return { type: "bigint", value: (l - (pythonMod(l, r))) / r };
          case TokenType.PERCENT:
            if (r === 0n) {
              handleRuntimeError(context, new ZeroDivisionError(code, command));
            }
            const mod = pythonMod(l, r);
            if (typeof mod === "bigint") {
              return { type: "bigint", value: mod };
            }
            return { type: "number", value: mod };
          case TokenType.DOUBLESTAR:
            if (l === 0n && r < 0n) {
              handleRuntimeError(context, new ZeroDivisionError(code, command));
            }
            if (r < 0n) return { type: "number", value: Number(l) ** Number(r) };
            return { type: "bigint", value: l ** r };
        }
      }
      break;

    // Comparison Operators
    case TokenType.DOUBLEEQUAL:
    case TokenType.NOTEQUAL:
    case TokenType.LESS:
    case TokenType.LESSEQUAL:
    case TokenType.GREATER:
    case TokenType.GREATEREQUAL: {
      const cmp = pyCompare(left, right);
      let result: boolean;
      switch (operator) {
        case TokenType.DOUBLEEQUAL:
          result = cmp === 0;
          break;
        case TokenType.NOTEQUAL:
          result = cmp !== 0;
          break;
        case TokenType.LESS:
          result = cmp < 0;
          break;
        case TokenType.LESSEQUAL:
          result = cmp <= 0;
          break;
        case TokenType.GREATER:
          result = cmp > 0;
          break;
        case TokenType.GREATEREQUAL:
          result = cmp >= 0;
          break;
        default:
          return { type: "error", message: "Unreachable in evaluateBinaryExpression - comparison" };
      }
      return { type: "bool", value: result };
    }
  }
  handleRuntimeError(
    context,
    new UnsupportedOperandTypeError(
      code,
      command,
      left.type,
      right.type,
      operatorTranslator(operator),
    ),
  );
}

/**
 * TEMPORARY IMPLEMENTATION
 * This function is a simplified comparison between int and float
 * to mimic Python-like ordering semantics.
 *
 * TODO: In future, replace this with proper method dispatch to
 * __eq__, __lt__, __gt__, etc., according to Python's object model.
 *
 * pyCompare: Compares a Python-style big integer (int_num) with a float (float_num),
 * returning -1, 0, or 1 for less-than, equal, or greater-than.
 *
 * This logic follows CPython's approach in floatobject.c, ensuring Python-like semantics:
 *
 * 1. Special Values:
 *    - If float_num is inf, any finite int_num is smaller (returns -1).
 *    - If float_num is -inf, any finite int_num is larger (returns 1).
 *
 * 2. Compare by Sign:
 *    - Determine each number’s sign (negative, zero, or positive). If they differ, return based on sign.
 *    - If both are zero, treat them as equal.
 *
 * 3. Safe Conversion:
 *    - If |int_num| <= 2^53, safely convert it to a double and do a normal floating comparison.
 *
 * 4. Handling Large Integers:
 *    - For int_num beyond 2^53, approximate the magnitudes via exponent/bit length.
 *    - Compare the integer’s digit count with float_num’s order of magnitude.
 *
 * 5. Close Cases:
 *    - If both integer and float have the same digit count, convert float_num to a “big-int-like” string
 *      (approximateBigIntString) and compare lexicographically to int_num’s string.
 *
 * By layering sign checks, safe numeric range checks, and approximate comparisons,
 * we achieve a Python-like ordering of large integers vs floats.
 */
function pyCompare(val1: NumberValue | BigIntValue, val2: NumberValue | BigIntValue): number {
  // Handle same type comparisons first
  if (val1.type === "bigint" && val2.type === "bigint") {
    if (val1.value < val2.value) return -1;
    if (val1.value > val2.value) return 1;
    return 0;
  }
  if (val1.type === "number" && val2.type === "number") {
    if (val1.value < val2.value) return -1;
    if (val1.value > val2.value) return 1;
    return 0;
  }
  let int_val: bigint;
  let float_val: number;
  if (val1.type === "bigint" && val2.type === "number") {
    int_val = val1.value;
    float_val = val2.value;
  } else if (val1.type === "number" && val2.type === "bigint") {
    int_val = val2.value;
    float_val = val1.value;
    // for swapped order, swap the result of comparison here
    return -pyCompare(val2, val1);
  } else {
    return 0;
  }
  // int_num.value < float_num.value => -1
  // int_num.value = float_num.value => 0
  // int_num.value > float_num.value => 1

  // If float_num is positive Infinity, then int_num is considered smaller.
  if (float_val === Infinity) {
    return -1;
  }
  if (float_val === -Infinity) {
    return 1;
  }

  const signInt = int_val < 0n ? -1 : int_val > 0n ? 1 : 0;
  const signFlt = Math.sign(float_val); // -1, 0, or 1

  if (signInt < signFlt) return -1; // e.g. int<0, float>=0 => int < float
  if (signInt > signFlt) return 1; // e.g. int>=0, float<0 => int > float

  // Both have the same sign (including 0).
  // If both are zero, treat them as equal.
  if (signInt === 0 && signFlt === 0) {
    return 0;
  }

  // Both are either positive or negative.
  // If |int_num.value| is within 2^53, it can be safely converted to a JS number for an exact comparison.
  const absInt = int_val < 0n ? -int_val : int_val;
  const MAX_SAFE = 9007199254740991; // 2^53 - 1

  if (absInt <= MAX_SAFE) {
    // Safe conversion to double.
    const intAsNum = Number(int_val);
    const diff = intAsNum - float_val;
    if (diff === 0) return 0;
    return diff < 0 ? -1 : 1;
  }

  // For large integers exceeding 2^53, need to distinguish more carefully.
  // Determine the order of magnitude of float_num.value (via log10) and compare it with
  // the number of digits of int_num.value. An approximate comparison can indicate whether
  // int_num.value is greater or less than float_num.value.

  // First, check if float_num.value is nearly zero (but not zero).
  if (float_val === 0) {
    // Although signFlt would be 0 and handled above, just to be safe:
    return signInt;
  }

  const absFlt = Math.abs(float_val);
  // Determine the order of magnitude.
  const exponent = Math.floor(Math.log10(absFlt));

  // Get the decimal string representation of the absolute integer.
  const intStr = absInt.toString();
  const intDigits = intStr.length;

  // If exponent + 1 is less than intDigits, then |int_num.value| has more digits
  // and is larger (if positive) or smaller (if negative) than float_num.value.
  // Conversely, if exponent + 1 is greater than intDigits, int_num.value has fewer digits.
  const integerPartLen = exponent + 1;
  if (integerPartLen < intDigits) {
    // length of int_num.value is larger => all positive => int_num.value > float_num.value
    //                => all negative => int_num.value < float_num.value
    return signInt > 0 ? 1 : -1;
  } else if (integerPartLen > intDigits) {
    // length of int_num.value is smaller => all positive => int_num.value < float_num.value
    //                => all negative => int_num.value > float_num.value
    return signInt > 0 ? -1 : 1;
  } else {
    // If the number of digits is the same, they may be extremely close.
    // Method: Convert float_num.value into an approximate BigInt string and perform a lexicographical comparison.
    const floatApproxStr = approximateBigIntString(absFlt, 30);

    const aTrim = intStr.replace(/^0+/, "");
    const bTrim = floatApproxStr.replace(/^0+/, "");

    // If lengths differ after trimming, the one with more digits is larger.
    if (aTrim.length > bTrim.length) {
      return signInt > 0 ? 1 : -1;
    } else if (aTrim.length < bTrim.length) {
      return signInt > 0 ? -1 : 1;
    } else {
      // Same length: use lexicographical comparison.
      const cmp = aTrim.localeCompare(bTrim);
      if (cmp === 0) {
        return 0;
      }
      // cmp>0 => aTrim > bTrim => aVal > bVal
      return cmp > 0 ? (signInt > 0 ? 1 : -1) : signInt > 0 ? -1 : 1;
    }
  }
}

function approximateBigIntString(num: number, precision: number): string {
  // Use scientific notation to obtain a string in the form "3.333333333333333e+49"
  const s = num.toExponential(precision);
  // Split into mantissa and exponent parts.
  // The regular expression matches strings of the form: /^([\d.]+)e([+\-]\d+)$/
  const match = s.match(/^([\d.]+)e([+\-]\d+)$/);
  if (!match) {
    // For extremely small or extremely large numbers, toExponential() should follow this format.
    // As a fallback, return Math.floor(num).toString()
    return Math.floor(num).toString();
  }
  let mantissaStr = match[1]; // "3.3333333333..."
  const exp = parseInt(match[2], 10); // e.g. +49

  // Remove the decimal point
  mantissaStr = mantissaStr.replace(".", "");
  // Get the current length of the mantissa string
  const len = mantissaStr.length;
  // Calculate the required integer length: for exp ≥ 0, we want the integer part
  // to have (1 + exp) digits.
  const integerLen = 1 + exp;
  if (integerLen <= 0) {
    // This indicates num < 1 (e.g., exponent = -1, mantissa = "3" results in 0.xxx)
    // For big integer comparison, such a number is very small, so simply return "0"
    return "0";
  }

  if (len < integerLen) {
    // The mantissa is not long enough; pad with zeros at the end.
    return mantissaStr.padEnd(integerLen, "0");
  }
  // If the mantissa is too long, truncate it (this is equivalent to taking the floor).
  // Rounding could be applied if necessary, but truncation is sufficient for comparison.
  return mantissaStr.slice(0, integerLen);
}

export function isFalsy(value: Value): boolean {
  switch (value.type) {
    case "bigint":
      return value.value === 0n;
    case "number":
      return value.value === 0;
    case "bool":
      return !value.value;
    case "string":
      return value.value === "";
    case "complex":
      return value.value.real === 0 && value.value.imag == 0;
    case "none": // Represents None
      return true;
    default:
      // All other objects are considered truthy
      return false;
  }
}
