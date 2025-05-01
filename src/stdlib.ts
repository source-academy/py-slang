import { ArrowFunctionExpression } from "estree";
import { Closure } from "./cse-machine/closure";
import { Value } from "./cse-machine/stash";
// npm install mathjs
import { gamma, lgamma, erf } from 'mathjs';
import { addPrint } from "./cse-machine/interpreter";
import { handleRuntimeError } from "./cse-machine/utils";
import { MissingRequiredPositionalError, TooManyPositionalArgumentsError, ValueError, TypeError, ZeroDivisionError } from "./errors/errors";
import { ControlItem } from "./cse-machine/control";
import { Context } from "./cse-machine/context";
import * as es from 'estree';

/*
    Create a map to hold built-in constants.
    Each constant is stored with a string key and its corresponding value object.
*/
export const builtInConstants = new Map<string, any>();
const math_e = { type: 'number', value: Math.E };
const math_inf = { type: 'number', value: Infinity };
const math_nan = { type: 'number', value: NaN };
const math_pi = { type: 'number', value: Math.PI };
const math_tau = { type: 'number', value: 2 * Math.PI };

builtInConstants.set('math_e', math_e);
builtInConstants.set('math_inf', math_inf);
builtInConstants.set('math_nan', math_nan);
builtInConstants.set('math_pi', math_pi);
builtInConstants.set('math_tau', math_tau);

/*
    Create a map to hold built-in functions.
    The keys are strings (function names) and the values are functions that can take any arguments.
*/
export const builtIns = new Map<string, (...args: any[]) => any>();
builtIns.set('_int', _int);
builtIns.set('_int_from_string', _int_from_string);
builtIns.set('abs', abs);
builtIns.set('char_at', char_at);
builtIns.set('error', error);
builtIns.set('input', input);
builtIns.set('isinstance', isinstance);
builtIns.set('math_acos', math_acos);
builtIns.set('math_acosh', math_acosh);
builtIns.set('math_asin', math_asin);
builtIns.set('math_asinh', math_asinh);
builtIns.set('math_atan', math_atan);
builtIns.set('math_atan2', math_atan2);
builtIns.set('math_atanh', math_atanh);
builtIns.set('math_cbrt', math_cbrt);
builtIns.set('math_ceil', math_ceil);
builtIns.set('math_comb', math_comb);
builtIns.set('math_copysign', math_copysign);
builtIns.set('math_cos', math_cos);
builtIns.set('math_cosh', math_cosh);
builtIns.set('math_degrees', math_degrees);
builtIns.set('math_erf', math_erf);
builtIns.set('math_erfc', math_erfc);
builtIns.set('math_exp', math_exp);
builtIns.set('math_exp2', math_exp2);
builtIns.set('math_expm1', math_expm1);
builtIns.set('math_fabs', math_fabs);
builtIns.set('math_factorial', math_factorial);
builtIns.set('math_floor', math_floor);
builtIns.set('math_fma', math_fma);
builtIns.set('math_fmod', math_fmod);
builtIns.set('math_gamma', math_gamma);
builtIns.set('math_lgamma', math_lgamma);
builtIns.set('math_gcd', math_gcd);
builtIns.set('math_isfinite', math_isfinite);
builtIns.set('math_isinf', math_isinf);
builtIns.set('math_isnan', math_isnan);
builtIns.set('math_isqrt', math_isqrt);
builtIns.set('math_lcm', math_lcm);
builtIns.set('math_ldexp', math_ldexp);
builtIns.set('math_log', math_log);
builtIns.set('math_log10', math_log10);
builtIns.set('math_log1p', math_log1p);
builtIns.set('math_log2', math_log2);
builtIns.set('math_nextafter', math_nextafter);
builtIns.set('math_perm', math_perm);
builtIns.set('math_pow', math_pow);
builtIns.set('math_radians', math_radians);
builtIns.set('math_remainder', math_remainder);
builtIns.set('math_sin', math_sin);
builtIns.set('math_sinh', math_sinh);
builtIns.set('math_sqrt', math_sqrt);
builtIns.set('math_tan', math_tan);
builtIns.set('math_tanh', math_tanh);
builtIns.set('math_trunc', math_trunc);
builtIns.set('math_ulp', math_ulp);
builtIns.set('max', max);
builtIns.set('min', min);
builtIns.set('print', print);
builtIns.set('random_random', random_random);
builtIns.set('round', round);
builtIns.set('str', str);
builtIns.set('time_time', time_time);

export function _int(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length === 0) {
        return { type: 'bigint', value: '0' };
    }
    if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), '_int', Number(1), args, true));
    }

    const arg = args[0];
    // If the value is a number, use Math.trunc to truncate toward zero.
    if (arg.type === 'number') {
        const truncated = Math.trunc(arg.value);
        return { type: 'bigint', value: BigInt(truncated) };
    }
    // If the value is a bigint, simply return the same value.
    if (arg.type === 'bigint') {
        return { type: 'bigint', value: arg.value };
    }

    handleRuntimeError(context, new TypeError(source, command as es.Node, context, arg.type, "float' or 'int"));
}

