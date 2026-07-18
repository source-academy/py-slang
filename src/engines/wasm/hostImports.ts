import { parse } from "../../parser";
import pythonLexer from "../../parser/lexer";
import { toAstToken } from "../../parser/token-bridge";
import { MetacircularGenerator } from "./metacircularGenerator";
import { ERROR_MAP, GC_OBJECT_HEADER_SIZE } from "./runtime";
import type { WasmExports } from "./types";

export type HostRuntimeState = {
  output: string[];
  rawOutputs: [number, bigint][];
  wasmExports: WasmExports | null;
};

export function createHostImports(memory: WebAssembly.Memory, runtime: HostRuntimeState) {
  const capture = (value: string) => {
    runtime.output.push(value);
  };
  const captureRaw = (tag: number, value: bigint) => {
    runtime.rawOutputs.push([tag, value]);
  };

  return {
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
        if (!runtime.wasmExports) throw new Error("WASM exports not initialised");

        const renderedItems: string[] = [];
        const dataView = new DataView(memory.buffer, pointer, length * 12);

        for (let i = 0; i < length; i++) {
          const itemTag = dataView.getUint32(i * 12, true);
          const itemValue = dataView.getBigUint64(i * 12 + 4, true);
          runtime.wasmExports.log(itemTag, itemValue);

          const renderedItem = runtime.output.pop();
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
        if (!runtime.wasmExports) throw new Error("WASM exports not initialised");
        const { malloc, makeString, makePair, makeNone } = runtime.wasmExports;

        pythonLexer.reset(
          new TextDecoder("utf8").decode(new Uint8Array(memory.buffer, offset, length)),
        );
        const encoder = new TextEncoder();
        const dataView = new DataView(memory.buffer);

        return Array.from(pythonLexer)
          .map(t => toAstToken(t))
          .map(({ lexeme }) => {
            const bytes = encoder.encode(lexeme);
            const heapPointer = malloc(bytes.length + GC_OBJECT_HEADER_SIZE);
            for (let i = 0; i < GC_OBJECT_HEADER_SIZE; i++) {
              dataView.setUint8(heapPointer + i, 0);
            }
            bytes.forEach((byte, i) =>
              dataView.setUint8(heapPointer + GC_OBJECT_HEADER_SIZE + i, byte),
            );
            return makeString(heapPointer, bytes.length);
          })
          .reduceRight((tail, [tag, value]) => makePair(tag, value, tail[0], tail[1]), makeNone());
      },

      parse: (offset: number, length: number) => {
        if (!runtime.wasmExports) throw new Error("WASM exports not initialised");

        const source = new TextDecoder("utf8").decode(
          new Uint8Array(memory.buffer, offset, length),
        );
        const ast = parse(source + "\n");

        const metacircularGenerator = new MetacircularGenerator(runtime.wasmExports, memory);
        return metacircularGenerator.visit(ast);
      },
    },
    js: { memory },
  };
}
