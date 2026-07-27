import { global, i32, i64, local, memory, wasm } from "@sourceacademy/wasm-util";
import {
  CURR_ENV,
  DATA_END,
  ENV_FORWARDING_BIT,
  ENV_HEAD_SIZE,
  ERROR_MAP,
  FROM_SPACE_END_PTR,
  FROM_SPACE_START_PTR,
  GC_OBJECT_HEADER_SIZE,
  GC_SPECIAL_TAG,
  HEAP_PTR,
  SHADOW_STACK_PTR,
  SHADOW_STACK_SLOT_SIZE,
  SHADOW_STACK_TAG,
  SHADOW_STACK_TOP,
  TO_SPACE_END_PTR,
  TO_SPACE_START_PTR,
  TYPE_TAG,
  getErrorIndex,
} from "./metadata";

export const IS_TAG_GCABLE = wasm
  .func("$_is_tag_gcable")
  .params({ $tag: i32 })
  .results(i32)
  .body(
    i32.or(
      i32.or(
        i32.or(
          i32.eq(local.get("$tag"), i32.const(TYPE_TAG.COMPLEX)),
          i32.eq(local.get("$tag"), i32.const(TYPE_TAG.STRING)),
        ),
        i32.or(
          i32.eq(local.get("$tag"), i32.const(TYPE_TAG.CLOSURE)),
          i32.eq(local.get("$tag"), i32.const(TYPE_TAG.LIST)),
        ),
      ),
      i32.or(
        i32.or(
          i32.eq(local.get("$tag"), i32.const(TYPE_TAG.TUPLE)),
          i32.eq(local.get("$tag"), i32.const(SHADOW_STACK_TAG.LIST_STATE)),
        ),
        i32.or(
          i32.eq(local.get("$tag"), i32.const(SHADOW_STACK_TAG.CALL_NEW_ENV)),
          i32.eq(local.get("$tag"), i32.const(GC_SPECIAL_TAG.ENV)),
        ),
      ),
    ),
  );

