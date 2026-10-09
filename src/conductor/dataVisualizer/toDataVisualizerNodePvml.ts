import type { RefIdAllocator } from "@sourceacademy/runner-data-visualizer";
import type { SerializedDataVisualizerNode } from "@sourceacademy/common-data-visualizer";

import { pvmlBoxToCseValue } from "../../engines/pvml/cse-interop";
import { isPVMLObject, type PVMLBoxType } from "../../engines/pvml/types";
import { toPythonString } from "../../stdlib/utils";
import { noneNode } from "./noneNode";

/**
 * Converts one PVML runtime value ({@link PVMLBoxType}) into a {@link SerializedDataVisualizerNode}.
 * The PVML counterpart of `toDataVisualizerNode.ts` (CSE) and `toDataVisualizerNodePy2Js.ts` (py2js):
 * purely mechanical, recursing into list elements, with cycle detection left to the host via `refs`
 * (chapter 3+'s set_head/set_tail build real cycles, which terminate here as "ref" nodes).
 *
 * A SICP §2 pair is a length-2 {@link PVMLArray}, so every list becomes the wire format's N-ary
 * `"array"` node. Leaves and functions are rendered with the same text `print` shows
 * (`pvmlBoxToCseValue` + `toPythonString`, never called on an array, so never on a cycle), and leaf
 * labels match the CSE adapter's `Value.type` labels.
 */
export function toDataVisualizerNodePvml(
  value: PVMLBoxType,
  refs: RefIdAllocator,
): SerializedDataVisualizerNode {
  if (value === null || value === undefined) return noneNode();
  if (isPVMLObject(value)) {
    switch (value.type) {
      case "array": {
        const { refId, alreadySeen } = refs.get(value);
        if (alreadySeen) return { type: "ref", refId };
        return {
          type: "array",
          refId,
          children: value.elements.map(element => toDataVisualizerNodePvml(element, refs)),
        };
      }
      case "closure":
      case "primitive":
      case "extern": {
        const { refId, alreadySeen } = refs.get(value);
        if (alreadySeen) return { type: "ref", refId };
        return {
          type: "function",
          refId,
          displayValue: toPythonString(pvmlBoxToCseValue(value)),
        };
      }
      case "opaque":
        return {
          type: "leaf",
          displayValue: toPythonString(pvmlBoxToCseValue(value)),
          label: "opaque",
        };
      case "iterator":
        // A for-loop's internal iteration state; never a value a program can pass to draw_data.
        return { type: "leaf", displayValue: "<iterator>", label: "unknown" };
    }
  }
  const cseValue = pvmlBoxToCseValue(value);
  return { type: "leaf", displayValue: toPythonString(cseValue), label: cseValue.type };
}
