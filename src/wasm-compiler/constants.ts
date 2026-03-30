import { f64, global, i32, i64, local, memory, wasm, type WasmInstruction } from "@sourceacademy/wasm-util";

// tags

// NOTE: for starred args in function calls, we will set the highest bit of the tag to
// indicate that it's starred, and the rest of the bits will indicate the actual type
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
  LIST_STATE: -1,
  CALL_RETURN_ADDR: -2,
  CALL_NEW_ENV: -3,
};

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
  GET_LENGTH_NOT_LIST: "Getting length of a non-list value.",
  MAKE_LINKED_LIST_NOT_LIST:
    "Trying to make a linked list out of a non-list value. (Internal error: linked_list function should only be called on lists)",
  STARRED_NOT_LIST: "Trying to unpack a non-list value.",
  PARSE_NOT_STRING: "Trying to parse a non-string value.",
  OUT_OF_MEMORY: "Out of memory.",
  STACK_OVERFLOW: "Stack overflow.",
  STACK_UNDERFLOW: "Stack underflow.",
} as const;

export const getErrorIndex = (errorKey: (typeof ERROR_MAP)[keyof typeof ERROR_MAP]) =>
  Object.values(ERROR_MAP).findIndex(v => v === errorKey);

export const DATA_END = "$_data_end";
export const SHADOW_STACK_BOTTOM = "$_shadow_stack_bottom_pointer";
export const SHADOW_STACK_TOP = "$_shadow_stack_top_pointer";

export const HEAP_PTR = "$_heap_pointer";
export const FROM_SPACE_END_PTR = "$_from_space_end_pointer";
export const TO_SPACE_END_PTR = "$_to_space_end_pointer";
export const SHADOW_STACK_PTR = "$_shadow_stack_pointer";
export const CURR_ENV = "$_current_env";

export const ENV_HEAD_SIZE = 8;
export const SHADOW_STACK_SLOT_SIZE = 12;
export const SHADOW_STACK_RESERVED_SIZE = 1024;

export const PEEK_SHADOW_STACK_FX = wasm
  .func("$_peek_shadow_stack")
  .params({ $offset: i32 })
  .locals({ $addr: i32 })
  .results(i32, i64)
  .body(
    local.set(
      "$addr",
      i32.add(global.get(SHADOW_STACK_PTR), i32.mul(local.get("$offset"), i32.const(SHADOW_STACK_SLOT_SIZE))),
    ),

    wasm
      .if(i32.lt_u(local.get("$addr"), global.get(SHADOW_STACK_BOTTOM)))
      .then(wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.STACK_OVERFLOW))), wasm.unreachable()),

    wasm
      .if(i32.ge_u(local.get("$addr"), global.get(SHADOW_STACK_TOP)))
      .then(wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.STACK_UNDERFLOW))), wasm.unreachable()),

    i32.load(local.get("$addr")),
    i64.load(i32.add(local.get("$addr"), i32.const(4))),
  );

export const SILENT_PUSH_SHADOW_STACK_FX = wasm
  .func("$_silent_push_shadow_stack")
  .params({ $tag: i32, $val: i64 })
  .locals({ $new_ptr: i32 })
  .body(
    local.set("$new_ptr", i32.sub(global.get(SHADOW_STACK_PTR), i32.const(SHADOW_STACK_SLOT_SIZE))),

    wasm
      .if(i32.lt_u(local.get("$new_ptr"), global.get(SHADOW_STACK_BOTTOM)))
      .then(wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.STACK_OVERFLOW))), wasm.unreachable()),

    global.set(SHADOW_STACK_PTR, local.get("$new_ptr")),
    i32.store(global.get(SHADOW_STACK_PTR), local.get("$tag")),
    i64.store(i32.add(global.get(SHADOW_STACK_PTR), i32.const(4)), local.get("$val")),
  );

export const PUSH_SHADOW_STACK_FX = wasm
  .func("$_push_shadow_stack")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    wasm.call(SILENT_PUSH_SHADOW_STACK_FX).args(local.get("$tag"), local.get("$val")),
    wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0)),
  );

export const DISCARD_SHADOW_STACK_FX = wasm
  .func("$_discard_shadow_stack")
  .body(global.set(SHADOW_STACK_PTR, i32.add(global.get(SHADOW_STACK_PTR), i32.const(SHADOW_STACK_SLOT_SIZE))));

export const POP_SHADOW_STACK_FX = wasm
  .func("$_pop_shadow_stack")
  .results(i32, i64)
  .locals({ $new_ptr: i32 })
  .body(
    local.set("$new_ptr", i32.add(global.get(SHADOW_STACK_PTR), i32.const(SHADOW_STACK_SLOT_SIZE))),

    wasm
      .if(i32.gt_u(local.get("$new_ptr"), global.get(SHADOW_STACK_TOP)))
      .then(wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.STACK_UNDERFLOW))), wasm.unreachable()),

    i32.load(global.get(SHADOW_STACK_PTR)),
    i64.load(i32.add(global.get(SHADOW_STACK_PTR), i32.const(4))),
    global.set(SHADOW_STACK_PTR, local.get("$new_ptr")),
  );

export const IS_TAG_GCABLE = wasm
  .func("$_is_tag_gcable")
  .params({ $tag: i32 })
  .results(i32)
  .body(
    i32.or(
      i32.or(
        i32.eq(local.get("$tag"), i32.const(TYPE_TAG.COMPLEX)),
        i32.eq(local.get("$tag"), i32.const(TYPE_TAG.STRING)),
      ),
      i32.or(
        i32.or(
          i32.eq(local.get("$tag"), i32.const(TYPE_TAG.CLOSURE)),
          i32.eq(local.get("$tag"), i32.const(TYPE_TAG.LIST)),
        ),
        i32.eq(local.get("$tag"), i32.const(TYPE_TAG.TUPLE)),
      ),
    ),
  );

export const COLLECT_FX = wasm.func("$_collect").body();

// returns allocated block start address and moves heap pointer by amount bytes
export const MALLOC_FX = wasm
  .func("$_malloc")
  .params({ $amount: i32 })
  .locals({ $new_heap: i32 })
  .results(i32)
  .body(
    local.set("$new_heap", i32.add(global.get(HEAP_PTR), local.get("$amount"))),

    wasm.if(i32.gt_u(local.get("$new_heap"), global.get(FROM_SPACE_END_PTR))).then(
      wasm.call(COLLECT_FX),
      local.set("$new_heap", i32.add(global.get(HEAP_PTR), local.get("$amount"))),

      wasm
        .if(i32.gt_u(local.get("$new_heap"), global.get(FROM_SPACE_END_PTR)))
        .then(wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.OUT_OF_MEMORY))), wasm.unreachable()),
    ),

    global.get(HEAP_PTR),
    global.set(HEAP_PTR, local.get("$new_heap")),
  );

// boxing functions

// store directly in payload
export const MAKE_INT_FX = wasm
  .func("$_make_int")
  .params({ $value: i64 })
  .results(i32, i64)
  .body(i32.const(TYPE_TAG.INT), local.get("$value"));

// reinterpret bits as int
export const MAKE_FLOAT_FX = wasm
  .func("$_make_float")
  .params({ $value: f64 })
  .results(i32, i64)
  .body(i32.const(TYPE_TAG.FLOAT), i64.reinterpret_f64(local.get("$value")));

// upper 32: pointer to f64 real part; lower 32: pointer to f64 imaginary part
export const MAKE_COMPLEX_FX = wasm
  .func("$_make_complex")
  .params({ $real: f64, $img: f64 })
  .locals({ $ptr: i32 })
  .results(i32, i64)
  .body(
    f64.store(local.tee("$ptr", wasm.call(MALLOC_FX).args(i32.const(16))), local.get("$real")),
    f64.store(i32.add(local.get("$ptr"), i32.const(8)), local.get("$img")),
    wasm.call(PUSH_SHADOW_STACK_FX).args(i32.const(TYPE_TAG.COMPLEX), i64.extend_i32_u(local.get("$ptr"))),
  );

