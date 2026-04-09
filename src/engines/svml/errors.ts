import { SVMLType } from "./types";

export class SVMLCompilerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SVMLCompilerError";
  }
}

export class SVMLInterpreterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SVMLInterpreterError";
  }
}

export class UnsupportedOperandTypeError extends SVMLInterpreterError {
  constructor(operand: string, ...wrongTypes: SVMLType[]) {
    const msg = `TypeError: unsupported operand type(s) for ${operand}: ${wrongTypes.map(t => `'${t}'`).join(" and ")}`;
    super(msg);
  }
}

export class MissingRequiredPositionalError extends SVMLInterpreterError {}
export class TooManyPositionalArgumentsError extends SVMLInterpreterError {}
export class ZeroDivisionError extends SVMLInterpreterError {}
export class ValueError extends SVMLInterpreterError {}
