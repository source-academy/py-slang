// ------------------------ WASM Numeric Types & Constants ----------------------------

type WasmLabel = `$${string}`;

type WasmIntNumericType = "i32" | "i64";
type WasmFloatNumericType = "f32" | "f64";
type WasmNumericType = WasmIntNumericType | WasmFloatNumericType;

const floatUnaryOp = [
  "neg",
  "abs",
  "sqrt",
  "ceil",
  "floor",
  "trunc",
  "nearest",
] as const;
const intBinaryOp = [
  "add",
  "sub",
  "mul",
  "div_s",
  "div_u",
  "and",
  "or",
  "xor",
  "shl",
  "shr_s",
  "shr_u",
] as const;
const floatBinaryOp = ["add", "sub", "mul", "div"] as const;
const intTestOp = ["eqz"] as const;
const intComparisonOp = [
  "eq",
  "ne",
  "lt_s",
  "lt_u",
  "gt_s",
  "gt_u",
  "le_s",
  "le_u",
  "ge_s",
  "ge_u",
] as const;
const floatComparisonOp = ["eq", "ne", "lt", "gt", "le", "ge"] as const;
const intConversionOp = [
  "trunc_f32_s",
  "trunc_f32_u",
  "trunc_f64_s",
  "trunc_f64_u",
] as const;
const i32ConversionOp = ["wrap_i64", "reinterpret_f32"] as const;
const i64ConversionOp = [
  "extend_i32_s",
  "extend_i32_u",
  "reinterpret_f64",
] as const;
const floatConversionOp = [
  "convert_i32_s",
  "convert_i32_u",
  "convert_i64_s",
  "convert_i64_u",
] as const;
const f32ConversionOp = ["demote_f64", "reinterpret_i32"] as const;
const f64ConversionOp = ["promote_f32", "reinterpret_i64"] as const;

type FloatUnaryOp = (typeof floatUnaryOp)[number];
type IntBinaryOp = (typeof intBinaryOp)[number];
type FloatBinaryOp = (typeof floatBinaryOp)[number];
type IntTestOp = (typeof intTestOp)[number];
type IntComparisonOp = (typeof intComparisonOp)[number];
type FloatComparisonOp = (typeof floatComparisonOp)[number];
type IntConversionOp = (typeof intConversionOp)[number];
type I32ConversionOp = (typeof i32ConversionOp)[number];
type I64ConversionOp = (typeof i64ConversionOp)[number];
type FloatConversionOp = (typeof floatConversionOp)[number];
type F32ConversionOp = (typeof f32ConversionOp)[number];
type F64ConversionOp = (typeof f64ConversionOp)[number];

// ------------------------ WASM Numeric Instructions ----------------------------

type WasmNumericConst<T extends WasmNumericType> = {
  op: `${T}.const`;
  value: T extends WasmIntNumericType ? bigint : number;
};

type WasmUnaryOp<T extends WasmFloatNumericType> = {
  [Op in FloatUnaryOp]: { op: `${T}.${Op}`; right: WasmNumericFor<T> };
}[FloatUnaryOp];

type WasmBinaryOp<T extends WasmNumericType> = T extends WasmIntNumericType
  ? {
      [Op in IntBinaryOp]: {
        op: `${T}.${Op}`;
        left: WasmNumericFor<T>;
        right: WasmNumericFor<T>;
      };
    }[IntBinaryOp]
  : T extends WasmFloatNumericType
  ? {
      [Op in FloatBinaryOp]: {
        op: `${T}.${Op}`;
        left: WasmNumericFor<T>;
        right: WasmNumericFor<T>;
      };
    }[FloatBinaryOp]
  : never;

type WasmIntTestOp<T extends WasmIntNumericType> = {
  [Op in IntTestOp]: { op: `${T}.${Op}`; right: WasmNumericFor<T> };
}[IntTestOp];

