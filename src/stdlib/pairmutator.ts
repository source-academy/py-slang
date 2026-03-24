import { Context } from "../cse-machine/context";
import { ControlItem } from "../cse-machine/control";
import { Value, NoneValue } from "../cse-machine/stash";
import { Validate } from "../stdlib";
import pairmutatorPrelude from "./pairmutator.prelude";
import { GroupName, Group } from "./utils";

const pairmutatorBuiltins = new Map<string, Value>();

class PairmutatorBuiltins {
  @Validate(2, 2, "set_head", true)
  static set_head(
    args: Value[],
    source: string,
    command: ControlItem,
    context: Context,
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
    source: string,
    command: ControlItem,
    context: Context,
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
      func: PairmutatorBuiltins[builtin as keyof typeof PairmutatorBuiltins] as any,
      name: builtin,
    }); // TODO: fix typing
  }
}
export default {
  name: GroupName.PAIRMUTATORS,
  prelude: pairmutatorPrelude,
  builtins: pairmutatorBuiltins,
} as Group;
