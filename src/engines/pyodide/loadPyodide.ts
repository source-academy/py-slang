import { loadPyodide, version } from "pyodide";
import type { PyodideInterface } from "pyodide";

const IN_NODE =
  typeof process !== "undefined" && process.versions != null && process.versions.node != null;

/**
 * pyodide's browser entry point fetches its assets (asm.js, .wasm, stdlib
 * zip) relative to `indexURL` via `fetch`; under Node there is no bundler
 * serving those, so this mirrors them into a local temp dir once per pyodide
 * version and points `indexURL` there instead.
 */
async function ensureLocalPyodideAssets(baseUrl: string): Promise<string> {
  const path = await import("node:path");
  const fs = await import("node:fs/promises");
  const os = await import("node:os");

  const dir = path.join(os.tmpdir(), `pyodide-${version}`);
  await fs.mkdir(dir, { recursive: true });

  const assets = [
    { name: "pyodide.asm.js", mode: "text" as const },
    { name: "pyodide.asm.wasm", mode: "binary" as const },
    { name: "python_stdlib.zip", mode: "binary" as const },
    { name: "pyodide-lock.json", mode: "text" as const },
  ];

  for (const asset of assets) {
    const url = baseUrl + asset.name;
    const dest = path.join(dir, asset.name);
    try {
      await fs.access(dest);
      continue;
    } catch {
      // File doesn't exist yet — download it.
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    const data =
      asset.mode === "text"
        ? Buffer.from(await res.text(), "utf8")
        : Buffer.from(await res.arrayBuffer());
    // Write next to the final path, then rename into place — an interrupted
    // fetch/write leaves only the .tmp file behind, never a truncated `dest`
    // that a later run's fs.access check would mistake for a valid cache hit.
    // The tmp name is unique per call (pid + random suffix) so concurrent
    // callers — e.g. several Jest workers racing a cold cache — never share
    // one tmp path: two callers renaming their own tmp file onto the same
    // `dest` just have the second's rename silently overwrite the first's
    // (identical content, fetched from the same URL) instead of one of them
    // finding its tmp file already gone.
    const tmpDest = `${dest}.tmp.${process.pid}.${Math.random().toString(36).slice(2)}`;
    await fs.writeFile(tmpDest, data);
    await fs.rename(tmpDest, dest);
  }

  return dir + path.sep;
}

/** Loads a fresh pyodide instance, from a CDN in the browser or a locally
 * cached copy under Node (tests, the REPL). */
export async function loadPyodideGeneric(): Promise<PyodideInterface> {
  const cdnBase = `https://cdn.jsdelivr.net/pyodide/v${version}/full/`;
  const indexURL = IN_NODE ? await ensureLocalPyodideAssets(cdnBase) : cdnBase;
  return loadPyodide({ indexURL, fullStdLib: true });
}
