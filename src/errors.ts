import { createErrorIndicator } from './errors/errors'
import { Token } from './tokenizer'
import { Position } from 'estree'

/*
    The offset is calculated as follows:    
    Current position is one after real position of end of token: 1
*/
const MAGIC_OFFSET = 1

const SPECIAL_CHARS = new RegExp('[\\\\$\'"]', 'g')

function escape(unsafe: string): string {
  // @TODO escape newlines
  return unsafe.replace(SPECIAL_CHARS, '\\$&')
}

/* Searches backwards and forwards till it hits a newline */
function getFullLine(source: string, current: number): { lineIndex: number; msg: string } {
  let back: number = current
  let forward: number = current
  if (source[back] == '\n') {
    back--
  }
  while (back > 0 && source[back] != '\n') {
    back--
  }
  if (source[back] === '\n') {
    back++
  }
  while (forward < source.length && source[forward] != '\n') {
    forward++
  }
  const lineIndex = source.slice(0, back).split('\n').length
  const msg = source.slice(back, forward)

  return { lineIndex, msg }
}

function toEstreeLocation(line: number, column: number, offset: number) {
  return { line, column, offset }
}

export namespace TokenizerErrors {
  export class BaseTokenizerError extends SyntaxError {
    line: number
    col: number
    loc: Position

    constructor(message: string, line: number, col: number) {
      super(`SyntaxError at line ${line} column ${col - 1}
                   ${message}`)
      this.line = line
      this.col = col
      this.name = 'BaseTokenizerError'
      this.loc = toEstreeLocation(line, col, 0)
    }
  }

  export class UnknownTokenError extends BaseTokenizerError {
    constructor(token: string, line: number, col: number, source: string, current: number) {
      let { lineIndex, msg } = getFullLine(source, current - 1)
      msg = '\n' + msg + '\n'
      let hint = `${col > 1 ? '~' : ''}^~ Unknown token '${escape(token)}'`
      // The extra `~` character takes up some space.
      hint = hint.padStart(hint.length + col - MAGIC_OFFSET - (col > 1 ? 1 : 0), ' ')
      super(msg + hint, lineIndex, col)
      this.name = 'UnknownTokenError'
    }
  }

  export class UnterminatedStringError extends BaseTokenizerError {
    constructor(line: number, col: number, source: string, start: number, current: number) {
      let { lineIndex, msg } = getFullLine(source, start)
      msg = '\n' + msg + '\n'
      let hint = `^ Unterminated string`
      const diff = current - start
      // +1 because we want the arrow to point after the string (where we expect the closing ")
      hint = hint.padStart(hint.length + diff - MAGIC_OFFSET + 1, '~')
      hint = hint.padStart(hint.length + col - diff, ' ')
      super(msg + hint, lineIndex, col)
      this.name = 'UnterminatedStringError'
    }
  }

  export class NonFourIndentError extends BaseTokenizerError {
    constructor(line: number, col: number, source: string, start: number) {
      let { lineIndex, msg } = getFullLine(source, start)
      msg = '\n' + msg + '\n'
      let hint = `^ This indent should be a multiple of 4 spaces. It's currently ${col} spaces.`
      hint = hint.padStart(hint.length + col - MAGIC_OFFSET, '-')
      super(msg + hint, lineIndex, col)
      this.name = 'NonFourIndentError'
    }
  }

  export class InvalidNumberError extends BaseTokenizerError {
    constructor(line: number, col: number, source: string, start: number, current: number) {
      let { lineIndex, msg } = getFullLine(source, start)
      msg = '\n' + msg + '\n'
      let hint = `^ Invalid Number input.`
      const diff = current - start
      // +1 because we want the arrow to point after the string (where we expect the closing ")
      hint = hint.padStart(hint.length + diff - MAGIC_OFFSET + 1, '~')
      hint = hint.padStart(hint.length + col - diff, ' ')
      super(msg + hint, lineIndex, col)
      this.name = 'InvalidNumberError'
    }
  }

  export class InconsistentIndentError extends BaseTokenizerError {
    constructor(line: number, col: number, source: string, start: number) {
      let { lineIndex, msg } = getFullLine(source, start)
      msg = '\n' + msg + '\n'
      let hint = `^ This indent/dedent is inconsistent with other indents/dedents. It's currently ${col} spaces.`
      hint = hint.padStart(hint.length + col - MAGIC_OFFSET, '-')
      super(msg + hint, lineIndex, col)
      this.name = 'InconsistentIndentError'
    }
  }
  export class ForbiddenIdentifierError extends BaseTokenizerError {
    constructor(line: number, col: number, source: string, start: number) {
      let { lineIndex, msg } = getFullLine(source, start)
      msg = '\n' + msg + '\n'
      let hint = `^ This identifier is reserved for use in Python. Consider using another identifier.`
      hint = hint.padStart(hint.length + col - MAGIC_OFFSET, '^')
      super(msg + hint, lineIndex, col)
      this.name = 'ForbiddenIdentifierError'
    }
  }
  export class ForbiddenOperatorError extends BaseTokenizerError {
    constructor(line: number, col: number, source: string, start: number, current: number) {
      let { lineIndex, msg } = getFullLine(source, start)
      msg = '\n' + msg + '\n'
      let hint = ` This operator is reserved for use in Python. It's not allowed to be used.`
      const diff = current - start
      hint = hint.padStart(hint.length + diff - MAGIC_OFFSET + 1, '^')
      hint = hint.padStart(hint.length + col - diff, ' ')
      super(msg + hint, lineIndex, col)
      this.name = 'ForbiddenOperatorError'
    }
  }

