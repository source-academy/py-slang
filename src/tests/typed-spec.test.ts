import { readFileSync } from "node:fs";
import {
  declarationsOf,
  parseDeclaration,
  typedListing,
  typesAppendix,
} from "../../scripts/typed-spec";
import { startTypedChecker, CHECKER_SETUP_TIMEOUT_MS } from "./typecheck-harness";
import type { TypedPythonChecker } from "../typecheck";

jest.setTimeout(120_000);

const prelude = readFileSync("src/typecheck/prelude.pyi", "utf8");
const helpers = readFileSync("docs/lib/helper-types.txt", "utf8");
const declarations = declarationsOf(prelude, helpers);

describe("a declaration", () => {
  test("is parsed into its type parameters, parameters and result", () => {
    expect(
      parseDeclaration("def map[A, B](f: Callable[[A], B], xs: LList[A], /) -> LList[B]"),
    ).toEqual({
      name: "map",
      typeParameters: ["A", "B"],
      parameters: [
        { star: false, type: "Callable[[A], B]" },
        { star: false, type: "LList[A]" },
      ],
      returns: "LList[B]",
    });
    expect(parseDeclaration("def llist[A](*xs: A) -> LList[A]").parameters).toEqual([
      { star: true, type: "A" },
    ]);
  });
});

describe("the typed listings of the library", () => {
  const listing = (name: string) =>
    typedListing(readFileSync(`docs/lib/${name}.py`, "utf8"), declarations);

  test("give each function the types of its declaration, under the names of the listing", () => {
    const text = listing("linked_list");
    expect(text).toContain("def map[A, B](f: Callable[[A], B], xs: LList[A]) -> LList[B]:");
    expect(text).toContain("def pair[H, T](x: H, y: T) -> Pair[H, T]:");
    expect(text).toContain("def llist[A](*values: A) -> LList[A]:");
    // a type that a program cannot write is a type parameter of its own, or bool
    expect(text).toContain("def head[H, X1](p: Pair[H, X1]) -> H:");
    expect(text).toContain("def is_pair(x: object) -> bool:");
    expect(text).not.toMatch(/\bAny\b|TypeIs/);
    // the helpers, which the checker does not predeclare
    expect(text).toContain("def _length[A](xs: LList[A], acc: int) -> int:");
  });

  test("have a declaration for every function of the listings (a new one needs its types)", () => {
    expect(() => listing("linked_list")).not.toThrow();
    expect(() => listing("stream")).not.toThrow();
    expect(() => typedListing("def unknown_function(x):\n    pass\n", declarations)).toThrow(
      /no declaration of unknown_function/,
    );
  });

  describe("are programs of Python §4 Typed", () => {
    let checker: TypedPythonChecker;
    beforeAll(async () => {
      checker = await startTypedChecker();
    }, CHECKER_SETUP_TIMEOUT_MS);
    afterAll(() => checker.dispose());

    /** The functions of a listing that are not primitive: their bodies are programs. The primitives are
     * only documented (their body is `pass`), and the checker predeclares them. */
    const implemented = (text: string) =>
      text
        .split(/^(?=def )/m)
        .filter(block => !block.includes("PRIMITIVE"))
        // These two assume that the stream has enough elements, as the specification says: the stream
        // can be None.
        .filter(block => !/^def (stream_ref|eval_stream)[[(]/.test(block))
        .join("");

    test.each(["linked_list", "stream"])(
      "the implementations in %s have no type errors",
      async name => {
        const errors = (await checker.check(implemented(listing(name)))).filter(
          d => d.severity === "error",
        );
        expect(errors.map(d => `line ${d.line}: ${d.message}`)).toEqual([]);
      },
    );
  });
});

describe("the appendix of the types of the predeclared names", () => {
  test("lists the declarations of the checker, in listings", () => {
    const tex = typesAppendix(prelude);
    expect(tex).toContain("\\subsection*{pairs and linked lists}");
    expect(tex).toContain("def head[H](p: Pair[H, Any], /) -> H");
    expect(tex).toContain("math_pi: float");
  });
});
