import { ExprNS } from "../ast-types";
import { Context } from "../cse-machine/context";
import { ControlItem } from "../cse-machine/control";
import { handleRuntimeError } from "../cse-machine/error";
import { BoolValue, LinkedListValue, NoneValue, StringValue, Value } from "../cse-machine/stash";
import { TypeError } from "../errors";
import { BuiltInFunctions, builtIns, toPythonString, Validate } from "../stdlib";
import linkedListPrelude from "./linked-list.prelude";
import { Group, GroupName } from "./utils";

const linkedListBuiltins = new Map<string, Value>();

class LinkedListBuiltins {
    @Validate(2, 2, 'pair', true)
    static pair(args: Value[], source: string, command: ControlItem, context: Context): LinkedListValue {
        return { type: 'linked_list', value: args };
    }

    @Validate(0, null, 'linked_list', true)
    static linked_list(args: Value[], source: string, command: ControlItem, context: Context): LinkedListValue | NoneValue{
        if (args.length === 0) {
            return { type: 'none' };
        }
        const head = args[0];
        const tail = LinkedListBuiltins.linked_list(args.slice(1), source, command, context);
        return { type: 'linked_list', value: [head, tail] };
    }

    @Validate(1, 1, 'is_pair', true)
    static is_pair(args: Value[], source: string, command: ControlItem, context: Context): BoolValue {
        return { type: 'bool', value: args[0].type === 'linked_list' && args[0].value.length === 2 };
    }

    @Validate(1, 1, 'head', true)
    static head(args: Value[], source: string, command: ControlItem, context: Context): Value {
        if (args[0].type !== 'linked_list' || args[0].value.length !== 2) {
            handleRuntimeError(context, new TypeError(source, command as ExprNS.Expr, context, args[0].type, "pair"));
        }
        return args[0].value[0];
    }

    @Validate(1, 1, 'tail', true)
    static tail(args: Value[], source: string, command: ControlItem, context: Context): Value {
        if (args[0].type !== 'linked_list' || args[0].value.length !== 2) {
            handleRuntimeError(context, new TypeError(source, command as ExprNS.Expr, context, args[0].type, "pair"));
        }
        return args[0].value[1];
    }

    
    static _is_linked_list(value: Value): boolean {
        if (value.type === 'none') {
            return true;
        }
        return value.type === 'linked_list' && value.value.length === 2 && LinkedListBuiltins._is_linked_list(value.value[1]);
    }

    @Validate(1, 1, 'is_linked_list', true)
    static is_linked_list(args: Value[], source: string, command: ControlItem, context: Context): BoolValue {
        // Just call the internal helper and wrap the result in a BoolValue!
        const result = LinkedListBuiltins._is_linked_list(args[0]);
        return { type: 'bool', value: result };
    }

    static _print_linked_list(value: Value, source: string, command: ControlItem, context: Context): StringValue {
        if (!LinkedListBuiltins._is_linked_list(value)) {
            const isPairResult = LinkedListBuiltins.is_pair([value], source, command, context);
            if (!isPairResult.value) {
                return { type: 'string', value: toPythonString(value) };
            }
            const string1 = LinkedListBuiltins._print_linked_list((value as LinkedListValue).value[0], source, command, context);
            const string2 = LinkedListBuiltins._print_linked_list((value as LinkedListValue).value[1], source, command, context);
            return { 'type': 'string', value: '[' + string1.value + ', ' + string2.value + ']' };
        }
        
        let string = 'linked_list(';
        let current = value;

        while (current.type == 'linked_list' && current.value.length === 2) {
            string += LinkedListBuiltins._print_linked_list(current.value[0], source, command, context).value;
            string += ', ';
            current = LinkedListBuiltins.tail([current], source, command, context);
        }
        if (string.endsWith(', ')) {
            string = string.slice(0, -2);
        }
        string += ')';
        return { type: 'string', value: string };
    }
    @Validate(1, 1, 'print_linked_list', true)
    static print_linked_list(args: Value[], source: string, command: ControlItem, context: Context): NoneValue {
        const stringValue = LinkedListBuiltins._print_linked_list(args[0], source, command, context);
        context.output += stringValue.value + '\n';
        return { type: 'none' };
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