export function _int_from_string(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), '_int_from_string', Number(1), args, true));
    }
    if (args.length > 2) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), '_int_from_string', Number(2), args, true));
    }
  
    const strVal = args[0];
    if (strVal.type !== 'string') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, args[0].type, "string"));
    }
  
    let base: number = 10;
    if (args.length === 2) {
        // The second argument must be either a bigint or a number (it will be converted to a number for uniform processing).
        const baseVal = args[1];
        if (baseVal.type === 'bigint') {
            base = Number(baseVal.value);
        } else {
            handleRuntimeError(context, new TypeError(source, command as es.Node, context, args[1].type, "float' or 'int"));
        }
    }
  
    // base should be in between 2 and 36
    if (base < 2 || base > 36) {
        handleRuntimeError(context, new ValueError(source, command as es.Node, context, "_int_from_string"));
    }
  
    let str = strVal.value as string;
    str = str.trim();
    str = str.replace(/_/g, '');
  
    // Parse the sign (determine if the value is positive or negative)
    let sign: bigint = BigInt(1);
    if (str.startsWith('+')) {
        str = str.slice(1);
    } else if (str.startsWith('-')) {
        sign = BigInt(-1);
        str = str.slice(1);
    }
  
    // The remaining portion must consist of valid characters for the specified base.
    const parsedNumber = parseInt(str, base);
    if (isNaN(parsedNumber)) {
        handleRuntimeError(context, new ValueError(source, command as es.Node, context, "_int_from_string"));
    }
  
    const result: bigint = sign * BigInt(parsedNumber);

    return { type: 'bigint', value: result };
}
  
export function abs(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'abs', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'abs', Number(1), args, false));
    }
    
    const x = args[0];
    switch (x.type) {
        case 'bigint': {
            const intVal = x.value;
            const result: bigint = intVal < 0 ? -intVal : intVal;
            return { type: 'int', value: result };
        }
        case 'number': {
            return { type: 'number', value: Math.abs(x.value) };
        }
        case 'complex': {
            // Calculate the modulus (absolute value) of a complex number.
            const real = x.value.real;
            const imag = x.value.imag;
            const modulus = Math.sqrt(real * real + imag * imag);
            return { type: 'number', value: modulus };
        }
        default:
            handleRuntimeError(context, new TypeError(source, command as es.Node, context, args[0].type, "float', 'int' or 'complex"));
    }
}

function toStr(val: Value): string {
    return String(val.value);
}

export function error(args: Value[], source: string, command: ControlItem, context: Context): Value {
    const output = "Error: " + args.map(arg => toStr(arg)).join(' ') + '\n';
    throw new Error(output);
}

export function isinstance(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 2) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'isinstance', Number(2), args, false));
    } else if (args.length > 2) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'isinstance', Number(2), args, false));
    }
  
    const obj = args[0];
    const classinfo = args[1];

    let expectedType: string;
    if (classinfo.type === 'string') {
        switch (classinfo.value) {
            case 'int':
                expectedType = 'bigint';
                break;
            case 'float':
                expectedType = 'number';
                break;
            case 'string':
                expectedType = 'string';
                break;
            case 'bool':
                expectedType = 'bool';
                break;
            case 'complex':
                expectedType = 'complex';
                break;
            case 'NoneType':
                expectedType = 'NoneType';
                break;
            default:
                handleRuntimeError(context, new ValueError(source, command as es.Node, context, "isinstance"));
                return;
        }
    } else {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, args[0].type, "string"));
        return;
    }

    const result = obj.type === expectedType;
  
    return { type: 'bool', value: result };
}

export function math_acos(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_acos', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_acos', Number(1), args, false));
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
    }

    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }

    if (num < -1 || num > 1) {
        handleRuntimeError(context, new ValueError(source, command as es.Node, context, "math_acos"));
    }
  
    const result = Math.acos(num);
    return { type: 'number', value: result };
}

export function math_acosh(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_acosh', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_acosh', Number(1), args, false));
    }
  
    const x = args[0];
  
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
    }
  
    let num: number;
    if (x.type === 'number') {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    if (num < 1) {
        handleRuntimeError(context, new ValueError(source, command as es.Node, context, "math_acosh"));
    }
  
    const result = Math.acosh(num);
    return { type: 'number', value: result };
}

export function math_asin(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_asin', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_asin', Number(1), args, false));
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
    }
  
    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }
  
    if (num < -1 || num > 1) {
        handleRuntimeError(context, new ValueError(source, command as es.Node, context, "math_asin"));
    }
  
    const result = Math.asin(num);
    return { type: 'number', value: result };
}

export function math_asinh(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_asinh', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_asinh', Number(1), args, false));
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
    }
  
    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }
  
    const result = Math.asinh(num);
    return { type: 'number', value: result };
}

export function math_atan(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_atan', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_atan', Number(1), args, false));
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
    }
  
    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }
  
    const result = Math.atan(num);
    return { type: 'number', value: result };
}

