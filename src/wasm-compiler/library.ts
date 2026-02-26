import {
  WasmCall,
  WasmInstruction,
  wasm,
  i32,
  global,
  i64,
} from "@sourceacademy/wasm-util";
import {
  GET_LEX_ADDR_FX,
  LOG_FX,
  TYPE_TAG,
  BOOLISE_FX,
  HEAP_PTR,
  SET_CONTIGUOUS_BLOCK_FX,
  MAKE_LIST_FX,
  GET_LIST_ELEMENT_FX,
  MAKE_INT_FX,
  SET_LIST_ELEMENT_FX,
} from "./constants";

type TupleOf<
  T,
  N extends number,
  R extends unknown[] = [],
> = R["length"] extends N ? R : TupleOf<T, N, [...R, T]>;

const libFunc = <Arity extends number>(
  name: string,
  arity: Arity,
  isVoid?: boolean,
  hasVarArgs?: boolean,
) => ({
  body: (
    mapper: (
      ...args: TupleOf<WasmCall, Arity>
    ) => WasmInstruction | WasmInstruction[],
  ) => {
    let body = mapper(
      ...([...Array(arity).keys()].map((i) =>
        wasm.call(GET_LEX_ADDR_FX).args(i32.const(0), i32.const(i)),
      ) as TupleOf<WasmCall, Arity>),
    );

    body = Array.isArray(body) ? body : [body];
    return { name, arity, isVoid: !!isVoid, hasVarArgs: !!hasVarArgs, body };
  },
});

export const libraryFunctions = [
  libFunc("print", 1, true).body((x) => wasm.call(LOG_FX).args(x)),
  libFunc("pair", 2).body((x, y) => [
    global.get(HEAP_PTR),
    global.set(HEAP_PTR, i32.add(global.get(HEAP_PTR), i32.const(24))),

    wasm.raw`(i32.const 0) ${x} (i32.const 0) (call ${SET_CONTIGUOUS_BLOCK_FX.name})`,
    wasm.raw`(i32.const 1) ${y} (i32.const 0) (call ${SET_CONTIGUOUS_BLOCK_FX.name})`,

    wasm.raw`(i32.const 2) (call ${MAKE_LIST_FX.name})`,
  ]),
  libFunc("head", 1).body((x) =>
    wasm
      .call(GET_LIST_ELEMENT_FX)
      .args(x, wasm.call(MAKE_INT_FX).args(i64.const(0))),
  ),
  libFunc("tail", 1).body((x) =>
    wasm
      .call(GET_LIST_ELEMENT_FX)
      .args(x, wasm.call(MAKE_INT_FX).args(i64.const(1))),
  ),
  libFunc("set_head", 2, true).body((x, y) =>
    wasm
      .call(SET_LIST_ELEMENT_FX)
      .args(x, wasm.call(MAKE_INT_FX).args(i64.const(0)), y),
  ),
  libFunc("set_tail", 2, true).body((x, y) =>
    wasm
      .call(SET_LIST_ELEMENT_FX)
      .args(x, wasm.call(MAKE_INT_FX).args(i64.const(1)), y),
  ),
  libFunc("bool", 1).body((x) => [
    i32.const(TYPE_TAG.BOOL),
    wasm.call(BOOLISE_FX).args(x),
  ]),
];