  export class NonMatchingParenthesesError extends BaseTokenizerError {
    constructor(line: number, col: number, source: string, current: number) {
      let { lineIndex, msg } = getFullLine(source, current - 1)
      msg = '\n' + msg + '\n'
      let hint = `${col > 1 ? '~' : ''}^~ Non-matching closing parentheses.`
      // The extra `~` character takes up some space.
      hint = hint.padStart(hint.length + col - MAGIC_OFFSET - (col > 1 ? 1 : 0), ' ')
      super(msg + hint, lineIndex, col)
      this.name = 'NonMatchingParenthesesError'
    }
  }
}

export namespace ParserErrors {
  export class BaseParserError extends SyntaxError {
    line: number
    col: number
    loc: Position

    constructor(message: string, line: number, col: number) {
      super(`SyntaxError at line ${line}
                   ${message}`)
      this.line = line
      this.col = col
      this.name = 'BaseParserError'
      this.loc = toEstreeLocation(line, col, 0)
    }
  }
  export class ExpectedTokenError extends BaseParserError {
    constructor(source: string, current: Token, expected: string) {
      let { lineIndex, msg } = getFullLine(source, current.indexInSource - current.lexeme.length)
      msg = '\n' + msg + '\n'
      let hint = `^ ${expected}. Found '${escape(current.lexeme)}'.`
      hint = hint.padStart(hint.length + current.col - MAGIC_OFFSET, ' ')
      super(msg + hint, lineIndex, current.col)
      this.name = 'ExpectedTokenError'
    }
  }
  export class NoElseBlockError extends BaseParserError {
    constructor(source: string, current: Token) {
      let { lineIndex, msg } = getFullLine(source, current.indexInSource)
      msg = '\n' + msg + '\n'
      let hint = `^ Expected else block after this if block.`
      hint = hint.padStart(hint.length + current.col - MAGIC_OFFSET, ' ')
      super(msg + hint, lineIndex, current.col)
      this.name = 'ExpectedTokenError'
    }
  }
  export class GenericUnexpectedSyntaxError extends BaseParserError {
    constructor(line: number, col: number, source: string, start: number, current: number) {
      let { lineIndex, msg } = getFullLine(source, start)
      msg = '\n' + msg + '\n'
      let hint = ` Detected invalid syntax.`
      const indicator = createErrorIndicator(msg, '@')
      super(msg + indicator + hint, lineIndex, col)
      this.name = 'GenericUnexpectedSyntaxError'
    }
  }
}

export namespace ResolverErrors {
  export class BaseResolverError extends SyntaxError {
    line: number
    col: number
    loc: Position

    constructor(name: string, message: string, line: number, col: number) {
      super(`${name} at line ${line}
                   ${message}`)
      this.line = line
      this.col = col
      this.name = 'BaseResolverError'
      this.loc = toEstreeLocation(line, col, 0)
    }
  }
  export class NameNotFoundError extends BaseResolverError {
    constructor(
      line: number,
      col: number,
      source: string,
      start: number,
      current: number,
      suggestion: string | null
    ) {
      let { lineIndex, msg } = getFullLine(source, start)
      msg = '\n' + msg + '\n'
      let hint = ` This name is not found in the current or enclosing environment(s).`
      const diff = current - start
      hint = hint.padStart(hint.length + diff - MAGIC_OFFSET + 1, '^')
      hint = hint.padStart(hint.length + col - diff, ' ')
      if (suggestion !== null) {
        let sugg = ` Perhaps you meant to type '${suggestion}'?`
        sugg = sugg.padStart(sugg.length + col - MAGIC_OFFSET + 1, ' ')
        sugg = '\n' + sugg
        hint += sugg
      }
      const name = 'NameNotFoundError'
      super(name, msg + hint, lineIndex, col)
      this.name = 'NameNotFoundError'
    }
  }

  export class NameReassignmentError extends BaseResolverError {
    constructor(
      line: number,
      col: number,
      source: string,
      start: number,
      current: number,
      oldName: Token
    ) {
      let { lineIndex, msg } = getFullLine(source, start)
      msg = '\n' + msg + '\n'
      let hint = ` A name has been declared here.`
      const diff = current - start
      hint = hint.padStart(hint.length + diff - MAGIC_OFFSET + 1, '^')
      hint = hint.padStart(hint.length + col - diff, ' ')
      let { lineIndex: oldLine, msg: oldNameLine } = getFullLine(source, oldName.indexInSource)
      oldNameLine = '\n' + oldNameLine + '\n'
      let sugg = ` However, it has already been declared in the same environment at line ${oldLine}, here: `
      sugg = sugg.padStart(sugg.length + col - MAGIC_OFFSET + 1, ' ')
      sugg = '\n' + sugg
      hint += sugg
      oldNameLine.padStart(oldNameLine.length + col - MAGIC_OFFSET + 1, ' ')
      hint += oldNameLine
      const name = 'NameReassignmentError'
      super(name, msg + hint, lineIndex, col)
      this.name = 'NameReassignmentError'
    }
  }
}

export namespace TranslatorErrors {
  export class BaseTranslatorError extends SyntaxError {
    line: number
    col: number
    loc: Position

    constructor(message: string, line: number, col: number) {
      super(`BaseTranslatorError at line ${line} column ${col - 1}
                   ${message}`)
      this.line = line
      this.col = col
      this.name = 'BaseTranslatorError'
      this.loc = toEstreeLocation(line, col, 0)
    }
  }
  export class UnsupportedOperator extends BaseTranslatorError {
    constructor(line: number, col: number, source: string, start: number) {
      let { lineIndex, msg } = getFullLine(source, start)
      msg = '\n' + msg + '\n'
      let hint = `^ This operator is not yet supported by us.`
      hint = hint.padStart(hint.length + col - MAGIC_OFFSET, ' ')
      super(msg + hint, lineIndex, col)
      this.name = 'UnsupportedOperator'
    }
  }
}
