import { readFileSync } from "node:fs";
import { declarationsFor, LIBRARIES, typedLibrary } from "../../scripts/typed-lib";

const declarations = declarationsFor(
  readFileSync("src/typecheck/prelude.pyi", "utf8"),
  readFileSync("docs/lib/helper-types.txt", "utf8"),
  readFileSync("docs/lib/builtin-types.txt", "utf8"),
);
const typed = (name: string) =>
  typedLibrary(readFileSync(`docs/lib/${name}.js`, "utf8"), declarations);

describe("the library documentation of Python §4 Typed", () => {
  test.each(LIBRARIES)(
    "every function and constant in %s has a type (a new documented name needs one)",
    name => {
      expect(() => typed(name)).not.toThrow();
    },
  );

  test("a missing declaration is reported by name", () => {
    expect(() =>
      typedLibrary("/**\n * Adds.\n */\nfunction unknown_name(x) {}\n", declarations),
    ).toThrow(/no declaration of unknown_name/);
  });

  test("starts each comment with the signature, under the parameter names of the documentation", () => {
    const linkedList = typed("linked_list");
    expect(linkedList).toContain(" * <CODE>def head[H](p: Pair[H, Any]) -&gt; H</CODE>");
    expect(linkedList).toContain(" * <CODE>def pair[H, T](x: H, y: T) -&gt; Pair[H, T]</CODE>");
    // the documentation writes draw_data(...values); the declaration is (value1, *values)
    expect(linkedList).toContain("def draw_data[A](value1: A, *values: Any) -&gt; A");
    expect(typed("math")).toContain(" * <CODE>math_pi: float</CODE>");
    expect(typed("stream")).toContain("def stream[A](*elements: A) -&gt; Stream[A]");
  });

  test("has the types of the names that the checker takes from the standard library", () => {
    const misc = typed("misc");
    expect(misc).toContain("def print(*object: object) -&gt; None");
    expect(misc).toContain("def round(number: int | float, ndigits: int = ...) -&gt; int | float");
  });

  test("says that the types of the names of the meta-circular evaluator are not fixed", () => {
    expect(typed("mce")).toContain("<CODE>parse: its type is not fixed yet</CODE>");
  });

  test("leaves no informal type in a tag (jsdoc cannot read a Python type there), and no `/`", () => {
    for (const name of LIBRARIES) {
      const text = typed(name);
      expect(text.match(/@(?:param|returns?|const|constant)\s+\{/g) ?? []).toEqual([]);
      expect(text).not.toMatch(/<CODE>[^<]*, \/[,)]/);
    }
  });

  test("keep the documentation parameters that the declaration does not have out of the signature", () => {
    // math_nextafter documents `steps`, but takes two arguments
    expect(typed("math")).toContain(
      "def math_nextafter(x: int | float, y: int | float) -&gt; float",
    );
  });
});