type WasmComparisonOp<T extends WasmNumericType> = T extends WasmIntNumericType
  ? {
      [Op in IntComparisonOp]: {
        op: `${T}.${Op}`;
        left: WasmNumericFor<T>;
        right: WasmNumericFor<T>;
      };
    }[IntComparisonOp]
  : T extends WasmFloatNumericType
  ? {
      [Op in FloatComparisonOp]: {
        op: `${T}.${Op}`;
        left: WasmNumericFor<T>;
        right: WasmNumericFor<T>;
      };
    }[FloatComparisonOp]
  : never;

type ExtractConversion<I extends string> = I extends `${string}_${infer T}`
  ? T extends WasmNumericType
    ? T
    : T extends `${infer U}_${string}`
    ? U
    : never
  : never;

type WasmConversionOpHelper<I> = I extends
  | `i32.${I32ConversionOp | IntConversionOp}`
  | `i64.${I64ConversionOp | IntConversionOp}`
  | `f32.${F32ConversionOp | FloatConversionOp}`
  | `f64.${F64ConversionOp | FloatConversionOp}`
  ? { op: I; right: WasmNumericFor<ExtractConversion<I>> }
  : never;

type WasmConversionOp<T extends WasmNumericType> =
  WasmConversionOpHelper<`${T}.${T extends "i32"
    ? I32ConversionOp | IntConversionOp
    : T extends "i64"
    ? I64ConversionOp | IntConversionOp
    : T extends "f32"
    ? F32ConversionOp | FloatConversionOp
    : F64ConversionOp | FloatConversionOp}`>;

type WasmLoadOpFor<T extends WasmNumericType> = {
  op: `${T}.load`;
  address: WasmNumericFor<"i32">;
};
type WasmLoadNarrowFor<T extends WasmIntNumericType> = {
  op: `${T}.load${
    | "8_s"
    | "8_u"
    | "16_s"
    | "16_u"
    | (T extends "i64" ? "32_s" | "32_u" : never)}`;
  address: WasmNumericFor<"i32">;
};

type WasmLoad =
  | WasmLoadOpFor<"i32">
  | WasmLoadOpFor<"i64">
  | WasmLoadOpFor<"f32">
  | WasmLoadOpFor<"f64">
  | WasmLoadNarrowFor<"i32">
  | WasmLoadNarrowFor<"i64">;

type WasmStoreOpFor<T extends WasmNumericType> = {
  op: `${T}.store`;
  address: WasmNumericFor<"i32">;
  value: WasmNumericFor<T>;
};
type WasmStore =
  | WasmStoreOpFor<"i32">
  | WasmStoreOpFor<"i64">
  | WasmStoreOpFor<"f32">
  | WasmStoreOpFor<"f64">;

type WasmNumericFor<T extends WasmNumericType> =
  | WasmNumericConst<T>
  | (T extends WasmFloatNumericType ? WasmUnaryOp<T> : never)
  | WasmBinaryOp<T>
  | (T extends WasmIntNumericType ? WasmIntTestOp<T> : never)
  | WasmComparisonOp<T>
  | WasmConversionOp<T>

  // below are not numeric instructions, but the results of these are numeric
  | WasmLoad
  | WasmStore
  | WasmLocalGet
  | WasmGlobalGet
  | WasmLocalTee
  | WasmCall // call generates numeric[], but for type simplicity we assume just 1
  | WasmSelect;

type WasmNumeric =
  | WasmNumericFor<"i32">
  | WasmNumericFor<"i64">
  | WasmNumericFor<"f32">
  | WasmNumericFor<"f64">;

// ------------------------ WASM Variable Instructions ----------------------------

type WasmLocalSet = { op: "local.set"; label: WasmLabel; right: WasmNumeric };
type WasmLocalGet = { op: "local.get"; label: WasmLabel };
type WasmLocalTee = { op: "local.tee"; label: WasmLabel; right: WasmNumeric };
type WasmGlobalSet = { op: "global.set"; label: WasmLabel; right: WasmNumeric };
type WasmGlobalGet = { op: "global.get"; label: WasmLabel };

type WasmVariable =
  | WasmLocalSet
  | WasmLocalGet
  | WasmLocalTee
  | WasmGlobalSet
  | WasmGlobalGet;

