import { ArrayValue, Config, Data } from "@sourceacademy/common-data-display";
import { BaseDataDisplayRunnerPlugin } from "@sourceacademy/runner-data-display";
import { ListValue, Value } from "../../engines/cse/stash";
import { toPythonString } from "../../stdlib/utils";
export default class CseDataDisplayPlugin extends BaseDataDisplayRunnerPlugin<Value> {
  public static instance?: CseDataDisplayPlugin;
  constructor(...args: ConstructorParameters<typeof BaseDataDisplayRunnerPlugin>) {
    super(...args);
    CseDataDisplayPlugin.instance = this;
  }
  getConfig(): Config {
    return {
      sicpTextbookName: "Structure and Interpretation of Computer Programs",
      sicpTextbookUrl: "https://sourceacademy.org/sicpy/",
      functionCallText: "draw_data(x1, x2, x3, ..., xn)",
    };
  }
  serialiseData(data: Value, objCache: WeakMap<ListValue, Data> = new WeakMap()): Data {
    switch (data.type) {
      case "number":
      case "bigint":
      case "bool":
      case "complex":
      case "string":
      case "none":
      case "error":
      case "opaque":
        return { type: "string", value: toPythonString(data, true) };
      case "builtin":
      case "function":
      case "multi_lambda":
      case "closure":
        return { type: "function" };
      case "list": {
        if (objCache.has(data)) {
          return objCache.get(data)!;
        }
        const arrayValue: ArrayValue = { type: "array", value: [] };
        objCache.set(data, arrayValue);
        arrayValue.value.push(...data.value.map(item => this.serialiseData(item, objCache)));
        return arrayValue;
      }
    }
  }
}
