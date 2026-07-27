import { parser } from "@lezer/python";
import { CompletionItemKind, WEB_PLUGIN_ID } from "@sourceacademy/common-autocomplete";
import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import {
  Py2JsEvaluator1,
  Py2JsEvaluator2,
  Py2JsEvaluator3,
  Py2JsEvaluator4,
} from "../../src/conductor/Py2JsEvaluator";
import {
  PyCseEvaluator1,
  PyCseEvaluator2,
  PyCseEvaluator3,
  PyCseEvaluator4,
} from "../../src/conductor/PyCseEvaluator";
import {
  PyPvmlEvaluator,
  PyPvmlEvaluator1,
  PyPvmlEvaluator2,
  PyPvmlEvaluator3,
  PyPvmlEvaluator4,
} from "../../src/conductor/PyPvmlEvaluator";
import { PyPvmlPynterEvaluator } from "../../src/conductor/PyPvmlPynterEvaluator";
import { PyStepperEvaluator1, PyStepperEvaluator2 } from "../../src/conductor/PyStepperEvaluator";
import {
  PyWasmEvaluator1,
  PyWasmEvaluator2,
  PyWasmEvaluator3,
  PyWasmEvaluator4,
} from "../../src/conductor/PyWasmEvaluator";
import {
  PyodideEvaluator1,
  PyodideEvaluator2,
  PyodideEvaluator3,
  PyodideEvaluator4,
  PyodideEvaluatorFull,
} from "../../src/conductor/PyodideEvaluator";
import AutoCompletePlugin from "../../src/conductor/plugins/autocomplete";
import pythonMode from "../../src/conductor/plugins/autocomplete/mode";
import { getNames } from "../../src/conductor/plugins/autocomplete/resolver";

jest.mock("../../src/engines/pyodide/loadPyodide", () => ({
  loadPyodideGeneric: jest.fn(() => new Promise(() => undefined)),
}));

describe("Python autocomplete plugin registration", () => {
  test.each([
    [PyCseEvaluator1, 1],
    [PyCseEvaluator2, 2],
    [PyCseEvaluator3, 3],
    [PyCseEvaluator4, 4],
    [PyPvmlEvaluator1, 1],
    [PyPvmlEvaluator2, 2],
    [PyPvmlEvaluator3, 3],
    [PyPvmlEvaluator4, 4],
    [PyPvmlEvaluator, 4],
    [PyPvmlPynterEvaluator, 3],
    [Py2JsEvaluator1, 1],
    [Py2JsEvaluator2, 2],
    [Py2JsEvaluator3, 3],
    [Py2JsEvaluator4, 4],
    [PyWasmEvaluator1, 1],
    [PyWasmEvaluator2, 2],
    [PyWasmEvaluator3, 3],
    [PyWasmEvaluator4, 4],
    [PyodideEvaluator1, 1],
    [PyodideEvaluator2, 2],
    [PyodideEvaluator3, 3],
    [PyodideEvaluator4, 4],
    [PyodideEvaluatorFull, 4],
    [PyStepperEvaluator1, 1],
    [PyStepperEvaluator2, 2],
  ] as const)("%p registers variant %i and requests its web counterpart", (Evaluator, variant) => {
    const registerPlugin = jest.fn().mockReturnValue({});
    const hostLoadPlugin = jest.fn().mockResolvedValue(undefined);
    const conductor = {
      registerPlugin,
      hostLoadPlugin,
    } as unknown as IRunnerPlugin;

    new Evaluator(conductor);

    expect(registerPlugin).toHaveBeenCalledWith(AutoCompletePlugin, variant);
    expect(hostLoadPlugin).toHaveBeenCalledWith(WEB_PLUGIN_ID);
  });
});

describe("Python autocomplete mode", () => {
  test.each([1, 2, 3, 4])("uses an Ace mode ID independent of evaluator names", variant => {
    const mode = pythonMode(variant);

    expect(mode.id).toBe(`ace/mode/python${variant}`);
    expect(mode.snippetFileId).toBe("ace/snippets/python");
  });

  test("delegates Python editor hooks with hookFrom", () => {
    const mode = pythonMode(1);

    expect(mode.foldingRules).toEqual({
      hookFrom: "ace/mode/folding/pythonic",
      args: ["\\:"],
    });
    expect(mode.indents).toEqual({ hookFrom: "ace/mode/python" });
    expect(mode.outdents).toEqual({ hookFrom: "ace/mode/python" });
    expect(mode.autoOutdent).toEqual({ hookFrom: "ace/mode/python" });
  });
});

