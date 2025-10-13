type WasmIntNumericType = "i32" | "i64";
type WasmFloatNumericType = "f32" | "f64";
type WasmNumericType = WasmIntNumericType | WasmFloatNumericType;
type FloatUnaryOp =
  | "neg"
  | "abs"
  | "sqrt"
  | "ceil"
  | "floor"
  | "trunc"
  | "nearest";
type IntBinaryOp =
  | "add"
  | "sub"
  | "mul"
  | "div_s"
  | "div_u"
  | "and"
  | "or"
  | "xor"
  | "shl"
  | "shr_s"
  | "shr_u";
type FloatBinaryOp = "add" | "sub" | "mul" | "div";
type IntTestOp = "eqz";
type IntComparisonOp =
  | "eq"
  | "ne"
  | "lt_s"
  | "lt_u"
  | "gt_s"
  | "gt_u"
  | "le_s"
  | "le_u"
  | "ge_s"
  | "ge_u";
type FloatComparisonOp = "eq" | "ne" | "lt" | "gt" | "le" | "ge";
type IntConversionOp =
  | "trunc_f32_s"
  | "trunc_f32_u"
  | "trunc_f64_s"
  | "trunc_f64_u"
  | "reinterpret_f32";
type I32ConversionOp = "wrap_i64";
type I64ConversionOp = "extend_i32_s" | "extend_i32_u";
type FloatConversionOp =
  | "convert_i32_s"
  | "convert_i32_u"
  | "convert_i64_s"
  | "convert_i64_u"
  | "reinterpret_i32";
type F32ConversionOp = "demote_f64";
type F64ConversionOp = "promote_f32";

type WasmNumericConst<T extends WasmNumericType> = {
  instr: `${T}.const`;
  value: T extends WasmIntNumericType ? bigint : number;
};

type WasmUnaryOp<T extends WasmFloatNumericType> = {
  instr: `${T}.${FloatUnaryOp}`;
  right: WasmNumericFor<T>;
};

type WasmBinaryOp<T extends WasmNumericType> = {
  instr: `${T}.${T extends WasmIntNumericType ? IntBinaryOp : FloatBinaryOp}`;
  left: WasmNumericFor<T>;
  right: WasmNumericFor<T>;
};

type WasmIntTestOp<T extends WasmIntNumericType> = {
  instr: `${T}.${IntTestOp}`;
  right: WasmNumericFor<T>;
};

type WasmComparisonOp<T extends WasmNumericType> = {
  instr: `${T}.${T extends WasmIntNumericType
    ? IntComparisonOp
    : FloatComparisonOp}`;
  left: WasmNumericFor<T>;
  right: WasmNumericFor<T>;
};

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
    : T extends "f64"
    ? F64ConversionOp | FloatConversionOp
    : never}`>;

type WasmNumericFor<
  T extends WasmNumericType,
  InFunc extends boolean = false
> =
  | WasmNumericConst<T>
  | (T extends WasmFloatNumericType ? WasmUnaryOp<T> : never)
  | WasmBinaryOp<T>
  | (T extends WasmIntNumericType ? WasmIntTestOp<T> : never)
  | WasmComparisonOp<T>
  | WasmConversionOp<T>;

type WasmNumeric<InFunc extends boolean = false> =
  | WasmNumericFor<"i32", InFunc>
  | WasmNumericFor<"i64", InFunc>
  | WasmNumericFor<"f32", InFunc>
  | WasmNumericFor<"f64", InFunc>;

type WasmBlockType = {
  paramTypes: WasmNumericType[];
  resultTypes: WasmNumericType[];
  localTypes?: WasmNumericType[];
};

type WasmBlockBase = { label?: string; blockType: WasmBlockType };
type WasmBlock = WasmBlockBase &
  (
    | { instr: "block"; body: WasmInstruction[] }
    | { instr: "loop"; body: WasmInstruction[] }
    | {
        instr: "if";
        predicate: WasmNumeric;
        then: WasmInstruction[];
        else?: WasmInstruction[];
      }
  );

type WasmControl =
  | WasmBlock
  | { instr: "br"; label: string | number }
  | { instr: "br_if"; label: string | number; predicate: WasmNumeric }
  | { instr: "br_table"; labels: (string | number)[]; index: WasmNumeric }
  | { instr: "call"; function: string | number }
  | { instr: "return" }
  | { instr: "drop"; value: WasmNumeric }
  | {
      instr: "select";
      condition: WasmNumeric;
      ifTrue: WasmNumeric;
      ifFalse: WasmNumeric;
    };

type WasmFunction = {
  instr: "func";
  name?: string;
  params: { name?: string; type: WasmNumericType }[];
  results: WasmNumericType[];
  locals?: { name?: string; type: WasmNumericType }[];
  body: WasmInstruction[];
};

type WasmInstruction = WasmNumeric | WasmControl | WasmFunction;

const test: WasmFunction = {
  instr: "func",
  name: "$_apply",
  params: [
    { name: "$arg1", type: "i32" },
    { name: "$arg2", type: "f32" },
  ],
  results: ["i32"],
  body: [
    {
      instr: "i32.add",
      left: {
        instr: "i32.ne",
        left: { instr: "i32.const", value: BigInt(0) },
        right: { instr: "i32.const", value: BigInt(1) },
      },
      right: { instr: "i32.const", value: BigInt(1) },
    },
  ],
};

export {};
