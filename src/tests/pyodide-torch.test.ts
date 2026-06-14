/**
 * Integration tests for the pyodide+torch pipeline.
 *
 * These tests load real pyodide and torch, so they are slow on first run
 * while pyodide downloads assets. They verify the full flow: parse → rewrite
 * imports → load torch → execute in pyodide.
 */

import { loadPyodide } from "pyodide";
import type { PyodideInterface } from "pyodide";
import * as torch from "@sourceacademy/torch";
import bridgeCode from "../pyodide/bridge.py";
import { rewriteTorchImports, resetHelperState } from "../pyodide/importAnalyzer";

let pyodide: PyodideInterface;

beforeAll(async () => {
  resetHelperState();
  pyodide = await loadPyodide({ fullStdLib: true });

  // Set up torch in pyodide (mirrors what loadTorch does)
  pyodide.globals.set("js_torch", torch);
  await pyodide.runPythonAsync(bridgeCode);
  pyodide.globals.set("__sa_import_torch", pyodide.globals.get("torch"));
}, 60_000);

async function runTorchCode(source: string): Promise<unknown> {
  const { code } = await rewriteTorchImports(pyodide, source);
  return pyodide.runPythonAsync(code);
}

/** Convert a pyodide result to a plain JS value. */
function toJS(result: unknown): unknown {
  if (result != null && typeof result === "object" && "toJs" in result) {
    return (result as { toJs: () => unknown }).toJs();
  }
  if (result != null && typeof result === "object" && "to_py" in result) {
    return (result as { to_py: () => unknown }).to_py();
  }
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("pyodide + torch integration", () => {
  test("from torch import tensor — create and read a tensor", async () => {
    const result = await runTorchCode(
      "from torch import tensor\nx = tensor([1, 2, 3])\nx.tolist()\n",
    );
    const val = toJS(result);
    expect(val).toEqual([1, 2, 3]);
  });

  test("from torch import zeros — creation function", async () => {
    const result = await runTorchCode("from torch import zeros\nx = zeros(3)\nx.tolist()\n");
    const val = toJS(result);
    expect(val).toEqual([0, 0, 0]);
  });

  test("from torch.nn import Linear as L — submodule with alias", async () => {
    // Just verify it doesn't throw
    await runTorchCode(
      "from torch.nn import Linear as L\nfrom torch import zeros\nlayer = L(2, 3)\nresult = layer(zeros(2))\nresult.shape\n",
    );
  });

  test("tensor arithmetic", async () => {
    const result = await runTorchCode(
      "from torch import tensor\na = tensor([1, 2, 3])\nb = tensor([4, 5, 6])\n(a + b).tolist()\n",
    );
    const val = toJS(result);
    expect(val).toEqual([5, 7, 9]);
  });

  test("autograd — backward pass", async () => {
    const result = await runTorchCode(`from torch import tensor
x = tensor([2.0], True)
y = x * x
y.backward()
x.grad.tolist()
`);
    const val = toJS(result);
    expect(val).toEqual([4.0]);
  });
});
