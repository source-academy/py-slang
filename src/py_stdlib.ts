import { ControlItem } from './cse-machine/control'
import { PyContext } from './cse-machine/py_context'
import { PyClosure } from './cse-machine/py_closure'
import { Value } from './cse-machine/stash'
import { pyHandleRuntimeError } from './cse-machine/py_utils'
import { ValueError, TypeError } from './errors/py_errors'
import { ExprNS } from './ast-types'

export function toPythonFloat(num: number): string {
  if (Object.is(num, -0)) {
    return '-0.0'
  }
  if (num === 0) {
    return '0.0'
  }

  if (num === Infinity) {
    return 'inf'
  }
  if (num === -Infinity) {
    return '-inf'
  }

  if (Number.isNaN(num)) {
    return 'nan'
  }

  if (Math.abs(num) >= 1e16 || (num !== 0 && Math.abs(num) < 1e-4)) {
    return num.toExponential().replace(/e([+-])(\d)$/, 'e$10$2')
  }
  if (Number.isInteger(num)) {
    return num.toFixed(1).toString()
  }
  return num.toString()
}

export function toPythonString(obj: Value): string {
  let ret: any
  if (!obj) {
    return 'None'
  }
  if ((obj as Value).type === 'builtin') {
    return `<built-in function ${(obj as any).name}>`
  }
  if ((obj as Value).type === 'bigint' || (obj as Value).type === 'complex') {
    ret = (obj as Value).value.toString()
  } else if ((obj as Value).type === 'number') {
    ret = toPythonFloat((obj as Value).value)
  } else if ((obj as Value).type === 'bool') {
    if ((obj as Value).value === true) {
      return 'True'
    } else {
      return 'False'
    }
  } else if ((obj as Value).type === 'error') {
    return (obj as Value).message
  } else if (obj instanceof PyClosure) {
    if (obj.node) {
      const funcName = (obj.node as any).name?.lexeme || '(anonymous)'
      return `<function ${funcName}>`
    }
  } else if ((obj as Value).value === undefined) {
    ret = 'None'
  } else {
    ret = (obj as Value).value.toString()
  }
  return ret
}

export class BuiltInFunctions {
  static print(source: string, node: ExprNS.Expr, context: PyContext, ...args: Value[]): Value {
    const output = args.map(arg => toPythonString(arg)).join(' ')
    context.output += output + '\n'
    return { type: 'undefined' }
  }

  static _int(source: string, node: ExprNS.Expr, context: PyContext, ...args: Value[]): Value {
    if (args.length === 0) {
      return { type: 'bigint', value: BigInt(0) }
    }

    const arg = args[0]
    if (args.length === 1) {
      if (arg.type === 'number') {
        const truncated = Math.trunc(arg.value)
        return { type: 'bigint', value: BigInt(truncated) }
      }
      if (arg.type === 'bigint') {
        return { type: 'bigint', value: arg.value }
      }
      if (arg.type === 'string') {
        const str = arg.value.trim().replace(/_/g, '')
        if (!/^[+-]?\d+$/.test(str)) {
          pyHandleRuntimeError(
            context,
            new ValueError(source, node, context, 'int')
          )
        }
        return { type: 'bigint', value: BigInt(str) }
      }
    } else if (args.length === 2) {
      const baseArg = args[1]
      if (arg.type !== 'string') {
        pyHandleRuntimeError(
          context,
          new TypeError(source, node, context, arg.type, 'string')
        )
      }
      if (baseArg.type !== 'bigint') {
        pyHandleRuntimeError(
          context,
          new TypeError(source, node, context, baseArg.type, "float' or 'int")
        )
      }

      let base = Number(baseArg.value)
      let str = arg.value.trim().replace(/_/g, '')

      const sign = str.startsWith('-') ? -1 : 1
      if (str.startsWith('+') || str.startsWith('-')) {
        str = str.substring(1)
      }

      if (base === 0) {
        if (str.startsWith('0x') || str.startsWith('0X')) {
          base = 16
          str = str.substring(2)
        } else if (str.startsWith('0o') || str.startsWith('0O')) {
          base = 8
          str = str.substring(2)
        } else if (str.startsWith('0b') || str.startsWith('0B')) {
          base = 2
          str = str.substring(2)
        } else {
          base = 10
        }
      }

      if (base < 2 || base > 36) {
        pyHandleRuntimeError(
          context,
          new ValueError(source, node, context, "float' or 'int")
        )
      }
      
      const validChars = '0123456789abcdefghijklmnopqrstuvwxyz'.substring(0, base)
      const regex = new RegExp(`^[${validChars}]+$`, 'i')
      if (!regex.test(str)) {
        pyHandleRuntimeError(
          context,
          new ValueError(source, node, context, "float' or 'int")
        )
      }

      const parsed = parseInt(str, base)
      return { type: 'bigint', value: BigInt(sign * parsed) }
    } else {
      // should be handled by a Validate decorator, but for now...
      // throw new TooManyPositionalArgumentsError(...)
    }
    pyHandleRuntimeError(
      context,
      new TypeError(
      source,
      node,
      context,
      arg.type,
      "string, a bytes-like object or a real number"
      )
    )
  }
  static abs(source: string, node: ExprNS.Expr, context: PyContext, ...args: Value[]): Value {
    const x = args[0]
    switch (x.type) {
      case 'bigint': {
        const intVal = x.value
        const result: bigint = intVal < 0 ? -intVal : intVal
        return { type: 'int', value: result }
      }
      case 'number': {
        return { type: 'number', value: Math.abs(x.value) }
      }
      case 'complex': {
        // Calculate the modulus (absolute value) of a complex number.
        const real = x.value.real
        const imag = x.value.imag
        const modulus = Math.sqrt(real * real + imag * imag)
        return { type: 'number', value: modulus }
      }
      default:
        pyHandleRuntimeError(
          context,
          new TypeError(
            source,
            node,
            context,
            args[0].type,
            "float', 'int' or 'complex"
          )
        )
    }
  }

