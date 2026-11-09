import { readFileSync } from "node:fs";
import { groupsOf, renderTypes } from "../../scripts/typed-readme";

const prelude = readFileSync("src/typecheck/prelude.pyi", "utf8");

describe("the types of the predeclared names in the documentation of Python §4 Typed", () => {
  const groups = groupsOf(prelude);
  const lines = groups.flatMap(group => group.lines);

  test("are the declarations that the type checker uses, as a student sees them", () => {
    expect(groups.map(group => group.title)).toEqual([
      "misc",
      "pairs and linked lists",
      "pair mutators",
      "streams",
      "math",
    ]);
    expect(lines).toContain("def head[H](p: Pair[H, Any], /) -> H");
    expect(lines).toContain("def map[A, B](f: Callable[[A], B], xs: LList[A], /) -> LList[B]");
    expect(lines).toContain("def is_none(x: object, /) -> TypeIs[None]");
    expect(lines).toContain("math_pi: float");
  });

  test("leave out the private helpers of the declarations", () => {
    expect(lines.filter(line => /\b_[A-Za-z]/.test(line))).toEqual([]);
    expect(lines.some(line => line.startsWith("_"))).toBe(false);
  });

  test("have the HTML escaped", () => {
    const html = renderTypes(prelude);
    expect(html).toContain("def head[H](p: Pair[H, Any], /) -&gt; H");
    expect(html).not.toMatch(/-> H/);
  });

  test("have a place in the template of the page", () => {
    expect(readFileSync("docs/md/README_4_typed.md", "utf8")).toContain("<!-- PRELUDE -->");
  });
});
