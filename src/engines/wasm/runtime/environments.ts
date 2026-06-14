import {
  global,
  i32,
  i64,
  local,
  memory,
  wasm,
  type WasmInstruction,
} from "@sourceacademy/wasm-util";
import { IS_TAG_GCABLE, MALLOC_FX } from "./gc";
import {
  CURR_ENV,
  ENV_HEAD_SIZE,
  ERROR_MAP,
  GC_OBJECT_HEADER_SIZE,
  SHADOW_STACK_PTR,
  SHADOW_STACK_TOP,
  TYPE_TAG,
  getErrorIndex,
} from "./metadata";
import {
  DISCARD_SHADOW_STACK_FX,
  PEEK_SHADOW_STACK_FX,
  POP_SHADOW_STACK_FX,
  PUSH_SHADOW_STACK_FX,
  SILENT_PUSH_SHADOW_STACK_FX,
} from "./shadowStack";
import { MAKE_NONE_FX } from "./values";

// env layout:
// +0: parent env pointer (i32)
// +4: environment size in bindings (i32)
// +8: first binding (tag i32, value i64)
export const ALLOC_ENV_FX = wasm
  .func("$_alloc_env")
  .params({ $size: i32 })
  .locals({ $env: i32, $i: i32, $parent: i32 })
  .results(i32)
  .body(
    local.set(
      "$env",
      wasm
        .call(MALLOC_FX)
        .args(i32.add(i32.const(ENV_HEAD_SIZE), i32.mul(local.get("$size"), i32.const(12)))),
    ),

    // if there's a callee on the stack, we need to reload the parent from it after MALLOC.
    // if there's no callee, the parent is 0, so this doesn't change anything
    wasm
      .if(i32.lt_u(global.get(SHADOW_STACK_PTR), global.get(SHADOW_STACK_TOP)))
      .then(
        wasm
          .if(i32.eq(i32.load(global.get(SHADOW_STACK_PTR)), i32.const(TYPE_TAG.CLOSURE)))
          .then(
            local.set(
              "$parent",
              i32.wrap_i64(i64.load(i32.add(global.get(SHADOW_STACK_PTR), i32.const(4)))),
            ),
          ),
      ),

    i32.store(local.get("$env"), local.get("$parent")),
    i32.store(i32.add(local.get("$env"), i32.const(4)), local.get("$size")),

    wasm
      .loop("$loop")
      .body(
        wasm
          .if(i32.lt_u(local.get("$i"), local.get("$size")))
          .then(
            i32.store(
              i32.add(
                i32.add(local.get("$env"), i32.const(ENV_HEAD_SIZE)),
                i32.mul(local.get("$i"), i32.const(12)),
              ),
              i32.const(TYPE_TAG.UNBOUND),
            ),
            local.set("$i", i32.add(local.get("$i"), i32.const(1))),
            wasm.br("$loop"),
          ),
      ),

    local.get("$env"),
  );

export const PRE_APPLY_FX = wasm
  .func("$_pre_apply")
  .params({ $tag: i32, $val: i64, $arg_len: i32 })
  .results(i32)
  .body(
    wasm
      .if(i32.ne(local.get("$tag"), i32.const(TYPE_TAG.CLOSURE)))
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.CALL_NOT_FX))),
        wasm.unreachable(),
      ),

    wasm
      .call(ALLOC_ENV_FX)
      .args(
        i32.add(
          local.get("$arg_len"),
          i32.sub(
            i32.and(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(32))), i32.const(255)),
            i32.and(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(40))), i32.const(255)),
          ),
        ),
      ),
  );