// store directly as i32
export const MAKE_BOOL_FX = wasm
  .func("$_make_bool")
  .params({ $value: i32 })
  .results(i32, i64)
  .body(
    i32.const(TYPE_TAG.BOOL),
    wasm
      .if(i32.eqz(local.get("$value")))
      .results(i64)
      .then(i64.const(0))
      .else(i64.const(1)),
  );

// upper 32: pointer; lower 32: length
export const MAKE_STRING_FX = wasm
  .func("$_make_string")
  .params({ $ptr: i32, $len: i32 })
  .results(i32, i64)
  .body(
    wasm
      .call(PUSH_SHADOW_STACK_FX)
      .args(
        i32.const(TYPE_TAG.STRING),
        i64.or(i64.shl(i64.extend_i32_u(local.get("$ptr")), i64.const(32)), i64.extend_i32_u(local.get("$len"))),
      ),
  );

// first     1: has varargs;
// upper    15: tag;
// upperMid  8: arity;
// lowerMid  8: envSize;
// lower    32: parentEnv
export const MAKE_CLOSURE_FX = wasm
  .func("$_make_closure")
  .params({ $varargs: i32, $tag: i32, $arity: i32, $env_size: i32, $parent_env: i32 })
  .results(i32, i64)
  .body(
    wasm
      .call(PUSH_SHADOW_STACK_FX)
      .args(
        i32.const(TYPE_TAG.CLOSURE),
        i64.or(
          i64.or(
            i64.or(
              i64.or(
                i64.shl(i64.extend_i32_u(local.get("$varargs")), i64.const(63)),
                i64.shl(i64.extend_i32_u(local.get("$tag")), i64.const(48)),
              ),
              i64.shl(i64.extend_i32_u(local.get("$arity")), i64.const(40)),
            ),
            i64.shl(i64.extend_i32_u(local.get("$env_size")), i64.const(32)),
          ),
          i64.extend_i32_u(local.get("$parent_env")),
        ),
      ),
  );

export const MAKE_NONE_FX = wasm.func("$_make_none").results(i32, i64).body(i32.const(TYPE_TAG.NONE), i64.const(0));

// upper 32: pointer; lower 32: length
// assumption: list elements are already stored in contiguous memory starting from pointer
export const MAKE_LIST_FX = wasm
  .func("$_make_list")
  .params({ $ptr: i32, $len: i32 })
  .results(i32, i64)
  .body(
    wasm
      .call(PUSH_SHADOW_STACK_FX)
      .args(
        i32.const(TYPE_TAG.LIST),
        i64.or(i64.shl(i64.extend_i32_u(local.get("$ptr")), i64.const(32)), i64.extend_i32_u(local.get("$len"))),
      ),
  );

export const MAKE_TUPLE_FX = wasm
  .func("$_make_tuple")
  .params({ $ptr: i32, $len: i32 })
  .results(i32, i64)
  .body(
    wasm
      .call(PUSH_SHADOW_STACK_FX)
      .args(
        i32.const(TYPE_TAG.TUPLE),
        i64.or(i64.shl(i64.extend_i32_u(local.get("$ptr")), i64.const(32)), i64.extend_i32_u(local.get("$len"))),
      ),
  );

// list related functions
export const GET_LIST_ELEMENT_FX = wasm
  .func("$_get_list_element")
  .params({ $tag: i32, $val: i64, $index_tag: i32, $index_val: i64 })
  .locals({ $elem_tag: i32, $elem_val: i64 })
  .results(i32, i64)
  .body(
    // allow tuples to be accessed also
    wasm
      .if(
        i32.eqz(
          i32.or(
            i32.eq(local.get("$tag"), i32.const(TYPE_TAG.LIST)),
            i32.eq(local.get("$tag"), i32.const(TYPE_TAG.TUPLE)),
          ),
        ),
      )
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.GET_ELEMENT_NOT_LIST))),
        wasm.unreachable(),
      ),

    wasm
      .if(i32.ne(local.get("$index_tag"), i32.const(TYPE_TAG.INT)))
      .then(wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.INDEX_NOT_INT))), wasm.unreachable()),

    wasm
      .if(i32.ge_u(i32.wrap_i64(local.get("$index_val")), i32.wrap_i64(local.get("$val"))))
      .then(wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.LIST_OUT_OF_RANGE))), wasm.unreachable()),

    wasm.call(POP_SHADOW_STACK_FX), // pop list reference from shadow stack to get actual pointer and length
    wasm.raw`(local.set $val) (local.set $tag)`,

    local.tee(
      "$elem_tag",
      i32.load(
        i32.add(
          i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(32))),
          i32.mul(i32.wrap_i64(local.get("$index_val")), i32.const(12)),
        ),
      ),
    ),
    local.tee(
      "$elem_val",
      i64.load(
        i32.add(
          i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(32))),
          i32.add(i32.mul(i32.wrap_i64(local.get("$index_val")), i32.const(12)), i32.const(4)),
        ),
      ),
    ),

    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$elem_tag")))
      .then(wasm.call(SILENT_PUSH_SHADOW_STACK_FX).args(local.get("$elem_tag"), local.get("$elem_val"))),
  );

export const SET_LIST_ELEMENT_FX = wasm
  .func("$_set_list_element")
  .params({ $list_tag: i32, $list_val: i64, $index_tag: i32, $index_val: i64, $tag: i32, $val: i64 })
  .body(
    wasm
      .if(i32.eq(local.get("$list_tag"), i32.const(TYPE_TAG.TUPLE)))
      .then(wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.SET_ELEMENT_TUPLE))), wasm.unreachable()),

    wasm
      .if(i32.ne(local.get("$list_tag"), i32.const(TYPE_TAG.LIST)))
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.SET_ELEMENT_NOT_LIST))),
        wasm.unreachable(),
      ),

    wasm
      .if(i32.ne(local.get("$index_tag"), i32.const(TYPE_TAG.INT)))
      .then(wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.INDEX_NOT_INT))), wasm.unreachable()),

    wasm
      .if(i32.ge_u(i32.wrap_i64(local.get("$index_val")), i32.wrap_i64(local.get("$list_val"))))
      .then(wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.LIST_OUT_OF_RANGE))), wasm.unreachable()),

    wasm.if(wasm.call(IS_TAG_GCABLE).args(local.get("$tag"))).then(
      wasm.call(POP_SHADOW_STACK_FX), // pop new element from shadow stack if GCable
      wasm.raw`(local.set $val) (local.set $tag)`,
    ),

    wasm.call(POP_SHADOW_STACK_FX), // pop list reference from shadow stack to get actual pointer and length
    wasm.raw`(local.set $list_val) (local.set $list_tag)`,

    i32.store(
      i32.add(
        i32.wrap_i64(i64.shr_u(local.get("$list_val"), i64.const(32))),
        i32.mul(i32.wrap_i64(local.get("$index_val")), i32.const(12)),
      ),
      local.get("$tag"),
    ),
    i64.store(
      i32.add(
        i32.wrap_i64(i64.shr_u(local.get("$list_val"), i64.const(32))),
        i32.add(i32.mul(i32.wrap_i64(local.get("$index_val")), i32.const(12)), i32.const(4)),
      ),
      local.get("$val"),
    ),
  );

export const LIST_LENGTH_FX = wasm
  .func("$_list_length")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(
        i32.eqz(
          i32.or(
            i32.eq(local.get("$tag"), i32.const(TYPE_TAG.LIST)),
            i32.eq(local.get("$tag"), i32.const(TYPE_TAG.TUPLE)),
          ),
        ),
      )
      .then(wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.GET_LENGTH_NOT_LIST))), wasm.unreachable()),

    wasm.call(POP_SHADOW_STACK_FX), // pop list reference from shadow stack to get actual pointer and length
    wasm.raw`(local.set $val) (local.set $tag)`,

    wasm.call(MAKE_INT_FX).args(i64.and(local.get("$val"), i64.const(0xffffffff))),
  );

