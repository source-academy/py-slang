import type { SerializedDataVisualizerNode } from "@sourceacademy/common-data-visualizer";

/**
 * Python's `None` as a data-visualizer node: the shared `"empty"` node, plus how Python writes it,
 * so `draw_data(None)` shows `None` rather than the host's language-neutral default, `null`.
 * Inside a pair/list the host still draws it as a diagonal slash.
 */
export function noneNode(): SerializedDataVisualizerNode {
  return { type: "empty", displayValue: "None" };
}
