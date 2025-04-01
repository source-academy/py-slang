import { ArrowFunctionExpression } from "estree";
import { Closure } from "./cse-machine/closure";
import { Value } from "./cse-machine/stash";
// npm install mathjs
import { gamma, lgamma, erf } from 'mathjs';
import { addPrint } from "./cse-machine/interpreter";

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

export function _int(args: Value[]): Value {
    if (args.length === 0) {
        return { type: 'bigint', value: '0' };
    }
    if (args.length > 1) {
        throw new Error(`_int() expects at most 1 argument, but got ${args.length}`);
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

    throw new Error(`_int() expects a numeric argument (number or bigint), but got ${arg.type}`);
}

export function _int_from_string(args: Value[]): Value {
    if (args.length < 1) {
        throw new Error(`_int_from_string() expects at least 1 argument, but got 0`);
    }
    if (args.length > 2) {
        throw new Error(`_int_from_string() expects at most 2 arguments, but got ${args.length}`);
    }
  
    const strVal = args[0];
    if (strVal.type !== 'string') {
        throw new Error(
            `_int_from_string: first argument must be a string, got ${strVal.type}`
        );
    }
  
    let base: number = 10;
    if (args.length === 2) {
        // The second argument must be either a bigint or a number (it will be converted to a number for uniform processing).
        const baseVal = args[1];
        if (baseVal.type === 'bigint') {
            base = Number(baseVal.value);
        } else {
            throw new Error(
                `_int_from_string: second argument must be an integer (number or bigint), got ${baseVal.type}`
            );
        }
    }
  
    // base should be in between 2 and 36
    if (base < 2 || base > 36) {
        throw new Error(`_int_from_string: base must be in [2..36], got ${base}`);
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
        throw new Error(`_int_from_string: cannot parse "${strVal.value}" with base ${base}`);
    }
  
    const result: bigint = sign * BigInt(parsedNumber);

    return { type: 'bigint', value: result };
}
  
export function abs(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`abs expects exactly 1 argument, but got ${args.length}`);
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
            throw new Error(`abs: unsupported type ${x.type}`);
    }
}

function toStr(val: Value): string {
    return String(val.value);
}

export function error(args: Value[]): Value {
    const output = "Error: " + args.map(arg => toStr(arg)).join(' ') + '\n';
    
    throw new Error(output);
}

export function isinstance(args: Value[]): Value {
    if (args.length !== 2) {
        throw new Error(`isinstance expects exactly 2 arguments, but got ${args.length}`);
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
                throw new Error(`isinstance: unknown type '${classinfo.value}'`);
        }
    } else {
        // TODO: If the value is not in string format, additional handling can be added as needed.
        throw new Error(`isinstance: second argument must be a string representing a type, got ${classinfo.type}`);
    }

    const result = obj.type === expectedType;
  
    return { type: 'bool', value: result };
}

export function math_acos(args: Value[]): Value {
    if (args.length !== 1) {
      throw new Error(`math_acos expects exactly 1 argument, but got ${args.length}`);
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        throw new Error(`math_acos: argument must be a number, int, or bigint, but got ${x.type}`);
    }

    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }

    if (num < -1 || num > 1) {
        throw new Error(`math_acos: argument must be in the interval [-1, 1], but got ${num}`);
    }
  
    const result = Math.acos(num);
    return { type: 'number', value: result };
}

export function math_acosh(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`math_acosh expects exactly 1 argument, but got ${args.length}`);
    }
  
    const x = args[0];
  
    if (x.type !== 'number' && x.type !== 'bigint') {
        throw new Error(`math_acosh: argument must be a number, int, or bigint, but got ${x.type}`);
    }
  
    let num: number;
    if (x.type === 'number') {
      num = x.value;
    } else {
      num = Number(x.value);
    }

    if (num < 1) {
        throw new Error(`math_acosh: argument must be greater than or equal to 1, but got ${num}`);
    }
  
    const result = Math.acosh(num);
    return { type: 'number', value: result };
}

