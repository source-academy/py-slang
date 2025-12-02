import { ErrorSeverity, ErrorType, SourceError, SourceLocation } from '../types'
import { Token } from '../tokenizer'

// todo
// just put on here temporarily
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

interface Locatable {
  startToken: Token
  endToken: Token
}

export abstract class PyRuntimeSourceError implements SourceError {
  public type: ErrorType = ErrorType.RUNTIME
  public severity: ErrorSeverity = ErrorSeverity.ERROR
  public location: SourceLocation
  public message = 'Unknown runtime error has occured'

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
