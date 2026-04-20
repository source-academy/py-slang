import { i32, i64, local, wasm } from "@sourceacademy/wasm-util";
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

    wasm
      .if(i32.ge_u(i32.wrap_i64(local.get("$index_val")), i32.wrap_i64(local.get("$list_val"))))
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.LIST_OUT_OF_RANGE))),
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
                i32.wrap_i64(local.get("$val")),
              ),
          ),
      ),
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
