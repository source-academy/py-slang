import { ExprNS } from '../ast-types'
import { ErrorType, SourceError, SourceLocation } from './base'
import { RuntimeSourceError } from './py_runtimeSourceError'
import { PyContext } from '../cse-machine/py_context'
import { typeTranslator, operatorTranslator } from '../cse-machine/py_types'

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

export function createErrorIndicator(snippet: string, errorPos: number): string {
  let indicator = ''
  for (let i = 0; i < snippet.length; i++) {
    indicator += i === errorPos ? '^' : '~'
  }
  return indicator
}

// export class TypeConcatenateError extends PyRuntimeSourceError {
//     constructor(source: string, node: ExprNS.Expr, wrongType: string) {
//         super(node);
//         this.type = ErrorType.TYPE;

//         let index = (node as any).symbol?.loc?.start?.index;
//         const { line, fullLine } = getFullLine(source, index);
//         const snippet = (node as any).symbol?.loc?.source ?? '<unknown source>';

//         let hint = 'TypeError: can only concatenate str (not "' + wrongType + '") to str.';
//         const offset = fullLine.indexOf(snippet);
//         const indicator = createErrorIndicator(snippet, '+');
//         const name = "TypeError";
//         const suggestion = "You are trying to concatenate a string with an " + wrongType + ". To fix this, convert the " + wrongType + " to a string using str(), or ensure both operands are of the same type.";
//         const msg = name + " at line " + line + "\n\n    " + fullLine + "\n    " + " ".repeat(offset) + indicator + "\n" + hint + "\n" + suggestion;
//         this.message = msg;
//     }
// }

export class UnsupportedOperandTypeError extends RuntimeSourceError {
  constructor(
    source: string,
    node: ExprNS.Expr,
    wrongType1: string,
    wrongType2: string,
    operand: string
  ) {
    super(node)
    this.type = ErrorType.TYPE

    const operatorStr = operatorTranslator(operand)
    const typeStr1 = typeTranslator(wrongType1)

    const { line, fullLine } = getFullLine(source, node.startToken.indexInSource)

    const snippet = source.substring(
      node.startToken.indexInSource,
      node.endToken.indexInSource + node.endToken.lexeme.length
    )

    const offset = fullLine.indexOf(snippet)
    const adjustedOffset = offset >= 0 ? offset : 0

    const errorPos = (node as any).operator.indexInSource - node.startToken.indexInSource
    const indicator = createErrorIndicator(snippet, errorPos)

    let hint: string
    let suggestion: string

    if (wrongType2 === '') {
      // Format for Unary operators
      hint = `TypeError: bad operand type for unary ${operatorStr}: '${typeStr1}'`
      suggestion = `You are using the unary '${operatorStr}' operator on '${typeStr1}', which is not a supported type for this operation.\nMake sure the operator is of the correct type.\n`
    } else {
      // Format for Binary operators
      const typeStr2 = typeTranslator(wrongType2)
      hint = `TypeError: unsupported operand type(s) for ${operatorStr}: '${typeStr1}' and '${typeStr2}'`
      suggestion = `You are using the '${operatorStr}' operator between '${typeStr1}' and '${typeStr2}', which are not compatible types for this operation.\nMake sure both operands are of the correct type.\n`
    }

    // Assemble the final multi-line message
    this.message = `TypeError at line ${line}\n\n    ${fullLine}\n    ${' '.repeat(adjustedOffset)}${indicator}\n${hint}\n${suggestion}`
  }
}

export class MissingRequiredPositionalError extends RuntimeSourceError {
  private functionName: string
  private missingParamCnt: number
  private missingParamName: string

