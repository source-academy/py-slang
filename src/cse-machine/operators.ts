import * as es from "estree";
import { handleRuntimeError, isIdentifier, pythonMod } from "./utils";
import { Context } from "./context";
import * as error from "../errors/errors"
import { PyComplexNumber } from "../types";

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



// export function evaluateBinaryExpression(operator: BinaryOperator, left: any, right: any) {
//     switch (operator) {
//       case '+':
//         return left + right
//       case '-':
//         return left - right
//       case '*':
//         return left * right
//       case '/':
//         return left / right
//       case '%':
//         return left % right
//       case '===':
//         return left === right
//       case '!==':
//         return left !== right
//       case '<=':
//         return left <= right
//       case '<':
//         return left < right
//       case '>':
//         return left > right
//       case '>=':
//         return left >= right
//       default:
//         return undefined
//     }
//   }

export function evaluateUnaryExpression(operator: es.UnaryOperator, value: any) {
    if (operator === '!') {
        if (value.type === 'bool') {
            return {
                type: 'bool',
                value: !(Boolean(value.value))
            };
        } else {
            // TODO: error
        }
    } else if (operator === '-') {
        if (value.type === 'bigint') {
            return {
                type: 'bigint',
                value: -value.value
            };
        } else if (value.type === 'number') {
            return {
                type: 'number',
                value: -Number(value.value)
            };
        } else {
            // TODO: error
        }
        // else if (value.type === 'bool') {
        //     return {
        //         type: 'bigint',
        //         value: Boolean(value.value)?BigInt(-1):BigInt(0)
        //     };
        // }
    } else if (operator === 'typeof') {
        // todo
        return {
            type: String,
            value: typeof value.value
        };
    } else {
        return value;
    }
}

export function evaluateBinaryExpression(context: Context, identifier: any, left: any, right: any) {
    //if(isIdentifier(identifier)){
    //if(identifier.name === '__py_adder') {
    if (left.type === 'string' && right.type === 'string' && identifier.name === '__py_adder') {
        if(isIdentifier(identifier) && identifier.name === '__py_adder') {
            return {
                type: 'string',
                value: left.value + right.value
            };
        } else {
            let ret_type : any;
            let ret_value : any;
            if (identifier === '>') {
                ret_value = left.value > right.value;
            } else if(identifier === '>=') {
                ret_value = left.value >= right.value;
            } else if(identifier === '<') {
                ret_value = left.value < right.value;
            } else if(identifier === '<=') {
                ret_value = left.value <= right.value;
            } else if(identifier === '===') {
                ret_value = left.value === right.value;
            } else if(identifier === '!==') {
                ret_value = left.value !== right.value;
            } else {
                // TODO: error
            }

            return {
                type: 'bool',
                value: ret_value
            };
        }
    } else {
        // numbers: only int and float, not bool
        const numericTypes = ['number', 'bigint', 'complex'];  //, 'bool'
        if (!numericTypes.includes(left.type) || !numericTypes.includes(right.type)) {
            // TODO: 
            //throw new Error('Placeholder: invalid operand types for addition');
            // console.info('not num or bigint', left.type, right.type);
        }

        // if (left.type === 'bool') {
        //     left.type = 'bigint';
        //     left.value = left.value?BigInt(1):BigInt(0);
        // }
        // if (right.type === 'bool') {
        //     right.type = 'bigint';
        //     right.value = right.value?BigInt(1):BigInt(0);
        // }

        let originalLeft = { type : left.type, value : left.value };
        let originalRight = { type : right.type, value : right.value };

        if (left.type !== right.type) {
            // left.type = 'number';
            // left.value = Number(left.value);
            // right.type = 'number';
            // right.value = Number(right.value);
            
            if (left.type === 'complex' || right.type === 'complex') {
                left.type = 'complex';
                right.type = 'complex';
                left.value = PyComplexNumber.fromValue(left.value);
                right.value = PyComplexNumber.fromValue(right.value);
            } else if (left.type === 'number' || right.type === 'number') {
                left.type = 'number';
                right.type = 'number';
                left.value = Number(left.value);
                right.value = Number(right.value);
            }
        }

        let ret_value : any;
        let ret_type : any = left.type;

        if(isIdentifier(identifier)) {
            if(identifier.name === '__py_adder') {
                if (left.type === 'complex' || right.type === 'complex') {
                    const leftComplex = PyComplexNumber.fromValue(left.value);
                    const rightComplex = PyComplexNumber.fromValue(right.value);
                    ret_value = leftComplex.add(rightComplex);
                } else {
                    ret_value = left.value + right.value;
                }
            } else if(identifier.name === '__py_minuser') {
                if (left.type === 'complex' || right.type === 'complex') {
                    const leftComplex = PyComplexNumber.fromValue(left.value);
                    const rightComplex = PyComplexNumber.fromValue(right.value);
                    ret_value = leftComplex.sub(rightComplex);
                } else {
                    ret_value = left.value - right.value;
                }
            } else if(identifier.name === '__py_multiplier') {
                if (left.type === 'complex' || right.type === 'complex') {
                    const leftComplex = PyComplexNumber.fromValue(left.value);
                    const rightComplex = PyComplexNumber.fromValue(right.value);
                    ret_value = leftComplex.mul(rightComplex);
                } else {
                    ret_value = left.value * right.value;
                }
            } else if(identifier.name === '__py_divider') {
                if (left.type === 'complex' || right.type === 'complex') {
                    const leftComplex = PyComplexNumber.fromValue(left.value);
                    const rightComplex = PyComplexNumber.fromValue(right.value);
                    ret_value = leftComplex.div(rightComplex);
                } else {
                    if(right.value !== 0) {
                        ret_type = 'number';
                        ret_value = Number(left.value) / Number(right.value);
                    } else {
                        // TODO: divide by 0 error
                    }
                }
            } else if(identifier.name === '__py_modder') {
                if (left.type === 'complex') {
                    // TODO: error
                }
                ret_value = pythonMod(left.value, right.value);
            } else if(identifier.name === '__py_floorer') {
                // TODO: floorer not in python now
                ret_value = 0;
            } else if(identifier.name === '__py_powerer') {
                if (left.type === 'complex') {
                    const leftComplex = PyComplexNumber.fromValue(left.value);
                    const rightComplex = PyComplexNumber.fromValue(right.value);
                    ret_value = leftComplex.pow(rightComplex);
                } else {
                    if (left.type === 'bigint' && right.value < 0) {
                        ret_value = Number(left.value) ** Number(right.value);
                        ret_type = 'number';
                    } else {
                        ret_value = left.value ** right.value;
                    }
                }
            } else {
                // TODO: throw an error
            }
        } else {
            ret_type = 'bool';

            // one of them is complex, convert all to complex then compare
            // for complex, only '==' and '!=' valid
            if (left.type === 'complex') {
                const leftComplex = PyComplexNumber.fromValue(left.value);
                const rightComplex = PyComplexNumber.fromValue(right.value);
                if (identifier === '===') {
                    ret_value = leftComplex.equals(rightComplex);
                } else if (identifier === '!==') {
                    ret_value = !leftComplex.equals(rightComplex);
                } else {
                    // TODO: error
                }
            } else if (originalLeft.type !== originalRight.type) {
                let int_num : any;
                let floatNum : any;
                let compare_res;
                if (originalLeft.type === 'bigint') {
                    int_num = originalLeft;
                    floatNum = originalRight;
                    compare_res = pyCompare(int_num, floatNum);
                } else {
                    int_num = originalRight;
                    floatNum = originalLeft;
                    compare_res = -pyCompare(int_num, floatNum);
                }

                if (identifier === '>') {
                    ret_value = compare_res > 0;
                } else if(identifier === '>=') {
                    ret_value = compare_res >= 0;
                } else if(identifier === '<') {
                    ret_value = compare_res < 0;
                } else if(identifier === '<=') {
                    ret_value = compare_res <= 0;
                } else if(identifier === '===') {
                    ret_value = compare_res === 0;
                } else if(identifier === '!==') {
                    ret_value = compare_res !== 0;
                } else {
                    // TODO: error
                }

                
            } else {
                if (identifier === '>') {
                    ret_value = left.value > right.value;
                } else if(identifier === '>=') {
                    ret_value = left.value >= right.value;
                } else if(identifier === '<') {
                    ret_value = left.value < right.value;
                } else if(identifier === '<=') {
                    ret_value = left.value <= right.value;
                } else if(identifier === '===') {
                    ret_value = left.value === right.value;
                } else if(identifier === '!==') {
                    ret_value = left.value !== right.value;
                } else {
                    // TODO: error
                }
            }

            
        }

        return {
            type: ret_type,
            value: ret_value
        };
    }
}

