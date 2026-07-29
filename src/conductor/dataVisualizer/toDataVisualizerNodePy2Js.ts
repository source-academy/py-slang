import type { RefIdAllocator } from "@sourceacademy/runner-data-visualizer";
import type { SerializedDataVisualizerNode } from "@sourceacademy/common-data-visualizer";

import { PyOpaque, type PyValue, pyStr } from "../../engines/py2js/runtime";

/**
 * Converts one py2js runtime {@link PyValue} into a {@link SerializedDataVisualizerNode}. The py2js
 * counterpart of `toDataVisualizerNode.ts` (which does the same for the CSE machine's tagged
 * `Value`) — purely mechanical, dispatches on the native (unboxed) value's own JS shape and recurses
 * into list elements. No cycle-detection or classification happens here; that's entirely the host's
 * job (see `BaseDataVisualizerRunnerPlugin`'s doc comment in `@sourceacademy/runner-data-visualizer`).
 *
 * Deliberately does NOT reuse stdlibBridge.ts's toTagged/CSE-Value round-trip: that conversion walks
 * a pair/list's spine with no cycle guard (relies on no bridged builtin ever being handed a genuinely
 * self-referential structure), whereas a `draw_data`d structure can be exactly that (chapter 3+'s
 * set_head/set_tail build real cycles) — walking native PyValues directly and leaning on `refs` here,
 * the same way the CSE adapter does, is what makes a cyclic argument terminate via a "ref" node
 * instead of hanging.
 *
 * A SICP §2 pair *is* a length-2 `PyList` in py2js (runtime.ts) — there's no separate pair type — so
 * every list, regardless of length, becomes the wire format's N-ary `"array"` node; the host
 * distinguishes "pair" from "list" by `children.length`, not by tag. Leaf labels ("bigint", "number",
 * "bool", "string", "complex", "opaque") match the CSE adapter's `Value.type` labels exactly, since
 * the host's `formatLeaf` special-cases `label === "string"` for quoting and nothing else.
 */
export function toDataVisualizerNodePy2Js(
  value: PyValue,
  refs: RefIdAllocator,
): SerializedDataVisualizerNode {
  switch (typeof value) {
    case "bigint":
      return { type: "leaf", displayValue: pyStr(value), label: "bigint" };
    case "number":
      return { type: "leaf", displayValue: pyStr(value), label: "number" };
    case "boolean":
      return { type: "leaf", displayValue: pyStr(value), label: "bool" };
    case "string":
      return { type: "leaf", displayValue: pyStr(value), label: "string" };
    case "function": {
      const { refId, alreadySeen } = refs.get(value);
      if (alreadySeen) return { type: "ref", refId };
      return { type: "function", refId, displayValue: pyStr(value) };
    }
    default:
      if (value === null) return { type: "empty" };
      if (Array.isArray(value)) {
        const { refId, alreadySeen } = refs.get(value);
        if (alreadySeen) return { type: "ref", refId };
        return {
          type: "array",
          refId,
          children: value.map(element => toDataVisualizerNodePy2Js(element, refs)),
        };
      }
      if (value instanceof PyOpaque) {
        return { type: "leaf", displayValue: pyStr(value), label: "opaque" };
      }
      // PyComplexNumber, the only PyValue variant left.
      return { type: "leaf", displayValue: pyStr(value), label: "complex" };
  }
}
