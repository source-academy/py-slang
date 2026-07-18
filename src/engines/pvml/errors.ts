import { friendlyTypeName } from "../cse/types";
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
    const msg = `TypeError: unsupported operand type(s) for ${operand}: ${wrongTypes.map(t => friendlyTypeName(t)).join(" and ")}`;
    super(msg);
  }
}

export class MissingRequiredPositionalError extends PVMLInterpreterError {}
export class TooManyPositionalArgumentsError extends PVMLInterpreterError {}
export class ZeroDivisionError extends PVMLInterpreterError {}
export class ValueError extends PVMLInterpreterError {}

/**
 * A local variable's env slot was read while still holding its `undefined`
 * initial fill (see PVMLEnvironment's constructor) — i.e. before any STLG
 * ever wrote to it. `undefined` is never a legitimate stored value (Python's
 * `None` is always the distinct `null`, pushed by LGCN — see
 * PVMLCompiler's visitNoneExpr/visitReturnStmt), so this is a reliable
 * "never assigned yet" sentinel, matching real Python's UnboundLocalError
 * for reading a name the current function assigns somewhere but hasn't
 * reached yet at this point in execution.
 */
export class UnboundLocalError extends PVMLInterpreterError {}
/** Same as UnboundLocalError but for a slot reached via LDPG (an enclosing
 * function's own local, captured by a `nonlocal` or implicit closure
 * reference) rather than the current function's own LDLG — matches real
 * Python's distinct "free variable ... referenced before assignment in
 * enclosing scope" wording for this case. */
export class FreeVariableUnboundError extends PVMLInterpreterError {}
/** A module-level (LDGG) name with no entry in globalEnv at all — e.g. a
 * bare `global x; print(x)` with no `x` ever assigned anywhere. Distinct
 * from UnboundLocalError/FreeVariableUnboundError: those are "this slot's
 * initial `undefined` fill was never overwritten"; this is "no binding for
 * this name exists in the global map at all" (globalEnv.get would also
 * return `undefined` for a missing key, indistinguishable from a
 * legitimately-unset slot without the `.has()` check this guards). */
export class NameError extends PVMLInterpreterError {}
