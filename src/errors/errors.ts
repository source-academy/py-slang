import { Token } from '../tokenizer'
import { Context } from '../cse-machine/context'
import { ExprNS } from '../ast-types'
import { operatorTranslator } from '../cse-machine/types'
import { TokenType } from '../tokens'
import { Value } from '../cse-machine/stash'

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

export interface Locatable {
  startToken: Token
  endToken: Token
}

/**
 * Represents a specific position in source code
 * Line is 1-based, Column is 0-based
 */
export interface SourcePosition {
  line: number
  column: number
}

/**
 * Represents the span of code within source code from start to end
 * Can be null if source code is not available
 */
export interface SourceLocation {
  source?: string | null
  start: SourcePosition
  end: SourcePosition
}

// any and all errors ultimately implement this interface. as such, changes to this will affect every type of error.
export interface SourceError {
  type: ErrorType
  severity: ErrorSeverity
  location: SourceLocation
  explain(): string
  elaborate(): string
}

// Base error and shared helpers
export const UNKNOWN_LOCATION: SourceLocation = {
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
  public location: SourceLocation
  public message = 'Error'

  constructor(node?: Locatable) {
    if (node) {
      this.location = {
        start: {
          line: node.startToken.line,
          column: node.startToken.col
        },
        end: {
          line: node.startToken.line,
          column: node.startToken.col
        }
      }
    } else {
      this.location = UNKNOWN_LOCATION
    }
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
export function getFullLine(source: string, current: number): { lineIndex: number; fullLine: string } {
  let back: number = current;
  let forward: number = current;

  while (back > 0 && source[back] != '\n') {
      back--;
  }
  if (source[back] === '\n') {
      back++;
  }
  while (forward < source.length && source[forward] != '\n') {
      forward++;
  }

  const lineIndex = source.slice(0, back).split('\n').length;
  const fullLine = source.slice(back, forward);

  return {lineIndex, fullLine};
}

export function createErrorIndicator(snippet: string, errorPos: number): string {
  let indicator = "";
  for (let i = 0; i < snippet.length; i++) {
    indicator += (i === errorPos ? "^" : "~");
  }
  return indicator;
}

export class TypeConcatenateError extends RuntimeSourceError {
    constructor(source: string, node: ExprNS.Expr, wrongType: string) {
        super(node);
        this.type = ErrorType.TYPE;

        let index = node.startToken.indexInSource;
        const { lineIndex, fullLine } = getFullLine(source, index);
        const snippet = source.substring(node.startToken.indexInSource, node.endToken.indexInSource + node.endToken.lexeme.length)
        
        let hint = 'TypeError: can only concatenate str (not "' + wrongType + '") to str.';
        const offset = fullLine.indexOf(snippet);
        const adjustedOffset = offset >= 0 ? offset : 0
        const errorPos = (node as any).operator.indexInSource - node.startToken.indexInSource
        const indicator = createErrorIndicator(snippet, errorPos);
        
        const name = "TypeError";
        const suggestion = "You are trying to concatenate a string with an " + wrongType + ". To fix this, convert the " + wrongType + " to a string using str(), or ensure both operands are of the same type.";
        const msg = name + " at line " + lineIndex + "\n\n    " + fullLine + "\n    " + " ".repeat(adjustedOffset) + indicator + "\n" + hint + "\n" + suggestion;
        this.message = msg;
    }
}

export class IndexError extends RuntimeSourceError {
    constructor(source: string, node: ExprNS.Expr, context: Context, index: number, length: number) {
        super(node);
        this.type = ErrorType.RUNTIME;
        this.message = "IndexError: list index out of range. You tried to access index " + index + " but the list only has " + length + " elements.";
    }
}

export class UnsupportedOperandTypeError extends RuntimeSourceError {
    constructor(source: string, node: ExprNS.Expr, wrongType1: Value["type"], wrongType2: Value["type"] | null, operand: TokenType | string) {
        super(node);
        this.type = ErrorType.TYPE;

        let index = node.startToken.indexInSource;
        const operatorStr = operatorTranslator(operand)
        const typeStr1 = typeTranslator(wrongType1)
        const { lineIndex, fullLine } = getFullLine(source, index);
        const snippet = source.substring(node.startToken.indexInSource, node.endToken.indexInSource + node.endToken.lexeme.length)
        let hint = "TypeError: unsupported operand type(s) for " + operand + ": '" + wrongType1 + "' and '" + wrongType2 + "'";
        const offset = fullLine.indexOf(snippet);
        const adjustedOffset = offset >= 0 ? offset : 0
        const errorPos = (node as any).operator.indexInSource - node.startToken.indexInSource
        const indicator = createErrorIndicator(snippet, errorPos);
        let suggestion: string
        if (wrongType2 === null) {
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
        this.message = `TypeError at line ${lineIndex}\n\n    ${fullLine}\n    ${' '.repeat(adjustedOffset)}${indicator}\n${hint}\n${suggestion}`
    }
}

export class MissingRequiredPositionalError extends RuntimeSourceError {
    private functionName: string;
    private missingParamCnt: number;
    private missingParamName: string;
  
    constructor(source: string, node: ExprNS.Expr, functionName: string, params: any, args: any, variadic: boolean) {
        super(node);
        this.type = ErrorType.TYPE;
        this.functionName = functionName;
        let adverb: string = "exactly";
        if (variadic) {
          adverb = "at least";
        }
        const index = (node as any).loc?.start?.index
                  ?? (node as any).srcNode?.loc?.start?.index
                  ?? 0;
        const { lineIndex, fullLine } = getFullLine(source, index);
        this.message = 'TypeError at line ' + lineIndex + '\n\n    ' + fullLine + '\n';

        if (typeof params === 'number') {
          this.missingParamCnt = params;
          this.missingParamName = '';
          const givenParamCnt = args.length;
          if (this.missingParamCnt === 1 || this.missingParamCnt === 0) {}
          const msg = `TypeError: ${this.functionName}() takes ${adverb} ${this.missingParamCnt} argument (${givenParamCnt} given)
Check the function definition of '${this.functionName}' and make sure to provide all required positional arguments in the correct order.`;
          this.message += msg;
        } else {
          this.missingParamCnt = params.length - args.length;
          const missingNames: string[] = [];
          for (let i = args.length; i < params.length; i++) {
            const param = params[i].name;
            missingNames.push("\'"+param+"\'");
          }
          this.missingParamName = this.joinWithCommasAndAnd(missingNames);
          const msg = `TypeError: ${this.functionName}() missing ${this.missingParamCnt} required positional argument(s): ${this.missingParamName}
You called ${this.functionName}() without providing the required positional argument ${this.missingParamName}. Make sure to pass all required arguments when calling ${this.functionName}.`;
          this.message += msg;
        }
    }

    private joinWithCommasAndAnd(names: string[]): string {
        if (names.length === 0) {
          return '';
        } else if (names.length === 1) {
          return names[0];
        } else if (names.length === 2) {
          return `${names[0]} and ${names[1]}`;
        } else {
          const last = names.pop();
          return `${names.join(', ')} and ${last}`;
        }
    }
}

export class TooManyPositionalArgumentsError extends RuntimeSourceError {
    private functionName: string;
    private expectedCount: number;
    private givenCount: number;
  
    constructor(source: string, node: ExprNS.Expr, functionName: string, params: any, args: any, variadic: boolean) {
      super(node);
      this.type = ErrorType.TYPE;
      this.functionName = functionName;
      let adverb: string = "exactly";
      if (variadic) {
        adverb = "at most";
      }

      const index = (node as any).loc?.start?.index
                  ?? (node as any).srcNode?.loc?.start?.index
                  ?? 0;
      const { lineIndex, fullLine } = getFullLine(source, index);
      this.message = 'TypeError at line ' + lineIndex + '\n\n    ' + fullLine + '\n';

      if (typeof params === 'number') {
        this.expectedCount = params;
        this.givenCount = args.length;
        if (this.expectedCount === 1 || this.expectedCount === 0) {
          this.message += `TypeError: ${this.functionName}() takes ${adverb} ${this.expectedCount} argument (${this.givenCount} given)`;
        } else {
          this.message += `TypeError: ${this.functionName}() takes ${adverb} ${this.expectedCount} arguments (${this.givenCount} given)`;
        }
      } else {
        this.expectedCount = params.length;
        this.givenCount = args.length;
        if (this.expectedCount === 1 || this.expectedCount === 0) {
          this.message += `TypeError: ${this.functionName}() takes ${this.expectedCount} positional argument but ${this.givenCount} were given`;
        } else {
          this.message += `TypeError: ${this.functionName}() takes ${this.expectedCount} positional arguments but ${this.givenCount} were given`;
        }
      }

      this.message += `\nRemove the extra argument(s) when calling '${this.functionName}', or check if the function definition accepts more arguments.`;
    }
}

export class ZeroDivisionError extends RuntimeSourceError {
  constructor(source: string, node: ExprNS.Expr, context: Context) {
    super(node);
    this.type = ErrorType.TYPE;
    let index = node.startToken.indexInSource;
    const { lineIndex, fullLine } = getFullLine(source, index);
    const snippet = source.substring(node.startToken.indexInSource, node.endToken.indexInSource + node.endToken.lexeme.length);
    
    let hint = 'ZeroDivisionError: division by zero.';
    const offset = fullLine.indexOf(snippet);
    const adjustedOffset = offset >= 0 ? offset : 0
    const errorPos = (node as any).operator.indexInSource - node.startToken.indexInSource
    const indicator = createErrorIndicator(snippet, errorPos);
    const name = "ZeroDivisionError";
    const operator = (node as any).operator.lexeme
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
    const suggestion = "You attempted to divide by zero. Division or modulo operations cannot be performed with a divisor of zero. Please ensure that the divisor is non-zero before performing the operation.";
    const msg = name + " at line " + lineIndex + "\n\n    " + fullLine + "\n    " + " ".repeat(adjustedOffset) + indicator + "\n" + hint + "\n" + suggestion;
    this.message = msg;
  }
}

export class StepLimitExceededError extends RuntimeSourceError {
  constructor(source: string, node: ExprNS.Expr, context: Context) {
    super(node);
    this.type = ErrorType.RUNTIME;

    const index = (node as any).loc?.start?.index
                  ?? (node as any).srcNode?.loc?.start?.index
                  ?? 0;

    const { lineIndex, fullLine } = getFullLine(source, index);

    const snippet = source.substring(node.startToken.indexInSource, node.endToken.indexInSource + node.endToken.lexeme.length);
    const errorPos = (node as any).operator.indexInSource - node.startToken.indexInSource

    const indicator = createErrorIndicator(fullLine, errorPos);  // no target symbol

    const name = 'StepLimitExceededError';
    const hint = 'The evaluation has exceeded the maximum step limit.';

    const offset = fullLine.indexOf(fullLine);
    const adjustedOffset = offset >= 0 ? offset : 0;

    const msg = [
      `${name} at line ${lineIndex}`,
      '',
      '    ' + fullLine,
      '    ' + ' '.repeat(adjustedOffset) + indicator,
      hint
    ].join('\n');

    this.message = msg;
  }
}

export class ValueError extends RuntimeSourceError {
  constructor(source: string, node: ExprNS.Expr, context: Context, functionName: string) {
    super(node);
    this.type = ErrorType.TYPE;
    const index = node.startToken.indexInSource;
    const { lineIndex, fullLine } = getFullLine(source, index);
    const snippet = source.substring(node.startToken.indexInSource, node.endToken.indexInSource + node.endToken.lexeme.length);
    let hint = 'ValueError: math domain error. ';
    const offset = fullLine.indexOf(snippet);
    const errorPos = 0;
    const indicator = createErrorIndicator(snippet, errorPos);
    const name = "ValueError";
    const suggestion = `Ensure that the input value(s) passed to '${functionName}' satisfy the mathematical requirements`;
    const msg = name + " at line " + lineIndex + "\n\n    " + fullLine + "\n    " + " ".repeat(offset) + indicator + "\n" + hint + suggestion;
    this.message = msg;
  }
}

export class TypeError extends RuntimeSourceError {
  constructor(source: string, node: ExprNS.Expr, context: Context, originalType: string, targetType: string) {
    super(node);
    originalType = typeTranslator(originalType);
    this.type = ErrorType.TYPE;
    const index = node.startToken.indexInSource;
    const { lineIndex, fullLine } = getFullLine(source, index);
    const snippet = source.substring(
      node.startToken.indexInSource,
      node.endToken.indexInSource + node.endToken.lexeme.length
    )
    let hint = "TypeError: '" + originalType + "' cannot be interpreted as an '" + targetType + "'.";
    const offset = fullLine.indexOf(snippet);
    const adjustedOffset = offset >= 0 ? offset : 0
    const errorPos = 0;
    const indicator = createErrorIndicator(snippet, errorPos);
    const name = "TypeError";
    const suggestion = ' Make sure the value you are passing is compatible with the expected type.';
    const msg = name + " at line " + lineIndex + "\n\n    " + fullLine + "\n    " + " ".repeat(adjustedOffset) + indicator + "\n" + hint + suggestion;
    this.message = msg;
  }
}

export class SublanguageError extends RuntimeSourceError {
  constructor (
  source: string,
  node: ExprNS.Expr,
  context: Context,
  functionName: string,
  chapter: string,
  details?: string
) {
    super(node)
    
    this.type = ErrorType.TYPE
    
    const index = node.startToken.indexInSource;
    const { lineIndex, fullLine } = getFullLine(source, index)
    const snippet = source.substring(
      node.startToken.indexInSource,
      node.endToken.indexInSource + node.endToken.lexeme.length
    )
    const offset = fullLine.indexOf(snippet)
    const errorPos = 0
    const indicator = createErrorIndicator(snippet, errorPos)
    
    const name = 'SublanguageError'
    const hint = 'Feature not supported in Python §' + chapter + '. '
    const suggestion = `The call to '${functionName}()' relies on behaviour that is valid in full Python but outside the Python §1 sublanguage${details ? ': ' + details : ''}.`
    
    this.message = `${name} at line ${lineIndex}\n\n ${fullLine}\n ${' '.repeat(offset)}${indicator}\n${hint}${suggestion}`
  }
}

export class UnboundLocalError extends RuntimeSourceError {
  constructor(source: string, name: string, node: ExprNS.Expr) {
    super(node)
    this.type = ErrorType.TYPE
    const { lineIndex, fullLine } = getFullLine(source, node.startToken.indexInSource)
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
    const msg = `UnboundLocalError at line ${lineIndex}\n\n    ${fullLine}\n    ${' '.repeat(adjustedOffset)}${indicator}\n${hint}\n${suggestion}`
    this.message = msg
  }
}

export class NameError extends RuntimeSourceError {
  constructor(source: string, name: string, node: ExprNS.Variable) {
    super(node)
    this.type = ErrorType.TYPE

    const { lineIndex, fullLine } = getFullLine(source, node.startToken.indexInSource)
    const snippet = source.substring(node.startToken.indexInSource, node.endToken.indexInSource + node.endToken.lexeme.length)
    const offset = fullLine.indexOf(snippet)
    const adjustedOffset = offset >= 0 ? offset : 0
    const errorPos = 0
    const indicator = createErrorIndicator(snippet, errorPos)
    const hint = `NameError: name '${name}' is not defined`
    const suggestion = `The name '${name}' is not defined in the current scope. Check for typos or make sure the variable is assigned a value before being used.`
    const msg = `NameError at line ${lineIndex}\n\n    ${fullLine}\n    ${' '.repeat(adjustedOffset)}${indicator}\n${hint}\n${suggestion}`
    this.message = msg
  }
}

export class BuiltinReassignmentError extends RuntimeSourceError {
  constructor(source: string, name: string, node: ExprNS.Expr) {
    super(node)
    this.type = ErrorType.TYPE
    const { lineIndex, fullLine } = getFullLine(source, node.startToken.indexInSource)
    const snippet = source.substring(
      node.startToken.indexInSource,
      node.endToken.indexInSource + node.endToken.lexeme.length
    )
    const offset = fullLine.indexOf(snippet)
    const adjustedOffset = offset >= 0 ? offset : 0
    const errorPos = 0
    const indicator = createErrorIndicator(snippet, errorPos)

    const hint = `TypeError: cannot reassign built-in function '${name}'`
    const suggestion = `You are trying to assign a value to '${name}', which is a built-in function. This is not allowed.`
    const msg = `TypeError at line ${lineIndex}\n\n    ${fullLine}\n    ${' '.repeat(adjustedOffset)}${indicator}\n${hint}\n${suggestion}`
    this.message = msg
  }
}

/*
    The offset is calculated as follows:    
    Current position is one after real position of end of token: 1
*/
export const MAGIC_OFFSET = 1;

export const SPECIAL_CHARS = new RegExp("[\\\\$'\"]", "g");

function escape(unsafe: string): string {
    // @TODO escape newlines
    return unsafe.replace(SPECIAL_CHARS, "\\$&");
}