// ------------------------ WASM Memory Instructions ----------------------------
// Technically WasmStoreOp and WasmLoadOp are memory instructions, but they are defined
// together with numerics for typing.

type WasmMemoryCopy = {
  op: "memory.copy";
  destination: WasmNumericFor<"i32">;
  source: WasmNumericFor<"i32">;
  size: WasmNumericFor<"i32">;
};

type WasmMemory = WasmMemoryCopy;

// ------------------------ WASM Control Instructions ----------------------------

type WasmUnreachable = { op: "unreachable" };
type WasmDrop = { op: "drop"; value?: WasmInstruction };

type WasmBlockType = {
  paramTypes: WasmNumericType[];
  resultTypes: WasmNumericType[];
  localTypes?: WasmNumericType[];
};

type WasmBlockBase = { label?: WasmLabel; blockType: WasmBlockType };
type WasmBlock = WasmBlockBase & { op: "block"; body: WasmInstruction[] };
type WasmLoop = WasmBlockBase & { op: "loop"; body: WasmInstruction[] };
type WasmIf = WasmBlockBase & {
  op: "if";
  predicate: WasmNumeric;
  thenBody: WasmInstruction[];
  elseBody?: WasmInstruction[];
};
type WasmBr = { op: "br"; label: WasmLabel };
type WasmBrTable = { op: "br_table"; labels: WasmLabel[]; value: WasmNumeric };
type WasmCall = { op: "call"; function: WasmLabel; arguments: WasmNumeric[] };
type WasmReturn = { op: "return"; values: WasmNumeric[] };
type WasmSelect = {
  op: "select";
  first: WasmNumeric;
  second: WasmNumeric;
  condition: WasmNumeric;
};

type WasmControl =
  | WasmBlock
  | WasmLoop
  | WasmIf
  | WasmUnreachable
  | WasmDrop
  | WasmBr
  | WasmBrTable
  | WasmCall
  | WasmReturn
  | WasmSelect;

// ------------------------ WASM Module Instructions ----------------------------

type WasmLocals = Record<WasmLabel, WasmNumericType>;
type WasmFuncType = {
  paramTypes: WasmLocals;
  resultTypes: WasmNumericType[];
  localTypes: WasmLocals;
};
type WasmExternType =
  | { type: "memory"; limits: { initial: number; maximum?: number } }
  | { type: "func"; name: WasmLabel; funcType: WasmBlockType };
type WasmImport = {
  op: "import";
  moduleName: string;
  itemName: string;
  externType: WasmExternType;
};

type WasmGlobalFor<T extends WasmNumericType> = {
  op: "global";
  name: WasmLabel;
  valueType: T | `mut ${T}`;
  initialValue: WasmNumericFor<T>;
};
type WasmGlobal =
  | WasmGlobalFor<"i32">
  | WasmGlobalFor<"i64">
  | WasmGlobalFor<"f32">
  | WasmGlobalFor<"f64">;

type WasmData = { op: "data"; offset: WasmNumericFor<"i32">; data: string };
type WasmFunction = {
  op: "func";
  name: WasmLabel;
  funcType: WasmFuncType;
  body: Exclude<WasmInstruction, WasmFunction>[];
};
type WasmStart = { op: "start"; functionName: WasmLabel };
type WasmExport = { op: "export"; name: string; externType: WasmExternType };

type WasmModule = {
  op: "module";
  imports: WasmImport[];
  globals: WasmGlobal[];
  datas: WasmData[];
  funcs: WasmFunction[];
  startFunc?: WasmStart;
  exports: WasmExport[];
};

type WasmModuleInstruction =
  | WasmImport
  | WasmGlobal
  | WasmData
  | WasmFunction
  | WasmExport
  | WasmStart
  | WasmModule;

type WasmInstruction =
  | WasmNumeric
  | WasmMemory
  | WasmControl
  | WasmVariable
  | WasmModuleInstruction;

// ------------------------ WASM Builder API ----------------------------

