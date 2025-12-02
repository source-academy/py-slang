import * as es from 'estree'
import { Context } from '../cse-machine/context'

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

// Base error and shared helpers
export const UNKNOWN_LOCATION: es.SourceLocation = {
  start: {
    line: -1,
    column: -1
  },
  end: {
    line: -1,
    column: -1
  }
}

export class RuntimeSourceError implements SourceError {
  public type = ErrorType.RUNTIME
  public severity = ErrorSeverity.ERROR
  public location: es.SourceLocation
  public message = 'Error'

  constructor(node?: es.Node) {
    this.location = node?.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return ''
  }

  public elaborate() {
    return this.explain()
  }
}

// Local copy to avoid circular import from utils
function typeTranslator(type: string): string {
  switch (type) {
    case 'bigint':
      return 'int'
    case 'number':
      return 'float'
    case 'boolean':
      return 'bool'
    case 'bool':
      return 'bool'
    case 'string':
      return 'string'
    case 'complex':
      return 'complex'
    default:
      return 'unknown'
  }
}

/* Searches backwards and forwards till it hits a newline */
function getFullLine(source: string, current: number): { line: number; fullLine: string } {
  let back: number = current
  let forward: number = current

  while (back > 0 && source[back] != '\n') {
    back--
  }
  if (source[back] === '\n') {
    back++
  }
  while (forward < source.length && source[forward] != '\n') {
    forward++
  }

  const line = source.slice(0, back).split('\n').length
  const fullLine = source.slice(back, forward)

  return { line, fullLine }
}

export function createErrorIndicator(snippet: string, errorOp: string = '/'): string {
  const pos = snippet.indexOf(errorOp)
  let indicator = ''
  for (let i = 0; i < snippet.length; i++) {
    indicator += i === pos ? '^' : '~'
  }
  return indicator
}

export class TypeConcatenateError extends RuntimeSourceError {
  constructor(source: string, node: es.Node, wrongType: string) {
    super(node)
    this.type = ErrorType.TYPE

    let index = (node as any).symbol?.loc?.start?.index
    const { line, fullLine } = getFullLine(source, index)
    const snippet = (node as any).symbol?.loc?.source ?? '<unknown source>'

    let hint = 'TypeError: can only concatenate str (not "' + wrongType + '") to str.'
    const offset = fullLine.indexOf(snippet)
    const indicator = createErrorIndicator(snippet, '+')
    const name = 'TypeError'
    const suggestion =
      'You are trying to concatenate a string with an ' +
      wrongType +
      '. To fix this, convert the ' +
      wrongType +
      ' to a string using str(), or ensure both operands are of the same type.'
    const msg =
      name +
      ' at line ' +
      line +
      '\n\n    ' +
      fullLine +
      '\n    ' +
      ' '.repeat(offset) +
      indicator +
      '\n' +
      hint +
      '\n' +
      suggestion
    this.message = msg
  }
}

export class UnsupportedOperandTypeError extends RuntimeSourceError {
  constructor(
    source: string,
    node: es.Node,
    wrongType1: string,
    wrongType2: string,
    operand: string
  ) {
    super(node)
    this.type = ErrorType.TYPE

    let index = (node as any).symbol?.loc?.start?.index ?? (node as any).srcNode?.loc?.start?.index
    const { line, fullLine } = getFullLine(source, index)
    const snippet =
      (node as any).symbol?.loc?.source ?? (node as any).srcNode?.loc?.source ?? '<unknown source>'
    let hint =
      'TypeError: unsupported operand type(s) for ' +
      operand +
      ": '" +
      wrongType1 +
      "' and '" +
      wrongType2 +
      "'"
    const offset = fullLine.indexOf(snippet)
    const indicator = createErrorIndicator(snippet, operand)
    const name = 'TypeError'
    const suggestion =
      "You are using the '" +
      operand +
      "' operator between a '" +
      wrongType1 +
      "' and a '" +
      wrongType2 +
      "', which are not compatible types for this operation.\nMake sure both operands are of the correct type."
    const msg =
      name +
      ' at line ' +
      line +
      '\n\n    ' +
      fullLine +
      '\n    ' +
      ' '.repeat(offset) +
      indicator +
      '\n' +
      hint +
      '\n' +
      suggestion
    this.message = msg
  }
}

export class MissingRequiredPositionalError extends RuntimeSourceError {
  private functionName: string
  private missingParamCnt: number
  private missingParamName: string

