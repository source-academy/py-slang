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
  /** A value of any type, which the function inspects (`is_tree`): `object`, which a program can only pass on. */
  | "any"
  /**
   * A value that the module defines and that a program can only pass back to it, by the name of its
   * type; with the types that it is applied to, if the type has type parameters (`BinaryTree[A]`).
   */
  | { opaque: string; arguments?: TypeDescription[] }
  /** A type parameter of the function that this type is a part of (`A` in `entry[A]`). */
  | { parameter: string }
  /** A linked list, a pair, an array (a Python list), and a function: with the types of their parts. */
  | { list: TypeDescription }
  | { pair: [TypeDescription, TypeDescription] }
  | { array: TypeDescription }
  | { function: { params: TypeDescription[]; returns: TypeDescription } };

export interface ParameterDescription {
  name: string;
  type: TypeDescription;
}

/** An opaque type that has type parameters: a tree of entries of type `A`, a `BinaryTree[A]`. */
export interface GenericOpaqueType {
  name: string;
  typeParameters: string[];
}

export interface FunctionDescription {
  name: string;
  /** The type parameters of a function that works for several types (`make_tree[A]`). */
  typeParameters?: string[];
  params: ParameterDescription[];
  returns: TypeDescription;
}

export interface ModuleDescription {
  version: typeof MODULE_DESCRIPTION_VERSION;
  /** The name that a program imports: `rune`. */
  module: string;
  /** The opaque types that the module defines: a name (`Rune`), or a name with type parameters. */
  opaqueTypes: (string | GenericOpaqueType)[];
  functions: FunctionDescription[];
  constants: { name: string; type: TypeDescription }[];
}

/** The description is of a kind that this version of py-slang does not know. */
export class UnknownDescriptionError extends Error {
  constructor(what: string) {
    super(`This module description cannot be used by this version of py-slang: ${what}`);
    this.name = "UnknownDescriptionError";
  }
}

/** What a type may refer to: the opaque types (with their number of type parameters), and the type parameters in scope. */
interface Scope {
  opaque: ReadonlyMap<string, number>;
  parameters: ReadonlySet<string>;
}

/**
 * Which way a value goes: `in` is what a program passes to the module (a parameter), `out` what it
 * receives (a result). A function type turns its parameters around: the parameter of a callback that a
 * program passes in is received by the program.
 */
type Direction = "in" | "out";

const turned = (direction: Direction): Direction => (direction === "in" ? "out" : "in");

/**
 * What the runtime does at the boundary of a module (src/engines/py2js/moduleInterop.ts): a Python int
 * becomes a JS number, a module's number comes back as a float, and integers are not part of the module
 * interface. So `number` is `int | float` going in (as the prelude's `math_*` are), and `float` coming out;
 * `integer` marks a parameter that must be whole, and is `int` going in. It is not a result: a result
 * comes back as a float.
 */
function pythonType(type: TypeDescription, scope: Scope, direction: Direction): string {
  if (typeof type === "string") {
    switch (type) {
      case "number":
        return direction === "in" ? "int | float" : "float";
      case "integer":
        if (direction === "out")
          throw new UnknownDescriptionError(
            "integer is for a parameter that must be whole: a result is a number",
          );
        return "int";
      case "string":
        return "str";
      case "boolean":
        return "bool";
      case "void":
        return "None";
      case "any":
        return "object";
    }
    throw new UnknownDescriptionError(`the type "${String(type)}"`);
  }
  if ("opaque" in type) {
    const arity = scope.opaque.get(type.opaque);
    if (arity === undefined)
      throw new UnknownDescriptionError(`the opaque type ${type.opaque} is not declared`);
    const given = type.arguments ?? [];
    if (given.length !== arity)
      throw new UnknownDescriptionError(
        `the opaque type ${type.opaque} has ${arity} type parameters, not ${given.length}`,
      );
    return arity === 0
      ? type.opaque
      : `${type.opaque}[${given.map(t => pythonType(t, scope, direction)).join(", ")}]`;
  }
  if ("parameter" in type) {
    if (!scope.parameters.has(type.parameter))
      throw new UnknownDescriptionError(`the type parameter ${type.parameter} is not declared`);
    return type.parameter;
  }
  if ("list" in type) return `_LList[${pythonType(type.list, scope, direction)}]`;
  if ("pair" in type)
    return `_Pair[${pythonType(type.pair[0], scope, direction)}, ${pythonType(type.pair[1], scope, direction)}]`;
  if ("array" in type) return `list[${pythonType(type.array, scope, direction)}]`;
  if ("function" in type) {
    const params = type.function.params
      .map(p => pythonType(p, scope, turned(direction)))
      .join(", ");
    return `_Callable[[${params}], ${pythonType(type.function.returns, scope, direction)}]`;
  }
  throw new UnknownDescriptionError(`the type ${JSON.stringify(type)}`);
}

