import { global, i32, i64, local, wasm } from "@sourceacademy/wasm-util";
import {
  ERROR_MAP,
  SHADOW_STACK_BOTTOM,
  SHADOW_STACK_PTR,
  SHADOW_STACK_SLOT_SIZE,
  SHADOW_STACK_TOP,
  getErrorIndex,
} from "./metadata";

export const PEEK_SHADOW_STACK_FX = wasm
  .func("$_peek_shadow_stack")
  .params({ $offset: i32 })
  .locals({ $addr: i32 })
  .results(i32, i64)
  .body(
    local.set(
      "$addr",
      i32.add(
        global.get(SHADOW_STACK_PTR),
        i32.mul(local.get("$offset"), i32.const(SHADOW_STACK_SLOT_SIZE)),
      ),
    ),

    wasm
      .if(i32.lt_u(local.get("$addr"), global.get(SHADOW_STACK_BOTTOM)))
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.STACK_OVERFLOW))),
        wasm.unreachable(),
      ),

    wasm
      .if(i32.ge_u(local.get("$addr"), global.get(SHADOW_STACK_TOP)))
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.STACK_UNDERFLOW))),
        wasm.unreachable(),
      ),

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
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.STACK_OVERFLOW))),
        wasm.unreachable(),
      ),

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
  .body(
    global.set(
      SHADOW_STACK_PTR,
      i32.add(global.get(SHADOW_STACK_PTR), i32.const(SHADOW_STACK_SLOT_SIZE)),
    ),
  );

export const POP_SHADOW_STACK_FX = wasm
  .func("$_pop_shadow_stack")
  .results(i32, i64)
  .locals({ $new_ptr: i32 })
  .body(
    local.set("$new_ptr", i32.add(global.get(SHADOW_STACK_PTR), i32.const(SHADOW_STACK_SLOT_SIZE))),

    wasm
      .if(i32.gt_u(local.get("$new_ptr"), global.get(SHADOW_STACK_TOP)))
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.STACK_UNDERFLOW))),
        wasm.unreachable(),
      ),

    i32.load(global.get(SHADOW_STACK_PTR)),
    i64.load(i32.add(global.get(SHADOW_STACK_PTR), i32.const(4))),
    global.set(SHADOW_STACK_PTR, local.get("$new_ptr")),
  );
