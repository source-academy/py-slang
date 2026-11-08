import { ensureTypedPython4Checker } from "../typecheck/bundler/typed4";
import { nodeWorkerFactory } from "../typecheck/node-worker";
import { TypedPythonChecker } from "../typecheck";

/** The time that building the worker (a few seconds to a minute, once) and starting it may take. */
export const CHECKER_SETUP_TIMEOUT_MS = 300_000;

/**
 * Starts the Typed Python §4 checker in a Node worker thread, building its worker first if it is
 * missing or out of date (`yarn build:typecheck` does that too). Dispose of it when done.
 */
export async function startTypedChecker(): Promise<TypedPythonChecker> {
  const file = await ensureTypedPython4Checker();
  return TypedPythonChecker.start(nodeWorkerFactory(file));
}
