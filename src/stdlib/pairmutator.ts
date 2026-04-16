import { ExprNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { handleRuntimeError } from "../engines/cse/error";
import { BuiltinValue, NoneValue, Value } from "../engines/cse/stash";
import { TypeError } from "../errors";
import { minArgMap, Validate } from "../stdlib";
import { GroupName } from "./utils";

const pairmutatorBuiltins = new Map<string, BuiltinValue>();

class PairmutatorBuiltins {
  @Validate(2, 2, "set_head", true)
  static set_head(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): NoneValue {
    const head = args[0];
    const tail = args[1];
    if (head.type !== "list" || head.value.length !== 2) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, head.type, "pair")
      );
    }
    head.value[0] = tail;
    return { type: "none" };
  }

  @Validate(2, 2, "set_tail", true)
  static set_tail(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): NoneValue {
    const head = args[0];
    const tail = args[1];
    if (head.type !== "list" || head.value.length !== 2) {
      handleRuntimeError(
        context,
        new TypeError(source, command, context, head.type, "pair")
      );
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
};
