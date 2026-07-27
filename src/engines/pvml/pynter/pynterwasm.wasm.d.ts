// TypeScript's sibling-file .wasm.d.ts convention only applies to relative
// imports, not a package subpath like "@sourceacademy/pynter-wasm/pynterwasm.wasm"
// — that needs an ambient module declaration keyed to the exact specifier
// instead, which is what this is now that the WASM build is a real npm
// dependency rather than a vendored, relatively-imported file.
declare module "@sourceacademy/pynter-wasm/pynterwasm.wasm" {
  function wasmLoader(
    imports: WebAssembly.Imports,
  ): Promise<WebAssembly.WebAssemblyInstantiatedSource>;
  export default wasmLoader;
}