const typedFromEntries = <const T extends readonly [PropertyKey, unknown][]>(
  entries: T
) => Object.fromEntries(entries) as { [K in T[number] as K[0]]: K[1] };

const binaryOp = <
  T extends WasmNumericType,
  const Op extends ((
    | WasmBinaryOp<T>
    | WasmComparisonOp<T>
  )["op"] extends `${T}.${infer S}`
    ? S
    : never)[]
>(
  type: T,
  ops: Op
) =>
  typedFromEntries(
    ops.map((op) => {
      const fn = (left: WasmNumericFor<T>, right: WasmNumericFor<T>) => ({
        op: `${type}.${op}`,
        left,
        right,
      });
      return [op, fn];
    }) as {
      [K in keyof Op]: [
        Op[K],
        (
          ...args: Extract<WasmNumericFor<T>, { op: `${T}.${Op[K]}` }> extends {
            left: infer L;
            right: infer R;
          }
            ? [left: L, right: R]
            : never
        ) => Extract<WasmNumericFor<T>, { op: `${T}.${Op[K]}` }>
      ];
    }
  );

const unaryOp = <
  T extends WasmNumericType,
  const Op extends ((
    | WasmConversionOp<T>
    | (T extends WasmIntNumericType
        ? WasmIntTestOp<T>
        : T extends WasmFloatNumericType
        ? WasmUnaryOp<T>
        : never)
  )["op"] extends `${T}.${infer S}`
    ? S
    : never)[]
>(
  type: T,
  ops: Op
) =>
  typedFromEntries(
    ops.map((op) => {
      const fn = (right: WasmNumericFor<T>) => ({
        op: `${type}.${op}`,
        right,
      });
      return [op, fn];
    }) as {
      [K in keyof Op]: [
        Op[K],
        (
          ...args: Extract<WasmNumericFor<T>, { op: `${T}.${Op[K]}` }> extends {
            right: infer R;
          }
            ? [right: R]
            : never
        ) => Extract<WasmNumericFor<T>, { op: `${T}.${Op[K]}` }>
      ];
    }
  );

const i32Load = (address: WasmNumericFor<"i32">): WasmLoadOpFor<"i32"> => ({
  op: "i32.load",
  address,
});
const i32 = {
  const: (value: number | bigint): WasmNumericConst<"i32"> => ({
    op: "i32.const",
    value: BigInt(value),
  }),
  ...binaryOp("i32", [...intBinaryOp, ...intComparisonOp]),
  ...unaryOp("i32", [...i32ConversionOp, ...intConversionOp, ...intTestOp]),
  load: i32Load,
  load8_s: i32Load,
  load8_u: i32Load,
  load16_s: i32Load,
  load16_u: i32Load,
  store: (
    address: WasmNumericFor<"i32">,
    value: WasmNumericFor<"i32">
  ): WasmStoreOpFor<"i32"> => ({ op: "i32.store", address, value }),
};

const i64Load = (address: WasmNumericFor<"i32">): WasmLoadOpFor<"i64"> => ({
  op: "i64.load",
  address,
});
const i64 = {
  const: (value: number | bigint): WasmNumericConst<"i64"> => ({
    op: "i64.const",
    value: BigInt(value),
  }),
  ...binaryOp("i64", [...intBinaryOp, ...intComparisonOp]),
  ...unaryOp("i64", [...i64ConversionOp, ...intConversionOp, ...intTestOp]),
  load: i64Load,
  load8_s: i64Load,
  load8_u: i64Load,
  load16_s: i64Load,
  load16_u: i64Load,
  load32_s: i64Load,
  load32_u: i64Load,
  store: (
    address: WasmNumericFor<"i32">,
    value: WasmNumericFor<"i64">
  ): WasmStoreOpFor<"i64"> => ({ op: "i64.store", address, value }),
};

