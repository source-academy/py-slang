import { ExprNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { BoolValue, BuiltinValue, Value } from "../engines/cse/stash";
import { GroupName, minArgMap, Validate } from "./utils";

const listBuiltins = new Map<string, BuiltinValue>();

class ListBuiltins {
  @Validate(1, 1, "is_list", true)
  static is_list(
    args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): BoolValue {
    const list = args[0];
    return { type: "bool", value: list.type === "list" };
  }
}
for (const builtin of Object.getOwnPropertyNames(ListBuiltins)) {
  if (typeof ListBuiltins[builtin as keyof typeof ListBuiltins] === "function") {
    listBuiltins.set(builtin, {
      type: "builtin",
      func: ListBuiltins[builtin as keyof typeof ListBuiltins] as BuiltinValue["func"],
      name: builtin,
      minArgs: minArgMap.get(builtin) || 0,
    });
  }
}
export default {
  name: GroupName.LIST,
  prelude: "",
  builtins: listBuiltins,
};
