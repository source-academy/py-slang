import { ExprNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { BuiltinValue, Value } from "../engines/cse/stash";
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
  ): Promise<Value> {
    // Draws its arguments when a data visualizer is attached (the browser); headless, there is
    // nothing to draw to, so this is just the identity on its first argument. Either way it returns
    // that argument, like Source's draw_data, so the call can sit inside an expression.
    await context.dataVisualizer?.sendDrawing(args);
    return args[0];
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
