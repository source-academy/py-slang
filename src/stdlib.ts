import { ArrowFunctionExpression } from "estree";
import { Closure } from "./cse-machine/closure";
import { Value } from "./cse-machine/stash";

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

export function str(args: Value[]): Value {
    if (args.length === 0) {
        return { type: 'string', value: "" };
    }
    const obj = args[0];
    const result = toPythonString(obj);
    return { type: 'string', value: result };
}
