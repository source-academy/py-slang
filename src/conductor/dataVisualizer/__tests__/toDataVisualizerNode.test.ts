import { createRefIdAllocator } from "@sourceacademy/runner-data-visualizer";
import type { SerializedDataVisualizerNode } from "@sourceacademy/common-data-visualizer";

import { Value } from "../../../engines/cse/stash";
import { toDataVisualizerNode } from "../toDataVisualizerNode";

function num(value: number): Value {
  return { type: "number", value };
}

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

describe("toDataVisualizerNode", () => {
  test("converts leaf values", () => {
    const refs = createRefIdAllocator();
    expect(toDataVisualizerNode(num(42), refs)).toEqual({
      type: "leaf",
      displayValue: "42.0",
      label: "number",
    });
    expect(toDataVisualizerNode({ type: "string", value: "hi" }, refs)).toEqual({
      type: "leaf",
      displayValue: "'hi'",
      label: "quoted_string",
    });
    expect(toDataVisualizerNode({ type: "bool", value: true }, refs)).toEqual({
      type: "leaf",
      displayValue: "True",
      label: "bool",
    });
  });

  test("converts None to the empty terminator", () => {
    const refs = createRefIdAllocator();
    expect(toDataVisualizerNode({ type: "none" }, refs)).toEqual({
      type: "empty",
      displayValue: "None",
    });
  });

  test("converts a pair (a length-2 ListValue) to an array node", () => {
    const refs = createRefIdAllocator();
    const pair: Value = { type: "list", value: [num(1), num(2)] };
    const node = toDataVisualizerNode(pair, refs);
    expect(node).toEqual({
      type: "array",
      refId: expect.any(Number),
      children: [
        { type: "leaf", displayValue: "1.0", label: "number" },
        { type: "leaf", displayValue: "2.0", label: "number" },
      ],
    });
  });

  test("converts a longer native list (not fixed at length 2)", () => {
    const refs = createRefIdAllocator();
    const list: Value = { type: "list", value: [num(1), num(2), num(3), num(4)] };
    const node = toDataVisualizerNode(list, refs);
    if (node.type !== "array") throw new Error("expected an array node");
    expect(node.children).toHaveLength(4);
  });

  test("a self-referential list terminates via a ref node instead of recursing forever", () => {
    const refs = createRefIdAllocator();
    const xs: Value = { type: "list", value: [num(1)] };
    xs.value.push(xs);

    const node = toDataVisualizerNode(xs, refs);
    if (node.type !== "array") throw new Error("expected an array node");
    expect(node.children[0]).toEqual({ type: "leaf", displayValue: "1.0", label: "number" });
    expect(node.children[1]).toEqual({ type: "ref", refId: node.refId });
  });

  test("a shared-but-acyclic list is referenced the second time, not re-walked", () => {
    const refs = createRefIdAllocator();
    const shared: Value = { type: "list", value: [num(9)] };
    const outer: Value = { type: "list", value: [shared, shared] };

    const node = toDataVisualizerNode(outer, refs);
    if (node.type !== "array") throw new Error("expected an array node");
    const [first, second] = node.children;
    if (first.type !== "array")
      throw new Error("expected the first occurrence to be an array node");
    expect(second).toEqual({ type: "ref", refId: first.refId });
  });

  test("closures/functions become function nodes, referenced by identity on repeat occurrence", () => {
    const refs = createRefIdAllocator();
    const fn: Value = {
      type: "function",
      name: "f",
      params: [],
      body: [],
      env: { tail: null, name: "global", head: {}, id: "-1" },
    };

    const first = toDataVisualizerNode(fn, refs);
    const second = toDataVisualizerNode(fn, refs);
    if (first.type !== "function") throw new Error("expected a function node");
    expect(second).toEqual({ type: "ref", refId: first.refId });
  });

  test("unrecognized-in-this-context values (error/opaque) fall back to a leaf rather than throwing", () => {
    const refs = createRefIdAllocator();
    const errorValue: Value = { type: "error", message: "boom" };
    const node: SerializedDataVisualizerNode = toDataVisualizerNode(errorValue, refs);
    expect(node).toEqual({ type: "leaf", displayValue: "boom", label: "error" });
  });

  describe("strings are sent quoted, as Python writes them", () => {
    test.each(QUOTED_STRINGS)("%j", (text, quoted) => {
      const refs = createRefIdAllocator();
      const leaf = { type: "leaf", displayValue: quoted, label: "quoted_string" };
      expect(toDataVisualizerNode({ type: "string", value: text }, refs)).toEqual(leaf);
      const pair: Value = { type: "list", value: [{ type: "string", value: text }, num(1)] };
      const node = toDataVisualizerNode(pair, refs);
      if (node.type !== "array") throw new Error("expected an array node");
      expect(node.children[0]).toEqual(leaf);
    });
  });
});