export function math_asin(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`math_asin expects exactly 1 argument, but got ${args.length}`);
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        throw new Error(`math_asin: argument must be a number, int, or bigint, but got ${x.type}`);
    }
  
    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }
  
    if (num < -1 || num > 1) {
        throw new Error(`math_asin: argument must be in the interval [-1, 1], but got ${num}`);
    }
  
    const result = Math.asin(num);
    return { type: 'number', value: result };
}

export function math_asinh(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`math_asinh expects exactly 1 argument, but got ${args.length}`);
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        throw new Error(`math_asinh: argument must be a number, int, or bigint, but got ${x.type}`);
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

export function math_atan(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`math_atan expects exactly 1 argument, but got ${args.length}`);
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'int' && x.type !== 'bigint') {
        throw new Error(`math_atan: argument must be a number, int, or bigint, but got ${x.type}`);
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

export function math_atan2(args: Value[]): Value {
    if (args.length !== 2) {
        throw new Error(`math_atan2 expects exactly 2 arguments, but got ${args.length}`);
    }
  
    const y = args[0];
    const x = args[1];
    if (
        (y.type !== 'number' && y.type !== 'bigint') ||
        (x.type !== 'number' && x.type !== 'bigint')
    ) {
        throw new Error(`math_atan2: both arguments must be a number, int, or bigint`);
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

export function math_atanh(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`math_atanh expects exactly 1 argument, but got ${args.length}`);
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        throw new Error(`math_atanh: argument must be a number, int, or bigint, but got ${x.type}`);
    }
  
    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }
  
    if (num <= -1 || num >= 1) {
        throw new Error(`math_atanh: argument must be in the interval (-1, 1), but got ${num}`);
    }
  
    const result = Math.atanh(num);
    return { type: 'number', value: result };
}

export function math_cos(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`math_cos expects exactly 1 argument, but got ${args.length}`);
    }
    
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        throw new Error(`math_cos: argument must be a number, int, or bigint, but got ${x.type}`);
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

export function math_cosh(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`math_cosh expects exactly 1 argument, but got ${args.length}`);
    }
    
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        throw new Error(`math_cosh: argument must be a number, int, or bigint, but got ${x.type}`);
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

export function math_degrees(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`math_degrees expects exactly 1 argument, but got ${args.length}`);
    }
    
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        throw new Error(`math_degrees: argument must be a number, int, or bigint, but got ${x.type}`);
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

export function math_erf(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`math_erf expects exactly 1 argument, but got ${args.length}`);
    }
    
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        throw new Error(`math_erf: argument must be a number, int, or bigint, but got ${x.type}`);
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

export function math_erfc(args: Value[]): Value {
    if (args.length !== 1) {
      throw new Error(`math_erfc expects exactly 1 argument, but got ${args.length}`);
    }
    
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        throw new Error(`math_erfc: argument must be a number, int, or bigint, but got ${x.type}`);
    }
    
    const erfc = 1 - math_erf(args[0]).value;
    
    return { type: 'number', value: erfc };
}

export function char_at(args: Value[]): Value {
    if (args.length !== 2) {
        throw new Error(`char_at expects exactly 2 arguments, but got ${args.length}`);
    }
  
    const s = args[0];
    const i = args[1];
  
    if (s.type !== 'string') {
      throw new Error(`char_at: first argument must be a string, but got ${typeof s}`);
    }
    if (i.type !== 'number' && i.type !== 'bigint') {
      throw new Error(`char_at: second argument must be a number, but got ${typeof i}`);
    }
  
    const index = i.value;

    return { type: 'string', value: (s.value)[index]};
}