export function math_atan2(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 2) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_atan', Number(2), args, false));
    } else if (args.length > 2) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_atan', Number(2), args, false));
    }
  
    const y = args[0];
    const x = args[1];
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
    } else if (y.type !== 'number' && y.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, y.type, "float' or 'int"));
    }
  
    let yNum: number, xNum: number;
    if (y.type === 'number') {
        yNum = y.value;
    } else {
        yNum = Number(y.value);
    }
  
    if (x.type === 'number') {
        xNum = x.value;
    } else {
        xNum = Number(x.value);
    }
  
    const result = Math.atan2(yNum, xNum);
    return { type: 'number', value: result };
}

export function math_atanh(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_atanh', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_atanh', Number(1), args, false));
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
    }
  
    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }
  
    if (num <= -1 || num >= 1) {
        handleRuntimeError(context, new ValueError(source, command as es.Node, context, "math_atanh"));
    }
  
    const result = Math.atanh(num);
    return { type: 'number', value: result };
}

export function math_cos(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_cos', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_cos', Number(1), args, false));
    }
    
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
    }
    
    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }
    
    const result = Math.cos(num);
    return { type: 'number', value: result };
}

export function math_cosh(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_cosh', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_cosh', Number(1), args, false));
    }
    
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
    }
    
    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }
    
    const result = Math.cosh(num);
    return { type: 'number', value: result };
}

export function math_degrees(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_degrees', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_degrees', Number(1), args, false));
    }
    
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
    }
    
    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }
    
    const result = num * 180 / Math.PI;
    return { type: 'number', value: result };
}

export function math_erf(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_erf', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_erf', Number(1), args, false));
    }
    
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
    }
    
    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }
    
    const erfnum = erf(num);
    
    return { type: 'number', value: erfnum };
}

export function math_erfc(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_erfc', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_erfc', Number(1), args, false));
    }
    
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
    }
    
    const erfc = 1 - math_erf(args[0], source, command, context).value;
    
    return { type: 'number', value: erfc };
}

export function char_at(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 2) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'char_at', Number(2), args, false));
    } else if (args.length > 2) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'char_at', Number(2), args, false));
    }

    const s = args[0];
    const i = args[1];
  
    if (s.type !== 'string') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, s.type, "string"));
    }
    if (i.type !== 'number' && i.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, i.type, "float' or 'int"));
    }
  
    const index = i.value;

    return { type: 'string', value: (s.value)[index]};
}

export function math_comb(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 2) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_comb', Number(2), args, false));
    } else if (args.length > 2) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_comb', Number(2), args, false));
    }
  
    const n = args[0];
    const k = args[1];
  
    if (n.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, n.type, "int"));
    } else if (k.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, k.type, "int"));
    }
  
    const nVal = BigInt(n.value);
    const kVal = BigInt(k.value);
  
    if (nVal < 0 || kVal < 0) {
        handleRuntimeError(context, new ValueError(source, command as es.Node, context, "math_comb"));
    }

    if (kVal > nVal) {
        return { type: 'bigint', value: BigInt(0) };
    }
  
    let result: bigint = BigInt(1);
    let kk = kVal > nVal - kVal ? nVal - kVal : kVal;
  
    for (let i: bigint = BigInt(0); i < kk; i++) {
        result = result * (nVal - i) / (i + BigInt(1));
    }

    return { type: 'bigint', value: result };
}

export function math_factorial(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_factorial', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_factorial', Number(1), args, false));
    }
  
    const n = args[0];
    
    if (n.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, n.type, "int"));
    }
  
    const nVal = BigInt(n.value);
  
    if (nVal < 0) {
        handleRuntimeError(context, new ValueError(source, command as es.Node, context, "math_factorial"));
    }
  
    // 0! = 1
    if (nVal === BigInt(0)) {
      return { type: 'bigint', value: BigInt(1) };
    }
  
    let result: bigint = BigInt(1);
    for (let i: bigint = BigInt(1); i <= nVal; i++) {
        result *= i;
    }
  
    return { type: 'bigint', value: result };
}
  
export function math_gcd(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length === 0) {
      return { type: 'bigint', value: BigInt(0) };
    }
  
    const values = args.map((v, idx) => {
        if (v.type !== 'bigint') {
            handleRuntimeError(context, new TypeError(source, command as es.Node, context, v.type, "int"));
        }
        return BigInt(v.value);
    });
  
    const allZero = values.every(val => val === BigInt(0));
    if (allZero) {
        return { type: 'bigint', value: BigInt(0) };
    }

    let currentGcd: bigint = values[0] < 0 ? -values[0] : values[0];
    for (let i = 1; i < values.length; i++) {
        currentGcd = gcdOfTwo(currentGcd, values[i] < 0 ? -values[i] : values[i]);
        if (currentGcd === BigInt(1)) {
            break;
        }
    }
  
    return { type: 'bigint', value: currentGcd };
}

function gcdOfTwo(a: bigint, b: bigint): bigint {
    let x: bigint = a;
    let y: bigint = b;
    while (y !== BigInt(0)) {
        const temp = x % y;
        x = y;
        y = temp;
    }
    return x < 0 ? -x : x;
}

