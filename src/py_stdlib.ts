import { PyContext } from './cse-machine/py_context'
import { PyClosure } from './cse-machine/py_closure'
import { Value } from './cse-machine/stash'
import { pyHandleRuntimeError } from './cse-machine/py_utils'
import { UnsupportedOperandTypeError } from './errors/py_errors'

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
  static print(context: PyContext, ...args: Value[]): Value {
    const output = args.map(arg => toPythonString(arg)).join(' ')
    context.output += output + '\n'
    return { type: 'undefined' }
  }

  static _int(context: PyContext, ...args: Value[]): Value {
    if (args.length === 0) {
      return { type: 'bigint', value: BigInt(0) }
    }

    const arg = args[0]
    if (arg.type === 'number') {
      const truncated = Math.trunc(arg.value)
      return { type: 'bigint', value: BigInt(truncated) }
    }
    if (arg.type === 'bigint') {
      return { type: 'bigint', value: arg.value }
    }

    // TODO: Use proper TypeError class once node is passed to built-ins
    return {
      type: 'error',
      message: `TypeError: int() argument must be a string, a bytes-like object or a real number, not '${arg.type}'`
    }
  }
}

// Load only the functions we have implemented
export const builtIns = new Map<string, Value>()
builtIns.set('print', { type: 'builtin', name: 'print', func: BuiltInFunctions.print })
builtIns.set('_int', { type: 'builtin', name: 'int', func: BuiltInFunctions._int })
