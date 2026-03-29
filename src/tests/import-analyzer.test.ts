import { loadPyodide } from "pyodide";
import type { PyodideInterface } from "pyodide";
import {
  detectTorchImports,
  getNonTorchImportRoots,
  rewriteTorchImports,
  resetHelperState,
} from "../pyodide/importAnalyzer";

let pyodide: PyodideInterface;

beforeAll(async () => {
  resetHelperState();
  pyodide = await loadPyodide();
}, 60_000);

// ---------------------------------------------------------------------------
// detectTorchImports
// ---------------------------------------------------------------------------
describe("detectTorchImports", () => {
  test("detects `from torch import tensor`", async () => {
    const result = await detectTorchImports(pyodide, "from torch import tensor\nx = 1\n");
    expect(result).toHaveLength(1);
    expect(result[0].module).toBe("torch");
    expect(result[0].names).toEqual([{ name: "tensor", alias: null }]);
  });

  test("detects `from torch.nn import Linear as L`", async () => {
    const result = await detectTorchImports(pyodide, "from torch.nn import Linear as L\nx = 1\n");
    expect(result).toHaveLength(1);
    expect(result[0].module).toBe("torch.nn");
    expect(result[0].names).toEqual([{ name: "Linear", alias: "L" }]);
  });

  test("detects multiple names", async () => {
    const result = await detectTorchImports(
      pyodide,
      "from torch import tensor, zeros, ones\nx = 1\n",
    );
    expect(result).toHaveLength(1);
    expect(result[0].names).toEqual([
      { name: "tensor", alias: null },
      { name: "zeros", alias: null },
      { name: "ones", alias: null },
    ]);
  });

  test("detects multiple torch import statements", async () => {
    const src = "from torch import tensor\nfrom torch.nn import Linear\nx = 1\n";
    const result = await detectTorchImports(pyodide, src);
    expect(result).toHaveLength(2);
    expect(result[0].module).toBe("torch");
    expect(result[1].module).toBe("torch.nn");
  });

  test("detects bare `import torch`", async () => {
    const result = await detectTorchImports(pyodide, "import torch\nx = 1\n");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("import");
    expect(result[0].module).toBe("torch");
    expect(result[0].names).toEqual([{ name: "torch", alias: null }]);
  });

  test("detects `import torch as t`", async () => {
    const result = await detectTorchImports(pyodide, "import torch as t\nx = 1\n");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("import");
    expect(result[0].module).toBe("torch");
    expect(result[0].names).toEqual([{ name: "torch", alias: "t" }]);
  });

  test("detects `import torch.nn`", async () => {
    const result = await detectTorchImports(pyodide, "import torch.nn\nx = 1\n");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("import");
    expect(result[0].module).toBe("torch.nn");
  });

  test("detects mix of bare import and from-import", async () => {
    const src = "import torch\nfrom torch.nn import Linear\nx = 1\n";
    const result = await detectTorchImports(pyodide, src);
    expect(result).toHaveLength(2);
    const types = result.map(r => r.type).sort();
    expect(types).toEqual(["from", "import"]);
  });

  test("ignores non-torch imports", async () => {
    const result = await detectTorchImports(pyodide, "from math import sqrt\nx = 1\n");
    expect(result).toHaveLength(0);
  });

  test("returns empty array for syntax errors", async () => {
    const result = await detectTorchImports(pyodide, "def (broken\n");
    expect(result).toHaveLength(0);
  });

  test("returns empty for code with no imports", async () => {
    const result = await detectTorchImports(pyodide, "x = 1\n");
    expect(result).toHaveLength(0);
  });

  test("works with full Python syntax (method calls, list literals)", async () => {
    const result = await detectTorchImports(
      pyodide,
      "from torch import tensor\nx = tensor([1,2]).tolist()\n",
    );
    expect(result).toHaveLength(1);
    expect(result[0].module).toBe("torch");
  });
});

// ---------------------------------------------------------------------------
// getNonTorchImportRoots
// ---------------------------------------------------------------------------
describe("getNonTorchImportRoots", () => {
  test("returns non-torch module roots", async () => {
    const src = "from math import sqrt\nfrom torch import tensor\nfrom numpy import array\nx = 1\n";
    const roots = await getNonTorchImportRoots(pyodide, src);
    expect(roots).toEqual(new Set(["math", "numpy"]));
  });

  test("returns empty set when only torch imports exist", async () => {
    const roots = await getNonTorchImportRoots(pyodide, "from torch import tensor\nx = 1\n");
    expect(roots).toEqual(new Set());
  });

  test("extracts root from dotted module name", async () => {
    const roots = await getNonTorchImportRoots(pyodide, "from os.path import join\nx = 1\n");
    expect(roots).toEqual(new Set(["os"]));
  });

  test("returns non-torch roots for bare import statements", async () => {
    const src = "import numpy\nimport torch\nx = 1\n";
    const roots = await getNonTorchImportRoots(pyodide, src);
    expect(roots).toEqual(new Set(["numpy"]));
  });
});

