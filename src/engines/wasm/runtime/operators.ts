import {
  f64,
  global,
  i32,
  i64,
  local,
  memory,
  wasm,
  type WasmInstruction,
} from "@sourceacademy/wasm-util";
import { MALLOC_FX } from "./gc";
import { LIST_SLOT_TAG_LOAD_FX, LIST_SLOT_VAL_LOAD_FX } from "./list";
import {
  CHAPTER,
  DATA_END,
  ERROR_MAP,
  GC_OBJECT_HEADER_SIZE,
  TYPE_TAG,
  getErrorIndex,
} from "./metadata";
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

export const ARITHMETIC_OP_TAG = {
  ADD: 0,
  SUB: 1,
  MUL: 2,
  DIV: 3,
  FLOORDIV: 4,
  MOD: 5,
  POW: 6,
} as const;
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

    // bool is never a valid arithmetic operand, at every chapter (see
    // docs/specs/python_typing_front.tex: NUMERIC excludes bool; mirrors
    // CSE's evaluateBinaryExpression, which never coerces bool for +,-,*,/,
    // //,%,** -- only for ordering comparisons, and only at §3/§4).
    wasm
      .if(
        i32.or(
          i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.BOOL)),
          i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.BOOL)),
        ),
      )
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.BOOL_OPERAND_NOT_SUPPORTED))),
        wasm.unreachable(),
      ),

    // //, %, ** are delegated to a host import that mirrors CSE's exact
    // numeric branches (see hostImports.ts's arith_ext): int floor-div/mod
    // need Python's floor-toward-negative-infinity semantics (not i64's
    // truncating div_s/rem_s), and ** needs arbitrary-precision bigint
    // exponentiation plus PyComplexNumber's general complex-power formula
    // (log/exp/atan2/cos/sin -- transcendental functions with no native WASM
    // instruction) -- reusing CSE's own implementations guarantees bit-for-bit
    // parity instead of a second, independently-derived formula that could
    // drift from it.
    wasm
      .if(
        i32.or(
          i32.eq(local.get("$op"), i32.const(ARITHMETIC_OP_TAG.FLOORDIV)),
          i32.or(
            i32.eq(local.get("$op"), i32.const(ARITHMETIC_OP_TAG.MOD)),
            i32.eq(local.get("$op"), i32.const(ARITHMETIC_OP_TAG.POW)),
          ),
        ),
      )
      .then(
        wasm.return(
          wasm
            .call("$_host_arith_ext")
            .args(
              local.get("$op"),
              local.get("$x_tag"),
              local.get("$x_val"),
              local.get("$y_tag"),
              local.get("$y_val"),
            ),
        ),
      ),

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
      [
        local.set(
          "$denom",
          f64.add(
            f64.mul(local.get("$c"), local.get("$c")),
            f64.mul(local.get("$d"), local.get("$d")),
          ),
        ),
        wasm.return(
          wasm
            .call(MAKE_COMPLEX_FX)
            .args(
              f64.div(
                f64.add(
                  f64.mul(local.get("$a"), local.get("$c")),
                  f64.mul(local.get("$b"), local.get("$d")),
                ),
                local.get("$denom"),
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
      ],
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
  IS: 6,
  ISNOT: 7,
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

    wasm.return(i32.sub(local.get("$x_len"), local.get("$y_len"))),
  );

/**
 * `is`/`is not` (COMPARISON_OP_TAG.IS/ISNOT): identity, not structural equality.
 * Mirrors CSE's pyIdentical (see engines/cse/operators.ts): different tags are
 * never identical; same-tag values compare by their underlying value for
 * every scalar type (no int/bool cross-coercion, unlike `==`), by pointer for
 * lists/tuples, and None is always identical to None. Closures compare by
 * their packed (tag,arity,env_size,parent_env) representation, which is an
 * approximation of CPython's per-object identity: two separately evaluated
 * closures with identical arity/captured-environment happen to compare equal
 * here, unlike CSE's real per-object identity -- a known gap in the absence
 * of a distinct heap-allocated closure object to compare by pointer.
 */
function identityCheck(): WasmInstruction[] {
  return [
    wasm
      .if(i32.ne(local.get("$x_tag"), local.get("$y_tag")))
      .then(local.set("$is_result", i32.const(0)))
      .else(
        wasm
          .if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.NONE)))
          .then(local.set("$is_result", i32.const(1)))
          .else(
            wasm
              .if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.FLOAT)))
              .then(
                local.set(
                  "$is_result",
                  f64.eq(
                    f64.reinterpret_i64(local.get("$x_val")),
                    f64.reinterpret_i64(local.get("$y_val")),
                  ),
                ),
              )
              .else(
                wasm
                  .if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.COMPLEX)))
                  .then(
                    local.set(
                      "$is_result",
                      i32.and(
                        f64.eq(
                          f64.load(i32.wrap_i64(local.get("$x_val"))),
                          f64.load(i32.wrap_i64(local.get("$y_val"))),
                        ),
                        f64.eq(
                          f64.load(i32.add(i32.wrap_i64(local.get("$x_val")), i32.const(8))),
                          f64.load(i32.add(i32.wrap_i64(local.get("$y_val")), i32.const(8))),
                        ),
                      ),
                    ),
                  )
                  .else(
                    wasm
                      .if(i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.STRING)))
                      .then(
                        local.set(
                          "$is_result",
                          i32.eqz(
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
                        ),
                      )
                      // Ints, bools, lists/tuples and closures: identity is raw
                      // (tag already matched) value equality -- lists/tuples by
                      // pointer (no recursive structural comparison, unlike ==),
                      // closures by their packed representation (see doc comment).
                      .else(
                        local.set(
                          "$is_result",
                          i64.eq(local.get("$x_val"), local.get("$y_val")),
                        ),
                      ),
                  ),
              ),
          ),
      ),
    wasm.return(
      wasm
        .call(MAKE_BOOL_FX)
        .args(
          wasm.select(
            i32.eqz(local.get("$is_result")),
            local.get("$is_result"),
            i32.eq(local.get("$op"), i32.const(COMPARISON_OP_TAG.ISNOT)),
          ),
        ),
    ),
  ];
}

