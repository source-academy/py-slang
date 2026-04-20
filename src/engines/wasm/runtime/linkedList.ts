import { i32, i64, local, wasm } from "@sourceacademy/wasm-util";
import { IS_TAG_GCABLE, MALLOC_FX } from "./gc";
import { LIST_SLOT_TAG_LOAD_FX, LIST_SLOT_VAL_LOAD_FX, MAKE_LIST_FX } from "./list";
import { ERROR_MAP, GC_OBJECT_HEADER_SIZE, TYPE_TAG, getErrorIndex } from "./metadata";
import {
  DISCARD_SHADOW_STACK_FX,
  PEEK_SHADOW_STACK_FX,
  POP_SHADOW_STACK_FX,
  PUSH_SHADOW_STACK_FX,
  SILENT_PUSH_SHADOW_STACK_FX,
} from "./shadowStack";
import { MAKE_BOOL_FX } from "./values";

export const MAKE_PAIR_FX = wasm
  .func("$_make_pair")
  .params({ $head_tag: i32, $head_val: i64, $tail_tag: i32, $tail_val: i64 })
  .locals({ $ptr: i32 })
  .results(i32, i64)
  .body(
    local.set("$ptr", wasm.call(MALLOC_FX).args(i32.const(32))),
    i64.store(local.get("$ptr"), i64.const(0)),

    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$tail_tag")))
      .then(wasm.call(POP_SHADOW_STACK_FX), wasm.raw`(local.set $tail_val) (local.set $tail_tag)`),

    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$head_tag")))
      .then(wasm.call(POP_SHADOW_STACK_FX), wasm.raw`(local.set $head_val) (local.set $head_tag)`),

    i32.store(i32.add(local.get("$ptr"), i32.const(GC_OBJECT_HEADER_SIZE)), local.get("$head_tag")),
    i64.store(
      i32.add(local.get("$ptr"), i32.const(GC_OBJECT_HEADER_SIZE + 4)),
      local.get("$head_val"),
    ),
    i32.store(
      i32.add(local.get("$ptr"), i32.const(GC_OBJECT_HEADER_SIZE + 12)),
      local.get("$tail_tag"),
    ),
    i64.store(
      i32.add(local.get("$ptr"), i32.const(GC_OBJECT_HEADER_SIZE + 16)),
      local.get("$tail_val"),
    ),

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

export const MAKE_LINKED_LIST_FX = wasm
  .func("$_make_linked_list")
  .params({ $tag: i32, $val: i64 })
  .locals({ $i: i32, $acc_tag: i32, $acc_val: i64, $elem_tag: i32, $elem_val: i64 })
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
        wasm
          .call("$_log_error")
          .args(i32.const(getErrorIndex(ERROR_MAP.MAKE_LINKED_LIST_NOT_LIST))),
        wasm.unreachable(),
      ),

    local.set("$i", i32.sub(i32.wrap_i64(local.get("$val")), i32.const(1))),
    local.set("$acc_tag", i32.const(TYPE_TAG.NONE)),

    wasm.loop("$loop").body(
      wasm.if(i32.ge_s(local.get("$i"), i32.const(0))).then(
        wasm
          .if(wasm.call(IS_TAG_GCABLE).args(local.get("$acc_tag")))
          .then(
            wasm.call(POP_SHADOW_STACK_FX),
            wasm.raw`(local.set $acc_val) (local.set $acc_tag)`,
          ),

        wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0)),
        wasm.raw`(local.set $val) (local.set $tag)`,

        local.tee(
          "$elem_tag",
          wasm.call(LIST_SLOT_TAG_LOAD_FX).args(local.get("$val"), local.get("$i")),
        ),
        local.tee(
          "$elem_val",
          wasm.call(LIST_SLOT_VAL_LOAD_FX).args(local.get("$val"), local.get("$i")),
        ),
        local.get("$acc_tag"),
        local.get("$acc_val"),

        wasm
          .if(wasm.call(IS_TAG_GCABLE).args(local.get("$elem_tag")))
          .then(
            wasm
              .call(SILENT_PUSH_SHADOW_STACK_FX)
              .args(local.get("$elem_tag"), local.get("$elem_val")),
          ),
        wasm
          .if(wasm.call(IS_TAG_GCABLE).args(local.get("$acc_tag")))
          .then(
            wasm
              .call(SILENT_PUSH_SHADOW_STACK_FX)
              .args(local.get("$acc_tag"), local.get("$acc_val")),
          ),

        wasm.raw`(call ${MAKE_PAIR_FX.name}) (local.set $acc_val) (local.set $acc_tag)`,

        local.set("$i", i32.sub(local.get("$i"), i32.const(1))),
        wasm.br("$loop"),
      ),
    ),

    wasm.call(POP_SHADOW_STACK_FX),
    wasm.raw`(local.set $acc_val) (local.set $acc_tag)`,
    wasm.call(DISCARD_SHADOW_STACK_FX),

    wasm.call(PUSH_SHADOW_STACK_FX).args(local.get("$acc_tag"), local.get("$acc_val")),
  );
