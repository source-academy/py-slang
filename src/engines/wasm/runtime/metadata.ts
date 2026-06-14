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
} as const;

export const SHADOW_STACK_TAG = {
  LIST_STATE: -1, // upper 32: pointer; lower 32: length
  CALL_RETURN_ADDR: -2,
  CALL_NEW_ENV: -3, // upper 32: pointer
} as const;

export const GC_SPECIAL_TAG = {
  ENV: -4,
} as const;

export const ERROR_MAP = {
  NEG_NOT_SUPPORT: "Unary minus operator used on unsupported operand.",
  LOG_UNKNOWN_TYPE: "Calling log on an unknown runtime type.",
  ARITH_OP_UNKNOWN_TYPE: "Calling an arithmetic operation on an unsupported runtime type.",
  COMPLEX_COMPARISON: "Using an unsupported comparison operator on complex type.",
  COMPARE_OP_UNKNOWN_TYPE: "Calling a comparison operation on unsupported operands.",
  CALL_NOT_FX: "Calling a non-function value.",
  FUNC_WRONG_ARITY: "Calling function with wrong number of arguments.",
  UNBOUND: "Accessing an unbound value.",
  HEAD_NOT_PAIR: "Accessing the head of a non-pair value.",
  TAIL_NOT_PAIR: "Accessing the tail of a non-pair value.",
  BOOL_UNKNOWN_TYPE: "Trying to convert an unknnown runtime type to a bool.",
  GET_ELEMENT_NOT_LIST: "Accessing an element of a non-list value.",
  SET_ELEMENT_NOT_LIST: "Setting an element of a non-list value.",
  SET_ELEMENT_TUPLE: "Cannot assign to the rest parameter of a function.",
  INDEX_NOT_INT: "Using a non-integer index to access a list element.",
  LIST_OUT_OF_RANGE: "List index out of range.",
  RANGE_ARG_NOT_INT: "Using a non-integer argument in range().",
  GET_LENGTH_NOT_LIST: "Getting length of a non-list value.",
  MAKE_LINKED_LIST_NOT_LIST:
    "Trying to make a linked list out of a non-list value. (Internal error: linked_list function should only be called on lists)",
  STARRED_NOT_LIST: "Trying to unpack a non-list value.",
  PARSE_NOT_STRING: "Trying to parse a non-string value.",
  OUT_OF_MEMORY: "Out of memory.",
  STACK_OVERFLOW: "Stack overflow.",
  STACK_UNDERFLOW: "Stack underflow.",
  GEN_LIST_NOT_INT: "Trying to generate a list of non-integer length.",
  ARITY_NOT_CLOSURE: "Trying to get arity of a non-closure value.",
} as const;

export const getErrorIndex = (errorKey: (typeof ERROR_MAP)[keyof typeof ERROR_MAP]) =>
  Object.values(ERROR_MAP).findIndex(v => v === errorKey);

export const DATA_END = "$_data_end";
export const SHADOW_STACK_BOTTOM = "$_shadow_stack_bottom_pointer";
export const SHADOW_STACK_TOP = "$_shadow_stack_top_pointer";

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
