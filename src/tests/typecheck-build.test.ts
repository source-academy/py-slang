import { parse } from "acorn";
import { buildWorkerBundle, readWorkerBundle, stdlibClosure } from "../typecheck/bundler/bundle";
import { patchSourceBuiltins, patchSourceTypes } from "../typecheck/bundler/source-builtins";

/** A bundle like the real one, but small: a JavaScript file with a map of typeshed files in it. */
function fakeBundle(files: Record<string, string>): string {
  // Other objects in the file have a few of these keys: the map is the one with the most.
  const padding = Object.fromEntries(
    Array.from({ length: 100 }, (_, i) => [`stubs/pkg${i}/__init__.pyi`, `# ${i}`]),
  );
  const entries = Object.entries({ ...files, ...padding })
    .map(
      ([path, text]) => `${JSON.stringify("/typeshed-fallback/" + path)}:${JSON.stringify(text)}`,
    )
    .join(",\n");
  return `var other = {a: 1};\nconst typeshed = {\n${entries}\n};\nmodule.exports = typeshed;\n`;
}

const STDLIB = {
  "stdlib/VERSIONS": "builtins: 3.0-\n",
  "stdlib/builtins.pyi": "from typing import Any\nfrom _typeshed import Incomplete\n",
  "stdlib/typing.pyi": "import collections.abc\nfrom types import ModuleType\n",
  "stdlib/_typeshed/__init__.pyi": "from . import helper\nfrom .helper import X\n",
  "stdlib/_typeshed/helper.pyi": "X = 1\n",
  "stdlib/types.pyi": "",
  "stdlib/collections/__init__.pyi": "from _collections_abc import dict_keys\n",
  "stdlib/collections/abc.pyi": "from _collections_abc import *\n",
  "stdlib/_collections_abc.pyi": "",
  "stdlib/os/__init__.pyi": "import sys\n",
  "stdlib/sys.pyi": "",
  "stdlib/json/__init__.pyi": "",
};

describe("building the worker", () => {
  const source = fakeBundle(STDLIB);

  test("the typeshed in a bundle is found", () => {
    const bundle = readWorkerBundle(source);
    expect(bundle.files.size).toBe(Object.keys(STDLIB).length + 100);
    expect(bundle.files.get("stdlib/builtins.pyi")!.text).toContain("from typing import Any");
    expect(() => readWorkerBundle("var x = {};")).toThrow(/no embedded typeshed/);
  });

  test("the standard library that the roots need, directly or not, is kept", () => {
    const keep = stdlibClosure(readWorkerBundle(source).files, ["builtins", "collections.abc"]);
    expect([...keep].sort()).toEqual([
      "_collections_abc.pyi",
      "_typeshed/__init__.pyi",
      "_typeshed/helper.pyi",
      "builtins.pyi",
      "collections/__init__.pyi",
      "collections/abc.pyi",
      "types.pyi",
      "typing.pyi",
    ]);
  });

  const options = {
    stdlibRoots: ["builtins"],
    replace: {},
    add: {},
  };

  test("the third-party stubs and the unneeded standard library are dropped", () => {
    const result = buildWorkerBundle(readWorkerBundle(source), options);
    expect(result.dropped).toBe(100 + 3);
    const rebuilt = readWorkerBundle(result.source);
    expect([...rebuilt.files.keys()].sort()).toEqual(
      [
        "stdlib/VERSIONS",
        "stdlib/_collections_abc.pyi",
        "stdlib/_typeshed/__init__.pyi",
        "stdlib/_typeshed/helper.pyi",
        "stdlib/builtins.pyi",
        "stdlib/collections/__init__.pyi",
        "stdlib/collections/abc.pyi",
        "stdlib/types.pyi",
        "stdlib/typing.pyi",
      ].sort(),
    );
    expect(result.kept).toBe(9);
    // The result is a program that parses, also when the last entries of the map were dropped.
    expect(() => parse(result.source, { ecmaVersion: "latest" })).not.toThrow();
  });

  test("a file can be replaced, and files can be added", () => {
    const result = buildWorkerBundle(readWorkerBundle(source), {
      ...options,
      replace: { "stdlib/builtins.pyi": 'from typing import Any\nclass bool: ...  # "quoted"\n' },
      add: { "/workspace/__builtins__.pyi": "def f(): ...\n", "/workspace/a.json": '{"a": "b"}' },
    });
    const rebuilt = readWorkerBundle(result.source);
    expect(rebuilt.files.get("stdlib/builtins.pyi")!.text).toBe(
      'from typing import Any\nclass bool: ...  # "quoted"\n',
    );
    const program = parse(result.source, { ecmaVersion: "latest" });
    expect(program.type).toBe("Program");
    const exported = new Function("module", `${result.source}\nreturn module.exports;`)(
      {},
    ) as Record<string, string>;
    expect(exported["/workspace/__builtins__.pyi"]).toBe("def f(): ...\n");
    expect(exported["/workspace/a.json"]).toBe('{"a": "b"}');
  });

  test("a file that is replaced must exist, and must be kept", () => {
    const bundle = readWorkerBundle(source);
    expect(() =>
      buildWorkerBundle(bundle, { ...options, replace: { "stdlib/nothing.pyi": "" } }),
    ).toThrow(/no stdlib\/nothing.pyi/);
    expect(() =>
      buildWorkerBundle(bundle, { ...options, replace: { "stdlib/json/__init__.pyi": "" } }),
    ).toThrow(/not kept/);
  });
});

