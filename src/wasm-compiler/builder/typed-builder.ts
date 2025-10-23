// ------------------------ WASM Numeric Types & Constants ----------------------------

type WasmIntNumericType = "i32" | "i64";
type WasmFloatNumericType = "f32" | "f64";

const wasmNumericType = ["i32", "i64", "f32", "f64"] as const;
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
  instr: `${T}.const`;
  value: T extends WasmIntNumericType ? bigint : number;
};

type WasmUnaryOp<T extends WasmFloatNumericType> = {
  [Op in FloatUnaryOp]: {
    instr: `${T}.${Op}`;
    right: WasmNumericFor<T>;
  };
}[FloatUnaryOp];

type WasmBinaryOp<T extends WasmNumericType> = T extends WasmIntNumericType
  ? {
      [Op in IntBinaryOp]: {
        instr: `${T}.${Op}`;
        left: WasmNumericFor<T>;
        right: WasmNumericFor<T>;
      };
    }[IntBinaryOp]
  : T extends WasmFloatNumericType
  ? {
      [Op in FloatBinaryOp]: {
        instr: `${T}.${Op}`;
        left: WasmNumericFor<T>;
        right: WasmNumericFor<T>;
      };
    }[FloatBinaryOp]
  : never;

type WasmIntTestOp<T extends WasmIntNumericType> = {
  [Op in IntTestOp]: {
    instr: `${T}.${Op}`;
    right: WasmNumericFor<T>;
  };
}[IntTestOp];

type WasmComparisonOp<T extends WasmNumericType> = T extends WasmIntNumericType
  ? {
      [Op in IntComparisonOp]: {
        instr: `${T}.${Op}`;
        left: WasmNumericFor<T>;
        right: WasmNumericFor<T>;
      };
    }[IntComparisonOp]
  : T extends WasmFloatNumericType
  ? {
      [Op in FloatComparisonOp]: {
        instr: `${T}.${Op}`;
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
  ? {
      instr: I;
      right: WasmNumericFor<ExtractConversion<I>>;
    }
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
  instr: `${T}.load`;
  address: WasmNumericFor<"i32">;
};
type WasmLoadOp =
  | WasmLoadOpFor<"i32">
  | WasmLoadOpFor<"i64">
  | WasmLoadOpFor<"f32">
  | WasmLoadOpFor<"f64">;

type WasmStoreOpFor<T extends WasmNumericType> = {
  instr: `${T}.store`;
  address: WasmNumericFor<"i32">;
  value: WasmNumericFor<T>;
};
type WasmStoreOp =
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
  | WasmLoadOp
  | WasmStoreOp
  | WasmLocalGet
  | WasmGlobalGet
  | WasmLocalTee;

type WasmNumeric =
  | WasmNumericFor<"i32">
  | WasmNumericFor<"i64">
  | WasmNumericFor<"f32">
  | WasmNumericFor<"f64">;

// ------------------------ WASM Variable Instructions ----------------------------

type WasmLocalSet = {
  instr: "local.set";
  label: string;
  right: WasmNumeric;
};
type WasmLocalGet = { instr: "local.get"; label: string };
type WasmLocalTee = {
  instr: "local.tee";
  label: string;
  right: WasmNumeric;
};
type WasmGlobalSet = {
  instr: "global.set";
  label: string;
  right: WasmNumeric;
};
type WasmGlobalGet = { instr: "global.get"; label: string };

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
  instr: "memory.copy";
  destination: WasmNumericFor<"i32">;
  source: WasmNumericFor<"i32">;
  size: WasmNumericFor<"i32">;
};

type WasmMemory = WasmMemoryCopy;

// ------------------------ WASM Control Instructions ----------------------------

type WasmUnreachable = {
  instr: "unreachable";
};
type WasmDrop = {
  instr: "drop";
  value?: WasmInstruction;
};

type WasmBlockType = {
  paramTypes: WasmNumericType[];
  resultTypes: WasmNumericType[];
  localTypes?: WasmNumericType[];
};

