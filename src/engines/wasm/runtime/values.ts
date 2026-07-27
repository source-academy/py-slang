import { f64, i32, i64, local, wasm } from "@sourceacademy/wasm-util";
import { MALLOC_FX } from "./gc";
import { ERROR_MAP, TYPE_TAG, getErrorIndex } from "./metadata";
import { PUSH_SHADOW_STACK_FX } from "./shadowStack";

// store directly in payload
export const MAKE_INT_FX = wasm
  .func("$_make_int")
  .params({ $value: i64 })
  .results(i32, i64)
  .body(i32.const(TYPE_TAG.INT), local.get("$value"));

export const CHECK_INT_FX = wasm
  .func("$_check_int")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(i32.ne(local.get("$tag"), i32.const(TYPE_TAG.INT)))
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.RANGE_ARG_NOT_INT))),
        wasm.unreachable(),
      ),

    local.get("$tag"),
    local.get("$val"),
  );

// reinterpret bits as int
export const MAKE_FLOAT_FX = wasm
  .func("$_make_float")
  .params({ $value: f64 })
  .results(i32, i64)
  .body(i32.const(TYPE_TAG.FLOAT), i64.reinterpret_f64(local.get("$value")));

// payload is a pointer to a 16-byte heap block laid out as:
// [0..7]   = real part (f64)
// [8..15]  = imaginary part (f64)
export const MAKE_COMPLEX_FX = wasm
  .func("$_make_complex")
  .params({ $real: f64, $img: f64 })
  .locals({ $ptr: i32 })
  .results(i32, i64)
  .body(
    f64.store(local.tee("$ptr", wasm.call(MALLOC_FX).args(i32.const(16))), local.get("$real")),
    f64.store(i32.add(local.get("$ptr"), i32.const(8)), local.get("$img")),
    wasm
      .call(PUSH_SHADOW_STACK_FX)
      .args(i32.const(TYPE_TAG.COMPLEX), i64.extend_i32_u(local.get("$ptr"))),
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
        i64.or(
          i64.shl(i64.extend_i32_u(local.get("$ptr")), i64.const(32)),
          i64.extend_i32_u(local.get("$len")),
        ),
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

export const MAKE_NONE_FX = wasm
  .func("$_make_none")
  .results(i32, i64)
  .body(i32.const(TYPE_TAG.NONE), i64.const(0));
