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
import { FeatureValidator } from "./types";

/**
 * Source Chapter 1: no lists, no loops, no reassignment, no break/continue, no global, no nonlocal,
 * no pass, no rest params, no annotated assignments, no is operator.
 * Factory function returns a fresh set of validators (stateful ones reset each time).
 */
export function makeChapter1Validators(): FeatureValidator[] {
  return [
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
    ForRangeOnlyValidator,
    NoRangeRedeclarationValidator,
    createRangeOnlyInForHeaderValidator(true),
    createBreakContinueValidator(),
    NoAnnAssignValidator,
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
