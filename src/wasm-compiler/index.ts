import { WatGenerator } from "@sourceacademy/wasm-util";
import assert from "assert";
import wabt from "wabt";
import { Parser } from "../parser";
import { Tokenizer } from "../tokenizer";
import { BuilderGenerator } from "./builderGenerator";
import { ERROR_MAP } from "./constants";
import { libraryFunctions } from "./library";
import { MetacircularGenerator } from "./metacircularGenerator";

export type WasmExports = {
  main: () => [number, number];
  makeInt: (value: bigint) => [number, bigint];
  makeFloat: (value: number) => [number, bigint];
  makeBool: (value: number) => [number, bigint];
  makeString: (offset: number, length: number) => [number, bigint];
  makePair: (
    tag1: number,
    value1: bigint,
    tag2: number,
    value2: bigint,
  ) => [number, bigint];
  makeNone: () => [number, bigint];
  getHeapPointer: () => number;
  incrementHeapPointer: (amount: number) => void;
};
export const PARSE_TREE_STRINGS = [
  // node / construct tags
  "sequence",
  "assignment",
  "function_declaration",
  "return_statement",
  "while_loop",
  "for_loop",
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
  // operator / keyword tags
  "+",
  "-",
  "*",
  "/",
  "==",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
  "and",
  "or",
  "not",
] as const;

export async function compileToWasmAndRun(
  code: string,
  interactiveMode?: false,
): Promise<void>;
export async function compileToWasmAndRun(
  code: string,
  interactiveMode: true,
): Promise<[number, number]>;
export async function compileToWasmAndRun(
  code: string,
  interactiveMode: boolean = false,
): Promise<void | [number, number]> {
  const script = code + "\n";
  const tokenizer = new Tokenizer(script);
  const tokens = tokenizer.scanEverything();
  const pyParser = new Parser(script, tokens);
  const ast = pyParser.parse();

  const builderGenerator = new BuilderGenerator(
    [...PARSE_TREE_STRINGS],
    libraryFunctions,
    interactiveMode,
  );
  const watIR = builderGenerator.visit(ast);

  const watGenerator = new WatGenerator();
  const wat = watGenerator.visit(watIR);

  const w = await wabt();
  const wasm = w.parseWat("a", wat).toBinary({}).buffer as BufferSource;

  const memory = new WebAssembly.Memory({ initial: 1 });

  let wasmExports: WasmExports | null = null;

  const result = await WebAssembly.instantiate(wasm, {
    console: {
      log: console.log,
      log_complex: (real: number, imag: number) =>
        console.log(`${real} ${imag >= 0 ? "+" : "-"} ${Math.abs(imag)}j`),
      log_bool: (value: bigint) =>
        console.log(value === BigInt(0) ? "False" : "True"),
      log_string: (offset: number, length: number) =>
        console.log(
          new TextDecoder("utf8").decode(
            new Uint8Array(memory.buffer, offset, length),
          ),
        ),
      log_closure: (
        tag: number,
        arity: number,
        envSize: number,
        parentEnv: number,
      ) =>
        console.log(
          `Closure (tag: ${tag}, arity: ${arity}, envSize: ${envSize}, parentEnv: ${parentEnv})`,
        ),
      log_none: () => console.log("None"),
      log_error: (tag: number) => {
        throw new Error(Object.values(ERROR_MAP).at(tag) ?? "Unknown Error");
      },
      log_pair: () => console.log(),
      log_list: (pointer: number, length: number) => {
        console.log(`List at pointer ${pointer} with length ${length}:`);
        const listItems: number[] = [];
        const dataView = new DataView(memory.buffer, pointer, length * 12);
        for (let i = 0; i < length; i++) {
          listItems.push(dataView.getUint32(i * 12, true));
          listItems.push(Number(dataView.getBigUint64(i * 12 + 4, true)));
        }

        console.log("List: ", listItems);
      },
    },
    parse: {
      parse: (offset: number, length: number) => {
        const string = new TextDecoder("utf8").decode(
          new Uint8Array(memory.buffer, offset, length),
        );
        const tokenizer = new Tokenizer(string + "\n");
        const tokens = tokenizer.scanEverything();
        const pyParser = new Parser(string, tokens);
        const ast = pyParser.parse();

        if (!wasmExports) {
          throw new Error("WASM exports not initialised");
        }

        const metacircularGenerator = new MetacircularGenerator(
          wasmExports,
          memory,
        );
        return metacircularGenerator.visit(ast);
      },
    },
    js: { memory },
  });

  wasmExports = result.instance.exports as WasmExports;

  // run the exported main function
  assert(typeof wasmExports?.main === "function");

  return wasmExports.main() as [number, number];
}
