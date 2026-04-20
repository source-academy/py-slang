import { wasm, WasmFunction, WasmInstruction } from "@sourceacademy/wasm-util";
import { IrPass } from ".";
import { COLLECT_FX } from "./runtime";

type InsertInArrayOptions = {
  matchIndex?: number;
  before?: boolean;
};

export function insertInArray(
  arrayLocator: (node: unknown) => false | unknown[],
  instructionLocator: (array: unknown) => boolean,
  insert: WasmInstruction[],
  { matchIndex = 0, before = false }: InsertInArrayOptions = {},
): IrPass {
  return ir => {
    const dfs = (node: unknown): unknown => {
      if (!node || typeof node !== "object") return;

      const array = arrayLocator(node);
      if (array) {
        const matches = array.filter(instructionLocator);
        if (matches.length > 0) {
          // Insert instructions after the first match
          const index = array.indexOf(matches[matchIndex]);
          array.splice(index + (before ? 0 : 1), 0, ...insert);
          return;
        }
      } else {
        for (const value of Object.values(node)) {
          if (Array.isArray(value)) {
            for (const item of value) dfs(item);
          } else {
            dfs(value);
          }
        }
      }
    };
    dfs(ir);
    return ir;
  };
}

export const disableGcIrPass: IrPass = ir => {
  if (
    ir != null &&
    typeof ir === "object" &&
    "op" in ir &&
    "funcs" in ir &&
    ir.op === "module" &&
    Array.isArray(ir.funcs)
  ) {
    ir.funcs = ir.funcs.map(fn => {
      if (isFunctionOfName(fn, COLLECT_FX)) {
        return { ...fn, body: [wasm.nop()] };
      }
      return fn;
    });
  }

  return ir;
};

export function isFunctionCall(
  instruction: unknown,
  functionName: string | WasmFunction,
): instruction is { function: string; arguments: unknown[] } {
  return (
    instruction != null &&
    typeof instruction === "object" &&
    "function" in instruction &&
    "arguments" in instruction &&
    Array.isArray(instruction.arguments) &&
    instruction.function === (typeof functionName === "string" ? functionName : functionName.name)
  );
}

export function isFunctionOfName(
  instruction: unknown,
  functionName: string | WasmFunction,
): instruction is { name: string; body: unknown[] } {
  return (
    instruction != null &&
    typeof instruction === "object" &&
    "name" in instruction &&
    "body" in instruction &&
    Array.isArray(instruction.body) &&
    instruction.name === (typeof functionName === "string" ? functionName : functionName.name)
  );
}

export function isIfInstruction(
  instruction: unknown,
): instruction is { op: "if"; thenBody: unknown[] } {
  return (
    instruction != null &&
    typeof instruction === "object" &&
    "op" in instruction &&
    instruction.op === "if" &&
    "thenBody" in instruction &&
    Array.isArray(instruction.thenBody)
  );
}
