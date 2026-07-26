import type { RefIdAllocator } from "@sourceacademy/runner-data-visualizer";
import type { SerializedDataVisualizerNode } from "@sourceacademy/common-data-visualizer";

import { Value } from "../../engines/cse/stash";
import { toPythonString } from "../../stdlib/utils";

/**
 * Converts one py-slang runtime {@link Value} into a {@link SerializedDataVisualizerNode}. Purely
 * mechanical — dispatches on `Value.type` and recurses into list elements. No cycle-detection or
 * classification happens here; that's entirely the host's job (see `BaseDataVisualizerRunnerPlugin`'s
 * doc comment in `@sourceacademy/runner-data-visualizer`).
 *
 * A SICP §2 pair *is* a length-2 `ListValue` in py-slang — there's no separate pair type — so every
 * list, regardless of length, becomes the wire format's N-ary `"array"` node; the host distinguishes
 * "pair" from "list" by `children.length`, not by tag.
 */
export function toDataVisualizerNode(value: Value, refs: RefIdAllocator): SerializedDataVisualizerNode {
  switch (value.type) {
    case "none":
      return { type: "empty" };
    case "list": {
      const { refId, alreadySeen } = refs.get(value);
      if (alreadySeen) {
        return { type: "ref", refId };
      }
      return {
        type: "array",
        refId,
        children: value.value.map(element => toDataVisualizerNode(element, refs)),
      };
    }
    case "closure":
    case "function":
    case "multi_lambda":
    case "builtin": {
      const { refId, alreadySeen } = refs.get(value);
      if (alreadySeen) {
        return { type: "ref", refId };
      }
      return { type: "function", refId, displayValue: toPythonString(value) };
    }
    case "number":
    case "bool":
    case "complex":
    case "string":
    case "error":
    case "bigint":
    case "opaque":
      return { type: "leaf", displayValue: toPythonString(value), label: value.type };
    default:
      value satisfies never;
      return { type: "leaf", displayValue: String(value), label: "unknown" };
  }
}
