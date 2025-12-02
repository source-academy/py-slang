import { Value } from './stash'
import { PyContext } from './py_context'
import { PyComplexNumber } from '../types'
import { UnsupportedOperandTypeError, ZeroDivisionError } from '../errors/py_errors'
import { ExprNS } from '../ast-types'
import { TokenType } from '../tokens'
import { pyHandleRuntimeError, pythonMod } from './py_utils'
import { operatorTranslator, typeTranslator } from './py_types'
import { Token } from '../tokenizer'
import { operandTranslator } from './utils'

export type BinaryOperator =
  | '=='
  | '!='
  | '==='
  | '!=='
  | '<'
  | '<='
  | '>'
  | '>='
  | '<<'
  | '>>'
  | '>>>'
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '**'
  | '|'
  | '^'
  | '&'
  | 'in'
  | 'instanceof'

// Helper function for truthiness based on Python rules
export function isFalsy(value: Value): boolean {
  switch (value.type) {
    case 'bigint':
      return value.value === 0n
    case 'number':
      return value.value === 0
    case 'bool':
      return !value.value
    case 'string':
      return value.value === ''
    case 'complex':
      return value.value.real === 0 && value.value.imag == 0
    case 'undefined': // Represents None
      return true
    default:
      // All other objects are considered truthy
      return false
  }
}

export function evaluateBoolExpression(
  code: string,
  command: ExprNS.Expr,
  context: PyContext,
  operator: TokenType,
  left: Value,
  right: Value
): Value {
  if (operator === TokenType.OR) {
    // Python 'or': if the first value is truthy, return it. Otherwise, evaluate and return the second value.
    return !isFalsy(left) ? left : right
  } else if (operator === TokenType.AND) {
    // Python 'and': if the first value is falsy, return it. Otherwise, evaluate and return the second value.
    return isFalsy(left) ? left : right
  } else {
    pyHandleRuntimeError(
      context,
      new UnsupportedOperandTypeError(
        code,
        command,
        typeTranslator(left.type),
        typeTranslator(right.type),
        operatorTranslator(operator)
      )
    )
    return { type: 'error', message: `Unreachable in evaluateBoolExpression}` }
  }
}

export function evaluateUnaryExpression(
  code: string,
  command: ExprNS.Expr,
  context: PyContext,
  operator: TokenType,
  value: Value
): Value {
  switch (operator) {
    case TokenType.NOT:
      return { type: 'bool', value: isFalsy(value) }

    case TokenType.MINUS:
      switch (value.type) {
        case 'number':
          return { type: 'number', value: -value.value }
        case 'bigint':
          return { type: 'bigint', value: -value.value }
        case 'bool':
          return { type: 'bigint', value: value.value ? -1n : 0n }
        case 'complex':
          return {
            type: 'complex',
            value: new PyComplexNumber(-value.value.real, -value.value.imag)
          }
        default:
          pyHandleRuntimeError(
            context,
            new UnsupportedOperandTypeError(
              code,
              command,
              value.type,
              '',
              operatorTranslator(operator)
            )
          )
          return { type: 'error', message: 'Unreachable in evaluateUnaryExpression - MINUS' }
      }

    case TokenType.PLUS:
      switch (value.type) {
        case 'number':
        case 'bigint':
        case 'complex':
          return value
        case 'bool':
          return { type: 'bigint', value: value.value ? 1n : 0n }
        default:
          pyHandleRuntimeError(
            context,
            new UnsupportedOperandTypeError(
              code,
              command,
              value.type,
              '',
              operatorTranslator(operator)
            )
          )
          return { type: 'error', message: 'Unreachable in evaluateUnaryExpression - PLUS' }
      }
  }
  return { type: 'error', message: 'Unreachable in evaluateUnaryExpression' }
}