export const IS_LIST_FX = wasm
  .func("$_is_list")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$tag")))
      .then(wasm.call(POP_SHADOW_STACK_FX), wasm.raw`(local.set $val) (local.set $tag)`),

    wasm
      .call(MAKE_BOOL_FX)
      .args(
        i32.or(
          i32.eq(local.get("$tag"), i32.const(TYPE_TAG.LIST)),
          i32.eq(local.get("$tag"), i32.const(TYPE_TAG.TUPLE)),
        ),
      ),
  );

// pair related functions
export const MAKE_PAIR_FX = wasm
  .func("$_make_pair")
  .params({ $head_tag: i32, $head_val: i64, $tail_tag: i32, $tail_val: i64 })
  .locals({ $ptr: i32 })
  .results(i32, i64)
  .body(
    local.set("$ptr", wasm.call(MALLOC_FX).args(i32.const(24))),

    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$tail_tag")))
      .then(wasm.call(POP_SHADOW_STACK_FX), wasm.raw`(local.set $tail_val) (local.set $tail_tag)`),

    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$head_tag")))
      .then(wasm.call(POP_SHADOW_STACK_FX), wasm.raw`(local.set $head_val) (local.set $head_tag)`),

    i32.store(local.get("$ptr"), local.get("$head_tag")),
    i64.store(i32.add(local.get("$ptr"), i32.const(4)), local.get("$head_val")),
    i32.store(i32.add(local.get("$ptr"), i32.const(12)), local.get("$tail_tag")),
    i64.store(i32.add(local.get("$ptr"), i32.const(16)), local.get("$tail_val")),

    wasm.call(MAKE_LIST_FX).args(local.get("$ptr"), i32.const(2)),
  );

export const IS_PAIR_FX = wasm
  .func("$_is_pair")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$tag")))
      .then(wasm.call(POP_SHADOW_STACK_FX), wasm.raw`(local.set $val) (local.set $tag)`),

    wasm
      .call(MAKE_BOOL_FX)
      .args(
        i32.and(
          i32.eq(local.get("$tag"), i32.const(TYPE_TAG.LIST)),
          i32.eq(i32.wrap_i64(local.get("$val")), i32.const(2)),
        ),
      ),
  );

// linked list related functions
export const MAKE_LINKED_LIST_FX = wasm
  .func("$_make_linked_list")
  .params({ $tag: i32, $val: i64 })
  .locals({ $i: i32, $acc_tag: i32, $acc_val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(
        i32.eqz(
          i32.or(
            i32.eq(local.get("$tag"), i32.const(TYPE_TAG.LIST)),
            i32.eq(local.get("$tag"), i32.const(TYPE_TAG.TUPLE)),
          ),
        ),
      )
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.MAKE_LINKED_LIST_NOT_LIST))),
        wasm.unreachable(),
      ),

    // start from the end of the list and keep pairing the last element with the accumulated linked list
    local.set("$i", i32.sub(i32.wrap_i64(local.get("$val")), i32.const(1))),

    local.set("$acc_tag", i32.const(TYPE_TAG.NONE)),
    // wasm.call(SILENT_PUSH_SHADOW_STACK_FX).args(i32.const(TYPE_TAG.NONE), i64.const(0)),

    wasm.loop("$loop").body(
      // update acc from shadow stack
      // wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0)),
      // wasm.raw`(local.set $acc_val) (local.set $acc_tag)`,

      wasm.if(i32.ge_s(local.get("$i"), i32.const(0))).then(
        wasm
          .call(MAKE_PAIR_FX)
          .args(
            i32.load(
              i32.add(
                i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(32))),
                i32.mul(local.get("$i"), i32.const(12)),
              ),
            ),
            i64.load(
              i32.add(
                i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(32))),
                i32.add(i32.mul(local.get("$i"), i32.const(12)), i32.const(4)),
              ),
            ),
            local.get("$acc_tag"),
            local.get("$acc_val"),
          ),

        wasm.raw`(local.set $acc_val) (local.set $acc_tag)`, // set acc to the new pair
        // make_pair pushed the new pair onto the shadow stack, so pop it,
        // discard the old accumulator, and push the new pair as the new accumulator
        // wasm.call(POP_SHADOW_STACK_FX),
        // wasm.call(DISCARD_SHADOW_STACK_FX).args(i32.const(1)),
        // wasm.call(SILENT_PUSH_SHADOW_STACK_FX),

        // reload input list into locals
        // wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(1)),
        // wasm.raw`(local.set $val) (local.set $tag)`,

        local.set("$i", i32.sub(local.get("$i"), i32.const(1))),
        wasm.br("$loop"),
      ),
    ),

    local.get("$acc_tag"),
    local.get("$acc_val"),
  );

export const IS_LINKED_LIST_FX = wasm
  .func("$_is_list")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .loop("$loop")
      .body(
        wasm
          .if(
            i32.and(
              i32.eq(local.get("$tag"), i32.const(TYPE_TAG.LIST)),
              i32.eq(i32.wrap_i64(local.get("$val")), i32.const(2)),
            ),
          )
          .then(
            wasm
              .call(GET_LIST_ELEMENT_FX)
              .args(local.get("$tag"), local.get("$val"), wasm.call(MAKE_INT_FX).args(i64.const(1))),
            wasm.raw`(local.set $val) (local.set $tag)`,
            wasm.br("$loop"),
          ),
      ),

    wasm.call(MAKE_BOOL_FX).args(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.NONE))),
  );

// logging functions
export const importedLogs = [
  wasm.import("console", "log").func("$_log_int").params(i64),
  wasm.import("console", "log").func("$_log_float").params(f64),
  wasm.import("console", "log_complex").func("$_log_complex").params(f64, f64),
  wasm.import("console", "log_bool").func("$_log_bool").params(i64),
  wasm.import("console", "log_string").func("$_log_string").params(i32, i32),
  wasm.import("console", "log_closure").func("$_log_closure").params(i32, i32, i32, i32),
  wasm.import("console", "log_none").func("$_log_none"),
  wasm.import("console", "log_list").func("$_log_list").params(i32, i32),
  wasm.import("console", "log_error").func("$_log_error").params(i32),
  wasm.import("console", "log_raw").func("$_log_raw").params(i32, i64),
];

export const LOG_FX = wasm
  .func("$_log")
  .params({ $tag: i32, $value: i64 })
  .body(
    wasm
      .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.INT)))
      .then(wasm.call("$_log_int").args(local.get("$value")), wasm.return()),
    wasm
      .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.FLOAT)))
      .then(wasm.call("$_log_float").args(f64.reinterpret_i64(local.get("$value"))), wasm.return()),
    wasm
      .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.COMPLEX)))
      .then(
        wasm
          .call("$_log_complex")
          .args(
            f64.load(i32.wrap_i64(local.get("$value"))),
            f64.load(i32.add(i32.wrap_i64(local.get("$value")), i32.const(8))),
          ),
        wasm.return(),
      ),
    wasm
      .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.BOOL)))
      .then(wasm.call("$_log_bool").args(local.get("$value")), wasm.return()),
    wasm
      .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.STRING)))
      .then(
        wasm
          .call("$_log_string")
          .args(i32.wrap_i64(i64.shr_u(local.get("$value"), i64.const(32))), i32.wrap_i64(local.get("$value"))),
        wasm.return(),
      ),
    wasm
      .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.CLOSURE)))
      .then(
        wasm
          .call("$_log_closure")
          .args(
            i32.and(i32.wrap_i64(i64.shr_u(local.get("$value"), i64.const(48))), i32.const(65535)),
            i32.and(i32.wrap_i64(i64.shr_u(local.get("$value"), i64.const(40))), i32.const(255)),
            i32.and(i32.wrap_i64(i64.shr_u(local.get("$value"), i64.const(32))), i32.const(255)),
            i32.wrap_i64(local.get("$value")),
          ),
        wasm.return(),
      ),
    wasm.if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.NONE))).then(wasm.call("$_log_none"), wasm.return()),
    wasm
      .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.LIST)))
      .then(
        wasm
          .call("$_log_list")
          .args(i32.wrap_i64(i64.shr_u(local.get("$value"), i64.const(32))), i32.wrap_i64(local.get("$value"))),
        wasm.return(),
      ),

    wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.LOG_UNKNOWN_TYPE))),
    wasm.unreachable(),
  );

