/**
 * Import analysis for the pyodide evaluator: finds every top-level module a
 * chunk imports, so evaluateChunk can `micropip.install` whichever of them
 * aren't already available before running the chunk.
 *
 * Uses Python's own `ast` module (via pyodide) rather than py-slang's parser,
 * since a pyodide chunk is arbitrary CPython source, not restricted to the
 * subset py-slang's grammar understands.
 *
 * The helper function this defines, and the invocations of it, run in a
 * private namespace (not `pyodide.globals`) so `_sa_import_roots` never
 * shows up in — or risks colliding with a name in — the user's own global
 * namespace, which is what actually executes chunks and needs to stay clean
 * for evaluateChunk's own moduleNames tracking (see PyodideEvaluator.ts).
 */

import type { PyodideInterface } from "pyodide";
import type { PyProxy } from "pyodide/ffi";

const ANALYZE_IMPORTS_PY = `
import ast as _ast, json as _json

def _sa_import_roots(source):
    """Parse source and return a JSON array of top-level module names imported."""
    try:
        tree = _ast.parse(source)
    except SyntaxError:
        return "[]"
    roots = set()
    for node in _ast.walk(tree):
        if isinstance(node, _ast.ImportFrom) and node.module:
            roots.add(node.module.split(".")[0])
        elif isinstance(node, _ast.Import):
            for alias in node.names:
                roots.add(alias.name.split(".")[0])
    return _json.dumps(sorted(roots))
`;

/** Per-instance private namespace + load state — a module-level boolean
 * would be shared across every PyodideEvaluator, even though each owns its
 * own separate pyodide runtime (this is what broke a second evaluator
 * instance: it saw the first instance's "already loaded" flag but its own
 * runtime never actually got the helper defined). */
let namespaces = new WeakMap<PyodideInterface, PyProxy>();

function getNamespace(pyodide: PyodideInterface): PyProxy {
  let ns = namespaces.get(pyodide);
  if (!ns) {
    ns = pyodide.toPy({}) as PyProxy;
    namespaces.set(pyodide, ns);
  }
  return ns;
}

async function ensureHelper(pyodide: PyodideInterface): Promise<PyProxy> {
  const isNew = !namespaces.has(pyodide);
  const ns = getNamespace(pyodide);
  if (isNew) {
    await pyodide.runPythonAsync(ANALYZE_IMPORTS_PY, { globals: ns });
  }
  return ns;
}

/** Test-only: forget every namespace this module has created, so a test that
 * reuses a pyodide instance across cases can force the helper to be
 * redefined in a specific one. Not needed for normal use — a fresh
 * PyodideInterface is simply never in the map yet. */
export function resetHelperState(): void {
  namespaces = new WeakMap();
}

/** The set of top-level module names `source` imports (`import x.y` and
 * `from x.y import z` both contribute root `"x"`). */
export async function getImportRoots(
  pyodide: PyodideInterface,
  source: string,
): Promise<Set<string>> {
  const ns = await ensureHelper(pyodide);
  const json = pyodide.runPython(`_sa_import_roots(${JSON.stringify(source)})`, {
    globals: ns,
  }) as string;
  return new Set(JSON.parse(json) as string[]);
}