// Remove __py_{operators} translation stage and switch case for readability
// TODO: do we need to string repetition like 'a' * 10?
export function evaluateBinaryExpression(
  code: string,
  command: ExprNS.Expr,
  context: PyContext,
  operator: TokenType,
  left: Value,
  right: Value
): Value {
  // Handle Complex numbers
  if (left.type === 'complex' || right.type === 'complex') {
    if (
      right.type !== 'complex' &&
      right.type !== 'number' &&
      right.type !== 'bigint' &&
      right.type !== 'bool'
    ) {
      pyHandleRuntimeError(
        context,
        new UnsupportedOperandTypeError(
          code,
          command,
          left.type,
          right.type,
          operatorTranslator(operator)
        )
      )
      return {
        type: 'error',
        message: 'Unreachable in evaluateBinaryExpression - complex | complex (start)'
      }
    }
    const leftComplex = PyComplexNumber.fromValue(left.value)
    const rightComplex = PyComplexNumber.fromValue(right.value)
    let result: PyComplexNumber

    switch (operator) {
      case TokenType.PLUS:
        result = leftComplex.add(rightComplex)
        break
      case TokenType.MINUS:
        result = leftComplex.sub(rightComplex)
        break
      case TokenType.STAR:
        result = leftComplex.mul(rightComplex)
        break
      case TokenType.SLASH:
        result = leftComplex.div(rightComplex)
        break
      case TokenType.DOUBLESTAR:
        result = leftComplex.pow(rightComplex)
        break
      case TokenType.DOUBLEEQUAL:
        return { type: 'bool', value: leftComplex.equals(rightComplex) }
      case TokenType.NOTEQUAL:
        return { type: 'bool', value: !leftComplex.equals(rightComplex) }
      default:
        pyHandleRuntimeError(
          context,
          new UnsupportedOperandTypeError(
            code,
            command,
            left.type,
            right.type,
            operatorTranslator(operator)
          )
        )
        return {
          type: 'error',
          message: 'Unreachable in evaluateBinaryExpression - complex | complex (end)'
        }
    }
    return { type: 'complex', value: result }
  }

  // Handle comparisons with None (represented as 'undefined' type)
  if (left.type === 'undefined' || right.type === 'undefined') {
    switch (operator) {
      case TokenType.DOUBLEEQUAL:
        // True only if both are None
        return { type: 'bool', value: left.type === right.type }
      case TokenType.NOTEQUAL:
        return { type: 'bool', value: left.type !== right.type }
      default:
        pyHandleRuntimeError(
          context,
          new UnsupportedOperandTypeError(
            code,
            command,
            left.type,
            right.type,
            operatorTranslator(operator)
          )
        )
        return {
          type: 'error',
          message: 'Unreachable in evaluateBinaryExpression - undefined | undefined'
        }
    }
  }

  // Handle string operations
  if (left.type === 'string' || right.type === 'string') {
    if (operator === TokenType.PLUS) {
      if (left.type === 'string' && right.type === 'string') {
        return { type: 'string', value: left.value + right.value }
      } else {
        pyHandleRuntimeError(
          context,
          new UnsupportedOperandTypeError(
            code,
            command,
            left.type,
            right.type,
            operatorTranslator(operator)
          )
        )
      }
    }
    if (left.type === 'string' && right.type === 'string') {
      switch (operator) {
        case TokenType.DOUBLEEQUAL:
          return { type: 'bool', value: left.value === right.value }
        case TokenType.NOTEQUAL:
          return { type: 'bool', value: left.value !== right.value }
        case TokenType.LESS:
          return { type: 'bool', value: left.value < right.value }
        case TokenType.LESSEQUAL:
          return { type: 'bool', value: left.value <= right.value }
        case TokenType.GREATER:
          return { type: 'bool', value: left.value > right.value }
        case TokenType.GREATEREQUAL:
          return { type: 'bool', value: left.value >= right.value }
      }
    }
    // TypeError: Reached if one is a string and the other is not
    pyHandleRuntimeError(
      context,
      new UnsupportedOperandTypeError(
        code,
        command,
        left.type,
        right.type,
        operatorTranslator(operator)
      )
    )
    return { type: 'error', message: 'Unreachable in evaluateBinaryExpression - string | string' }
  }

  /**
   * Coerce boolean to a numeric value for all other arithmetic
   * Support for True - 1 or False + 1
   */
  const leftNum = left.type === 'bool' ? (left.value ? 1 : 0) : left.value
  const rightNum = right.type === 'bool' ? (right.value ? 1 : 0) : right.value
  const leftType = left.type === 'bool' ? 'number' : left.type
  const rightType = right.type === 'bool' ? 'number' : right.type

  // Numeric Operations (number or bigint)
  switch (operator) {
    case TokenType.PLUS:
    case TokenType.MINUS:
    case TokenType.STAR:
    case TokenType.SLASH:
    case TokenType.DOUBLESLASH:
    case TokenType.PERCENT:
    case TokenType.DOUBLESTAR:
      if (leftType === 'number' || rightType === 'number') {
        const l = Number(leftNum)
        const r = Number(rightNum)
        switch (operator) {
          case TokenType.PLUS:
            return { type: 'number', value: l + r }
          case TokenType.MINUS:
            return { type: 'number', value: l - r }
          case TokenType.STAR:
            return { type: 'number', value: l * r }
          case TokenType.SLASH:
            if (r === 0) {
              pyHandleRuntimeError(context, new ZeroDivisionError(code, command, context))
            }
            return { type: 'number', value: l / r }
          case TokenType.DOUBLESLASH:
            if (r === 0) {
              pyHandleRuntimeError(context, new ZeroDivisionError(code, command, context))
            }
            return { type: 'number', value: Math.floor(l / r) }
          case TokenType.PERCENT:
            if (r === 0) {
              pyHandleRuntimeError(context, new ZeroDivisionError(code, command, context))
            }
            return { type: 'number', value: pythonMod(l, r) }
          case TokenType.DOUBLESTAR:
            if (l === 0 && r < 0) {
              pyHandleRuntimeError(context, new ZeroDivisionError(code, command, context))
            }
            return { type: 'number', value: l ** r }
        }
      }
      if (leftType === 'bigint' && rightType === 'bigint') {
        const l = leftNum as bigint
        const r = rightNum as bigint
        switch (operator) {
          case TokenType.PLUS:
            return { type: 'bigint', value: l + r }
          case TokenType.MINUS:
            return { type: 'bigint', value: l - r }
          case TokenType.STAR:
            return { type: 'bigint', value: l * r }
          case TokenType.SLASH:
            if (r === 0n) {
              pyHandleRuntimeError(context, new ZeroDivisionError(code, command, context))
            }
            return { type: 'number', value: Number(l) / Number(r) }
          case TokenType.DOUBLESLASH:
            if (r === 0n) {
              pyHandleRuntimeError(context, new ZeroDivisionError(code, command, context))
            }
            return { type: 'bigint', value: (l - (pythonMod(l, r) as bigint)) / r }
          case TokenType.PERCENT:
            if (r === 0n) {
              pyHandleRuntimeError(context, new ZeroDivisionError(code, command, context))
            }
            return { type: 'bigint', value: pythonMod(l, r) }
          case TokenType.DOUBLESTAR:
            if (l === 0n && r < 0n) {
              pyHandleRuntimeError(context, new ZeroDivisionError(code, command, context))
            }
            if (r < 0n) return { type: 'number', value: Number(l) ** Number(r) }
            return { type: 'bigint', value: l ** r }
        }
      }
      break

    // Comparison Operators
    case TokenType.DOUBLEEQUAL:
    case TokenType.NOTEQUAL:
    case TokenType.LESS:
    case TokenType.LESSEQUAL:
    case TokenType.GREATER:
    case TokenType.GREATEREQUAL: {
      const cmp = pyCompare(left, right)
      let result: boolean
      switch (operator) {
        case TokenType.DOUBLEEQUAL:
          result = cmp === 0
          break
        case TokenType.NOTEQUAL:
          result = cmp !== 0
          break
        case TokenType.LESS:
          result = cmp < 0
          break
        case TokenType.LESSEQUAL:
          result = cmp <= 0
          break
        case TokenType.GREATER:
          result = cmp > 0
          break
        case TokenType.GREATEREQUAL:
          result = cmp >= 0
          break
        default:
          return { type: 'error', message: 'Unreachable in evaluateBinaryExpression - comparison' }
      }
      return { type: 'bool', value: result }
    }
  }
  return { type: 'error', message: 'todo error' }
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

function pyCompare(val1: Value, val2: Value): number {
  // Handle same type comparisons first
  if (val1.type === 'bigint' && val2.type === 'bigint') {
    if (val1.value < val2.value) return -1
    if (val1.value > val2.value) return 1
    return 0
  }
  if (val1.type === 'number' && val2.type === 'number') {
    if (val1.value < val2.value) return -1
    if (val1.value > val2.value) return 1
    return 0
  }

  // int_num.value < float_num.value => -1
  // int_num.value = float_num.value => 0
  // int_num.value > float_num.value => 1
  let int_val: bigint
  let float_val: number

  if (val1.type === 'bigint' && val2.type === 'number') {
    int_val = val1.value
    float_val = val2.value
  } else if (val1.type === 'number' && val2.type === 'bigint') {
    int_val = val2.value
    float_val = val1.value
    // for swapped order, swap the result of comparison here
    return -pyCompare(val2, val1)
  } else {
    return 0
  }

  // If float_num is positive Infinity, then int_num is considered smaller.
  if (float_val === Infinity) {
    return -1
  }
  if (float_val === -Infinity) {
    return 1
  }

  const signInt = int_val < 0n ? -1 : int_val > 0n ? 1 : 0
  const signFlt = Math.sign(float_val) // -1, 0, or 1

  if (signInt < signFlt) return -1 // e.g. int<0, float>=0 => int < float
  if (signInt > signFlt) return 1 // e.g. int>=0, float<0 => int > float

  // Both have the same sign (including 0).
  // If both are zero, treat them as equal.
  if (signInt === 0 && signFlt === 0) {
    return 0
  }

  // Both are either positive or negative.
  // If |int_num.value| is within 2^53, it can be safely converted to a JS number for an exact comparison.
  const absInt = int_val < 0n ? -int_val : int_val
  const MAX_SAFE = 9007199254740991 // 2^53 - 1

  if (absInt <= MAX_SAFE) {
    // Safe conversion to double.
    const intAsNum = Number(int_val)
    const diff = intAsNum - float_val
    if (diff === 0) return 0
    return diff < 0 ? -1 : 1
  }

  // For large integers exceeding 2^53, need to distinguish more carefully.
  // Determine the order of magnitude of float_num.value (via log10) and compare it with
  // the number of digits of int_num.value. An approximate comparison can indicate whether
  // int_num.value is greater or less than float_num.value.

  // First, check if float_num.value is nearly zero (but not zero).
  if (float_val === 0) {
    // Although signFlt would be 0 and handled above, just to be safe:
    return signInt
  }

  const absFlt = Math.abs(float_val)
  // Determine the order of magnitude.
  const exponent = Math.floor(Math.log10(absFlt))

  // Get the decimal string representation of the absolute integer.
  const intStr = absInt.toString()
  const intDigits = intStr.length

  // If exponent + 1 is less than intDigits, then |int_num.value| has more digits
  // and is larger (if positive) or smaller (if negative) than float_num.value.
  // Conversely, if exponent + 1 is greater than intDigits, int_num.value has fewer digits.
  const integerPartLen = exponent + 1
  if (integerPartLen < intDigits) {
    // length of int_num.value is larger => all positive => int_num.value > float_num.value
    //                => all negative => int_num.value < float_num.value
    return signInt > 0 ? 1 : -1
  } else if (integerPartLen > intDigits) {
    // length of int_num.value is smaller => all positive => int_num.value < float_num.value
    //                => all negative => int_num.value > float_num.value
    return signInt > 0 ? -1 : 1
  } else {
    // If the number of digits is the same, they may be extremely close.
    // Method: Convert float_num.value into an approximate BigInt string and perform a lexicographical comparison.
    const floatApproxStr = approximateBigIntString(absFlt, 30)

    const aTrim = intStr.replace(/^0+/, '')
    const bTrim = floatApproxStr.replace(/^0+/, '')

    // If lengths differ after trimming, the one with more digits is larger.
    if (aTrim.length > bTrim.length) {
      return signInt > 0 ? 1 : -1
    } else if (aTrim.length < bTrim.length) {
      return signInt > 0 ? -1 : 1
    } else {
      // Same length: use lexicographical comparison.
      const cmp = aTrim.localeCompare(bTrim)
      if (cmp === 0) {
        return 0
      }
      // cmp>0 => aTrim > bTrim => aVal > bVal
      return cmp > 0 ? (signInt > 0 ? 1 : -1) : signInt > 0 ? -1 : 1
    }
  }
}

function approximateBigIntString(num: number, precision: number): string {
  // Use scientific notation to obtain a string in the form "3.333333333333333e+49"
  const s = num.toExponential(precision)
  // Split into mantissa and exponent parts.
  // The regular expression matches strings of the form: /^([\d.]+)e([+\-]\d+)$/
  const match = s.match(/^([\d.]+)e([+\-]\d+)$/)
  if (!match) {
    // For extremely small or extremely large numbers, toExponential() should follow this format.
    // As a fallback, return Math.floor(num).toString()
    return Math.floor(num).toString()
  }
  let mantissaStr = match[1] // "3.3333333333..."
  const exp = parseInt(match[2], 10) // e.g. +49

  // Remove the decimal point
  mantissaStr = mantissaStr.replace('.', '')
  // Get the current length of the mantissa string
  const len = mantissaStr.length
  // Calculate the required integer length: for exp ≥ 0, we want the integer part
  // to have (1 + exp) digits.
  const integerLen = 1 + exp
  if (integerLen <= 0) {
    // This indicates num < 1 (e.g., exponent = -1, mantissa = "3" results in 0.xxx)
    // For big integer comparison, such a number is very small, so simply return "0"
    return '0'
  }

  if (len < integerLen) {
    // The mantissa is not long enough; pad with zeros at the end.
    return mantissaStr.padEnd(integerLen, '0')
  }
  // If the mantissa is too long, truncate it (this is equivalent to taking the floor).
  // Rounding could be applied if necessary, but truncation is sufficient for comparison.
  return mantissaStr.slice(0, integerLen)
}
