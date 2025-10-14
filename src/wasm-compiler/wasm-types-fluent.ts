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

type WasmNumericConst<T extends WasmNumericType> = {
  instr: `${T}.const`;
  value: T extends WasmIntNumericType ? bigint : number;
};

type WasmBinaryOp<T extends WasmNumericType> = {
  instr: `${T}.${T extends WasmIntNumericType ? IntBinaryOp : FloatBinaryOp}`;
  left: WasmNumericFor<T>;
  right: WasmNumericFor<T>;
};

type WasmNumericFor<T extends WasmNumericType> =
  | WasmNumericConst<T>
  | WasmBinaryOp<T>;

type WasmNumeric<> =
  | WasmNumericFor<"i32">
  | WasmNumericFor<"i64">
  | WasmNumericFor<"f32">
  | WasmNumericFor<"f64">;

type WasmInstruction = WasmNumeric;

type WasmNumericFluent<T extends WasmNumericType> = {
  const: (value: number) => WasmNumericFor<T>;
} & {
  [op in IntBinaryOp]: (
    left: WasmNumericFor<T>,
    right: WasmNumericFor<T>
  ) => WasmBinaryOp<T>;
};

const i32: WasmNumericFluent<"i32"> = {
  const: (value) => ({ instr: "i32.const", value: BigInt(value) }),

  add: (left, right) => ({ instr: "i32.add", left, right }),

  // add: (left, right) => ({ instr: "i32.add", left, right }),
  // [key in keyof IntBinaryOp]
};

console.log(i32.add(i32.const(0), i32.const(3)));

// i32.mul(
//   i32.reinterpret_f32(
//     f32.add(
//       f32.add(f32.const(0.1)32.const(0.1)),
//       f32.demote_f64(f64.const(0.4))
//     )
//   ),
//   i32.const(0)
// );
