import {
  WasmCall,
  WasmInstruction,
  i32,
  i64,
  wasm,
} from "@sourceacademy/wasm-util";
import {
  BOOLISE_FX,
  GET_LEX_ADDR_FX,
  GET_LIST_ELEMENT_FX,
  IS_LINKED_LIST_FX,
  IS_PAIR_FX,
  LIST_LENGTH_FX,
  LOG_FX,
  MAKE_BOOL_FX,
  MAKE_INT_FX,
  MAKE_LINKED_LIST_FX,
  MAKE_PAIR_FX,
  PARSE_FX,
  SET_LIST_ELEMENT_FX,
  TOKENIZE_FX,
  TYPE_TAG,
} from "./constants";

type TupleOf<
  T,
  N extends number,
  R extends unknown[] = [],
> = R["length"] extends N ? R : TupleOf<T, N, [...R, T]>;

export type LibFuncType = {
  name: string;
  arity: number;
  isVoid: boolean;
  hasVarArgs: boolean;
  body: WasmInstruction[];
};

const libFunc = <Arity extends number, HasVarArgs extends boolean = false>(
  name: string,
  arity: Arity,
  isVoid?: boolean,
  hasVarArgs?: HasVarArgs,
) => ({
  body: (
    mapper: (
      ...args: HasVarArgs extends true
        ? [...TupleOf<WasmCall, Arity>, WasmCall]
        : TupleOf<WasmCall, Arity>
    ) => WasmInstruction | WasmInstruction[],
  ) => {
    let body = mapper(
      ...([...Array(arity + (hasVarArgs ? 1 : 0)).keys()].map((i) =>
        wasm.call(GET_LEX_ADDR_FX).args(i32.const(0), i32.const(i)),
      ) as HasVarArgs extends true
        ? [...TupleOf<WasmCall, Arity>, WasmCall]
        : TupleOf<WasmCall, Arity>),
    );

    body = Array.isArray(body) ? body : [body];
    return { name, arity, isVoid: !!isVoid, hasVarArgs: !!hasVarArgs, body };
  },
});

export const libraryFunctions: LibFuncType[] = [
  libFunc("print", 1, true).body((x) => wasm.call(LOG_FX).args(x)),

  // pair & linked list functions
  libFunc("pair", 2).body((x, y) => wasm.call(MAKE_PAIR_FX).args(x, y)),
  libFunc("is_pair", 1).body((x) => wasm.call(IS_PAIR_FX).args(x)),
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
  libFunc("is_none", 1).body(
    (x) =>
      wasm.raw`${x} (drop) (i32.const ${TYPE_TAG.NONE}) (i32.eq) (call ${MAKE_BOOL_FX.name})`,
  ),
  libFunc("is_linked_list", 1).body((x) =>
    wasm.call(IS_LINKED_LIST_FX).args(x),
  ),
  libFunc("linked_list", 0, false, true).body((x) =>
    wasm.call(MAKE_LINKED_LIST_FX).args(x),
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

  // list functions
  libFunc("list_length", 1).body((x) => wasm.call(LIST_LENGTH_FX).args(x)),
  libFunc("is_list", 1).body(
    (x) =>
      wasm.raw`${x} (drop) (i32.const ${TYPE_TAG.LIST}) (i32.eq) (call ${MAKE_BOOL_FX.name})`,
  ),

  libFunc("bool", 1).body((x) => [
    i32.const(TYPE_TAG.BOOL),
    wasm.call(BOOLISE_FX).args(x),
  ]),

  libFunc("tokenize", 1).body((x) => wasm.call(TOKENIZE_FX).args(x)),
  libFunc("parse", 1).body((x) => wasm.call(PARSE_FX).args(x)),
];
