import {
  ALLOC_ENV_FX,
  GET_LAST_EXPR_RESULT_FX,
  GET_LEX_ADDR_FX,
  PRE_APPLY_FX,
  SET_CONTIGUOUS_BLOCK_FX,
  SET_LEX_ADDR_FX,
} from "./environments";
import { CLEAR_GC_HEADER_FX, COLLECT_FX, COPY_FX, IS_TAG_GCABLE, MALLOC_FX } from "./gc";
import { IS_PAIR_FX, MAKE_LINKED_LIST_FX, MAKE_PAIR_FX } from "./linkedList";
import {
  DEBUG_GET_LIST_ELEMENT_FX,
  GEN_LIST_FX,
  GET_LIST_ELEMENT_FX,
  IS_LIST_FX,
  LIST_LENGTH_FX,
  LIST_SLOT_STORE_FX,
  LIST_SLOT_TAG_LOAD_FX,
  LIST_SLOT_VAL_LOAD_FX,
  MAKE_LIST_FX,
  MAKE_TUPLE_FX,
  SET_LIST_ELEMENT_FX,
} from "./list";
import { PARSE_FX, TOKENIZE_FX } from "./mce";
import {
  ARITHMETIC_OP_FX,
  BOOL_NOT_FX,
  COMPARISON_OP_FX,
  NEG_FX,
  STRING_COMPARE_FX,
} from "./operators";
import {
  DISCARD_SHADOW_STACK_FX,
  PEEK_SHADOW_STACK_FX,
  POP_SHADOW_STACK_FX,
  PUSH_SHADOW_STACK_FX,
  SILENT_PUSH_SHADOW_STACK_FX,
} from "./shadowStack";
import {
  ARITY_FX,
  BOOLISE_FX,
  IS_BOOL_FX,
  IS_COMPLEX_FX,
  IS_FLOAT_FX,
  IS_FUNCTION_FX,
  IS_INT_FX,
  IS_NONE_FX,
  IS_STRING_FX,
  LOG_FX,
} from "./stdlib";
import {
  CHECK_INT_FX,
  MAKE_BOOL_FX,
  MAKE_CLOSURE_FX,
  MAKE_COMPLEX_FX,
  MAKE_FLOAT_FX,
  MAKE_INT_FX,
  MAKE_NONE_FX,
  MAKE_STRING_FX,
} from "./values";

export * from "./environments";
export * from "./gc";
export * from "./linkedList";
export * from "./list";
export * from "./mce";
export * from "./metadata";
export * from "./operators";
export * from "./shadowStack";
export * from "./stdlib";
export * from "./values";

export const nativeFunctions = [
  // gc
  COPY_FX,
  COLLECT_FX,
  CLEAR_GC_HEADER_FX,
  MALLOC_FX,
  IS_TAG_GCABLE,

  // shadowStack
  PUSH_SHADOW_STACK_FX,
  SILENT_PUSH_SHADOW_STACK_FX,
  POP_SHADOW_STACK_FX,
  PEEK_SHADOW_STACK_FX,
  DISCARD_SHADOW_STACK_FX,

  // values
  CHECK_INT_FX,
  MAKE_INT_FX,
  MAKE_FLOAT_FX,
  MAKE_COMPLEX_FX,
  MAKE_BOOL_FX,
  MAKE_STRING_FX,
  MAKE_CLOSURE_FX,
  MAKE_NONE_FX,

  // stdlib
  LOG_FX,
  BOOLISE_FX,
  ARITY_FX,
  IS_NONE_FX,
  IS_INT_FX,
  IS_FLOAT_FX,
  IS_COMPLEX_FX,
  IS_STRING_FX,
  IS_BOOL_FX,
  IS_FUNCTION_FX,

  // environments
  ALLOC_ENV_FX,
  PRE_APPLY_FX,
  GET_LEX_ADDR_FX,
  SET_LEX_ADDR_FX,
  SET_CONTIGUOUS_BLOCK_FX,
  GET_LAST_EXPR_RESULT_FX,

  // list
  MAKE_LIST_FX,
  MAKE_TUPLE_FX,
  LIST_SLOT_TAG_LOAD_FX,
  LIST_SLOT_VAL_LOAD_FX,
  LIST_SLOT_STORE_FX,
  GET_LIST_ELEMENT_FX,
  DEBUG_GET_LIST_ELEMENT_FX,
  SET_LIST_ELEMENT_FX,
  LIST_LENGTH_FX,
  IS_LIST_FX,
  GEN_LIST_FX,

  // linkedList
  MAKE_PAIR_FX,
  IS_PAIR_FX,
  MAKE_LINKED_LIST_FX,

  // mce
  TOKENIZE_FX,
  PARSE_FX,

  // operators
  NEG_FX,
  ARITHMETIC_OP_FX,
  STRING_COMPARE_FX,
  COMPARISON_OP_FX,
  BOOL_NOT_FX,
];
