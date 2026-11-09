/**
 * The library documentation of Python §4 Typed (docs/lib/*.js, the sources of the pages of the predeclared
 * names), with the types of the language: the types come from the declarations that the type checker uses
 * (src/typecheck/prelude.pyi) and, for the names that it takes from Python's standard library,
 * docs/lib/builtin-types.txt.
 *
 * In the documentation comment of each function (and constant) the signature, `def map[A, B](f: ..., xs: ...)
 * -> LList[B]`, is put first, and the informal types of the tags (`{value}`, `{pair}`) are removed: a tag
 * cannot hold a Python type (`LList[A]` is not a type that jsdoc can read), and the signature has them.
 *
 *     tsx scripts/typed-lib.ts <output directory>
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  constantsOf,
  declarationsOf,
  renderSignature,
  splitTopLevel,
  type Declaration,
} from "./typed-spec";

/** The names whose types are not fixed yet (py-slang issue 631). */
const NOT_FIXED = new Set(["tokenize", "parse", "apply_in_underlying_python"]);

/**
 * Parameters that the documentation has and the type checker's declaration does not: `math_nextafter` documents
 * `steps`, but it takes two arguments (and is not implemented yet). They are left out of the signature.
 */
const DOCUMENTED_ONLY: Record<string, string[]> = { math_nextafter: ["steps"] };

/** Where the documentation writes the parameters in another way than the declaration: `draw_data(...values)` is `(value1, *values)`. */
const PARAMETER_NAMES: Record<string, string[]> = {
  draw_data: ["value1", "*values"],
  stream: ["*elements"],
};

export interface Declarations {
  functions: Map<string, Declaration>;
  constants: Map<string, string>;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** `x, y = 1, ...args` as the names of a signature: `x`, `y`, `*args` (a default value is left out). */
function parameterNames(list: string): string[] {
  return splitTopLevel(list).map(part => {
    const name = part.split("=")[0].trim();
    return name.startsWith("...") ? `*${name.slice(3)}` : name;
  });
}

/** What a documentation comment says about the type of the name: its signature, first; no informal types in the tags. */
function typedComment(comment: string, signature: string): string {
  const lines = comment.split("\n");
  const tags = lines.map(line =>
    line.replace(/^(\s*\* @(?:param|returns?|const|constant))\s+\{[^}]*\}/, "$1"),
  );
  return [tags[0], ` * <CODE>${escapeHtml(signature)}</CODE>`, " *", ...tags.slice(1)].join("\n");
}

/**
 * The text of a library source with the types of its functions and constants. A function or constant without
 * a declaration is an error: add it to prelude.pyi (if the checker declares it) or to builtin-types.txt.
 */
export function typedLibrary(source: string, declarations: Declarations): string {
  const problems: string[] = [];
  const documented =
    /(\/\*\*[\s\S]*?\*\/)(\s*\n)(function\s+(\w+)\s*\(([^)]*)\)|const\s+(\w+)\s*=)/g;
  const result = source.replace(
    documented,
    (
      _,
      comment: string,
      gap: string,
      definition: string,
      fn?: string,
      params?: string,
      constant?: string,
    ) => {
      let signature = "";
      try {
        if (fn !== undefined) {
          const declaration = declarations.functions.get(fn);
          if (NOT_FIXED.has(fn)) signature = `${fn}: its type is not fixed yet`;
          else if (!declaration)
            throw new Error(`no declaration of ${fn}: add it to prelude.pyi or builtin-types.txt`);
          else {
            const names =
              PARAMETER_NAMES[fn] ??
              parameterNames(params ?? "").filter(name => !DOCUMENTED_ONLY[fn]?.includes(name));
            signature = `def ${renderSignature(fn, names, declaration, fn, false)}`;
          }
        } else {
          const type = declarations.constants.get(constant!);
          if (!type) throw new Error(`no declaration of ${constant}: add it to prelude.pyi`);
          signature = `${constant}: ${type}`;
        }
      } catch (error) {
        problems.push((error as Error).message);
      }
      return typedComment(comment, signature) + gap + definition;
    },
  );
  if (problems.length > 0) throw new Error(problems.join("\n"));
  return result;
}

export function declarationsFor(prelude: string, helpers: string, builtins: string): Declarations {
  return {
    functions: declarationsOf(prelude, `${helpers}\n${builtins}`),
    constants: constantsOf(prelude),
  };
}

export const LIBRARIES = ["misc", "math", "linked_list", "pairmutator", "list", "stream", "mce"];

if (require.main === module) {
  const [output] = process.argv.slice(2);
  const declarations = declarationsFor(
    readFileSync("src/typecheck/prelude.pyi", "utf8"),
    readFileSync("docs/lib/helper-types.txt", "utf8"),
    readFileSync("docs/lib/builtin-types.txt", "utf8"),
  );
  mkdirSync(output, { recursive: true });
  for (const name of [...LIBRARIES, "empty"])
    writeFileSync(
      `${output}/${name}.js`,
      typedLibrary(readFileSync(`docs/lib/${name}.js`, "utf8"), declarations),
    );
}
