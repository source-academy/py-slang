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
          { name: "f", type: { function: { params: ["number"], returns: "boolean" } } },
          { name: "xs", type: { list: "integer" } },
        ],
        returns: { pair: [{ array: "number" }, "void"] },
      },
      { name: "now", params: [], returns: "number" },
    ],
    constants: [{ name: "origin", type: { opaque: "Thing" } }],
  };

  test("every kind of type has its Python type; the parameters are positional", () => {
    expect(toStub(description)).toBe(
      [
        "from typing import Callable as _Callable, NoReturn as _NoReturn",
        "from __builtins__ import LList as _LList, Pair as _Pair",
        "class Thing:",
        "    def __init__(self, _never: _NoReturn, /) -> None: ...",
        "def make(size: int | float, label: str, /) -> Thing: ...",
        "def each(f: _Callable[[float], bool], xs: _LList[int], /) -> _Pair[list[float], None]: ...",
        "def now() -> float: ...",
        "origin: Thing",
        "",
      ].join("\n"),
    );
  });

  test("an opaque type with type parameters, a type parameter, and a value of any type", () => {
    const stub = toStub({
      version: 1,
      module: "box",
      opaqueTypes: [{ name: "Box", typeParameters: ["A"] }],
      functions: [
        {
          name: "wrap",
          typeParameters: ["A"],
          params: [{ name: "x", type: { parameter: "A" } }],
          returns: { opaque: "Box", arguments: [{ parameter: "A" }] },
        },
        { name: "is_box", params: [{ name: "x", type: "any" }], returns: "boolean" },
      ],
      constants: [],
    });
    expect(stub).toContain("class Box[A]:\n    type_parameter_A: A\n");
    expect(stub).toContain("def wrap[A](x: A, /) -> Box[A]: ...");
    expect(stub).toContain("def is_box(x: object, /) -> bool: ...");
  });

  test("a type parameter that is not declared, or an opaque type with the wrong number of them", () => {
    const base: ModuleDescription = {
      version: 1,
      module: "box",
      opaqueTypes: [{ name: "Box", typeParameters: ["A"] }],
      functions: [],
      constants: [],
    };
    expect(() =>
      toStub({
        ...base,
        functions: [{ name: "f", params: [], returns: { parameter: "A" } }],
      }),
    ).toThrow(/type parameter A is not declared/);
    expect(() =>
      toStub({
        ...base,
        functions: [{ name: "f", params: [], returns: { opaque: "Box" } }],
      }),
    ).toThrow(/Box has 1 type parameters, not 0/);
  });

  test("a number is int | float going in and float coming out; a callback turns that around", () => {
    const stub = toStub({
      version: 1,
      module: "nums",
      opaqueTypes: [],
      functions: [
        {
          name: "each",
          params: [
            { name: "n", type: "integer" },
            { name: "x", type: "number" },
            { name: "f", type: { function: { params: ["number"], returns: "number" } } },
          ],
          returns: { function: { params: ["number"], returns: "number" } },
        },
      ],
      constants: [{ name: "pi", type: "number" }],
    });
    expect(stub).toContain(
      "def each(n: int, x: int | float, f: _Callable[[float], int | float], /) -> _Callable[[int | float], float]: ...",
    );
    expect(stub).toContain("pi: float");
  });

  test("an array has the same element type going in and coming out, as it is invariant", () => {
    const stub = toStub({
      version: 1,
      module: "arrays",
      opaqueTypes: [],
      functions: [
        {
          name: "twice",
          params: [{ name: "xs", type: { array: "number" } }],
          returns: { array: "number" },
        },
      ],
      constants: [],
    });
    expect(stub).toContain("def twice(xs: list[float], /) -> list[float]: ...");
  });

  test("an integer is for a parameter: a result comes back as a float", () => {
    const base: ModuleDescription = {
      version: 1,
      module: "nums",
      opaqueTypes: [],
      functions: [],
      constants: [],
    };
    expect(() =>
      toStub({ ...base, functions: [{ name: "f", params: [], returns: "integer" }] }),
    ).toThrow(/integer is for a parameter/);
    // The parameter of a callback that a program passes in is received by the program.
    expect(() =>
      toStub({
        ...base,
        functions: [
          {
            name: "f",
            params: [{ name: "g", type: { function: { params: ["integer"], returns: "void" } } }],
            returns: "void",
          },
        ],
      }),
    ).toThrow(/integer is for a parameter/);
  });

  test("what this version does not know is rejected, not guessed", () => {
    expect(() => toStub({ ...description, version: 2 as 1 })).toThrow(UnknownDescriptionError);
    expect(() =>
      toStub({ ...description, constants: [{ name: "x", type: { set: "number" } as never }] }),
    ).toThrow(/cannot be used by this version/);
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
      "The module nothing cannot be imported: its types are not known to Python §4 Typed",
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

describe("descriptions that make a stub that does not check", () => {
  const withSource = async (description: ModuleDescription) =>
    TypedPythonChecker.start(
      nodeWorkerFactory(await ensureTypedPython4Checker()),
      () => description,
    );

  test("names that are not names, or that change what the stub means, are rejected by the mapper", () => {
    const base: ModuleDescription = {
      version: 1,
      module: "odd",
      opaqueTypes: [],
      functions: [],
      constants: [],
    };
    expect(() => toStub({ ...base, opaqueTypes: ["int"] })).toThrow(/cannot be named int/);
    expect(() => toStub({ ...base, opaqueTypes: ["class"] })).toThrow(/not a name for a type/);
    expect(() =>
      toStub({ ...base, functions: [{ name: "a-b", params: [], returns: "void" }] }),
    ).toThrow(/not a name for a function/);
  });

  test(
    "a stub that has an error in it is reported, and programs are not checked against it",
    async () => {
      // What the mapper cannot know: a parameter that is named twice.
      const checker = await withSource({
        version: 1,
        module: "odd",
        opaqueTypes: [],
        functions: [
          {
            name: "f",
            params: [
              { name: "x", type: "integer" },
              { name: "x", type: "integer" },
            ],
            returns: "void",
          },
        ],
        constants: [],
      });
      try {
        const found = errors(await checker.check("from odd import f\nf(1, 2)\n"));
        expect(found[0].message).toMatch(
          /The types of the module odd cannot be used: .*its stub has an error/,
        );
      } finally {
        checker.dispose();
      }
    },
    CHECKER_SETUP_TIMEOUT_MS,
  );

  test(
    "the description of another module is not used for the module that was asked for",
    async () => {
      const checker = await withSource({
        version: 1,
        module: "bar",
        opaqueTypes: [],
        functions: [{ name: "f", params: [], returns: "void" }],
        constants: [],
      });
      try {
        const found = errors(await checker.check("from foo import f\nf()\n"));
        expect(found[0].message).toMatch(/cannot be used.*describes the module bar, not foo/);
      } finally {
        checker.dispose();
      }
    },
    CHECKER_SETUP_TIMEOUT_MS,
  );

  test(
    "a module with a dotted name is found where a program imports it",
    async () => {
      const checker = await withSource({
        version: 1,
        module: "pkg.sub",
        opaqueTypes: [],
        functions: [{ name: "f", params: [{ name: "x", type: "integer" }], returns: "number" }],
        constants: [],
      });
      try {
        expect(errors(await checker.check("from pkg.sub import f\nf(1)\n"))).toEqual([]);
        expect(errors(await checker.check('from pkg.sub import f\nf("a")\n'))).toHaveLength(1);
      } finally {
        checker.dispose();
      }
    },
    CHECKER_SETUP_TIMEOUT_MS,
  );
});

describe("the temporary descriptions of curve, sound and binary_tree", () => {
  let checker: TypedPythonChecker;
  beforeAll(async () => {
    checker = await startTypedChecker();
  }, CHECKER_SETUP_TIMEOUT_MS);
  afterAll(() => checker.dispose());

  const accepted = async (program: string) => errors(await checker.check(program));

  test("curve: curves are functions, and are combined, transformed and drawn", async () => {
    expect(
      await accepted(
        "from curve import unit_circle, connect_ends, translate, scale_proportional, draw_connected, unit_line, make_point, x_of, animate_curve, put_in_standard_position\n" +
          "c = connect_ends(unit_circle, translate(1, 0, 0)(unit_line))\n" +
          "draw_connected(200)(scale_proportional(0.5)(put_in_standard_position(c)))\n" +
          "x_of(unit_circle(0.5))\n" +
          "animate_curve(1, 20, draw_connected(100), lambda t: translate(t, 0, 0)(unit_circle))\n",
      ),
    ).toEqual([]);
  });

  test.each([
    ["a number where a curve is wanted", "from curve import invert\ninvert(3)\n"],
    [
      "a point where a curve is wanted",
      "from curve import invert, make_point\ninvert(make_point(1, 2))\n",
    ],
    ["a curve where a point is wanted", "from curve import x_of, unit_circle\nx_of(unit_circle)\n"],
    [
      "an animation function that returns a point",
      "from curve import animate_curve, draw_connected, unit_circle\nanimate_curve(1, 20, draw_connected(10), lambda t: unit_circle(t))\n",
    ],
  ])("curve: %s is an error", async (_, program) => {
    expect((await accepted(program)).length).toBeGreaterThan(0);
  });

  test("sound: sounds are made, combined, transformed and played; recordings are functions", async () => {
    expect(
      await accepted(
        "from sound import sine_sound, square_sound, consecutively, simultaneously, adsr, stacking_adsr, play, make_sound, get_duration, record_for, pan, bell\n" +
          "s = consecutively(llist(sine_sound(440, 1), square_sound(220, 2)))\n" +
          "play(adsr(0.1, 0.2, 0.5, 0.2)(simultaneously(llist(s, bell(60, 1)))))\n" +
          "play(pan(0.5)(make_sound(lambda t: math_sin(t * 440), 2)))\n" +
          "stacking_adsr(sine_sound, 300, 5, llist(adsr(0.1, 0.3, 0.2, 0.5)))\n" +
          "d: float = get_duration(s)\n" +
          "play(record_for(1, 0.5)())\n",
      ),
    ).toEqual([]);
  });

  test.each([
    ["a wave where a sound is wanted", "from sound import play, sine_wave\nplay(sine_wave(440))\n"],
    [
      "a list of numbers of sounds",
      "from sound import consecutively\nconsecutively(llist(1, 2))\n",
    ],
    [
      "a wave that returns a string",
      "from sound import make_sound\nmake_sound(lambda t: 'a', 1)\n",
    ],
    ["a sound used as a pair", "from sound import sine_sound\nhead(sine_sound(440, 1))\n"],
    ["an envelope applied to a number", "from sound import adsr\nadsr(0.1, 0.2, 0.5, 0.2)(3)\n"],
  ])("sound: %s is an error", async (_, program) => {
    expect((await accepted(program)).length).toBeGreaterThan(0);
  });

  test("binary_tree: a tree has the type of its entries, which is checked", async () => {
    expect(
      await accepted(
        "from binary_tree import make_tree, make_empty_tree, entry, left_branch, is_empty_tree, is_tree\n" +
          "t = make_tree(1, make_tree(2, make_empty_tree(), make_empty_tree()), make_empty_tree())\n" +
          "x: int = entry(left_branch(t))\n" +
          "b: bool = is_empty_tree(5) or is_tree(t)\n",
      ),
    ).toEqual([]);
  });

  test.each([
    [
      "an entry of the wrong type",
      "from binary_tree import make_tree, make_empty_tree, entry\nt = make_tree(1, make_empty_tree(), make_empty_tree())\ns: str = entry(t)\n",
    ],
    [
      "a subtree with another type of entries",
      "from binary_tree import make_tree, make_empty_tree\na = make_tree(1, make_empty_tree(), make_empty_tree())\nb = make_tree('a', make_empty_tree(), make_empty_tree())\nmake_tree(2, a, b)\n",
    ],
    ["a number where a tree is wanted", "from binary_tree import entry\nentry(3)\n"],
    [
      "a tree that is taken apart as a pair",
      "from binary_tree import make_tree, make_empty_tree\nhead(make_tree(1, make_empty_tree(), make_empty_tree()))\n",
    ],
  ])("binary_tree: %s is an error", async (_, program) => {
    expect((await accepted(program)).length).toBeGreaterThan(0);
  });
});

describe("whole numbers and numbers in programs that use a module", () => {
  let checker: TypedPythonChecker;
  beforeAll(async () => {
    checker = await startTypedChecker();
  }, CHECKER_SETUP_TIMEOUT_MS);
  afterAll(() => checker.dispose());

  test("an int is accepted where a number is wanted, a float where a whole number is wanted is not", async () => {
    expect(
      errors(
        await checker.check(
          "from rune import stackn, heart, scale\nstackn(3, scale(2, heart))\nscale(0.5, heart)\n",
        ),
      ),
    ).toEqual([]);
    const [error] = errors(
      await checker.check("from rune import stackn, heart\nstackn(2.5, heart)\n"),
    );
    expect(error.message).toBe("stackn expects n to be int, but got float");
    expect(
      errors(await checker.check("from curve import draw_connected\ndraw_connected(200)\n")),
    ).toEqual([]);
    expect(
      errors(await checker.check("from curve import draw_connected\ndraw_connected(200.5)\n")),
    ).toHaveLength(1);
  });

  test("a callback gets a float, and may return an int or a float", async () => {
    expect(
      errors(
        await checker.check(
          "from sound import make_sound\nmake_sound(lambda t: 1, 2)\nmake_sound(lambda t: t * 0.5, 2)\n",
        ),
      ),
    ).toEqual([]);
    // a function that wants an int is called with a float
    expect(
      errors(
        await checker.check(
          "from sound import make_sound\ndef wave(t: int) -> float:\n    return 0.5\nmake_sound(wave, 2)\n",
        ),
      ).length,
    ).toBeGreaterThan(0);
  });

  test("a result is a float: it is not an int", async () => {
    expect(
      errors(
        await checker.check(
          "from sound import get_duration, sine_sound\nd: int = get_duration(sine_sound(440, 1))\n",
        ),
      ).length,
    ).toBeGreaterThan(0);
  });
});
