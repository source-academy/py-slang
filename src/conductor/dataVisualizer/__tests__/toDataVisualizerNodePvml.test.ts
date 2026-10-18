import { createRefIdAllocator } from "@sourceacademy/runner-data-visualizer";

import { PyComplexNumber } from "../../../types/value-types";
import type { PVMLArray, PVMLBoxType } from "../../../engines/pvml/types";
import { toDataVisualizerNodePvml } from "../toDataVisualizerNodePvml";

/** Strings as Python writes them (`repr`): what the visualizer draws is a valid literal (py-slang#600). */
const QUOTED_STRINGS: [string, string][] = [
  ["hi", "'hi'"],
  ["", "''"],
  ['say "hi"', "'say \"hi\"'"],
  ["it's", '"it\'s"'],
  ["both ' and \"", "'both \\' and \"'"],
  ["back\\slash", "'back\\\\slash'"],
  ["two\nlines", "'two\\nlines'"],
  ["caf\u00e9 \u4e2d", "'caf\u00e9 \u4e2d'"],
];

describe("toDataVisualizerNodePvml", () => {
  test("converts leaf values", () => {
    const refs = createRefIdAllocator();
    expect(toDataVisualizerNodePvml(42n, refs)).toEqual({
      type: "leaf",
      displayValue: "42",
      label: "bigint",
    });
    expect(toDataVisualizerNodePvml(2.5, refs)).toEqual({
      type: "leaf",
      displayValue: "2.5",
      label: "number",
    });
    expect(toDataVisualizerNodePvml("hi", refs)).toEqual({
      type: "leaf",
      displayValue: "'hi'",
      label: "quoted_string",
    });
    expect(toDataVisualizerNodePvml(true, refs)).toEqual({
      type: "leaf",
      displayValue: "True",
      label: "bool",
    });
    const complex = new PyComplexNumber(1, 2);
    expect(toDataVisualizerNodePvml(complex, refs)).toEqual({
      type: "leaf",
      displayValue: complex.toString(),
      label: "complex",
    });
  });

  test("converts None to the empty terminator", () => {
    expect(toDataVisualizerNodePvml(null, createRefIdAllocator())).toEqual({
      type: "empty",
      displayValue: "None",
    });
  });

  test("converts a pair to an array node", () => {
    const pair: PVMLBoxType = { type: "array", elements: [1n, 2n] };
    expect(toDataVisualizerNodePvml(pair, createRefIdAllocator())).toEqual({
      type: "array",
      refId: expect.any(Number),
      children: [
        { type: "leaf", displayValue: "1", label: "bigint" },
        { type: "leaf", displayValue: "2", label: "bigint" },
      ],
    });
  });

  test("converts a builtin reference to a function node", () => {
    const print: PVMLBoxType = { type: "primitive", primitiveIndex: 5 };
    expect(toDataVisualizerNodePvml(print, createRefIdAllocator())).toEqual({
      type: "function",
      refId: expect.any(Number),
      displayValue: "<built-in function print>",
    });
  });

  test("a cyclic pair terminates with a ref node", () => {
    const x: PVMLArray = { type: "array", elements: [1n, null] };
    x.elements[1] = x;
    const node = toDataVisualizerNodePvml(x, createRefIdAllocator());
    if (node.type !== "array") throw new Error("expected an array node");
    expect(node.children[1]).toEqual({ type: "ref", refId: node.refId });
  });

  test("a structure shared twice is drawn once, then referenced", () => {
    const shared: PVMLBoxType = { type: "array", elements: [1n, 2n] };
    const outer: PVMLBoxType = { type: "array", elements: [shared, shared] };
    const node = toDataVisualizerNodePvml(outer, createRefIdAllocator());
    if (node.type !== "array") throw new Error("expected an array node");
    expect(node.children[0].type).toBe("array");
    expect(node.children[1].type).toBe("ref");
  });

  describe("strings are sent quoted, as Python writes them", () => {
    test.each(QUOTED_STRINGS)("%j", (text, quoted) => {
      const refs = createRefIdAllocator();
      const leaf = { type: "leaf", displayValue: quoted, label: "quoted_string" };
      expect(toDataVisualizerNodePvml(text, refs)).toEqual(leaf);
      const pair: PVMLArray = { type: "array", elements: [text, 1n] };
      const node = toDataVisualizerNodePvml(pair, refs);
      if (node.type !== "array") throw new Error("expected an array node");
      expect(node.children[0]).toEqual(leaf);
    });
  });
});
