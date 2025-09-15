import { Value } from "./stash";
import { PyContext } from "./py_context";
import { PyComplexNumber } from "../types";
import { TypeConcatenateError, UnsupportedOperandTypeError, ZeroDivisionError } from "../errors/errors";
import { ExprNS } from "../ast-types";
import { TokenType } from "../tokens";
import { handleRuntimeError, operandTranslator, pythonMod, typeTranslator } from "./py_utils";
import { Token } from "../tokenizer";

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

function pyCompare(val1 : Value, val2 : Value): number {
    // int_num.value < float_num.value => -1
    // int_num.value = float_num.value => 0
    // int_num.value > float_num.value => 1
    let int_val: bigint;
    let float_val: number;

    if (val1.type === 'bigint' && val2.type === 'number') {
        int_val = val1.value;
        float_val = val2.value;
    } else if (val1.type === 'number' && val2.type === 'bigint') {
        int_val = val2.value;
        float_val = val1.value;
        // for swapped order, swap the result of comparison here
        return -pyCompare(val2, val1);
    } else {
        return 0;
    }

    // If float_num is positive Infinity, then int_num is considered smaller.
    if (float_val === Infinity) {
        return -1;
    }
    if (float_val === -Infinity) {
        return 1;
    }

    const signInt = (int_val < 0n) ? -1 : (int_val > 0n ? 1 : 0);
    const signFlt = Math.sign(float_val);  // -1, 0, or 1

    if (signInt < signFlt) return -1;  // e.g. int<0, float>=0 => int < float
    if (signInt > signFlt) return 1;   // e.g. int>=0, float<0 => int > float
    
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
        return (signInt > 0) ? 1 : -1;
    } else if (integerPartLen > intDigits) {
        // length of int_num.value is smaller => all positive => int_num.value < float_num.value
        //                => all negative => int_num.value > float_num.value
        return (signInt > 0) ? -1 : 1;
    } else {
        // If the number of digits is the same, they may be extremely close.
        // Method: Convert float_num.value into an approximate BigInt string and perform a lexicographical comparison.
        const floatApproxStr = approximateBigIntString(absFlt, 30);
        
        const aTrim = intStr.replace(/^0+/, '');
        const bTrim = floatApproxStr.replace(/^0+/, '');

        // If lengths differ after trimming, the one with more digits is larger.
        if (aTrim.length > bTrim.length) {
            return (signInt > 0) ? 1 : -1;
        } else if (aTrim.length < bTrim.length) {
            return (signInt > 0) ? -1 : 1;
        } else {
        // Same length: use lexicographical comparison.
        const cmp = aTrim.localeCompare(bTrim);
        if (cmp === 0) {
            return 0;
        }
        // cmp>0 => aTrim > bTrim => aVal > bVal
        return (cmp > 0) ? (signInt > 0 ? 1 : -1)
                        : (signInt > 0 ? -1 : 1);
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
    mantissaStr = mantissaStr.replace('.', ''); 
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
        return mantissaStr.padEnd(integerLen, '0');
    }
    // If the mantissa is too long, truncate it (this is equivalent to taking the floor).
    // Rounding could be applied if necessary, but truncation is sufficient for comparison.
    return mantissaStr.slice(0, integerLen);
}