// unary operation functions
export const NEG_FX = wasm
  .func("$_py_neg")
  .params({ $x_tag: i32, $x_val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.INT)))
      .then(
        wasm.return(wasm.call(MAKE_INT_FX).args(i64.add(i64.xor(local.get("$x_val"), i64.const(-1)), i64.const(1)))),
      ),

    wasm
      .if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.FLOAT)))
      .then(wasm.return(wasm.call(MAKE_FLOAT_FX).args(f64.neg(f64.reinterpret_i64(local.get("$x_val")))))),

    wasm
      .if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.COMPLEX)))
      .then(
        wasm.return(
          wasm
            .call(MAKE_COMPLEX_FX)
            .args(
              f64.neg(f64.load(i32.wrap_i64(local.get("$x_val")))),
              f64.neg(f64.load(i32.add(i32.wrap_i64(local.get("$x_val")), i32.const(8)))),
            ),
        ),
      ),

    wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.NEG_NOT_SUPPORT))),
    wasm.unreachable(),
  );

export const ARITHMETIC_OP_TAG = { ADD: 0, SUB: 1, MUL: 2, DIV: 3 } as const;
// binary operation function
export const ARITHMETIC_OP_FX = wasm
  .func("$_py_arith_op")
  .params({ $x_tag: i32, $x_val: i64, $y_tag: i32, $y_val: i64, $op: i32 })
  .results(i32, i64)
  .locals({ $a: f64, $b: f64, $c: f64, $d: f64, $denom: f64, $str_ptr: i32 })
  .body(
    // if adding, check if both are strings
    wasm
      .if(
        i32.and(
          i32.eq(local.get("$op"), i32.const(ARITHMETIC_OP_TAG.ADD)),
          i32.and(
            i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.STRING)),
            i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.STRING)),
          ),
        ),
      )
      .then(
        wasm.call(POP_SHADOW_STACK_FX),
        wasm.raw`(local.set $y_val) (local.set $y_tag)`,
        wasm.call(POP_SHADOW_STACK_FX),
        wasm.raw`(local.set $x_val) (local.set $x_tag)`,

        memory.copy(
          local.tee(
            "$str_ptr",
            wasm.call(MALLOC_FX).args(i32.add(i32.wrap_i64(local.get("$x_val")), i32.wrap_i64(local.get("$y_val")))),
          ),
          i32.wrap_i64(i64.shr_u(local.get("$x_val"), i64.const(32))),
          i32.wrap_i64(local.get("$x_val")),
        ),
        memory.copy(
          i32.add(local.get("$str_ptr"), i32.wrap_i64(local.get("$x_val"))),
          i32.wrap_i64(i64.shr_u(local.get("$y_val"), i64.const(32))),
          i32.wrap_i64(local.get("$y_val")),
        ),

        wasm.return(
          wasm
            .call(MAKE_STRING_FX)
            .args(local.get("$str_ptr"), i32.add(i32.wrap_i64(local.get("$x_val")), i32.wrap_i64(local.get("$y_val")))),
        ),
      ),

    // if either's bool, convert to int
    wasm.if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.BOOL))).then(local.set("$x_tag", i32.const(TYPE_TAG.INT))),
    wasm.if(i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.BOOL))).then(local.set("$y_tag", i32.const(TYPE_TAG.INT))),

    // if both int, use int instr (except for division: use float)
    wasm
      .if(
        i32.and(
          i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.INT)),
          i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.INT)),
        ),
      )
      .then(
        ...wasm.buildBrTableBlocks(
          wasm.br_table(local.get("$op"), "$add", "$sub", "$mul", "$div"),
          wasm.return(wasm.call(MAKE_INT_FX).args(i64.add(local.get("$x_val"), local.get("$y_val")))),
          wasm.return(wasm.call(MAKE_INT_FX).args(i64.sub(local.get("$x_val"), local.get("$y_val")))),
          wasm.return(wasm.call(MAKE_INT_FX).args(i64.mul(local.get("$x_val"), local.get("$y_val")))),
          wasm.return(
            wasm
              .call(MAKE_FLOAT_FX)
              .args(f64.div(f64.convert_i64_s(local.get("$x_val")), f64.convert_i64_s(local.get("$y_val")))),
          ),
        ),
      ),

    // else, if either's int, convert to float and set float locals
    wasm
      .if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.INT)))
      .then(local.set("$a", f64.convert_i64_s(local.get("$x_val"))), local.set("$x_tag", i32.const(TYPE_TAG.FLOAT)))
      .else(local.set("$a", f64.reinterpret_i64(local.get("$x_val")))),

    wasm
      .if(i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.INT)))
      .then(local.set("$c", f64.convert_i64_s(local.get("$y_val"))), local.set("$y_tag", i32.const(TYPE_TAG.FLOAT)))
      .else(local.set("$c", f64.reinterpret_i64(local.get("$y_val")))),

    // if both float, use float instr
    wasm
      .if(
        i32.and(
          i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.FLOAT)),
          i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.FLOAT)),
        ),
      )
      .then(
        ...wasm.buildBrTableBlocks(
          wasm.br_table(local.get("$op"), "$add", "$sub", "$mul", "$div"),
          wasm.return(wasm.call(MAKE_FLOAT_FX).args(f64.add(local.get("$a"), local.get("$c")))),
          wasm.return(wasm.call(MAKE_FLOAT_FX).args(f64.sub(local.get("$a"), local.get("$c")))),
          wasm.return(wasm.call(MAKE_FLOAT_FX).args(f64.mul(local.get("$a"), local.get("$c")))),
          wasm.return(wasm.call(MAKE_FLOAT_FX).args(f64.div(local.get("$a"), local.get("$c")))),
        ),
      ),

    // else, if either's float, convert to complex.
    // elseif complex: load from mem, set locals (default 0).
    // else: unreachable
    wasm
      .if(i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.FLOAT)))
      .then(local.set("$y_tag", i32.const(TYPE_TAG.COMPLEX)))
      .else(
        wasm
          .if(i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.COMPLEX)))
          .then(
            wasm.call(POP_SHADOW_STACK_FX),
            wasm.raw`(local.set $y_val) (local.set $y_tag)`,

            local.set("$c", f64.load(i32.wrap_i64(local.get("$y_val")))),
            local.set("$d", f64.load(i32.add(i32.wrap_i64(local.get("$y_val")), i32.const(8)))),
          )
          .else(
            wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.ARITH_OP_UNKNOWN_TYPE))),
            wasm.unreachable(),
          ),
      ),
    wasm
      .if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.FLOAT)))
      .then(local.set("$x_tag", i32.const(TYPE_TAG.COMPLEX)))
      .else(
        wasm
          .if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.COMPLEX)))
          .then(
            wasm.call(POP_SHADOW_STACK_FX),
            wasm.raw`(local.set $x_val) (local.set $x_tag)`,

            local.set("$a", f64.load(i32.wrap_i64(local.get("$x_val")))),
            local.set("$b", f64.load(i32.add(i32.wrap_i64(local.get("$x_val")), i32.const(8)))),
          )
          .else(
            wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.ARITH_OP_UNKNOWN_TYPE))),
            wasm.unreachable(),
          ),
      ),

    // perform complex operations
    ...wasm.buildBrTableBlocks(
      wasm.br_table(local.get("$op"), "$add", "$sub", "$mul", "$div"),
      wasm.return(
        wasm
          .call(MAKE_COMPLEX_FX)
          .args(f64.add(local.get("$a"), local.get("$c")), f64.add(local.get("$b"), local.get("$d"))),
      ),
      wasm.return(
        wasm
          .call(MAKE_COMPLEX_FX)
          .args(f64.sub(local.get("$a"), local.get("$c")), f64.sub(local.get("$b"), local.get("$d"))),
      ),
      // (a+bi)*(c+di) = (ac-bd) + (ad+bc)i
      wasm.return(
        wasm
          .call(MAKE_COMPLEX_FX)
          .args(
            f64.sub(f64.mul(local.get("$a"), local.get("$c")), f64.mul(local.get("$b"), local.get("$d"))),
            f64.add(f64.mul(local.get("$b"), local.get("$c")), f64.mul(local.get("$a"), local.get("$d"))),
          ),
      ),
      // (a+bi)/(c+di) = (ac+bd)/(c^2+d^2) + (bc-ad)/(c^2+d^2)i
      wasm.return(
        wasm
          .call(MAKE_COMPLEX_FX)
          .args(
            local.tee(
              "$denom",
              f64.div(
                f64.add(f64.mul(local.get("$a"), local.get("$c")), f64.mul(local.get("$b"), local.get("$d"))),
                f64.add(f64.mul(local.get("$c"), local.get("$c")), f64.mul(local.get("$d"), local.get("$d"))),
              ),
            ),
            f64.div(
              f64.sub(f64.mul(local.get("$b"), local.get("$c")), f64.mul(local.get("$a"), local.get("$d"))),
              local.get("$denom"),
            ),
          ),
      ),
    ),

    wasm.unreachable(),
  );

