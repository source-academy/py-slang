import { i32, i64, local, memory, wasm } from "@sourceacademy/wasm-util";
import { IS_TAG_GCABLE, MALLOC_FX } from "./gc";
import { ERROR_MAP, GC_OBJECT_HEADER_SIZE, TYPE_TAG, getErrorIndex } from "./metadata";
import {
  POP_SHADOW_STACK_FX,
  PUSH_SHADOW_STACK_FX,
  SILENT_PUSH_SHADOW_STACK_FX,
} from "./shadowStack";
import { MAKE_BOOL_FX, MAKE_INT_FX } from "./values";

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
        i64.or(
          i64.shl(i64.extend_i32_u(local.get("$ptr")), i64.const(32)),
          i64.extend_i32_u(local.get("$len")),
        ),
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
        i64.or(
          i64.shl(i64.extend_i32_u(local.get("$ptr")), i64.const(32)),
          i64.extend_i32_u(local.get("$len")),
        ),
      ),
  );

export const LIST_SLOT_TAG_LOAD_FX = wasm
  .func("$_list_slot_tag_load")
  .params({ $list_val: i64, $index: i32 })
  .results(i32)
  .body(
    i32.load(
      i32.add(
        i32.add(
          i32.wrap_i64(i64.shr_u(local.get("$list_val"), i64.const(32))),
          i32.const(GC_OBJECT_HEADER_SIZE),
        ),
        i32.mul(local.get("$index"), i32.const(12)),
      ),
    ),
  );

export const LIST_SLOT_VAL_LOAD_FX = wasm
  .func("$_list_slot_val_load")
  .params({ $list_val: i64, $index: i32 })
  .results(i64)
  .body(
    i64.load(
      i32.add(
        i32.add(
          i32.add(
            i32.wrap_i64(i64.shr_u(local.get("$list_val"), i64.const(32))),
            i32.const(GC_OBJECT_HEADER_SIZE),
          ),
          i32.mul(local.get("$index"), i32.const(12)),
        ),
        i32.const(4),
      ),
    ),
  );

export const LIST_SLOT_STORE_FX = wasm
  .func("$_list_slot_store")
  .params({ $list_val: i64, $index: i32, $tag: i32, $val: i64 })
  .body(
    i32.store(
      i32.add(
        i32.add(
          i32.wrap_i64(i64.shr_u(local.get("$list_val"), i64.const(32))),
          i32.const(GC_OBJECT_HEADER_SIZE),
        ),
        i32.mul(local.get("$index"), i32.const(12)),
      ),
      local.get("$tag"),
    ),
    i64.store(
      i32.add(
        i32.add(
          i32.add(
            i32.wrap_i64(i64.shr_u(local.get("$list_val"), i64.const(32))),
            i32.const(GC_OBJECT_HEADER_SIZE),
          ),
          i32.mul(local.get("$index"), i32.const(12)),
        ),
        i32.const(4),
      ),
      local.get("$val"),
    ),
  );

export const GET_LIST_ELEMENT_FX = wasm
  .func("$_get_list_element")
  .params({ $tag: i32, $val: i64, $index_tag: i32, $index_val: i64 })
  .locals({ $elem_tag: i32, $elem_val: i64, $index: i32 })
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
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.INDEX_NOT_INT))),
        wasm.unreachable(),
      ),

    // Negative indices wrap: adding the list's length once is sufficient for
    // any index >= -length (docs/specs/python_typing_middle_34.tex). An index
    // still negative afterwards (too negative to wrap) stays negative, and
    // the unsigned OOB check below still correctly rejects it (a negative i64
    // wraps to a huge unsigned value when truncated to i32).
    wasm
      .if(i64.lt_s(local.get("$index_val"), i64.const(0)))
      .then(
        local.set(
          "$index_val",
          i64.add(local.get("$index_val"), i64.extend_i32_u(i32.wrap_i64(local.get("$val")))),
        ),
      ),

    wasm
      .if(i32.ge_u(i32.wrap_i64(local.get("$index_val")), i32.wrap_i64(local.get("$val"))))
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.LIST_OUT_OF_RANGE))),
        wasm.unreachable(),
      ),

    wasm.call(POP_SHADOW_STACK_FX),
    wasm.raw`(local.set $val) (local.set $tag)`,

    local.set("$index", i32.wrap_i64(local.get("$index_val"))),

    local.tee(
      "$elem_tag",
      wasm.call(LIST_SLOT_TAG_LOAD_FX).args(local.get("$val"), local.get("$index")),
    ),
    local.tee(
      "$elem_val",
      wasm.call(LIST_SLOT_VAL_LOAD_FX).args(local.get("$val"), local.get("$index")),
    ),

    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$elem_tag")))
      .then(
        wasm.call(SILENT_PUSH_SHADOW_STACK_FX).args(local.get("$elem_tag"), local.get("$elem_val")),
      ),
  );