const KEYWORDS = new Set(
  "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield".split(
    " ",
  ),
);
/** The names that the stub itself uses for types: an opaque type with one of them would change what they mean. */
const TYPE_NAMES = new Set(["int", "float", "str", "bool", "list", "Pair", "LList"]);

function checkName(name: string, what: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || KEYWORDS.has(name))
    throw new UnknownDescriptionError(`${JSON.stringify(name)} is not a name for ${what}`);
}

/**
 * The text of the Python stub (a `.pyi` file) for a module. Parameters are positional-only, as
 * the functions of a module are called by position in Source Academy Python.
 */
export function toStub(description: ModuleDescription): string {
  if (description.version !== MODULE_DESCRIPTION_VERSION)
    throw new UnknownDescriptionError(`version ${String(description.version)}`);
  const opaque = new Map<string, number>();
  const classes: string[] = [];
  for (const type of description.opaqueTypes) {
    const { name, typeParameters } =
      typeof type === "string" ? { name: type, typeParameters: [] } : type;
    checkName(name, "a type");
    if (TYPE_NAMES.has(name))
      throw new UnknownDescriptionError(`the opaque type cannot be named ${name}`);
    typeParameters.forEach(parameter => checkName(parameter, "a type parameter"));
    opaque.set(name, typeParameters.length);
    // An opaque value is only received from the module and passed back to it: no program makes
    // one. The constructor takes an argument that no value has, so `Rune()` and `Rune(x)` are errors.
    // A type parameter is used by a member, so that it is invariant: a `BinaryTree[int]` is not a
    // `BinaryTree[str]` (a parameter that nothing uses would accept either). Not a private name:
    // pyright leaves those out when it works out the variance.
    classes.push(
      `class ${name}${typeParameters.length ? `[${typeParameters.join(", ")}]` : ""}:`,
      ...typeParameters.map(parameter => `    type_parameter_${parameter}: ${parameter}`),
      "    def __init__(self, _never: _NoReturn, /) -> None: ...",
    );
  }
  for (const { name, params, typeParameters } of description.functions) {
    checkName(name, "a function");
    for (const parameter of params) checkName(parameter.name, "a parameter");
    for (const parameter of typeParameters ?? []) checkName(parameter, "a type parameter");
  }
  for (const { name } of description.constants) checkName(name, "a constant");
  const lines = [
    "from typing import Callable as _Callable, NoReturn as _NoReturn",
    // The names of the prelude (Pair, LList) are the builtins of a program, but a stub must import them.
    "from __builtins__ import LList as _LList, Pair as _Pair",
    ...classes,
  ];
  for (const { name, params, returns, typeParameters = [] } of description.functions) {
    const scope = { opaque, parameters: new Set(typeParameters) };
    const parameters = params.map(p => `${p.name}: ${pythonType(p.type, scope, "in")}`);
    if (parameters.length > 0) parameters.push("/");
    const generic = typeParameters.length ? `[${typeParameters.join(", ")}]` : "";
    lines.push(
      `def ${name}${generic}(${parameters.join(", ")}) -> ${pythonType(returns, scope, "out")}: ...`,
    );
  }
  for (const { name, type } of description.constants)
    lines.push(`${name}: ${pythonType(type, { opaque, parameters: new Set() }, "out")}`);
  return lines.join("\n") + "\n";
}