  constructor(
    source: string,
    node: es.Node,
    functionName: string,
    params: any,
    args: any,
    variadic: boolean
  ) {
    super(node)
    this.type = ErrorType.TYPE
    this.functionName = functionName
    let adverb: string = 'exactly'
    if (variadic) {
      adverb = 'at least'
    }
    const index = (node as any).loc?.start?.index ?? (node as any).srcNode?.loc?.start?.index ?? 0
    const { line, fullLine } = getFullLine(source, index)
    this.message = 'TypeError at line ' + line + '\n\n    ' + fullLine + '\n'

    if (typeof params === 'number') {
      this.missingParamCnt = params
      this.missingParamName = ''
      const givenParamCnt = args.length
      if (this.missingParamCnt === 1 || this.missingParamCnt === 0) {
      }
      const msg = `TypeError: ${this.functionName}() takes ${adverb} ${this.missingParamCnt} argument (${givenParamCnt} given)
Check the function definition of '${this.functionName}' and make sure to provide all required positional arguments in the correct order.`
      this.message += msg
    } else {
      this.missingParamCnt = params.length - args.length
      const missingNames: string[] = []
      for (let i = args.length; i < params.length; i++) {
        const param = params[i].name
        missingNames.push("\'" + param + "\'")
      }
      this.missingParamName = this.joinWithCommasAndAnd(missingNames)
      const msg = `TypeError: ${this.functionName}() missing ${this.missingParamCnt} required positional argument(s): ${this.missingParamName}
You called ${this.functionName}() without providing the required positional argument ${this.missingParamName}. Make sure to pass all required arguments when calling ${this.functionName}.`
      this.message += msg
    }
  }

  private joinWithCommasAndAnd(names: string[]): string {
    if (names.length === 0) {
      return ''
    } else if (names.length === 1) {
      return names[0]
    } else if (names.length === 2) {
      return `${names[0]} and ${names[1]}`
    } else {
      const last = names.pop()
      return `${names.join(', ')} and ${last}`
    }
  }
}

export class TooManyPositionalArgumentsError extends RuntimeSourceError {
  private functionName: string
  private expectedCount: number
  private givenCount: number

  constructor(
    source: string,
    node: es.Node,
    functionName: string,
    params: any,
    args: any,
    variadic: boolean
  ) {
    super(node)
    this.type = ErrorType.TYPE
    this.functionName = functionName
    let adverb: string = 'exactly'
    if (variadic) {
      adverb = 'at most'
    }

    const index = (node as any).loc?.start?.index ?? (node as any).srcNode?.loc?.start?.index ?? 0
    const { line, fullLine } = getFullLine(source, index)
    this.message = 'TypeError at line ' + line + '\n\n    ' + fullLine + '\n'

    if (typeof params === 'number') {
      this.expectedCount = params
      this.givenCount = args.length
      if (this.expectedCount === 1 || this.expectedCount === 0) {
        this.message += `TypeError: ${this.functionName}() takes ${adverb} ${this.expectedCount} argument (${this.givenCount} given)`
      } else {
        this.message += `TypeError: ${this.functionName}() takes ${adverb} ${this.expectedCount} arguments (${this.givenCount} given)`
      }
    } else {
      this.expectedCount = params.length
      this.givenCount = args.length
      if (this.expectedCount === 1 || this.expectedCount === 0) {
        this.message += `TypeError: ${this.functionName}() takes ${this.expectedCount} positional argument but ${this.givenCount} were given`
      } else {
        this.message += `TypeError: ${this.functionName}() takes ${this.expectedCount} positional arguments but ${this.givenCount} were given`
      }
    }

    this.message += `\nRemove the extra argument(s) when calling '${this.functionName}', or check if the function definition accepts more arguments.`
  }
}

export class ZeroDivisionError extends RuntimeSourceError {
  constructor(source: string, node: es.Node, context: Context) {
    super(node)
    this.type = ErrorType.TYPE
    let index = (node as any).symbol?.loc?.start?.index
    const { line, fullLine } = getFullLine(source, index)
    const snippet = (node as any).symbol?.loc?.source ?? '<unknown source>'

    let hint = 'ZeroDivisionError: division by zero.'
    const offset = fullLine.indexOf(snippet)
    const indicator = createErrorIndicator(snippet, '/')
    const name = 'ZeroDivisionError'
    const suggestion =
      'You attempted to divide by zero. Division or modulo operations cannot be performed with a divisor of zero. Please ensure that the divisor is non-zero before performing the operation.'
    const msg =
      name +
      ' at line ' +
      line +
      '\n\n    ' +
      fullLine +
      '\n    ' +
      ' '.repeat(offset) +
      indicator +
      '\n' +
      hint +
      '\n' +
      suggestion
    this.message = msg
  }
}

