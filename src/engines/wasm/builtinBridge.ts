import { ExprNS } from "../../ast-types";
import { RuntimeSourceError } from "../../errors";
import math from "../../stdlib/math";
import misc from "../../stdlib/misc";
import { Token, TokenType } from "../../tokenizer";
import { PyComplexNumber } from "../../types/value-types";
import { Context } from "../cse/context";
import type { Value } from "../cse/stash";
import { BRIDGED_BUILTINS } from "./bridgedBuiltins";
import { GC_OBJECT_HEADER_SIZE, TYPE_TAG } from "./runtime";
import type { WasmExports } from "./types";

/** A Call node whose callee carries the builtin's name, so errors that name
 * the callee ("unsupported argument type for math_sin...") stay accurate
 * (same trick as py2js's stdlibBridge.ts). */
function syntheticCallNode(name: string): ExprNS.Call {
  const token = new Token(TokenType.NAME, name, 1, 0, 0);
  token.synthetic = true;
  const callee = new ExprNS.Variable(token, token, token);
  return new ExprNS.Call(token, token, callee, []);
}

type SyncBuiltin = (
  args: Value[],
  source: string,
  command: ExprNS.Call,
  context: Context,
) => Value | undefined;

function decodeArgument(memory: WebAssembly.Memory, tag: number, val: bigint): Value {
  switch (tag) {
    case TYPE_TAG.INT:
      return { type: "bigint", value: val };
    case TYPE_TAG.FLOAT: {
      const buf = new ArrayBuffer(8);
      new DataView(buf).setBigInt64(0, val, true);
      return { type: "number", value: new DataView(buf).getFloat64(0, true) };
    }
    case TYPE_TAG.BOOL:
      return { type: "bool", value: val !== 0n };
    case TYPE_TAG.COMPLEX: {
      const dv = new DataView(memory.buffer, Number(val), 16);
      return {
        type: "complex",
        value: new PyComplexNumber(dv.getFloat64(0, true), dv.getFloat64(8, true)),
      };
    }
    // Only the *type* of the remaining kinds matters (no bridged function
    // accepts them, and the builtin's own check names the type it rejects).
    case TYPE_TAG.STRING:
      return { type: "string", value: "" };
    case TYPE_TAG.LIST:
    case TYPE_TAG.TUPLE:
      return { type: "list", value: [] };
    default:
      return { type: "none" };
  }
}

function encodeResult(exports: WasmExports, name: string, result: Value | undefined) {
  switch (result?.type) {
    case "bigint":
      return exports.makeInt(result.value);
    case "number":
      return exports.makeFloat(result.value);
    case "bool":
      return exports.makeBool(result.value ? 1 : 0);
    case "complex":
      return exports.makeComplex(result.value.real, result.value.imag);
    default:
      throw new Error(`SystemError: ${name} returned a value the WASM engine cannot represent`);
  }
}

/**
 * The `builtin.call` host import: runs the stdlib builtin that
 * BRIDGED_BUILTINS[id] names on the (tag, value) arguments, and converts the
 * numeric/bool result back into a WASM value.
 */
export function createBuiltinBridge(
  memory: WebAssembly.Memory,
  getExports: () => WasmExports | null,
) {
  const context = new Context();
  const table = BRIDGED_BUILTINS.map(entry => {
    const builtin = (entry.group === "math" ? math : misc).builtins.get(entry.name);
    if (builtin?.type !== "builtin") {
      throw new Error(`bridged builtin '${entry.name}' is missing from the ${entry.group} group`);
    }
    return {
      entry,
      call: builtin.func as SyncBuiltin,
      node: syntheticCallNode(entry.name),
    };
  });

  return (
    id: number,
    t1: number,
    v1: bigint,
    t2: number,
    v2: bigint,
    t3: number,
    v3: bigint,
  ): [number, bigint] => {
    const exports = getExports();
    if (!exports) throw new Error("WASM exports not initialised");
    const { entry, call, node } = table[id];
    const raw: [number, bigint][] = [
      [t1, v1],
      [t2, v2],
      [t3, v3],
    ];
    const fixed = raw.slice(0, entry.arity);
    const args = fixed.map(([tag, val]) => decodeArgument(memory, tag, val));
    if (entry.variadic) {
      // The rest list follows the fixed arguments: (ptr << 32 | length), with
      // 12-byte (tag u32, value u64) elements after the GC header.
      const [, listVal] = raw[entry.arity];
      const pointer = Number(listVal >> 32n) + GC_OBJECT_HEADER_SIZE;
      const length = Number(listVal & 0xffffffffn);
      const view = new DataView(memory.buffer, pointer, length * 12);
      for (let i = 0; i < length; i++) {
        args.push(
          decodeArgument(memory, view.getUint32(i * 12, true), view.getBigInt64(i * 12 + 4, true)),
        );
      }
    }
    let result: Value | undefined;
    try {
      result = call(args, "", node, context);
    } catch (e) {
      // handleRuntimeError throws a plain RuntimeSourceError object, which is
      // not an Error: surface it as one, keeping the "XError: ..." message.
      if (e instanceof RuntimeSourceError) throw new Error(e.message);
      throw e;
    }
    return encodeResult(exports, entry.name, result);
  };
}
