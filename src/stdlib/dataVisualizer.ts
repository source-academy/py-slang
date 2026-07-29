import { ExprNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { BuiltinValue, NoneValue, Value } from "../engines/cse/stash";
import { GroupName, minArgMap, Validate } from "./utils";

const dataVisualizerBuiltins = new Map<string, BuiltinValue>();

export class DataVisualizerBuiltins {
  // Minimum 1 arg, matching the documented signature `def draw_data(value1, *values)`
  // (docs/lib/linked_list.py) and js-slang's own minimum.
  @Validate(1, null, "draw_data", true)
  static async draw_data(
    args: Value[],
    _source: string,
    _command: ExprNS.Call,
    context: Context,
  ): Promise<NoneValue> {
    await context.dataVisualizer?.sendDrawing(args);
    return { type: "none" };
  }
}

for (const builtin of Object.getOwnPropertyNames(DataVisualizerBuiltins)) {
  if (
    typeof DataVisualizerBuiltins[builtin as keyof typeof DataVisualizerBuiltins] === "function" &&
    !builtin.startsWith("_")
  ) {
    dataVisualizerBuiltins.set(builtin, {
      type: "builtin",
      func: DataVisualizerBuiltins[
        builtin as keyof typeof DataVisualizerBuiltins
      ] as BuiltinValue["func"],
      name: builtin,
      minArgs: minArgMap.get(builtin) || 0,
    });
  }
}

export default {
  name: GroupName.DATA_VISUALIZER,
  prelude: "",
  builtins: dataVisualizerBuiltins,
};
