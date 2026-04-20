import { ExprNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { handleRuntimeError } from "../engines/cse/error";
import { BigIntValue, BoolValue, BuiltinValue, Value } from "../engines/cse/stash";
import { TypeError } from "../errors";
import { minArgMap, Validate } from "../stdlib";
import listPrelude from "./list.prelude";
import { GroupName } from "./utils";

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

  // A helper function to generate a list of a given length
  @Validate(1, 1, "_gen_list", true)
  static _gen_list(
    args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): Value {
    const length = args[0];
    if (length.type !== "bigint") {
      throw new Error("_gen_list expects a bigint as the first argument");
    }
    const list: Value[] = [];
    for (let i = BigInt(0); i < length.value; i++) {
      list.push({ type: "none" });
    }
    return { type: "list", value: list };
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
  prelude: listPrelude,
  builtins: listBuiltins,
};
