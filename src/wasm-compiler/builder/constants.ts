import { f64, global, i32, i64, local, memory, wasm } from "wasm-util";
import { WasmInstruction } from "wasm-util/src/types";

// tags
const TYPE_TAG = {
  INT: 0,
  FLOAT: 1,
  COMPLEX: 2,
  BOOL: 3,
  STRING: 4,
  CLOSURE: 5,
  NONE: 6,
  UNBOUND: 7,
  PAIR: 8,
} as const;

export const ERROR_MAP = {
  NEG_NOT_SUPPORT: [0, "Unary minus operator used on unsupported operand."],
  LOG_UNKNOWN_TYPE: [1, "Calling log on an unknown runtime type."],
  ARITH_OP_UNKNOWN_TYPE: [2, "Calling an arithmetic operation on an unsupported runtime type."],
  COMPLEX_COMPARISON: [3, "Using an unsupported comparison operator on complex type."],
  COMPARE_OP_UNKNOWN_TYPE: [4, "Calling a comparison operation on an unsupported runtime type."],
  CALL_NOT_FX: [5, "Calling a non-function value."],
  FUNC_WRONG_ARITY: [6, "Calling function with wrong number of arguments."],
  UNBOUND: [7, "Accessing an unbound value."],
  HEAD_NOT_PAIR: [8, "Accessing the head of a non-pair value."],
  TAIL_NOT_PAIR: [9, "Accessing the tail of a non-pair value."],
} as const;

const TAG_SUFFIX = "_tag";
const PAYLOAD_SUFFIX = "_payload";

export const HEAP_PTR = "$_heap_pointer";
export const CURR_ENV = "$_current_env";

// boxing functions
export const MAKE_INT_FX = wasm
  .func("$_make_int")
  .params({ $value: i64 })
  .results(i32, i64)
  .body(i32.const(TYPE_TAG.INT), local.get("$value"));

export const MAKE_FLOAT_FX = wasm
  .func("$_make_float")
  .params({ $value: f64 })
  .results(i32, i64)
  .body(i32.const(TYPE_TAG.FLOAT), i64.reinterpret_f64(local.get("$value")));

export const MAKE_COMPLEX_FX = wasm
  .func("$_make_complex")
  .params({ $real: f64, $img: f64 })
  .results(i32, i64)
  .body(
    f64.store(global.get(HEAP_PTR), local.get("$real")),
    f64.store(i32.add(global.get(HEAP_PTR), i32.const(8)), local.get("$img")),

    i32.const(TYPE_TAG.COMPLEX),
    i64.extend_i32_s(global.get(HEAP_PTR)),

    global.set(HEAP_PTR, i32.add(global.get(HEAP_PTR), i32.const(16)))
  );

export const MAKE_BOOL_FX = wasm
  .func("$_make_bool")
  .params({ $value: i32 })
  .results(i32, i64)
  .body(i32.const(TYPE_TAG.BOOL), i64.extend_i32_u(local.get("$value")));

// upper 32: pointer; lower 32: length
export const MAKE_STRING_FX = wasm
  .func("$_make_string")
  .params({ $ptr: i32, $len: i32 })
  .results(i32, i64)
  .body(
    i32.const(TYPE_TAG.STRING),
    i64.or(i64.shl(i64.extend_i32_u(local.get("$ptr")), i64.const(32)), i64.extend_i32_u(local.get("$len")))
  );

// upper 16: tag; upperMid 8: arity; lowerMid 8: envSize; lower 32: parentEnv
export const MAKE_CLOSURE_FX = wasm
  .func("$_make_closure")
  .params({ $tag: i32, $arity: i32, $env_size: i32, $parent_env: i32 })
  .results(i32, i64)
  .body(
    i32.const(TYPE_TAG.CLOSURE),

    i64.or(
      i64.or(
        i64.or(
          i64.shl(i64.extend_i32_u(local.get("$tag")), i64.const(48)),
          i64.shl(i64.extend_i32_u(local.get("$arity")), i64.const(40))
        ),
        i64.shl(i64.extend_i32_u(local.get("$env_size")), i64.const(32))
      ),
      i64.extend_i32_u(local.get("$parent_env"))
    )
  );

