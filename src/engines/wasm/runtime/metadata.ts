export const TYPE_TAG = {
  INT: 0,
  FLOAT: 1,
  COMPLEX: 2,
  BOOL: 3,
  STRING: 4,
  CLOSURE: 5,
  NONE: 6,
  UNBOUND: 7,
  LIST: 9,
  TUPLE: 10,
  /** A handle to a value owned by an imported conductor module (an opaque
   * like a runes Rune, or a module function) — see moduleInterop.ts. The
   * payload is an index into the JS-side handle table, *not* a heap
   * pointer, so this tag is deliberately absent from IS_TAG_GCABLE (gc.ts):
   * the GC treats a hostref like INT/BOOL, an immediate it never traces or
   * moves. Calling a hostref dispatches to the `modules.call` host import —
   * see PRE_APPLY_FX/APPLY_FX (environments.ts). */
  HOSTREF: 11,
} as const;

export const SHADOW_STACK_TAG = {
  LIST_STATE: -1, // upper 32: pointer; lower 32: length
  CALL_RETURN_ADDR: -2,
  CALL_NEW_ENV: -3, // upper 32: pointer
} as const;

export const GC_SPECIAL_TAG = {
  ENV: -4,
} as const;

// Static, non-interpolated versions of the "wrong type" wording introduced by
// #273 for CSE/PVML (see friendlyTypeName/UnsupportedOperandTypeError/
// TypeError in src/errors/errors.ts and src/engines/pvml/builtins.ts): the
// same "TypeError: unsupported operand type(s) for X" / "unsupported
// argument type for X" phrasing and CPython-style error-class prefixes
// (TypeError/IndexError/ZeroDivisionError/RecursionError/MemoryError/
// UnboundLocalError), without naming the actual offending type -- unlike
// those two engines, log_error only carries a static message index, with no
// operand type/value threaded through to interpolate into it.
export const ERROR_MAP = {
  NEG_NOT_SUPPORT: "TypeError: bad operand type for unary -",
  LOG_UNKNOWN_TYPE: "Cannot render a value of an unrecognized type",
  ARITH_OP_UNKNOWN_TYPE: "TypeError: unsupported operand type(s) for this arithmetic operation",
  COMPLEX_COMPARISON: "TypeError: ordering comparisons are not supported between complex numbers",
  COMPARE_OP_UNKNOWN_TYPE: "TypeError: unsupported operand type(s) for this comparison",
  CALL_NOT_FX: "TypeError: this value is not callable",
  FUNC_WRONG_ARITY: "TypeError: function called with the wrong number of arguments",
  UNBOUND: "UnboundLocalError: cannot access a local variable before it is assigned a value",
  HEAD_NOT_PAIR: "TypeError: unsupported argument type for head",
  TAIL_NOT_PAIR: "TypeError: unsupported argument type for tail",
  BOOL_UNKNOWN_TYPE: "Cannot convert a value of an unrecognized type to bool",
  GET_ELEMENT_NOT_LIST: "TypeError: unsupported argument type for subscript access",
  SET_ELEMENT_NOT_LIST: "TypeError: unsupported argument type for subscript assignment",
  SET_ELEMENT_TUPLE: "TypeError: cannot assign to a function's rest-parameter tuple",
  INDEX_NOT_INT: "TypeError: list indices must be integers",
  LIST_OUT_OF_RANGE: "IndexError: list index out of range",
  SET_OUT_OF_RANGE: "IndexError: list assignment index out of range",
  MULTIPLY_LIST_NOT_INT: "TypeError: can't multiply list by non-integer",
  RANGE_ARG_NOT_INT: "TypeError: unsupported argument type for range",
  GET_LENGTH_NOT_LIST: "TypeError: unsupported argument type for len",
  MAKE_LINKED_LIST_NOT_LIST:
    "Trying to make a linked list out of a non-list value. (Internal error: llist function should only be called on lists)",
  STARRED_NOT_LIST: "TypeError: unsupported argument type for spread unpacking",
  PARSE_NOT_STRING: "TypeError: unsupported argument type for parse",
  OUT_OF_MEMORY: "MemoryError: out of memory",
  STACK_OVERFLOW: "RecursionError: the evaluation has exceeded the maximum recursion depth",
  STACK_UNDERFLOW: "Internal error: shadow stack underflow",
  GEN_LIST_NOT_INT: "TypeError: the repeat count for list generation must be an integer",
  ARITY_NOT_CLOSURE: "TypeError: unsupported argument type for arity",
  ZERO_DIVISION: "ZeroDivisionError: division by zero",
  BOOL_OPERAND_NOT_SUPPORTED: "TypeError: unsupported operand type(s) for this operation: boolean",
  EXPECTED_BOOL_OPERAND: "TypeError: expected a boolean operand for this operation",
  HOSTREF_STARRED:
    "TypeError: argument unpacking is not supported when calling an imported module function",
} as const;

export const getErrorIndex = (errorKey: (typeof ERROR_MAP)[keyof typeof ERROR_MAP]) =>
  Object.values(ERROR_MAP).findIndex(v => v === errorKey);

export const DATA_END = "$_data_end";
export const SHADOW_STACK_BOTTOM = "$_shadow_stack_bottom_pointer";
export const SHADOW_STACK_TOP = "$_shadow_stack_top_pointer";

export const CHAPTER = "$_chapter";

export const HEAP_PTR = "$_heap_pointer";
export const FROM_SPACE_START_PTR = "$_from_space_start_pointer";
export const FROM_SPACE_END_PTR = "$_from_space_end_pointer";
export const TO_SPACE_START_PTR = "$_to_space_start_pointer";
export const TO_SPACE_END_PTR = "$_to_space_end_pointer";
export const SHADOW_STACK_PTR = "$_shadow_stack_pointer";
export const CURR_ENV = "$_current_env";

export const ENV_HEAD_SIZE = 8;
export const GC_OBJECT_HEADER_SIZE = 8;
export const SHADOW_STACK_SLOT_SIZE = 12;
export const SHADOW_STACK_RESERVED_SIZE = 1024 * 8; // 8KB reserved for shadow stack
export const ENV_FORWARDING_BIT = 0x40000000;
