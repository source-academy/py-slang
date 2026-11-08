/**
 * The configuration of pyright for Typed Python §4 (`pyrightconfig.json`): basedpyright's
 * `standard` mode, with the rules that follow from the specification (docs/typed-python-4.md):
 *
 * - Nothing may have an unknown type: a lambda whose parameters are not given a type by its context,
 *   an empty list without a declared type, an unannotated parameter are all errors.
 * - A name can be defined again (Python §3 and §4 allow reassignment), so a redeclaration is not an
 *   error.
 * - An expression statement is not a mistake (`1 + 2` in a REPL).
 */
export const TYPED_PYTHON_4_CONFIG = {
  typeCheckingMode: "standard",
  pythonVersion: "3.13",
  reportMissingParameterType: "error",
  reportUnknownLambdaType: "error",
  reportUnknownParameterType: "error",
  reportUnknownVariableType: "error",
  reportUnknownArgumentType: "error",
  reportUnknownMemberType: "error",
  reportRedeclaration: "none",
  reportUnusedExpression: "none",
} as const;
