import { f64, global, i32, i64, local, memory, wasm, type WasmInstruction } from "@sourceacademy/wasm-util";

// tags
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
  BOOL_UNKNOWN_OP: "Unknown boolean binary operator.",
  GET_ELEMENT_NOT_LIST: "Accessing an element of a non-list value.",
  SET_ELEMENT_NOT_LIST: "Setting an element of a non-list value.",
  INDEX_NOT_INT: "Using a non-integer index to access a list element.",
  LIST_OUT_OF_RANGE: "List index out of range.",
} as const;

const getErrorIndex = (errorKey: (typeof ERROR_MAP)[keyof typeof ERROR_MAP]) =>
  Object.values(ERROR_MAP).findIndex((v) => v === errorKey);

export const HEAP_PTR = "$_heap_pointer";
export const CURR_ENV = "$_current_env";

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
  .results(i32, i64)
  .body(
    f64.store(global.get(HEAP_PTR), local.get("$real")),
    f64.store(i32.add(global.get(HEAP_PTR), i32.const(8)), local.get("$img")),

    i32.const(TYPE_TAG.COMPLEX),
    i64.extend_i32_u(global.get(HEAP_PTR)),

    global.set(HEAP_PTR, i32.add(global.get(HEAP_PTR), i32.const(16))),
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
    i32.const(TYPE_TAG.STRING),
    i64.or(i64.shl(i64.extend_i32_u(local.get("$ptr")), i64.const(32)), i64.extend_i32_u(local.get("$len"))),
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
  );

export const MAKE_NONE_FX = wasm.func("$_make_none").results(i32, i64).body(i32.const(TYPE_TAG.NONE), i64.const(0));

// upper 32: pointer; lower 32: length
// assumption: list elements are already stored in contiguous memory starting from pointer
export const MAKE_LIST_FX = wasm
  .func("$_make_list")
  .params({ $ptr: i32, $len: i32 })
  .results(i32, i64)
  .body(
    i32.const(TYPE_TAG.LIST),
    i64.or(i64.shl(i64.extend_i32_u(local.get("$ptr")), i64.const(32)), i64.extend_i32_u(local.get("$len"))),
  );

// list related functions
export const GET_LIST_ELEMENT_FX = wasm
  .func("$_get_list_element")
  .params({ $tag: i32, $val: i64, $index_tag: i32, $index_val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(i32.ne(local.get("$tag"), i32.const(TYPE_TAG.LIST)))
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

    i32.load(
      i32.add(
        i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(32))),
        i32.mul(i32.wrap_i64(local.get("$index_val")), i32.const(12)),
      ),
    ),
    i64.load(
      i32.add(
        i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(32))),
        i32.add(i32.mul(i32.wrap_i64(local.get("$index_val")), i32.const(12)), i32.const(4)),
      ),
    ),
  );

export const SET_LIST_ELEMENT_FX = wasm
  .func("$_set_list_element")
  .params({ $list_tag: i32, $list_val: i64, $index_tag: i32, $index_val: i64, $tag: i32, $val: i64 })
  .body(
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
    // wasm
    //   .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.PAIR)))
    //   .then(
    //     wasm.call("$_log").args(wasm.call(GET_PAIR_HEAD_FX).args(local.get("$tag"), local.get("$value"))),
    //     wasm.call("$_log").args(wasm.call(GET_PAIR_TAIL_FX).args(local.get("$tag"), local.get("$value"))),
    //     wasm.return(),
    //   ),
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
  .locals({ $a: f64, $b: f64, $c: f64, $d: f64, $denom: f64 })
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
        global.get(HEAP_PTR), // starting address of new string

        memory.copy(
          global.get(HEAP_PTR),
          i32.wrap_i64(i64.shr_u(local.get("$x_val"), i64.const(32))),
          i32.wrap_i64(local.get("$x_val")),
        ),
        global.set(HEAP_PTR, i32.add(global.get(HEAP_PTR), i32.wrap_i64(local.get("$x_val")))),
        memory.copy(
          global.get(HEAP_PTR),
          i32.wrap_i64(i64.shr_u(local.get("$y_val"), i64.const(32))),
          i32.wrap_i64(local.get("$y_val")),
        ),
        global.set(HEAP_PTR, i32.add(global.get(HEAP_PTR), i32.wrap_i64(local.get("$y_val")))),
        i32.add(i32.wrap_i64(local.get("$x_val")), i32.wrap_i64(local.get("$y_val"))),

        wasm.return(wasm.call(MAKE_STRING_FX).args()),
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

    // else, if either's complex, load from mem, set locals (default 0)
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

    // if both complex, perform complex operations
    wasm
      .if(
        i32.and(
          i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.COMPLEX)),
          i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.COMPLEX)),
        ),
      )
      .then(
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
      ),

    wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.ARITH_OP_UNKNOWN_TYPE))),
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

export const BOOL_BINARY_OP_TAG = { AND: 0, OR: 1 };

// +4 because parentEnv is stored at start of env
export const ALLOC_ENV_FX = wasm
  .func("$_alloc_env")
  .params({ $size: i32, $parent: i32 })
  .results(i32)
  .body(
    global.get(HEAP_PTR), // return the start of the new env, set CURR_ENV AFTER
    i32.store(global.get(HEAP_PTR), local.get("$parent")),
    global.set(HEAP_PTR, i32.add(global.get(HEAP_PTR), i32.const(4))),

    wasm
      .loop("$loop")
      .body(
        wasm
          .if(local.get("$size"))
          .then(
            i32.store(global.get(HEAP_PTR), i32.const(TYPE_TAG.UNBOUND)),
            global.set(HEAP_PTR, i32.add(global.get(HEAP_PTR), i32.const(12))),
            local.set("$size", i32.sub(local.get("$size"), i32.const(1))),
            wasm.br("$loop"),
          ),
      ),
  );