export const MAKE_NONE_FX = wasm.func("$_make_none").results(i32, i64).body(i32.const(TYPE_TAG.NONE), i64.const(0));

// pair-related functions
export const MAKE_PAIR_FX = wasm
  .func("$_make_pair")
  .params({ $tag1: i32, $val1: i64, $tag2: i32, $val2: i64 })
  .results(i32, i64)
  .body(
    i32.store(global.get(HEAP_PTR), local.get("$tag1")),
    i64.store(i32.add(global.get(HEAP_PTR), i32.const(4)), local.get("$val1")),
    i32.store(i32.add(global.get(HEAP_PTR), i32.const(12)), local.get("$tag2")),
    i64.store(i32.add(global.get(HEAP_PTR), i32.const(16)), local.get("$val2")),

    i32.const(TYPE_TAG.PAIR),
    i64.extend_i32_u(global.get(HEAP_PTR)),

    global.set(HEAP_PTR, i32.add(global.get(HEAP_PTR), i32.const(24)))
  );

export const GET_PAIR_HEAD_FX = wasm
  .func("$_get_pair_head")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(i32.ne(local.get("$tag"), i32.const(TYPE_TAG.PAIR)))
      .then(wasm.call("$_log_error").args(i32.const(ERROR_MAP.HEAD_NOT_PAIR[0])), wasm.unreachable()),

    i32.load(i32.wrap_i64(local.get("$val"))),
    i64.load(i32.add(i32.wrap_i64(local.get("$val")), i32.const(4)))
  );

export const GET_PAIR_TAIL_FX = wasm
  .func("$_get_pair_tail")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(i32.ne(local.get("$tag"), i32.const(TYPE_TAG.PAIR)))
      .then(wasm.call("$_log_error").args(i32.const(ERROR_MAP.TAIL_NOT_PAIR[0])), wasm.unreachable()),

    i32.load(i32.add(i32.wrap_i64(local.get("$val")), i32.const(12))),
    i64.load(i32.add(i32.wrap_i64(local.get("$val")), i32.const(16)))
  );

export const SET_PAIR_HEAD_FX = wasm
  .func("$_set_pair_head")
  .params({ $pair_tag: i32, $pair_val: i64, $tag: i32, $val: i64 })
  .body(
    wasm
      .if(i32.ne(local.get("$pair_tag"), i32.const(TYPE_TAG.PAIR)))
      .then(wasm.call("$_log_error").args(i32.const(ERROR_MAP.HEAD_NOT_PAIR[0])), wasm.unreachable()),

    i32.store(i32.wrap_i64(local.get("$pair_val")), local.get("$tag")),
    i64.store(i32.add(i32.wrap_i64(local.get("$pair_val")), i32.const(4)), local.get("$val"))
  );

export const SET_PAIR_TAIL_FX = wasm
  .func("$_set_pair_tail")
  .params({ $pair_tag: i32, $pair_val: i64, $tag: i32, $val: i64 })
  .body(
    wasm
      .if(i32.ne(local.get("$pair_tag"), i32.const(TYPE_TAG.PAIR)))
      .then(wasm.call("$_log_error").args(i32.const(ERROR_MAP.TAIL_NOT_PAIR[0])), wasm.unreachable()),

    i32.store(i32.add(i32.wrap_i64(local.get("$pair_val")), i32.const(12)), local.get("$tag")),
    i64.store(i32.add(i32.wrap_i64(local.get("$pair_val")), i32.const(16)), local.get("$val"))
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
            f64.load(i32.add(i32.wrap_i64(local.get("$value")), i32.const(8)))
          ),
        wasm.return()
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
        wasm.return()
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
            i32.wrap_i64(local.get("$value"))
          ),
        wasm.return()
      ),
    wasm.if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.NONE))).then(wasm.call("$_log_none"), wasm.return()),
    wasm
      .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.PAIR)))
      .then(
        wasm.call("$_log").args(wasm.call(GET_PAIR_HEAD_FX).args(local.get("$tag"), local.get("$value"))),
        wasm.call("$_log").args(wasm.call(GET_PAIR_TAIL_FX).args(local.get("$tag"), local.get("$value"))),
        wasm.return()
      ),

    wasm.call("$_log_error").args(i32.const(ERROR_MAP.LOG_UNKNOWN_TYPE[0])),
    wasm.unreachable()
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
        wasm.return(wasm.call(MAKE_INT_FX).args(i64.add(i64.xor(local.get("$x_val"), i64.const(-1)), i64.const(1))))
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
              f64.neg(f64.load(i32.add(i32.wrap_i64(local.get("$x_val")), i32.const(8))))
            )
        )
      ),

    wasm.call("$_log_error").args(i32.const(ERROR_MAP.NEG_NOT_SUPPORT[0])),
    wasm.unreachable()
  );

