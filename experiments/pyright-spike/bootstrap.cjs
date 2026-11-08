// Runs browser-basedpyright's web-worker bundle inside a Node worker_thread by shimming the
// handful of DedicatedWorkerGlobalScope members that vscode-jsonrpc/browser uses.
const { parentPort } = require("node:worker_threads");

const listeners = [];
globalThis.self = globalThis;
globalThis.postMessage = (msg, transfer) => parentPort.postMessage(msg, transfer);
globalThis.addEventListener = (type, fn) => {
  if (type === "message") listeners.push(fn);
};
globalThis.removeEventListener = (type, fn) => {
  const i = listeners.indexOf(fn);
  if (i >= 0) listeners.splice(i, 1);
};
parentPort.on("message", data => {
  const ev = { data };
  if (typeof globalThis.onmessage === "function") globalThis.onmessage(ev);
  for (const fn of listeners) fn(ev);
});

require(
  process.env.PYRIGHT_WORKER
    ? require("node:path").resolve(process.env.PYRIGHT_WORKER)
    : "browser-basedpyright/dist/pyright.worker.js",
);