type WasmBlockBase = { label?: string; blockType: WasmBlockType };
type WasmBlock = WasmBlockBase & {
  instr: "block";
  body: WasmInstruction[];
};
type WasmLoop = WasmBlockBase & {
  instr: "loop";
  body: WasmInstruction[];
};
type WasmIf = WasmBlockBase & {
  instr: "if";
  predicate: WasmNumeric;
  thenBody: WasmInstruction[];
  elseBody?: WasmInstruction[];
};
type WasmBr = {
  instr: "br";
  label: string;
};
type WasmBrTable = {
  instr: "br_table";
  labels: string[];
};
type WasmCall = {
  instr: "call";
  function: string;
  arguments: WasmNumeric[];
};
type WasmReturn = {
  instr: "return";
  values: WasmNumeric[];
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
  | WasmReturn;

// ------------------------ WASM Module Instructions ----------------------------

type WasmLocals = Record<string, WasmNumericType>;
type WasmFuncType = {
  paramTypes: WasmLocals;
  resultTypes: WasmNumericType[];
  localTypes: WasmLocals;
};
type WasmExternType =
  | {
      type: "memory";
      limits: { initial: number; maximum?: number };
    }
  | {
      type: "func";
      name: string;
      funcType: WasmBlockType;
    };
type WasmImport = {
  instr: "import";
  moduleName: string;
  itemName: string;
  externType: WasmExternType;
};
type WasmGlobalFor<T extends WasmNumericType> = {
  instr: "global";
  name: string;
  mutable: boolean;
  valueType: T;
  initialValue: WasmNumericFor<T>;
};
type WasmGlobal =
  | WasmGlobalFor<"i32">
  | WasmGlobalFor<"i64">
  | WasmGlobalFor<"f32">
  | WasmGlobalFor<"f64">;
type WasmData = {
  instr: "data";
  offset: WasmNumericFor<"i32">;
  data: string;
};
type WasmStart = {
  instr: "start";
  functionName: string;
};
type WasmExport = {
  instr: "export";
  name: string;
  externType: WasmExternType;
};
type WasmModule = {
  instr: "module";
  imports: WasmImport[];
  globals: WasmGlobal[];
  datas: WasmData[];
  funcs: WasmFunction[];
  startFunc?: WasmStart;
  exports: WasmExport[];
};

type WasmFunction = {
  instr: "func";
  name: string;
  funcType: WasmFuncType;
  body: Exclude<WasmInstruction, WasmFunction>[];
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
  const I extends ((
    | WasmBinaryOp<T>
    | WasmComparisonOp<T>
  )["instr"] extends `${T}.${infer S}`
    ? S
    : never)[]
>(
  type: T,
  instrs: I
) =>
  typedFromEntries(
    instrs.map((instr) => {
      const fn = (left: WasmNumericFor<T>, right: WasmNumericFor<T>) => ({
        instr: `${type}.${instr}`,
        left,
        right,
      });
      return [instr, fn];
    }) as {
      [K in keyof I]: [
        I[K],
        (
          ...args: Extract<
            WasmNumericFor<T>,
            { instr: `${T}.${I[K]}` }
          > extends { left: infer L; right: infer R }
            ? [left: L, right: R]
            : never
        ) => Extract<WasmNumericFor<T>, { instr: `${T}.${I[K]}` }>
      ];
    }
  );

const unaryOp = <
  T extends WasmNumericType,
  const I extends ((
    | WasmConversionOp<T>
    | (T extends WasmIntNumericType
        ? WasmIntTestOp<T>
        : T extends WasmFloatNumericType
        ? WasmUnaryOp<T>
        : never)
  )["instr"] extends `${T}.${infer S}`
    ? S
    : never)[]
>(
  type: T,
  instrs: I
) =>
  typedFromEntries(
    instrs.map((instr) => {
      const fn = (right: WasmNumericFor<T>) => ({
        instr: `${type}.${instr}`,
        right,
      });
      return [instr, fn];
    }) as {
      [K in keyof I]: [
        I[K],
        (
          ...args: Extract<
            WasmNumericFor<T>,
            { instr: `${T}.${I[K]}` }
          > extends { right: infer R }
            ? [right: R]
            : never
        ) => Extract<WasmNumericFor<T>, { instr: `${T}.${I[K]}` }>
      ];
    }
  );

const i32 = {
  const: (value: number | bigint): WasmNumericConst<"i32"> => ({
    instr: "i32.const",
    value: BigInt(value),
  }),
  ...binaryOp("i32", [...intBinaryOp, ...intComparisonOp]),
  ...unaryOp("i32", [...i32ConversionOp, ...intConversionOp, ...intTestOp]),
  load: (address: WasmNumericFor<"i32">): WasmLoadOpFor<"i32"> => ({
    instr: "i32.load",
    address,
  }),
  store: (
    address: WasmNumericFor<"i32">,
    value: WasmNumericFor<"i32">
  ): WasmStoreOpFor<"i32"> => ({
    instr: "i32.store",
    address,
    value,
  }),
};

const i64 = {
  const: (value: number | bigint): WasmNumericConst<"i64"> => ({
    instr: "i64.const",
    value: BigInt(value),
  }),
  ...binaryOp("i64", [...intBinaryOp, ...intComparisonOp]),
  ...unaryOp("i64", [...i64ConversionOp, ...intConversionOp, ...intTestOp]),
  load: (address: WasmNumericFor<"i32">): WasmLoadOpFor<"i64"> => ({
    instr: "i64.load",
    address,
  }),
  store: (
    address: WasmNumericFor<"i32">,
    value: WasmNumericFor<"i64">
  ): WasmStoreOpFor<"i64"> => ({
    instr: "i64.store",
    address,
    value,
  }),
};

const f32 = {
  const: (value: number): WasmNumericConst<"f32"> => ({
    instr: "f32.const",
    value,
  }),
  ...binaryOp("f32", [...floatBinaryOp, ...floatComparisonOp]),
  ...unaryOp("f32", [
    ...f32ConversionOp,
    ...floatConversionOp,
    ...floatUnaryOp,
  ]),
  load: (address: WasmNumericFor<"i32">): WasmLoadOpFor<"f32"> => ({
    instr: "f32.load",
    address,
  }),
  store: (
    address: WasmNumericFor<"i32">,
    value: WasmNumericFor<"f32">
  ): WasmStoreOpFor<"f32"> => ({
    instr: "f32.store",
    address,
    value,
  }),
};

const f64 = {
  const: (value: number): WasmNumericConst<"f64"> => ({
    instr: "f64.const",
    value,
  }),
  ...binaryOp("f64", [...floatBinaryOp, ...floatComparisonOp]),
  ...unaryOp("f64", [
    ...f64ConversionOp,
    ...floatConversionOp,
    ...floatUnaryOp,
  ]),
  load: (address: WasmNumericFor<"i32">): WasmLoadOpFor<"f64"> => ({
    instr: "f64.load",
    address,
  }),
  store: (
    address: WasmNumericFor<"i32">,
    value: WasmNumericFor<"f64">
  ): WasmStoreOpFor<"f64"> => ({
    instr: "f64.store",
    address,
    value,
  }),
};

const local = {
  get: (label: string): WasmLocalGet => ({
    instr: "local.get",
    label,
  }),
  set: (label: string, right: WasmNumeric): WasmLocalSet => ({
    instr: "local.set",
    label,
    right,
  }),
  tee: (label: string, right: WasmNumeric): WasmLocalTee => ({
    instr: "local.tee",
    label,
    right,
  }),
};

const global = {
  get: (label: string): WasmGlobalGet => ({
    instr: "global.get",
    label,
  }),
  set: (label: string, right: WasmNumeric): WasmGlobalSet => ({
    instr: "global.set",
    label,
    right,
  }),
};

const memory = {
  copy: (
    destination: WasmNumericFor<"i32">,
    source: WasmNumericFor<"i32">,
    size: WasmNumericFor<"i32">
  ): WasmMemoryCopy => ({
    instr: "memory.copy",
    destination,
    source,
    size,
  }),
};

type WasmBlockTypeHelper = {
  product: Required<WasmBlockType>;
  params(...params: WasmNumericType[]): WasmBlockTypeHelper;
  results(...results: WasmNumericType[]): WasmBlockTypeHelper;
  locals(...locals: WasmNumericType[]): WasmBlockTypeHelper;
};

const blockType: WasmBlockTypeHelper = {
  product: {
    paramTypes: [],
    resultTypes: [],
    localTypes: [],
  },
  params(...params) {
    this.product.paramTypes.push(...params);
    return this;
  },
  results(...results) {
    this.product.resultTypes.push(...results);
    return this;
  },
  locals(...locals) {
    this.product.localTypes.push(...locals);
    return this;
  },
};

type WasmFuncTypeHelper = {
  params: (params: WasmLocals) => WasmFuncTypeHelper;
  locals: (locals: WasmLocals) => WasmFuncTypeHelper;
  results: (...results: WasmNumericType[]) => WasmFuncTypeHelper;

  body: (...instrs: WasmFunction["body"]) => WasmFunction;
};

type WasmModuleHelper = {
  imports: (...imports: WasmImport[]) => WasmModuleHelper;
  globals: (...globals: WasmGlobal[]) => WasmModuleHelper;
  datas: (...datas: WasmData[]) => WasmModuleHelper;
  funcs: (...funcs: WasmFunction[]) => WasmModuleHelper;
  startFunc: (startFunc: string) => Omit<WasmModuleHelper, "startFunc">;
  exports: (...exports: WasmExport[]) => WasmModuleHelper;

  build: () => WasmModule;
};

const wasm = {
  block: (label: string, blockType?: WasmBlockTypeHelper) => ({
    body: (...instrs: WasmInstruction[]): WasmBlock => ({
      instr: "block",
      label,
      blockType: blockType
        ? blockType.product
        : { paramTypes: [], resultTypes: [] },
      body: instrs,
    }),
  }),
  loop: (label: string, blockType?: WasmBlockTypeHelper) => ({
    body: (...instrs: WasmInstruction[]): WasmLoop => ({
      instr: "loop",
      label,
      blockType: blockType
        ? blockType.product
        : { paramTypes: [], resultTypes: [] },
      body: instrs,
    }),
  }),
  if: (
    label: string,
    predicate: WasmNumeric,
    blockType?: WasmBlockTypeHelper
  ) => ({
    then: (
      ...thenInstrs: WasmInstruction[]
    ): WasmIf & {
      else: (...elseInstrs: WasmInstruction[]) => WasmIf;
    } => ({
      instr: "if",
      label,
      blockType: blockType
        ? blockType.product
        : { paramTypes: [], resultTypes: [] },
      predicate,
      thenBody: thenInstrs,
      else: (...elseInstrs) => ({
        instr: "if",
        label,
        blockType: blockType
          ? blockType.product
          : { paramTypes: [], resultTypes: [] },
        predicate,
        thenBody: thenInstrs,
        elseBody: elseInstrs,
      }),
    }),
  }),
  drop: (value?: WasmInstruction): WasmDrop => ({ instr: "drop", value }),
  unreachable: (): WasmUnreachable => ({ instr: "unreachable" }),
  br: (label: string): WasmBr => ({ instr: "br", label }),
  br_table: (...labels: string[]): WasmBrTable => ({
    instr: "br_table",
    labels,
  }),
  call: (functionName: string) => ({
    args: (...args: WasmNumeric[]): WasmCall => ({
      instr: "call",
      function: functionName,
      arguments: args,
    }),
  }),
  return: (...values: WasmNumeric[]): WasmReturn => ({
    instr: "return",
    values,
  }),

  import: (moduleName: string, itemName: string) => ({
    memory(initial: number, maximum?: number): WasmImport {
      return {
        instr: "import",
        moduleName,
        itemName,
        externType: { type: "memory", limits: { initial, maximum } },
      };
    },

    func(name: string, funcType: WasmBlockTypeHelper): WasmImport {
      return {
        instr: "import",
        moduleName,
        itemName,
        externType: { type: "func", name, funcType: funcType.product },
      };
    },
  }),

  func(
    name: string,
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

      body: (...instrs) => ({
        instr: "func",
        name,
        funcType,
        body: instrs,
      }),
    };
  },

  module(
    definitions: Omit<WasmModule, "instr"> = {
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
            instr: "start",
            functionName: startFunc,
          },
        }),
      exports: (...exports) =>
        this.module({
          ...definitions,
          exports: [...definitions.exports, ...exports],
        }),

      build: () => ({
        instr: "module",
        ...definitions,
      }),
    };
  },
};

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

  ...typedFromEntries(
    wasmNumericType.map((type) => [`${type}.load`, "visitLoadOp"] as const)
  ),
  ...typedFromEntries(
    wasmNumericType.map((type) => [`${type}.store`, "visitStoreOp"] as const)
  ),

  // memory
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
} as const satisfies Record<WasmInstruction["instr"], string>;

