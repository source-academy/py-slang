import {
  BaseDataVisualizerRunnerPlugin,
  type RefIdAllocator,
} from "@sourceacademy/runner-data-visualizer";
import type { SerializedDataVisualizerNode } from "@sourceacademy/common-data-visualizer";

import type { PyValue } from "../../engines/py2js/runtime";
import { toDataVisualizerNodePy2Js } from "./toDataVisualizerNodePy2Js";

/**
 * The py2js engine's binding of the language-agnostic data visualizer runner — the native-value
 * counterpart of `PythonDataVisualizerRunnerPlugin` (the CSE machine's binding).
 *
 * All py2js-specific knowledge lives in {@link toDataVisualizerNodePy2Js}; this class is the thin
 * adapter `BaseDataVisualizerRunnerPlugin` expects — no cycle-detection or classification here, that
 * stays host-side, shared across every language and every engine.
 */
export class Py2JsDataVisualizerRunnerPlugin extends BaseDataVisualizerRunnerPlugin<PyValue> {
  protected toNode(value: PyValue, refs: RefIdAllocator): SerializedDataVisualizerNode {
    return toDataVisualizerNodePy2Js(value, refs);
  }
}
