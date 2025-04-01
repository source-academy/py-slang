import * as es from 'estree'
import { str, toPythonString } from './stdlib'
import { Value } from './cse-machine/stash'
import { Context } from './cse-machine/context'
import { ModuleFunctions } from './modules/moduleTypes'

export class CSEBreak {}

// export class CseError {
//     constructor(public readonly error: any) {}
// }

export enum ErrorType {
    IMPORT = 'Import',
    RUNTIME = 'Runtime',
    SYNTAX = 'Syntax',
    TYPE = 'Type'
}

export enum ErrorSeverity {
    WARNING = 'Warning',
    ERROR = 'Error'
}

// any and all errors ultimately implement this interface. as such, changes to this will affect every type of error.
export interface SourceError {
    type: ErrorType
    severity: ErrorSeverity
    location: es.SourceLocation
    explain(): string
    elaborate(): string
}

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
        if (!/[jJ]/.test(str)) {
            const realVal = Number(str);
            if (isNaN(realVal)) {
                throw new Error(`Invalid complex string: ${str}`);
            }
            return new PyComplexNumber(realVal, 0);
        }

        const lower = str.toLowerCase();
        if (lower.endsWith('j')) {
            const numericPart = str.substring(0, str.length - 1);
            if (numericPart === '' || numericPart === '+' || numericPart === '-') {
                const sign = (numericPart === '-') ? -1 : 1;
                return new PyComplexNumber(0, sign * 1);
            }

            const imagVal = Number(numericPart);
            if (isNaN(imagVal)) {
                throw new Error(`Invalid complex string: ${str}`);
            }
            return new PyComplexNumber(0, imagVal);
        }

        const match = str.match(/^([\+\-]?\d+(\.\d+)?([eE][+\-]?\d+)?)([\+\-]\d+(\.\d+)?([eE][+\-]?\d+)?)?[jJ]?$/);
        if (!match) {
            throw new Error(`Invalid complex string: ${str}`);
        }

        const realPart = Number(match[1]);
        let imagPart = 0;

        if (match[4]) {
            imagPart = Number(match[4]);
        }

        return new PyComplexNumber(realPart, imagPart);
    }

    public static fromValue(value: number | bigint | string | PyComplexNumber): PyComplexNumber {
        if (value instanceof PyComplexNumber) {
            return new PyComplexNumber(value.real, value.imag);
        }
        if (typeof value === "number") {
            return PyComplexNumber.fromNumber(value);
        }
        if (typeof value === "bigint") {
            return PyComplexNumber.fromBigInt(value);
        }
        return PyComplexNumber.fromString(value);
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
    public div(other: PyComplexNumber): PyComplexNumber {
        // (a+bi)/(c+di) = ((a+bi)*(c-di)) / (c^2 + d^2)
        const denominator = other.real * other.real + other.imag * other.imag;
        if (denominator === 0) {
            throw new Error(`Division by zero in complex number.`);
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
                throw new Error('0 cannot be raised to a negative or complex power');
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
        
        const sign = (this.imag >= 0) ? "+" : "";

        // return `(${this.real}${sign}${this.imag}j)`;
        return `(${this.toPythonComplexFloat(this.real)}${sign}${this.toPythonComplexFloat(this.imag)}j)`;
    }

    private toPythonComplexFloat(num: number){
        if (num === Infinity) {
            return "inf";
        }
        if (num === -Infinity) {
            return "-inf";
        }
        
        if (Math.abs(num) >= 1e16 || (num !== 0 && Math.abs(num) < 1e-4)) {
            return num.toExponential().replace(/e([+-])(\d)$/, 'e$10$2');
        }
        return num.toString();
    }

    public equals(other: PyComplexNumber): boolean {
        return (Number(this.real) === Number(other.real) && Number(this.imag) === Number(other.imag));
    }
}

export interface None extends es.BaseNode {
    type: 'NoneType';
    loc?: es.SourceLocation;
}

export interface ComplexLiteral extends es.BaseNode {
    type: 'Literal';
    complex: {
        real: number;
        imag: number;
    }
    loc?: es.SourceLocation;
}

/**
 * Helper type to recursively make properties that are also objects
 * partial
 *
 * By default, `Partial<Array<T>>` is equivalent to `Array<T | undefined>`. For this type, `Array<T>` will be
 * transformed to Array<Partial<T>> instead
 */
export type RecursivePartial<T> =
  T extends Array<any>
    ? Array<RecursivePartial<T[number]>>
    : T extends Record<any, any>
      ? Partial<{
          [K in keyof T]: RecursivePartial<T[K]>
        }>
      : T

export type Result = Finished | Error | SuspendedCseEval // | Suspended

// TODO: should allow debug
// export interface Suspended {
//     status: 'suspended'
//     it: IterableIterator<Value>
//     scheduler: Scheduler
//     context: Context
// }
  
export interface SuspendedCseEval {
    status: 'suspended-cse-eval'
    context: Context
}

export interface Finished {
    status: 'finished'
    context: Context
    value: Value
    representation: Representation // if the returned value needs a unique representation,
    // (for example if the language used is not JS),
    // the display of the result will use the representation
    // field instead
}

// export class Representation {
//     constructor(public representation: string) {}
//     toString() {
//         return this.representation
//     }
// }

export class Representation {
    constructor(public representation: string) {}
  
    toString(value: any): string {
        // call str(value) in stdlib
        // TODO: mapping
        const result = toPythonString(value);
        return result;
    }
}

export interface NativeStorage {
    builtins: Map<string, Value>
    previousProgramsIdentifiers: Set<string>
    operators: Map<string, (...operands: Value[]) => Value>
    maxExecTime: number
    evaller: null | ((program: string) => Value)
    /*
    the first time evaller is used, it must be used directly like `eval(code)` to inherit
    surrounding scope, so we cannot set evaller to `eval` directly. subsequent assignments to evaller will
    close in the surrounding values, so no problem
     */
    loadedModules: Record<string, ModuleFunctions>
    loadedModuleTypes: Record<string, Record<string, string>>
}