export function math_isqrt(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_isqrt', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_isqrt', Number(1), args, false));
    }
  
    const nValObj = args[0];
    if (nValObj.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, nValObj.type, "int"));
    }
  
    const n: bigint = nValObj.value;
  
    if (n < 0) {
        handleRuntimeError(context, new ValueError(source, command as es.Node, context, "math_isqrt"));
    }

    if (n < 2) {
      return { type: 'bigint', value: n };
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

    return { type: 'bigint', value: low };
}
  
export function math_lcm(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length === 0) {
        return { type: 'bigint', value: BigInt(1) };
    }
  
    const values = args.map((val, idx) => {
        if (val.type !== 'bigint') {
            handleRuntimeError(context, new TypeError(source, command as es.Node, context, val.type, "int"));
        }
        return BigInt(val.value);
    });

    if (values.some(v => v === BigInt(0))) {
        return { type: 'bigint', value: BigInt(0) };
    }
  
    let currentLcm: bigint = absBigInt(values[0]);
    for (let i = 1; i < values.length; i++) {
        currentLcm = lcmOfTwo(currentLcm, absBigInt(values[i]));
        if (currentLcm === BigInt(0)) {
            break;
        }
    }
  
    return { type: 'bigint', value: currentLcm };
}

function lcmOfTwo(a: bigint, b: bigint): bigint {
    const gcdVal: bigint = gcdOfTwo(a, b);
    return BigInt((a / gcdVal) * b);
}
  
function absBigInt(x: bigint): bigint {
    return x < 0 ? -x : x;
}

export function math_perm(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_perm', Number(1), args, true));
    } else if (args.length > 2) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_perm', Number(2), args, true));
    }

    const nValObj = args[0];
    if (nValObj.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, nValObj.type, "int"));
    }
    const n = BigInt(nValObj.value);

    let k = n;
    if (args.length === 2) {
        const kValObj = args[1];
        if (kValObj.type === 'null' || kValObj.type === 'undefined') {
            k = n;
        } else if (kValObj.type === 'bigint') {
            k = BigInt(kValObj.value);
        } else {
            handleRuntimeError(context, new TypeError(source, command as es.Node, context, kValObj.type, "int' or 'None"));
        }
    }
  
    if (n < 0 || k < 0) {
        handleRuntimeError(context, new ValueError(source, command as es.Node, context, "math_perm"));
    }

    if (k > n) {
        return { type: 'bigint', value: BigInt(0) };
    }

    let result: bigint = BigInt(1);
    for (let i: bigint = BigInt(0); i < k; i++) {
        result *= (n - i);
    }

    return { type: 'bigint', value: result };
}

export function math_ceil(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_ceil', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_ceil', Number(1), args, false));
    }
  
    const x = args[0];
  
    if (x.type === 'bigint') {
        return x;
    }
  
    if (x.type === 'number') {
        const numVal = x.value as number;
        if (typeof numVal !== 'number') {
            handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
        }
        const ceiled: bigint = BigInt(Math.ceil(numVal));
        return { type: 'bigint', value: ceiled };
    }
  
    handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
}

export function math_fabs(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_fabs', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_fabs', Number(1), args, false));
    }
  
    const x = args[0];
  
    if (x.type === 'bigint') {
        const bigVal: bigint = BigInt(x.value);
        const absVal: number = bigVal < 0 ? -Number(bigVal) : Number(bigVal);
        return { type: 'number', value: absVal };
    }
  
    if (x.type === 'number') {
        const numVal: number = x.value as number;
        if (typeof numVal !== 'number') {
            handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
        }
        const absVal: number = Math.abs(numVal);
        return { type: 'number', value: absVal };
    }

    handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
}

export function math_floor(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_floor', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_floor', Number(1), args, false));
    }
  
    const x = args[0];
  
    if (x.type === 'bigint') {
        return x;
    }

    if (x.type === 'number') {
        const numVal: number = x.value as number;
        if (typeof numVal !== 'number') {
            handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
        }
        const floored: bigint = BigInt(Math.floor(numVal));
        return { type: 'bigint', value: floored };
    }

    handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
}

// Computes the product of a and b along with the rounding error using Dekker's algorithm.
function twoProd(a: number, b: number): { prod: number; err: number } {
    const prod = a * b;
    const c = 134217729; // 2^27 + 1
    const a_hi = (a * c) - ((a * c) - a);
    const a_lo = a - a_hi;
    const b_hi = (b * c) - ((b * c) - b);
    const b_lo = b - b_hi;
    const err = a_lo * b_lo - (((prod - a_hi * b_hi) - a_lo * b_hi) - a_hi * b_lo);
    return { prod, err };
}
  
// Computes the sum of a and b along with the rounding error using Fast TwoSum.
function twoSum(a: number, b: number): { sum: number; err: number } {
    const sum = a + b;
    const v = sum - a;
    const err = (a - (sum - v)) + (b - v);
    return { sum, err };
}

// Performs a fused multiply-add operation: computes (x * y) + z with a single rounding.
function fusedMultiplyAdd(x: number, y: number, z: number): number {
    const { prod, err: prodErr } = twoProd(x, y);
    const { sum, err: sumErr } = twoSum(prod, z);
    const result = sum + (prodErr + sumErr);
    return result;
}

