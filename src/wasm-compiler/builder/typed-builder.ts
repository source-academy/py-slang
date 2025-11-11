// ------------------------ WASM Numeric Types & Constants ----------------------------

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

  // below are not numeric instructions, but the results of these are numeric
  | WasmLoadOp
  | WasmStoreOp
  | WasmLocalGet
  | WasmGlobalGet
  | WasmLocalTee
  | WasmCall; // call generates numeric[], but for type simplicity we assume just 1

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
  value: WasmNumeric;
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
  valueType: T | `mut ${T}`;
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

type BuilderAsType<T extends WasmNumericType = WasmNumericType> = {
  "~type": T;
};
type NumericBuilder<T extends WasmNumericType> = {
  [K in WasmNumericFor<T>["instr"] as K extends `${T}.${infer S}`
    ? S
    : never]: (...args: never[]) => Extract<WasmNumericFor<T>, { instr: K }>;
} & BuilderAsType<T>;

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
  "~type": "i32",
} satisfies NumericBuilder<"i32">;

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
  "~type": "i64",
} satisfies NumericBuilder<"i64">;

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
  "~type": "f32",
} satisfies NumericBuilder<"f32">;

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
  "~type": "f64",
} satisfies NumericBuilder<"f64">;

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

type WasmBlockTypeHelper<T extends WasmBlock | WasmLoop> = {
  params(...params: BuilderAsType[]): WasmBlockTypeHelper<T>;
  results(...results: BuilderAsType[]): WasmBlockTypeHelper<T>;
  locals(...locals: BuilderAsType[]): WasmBlockTypeHelper<T>;

  body: (...instrs: WasmInstruction[]) => T;
};

type WasmIfBlockTypeHelper = {
  params(...params: BuilderAsType[]): WasmIfBlockTypeHelper;
  results(...results: BuilderAsType[]): WasmIfBlockTypeHelper;
  locals(...locals: BuilderAsType[]): WasmIfBlockTypeHelper;

  then(...thenInstrs: WasmInstruction[]): WasmIf & {
    else(...elseInstrs: WasmInstruction[]): WasmIf;
  };
};

type WasmFuncTypeHelper = {
  params(params: Record<string, BuilderAsType>): WasmFuncTypeHelper;
  locals(locals: Record<string, BuilderAsType>): WasmFuncTypeHelper;
  results(...results: BuilderAsType[]): WasmFuncTypeHelper;

  body(...instrs: Exclude<WasmInstruction, WasmFunction>[]): WasmFunction;
};

type WasmModuleHelper = {
  imports(...imports: WasmImport[]): WasmModuleHelper;
  globals(...globals: WasmGlobal[]): WasmModuleHelper;
  datas(...datas: WasmData[]): WasmModuleHelper;
  funcs(...funcs: WasmFunction[]): WasmModuleHelper;
  startFunc(startFunc: string): Omit<WasmModuleHelper, "startFunc">;
  exports(...exports: WasmExport[]): WasmModuleHelper;

  build(): WasmModule;
};

const wasmBlockLoop =
  <T extends "block" | "loop">(type: T) =>
  (
    label?: string
  ): WasmBlockTypeHelper<T extends "block" ? WasmBlock : WasmLoop> => {
    const blockType: Required<WasmBlockType> = {
      paramTypes: [],
      resultTypes: [],
      localTypes: [],
    };

    return {
      params(...params) {
        blockType.paramTypes.push(...params.map((p) => p["~type"]));
        return this;
      },
      results(...results) {
        blockType.resultTypes.push(...results.map((r) => r["~type"]));
        return this;
      },
      locals(...locals) {
        blockType.localTypes.push(...locals.map((l) => l["~type"]));
        return this;
      },

      body(...instrs) {
        return {
          instr: type,
          label,
          blockType,
          body: instrs,
        } as T extends "block" ? WasmBlock : WasmLoop;
      },
    };
  };