export const ARITHMETIC_OP_TAG = { ADD: 0, SUB: 1, MUL: 2, DIV: 3 } as const;
// binary operation function
export const ARITHMETIC_OP_FX = wasm
  .func("$_py_arith_op")
  .params({ $x_tag: i32, $x_val: i64, $y_tag: i32, $y_val: i64, $op: i32 })
  .results(i32, i64)
  .locals({ $a: f64, $b: f64, $c: f64, $d: f64, $denom: f64 })
  .body(
    wasm
      .if(
        i32.and(
          i32.eq(local.get("$op"), i32.const(ARITHMETIC_OP_TAG.ADD)),
          i32.and(
            i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.STRING)),
            i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.STRING))
          )
        )
      )
      .then(
        global.get(HEAP_PTR),

        memory.copy(
          global.get(HEAP_PTR),
          i32.wrap_i64(i64.shr_u(local.get("$x_val"), i64.const(32))),
          i32.wrap_i64(local.get("$x_val"))
        ),
        global.set(HEAP_PTR, i32.add(global.get(HEAP_PTR), i32.wrap_i64(local.get("$x_val")))),
        memory.copy(
          global.get(HEAP_PTR),
          i32.wrap_i64(i64.shr_u(local.get("$y_val"), i64.const(32))),
          i32.wrap_i64(local.get("$y_val"))
        ),
        global.set(HEAP_PTR, i32.add(global.get(HEAP_PTR), i32.wrap_i64(local.get("$y_val")))),
        i32.add(i32.wrap_i64(local.get("$x_val")), i32.wrap_i64(local.get("$y_val"))),

        wasm.return(wasm.call(MAKE_STRING_FX).args())
      ),

    wasm.if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.BOOL))).then(local.set("$x_tag", i32.const(TYPE_TAG.INT))),
    wasm.if(i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.BOOL))).then(local.set("$y_tag", i32.const(TYPE_TAG.INT))),

    wasm
      .if(
        i32.and(
          i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.INT)),
          i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.INT))
        )
      )
      .then(
        wasm
          .block("$div")
          .body(
            wasm
              .block("$mul")
              .body(
                wasm
                  .block("$sub")
                  .body(
                    wasm.block("$add").body(wasm.br_table(local.get("$op"), "$add", "$sub", "$mul", "$div")),
                    wasm.return(wasm.call(MAKE_INT_FX).args(i64.add(local.get("$x_val"), local.get("$y_val"))))
                  ),
                wasm.return(wasm.call(MAKE_INT_FX).args(i64.sub(local.get("$x_val"), local.get("$y_val"))))
              ),
            wasm.return(wasm.call(MAKE_INT_FX).args(i64.mul(local.get("$x_val"), local.get("$y_val"))))
          ),
        wasm.return(
          wasm
            .call(MAKE_FLOAT_FX)
            .args(f64.div(f64.convert_i64_s(local.get("$x_val")), f64.convert_i64_s(local.get("$y_val"))))
        )
      ),

    wasm
      .if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.INT)))
      .then(local.set("$a", f64.convert_i64_s(local.get("$x_val"))), local.set("$x_tag", i32.const(TYPE_TAG.FLOAT)))
      .else(local.set("$a", f64.reinterpret_i64(local.get("$x_val")))),

    wasm
      .if(i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.INT)))
      .then(local.set("$c", f64.convert_i64_s(local.get("$y_val"))), local.set("$y_tag", i32.const(TYPE_TAG.FLOAT)))
      .else(local.set("$c", f64.reinterpret_i64(local.get("$y_val")))),

    wasm
      .if(
        i32.and(
          i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.FLOAT)),
          i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.FLOAT))
        )
      )
      .then(
        wasm
          .block("$div")
          .body(
            wasm
              .block("$mul")
              .body(
                wasm
                  .block("$sub")
                  .body(
                    wasm.block("$add").body(wasm.br_table(local.get("$op"), "$add", "$sub", "$mul", "$div")),
                    wasm.return(wasm.call(MAKE_FLOAT_FX).args(f64.add(local.get("$a"), local.get("$c"))))
                  ),
                wasm.return(wasm.call(MAKE_FLOAT_FX).args(f64.sub(local.get("$a"), local.get("$c"))))
              ),
            wasm.return(wasm.call(MAKE_FLOAT_FX).args(f64.mul(local.get("$a"), local.get("$c"))))
          ),
        wasm.return(wasm.call(MAKE_FLOAT_FX).args(f64.div(local.get("$a"), local.get("$c"))))
      ),

    wasm
      .if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.FLOAT)))
      .then(local.set("$x_tag", i32.const(TYPE_TAG.COMPLEX)))
      .else(
        local.set("$a", f64.load(i32.wrap_i64(local.get("$x_val")))),
        local.set("$b", f64.load(i32.add(i32.wrap_i64(local.get("$x_val")), i32.const(8))))
      ),

    wasm
      .if(i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.FLOAT)))
      .then(local.set("$y_tag", i32.const(TYPE_TAG.COMPLEX)))
      .else(
        local.set("$c", f64.load(i32.wrap_i64(local.get("$y_val")))),
        local.set("$d", f64.load(i32.add(i32.wrap_i64(local.get("$y_val")), i32.const(8))))
      ),

    wasm
      .if(
        i32.and(
          i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.COMPLEX)),
          i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.COMPLEX))
        )
      )
      .then(
        wasm
          .block("$div")
          .body(
            wasm
              .block("$mul")
              .body(
                wasm
                  .block("$sub")
                  .body(
                    wasm.block("$add").body(wasm.br_table(local.get("$op"), "$add", "$sub", "$mul", "$div")),
                    wasm.return(
                      wasm
                        .call(MAKE_COMPLEX_FX)
                        .args(f64.add(local.get("$a"), local.get("$c")), f64.add(local.get("$b"), local.get("$d")))
                    )
                  ),
                wasm.return(
                  wasm
                    .call(MAKE_COMPLEX_FX)
                    .args(f64.sub(local.get("$a"), local.get("$c")), f64.sub(local.get("$b"), local.get("$d")))
                )
              ),
            wasm.return(
              wasm
                .call(MAKE_COMPLEX_FX)
                .args(
                  f64.sub(f64.mul(local.get("$a"), local.get("$c")), f64.mul(local.get("$b"), local.get("$d"))),
                  f64.add(f64.mul(local.get("$b"), local.get("$c")), f64.mul(local.get("$a"), local.get("$d")))
                )
            )
          ),
        wasm.return(
          wasm
            .call(MAKE_COMPLEX_FX)
            .args(
              local.tee(
                "$denom",
                f64.div(
                  f64.add(f64.mul(local.get("$a"), local.get("$c")), f64.mul(local.get("$b"), local.get("$d"))),
                  f64.add(f64.mul(local.get("$c"), local.get("$c")), f64.mul(local.get("$d"), local.get("$d")))
                )
              ),
              f64.div(
                f64.sub(f64.mul(local.get("$b"), local.get("$c")), f64.mul(local.get("$a"), local.get("$d"))),
                local.get("$denom")
              )
            )
        )
      ),

    wasm.unreachable()
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
      wasm.select(local.get("$x_len"), local.get("$y_len"), i32.lt_s(local.get("$x_len"), local.get("$y_len")))
    ),

    wasm.loop("$loop").body(
      wasm.if(i32.lt_s(local.get("$i"), local.get("$min_len"))).then(
        local.set("$x_char", i32.load8_u(i32.add(local.get("$x_ptr"), local.get("$i")))),
        local.set("$y_char", i32.load8_u(i32.add(local.get("$y_ptr"), local.get("$i")))),

        wasm
          .if(local.tee("$result", i32.sub(local.get("$x_char"), local.get("$y_char"))))
          .then(wasm.return(local.get("$result"))),

        local.set("$i", i32.add(local.get("$i"), i32.const(1))),

        wasm.br("$loop")
      )
    ),

    wasm.return(i32.sub(local.get("$y_len"), local.get("$x_len")))
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
          i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.STRING))
        )
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
              i32.wrap_i64(local.get("$y_val"))
            )
        ),

        wasm
          .block("$eq")
          .body(
            wasm
              .block("$neq")
              .body(
                wasm
                  .block("$lt")
                  .body(
                    wasm
                      .block("$lte")
                      .body(
                        wasm
                          .block("$gt")
                          .body(
                            wasm
                              .block("$gte")
                              .body(wasm.br_table(local.get("$op"), "$eq", "$neq", "$lt", "$lte", "$gt", "$gte")),
                            wasm.return(wasm.call(MAKE_BOOL_FX).args(i32.ge_s(local.get("$x_tag"), i32.const(0))))
                          ),
                        wasm.return(wasm.call(MAKE_BOOL_FX).args(i32.gt_s(local.get("$x_tag"), i32.const(0))))
                      ),
                    wasm.return(wasm.call(MAKE_BOOL_FX).args(i32.le_s(local.get("$x_tag"), i32.const(0))))
                  ),
                wasm.return(wasm.call(MAKE_BOOL_FX).args(i32.lt_s(local.get("$x_tag"), i32.const(0))))
              ),
            wasm.return(wasm.call(MAKE_BOOL_FX).args(i32.ne(local.get("$x_tag"), i32.const(0))))
          ),
        wasm.return(wasm.call(MAKE_BOOL_FX).args(i32.eqz(local.get("$x_tag"))))
      ),

    // if either are bool, convert to int
    wasm.if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.BOOL))).then(local.set("$x_tag", i32.const(TYPE_TAG.INT))),
    wasm.if(i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.BOOL))).then(local.set("$y_tag", i32.const(TYPE_TAG.INT))),

    // if both int, use int comparison
    wasm
      .if(
        i32.and(
          i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.INT)),
          i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.INT))
        )
      )
      .then(
        wasm
          .block("$eq")
          .body(
            wasm
              .block("$neq")
              .body(
                wasm
                  .block("$lt")
                  .body(
                    wasm
                      .block("$lte")
                      .body(
                        wasm
                          .block("$gt")
                          .body(
                            wasm
                              .block("$gte")
                              .body(wasm.br_table(local.get("$op"), "$eq", "$neq", "$lt", "$lte", "$gt", "$gte")),
                            wasm.return(
                              wasm.call(MAKE_BOOL_FX).args(i64.ge_s(local.get("$x_val"), local.get("$y_val")))
                            )
                          ),
                        wasm.return(wasm.call(MAKE_BOOL_FX).args(i64.gt_s(local.get("$x_val"), local.get("$y_val"))))
                      ),
                    wasm.return(wasm.call(MAKE_BOOL_FX).args(i64.le_s(local.get("$x_val"), local.get("$y_val"))))
                  ),
                wasm.return(wasm.call(MAKE_BOOL_FX).args(i64.lt_s(local.get("$x_val"), local.get("$y_val"))))
              ),
            wasm.return(wasm.call(MAKE_BOOL_FX).args(i64.ne(local.get("$x_val"), local.get("$y_val"))))
          ),
        wasm.return(wasm.call(MAKE_BOOL_FX).args(i64.eq(local.get("$x_val"), local.get("$y_val"))))
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
          i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.FLOAT))
        )
      )
      .then(
        wasm
          .block("$eq")
          .body(
            wasm
              .block("$neq")
              .body(
                wasm
                  .block("$lt")
                  .body(
                    wasm
                      .block("$lte")
                      .body(
                        wasm
                          .block("$gt")
                          .body(
                            wasm
                              .block("$gte")
                              .body(wasm.br_table(local.get("$op"), "$eq", "$neq", "$lt", "$lte", "$gt", "$gte")),
                            wasm.return(wasm.call(MAKE_BOOL_FX).args(f64.ge(local.get("$a"), local.get("$c"))))
                          ),
                        wasm.return(wasm.call(MAKE_BOOL_FX).args(f64.gt(local.get("$a"), local.get("$c"))))
                      ),
                    wasm.return(wasm.call(MAKE_BOOL_FX).args(f64.le(local.get("$a"), local.get("$c"))))
                  ),
                wasm.return(wasm.call(MAKE_BOOL_FX).args(f64.lt(local.get("$a"), local.get("$c"))))
              ),
            wasm.return(wasm.call(MAKE_BOOL_FX).args(f64.eq(local.get("$a"), local.get("$c"))))
          )
      ),

    // else, if either are complex, load complex from memory and set float locals (default 0)
    wasm
      .if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.FLOAT)))
      .then(local.set("$x_tag", i32.const(TYPE_TAG.COMPLEX)))
      .else(
        local.set("$a", f64.load(i32.wrap_i64(local.get("$x_val")))),
        local.set("$b", f64.load(i32.add(i32.wrap_i64(local.get("$x_val")), i32.const(8))))
      ),
    wasm
      .if(i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.FLOAT)))
      .then(local.set("$y_tag", i32.const(TYPE_TAG.COMPLEX)))
      .else(
        local.set("$c", f64.load(i32.wrap_i64(local.get("$y_val")))),
        local.set("$d", f64.load(i32.add(i32.wrap_i64(local.get("$y_val")), i32.const(8))))
      ),

    // if both complex, compare real and imaginary parts. only ==, !=
    wasm
      .if(
        i32.and(
          i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.COMPLEX)),
          i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.COMPLEX))
        )
      )
      .then(
        wasm
          .if(i32.eq(local.get("$op"), i32.const(COMPARISON_OP_TAG.EQ)))
          .then(
            wasm.return(
              wasm
                .call(MAKE_BOOL_FX)
                .args(i32.and(f64.eq(local.get("$a"), local.get("$c")), f64.eq(local.get("$b"), local.get("$d"))))
            )
          )
          .else(
            wasm
              .if(i32.eq(local.get("$op"), i32.const(COMPARISON_OP_TAG.NEQ)))
              .then(
                wasm.return(
                  wasm
                    .call(MAKE_BOOL_FX)
                    .args(i32.or(f64.ne(local.get("$a"), local.get("$c")), f64.ne(local.get("$b"), local.get("$d"))))
                )
              )
              .else(wasm.call("$_log_error").args(i32.const(ERROR_MAP.COMPLEX_COMPARISON[0])), wasm.unreachable())
          )
      ),

    // else, unreachable
    wasm.call("$_log_error").args(i32.const(ERROR_MAP.COMPARE_OP_UNKNOWN_TYPE[0])),
    wasm.unreachable()
  );