export class StepLimitExceededError extends RuntimeSourceError {
  constructor(source: string, node: es.Node, context: Context) {
    super(node)
    this.type = ErrorType.RUNTIME

    const index = (node as any).loc?.start?.index ?? (node as any).srcNode?.loc?.start?.index ?? 0

    const { line, fullLine } = getFullLine(source, index)

    const snippet =
      (node as any).loc?.source ?? (node as any).srcNode?.loc?.source ?? '<unknown source>'

    const indicator = createErrorIndicator(fullLine, '@') // no target symbol

    const name = 'StepLimitExceededError'
    const hint = 'The evaluation has exceeded the maximum step limit.'

    const offset = fullLine.indexOf(fullLine)
    const adjustedOffset = offset >= 0 ? offset : 0

    const msg = [
      `${name} at line ${line}`,
      '',
      '    ' + fullLine,
      '    ' + ' '.repeat(adjustedOffset) + indicator,
      hint
    ].join('\n')

    this.message = msg
  }
}

export class ValueError extends RuntimeSourceError {
  constructor(source: string, node: es.Node, context: Context, functionName: string) {
    super(node)
    this.type = ErrorType.TYPE
    const index = (node as any).loc?.start?.index ?? (node as any).srcNode?.loc?.start?.index ?? 0
    const { line, fullLine } = getFullLine(source, index)
    const snippet =
      (node as any).loc?.source ?? (node as any).srcNode?.loc?.source ?? '<unknown source>'
    let hint = 'ValueError: math domain error. '
    const offset = fullLine.indexOf(snippet)
    const indicator = createErrorIndicator(snippet, '@')
    const name = 'ValueError'
    const suggestion = `Ensure that the input value(s) passed to '${functionName}' satisfy the mathematical requirements`
    const msg =
      name +
      ' at line ' +
      line +
      '\n\n    ' +
      fullLine +
      '\n    ' +
      ' '.repeat(offset) +
      indicator +
      '\n' +
      hint +
      suggestion
    this.message = msg
  }
}

export class TypeError extends RuntimeSourceError {
  constructor(
    source: string,
    node: es.Node,
    context: Context,
    originalType: string,
    targetType: string
  ) {
    super(node)
    originalType = typeTranslator(originalType)
    this.type = ErrorType.TYPE
    const index = (node as any).loc?.start?.index ?? (node as any).srcNode?.loc?.start?.index ?? 0
    const { line, fullLine } = getFullLine(source, index)
    const snippet =
      (node as any).loc?.source ?? (node as any).srcNode?.loc?.source ?? '<unknown source>'
    let hint = "TypeError: '" + originalType + "' cannot be interpreted as an '" + targetType + "'."
    const offset = fullLine.indexOf(snippet)
    const adjustedOffset = offset >= 0 ? offset : 0
    const indicator = createErrorIndicator(snippet, '@')
    const name = 'TypeError'
    const suggestion = ' Make sure the value you are passing is compatible with the expected type.'
    const msg =
      name +
      ' at line ' +
      line +
      '\n\n    ' +
      fullLine +
      '\n    ' +
      ' '.repeat(adjustedOffset) +
      indicator +
      '\n' +
      hint +
      suggestion
    this.message = msg
  }
}

export class SublanguageError extends RuntimeSourceError {
  constructor(
    source: string,
    node: es.Node,
    context: Context,
    functionName: string,
    chapter: string,
    details?: string
  ) {
    super(node)

    this.type = ErrorType.TYPE

    const index = (node as any).loc?.start?.index ?? (node as any).srcNode?.loc?.start?.index ?? 0
    const { line, fullLine } = getFullLine(source, index)
    const snippet =
      (node as any).loc?.source ?? (node as any).srcNode?.loc?.source ?? '<unknown source>'
    const offset = fullLine.indexOf(snippet)
    const indicator = createErrorIndicator(snippet, '@')

    const name = 'SublanguageError'
    const hint = 'Feature not supported in Python §' + chapter + '. '
    const suggestion = `The call to '${functionName}()' relies on behaviour that is valid in full Python but outside the Python §1 sublanguage${details ? ': ' + details : ''}.`

    this.message = `${name} at line ${line}\n\n ${fullLine}\n ${' '.repeat(offset)}${indicator}\n${hint}${suggestion}`
  }
}