export const COMPARISON_OP_FX = wasm
  .func("$_py_compare_op")
  .params({ $x_tag: i32, $x_val: i64, $y_tag: i32, $y_val: i64, $op: i32 })
  .results(i32, i64)
  .locals({ $a: f64, $b: f64, $c: f64, $d: f64, $is_result: i32, $eq_result: i32 })
  .body(
    wasm
      .if(
        i32.or(
          i32.eq(local.get("$op"), i32.const(COMPARISON_OP_TAG.IS)),
          i32.eq(local.get("$op"), i32.const(COMPARISON_OP_TAG.ISNOT)),
        ),
      )
      .then(...identityCheck()),

    // Python §1/§2 restrictions the runtime alone can enforce (chapter-gated
    // static validators can't see values flowing through variables): `==`/`!=`
    // exclude bool and closures entirely (docs/specs/python_typing_middle_12.tex
    // -- mirrors CSE's excludedFromChapter12Equality), and ordering comparisons
    // exclude bool (bool only participates in ordering, as the int it is, from
    // §3/§4 -- mirrors CSE's isOrderable/asIntIfBool gating on variant >= 3).
    wasm
      .if(i32.lt_s(global.get(CHAPTER), i32.const(3)))
      .then(
        wasm
          .if(
            i32.or(
              i32.eq(local.get("$op"), i32.const(COMPARISON_OP_TAG.EQ)),
              i32.eq(local.get("$op"), i32.const(COMPARISON_OP_TAG.NEQ)),
            ),
          )
          .then(
            wasm
              .if(
                i32.or(
                  i32.or(
                    i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.BOOL)),
                    i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.CLOSURE)),
                  ),
                  i32.or(
                    i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.BOOL)),
                    i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.CLOSURE)),
                  ),
                ),
              )
              .then(
                wasm
                  .call("$_log_error")
                  .args(i32.const(getErrorIndex(ERROR_MAP.COMPARE_OP_UNKNOWN_TYPE))),
                wasm.unreachable(),
              ),
          ),
        wasm
          .if(
            i32.or(
              i32.or(
                i32.eq(local.get("$op"), i32.const(COMPARISON_OP_TAG.LT)),
                i32.eq(local.get("$op"), i32.const(COMPARISON_OP_TAG.LTE)),
              ),
              i32.or(
                i32.eq(local.get("$op"), i32.const(COMPARISON_OP_TAG.GT)),
                i32.eq(local.get("$op"), i32.const(COMPARISON_OP_TAG.GTE)),
              ),
            ),
          )
          .then(
            wasm
              .if(
                i32.or(
                  i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.BOOL)),
                  i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.BOOL)),
                ),
              )
              .then(
                wasm
                  .call("$_log_error")
                  .args(i32.const(getErrorIndex(ERROR_MAP.COMPARE_OP_UNKNOWN_TYPE))),
                wasm.unreachable(),
              ),
          ),
      ),

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

    // Remaining types reaching here (None, list/tuple, closures) only support
    // `==`/`!=` -- never ordering. Mismatched tags are simply unequal, as in
    // Python (structuralEquals: "if two types are different, they are not
    // equal"); same-tag list/tuple values compare structurally, recursively,
    // element-by-element (see LIST_STRUCT_EQ_FX); every other same-tag value
    // reaching here (None, closures) compares by its raw representation --
    // None always to itself, closures by their packed representation (the
    // same approximation of object identity `is` uses above).
    wasm
      .if(
        i32.or(
          i32.eq(local.get("$op"), i32.const(COMPARISON_OP_TAG.EQ)),
          i32.eq(local.get("$op"), i32.const(COMPARISON_OP_TAG.NEQ)),
        ),
      )
      .then(
        wasm
          .if(i32.ne(local.get("$x_tag"), local.get("$y_tag")))
          .then(local.set("$eq_result", i32.const(0)))
          .else(
            wasm
              .if(
                i32.or(
                  i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.LIST)),
                  i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.TUPLE)),
                ),
              )
              .then(
                local.set(
                  "$eq_result",
                  wasm.call("$_list_struct_eq").args(local.get("$x_val"), local.get("$y_val")),
                ),
              )
              .else(local.set("$eq_result", i64.eq(local.get("$x_val"), local.get("$y_val")))),
          ),
        wasm.return(
          wasm
            .call(MAKE_BOOL_FX)
            .args(
              wasm.select(
                i32.eqz(local.get("$eq_result")),
                local.get("$eq_result"),
                i32.eq(local.get("$op"), i32.const(COMPARISON_OP_TAG.NEQ)),
              ),
            ),
        ),
      ),

    // other operators (ordering) on None/list/tuple/closure: unreachable
    wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.COMPARE_OP_UNKNOWN_TYPE))),
    wasm.unreachable(),
  );

