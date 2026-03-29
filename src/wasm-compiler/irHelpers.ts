import { WasmFunction, WasmInstruction } from "@sourceacademy/wasm-util";
import { IrPass } from ".";

export function insertInArray(
  arrayLocator: (node: unknown) => false | unknown[],
  instructionLocator: (array: unknown) => boolean,
  insert: WasmInstruction[],
  matchIndex = 0,
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
          array.splice(index + 1, 0, ...insert);
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

export function isFunctionOfName(
  instruction: unknown,
  name: string | WasmFunction,
): instruction is { function: string; arguments: unknown[] } {
  return (
    instruction != null &&
    typeof instruction === "object" &&
    "function" in instruction &&
    "arguments" in instruction &&
    Array.isArray(instruction.arguments) &&
    instruction.function === (typeof name === "string" ? name : name.name)
  );
}
