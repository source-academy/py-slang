/**
 * A language-neutral description of the types of a module (docs/typed-python-4.md, Phase 4;
 * source-academy/modules#996), and the mapper from it to the text of a Python stub, which the type
 * checker reads as the module. Modules are language-agnostic: the description says `number`, `pair`
 * and `function`, and each typed language maps that to its own types.
 *
 * The format is versioned; a mapper rejects what it does not know, with a message that says so.
 */

export const MODULE_DESCRIPTION_VERSION = 1;

/** The type of a value that a module's function takes or returns. */
export type TypeDescription =
  | "number"
  | "integer"
  | "string"
  | "boolean"
  | "void"
  /** A value that the module defines and that a program can only pass back to it, by the name of its type. */
  | { opaque: string }
  /** A linked list, a pair, an array (a Python list), and a function: with the types of their parts. */
  | { list: TypeDescription }
  | { pair: [TypeDescription, TypeDescription] }
  | { array: TypeDescription }
  | { function: { params: TypeDescription[]; returns: TypeDescription } };

export interface ParameterDescription {
  name: string;
  type: TypeDescription;
}

export interface ModuleDescription {
  version: typeof MODULE_DESCRIPTION_VERSION;
  /** The name that a program imports: `rune`. */
  module: string;
  /** The names of the opaque types that the module defines (`Rune`). */
  opaqueTypes: string[];
  functions: { name: string; params: ParameterDescription[]; returns: TypeDescription }[];
  constants: { name: string; type: TypeDescription }[];
}

/** The description is of a kind that this version of py-slang does not know. */
export class UnknownDescriptionError extends Error {
  constructor(what: string) {
    super(`This module description is not supported by this version of py-slang: ${what}`);
    this.name = "UnknownDescriptionError";
  }
}

function pythonType(type: TypeDescription, opaque: ReadonlySet<string>): string {
  if (typeof type === "string") {
    switch (type) {
      case "number":
        return "float"; // an int is accepted where a float is wanted
      case "integer":
        return "int";
      case "string":
        return "str";
      case "boolean":
        return "bool";
      case "void":
        return "None";
    }
    throw new UnknownDescriptionError(`the type "${String(type)}"`);
  }
  if ("opaque" in type) {
    if (!opaque.has(type.opaque))
      throw new UnknownDescriptionError(`the opaque type ${type.opaque} is not declared`);
    return type.opaque;
  }
  if ("list" in type) return `LList[${pythonType(type.list, opaque)}]`;
  if ("pair" in type)
    return `Pair[${pythonType(type.pair[0], opaque)}, ${pythonType(type.pair[1], opaque)}]`;
  if ("array" in type) return `list[${pythonType(type.array, opaque)}]`;
  if ("function" in type) {
    const params = type.function.params.map(p => pythonType(p, opaque)).join(", ");
    return `Callable[[${params}], ${pythonType(type.function.returns, opaque)}]`;
  }
  throw new UnknownDescriptionError(`the type ${JSON.stringify(type)}`);
}

/**
 * The text of the Python stub (a `.pyi` file) for a module. Parameters are positional-only, as
 * the functions of a module are called by position in Source Academy Python.
 */
export function toStub(description: ModuleDescription): string {
  if (description.version !== MODULE_DESCRIPTION_VERSION)
    throw new UnknownDescriptionError(`version ${String(description.version)}`);
  const opaque = new Set(description.opaqueTypes);
  const lines = [
    "from typing import Callable",
    ...description.opaqueTypes.map(name => `class ${name}: ...`),
  ];
  for (const { name, params, returns } of description.functions) {
    const parameters = params.map(p => `${p.name}: ${pythonType(p.type, opaque)}`);
    if (parameters.length > 0) parameters.push("/");
    lines.push(`def ${name}(${parameters.join(", ")}) -> ${pythonType(returns, opaque)}: ...`);
  }
  for (const { name, type } of description.constants)
    lines.push(`${name}: ${pythonType(type, opaque)}`);
  return lines.join("\n") + "\n";
}