// Changed operator from es.UnaryOperator to TokenType
// Added parameters command and context for error handling
// updated logics for TokenType.NOT [3]
export function evaluateUnaryExpression(operator: TokenType, value: Value, command: ExprNS.Expr, context: PyContext): Value {
    if (operator === TokenType.NOT) {
        let isFalsy: boolean;
        switch (value.type) {
            case 'bigint':
                isFalsy = value.value === 0n;
                break;
            case 'number':
                isFalsy = value.value === 0;
                break;
            case 'bool':
                isFalsy = !value.value;
                break;
            case 'string':
                isFalsy = value.value === '';
                break;
            case 'undefined':
                isFalsy = true;
                break;
            default:
                // TODO: consider strings, list as truthy if exists
                // Implement falsy for empty strings..etc
                isFalsy = false;
        }return {type: 'bool', value: isFalsy}

    } else if (operator === TokenType.MINUS) {
        if (value.type === 'bigint') {
            return {
                type: 'bigint',
                value: -1n * value.value 
            };
        } else if (value.type === 'number') {
            return {
                type: 'number',
                value: -value.value
            };
        } else {
            // TODO: error handling for unsupported type
            // TODO: command is currently passed as "any", to be adjusted in future commits[from #2]
            // handleRuntimeError(context, new UnsupportedOperandTypeError("", command as any, typeTranslator(value.type), "", operandTranslator(operator)))
        }
    } else if (operator === TokenType.PLUS) {
        if (value.type === 'complex' || value.type === 'number' || value.type === 'bigint') {
            return value;
        } else {
            // TODO: error handling for unsupported type
            // TODO: command is currently passed as "any", to be adjusted in future commits[from #2]
            // handleRuntimeError(context, new UnsupportedOperandTypeError("", command as any, typeTranslator(value.type), "", operandTranslator(operator)))
        }
    }
    // final fallback
    // handleRuntimeError
    return { type: "error", message: 'unreachable' };
}

