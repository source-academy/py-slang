/**
 * Python's RecursionError for the engines that run on the JavaScript stack: when the JavaScript stack
 * runs out before the engine's own recursion limit (CPython's is 1000 calls), the engine reports what
 * CPython does, not the RangeError of the JavaScript engine.
 */

/** The message of CPython's RecursionError, with the name of the error as the engines print it. */
export const RECURSION_ERROR_MESSAGE = "RecursionError: maximum recursion depth exceeded";

/** Whether a thrown value is the JavaScript stack running out. */
export function isStackOverflow(e: unknown): boolean {
  return e instanceof RangeError && /call stack/i.test(e.message);
}
