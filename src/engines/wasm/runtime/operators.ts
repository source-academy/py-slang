import { f64, global, i32, i64, local, memory, wasm } from "@sourceacademy/wasm-util";
import { MALLOC_FX } from "./gc";
import { DATA_END, ERROR_MAP, GC_OBJECT_HEADER_SIZE, TYPE_TAG, getErrorIndex } from "./metadata";
import { POP_SHADOW_STACK_FX } from "./shadowStack";
import { BOOLISE_FX } from "./stdlib";
import {
  MAKE_BOOL_FX,
  MAKE_COMPLEX_FX,
  MAKE_FLOAT_FX,
  MAKE_INT_FX,
  MAKE_STRING_FX,
} from "./values";

// unary operation functions
export const NEG_FX = wasm
  .func("$_py_neg")
  .params({ $x_tag: i32, $x_val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.INT)))
      .then(
        wasm.return(
          wasm
            .call(MAKE_INT_FX)
            .args(i64.add(i64.xor(local.get("$x_val"), i64.const(-1)), i64.const(1))),
        ),
      ),

    wasm
      .if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.FLOAT)))
      .then(
        wasm.return(
          wasm.call(MAKE_FLOAT_FX).args(f64.neg(f64.reinterpret_i64(local.get("$x_val")))),
        ),
      ),

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
        local.set(
          "$str_ptr",
          wasm
            .call(MALLOC_FX)
            .args(
              i32.add(
                i32.add(i32.wrap_i64(local.get("$x_val")), i32.wrap_i64(local.get("$y_val"))),
                i32.const(GC_OBJECT_HEADER_SIZE),
              ),
            ),
        ),

        wasm.call(POP_SHADOW_STACK_FX),
        wasm.raw`(local.set $y_val) (local.set $y_tag)`,
        wasm.call(POP_SHADOW_STACK_FX),
        wasm.raw`(local.set $x_val) (local.set $x_tag)`,

        i64.store(local.get("$str_ptr"), i64.const(0)),
        memory.copy(
          i32.add(local.get("$str_ptr"), i32.const(GC_OBJECT_HEADER_SIZE)),
          i32.add(
            i32.wrap_i64(i64.shr_u(local.get("$x_val"), i64.const(32))),
            wasm.select(
              i32.const(0),
              i32.const(GC_OBJECT_HEADER_SIZE),
              i32.lt_u(
                i32.wrap_i64(i64.shr_u(local.get("$x_val"), i64.const(32))),
                global.get(DATA_END),
              ),
            ),
          ),
          i32.wrap_i64(local.get("$x_val")),
        ),
        memory.copy(
          i32.add(
            i32.add(local.get("$str_ptr"), i32.const(GC_OBJECT_HEADER_SIZE)),
            i32.wrap_i64(local.get("$x_val")),
          ),
          i32.add(
            i32.wrap_i64(i64.shr_u(local.get("$y_val"), i64.const(32))),
            wasm.select(
              i32.const(0),
              i32.const(GC_OBJECT_HEADER_SIZE),
              i32.lt_u(
                i32.wrap_i64(i64.shr_u(local.get("$y_val"), i64.const(32))),
                global.get(DATA_END),
              ),
            ),
          ),
          i32.wrap_i64(local.get("$y_val")),
        ),

        wasm.return(
          wasm
            .call(MAKE_STRING_FX)
            .args(
              local.get("$str_ptr"),
              i32.add(i32.wrap_i64(local.get("$x_val")), i32.wrap_i64(local.get("$y_val"))),
            ),
        ),
      ),

    // if either's bool, convert to int
    wasm
      .if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.BOOL)))
      .then(local.set("$x_tag", i32.const(TYPE_TAG.INT))),
    wasm
      .if(i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.BOOL)))
      .then(local.set("$y_tag", i32.const(TYPE_TAG.INT))),

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
          wasm.return(
            wasm.call(MAKE_INT_FX).args(i64.add(local.get("$x_val"), local.get("$y_val"))),
          ),
          wasm.return(
            wasm.call(MAKE_INT_FX).args(i64.sub(local.get("$x_val"), local.get("$y_val"))),
          ),
          wasm.return(
            wasm.call(MAKE_INT_FX).args(i64.mul(local.get("$x_val"), local.get("$y_val"))),
          ),
          wasm.return(
            wasm
              .call(MAKE_FLOAT_FX)
              .args(
                f64.div(
                  f64.convert_i64_s(local.get("$x_val")),
                  f64.convert_i64_s(local.get("$y_val")),
                ),
              ),
          ),
        ),
      ),

    // else, if either's int, convert to float and set float locals
    wasm
      .if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.INT)))
      .then(
        local.set("$a", f64.convert_i64_s(local.get("$x_val"))),
        local.set("$x_tag", i32.const(TYPE_TAG.FLOAT)),
      )
      .else(local.set("$a", f64.reinterpret_i64(local.get("$x_val")))),

    wasm
      .if(i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.INT)))
      .then(
        local.set("$c", f64.convert_i64_s(local.get("$y_val"))),
        local.set("$y_tag", i32.const(TYPE_TAG.FLOAT)),
      )
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
            wasm
              .call("$_log_error")
              .args(i32.const(getErrorIndex(ERROR_MAP.ARITH_OP_UNKNOWN_TYPE))),
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
            wasm
              .call("$_log_error")
              .args(i32.const(getErrorIndex(ERROR_MAP.ARITH_OP_UNKNOWN_TYPE))),
            wasm.unreachable(),
          ),
      ),

    // perform complex operations
    ...wasm.buildBrTableBlocks(
      wasm.br_table(local.get("$op"), "$add", "$sub", "$mul", "$div"),
      wasm.return(
        wasm
          .call(MAKE_COMPLEX_FX)
          .args(
            f64.add(local.get("$a"), local.get("$c")),
            f64.add(local.get("$b"), local.get("$d")),
          ),
      ),
      wasm.return(
        wasm
          .call(MAKE_COMPLEX_FX)
          .args(
            f64.sub(local.get("$a"), local.get("$c")),
            f64.sub(local.get("$b"), local.get("$d")),
          ),
      ),
      // (a+bi)*(c+di) = (ac-bd) + (ad+bc)i
      wasm.return(
        wasm
          .call(MAKE_COMPLEX_FX)
          .args(
            f64.sub(
              f64.mul(local.get("$a"), local.get("$c")),
              f64.mul(local.get("$b"), local.get("$d")),
            ),
            f64.add(
              f64.mul(local.get("$b"), local.get("$c")),
              f64.mul(local.get("$a"), local.get("$d")),
            ),
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
                f64.add(
                  f64.mul(local.get("$a"), local.get("$c")),
                  f64.mul(local.get("$b"), local.get("$d")),
                ),
                f64.add(
                  f64.mul(local.get("$c"), local.get("$c")),
                  f64.mul(local.get("$d"), local.get("$d")),
                ),
              ),
            ),
            f64.div(
              f64.sub(
                f64.mul(local.get("$b"), local.get("$c")),
                f64.mul(local.get("$a"), local.get("$d")),
              ),
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
      wasm.select(
        local.get("$x_len"),
        local.get("$y_len"),
        i32.lt_s(local.get("$x_len"), local.get("$y_len")),
      ),
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
          "$x_tag",
          wasm
            .call(STRING_COMPARE_FX)
            .args(
              i32.add(
                i32.wrap_i64(i64.shr_u(local.get("$x_val"), i64.const(32))),
                wasm.select(
                  i32.const(0),
                  i32.const(GC_OBJECT_HEADER_SIZE),
                  i32.lt_u(
                    i32.wrap_i64(i64.shr_u(local.get("$x_val"), i64.const(32))),
                    global.get(DATA_END),
                  ),
                ),
              ),
              i32.wrap_i64(local.get("$x_val")),
              i32.add(
                i32.wrap_i64(i64.shr_u(local.get("$y_val"), i64.const(32))),
                wasm.select(
                  i32.const(0),
                  i32.const(GC_OBJECT_HEADER_SIZE),
                  i32.lt_u(
                    i32.wrap_i64(i64.shr_u(local.get("$y_val"), i64.const(32))),
                    global.get(DATA_END),
                  ),
                ),
              ),
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
    wasm
      .if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.BOOL)))
      .then(local.set("$x_tag", i32.const(TYPE_TAG.INT))),
    wasm
      .if(i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.BOOL)))
      .then(local.set("$y_tag", i32.const(TYPE_TAG.INT))),

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
          wasm.return(
            wasm.call(MAKE_BOOL_FX).args(i64.eq(local.get("$x_val"), local.get("$y_val"))),
          ),
          wasm.return(
            wasm.call(MAKE_BOOL_FX).args(i64.ne(local.get("$x_val"), local.get("$y_val"))),
          ),
          wasm.return(
            wasm.call(MAKE_BOOL_FX).args(i64.lt_s(local.get("$x_val"), local.get("$y_val"))),
          ),
          wasm.return(
            wasm.call(MAKE_BOOL_FX).args(i64.le_s(local.get("$x_val"), local.get("$y_val"))),
          ),
          wasm.return(
            wasm.call(MAKE_BOOL_FX).args(i64.gt_s(local.get("$x_val"), local.get("$y_val"))),
          ),
          wasm.return(
            wasm.call(MAKE_BOOL_FX).args(i64.ge_s(local.get("$x_val"), local.get("$y_val"))),
          ),
        ),
      ),

    // else, if either are int, convert to float and set float locals
    wasm
      .if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.INT)))
      .then(
        local.set("$a", f64.convert_i64_s(local.get("$x_val"))),
        local.set("$x_tag", i32.const(TYPE_TAG.FLOAT)),
      )
      .else(local.set("$a", f64.reinterpret_i64(local.get("$x_val")))),
    wasm
      .if(i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.INT)))
      .then(
        local.set("$c", f64.convert_i64_s(local.get("$y_val"))),
        local.set("$y_tag", i32.const(TYPE_TAG.FLOAT)),
      )
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
                .args(
                  i32.and(
                    f64.eq(local.get("$a"), local.get("$c")),
                    f64.eq(local.get("$b"), local.get("$d")),
                  ),
                ),
            ),
          )
          .else(
            wasm
              .if(i32.eq(local.get("$op"), i32.const(COMPARISON_OP_TAG.NEQ)))
              .then(
                wasm.return(
                  wasm
                    .call(MAKE_BOOL_FX)
                    .args(
                      i32.or(
                        f64.ne(local.get("$a"), local.get("$c")),
                        f64.ne(local.get("$b"), local.get("$d")),
                      ),
                    ),
                ),
              )
              .else(
                wasm
                  .call("$_log_error")
                  .args(i32.const(getErrorIndex(ERROR_MAP.COMPLEX_COMPARISON))),
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

export const BOOL_NOT_FX = wasm
  .func("$_bool_not")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    i32.const(TYPE_TAG.BOOL),
    i64.extend_i32_u(i64.eqz(wasm.call(BOOLISE_FX).args(local.get("$tag"), local.get("$val")))),
  );
