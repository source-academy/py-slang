import { DataType, IDataHandler, TypedValue } from "@sourceacademy/conductor/types";
import { ENV_HEAD_SIZE, GC_OBJECT_HEADER_SIZE, TYPE_TAG } from "./runtime";
import type { WasmExports } from "./types";

/**
 * Conversion layer between the WASM engine's tagged (i32 tag, i64 value)
 * runtime values and the conductor module protocol's TypedValues — the WASM
 * analogue of src/engines/pvml/modules.ts, mirroring the same mapping
 * decisions (NUMBER<->float, none<->EMPTY_LIST, PAIR<->2-element list,
 * OPAQUE/CLOSURE<->handle) so a module behaves identically whichever engine
 * the student runs on.
 *
 * The structural twist unique to this engine: conversion *into* wasm values
 * must happen in two phases. IDataHandler traversal (pair_head/pair_tail/
 * opaque handling) is async, but the `modules.get` host import that
 * materialises imported values runs synchronously in the middle of `main()`.
 * So `prepareModuleBindings` does all the async traversal up front (at
 * import-load time, before compilation) into a plain synchronous
 * `HostModuleValue` tree, and materialisation into actual wasm values — via
 * the instance's own make* exports, which handle GC rooting — happens
 * on demand, synchronously, when the compiled FromImport statement executes.
 *
 * GC discipline (see the make* functions in runtime/values.ts): every make*
 * export pushes its GCable result onto the shadow stack and pops its GCable
 * arguments, so a bottom-up materialisation (children before parents, head
 * before tail) is self-balancing and ends with exactly the root value
 * rooted — the same convention the metacircular tokenize host import relies
 * on. Reading wasm values (readWasmValue) never calls back into the
 * instance at all, only DataView reads, so no allocation — and therefore no
 * GC movement — can happen while raw heap pointers are held.
 */

/**
 * The JS Promise Integration API surface this engine uses, absent from
 * TypeScript's WebAssembly lib types (the proposal is only shipped in
 * V8-based engines so far). `Suspending` wraps an async host import so the
 * wasm instance suspends on its promise; `promising` wraps an export so
 * calling it returns a promise that settles when the (possibly suspended)
 * activation completes.
 */
export type JspiApi = {
  Suspending: new (fn: (...args: never[]) => Promise<unknown>) => WebAssembly.ImportValue & object;
  promising: <A extends unknown[], R>(fn: (...args: A) => R) => (...args: A) => Promise<R>;
};

/** Feature-detects JSPI — null on runtimes without it (Firefox/Safari, and
 * Node before V8 13.x), where imported-module *values* still work but
 * calling a module function raises a clear error (see index.ts). */
export function getJspi(): JspiApi | null {
  const wa = WebAssembly as unknown as Partial<JspiApi>;
  return typeof wa.Suspending === "function" && typeof wa.promising === "function"
    ? (wa as JspiApi)
    : null;
}

export type HostModuleValue =
  | { kind: "float"; value: number }
  | { kind: "bool"; value: boolean }
  | { kind: "string"; value: string }
  | { kind: "none" }
  | { kind: "pair"; head: HostModuleValue; tail: HostModuleValue }
  | { kind: "handle"; index: number };

/** An entry in the handle table: the conductor value a HOSTREF wasm value
 * stands for, plus its export symbol (display/error messages only). */
export type ModuleHandle = { value: TypedValue<DataType>; name: string };

export type PreparedModuleBindings = {
  /** Bound names in binding-index order — what the compiler resolves
   * FromImport statements against (see BuilderGenerator's
   * moduleBindingIndices). */
  names: string[];
  /** Pre-converted values, same order as `names`. */
  values: HostModuleValue[];
  /** HOSTREF handle table — grows at runtime as module calls return new
   * opaques/closures. */
  handles: ModuleHandle[];
  dh: IDataHandler;
};

/** Async phase: converts one module-export TypedValue into the synchronous
 * HostModuleValue form, registering opaques/closures in `handles`. */
async function typedToHostValue(
  dh: IDataHandler,
  value: TypedValue<DataType> | undefined | null,
  name: string,
  handles: ModuleHandle[],
): Promise<HostModuleValue> {
  // A void-returning module function's generator settles with `step.value`
  // left undefined (its `next()` never received an explicit return value) --
  // treat that the same as Python's None, matching every other DataType.VOID
  // case below.
  if (value === undefined || value === null) {
    return { kind: "none" };
  }
  switch (value.type) {
    case DataType.NUMBER:
      return { kind: "float", value: value.value };
    case DataType.BOOLEAN:
      return { kind: "bool", value: value.value };
    case DataType.CONST_STRING:
      return { kind: "string", value: value.value };
    case DataType.VOID:
    case DataType.EMPTY_LIST:
      return { kind: "none" };
    case DataType.PAIR:
      return {
        kind: "pair",
        head: await typedToHostValue(dh, await dh.pair_head(value), name, handles),
        tail: await typedToHostValue(dh, await dh.pair_tail(value), name, handles),
      };
    case DataType.OPAQUE:
    case DataType.CLOSURE:
      handles.push({ value, name });
      return { kind: "handle", index: handles.length - 1 };
    case DataType.ARRAY:
      // The WASM engine's flat LIST can't be built through the pair-based
      // make* exports; no SICPy module traffics in ARRAY today.
      throw new Error(
        `Module value "${name}": ARRAY module values are not supported by the WASM evaluator yet`,
      );
  }
}