export function math_comb(args: Value[]): Value {
    if (args.length !== 2) {
        throw new Error(`comb expects exactly 2 arguments, but got ${args.length}`);
    }
  
    const n = args[0];
    const k = args[1];
  
    if (n.type !== 'bigint' || k.type !== 'bigint') {
        throw new Error(
            `comb: both arguments must be 'bigint', but got n=${n.type}, k=${k.type}`
        );
    }
  
    const nVal = BigInt(n.value);
    const kVal = BigInt(k.value);
  
    if (nVal < 0 || kVal < 0) {
        throw new Error(`comb: n and k must be non-negative, got n=${nVal}, k=${kVal}`);
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

export function math_factorial(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`factorial expects exactly 1 argument, but got ${args.length}`);
    }
  
    const n = args[0];
    
    if (n.type !== 'bigint') {
        throw new Error(`factorial: argument must be an integer (bigint), but got ${n.type}`);
    }
  
    const nVal = BigInt(n.value);
  
    if (nVal < 0) {
      throw new Error(`factorial: argument must be non-negative, but got ${nVal}`);
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
  
export function math_gcd(args: Value[]): Value {
    if (args.length === 0) {
      return { type: 'bigint', value: BigInt(0) };
    }
  
    const values = args.map((v, idx) => {
        if (v.type !== 'bigint') {
            throw new Error(`gcd: argument #${idx + 1} must be an integer (bigint), got ${v.type}`);
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

export function math_isqrt(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`isqrt expects exactly 1 argument, but got ${args.length}`);
    }
  
    const nValObj = args[0];
    if (nValObj.type !== 'bigint') {
        throw new Error(`isqrt: argument must be a nonnegative integer (bigint), but got ${nValObj.type}`);
    }
  
    const n: bigint = nValObj.value;
  
    if (n < 0) {
      throw new Error(`isqrt: argument must be nonnegative, but got ${n}`);
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
  
export function math_lcm(args: Value[]): Value {
    if (args.length === 0) {
        return { type: 'bigint', value: BigInt(1) };
    }
  
    const values = args.map((val, idx) => {
        if (val.type !== 'bigint') {
            throw new Error(`lcm: argument #${idx + 1} must be a bigint, got ${val.type}`);
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

export function math_perm(args: Value[]): Value {
    if (args.length < 1 || args.length > 2) {
        throw new Error(`perm expects 1 or 2 arguments, but got ${args.length}`);
    }

    const nValObj = args[0];
    if (nValObj.type !== 'bigint') {
        throw new Error(
            `perm: first argument n must be an integer (bigint), but got ${nValObj.type}`
        );
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
            throw new Error(
                `perm: second argument k must be an integer (bigint) or None, but got ${kValObj.type}`
            );
        }
    }
  
    if (n < 0 || k < 0) {
        throw new Error(`perm: n and k must be non-negative, got n=${n}, k=${k}`);
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

export function math_ceil(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`ceil expects exactly 1 argument, but got ${args.length}`);
    }
  
    const x = args[0];
  
    if (x.type === 'bigint') {
        return x;
    }
  
    if (x.type === 'number') {
        const numVal = x.value as number;
        if (typeof numVal !== 'number') {
            throw new Error(`ceil: value must be a JavaScript number, got ${typeof numVal}`);
        }
        const ceiled: bigint = BigInt(Math.ceil(numVal));
        return { type: 'bigint', value: ceiled };
    }
  
    throw new Error(
        `ceil: unsupported type '${x.type}'. If simulating Python, implement x.__ceil__.`
    );
}

export function math_fabs(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`fabs expects exactly 1 argument, but got ${args.length}`);
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
            throw new Error(`fabs: expected a JavaScript number, got ${typeof numVal}`);
        }
        const absVal: number = Math.abs(numVal);
        return { type: 'number', value: absVal };
    }

    throw new Error(`fabs: unsupported type '${x.type}'. Implement x.__abs__ if needed.`);
}

export function math_floor(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`floor expects exactly 1 argument, but got ${args.length}`);
    }
  
    const x = args[0];
  
    if (x.type === 'bigint') {
        return x;
    }

    if (x.type === 'number') {
        const numVal: number = x.value as number;
        if (typeof numVal !== 'number') {
            throw new Error(`floor: expected a JavaScript number, got ${typeof numVal}`);
        }
        const floored: bigint = BigInt(Math.floor(numVal));
        return { type: 'bigint', value: floored };
    }

    throw new Error(
        `floor: unsupported type '${x.type}'. Implement x.__floor__ if needed.`
    );
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

function toNumber(val: Value): number {
    if (val.type === 'bigint') {
        return Number(val.value);
    } else if (val.type === 'number') {
        return val.value as number;
    } else {
        throw new Error(`unsupported type '${val.type}'`);
    }
}

export function math_fma(args: Value[]): Value {
    if (args.length !== 3) {
        throw new Error(`fma expects exactly 3 arguments, but got ${args.length}`);
    }
    
    const xVal = toNumber(args[0]);
    const yVal = toNumber(args[1]);
    const zVal = toNumber(args[2]);

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

export function math_fmod(args: Value[]): Value {
    if (args.length !== 2) {
        throw new Error(`fmod expects exactly 2 arguments, but got ${args.length}`);
    }

    // Convert inputs to numbers
    const xVal = toNumber(args[0]);
    const yVal = toNumber(args[1]);

    // Divisor cannot be zero
    if (yVal === 0) {
        throw new Error("fmod: divisor (y) must not be zero");
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
  
export function math_remainder(args: Value[]): Value {
    if (args.length !== 2) {
        throw new Error(`remainder expects exactly 2 arguments, but got ${args.length}`);
    }
    
    const x = args[0];
    const y = args[1];

    let xValue: number;
    if (x.type === 'bigint') {
        xValue = Number(x.value);
    } else if (x.type === 'number') {
        xValue = x.value as number;
    } else {
        throw new Error(`remainder: unsupported type '${x.type}' for first argument`);
    }

    let yValue: number;
    if (y.type === 'bigint') {
        yValue = Number(y.value);
    } else if (y.type === 'number') {
        yValue = y.value as number;
    } else {
        throw new Error(`remainder: unsupported type '${y.type}' for second argument`);
    }

    if (yValue === 0) {
        throw new Error(`remainder: divisor y must not be zero`);
    }

    const quotient = xValue / yValue;
    const n = roundToEven(quotient);
    const remainder = xValue - n * yValue;

    return { type: 'number', value: remainder };
}

export function math_trunc(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`trunc expects exactly 1 argument, but got ${args.length}`);
    }
  
    const x = args[0];
  
    if (x.type === 'bigint') {
        return x;
    }
  
    if (x.type === 'number') {
        const numVal: number = x.value as number;
        if (typeof numVal !== 'number') {
            throw new Error(`trunc: argument must be a number, got ${typeof numVal}`);
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
  
    throw new Error(`trunc: unsupported type '${x.type}'. Implement x.__trunc__ if needed.`);
}

export function math_copysign(args: Value[]): Value {
    if (args.length !== 2) {
        throw new Error(`copysign expects exactly 2 arguments, but got ${args.length}`);
    }
  
    const [x, y] = args;

    if ((x.type !== 'number' && x.type !== 'bigint') || 
            (y.type !== 'number' && y.type !== 'bigint')) {
        throw new Error(`copysign: both x and y must be of type 'number'`);
    }
    
    const xVal = Number(x.value) as number;
    const yVal = Number(y.value) as number;

    const absVal = Math.abs(xVal);
    const isNegative = yVal < 0 || (Object.is(yVal, -0));
    const result = isNegative ? -absVal : absVal;
    
    return { type: 'number', value: Number(result) };
}

export function math_isfinite(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`isfinite expects exactly 1 argument, but got ${args.length}`);
    }

    const xValObj = args[0];
    if (xValObj.type !== 'number') {
      throw new Error(`isfinite: argument must be 'number', got '${xValObj.type}'`);
    }
  
    const x = xValObj.value as number;
    const result: boolean = Number.isFinite(x);
  
    return { type: 'bool', value: result };
}

export function math_isinf(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`isinf expects exactly 1 argument, but got ${args.length}`);
    }

    const xValObj = args[0];
    if (xValObj.type !== 'number') {
        throw new Error(`isinf: argument must be 'number', got '${xValObj.type}'`);
    }
  
    const x = xValObj.value as number;
    const result: boolean = (x === Infinity || x === -Infinity);
  
    return { type: 'bool', value: result };
}

export function math_isnan(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`isnan expects exactly 1 argument, but got ${args.length}`);
    }
  
    const xValObj = args[0];
    if (xValObj.type !== 'number') {
        throw new Error(`isnan: argument must be 'number', got '${xValObj.type}'`);
    }
  
    const x = xValObj.value as number;
    const result: boolean = Number.isNaN(x);
  
    return { type: 'bool', value: result };
}

export function math_ldexp(args: Value[]): Value {
    if (args.length !== 2) {
      throw new Error(`ldexp expects exactly 2 arguments, but got ${args.length}`);
    }

    const xVal = toNumber(args[0]);

    if (args[1].type !== 'bigint') {
        throw new Error(`ldexp: argument must be 'int', got '${args[1].type}'`);
    }
    const expVal = args[1].value;

    // Perform x * 2^expVal
    // In JavaScript, 2**expVal may overflow or underflow, yielding Infinity or 0 respectively.
    // That behavior parallels typical C library rules for ldexp.
    const result = xVal * Math.pow(2, Number(expVal));
  
    return { type: 'number', value: result };
}
  
export function math_nextafter(args: Value[]): Value {
    // TODO: Implement math_nextafter using proper bit-level manipulation and handling special cases (NaN, Infinity, steps, etc.)
    throw new Error("math_nextafter not implemented");
}

export function math_ulp(args: Value[]): Value {
    // TODO: Implement math_ulp to return the unit in the last place (ULP) of the given floating-point number.
    throw new Error("math_ulp not implemented");
}

export function math_cbrt(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`math_cbrt expects exactly 1 argument, but got ${args.length}`);
    }

    const xVal = args[0];
    let x: number;

    if (xVal.type !== 'number') {
        if (xVal.type === 'bigint') {
            x = Number(xVal.value);
        } else {
            throw new Error(`math_cbrt: argument must be a number, got ${xVal.type}`);
        }
    } else {
        x = xVal.value as number;
    }

    const result = Math.cbrt(x);

    return { type: 'number', value: result };
}

