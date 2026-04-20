import { ExprNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { BuiltinValue, ListValue, NoneValue, Value } from "../engines/cse/stash";
import { minArgMap, Validate } from "../stdlib";
import streamPrelude from "./stream.prelude";
import { GroupName } from "./utils";

const streamBuiltins = new Map<string, BuiltinValue>();

class StreamBuiltins {
  @Validate(0, null, "stream", true)
  static stream(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): ListValue | NoneValue {
    if (args.length === 0) {
      return { type: "none" };
    }
    const head = args[0];
    return {
      type: "list",
      value: [
        head,
        {
          type: "builtin",
          name: "anonymous stream",
          minArgs: 0,
          func: () => StreamBuiltins.stream(args.slice(1), source, command, context),
        },
      ],
    };
  }
}
for (const builtin of Object.getOwnPropertyNames(StreamBuiltins)) {
  if (
    typeof StreamBuiltins[builtin as keyof typeof StreamBuiltins] === "function" &&
    !builtin.startsWith("_")
  ) {
    streamBuiltins.set(builtin, {
      type: "builtin",
      func: StreamBuiltins[builtin as keyof typeof StreamBuiltins] as BuiltinValue["func"],
      name: builtin,
      minArgs: minArgMap.get(builtin) || 0,
    });
  }
}
export default {
  name: GroupName.STREAMS,
  prelude: streamPrelude,
  builtins: streamBuiltins,
};