const testContains = (
  code: string,
  expected: { name: string; meta: CompletionItemKind },
  line: number,
  column: number,
  variant: number,
) => {
  const tree = parser.parse(code);
  const suggestions = getNames(tree, code, line, column, variant);
  expect(suggestions).toContainEqual(expect.objectContaining(expected));
};

const testNotContains = (
  code: string,
  expected: { name: string; meta: CompletionItemKind },
  line: number,
  column: number,
  variant: number,
) => {
  const tree = parser.parse(code);
  const suggestions = getNames(tree, code, line, column, variant);
  expect(suggestions).not.toContainEqual(expect.objectContaining(expected));
};
describe("Chapter 1 Autocomplete", () => {
  test("suggests names imported at the top level", () => {
    testContains(
      "from sound import play, sine_sound\npl",
      { name: "play", meta: CompletionItemKind.Variable },
      2,
      2,
      1,
    );
    testContains(
      "from sound import play, sine_sound\nsi",
      { name: "sine_sound", meta: CompletionItemKind.Variable },
      2,
      2,
      1,
    );
  });

  test("suggests import aliases instead of their original names", () => {
    testContains(
      "from sound import sine_sound as sine\nsi",
      { name: "sine", meta: CompletionItemKind.Variable },
      2,
      2,
      1,
    );
    testNotContains(
      "from sound import sine_sound as sine\nsi",
      { name: "sine_sound", meta: CompletionItemKind.Variable },
      2,
      2,
      1,
    );
  });

  test("supports ordinary top-level imports and ignores nested imports", () => {
    testContains(
      "import audio.wave as wave\nwa",
      { name: "wave", meta: CompletionItemKind.Variable },
      2,
      2,
      1,
    );
    testContains(
      "import audio.wave\na",
      { name: "audio", meta: CompletionItemKind.Variable },
      2,
      1,
      1,
    );
    testNotContains(
      "def load():\n    import audio as nested\nne",
      { name: "nested", meta: CompletionItemKind.Variable },
      3,
      2,
      1,
    );
  });

  test("should suggest built-in functions", () => {
    testContains("le", { name: "len", meta: CompletionItemKind.Function }, 1, 2, 1);
  });
  test("should not suggest built-ins when not a subsequence", () => {
    testNotContains("el", { name: "len", meta: CompletionItemKind.Function }, 1, 2, 1);
  });
  test("should not suggest Chapter 3 keywords", () => {
    testNotContains("wh", { name: "while", meta: CompletionItemKind.Keyword }, 1, 2, 1);
    testNotContains("fo", { name: "for", meta: CompletionItemKind.Keyword }, 1, 2, 1);
    testNotContains("br", { name: "break", meta: CompletionItemKind.Keyword }, 1, 2, 1);
    testNotContains("co", { name: "continue", meta: CompletionItemKind.Keyword }, 1, 2, 1);
    testNotContains("i", { name: "in", meta: CompletionItemKind.Keyword }, 1, 1, 1);
  });
  test("should suggest keywords", () => {
    testContains("de", { name: "def", meta: CompletionItemKind.Keyword }, 1, 2, 1);
  });
  test("can handle no suggestions", () => {
    const tree = parser.parse("x = 10\nx.");
    const suggestions = getNames(tree, "x = 10\nx.", 2, 3, 1);
    expect(suggestions).toEqual([]);
  });
  test("should suggest variables in scope", () => {
    testContains(
      "x = 10\ny = x + 5\nzab = y * 2\nza",
      { name: "zab", meta: CompletionItemKind.Variable },
      4,
      2,
      1,
    );
  });
  test("can handle layers of scope", () => {
    testContains(
      "x = 10\ndef foo():\n    y = x + 5\n    def bar():\n        zab = y * 2\n        za",
      { name: "zab", meta: CompletionItemKind.Variable },
      6,
      10,
      1,
    );
    testContains(
      "x = 10\ndef foo():\n    y = x + 5\n    def bar():\n        zab = y * 2\n        y",
      { name: "y", meta: CompletionItemKind.Variable },
      6,
      9,
      1,
    );
    testContains(
      "x = 10\ndef foo():\n    y = x + 5\n    def bar():\n        zab = y * 2\n        x",
      { name: "x", meta: CompletionItemKind.Variable },
      6,
      9,
      1,
    );

    testNotContains(
      "x = 10\ndef foo():\n    y = x + 5\n    def bar():\n        zab = y * 2\nza",
      { name: "zab", meta: CompletionItemKind.Variable },
      6,
      2,
      1,
    );
    testNotContains(
      "x = 10\ndef foo():\n    y = x + 5\n    def bar():\n        zab = y * 2\ny",
      { name: "y", meta: CompletionItemKind.Variable },
      6,
      1,
      1,
    );
    testContains(
      "x = 10\ndef foo(x):\n    y = x + 5\n    def bar():\n        zab = y * 2\nx",
      { name: "x", meta: CompletionItemKind.Variable },
      6,
      1,
      1,
    );
  });
  test("does not suggest name during function definition", () => {
    testNotContains("foo = 3\ndef f", { name: "f", meta: CompletionItemKind.Function }, 2, 5, 1);
    testNotContains("foo = 3\ndef f", { name: "foo", meta: CompletionItemKind.Variable }, 2, 5, 1);
    testNotContains(
      "bar = 3\ndef f(b",
      { name: "bar", meta: CompletionItemKind.Variable },
      2,
      7,
      1,
    );
  });
  test("suggests name during function call", () => {
    testContains(
      "foo = 3\ndef f():\n    pass\nf(fo",
      { name: "foo", meta: CompletionItemKind.Variable },
      4,
      4,
      1,
    );
  });
});

