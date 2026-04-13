import { BuiltinValue } from "../engines/cse/stash";

export enum GroupName {
  LINKED_LISTS = "linked-list",
  STREAMS = "stream",
  LIST = "list",
  PAIRMUTATORS = "pair-mutators",
  MCE = "mce",
}

/**
 * A Group represents a library of related built-in values (e.g., linked list library, stream library).
 * It consists of primitive built-in values implemented in TypeScript, as well as a prelude of non-primitive built-in values
 * evaluated in Python using the current evaluator
 */
export type Group = {
  name: GroupName;

  /**
   * The prelude is a string of code that defines the non-primitive built-in values in this group.
   * It is loaded before any user code is run, so that the built-in values are available to the user code.
   * The execution of functions is performed using the current evaluator, so the prelude can use other built-in values defined in other groups.
   */
  prelude: string;

  /**
   * The builtins are primitive built-in values implemented in TypeScript. They are to provide functionalities that are not easily implemented in the required sublanguage of Python,
   * such as variadic functions in Python §2 (e.g., `linked_list`)
   *
   * They are stored as a map from the name of the built-in value to its corresponding implementation.
   */
  builtins: Map<string, BuiltinValue>;
};
