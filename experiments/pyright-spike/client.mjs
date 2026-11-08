// Minimal LSP client for the browser-basedpyright worker: initialize with an in-memory file
// system, open a document, and resolve with the diagnostics pyright publishes for it.
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";

const ROOT = "/workspace";

export async function createChecker({ files = {}, config = {} } = {}) {
  const t0 = performance.now();
  const worker = new Worker(fileURLToPath(new URL("./bootstrap.cjs", import.meta.url)));
  let nextId = 1;
  const pending = new Map();
  const diagWaiters = new Map(); // uri -> resolve
  const log = [];
  const backgroundWorkers = [];

  const send = msg => worker.postMessage({ jsonrpc: "2.0", ...msg });
  const request = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      send({ id, method, params });
    });
  const notify = (method, params) => send({ method, params });

  worker.on("message", msg => {
    if (process.env.LSP_TRACE) console.log("<-", JSON.stringify(msg).slice(0, 400));
    if (msg.type === "browser/newWorker") {
      // The foreground server asks the host to spawn a background-analysis worker and hands it
      // one end of a MessageChannel. (In a browser page: `new Worker(url)` + the same message.)
      const bg = new Worker(fileURLToPath(new URL("./bootstrap.cjs", import.meta.url)));
      bg.on("error", e => console.error("background worker error", e));
      bg.postMessage(
        { type: "browser/boot", mode: "background", port: msg.port, initialData: msg.initialData },
        [msg.port],
      );
      backgroundWorkers.push(bg);
      return;
    }
    if (msg.id !== undefined && msg.method === undefined) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p?.reject(new Error(JSON.stringify(msg.error)));
      else p?.resolve(msg.result);
      return;
    }
    if (msg.id !== undefined) {
      // server -> client request
      let result = null;
      if (msg.method === "workspace/configuration") {
        result = msg.params.items.map(() => ({}));
      }
      send({ id: msg.id, result });
      return;
    }
    if (msg.method === "textDocument/publishDiagnostics") {
      const w = diagWaiters.get(msg.params.uri);
      if (w) {
        diagWaiters.delete(msg.params.uri);
        w(msg.params.diagnostics);
      }
    } else if (msg.method === "window/logMessage") {
      log.push(msg.params.message);
    }
  });
  worker.on("error", e => console.error("worker error", e));
  // The bundle waits for a boot message before creating the language server.
  worker.postMessage({ type: "browser/boot", mode: "foreground" });

  const allFiles = {
    [`${ROOT}/pyrightconfig.json`]: JSON.stringify({
      typeCheckingMode: "standard",
      pythonVersion: "3.13",
      ...config,
    }),
    ...Object.fromEntries(
      Object.entries(files).map(([k, v]) => [k.startsWith("/") ? k : `${ROOT}/${k}`, v]),
    ),
  };

  await request("initialize", {
    processId: null,
    rootUri: `file://${ROOT}`,
    workspaceFolders: [{ uri: `file://${ROOT}`, name: "workspace" }],
    capabilities: { textDocument: { publishDiagnostics: {} } },
    initializationOptions: { files: allFiles },
  });
  notify("initialized", {});
  const startupMs = performance.now() - t0;

  let version = 0;
  const opened = new Set();
  async function check(name, text) {
    const uri = `file://${ROOT}/${name}`;
    const done = new Promise(resolve => diagWaiters.set(uri, resolve));
    const t = performance.now();
    if (opened.has(uri)) {
      notify("textDocument/didChange", {
        textDocument: { uri, version: ++version },
        contentChanges: [{ text }],
      });
    } else {
      opened.add(uri);
      notify("textDocument/didOpen", {
        textDocument: { uri, languageId: "python", version: ++version, text },
      });
    }
    const diagnostics = await done;
    return { diagnostics, ms: performance.now() - t };
  }

  return {
    check,
    startupMs,
    log,
    close: () => [worker, ...backgroundWorkers].forEach(w => w.terminate()),
  };
}
