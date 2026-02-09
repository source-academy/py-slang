import { Context } from './context';
import {
  SourceError,
  ErrorType,
  ErrorSeverity,
  SourceLocation,
  UNKNOWN_LOCATION
} from '../errors/base';
import { RuntimeSourceError } from '../errors/py_runtimeSourceError';

export class CseError implements SourceError {
  public type = ErrorType.RUNTIME
  public severity = ErrorSeverity.ERROR
  public location: SourceLocation

  constructor(public message: string, location?: SourceLocation) {
    this.location = location ?? UNKNOWN_LOCATION
  }

  public explain() {
    return this.message
  }

  public elaborate() {
    return 'There is an error in the CSE machine.'
  }
}

export function handleRuntimeError(context: Context, error: RuntimeSourceError) {
  context.errors.push(error)
  throw error
}
