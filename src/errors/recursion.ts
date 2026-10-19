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
 * in SpiderMonkey (Firefox), which has no global InternalError class to test against. When the
 * browser copies a deeply nested value (`postMessage`, `structuredClone`) it throws that message
 * as a DOMException ("Failed to execute 'postMessage' on 'MessagePort': Maximum call stack size
 * exceeded"). The error is told by its name and message, not by its class: one from another realm
 * (the browser's own code, a test sandbox) is not an instance of this realm's.
 */
export function isStackOverflow(e: unknown): boolean {
  if (typeof DOMException !== "undefined" && e instanceof DOMException) {
    return /call stack|too much recursion/i.test(e.message);
  }
  const { name, message } = (e ?? {}) as { name?: unknown; message?: unknown };
  if (typeof name !== "string" || typeof message !== "string") return false;
  if (name === "RangeError") return /call stack/i.test(message);
  if (name === "InternalError") return /too much recursion/i.test(message);
  return false;
}
