/**
 * The typed parts of the specification of Python §4 Typed (docs/specs/python_4_typed.tex): the types come
 * from the declarations that the type checker uses (src/typecheck/prelude.pyi), so that the specification is
 * what the checker accepts.
 *
 * - the library listings (docs/lib/linked_list.py, stream.py) with the types of their functions: each
 *   `def name(x, y):` is given the types of the declaration of `name`, under the parameter names of the
 *   listing; the docstrings and the bodies are those of the listing;
 * - the appendix "Types of the predeclared names".
 *
 *     tsx scripts/typed-spec.ts            (writes docs/specs/generated/)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { groupsOf } from "./typed-readme";

/** The text up to the matching close bracket of the one at `open`, and the index after it. */
function balanced(text: string, open: number): { inside: string; end: number } {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "[" || text[i] === "(") depth++;
    else if (text[i] === "]" || text[i] === ")") {
      depth--;
      if (depth === 0) return { inside: text.slice(open + 1, i), end: i + 1 };
    }
  }
  throw new Error(`unbalanced: ${text}`);
}

/** The top-level comma-separated parts of `text` (commas inside brackets do not separate). */
export function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "[" || text[i] === "(") depth++;
    else if (text[i] === "]" || text[i] === ")") depth--;
    else if (text[i] === "," && depth === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  const last = text.slice(start).trim();
  if (last) parts.push(last);
  return parts;
}

export interface Declaration {
  name: string;
  typeParameters: string[];
  /** The types of the parameters in order, without the `/`; a `*` in front for a star parameter. */
  parameters: { star: boolean; type: string }[];
  returns: string;
}

/** `def map[A, B](f: Callable[[A], B], xs: LList[A], /) -> LList[B]`. */
export function parseDeclaration(line: string): Declaration {
  const head = /^def ([\w.]+)/.exec(line);
  if (!head) throw new Error(`not a declaration: ${line}`);
  let at = head[0].length;
  let typeParameters: string[] = [];
  if (line[at] === "[") {
    const generic = balanced(line, at);
    typeParameters = splitTopLevel(generic.inside);
    at = generic.end;
  }
  const params = balanced(line, at);
  const returns = line
    .slice(params.end)
    .replace(/^\s*->\s*/, "")
    .trim();
  const parameters = splitTopLevel(params.inside)
    .filter(part => part !== "/")
    .map(part => {
      const star = part.startsWith("*");
      const colon = part.indexOf(":");
      return { star, type: part.slice(colon + 1).trim() };
    });
  return { name: head[1], typeParameters, parameters, returns };
}

/** The declarations of the prelude, and of the helpers of the library sources, by name. */
export function declarationsOf(prelude: string, helpers: string): Map<string, Declaration> {
  const declarations = new Map<string, Declaration>();
  for (const group of groupsOf(prelude))
    for (const line of group.lines)
      if (line.startsWith("def "))
        declarations.set(parseDeclaration(line).name, parseDeclaration(line));
  for (const line of helpers.split("\n"))
    if (line.startsWith("def "))
      declarations.set(parseDeclaration(line).name, parseDeclaration(line));
  return declarations;
}

/**
 * `TypeIs[T]` and `TypeGuard[T]` (a result that narrows its argument, which a program cannot write) are
 * `bool`; `T` may have brackets.
 */