export const DEBUG_GET_LIST_ELEMENT_FX = wasm
  .func("$_debug_get_list_element")
  .params({ $tag: i32, $val: i64, $index: i32 })
  .locals({ $elem_tag: i32, $elem_val: i64 })
  .results(i32, i64)
  .body(
    local.tee(
      "$elem_tag",
      wasm.call(LIST_SLOT_TAG_LOAD_FX).args(local.get("$val"), local.get("$index")),
    ),
    local.tee(
      "$elem_val",
      wasm.call(LIST_SLOT_VAL_LOAD_FX).args(local.get("$val"), local.get("$index")),
    ),

    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$elem_tag")))
      .then(
        wasm.call(SILENT_PUSH_SHADOW_STACK_FX).args(local.get("$elem_tag"), local.get("$elem_val")),
      ),
  );

export const SET_LIST_ELEMENT_FX = wasm
  .func("$_set_list_element")
  .params({
    $list_tag: i32,
    $list_val: i64,
    $index_tag: i32,
    $index_val: i64,
    $tag: i32,
    $val: i64,
  })
  .locals({ $index: i32 })
  .body(
    wasm
      .if(i32.eq(local.get("$list_tag"), i32.const(TYPE_TAG.TUPLE)))
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.SET_ELEMENT_TUPLE))),
        wasm.unreachable(),
      ),

    wasm
      .if(i32.ne(local.get("$list_tag"), i32.const(TYPE_TAG.LIST)))
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.SET_ELEMENT_NOT_LIST))),
        wasm.unreachable(),
      ),

    wasm
      .if(i32.ne(local.get("$index_tag"), i32.const(TYPE_TAG.INT)))
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.INDEX_NOT_INT))),
        wasm.unreachable(),
      ),

    // Negative indices wrap -- see GET_LIST_ELEMENT_FX's identical check above.
    wasm
      .if(i64.lt_s(local.get("$index_val"), i64.const(0)))
      .then(
        local.set(
          "$index_val",
          i64.add(local.get("$index_val"), i64.extend_i32_u(i32.wrap_i64(local.get("$list_val")))),
        ),
      ),

    wasm
      .if(i32.ge_u(i32.wrap_i64(local.get("$index_val")), i32.wrap_i64(local.get("$list_val"))))
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.SET_OUT_OF_RANGE))),
        wasm.unreachable(),
      ),

    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$tag")))
      .then(wasm.call(POP_SHADOW_STACK_FX), wasm.raw`(local.set $val) (local.set $tag)`),

    wasm.call(POP_SHADOW_STACK_FX),
    wasm.raw`(local.set $list_val) (local.set $list_tag)`,

    local.set("$index", i32.wrap_i64(local.get("$index_val"))),

    wasm
      .call(LIST_SLOT_STORE_FX)
      .args(local.get("$list_val"), local.get("$index"), local.get("$tag"), local.get("$val")),
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
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.GET_LENGTH_NOT_LIST))),
        wasm.unreachable(),
      ),

    wasm.call(POP_SHADOW_STACK_FX),
    wasm.raw`(local.set $val) (local.set $tag)`,

    wasm.call(MAKE_INT_FX).args(i64.and(local.get("$val"), i64.const(0xffffffff))),
  );

