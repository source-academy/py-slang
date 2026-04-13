import {
  RuntimeSourceError
} from "../../errors";
import type { Context } from "./context";

export function handleRuntimeError(context: Context, error: RuntimeSourceError): never {
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
