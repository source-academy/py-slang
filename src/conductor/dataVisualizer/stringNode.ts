import type { SerializedDataVisualizerNode } from "@sourceacademy/common-data-visualizer";

import { escape } from "../../stdlib/utils";

/**
 * The label of a string that the evaluator has already quoted (`repr`). The host shows such a
 * leaf as sent, and, when a box is too narrow, shortens it without cutting an escape sequence.
 * It is not `"string"`: a host that adds the quotes itself (an older one, or the host of another
 * language) would show them twice, and one that does not know this label shows the text as sent.
 */
export const QUOTED_STRING_LABEL = "quoted_string";

/**
 * A Python string as a data-visualizer leaf, with Python's quoting and escapes
 * (`'say "hi"'`, `"it's"`, `'a\nb'`), so that what is drawn is a valid literal.
 */
export function stringNode(value: string): SerializedDataVisualizerNode {
  return { type: "leaf", displayValue: escape(value), label: QUOTED_STRING_LABEL };
}