const f32 = {
  const: (value: number): WasmNumericConst<"f32"> => ({
    op: "f32.const",
    value,
  }),
  ...binaryOp("f32", [...floatBinaryOp, ...floatComparisonOp]),
  ...unaryOp("f32", [
    ...f32ConversionOp,
    ...floatConversionOp,
    ...floatUnaryOp,
  ]),
  load: (address: WasmNumericFor<"i32">): WasmLoadOpFor<"f32"> => ({
    op: "f32.load",
    address,
  }),
  store: (
    address: WasmNumericFor<"i32">,
    value: WasmNumericFor<"f32">
  ): WasmStoreOpFor<"f32"> => ({ op: "f32.store", address, value }),
};

const f64 = {
  const: (value: number): WasmNumericConst<"f64"> => ({
    op: "f64.const",
    value,
  }),
  ...binaryOp("f64", [...floatBinaryOp, ...floatComparisonOp]),
  ...unaryOp("f64", [
    ...f64ConversionOp,
    ...floatConversionOp,
    ...floatUnaryOp,
  ]),
  load: (address: WasmNumericFor<"i32">): WasmLoadOpFor<"f64"> => ({
    op: "f64.load",
    address,
  }),
  store: (
    address: WasmNumericFor<"i32">,
    value: WasmNumericFor<"f64">
  ): WasmStoreOpFor<"f64"> => ({ op: "f64.store", address, value }),
};

const local = {
  get: (label: WasmLabel): WasmLocalGet => ({ op: "local.get", label }),
  set: (label: WasmLabel, right: WasmNumeric): WasmLocalSet => ({
    op: "local.set",
    label,
    right,
  }),
  tee: (label: WasmLabel, right: WasmNumeric): WasmLocalTee => ({
    op: "local.tee",
    label,
    right,
  }),
};

const global = {
  get: (label: WasmLabel): WasmGlobalGet => ({ op: "global.get", label }),
  set: (label: WasmLabel, right: WasmNumeric): WasmGlobalSet => ({
    op: "global.set",
    label,
    right,
  }),
};

const memory = {
  copy: (
    destination: WasmNumericFor<"i32">,
    source: WasmNumericFor<"i32">,
    size: WasmNumericFor<"i32">
  ): WasmMemoryCopy => ({ op: "memory.copy", destination, source, size }),
};

type WasmBlockTypeHelper<T extends WasmBlock | WasmLoop> = {
  params(...params: WasmNumericType[]): WasmBlockTypeHelper<T>;
  results(...results: WasmNumericType[]): WasmBlockTypeHelper<T>;
  locals(...locals: WasmNumericType[]): WasmBlockTypeHelper<T>;

  body: (...instrs: WasmInstruction[]) => T;
};

type WasmIfBlockTypeHelper = {
  params(...params: WasmNumericType[]): WasmIfBlockTypeHelper;
  results(...results: WasmNumericType[]): WasmIfBlockTypeHelper;
  locals(...locals: WasmNumericType[]): WasmIfBlockTypeHelper;

  then: (...thenInstrs: WasmInstruction[]) => WasmIf & {
    else: (...elseInstrs: WasmInstruction[]) => WasmIf;
  };
};

type WasmFuncTypeHelper = {
  params: (params: WasmLocals) => WasmFuncTypeHelper;
  locals: (locals: WasmLocals) => WasmFuncTypeHelper;
  results: (...results: WasmNumericType[]) => WasmFuncTypeHelper;

  body: (...instrs: Exclude<WasmInstruction, WasmFunction>[]) => WasmFunction;
};

type WasmModuleHelper = {
  imports: (...imports: WasmImport[]) => WasmModuleHelper;
  globals: (...globals: WasmGlobal[]) => WasmModuleHelper;
  datas: (...datas: WasmData[]) => WasmModuleHelper;
  funcs: (...funcs: WasmFunction[]) => WasmModuleHelper;
  startFunc: (startFunc: WasmLabel) => Omit<WasmModuleHelper, "startFunc">;
  exports: (...exports: WasmExport[]) => WasmModuleHelper;

  build: () => WasmModule;
};