  static str(source: string, node: ExprNS.Expr, context: PyContext, ...args: Value[]): Value {
      if (args.length === 0) {
        return { type: 'string', value: '' }
      }
      const obj = args[0]
      const result = toPythonString(obj)
      return { type: 'string', value: result }
    }

  static error(source: string, node: ExprNS.Expr, context: PyContext, ...args: Value[]): Value {
    const output = 'Error: ' + args.map(arg => toPythonString(arg)).join(' ') + '\n'
    throw new Error(output)
  }
}
import py_s1_constants from './stdlib/py_s1_constants_copy.json'

// NOTE: If we ever switch to another Python “chapter” (e.g. py_s2_constants),
//       just change the variable below to switch to the set.
const constants = py_s1_constants

/*
    Create a map to hold built-in constants.
    Each constant is stored with a string key and its corresponding value object.
*/
export const builtInConstants = new Map<string, any>()

const constantMap = {
  math_e: { type: 'number', value: Math.E },
  math_inf: { type: 'number', value: Infinity },
  math_nan: { type: 'number', value: NaN },
  math_pi: { type: 'number', value: Math.PI },
  math_tau: { type: 'number', value: 2 * Math.PI }
} as const

for (const name of constants.constants as string[]) {
  const valueObj = constantMap[name as keyof typeof constantMap]
  if (!valueObj) {
    throw new Error(`Constant '${name}' is not implemented`)
  }
  builtInConstants.set(name, valueObj)
}
// Load only the functions we have implemented
export const builtIns = new Map<string, Value>()
for (const name of constants.builtInFuncs as string[]) {
  const impl = (BuiltInFunctions as any)[name]
  if (typeof impl !== 'function') {
    // some functions are not yet implemented
    console.warn(`BuiltInFunctions.${name} is not implemented`)
    continue
  }
  const builtinName = name.startsWith('_') ? name.substring(1) : name
  builtIns.set(name, { type: 'builtin', name: builtinName, func: impl })
}
// export const builtIns = new Map<string, Value>()
// builtIns.set('print', { type: 'builtin', name: 'print', func: BuiltInFunctions.print })
// builtIns.set('_int', { type: 'builtin', name: 'int', func: BuiltInFunctions._int })
// builtIns.set('abs', { type: 'builtin', name: 'abs', func: BuiltInFunctions.abs })
// builtIns.set('_str', { type: 'builtin', name: 'str', func: BuiltInFunctions._str })

