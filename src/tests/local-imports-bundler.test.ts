/**
 * Unit tests for the engine-agnostic local-file ("folder") import bundler
 * (src/modules/localImports.ts) — a genuine source-to-source transform,
 * mirroring js-slang's own local-module preprocessor. `from .foo import
 * bar` (level > 0) resolves against a program's own file map; the whole
 * multi-file program flattens into one Python source string that any
 * py-slang engine parses and runs unmodified — no engine-specific plumbing
 * involved. See source-academy/py-slang#378.
 */
import { bundleLocalImports, resolveLocalModulePath } from "../modules/localImports";
import { runCode } from "../runner";

describe("resolveLocalModulePath", () => {
  test("level 1 resolves to a sibling in the importing file's own directory", () => {
    expect(resolveLocalModulePath("/main.py", 1, "utils")).toBe("/utils.py");
    expect(resolveLocalModulePath("/pkg/main.py", 1, "utils")).toBe("/pkg/utils.py");
  });

  test("level 2 walks up one directory before resolving", () => {
    expect(resolveLocalModulePath("/pkg/main.py", 2, "utils")).toBe("/utils.py");
    expect(resolveLocalModulePath("/pkg/sub/main.py", 2, "utils")).toBe("/pkg/utils.py");
  });

  test("a dotted module path becomes nested directory segments", () => {
    expect(resolveLocalModulePath("/main.py", 1, "pkg.utils")).toBe("/pkg/utils.py");
    expect(resolveLocalModulePath("/pkg/main.py", 2, "a.b")).toBe("/a/b.py");
  });

  test("level beyond the available directory depth clamps rather than throwing", () => {
    expect(resolveLocalModulePath("/main.py", 5, "utils")).toBe("/utils.py");
  });
});

