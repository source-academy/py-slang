import { i32, i64, local, wasm } from "@sourceacademy/wasm-util";
import { ERROR_MAP, TYPE_TAG, getErrorIndex } from "./metadata";
import { POP_SHADOW_STACK_FX } from "./shadowStack";

export const TOKENIZE_FX = wasm
  .func("$_tokenize")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(i32.ne(local.get("$tag"), i32.const(TYPE_TAG.STRING)))
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.PARSE_NOT_STRING))),
        wasm.unreachable(),
      ),

    wasm.call(POP_SHADOW_STACK_FX),
    wasm.raw`(local.set $val) (local.set $tag)`,

    wasm
      .call("$_host_tokenize")
      .args(
        i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(32))),
        i32.wrap_i64(local.get("$val")),
      ),
  );

export const PARSE_FX = wasm
  .func("$_parse")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(i32.ne(local.get("$tag"), i32.const(TYPE_TAG.STRING)))
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.PARSE_NOT_STRING))),
        wasm.unreachable(),
      ),

    wasm.call(POP_SHADOW_STACK_FX),
    wasm.raw`(local.set $val) (local.set $tag)`,

    wasm
      .call("$_host_parse")
      .args(
        i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(32))),
        i32.wrap_i64(local.get("$val")),
      ),
  );