const wasm = {
  block: wasmBlockLoop("block"),
  loop: wasmBlockLoop("loop"),
  if: (predicate: WasmNumeric, label?: string): WasmIfBlockTypeHelper => {
    const blockType: Required<WasmBlockType> = {
      paramTypes: [],
      resultTypes: [],
      localTypes: [],
    };

    return {
      params(...params) {
        blockType.paramTypes.push(...params.map((p) => p["~type"]));
        return this;
      },
      locals(...locals) {
        blockType.localTypes.push(...locals.map((l) => l["~type"]));
        return this;
      },
      results(...results) {
        blockType.resultTypes.push(...results.map((r) => r["~type"]));
        return this;
      },
      then(...thenInstrs) {
        return {
          instr: "if",
          predicate,
          label,
          blockType,
          thenBody: thenInstrs,

          else(...elseInstrs) {
            return { ...this, elseBody: elseInstrs };
          },
        };
      },
    };
  },
  drop: (value?: WasmInstruction): WasmDrop => ({ instr: "drop", value }),
  unreachable: (): WasmUnreachable => ({ instr: "unreachable" }),
  br: (label: string): WasmBr => ({ instr: "br", label }),
  br_table: (value: WasmNumeric, ...labels: string[]): WasmBrTable => ({
    instr: "br_table",
    labels,
    value,
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
    memory: (initial: number, maximum?: number): WasmImport => ({
      instr: "import",
      moduleName,
      itemName,
      externType: { type: "memory", limits: { initial, maximum } },
    }),

    func(name: string) {
      const funcType: Required<WasmBlockType> = {
        paramTypes: [],
        resultTypes: [],
        localTypes: [],
      };
      const importInstr: WasmImport = {
        instr: "import",
        moduleName,
        itemName,
        externType: { type: "func", name, funcType },
      };

      return {
        ...importInstr,

        params(...params: BuilderAsType[]) {
          funcType.paramTypes.push(...params.map((p) => p["~type"]));
          return importInstr;
        },
        locals(...locals: BuilderAsType[]) {
          funcType.localTypes.push(...locals.map((l) => l["~type"]));
          return importInstr;
        },
        results(...results: BuilderAsType[]) {
          funcType.resultTypes.push(...results.map((r) => r["~type"]));
          return importInstr;
        },
      };
    },
  }),

  global: <T extends WasmNumericType>(
    name: string,
    valueType: T | `mut ${T}`
  ) => ({
    init: (initialValue: WasmNumericFor<T>): WasmGlobalFor<T> => ({
      instr: "global",
      name,
      valueType,
      initialValue,
    }),
  }),

  func(name: string): WasmFuncTypeHelper {
    const funcType: WasmFuncType = {
      paramTypes: {},
      resultTypes: [],
      localTypes: {},
    };
    return {
      params(params) {
        for (const p in params) funcType.paramTypes[p] = params[p]["~type"];
        return this;
      },
      locals(locals) {
        for (const l in locals) funcType.localTypes[l] = locals[l]["~type"];
        return this;
      },
      results(...results) {
        funcType.resultTypes.push(...results.map((r) => r["~type"]));
        return this;
      },

      body: (...instrs) => ({ instr: "func", name, funcType, body: instrs }),
    };
  },

  module(): WasmModuleHelper {
    const definitions: Omit<WasmModule, "instr"> = {
      imports: [],
      globals: [],
      datas: [],
      funcs: [],
      startFunc: undefined,
      exports: [],
    };
    return {
      imports(...imports) {
        definitions.imports.push(...imports);
        return this;
      },
      globals(...globals) {
        definitions.globals.push(...globals);
        return this;
      },
      datas(...datas) {
        definitions.datas.push(...datas);
        return this;
      },
      funcs(...funcs) {
        definitions.funcs.push(...funcs);
        return this;
      },
      startFunc(startFunc) {
        definitions.startFunc = { instr: "start", functionName: startFunc };
        return this;
      },
      exports(...exports) {
        definitions.exports.push(...exports);
        return this;
      },

      build() {
        return { instr: "module", ...definitions };
      },
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

// This collects all the visitor method names (the values in the above object)
// and maps it to an actual method which takes as argument the specific
// WasmInstruction type corresponding to the instructino string, and returns
// the WAT string.
// Expection: For WasmNumeric unary and binary operations, since there are
// so many specific WasmInstruction types, we generalise them.

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
  type WasmLoadOp,
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
  type WasmStart,
  type WasmStoreOp,
  type WasmUnreachable,
  type WatVisitor,
};
