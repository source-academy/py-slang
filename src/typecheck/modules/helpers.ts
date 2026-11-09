import type { FunctionDescription, TypeDescription } from "../module-description";

/** Short forms for writing descriptions by hand. */
export const opaque = (name: string, ...args: TypeDescription[]): TypeDescription =>
  args.length ? { opaque: name, arguments: args } : { opaque: name };
export const parameter = (name: string): TypeDescription => ({ parameter: name });
export const fun = (params: TypeDescription[], returns: TypeDescription): TypeDescription => ({
  function: { params, returns },
});
/** `fn("scale", [["ratio", "number"], ["rune", Rune]], Rune)`; `typeParameters` for a generic function. */
export const fn = (
  name: string,
  params: [string, TypeDescription][],
  returns: TypeDescription,
  typeParameters?: string[],
): FunctionDescription => ({
  name,
  ...(typeParameters ? { typeParameters } : {}),
  params: params.map(([name, type]) => ({ name, type })),
  returns,
});
