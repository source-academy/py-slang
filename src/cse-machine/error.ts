import {
  ErrorSeverity,
  ErrorType,
  RuntimeSourceError,
  SourceError,
  SourceLocation,
  UNKNOWN_LOCATION,
} from "../errors";
import { Context } from "./context";

export class CseError implements SourceError {
  public type = ErrorType.RUNTIME;
  public severity = ErrorSeverity.ERROR;
  public location: SourceLocation;

  constructor(
    public message: string,
    location?: SourceLocation,
  ) {
    this.location = location ?? UNKNOWN_LOCATION;
  }

  public explain() {
    return this.message;
  }

  public elaborate() {
    return "There is an error in the CSE machine.";
  }
}

export function handleRuntimeError(context: Context, error: RuntimeSourceError) {
  context.errors.push(error);
  throw error;
}

export class AssertionError extends RuntimeSourceError {
  constructor(public readonly message: string) {
    super();
  }

  public explain(): string {
    return this.message;
  }

  public elaborate(): string {
    return "Please contact the administrators to let them know that this error has occurred";
  }
}
