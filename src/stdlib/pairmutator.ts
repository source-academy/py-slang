import { Context } from "../engines/cse/context";
import { ControlItem } from "../engines/cse/control";
import { BuiltinValue, NoneValue, Value } from "../engines/cse/stash";
import { Validate } from "../stdlib";
import { Group, GroupName } from "./utils";

const pairmutatorBuiltins = new Map<string, BuiltinValue>();

class PairmutatorBuiltins {
  @Validate(2, 2, "set_head", true)
  static set_head(
    args: Value[],
    _source: string,
    _command: ControlItem,
    _context: Context,
  ): NoneValue {
    const head = args[0];
    const tail = args[1];
    if (head.type !== "list" || head.value.length !== 2) {
      throw new Error("set_head expects a pair as the first argument");
    }
    head.value[0] = tail;
    return { type: "none" };
  }

  @Validate(2, 2, "set_tail", true)
  static set_tail(
    args: Value[],
    _source: string,
    _command: ControlItem,
    _context: Context,
  ): NoneValue {
    const head = args[0];
    const tail = args[1];
    if (head.type !== "list" || head.value.length !== 2) {
      throw new Error("set_tail expects a pair as the first argument");
    }
    head.value[1] = tail;
    return { type: "none" };
  }
}
for (const builtin of Object.getOwnPropertyNames(PairmutatorBuiltins)) {
  if (
    typeof PairmutatorBuiltins[builtin as keyof typeof PairmutatorBuiltins] === "function" &&
    !builtin.startsWith("_")
  ) {
    pairmutatorBuiltins.set(builtin, {
      type: "builtin",
      func: PairmutatorBuiltins[
        builtin as keyof typeof PairmutatorBuiltins
      ] as BuiltinValue["func"],
      name: builtin,
      minArgs: minArgMap.get(builtin) || 0,
    });
  }
}
export default {
  name: GroupName.PAIRMUTATORS,
  prelude: ``,
  builtins: pairmutatorBuiltins,
} as Group;
