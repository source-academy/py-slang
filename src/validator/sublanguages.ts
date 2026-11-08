import { ForRangeOnlyValidator } from "./features/for-range-only";
import { createBreakContinueValidator } from "./features/loop-break-continue-only";
import { NoAnnAssignValidator } from "./features/no-ann-assign";
import { NoBreakContinueValidator } from "./features/no-break-continue";
import { NoIsOperatorValidator } from "./features/no-is-operator";
import { NoListsValidator } from "./features/no-lists";
import { NoLoopsValidator } from "./features/no-loops";
import { NoGlobalValidator } from "./features/no-global";
import { NoNonlocalValidator } from "./features/no-nonlocal";
import { NoPassValidator } from "./features/no-pass";
import { NoRangeRedeclarationValidator } from "./features/no-range-redeclaration";
import { createNoReassignmentValidator } from "./features/no-reassignment";
import { createRangeOnlyInForHeaderValidator } from "./features/range-only-in-for-header";
import { NoRestParamsValidator } from "./features/no-rest-params";
import { NoSpreadValidator } from "./features/no-spread";
import { NoDefaultValuesValidator } from "./features/no-default-values";
import { NoFullPythonExpressionsValidator } from "./features/no-full-python-expressions";
import { NoFullPythonStatementsValidator } from "./features/no-full-python-statements";
import { NoDeclarationWithoutValueValidator } from "./features/no-declaration-without-value";
import { NoDictsValidator } from "./features/no-dicts";
import { NoKeywordArgsValidator } from "./features/no-keyword-args";
import { NoTuplesValidator } from "./features/no-tuples";
import { NoTypingImportsValidator } from "./features/no-typing-imports";
import { NoTypeAnnotationsValidator } from "./features/no-type-annotations";
import { RequireTypeAnnotationsValidator } from "./features/require-type-annotations";
import { FeatureValidator } from "./types";

/** Syntax of full Python that no sublanguage (§1–§4) has: the parser accepts it, these reject it. */
const beyondPython4Validators: FeatureValidator[] = [
  NoTuplesValidator,
  NoDictsValidator,
  NoKeywordArgsValidator,
  NoDefaultValuesValidator,
  NoFullPythonStatementsValidator,
  NoFullPythonExpressionsValidator,
  NoTypeAnnotationsValidator,
];

/**
 * Source Chapter 1: no lists, no loops, no reassignment, no break/continue, no global, no nonlocal,
 * no pass, no rest params, no annotated assignments, no is operator.
 * Factory function returns a fresh set of validators (stateful ones reset each time).
 */
export function makeChapter1Validators(): FeatureValidator[] {
  return [
    ...beyondPython4Validators,
    NoListsValidator,
    NoLoopsValidator,
    createNoReassignmentValidator(),
    NoBreakContinueValidator,
    NoGlobalValidator,
    NoNonlocalValidator,
    NoPassValidator,
    NoRestParamsValidator,
    NoSpreadValidator,
    NoAnnAssignValidator,
    NoIsOperatorValidator,
    createRangeOnlyInForHeaderValidator(false),
  ];
}

/**
 * Source Chapter 2: no lists, no loops, no reassignment, no break/continue, no global, no nonlocal,
 * no pass, no rest params, no annotated assignments, no is operator.
 * Linked-list library available (None as linked list expression).
 */
export function makeChapter2Validators(): FeatureValidator[] {
  return [
    ...beyondPython4Validators,
    NoListsValidator,
    NoLoopsValidator,
    createNoReassignmentValidator(),
    NoBreakContinueValidator,
    NoGlobalValidator,
    NoNonlocalValidator,
    NoPassValidator,
    NoRestParamsValidator,
    NoSpreadValidator,
    NoAnnAssignValidator,
    NoIsOperatorValidator,
    createRangeOnlyInForHeaderValidator(false),
  ];
}

/**
 * Source Chapter 3: lists, loops, and reassignment are all allowed.
 * for loops are restricted to range() only, and the name `range` cannot be redefined. Break and continue are allowed, but only within loops. No annotated assignments allowed.
 */
export function makeChapter3Validators(): FeatureValidator[] {
  return [
    ...beyondPython4Validators,
    ForRangeOnlyValidator,
    NoRangeRedeclarationValidator,
    createRangeOnlyInForHeaderValidator(true),
    createBreakContinueValidator(),
    NoAnnAssignValidator,
  ];
}

/**
 * Source Chapter 4: unrestricted. No validators except for for-range-only, `range` redefinition, break/continue and annotated assignment validation.
 */
export function makeChapter4Validators(): FeatureValidator[] {
  return [
    ...beyondPython4Validators,
    ForRangeOnlyValidator,
    NoRangeRedeclarationValidator,
    createRangeOnlyInForHeaderValidator(true),
    createBreakContinueValidator(),
    NoAnnAssignValidator,
  ];
}

/**
 * Typed Python §4 (docs/typed-python-4.md): Python §4 with type annotations. The rules on the
 * annotations themselves: every `def` annotates its parameters and its return type, a name is
 * declared by an assignment (`x: int = 0`), not on its own (`x: int`), and types need no import.
 *
 * These run on the parsed program, before its types are erased, with {@link traverseAST} (the
 * Resolver does not look at annotations: they are not values). The program then runs as a Python §4
 * program: see `prepareTypedProgram` in src/typecheck/.
 */
export function makeTypedChapter4Validators(): FeatureValidator[] {
  return [
    RequireTypeAnnotationsValidator,
    NoDeclarationWithoutValueValidator,
    NoTypingImportsValidator,
  ];
}

export function makeValidatorsForChapter(chapter: number): FeatureValidator[] {
  switch (chapter) {
    case 1:
      return makeChapter1Validators();
    case 2:
      return makeChapter2Validators();
    case 3:
      return makeChapter3Validators();
    case 4:
      return makeChapter4Validators();
    default:
      return makeChapter4Validators();
  }
}
