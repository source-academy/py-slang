import { Context } from "../cse-machine/context";
import { ControlItem } from "../cse-machine/control";
import { BigIntValue, BoolValue, Value } from "../cse-machine/stash";
import { Validate } from "../stdlib";
import listPrelude from "./list.prelude";
import { Group, GroupName } from "./utils";

const listBuiltins = new Map<string, Value>();

class ListBuiltins {
    @Validate(1, 1, 'list_length', true)
    static list_length(args: Value[], source: string, command: ControlItem, context: Context): BigIntValue {
        const list = args[0];
        if (list.type !== 'list') {
            throw new Error('list_length expects a list as the first argument');
        }
        return { type: 'bigint', value: BigInt(list.value.length) };
    }

    @Validate(1, 1, 'is_list', true)
    static is_list(args: Value[], source: string, command: ControlItem, context: Context): BoolValue {
        const list = args[0];
        return { type: 'bool', value: list.type === 'list' };
    }

    // A helper function to generate a list of a given length
    @Validate(1, 1, '_gen_list', true)
    static _gen_list(args: Value[], source: string, command: ControlItem, context: Context): Value {
        const length = args[0];
        if (length.type !== 'bigint') {
            throw new Error('_gen_list expects a bigint as the first argument');
        }
        const list: Value[] = [];
        for (let i = BigInt(0); i < length.value; i++) {
            list.push({ type: 'none' });
        }
        return { type: 'list', value: list };
    }
}
for (const builtin of Object.getOwnPropertyNames(ListBuiltins)) {
    if (typeof ListBuiltins[builtin as keyof typeof ListBuiltins] === 'function' && !builtin.startsWith('_')) {
        listBuiltins.set(builtin, { type: 'builtin', func: ListBuiltins[builtin as keyof typeof ListBuiltins] as any, name: builtin }); // TODO: fix typing
    }
}
export default {
    name: GroupName.LIST,
    prelude: listPrelude,
    builtins: listBuiltins
} as Group;
