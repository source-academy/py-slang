import { FeatureValidator } from "./types";
import { NoListsValidator } from "./features/no-lists";
import { NoLoopsValidator } from "./features/no-loops";
import { createNoReassignmentValidator } from "./features/no-reassignment";
import { NoBreakContinueValidator } from "./features/no-break-continue";
import { NoNonlocalValidator } from "./features/no-nonlocal";

/**
 * Source Chapter 1: no lists, no loops, no reassignment, no lambda, no break/continue, no nonlocal.
 * Factory function returns a fresh set of validators (stateful ones reset each time).
 */
export function makeChapter1Validators(): FeatureValidator[] {
  return [
    NoListsValidator,
    NoLoopsValidator,
    createNoReassignmentValidator(),
    NoBreakContinueValidator,
    NoNonlocalValidator,
  ];
}

/**
 * Source Chapter 2: no lists, no loops, no nonlocal. Reassignment is allowed.
 */
export function makeChapter2Validators(): FeatureValidator[] {
  return [NoListsValidator, NoLoopsValidator, NoBreakContinueValidator, NoNonlocalValidator];
}

/**
 * Source Chapter 3: lists, loops, and reassignment are all allowed.
 */
export function makeChapter3Validators(): FeatureValidator[] {
  return [];
}

/**
 * Source Chapter 4: unrestricted. No validators.
 */
export function makeChapter4Validators(): FeatureValidator[] {
  return [];
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