// *3*4 because each variable has a tag and payload = 3 words = 12 bytes; +4 because parentEnv is stored at start of env
// TODO: memory.fill with unbound tag instead of loop
export const ALLOC_ENV_FX = wasm
  .func("$_alloc_env")
  .params({ $size: i32, $parent: i32 })
  .body(
    global.set(CURR_ENV, global.get(HEAP_PTR)),
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
            wasm.br("$loop")
          )
      )
  );

export const PRE_APPLY_FX = wasm
  .func("$_pre_apply")
  .params({ $tag: i32, $val: i64, $arity: i32 })
  .results(i32, i64)
  .body(
    wasm
      .if(i32.ne(local.get("$tag"), i32.const(TYPE_TAG.CLOSURE)))
      .then(wasm.call("$_log_error").args(i32.const(ERROR_MAP.CALL_NOT_FX[0])), wasm.unreachable()),

    wasm
      .if(
        i32.ne(i32.and(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(40))), i32.const(255)), local.get("$arity"))
      )
      .then(wasm.call("$_log_error").args(i32.const(ERROR_MAP.FUNC_WRONG_ARITY[0])), wasm.unreachable()),

    wasm
      .call(ALLOC_ENV_FX)
      .args(
        i32.and(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(32))), i32.const(255)),
        i32.wrap_i64(local.get("$val"))
      ),
    local.get("$tag"),
    local.get("$val")
  );