export const APPLY_FX_NAME = "$_apply";
export const RETURN_ENV_NAME = "$return_env";
export const RETURN_NONVOID_SUFFIX = [
  wasm.raw`(local.set $return_val) (local.set $return_tag)`,
  wasm
    .if(wasm.call(IS_TAG_GCABLE).args(local.get("$return_tag")))
    .results(i32, i64)
    .then(
      wasm.call(DISCARD_SHADOW_STACK_FX),
      local.set(
        RETURN_ENV_NAME,
        i32.wrap_i64(i64.load(i32.add(global.get(SHADOW_STACK_PTR), i32.const(4)))),
      ),
      wasm.call(DISCARD_SHADOW_STACK_FX),

      wasm.call(PUSH_SHADOW_STACK_FX).args(local.get("$return_tag"), local.get("$return_val")),
    )
    .else(
      local.set(
        RETURN_ENV_NAME,
        i32.wrap_i64(i64.load(i32.add(global.get(SHADOW_STACK_PTR), i32.const(4)))),
      ),
      wasm.call(DISCARD_SHADOW_STACK_FX),
      local.get("$return_tag"),
      local.get("$return_val"),
    ),

  global.set(CURR_ENV, local.get(RETURN_ENV_NAME)),
];

export const RETURN_VOID_SUFFIX = [
  local.set(
    RETURN_ENV_NAME,
    i32.wrap_i64(i64.load(i32.add(global.get(SHADOW_STACK_PTR), i32.const(4)))),
  ),
  wasm.call(DISCARD_SHADOW_STACK_FX),
  wasm.call(MAKE_NONE_FX),

  global.set(CURR_ENV, local.get(RETURN_ENV_NAME)),
];

