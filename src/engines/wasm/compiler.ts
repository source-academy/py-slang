import { WatGenerator } from "@sourceacademy/wasm-util";
import wabt from "wabt";
import { parse } from "../../parser";
import { analyze } from "../../resolver";
import { Group } from "../../stdlib/utils";
import { BuilderGenerator } from "./builderGenerator";
import { disableGcIrPass } from "./irHelpers";
import { applyIrPasses } from "./irPipeline";
import { makeLibraryFunctions } from "./library";
import { PARSE_TREE_STRINGS, type CompileOptions, type IrPass } from "./types";

export type CompileToBinaryResult =
  | { ok: true; wasm: BufferSource }
  | { ok: false; errors: Error[] };

export async function compileScriptToWasmBinary(
  script: string,
  interactiveMode: boolean,
  options: CompileOptions,
  groups: Group[],
): Promise<CompileToBinaryResult> {
  const ast = parse(script);
  const analysisErrors = analyze(ast, script, options.chapter ?? 4, groups);

  if (analysisErrors.length > 0) {
    return { ok: false, errors: analysisErrors };
  }

  const builderGenerator = new BuilderGenerator(
    [...PARSE_TREE_STRINGS],
    makeLibraryFunctions(groups),
    interactiveMode,
    options.pageCount ?? 1,
  );
  const passes: IrPass[] = [
    ...(options.irPasses ?? []),
    ...(options.disableGC ? [disableGcIrPass] : []),
  ];
  const watIR = applyIrPasses(builderGenerator.visit(ast), passes);

  const watGenerator = new WatGenerator();
  const wat = watGenerator.visit(watIR);

  const w = await wabt();
  const wasm = w.parseWat("a", wat).toBinary({}).buffer as BufferSource;

  return { ok: true, wasm };
}
