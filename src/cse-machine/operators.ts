import * as es from 'estree'
import {
  handleRuntimeError,
  isIdentifier,
  operandTranslator,
  pythonMod,
  typeTranslator
} from './utils'
import { Context } from './context'
import { PyComplexNumber } from '../types'
import {
  TypeConcatenateError,
  UnsupportedOperandTypeError,
  ZeroDivisionError
} from '../errors/errors'
import { ControlItem } from './control'

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

export function evaluateUnaryExpression(operator: es.UnaryOperator, value: any) {
  if (operator === '!') {
    if (value.type === 'bool') {
      return {
        type: 'bool',
        value: !Boolean(value.value)
      }
    } else {
      // TODO: error
    }
  } else if (operator === '-') {
    if (value.type === 'bigint') {
      return {
        type: 'bigint',
        value: -value.value
      }
    } else if (value.type === 'number') {
      return {
        type: 'number',
        value: -Number(value.value)
      }
    } else {
      // TODO: error
    }
  } else if (operator === 'typeof') {
    return {
      type: String,
      value: typeof value.value
    }
  } else {
    return value
  }
}

export function evaluateBinaryExpression(
  code: string,
  command: ControlItem,
  context: Context,
  identifier: any,
  left: any,
  right: any
) {
  let operandName: any
  const originalLeftType = typeTranslator(left.type)
  const originalRightType = typeTranslator(right.type)
  if (isIdentifier(identifier)) {
    operandName = identifier.name
  } else {
    operandName = identifier
  }
  const operand = operandTranslator(operandName)
  if (left.type === 'string' && right.type === 'string') {
    if (isIdentifier(identifier) && identifier.name === '__py_adder') {
      return {
        type: 'string',
        value: left.value + right.value
      }
    } else {
      let ret_type: any
      let ret_value: any
      if (identifier === '>') {
        ret_value = left.value > right.value
      } else if (identifier === '>=') {
        ret_value = left.value >= right.value
      } else if (identifier === '<') {
        ret_value = left.value < right.value
      } else if (identifier === '<=') {
        ret_value = left.value <= right.value
      } else if (identifier === '===') {
        ret_value = left.value === right.value
      } else if (identifier === '!==') {
        ret_value = left.value !== right.value
      } else {
        handleRuntimeError(
          context,
          new UnsupportedOperandTypeError(
            code,
            command as es.Node,
            originalLeftType,
            originalRightType,
            operand
          )
        )
      }

      return {
        type: 'bool',
        value: ret_value
      }
    }
  } else {
    // numbers: only int and float, not bool
    const numericTypes = ['number', 'bigint', 'complex']
    if (!numericTypes.includes(left.type) || !numericTypes.includes(right.type)) {
      handleRuntimeError(
        context,
        new UnsupportedOperandTypeError(
          code,
          command as es.Node,
          originalLeftType,
          originalRightType,
          operand
        )
      )
    }

    let originalLeft = { type: left.type, value: left.value }
    let originalRight = { type: right.type, value: right.value }

    if (left.type !== right.type) {
      if (left.type === 'complex' || right.type === 'complex') {
        left.type = 'complex'
        right.type = 'complex'
        left.value = PyComplexNumber.fromValue(left.value)
        right.value = PyComplexNumber.fromValue(right.value)
      } else if (left.type === 'number' || right.type === 'number') {
        left.type = 'number'
        right.type = 'number'
        left.value = Number(left.value)
        right.value = Number(right.value)
      }
    }

    let ret_value: any
    let ret_type: any = left.type

    if (isIdentifier(identifier)) {
      if (identifier.name === '__py_adder') {
        if (left.type === 'complex' || right.type === 'complex') {
          const leftComplex = PyComplexNumber.fromValue(left.value)
          const rightComplex = PyComplexNumber.fromValue(right.value)
          ret_value = leftComplex.add(rightComplex)
        } else {
          ret_value = left.value + right.value
        }
      } else if (identifier.name === '__py_minuser') {
        if (left.type === 'complex' || right.type === 'complex') {
          const leftComplex = PyComplexNumber.fromValue(left.value)
          const rightComplex = PyComplexNumber.fromValue(right.value)
          ret_value = leftComplex.sub(rightComplex)
        } else {
          ret_value = left.value - right.value
        }
      } else if (identifier.name === '__py_multiplier') {
        if (left.type === 'complex' || right.type === 'complex') {
          const leftComplex = PyComplexNumber.fromValue(left.value)
          const rightComplex = PyComplexNumber.fromValue(right.value)
          ret_value = leftComplex.mul(rightComplex)
        } else {
          ret_value = left.value * right.value
        }
      } else if (identifier.name === '__py_divider') {
        if (left.type === 'complex' || right.type === 'complex') {
          const leftComplex = PyComplexNumber.fromValue(left.value)
          const rightComplex = PyComplexNumber.fromValue(right.value)
          ret_value = leftComplex.div(rightComplex)
        } else {
          if (
            (right.type === 'bigint' && Number(right.value) !== 0) ||
            (right.type === 'number' && right.value !== 0)
          ) {
            ret_type = 'number'
            ret_value = Number(left.value) / Number(right.value)
          } else {
            handleRuntimeError(context, new ZeroDivisionError(code, command as es.Node, context))
          }
        }
      } else if (identifier.name === '__py_modder') {
        if (left.type === 'complex') {
          handleRuntimeError(
            context,
            new UnsupportedOperandTypeError(
              code,
              command as es.Node,
              originalLeftType,
              originalRightType,
              operand
            )
          )
        }
        ret_value = pythonMod(left.value, right.value)
      } else if (identifier.name === '__py_floorer') {
        // TODO: floorer not in python now
        // see math_floor in stdlib.ts
        ret_value = 0
      } else if (identifier.name === '__py_powerer') {
        if (left.type === 'complex') {
          const leftComplex = PyComplexNumber.fromValue(left.value)
          const rightComplex = PyComplexNumber.fromValue(right.value)
          ret_value = leftComplex.pow(rightComplex)
        } else {
          if (left.type === 'bigint' && right.value < 0) {
            ret_value = Number(left.value) ** Number(right.value)
            ret_type = 'number'
          } else {
            ret_value = left.value ** right.value
          }
        }
      } else {
        handleRuntimeError(
          context,
          new UnsupportedOperandTypeError(
            code,
            command as es.Node,
            originalLeftType,
            originalRightType,
            operand
          )
        )
      }
    } else {
      ret_type = 'bool'
      // one of them is complex, convert all to complex then compare
      // for complex, only '==' and '!=' valid
      if (left.type === 'complex') {
        const leftComplex = PyComplexNumber.fromValue(left.value)
        const rightComplex = PyComplexNumber.fromValue(right.value)

        if (identifier === '===') {
          ret_value = leftComplex.equals(rightComplex)
        } else if (identifier === '!==') {
          ret_value = !leftComplex.equals(rightComplex)
        } else {
          handleRuntimeError(
            context,
            new UnsupportedOperandTypeError(
              code,
              command as es.Node,
              originalLeftType,
              originalRightType,
              operand
            )
          )
        }
      } else if (originalLeft.type !== originalRight.type) {
        let int_num: any
        let floatNum: any
        let compare_res
        if (originalLeft.type === 'bigint') {
          int_num = originalLeft
          floatNum = originalRight
          compare_res = pyCompare(int_num, floatNum)
        } else {
          int_num = originalRight
          floatNum = originalLeft
          compare_res = -pyCompare(int_num, floatNum)
        }

        if (identifier === '>') {
          ret_value = compare_res > 0
        } else if (identifier === '>=') {
          ret_value = compare_res >= 0
        } else if (identifier === '<') {
          ret_value = compare_res < 0
        } else if (identifier === '<=') {
          ret_value = compare_res <= 0
        } else if (identifier === '===') {
          ret_value = compare_res === 0
        } else if (identifier === '!==') {
          ret_value = compare_res !== 0
        } else {
          handleRuntimeError(
            context,
            new UnsupportedOperandTypeError(
              code,
              command as es.Node,
              originalLeftType,
              originalRightType,
              operand
            )
          )
        }
      } else {
        if (identifier === '>') {
          ret_value = left.value > right.value
        } else if (identifier === '>=') {
          ret_value = left.value >= right.value
        } else if (identifier === '<') {
          ret_value = left.value < right.value
        } else if (identifier === '<=') {
          ret_value = left.value <= right.value
        } else if (identifier === '===') {
          ret_value = left.value === right.value
        } else if (identifier === '!==') {
          ret_value = left.value !== right.value
        } else {
          handleRuntimeError(
            context,
            new UnsupportedOperandTypeError(
              code,
              command as es.Node,
              originalLeftType,
              originalRightType,
              operand
            )
          )
        }
      }
    }

    return {
      type: ret_type,
      value: ret_value
    }
  }
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
function pyCompare(int_num: any, float_num: any) {
  // int_num.value < float_num.value => -1
  // int_num.value = float_num.value => 0
  // int_num.value > float_num.value => 1

  // If float_num is positive Infinity, then int_num is considered smaller.
  if (float_num.value === Infinity) {
    return -1
  }
  if (float_num.value === -Infinity) {
    return 1
  }

  const signInt = int_num.value < 0 ? -1 : int_num.value > 0 ? 1 : 0
  const signFlt = Math.sign(float_num.value) // -1, 0, or 1

  if (signInt < signFlt) return -1 // e.g. int<0, float>=0 => int < float
  if (signInt > signFlt) return 1 // e.g. int>=0, float<0 => int > float

  // Both have the same sign (including 0).
  // If both are zero, treat them as equal.
  if (signInt === 0 && signFlt === 0) {
    return 0
  }

  // Both are either positive or negative.
  // If |int_num.value| is within 2^53, it can be safely converted to a JS number for an exact comparison.
  const absInt = int_num.value < 0 ? -int_num.value : int_num.value
  const MAX_SAFE = 9007199254740991 // 2^53 - 1

  if (absInt <= MAX_SAFE) {
    // Safe conversion to double.
    const intAsNum = Number(int_num.value)
    const diff = intAsNum - float_num.value
    if (diff === 0) return 0
    return diff < 0 ? -1 : 1
  }

  // For large integers exceeding 2^53, need to distinguish more carefully.
  // Determine the order of magnitude of float_num.value (via log10) and compare it with
  // the number of digits of int_num.value. An approximate comparison can indicate whether
  // int_num.value is greater or less than float_num.value.

  // First, check if float_num.value is nearly zero (but not zero).
  if (float_num.value === 0) {
    // Although signFlt would be 0 and handled above, just to be safe:
    return signInt
  }

  const absFlt = Math.abs(float_num.value)
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
