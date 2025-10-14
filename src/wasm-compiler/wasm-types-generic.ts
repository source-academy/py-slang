type WasmIntNumericType = "i32" | "i64";
type WasmFloatNumericType = "f32" | "f64";
type WasmNumericType = WasmIntNumericType | WasmFloatNumericType;
type WasmFuncLocal = [type: WasmNumericType, label: `$${string}`];

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

type WasmUnaryOp<T extends WasmFloatNumericType, F extends WasmFuncLocal> = {
  instr: `${T}.${FloatUnaryOp}`;
  right: WasmNumericFor<T, F>;
};

type WasmBinaryOp<T extends WasmNumericType, F extends WasmFuncLocal> = {
  instr: `${T}.${T extends WasmIntNumericType ? IntBinaryOp : FloatBinaryOp}`;
  left: WasmNumericFor<T, F>;
  right: WasmNumericFor<T, F>;
};

type WasmIntTestOp<T extends WasmIntNumericType, F extends WasmFuncLocal> = {
  instr: `${T}.${IntTestOp}`;
  right: WasmNumericFor<T, F>;
};

type WasmComparisonOp<T extends WasmNumericType, F extends WasmFuncLocal> = {
  instr: `${T}.${T extends WasmIntNumericType
    ? IntComparisonOp
    : FloatComparisonOp}`;
  left: WasmNumericFor<T, F>;
  right: WasmNumericFor<T, F>;
};

type ExtractConversion<I extends string> = I extends `${string}_${infer T}`
  ? T extends WasmNumericType
    ? T
    : T extends `${infer U}_${string}`
    ? U
    : never
  : never;

type WasmConversionOpHelper<I, F extends WasmFuncLocal> = I extends
  | `i32.${I32ConversionOp | IntConversionOp}`
  | `i64.${I64ConversionOp | IntConversionOp}`
  | `f32.${F32ConversionOp | FloatConversionOp}`
  | `f64.${F64ConversionOp | FloatConversionOp}`
  ? {
      instr: I;
      right: WasmNumericFor<ExtractConversion<I>, F>;
    }
  : never;

type WasmConversionOp<
  T extends WasmNumericType,
  F extends WasmFuncLocal
> = WasmConversionOpHelper<
  `${T}.${T extends "i32"
    ? I32ConversionOp | IntConversionOp
    : T extends "i64"
    ? I64ConversionOp | IntConversionOp
    : T extends "f32"
    ? F32ConversionOp | FloatConversionOp
    : T extends "f64"
    ? F64ConversionOp | FloatConversionOp
    : never}`,
  F
>;

type WasmNumericFor<T extends WasmNumericType, F extends WasmFuncLocal> =
  | WasmNumericConst<T>
  | (T extends WasmFloatNumericType ? WasmUnaryOp<T, F> : never)
  | WasmBinaryOp<T, F>
  | (T extends WasmIntNumericType ? WasmIntTestOp<T, F> : never)
  | WasmComparisonOp<T, F>
  | WasmConversionOp<T, F>
  | (F[0] extends T
      ? {
          instr: "local.get";
          label: F[1];
        }
      : never);

type WasmNumeric<F extends WasmFuncLocal> =
  | WasmNumericFor<"i32", F>
  | WasmNumericFor<"i64", F>
  | WasmNumericFor<"f32", F>
  | WasmNumericFor<"f64", F>;

type WasmBlockType = {
  paramTypes: WasmNumericType[];
  resultTypes: WasmNumericType[];
  localTypes?: WasmNumericType[];
};

type WasmBlockBase = { label?: string; blockType: WasmBlockType };
type WasmBlock<F extends WasmFuncLocal> = WasmBlockBase &
  (
    | { instr: "block"; body: WasmInstruction<F>[] }
    | { instr: "loop"; body: WasmInstruction<F>[] }
    | {
        instr: "if";
        predicate: WasmNumeric<F>;
        then: WasmInstruction<F>[];
        else?: WasmInstruction<F>[];
      }
  );

type WasmControl<F extends WasmFuncLocal> =
  | WasmBlock<F>
  | { instr: "br"; label: string | number }
  | {
      instr: "br_if";
      label: string | number;
      predicate: WasmNumeric<F>;
    }
  | {
      instr: "br_table";
      labels: (string | number)[];
      index: WasmNumeric<F>;
    }
  | { instr: "call"; function: string | number }
  | { instr: "return" }
  | { instr: "drop"; value: WasmNumeric<F> }
  | {
      instr: "select";
      condition: WasmNumeric<F>;
      ifTrue: WasmNumeric<F>;
      ifFalse: WasmNumeric<F>;
    };

type WasmLocalSet<F extends WasmFuncLocal> = {
  instr: "local.set";
  label: F[1];
  right: WasmNumericFor<F[0], F>;
};

type WasmFunction<
  Params extends WasmFuncLocal[],
  Locals extends WasmFuncLocal[]
> = {
  instr: "func";
  name?: string;
  params?: Params;
  results?: WasmNumericType[];
  locals?: Locals;
  body: (
    | (Params[number] extends infer T
        ? T extends WasmFuncLocal
          ? WasmLocalSet<T>
          : never
        : never)
    | (Locals[number] extends infer T
        ? T extends WasmFuncLocal
          ? WasmLocalSet<T>
          : never
        : never)
    | Exclude<
        Params[number] | Locals[number] extends infer F
          ? F extends WasmFuncLocal
            ? WasmInstruction<F>
            : never
          : never,
        WasmFunction<any, any>
      >
  )[];
};

type WasmInstruction<F extends WasmFuncLocal> =
  | WasmNumeric<F>
  | WasmControl<F>
  | WasmFunction<WasmFuncLocal[], WasmFuncLocal[]>;

const makeWasmFunction = <
  const Params extends WasmFuncLocal[],
  const Locals extends WasmFuncLocal[]
>(
  x: Omit<WasmFunction<Params, Locals>, "instr">
) => ({ instr: "func", ...x });

const test = makeWasmFunction({
  name: "$_apply",
  params: [
    ["i32", "$arg1"],
    ["f32", "$arg2"],
  ],
  locals: [["f32", "$local1"]],
  results: ["i32"],
  body: [
    {
      instr: "local.set",
      label: "$arg1",
      right: {
        instr: "i32.add",
        left: {
          instr: "i32.const",
          value: BigInt(4),
        },
        right: {
          instr: "local.get",
          label: "$arg1",
        },
      },
    },
  ],
});

// func($_apply)
//   .params(({ i32, f32 }) => [i32("$arg1"), f32("$arg2")])
//   .locals(({ f32 }) => [f32("$local.1")])
//   .results(({ i32 }) => [i32])
//   .body([
//     local.set("$arg1", i32.add(i32.const(0)), local.get("$arg1")),
//     i64.extend_i32_u(i32.const(0)),
//   ]);

export {};
