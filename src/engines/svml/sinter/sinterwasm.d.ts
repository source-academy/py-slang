/* eslint-disable */
// TypeScript bindings for emscripten-generated code.  Automatically generated at compile time.
declare namespace RuntimeExports {
  /**
   * @param {string|null=} returnType
   * @param {Array=} argTypes
   * @param {Array=} args
   * @param {Object=} opts
   */
  function ccall(
    ident: any,
    returnType?: (string | null) | undefined,
    argTypes?: any[] | undefined,
    args?: any[] | undefined,
    opts?: any | undefined,
  ): any;
  /**
   * @param {string=} returnType
   * @param {Array=} argTypes
   * @param {Object=} opts
   */
  function cwrap(
    ident: any,
    returnType?: string | undefined,
    argTypes?: any[] | undefined,
    opts?: any | undefined,
  ): any;
  let HEAP8: any;
  let HEAPU8: any;
}
interface WasmModule {
  _siwasm_alloc_heap(_0: number): void;
  _siwasm_alloc(_0: number): number;
  _siwasm_free(_0: number): void;
  _siwasm_run(_0: number, _1: number): number;
}

export type MainModule = WasmModule & typeof RuntimeExports;
export default function MainModuleFactory(options?: unknown): Promise<MainModule>;