const wasm = {
  block: (
    label?: WasmLabel,
    blockType: WasmBlockType = {
      paramTypes: [],
      resultTypes: [],
      localTypes: [],
    }
  ): WasmBlockTypeHelper<WasmBlock> => ({
    params: (...params) =>
      wasm.block(label, {
        ...blockType,
        paramTypes: [...blockType.paramTypes, ...params],
      }),
    locals: (...locals) =>
      wasm.block(label, {
        ...blockType,
        localTypes: [...(blockType.localTypes ?? []), ...locals],
      }),
    results: (...results) =>
      wasm.block(label, {
        ...blockType,
        resultTypes: [...blockType.resultTypes, ...results],
      }),

    body: (...instrs) => ({
      op: "block",
      blockType,
      body: instrs,
    }),
  }),
  loop: (
    label?: WasmLabel,
    blockType: WasmBlockType = {
      paramTypes: [],
      resultTypes: [],
      localTypes: [],
    }
  ): WasmBlockTypeHelper<WasmLoop> => ({
    params: (...params) =>
      wasm.loop(label, {
        ...blockType,
        paramTypes: [...blockType.paramTypes, ...params],
      }),
    locals: (...locals) =>
      wasm.loop(label, {
        ...blockType,
        localTypes: [...(blockType.localTypes ?? []), ...locals],
      }),
    results: (...results) =>
      wasm.loop(label, {
        ...blockType,
        resultTypes: [...blockType.resultTypes, ...results],
      }),

    body: (...instrs) => ({
      op: "loop",
      blockType,
      body: instrs,
    }),
  }),
  if: (
    predicate: WasmNumeric,
    label?: WasmLabel,
    blockType: WasmBlockType = {
      paramTypes: [],
      resultTypes: [],
      localTypes: [],
    }
  ): WasmIfBlockTypeHelper => ({
    params: (...params) =>
      wasm.if(predicate, label, {
        ...blockType,
        paramTypes: [...blockType.paramTypes, ...params],
      }),
    locals: (...locals) =>
      wasm.if(predicate, label, {
        ...blockType,
        localTypes: [...(blockType.localTypes ?? []), ...locals],
      }),
    results: (...results) =>
      wasm.if(predicate, label, {
        ...blockType,
        resultTypes: [...blockType.resultTypes, ...results],
      }),

    then: (...thenInstrs) => ({
      op: "if",
      predicate,
      label,
      blockType,
      thenBody: thenInstrs,

      else(...elseInstrs) {
        return { ...this, elseBody: elseInstrs };
      },
    }),
  }),
  drop: (value?: WasmInstruction): WasmDrop => ({ op: "drop", value }),
  unreachable: (): WasmUnreachable => ({ op: "unreachable" }),
  br: (label: WasmLabel): WasmBr => ({ op: "br", label }),
  br_table: (value: WasmNumeric, ...labels: WasmLabel[]): WasmBrTable => ({
    op: "br_table",
    labels,
    value,
  }),
  call: (functionName: WasmLabel) => ({
    args: (...args: WasmNumeric[]): WasmCall => ({
      op: "call",
      function: functionName,
      arguments: args,
    }),
  }),
  return: (...values: WasmNumeric[]): WasmReturn => ({ op: "return", values }),
  select: (
    first: WasmNumeric,
    second: WasmNumeric,
    condition: WasmNumeric
  ): WasmSelect => ({ op: "select", first, second, condition }),

  import: (moduleName: string, itemName: string) => ({
    memory: (initial: number, maximum?: number): WasmImport => ({
      op: "import",
      moduleName,
      itemName,
      externType: { type: "memory", limits: { initial, maximum } },
    }),

    func(
      name: WasmLabel,
      funcType: WasmBlockType = {
        paramTypes: [],
        resultTypes: [],
        localTypes: [],
      }
    ) {
      const importInstr: WasmImport = {
        op: "import",
        moduleName,
        itemName,
        externType: { type: "func", name, funcType },
      };

      return {
        ...importInstr,

        params: (...params: WasmNumericType[]) => ({
          ...importInstr,
          ...this.func(name, {
            ...funcType,
            paramTypes: [...funcType.paramTypes, ...params],
          }),
        }),

        locals: (...locals: WasmNumericType[]) => ({
          ...importInstr,
          ...this.func(name, {
            ...funcType,
            localTypes: [...(funcType.localTypes ?? []), ...locals],
          }),
        }),

        results: (...results: WasmNumericType[]) => ({
          ...importInstr,
          ...this.func(name, {
            ...funcType,
            resultTypes: [...funcType.resultTypes, ...results],
          }),
        }),
      };
    },
  }),

  global: <T extends WasmNumericType>(
    name: WasmLabel,
    valueType: T | `mut ${T}`
  ) => ({
    init: (initialValue: WasmNumericFor<T>): WasmGlobalFor<T> => ({
      op: "global",
      name,
      valueType,
      initialValue,
    }),
  }),

  func(
    name: WasmLabel,
    funcType: WasmFuncType = {
      paramTypes: {},
      resultTypes: [],
      localTypes: {},
    }
  ): WasmFuncTypeHelper {
    return {
      params: (params) =>
        this.func(name, {
          ...funcType,
          paramTypes: { ...funcType.paramTypes, ...params },
        }),
      locals: (locals) =>
        this.func(name, {
          ...funcType,
          localTypes: { ...funcType.localTypes, ...locals },
        }),
      results: (...results) =>
        this.func(name, {
          ...funcType,
          resultTypes: [...funcType.resultTypes, ...results],
        }),

      body: (...instrs) => ({ op: "func", name, funcType, body: instrs }),
    };
  },

  module(
    definitions: Omit<WasmModule, "op"> = {
      imports: [],
      globals: [],
      datas: [],
      funcs: [],
      startFunc: undefined,
      exports: [],
    }
  ): WasmModuleHelper {
    return {
      imports: (...imports) =>
        this.module({
          ...definitions,
          imports: [...definitions.imports, ...imports],
        }),
      globals: (...globals) =>
        this.module({
          ...definitions,
          globals: [...definitions.globals, ...globals],
        }),
      datas: (...datas) =>
        this.module({
          ...definitions,
          datas: [...definitions.datas, ...datas],
        }),
      funcs: (...funcs) =>
        this.module({
          ...definitions,
          funcs: [...definitions.funcs, ...funcs],
        }),
      startFunc: (startFunc) =>
        this.module({
          ...definitions,
          startFunc: {
            op: "start",
            functionName: startFunc,
          },
        }),
      exports: (...exports) =>
        this.module({
          ...definitions,
          exports: [...definitions.exports, ...exports],
        }),

      build: () => ({ op: "module", ...definitions }),
    };
  },
};