export const COMPARISON_OP_TAG = {
  EQ: 0,
  NEQ: 1,
  LT: 2,
  LTE: 3,
  GT: 4,
  GTE: 5,
} as const;
// comparison function
export const STRING_COMPARE_FX = wasm
  .func("$_py_string_cmp")
  .params({ $x_ptr: i32, $x_len: i32, $y_ptr: i32, $y_len: i32 })
  .results(i32)
  .locals({ $i: i32, $min_len: i32, $x_char: i32, $y_char: i32, $result: i32 })
  .body(
    local.set(
      "$min_len",
      wasm.select(local.get("$x_len"), local.get("$y_len"), i32.lt_s(local.get("$x_len"), local.get("$y_len"))),
    ),

    wasm.loop("$loop").body(
      wasm.if(i32.lt_s(local.get("$i"), local.get("$min_len"))).then(
        local.set("$x_char", i32.load8_u(i32.add(local.get("$x_ptr"), local.get("$i")))),
        local.set("$y_char", i32.load8_u(i32.add(local.get("$y_ptr"), local.get("$i")))),

        wasm
          .if(local.tee("$result", i32.sub(local.get("$x_char"), local.get("$y_char"))))
          .then(wasm.return(local.get("$result"))),

        local.set("$i", i32.add(local.get("$i"), i32.const(1))),

        wasm.br("$loop"),
      ),
    ),

    wasm.return(i32.sub(local.get("$y_len"), local.get("$x_len"))),
  );

export const COMPARISON_OP_FX = wasm
  .func("$_py_compare_op")
  .params({ $x_tag: i32, $x_val: i64, $y_tag: i32, $y_val: i64, $op: i32 })
  .results(i32, i64)
  .locals({ $a: f64, $b: f64, $c: f64, $d: f64 })
  .body(
    // if both are strings
    wasm
      .if(
        i32.and(
          i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.STRING)),
          i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.STRING)),
        ),
      )
      .then(
        local.set(
          "$x_tag", // reuse x_tag for comparison result
          wasm
            .call(STRING_COMPARE_FX)
            .args(
              i32.wrap_i64(i64.shr_u(local.get("$x_val"), i64.const(32))),
              i32.wrap_i64(local.get("$x_val")),
              i32.wrap_i64(i64.shr_u(local.get("$y_val"), i64.const(32))),
              i32.wrap_i64(local.get("$y_val")),
            ),
        ),

        ...wasm.buildBrTableBlocks(
          wasm.br_table(local.get("$op"), "$eq", "$neq", "$lt", "$lte", "$gt", "$gte"),
          wasm.return(wasm.call(MAKE_BOOL_FX).args(i32.eqz(local.get("$x_tag")))),
          wasm.return(wasm.call(MAKE_BOOL_FX).args(i32.ne(local.get("$x_tag"), i32.const(0)))),
          wasm.return(wasm.call(MAKE_BOOL_FX).args(i32.lt_s(local.get("$x_tag"), i32.const(0)))),
          wasm.return(wasm.call(MAKE_BOOL_FX).args(i32.le_s(local.get("$x_tag"), i32.const(0)))),
          wasm.return(wasm.call(MAKE_BOOL_FX).args(i32.gt_s(local.get("$x_tag"), i32.const(0)))),
          wasm.return(wasm.call(MAKE_BOOL_FX).args(i32.ge_s(local.get("$x_tag"), i32.const(0)))),
        ),
      ),

    // if either are bool, convert to int
    wasm.if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.BOOL))).then(local.set("$x_tag", i32.const(TYPE_TAG.INT))),
    wasm.if(i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.BOOL))).then(local.set("$y_tag", i32.const(TYPE_TAG.INT))),

    // if both int, use int comparison
    wasm
      .if(
        i32.and(
          i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.INT)),
          i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.INT)),
        ),
      )
      .then(
        ...wasm.buildBrTableBlocks(
          wasm.br_table(local.get("$op"), "$eq", "$neq", "$lt", "$lte", "$gt", "$gte"),
          wasm.return(wasm.call(MAKE_BOOL_FX).args(i64.eq(local.get("$x_val"), local.get("$y_val")))),
          wasm.return(wasm.call(MAKE_BOOL_FX).args(i64.ne(local.get("$x_val"), local.get("$y_val")))),
          wasm.return(wasm.call(MAKE_BOOL_FX).args(i64.lt_s(local.get("$x_val"), local.get("$y_val")))),
          wasm.return(wasm.call(MAKE_BOOL_FX).args(i64.le_s(local.get("$x_val"), local.get("$y_val")))),
          wasm.return(wasm.call(MAKE_BOOL_FX).args(i64.gt_s(local.get("$x_val"), local.get("$y_val")))),
          wasm.return(wasm.call(MAKE_BOOL_FX).args(i64.ge_s(local.get("$x_val"), local.get("$y_val")))),
        ),
      ),

    // else, if either are int, convert to float and set float locals
    wasm
      .if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.INT)))
      .then(local.set("$a", f64.convert_i64_s(local.get("$x_val"))), local.set("$x_tag", i32.const(TYPE_TAG.FLOAT)))
      .else(local.set("$a", f64.reinterpret_i64(local.get("$x_val")))),
    wasm
      .if(i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.INT)))
      .then(local.set("$c", f64.convert_i64_s(local.get("$y_val"))), local.set("$y_tag", i32.const(TYPE_TAG.FLOAT)))
      .else(local.set("$c", f64.reinterpret_i64(local.get("$y_val")))),

    // if both float, use float comparison
    wasm
      .if(
        i32.and(
          i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.FLOAT)),
          i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.FLOAT)),
        ),
      )
      .then(
        ...wasm.buildBrTableBlocks(
          wasm.br_table(local.get("$op"), "$eq", "$neq", "$lt", "$lte", "$gt", "$gte"),
          wasm.return(wasm.call(MAKE_BOOL_FX).args(f64.eq(local.get("$a"), local.get("$c")))),
          wasm.return(wasm.call(MAKE_BOOL_FX).args(f64.ne(local.get("$a"), local.get("$c")))),
          wasm.return(wasm.call(MAKE_BOOL_FX).args(f64.lt(local.get("$a"), local.get("$c")))),
          wasm.return(wasm.call(MAKE_BOOL_FX).args(f64.le(local.get("$a"), local.get("$c")))),
          wasm.return(wasm.call(MAKE_BOOL_FX).args(f64.gt(local.get("$a"), local.get("$c")))),
          wasm.return(wasm.call(MAKE_BOOL_FX).args(f64.ge(local.get("$a"), local.get("$c")))),
        ),
      ),

    // else, if either are complex, load complex from memory and set float locals (default 0)
    wasm
      .if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.FLOAT)))
      .then(local.set("$x_tag", i32.const(TYPE_TAG.COMPLEX)))
      .else(
        local.set("$a", f64.load(i32.wrap_i64(local.get("$x_val")))),
        local.set("$b", f64.load(i32.add(i32.wrap_i64(local.get("$x_val")), i32.const(8)))),
      ),
    wasm
      .if(i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.FLOAT)))
      .then(local.set("$y_tag", i32.const(TYPE_TAG.COMPLEX)))
      .else(
        local.set("$c", f64.load(i32.wrap_i64(local.get("$y_val")))),
        local.set("$d", f64.load(i32.add(i32.wrap_i64(local.get("$y_val")), i32.const(8)))),
      ),

    // if both complex, compare real and imaginary parts. only ==, !=
    wasm
      .if(
        i32.and(
          i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.COMPLEX)),
          i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.COMPLEX)),
        ),
      )
      .then(
        wasm
          .if(i32.eq(local.get("$op"), i32.const(COMPARISON_OP_TAG.EQ)))
          .then(
            wasm.return(
              wasm
                .call(MAKE_BOOL_FX)
                .args(i32.and(f64.eq(local.get("$a"), local.get("$c")), f64.eq(local.get("$b"), local.get("$d")))),
            ),
          )
          .else(
            wasm
              .if(i32.eq(local.get("$op"), i32.const(COMPARISON_OP_TAG.NEQ)))
              .then(
                wasm.return(
                  wasm
                    .call(MAKE_BOOL_FX)
                    .args(i32.or(f64.ne(local.get("$a"), local.get("$c")), f64.ne(local.get("$b"), local.get("$d")))),
                ),
              )
              .else(
                wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.COMPLEX_COMPARISON))),
                wasm.unreachable(),
              ),
          ),
      ),

    // else, default to not equal
    wasm
      .if(i32.eq(local.get("$op"), i32.const(COMPARISON_OP_TAG.EQ)))
      .then(wasm.return(wasm.call(MAKE_BOOL_FX).args(i32.const(0))))
      .else(
        wasm
          .if(i32.eq(local.get("$op"), i32.const(COMPARISON_OP_TAG.NEQ)))
          .then(wasm.return(wasm.call(MAKE_BOOL_FX).args(i32.const(1)))),
      ),

    // other operators: unreachable
    wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.COMPARE_OP_UNKNOWN_TYPE))),
    wasm.unreachable(),
  );

