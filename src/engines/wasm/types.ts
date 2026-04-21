import type { WasmInstruction } from "@sourceacademy/wasm-util";
import { Group } from "../../stdlib/utils";

export type WasmExports = {
  main: () => [number, bigint];
  collect: () => void;
  log: (tag: number, value: bigint) => void;
  makeInt: (value: bigint) => [number, bigint];
  makeFloat: (value: number) => [number, bigint];
  makeComplex: (real: number, imag: number) => [number, bigint];
  makeBool: (value: number) => [number, bigint];
  makeString: (offset: number, length: number) => [number, bigint];
  makePair: (tag1: number, value1: bigint, tag2: number, value2: bigint) => [number, bigint];
  makeNone: () => [number, bigint];
  malloc: (amount: number) => number;
  peekShadowStack: (index: number) => [number, bigint];
  getListElement: (listTag: number, listValue: bigint, index: number) => [number, bigint];
};

export type IrPass = (ir: WasmInstruction) => WasmInstruction;

export type CompileOptions = {
  irPasses?: IrPass[];
  pageCount?: number;
  disableGC?: boolean;

  chapter?: number;
  groups?: Group[];
};

export const PARSE_TREE_STRINGS = [
  // node / construct tags
  "sequence",
  "assignment",
  "function_declaration",
  "return_statement",
  "while_loop",
  "for_loop",
  "range_args",
  "break_statement",
  "continue_statement",
  "conditional_statement",
  "block",
  "object_assignment",
  "literal",
  "name",
  "logical_composition",
  "binary_operator_combination",
  "unary_operator_combination",
  "application",
  "lambda_expression",
  "conditional_expression",
  "object_access",
  "list_expression",
  "pass_statement",
  "nonlocal_declaration",
  // operator / keyword tags
  '"+"',
  '"-"',
  '"*"',
  '"/"',
  '"=="',
  '"!="',
  '"<"',
  '"<="',
  '">"',
  '">="',
  '"and"',
  '"or"',
  '"-unary"',
  '"not"',
] as const;

type BaseWasmRunResult = {
  prints: string[];
  rawOutputs: [number, bigint][];
  errors: Error[];

  debugFunctions: Pick<WasmExports, "peekShadowStack" | "getListElement">;
};

export type WasmRunResult = BaseWasmRunResult & {
  rawResult: null;
  renderedResult: null;
};

export type WasmInteractiveRunResult = BaseWasmRunResult & {
  rawResult: [number, bigint];
  renderedResult: string;
};

export function createCompileFailureResult(
  errors: Error[],
): WasmRunResult | WasmInteractiveRunResult {
  return {
    prints: [],
    rawOutputs: [],
    errors,
    rawResult: null,
    renderedResult: null,
    debugFunctions: {
      peekShadowStack: () => {
        throw new Error("Debug functions not initialised");
      },
      getListElement: () => {
        throw new Error("Debug functions not initialised");
      },
    },
  };
}
