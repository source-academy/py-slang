// Browser LSP client for the pyright worker; exposes window.createChecker for the Playwright driver.
window.createChecker = async function ({ workerUrl, files, config }) {
  const t0 = performance.now();
  const worker = new Worker(workerUrl);
  const bgWorkers = [];
  let nextId = 1;
  const pending = new Map();
  const diagWaiters = new Map();
  const send = m => worker.postMessage({ jsonrpc: "2.0", ...m });
  const request = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      send({ id, method, params });
    });
  const notify = (method, params) => send({ method, params });
  worker.onmessage = e => {
    const msg = e.data;
    if (msg.type === "browser/newWorker") {
      const bg = new Worker(workerUrl);
      bg.postMessage(
        { type: "browser/boot", mode: "background", port: msg.port, initialData: msg.initialData },
        [msg.port],
      );
      bgWorkers.push(bg);
      return;
    }
    if (msg.id !== undefined && msg.method === undefined) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
      return;
    }
    if (msg.id !== undefined) {
      send({
        id: msg.id,
        result: msg.method === "workspace/configuration" ? msg.params.items.map(() => ({})) : null,
      });
      return;
    }
    if (msg.method === "textDocument/publishDiagnostics") {
      const w = diagWaiters.get(msg.params.uri);
      if (w) {
        diagWaiters.delete(msg.params.uri);
        w(msg.params.diagnostics);
      }
    }
  };
  worker.postMessage({ type: "browser/boot", mode: "foreground" });
  const ROOT = "/workspace";
  const allFiles = {
    [`${ROOT}/pyrightconfig.json`]: JSON.stringify({
      typeCheckingMode: "standard",
      pythonVersion: "3.13",
      ...config,
    }),
  };
  for (const [k, v] of Object.entries(files)) allFiles[`${ROOT}/${k}`] = v;
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
  return {
    startupMs,
    async check(name, text) {
      const uri = `file://${ROOT}/${name}`;
      const done = new Promise(r => diagWaiters.set(uri, r));
      const t = performance.now();
      if (opened.has(uri))
        notify("textDocument/didChange", {
          textDocument: { uri, version: ++version },
          contentChanges: [{ text }],
        });
      else {
        opened.add(uri);
        notify("textDocument/didOpen", {
          textDocument: { uri, languageId: "python", version: ++version, text },
        });
      }
      const diagnostics = await done;
      return { diagnostics, ms: performance.now() - t };
    },
  };
};