// bool related functions

export const BOOLISE_FX = wasm
  .func("$_boolise")
  .params({ $tag: i32, $val: i64 })
  .results(i64)
  .body(
    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$tag")))
      .then(wasm.call(POP_SHADOW_STACK_FX), wasm.raw`(local.set $val) (local.set $tag)`),

    // None => False
    wasm
      .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.NONE)))
      .then(wasm.return(wasm.call(MAKE_BOOL_FX).args(i32.const(0)))),

    // bool or int => return bool with value (False if 0)
    wasm
      .if(
        i32.or(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.INT)), i32.eq(local.get("$tag"), i32.const(TYPE_TAG.BOOL))),
      )
      .then(wasm.return(wasm.call(MAKE_BOOL_FX).args(i32.wrap_i64(local.get("$val"))))),

    // float/complex => False if equivalent of 0
    wasm
      .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.FLOAT)))
      .then(wasm.return(wasm.call(MAKE_BOOL_FX).args(f64.ne(f64.reinterpret_i64(local.get("$val")), f64.const(0))))),
    wasm
      .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.COMPLEX)))
      .then(
        wasm.return(
          wasm
            .call(MAKE_BOOL_FX)
            .args(
              i32.or(
                f64.ne(f64.load(i32.add(i32.wrap_i64(local.get("$val")), i32.const(8))), f64.const(0)),
                f64.ne(f64.load(i32.wrap_i64(local.get("$val"))), f64.const(0)),
              ),
            ),
        ),
      ),

    // string => False if length is 0
    wasm
      .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.STRING)))
      .then(wasm.return(wasm.call(MAKE_BOOL_FX).args(i32.wrap_i64(local.get("$val"))))),

    // list => False if length is 0
    wasm
      .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.LIST)))
      .then(wasm.return(wasm.call(MAKE_BOOL_FX).args(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(32)))))),

    // closure => True
    wasm
      .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.CLOSURE)))
      .then(wasm.return(wasm.call(MAKE_BOOL_FX).args(i32.const(1)))),

    wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.BOOL_UNKNOWN_TYPE))),
    wasm.unreachable(),
  );

export const BOOL_NOT_FX = wasm
  .func("$_bool_not")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    i32.const(TYPE_TAG.BOOL),
    i64.extend_i32_u(i64.eqz(wasm.call(BOOLISE_FX).args(local.get("$tag"), local.get("$val")))),
  );

// env layout:
// +0: parent env pointer (i32)
// +4: environment size in bindings (i32)
// +8: first binding (tag i32, value i64)
export const ALLOC_ENV_FX = wasm
  .func("$_alloc_env")
  .params({ $size: i32 })
  .locals({ $env: i32, $i: i32, $parent: i32 })
  .results(i32)
  .body(
    local.set(
      "$env",
      wasm.call(MALLOC_FX).args(i32.add(i32.const(ENV_HEAD_SIZE), i32.mul(local.get("$size"), i32.const(12)))),
    ),

    // if there's a callee on the stack, we need to reload the parent from it after MALLOC.
    // if there's no callee, the parent is 0, so this doesn't change anything
    wasm
      .if(i32.lt_s(global.get(SHADOW_STACK_PTR), global.get(SHADOW_STACK_TOP)))
      .then(
        wasm
          .if(i32.eq(i32.load(global.get(SHADOW_STACK_PTR)), i32.const(TYPE_TAG.CLOSURE)))
          .then(local.set("$parent", i32.wrap_i64(i64.load(i32.add(global.get(SHADOW_STACK_PTR), i32.const(4)))))),
      ),

    i32.store(local.get("$env"), local.get("$parent")),
    i32.store(i32.add(local.get("$env"), i32.const(4)), local.get("$size")),

    wasm
      .loop("$loop")
      .body(
        wasm
          .if(i32.lt_u(local.get("$i"), local.get("$size")))
          .then(
            i32.store(
              i32.add(i32.add(local.get("$env"), i32.const(ENV_HEAD_SIZE)), i32.mul(local.get("$i"), i32.const(12))),
              i32.const(TYPE_TAG.UNBOUND),
            ),
            local.set("$i", i32.add(local.get("$i"), i32.const(1))),
            wasm.br("$loop"),
          ),
      ),

    local.get("$env"),
  );

export const PRE_APPLY_FX = wasm
  .func("$_pre_apply")
  .params({ $tag: i32, $val: i64, $arg_len: i32 })
  .results(i32)
  .body(
    wasm
      .if(i32.ne(local.get("$tag"), i32.const(TYPE_TAG.CLOSURE)))
      .then(wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.CALL_NOT_FX))), wasm.unreachable()),

    wasm
      .call(ALLOC_ENV_FX)
      .args(
        i32.add(
          local.get("$arg_len"),
          i32.sub(
            i32.and(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(32))), i32.const(255)),
            i32.and(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(40))), i32.const(255)),
          ),
        ),
      ),
  );