export const APPLY_FX_NAME = "$_apply";
export const applyFuncFactory = (bodies: WasmInstruction[][]) =>
  wasm
    .func(APPLY_FX_NAME)
    .params({ $return_env: i32, $tag: i32, $val: i64 })
    .results(i32, i64)
    .body(
      ...wasm.buildBrTableBlocks(
        wasm.br_table(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(48))), ...Array(bodies.length).keys()),
        ...bodies.map((body) => [
          ...body,
          wasm.return(wasm.call(MAKE_NONE_FX), global.set(CURR_ENV, local.get("$return_env"))),
        ])
      )
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
          i32.load(i32.add(i32.add(local.get("$env"), i32.const(4)), i32.mul(local.get("$index"), i32.const(12))))
        ),
        wasm
          .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.UNBOUND)))
          .then(wasm.call("$_log_error").args(i32.const(ERROR_MAP.UNBOUND[0])), wasm.unreachable()),

        wasm.return(
          local.get("$tag"),
          i64.load(i32.add(i32.add(local.get("$env"), i32.const(8)), i32.mul(local.get("$index"), i32.const(12))))
        )
      ),

      local.set("$env", i32.load(local.get("$env"))),
      local.set("$depth", i32.sub(local.get("$depth"), i32.const(1))),
      wasm.br("$loop")
    ),

    wasm.unreachable()
  );