/**
 * Structural equality for list/tuple `==`/`!=` (see COMPARISON_OP_FX's
 * fallback above): same length, and every element pair recursively equal.
 * Recurses through COMPARISON_OP_FX itself (called by name, not by direct
 * reference -- this function is defined after it, and the two are mutually
 * recursive: list elements can themselves be lists) so nested lists, and
 * elements of every other type (string, numeric, complex, None, closures),
 * get exactly the same comparison logic already implemented there, with no
 * separate re-implementation to drift from it. Self-referential lists
 * without shared identity exhaust the call stack, mirroring CPython's
 * RecursionError on such comparisons (same as CSE's structuralEquals).
 */
export const LIST_STRUCT_EQ_FX = wasm
  .func("$_list_struct_eq")
  .params({ $x_val: i64, $y_val: i64 })
  .results(i32)
  .locals({
    $len_x: i32,
    $len_y: i32,
    $i: i32,
    $ex_tag: i32,
    $ex_val: i64,
    $ey_tag: i32,
    $ey_val: i64,
    $eq_tag: i32,
    $eq_val: i64,
  })
  .body(
    local.set("$len_x", i32.wrap_i64(local.get("$x_val"))),
    local.set("$len_y", i32.wrap_i64(local.get("$y_val"))),
    wasm
      .if(i32.ne(local.get("$len_x"), local.get("$len_y")))
      .then(wasm.return(i32.const(0))),

    wasm.loop("$loop").body(
      wasm
        .if(i32.ge_s(local.get("$i"), local.get("$len_x")))
        .then(wasm.return(i32.const(1))),

      local.set(
        "$ex_tag",
        wasm.call(LIST_SLOT_TAG_LOAD_FX).args(local.get("$x_val"), local.get("$i")),
      ),
      local.set(
        "$ex_val",
        wasm.call(LIST_SLOT_VAL_LOAD_FX).args(local.get("$x_val"), local.get("$i")),
      ),
      local.set(
        "$ey_tag",
        wasm.call(LIST_SLOT_TAG_LOAD_FX).args(local.get("$y_val"), local.get("$i")),
      ),
      local.set(
        "$ey_val",
        wasm.call(LIST_SLOT_VAL_LOAD_FX).args(local.get("$y_val"), local.get("$i")),
      ),

      wasm
        .call(COMPARISON_OP_FX)
        .args(
          local.get("$ex_tag"),
          local.get("$ex_val"),
          local.get("$ey_tag"),
          local.get("$ey_val"),
          i32.const(COMPARISON_OP_TAG.EQ),
        ),
      wasm.raw`(local.set $eq_val) (local.set $eq_tag)`,

      wasm.if(i64.eqz(local.get("$eq_val"))).then(wasm.return(i32.const(0))),

      local.set("$i", i32.add(local.get("$i"), i32.const(1))),
      wasm.br("$loop"),
    ),

    // Every path through the loop above returns explicitly; this is
    // structurally unreachable, but the function's declared (result i32)
    // still needs *something* after a void-typed loop statement to satisfy
    // validation (see NEG_FX/ARITHMETIC_OP_FX's identical trailing
    // unreachable() for the same reason).
    wasm.unreachable(),
  );

