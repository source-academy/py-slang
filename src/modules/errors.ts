import { ErrorType, SourceError, SourceLocation, ErrorSeverity, Locatable,  UNKNOWN_LOCATION } from "../errors/base"
import { RuntimeSourceError } from "../errors/py_runtimeSourceError"

export class ModuleInternalError extends RuntimeSourceError {
  constructor(
    public moduleName: string,
    public error?: any,
    node?: Locatable
  ) {
    super(node)
    this.message = this.explain()
  }

  public explain() {
    return `Error(s) occured when executing the module '${this.moduleName}'.`
  }

  public elaborate() {
    return 'You may need to contact with the author for this module to fix this error.'
  }
}

abstract class ImportError implements SourceError {
  public type: ErrorType = ErrorType.IMPORT
  public severity = ErrorSeverity.ERROR
  public location: SourceLocation
  public message: string = '' // Add the message property

  constructor(public node?: Locatable) {
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

  public abstract explain(): string
  public abstract elaborate(): string
}

export class ModuleConnectionError extends ImportError {
  private static staticMessage: string = `Unable to get modules.`
  private static staticElaboration: string = `You should check your Internet connection, and ensure you have used the correct module path.`
  constructor(node?: Locatable) {
    super(node)
    this.message = ModuleConnectionError.staticMessage
  }

  public explain() {
    return this.message
  }

  public elaborate() {
    return ModuleConnectionError.staticElaboration
  }
}

export class ModuleNotFoundError extends ImportError {
  constructor(
    public moduleName: string,
    node?: Locatable
  ) {
    super(node)
    this.message = this.explain()
  }

  public explain() {
    return `Module '${this.moduleName}' not found.`
  }

  public elaborate() {
    return 'You should check your import declarations, and ensure that all are valid modules.'
  }
}

export class UndefinedImportError extends ImportError {
  constructor(
    public name: string,
    public moduleName: string,
    node?: Locatable
  ) {
    super(node)
    this.message = this.explain()
  }

  public explain() {
    return `'${this.moduleName}' does not contain a definition for '${this.name}'`
  }
  public elaborate(): string {
    return `You should check if '${this.name}' is exported by module '${this.moduleName}' and that it is spelled correctly.`
  }
}

export class ModulePreprocessingError extends ImportError {
  constructor(public underlyingError: SourceError) {
    super(underlyingError.location ? { startToken: { line: underlyingError.location.start.line, col: underlyingError.location.start.column } as any, endToken: {} as any } : undefined);
    this.message = this.explain();
  }

  public explain() {
    return `Error during module preprocessing: ${this.underlyingError.explain()}`;
  }

  public elaborate() {
    return this.underlyingError.elaborate();
  }
}
