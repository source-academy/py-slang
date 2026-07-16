import { ExprNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { handleRuntimeError } from "../engines/cse/error";
import { BigIntValue, BoolValue, BuiltinValue, Value } from "../engines/cse/stash";
import { TypeError } from "../errors";
import { GroupName, minArgMap, Validate } from "./utils";

const listBuiltins = new Map<string, BuiltinValue>();

class ListBuiltins {
  @Validate(1, 1, "list_length", true)
  static list_length(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): BigIntValue {
    const list = args[0];
    if (list.type !== "list") {
      handleRuntimeError(context, new TypeError(source, command, context, list.type, "list"));
    }
    return { type: "bigint", value: BigInt(list.value.length) };
  }

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
