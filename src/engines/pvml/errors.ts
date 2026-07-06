import { PVMLType } from "./types";

export class PVMLCompilerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PVMLCompilerError";
  }
}

export class PVMLInterpreterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PVMLInterpreterError";
  }
}

export class UnsupportedOperandTypeError extends PVMLInterpreterError {
  constructor(operand: string, ...wrongTypes: PVMLType[]) {
    const msg = `TypeError: unsupported operand type(s) for ${operand}: ${wrongTypes.map(t => `'${t}'`).join(" and ")}`;
    super(msg);
  }
}

export class MissingRequiredPositionalError extends PVMLInterpreterError {}
export class TooManyPositionalArgumentsError extends PVMLInterpreterError {}
export class ZeroDivisionError extends PVMLInterpreterError {}
export class ValueError extends PVMLInterpreterError {}