/** Builds the PreparedModuleBindings for a chunk's imports, in binding order.
 * Called by PyWasmEvaluator's loadImports before compilation. */
export async function prepareModuleBindings(
  dh: IDataHandler,
  entries: { name: string; value: TypedValue<DataType> }[],
): Promise<PreparedModuleBindings> {
  const handles: ModuleHandle[] = [];
  const values: HostModuleValue[] = [];
  for (const entry of entries) {
    values.push(await typedToHostValue(dh, entry.value, entry.name, handles));
  }
  return { names: entries.map(e => e.name), values, handles, dh };
}

/** Renders a HOSTREF for print()/str(), matching what the CSE machine and
 * PVML show for the same values. */
export function hostrefDisplay(
  prepared: PreparedModuleBindings | undefined,
  index: number,
): string {
  const handle = prepared?.handles[index];
  if (!handle) return "<module value>";
  return handle.value.type === DataType.CLOSURE
    ? `<built-in function ${handle.name}>`
    : "<opaque object>";
}

function decodeFloat(val: bigint): number {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setBigUint64(0, val, true);
  return new DataView(buf).getFloat64(0, true);
}

/**
 * Sync phase of value import: materialises a HostModuleValue as a real wasm
 * value through the instance's make* exports (see the GC-discipline note in
 * the module doc comment). Strings follow the metacircular tokenize
 * pattern: malloc, zero the GC header, write bytes, makeString.
 */
function materialize(
  value: HostModuleValue,
  exports: WasmExports,
  memory: WebAssembly.Memory,
): [number, bigint] {
  switch (value.kind) {
    case "float":
      return exports.makeFloat(value.value);
    case "bool":
      return exports.makeBool(value.value ? 1 : 0);
    case "none":
      return exports.makeNone();
    case "string": {
      const bytes = new TextEncoder().encode(value.value);
      const ptr = exports.malloc(bytes.length + GC_OBJECT_HEADER_SIZE);
      const view = new Uint8Array(memory.buffer);
      view.fill(0, ptr, ptr + GC_OBJECT_HEADER_SIZE);
      view.set(bytes, ptr + GC_OBJECT_HEADER_SIZE);
      return exports.makeString(ptr, bytes.length);
    }
    case "pair": {
      // Head materialised before tail so the shadow-stack pops in makePair
      // (tail first, then head) line up LIFO with the pushes.
      const [headTag, headVal] = materialize(value.head, exports, memory);
      const [tailTag, tailVal] = materialize(value.tail, exports, memory);
      return exports.makePair(headTag, headVal, tailTag, tailVal);
    }
    case "handle":
      return [TYPE_TAG.HOSTREF, BigInt(value.index)];
  }
}

/**
 * Reads one tagged wasm value into a conductor TypedValue. Pure reads (no
 * wasm calls, no allocation — see the module doc comment's GC note);
 * `dataEnd` is the boundary below which STRING payload pointers are static
 * data-section strings with no GC header (mirrors LOG_FX's identical
 * offset select in runtime/stdlib.ts).
 */
