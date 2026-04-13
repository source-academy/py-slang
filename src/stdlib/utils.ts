import { BuiltinValue } from "../engines/cse/stash";

export enum GroupName {
  LINKED_LISTS = "linked-list",
  STREAMS = "stream",
  LIST = "list",
  PAIRMUTATORS = "pair-mutators",
  MCE = "mce",
}

export type Group = {
  name: GroupName;
  prelude: string;
  builtins: Map<string, BuiltinValue>;
};
