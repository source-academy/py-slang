import { sourceMapsEnabled } from "process";
import { Context } from "../cse-machine/context";
import { ControlItem } from "../cse-machine/control";
import { BoolValue, ListValue, NoneValue, StringValue, Value } from "../cse-machine/stash";
import { BuiltInFunctions, toPythonString, Validate } from "../stdlib";
import linkedListPrelude from "./linked-list.prelude";
import { Group, GroupName } from "./utils";
import { stringify } from "querystring";

const linkedListBuiltins = new Map<string, Value>();

class LinkedListBuiltins {
    @Validate(2, 2, 'pair', true)
    static pair(args: Value[], source: string, command: ControlItem, context: Context): ListValue {
        return { type: 'list', value: args };
    }

    @Validate(0, null, 'linked_list', true)
    static linked_list(args: Value[], source: string, command: ControlItem, context: Context): ListValue | NoneValue{
        if (args.length === 0) {
            return { type: 'none' };
        }
        const head = args[0];
        const tail = LinkedListBuiltins.linked_list(args.slice(1), source, command, context);
        return { type: 'list', value: [head, tail] };
    }

    @Validate(1, 1, 'is_pair', true)
    static is_pair(args: Value[], source: string, command: ControlItem, context: Context): BoolValue {
        return { type: 'bool', value: args[0].type === 'list' && args[0].value.length === 2 };
    }

    @Validate(1, 1, 'head', true)
    static head(args: Value[], source: string, command: ControlItem, context: Context): Value {
        if (args[0].type !== 'list' || args[0].value.length !== 2) {
            throw new Error('head expects a pair');
        }
        return args[0].value[0];
    }

    @Validate(1, 1, 'tail', true)
    static tail(args: Value[], source: string, command: ControlItem, context: Context): Value {
        if (args[0].type !== 'list' || args[0].value.length !== 2) {
            throw new Error('tail expects a pair');
        }
        return args[0].value[1];
    }
    static _is_linked_list(value: Value): boolean {
        if (value.type === 'none') {
            return true;
        }
        return value.type === 'list' && value.value.length === 2 && LinkedListBuiltins._is_linked_list(value.value[1]);
    }

    @Validate(1, 1, 'print_linked_list', true)
    static print_linked_list(args: Value[], source: string, command: ControlItem, context: Context): StringValue {
        const isPairResult = LinkedListBuiltins.is_pair(args, source, command, context);
        if (!isPairResult.value) {
            return { 'type': 'string', 'value': toPythonString(args[0]) };
        }
        if (!LinkedListBuiltins._is_linked_list(args[0])) {
            const string1 = LinkedListBuiltins.print_linked_list([(args[0] as ListValue).value[0]], source, command, context);
            const string2 = LinkedListBuiltins.print_linked_list([(args[0] as ListValue).value[1]], source, command, context);
            return { 'type': 'string', 'value': '[' + string1.value + ', ' + string2.value + ']' };
        }
        let string = 'list(';
        let current = args[0];

        while (current.type == 'list' && current.value.length === 2) {
            string += LinkedListBuiltins.print_linked_list([current.value[0]], source, command, context).value;
            string += ', ';
            current = LinkedListBuiltins.tail([current], source, command, context);
        }
        if (string.endsWith(', ')) {
            string = string.slice(0, -2);
        }
        string += ')';
        return { type: 'string', value: string };
    }
}
for (const builtin of Object.getOwnPropertyNames(LinkedListBuiltins)) {
    if (typeof LinkedListBuiltins[builtin as keyof typeof LinkedListBuiltins] === 'function' && !builtin.startsWith('_')) {
        linkedListBuiltins.set(builtin, { type: 'builtin', func: LinkedListBuiltins[builtin as keyof typeof LinkedListBuiltins] as any, name: builtin }); // TODO: fix typing
    }
}
export default {
    name: GroupName.LINKED_LISTS,
    prelude: linkedListPrelude,
    builtins: linkedListBuiltins
} as Group;