  constructor(
    source: string,
    node: ExprNS.Expr,
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
    node: ExprNS.Expr,
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
  constructor(source: string, node: ExprNS.Expr, context: PyContext) {
    super(node)
    this.type = ErrorType.TYPE

    const { line, fullLine } = getFullLine(source, node.startToken.indexInSource)

    const snippet = source.substring(
      node.startToken.indexInSource,
      node.endToken.indexInSource + node.endToken.lexeme.length
    )
    const offset = fullLine.indexOf(snippet)
    const adjustedOffset = offset >= 0 ? offset : 0

    const errorPos = (node as any).operator.indexInSource - node.startToken.indexInSource
    const indicator = createErrorIndicator(snippet, errorPos)
    const name = 'ZeroDivisionError'
    const operator = (node as any).operator.lexeme
    let hint: string

    switch (operator) {
      case '/':
        hint = 'ZeroDivisionError: division by zero.'
        break
      case '//':
        hint = 'ZeroDivisionError: integer division or modulo by zero.'
        break
      case '%':
        hint = 'ZeroDivisionError: integer modulo by zero.'
        break
      case '**':
        hint = 'ZeroDivisionError: 0.0 cannot be raised to a negative power.'
        break
      default:
        hint = 'ZeroDivisionError: division by zero.'
    }
    const suggestion =
      'You attempted to divide by zero. Division or modulo operations cannot be performed with a divisor of zero. Please ensure that the divisor is non-zero before performing the operation.'
    const msg = `${name} at line ${line}\n\n     ${fullLine}\n     ${' '.repeat(adjustedOffset)}${indicator}\n${hint}\n${suggestion}`
    this.message = msg
  }
}

export class UnboundLocalError extends RuntimeSourceError {
  constructor(source: string, name: string, node: ExprNS.Expr) {
    super(node)
    this.type = ErrorType.TYPE

    const { line, fullLine } = getFullLine(source, node.startToken.indexInSource)
    const snippet = source.substring(
      node.startToken.indexInSource,
      node.endToken.indexInSource + node.endToken.lexeme.length
    )
    const offset = fullLine.indexOf(snippet)
    const adjustedOffset = offset >= 0 ? offset : 0

    const errorPos = 0
    const indicator = createErrorIndicator(snippet, errorPos)

    const hint = `UnboundLocalError: cannot access local variable '${name}' where it is not associated with a value`
    const suggestion = `The variable '${name}' is used in the current function, so it's considered a local variable. However, you tried to access it before a value was assigned to it in the local scope. Assign a value to '${name}' before you use it.`
    const msg = `UnboundLocalError at line ${line}\n\n    ${fullLine}\n    ${' '.repeat(adjustedOffset)}${indicator}\n${hint}\n${suggestion}`
    this.message = msg
  }
}

export class NameError extends RuntimeSourceError {
  constructor(source: string, name: string, node: ExprNS.Variable) {
    super(node)
    this.type = ErrorType.TYPE

    const { line, fullLine } = getFullLine(source, node.startToken.indexInSource)

    const snippet = source.substring(
      node.startToken.indexInSource,
      node.endToken.indexInSource + node.endToken.lexeme.length
    )

    const offset = fullLine.indexOf(snippet)
    const adjustedOffset = offset >= 0 ? offset : 0

    const errorPos = 0
    const indicator = createErrorIndicator(snippet, errorPos)

    const hint = `NameError: name '${name}' is not defined`
    const suggestion = `The name '${name}' is not defined in the current scope. Check for typos or make sure the variable is assigned a value before being used.`

    this.message = `NameError at line ${line}\n\n    ${fullLine}\n    ${' '.repeat(adjustedOffset)}${indicator}\n${hint}\n${suggestion}`
  }
}

// export class StepLimitExceededError extends PyRuntimeSourceError {
//   constructor(source: string, node: ExprNS.Expr, context: PyContext) {
//     super(node);
//     this.type = ErrorType.RUNTIME;

//     const index = (node as any).loc?.start?.index
//                   ?? (node as any).srcNode?.loc?.start?.index
//                   ?? 0;

//     const { line, fullLine } = getFullLine(source, index);

//     const snippet = (node as any).loc?.source
//                   ?? (node as any).srcNode?.loc?.source
//                   ?? '<unknown source>';

//     const indicator = createErrorIndicator(fullLine, '@');  // no target symbol

//     const name = 'StepLimitExceededError';
//     const hint = 'The evaluation has exceeded the maximum step limit.';

//     const offset = fullLine.indexOf(fullLine);
//     const adjustedOffset = offset >= 0 ? offset : 0;

//     const msg = [
//       `${name} at line ${line}`,
//       '',
//       '    ' + fullLine,
//       '    ' + ' '.repeat(adjustedOffset) + indicator,
//       hint
//     ].join('\n');

//     this.message = msg;
//   }
// }

// export class ValueError extends PyRuntimeSourceError {
//   constructor(source: string, node: ExprNS.Expr, context: PyContext, functionName: string) {
//     super(node);
//     this.type = ErrorType.TYPE;
//     const index = (node as any).loc?.start?.index
//                   ?? (node as any).srcNode?.loc?.start?.index
//                   ?? 0;
//     const { line, fullLine } = getFullLine(source, index);
//     const snippet = (node as any).loc?.source
//                   ?? (node as any).srcNode?.loc?.source
//                   ?? '<unknown source>';
//     let hint = 'ValueError: math domain error. ';
//     const offset = fullLine.indexOf(snippet);
//     const indicator = createErrorIndicator(snippet, '@');
//     const name = "ValueError";
//     const suggestion = `Ensure that the input value(s) passed to '${functionName}' satisfy the mathematical requirements`;
//     const msg = name + " at line " + line + "\n\n    " + fullLine + "\n    " + " ".repeat(offset) + indicator + "\n" + hint + suggestion;
//     this.message = msg;
//   }
// }

// export class TypeError extends PyRuntimeSourceError {
//   constructor(source: string, node: ExprNS.Expr, context: PyContext, originalType: string, targetType: string) {
//     super(node);
//     originalType = typeTranslator(originalType);
//     this.type = ErrorType.TYPE;
//     const index = (node as any).loc?.start?.index
//                   ?? (node as any).srcNode?.loc?.start?.index
//                   ?? 0;
//     const { line, fullLine } = getFullLine(source, index);
//     const snippet = (node as any).loc?.source
//                   ?? (node as any).srcNode?.loc?.source
//                   ?? '<unknown source>';
//     let hint = "TypeError: '" + originalType + "' cannot be interpreted as an '" + targetType + "'.";
//     const offset = fullLine.indexOf(snippet);
//     const adjustedOffset = offset >= 0 ? offset : 0;
//     const indicator = createErrorIndicator(snippet, '@');
//     const name = "TypeError";
//     const suggestion = ' Make sure the value you are passing is compatible with the expected type.';
//     const msg = name + " at line " + line + "\n\n    " + fullLine + "\n    " + " ".repeat(adjustedOffset) + indicator + "\n" + hint + suggestion;
//     this.message = msg;
//   }
// }

// export class SublanguageError extends PyRuntimeSourceError {
//   constructor (
//   source: string,
//   node: ExprNS.Expr,
//   context: PyContext,
//   functionName: string,
//   chapter: string,
//   details?: string
// ) {
//     super(node)

//     this.type = ErrorType.TYPE

//     const index = (node as any).loc?.start?.index
//                 ?? (node as any).srcNode?.loc?.start?.index
//                 ?? 0
//     const { line, fullLine } = getFullLine(source, index)
//     const snippet = (node as any).loc?.source
//                   ?? (node as any).srcNode?.loc?.source
//                   ?? '<unknown source>'
//     const offset = fullLine.indexOf(snippet)
//     const indicator = createErrorIndicator(snippet, '@')

//     const name = 'SublanguageError'
//     const hint = 'Feature not supported in Python §' + chapter + '. '
//     const suggestion = `The call to '${functionName}()' relies on behaviour that is valid in full Python but outside the Python §1 sublanguage${details ? ': ' + details : ''}.`

//     this.message = `${name} at line ${line}\n\n ${fullLine}\n ${' '.repeat(offset)}${indicator}\n${hint}${suggestion}`
//   }
// }
