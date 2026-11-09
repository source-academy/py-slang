/**
 * The configuration of pyright for Python §4 Typed (`pyrightconfig.json`): basedpyright's
 * `standard` mode, with the rules that follow from the specification (docs/typed-python-4.md):
 *
 * - Nothing may have an unknown type: a lambda whose parameters are not given a type by its context,
 *   an empty list without a declared type, an unannotated parameter are all errors.
 * - There is no type `Any`: it is not a name of the language, and one imported from `typing` is an
 *   error where it is used.
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
  reportExplicitAny: "error",
  reportRedeclaration: "none",
  reportUnusedExpression: "none",
  // A module is a stub (`rune.pyi`) with no source: the module is loaded at run time.
  reportMissingModuleSource: "none",
} as const;