// Change command from "ControlItem" to "ExprNS.Expr", "identifier" to "operator" for type safety
export function evaluateBinaryExpression(code: string, command: ExprNS.Expr, context: PyContext, operator: TokenType | string, left: Value, right: Value): Value {
    
    const operand = operandTranslator(operator);
    const originalLeftType = typeTranslator(left.type);
    const originalRightType = typeTranslator(right.type);

    // String Operations
    if (left.type === 'string' && right.type === 'string') {
        if(operator === '__py_adder') {
            return { type: 'string', value: left.value + right.value };
        } else if (operator === TokenType.GREATER) {
            return { type: 'bool', value: left.value > right.value };
        } else if (operator === TokenType.GREATEREQUAL) {
            return { type: 'bool', value: left.value >= right.value };
        } else if (operator === TokenType.LESS) {
            return { type: 'bool', value: left.value < right.value };
        } else if (operator === TokenType.LESSEQUAL) {
            return { type: 'bool', value: left.value <= right.value };
        } else if (operator === TokenType.DOUBLEEQUAL) {
            return { type: 'bool', value: left.value === right.value };
        } else if (operator === TokenType.NOTEQUAL) {
            return { type: 'bool', value: left.value !== right.value };
        } else {
            // handleRuntimeError(context, new UnsupportedOperandTypeError(code, command as any, originalLeftType, originalRightType, operand));
            return { type: 'error', message: 'Unsupported string operation' }
        }
    }
    // Complex Operations
    else if (left.type === 'complex' || right.type ==='complex'){
        let leftForComplex: number | bigint | string | PyComplexNumber;
        let rightForComplex: number | bigint | string | PyComplexNumber;

        if (left.type === 'complex' || left.type === 'number' || left.type === 'bigint' || left.type === 'string') {
            leftForComplex = left.value;
        } else {
            // handleRuntimeError
            return { type: 'error', message: 'Invalid operand for complex operation' };
        }

        if (right.type === 'complex' || right.type === 'number' || right.type === 'bigint' || right.type === 'string') {
            rightForComplex = right.value;
        } else {
            // handleRuntimeError
            return { type: 'error', message: 'Invalid operand for complex operation' };
        }
        
        const leftComplex = PyComplexNumber.fromValue(leftForComplex);
        const rightComplex = PyComplexNumber.fromValue(rightForComplex);
        let result: PyComplexNumber;

        if (operator === '__py_adder') {
            result = leftComplex.add(rightComplex);
        } else if (operator === '__py_minuser') {
            result = leftComplex.sub(rightComplex);
        } else if (operator === '__py_multiplier') {
            result = leftComplex.mul(rightComplex);
        } else if (operator === '__py_divider') {
            result = leftComplex.div(rightComplex);
        } else if (operator === '__py_powerer') {
            result = leftComplex.pow(rightComplex);
        } else if (operator === TokenType.DOUBLEEQUAL) {
            return { type: 'bool', value: leftComplex.equals(rightComplex)};
        } else if (operator === TokenType.NOTEQUAL) {
            return { type: 'bool', value: !leftComplex.equals(rightComplex)};
        } else {
            // handleRuntimeError
            return {type: 'error', message: 'Unsupported complex operation'};
        } return {type: 'complex', value: result};
    } 
    // bool and numeric operations
    else if ((left.type === 'bool' && (right.type === 'number' || right.type === 'bigint' || right.type === 'bool')) ||
            (right.type === 'bool' && (left.type === 'number' || left.type === 'bigint' || left.type === 'bool'))) {
    
        const leftNum = left.type === 'bool' ? (left.value ? 1 : 0) : Number(left.value);
        const rightNum = right.type === 'bool' ? (right.value ? 1 : 0) : Number(right.value);
        let result: number | boolean;
        
        // Arithmetic
        if (typeof operator === 'string') { 
            if (operator === '__py_adder') result = leftNum + rightNum;
            else if (operator === '__py_minuser') result = leftNum - rightNum;
            else if (operator === '__py_multiplier') result = leftNum * rightNum;
            else if (operator === '__py_divider') {
                if (rightNum === 0) {
                    // handleRuntimeError(context, new ZeroDivisionError(code, command, context));
                    return { type: 'error', message: 'Division by zero' };
                }
                result = leftNum / rightNum;
            }
            else if (operator === '__py_powerer') result = leftNum ** rightNum;
            else if (operator === '__py_modder') result = pythonMod(leftNum, rightNum);
            else {
                // handleRuntimeError(context, new UnsupportedOperandTypeError(code, command, originalLeftType, originalRightType, operand));
                return { type: 'error', message: 'Unsupported boolean/numeric operation' };
            }
            const resultType = (left.type === 'number' || right.type === 'number') ? 'number' : 'bigint';
            return { type: resultType, value: resultType === 'bigint' ? BigInt(result) : result };
        }
        // Comparisons
        else { 
            if (operator === TokenType.GREATER) result = leftNum > rightNum;
            else if (operator === TokenType.GREATEREQUAL) result = leftNum >= rightNum;
            else if (operator === TokenType.LESS) result = leftNum < rightNum;
            else if (operator === TokenType.LESSEQUAL) result = leftNum <= rightNum;
            else if (operator === TokenType.DOUBLEEQUAL) result = leftNum === rightNum;
            else if (operator === TokenType.NOTEQUAL) result = leftNum !== rightNum;
            else {
                // handleRuntimeError(context, new UnsupportedOperandTypeError(code, command, originalLeftType, originalRightType, operand));
                return { type: 'error', message: 'Unsupported boolean/numeric comparison' };
            }
            return { type: 'bool', value: result };
        }
    }
    // Float and or Int Operations
    else if ((left.type === 'number' || left.type === 'bigint') && (right.type === 'number' || right.type === 'bigint')) {
        if (left.type === 'number' || right.type === 'number' || operator === '__py_divider') {
            const leftFloat = Number(left.value);
            const rightFloat = Number(right.value);
                let result: number | boolean;

            // Arithmetic
            if (typeof operator === 'string') {
                if (operator === '__py_adder') result = leftFloat + rightFloat;
                else if (operator === '__py_minuser') result = leftFloat - rightFloat;
                else if (operator === '__py_multiplier') result = leftFloat * rightFloat;
                else if (operator === '__py_divider') {
                    if (rightFloat === 0) {
                        // handleRuntimeError(context, new ZeroDivisionError(code, command, context));
                    return { type: 'error', message: 'Division by zero' };
                    }
                    result = leftFloat / rightFloat;
                }
                else if (operator === '__py_powerer') result = leftFloat ** rightFloat;
                else if (operator === '__py_modder') {
                    if (rightFloat === 0) {
                        // handleRuntimeError(context, new UnsupportedOperandTypeError(code, command, originalLeftType, originalRightType, operand));
                        return { type: 'error', message: 'Division by zero' };
                    }
                    result = pythonMod(leftFloat, rightFloat);
                } else {
                    // handleRuntimeError(context, new UnsupportedOperandTypeError(code, command, originalLeftType, originalRightType, operand));
                    return { type: 'error', message: 'Unsupported float comparison' };
                }
                return { type: 'number', value: result };
            }
            // Comparisons
            else {
                const compare_res = pyCompare(left, right);
                if (operator === TokenType.GREATER) result = compare_res > 0;
                else if (operator === TokenType.GREATEREQUAL) result = compare_res >= 0;
                else if (operator === TokenType.LESS) result = compare_res < 0;
                else if (operator === TokenType.LESSEQUAL) result = compare_res <= 0;
                else if (operator === TokenType.DOUBLEEQUAL) result = compare_res === 0;
                else if (operator === TokenType.NOTEQUAL) result = compare_res !== 0;
                else {
                    // handleRuntimeError(context, new UnsupportedOperandTypeError(code, command, originalLeftType, originalRightType, operand));
                    return { type: 'error', message: 'Unsupported float comparison' };
                    }
                return { type: 'bool', value: result };
            }
    } 
    // Same type Integer Operations
    else if (left.type === 'bigint' && right.type ==='bigint') {    
        const leftBigInt = left.value as bigint;
        const rightBigInt = right.value as bigint;
        let result: bigint | boolean;

        if (operator === '__py_adder') {
            return { type: 'bigint', value: leftBigInt + rightBigInt };
        } else if (operator === '__py_minuser') {
            return { type: 'bigint', value: leftBigInt - rightBigInt };
        } else if (operator === '__py_multiplier') {
            return { type: 'bigint', value: leftBigInt * rightBigInt };
        } else if (operator === '__py_divider') {
            if (rightBigInt === 0n) {
                // handleRunTimeError - ZeroDivisionError
                return { type: 'error', message: 'Division by zero' } ;
            }
            return { type: 'number', value: Number(leftBigInt) / Number(rightBigInt) };
        } else if (operator === '__py_powerer') {
            if (leftBigInt === 0n && rightBigInt < 0) {
                // handleRunTimeError, zerodivision error
                return { type: 'error', message: '0.0 cannot be raised to a negative power'}
            }
            if (rightBigInt < 0) {
                return {type: 'number', value: Number(leftBigInt) ** Number(rightBigInt) };
            }
            return { type: 'bigint', value: leftBigInt ** rightBigInt };
        } else if (operator === '__py_modder') {
            if (rightBigInt === 0n) {
                // handleRunTimeError - ZeroDivisionError
                return { type: 'error', message: 'integer modulo by zero' } ;
            }
            return { type: 'bigint', value: pythonMod(leftBigInt, rightBigInt) }; 
        } else if (operator === TokenType.GREATER) {
            return { type: 'bool', value: leftBigInt > rightBigInt };
        } else if (operator === TokenType.GREATEREQUAL) {
            return { type: 'bool', value: leftBigInt >= rightBigInt };
        } else if (operator === TokenType.LESS) {
            return { type: 'bool', value: leftBigInt < rightBigInt };
        } else if (operator === TokenType.LESSEQUAL) {
            return { type: 'bool', value: leftBigInt <= rightBigInt };
        } else if (operator === TokenType.DOUBLEEQUAL) {
            return { type: 'bool', value: leftBigInt === rightBigInt };
        } else if (operator === TokenType.NOTEQUAL) {
            return { type: 'bool', value: leftBigInt !== rightBigInt };
        }
        // handleRuntimeError
        return { type: 'error', message: 'Unsupported operation' };
        }    
    }
}
