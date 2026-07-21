import misc from "../../stdlib/misc";
import { compileScriptToWasmBinary } from "./compiler";
import { createHostImports, HostRuntimeState } from "./hostImports";
import { createModuleCall, createModuleGet, getJspi, hostrefDisplay } from "./moduleInterop";
import {
  type CompileOptions,
  type WasmExports,
  type WasmInteractiveRunResult,
  type WasmRunResult,
  createCompileFailureResult,
} from "./types";

/** Matches one `from <dotted-name> import ...` line (the grammar's
 * import-stmt production is always exactly one line — see
 * docs/specs/python_3_bnf.tex's `import-stmt`). */
const IMPORT_LINE_RE = /^\s*from\s+\S+\s+import\s+.+$/;

/**
 * Splits `code`'s *leading* run of import statements (and any blank lines
 * among them) from the rest, so callers can place them before a prepended
 * prelude. The grammar requires every import statement to appear before any
 * other statement in the whole compiled program (`program ::= import-stmt...
 * block` — docs/specs/python_3_bnf.tex), so a chunk that compiles at all on
 * its own can only ever have its imports at the very top; this is a
 * line-based scan rather than a real parse, but it's checking for exactly
 * that same leading-only shape, not a looser heuristic.
 */
function splitLeadingImports(code: string): { imports: string; rest: string } {
  const lines = code.split("\n");
  let i = 0;
  while (i < lines.length && (lines[i].trim() === "" || IMPORT_LINE_RE.test(lines[i]))) {
    i++;
  }
  return { imports: lines.slice(0, i).join("\n"), rest: lines.slice(i).join("\n") };
}

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

  // A chunk's own `from X import y` must compile as one of the program's
  // leading import statements (see splitLeadingImports' doc comment), which
  // means it has to precede the prepended prelude here, not follow the
  // student's code the way `code` alone would put it.
  const { imports, rest } = splitLeadingImports(code);
  const script = imports + "\n" + prelude + "\n" + rest + "\n";

  const errors: Error[] = [];
  let wasmExports: WasmExports | null = null;
  let output: string[] = [];
  let rawOutputs: [number, bigint][] = [];
  let debugFunctions: Pick<WasmExports, "peekShadowStack" | "getListElement"> | null = null;

  const prepared = options.moduleBindings;
  const jspi = getJspi();

  try {
    const compileResult = await compileScriptToWasmBinary(script, interactiveMode, options, groups);
    if (!compileResult.ok) {
      return createCompileFailureResult(compileResult.errors);
    }

    const memory = new WebAssembly.Memory({ initial: options.pageCount ?? 1 });
    const runtimeState: HostRuntimeState = { output: [], rawOutputs: [], wasmExports: null };

    // Imported-module support (see moduleInterop.ts). The modules.get/
    // modules.call imports are declared unconditionally in the compiled WAT,
    // so the import object must always carry them; without prepared bindings
    // they can never fire (FromImport already failed compilation), and the
    // stubs below only make that invariant loud. modules.call is async on
    // the JS side, so it is only truly callable under JSPI — on runtimes
    // without it, imported module *values* still work but calling a module
    // function raises a clear error.
    const getExports = () => runtimeState.wasmExports;
    const moduleImports = {
      get: prepared
        ? createModuleGet(memory, getExports, prepared)
        : () => {
            throw new Error(
              "Module imports are not supported here (no module bindings were supplied)",
            );
          },
      call:
        prepared && jspi
          ? new jspi.Suspending(
              createModuleCall(memory, getExports, compileResult.dataEnd, prepared),
            )
          : () => {
              throw new Error(
                "Calling an imported module function requires JS Promise Integration (JSPI), " +
                  "which this runtime does not support",
              );
            },
    };

    const instantiated = await WebAssembly.instantiate(compileResult.wasm, {
      ...createHostImports(memory, runtimeState, index => hostrefDisplay(prepared, Number(index))),
      modules: moduleImports as WebAssembly.ModuleImports,
    });

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

  // A main() whose imports can suspend (JSPI) must be entered through
  // `promising`, which turns the activation into a promise; without module
  // bindings (or without JSPI) it is the plain synchronous export, and the
  // awaits below are no-ops on its already-settled value.
  const runMain: () => [number, bigint] | Promise<[number, bigint]> =
    prepared && jspi ? jspi.promising(wasmExports.main) : wasmExports.main;

  if (!interactiveMode) {
    try {
      await runMain();
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
    return {
      prints: output,
      rawOutputs,
      errors,
      rawResult: null,
      renderedResult: null,
      debugFunctions,
    };
  }

  const rawResult = await runMain();

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
