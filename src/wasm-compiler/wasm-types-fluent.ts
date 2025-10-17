// func("$_apply")
//   .params(({ i3232 }) => [i32("$arg1")32("$arg2")])
//   .locals(({ f32 }) => [f32("$local.1")])
//   .results(({ i32 }) => [i32])
//   .body([
//     local.set("$arg1", i32.add(i32.const(0)), local.get("$arg1")),
//     i64.extend_i32_u(i32.const(0)),
//   ]);

// (loop $loop
//   (i32.eqz (local.get $depth)) (if (then
//     (local.get $env) (i32.const 4) (i32.add) (local.get $index) (i32.const 12) (i32.mul) (i32.add) (i32.load) (local.set $tag)
//     (i32.eq (local.get $tag) (i32.const ${TYPE_TAG.UNBOUND})) (if (then unreachable))
//     (local.get $tag)
//     (local.get $env) (i32.const 8) (i32.add) (local.get $index) (i32.const 12) (i32.mul) (i32.add) (i64.load)
//     (return)
//   ))

//   (local.get $env) (i32.load) (local.set $env)
//   (local.get $depth) (i32.const 1) (i32.sub) (local.set $depth)
//   (br $loop)

// loop("$loop").body([
//   wasm
//     .if(i32.eqz(local.get("$depth")))
//     .then([
//       local.set(
//         "$tag",
//         i32.load(
//           i32.add(
//             i32.add(local.get("$env"), i32.const(4)),
//             i32.mul(local.get("$index"), i32.const(12))
//           )
//         )
//       ),

//       wasm
//         .if(i32.eq(local.get("$tag"), i32.const(TYPE_TAG.UNBOUND)))
//         .then([wasm.unreachable()]),

//       local.get($tag),

//       i64.load(
//         i32.add(
//           i32.add(local.get("$env"), i32.const(8)),
//           i32.mul(local.get("$index"), i32.const(12))
//         )
//       ),

//       wasm.return(),
//     ]),

//   local.set("$env", i32.load(local.get("env"))),
//   local.set("$depth", i32.sub(local.get("$depth"), i32.const(1))),

//   wasm.br("$loop"),
// ]);
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

type WasmNumericFor<T extends WasmNumericType> =
  | WasmNumericConst<T>
  | (T extends WasmFloatNumericType ? WasmUnaryOp<T> : never)
  | WasmBinaryOp<T>
  | (T extends WasmIntNumericType ? WasmIntTestOp<T> : never)
  | WasmComparisonOp<T>
  | WasmConversionOp<T>;

type WasmNumeric =
  | WasmNumericFor<"i32">
  | WasmNumericFor<"i64">
  | WasmNumericFor<"f32">
  | WasmNumericFor<"f64">;

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

type WasmInstruction = WasmNumeric | WasmBlock;

type WasmNumericFluent<T extends WasmNumericType> = {
  [op in WasmNumericFor<T>["instr"] extends `${T}.${infer S}`
    ? S
    : never]: Extract<
    WasmNumericFor<T>,
    { instr: `${T}.${op}` }
  > extends infer I
    ? (
        ...args: op extends "const"
          ? T extends WasmIntNumericType
            ? [value: number | bigint]
            : [value: number]
          : I extends { left: infer L; right: infer R }
          ? [left: L, right: R]
          : I extends { right: infer R }
          ? [right: R]
          : never
      ) => I
    : never;
};

// type WasmFluent = {
//   [op in WasmInstruction["instr"] extends infer I
//     ? I extends `${WasmNumericType}.${infer S}`
//       ? S
//       : I
//     : never]: op
// };

// type WasmFluent<T extends WasmNumericType | "wasm"> = {
//   [op in WasmInstruction as op["instr"] extends `${WasmNumericType}.${infer S}`
//     ? S
//     : op["instr"]]: op["instr"] extends `${WasmNumericType}.${infer S}`
//     ? S
//     : op["instr"];
// };

type WasmFluent<T extends WasmNumericType | "wasm"> = {
  [I in T extends WasmNumericType
    ? WasmNumericFor<T>
    : WasmBlock as I["instr"] extends `${WasmNumericType}.${infer S}`
    ? S
    : I["instr"]]: (
    ...args: I["instr"] extends `${T}.const`
      ? T extends WasmIntNumericType
        ? [value: number | bigint]
        : [value: number]
      : I extends { left: infer L; right: infer R }
      ? [left: L, right: R]
      : I extends { right: infer R }
      ? [right: R]
      : I extends { blockType: WasmBlockType; body: infer B }
      ? [blockType: WasmBlockTypeHelper, body: B]
      : I extends {
          blockType: WasmBlockType;
          predicate: infer P;
          then: infer T;
          else?: infer E;
        }
      ? [blockType: WasmBlockTypeHelper, predicate: P, then: T, wasmElse?: T]
      : never
  ) => I;
};