const COPY_FX_NAME = "$_copy";
export const COPY_FX = wasm
  .func(COPY_FX_NAME)
  .params({ $tag: i32, $val: i64 })
  .locals({
    $new_ptr: i32,
    $len: i32,
    $ptr: i32,
    $alloc_size: i32,
    $i: i32,
    $elem_tag: i32,
    $elem_ptr: i32,
  })
  .results(i64)
  .body(
    // gc-special environment pointer in low 32 bits
    wasm.if(i32.eq(local.get("$tag"), i32.const(GC_SPECIAL_TAG.ENV))).then(
      local.set("$ptr", i32.wrap_i64(local.get("$val"))),

      // forwarding bit is at +4 offset, 2nd leftmost bit.
      // forwarding address is at +0 offset, whole 32 bits.
      wasm
        .if(
          i32.and(
            i32.load(i32.add(local.get("$ptr"), i32.const(4))),
            i32.const(ENV_FORWARDING_BIT),
          ),
        )
        .then(wasm.return(i64.extend_i32_u(i32.load(local.get("$ptr"))))),

      local.set(
        "$len",
        i32.add(
          i32.const(ENV_HEAD_SIZE),
          i32.mul(i32.load(i32.add(local.get("$ptr"), i32.const(4))), i32.const(12)),
        ),
      ),
      local.set("$alloc_size", i32.load(i32.add(local.get("$ptr"), i32.const(4)))),
      local.set("$new_ptr", global.get(HEAP_PTR)),
      global.set(HEAP_PTR, i32.add(global.get(HEAP_PTR), local.get("$len"))),
      memory.copy(local.get("$new_ptr"), local.get("$ptr"), local.get("$len")),

      // install forwarding metadata on from-space env
      // (overwrite length with the forwarding bit)
      i32.store(local.get("$ptr"), local.get("$new_ptr")),
      i32.store(i32.add(local.get("$ptr"), i32.const(4)), i32.const(ENV_FORWARDING_BIT)),

      // if parent is not yet 0, means we need to copy parent also (+0 offset)
      wasm
        .if(i32.load(local.get("$new_ptr")))
        .then(
          i32.store(
            local.get("$new_ptr"),
            i32.wrap_i64(
              wasm
                .call(COPY_FX_NAME)
                .args(
                  i32.const(GC_SPECIAL_TAG.ENV),
                  i64.extend_i32_u(i32.load(local.get("$new_ptr"))),
                ),
            ),
          ),
        ),

      local.set("$i", i32.const(0)),
      wasm.loop("$copy_env_fields").body(
        wasm.if(i32.lt_u(local.get("$i"), local.get("$alloc_size"))).then(
          local.set(
            "$elem_ptr",
            i32.add(
              i32.add(local.get("$new_ptr"), i32.const(ENV_HEAD_SIZE)),
              i32.mul(local.get("$i"), i32.const(12)),
            ),
          ),
          local.set("$elem_tag", i32.load(local.get("$elem_ptr"))),

          wasm
            .if(wasm.call(IS_TAG_GCABLE).args(local.get("$elem_tag")))
            .then(
              i64.store(
                i32.add(local.get("$elem_ptr"), i32.const(4)),
                wasm
                  .call(COPY_FX_NAME)
                  .args(
                    local.get("$elem_tag"),
                    i64.load(i32.add(local.get("$elem_ptr"), i32.const(4))),
                  ),
              ),
            ),

          local.set("$i", i32.add(local.get("$i"), i32.const(1))),
          wasm.br("$copy_env_fields"),
        ),
      ),

      wasm.return(i64.extend_i32_u(local.get("$new_ptr"))),
    ),

    // complex (no forwarding, see test)
    wasm.if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.COMPLEX))).then(
      local.set("$ptr", i32.wrap_i64(local.get("$val"))),

      local.set("$new_ptr", global.get(HEAP_PTR)),
      global.set(HEAP_PTR, i32.add(global.get(HEAP_PTR), i32.const(16))),
      memory.copy(local.get("$new_ptr"), local.get("$ptr"), i32.const(16)),

      wasm.return(i64.extend_i32_u(local.get("$new_ptr"))),
    ),

    // string
    wasm.if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.STRING))).then(
      // if string in data section, don't do anything since data section is immutable and won't be moved by GC
      wasm
        .if(
          i32.lt_u(i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(32))), global.get(DATA_END)),
        )
        .then(wasm.return(local.get("$val"))),

      local.set("$ptr", i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(32)))),
      local.set("$len", i32.wrap_i64(local.get("$val"))),

      // forwarding metadata is encoded in from-space memory at $ptr as an i64:
      wasm
        .if(
          i32.eq(i32.load(i32.add(local.get("$ptr"), i32.const(4))), i32.const(ENV_FORWARDING_BIT)),
        )
        .then(
          wasm.return(
            i64.or(
              i64.shl(i64.extend_i32_u(i32.load(local.get("$ptr"))), i64.const(32)),
              i64.extend_i32_u(local.get("$len")),
            ),
          ),
        ),

      local.set("$new_ptr", global.get(HEAP_PTR)),
      global.set(
        HEAP_PTR,
        i32.add(global.get(HEAP_PTR), i32.add(local.get("$len"), i32.const(GC_OBJECT_HEADER_SIZE))),
      ),
      memory.copy(
        local.get("$new_ptr"),
        local.get("$ptr"),
        i32.add(local.get("$len"), i32.const(GC_OBJECT_HEADER_SIZE)),
      ),

      // forwarding metadata is encoded in from-space memory at $ptr as an i64:
      // upper 32 bits = forwarding address, lower 32 bits carries forwarding bit (2nd leftmost bit)
      i32.store(local.get("$ptr"), local.get("$new_ptr")),
      i32.store(i32.add(local.get("$ptr"), i32.const(4)), i32.const(ENV_FORWARDING_BIT)),

      wasm.return(
        i64.or(
          i64.shl(i64.extend_i32_u(local.get("$new_ptr")), i64.const(32)),
          i64.extend_i32_u(local.get("$len")),
        ),
      ),
    ),

    // closure: payload low 32 bits is parent env pointer
    wasm.if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.CLOSURE))).then(
      local.set("$new_ptr", i32.wrap_i64(local.get("$val"))),

      // null parent env means top-level closure: nothing to rewrite
      wasm.if(local.get("$new_ptr")).then(
        // keep high 32 bits, replace low 32 parent env with forwarded/copied env pointer
        wasm.return(
          i64.or(
            i64.and(local.get("$val"), i64.const(BigInt("0xffffffff00000000"))),
            wasm
              .call(COPY_FX_NAME)
              .args(i32.const(GC_SPECIAL_TAG.ENV), i64.extend_i32_u(local.get("$new_ptr"))),
          ),
        ),
      ),
    ),

    // call return address: payload low 32 bits is the saved env pointer
    wasm.if(i32.eq(local.get("$tag"), i32.const(SHADOW_STACK_TAG.CALL_RETURN_ADDR))).then(
      local.set("$new_ptr", i32.wrap_i64(local.get("$val"))),

      wasm
        .if(local.get("$new_ptr"))
        .then(
          wasm.return(
            wasm
              .call(COPY_FX_NAME)
              .args(i32.const(GC_SPECIAL_TAG.ENV), i64.extend_i32_u(local.get("$new_ptr"))),
          ),
        ),
    ),

    // lists, tuples, and list_state: upper 32 is pointer, lower 32 is length
    wasm
      .if(
        i32.or(
          i32.or(
            i32.eq(local.get("$tag"), i32.const(TYPE_TAG.LIST)),
            i32.eq(local.get("$tag"), i32.const(TYPE_TAG.TUPLE)),
          ),
          i32.eq(local.get("$tag"), i32.const(SHADOW_STACK_TAG.LIST_STATE)),
        ),
      )
      .then(
        local.set("$ptr", i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(32)))),
        local.set("$len", i32.wrap_i64(local.get("$val"))),

        // forwarding metadata is encoded in from-space memory at $ptr as an i64:
        // upper 32 bits = forwarding address, lower 32 bits carries forwarding bit (2nd leftmost bit)
        wasm
          .if(
            i32.eq(
              i32.load(i32.add(local.get("$ptr"), i32.const(4))),
              i32.const(ENV_FORWARDING_BIT),
            ),
          )
          .then(
            wasm.return(
              i64.or(
                i64.shl(i64.extend_i32_u(i32.load(local.get("$ptr"))), i64.const(32)),
                i64.extend_i32_u(local.get("$len")),
              ),
            ),
          ),

        local.set("$new_ptr", global.get(HEAP_PTR)),
        global.set(
          HEAP_PTR,
          i32.add(
            global.get(HEAP_PTR),
            i32.add(i32.mul(local.get("$len"), i32.const(12)), i32.const(GC_OBJECT_HEADER_SIZE)),
          ),
        ),
        memory.copy(
          local.get("$new_ptr"),
          local.get("$ptr"),
          i32.add(i32.mul(local.get("$len"), i32.const(12)), i32.const(GC_OBJECT_HEADER_SIZE)),
        ),

        // install forwarding metadata in from-space memory
        // (overwrite length with the forwarding bit)
        i32.store(local.get("$ptr"), local.get("$new_ptr")),
        i32.store(i32.add(local.get("$ptr"), i32.const(4)), i32.const(ENV_FORWARDING_BIT)),

        local.set("$i", i32.const(0)),
        wasm.loop("$copy_list_fields").body(
          wasm.if(i32.lt_u(local.get("$i"), local.get("$len"))).then(
            local.set(
              "$elem_ptr",
              i32.add(
                i32.add(local.get("$new_ptr"), i32.const(GC_OBJECT_HEADER_SIZE)),
                i32.mul(local.get("$i"), i32.const(12)),
              ),
            ),
            local.set("$elem_tag", i32.load(local.get("$elem_ptr"))),

            wasm
              .if(wasm.call(IS_TAG_GCABLE).args(local.get("$elem_tag")))
              .then(
                i64.store(
                  i32.add(local.get("$elem_ptr"), i32.const(4)),
                  wasm
                    .call(COPY_FX_NAME)
                    .args(
                      local.get("$elem_tag"),
                      i64.load(i32.add(local.get("$elem_ptr"), i32.const(4))),
                    ),
                ),
              ),

            local.set("$i", i32.add(local.get("$i"), i32.const(1))),
            wasm.br("$copy_list_fields"),
          ),
        ),

        wasm.return(
          i64.or(
            i64.shl(i64.extend_i32_u(local.get("$new_ptr")), i64.const(32)),
            i64.extend_i32_u(local.get("$len")),
          ),
        ),
      ),

    // call env state: upper 32 = env pointer
    wasm.if(i32.eq(local.get("$tag"), i32.const(SHADOW_STACK_TAG.CALL_NEW_ENV))).then(
      local.set("$new_ptr", i32.wrap_i64(i64.shr_u(local.get("$val"), i64.const(32)))),

      // null env pointer means there is no env payload to rewrite
      wasm
        .if(local.get("$new_ptr"))
        .then(
          wasm.return(
            i64.or(
              i64.shl(
                wasm
                  .call(COPY_FX_NAME)
                  .args(i32.const(GC_SPECIAL_TAG.ENV), i64.extend_i32_u(local.get("$new_ptr"))),
                i64.const(32),
              ),
              i64.and(local.get("$val"), i64.const(0xffffffff)),
            ),
          ),
        ),
    ),

    wasm.return(local.get("$val")),
  );

