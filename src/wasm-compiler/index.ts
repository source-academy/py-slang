import { WatGenerator } from "@sourceacademy/wasm-util";
import wabt from "wabt";
import { Parser } from "../parser";
import { Tokenizer } from "../tokenizer";
import { BuilderGenerator } from "./builderGenerator";
import { ERROR_MAP } from "./constants";
import { libraryFunctions } from "./library";
import { MetacircularGenerator } from "./metacircularGenerator";

export type WasmExports = {
  main: () => [number, bigint];
  log: (tag: number, value: bigint) => void;
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
  "range_args",
  "break_statement",
  "continue_statement",
  "conditional_statement",
  // "block",
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

type WasmRunResult = {
  prints: string[];
  rawResult: null;
  renderedResult: null;
};

type WasmInteractiveRunResult = {
  prints: string[];
  rawResult: [number, bigint];
  renderedResult: string;
};

export async function compileToWasmAndRun(
  code: string,
  interactiveMode?: false,
): Promise<WasmRunResult>;
export async function compileToWasmAndRun(
  code: string,
  interactiveMode: true,
): Promise<WasmInteractiveRunResult>;
export async function compileToWasmAndRun(
  code: string,
  interactiveMode: boolean = false,
): Promise<WasmRunResult | WasmInteractiveRunResult> {
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

  const output: string[] = [];
  const capture = (value: string) => void output.push(value);

  const instantiated = await WebAssembly.instantiate(wasm, {
    console: {
      log: (value: bigint) => capture(value.toString()),
      log_complex: (real: number, imag: number) =>
        capture(`${real} ${imag >= 0 ? "+" : "-"} ${Math.abs(imag)}j`),
      log_bool: (value: bigint) =>
        capture(value === BigInt(0) ? "False" : "True"),
      log_string: (offset: number, length: number) =>
        capture(
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
        capture(
          `Closure (tag: ${tag}, arity: ${arity}, envSize: ${envSize}, parentEnv: ${parentEnv})`,
        ),
      log_none: () => capture("None"),
      log_error: (tag: number) => {
        throw new Error(Object.values(ERROR_MAP).at(tag) ?? "Unknown Error");
      },
      log_list: (pointer: number, length: number) => {
        if (!wasmExports) {
          throw new Error("WASM exports not initialised");
        }

        const renderedItems: string[] = [];
        const dataView = new DataView(memory.buffer, pointer, length * 12);

        for (let i = 0; i < length; i++) {
          const itemTag = dataView.getUint32(i * 12, true);
          const itemValue = dataView.getBigUint64(i * 12 + 4, true);
          wasmExports.log(itemTag, itemValue);

          const renderedItem = output.pop();
          if (renderedItem === undefined) {
            throw new Error(
              "List item logging did not produce a rendered value",
            );
          }
          renderedItems.push(renderedItem);
        }

        capture(`[${renderedItems.join(", ")}]`);
      },
    },
    metacircular: {
      tokenize: (offset: number, length: number) => {
        if (!wasmExports) throw new Error("WASM exports not initialised");

        const tokenizer = new Tokenizer(
          new TextDecoder("utf8").decode(
            new Uint8Array(memory.buffer, offset, length),
          ),
        );
        const tokens = tokenizer
          .scanEverything()
          .filter((x) => x.lexeme !== "");

        const encoder = new TextEncoder();
        const dataView = new DataView(memory.buffer);

        let heapPointer = wasmExports.getHeapPointer();
        const strings = tokens.map(({ lexeme }) => {
          if (!wasmExports) throw new Error("WASM exports not initialised");

          encoder
            .encode(lexeme)
            .forEach((byte, i) => dataView.setUint8(heapPointer + i, byte));

          const string = wasmExports.makeString(heapPointer, lexeme.length);

          heapPointer += lexeme.length;
          return string;
        });

        wasmExports.incrementHeapPointer(
          heapPointer - wasmExports.getHeapPointer(),
        );

        return strings.reduceRight(([tailTag, tailValue], [tag, value]) => {
          if (!wasmExports) throw new Error("WASM exports not initialised");

          const pair = wasmExports.makePair(
            tag,
            BigInt(value),
            tailTag,
            BigInt(tailValue),
          );
          return pair;
        }, wasmExports.makeNone());
      },

      parse: (offset: number, length: number) => {
        if (!wasmExports) {
          throw new Error("WASM exports not initialised");
        }

        const string = new TextDecoder("utf8").decode(
          new Uint8Array(memory.buffer, offset, length),
        );
        const tokenizer = new Tokenizer(string + "\n");
        const tokens = tokenizer.scanEverything();
        const pyParser = new Parser(string, tokens);
        const ast = pyParser.parse();

        const metacircularGenerator = new MetacircularGenerator(
          wasmExports,
          memory,
        );
        return metacircularGenerator.visit(ast);
      },
    },
    js: { memory },
  });

  wasmExports = instantiated.instance.exports as WasmExports;

  if (!interactiveMode) {
    wasmExports.main();
    return { prints: output, rawResult: null, renderedResult: null };
  }

  const rawResult = wasmExports.main();

  wasmExports.log(rawResult[0], rawResult[1]);
  const renderedResult = output.pop();
  if (renderedResult == null) {
    throw new Error("Main function did not produce any output");
  }

  return { prints: output, rawResult, renderedResult };
}
