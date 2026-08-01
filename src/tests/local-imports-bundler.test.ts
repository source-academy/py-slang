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
import { parse } from "../parser";

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
    const bundled = await bundleLocalImports(
      entrypoint,
      "/main.py",
      () => Promise.resolve(undefined),
      1,
    );
    expect(bundled).toBe(entrypoint);
  });

  test("imports a value and a function from a sibling file, and it actually runs", async () => {
    const files: Record<string, string> = {
      "/test.py": "def square(x):\n    return x * x\n\nCONST = 4\n",
    };
    const entrypoint = "from .test import square, CONST\nprint(square(CONST))\n";
    const bundled = await bundleLocalImports(
      entrypoint,
      "/main.py",
      p => Promise.resolve(files[p]),
      2,
    );

    // The generated program is exactly what a student could be shown: a
    // pair()/head()/tail()-based access helper, one wrapper function per
    // dependency returning a pair-list of its own top-level bindings, and
    // the entrypoint's own imports rewritten as plain lookups against it.
    // The module/exports names carry a deterministic path-hash suffix (not
    // asserted exactly here) so distinct paths never collide — see the
    // "slugify" describe block below.
    expect(bundled).toContain("def __access_named_export__(named_exports, lookup_name):");
    expect(bundled).toMatch(/def __module_test_py_\w+__\(\):/);
    expect(bundled).toMatch(
      /return __li_pair__\(__li_pair__\("CONST", CONST\), __li_pair__\(__li_pair__\("square", square\), None\)\)/,
    );
    expect(bundled).toMatch(/__exports_test_py_\w+__ = __module_test_py_\w+__\(\)/);
    expect(bundled).toMatch(
      /square = __access_named_export__\(__exports_test_py_\w+__, "square"\)/,
    );
    expect(bundled).toMatch(/CONST = __access_named_export__\(__exports_test_py_\w+__, "CONST"\)/);
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
    expect(bundled.match(/def __module_shared_py_\w+__\(\):/g)).toHaveLength(1);
    expect(bundled.match(/__exports_shared_py_\w+__ = __module_shared_py_\w+__\(\)/g)).toHaveLength(
      1,
    );
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

  test("two local files hoisting the same name from different conductor modules raise a clear error", async () => {
    // Bundled files share one flat global scope once flattened, so /a.py's
    // `from rune import show` and /b.py's `from curve import show` can't
    // both be satisfied — the later hoisted binding would otherwise
    // silently win for both files.
    const files: Record<string, string> = {
      "/a.py": "from rune import show\n",
      "/b.py": "from curve import show\n",
    };
    await expect(
      bundleLocalImports(
        "from .a import x\nfrom .b import y\n",
        "/main.py",
        p => Promise.resolve(files[p]),
        3,
      ),
    ).rejects.toThrow(/conflicting imports of 'show'/);
  });

  test("two local files hoisting the identical import are deduplicated, not rejected", async () => {
    const files: Record<string, string> = {
      "/a.py": "from rune import show\n",
      "/b.py": "from rune import show\n",
    };
    const bundled = await bundleLocalImports(
      "from .a import x\nfrom .b import y\n",
      "/main.py",
      p => Promise.resolve(files[p]),
      3,
    );
    expect(bundled.match(/from rune import show/g)).toHaveLength(1);
  });

  test("importing a missing file raises a clear error", async () => {
    await expect(
      bundleLocalImports(
        "from .missing import x\n",
        "/main.py",
        () => Promise.resolve(undefined),
        3,
      ),
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
    // Hoisted to the very top, ahead of the access-helper aliases and every
    // generated def/invocation — a hoisted import must precede every
    // statement (including `def`s) per the grammar's own leading-imports
    // rule, so getting this ordering wrong makes the flattened program
    // unparseable (see the regression test below).
    const hoistedIndex = bundled.indexOf("from rune import show");
    const aliasIndex = bundled.indexOf("__li_pair__ = pair");
    const moduleDefIndex = bundled.search(/def __module_utils_py_\w+__/);
    expect(hoistedIndex).toBeGreaterThanOrEqual(0);
    expect(hoistedIndex).toBeLessThan(aliasIndex);
    expect(hoistedIndex).toBeLessThan(moduleDefIndex);
  });

  test("a hoisted conductor-module import plus a local import actually runs (regression: emission order)", async () => {
    // Regression test: an earlier version of the bundler emitted the access
    // helper/aliases *before* the hoisted level-0 imports, which produced a
    // `from ...` statement after a `def` — unparseable, since the grammar
    // requires all imports to lead every other statement.
    const bundled = await bundleLocalImports(
      "from .utils import square\nfrom rune import show\nprint(square(3))\n",
      "/main.py",
      p => Promise.resolve(p === "/utils.py" ? "def square(x):\n    return x * x\n" : undefined),
      2,
    );
    // A bare `parse()` check is enough here: `rune` isn't a real module in
    // this test context, so running it end to end would need a conductor;
    // parsing is exactly what the emission-order bug broke.
    expect(() => parse(bundled)).not.toThrow();
  });

  test("two files whose paths sanitize to the same fragment don't collide", async () => {
    // "/pkg/utils.py" and "/pkg_utils.py" both collapse to "pkg_utils_py"
    // once non-alphanumeric runs become "_" — the path-hash suffix keeps
    // them distinct.
    const files: Record<string, string> = {
      "/pkg/utils.py": "A = 1\n",
      "/pkg_utils.py": "B = 2\n",
    };
    const bundled = await bundleLocalImports(
      "from .pkg.utils import A\nfrom .pkg_utils import B\nprint(A, B)\n",
      "/main.py",
      p => Promise.resolve(files[p]),
      2,
    );
    expect(await runCode(bundled, 2)).toBe("1 2\n");
  });

  test("a top-level 'pair' defined after the imports doesn't break the export machinery", async () => {
    // The generated access helper/return-expr must not resolve `pair`/
    // `head`/`tail` by bare name, since the entrypoint's own trailing code
    // is free to rebind them at the global scope this all shares.
    const files: Record<string, string> = { "/utils.py": "def square(x):\n    return x * x\n" };
    const bundled = await bundleLocalImports(
      "from .utils import square\ndef pair(a, b):\n    return a + b\nprint(square(3))\nprint(pair(1, 2))\n",
      "/main.py",
      p => Promise.resolve(files[p]),
      2,
    );
    expect(await runCode(bundled, 2)).toBe("9\n3\n");
  });

  test("priorGlobalNames skips re-bundling a file already available from an earlier chunk", async () => {
    const files: Record<string, string> = { "/utils.py": "def square(x):\n    return x * x\n" };
    // Bundle once to learn this path's real (hash-suffixed) generated names,
    // simulating what a first chunk in a persistent session would produce.
    const firstBundle = await bundleLocalImports(
      "from .utils import square\n",
      "/main.py",
      p => Promise.resolve(files[p]),
      2,
    );
    const exportsVarMatch = firstBundle.match(/__exports_utils_py_\w+__/);
    expect(exportsVarMatch).not.toBeNull();
    const exportsVar = exportsVarMatch![0];
    const priorGlobalNames = new Set([exportsVar, "__access_named_export__"]);
    const bundled = await bundleLocalImports(
      "from .utils import square\nprint(square(4))\n",
      "/main.py",
      p => Promise.resolve(files[p]),
      2,
      priorGlobalNames,
    );
    // Neither the helper, its aliases, nor the dependency's def/invocation
    // are re-emitted — just the lookup against the (already-bound, from a
    // prior chunk) exports name.
    expect(bundled).not.toContain("def __access_named_export__");
    expect(bundled).not.toContain("__li_pair__ = pair");
    expect(bundled).not.toMatch(/def __module_utils_py_\w+__/);
    expect(bundled).toBe(
      `square = __access_named_export__(${exportsVar}, "square")\nprint(square(4))\n`,
    );
  });
});
