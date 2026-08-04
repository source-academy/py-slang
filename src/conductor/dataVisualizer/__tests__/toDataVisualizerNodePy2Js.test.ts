import { createRefIdAllocator } from "@sourceacademy/runner-data-visualizer";

import { PyComplexNumber } from "../../../types/value-types";
import { PyOpaque, type PyValue } from "../../../engines/py2js/runtime";
import { toDataVisualizerNodePy2Js } from "../toDataVisualizerNodePy2Js";

describe("toDataVisualizerNodePy2Js", () => {
  test("converts leaf values", () => {
    const refs = createRefIdAllocator();
    expect(toDataVisualizerNodePy2Js(42n, refs)).toEqual({
      type: "leaf",
      displayValue: "42",
      label: "bigint",
    });
    expect(toDataVisualizerNodePy2Js(2.5, refs)).toEqual({
      type: "leaf",
      displayValue: "2.5",
      label: "number",
    });
    expect(toDataVisualizerNodePy2Js("hi", refs)).toEqual({
      type: "leaf",
      displayValue: "hi",
      label: "string",
    });
    expect(toDataVisualizerNodePy2Js(true, refs)).toEqual({
      type: "leaf",
      displayValue: "True",
      label: "bool",
    });
    const complex = new PyComplexNumber(1, 2);
    expect(toDataVisualizerNodePy2Js(complex, refs)).toEqual({
      type: "leaf",
      displayValue: complex.toString(),
      label: "complex",
    });
  });

  test("converts None to the empty terminator", () => {
    const refs = createRefIdAllocator();
    expect(toDataVisualizerNodePy2Js(null, refs)).toEqual({ type: "empty" });
  });

  test("converts a pair (a length-2 PyList) to an array node", () => {
    const refs = createRefIdAllocator();
    const pair: PyValue = [1n, 2n];
    const node = toDataVisualizerNodePy2Js(pair, refs);
    expect(node).toEqual({
      type: "array",
      refId: expect.any(Number),
      children: [
        { type: "leaf", displayValue: "1", label: "bigint" },
        { type: "leaf", displayValue: "2", label: "bigint" },
      ],
    });
  });

  test("converts a longer native list (not fixed at length 2)", () => {
    const refs = createRefIdAllocator();
    const list: PyValue = [1n, 2n, 3n, 4n];
    const node = toDataVisualizerNodePy2Js(list, refs);
    if (node.type !== "array") throw new Error("expected an array node");
    expect(node.children).toHaveLength(4);
  });

  test("a self-referential list terminates via a ref node instead of recursing forever", () => {
    const refs = createRefIdAllocator();
    const xs: PyValue[] = [1n];
    xs.push(xs);

    const node = toDataVisualizerNodePy2Js(xs, refs);
    if (node.type !== "array") throw new Error("expected an array node");
    expect(node.children[0]).toEqual({ type: "leaf", displayValue: "1", label: "bigint" });
    expect(node.children[1]).toEqual({ type: "ref", refId: node.refId });
  });

  test("a shared-but-acyclic list is referenced the second time, not re-walked", () => {
    const refs = createRefIdAllocator();
    const shared: PyValue = [9n];
    const outer: PyValue = [shared, shared];

    const node = toDataVisualizerNodePy2Js(outer, refs);
    if (node.type !== "array") throw new Error("expected an array node");
    const [first, second] = node.children;
    if (first.type !== "array")
      throw new Error("expected the first occurrence to be an array node");
    expect(second).toEqual({ type: "ref", refId: first.refId });
  });

  test("functions become function nodes, referenced by identity on repeat occurrence", () => {
    const refs = createRefIdAllocator();
    const fn = Object.assign((x: PyValue) => x, { pyName: "f", pyArity: 1, pyBuiltin: false });

    const first = toDataVisualizerNodePy2Js(fn, refs);
    const second = toDataVisualizerNodePy2Js(fn, refs);
    if (first.type !== "function") throw new Error("expected a function node");
    expect(second).toEqual({ type: "ref", refId: first.refId });
  });

  test("an opaque module value falls back to a leaf rather than throwing", () => {
    const refs = createRefIdAllocator();
    const opaque = new PyOpaque({} as never);
    const node = toDataVisualizerNodePy2Js(opaque, refs);
    expect(node).toEqual({ type: "leaf", displayValue: "<opaque object>", label: "opaque" });
  });
});