function pyCompare(int_num : any, float_num : any) {
    // int_num.value < float_num.value => -1
    // int_num.value = float_num.value => 0
    // int_num.value > float_num.value => 1

    // If float_num is positive Infinity, then int_num is considered smaller.
    if (float_num.value === Infinity) {
        return -1;
    }
    if (float_num.value === -Infinity) {
        return 1;
    }

    const signInt = (int_num.value < 0) ? -1 : (int_num.value > 0 ? 1 : 0);
    const signFlt = Math.sign(float_num.value);  // -1, 0, or 1

    if (signInt < signFlt) return -1;  // e.g. int<0, float>=0 => int < float
    if (signInt > signFlt) return 1;   // e.g. int>=0, float<0 => int > float
    
    // Both have the same sign (including 0).
    // If both are zero, treat them as equal.
    if (signInt === 0 && signFlt === 0) {
        return 0;
    }

    // Both are either positive or negative.
    // If |int_num.value| is within 2^53, it can be safely converted to a JS number for an exact comparison.
    const absInt = int_num.value < 0 ? -int_num.value : int_num.value;
    const MAX_SAFE = 9007199254740991; // 2^53 - 1

    if (absInt <= MAX_SAFE) {
        // Safe conversion to double.
        const intAsNum = Number(int_num.value); 
        const diff = intAsNum - float_num.value;
        if (diff === 0) return 0;
        return diff < 0 ? -1 : 1;
    }

    // For large integers exceeding 2^53, we need to distinguish more carefully.
    // General idea: Determine the order of magnitude of float_num.value (via log10) and compare it with
    // the number of digits of int_num.value. An approximate comparison can indicate whether
    // int_num.value is greater or less than float_num.value.
    
    // First, check if float_num.value is nearly zero (but not zero).
    if (float_num.value === 0) {
        // Although signFlt would be 0 and handled above, just to be safe:
        return signInt; 
    }

    const absFlt = Math.abs(float_num.value);
    // Determine the order of magnitude.
    const exponent = Math.floor(Math.log10(absFlt)); 
    // For example, if float_num.value = 3.333333e49, exponent = 49, indicating roughly 50 digits in its integer part.
  
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
        // (5.2) If the number of digits is the same, they may be extremely close.
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
  