describe("bundleLocalImports", () => {
  test("a program with no local imports is returned completely unchanged", async () => {
    const entrypoint = "print(1)\n";
    const bundled = await bundleLocalImports(entrypoint, "/main.py", () => Promise.resolve(undefined), 1);
    expect(bundled).toBe(entrypoint);
  });

  test("imports a value and a function from a sibling file, and it actually runs", async () => {
    const files: Record<string, string> = {
      "/test.py": "def square(x):\n    return x * x\n\nCONST = 4\n",
    };
    const entrypoint = "from .test import square, CONST\nprint(square(CONST))\n";
    const bundled = await bundleLocalImports(entrypoint, "/main.py", p => Promise.resolve(files[p]), 2);

    // The generated program is exactly what a student could be shown: a
    // pair()/head()/tail()-based access helper, one wrapper function per
    // dependency returning a pair-list of its own top-level bindings, and
    // the entrypoint's own imports rewritten as plain lookups against it.
    expect(bundled).toContain("def __access_named_export__(named_exports, lookup_name):");
    expect(bundled).toContain("def __module_test_py__():");
    expect(bundled).toContain('return pair(pair("CONST", CONST), pair(pair("square", square), None))');
    expect(bundled).toContain("__exports_test_py__ = __module_test_py__()");
    expect(bundled).toContain('square = __access_named_export__(__exports_test_py__, "square")');
    expect(bundled).toContain('CONST = __access_named_export__(__exports_test_py__, "CONST")');
    expect(bundled).not.toContain("__py."); // no engine-specific runtime plumbing anywhere

    expect(await runCode(bundled, 2)).toBe("16\n");
  });

  test("resolves a nested directory via a dotted relative path", async () => {
    const files: Record<string, string> = { "/pkg/utils.py": "def greet():\n    return 'hi'\n" };
    const bundled = await bundleLocalImports(
      "from .pkg.utils import greet\nprint(greet())\n",
      "/main.py",
      p => Promise.resolve(files[p]),
      2,
    );
    expect(await runCode(bundled, 2)).toBe("hi\n");
  });

  test("supports an alias", async () => {
    const files: Record<string, string> = { "/utils.py": "def square(x):\n    return x * x\n" };
    const bundled = await bundleLocalImports(
      "from .utils import square as sq\nprint(sq(3))\n",
      "/main.py",
      p => Promise.resolve(files[p]),
      2,
    );
    expect(await runCode(bundled, 2)).toBe("9\n");
  });

  test("a diamond dependency's shared file is bundled and run exactly once", async () => {
    const files: Record<string, string> = {
      "/shared.py": "print('loading shared')\nVALUE = 1\n",
      "/a.py": "from .shared import VALUE\na_val = VALUE\n",
      "/b.py": "from .shared import VALUE\nb_val = VALUE\n",
    };
    const bundled = await bundleLocalImports(
      "from .a import a_val\nfrom .b import b_val\nprint(a_val, b_val)\n",
      "/main.py",
      p => Promise.resolve(files[p]),
      3,
    );
    // Exactly one def/invocation for the shared file, no matter how many
    // importers reference it.
    expect(bundled.match(/def __module_shared_py__\(\):/g)).toHaveLength(1);
    expect(bundled.match(/__exports_shared_py__ = __module_shared_py__\(\)/g)).toHaveLength(1);
    expect(await runCode(bundled, 3)).toBe("loading shared\n1 1\n");
  });

  test("a locally-imported file with its own from-import (transitive) works", async () => {
    const files: Record<string, string> = {
      "/b.py": "VALUE = 42\n",
      "/a.py": "from .b import VALUE\na_val = VALUE\n",
    };
    const bundled = await bundleLocalImports(
      "from .a import a_val\nprint(a_val)\n",
      "/main.py",
      p => Promise.resolve(files[p]),
      3,
    );
    expect(await runCode(bundled, 3)).toBe("42\n");
  });

  test("circular imports raise an ImportError before running anything", async () => {
    const files: Record<string, string> = {
      "/a.py": "from .b import y\nx = 1\n",
      "/b.py": "from .a import x\ny = 2\n",
    };
    await expect(
      bundleLocalImports("from .a import x\n", "/main.py", p => Promise.resolve(files[p]), 3),
    ).rejects.toThrow(/circular import/);
  });

  test("importing a missing file raises a clear error", async () => {
    await expect(
      bundleLocalImports("from .missing import x\n", "/main.py", () => Promise.resolve(undefined), 3),
    ).rejects.toThrow(/not found/);
  });

  test("importing an undefined name silently gives None, matching js-slang's own __access_export__", async () => {
    // Faithfully mirrors js-slang's local-import prelude: __access_named_export__
    // walks off the end of the pair list and returns None rather than
    // raising an ImportError — a deliberate parity choice, not an oversight.
    const files: Record<string, string> = { "/utils.py": "x = 1\n" };
    const bundled = await bundleLocalImports(
      "from .utils import does_not_exist\nprint(does_not_exist)\n",
      "/main.py",
      p => Promise.resolve(files[p]),
      3,
    );
    expect(await runCode(bundled, 3)).toBe("None\n");
  });

  test("rejected at chapter 1 — the exports transfer needs pair/list, unavailable there", async () => {
    const files: Record<string, string> = { "/utils.py": "x = 1\n" };
    await expect(
      bundleLocalImports("from .utils import x\n", "/main.py", p => Promise.resolve(files[p]), 1),
    ).rejects.toThrow(/require SICPy §2 or higher/);
  });

  test("a level === 0 (conductor module) import is hoisted verbatim, untouched", async () => {
    const bundled = await bundleLocalImports(
      "from .utils import helper\nfrom rune import show\nprint(1)\n",
      "/main.py",
      p => Promise.resolve(p === "/utils.py" ? "def helper():\n    return 1\n" : undefined),
      2,
    );
    expect(bundled).toContain("from rune import show");
    // Hoisted to the very top, ahead of every generated def/invocation.
    const hoistedIndex = bundled.indexOf("from rune import show");
    const moduleDefIndex = bundled.indexOf("def __module_utils_py__");
    expect(hoistedIndex).toBeLessThan(moduleDefIndex);
  });

  test("priorGlobalNames skips re-bundling a file already available from an earlier chunk", async () => {
    const files: Record<string, string> = { "/utils.py": "def square(x):\n    return x * x\n" };
    const priorGlobalNames = new Set(["__exports_utils_py__", "__access_named_export__"]);
    const bundled = await bundleLocalImports(
      "from .utils import square\nprint(square(4))\n",
      "/main.py",
      p => Promise.resolve(files[p]),
      2,
      priorGlobalNames,
    );
    // Neither the helper nor the dependency's def/invocation are re-emitted —
    // just the lookup against the (already-bound, from a prior chunk)
    // __exports_utils_py__ name.
    expect(bundled).not.toContain("def __access_named_export__");
    expect(bundled).not.toContain("def __module_utils_py__");
    expect(bundled).toContain('square = __access_named_export__(__exports_utils_py__, "square")');
  });
});
