// ------------------------ WASM Numeric Types & Constants ----------------------------

export type WasmLabel = `$${string}`;

export type WasmIntNumericType = "i32" | "i64";
export type WasmFloatNumericType = "f32" | "f64";
export type WasmNumericType = WasmIntNumericType | WasmFloatNumericType;

export const floatUnaryOp = [
  "neg",
  "abs",
  "sqrt",
  "ceil",
  "floor",
  "trunc",
  "nearest",
] as const;
export const intBinaryOp = [
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
export const floatBinaryOp = ["add", "sub", "mul", "div"] as const;
export const intTestOp = ["eqz"] as const;
export const intComparisonOp = [
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
export const floatComparisonOp = ["eq", "ne", "lt", "gt", "le", "ge"] as const;
export const intConversionOp = [
  "trunc_f32_s",
  "trunc_f32_u",
  "trunc_f64_s",
  "trunc_f64_u",
] as const;
export const i32ConversionOp = ["wrap_i64", "reinterpret_f32"] as const;
export const i64ConversionOp = [
  "extend_i32_s",
  "extend_i32_u",
  "reinterpret_f64",
] as const;
export const floatConversionOp = [
  "convert_i32_s",
  "convert_i32_u",
  "convert_i64_s",
  "convert_i64_u",
] as const;
export const f32ConversionOp = ["demote_f64", "reinterpret_i32"] as const;
export const f64ConversionOp = ["promote_f32", "reinterpret_i64"] as const;
export const intLoadNarrowOp = ["8_s", "8_u", "16_s", "16_u"] as const;
export const i64LoadNarrowOp = ["32_s", "32_u"] as const;

export type FloatUnaryOp = (typeof floatUnaryOp)[number];
export type IntBinaryOp = (typeof intBinaryOp)[number];
export type FloatBinaryOp = (typeof floatBinaryOp)[number];
export type IntTestOp = (typeof intTestOp)[number];
export type IntComparisonOp = (typeof intComparisonOp)[number];
export type FloatComparisonOp = (typeof floatComparisonOp)[number];
export type IntConversionOp = (typeof intConversionOp)[number];
export type I32ConversionOp = (typeof i32ConversionOp)[number];
export type I64ConversionOp = (typeof i64ConversionOp)[number];
export type FloatConversionOp = (typeof floatConversionOp)[number];
export type F32ConversionOp = (typeof f32ConversionOp)[number];
export type F64ConversionOp = (typeof f64ConversionOp)[number];
export type IntLoadNarrowOp = (typeof intLoadNarrowOp)[number];
export type I64LoadNarrowOp = (typeof i64LoadNarrowOp)[number];

// ------------------------ WASM Numeric Instructions ----------------------------

export type WasmConst<T extends WasmNumericType> = {
  op: `${T}.const`;
  value: T extends WasmIntNumericType ? bigint : number;
};

export type WasmUnaryOp<T extends WasmFloatNumericType> = {
  [Op in FloatUnaryOp]: { op: `${T}.${Op}`; right: WasmNumericFor<T> };
}[FloatUnaryOp];

export type WasmBinaryOp<T extends WasmNumericType> =
  T extends WasmIntNumericType
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

export type WasmIntTestOp<T extends WasmIntNumericType> = {
  [Op in IntTestOp]: { op: `${T}.${Op}`; right: WasmNumericFor<T> };
}[IntTestOp];

export type WasmComparisonOp<T extends WasmNumericType> =
  T extends WasmIntNumericType
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

export type WasmConversionOp<T extends WasmNumericType> =
  WasmConversionOpHelper<`${T}.${T extends "i32"
    ? I32ConversionOp | IntConversionOp
    : T extends "i64"
    ? I64ConversionOp | IntConversionOp
    : T extends "f32"
    ? F32ConversionOp | FloatConversionOp
    : F64ConversionOp | FloatConversionOp}`>;

export type WasmLoadOp<T extends WasmNumericType> = {
  op: `${T}.load`;
  address: WasmNumericFor<"i32">;
};
export type WasmLoadNarrowOp<T extends WasmIntNumericType> = T extends "i32"
  ? {
      [Op in IntLoadNarrowOp]: {
        op: `${T}.load${Op}`;
        address: WasmNumericFor<"i32">;
      };
    }[IntLoadNarrowOp]
  : {
      [Op in IntLoadNarrowOp | I64LoadNarrowOp]: {
        op: `${T}.load${Op}`;
        address: WasmNumericFor<"i32">;
      };
    }[IntLoadNarrowOp | I64LoadNarrowOp];
export type WasmLoad =
  | WasmLoadOp<"i32">
  | WasmLoadOp<"i64">
  | WasmLoadOp<"f32">
  | WasmLoadOp<"f64">
  | WasmLoadNarrowOp<"i32">
  | WasmLoadNarrowOp<"i64">;

export type WasmStoreOp<T extends WasmNumericType> = {
  op: `${T}.store`;
  address: WasmNumericFor<"i32">;
  value: WasmNumericFor<T>;
};
export type WasmStore =
  | WasmStoreOp<"i32">
  | WasmStoreOp<"i64">
  | WasmStoreOp<"f32">
  | WasmStoreOp<"f64">;

export type WasmNumericFor<T extends WasmNumericType> =
  | WasmConst<T>
  | (T extends WasmFloatNumericType ? WasmUnaryOp<T> : never)
  | WasmBinaryOp<T>
  | (T extends WasmIntNumericType ? WasmIntTestOp<T> : never)
  | (T extends "i32" ? WasmComparisonOp<WasmNumericType> : never)
  | WasmConversionOp<T>

  // below are not numeric instructions, but the results of these are numeric
  | WasmLoad
  | WasmStore
  | WasmLocalGet
  | WasmGlobalGet
  | WasmLocalTee
  | WasmCall // call generates numeric[], but for type simplicity we assume just 1
  | WasmSelect;

export type WasmNumeric =
  | WasmNumericFor<"i32">
  | WasmNumericFor<"i64">
  | WasmNumericFor<"f32">
  | WasmNumericFor<"f64">;

// ------------------------ WASM Variable Instructions ----------------------------

export type WasmLocalSet = {
  op: "local.set";
  label: WasmLabel;
  right: WasmNumeric;
};
export type WasmLocalGet = { op: "local.get"; label: WasmLabel };
export type WasmLocalTee = {
  op: "local.tee";
  label: WasmLabel;
  right: WasmNumeric;
};
export type WasmGlobalSet = {
  op: "global.set";
  label: WasmLabel;
  right: WasmNumeric;
};
export type WasmGlobalGet = { op: "global.get"; label: WasmLabel };

type WasmVariable =
  | WasmLocalSet
  | WasmLocalGet
  | WasmLocalTee
  | WasmGlobalSet
  | WasmGlobalGet;

// ------------------------ WASM Memory Instructions ----------------------------
// Technically WasmStoreOp and WasmLoadOp are memory instructions, but they are defined
// together with numerics for typing.

export type WasmMemoryCopy = {
  op: "memory.copy";
  destination: WasmNumericFor<"i32">;
  source: WasmNumericFor<"i32">;
  size: WasmNumericFor<"i32">;
};

export type WasmMemoryFill = {
  op: "memory.fill";
  address: WasmNumericFor<"i32">;
  value: WasmNumericFor<"i32">;
  numOfBytes: WasmNumericFor<"i32">;
};

type WasmMemory = WasmMemoryCopy | WasmMemoryFill;

// ------------------------ WASM Control Instructions ----------------------------

export type WasmUnreachable = { op: "unreachable" };
export type WasmDrop = { op: "drop"; value: WasmInstruction | undefined };
export type WasmNop = { op: "nop" };

export type WasmBlockType = {
  paramTypes: WasmNumericType[];
  resultTypes: WasmNumericType[];
  localTypes?: WasmNumericType[];
};

export type WasmBlockBase = {
  label: WasmLabel | undefined;
  blockType: WasmBlockType;
};
export type WasmBlock = WasmBlockBase & {
  op: "block";
  body: WasmInstruction[];
};
export type WasmLoop = WasmBlockBase & { op: "loop"; body: WasmInstruction[] };
export type WasmIf = WasmBlockBase & {
  op: "if";
  predicate: WasmNumeric;
  thenBody: WasmInstruction[];
  elseBody?: WasmInstruction[];
};
export type WasmBr = { op: "br"; label: WasmLabel };
export type WasmBrTable = {
  op: "br_table";
  labels: (WasmLabel | number)[];
  value: WasmNumeric;
};
export type WasmCall = {
  op: "call";
  function: WasmLabel;
  arguments: WasmNumeric[];
};
export type WasmReturn = { op: "return"; values: WasmInstruction[] };
export type WasmSelect = {
  op: "select";
  first: WasmNumeric;
  second: WasmNumeric;
  condition: WasmNumeric;
};

type WasmControl =
  | WasmUnreachable
  | WasmDrop
  | WasmNop
  | WasmBlock
  | WasmLoop
  | WasmIf
  | WasmBr
  | WasmBrTable
  | WasmCall
  | WasmReturn
  | WasmSelect;

// ------------------------ WASM Module Instructions ----------------------------

export type WasmLocals = Record<WasmLabel, WasmNumericType>;
export type WasmFuncType = {
  paramTypes: WasmLocals;
  resultTypes: WasmNumericType[];
  localTypes: WasmLocals;
};

export type WasmExternType =
  | { type: "memory"; limits: { initial: number; maximum: number | undefined } }
  | { type: "func"; name: WasmLabel; funcType: WasmBlockType };
export type WasmImport = {
  op: "import";
  moduleName: string;
  itemName: string;
  externType: WasmExternType;
};

export type WasmGlobalFor<T extends WasmNumericType> = {
  op: "global";
  name: WasmLabel;
  valueType: T | `mut ${T}`;
  initialValue: WasmNumericFor<T>;
};
export type WasmGlobal =
  | WasmGlobalFor<"i32">
  | WasmGlobalFor<"i64">
  | WasmGlobalFor<"f32">
  | WasmGlobalFor<"f64">;

export type WasmData = {
  op: "data";
  offset: WasmNumericFor<"i32">;
  data: string;
};
export type WasmFunction = {
  op: "func";
  name: WasmLabel;
  funcType: WasmFuncType;
  body: WasmInstruction[];
};
export type WasmStart = { op: "start"; functionName: WasmLabel };

export type WasmExternIdx =
  | { type: "func"; identifier: WasmLabel }
  | { type: "memory"; index: number };
export type WasmExport = {
  op: "export";
  name: string;
  externType: WasmExternIdx;
};

export type WasmModule = {
  op: "module";
  imports: WasmImport[];
  globals: WasmGlobal[];
  datas: WasmData[];
  funcs: WasmFunction[];
  startFunc: WasmStart | undefined;
  exports: WasmExport[];
};

export type WasmModuleInstruction =
  | WasmImport
  | WasmGlobal
  | WasmData
  | WasmFunction
  | WasmExport
  | WasmStart
  | WasmModule;

export type WasmInstruction =
  | WasmNumeric
  | WasmMemory
  | WasmControl
  | WasmVariable
  | WasmModuleInstruction;
