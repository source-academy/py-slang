import { ensureTypedPython4Checker } from "../typecheck/bundler/typed4";
import { nodeWorkerFactory } from "../typecheck/node-worker";
import {
  toStub,
  TypedPythonChecker,
  UnknownDescriptionError,
  type ModuleDescription,
  type TypeDiagnostic,
} from "../typecheck";
import { CHECKER_SETUP_TIMEOUT_MS, startTypedChecker } from "./typecheck-harness";

jest.setTimeout(60_000);

const errors = (diagnostics: TypeDiagnostic[]) => diagnostics.filter(d => d.severity === "error");

describe("the stub that a description becomes", () => {
  const description: ModuleDescription = {
    version: 1,
    module: "demo",
    opaqueTypes: ["Thing"],
    functions: [
      {
        name: "make",
        params: [
          { name: "size", type: "number" },
          { name: "label", type: "string" },
        ],
        returns: { opaque: "Thing" },
      },
      {
        name: "each",
        params: [
          { name: "f", type: { function: { params: ["integer"], returns: "boolean" } } },
          { name: "xs", type: { list: "integer" } },
        ],
        returns: { pair: [{ array: "number" }, "void"] },
      },
      { name: "now", params: [], returns: "integer" },
    ],
    constants: [{ name: "origin", type: { opaque: "Thing" } }],
  };

  test("every kind of type has its Python type; the parameters are positional", () => {
    expect(toStub(description)).toBe(
      [
        "from typing import Callable, NoReturn",
        "class Thing:",
        "    def __init__(self, _never: NoReturn, /) -> None: ...",
        "def make(size: float, label: str, /) -> Thing: ...",
        "def each(f: Callable[[int], bool], xs: LList[int], /) -> Pair[list[float], None]: ...",
        "def now() -> int: ...",
        "origin: Thing",
        "",
      ].join("\n"),
    );
  });

  test("what this version does not know is rejected, not guessed", () => {
    expect(() => toStub({ ...description, version: 2 as 1 })).toThrow(UnknownDescriptionError);
    expect(() =>
      toStub({ ...description, constants: [{ name: "x", type: { set: "number" } as never }] }),
    ).toThrow(/not supported by this version/);
    expect(() =>
      toStub({ ...description, constants: [{ name: "x", type: { opaque: "Other" } }] }),
    ).toThrow(/Other is not declared/);
  });
});

describe("programs that import a module", () => {
  let checker: TypedPythonChecker;
  beforeAll(async () => {
    checker = await startTypedChecker();
  }, CHECKER_SETUP_TIMEOUT_MS);
  afterAll(() => checker.dispose());

  test("a correct use of rune is accepted, also with a callback", async () => {
    expect(
      errors(
        await checker.check(
          "from rune import heart, circle, beside, stack, show, animate_rune, rotate\n" +
            "show(stack(beside(heart, circle), circle))\n" +
            "animate_rune(1, 20, lambda t: rotate(t, heart))\n",
        ),
      ),
    ).toEqual([]);
  });

  test.each([
    [
      "a number where a rune is wanted",
      "from rune import heart, beside\nbeside(heart, 3)\n",
      /rune2/,
    ],
    [
      "a callback that returns a number",
      "from rune import animate_rune\nanimate_rune(1, 20, lambda t: t * 2)\n",
      /func|lambda|Rune/,
    ],
    ["a name that the module does not have", "from rune import flower\n", /flower/],
  ])("%s is an error", async (_, program, message) => {
    const found = errors(await checker.check(program));
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].message).toMatch(message);
  });

  test("a program cannot make a value of an opaque type", async () => {
    for (const program of ["Rune()\n", "Rune(1)\n", "Rune(heart)\n"])
      expect(
        errors(await checker.check(`from rune import Rune, heart\n${program}`)).length,
      ).toBeGreaterThan(0);
  });

  test("a module with no description cannot be imported, and the message says why", async () => {
    const [error] = errors(await checker.check("from nothing import x\n"));
    expect(error.message).toBe(
      "The module nothing cannot be imported: its types are not known to Typed Python §4",
    );
  });

  test("a REPL chunk uses what an earlier chunk imported from a module", async () => {
    expect(errors(await checker.checkChunk("from rune import heart, scale\n"))).toEqual([]);
    expect(errors(await checker.checkChunk("scale(2, heart)\n"))).toEqual([]);
    // both arguments are of the wrong type
    expect(errors(await checker.checkChunk("scale(heart, 2)\n"))).toHaveLength(2);
  });
});

describe("a description that this version cannot read", () => {
  test(
    "is an error at the first line, with the reason",
    async () => {
      const worker = await ensureTypedPython4Checker();
      const checker = await TypedPythonChecker.start(nodeWorkerFactory(worker), () => ({
        version: 2 as 1,
        module: "future",
        opaqueTypes: [],
        functions: [],
        constants: [],
      }));
      try {
        const [error] = errors(await checker.check("from future import x\n"));
        expect(error).toMatchObject({ line: 1 });
        expect(error.message).toMatch(/The types of the module future cannot be used: .*version 2/);
      } finally {
        checker.dispose();
      }
    },
    CHECKER_SETUP_TIMEOUT_MS,
  );
});
