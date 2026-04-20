import { i32, i64, wasm, WasmCall, WasmInstruction } from "@sourceacademy/wasm-util";
import { Group, GroupName } from "../../stdlib/utils";
import {
  ARITY_FX,
  BOOLISE_FX,
  ERROR_MAP,
  GEN_LIST_FX,
  GET_LEX_ADDR_FX,
  GET_LIST_ELEMENT_FX,
  getErrorIndex,
  IS_BOOL_FX,
  IS_COMPLEX_FX,
  IS_FLOAT_FX,
  IS_FUNCTION_FX,
  IS_INT_FX,
  IS_LIST_FX,
  IS_NONE_FX,
  IS_PAIR_FX,
  IS_STRING_FX,
  LIST_LENGTH_FX,
  LOG_FX,
  MAKE_INT_FX,
  MAKE_LINKED_LIST_FX,
  MAKE_PAIR_FX,
  PARSE_FX,
  SET_LIST_ELEMENT_FX,
  TOKENIZE_FX,
  TYPE_TAG,
} from "./runtime";

type TupleOf<T, N extends number, R extends unknown[] = []> = R["length"] extends N
  ? R
  : TupleOf<T, N, [...R, T]>;

export type LibFuncType = {
  name: string;
  arity: number;
  isVoid: boolean;
  hasVarArgs: boolean;
  body: WasmInstruction[];
};

const funcHelper = <Arity extends number, HasVarArgs extends boolean = false>(
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
      ...([...Array(arity + (hasVarArgs ? 1 : 0)).keys()].map(i =>
        wasm.call(GET_LEX_ADDR_FX).args(i32.const(0), i32.const(i)),
      ) as HasVarArgs extends true
        ? [...TupleOf<WasmCall, Arity>, WasmCall]
        : TupleOf<WasmCall, Arity>),
    );

    body = Array.isArray(body) ? body : [body];
    return { name, arity, isVoid: !!isVoid, hasVarArgs: !!hasVarArgs, body };
  },
});

const stdlib: LibFuncType[] = [
  funcHelper("print", 1, true).body(x => wasm.call(LOG_FX).args(x)),
  funcHelper("repr", 1, true).body(x => wasm.call(LOG_FX).args(x)),
  funcHelper("error", 1, true).body(x => [wasm.call(LOG_FX).args(x), wasm.unreachable()]),
  funcHelper("_gen_list", 1).body(x => wasm.call(GEN_LIST_FX).args(x)),
  funcHelper("arity", 1).body(x => wasm.call(ARITY_FX).args(x)),

  funcHelper("bool", 1).body(x => [i32.const(TYPE_TAG.BOOL), wasm.call(BOOLISE_FX).args(x)]),
  funcHelper("is_int", 1).body(x => wasm.call(IS_INT_FX).args(x)),
  funcHelper("is_float", 1).body(x => wasm.call(IS_FLOAT_FX).args(x)),
  funcHelper("is_complex", 1).body(x => wasm.call(IS_COMPLEX_FX).args(x)),
  funcHelper("is_string", 1).body(x => wasm.call(IS_STRING_FX).args(x)),
  funcHelper("is_boolean", 1).body(x => wasm.call(IS_BOOL_FX).args(x)),
  funcHelper("is_function", 1).body(x => wasm.call(IS_FUNCTION_FX).args(x)),
  funcHelper("is_none", 1).body(x => wasm.call(IS_NONE_FX).args(x)),
];

const linkedListLib: LibFuncType[] = [
  funcHelper("pair", 2).body((x, y) => wasm.call(MAKE_PAIR_FX).args(x, y)),
  funcHelper("is_pair", 1).body(x => wasm.call(IS_PAIR_FX).args(x)),
  funcHelper("head", 1).body(x => [
    wasm
      .if(i32.eqz(wasm.raw`${wasm.call(IS_PAIR_FX).args(x)} (i32.wrap_i64)`))
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.HEAD_NOT_PAIR))),
        wasm.unreachable(),
      ),

    wasm.call(GET_LIST_ELEMENT_FX).args(x, wasm.call(MAKE_INT_FX).args(i64.const(0))),
  ]),
  funcHelper("tail", 1).body(x => [
    wasm
      .if(i32.eqz(wasm.raw`${wasm.call(IS_PAIR_FX).args(x)} (i32.wrap_i64)`))
      .then(
        wasm.call("$_log_error").args(i32.const(getErrorIndex(ERROR_MAP.TAIL_NOT_PAIR))),
        wasm.unreachable(),
      ),

    wasm.call(GET_LIST_ELEMENT_FX).args(x, wasm.call(MAKE_INT_FX).args(i64.const(1))),
  ]),
  funcHelper("linked_list", 0, false, true).body(x => wasm.call(MAKE_LINKED_LIST_FX).args(x)),
];

const pairMutatorLib: LibFuncType[] = [
  funcHelper("set_head", 2, true).body((x, y) =>
    wasm.call(SET_LIST_ELEMENT_FX).args(x, wasm.call(MAKE_INT_FX).args(i64.const(0)), y),
  ),
  funcHelper("set_tail", 2, true).body((x, y) =>
    wasm.call(SET_LIST_ELEMENT_FX).args(x, wasm.call(MAKE_INT_FX).args(i64.const(1)), y),
  ),
];

const listLib: LibFuncType[] = [
  funcHelper("list_length", 1).body(x => wasm.call(LIST_LENGTH_FX).args(x)),
  funcHelper("is_list", 1).body(x => wasm.call(IS_LIST_FX).args(x)),
];

const mceLib: LibFuncType[] = [
  funcHelper("tokenize", 1).body(x => wasm.call(TOKENIZE_FX).args(x)),
  funcHelper("parse", 1).body(x => wasm.call(PARSE_FX).args(x)),
];

export function makeLibraryFunctions(groups?: Group[]): LibFuncType[] {
  if (groups == null) {
    return [...stdlib, ...linkedListLib, ...pairMutatorLib, ...listLib, ...mceLib];
  }

  return [
    ...stdlib,
    ...(groups.some(group => group.name === GroupName.LINKED_LISTS) ? linkedListLib : []),
    ...(groups.some(group => group.name === GroupName.PAIRMUTATORS) ? pairMutatorLib : []),
    ...(groups.some(group => group.name === GroupName.LIST) ? listLib : []),
    ...(groups.some(group => group.name === GroupName.MCE) ? mceLib : []),
  ];
}
