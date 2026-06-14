import type { PyodideInterface } from "pyodide";
import * as torch from "@sourceacademy/torch";
import bridgeCode from "./bridge.py";

/**
 * Loads the torch library into Pyodide by exposing the JS torch object
 * and running bridge.py to set up the Python-side `torch` module.
 *
 * After this call, `pyodide.globals.get("torch")` is the usable torch module.
 */
export async function loadTorch(pyodide: PyodideInterface): Promise<void> {
  pyodide.globals.set("js_torch", torch);

  await pyodide.runPythonAsync(bridgeCode);

  const hasTorch = pyodide.runPython("'torch' in globals()");
  if (!hasTorch) {
    throw new Error("torch not found in globals after running bridge.py");
  }
}
