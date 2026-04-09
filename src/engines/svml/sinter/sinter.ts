import sinterwasm from "./sinterwasm.js";
import wasm from "./sinterwasm.wasm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EmscriptenModule = any;

export type SinterValue =
  | { type: "undefined" }
  | { type: "NoneType" }
  | { type: "bool"; value: boolean }
  | { type: "int"; value: number }
  | { type: "float"; value: number }
  | { type: "string"; value: string };

interface SinterModule {
  module: EmscriptenModule;
  alloc_heap: (size: number) => void;
  alloc: (size: number) => number;
  free: (ptr: number) => void;
  run: (ptr: number, size: number) => number;
  runBinary: (buffer: Uint8Array) => SinterValue;
}

// Initialize the sinter WASM module
export default async function init(props: Record<string, unknown> = {}): Promise<SinterModule> {
  const module = await sinterwasm({
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

  const alloc_heap = module.cwrap("siwasm_alloc_heap", undefined, ["number"]);
  const alloc = module.cwrap("siwasm_alloc", "number", ["number"]);
  const free = module.cwrap("siwasm_free", undefined, ["number"]);
  const run = module.cwrap("siwasm_run", "number", ["number", "number"]);

  const readReturnValue = (resPtr: number): SinterValue => {
    const u8 = module.HEAPU8 as Uint8Array;
    const dv = new DataView(u8.buffer);
    const type = dv.getUint32(resPtr, true);
    const raw32 = dv.getUint32(resPtr + 4, true);

    switch (type) {
      case 1: // sinter_type_undefined
        return { type: "undefined" };
      case 2: // sinter_type_null
        return { type: "NoneType" };
      case 3: // sinter_type_boolean
        return { type: "bool", value: raw32 === 1 };
      case 4: // sinter_type_integer (32-bit signed)
        return { type: "int", value: dv.getInt32(resPtr + 4, true) };
      case 5: // sinter_type_float (IEEE-754 float32)
        return { type: "float", value: dv.getFloat32(resPtr + 4, true) };
      case 6: {
        // sinter_type_string: raw32 is a pointer to null-terminated string
        const bytearray = module.HEAPU8.subarray(raw32, module.HEAPU8.indexOf(0, raw32));
        return { type: "string", value: new TextDecoder("utf-8").decode(bytearray) };
      }
      case 7: // sinter_type_array
        throw new Error("Type not yet supported");
      case 8: // sinter_type_function
        throw new Error("Type not yet supported");
      default:
        throw new Error(`Unknown return type: ${type}`);
    }
  };

  const runBinary = (buffer: Uint8Array): SinterValue => {
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