// ---------------------------------------------------------------------------
// rewriteTorchImports
// ---------------------------------------------------------------------------
describe("rewriteTorchImports", () => {
  test("rewrites `from torch import tensor`", async () => {
    const { code, hasTorch } = await rewriteTorchImports(
      pyodide,
      "from torch import tensor\nx = tensor(1)\n",
    );
    expect(hasTorch).toBe(true);
    expect(code).toContain("tensor = __sa_import_torch.tensor");
    expect(code).not.toContain("from torch");
    expect(code).toContain("x = tensor(1)");
  });

  test("rewrites `from torch.nn import Linear as L`", async () => {
    const { code, hasTorch } = await rewriteTorchImports(
      pyodide,
      "from torch.nn import Linear as L\nx = L(3, 2)\n",
    );
    expect(hasTorch).toBe(true);
    expect(code).toContain("L = __sa_import_torch.nn.Linear");
    expect(code).toContain("x = L(3, 2)");
  });

  test("rewrites multiple names", async () => {
    const { code, hasTorch } = await rewriteTorchImports(
      pyodide,
      "from torch import tensor, zeros\nx = 1\n",
    );
    expect(hasTorch).toBe(true);
    expect(code).toContain("tensor = __sa_import_torch.tensor");
    expect(code).toContain("zeros = __sa_import_torch.zeros");
  });

  test("leaves non-torch code unchanged", async () => {
    const src = "x = 1\n";
    const { code, hasTorch } = await rewriteTorchImports(pyodide, src);
    expect(hasTorch).toBe(false);
    expect(code).toBe(src);
  });

  test("preserves non-torch imports", async () => {
    const src = "from math import sqrt\nfrom torch import tensor\nx = sqrt(tensor(4))\n";
    const { code, hasTorch } = await rewriteTorchImports(pyodide, src);
    expect(hasTorch).toBe(true);
    expect(code).toContain("from math import sqrt");
    expect(code).toContain("tensor = __sa_import_torch.tensor");
  });

  test("rewrites deeply nested module path", async () => {
    const { code } = await rewriteTorchImports(
      pyodide,
      "from torch.nn.functional import relu\nx = relu(1)\n",
    );
    expect(code).toContain("relu = __sa_import_torch.nn.functional.relu");
  });

  test("rewrites bare `import torch`", async () => {
    const { code, hasTorch } = await rewriteTorchImports(
      pyodide,
      "import torch\nx = torch.tensor([1, 2, 3])\n",
    );
    expect(hasTorch).toBe(true);
    expect(code).toContain("torch = __sa_import_torch");
    expect(code).not.toContain("import torch");
    expect(code).toContain("x = torch.tensor([1, 2, 3])");
  });

  test("rewrites `import torch as t`", async () => {
    const { code, hasTorch } = await rewriteTorchImports(
      pyodide,
      "import torch as t\nx = t.tensor([1])\n",
    );
    expect(hasTorch).toBe(true);
    expect(code).toContain("t = __sa_import_torch");
    expect(code).toContain("x = t.tensor([1])");
  });

  test("rewrites `import torch.nn as nn`", async () => {
    const { code, hasTorch } = await rewriteTorchImports(
      pyodide,
      "import torch.nn as nn\nx = nn.Linear(3, 2)\n",
    );
    expect(hasTorch).toBe(true);
    expect(code).toContain("nn = __sa_import_torch.nn");
    expect(code).toContain("x = nn.Linear(3, 2)");
  });

  test("rewrites `import torch.nn` (no alias)", async () => {
    const { code, hasTorch } = await rewriteTorchImports(
      pyodide,
      "import torch.nn\nx = torch.nn.Linear(3, 2)\n",
    );
    expect(hasTorch).toBe(true);
    expect(code).toContain("torch = __sa_import_torch");
    expect(code).toContain("x = torch.nn.Linear(3, 2)");
  });

  test("rewrites mix of bare import and from-import", async () => {
    const src =
      "import torch\nfrom torch.nn import Linear\nx = torch.tensor(1)\ny = Linear(3, 2)\n";
    const { code, hasTorch } = await rewriteTorchImports(pyodide, src);
    expect(hasTorch).toBe(true);
    expect(code).toContain("torch = __sa_import_torch");
    expect(code).toContain("Linear = __sa_import_torch.nn.Linear");
    expect(code).not.toMatch(/^import torch$/m);
    expect(code).not.toContain("from torch");
  });

  test("handles full Python body that py-slang cannot parse", async () => {
    const src = "from torch import tensor\nx = tensor([1, 2, 3]).tolist()\nprint(x)\n";
    const { code, hasTorch } = await rewriteTorchImports(pyodide, src);
    expect(hasTorch).toBe(true);
    expect(code).toContain("tensor = __sa_import_torch.tensor");
    expect(code).toContain("x = tensor([1, 2, 3]).tolist()");
  });
});