export function math_exp(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`math_exp expects exactly 1 argument, but got ${args.length}`);
    }
  
    const xVal = args[0];
    let x: number;

    if (xVal.type !== 'number') {
        if (xVal.type === 'bigint') {
            x = Number(xVal.value);
        } else {
            throw new Error(`math_cbrt: argument must be a number, got ${xVal.type}`);
        }
    } else {
        x = xVal.value as number;
    }

    const result = Math.exp(x);
    return { type: 'number', value: result };
}

export function math_exp2(args: Value[]): Value {
    if (args.length !== 1) {
      throw new Error(`math_exp2 expects exactly 1 argument, but got ${args.length}`);
    }
  
    const xVal = args[0];
    let x: number;

    if (xVal.type !== 'number') {
        if (xVal.type === 'bigint') {
            x = Number(xVal.value);
        } else {
            throw new Error(`math_cbrt: argument must be a number, got ${xVal.type}`);
        }
    } else {
        x = xVal.value as number;
    }
    
    const result = Math.pow(2, x);
    return { type: 'number', value: result };
}

export function math_expm1(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`math_expm1 expects exactly 1 argument, but got ${args.length}`);
    }
    
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        throw new Error(`math_expm1: argument must be a number, int, or bigint, but got ${x.type}`);
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

