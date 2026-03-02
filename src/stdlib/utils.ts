import { Value } from "../cse-machine/stash";

export enum GroupName {
    LINKED_LISTS = 'linked-list',
    STREAMS = 'stream',
    LIST = 'list',
    PAIRMUTATORS = 'pair-mutators',
    MCE = 'mce'
}

export type Group = {
    name: GroupName;
    prelude: string;
    builtins: Map<string, Value>;
}


    