// ------------------------ WASM Visitor Interface ----------------------------

type WatVisitor = {
  [K in keyof typeof instrToMethodMap as (typeof instrToMethodMap)[K]]: (
    instruction: (typeof instrToMethodMap)[K] extends "visitUnaryOp"
      ? { instr: string; right: WasmInstruction }
      : (typeof instrToMethodMap)[K] extends "visitBinaryOp"
      ? { instr: string; left: WasmInstruction; right: WasmInstruction }
      : Extract<WasmInstruction, { instr: K }>
  ) => string;
};

export {
  blockType,
  f32,
  f64,
  global,
  i32,
  i64,
  instrToMethodMap,
  local,
  memory,
  wasm,
  WasmBlock,
  WasmBr,
  WasmBrTable,
  WasmCall,
  WasmData,
  WasmDrop,
  WasmExport,
  WasmExternType,
  WasmFunction,
  WasmGlobal,
  WasmGlobalGet,
  WasmGlobalSet,
  WasmIf,
  WasmImport,
  WasmInstruction,
  WasmLoadOp,
  WasmLocalGet,
  WasmLocalSet,
  WasmLocalTee,
  WasmLoop,
  WasmMemoryCopy,
  WasmModule,
  WasmNumeric,
  WasmNumericConst,
  WasmNumericType,
  WasmReturn,
  WasmStart,
  WasmStoreOp,
  WasmUnreachable,
  WatVisitor,
};

