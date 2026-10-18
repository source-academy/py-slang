/**
 * Python's RecursionError for the engines that run on the JavaScript stack: when the JavaScript stack
 * runs out before the engine's own recursion limit (CPython's is 1000 calls), the engine reports what
 * CPython does, not the RangeError of the JavaScript engine.
 */

/** The message of CPython's RecursionError, with the name of the error as the engines print it. */
export const RECURSION_ERROR_MESSAGE = "RecursionError: maximum recursion depth exceeded";

/**
 * Whether a thrown value is the JavaScript stack running out: a RangeError "Maximum call stack size
 * exceeded" in V8 and JavaScriptCore (Chrome, Node, Safari), an InternalError "too much recursion"
 * in SpiderMonkey (Firefox), which has no global InternalError class to test against.
 */
export function isStackOverflow(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  if (e instanceof RangeError) return /call stack/i.test(e.message);
  return e.name === "InternalError" && /too much recursion/i.test(e.message);
}
