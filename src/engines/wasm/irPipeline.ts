import type { WasmInstruction } from "@sourceacademy/wasm-util";
import type { IrPass } from "./types";

function cloneIr<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => cloneIr(item)) as T;
  }

  if (value != null && typeof value === "object") {
    const cloned: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      cloned[key] = cloneIr(item);
    }
    return cloned as T;
  }

  return value;
}

export function applyIrPasses(ir: WasmInstruction, passes: IrPass[] = []): WasmInstruction {
  // IR nodes include shared function templates; clone first so test/debug passes stay isolated.
  const isolatedIr = cloneIr(ir);
  return passes.reduce((acc, pass) => pass(acc), isolatedIr);
}
