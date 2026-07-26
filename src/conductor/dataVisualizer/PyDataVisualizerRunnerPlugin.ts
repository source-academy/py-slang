import { BaseDataVisualizerRunnerPlugin, type RefIdAllocator } from "@sourceacademy/runner-data-visualizer";
import type { SerializedDataVisualizerNode } from "@sourceacademy/common-data-visualizer";

import { Value } from "../../engines/cse/stash";
import { toDataVisualizerNode } from "./toDataVisualizerNode";

/**
 * The py-slang (Python) binding of the language-agnostic data visualizer runner.
 *
 * All Python-specific knowledge lives in {@link toDataVisualizerNode}; this class is the thin
 * adapter `BaseDataVisualizerRunnerPlugin` expects — no cycle-detection or classification here, that
 * stays host-side, shared across every language. Mirrors `PythonStepperRunnerPlugin`'s shape.
 */
export class PythonDataVisualizerRunnerPlugin extends BaseDataVisualizerRunnerPlugin<Value> {
  protected toNode(value: Value, refs: RefIdAllocator): SerializedDataVisualizerNode {
    return toDataVisualizerNode(value, refs);
  }
}
