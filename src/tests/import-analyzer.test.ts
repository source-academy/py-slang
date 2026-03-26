import {
  detectTorchImports,
  getNonTorchImportRoots,
  rewriteTorchImports,
} from "../pyodide/importAnalyzer";

// ---------------------------------------------------------------------------
// detectTorchImports
// ---------------------------------------------------------------------------
describe("detectTorchImports", () => {
  test("detects `from torch import tensor`", () => {
    const result = detectTorchImports("from torch import tensor\nx = 1\n");
    expect(result).toHaveLength(1);
    expect(result[0].module).toBe("torch");
    expect(result[0].names).toEqual([{ name: "tensor", alias: null }]);
  });

  test("detects `from torch.nn import Linear as L`", () => {
    const result = detectTorchImports("from torch.nn import Linear as L\nx = 1\n");
    expect(result).toHaveLength(1);
    expect(result[0].module).toBe("torch.nn");
    expect(result[0].names).toEqual([{ name: "Linear", alias: "L" }]);
  });

  test("detects multiple names", () => {
    const result = detectTorchImports("from torch import tensor, zeros, ones\nx = 1\n");
    expect(result).toHaveLength(1);
    expect(result[0].names).toEqual([
      { name: "tensor", alias: null },
      { name: "zeros", alias: null },
      { name: "ones", alias: null },
    ]);
  });

  test("detects multiple torch import statements", () => {
    const src = "from torch import tensor\nfrom torch.nn import Linear\nx = 1\n";
    const result = detectTorchImports(src);
    expect(result).toHaveLength(2);
    expect(result[0].module).toBe("torch");
    expect(result[1].module).toBe("torch.nn");
  });

  test("ignores non-torch imports", () => {
    const result = detectTorchImports("from math import sqrt\nx = 1\n");
    expect(result).toHaveLength(0);
  });

  test("returns empty for code with no imports", () => {
    const result = detectTorchImports("x = 1\n");
    expect(result).toHaveLength(0);
  });

  test("works when body uses full Python syntax unsupported by py-slang", () => {
    const result = detectTorchImports("from torch import tensor\nx = tensor([1,2]).tolist()\n");
    expect(result).toHaveLength(1);
    expect(result[0].module).toBe("torch");
  });
});

// ---------------------------------------------------------------------------
// getNonTorchImportRoots
// ---------------------------------------------------------------------------
describe("getNonTorchImportRoots", () => {
  test("returns non-torch module roots", () => {
    const src = "from math import sqrt\nfrom torch import tensor\nfrom numpy import array\nx = 1\n";
    const roots = getNonTorchImportRoots(src);
    expect(roots).toEqual(new Set(["math", "numpy"]));
  });

  test("returns empty set when only torch imports exist", () => {
    const roots = getNonTorchImportRoots("from torch import tensor\nx = 1\n");
    expect(roots).toEqual(new Set());
  });

  test("extracts root from dotted module name", () => {
    const roots = getNonTorchImportRoots("from os.path import join\nx = 1\n");
    expect(roots).toEqual(new Set(["os"]));
  });
});

// ---------------------------------------------------------------------------
// rewriteTorchImports
// ---------------------------------------------------------------------------
describe("rewriteTorchImports", () => {
  test("rewrites `from torch import tensor`", () => {
    const { code, hasTorch } = rewriteTorchImports("from torch import tensor\nx = tensor(1)\n");
    expect(hasTorch).toBe(true);
    expect(code).toContain("tensor = __sa_import_torch.tensor");
    expect(code).not.toContain("from torch");
    expect(code).toContain("x = tensor(1)");
  });

  test("rewrites `from torch.nn import Linear as L`", () => {
    const { code, hasTorch } = rewriteTorchImports(
      "from torch.nn import Linear as L\nx = L(3, 2)\n",
    );
    expect(hasTorch).toBe(true);
    expect(code).toContain("L = __sa_import_torch.nn.Linear");
    expect(code).toContain("x = L(3, 2)");
  });

  test("rewrites multiple names", () => {
    const { code, hasTorch } = rewriteTorchImports("from torch import tensor, zeros\nx = 1\n");
    expect(hasTorch).toBe(true);
    expect(code).toContain("tensor = __sa_import_torch.tensor");
    expect(code).toContain("zeros = __sa_import_torch.zeros");
  });

  test("leaves non-torch code unchanged", () => {
    const src = "x = 1\n";
    const { code, hasTorch } = rewriteTorchImports(src);
    expect(hasTorch).toBe(false);
    expect(code).toBe(src);
  });

  test("preserves non-torch imports", () => {
    const src = "from math import sqrt\nfrom torch import tensor\nx = sqrt(tensor(4))\n";
    const { code, hasTorch } = rewriteTorchImports(src);
    expect(hasTorch).toBe(true);
    expect(code).toContain("from math import sqrt");
    expect(code).toContain("tensor = __sa_import_torch.tensor");
  });

  test("rewrites deeply nested module path", () => {
    const { code } = rewriteTorchImports("from torch.nn.functional import relu\nx = relu(1)\n");
    expect(code).toContain("relu = __sa_import_torch.nn.functional.relu");
  });

  test("handles full Python body that py-slang cannot parse", () => {
    const src = "from torch import tensor\nx = tensor([1, 2, 3]).tolist()\nprint(x)\n";
    const { code, hasTorch } = rewriteTorchImports(src);
    expect(hasTorch).toBe(true);
    expect(code).toContain("tensor = __sa_import_torch.tensor");
    expect(code).toContain("x = tensor([1, 2, 3]).tolist()");
  });
});