// This maps all WASM instructions to a visitor method name that will
// be used in the interface for the watGenerator

const instrToMethodMap = {
  // numerics
  "i64.const": "visitConstOp",
  "f32.const": "visitConstOp",
  "i32.const": "visitConstOp",
  "f64.const": "visitConstOp",

  // numerics: binary ops and comparisons
  ...typedFromEntries(
    [...intBinaryOp, ...intComparisonOp].map(
      (op) => [`i32.${op}`, "visitBinaryOp"] as const
    )
  ),
  ...typedFromEntries(
    [...intBinaryOp, ...intComparisonOp].map(
      (op) => [`i64.${op}`, "visitBinaryOp"] as const
    )
  ),
  ...typedFromEntries(
    [...floatBinaryOp, ...floatComparisonOp].map(
      (op) => [`f32.${op}`, "visitBinaryOp"] as const
    )
  ),
  ...typedFromEntries(
    [...floatBinaryOp, ...floatComparisonOp].map(
      (op) => [`f64.${op}`, "visitBinaryOp"] as const
    )
  ),

  ...typedFromEntries(
    [...i32ConversionOp, ...intConversionOp, ...intTestOp].map(
      (op) => [`i32.${op}`, "visitUnaryOp"] as const
    )
  ),
  ...typedFromEntries(
    [...i64ConversionOp, ...intConversionOp, ...intTestOp].map(
      (op) => [`i64.${op}`, "visitUnaryOp"] as const
    )
  ),
  ...typedFromEntries(
    [...f32ConversionOp, ...floatConversionOp, ...floatUnaryOp].map(
      (op) => [`f32.${op}`, "visitUnaryOp"] as const
    )
  ),
  ...typedFromEntries(
    [...f64ConversionOp, ...floatConversionOp, ...floatUnaryOp].map(
      (op) => [`f64.${op}`, "visitUnaryOp"] as const
    )
  ),

  // memory
  "i32.load": "visitLoadOp",
  "i64.load": "visitLoadOp",
  "f32.load": "visitLoadOp",
  "f64.load": "visitLoadOp",
  "i32.load8_s": "visitLoadOp",
  "i32.load8_u": "visitLoadOp",
  "i32.load16_s": "visitLoadOp",
  "i32.load16_u": "visitLoadOp",
  "i64.load8_s": "visitLoadOp",
  "i64.load8_u": "visitLoadOp",
  "i64.load16_s": "visitLoadOp",
  "i64.load16_u": "visitLoadOp",
  "i64.load32_s": "visitLoadOp",
  "i64.load32_u": "visitLoadOp",

  "i32.store": "visitStoreOp",
  "i64.store": "visitStoreOp",
  "f32.store": "visitStoreOp",
  "f64.store": "visitStoreOp",

  "memory.copy": "visitMemoryCopyOp",

  // control
  block: "visitBlockOp",
  loop: "visitLoopOp",
  if: "visitIfOp",
  unreachable: "visitUnreachableOp",
  drop: "visitDropOp",
  br: "visitBrOp",
  br_table: "visitBrTableOp",
  call: "visitCallOp",
  return: "visitReturnOp",
  select: "visitSelectOp",

  // variables
  "local.get": "visitVariableGetOp",
  "global.get": "visitVariableGetOp",
  "local.set": "visitVariableSetOp",
  "global.set": "visitVariableSetOp",
  "local.tee": "visitVariableSetOp",

  // module
  import: "visitImportOp",
  global: "visitGlobalOp",
  data: "visitDataOp",
  func: "visitFuncOp",
  export: "visitExportOp",
  start: "visitStartOp",
  module: "visitModuleOp",
} as const satisfies Record<WasmInstruction["op"], string>;