const test = wasm
  .func("$_get_lex_addr")
  .params({ $depth: "i32", $index: "i32" })
  .results("i32", "i64")
  .locals({ $env: "i32", $tag: "i32" })
  .body(
    wasm.loop("$loop").body(
      wasm.if("", i32.eqz(i32.const(0))).then(
        local.set(
          "$tag",
          i32.load(
            i32.add(
              i32.add(local.get("$env"), i32.const(4)),
              i32.mul(local.get("$index"), i32.const(12))
            )
          )
        ),

        wasm
          .if("", i32.eq(local.get("$tag"), i32.const(7)))
          .then(wasm.unreachable()),

        wasm.return(
          local.get("$tag"),
          i64.load(
            i32.add(
              i32.add(local.get("$env"), i32.const(8)),
              i32.mul(local.get("$index"), i32.const(12))
            )
          )
        )
      ),

      local.set("$env", i32.load(local.get("env"))),
      local.set("$depth", i32.sub(local.get("$depth"), i32.const(1))),

      local.tee("$tag", i32.load(local.get("$tag"))),

      wasm.br("$loop")
    )
  );

// (a+bi)/(c+di) = (ac+bd)/(c^2+d^2) + (bc-ad)/(c^2+d^2)i
// (f64.add (f64.mul (local.get $a) (local.get $c))
//           (f64.mul (local.get $b) (local.get $d)))
// (f64.add (f64.mul (local.get $c) (local.get $c))
//           (f64.mul (local.get $d) (local.get $d)))
// (local.tee $denom) (f64.div)
// (f64.sub (f64.mul (local.get $b) (local.get $c))
//           (f64.mul (local.get $a) (local.get $d)))
// (local.get $denom) (f64.div)

f64.div(
  f64.add(
    f64.mul(local.get("$a"), local.get("$c")),
    f64.mul(local.get("$b"), local.get("$d"))
  ),
  local.tee(
    "$denom",
    f64.add(
      f64.mul(local.get("$c"), local.get("$c")),
      f64.mul(local.get("$d"), local.get("$d"))
    )
  )
);

f64.div(
  f64.sub(
    f64.mul(local.get("$b"), local.get("$c")),
    f64.mul(local.get("$a"), local.get("$d"))
  ),
  local.get("$denom")
);
