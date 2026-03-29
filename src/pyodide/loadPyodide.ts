import { version, loadPyodide } from "pyodide";
import type { PyodideInterface } from "pyodide";

const IN_NODE =
  typeof process !== "undefined" && process.versions != null && process.versions.node != null;

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
    await fs.writeFile(dest, data);
  }

  return dir + path.sep;
}

export async function loadPyodideGeneric(): Promise<PyodideInterface> {
  const cdnBase = `https://cdn.jsdelivr.net/pyodide/v${version}/full/`;
  const indexURL = IN_NODE ? await ensureLocalPyodideAssets(cdnBase) : cdnBase;
  return loadPyodide({ indexURL, fullStdLib: true });
}
