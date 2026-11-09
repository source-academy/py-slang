import { readFileSync } from "node:fs";
import { renderModules, groupsOf, renderTypes, type ModuleDocs } from "../../scripts/typed-readme";
import { signaturesOf } from "../typecheck/module-description";
import { temporaryModuleDescriptions } from "../typecheck/modules";

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
    expect(lines).toContain("def head[H, T](p: Pair[H, T]) -> H");
    expect(lines).toContain("def map[A, B](f: Callable[[A], B], xs: LList[A]) -> LList[B]");
    expect(lines).toContain("def is_none(x: object) -> TypeIs[None]");
    expect(lines).toContain("math_pi: float");
  });

  test("leave out the private helpers of the declarations", () => {
    expect(lines.filter(line => /\b_[A-Za-z]/.test(line))).toEqual([]);
    expect(lines.some(line => line.startsWith("_"))).toBe(false);
  });

  test("have the HTML escaped", () => {
    const html = renderTypes(prelude);
    expect(html).toContain("def head[H, T](p: Pair[H, T]) -&gt; H");
    expect(html).not.toMatch(/-> H/);
  });

  test("have a place in the template of the page", () => {
    expect(readFileSync("docs/md/README_4_typed.md", "utf8")).toContain("<!-- PRELUDE -->");
  });
});

describe("the types of the modules in the documentation of Python §4 Typed", () => {
  const docs = JSON.parse(readFileSync("docs/md/module-types.json", "utf8")) as Record<
    string,
    ModuleDocs
  >;
  const descriptions = temporaryModuleDescriptions();

  test("every type that a module defines is explained, and nothing is explained that does not exist", () => {
    for (const description of descriptions) {
      const defined = signaturesOf(description)
        .types.map(type => type.name)
        .sort();
      expect(Object.keys(docs[description.module]?.types ?? {}).sort()).toEqual(defined);
    }
    expect(Object.keys(docs).filter(name => !descriptions.some(d => d.module === name))).toEqual(
      [],
    );
  });

  test("show the names with their Python types, and the types that a module defines", () => {
    const html = renderModules(descriptions, docs);
    expect(html).toContain("<h3>rune</h3>");
    expect(html).toContain("def beside(rune1: Rune, rune2: Rune) -&gt; Rune");
    expect(html).toContain("<code>BinaryTree[A]</code>: a binary tree");
    expect(html).toContain("def entry[A](t: BinaryTree[A]) -&gt; A");
    expect(html).toContain("heart: Rune");
    // the private helpers of the stubs are not shown
    expect(html).not.toMatch(/\b_(Callable|LList|Pair)\b/);
  });
});
