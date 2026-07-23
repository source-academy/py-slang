/**
 * Tests for the generic (non-torch) import-root detection pyodide's
 * evaluator uses to decide what to micropip-install before running a chunk.
 */
import { loadPyodide } from "pyodide";
import type { PyodideInterface } from "pyodide";
import { getImportRoots, resetHelperState } from "../engines/pyodide/importAnalyzer";

let pyodide: PyodideInterface;

beforeAll(async () => {
  resetHelperState();
  pyodide = await loadPyodide();
}, 60_000);

describe("getImportRoots", () => {
  test("returns the root of a bare import", async () => {
    const roots = await getImportRoots(pyodide, "import numpy\n");
    expect(roots).toEqual(new Set(["numpy"]));
  });

  test("returns the root of a dotted import", async () => {
    const roots = await getImportRoots(pyodide, "import numpy.linalg\n");
    expect(roots).toEqual(new Set(["numpy"]));
  });

  test("returns the root of a from-import", async () => {
    const roots = await getImportRoots(pyodide, "from numpy import array\n");
    expect(roots).toEqual(new Set(["numpy"]));
  });

  test("collects roots from multiple import statements, deduplicated", async () => {
    const src = "import math\nimport math\nfrom numpy import array\nimport sys\n";
    const roots = await getImportRoots(pyodide, src);
    expect(roots).toEqual(new Set(["math", "numpy", "sys"]));
  });

  test("returns an empty set for a chunk with no imports", async () => {
    const roots = await getImportRoots(pyodide, "x = 1\nprint(x)\n");
    expect(roots).toEqual(new Set());
  });

  test("returns an empty set for unparseable source rather than throwing", async () => {
    const roots = await getImportRoots(pyodide, "def f(:\n");
    expect(roots).toEqual(new Set());
  });
});
