import pynterwasm from "@sourceacademy/pynter-wasm";
import wasm from "@sourceacademy/pynter-wasm/pynterwasm.wasm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EmscriptenModule = any;

export type PynterValue =
  | { type: "undefined" }
  | { type: "NoneType" }
  | { type: "bool"; value: boolean }
  | { type: "int"; value: number }
  | { type: "float"; value: number }
  | { type: "string"; value: string };

interface PynterModule {
  module: EmscriptenModule;
  alloc_heap: (size: number) => void;
  alloc: (size: number) => number;
  free: (ptr: number) => void;
  run: (ptr: number, size: number) => number;
  runBinary: (buffer: Uint8Array) => PynterValue;
}

// Initialize the Pynter WASM module
export default async function init(props: Record<string, unknown> = {}): Promise<PynterModule> {
  const module = await pynterwasm({
    instantiateWasm(
      imports: WebAssembly.Imports,
      callback: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
    ) {
      return wasm(imports).then((result: WebAssembly.WebAssemblyInstantiatedSource) => {
        callback(result.instance, result.module);
        return result.instance.exports;
      });
    },
    ...props,
  });

  if (!module.cwrap) {
    console.error("module has no cwrap", module);
    throw new Error("module has no cwrap");
  }

  // These are the WASM-exported symbol names actually compiled into
  // pynterwasm.wasm (see Pynter's devices/wasm/wasm/lib.c); they keep
  // Pynter's internal "si"-prefix convention, which this rename didn't touch.
  //
  // `undefined` (not `null`) for a void return type: Emscripten's own
  // upstream cwrap JSDoc types returnType as `{string=}`, narrower than
  // ccall's `{string|null=}` — an asymmetry that carries through to the
  // --emit-tsd output @sourceacademy/pynter-wasm actually ships (verified
  // directly against its published .d.ts), so `null` doesn't type-check
  // here even though it's the more common Emscripten convention elsewhere
  // (see the equivalent README example in source-academy/pynter#18, which
  // isn't bound to this package's real, narrower shipped types the way
  // this call site is).
  const alloc_heap = module.cwrap("siwasm_alloc_heap", undefined, ["number"]);
  const alloc = module.cwrap("siwasm_alloc", "number", ["number"]);
  const free = module.cwrap("siwasm_free", undefined, ["number"]);
  const run = module.cwrap("siwasm_run", "number", ["number", "number"]);

  // Initialise the Pynter heap (required before any run call)
  alloc_heap(0x10000);

  const readReturnValue = (resPtr: number): PynterValue => {
    const u8 = module.HEAPU8;
    const dv = new DataView(u8.buffer);
    const type = dv.getUint32(resPtr, true);
    const raw32 = dv.getUint32(resPtr + 4, true);

    switch (type) {
      case 1: // pynter_type_undefined
        return { type: "undefined" };
      case 2: // pynter_type_none
        return { type: "NoneType" };
      case 3: // pynter_type_boolean
        return { type: "bool", value: raw32 === 1 };
      case 4: // pynter_type_integer (32-bit signed)
        return { type: "int", value: dv.getInt32(resPtr + 4, true) };
      case 5: // pynter_type_float (IEEE-754 float32)
        return { type: "float", value: dv.getFloat32(resPtr + 4, true) };
      case 6: {
        // pynter_type_string: raw32 is a pointer to null-terminated string
        const bytearray = module.HEAPU8.subarray(raw32, module.HEAPU8.indexOf(0, raw32));
        return { type: "string", value: new TextDecoder("utf-8").decode(bytearray) };
      }
      case 7: // pynter_type_array
        throw new Error("Type not yet supported");
      case 8: // pynter_type_function
        throw new Error("Type not yet supported");
      default:
        throw new Error(`Unknown return type: ${type}`);
    }
  };

  const runBinary = (buffer: Uint8Array): PynterValue => {
    const ptr = alloc(buffer.length);
    if (!ptr) {
      throw new Error("Failed to allocate WASM memory");
    }

    try {
      module.HEAPU8.set(buffer, ptr);
      const resPtr = run(ptr, buffer.length);
      return readReturnValue(resPtr);
    } finally {
      free(ptr);
    }
  };

  return {
    module,
    alloc_heap,
    alloc,
    free,
    run,
    runBinary,
  };
}
