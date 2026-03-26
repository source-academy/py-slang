import { BasicEvaluator, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import type { PyodideInterface } from "pyodide";
import { loadPyodideGeneric } from "./loadPyodide";
import { loadTorch } from "./loadTorch";
import { rewriteTorchImports, getNonTorchImportRoots } from "./importAnalyzer";

export default class PyodideEvaluator extends BasicEvaluator {
  private pyodide: Promise<PyodideInterface>;
  private torchLoaded = false;

  constructor(conductor: IRunnerPlugin) {
    super(conductor);
    this.pyodide = loadPyodideGeneric().then(async pyodide => {
      await pyodide.loadPackage("micropip");
      await pyodide.setStdout({
        batched: (output: string) => {
          this.conductor.sendOutput(output);
        },
      });
      return pyodide;
    });
  }

  async evaluateChunk(chunk: string): Promise<void> {
    const pyodide = await this.pyodide;

    // --- Use py-slang's parser to detect and rewrite torch imports ---
    const { code, hasTorch } = rewriteTorchImports(chunk);

    if (hasTorch && !this.torchLoaded) {
      await loadTorch(pyodide);
      pyodide.globals.set("__sa_import_torch", pyodide.globals.get("torch"));
      this.torchLoaded = true;
    }

    // --- Install any other imported modules via micropip ---
    const otherRoots = getNonTorchImportRoots(chunk);
    if (otherRoots.size > 0) {
      const modulesArray = Array.from(otherRoots);
      const installerCode = `
import importlib, micropip
mods = ${JSON.stringify(modulesArray)}
missing = []
for m in mods:
    try:
        importlib.import_module(m)
    except Exception:
        missing.append(m)
if missing:
    await micropip.install(missing)
`;
      await pyodide.runPythonAsync(installerCode);
    }

    // --- Execute the (possibly rewritten) code ---
    const output = await pyodide.runPythonAsync(code);
    this.conductor.sendOutput(output);
  }
}
