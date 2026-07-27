import { ArrayValue, Config, Data } from "@sourceacademy/common-data-display";
import { BaseDataDisplayRunnerPlugin } from "@sourceacademy/runner-data-display";
import { llistLeafRepr } from "../../engines/pvml/builtins";
import { isPVMLObject, PVMLArray, PVMLBoxType } from "../../engines/pvml/types";
export default class PvmlDataDisplayPlugin extends BaseDataDisplayRunnerPlugin<PVMLBoxType> {
  public static instance?: PvmlDataDisplayPlugin;
  constructor(...args: ConstructorParameters<typeof BaseDataDisplayRunnerPlugin>) {
    super(...args);
    PvmlDataDisplayPlugin.instance = this;
  }
  getConfig(): Config {
    return {
      sicpTextbookName: "Structure and Interpretation of Computer Programs",
      sicpTextbookUrl: "https://sourceacademy.org/sicpy/",
      functionCallText: "draw_data(x1, x2, x3, ..., xn)",
    };
  }
  serialiseData(data: PVMLBoxType, objCache: WeakMap<PVMLArray, Data> = new WeakMap()): Data {
    if (!isPVMLObject(data)) {
      const repr = llistLeafRepr(data);
      return { type: "string", value: repr };
    }

    switch (data.type) {
      case "array": {
        if (objCache.has(data)) {
          return objCache.get(data)!;
        }
        const arrayValue: ArrayValue = { type: "array", value: [] };
        objCache.set(data, arrayValue);
        arrayValue.value.push(...data.elements.map(item => this.serialiseData(item, objCache)));
        return arrayValue;
      }
      case "closure":
      case "extern":
      case "primitive":
        return { type: "function" };
      case "iterator":
        return { type: "string", value: "<iterator>" };
      case "opaque":
        return { type: "string", value: "<opaque>" };
    }
  }
}
