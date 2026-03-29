import { BasicEvaluator, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import type { PyodideInterface } from "pyodide";
import { parse } from "../parser/parser-adapter";
import { analyze } from "../resolver/analysis";
import { getNonTorchImportRoots, rewriteTorchImports } from "./importAnalyzer";
import { loadPyodideGeneric } from "./loadPyodide";
import { loadTorch } from "./loadTorch";

export default abstract class PyodideEvaluator extends BasicEvaluator {
  protected pyodide: Promise<PyodideInterface>;
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

  protected abstract validateChunk(_chunk: string): void;

  async evaluateChunk(chunk: string): Promise<void> {
    this.validateChunk(chunk);

    const pyodide = await this.pyodide;

    // --- Use Python's ast module (via Pyodide) to detect and rewrite torch imports ---
    const { code, hasTorch } = await rewriteTorchImports(pyodide, chunk);

    if (hasTorch && !this.torchLoaded) {
      await loadTorch(pyodide);
      pyodide.globals.set("__sa_import_torch", pyodide.globals.get("torch"));
      this.torchLoaded = true;
    }

    // --- Install any other imported modules via micropip ---
    const otherRoots = await getNonTorchImportRoots(pyodide, chunk);
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

export class ChapterPyodideEvaluator extends PyodideEvaluator {
  private chapter: number;

  constructor(conductor: IRunnerPlugin, chapter: number) {
    super(conductor);
    this.chapter = chapter;
  }

  protected validateChunk(chunk: string): void {
    const script = chunk + "\n";
    const ast = parse(script);
    analyze(ast, script, this.chapter);
  }
}