export const PRE_APPLY_FX = wasm
  .func("$_pre_apply")
  .params({ $tag: i32, $val: i64, $arity: i32 })
  .results(i32, i64, i32)
  .body(
    wasm
      .if(i32.ne(local.get("$tag"), i32.const(TYPE_TAG.CLOSURE)))
      .then(wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.CALL_NOT_FX))), wasm.unreachable()),

    // if varargs bit is true AND arity is greater than argument length, error
    // if not varargs AND arity doesn't equal argument length, error
    wasm
      .if(
        i32.or(
          i32.and(
            i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(63))),
            i32.gt_u(
              i32.and(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(40))), i32.const(255)),
              local.get("$arity"),
            ),
          ),
          i32.and(
            i32.eqz(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(63)))),
            i32.ne(
              i32.and(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(40))), i32.const(255)),
              local.get("$arity"),
            ),
          ),
        ),
      )
      .then(wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.FUNC_WRONG_ARITY))), wasm.unreachable()),

    local.get("$tag"),
    local.get("$val"),
    wasm
      .call(ALLOC_ENV_FX)
      .args(
        i32.and(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(32))), i32.const(255)),
        i32.wrap_i64(local.get("$val")),
      ),
  );

export const APPLY_FX_NAME = "$_apply";
export const RETURN_ENV_NAME = "$return_env";
export const applyFuncFactory = (bodies: WasmInstruction[][]) =>
  wasm
    .func(APPLY_FX_NAME)
    .locals({ $list_len: i32, $list_tag: i32, $list_val: i64 })
    .params({ [RETURN_ENV_NAME]: i32, $tag: i32, $val: i64, $arg_len: i32 })
    .results(i32, i64)
    .body(
      wasm.if(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(63)))).then(
        local.set(
          "$list_len",
          i32.sub(
            local.get("$arg_len"),
            i32.and(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(40))), i32.const(255)),
          ),
        ),

        memory.copy(
          global.get(HEAP_PTR),
          i32.sub(global.get(HEAP_PTR), i32.const(12)),
          i32.mul(local.get("$list_len"), i32.const(12)),
        ),

        wasm.raw`${wasm.call(MAKE_LIST_FX).args(global.get(HEAP_PTR), local.get("$list_len"))}
        (local.set $list_val)
        (local.set $list_tag)`,
        i32.store(i32.sub(global.get(HEAP_PTR), i32.const(12)), local.get("$list_tag")),
        i64.store(i32.sub(global.get(HEAP_PTR), i32.const(8)), local.get("$list_val")),

        global.set(HEAP_PTR, i32.add(global.get(HEAP_PTR), i32.mul(local.get("$list_len"), i32.const(12)))),
      ),

      ...wasm.buildBrTableBlocks(
        wasm.br_table(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(48))), ...Array(bodies.length).keys()),
        ...bodies.map((body) => [
          ...body,
          wasm.return(wasm.call(MAKE_NONE_FX), global.set(CURR_ENV, local.get(RETURN_ENV_NAME))),
        ]),
      ),
    );

export const GET_LEX_ADDR_FX = wasm
  .func("$_get_lex_addr")
  .params({ $depth: i32, $index: i32 })
  .results(i32, i64)
  .locals({ $env: i32, $tag: i32 })
  .body(
    local.set("$env", global.get(CURR_ENV)),

    wasm.loop("$loop").body(
      wasm.if(i32.eqz(local.get("$depth"))).then(
        local.set(
          "$tag",
          i32.load(i32.add(i32.add(local.get("$env"), i32.const(4)), i32.mul(local.get("$index"), i32.const(12)))),
        ),

        wasm
          .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.UNBOUND)))
          .then(wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.UNBOUND))), wasm.unreachable()),

        wasm.return(
          local.get("$tag"),
          i64.load(i32.add(i32.add(local.get("$env"), i32.const(8)), i32.mul(local.get("$index"), i32.const(12)))),
        ),
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

    wasm.loop("$loop").body(
      wasm
        .if(i32.eqz(local.get("$depth")))
        .then(
          i32.store(
            i32.add(i32.add(local.get("$env"), i32.const(4)), i32.mul(local.get("$index"), i32.const(12))),
            local.get("$tag"),
          ),
          i64.store(
            i32.add(i32.add(local.get("$env"), i32.const(8)), i32.mul(local.get("$index"), i32.const(12))),
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
  .params({ $addr: i32, $index: i32, $tag: i32, $value: i64, $offset: i32 })
  .results(i32)
  .body(
    i32.store(
      i32.add(i32.add(local.get("$addr"), local.get("$offset")), i32.mul(local.get("$index"), i32.const(12))),
      local.get("$tag"),
    ),
    i64.store(
      i32.add(
        i32.add(local.get("$addr"), i32.add(local.get("$offset"), i32.const(4))),
        i32.mul(local.get("$index"), i32.const(12)),
      ),
      local.get("$value"),
    ),

    local.get("$addr"),
  );

export const nativeFunctions = [
  MAKE_INT_FX,
  MAKE_FLOAT_FX,
  MAKE_COMPLEX_FX,
  MAKE_BOOL_FX,
  MAKE_STRING_FX,
  MAKE_CLOSURE_FX,
  MAKE_NONE_FX,
  MAKE_LIST_FX,
  GET_LIST_ELEMENT_FX,
  SET_LIST_ELEMENT_FX,
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
];