function toNumber(val: Value, source: string, command: ControlItem, context: Context): number {
    if (val.type === 'bigint') {
        return Number(val.value);
    } else if (val.type === 'number') {
        return val.value as number;
    } else {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, val.type, "float' or 'int"));
        return 0;
    }
}

export function math_fma(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 3) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_fma', Number(3), args, false));
    } else if (args.length > 3) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_fma', Number(3), args, false));
    }
    
    const xVal = toNumber(args[0], source, command, context);
    const yVal = toNumber(args[1], source, command, context);
    const zVal = toNumber(args[2], source, command, context);

    // Special-case handling: According to the IEEE 754 standard, fma(0, inf, nan)
    // and fma(inf, 0, nan) should return NaN.
    if (isNaN(xVal) || isNaN(yVal) || isNaN(zVal)) {
        return { type: 'number', value: NaN };
    }
    if (xVal === 0 && !isFinite(yVal) && isNaN(zVal)) {
        return { type: 'number', value: NaN };
    }
    if (yVal === 0 && !isFinite(xVal) && isNaN(zVal)) {
        return { type: 'number', value: NaN };
    }
    
    const result = fusedMultiplyAdd(xVal, yVal, zVal);
    return { type: 'number', value: result };
}

export function math_fmod(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 2) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_fmod', Number(2), args, false));
    } else if (args.length > 2) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_fmod', Number(2), args, false));
    }

    // Convert inputs to numbers
    const xVal = toNumber(args[0], source, command, context);
    const yVal = toNumber(args[1], source, command, context);

    // Divisor cannot be zero
    if (yVal === 0) {
        handleRuntimeError(context, new ValueError(source, command as es.Node, context, "math_fmod"));
    }

    // JavaScript's % operator behaves similarly to C's fmod
    // in that the sign of the result is the same as the sign of x.
    // For corner cases (NaN, Infinity), JavaScript remainder
    // yields results consistent with typical C library fmod behavior.
    const remainder = xVal % yVal;

    return { type: 'number', value: remainder };
}

function roundToEven(num: number): number {
    const floorVal = Math.floor(num);
    const ceilVal = Math.ceil(num);
    const diffFloor = num - floorVal;
    const diffCeil = ceilVal - num;
    if (diffFloor < diffCeil) {
        return floorVal;
    } else if (diffCeil < diffFloor) {
        return ceilVal;
    } else {
        return (floorVal % 2 === 0) ? floorVal : ceilVal;
    }
}
  
export function math_remainder(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 2) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_remainder', Number(2), args, false));
    } else if (args.length > 2) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_remainder', Number(2), args, false));
    }
    
    const x = args[0];
    const y = args[1];

    let xValue: number;
    if (x.type === 'bigint') {
        xValue = Number(x.value);
    } else if (x.type === 'number') {
        xValue = x.value as number;
    } else {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
        return;
    }

    let yValue: number;
    if (y.type === 'bigint') {
        yValue = Number(y.value);
    } else if (y.type === 'number') {
        yValue = y.value as number;
    } else {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, y.type, "float' or 'int"));
        return;
    }

    if (yValue === 0) {
        
        handleRuntimeError(context, new ValueError(source, command as es.Node, context, "math_remainder"));
    }

    const quotient = xValue / yValue;
    const n = roundToEven(quotient);
    const remainder = xValue - n * yValue;

    return { type: 'number', value: remainder };
}

export function math_trunc(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_trunc', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_trunc', Number(1), args, false));
    }
  
    const x = args[0];
  
    if (x.type === 'bigint') {
        return x;
    }
  
    if (x.type === 'number') {
        const numVal: number = x.value as number;
        if (typeof numVal !== 'number') {
            handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
        }
        let truncated: number;
        if (numVal === 0) {
            truncated = 0;
        } else if (numVal < 0) {
            truncated = Math.ceil(numVal);
        } else {
            truncated = Math.floor(numVal);
        }
        return { type: 'bigint', value: BigInt(truncated) };
    }
  
    handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
}

export function math_copysign(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 2) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_copysign', Number(2), args, false));
    } else if (args.length > 2) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_copysign', Number(2), args, false));
    }
  
    const [x, y] = args;

    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
    } else if (y.type !== 'number' && y.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, y.type, "float' or 'int"));
    }
    
    const xVal = Number(x.value) as number;
    const yVal = Number(y.value) as number;

    const absVal = Math.abs(xVal);
    const isNegative = yVal < 0 || (Object.is(yVal, -0));
    const result = isNegative ? -absVal : absVal;
    
    return { type: 'number', value: Number(result) };
}

export function math_isfinite(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_isfinite', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_isfinite', Number(1), args, false));
    }

    const xValObj = args[0];
    if (xValObj.type !== 'number' && xValObj.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, xValObj.type, "float' or 'int"));
    }

    const x = Number(xValObj.value) as number;
    const result: boolean = Number.isFinite(x);
  
    return { type: 'bool', value: result };
}