function withoutTypeIs(type: string): string {
  const match = /\bType(?:Is|Guard)(?=\[)/.exec(type);
  if (!match) return type;
  const { end } = balanced(type, match.index + match[0].length);
  return withoutTypeIs(`${type.slice(0, match.index)}bool${type.slice(end)}`);
}

/**
 * A type that a program can write: `Any` (which a program cannot write) becomes a type parameter of its
 * own, `TypeIs[T]` and `TypeGuard[T]` (a result that narrows the argument) are `bool`.
 */
function writable(types: string[], taken: string[]): { types: string[]; added: string[] } {
  const added: string[] = [];
  const fresh = () => {
    let i = added.length + 1;
    let name = `X${i}`;
    while (taken.includes(name) || added.includes(name)) name = `X${++i}`;
    added.push(name);
    return name;
  };
  return {
    types: types.map(type => withoutTypeIs(type).replace(/\bAny\b/g, fresh)),
    added,
  };
}

/** The types of the constants of the prelude (`math_pi: float`), by name. */
export function constantsOf(prelude: string): Map<string, string> {
  const constants = new Map<string, string>();
  for (const group of groupsOf(prelude))
    for (const line of group.lines) {
      const constant = /^([a-z][A-Za-z0-9_]*): (.+)$/.exec(line);
      if (constant) constants.set(constant[1], constant[2]);
    }
  return constants;
}

/**
 * `name[A, B](f: ..., xs: ...) -> R`: the declaration with the parameter names of a listing (`names`, in order;
 * a `*` in front of a star parameter). What a program cannot write is made writable (see `writable`).
 * `shown` is the name to show (`build` for the key `build_stream.build`).
 */
export function renderSignature(
  key: string,
  names: string[],
  declaration: Declaration,
  shown: string = key,
  /**
   * Whether the signature is part of a program (a listing): then `Any`, `TypeIs` and `TypeGuard`, which a program cannot
   * write, are replaced. In the documentation of the names it is the declaration as the checker has it.
   */
  forProgram = true,
): string {
  if (names.length !== declaration.parameters.length)
    throw new Error(
      `${key} has ${names.length} parameters in the listing and ${declaration.parameters.length} in its declaration`,
    );
  const all = [...declaration.parameters.map(p => p.type), declaration.returns];
  const { types, added } = forProgram
    ? writable(all, declaration.typeParameters)
    : { types: all, added: [] };
  const parameters = names.map((parameter, i) => `${parameter}: ${types[i]}`);
  const typeParameters = [...declaration.typeParameters, ...added];
  const generic = typeParameters.length ? `[${typeParameters.join(", ")}]` : "";
  return `${shown}${generic}(${parameters.join(", ")}) -> ${types[types.length - 1]}`;
}

/**
 * The text of a listing with the types of its functions: every line `def name(x, y):` is given the types of
 * the declaration of `name`. A function without a declaration is an error.
 */
export function typedListing(source: string, declarations: Map<string, Declaration>): string {
  // The function that an indented `def` is in: a nested function is declared as `outer.inner`, and uses
  // the type parameters of `outer`.
  let outer = "";
  return source
    .split("\n")
    .map(line => {
      const def = /^(\s*)def (\w+)\((.*)\):$/.exec(line);
      if (!def) return line;
      const [, indent, name, parameterNames] = def;
      if (indent === "") outer = name;
      const key = indent === "" ? name : `${outer}.${name}`;
      const declaration = declarations.get(key);
      if (!declaration)
        throw new Error(`no declaration of ${key}: add it to prelude.pyi or helper-types.txt`);
      return `${indent}def ${renderSignature(key, splitTopLevel(parameterNames), declaration, name)}:`;
    })
    .join("\n");
}

/** The appendix "Types of the predeclared names": the declarations of the prelude, by group, as a listing. */
export function typesAppendix(prelude: string): string {
  const groups = groupsOf(prelude);
  return [
    "\\section*{Appendix: Types of the predeclared names}",
    "",
    "The predeclared names have the following types. \\lstinline{TypeIs[T]} means \\lstinline{bool}, and in",
    "addition narrows the type of the argument to \\lstinline{T}; \\lstinline{TypeGuard[T]} also means",
    "\\lstinline{bool}, but narrows the type only where the result is true. \\lstinline{is_float} and",
    "\\lstinline{is_complex} have it, because the checker takes an \\lstinline{int} for a \\lstinline{float}",
    "and a \\lstinline{complex}, although \\lstinline{is_float(5)} is false. \\lstinline{NoReturn} is the result of a",
    "function that never returns. In the \\lstinline{TypeIs} of \\lstinline{is_pair} and \\lstinline{is_list},",
    "\\lstinline{object} stands for the types of the components and elements, which the checker does not know:",
    "it accepts any type there, so that narrowing a union keeps its pairs and its lists.",
    "\\lstinline{tail} and \\lstinline{stream_tail} have two declarations: the first is for linked lists and",
    "streams, so that the tail of an \\lstinline{LList[int]} is an \\lstinline{LList[int]}, and the second is for",
    "any other pair.",
    "The names \\lstinline{print}, \\lstinline{len}, \\lstinline{abs}, \\lstinline{max}, \\lstinline{min},",
    "\\lstinline{round}, \\lstinline{input}, \\lstinline{repr}, \\lstinline{str} and \\lstinline{complex} have the",
    "types that Python's standard library gives them (but \\lstinline{bool} is not a number).",
    "",
    ...groups.flatMap(({ title, lines }) => [
      `\\subsection*{${title}}`,
      "\\begin{lstlisting}[language=Python]",
      ...lines,
      "\\end{lstlisting}",
      "",
    ]),
  ].join("\n");
}

if (require.main === module) {
  const prelude = readFileSync("src/typecheck/prelude.pyi", "utf8");
  const helpers = readFileSync("docs/lib/helper-types.txt", "utf8");
  const declarations = declarationsOf(prelude, helpers);
  mkdirSync("docs/specs/generated", { recursive: true });
  for (const name of ["linked_list", "stream"])
    writeFileSync(
      `docs/specs/generated/${name}_typed.py`,
      typedListing(readFileSync(`docs/lib/${name}.py`, "utf8"), declarations),
    );
  writeFileSync("docs/specs/generated/python_typed_names.tex", typesAppendix(prelude));
}