export const applyFuncFactory = (bodies: WasmInstruction[][]) =>
  wasm
    .func(APPLY_FX_NAME)
    .params({ $arg_len: i32 })
    .locals({
      [RETURN_ENV_NAME]: i32,
      $val: i64,
      $additional_args: i32,
      $i: i32,
      $arg_ptr: i32,
      $write_ptr: i32,
      $tuple_ptr: i32,
      $new_env: i32,
      $arity: i32,
      $env_size: i32,
      $has_varargs: i32,
      $return_tag: i32,
      $return_val: i64,
    })
    .results(i32, i64)
    .body(
      // the new env pointer will be rooted in CURR_ENV global, so no need to remain on shadow stack after this point
      global.set(
        CURR_ENV,
        i32.wrap_i64(
          i64.shr_u(i64.load(i32.add(global.get(SHADOW_STACK_PTR), i32.const(4))), i64.const(32)),
        ),
      ),
      wasm.call(DISCARD_SHADOW_STACK_FX),

      // pop closure from shadow stack into locals
      wasm.call(POP_SHADOW_STACK_FX),
      wasm.raw`(local.set $val) (drop)`,

      // return env remains on the shadow stack for the return instruction to use after the call

      local.set(
        "$arity",
        i32.and(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(40))), i32.const(255)),
      ),
      local.set(
        "$env_size",
        i32.and(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(32))), i32.const(255)),
      ),
      local.set(
        "$has_varargs",
        i32.and(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(63))), i32.const(1)),
      ),

      // check if args have any starred arguments (unpack). if so, we need to construct a new env
      wasm.loop("$loop").body(
        wasm.if(i32.lt_s(local.get("$i"), local.get("$arg_len"))).then(
          local.set(
            "$arg_ptr",
            i32.add(
              i32.add(global.get(CURR_ENV), i32.mul(local.get("$i"), i32.const(12))),
              i32.const(ENV_HEAD_SIZE),
            ),
          ),
          wasm.if(i32.shr_u(i32.load(local.get("$arg_ptr")), i32.const(31))).then(
            // check if it's a list, if not error (only lists can be unpacked)
            wasm
              .if(
                i32.ne(
                  i32.and(i32.load(local.get("$arg_ptr")), i32.const(0x7fffffff)),
                  i32.const(TYPE_TAG.LIST),
                ),
              )
              .then(
                wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.STARRED_NOT_LIST))),
                wasm.unreachable(),
              ),
            local.set(
              "$additional_args",
              i32.add(
                local.get("$additional_args"),
                i32.sub(
                  i32.wrap_i64(i64.load(i32.add(local.get("$arg_ptr"), i32.const(4)))),
                  i32.const(1),
                ),
              ),
            ),
          ),

          local.set("$i", i32.add(local.get("$i"), i32.const(1))),
          wasm.br("$loop"),
        ),
      ),

      wasm.if(local.get("$additional_args")).then(
        // ALLOC a new environment with size = old env length + additional args from unpacking
        // push the callee back onto the stack for ALLOC_ENV to use as the parent env, then discard it after
        wasm.call(SILENT_PUSH_SHADOW_STACK_FX).args(i32.const(TYPE_TAG.CLOSURE), local.get("$val")),
        local.set(
          "$new_env",
          wasm
            .call(ALLOC_ENV_FX)
            .args(
              i32.add(
                i32.load(i32.add(global.get(CURR_ENV), i32.const(4))),
                local.get("$additional_args"),
              ),
            ),
        ),
        wasm.call(DISCARD_SHADOW_STACK_FX),

        local.set("$arg_len", i32.add(local.get("$arg_len"), local.get("$additional_args"))),
        local.set("$write_ptr", i32.add(local.get("$new_env"), i32.const(ENV_HEAD_SIZE))),

        // loop over the entire old environment, which = old env length
        local.set("$i", i32.const(0)),
        wasm.loop("$unpack_loop").body(
          wasm
            .if(i32.lt_s(local.get("$i"), i32.load(i32.add(global.get(CURR_ENV), i32.const(4)))))
            .then(
              local.set(
                "$arg_ptr",
                i32.add(
                  i32.add(global.get(CURR_ENV), i32.mul(local.get("$i"), i32.const(12))),
                  i32.const(ENV_HEAD_SIZE),
                ),
              ),

              // if starred, remove the starred bit and prepare to unpack
              wasm
                .if(i32.shr_u(i32.load(local.get("$arg_ptr")), i32.const(31)))
                .then(
                  i32.store(
                    local.get("$arg_ptr"),
                    i32.and(i32.load(local.get("$arg_ptr")), i32.const(0x7fffffff)),
                  ),
                  // copy over the list
                  memory.copy(
                    local.get("$write_ptr"),
                    i32.add(
                      i32.wrap_i64(
                        i64.shr_u(
                          i64.load(i32.add(local.get("$arg_ptr"), i32.const(4))),
                          i64.const(32),
                        ),
                      ),
                      i32.const(GC_OBJECT_HEADER_SIZE),
                    ),
                    i32.mul(
                      i32.wrap_i64(i64.load(i32.add(local.get("$arg_ptr"), i32.const(4)))),
                      i32.const(12),
                    ),
                  ),
                  local.set(
                    "$write_ptr",
                    i32.add(
                      local.get("$write_ptr"),
                      i32.mul(
                        i32.wrap_i64(i64.load(i32.add(local.get("$arg_ptr"), i32.const(4)))),
                        i32.const(12),
                      ),
                    ),
                  ),
                )
                .else(
                  // else not starred: just copy the element over
                  memory.copy(local.get("$write_ptr"), local.get("$arg_ptr"), i32.const(12)),
                  local.set("$write_ptr", i32.add(local.get("$write_ptr"), i32.const(12))),
                ),
              local.set("$i", i32.add(local.get("$i"), i32.const(1))),
              wasm.br("$unpack_loop"),
            ),
        ),

        global.set(CURR_ENV, local.get("$new_env")),
      ),

      // if varargs bit is true AND arity is greater than argument length, error
      // if not varargs AND arity doesn't equal argument length, error
      wasm
        .if(
          i32.or(
            i32.and(
              local.get("$has_varargs"),
              i32.gt_u(local.get("$arity"), local.get("$arg_len")),
            ),
            i32.and(
              i32.eqz(local.get("$has_varargs")),
              i32.ne(local.get("$arity"), local.get("$arg_len")),
            ),
          ),
        )
        .then(
          wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.FUNC_WRONG_ARITY))),
          wasm.unreachable(),
        ),

      // if has varargs
      wasm.if(local.get("$has_varargs")).then(
        local.set(
          "$tuple_ptr",
          wasm
            .call(MALLOC_FX)
            .args(
              i32.add(
                i32.mul(i32.sub(local.get("$arg_len"), local.get("$arity")), i32.const(12)),
                i32.const(GC_OBJECT_HEADER_SIZE),
              ),
            ),
        ),
        i64.store(local.get("$tuple_ptr"), i64.const(0)),

        memory.copy(
          i32.add(local.get("$tuple_ptr"), i32.const(GC_OBJECT_HEADER_SIZE)),
          i32.add(
            i32.add(global.get(CURR_ENV), i32.const(ENV_HEAD_SIZE)),
            i32.mul(local.get("$arity"), i32.const(12)),
          ),
          i32.mul(i32.sub(local.get("$arg_len"), local.get("$arity")), i32.const(12)),
        ),

        // create tuple manually with pointer to start of the copied list, and store it in the env where the varargs would be,
        // which is right after the fixed arguments and before local declarations
        i32.store(
          i32.add(
            i32.add(global.get(CURR_ENV), i32.const(ENV_HEAD_SIZE)),
            i32.mul(local.get("$arity"), i32.const(12)),
          ),
          i32.const(TYPE_TAG.TUPLE),
        ),
        i64.store(
          i32.add(
            i32.add(
              i32.add(global.get(CURR_ENV), i32.const(ENV_HEAD_SIZE)),
              i32.mul(local.get("$arity"), i32.const(12)),
            ),
            i32.const(4),
          ),
          i64.or(
            i64.shl(i64.extend_i32_u(local.get("$tuple_ptr")), i64.const(32)),
            i64.extend_i32_u(i32.sub(local.get("$arg_len"), local.get("$arity"))),
          ),
        ),

        // need to re-UNBOUND the local variables
        local.set("$i", i32.const(0)),
        wasm
          .loop("$reunbound_loop")
          .body(
            wasm
              .if(
                i32.lt_s(
                  local.get("$i"),
                  i32.sub(i32.sub(local.get("$env_size"), local.get("$arity")), i32.const(1)),
                ),
              )
              .then(
                i32.store(
                  i32.add(
                    i32.add(global.get(CURR_ENV), i32.const(ENV_HEAD_SIZE)),
                    i32.mul(
                      i32.add(i32.add(local.get("$arity"), i32.const(1)), local.get("$i")),
                      i32.const(12),
                    ),
                  ),
                  i32.const(TYPE_TAG.UNBOUND),
                ),
                local.set("$i", i32.add(local.get("$i"), i32.const(1))),
                wasm.br("$reunbound_loop"),
              ),
          ),
      ),

      ...wasm.buildBrTableBlocks(
        wasm.br_table(
          i32.and(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(48))), i32.const(32767)),
          ...Array(bodies.length).keys(),
        ),
        ...bodies.map(body => [...body, wasm.return(...RETURN_VOID_SUFFIX)]),
      ),
    );

