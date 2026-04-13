declare function wasmLoader(
  imports: WebAssembly.Imports,
): Promise<WebAssembly.WebAssemblyInstantiatedSource>;
export default wasmLoader;
