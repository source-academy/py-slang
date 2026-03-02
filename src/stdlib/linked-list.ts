import { Context } from "../cse-machine/context";
import { ControlItem } from "../cse-machine/control";
import { Value } from "../cse-machine/stash";
import { Validate } from "../stdlib";
import linkedListPrelude from "./linked-list.prelude";
import { Group, GroupName } from "./utils";

const linkedListBuiltins = new Map<string, Value>();
class LinkedListBuiltins { 
    @Validate(2, 2, 'pair', true)
    static pair(args: Value[], source: string, command: ControlItem, context: Context): Value {
        return { type: 'list', value: args };
    }

    @Validate(0, null, 'linked_list', true)
    static linked_list(args: Value[], source: string, command: ControlItem, context: Context): Value {
        if (args.length === 0) {
            return { type: 'none' };
        }
        const head = args[0];
        const tail = LinkedListBuiltins.linked_list(args.slice(1), source, command, context);
        return { type: 'list', value: [head, tail] };
    }
}
for (const builtin of Object.getOwnPropertyNames(LinkedListBuiltins)) {
    if (typeof LinkedListBuiltins[builtin as keyof typeof LinkedListBuiltins] === 'function') {
        linkedListBuiltins.set(builtin, { type: 'builtin', func: LinkedListBuiltins[builtin as keyof typeof LinkedListBuiltins] as any, name: builtin }); // TODO: fix typing
    }
}
export default {
    name: GroupName.LINKED_LISTS,
    prelude: linkedListPrelude,
    builtins: linkedListBuiltins
} as Group;