const typedFromEntries = <const T extends readonly [PropertyKey, unknown][]>(
  entries: T
) => Object.fromEntries(entries) as { [K in T[number] as K[0]]: K[1] };

type AnyFn = (...args: never[]) => unknown;
const numericFluent = <
  T extends WasmNumericType,
  const Ops extends readonly (keyof WasmFluent<T>)[],
  Params extends WasmFluent<T>[Ops[number]] extends AnyFn
    ? Parameters<WasmFluent<T>[Ops[number]]>
    : never,
  Fn extends WasmFluent<T>[Ops[number]] extends AnyFn
    ? (...args: Params) => Omit<ReturnType<WasmFluent<T>[Ops[number]]>, "instr">
    : never
>(
  type: T,
  ops: Ops,
  fn: Fn
) =>
  typedFromEntries(
    ops.map((op) => [
      op,
      (...args: Params) => ({ instr: `${type}.${String(op)}`, ...fn(...args) }),
    ]) as {
      [I in keyof Ops]: [
        Ops[I],
        (
          ...args: WasmFluent<T>[Ops[I]] extends AnyFn
            ? Parameters<WasmFluent<T>[Ops[I]]>
            : never
        ) => WasmFluent<T>[Ops[I]] extends AnyFn
          ? ReturnType<WasmFluent<T>[Ops[I]]>
          : never
      ];
    }
  );

const i32: WasmFluent<"i32"> = {
  ...numericFluent("i32", ["const"], (value) => ({ value: BigInt(value) })),
  ...numericFluent(
    "i32",
    [...intBinaryOp, ...intComparisonOp],
    (left, right) => ({
      left,
      right,
    })
  ),
  ...numericFluent("i32", intTestOp, (right) => ({ right })),
  ...numericFluent(
    "i32",
    [...i32ConversionOp, ...intConversionOp],
    (right) => ({
      right,
    })
  ),
};

const i64: WasmFluent<"i64"> = {
  ...numericFluent("i64", ["const"], (value) => ({ value: BigInt(value) })),
  ...numericFluent(
    "i64",
    [...intBinaryOp, ...intComparisonOp],
    (left, right) => ({
      left,
      right,
    })
  ),
  ...numericFluent("i64", intTestOp, (right) => ({ right })),
  ...numericFluent(
    "i64",
    [...i64ConversionOp, ...intConversionOp],
    (right) => ({
      right,
    })
  ),
};

const f32: WasmFluent<"f32"> = {
  ...numericFluent("f32", ["const"], (value) => ({ value })),
  ...numericFluent(
    "f32",
    [...floatBinaryOp, ...floatComparisonOp],
    (left, right) => ({ left, right })
  ),
  ...numericFluent("f32", floatUnaryOp, (right) => ({ right })),
  ...numericFluent(
    "f32",
    [...f32ConversionOp, ...floatConversionOp],
    (right) => ({
      right,
    })
  ),
};

const f64: WasmFluent<"f64"> = {
  ...numericFluent("f64", ["const"], (value) => ({ value })),
  ...numericFluent(
    "f64",
    [...floatBinaryOp, ...floatComparisonOp],
    (left, right) => ({ left, right })
  ),
  ...numericFluent("f64", floatUnaryOp, (right) => ({ right })),
  ...numericFluent(
    "f64",
    [...f64ConversionOp, ...floatConversionOp],
    (right) => ({
      right,
    })
  ),
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
  params(...params: WasmNumericType[]) {
    this.product.paramTypes.push(...params);
    return this;
  },
  results(...results: WasmNumericType[]) {
    this.product.paramTypes.push(...results);
    return this;
  },
  locals(...locals: WasmNumericType[]) {
    this.product.localTypes.push(...locals);
    return this;
  },
};

blockType.params("i32");

const wasm: WasmFluent<"wasm"> = {
  block: (helper, body) => ({
    instr: "block",
    blockType: helper.product,
    body,
  }),
  loop: (helper, body) => ({
    instr: "loop",
    blockType: helper.product,
    body,
  }),
  if: (helper, predicate, then, wasmElse) => ({
    instr: "if",
    blockType: helper.product,
    predicate,
    then,
    wasmElse,
  }),
};

wasm.if(blockType.params("i32"), i32.const(0), [i32.const(0)]);

console.dir(
  i32.mul(
    i32.reinterpret_f32(
      f32.add(
        f32.add(f32.const(0.1), f32.const(0.1)),
        f32.demote_f64(f64.const(0.4))
      )
    ),
    i32.const(0)
  ),
  { depth: null }
);

export {};
