import { parse } from "../../parser";
import pythonLexer from "../../parser/lexer";
import { toAstToken } from "../../parser/token-bridge";
import { pythonMod } from "../cse/utils";
import { PyComplexNumber } from "../../types/value-types";
import { escape, toPythonFloat } from "../../stdlib/utils";
import { MetacircularGenerator } from "./metacircularGenerator";
import { ARITHMETIC_OP_TAG, ERROR_MAP, GC_OBJECT_HEADER_SIZE, TYPE_TAG } from "./runtime";
import type { WasmExports } from "./types";

/** Encodes `text` as UTF-8 into freshly `malloc`'d WASM memory and tags it
 * as a string value — the allocation half of what `str()`/`repr()` (see the
 * `stringify` host imports below) and `tokenize` both need: computing text
 * on the JS side, then handing a real WASM value back to the caller.
 * Mirrors `tokenize`'s own inline version of this exact sequence. */
function allocateWasmString(
  wasmExports: WasmExports,
  memory: WebAssembly.Memory,
  text: string,
): [number, bigint] {
  const bytes = new TextEncoder().encode(text);
  const heapPointer = wasmExports.malloc(bytes.length + GC_OBJECT_HEADER_SIZE);
  const dataView = new DataView(memory.buffer);
  for (let i = 0; i < GC_OBJECT_HEADER_SIZE; i++) {
    dataView.setUint8(heapPointer + i, 0);
  }
  bytes.forEach((byte, i) => dataView.setUint8(heapPointer + GC_OBJECT_HEADER_SIZE + i, byte));
  return wasmExports.makeString(heapPointer, bytes.length);
}

/** Decodes a (tag, val) operand pair into the JS numeric representation
 * arith.ext's host-side computation works with: an int stays a bigint, a
 * float's bit-reinterpreted i64 is read back out as a JS number, and a
 * complex operand's real/imag pair is read directly off the GC heap at its
 * pointer (mirroring operators.ts's own f64.load(...)/f64.load(...+8) reads
 * for complex operands elsewhere in the runtime). */
function decodeArithOperand(
  memory: WebAssembly.Memory,
  tag: number,
  val: bigint,
): bigint | number | PyComplexNumber {
  switch (tag) {
    case TYPE_TAG.INT:
      return val;
    case TYPE_TAG.FLOAT: {
      const buf = new ArrayBuffer(8);
      new DataView(buf).setBigInt64(0, val, true);
      return new DataView(buf).getFloat64(0, true);
    }
    case TYPE_TAG.COMPLEX: {
      const dv = new DataView(memory.buffer, Number(val), 16);
      return new PyComplexNumber(dv.getFloat64(0, true), dv.getFloat64(8, true));
    }
    default:
      throw new Error(ERROR_MAP.ARITH_OP_UNKNOWN_TYPE);
  }
}

function toComplex(value: bigint | number | PyComplexNumber): PyComplexNumber {
  if (value instanceof PyComplexNumber) return value;
  return typeof value === "bigint"
    ? PyComplexNumber.fromBigInt(value)
    : PyComplexNumber.fromNumber(value);
}

export type HostRuntimeState = {
  output: string[];
  rawOutputs: [number, bigint][];
  wasmExports: WasmExports | null;
};

