import { Worker } from "worker_threads";
import type { WorkerFactory, WorkerLike } from "./client";

/**
 * The code of a Node worker thread that runs a web worker's script: the few members of a browser's
 * `DedicatedWorkerGlobalScope` that the script uses (`self`, `postMessage`, `addEventListener`,
 * `onmessage`) are made from the thread's message port.
 */
function bootstrap(script: string): string {
  return `
const { parentPort } = require("node:worker_threads");
const listeners = [];
globalThis.self = globalThis;
globalThis.postMessage = (message, transfer) => parentPort.postMessage(message, transfer);
globalThis.addEventListener = (type, listener) => {
  if (type === "message") listeners.push(listener);
};
globalThis.removeEventListener = (type, listener) => {
  const i = listeners.indexOf(listener);
  if (i >= 0) listeners.splice(i, 1);
};
parentPort.on("message", data => {
  const event = { data };
  if (typeof globalThis.onmessage === "function") globalThis.onmessage(event);
  for (const listener of listeners) listener(event);
});
// A browser has SharedArrayBuffer only on a page that is cross-origin isolated. The worker should not
// need it (it does not under Node, where it was tried both ways), so it is not given it here, as on a
// page that is not isolated.
delete globalThis.SharedArrayBuffer;
require(${JSON.stringify(script)});
`;
}

/**
 * Runs the checker's worker (dist/TypedPy4Checker.js) in Node, for the tests and the command line.
 * In a browser the worker is started with `new Worker(url)` instead.
 */
export function nodeWorkerFactory(script: string): WorkerFactory {
  return () => {
    const thread = new Worker(bootstrap(script), { eval: true });
    const worker: WorkerLike = {
      onmessage: null,
      onerror: null,
      postMessage: (message, transfer) =>
        thread.postMessage(
          message,
          transfer as unknown as import("worker_threads").TransferListItem[],
        ),
      terminate: () => void thread.terminate(),
    };
    thread.on("message", data => worker.onmessage?.({ data }));
    thread.on("error", error => worker.onerror?.(error));
    return worker;
  };
}
