import { Closure } from "./cse-machine/closure";
import { Value } from "./cse-machine/stash";


export function toPythonFloat(num: number): string {
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