export function createHostImports(
  memory: WebAssembly.Memory,
  runtime: HostRuntimeState,
  /** Renders a HOSTREF (imported-module value — see moduleInterop.ts) for
   * print(). Defaults cover the no-modules case, where log_hostref can
   * never actually fire but the import must still exist. */
  hostrefDisplay: (index: bigint) => string = () => "<module value>",
) {
  const capture = (value: string) => {
    runtime.output.push(value);
  };
  const captureRaw = (tag: number, value: bigint) => {
    runtime.rawOutputs.push([tag, value]);
  };

  return {
    console: {
      log_int: (value: bigint) => capture(value.toString()),
      log_float: (value: number) => capture(toPythonFloat(value)),
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
      log_hostref: (index: bigint) => capture(hostrefDisplay(index)),
    },
    stringify: {
      /**
       * str()/repr(): reuses LOG_FX's own formatting the same way log_list
       * reuses it for element rendering above -- call back into the exported
       * `log`, pop the text it pushed into runtime.output, then (repr only,
       * string values only) apply Python's repr quoting via `escape` before
       * allocating the result as a real WASM string (same malloc/encode/
       * write/makeString sequence `tokenize` below uses to hand text
       * computed in JS back to WASM as a value).
       */
      to_str: (tag: number, value: bigint): [number, bigint] => {
        if (!runtime.wasmExports) throw new Error("WASM exports not initialised");
        runtime.wasmExports.log(tag, value);
        const rendered = runtime.output.pop();
        if (rendered === undefined) throw new Error("str() logging did not produce rendered text");
        return allocateWasmString(runtime.wasmExports, memory, rendered);
      },
      to_repr: (tag: number, value: bigint): [number, bigint] => {
        if (!runtime.wasmExports) throw new Error("WASM exports not initialised");
        runtime.wasmExports.log(tag, value);
        const rendered = runtime.output.pop();
        if (rendered === undefined) throw new Error("repr() logging did not produce rendered text");
        const text = tag === TYPE_TAG.STRING ? escape(rendered) : rendered;
        return allocateWasmString(runtime.wasmExports, memory, text);
      },
    },
    metacircular: {
      tokenize: (offset: number, length: number) => {
        if (!runtime.wasmExports) throw new Error("WASM exports not initialised");
        const { makePair, makeNone } = runtime.wasmExports;

        pythonLexer.reset(
          new TextDecoder("utf8").decode(new Uint8Array(memory.buffer, offset, length)),
        );

        return Array.from(pythonLexer)
          .map(t => toAstToken(t))
          .map(({ lexeme }) => allocateWasmString(runtime.wasmExports!, memory, lexeme))
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
    arith: {
      /**
       * `//`, `%`, `**` (see runtime/operators.ts's ARITHMETIC_OP_FX,
       * whose FLOORDIV/MOD/POW branches delegate here entirely): reuses
       * CSE's own pythonMod and PyComplexNumber.pow so WASM's floor-division
       * (floors toward -infinity, not i64 div_s's truncation-toward-zero)
       * and complex exponentiation (needs log/exp/atan2/cos/sin -- none of
       * which are native WASM instructions) match CSE bit-for-bit instead of
       * a second, independently-derived implementation.
       */
      ext: (
        op: number,
        xTag: number,
        xVal: bigint,
        yTag: number,
        yVal: bigint,
      ): [number, bigint] => {
        if (!runtime.wasmExports) throw new Error("WASM exports not initialised");
        const { makeInt, makeFloat, makeComplex } = runtime.wasmExports;

        const x = decodeArithOperand(memory, xTag, xVal);
        const y = decodeArithOperand(memory, yTag, yVal);

        if (x instanceof PyComplexNumber || y instanceof PyComplexNumber) {
          if (op !== ARITHMETIC_OP_TAG.POW) throw new Error(ERROR_MAP.ARITH_OP_UNKNOWN_TYPE);
          const result = toComplex(x).pow(toComplex(y));
          return makeComplex(result.real, result.imag);
        }

        if (typeof x === "number" || typeof y === "number") {
          const xf = Number(x);
          const yf = Number(y);
          switch (op) {
            case ARITHMETIC_OP_TAG.FLOORDIV:
              if (yf === 0) throw new Error(ERROR_MAP.ZERO_DIVISION);
              return makeFloat(Math.floor(xf / yf));
            case ARITHMETIC_OP_TAG.MOD:
              if (yf === 0) throw new Error(ERROR_MAP.ZERO_DIVISION);
              return makeFloat(pythonMod(xf, yf));
            case ARITHMETIC_OP_TAG.POW:
              if (xf === 0 && yf < 0) throw new Error(ERROR_MAP.ZERO_DIVISION);
              return makeFloat(xf ** yf);
            default:
              throw new Error(ERROR_MAP.ARITH_OP_UNKNOWN_TYPE);
          }
        }

        const xb = x;
        const yb = y;
        switch (op) {
          case ARITHMETIC_OP_TAG.FLOORDIV:
            if (yb === 0n) throw new Error(ERROR_MAP.ZERO_DIVISION);
            return makeInt((xb - pythonMod(xb, yb)) / yb);
          case ARITHMETIC_OP_TAG.MOD:
            if (yb === 0n) throw new Error(ERROR_MAP.ZERO_DIVISION);
            return makeInt(pythonMod(xb, yb));
          case ARITHMETIC_OP_TAG.POW:
            if (xb === 0n && yb < 0n) throw new Error(ERROR_MAP.ZERO_DIVISION);
            if (yb < 0n) return makeFloat(Number(xb) ** Number(yb));
            return makeInt(xb ** yb);
          default:
            throw new Error(ERROR_MAP.ARITH_OP_UNKNOWN_TYPE);
        }
      },
    },
    js: { memory },
  };
}