export function math_gamma(args: Value[]): Value { 
    if (args.length !== 1) {
        throw new Error(`gamma expects exactly 1 argument, but got ${args.length}`);
    }
    
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        throw new Error(`gamma: argument must be a number, int, or bigint, but got ${x.type}`);
    }

    const z = toNumber(x);
    const result = gamma(z);

    return { type: 'number', value: result };
}

export function math_lgamma(args: Value[]): Value { 
    if (args.length !== 1) {
        throw new Error(`gamma expects exactly 1 argument, but got ${args.length}`);
    }
    
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        throw new Error(`gamma: argument must be a number, int, or bigint, but got ${x.type}`);
    }

    const z = toNumber(x);
    const result = lgamma(z);

    return { type: 'number', value: result };
}

export function math_log(args: Value[]): Value {
    if (args.length < 1 || args.length > 2) {
      throw new Error(`math_log expects 1 or 2 arguments, but got ${args.length}`);
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        throw new Error(`math_log: first argument must be a number, int, or bigint, but got ${x.type}`);
    }
    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }
    
    if (num <= 0) {
        throw new Error(`math_log: argument must be positive, but got ${num}`);
    }
  
    if (args.length === 1) {
        return { type: 'number', value: Math.log(num) };
    }
  
    const baseArg = args[1];
    if (baseArg.type !== 'number' && baseArg.type !== 'int' && baseArg.type !== 'bigint') {
        throw new Error(`math_log: base argument must be a number, int, or bigint, but got ${baseArg.type}`);
    }
    let baseNum: number;
    if (baseArg.type === 'number') {
        baseNum = baseArg.value;
    } else {
        baseNum = Number(baseArg.value);
    }
    if (baseNum <= 0) {
        throw new Error(`math_log: base must be positive, but got ${baseNum}`);
    }
  
    const result = Math.log(num) / Math.log(baseNum);
    return { type: 'number', value: result };
}