export function math_isinf(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_isinf', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_isinf', Number(1), args, false));
    }

    const xValObj = args[0];
    if (xValObj.type !== 'number' && xValObj.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, xValObj.type, "float' or 'int"));
    }

    const x = Number(xValObj.value) as number;
    const result: boolean = (x === Infinity || x === -Infinity);
  
    return { type: 'bool', value: result };
}

export function math_isnan(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_isnan', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_isnan', Number(1), args, false));
    }
  
    const xValObj = args[0];
    if (xValObj.type !== 'number' && xValObj.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, xValObj.type, "float' or 'int"));
    }

    const x = Number(xValObj.value) as number;
    const result: boolean = Number.isNaN(x);
  
    return { type: 'bool', value: result };
}

export function math_ldexp(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 2) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_ldexp', Number(2), args, false));
    } else if (args.length > 2) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_ldexp', Number(2), args, false));
    }

    const xVal = toNumber(args[0], source, command, context);

    if (args[1].type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, args[1].type, "int"));
    }
    const expVal = args[1].value;

    // Perform x * 2^expVal
    // In JavaScript, 2**expVal may overflow or underflow, yielding Infinity or 0 respectively.
    // That behavior parallels typical C library rules for ldexp.
    const result = xVal * Math.pow(2, Number(expVal));
  
    return { type: 'number', value: result };
}
  
export function math_nextafter(args: Value[], source: string, command: ControlItem, context: Context): Value {
    // TODO: Implement math_nextafter using proper bit-level manipulation and handling special cases (NaN, Infinity, steps, etc.)
    throw new Error("math_nextafter not implemented");
}

export function math_ulp(args: Value[], source: string, command: ControlItem, context: Context): Value {
    // TODO: Implement math_ulp to return the unit in the last place (ULP) of the given floating-point number.
    throw new Error("math_ulp not implemented");
}

export function math_cbrt(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_cbrt', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_cbrt', Number(1), args, false));
    }

    const xVal = args[0];
    let x: number;

    if (xVal.type !== 'number') {
        if (xVal.type === 'bigint') {
            x = Number(xVal.value);
        } else {
            handleRuntimeError(context, new TypeError(source, command as es.Node, context, xVal.type, "float' or 'int"));
            return;
        }
    } else {
        x = xVal.value as number;
    }

    const result = Math.cbrt(x);

    return { type: 'number', value: result };
}

export function math_exp(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_exp', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_exp', Number(1), args, false));
    }
  
    const xVal = args[0];
    let x: number;

    if (xVal.type !== 'number') {
        if (xVal.type === 'bigint') {
            x = Number(xVal.value);
        } else {
            handleRuntimeError(context, new TypeError(source, command as es.Node, context, xVal.type, "float' or 'int"));
            return;
        }
    } else {
        x = xVal.value as number;
    }

    const result = Math.exp(x);
    return { type: 'number', value: result };
}

export function math_exp2(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_exp2', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_exp2', Number(1), args, false));
    }
  
    const xVal = args[0];
    let x: number;

    if (xVal.type !== 'number') {
        if (xVal.type === 'bigint') {
            x = Number(xVal.value);
        } else {
            handleRuntimeError(context, new TypeError(source, command as es.Node, context, xVal.type, "float' or 'int"));
            return;
        }
    } else {
        x = xVal.value as number;
    }
    
    const result = Math.pow(2, x);
    return { type: 'number', value: result };
}

export function math_expm1(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_expm1', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_expm1', Number(1), args, false));
    }
    
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
    }
    
    let num: number;
    if (x.type === 'number') {
      num = x.value;
    } else {
      num = Number(x.value);
    }
    
    const result = Math.expm1(num);
    return { type: 'number', value: result };
}

export function math_gamma(args: Value[], source: string, command: ControlItem, context: Context): Value { 
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_gamma', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_gamma', Number(1), args, false));
    }
    
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
    }

    const z = toNumber(x, source, command, context);
    const result = gamma(z);

    return { type: 'number', value: result };
}

export function math_lgamma(args: Value[], source: string, command: ControlItem, context: Context): Value { 
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_lgamma', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_lgamma', Number(1), args, false));
    }
    
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
    }

    const z = toNumber(x, source, command, context);
    const result = lgamma(z);

    return { type: 'number', value: result };
}

export function math_log(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_gamma', Number(1), args, true));
    } else if (args.length > 2) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_gamma', Number(2), args, true));
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
    }
    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }
    
    if (num <= 0) {
        handleRuntimeError(context, new ValueError(source, command as es.Node, context, "math_log"));
    }
  
    if (args.length === 1) {
        return { type: 'number', value: Math.log(num) };
    }
  
    const baseArg = args[1];
    if (baseArg.type !== 'number' && baseArg.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, baseArg.type, "float' or 'int"));
    }
    let baseNum: number;
    if (baseArg.type === 'number') {
        baseNum = baseArg.value;
    } else {
        baseNum = Number(baseArg.value);
    }
    if (baseNum <= 0) {
        handleRuntimeError(context, new ValueError(source, command as es.Node, context, "math_log"));
    }
  
    const result = Math.log(num) / Math.log(baseNum);
    return { type: 'number', value: result };
}