async function readWasmValue(
  tag: number,
  val: bigint,
  memory: WebAssembly.Memory,
  dataEnd: number,
  prepared: PreparedModuleBindings,
): Promise<TypedValue<DataType>> {
  const { dh } = prepared;
  switch (tag) {
    case TYPE_TAG.INT:
      // Module signatures only know NUMBER, so ints cross as floats —
      // same as the CSE and PVML converters.
      return { type: DataType.NUMBER, value: Number(BigInt.asIntN(64, val)) };
    case TYPE_TAG.FLOAT:
      return { type: DataType.NUMBER, value: decodeFloat(val) };
    case TYPE_TAG.BOOL:
      return { type: DataType.BOOLEAN, value: val !== 0n };
    case TYPE_TAG.NONE:
      return { type: DataType.EMPTY_LIST, value: null };
    case TYPE_TAG.STRING: {
      const ptr = Number(val >> 32n);
      const len = Number(val & 0xffffffffn);
      const offset = ptr < dataEnd ? ptr : ptr + GC_OBJECT_HEADER_SIZE;
      return {
        type: DataType.CONST_STRING,
        value: new TextDecoder("utf8").decode(new Uint8Array(memory.buffer, offset, len)),
      };
    }
    case TYPE_TAG.LIST:
    case TYPE_TAG.TUPLE: {
      const ptr = Number(val >> 32n) + GC_OBJECT_HEADER_SIZE;
      const len = Number(val & 0xffffffffn);
      const dv = new DataView(memory.buffer, ptr, len * 12);
      const elements: [number, bigint][] = [];
      for (let i = 0; i < len; i++) {
        elements.push([dv.getUint32(i * 12, true), dv.getBigUint64(i * 12 + 4, true)]);
      }
      // A length-2 LIST is this engine's pair (MAKE_PAIR builds exactly
      // that — see runtime/linkedList.ts), reconstructed as a single
      // pair_make; any other length is a flat Python list, folded into a
      // proper PAIR/EMPTY_LIST chain. Same rule (and same 2-element-literal
      // ambiguity caveat) as the PVML converter.
      if (len === 2) {
        return dh.pair_make(
          await readWasmValue(elements[0][0], elements[0][1], memory, dataEnd, prepared),
          await readWasmValue(elements[1][0], elements[1][1], memory, dataEnd, prepared),
        );
      }
      let chain: TypedValue<DataType> = { type: DataType.EMPTY_LIST, value: null };
      for (let i = len - 1; i >= 0; i--) {
        chain = await dh.pair_make(
          await readWasmValue(elements[i][0], elements[i][1], memory, dataEnd, prepared),
          chain,
        );
      }
      return chain;
    }
    case TYPE_TAG.HOSTREF:
      return prepared.handles[Number(val)].value;
    case TYPE_TAG.CLOSURE:
      throw new Error(
        "Passing a function to an imported module function is not supported by the WASM evaluator yet",
      );
    default:
      throw new Error(`Cannot pass a value of runtime tag ${tag} to an imported module function`);
  }
}

/**
 * The `modules.call` host-import implementation: reads the call's arguments
 * out of the environment PRE_APPLY allocated for them (see the HOSTREF
 * branches in runtime/environments.ts), runs the module function, and
 * materialises its result as a wasm value. Async — the wasm instance can
 * only run it wrapped in WebAssembly.Suspending (JSPI); see index.ts.
 */
export function createModuleCall(
  memory: WebAssembly.Memory,
  getExports: () => WasmExports | null,
  dataEnd: number,
  prepared: PreparedModuleBindings,
): (handleIndex: number, envPtr: number, argLen: number) => Promise<[number, bigint]> {
  return async (handleIndex, envPtr, argLen) => {
    const exports = getExports();
    if (!exports) throw new Error("WASM exports not initialised");

    const handle = prepared.handles[handleIndex];
    if (!handle) throw new Error(`Invalid module handle: ${handleIndex}`);
    if (handle.value.type !== DataType.CLOSURE) {
      throw new Error(`'${handle.name}' (an imported module value) is not callable`);
    }

    // Read all raw (tag, val) pairs first: readWasmValue never allocates,
    // so the env pointer stays valid for the whole read phase.
    const dv = new DataView(memory.buffer, envPtr + ENV_HEAD_SIZE, argLen * 12);
    const rawArgs: [number, bigint][] = [];
    for (let i = 0; i < argLen; i++) {
      rawArgs.push([dv.getUint32(i * 12, true), dv.getBigUint64(i * 12 + 4, true)]);
    }
    const args: TypedValue<DataType>[] = [];
    for (const [tag, val] of rawArgs) {
      args.push(await readWasmValue(tag, val, memory, dataEnd, prepared));
    }

    const gen = prepared.dh.closure_call_unchecked(handle.value, args);
    let step = await gen.next();
    while (!step.done) {
      step = await gen.next();
    }

    const result = await typedToHostValue(prepared.dh, step.value, handle.name, prepared.handles);
    return materialize(result, exports, memory);
  };
}

/** The sync `modules.get` host-import implementation (imported-value
 * materialisation at FromImport execution — see the compiler's
 * visitFromImportStmt). */
export function createModuleGet(
  memory: WebAssembly.Memory,
  getExports: () => WasmExports | null,
  prepared: PreparedModuleBindings,
): (bindingIndex: number) => [number, bigint] {
  return bindingIndex => {
    const exports = getExports();
    if (!exports) throw new Error("WASM exports not initialised");
    const value = prepared.values[bindingIndex];
    if (value === undefined) throw new Error(`Invalid module binding index: ${bindingIndex}`);
    return materialize(value, exports, memory);
  };
}
