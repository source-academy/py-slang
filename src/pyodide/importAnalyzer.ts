/**
 * Import analysis for detecting and rewriting torch imports using Python's
 * built-in `ast` module via Pyodide.
 *
 * This avoids the limitations of py-slang's parser (which only supports a
 * subset of Python) by delegating to CPython's own parser running inside
 * Pyodide.
 */

import type { PyodideInterface } from "pyodide";

export interface TorchImportInfo {
  /** Full module path, e.g. "torch" or "torch.nn" */
  module: string;
  /** Imported names with optional aliases */
  names: { name: string; alias: string | null }[];
  /** 1-based line number in the original source */
  line: number;
}

/**
 * Python helper that uses the `ast` module to extract import info.
 * Returns a JSON string describing all FromImport statements.
 */
const ANALYZE_IMPORTS_PY = `
import ast as _ast, json as _json

def _sa_analyze_imports(source):
    """Parse source and return JSON array of from-import info."""
    try:
        tree = _ast.parse(source)
    except SyntaxError:
        return "[]"
    result = []
    for node in _ast.walk(tree):
        if isinstance(node, _ast.ImportFrom) and node.module:
            result.append({
                "module": node.module,
                "names": [
                    {"name": a.name, "alias": a.asname}
                    for a in node.names
                ],
                "line": node.lineno,
            })
    return _json.dumps(result)
`;

let helperLoaded = false;

/**
 * Ensure the Python-side `_sa_analyze_imports` function is defined.
 * Idempotent — only runs once.
 */
async function ensureHelper(pyodide: PyodideInterface): Promise<void> {
  if (helperLoaded) return;
  await pyodide.runPythonAsync(ANALYZE_IMPORTS_PY);
  helperLoaded = true;
}

/**
 * Reset the helper loaded state. Useful for testing when pyodide
 * instances are recreated.
 */
export function resetHelperState(): void {
  helperLoaded = false;
}

/**
 * Parses the source code using Python's `ast` module (via Pyodide) and
 * returns all `from … import …` statements whose root module is "torch".
 */
export async function detectTorchImports(
  pyodide: PyodideInterface,
  source: string,
): Promise<TorchImportInfo[]> {
  await ensureHelper(pyodide);

  const json = pyodide.runPython(
    `_sa_analyze_imports(${JSON.stringify(source)})`,
  ) as string;

  const allImports: TorchImportInfo[] = JSON.parse(json);
  return allImports.filter(imp => imp.module.split(".")[0] === "torch");
}

/**
 * Returns the set of top-level module roots for all non-torch
 * `from … import …` statements. These may need to be installed via micropip.
 */
export async function getNonTorchImportRoots(
  pyodide: PyodideInterface,
  source: string,
): Promise<Set<string>> {
  await ensureHelper(pyodide);

  const json = pyodide.runPython(
    `_sa_analyze_imports(${JSON.stringify(source)})`,
  ) as string;

  const allImports: TorchImportInfo[] = JSON.parse(json);
  const roots = new Set<string>();
  for (const imp of allImports) {
    const root = imp.module.split(".")[0];
    if (root !== "torch") {
      roots.add(root);
    }
  }
  return roots;
}

/**
 * Generates Python assignment code that replaces a torch import statement.
 *
 * Example:
 *   from torch.nn import Linear as L, Conv2d
 *   →  L = __sa_import_torch.nn.Linear
 *      Conv2d = __sa_import_torch.nn.Conv2d
 */
function generateReplacement(imp: TorchImportInfo): string {
  const injected = "__sa_import_torch";
  const subparts = imp.module.split(".").slice(1);
  const base = subparts.length > 0 ? `${injected}.${subparts.join(".")}` : injected;

  return imp.names
    .map(({ name, alias }) => {
      const binding = alias ?? name;
      return `${binding} = ${base}.${name}`;
    })
    .join("\n");
}

/**
 * Rewrites the source code by replacing torch import lines with
 * variable assignments that reference the injected `__sa_import_torch` global.
 *
 * Non-torch code is passed through unchanged.
 */
export async function rewriteTorchImports(
  pyodide: PyodideInterface,
  source: string,
): Promise<{ code: string; hasTorch: boolean }> {
  const imports = await detectTorchImports(pyodide, source);

  if (imports.length === 0) {
    return { code: source, hasTorch: false };
  }

  const lines = source.split(/\r?\n/);

  // Process in reverse order so earlier line indices stay valid.
  for (let i = imports.length - 1; i >= 0; i--) {
    const imp = imports[i];
    const replacement = generateReplacement(imp);
    const idx = imp.line - 1;
    lines.splice(idx, 1, replacement);
  }

  return { code: lines.join("\n"), hasTorch: true };
}