export const SET_LEX_ADDR_FX = wasm
  .func("$_set_lex_addr")
  .params({ $depth: i32, $index: i32, $tag: i32, $payload: i64 })
  .locals({ $env: i32 })
  .body(
    local.set("$env", global.get(CURR_ENV)),

    wasm.loop("$loop").body(
      wasm
        .if(i32.eqz(local.get("$depth")))
        .then(
          i32.store(
            i32.add(i32.add(local.get("$env"), i32.const(4)), i32.mul(local.get("$index"), i32.const(12))),
            local.get("$tag")
          ),
          i64.store(
            i32.add(i32.add(local.get("$env"), i32.const(8)), i32.mul(local.get("$index"), i32.const(12))),
            local.get("$payload")
          ),
          wasm.return()
        ),

      local.set("$env", i32.load(local.get("$env"))),
      local.set("$depth", i32.sub(local.get("$depth"), i32.const(1))),
      wasm.br("$loop")
    ),

    wasm.unreachable()
  );

export const nativeFunctions = [
  MAKE_INT_FX,
  MAKE_FLOAT_FX,
  MAKE_COMPLEX_FX,
  MAKE_BOOL_FX,
  MAKE_STRING_FX,
  MAKE_CLOSURE_FX,
  MAKE_NONE_FX,
  MAKE_PAIR_FX,
  GET_PAIR_HEAD_FX,
  GET_PAIR_TAIL_FX,
  SET_PAIR_HEAD_FX,
  SET_PAIR_TAIL_FX,
  NEG_FX,
  ARITHMETIC_OP_FX,
  STRING_COMPARE_FX,
  COMPARISON_OP_FX,
  ALLOC_ENV_FX,
  PRE_APPLY_FX,
  GET_LEX_ADDR_FX,
  SET_LEX_ADDR_FX,
  LOG_FX,
];
