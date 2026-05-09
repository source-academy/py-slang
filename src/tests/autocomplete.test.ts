import { parser } from "@lezer/python";
import { CompletionItemKind } from "@sourceacademy/autocomplete";
import { getNames } from "../../src/conductor/plugins/autocomplete/resolver";
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
  test("should suggest built-in functions", () => {
    testContains("le", { name: "len", meta: CompletionItemKind.Function }, 1, 2, 1);
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
      "x = 10\ndef foo():\n    y = x + 5\n    def bar():\n        zab = y * 2\nx",
      { name: "x", meta: CompletionItemKind.Variable },
      6,
      1,
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
      1,
    );
    testNotContains(
      "x = 10\nwhile x > 0:\n    y = x + 5\n    x -= 1\n    zab = y * 2\ny",
      { name: "zab", meta: CompletionItemKind.Variable },
      6,
      1,
      1,
    );
  });
  test("for loop internals should not be visible", () => {
    testNotContains(
      "x = 10\nfor i in range(x):\n    y = i + 5\n    zab = y * 2\nza",
      { name: "zab", meta: CompletionItemKind.Variable },
      5,
      2,
      1,
    );
    testNotContains(
      "x = 10\nfor i in range(x):\n    y = i + 5\n    zab = y * 2\ny",
      { name: "y", meta: CompletionItemKind.Variable },
      5,
      1,
      1,
    );
    testNotContains(
      "x = 10\nfor i in range(x):\n    y = i + 5\n    zab = y * 2\ni",
      { name: "i", meta: CompletionItemKind.Variable },
      5,
      1,
      1,
    );
  });
});