export const APPLY_FX_NAME = "$_apply";
export const RETURN_ENV_NAME = "$return_env";
export const RETURN_NONVOID_SUFFIX = [
  wasm.raw`(local.set $return_val) (local.set $return_tag)`,
  wasm
    .if(wasm.call(IS_TAG_GCABLE).args(local.get("$return_tag")))
    .results(i32, i64)
    .then(
      wasm.call(DISCARD_SHADOW_STACK_FX),
      local.set(RETURN_ENV_NAME, i32.wrap_i64(i64.load(i32.add(global.get(SHADOW_STACK_PTR), i32.const(4))))),
      wasm.call(DISCARD_SHADOW_STACK_FX),

      wasm.call(PUSH_SHADOW_STACK_FX).args(local.get("$return_tag"), local.get("$return_val")),
    )
    .else(
      local.set(RETURN_ENV_NAME, i32.wrap_i64(i64.load(i32.add(global.get(SHADOW_STACK_PTR), i32.const(4))))),
      wasm.call(DISCARD_SHADOW_STACK_FX),
      local.get("$return_tag"),
      local.get("$return_val"),
    ),

  global.set(CURR_ENV, local.get(RETURN_ENV_NAME)),
];

export const RETURN_VOID_SUFFIX = [
  local.set(RETURN_ENV_NAME, i32.wrap_i64(i64.load(i32.add(global.get(SHADOW_STACK_PTR), i32.const(4))))),
  wasm.call(DISCARD_SHADOW_STACK_FX),
  wasm.call(MAKE_NONE_FX),

  global.set(CURR_ENV, local.get(RETURN_ENV_NAME)),
];

export const applyFuncFactory = (bodies: WasmInstruction[][]) =>
  wasm
    .func(APPLY_FX_NAME)
    .params({ $arg_len: i32 })
    .locals({
      [RETURN_ENV_NAME]: i32,
      $val: i64,
      $additional_args: i32,
      $i: i32,
      $arg_ptr: i32,
      $write_ptr: i32,
      $new_env: i32,
      $arity: i32,
      $env_size: i32,
      $has_varargs: i32,
      $return_tag: i32,
      $return_val: i64,
    })
    .results(i32, i64)
    .body(
      // the new env pointer is rooted in CURR_ENV global, so no need to remain on shadow stack after this point
      global.set(CURR_ENV, i32.wrap_i64(i64.load(i32.add(global.get(SHADOW_STACK_PTR), i32.const(4))))),
      wasm.call(DISCARD_SHADOW_STACK_FX),

      // pop closure from shadow stack into locals
      wasm.call(POP_SHADOW_STACK_FX),
      wasm.raw`(local.set $val) (drop)`,

      // return env remains on the shadow stack for the return instruction to use after the call

      local.set("$arity", i32.and(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(40))), i32.const(255))),
      local.set("$env_size", i32.and(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(32))), i32.const(255))),
      local.set("$has_varargs", i32.and(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(63))), i32.const(1))),

      // check if args have any starred arguments (unpack). if so, we need to construct a new env
      wasm.loop("$loop").body(
        wasm.if(i32.lt_s(local.get("$i"), local.get("$arg_len"))).then(
          local.set(
            "$arg_ptr",
            i32.add(i32.add(global.get(CURR_ENV), i32.mul(local.get("$i"), i32.const(12))), i32.const(ENV_HEAD_SIZE)),
          ),
          wasm.if(i32.shr_u(i32.load(local.get("$arg_ptr")), i32.const(31))).then(
            // check if it's a list, if not error (only lists can be unpacked)
            wasm
              .if(i32.ne(i32.and(i32.load(local.get("$arg_ptr")), i32.const(0x7fffffff)), i32.const(TYPE_TAG.LIST)))
              .then(
                wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.STARRED_NOT_LIST))),
                wasm.unreachable(),
              ),
            local.set(
              "$additional_args",
              i32.add(
                local.get("$additional_args"),
                i32.sub(i32.wrap_i64(i64.load(i32.add(local.get("$arg_ptr"), i32.const(4)))), i32.const(1)),
              ),
            ),
          ),

          local.set("$i", i32.add(local.get("$i"), i32.const(1))),
          wasm.br("$loop"),
        ),
      ),

      wasm.if(local.get("$additional_args")).then(
        // ALLOC a new environment with size = old env size + additional args from unpacking
        // push the callee back onto the stack for ALLOC_ENV to use as the parent env, then discard it after
        wasm.call(SILENT_PUSH_SHADOW_STACK_FX).args(i32.const(TYPE_TAG.CLOSURE), local.get("$val")),
        local.set(
          "$new_env",
          wasm.call(ALLOC_ENV_FX).args(i32.add(local.get("$env_size"), local.get("$additional_args"))),
        ),
        wasm.call(DISCARD_SHADOW_STACK_FX),

        local.set("$arg_len", i32.add(local.get("$arg_len"), local.get("$additional_args"))),
        local.set("$write_ptr", i32.add(local.get("$new_env"), i32.const(ENV_HEAD_SIZE))),

        // loop over the entire old environment, which = envSize
        local.set("$i", i32.const(0)),
        wasm.loop("$unpack_loop").body(
          wasm.if(i32.lt_s(local.get("$i"), i32.load(i32.add(global.get(CURR_ENV), i32.const(4))))).then(
            local.set(
              "$arg_ptr",
              i32.add(i32.add(global.get(CURR_ENV), i32.mul(local.get("$i"), i32.const(12))), i32.const(ENV_HEAD_SIZE)),
            ),

            // if starred, remove the starred bit and prepare to unpack
            wasm
              .if(i32.shr_u(i32.load(local.get("$arg_ptr")), i32.const(31)))
              .then(
                i32.store(local.get("$arg_ptr"), i32.and(i32.load(local.get("$arg_ptr")), i32.const(0x7fffffff))),
                // copy over the list
                memory.copy(
                  local.get("$write_ptr"),
                  i32.wrap_i64(i64.shr_u(i64.load(i32.add(local.get("$arg_ptr"), i32.const(4))), i64.const(32))),
                  i32.mul(i32.wrap_i64(i64.load(i32.add(local.get("$arg_ptr"), i32.const(4)))), i32.const(12)),
                ),
                local.set(
                  "$write_ptr",
                  i32.add(
                    local.get("$write_ptr"),
                    i32.mul(i32.wrap_i64(i64.load(i32.add(local.get("$arg_ptr"), i32.const(4)))), i32.const(12)),
                  ),
                ),
              )
              .else(
                // else not starred: just copy the element over
                memory.copy(local.get("$write_ptr"), local.get("$arg_ptr"), i32.const(12)),
                local.set("$write_ptr", i32.add(local.get("$write_ptr"), i32.const(12))),
              ),
            local.set("$i", i32.add(local.get("$i"), i32.const(1))),
            wasm.br("$unpack_loop"),
          ),
        ),

        global.set(CURR_ENV, local.get("$new_env")),
      ),

      // if varargs bit is true AND arity is greater than argument length, error
      // if not varargs AND arity doesn't equal argument length, error
      wasm
        .if(
          i32.or(
            i32.and(local.get("$has_varargs"), i32.gt_u(local.get("$arity"), local.get("$arg_len"))),
            i32.and(i32.eqz(local.get("$has_varargs")), i32.ne(local.get("$arity"), local.get("$arg_len"))),
          ),
        )
        .then(wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.FUNC_WRONG_ARITY))), wasm.unreachable()),

      // if has varargs
      wasm.if(local.get("$has_varargs")).then(
        memory.copy(
          i32.add(
            i32.add(global.get(CURR_ENV), i32.const(ENV_HEAD_SIZE)),
            i32.mul(local.get("$env_size"), i32.const(12)),
          ),
          i32.add(i32.add(global.get(CURR_ENV), i32.const(ENV_HEAD_SIZE)), i32.mul(local.get("$arity"), i32.const(12))),
          i32.mul(i32.sub(local.get("$arg_len"), local.get("$arity")), i32.const(12)),
        ),

        // create tuple manually with pointer to start of the copied list, and store it in the env where the varargs would be,
        // which is right after the fixed arguments and before local declarations
        i32.store(
          i32.add(i32.add(global.get(CURR_ENV), i32.const(ENV_HEAD_SIZE)), i32.mul(local.get("$arity"), i32.const(12))),
          i32.const(TYPE_TAG.TUPLE),
        ),
        i64.store(
          i32.add(
            i32.add(
              i32.add(global.get(CURR_ENV), i32.const(ENV_HEAD_SIZE)),
              i32.mul(local.get("$arity"), i32.const(12)),
            ),
            i32.const(4),
          ),
          i64.or(
            i64.shl(
              i64.extend_i32_u(
                i32.add(
                  i32.add(global.get(CURR_ENV), i32.const(ENV_HEAD_SIZE)),
                  i32.mul(local.get("$env_size"), i32.const(12)),
                ),
              ),
              i64.const(32),
            ),
            i64.extend_i32_u(i32.sub(local.get("$arg_len"), local.get("$arity"))),
          ),
        ),

        // need to re-UNBOUND the local variables
        local.set("$i", i32.const(0)),
        wasm
          .loop("$reunbound_loop")
          .body(
            wasm
              .if(
                i32.lt_s(local.get("$i"), i32.sub(i32.sub(local.get("$env_size"), local.get("$arity")), i32.const(1))),
              )
              .then(
                i32.store(
                  i32.add(
                    i32.add(global.get(CURR_ENV), i32.const(ENV_HEAD_SIZE)),
                    i32.mul(i32.add(i32.add(local.get("$arity"), i32.const(1)), local.get("$i")), i32.const(12)),
                  ),
                  i32.const(TYPE_TAG.UNBOUND),
                ),
                local.set("$i", i32.add(local.get("$i"), i32.const(1))),
                wasm.br("$reunbound_loop"),
              ),
          ),
      ),

      ...wasm.buildBrTableBlocks(
        wasm.br_table(
          i32.and(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(48))), i32.const(32767)),
          ...Array(bodies.length).keys(),
        ),
        ...bodies.map(body => [...body, wasm.return(...RETURN_VOID_SUFFIX)]),
      ),
    );

