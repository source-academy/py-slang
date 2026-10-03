/**
 * pair/llist/head/tail must return the caller's own values, not copies (see stdlibBridge.ts's
 * nativeLinkedListPrimitive). Through the generic stdlib bridge, every call rebuilt the PyLists it
 * touched, so shared substructure was silently duplicated: draw_data drew one shared list as two,
 * and set_head/set_tail on a value obtained through head/tail mutated a throwaway copy.
 */
import type { BaseDataVisualizerRunnerPlugin } from "@sourceacademy/runner-data-visualizer";
import { createRefIdAllocator } from "@sourceacademy/runner-data-visualizer";

import { toDataVisualizerNodePy2Js } from "../conductor/dataVisualizer/toDataVisualizerNodePy2Js";
import { Py2JsSession, runCodePy2Js, type PyValue } from "../engines/py2js";

function run(code: string, variant = 3): string {
  return runCodePy2Js(code, variant).output;
}

function runError(code: string, variant = 3): string {
  try {
    runCodePy2Js(code, variant);
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("expected the program to fail");
}

describe("py2js linked-list primitives preserve sharing", () => {
  test("set_head through head() mutates the shared list", () => {
    const code = `
x = llist(1)
y = pair(x, x)
set_head(head(y), 99)
print(head(x))
print(head(head(y)))
print(head(tail(y)))
`;
    expect(run(code)).toBe("99\n99\n99\n");
  });

  test("set_tail through tail() mutates the original list", () => {
    const code = `
xs = llist(1, 2, 3)
set_tail(tail(xs), None)
print_llist(xs)
`;
    expect(run(code)).toBe("llist(1, 2)\n");
  });

  test("prelude functions built on pair/head/tail share structure too", () => {
    const code = `
xs = llist(1, 2)
ys = append(llist(0), xs)
set_head(xs, 99)
print_llist(ys)
`;
    expect(run(code)).toBe("llist(0, 99, 2)\n");
  });

  test("results are unchanged", () => {
    expect(run("print(pair(1, 2))", 2)).toBe("[1, 2]\n");
    expect(run("print(llist())", 2)).toBe("None\n");
    expect(run("print(llist(1, 2))", 2)).toBe("[1, [2, None]]\n");
    expect(run("print(head(pair(1, 2)), tail(pair(1, 2)))", 2)).toBe("1 2\n");
    expect(run("print(head)", 2)).toBe("<built-in function head>\n");
  });

  test("errors keep the CSE machine's messages", () => {
    expect(runError("head(5)")).toBe("TypeError: unsupported argument type for head: integer");
    expect(runError("tail(None)")).toBe("TypeError: unsupported argument type for tail: None");
    expect(runError("head([1, 2, 3])")).toBe("TypeError: unsupported argument type for head: list");
    expect(runError("pair(1)")).toMatch(
      /^TypeError: pair\(\) takes at least 2 argument \(1 given\)/,
    );
    expect(runError("pair(1, 2, 3)")).toMatch(
      /^TypeError: pair\(\) takes at most 2 arguments \(3 given\)/,
    );
    expect(runError("head()")).toMatch(
      /^TypeError: head\(\) takes at least 1 argument \(0 given\)/,
    );
  });

  test("draw_data receives shared substructure as a ref, not a copy", async () => {
    const drawings: PyValue[][] = [];
    const dataVisualizer = {
      sendDrawing: (args: PyValue[]) => drawings.push(args),
    } as unknown as BaseDataVisualizerRunnerPlugin<PyValue>;
    const session = new Py2JsSession(2, { dataVisualizer });

    await session.runChunk(`
def dup(xs):
    return (None if is_none(xs)
            else pair(head(xs), pair(head(xs), dup(tail(xs)))))

draw_data(dup(llist(llist(1), 2)))
`);

    expect(drawings).toHaveLength(1);
    const node = toDataVisualizerNodePy2Js(drawings[0][0], createRefIdAllocator());
    // dup(...) is [inner, [inner, [2, [2, None]]]]: the second occurrence of inner is a ref.
    expect(node).toMatchObject({
      type: "array",
      children: [
        { type: "array", refId: expect.anything() },
        { type: "array", children: [{ type: "ref" }, expect.anything()] },
      ],
    });
    const first = (node as { children: { refId: unknown }[] }).children[0];
    const second = (node as { children: { children: { refId: unknown }[] }[] }).children[1]
      .children[0];
    expect(second.refId).toBe(first.refId);
  });
});
