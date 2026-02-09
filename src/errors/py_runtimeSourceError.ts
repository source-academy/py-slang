import { ErrorSeverity, ErrorType, Locatable, type SourceError, SourceLocation, UNKNOWN_LOCATION } from "./base"

export class RuntimeSourceError implements SourceError {
  public type: ErrorType = ErrorType.RUNTIME
  public severity: ErrorSeverity = ErrorSeverity.ERROR
  public location: SourceLocation
  public message = "Default error message"

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
