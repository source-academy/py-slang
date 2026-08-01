/**
 * Engine-level tests for py2js's local-file ("folder") imports — relative
 * imports (`from .foo import bar`, `from ..pkg.foo import bar`, level > 0)
 * that resolve against a program's own file map rather than a conductor
 * module, via the engine-agnostic source-to-source bundler
 * (src/modules/localImports.ts — see src/tests/local-imports-bundler.test.ts
 * for unit tests of the bundler itself). These exercise the *engine's* own
 * public API (runCodePy2JsDual/Py2JsSession) end to end: parsing, bundling,
 * resolving, compiling, and running for real, not just calling the bundler
 * directly. See source-academy/py-slang#378.
 *
 * level === 0 imports (`from rune import show`) go through the unchanged
 * conductor-module path — src/tests/py2js-module-interop.test.ts already
 * covers that conversion layer directly and is untouched by this feature.
 */
import { runCodePy2JsDual, Py2JsSession } from "../engines/py2js";

describe("runCodePy2JsDual local imports", () => {
  test("imports a value and a function from a sibling file", async () => {
    const { output } = await runCodePy2JsDual("from .utils import CONST, square\nprint(square(CONST))\n", 3, {
      files: { "/utils.py": "CONST = 4\ndef square(x):\n    return x * x\n" },
    });
    expect(output).toBe("16\n");
  });

  test("resolves a nested directory via a dotted relative path", async () => {
    const { output } = await runCodePy2JsDual("from .pkg.utils import greet\nprint(greet())\n", 2, {
      files: { "/pkg/utils.py": "def greet():\n    return 'hi'\n" },
    });
    expect(output).toBe("hi\n");
  });

  test("rejected at chapter 1 — the exports transfer needs pair/list, unavailable there", async () => {
    await expect(
      runCodePy2JsDual("from .utils import square\nprint(square(3))\n", 1, {
        files: { "/utils.py": "def square(x):\n    return x * x\n" },
      }),
    ).rejects.toThrow(/require SICPy §2 or higher/);
  });

  test("supports an alias", async () => {
    const { output } = await runCodePy2JsDual("from .utils import square as sq\nprint(sq(3))\n", 3, {
      files: { "/utils.py": "def square(x):\n    return x * x\n" },
    });
    expect(output).toBe("9\n");
  });

  test("a diamond dependency runs its shared dependency exactly once", async () => {
    const { output } = await runCodePy2JsDual(
      "from .a import a_val\nfrom .b import b_val\nprint(a_val, b_val)\n",
      3,
      {
        files: {
          "/shared.py": "print('loading shared')\nVALUE = 1\n",
          "/a.py": "from .shared import VALUE\na_val = VALUE\n",
          "/b.py": "from .shared import VALUE\nb_val = VALUE\n",
        },
      },
    );
    expect(output).toBe("loading shared\n1 1\n");
  });

  test("circular imports raise an ImportError", async () => {
    await expect(
      runCodePy2JsDual("from .a import x\n", 3, {
        files: {
          "/a.py": "from .b import y\nx = 1\n",
          "/b.py": "from .a import x\ny = 2\n",
        },
      }),
    ).rejects.toThrow(/circular import/);
  });

  test("importing an undefined name silently gives None (matching js-slang's own __access_export__)", async () => {
    const { output } = await runCodePy2JsDual("from .utils import does_not_exist\nprint(does_not_exist)\n", 3, {
      files: { "/utils.py": "x = 1\n" },
    });
    expect(output).toBe("None\n");
  });

  test("importing a missing file raises ModuleNotFoundError", async () => {
    await expect(runCodePy2JsDual("from .missing import x\n", 3, { files: {} })).rejects.toThrow(
      /not found/,
    );
  });

  test("a locally-imported file with its own from-import (transitive) works", async () => {
    const { output } = await runCodePy2JsDual("from .a import a_val\nprint(a_val)\n", 3, {
      files: {
        "/b.py": "VALUE = 42\n",
        "/a.py": "from .b import VALUE\na_val = VALUE\n",
      },
    });
    expect(output).toBe("42\n");
  });
});