export const GEN_LIST_FX = wasm
  .func("$_gen_list")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(i32.ne(local.get("$tag"), i32.const(TYPE_TAG.INT)))
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.GEN_LIST_NOT_INT))),
        wasm.unreachable(),
      ),

    wasm
      .call(PUSH_SHADOW_STACK_FX)
      .args(
        wasm
          .call(MAKE_LIST_FX)
          .args(
            wasm
              .call(MALLOC_FX)
              .args(
                i32.add(
                  i32.mul(i32.wrap_i64(local.get("$val")), i32.const(12)),
                  i32.const(GC_OBJECT_HEADER_SIZE),
                ),
              ),
            i32.wrap_i64(local.get("$val")),
          ),
      ),
  );

/**
 * `list * int` / `int * list` (docs/specs/python_typing_middle_34.tex): a
 * new list whose slots are `$val`'s elements repeated `count` times, or `[]`
 * for `count <= 0`. Each repetition is a single `memory.copy` of the whole
 * source slot array -- copying the raw (tag, val) pairs already gives the
 * required shallow-copy semantics, since a GC'able element's `val` is just a
 * pointer: duplicating the pair duplicates the reference, not the referent
 * (so `x = [[1,2]] * 4` makes `x[0] is x[1]` true, matching real Python).
 */
export const LIST_REPEAT_FX = wasm
  .func("$_list_repeat")
  .params({ $tag: i32, $val: i64, $count_tag: i32, $count_val: i64 })
  .locals({ $src_len: i32, $count: i32, $new_len: i32, $new_ptr: i32, $i: i32 })
  .results(i32, i64)
  .body(
    wasm
      .if(i32.ne(local.get("$count_tag"), i32.const(TYPE_TAG.INT)))
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.MULTIPLY_LIST_NOT_INT))),
        wasm.unreachable(),
      ),

    local.set("$src_len", i32.wrap_i64(local.get("$val"))),
    // Check the sign on the full 64-bit value before truncating to i32 --
    // wrapping first (as this used to) turns any large positive count whose
    // low 32 bits have the sign bit set (e.g. 3_000_000_000n) into a
    // spuriously "negative" i32, silently clamping a valid huge count to [].
    local.set(
      "$count",
      wasm.select(
        i32.const(0),
        i32.wrap_i64(local.get("$count_val")),
        i64.lt_s(local.get("$count_val"), i64.const(0)),
      ),
    ),
    local.set("$new_len", i32.mul(local.get("$src_len"), local.get("$count"))),

    local.set(
      "$new_ptr",
      wasm
        .call(MALLOC_FX)
        .args(
          i32.add(i32.mul(local.get("$new_len"), i32.const(12)), i32.const(GC_OBJECT_HEADER_SIZE)),
        ),
    ),

    // Refetch the source list's (possibly GC-relocated) pointer only now,
    // after the allocation above -- matches ARITHMETIC_OP_FX's string
    // concatenation, the other malloc-then-copy-from-operands case in this
    // codebase.
    wasm.call(POP_SHADOW_STACK_FX),
    wasm.raw`(local.set $val) (local.set $tag)`,

    local.set("$i", i32.const(0)),
    wasm
      .loop("$list_repeat_loop")
      .body(
        wasm
          .if(i32.lt_u(local.get("$i"), local.get("$count")))
          .then(
            memory.copy(
              i32.add(
                i32.add(local.get("$new_ptr"), i32.const(GC_OBJECT_HEADER_SIZE)),
                i32.mul(i32.mul(local.get("$i"), local.get("$src_len")), i32.const(12)),
              ),
              i32.add(
                i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(32))),
                i32.const(GC_OBJECT_HEADER_SIZE),
              ),
              i32.mul(local.get("$src_len"), i32.const(12)),
            ),
            local.set("$i", i32.add(local.get("$i"), i32.const(1))),
            wasm.br("$list_repeat_loop"),
          ),
      ),

    wasm.call(MAKE_LIST_FX).args(local.get("$new_ptr"), local.get("$new_len")),
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