export const GET_LEX_ADDR_FX = wasm
  .func("$_get_lex_addr")
  .params({ $depth: i32, $index: i32 })
  .results(i32, i64)
  .locals({ $env: i32, $tag: i32, $value: i64 })
  .body(
    local.set("$env", global.get(CURR_ENV)),

    wasm.loop("$loop").body(
      wasm.if(i32.eqz(local.get("$depth"))).then(
        local.set(
          "$tag",
          i32.load(
            i32.add(
              i32.add(local.get("$env"), i32.const(ENV_HEAD_SIZE)),
              i32.mul(local.get("$index"), i32.const(12)),
            ),
          ),
        ),

        wasm
          .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.UNBOUND)))
          .then(
            wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.UNBOUND))),
            wasm.unreachable(),
          ),

        local.tee(
          "$value",
          i64.load(
            i32.add(
              i32.add(i32.add(local.get("$env"), i32.const(ENV_HEAD_SIZE)), i32.const(4)),
              i32.mul(local.get("$index"), i32.const(12)),
            ),
          ),
        ),

        wasm
          .if(wasm.call(IS_TAG_GCABLE).args(local.get("$tag")))
          .then(
            wasm.call(SILENT_PUSH_SHADOW_STACK_FX).args(local.get("$tag"), local.get("$value")),
          ),

        wasm.return(local.get("$tag"), local.get("$value")),
      ),

      local.set("$env", i32.load(local.get("$env"))),
      local.set("$depth", i32.sub(local.get("$depth"), i32.const(1))),
      wasm.br("$loop"),
    ),

    wasm.unreachable(),
  );