describe("__program__ shows the flattened single-file program", () => {
  test("__program__ is the bundled Python text, pair/list based, not the raw multi-file entrypoint", async () => {
    const output: string[] = [];
    const session = new Py2JsSession(2, {
      onOutput: line => output.push(line),
      files: { "/utils.py": "CONST = 4\ndef square(x):\n    return x * x\n" },
    });
    await session.runChunk("from .utils import square, CONST\nprint(__program__)\n");
    const program = output.join("\n");
    expect(program).toContain("def __access_named_export__(named_exports, lookup_name):");
    expect(program).toContain("def __module_utils_py__():");
    expect(program).toContain('square = __access_named_export__(__exports_utils_py__, "square")');
    // The raw multi-file entrypoint text (with its own `from .utils import`
    // line) is gone — replaced by the flattened program's own lookups.
    expect(program).not.toContain("from .utils import");
  });
});

describe("Py2JsSession local imports", () => {
  test("runs an entrypoint chunk against a sibling file", async () => {
    const output: string[] = [];
    const session = new Py2JsSession(3, {
      onOutput: line => output.push(line),
      files: { "/utils.py": "def square(x):\n    return x * x\n" },
    });
    await session.runChunk("from .utils import square\nprint(square(6))\n");
    expect(output.join("\n") + "\n").toBe("36\n");
  });

  test("a later chunk still sees an earlier chunk's local import", async () => {
    const output: string[] = [];
    const session = new Py2JsSession(3, {
      onOutput: line => output.push(line),
      files: { "/utils.py": "def square(x):\n    return x * x\n" },
    });
    await session.runChunk("from .utils import square\n");
    await session.runChunk("print(square(5))\n");
    expect(output.join("\n") + "\n").toBe("25\n");
  });

  test("a later chunk importing the same file doesn't re-run it (no duplicate side effects)", async () => {
    const output: string[] = [];
    const session = new Py2JsSession(3, {
      onOutput: line => output.push(line),
      files: { "/utils.py": "print('loading utils')\ndef square(x):\n    return x * x\n" },
    });
    await session.runChunk("from .utils import square\nprint(square(2))\n");
    await session.runChunk("from .utils import square\nprint(square(3))\n");
    expect(output.join("\n") + "\n").toBe("loading utils\n4\n9\n");
  });
});

describe("fileGetter (conductor.requestFile shape)", () => {
  // A host like the conductor evaluator never hands over a static
  // Record<string,string> up front — it resolves each file on demand via an
  // async call (conductor.requestFile). This exercises exactly that shape,
  // not just the files: Record convenience wrapper the other tests use.
  function requestFileLike(files: Record<string, string>) {
    const requested: string[] = [];
    return {
      requested,
      fileGetter: (path: string) => {
        requested.push(path);
        return Promise.resolve(files[path]);
      },
    };
  }

  test("runCodePy2JsDual resolves imports through an async fileGetter", async () => {
    const { fileGetter, requested } = requestFileLike({
      "/utils.py": "def square(x):\n    return x * x\n",
    });
    const { output } = await runCodePy2JsDual("from .utils import square\nprint(square(7))\n", 3, {
      fileGetter,
    });
    expect(output).toBe("49\n");
    expect(requested).toEqual(["/utils.py"]);
  });

  test("Py2JsSession.setEntrypointFilePath changes what a relative import resolves against", async () => {
    const output: string[] = [];
    const { fileGetter } = requestFileLike({
      "/pkg/utils.py": "def square(x):\n    return x * x\n",
      "/utils.py": "def square(x):\n    return x * 1000\n",
    });
    const session = new Py2JsSession(3, { onOutput: line => output.push(line), fileGetter });
    // Mirrors Py2JsEvaluatorBase.evaluateFile: the host's real entrypoint
    // path is only known once it calls evaluateFile(fileName, ...), after
    // the session already exists.
    session.setEntrypointFilePath("/pkg/main.py");
    await session.runChunk("from .utils import square\nprint(square(3))\n");
    expect(output.join("\n") + "\n").toBe("9\n");
  });
});