export function math_log10(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_log10', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_log10', Number(1), args, false));
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, args[0].type, "float' or 'int"));
    }
    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }
    if (num <= 0) {
        handleRuntimeError(context, new ValueError(source, command as es.Node, context, "math_log10"));
    }
  
    const result = Math.log10(num);
    return { type: 'number', value: result };
}
  
export function math_log1p(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_log1p', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_log1p', Number(1), args, false));
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, args[0].type, "float' or 'int"));
    }
    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }
    if (1 + num <= 0) {
        handleRuntimeError(context, new ValueError(source, command as es.Node, context, "math_log1p"));
    }
  
    const result = Math.log1p(num);
    return { type: 'number', value: result };
}
  
export function math_log2(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_log2', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_log2', Number(1), args, false));
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, args[0].type, "float' or 'int"));
    }
    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }
    if (num <= 0) {
        handleRuntimeError(context, new ValueError(source, command as es.Node, context, "math_log2"));
    }
  
    const result = Math.log2(num);
    return { type: 'number', value: result };
}

export function math_pow(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 2) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_pow', Number(2), args, false));
    } else if (args.length > 2) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_pow', Number(2), args, false));
    }
  
    const base = args[0];
    const exp = args[1];
  
    if (base.type !== 'number' && base.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, base.type, "float' or 'int"));
    } else if (exp.type !== 'number' && exp.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, exp.type, "float' or 'int"));
    }
  
    let baseNum: number;
    if (base.type === 'number') {
        baseNum = base.value;
    } else {
        baseNum = Number(base.value);
    }
  
    let expNum: number;
    if (exp.type === 'number') {
        expNum = exp.value;
    } else {
        expNum = Number(exp.value);
    }
  
    const result = Math.pow(baseNum, expNum);
    return { type: 'number', value: result };
}

export function math_radians(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_radians', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_radians', Number(1), args, false));
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
    }
  
    let deg: number;
    if (x.type === 'number') {
        deg = x.value;
    } else { 
        deg = Number(x.value);
    }
  
    const radians = deg * Math.PI / 180;
    return { type: 'number', value: radians };
}

export function math_sin(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_sin', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_sin', Number(1), args, false));
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
    }
  
    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }
  
    const result = Math.sin(num);
    return { type: 'number', value: result };
}

export function math_sinh(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_sinh', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_sinh', Number(1), args, false));
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
    }
  
    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }
  
    const result = Math.sinh(num);
    return { type: 'number', value: result };
}

export function math_tan(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_tan', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_tan', Number(1), args, false));
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
    }
  
    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }
  
    const result = Math.tan(num);
    return { type: 'number', value: result };
}

export function math_tanh(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_tanh', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_tanh', Number(1), args, false));
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
    }
  
    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }
  
    const result = Math.tanh(num);
    return { type: 'number', value: result };
}

export function math_sqrt(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'math_sqrt', Number(1), args, false));
    } else if (args.length > 1) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'math_sqrt', Number(1), args, false));
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, x.type, "float' or 'int"));
    }
  
    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }
  
    if (num < 0) {
        handleRuntimeError(context, new ValueError(source, command as es.Node, context, "math_sqrt"));
    }
  
    const result = Math.sqrt(num);
    return { type: 'number', value: result };
}

export function max(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 2) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'max', Number(2), args, true));
    }

    const numericTypes = ['bigint', 'number'];
    const firstType = args[0].type;
    let isNumeric = numericTypes.includes(firstType);
    let isString = firstType === 'string';
  
    for (let i = 1; i < args.length; i++) {
        const t = args[i].type;
        if (isNumeric && !numericTypes.includes(t)) {
            handleRuntimeError(context, new TypeError(source, command as es.Node, context, args[i].type, "float' or 'int"));
        }
        if (isString && t !== 'string') {
            handleRuntimeError(context, new TypeError(source, command as es.Node, context, args[i].type, "string"));
        }
    }
  
    let useFloat = false;
    if (isNumeric) {
        for (const arg of args) {
            if (arg.type === 'number') {
                useFloat = true;
                break;
            }
        }
    }
  
    let maxIndex = 0;
    if (isNumeric) {
        if (useFloat) {
            let maxVal: number = Number(args[0].value);
            for (let i = 1; i < args.length; i++) {
                const curr: number = Number(args[i].value);
                if (curr > maxVal) {
                    maxVal = curr;
                    maxIndex = i;
                }
            }
        } else {
            let maxVal: bigint = args[0].value;
            for (let i = 1; i < args.length; i++) {
                const curr: bigint = args[i].value;
                if (curr > maxVal) {
                    maxVal = curr;
                    maxIndex = i;
                }
            }
        }
    } else if (isString) {
        let maxVal = args[0].value as string;
        for (let i = 1; i < args.length; i++) {
            const curr = args[i].value as string;
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

export function min(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 2) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'min', Number(2), args, true));
    }
  
    const numericTypes = ['bigint', 'number'];
    const firstType = args[0].type;
    let isNumeric = numericTypes.includes(firstType);
    let isString = firstType === 'string';

    for (let i = 1; i < args.length; i++) {
        const t = args[i].type;
        if (isNumeric && !numericTypes.includes(t)) {
            handleRuntimeError(context, new TypeError(source, command as es.Node, context, args[i].type, "float' or 'int"));
        }
        if (isString && t !== 'string') {
            handleRuntimeError(context, new TypeError(source, command as es.Node, context, args[i].type, "string"));
        }
    }

    let useFloat = false;
    if (isNumeric) {
        for (const arg of args) {
            if (arg.type === 'number') {
                useFloat = true;
                break;
            }
        }
    }

    let maxIndex = 0;
    if (isNumeric) {
        if (useFloat) {
            let maxVal: number = Number(args[0].value);
            for (let i = 1; i < args.length; i++) {
                const curr: number = Number(args[i].value);
                if (curr < maxVal) {
                    maxVal = curr;
                    maxIndex = i;
                }
            }
        } else {
            let maxVal: bigint = args[0].value;
            for (let i = 1; i < args.length; i++) {
                const curr: bigint = args[i].value;
                if (curr < maxVal) {
                    maxVal = curr;
                    maxIndex = i;
                }
            }
        }
    } else if (isString) {
        let maxVal = args[0].value as string;
        for (let i = 1; i < args.length; i++) {
            const curr = args[i].value as string;
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

export function random_random(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length > 0) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'random_random', Number(0), args, false));
    }
    const result = Math.random();
    return { type: 'number', value: result };
}