describe("Chapter 3 Autocomplete", () => {
  test("while loops internals should not be visible", () => {
    testNotContains(
      "x = 10\nwhile x > 0:\n    y = x + 5\n    x -= 1\n    zab = y * 2\nza",
      { name: "y", meta: CompletionItemKind.Variable },
      6,
      2,
      3,
    );
    testNotContains(
      "x = 10\nwhile x > 0:\n    y = x + 5\n    x -= 1\n    zab = y * 2\ny",
      { name: "zab", meta: CompletionItemKind.Variable },
      6,
      1,
      3,
    );
  });
  test("for loops should have the loop variable visible inside the loop", () => {
    testContains(
      "x = 10\nfor i in range(x):\n    y = i + 5\n    zab = y * 2\n    i",
      { name: "i", meta: CompletionItemKind.Variable },
      5,
      5,
      3,
    );
  });

  test("for loop internals should not be visible", () => {
    testNotContains(
      "x = 10\nfor i in range(x):\n    y = i + 5\n    zab = y * 2\nza",
      { name: "zab", meta: CompletionItemKind.Variable },
      5,
      2,
      3,
    );
    testNotContains(
      "x = 10\nfor i in range(x):\n    y = i + 5\n    zab = y * 2\ny",
      { name: "y", meta: CompletionItemKind.Variable },
      5,
      1,
      3,
    );
    testNotContains(
      "x = 10\nfor i in range(x):\n    y = i + 5\n    zab = y * 2\ni",
      { name: "i", meta: CompletionItemKind.Variable },
      5,
      1,
      3,
    );
  });
  test("should suggest Chapter 3 keywords", () => {
    testContains("wh", { name: "while", meta: CompletionItemKind.Keyword }, 1, 2, 3);
    testContains("fo", { name: "for", meta: CompletionItemKind.Keyword }, 1, 2, 3);
    testContains("br", { name: "break", meta: CompletionItemKind.Keyword }, 1, 2, 3);
    testContains("co", { name: "continue", meta: CompletionItemKind.Keyword }, 1, 2, 3);
    testContains("i", { name: "in", meta: CompletionItemKind.Keyword }, 1, 1, 3);
  });
});
