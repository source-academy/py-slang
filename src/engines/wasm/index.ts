import misc from "../../stdlib/misc";
import { compileScriptToWasmBinary } from "./compiler";
import { createHostImports, HostRuntimeState } from "./hostImports";
import {
  type CompileOptions,
  type WasmExports,
  type WasmInteractiveRunResult,
  type WasmRunResult,
  createCompileFailureResult,
} from "./types";

export async function compileToWasmAndRun(
  code: string,
  interactiveMode?: false,
  options?: CompileOptions,
): Promise<WasmRunResult>;
export async function compileToWasmAndRun(
  code: string,
  interactiveMode: true,
  options?: CompileOptions,
): Promise<WasmInteractiveRunResult>;
export async function compileToWasmAndRun(
  code: string,
  interactiveMode: boolean = false,
  options: CompileOptions = {},
): Promise<WasmRunResult | WasmInteractiveRunResult> {
  const groups = [...(options.groups ?? []), misc];
  const prelude = groups.map(group => group.prelude).join("\n");

  const script = prelude + "\n" + code + "\n";

  const errors: Error[] = [];
  let wasmExports: WasmExports | null = null;
  let output: string[] = [];
  let rawOutputs: [number, bigint][] = [];
  let debugFunctions: Pick<WasmExports, "peekShadowStack" | "getListElement"> | null = null;

  try {
    const compileResult = await compileScriptToWasmBinary(script, interactiveMode, options, groups);
    if (!compileResult.ok) {
      return createCompileFailureResult(compileResult.errors);
    }

    const memory = new WebAssembly.Memory({ initial: options.pageCount ?? 1 });
    const runtimeState: HostRuntimeState = { output: [], rawOutputs: [], wasmExports: null };
    const instantiated = await WebAssembly.instantiate(
      compileResult.wasm,
      createHostImports(memory, runtimeState),
    );

    runtimeState.wasmExports = instantiated.instance.exports as WasmExports;
    ({ wasmExports, output, rawOutputs } = runtimeState);

    if (!wasmExports) throw new Error("WASM exports not found after instantiation");
    debugFunctions = wasmExports;
  } catch (error) {
    if (error instanceof Error) {
      errors.push(error);
      return createCompileFailureResult(errors);
    }
    throw error;
  }

  if (!interactiveMode) {
    wasmExports.main();
    return {
      prints: output,
      rawOutputs,
      errors,
      rawResult: null,
      renderedResult: null,
      debugFunctions,
    };
  }

  const rawResult = wasmExports.main();

  wasmExports.log(rawResult[0], rawResult[1]);
  const renderedResult = output.pop();
  if (renderedResult == null) {
    throw new Error("Main function did not produce any output");
  }

  return {
    prints: output,
    rawOutputs,
    errors,
    rawResult,
    renderedResult,
    debugFunctions,
  };
}