export function math_log10(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`math_log10 expects exactly 1 argument, but got ${args.length}`);
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        throw new Error(`math_log10: argument must be a number, int, or bigint, but got ${x.type}`);
    }
    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }
    if (num <= 0) {
        throw new Error(`math_log10: argument must be positive, but got ${num}`);
    }
  
    const result = Math.log10(num);
    return { type: 'number', value: result };
}
  
export function math_log1p(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`math_log1p expects exactly 1 argument, but got ${args.length}`);
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        throw new Error(`math_log1p: argument must be a number, int, or bigint, but got ${x.type}`);
    }
    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }
    if (1 + num <= 0) {
        throw new Error(`math_log1p: 1 + argument must be positive, but got 1 + ${num} = ${1 + num}`);
    }
  
    const result = Math.log1p(num);
    return { type: 'number', value: result };
}
  
export function math_log2(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`math_log2 expects exactly 1 argument, but got ${args.length}`);
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        throw new Error(`math_log2: argument must be a number, int, or bigint, but got ${x.type}`);
    }
    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }
    if (num <= 0) {
        throw new Error(`math_log2: argument must be positive, but got ${num}`);
    }
  
    const result = Math.log2(num);
    return { type: 'number', value: result };
}

export function math_pow(args: Value[]): Value {
    if (args.length !== 2) {
      throw new Error(`math_pow expects exactly 2 arguments, but got ${args.length}`);
    }
  
    const base = args[0];
    const exp = args[1];
  
    if ((base.type !== 'number' && base.type !== 'bigint') ||
        (exp.type !== 'number' && exp.type !== 'bigint')) {
        throw new Error(`math_pow: both arguments must be a number or bigint`);
    }
  
    let baseNum: number;
    if (base.type === 'number') {
        baseNum = base.value;
    } else { // 'bigint'
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

export function math_radians(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`math_radians expects exactly 1 argument, but got ${args.length}`);
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        throw new Error(`math_radians: argument must be a number, int, or bigint, but got ${x.type}`);
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

export function math_sin(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`math_sin expects exactly 1 argument, but got ${args.length}`);
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        throw new Error(`math_sin: argument must be a number, int, or bigint, but got ${x.type}`);
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

export function math_sinh(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`math_sinh expects exactly 1 argument, but got ${args.length}`);
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        throw new Error(`math_sinh: argument must be a number, int, or bigint, but got ${x.type}`);
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

export function math_tan(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`math_tan expects exactly 1 argument, but got ${args.length}`);
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        throw new Error(`math_tan: argument must be a number, int, or bigint, but got ${x.type}`);
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

export function math_tanh(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`math_tanh expects exactly 1 argument, but got ${args.length}`);
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'bigint') {
        throw new Error(`math_tanh: argument must be a number, int, or bigint, but got ${x.type}`);
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

export function math_sqrt(args: Value[]): Value {
    if (args.length !== 1) {
        throw new Error(`math_sqrt expects exactly 1 argument, but got ${args.length}`);
    }
  
    const x = args[0];
    if (x.type !== 'number' && x.type !== 'int' && x.type !== 'bigint') {
        throw new Error(`math_sqrt: argument must be a number, int, or bigint, but got ${x.type}`);
    }
  
    let num: number;
    if (x.type === 'number') {
        num = x.value;
    } else {
        num = Number(x.value);
    }
  
    if (num < 0) {
        throw new Error(`math_sqrt: argument must be non-negative, but got ${num}`);
    }
  
    const result = Math.sqrt(num);
    return { type: 'number', value: result };
}

export function max(args: Value[]): Value {
    if (args.length < 2) {
        throw new Error(`max expects at least 2 arguments, but got ${args.length}`);
    }
  
    const numericTypes = ['bigint', 'number'];
    const firstType = args[0].type;
    let isNumeric = numericTypes.includes(firstType);
    let isString = firstType === 'string';
  
    for (let i = 1; i < args.length; i++) {
        const t = args[i].type;
        if (isNumeric && !numericTypes.includes(t)) {
            throw new Error(`max: all arguments must be mutually comparable (all numeric or all string)`);
        }
        if (isString && t !== 'string') {
            throw new Error(`max: all arguments must be mutually comparable (all numeric or all string)`);
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
        throw new Error(`max: unsupported type ${firstType}`);
    }
  
    return args[maxIndex];
}

export function min(args: Value[]): Value {
    if (args.length < 2) {
        throw new Error(`min expects at least 2 arguments, but got ${args.length}`);
    }
  
    const numericTypes = ['bigint', 'number'];
    const firstType = args[0].type;
    let isNumeric = numericTypes.includes(firstType);
    let isString = firstType === 'string';

    for (let i = 1; i < args.length; i++) {
        const t = args[i].type;
        if (isNumeric && !numericTypes.includes(t)) {
            throw new Error(`min: all arguments must be mutually comparable (all numeric or all string)`);
        }
        if (isString && t !== 'string') {
            throw new Error(`min: all arguments must be mutually comparable (all numeric or all string)`);
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
        throw new Error(`min: unsupported type ${firstType}`);
    }

    return args[maxIndex];
}

export function random_random(args: Value[]): Value {
    if (args.length !== 0) {
        throw new Error(`random_random expects exactly 0 arguments, but got ${args.length}`);
    }
    const result = Math.random();
    return { type: 'number', value: result };
}

export function round(args: Value[]): Value {
    if (args.length < 1 || args.length > 2) {
        throw new Error(`round expects 1 or 2 arguments, but got ${args.length}`);
    }
  
    const numArg = args[0];
    if (numArg.type !== 'number' && numArg.type !== 'bigint') {
        throw new Error(`round: first argument must be a number, int, or bigint, but got ${numArg.type}`);
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

export function time_time(args: Value[]): Value {
    if (args.length !== 0) {
        throw new Error(`time_time expects 0 arguments, but got ${args.length}`);
    }
    const currentTime = Date.now();
    return { type: 'number', value: currentTime };
}

function toPythonFloat(num: number): string {
    //num = Number(num);
    //console.info(typeof(num));
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

export function str(args: Value[]): Value {
    if (args.length === 0) {
        return { type: 'string', value: "" };
    }
    const obj = args[0];
    const result = toPythonString(obj);
    return { type: 'string', value: result };
}

export function input(args: Value[]): Value {
    // TODO: 
    // nodejs
    // readline
    // distinguish between browser and commandline
}

export function print(args: Value[]) {
    // Convert each argument using toPythonString (an assumed helper function).
    const pieces = args.map(arg => toPythonString(arg));
    // Join them with spaces.
    const output = pieces.join(' ');
    // Actually print to console (you can replace this with any desired output).
    // console.info(output);
    addPrint(output);
    //return { type: 'string', value: output };
}
  