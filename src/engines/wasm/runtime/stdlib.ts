import { f64, global, i32, i64, local, wasm } from "@sourceacademy/wasm-util";
import { IS_TAG_GCABLE } from "./gc";
import { DATA_END, ERROR_MAP, GC_OBJECT_HEADER_SIZE, TYPE_TAG, getErrorIndex } from "./metadata";
import { POP_SHADOW_STACK_FX } from "./shadowStack";
import { MAKE_BOOL_FX, MAKE_INT_FX } from "./values";

export const IS_INT_FX = wasm
  .func("$_is_int")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$tag")))
      .then(wasm.call(POP_SHADOW_STACK_FX), wasm.raw`(local.set $val) (local.set $tag)`),

    wasm.call(MAKE_BOOL_FX).args(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.INT))),
  );

export const IS_FLOAT_FX = wasm
  .func("$_is_float")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$tag")))
      .then(wasm.call(POP_SHADOW_STACK_FX), wasm.raw`(local.set $val) (local.set $tag)`),

    wasm.call(MAKE_BOOL_FX).args(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.FLOAT))),
  );

export const IS_COMPLEX_FX = wasm
  .func("$_is_complex")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$tag")))
      .then(wasm.call(POP_SHADOW_STACK_FX), wasm.raw`(local.set $val) (local.set $tag)`),

    wasm.call(MAKE_BOOL_FX).args(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.COMPLEX))),
  );

export const IS_STRING_FX = wasm
  .func("$_is_string")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$tag")))
      .then(wasm.call(POP_SHADOW_STACK_FX), wasm.raw`(local.set $val) (local.set $tag)`),

    wasm.call(MAKE_BOOL_FX).args(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.STRING))),
  );

export const IS_BOOL_FX = wasm
  .func("$_is_bool")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$tag")))
      .then(wasm.call(POP_SHADOW_STACK_FX), wasm.raw`(local.set $val) (local.set $tag)`),

    wasm.call(MAKE_BOOL_FX).args(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.BOOL))),
  );

export const IS_FUNCTION_FX = wasm
  .func("$_is_function")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$tag")))
      .then(wasm.call(POP_SHADOW_STACK_FX), wasm.raw`(local.set $val) (local.set $tag)`),

    wasm.call(MAKE_BOOL_FX).args(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.CLOSURE))),
  );

export const IS_NONE_FX = wasm
  .func("$_is_none")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$tag")))
      .then(wasm.call(POP_SHADOW_STACK_FX), wasm.raw`(local.set $val) (local.set $tag)`),

    wasm.call(MAKE_BOOL_FX).args(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.NONE))),
  );

// bool related functions
export const BOOLISE_FX = wasm
  .func("$_boolise")
  .params({ $tag: i32, $val: i64 })
  .results(i64)
  .body(
    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$tag")))
      .then(wasm.call(POP_SHADOW_STACK_FX), wasm.raw`(local.set $val) (local.set $tag)`),

    // None => False
    wasm
      .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.NONE)))
      .then(wasm.return(wasm.call(MAKE_BOOL_FX).args(i32.const(0)))),

    // bool or int => return bool with value (False if 0)
    wasm
      .if(
        i32.or(
          i32.eq(local.get("$tag"), i32.const(TYPE_TAG.INT)),
          i32.eq(local.get("$tag"), i32.const(TYPE_TAG.BOOL)),
        ),
      )
      .then(wasm.return(wasm.call(MAKE_BOOL_FX).args(i32.wrap_i64(local.get("$val"))))),

    // float/complex => False if equivalent of 0
    wasm
      .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.FLOAT)))
      .then(
        wasm.return(
          wasm
            .call(MAKE_BOOL_FX)
            .args(f64.ne(f64.reinterpret_i64(local.get("$val")), f64.const(0))),
        ),
      ),
    wasm
      .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.COMPLEX)))
      .then(
        wasm.return(
          wasm
            .call(MAKE_BOOL_FX)
            .args(
              i32.or(
                f64.ne(
                  f64.load(i32.add(i32.wrap_i64(local.get("$val")), i32.const(8))),
                  f64.const(0),
                ),
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
      .then(
        wasm.return(
          wasm.call(MAKE_BOOL_FX).args(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(32)))),
        ),
      ),

    // closure => True
    wasm
      .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.CLOSURE)))
      .then(wasm.return(wasm.call(MAKE_BOOL_FX).args(i32.const(1)))),

    wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.BOOL_UNKNOWN_TYPE))),
    wasm.unreachable(),
  );

export const ARITY_FX = wasm
  .func("$_arity")
  .params({ $tag: i32, $val: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(i32.ne(local.get("$tag"), i32.const(TYPE_TAG.CLOSURE)))
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.ARITY_NOT_CLOSURE))),
        wasm.unreachable(),
      ),

    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$tag")))
      .then(wasm.call(POP_SHADOW_STACK_FX), wasm.raw`(local.set $val) (local.set $tag)`),

    wasm
      .call(MAKE_INT_FX)
      .args(i64.and(i64.shr_u(local.get("$val"), i64.const(40)), i64.const(255))),
  );

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
  wasm.import("console", "log_raw").func("$_log_raw").params(i32, i64),
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
          .args(
            i32.add(
              i32.wrap_i64(i64.shr_u(local.get("$value"), i64.const(32))),
              wasm.select(
                i32.const(0),
                i32.const(GC_OBJECT_HEADER_SIZE),
                i32.lt_u(
                  i32.wrap_i64(i64.shr_u(local.get("$value"), i64.const(32))),
                  global.get(DATA_END),
                ),
              ),
            ),
            i32.wrap_i64(local.get("$value")),
          ),
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
    wasm
      .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.NONE)))
      .then(wasm.call("$_log_none"), wasm.return()),
    wasm
      .if(
        i32.or(
          i32.eq(local.get("$tag"), i32.const(TYPE_TAG.LIST)),
          i32.eq(local.get("$tag"), i32.const(TYPE_TAG.TUPLE)),
        ),
      )
      .then(
        wasm
          .call("$_log_list")
          .args(
            i32.add(
              i32.wrap_i64(i64.shr_u(local.get("$value"), i64.const(32))),
              i32.const(GC_OBJECT_HEADER_SIZE),
            ),
            i32.wrap_i64(local.get("$value")),
          ),
        wasm.return(),
      ),

    wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.LOG_UNKNOWN_TYPE))),
    wasm.unreachable(),
  );
