/**
 * Errors of the full e-stepper. The `kind` is the name of the Python exception class that CPython
 * raises for the same program (`TypeError`, `ZeroDivisionError`, …); the differential tests compare
 * it with CPython's. Messages follow CPython's wording where it is stable across versions.
 */

export class PyError extends Error {
  constructor(
    readonly kind: string,
    message: string,
  ) {
    super(message);
    this.name = kind;
  }
}

/** A construct of Python that the full e-stepper does not implement (yet). */
export class UnsupportedError extends PyError {
  constructor(what: string) {
    super("NotImplementedError", `The environment stepper does not support ${what} yet`);
  }
}
