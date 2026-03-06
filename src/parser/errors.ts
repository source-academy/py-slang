import { createErrorIndicator, getFullLine, MAGIC_OFFSET } from '../errors'
import { Token } from '../tokenizer'

export namespace ParserErrors {
  export class BaseParserError extends SyntaxError {
    line: number
    col: number

    constructor(message: string, line: number, col: number) {
      super(`SyntaxError at line ${line}
                   ${message}`)
      this.line = line
      this.col = col
      this.name = 'BaseParserError'
    }
  }
  export class ExpectedTokenError extends BaseParserError {
    constructor(source: string, current: Token, expected: string) {
      const { lineIndex, fullLine } = getFullLine(
        source,
        current.indexInSource - current.lexeme.length
      )
      let hint = `^ ${expected}. Found '${current.lexeme}'.`
      hint = hint.padStart(hint.length + current.col - MAGIC_OFFSET, ' ')
      super('\n' + fullLine + '\n' + hint, lineIndex, current.col)
      this.name = 'ExpectedTokenError'
    }
  }
  export class NoElseBlockError extends BaseParserError {
    constructor(source: string, current: Token) {
      const { lineIndex, fullLine } = getFullLine(source, current.indexInSource)
      let hint = `^ Expected else block after this if block.`
      hint = hint.padStart(hint.length + current.col - MAGIC_OFFSET, ' ')
      super('\n' + fullLine + '\n' + hint, lineIndex, current.col)
      this.name = 'NoElseBlockError'
    }
  }
  export class GenericUnexpectedSyntaxError extends BaseParserError {
    constructor(line: number, col: number, source: string, start: number) {
      const { lineIndex, fullLine } = getFullLine(source, start)
      const hint = ` Detected invalid syntax.`
      const indicator = createErrorIndicator(fullLine, -1)
      super('\n' + fullLine + '\n' + indicator + hint, lineIndex, col)
      this.name = 'GenericUnexpectedSyntaxError'
    }
  }
}