export function round(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length < 1) {
        handleRuntimeError(context, new MissingRequiredPositionalError(source, (command as es.Node), 'round', Number(1), args, true));
    } else if (args.length > 2) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'round', Number(2), args, true));
    }
  
    const numArg = args[0];
    if (numArg.type !== 'number' && numArg.type !== 'bigint') {
        handleRuntimeError(context, new TypeError(source, command as es.Node, context, numArg.type, "float' or 'int"));
    }
    
    let ndigitsArg = { type: 'bigint', value: BigInt(0) }; 
    if (args.length === 2 && args[1].type !== 'NoneType') {
        ndigitsArg = args[1];
    }

    if (numArg.type === 'number') {
        let numberValue: number = numArg.value;
        if (ndigitsArg.value > 0) {
            const shifted = Number(numberValue.toFixed(Number(ndigitsArg.value)));
            return { type: 'number', value: shifted };  
        } else if (ndigitsArg.value === BigInt(0)) {
            const shifted = Math.round(numArg.value);
            return { type: 'bigint', value: BigInt(shifted) };  
        } else {
            const shifted = Math.round(numArg.value / (10 ** (-Number(ndigitsArg.value)))) * (10 ** (-Number(ndigitsArg.value)));
            return { type: 'number', value: shifted };  
        }
    } else {
        if (ndigitsArg.value >= 0) {
            return numArg;
        } else {
            const shifted: bigint = numArg.value / (BigInt(10) ** (-ndigitsArg.value)) * (BigInt(10) ** (-ndigitsArg.value));
            return { type: 'bigint', value: shifted };
        }
    }
}

export function time_time(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length > 0) {
        handleRuntimeError(context, new TooManyPositionalArgumentsError(source, (command as es.Node), 'time_time', Number(0), args, false));
    }
    const currentTime = Date.now();
    return { type: 'number', value: currentTime };
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
function toPythonFloat(num: number): string {
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
        return num.toExponential().replace(/e([+-])(\d)$/, 'e$10$2');
    }
    if (Number.isInteger(num)) {
        return num.toFixed(1).toString();
    }
    return num.toString();
}

export function toPythonString(obj: Value): string {
    let ret: any;
    if ((obj as Value).type === 'bigint' || (obj as Value).type === 'complex') {
        ret = (obj as Value).value.toString();
    } else if ((obj as Value).type === 'number') {
        ret = toPythonFloat((obj as Value).value);
    } else if ((obj as Value).type === 'bool') {
        if ((obj as Value).value === true) {
            return "True";
        } else {
            return "False";
        }
    } else if ((obj as Value).type === 'error') {
        return (obj as Value).message;
    } else if ((obj as unknown as Closure).node) {
        for (let name in (obj as unknown as Closure).environment!.head) {
            if ((obj as unknown as Closure).environment!.head[name] === obj) {
                return '<function ' + name + '>';
            }
        }
    } else if ((obj as Value) === undefined || (obj as Value).value === undefined) {
        ret = 'None';
    } else {
        ret = (obj as Value).value.toString();
    }
    return ret;
}

export function str(args: Value[], source: string, command: ControlItem, context: Context): Value {
    if (args.length === 0) {
        return { type: 'string', value: "" };
    }
    const obj = args[0];
    const result = toPythonString(obj);
    return { type: 'string', value: result };
}

export function input(args: Value[], source: string, command: ControlItem, context: Context): Value {
    // TODO: : call conductor to receive user input
}

export function print(args: Value[], source: string, command: ControlItem, context: Context) {
    const pieces = args.map(arg => toPythonString(arg));
    const output = pieces.join(' ');
    addPrint(output);
    //return { type: 'string', value: output };
}
  