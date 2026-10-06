import {
  BaseDataVisualizerRunnerPlugin,
  type RefIdAllocator,
} from "@sourceacademy/runner-data-visualizer";
import type { SerializedDataVisualizerNode } from "@sourceacademy/common-data-visualizer";

import type { PVMLBoxType } from "../../engines/pvml/types";
import { toDataVisualizerNodePvml } from "./toDataVisualizerNodePvml";

/**
 * The PVML-in-browser engine's binding of the language-agnostic data visualizer runner — the
 * counterpart of `PythonDataVisualizerRunnerPlugin` (CSE) and `Py2JsDataVisualizerRunnerPlugin`
 * (py2js). All PVML-specific knowledge lives in {@link toDataVisualizerNodePvml}.
 */
export class PvmlDataVisualizerRunnerPlugin extends BaseDataVisualizerRunnerPlugin<PVMLBoxType> {
  protected toNode(value: PVMLBoxType, refs: RefIdAllocator): SerializedDataVisualizerNode {
    return toDataVisualizerNodePvml(value, refs);
  }
}