export const COLLECT_FX = wasm
  .func("$_collect")
  .locals({ $shadow_ptr: i32, $temp_start: i32, $temp_end: i32 })
  .body(
    local.set("$shadow_ptr", global.get(SHADOW_STACK_PTR)),
    global.set(HEAP_PTR, global.get(TO_SPACE_START_PTR)),

    // Root copying; transitive copying happens in $_copy.
    wasm
      .if(global.get(CURR_ENV))
      .then(
        global.set(
          CURR_ENV,
          i32.wrap_i64(
            wasm
              .call(COPY_FX)
              .args(i32.const(GC_SPECIAL_TAG.ENV), i64.extend_i32_u(global.get(CURR_ENV))),
          ),
        ),
      ),

    // copy live objects in shadow stack to to-space
    wasm.loop("$copy_loop").body(
      wasm.if(i32.lt_u(local.get("$shadow_ptr"), global.get(SHADOW_STACK_TOP))).then(
        i64.store(
          i32.add(local.get("$shadow_ptr"), i32.const(4)),
          wasm
            .call(COPY_FX)
            .args(
              i32.load(local.get("$shadow_ptr")),
              i64.load(i32.add(local.get("$shadow_ptr"), i32.const(4))),
            ),
        ),

        local.set(
          "$shadow_ptr",
          i32.add(local.get("$shadow_ptr"), i32.const(SHADOW_STACK_SLOT_SIZE)),
        ),
        wasm.br("$copy_loop"),
      ),
    ),

    // swap from-space and to-space
    local.set("$temp_start", global.get(FROM_SPACE_START_PTR)),
    local.set("$temp_end", global.get(FROM_SPACE_END_PTR)),

    global.set(FROM_SPACE_START_PTR, global.get(TO_SPACE_START_PTR)),
    global.set(FROM_SPACE_END_PTR, global.get(TO_SPACE_END_PTR)),
    global.set(TO_SPACE_START_PTR, local.get("$temp_start")),
    global.set(TO_SPACE_END_PTR, local.get("$temp_end")),
  );

// returns allocated block start address and moves heap pointer by amount bytes
export const MALLOC_FX = wasm
  .func("$_malloc")
  .params({ $amount: i32 })
  .locals({ $new_heap: i32 })
  .results(i32)
  .body(
    local.set("$new_heap", i32.add(global.get(HEAP_PTR), local.get("$amount"))),

    wasm.if(i32.gt_u(local.get("$new_heap"), global.get(FROM_SPACE_END_PTR))).then(
      wasm.call(COLLECT_FX),
      local.set("$new_heap", i32.add(global.get(HEAP_PTR), local.get("$amount"))),

      wasm
        .if(i32.gt_u(local.get("$new_heap"), global.get(FROM_SPACE_END_PTR)))
        .then(
          wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.OUT_OF_MEMORY))),
          wasm.unreachable(),
        ),
    ),

    global.get(HEAP_PTR),
    global.set(HEAP_PTR, local.get("$new_heap")),
  );

export const CLEAR_GC_HEADER_FX = wasm
  .func("$_clear_gc_header")
  .params({ $ptr: i32 })
  .results(i32)
  .body(i64.store(local.get("$ptr"), i64.const(0)), local.get("$ptr"));
