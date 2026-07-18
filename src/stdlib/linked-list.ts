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

export const isPair = (value: Value): value is ListValue => {
  return value.type === "list" && value.value.length === 2;
};

/**
 * Whether `value` is a proper linked list: a chain of pairs (as constructed by `pair()`/`llist()`)
 * terminated by `None`, rather than an arbitrary 2-element list. Distinguishing this from a bare
 * `isPair()` check matters at the module interop boundary (see `pythonToModule`'s "list" case in
 * `engines/cse/modules.ts`), where a plain 2-element list shouldn't be misidentified as a pair
 * chain just because it happens to have length 2.
 */
export const isProperList = (value: Value): boolean => {
  if (value.type === "none") {
    return true;
  }
  return isPair(value) && isProperList(value.value[1]);
};

class LinkedListBuiltins {
  @Validate(2, 2, "pair", true)
  static pair(args: Value[], _source: string, _command: ControlItem, _context: Context): ListValue {
    return { type: "list", value: args };
  }

  @Validate(0, null, "llist", true)
  static llist(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): ListValue | NoneValue {
    if (args.length === 0) {
      return { type: "none" };
    }
    const head = args[0];
    const tail = LinkedListBuiltins.llist(args.slice(1), source, command, context);
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

  static _is_llist(value: Value): boolean {
    return isProperList(value);
  }

  static _print_llist(
    value: Value,
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): string {
    if (!LinkedListBuiltins._is_llist(value)) {
      if (!isPair(value)) {
        return toPythonString(value, true);
      }
      const string1 = LinkedListBuiltins._print_llist(value.value[0], source, command, context);
      const string2 = LinkedListBuiltins._print_llist(value.value[1], source, command, context);
      return "[" + string1 + ", " + string2 + "]";
    }

    let string = "llist(";
    let current = value;

    while (current.type == "list" && current.value.length === 2) {
      string += LinkedListBuiltins._print_llist(current.value[0], source, command, context);
      string += ", ";
      current = LinkedListBuiltins.tail([current], source, command, context);
    }
    if (string.endsWith(", ")) {
      string = string.slice(0, -2);
    }
    string += ")";
    return string;
  }
  @Validate(1, 1, "print_llist", true)
  static async print_llist(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): Promise<NoneValue> {
    const stringValue = LinkedListBuiltins._print_llist(args[0], source, command, context);
    await displayOutput(context, stringValue + "\n");
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