describe("Source Python's builtins", () => {
  /** The parts of typeshed's `builtins.pyi` that the patches change, with its line endings. */
  const typeshed = [
    "class int:",
    "    def __bool__(self) -> bool: ...",
    "    def __pow__(self, value: int, mod: None = None, /) -> Any: ...",
    "    def __rpow__(self, value: int, mod: int | None = None, /) -> Any: ...",
    "class float:",
    "    def __bool__(self) -> bool: ...",
    "    def __pow__(self, value: float, mod: None = None, /) -> Any: ...",
    "    def __rpow__(self, value: float, mod: None = None, /) -> Any: ...",
    "class complex:",
    "    def __bool__(self) -> bool: ...",
    "class str(Sequence[str]):",
    "    pass",
    "class list(MutableSequence[_T]):",
    "    pass",
    "class tuple(Sequence[_T_co]):",
    "    pass",
    "class dict(MutableMapping[_KT, _VT]):",
    "    pass",
    "class bool(int):",
    "    pass",
    "",
  ].join("\r\n");

  test("what is not a condition has a __bool__ that returns None", () => {
    const patched = patchSourceBuiltins(typeshed);
    expect(patched.match(/def __bool__\(self\) -> bool:/g)).toHaveLength(1); // bool's own
    expect(patched.match(/def __bool__\(self\) -> None/g)).toHaveLength(3 + 4);
  });

  test("bool is not an int, but it is compared with numbers", () => {
    const patched = patchSourceBuiltins(typeshed);
    expect(patched).not.toContain("class bool(int)");
    expect(patched).toContain("class bool:");
    for (const method of ["__lt__", "__le__", "__gt__", "__ge__"]) {
      expect(patched).toContain(`def ${method}(self, value: bool | int | float, /) -> bool`);
    }
  });

  test("** has the types of the table of operators", () => {
    const patched = patchSourceBuiltins(typeshed);
    expect(patched).not.toContain("-> Any");
    expect(patched.match(/-> int \| float/g)).toHaveLength(2);
  });

  test("None is not a condition", () => {
    const types = "class NoneType:\r\n    def __bool__(self) -> Literal[False]:\r\n        ...\r\n";
    expect(patchSourceTypes(types)).toContain("def __bool__(self) -> None:");
  });

  test("a typeshed that has another shape is an error, with what to do", () => {
    expect(() => patchSourceBuiltins(typeshed.replace("class list(", "class lyst("))).toThrow(
      /typeshed has changed.*class list.*source-builtins\.ts/,
    );
    expect(() => patchSourceBuiltins(typeshed.replace("-> Any", "-> object"))).toThrow(
      /typeshed has changed/,
    );
    expect(() =>
      patchSourceBuiltins(typeshed + "class bytes:\r\n    def __bool__(self) -> bool: ...\r\n"),
    ).toThrow(/expected 3 classes/);
    expect(() => patchSourceTypes("class NoneType:\r\n    pass\r\n")).toThrow(
      /typeshed has changed/,
    );
  });
});