export const GET_LEX_ADDR_FX = wasm
  .func("$_get_lex_addr")
  .params({ $depth: i32, $index: i32 })
  .results(i32, i64)
  .locals({ $env: i32, $tag: i32, $value: i64 })
  .body(
    local.set("$env", global.get(CURR_ENV)),

    wasm.loop("$loop").body(
      wasm.if(i32.eqz(local.get("$depth"))).then(
        local.set(
          "$tag",
          i32.load(
            i32.add(i32.add(local.get("$env"), i32.const(ENV_HEAD_SIZE)), i32.mul(local.get("$index"), i32.const(12))),
          ),
        ),

        wasm
          .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.UNBOUND)))
          .then(wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.UNBOUND))), wasm.unreachable()),

        local.tee(
          "$value",
          i64.load(
            i32.add(
              i32.add(i32.add(local.get("$env"), i32.const(ENV_HEAD_SIZE)), i32.const(4)),
              i32.mul(local.get("$index"), i32.const(12)),
            ),
          ),
        ),

        wasm
          .if(wasm.call(IS_TAG_GCABLE).args(local.get("$tag")))
          .then(wasm.call(SILENT_PUSH_SHADOW_STACK_FX).args(local.get("$tag"), local.get("$value"))),

        wasm.return(local.get("$tag"), local.get("$value")),
      ),

      local.set("$env", i32.load(local.get("$env"))),
      local.set("$depth", i32.sub(local.get("$depth"), i32.const(1))),
      wasm.br("$loop"),
    ),

    wasm.unreachable(),
  );

export const SET_LEX_ADDR_FX = wasm
  .func("$_set_lex_addr")
  .params({ $depth: i32, $index: i32, $tag: i32, $value: i64 })
  .locals({ $env: i32 })
  .body(
    local.set("$env", global.get(CURR_ENV)),

    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$tag")))
      .then(wasm.call(POP_SHADOW_STACK_FX), wasm.raw`(local.set $value) (local.set $tag)`),

    wasm.loop("$loop").body(
      wasm
        .if(i32.eqz(local.get("$depth")))
        .then(
          i32.store(
            i32.add(i32.add(local.get("$env"), i32.const(ENV_HEAD_SIZE)), i32.mul(local.get("$index"), i32.const(12))),
            local.get("$tag"),
          ),
          i64.store(
            i32.add(
              i32.add(i32.add(local.get("$env"), i32.const(ENV_HEAD_SIZE)), i32.const(4)),
              i32.mul(local.get("$index"), i32.const(12)),
            ),
            local.get("$value"),
          ),
          wasm.return(),
        ),

      local.set("$env", i32.load(local.get("$env"))),
      local.set("$depth", i32.sub(local.get("$depth"), i32.const(1))),
      wasm.br("$loop"),
    ),

    wasm.unreachable(),
  );

export const SET_CONTIGUOUS_BLOCK_FX = wasm
  .func("$_set_contiguous_block")
  .params({ $index: i32, $tag: i32, $value: i64, $offset: i32, $is_starred: i32 })
  .locals({ $addr: i32 })
  .body(
    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$tag")))
      .then(wasm.call(POP_SHADOW_STACK_FX), wasm.raw`(local.set $value) (local.set $tag)`),

    wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0)),
    wasm.raw`(i32.wrap_i64) (local.set $addr) (drop)`,

    i32.store(
      i32.add(i32.add(local.get("$addr"), local.get("$offset")), i32.mul(local.get("$index"), i32.const(12))),
      i32.or(local.get("$tag"), i32.shl(local.get("$is_starred"), i32.const(31))),
    ),
    i64.store(
      i32.add(
        i32.add(i32.add(local.get("$addr"), local.get("$offset")), i32.const(4)),
        i32.mul(local.get("$index"), i32.const(12)),
      ),
      local.get("$value"),
    ),
  );

export const TOKENIZE_FX = wasm
  .func("$_tokenize")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(i32.ne(local.get("$tag"), i32.const(TYPE_TAG.STRING)))
      .then(wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.PARSE_NOT_STRING))), wasm.unreachable()),

    wasm
      .call("$_host_tokenize")
      .args(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(32))), i32.wrap_i64(local.get("$val"))),
  );

export const PARSE_FX = wasm
  .func("$_parse")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(i32.ne(local.get("$tag"), i32.const(TYPE_TAG.STRING)))
      .then(wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.PARSE_NOT_STRING))), wasm.unreachable()),

    wasm
      .call("$_host_parse")
      .args(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(32))), i32.wrap_i64(local.get("$val"))),
  );

export const nativeFunctions = [
  COLLECT_FX,
  MALLOC_FX,
  PUSH_SHADOW_STACK_FX,
  SILENT_PUSH_SHADOW_STACK_FX,
  POP_SHADOW_STACK_FX,
  PEEK_SHADOW_STACK_FX,
  DISCARD_SHADOW_STACK_FX,
  IS_TAG_GCABLE,
  MAKE_INT_FX,
  MAKE_FLOAT_FX,
  MAKE_COMPLEX_FX,
  MAKE_BOOL_FX,
  MAKE_STRING_FX,
  MAKE_CLOSURE_FX,
  MAKE_NONE_FX,
  MAKE_LIST_FX,
  MAKE_TUPLE_FX,
  GET_LIST_ELEMENT_FX,
  SET_LIST_ELEMENT_FX,
  LIST_LENGTH_FX,
  IS_LIST_FX,
  MAKE_PAIR_FX,
  IS_PAIR_FX,
  MAKE_LINKED_LIST_FX,
  IS_LINKED_LIST_FX,
  LOG_FX,
  NEG_FX,
  ARITHMETIC_OP_FX,
  STRING_COMPARE_FX,
  COMPARISON_OP_FX,
  BOOLISE_FX,
  BOOL_NOT_FX,
  ALLOC_ENV_FX,
  PRE_APPLY_FX,
  GET_LEX_ADDR_FX,
  SET_LEX_ADDR_FX,
  SET_CONTIGUOUS_BLOCK_FX,
  TOKENIZE_FX,
  PARSE_FX,
];