export const SET_LEX_ADDR_FX = wasm
  .func("$_set_lex_addr")
  .params({ $depth: i32, $index: i32, $tag: i32, $value: i64 })
  .locals({ $env: i32 })
  .body(
    local.set("$env", global.get(CURR_ENV)),

    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$tag")))
      .then(wasm.call(POP_SHADOW_STACK_FX), wasm.raw`(local.set $value) (local.set $tag)`),

    wasm.loop("$loop").body(
      wasm
        .if(i32.eqz(local.get("$depth")))
        .then(
          i32.store(
            i32.add(
              i32.add(local.get("$env"), i32.const(ENV_HEAD_SIZE)),
              i32.mul(local.get("$index"), i32.const(12)),
            ),
            local.get("$tag"),
          ),
          i64.store(
            i32.add(
              i32.add(i32.add(local.get("$env"), i32.const(ENV_HEAD_SIZE)), i32.const(4)),
              i32.mul(local.get("$index"), i32.const(12)),
            ),
            local.get("$value"),
          ),
          wasm.return(),
        ),

      local.set("$env", i32.load(local.get("$env"))),
      local.set("$depth", i32.sub(local.get("$depth"), i32.const(1))),
      wasm.br("$loop"),
    ),

    wasm.unreachable(),
  );

export const SET_CONTIGUOUS_BLOCK_FX = wasm
  .func("$_set_contiguous_block")
  .params({ $index: i32, $tag: i32, $value: i64, $offset: i32, $is_starred: i32 })
  .locals({ $addr: i32, $state_val: i64 })
  .body(
    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$tag")))
      .then(wasm.call(POP_SHADOW_STACK_FX), wasm.raw`(local.set $value) (local.set $tag)`),

    wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0)),
    wasm.raw`(local.set $state_val) (drop)`,

    // state payload stores pointer in upper 32 bits for both CALL_NEW_ENV and LIST_STATE
    local.set("$addr", i32.wrap_i64(i64.shr_u(local.get("$state_val"), i64.const(32)))),

    i32.store(
      i32.add(
        i32.add(local.get("$addr"), local.get("$offset")),
        i32.mul(local.get("$index"), i32.const(12)),
      ),
      i32.or(local.get("$tag"), i32.shl(local.get("$is_starred"), i32.const(31))),
    ),
    i64.store(
      i32.add(
        i32.add(i32.add(local.get("$addr"), local.get("$offset")), i32.const(4)),
        i32.mul(local.get("$index"), i32.const(12)),
      ),
      local.get("$value"),
    ),
  );

// Helper function for interactive mode: takes (tag, value) and returns either
// the shadow stack value (if tag is gcable) or the original (tag, value)
export const GET_LAST_EXPR_RESULT_FX = wasm
  .func("$_get_last_expr_result")
  .params({ $tag: i32, $value: i64 })
  .results(i32, i64)
  .body(
    wasm
      .if(wasm.call(IS_TAG_GCABLE).args(local.get("$tag")))
      .results(i32, i64)
      .then(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0)))
      .else(local.get("$tag"), local.get("$value")),
  );