/**
 * `not`'s sole operand, and `and`/`or`'s *left* operand specifically, must be
 * an actual bool -- see docs/specs/python_typing_back.tex: `and`/`or`/`not`
 * are all typed `bool, any -> any` / `bool -> bool` (only the right operand
 * of `and`/`or` is `any`). Passes the (tag,val) pair through unchanged so
 * callers can use this as a transparent wrapper around the operand
 * expression, matching CSE's evaluateUnaryExpression / BOOL_OP instruction
 * handler, which reject a non-bool operand here outright (not a truthiness
 * shortcut like BOOLISE_FX, which is for contexts -- if/while conditions,
 * and/or's *right* operand's short-circuit test -- that spec any x truthy).
 */
export const CHECK_BOOL_FX = wasm
  .func("$_check_bool")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(i32.ne(local.get("$tag"), i32.const(TYPE_TAG.BOOL)))
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.EXPECTED_BOOL_OPERAND))),
        wasm.unreachable(),
      ),
    local.get("$tag"),
    local.get("$val"),
  );

export const BOOL_NOT_FX = wasm
  .func("$_bool_not")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    i32.const(TYPE_TAG.BOOL),
    i64.extend_i32_u(i64.eqz(wasm.call(BOOLISE_FX).args(local.get("$tag"), local.get("$val")))),
  );
