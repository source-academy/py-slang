import { WatGenerator, type WasmInstruction } from "@sourceacademy/wasm-util";
import wabt from "wabt";
import { parse } from "../parser";
import pythonLexer from "../parser/lexer";
import { toAstToken } from "../parser/token-bridge";
import { BuilderGenerator } from "./builderGenerator";
import { ERROR_MAP } from "./constants";
import { libraryFunctions } from "./library";
import { MetacircularGenerator } from "./metacircularGenerator";

export type WasmExports = {
  main: () => [number, bigint];
  collect: () => void;
  log: (tag: number, value: bigint) => void;
  makeInt: (value: bigint) => [number, bigint];
  makeFloat: (value: number) => [number, bigint];
  makeBool: (value: number) => [number, bigint];
  makeString: (offset: number, length: number) => [number, bigint];
  makePair: (tag1: number, value1: bigint, tag2: number, value2: bigint) => [number, bigint];
  makeNone: () => [number, bigint];
  malloc: (amount: number) => number;
  peekShadowStack: (index: number) => [number, bigint];
};

export type IrPass = (ir: WasmInstruction) => WasmInstruction;

export type CompileOptions = {
  irPasses?: IrPass[];
};

function applyIrPasses(ir: WasmInstruction, passes: IrPass[] = []): WasmInstruction {
  return passes.reduce((acc, pass) => pass(acc), ir);
}

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
  getStackAt: (index: number) => [number, bigint];
  rawOutputs: [number, bigint][];
};

type WasmRunResult = BaseWasmRunResult & {
  rawResult: null;
  renderedResult: null;
};

type WasmInteractiveRunResult = BaseWasmRunResult & {
  rawResult: [number, bigint];
  renderedResult: string;
};

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
  const pageCount = 1;

  const script = code + "\n";
  const ast = parse(script);

  const builderGenerator = new BuilderGenerator(
    [...PARSE_TREE_STRINGS],
    libraryFunctions,
    interactiveMode,
    pageCount,
  );
  const watIR = applyIrPasses(builderGenerator.visit(ast), options.irPasses ?? []);

  const watGenerator = new WatGenerator();
  const wat = watGenerator.visit(watIR);

  const w = await wabt();
  const wasm = w.parseWat("a", wat).toBinary({}).buffer as BufferSource;

  const memory = new WebAssembly.Memory({ initial: pageCount });

  let wasmExports: WasmExports | null = null;

  const output: string[] = [];
  const capture = (value: string) => void output.push(value);

  const rawOutputs: [number, bigint][] = [];
  const captureRaw = (tag: number, value: bigint) => void rawOutputs.push([tag, value]);

  const instantiated = await WebAssembly.instantiate(wasm, {
    console: {
      log: (value: bigint) => capture(value.toString()),
      log_complex: (real: number, imag: number) =>
        capture(real === 0 ? `${imag}j` : `${real} ${imag >= 0 ? "+" : "-"} ${Math.abs(imag)}j`),
      log_bool: (value: bigint) => capture(value === 0n ? "False" : "True"),
      log_string: (offset: number, length: number) =>
        capture(new TextDecoder("utf8").decode(new Uint8Array(memory.buffer, offset, length))),
      log_closure: (tag: number, arity: number, envSize: number, parentEnv: number) =>
        capture(
          `Closure (tag: ${tag}, arity: ${arity}, envSize: ${envSize}, parentEnv: ${parentEnv})`,
        ),
      log_none: () => capture("None"),
      log_error: (tag: number) => {
        throw new Error(Object.values(ERROR_MAP).at(tag) ?? "Unknown Error");
      },
      log_list: (pointer: number, length: number) => {
        if (!wasmExports) throw new Error("WASM exports not initialised");

        const renderedItems: string[] = [];
        const dataView = new DataView(memory.buffer, pointer, length * 12);

        for (let i = 0; i < length; i++) {
          const itemTag = dataView.getUint32(i * 12, true);
          const itemValue = dataView.getBigUint64(i * 12 + 4, true);
          wasmExports.log(itemTag, itemValue);

          const renderedItem = output.pop();
          if (renderedItem === undefined) {
            throw new Error("List item logging did not produce a rendered value");
          }
          renderedItems.push(renderedItem);
        }

        capture(`[${renderedItems.join(", ")}]`);
      },
      log_raw: (tag: number, value: bigint) => captureRaw(tag, value),
    },
    metacircular: {
      tokenize: (offset: number, length: number) => {
        if (!wasmExports) throw new Error("WASM exports not initialised");
        const { malloc, makeString, makePair, makeNone } = wasmExports;

        pythonLexer.reset(
          new TextDecoder("utf8").decode(new Uint8Array(memory.buffer, offset, length)),
        );
        const encoder = new TextEncoder();
        const dataView = new DataView(memory.buffer);

        return Array.from(pythonLexer)
          .map(t => toAstToken(t))
          .map(({ lexeme }) => {
            const heapPointer = malloc(lexeme.length);
            encoder.encode(lexeme).forEach((byte, i) => dataView.setUint8(heapPointer + i, byte));
            return makeString(heapPointer, lexeme.length);
          })
          .reduceRight((tail, [tag, value]) => makePair(tag, value, tail[0], tail[1]), makeNone());
      },

      parse: (offset: number, length: number) => {
        if (!wasmExports) throw new Error("WASM exports not initialised");

        const string = new TextDecoder("utf8").decode(
          new Uint8Array(memory.buffer, offset, length),
        );
        const ast = parse(string + "\n");

        const metacircularGenerator = new MetacircularGenerator(wasmExports, memory);
        return metacircularGenerator.visit(ast);
      },
    },
    js: { memory },
  });

  wasmExports = instantiated.instance.exports as WasmExports;

  const getStackAt = (index: number) => {
    if (!wasmExports) throw new Error("WASM exports not initialised");
    return wasmExports.peekShadowStack(index);
  };

  if (!interactiveMode) {
    wasmExports.main();
    return { prints: output, rawOutputs, rawResult: null, renderedResult: null, getStackAt };
  }

  const rawResult = wasmExports.main();

  wasmExports.log(rawResult[0], rawResult[1]);
  const renderedResult = output.pop();
  if (renderedResult == null) {
    throw new Error("Main function did not produce any output");
  }

  return { prints: output, rawOutputs, rawResult, renderedResult, getStackAt };
}