// ------------------------ WASM Visitor Interface ----------------------------

// This collects all the visitor method names (the values in the above object)
// and maps it to an actual method which takes as argument the specific
// WasmInstruction type corresponding to the instructino string, and returns
// the WAT string.
// Expection: For WasmNumeric unary and binary operations, since there are
// so many specific WasmInstruction types, we generalise them.

type WatVisitor = {
  [K in keyof typeof instrToMethodMap as (typeof instrToMethodMap)[K]]: (
    instruction: (typeof instrToMethodMap)[K] extends "visitUnaryOp"
      ? { op: string; right: WasmInstruction }
      : (typeof instrToMethodMap)[K] extends "visitBinaryOp"
      ? { op: string; left: WasmInstruction; right: WasmInstruction }
      : Extract<WasmInstruction, { op: K }>
  ) => string;
};

export {
  f32,
  f64,
  global,
  i32,
  i64,
  instrToMethodMap,
  local,
  memory,
  wasm,
  type WasmBlock,
  type WasmBr,
  type WasmBrTable,
  type WasmCall,
  type WasmData,
  type WasmDrop,
  type WasmExport,
  type WasmExternType,
  type WasmFunction,
  type WasmGlobal,
  type WasmGlobalGet,
  type WasmGlobalSet,
  type WasmIf,
  type WasmImport,
  type WasmInstruction,
  type WasmLoad,
  type WasmLocalGet,
  type WasmLocalSet,
  type WasmLocalTee,
  type WasmLoop,
  type WasmMemoryCopy,
  type WasmModule,
  type WasmNumeric,
  type WasmNumericConst,
  type WasmNumericType,
  type WasmReturn,
  type WasmSelect,
  type WasmStart,
  type WasmStore,
  type WasmUnreachable,
  type WatVisitor,
};
