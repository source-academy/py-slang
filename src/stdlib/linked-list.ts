import { ExprNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { ControlItem } from "../engines/cse/control";
import { handleRuntimeError } from "../engines/cse/error";
import { BoolValue, BuiltinValue, ListValue, NoneValue, Value } from "../engines/cse/stash";
import { displayOutput } from "../engines/cse/streams";
import { TypeError } from "../errors";
import linkedListPrelude from "./linked-list.prelude";
import { GroupName, minArgMap, toPythonString, Validate } from "./utils";

const linkedListBuiltins = new Map<string, BuiltinValue>();

const isPair = (value: Value): value is ListValue => {
  return value.type === "list" && value.value.length === 2;
};

class LinkedListBuiltins {
  @Validate(2, 2, "pair", true)
  static pair(args: Value[], _source: string, _command: ControlItem, _context: Context): ListValue {
    return { type: "list", value: args };
  }

  @Validate(0, null, "linked_list", true)
  static linked_list(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): ListValue | NoneValue {
    if (args.length === 0) {
      return { type: "none" };
    }
    const head = args[0];
    const tail = LinkedListBuiltins.linked_list(args.slice(1), source, command, context);
    return { type: "list", value: [head, tail] };
  }

  @Validate(1, 1, "is_pair", true)
  static is_pair(
    args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): BoolValue {
    return { type: "bool", value: isPair(args[0]) };
  }

  @Validate(1, 1, "head", true)
  static head(args: Value[], source: string, command: ExprNS.Call, context: Context): Value {
    if (!isPair(args[0])) {
      handleRuntimeError(context, new TypeError(source, command, context, args[0].type, "pair"));
    }
    return args[0].value[0];
  }

  @Validate(1, 1, "tail", true)
  static tail(args: Value[], source: string, command: ExprNS.Call, context: Context): Value {
    if (!isPair(args[0])) {
      handleRuntimeError(context, new TypeError(source, command, context, args[0].type, "pair"));
    }
    return args[0].value[1];
  }

  static _is_linked_list(value: Value): boolean {
    if (value.type === "none") {
      return true;
    }
    return isPair(value) && LinkedListBuiltins._is_linked_list(value.value[1]);
  }

  static _print_linked_list(
    value: Value,
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): string {
    if (!LinkedListBuiltins._is_linked_list(value)) {
      if (!isPair(value)) {
        return toPythonString(value, true);
      }
      const string1 = LinkedListBuiltins._print_linked_list(
        value.value[0],
        source,
        command,
        context,
      );
      const string2 = LinkedListBuiltins._print_linked_list(
        value.value[1],
        source,
        command,
        context,
      );
      return "[" + string1 + ", " + string2 + "]";
    }

    let string = "linked_list(";
    let current = value;

    while (current.type == "list" && current.value.length === 2) {
      string += LinkedListBuiltins._print_linked_list(current.value[0], source, command, context);
      string += ", ";
      current = LinkedListBuiltins.tail([current], source, command, context);
    }
    if (string.endsWith(", ")) {
      string = string.slice(0, -2);
    }
    string += ")";
    return string;
  }
  @Validate(1, 1, "print_linked_list", true)
  static async print_linked_list(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): Promise<NoneValue> {
    const stringValue = LinkedListBuiltins._print_linked_list(args[0], source, command, context);
    await displayOutput(context, stringValue);
    return { type: "none" };
  }
}
for (const builtin of Object.getOwnPropertyNames(LinkedListBuiltins)) {
  if (
    typeof LinkedListBuiltins[builtin as keyof typeof LinkedListBuiltins] === "function" &&
    !builtin.startsWith("_")
  ) {
    linkedListBuiltins.set(builtin, {
      type: "builtin",
      func: LinkedListBuiltins[builtin as keyof typeof LinkedListBuiltins] as BuiltinValue["func"],
      name: builtin,
      minArgs: minArgMap.get(builtin) || 0,
    });
  }
}
export default {
  name: GroupName.LINKED_LISTS,
  prelude: linkedListPrelude,
  builtins: linkedListBuiltins,
};
