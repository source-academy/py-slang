// ------------------------ WASM Builder API ----------------------------

import {
  f32ConversionOp,
  f64ConversionOp,
  floatBinaryOp,
  floatComparisonOp,
  floatConversionOp,
  floatUnaryOp,
  i32ConversionOp,
  i64ConversionOp,
  intBinaryOp,
  intComparisonOp,
  intConversionOp,
  intTestOp,
  type WasmBinaryOp,
  type WasmBlock,
  type WasmBlockType,
  type WasmBr,
  type WasmBrTable,
  type WasmCall,
  type WasmComparisonOp,
  type WasmConst,
  type WasmConversionOp,
  type WasmData,
  type WasmDrop,
  type WasmExport,
  type WasmFloatNumericType,
  type WasmFunction,
  type WasmFuncType,
  type WasmGlobal,
  type WasmGlobalFor,
  type WasmGlobalGet,
  type WasmGlobalSet,
  type WasmIf,
  type WasmImport,
  type WasmInstruction,
  type WasmIntNumericType,
  type WasmIntTestOp,
  type WasmLabel,
  type WasmLoadOp,
  type WasmLocalGet,
  type WasmLocalSet,
  type WasmLocalTee,
  type WasmLoop,
  type WasmMemoryCopy,
  type WasmMemoryFill,
  type WasmModule,
  type WasmNop,
  type WasmNumeric,
  type WasmNumericFor,
  type WasmNumericType,
  type WasmReturn,
  type WasmSelect,
  type WasmStoreOp,
  type WasmUnaryOp,
  type WasmUnreachable,
} from "./types.js";
import { typedFromEntries } from "./util.js";

type BuilderAsType<T extends WasmNumericType = WasmNumericType> = {
  "~type": T;
};

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
        ? WasmIntTestOp<T> | WasmLoadOp<T>
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

type Builder<T extends WasmNumericType | "local" | "global" | "memory"> = {
  [K in WasmInstruction["op"] as K extends `${T}.${infer S}` ? S : never]: (
    ...args: never[]
  ) => Extract<WasmInstruction, { op: K }>;
} & (T extends WasmNumericType ? BuilderAsType<T> : unknown);

const loadHelper =
  <const Op extends string>(op: Op) =>
  (address: WasmNumericFor<"i32">) => ({ op, address });

const i32 = {
  const: (value: number | bigint): WasmConst<"i32"> => ({
    op: "i32.const",
    value: BigInt(value),
  }),
  ...binaryOp("i32", [...intBinaryOp, ...intComparisonOp]),
  ...unaryOp("i32", [...i32ConversionOp, ...intConversionOp, ...intTestOp]),
  load: loadHelper("i32.load"),
  load8_s: loadHelper("i32.load8_s"),
  load8_u: loadHelper("i32.load8_u"),
  load16_s: loadHelper("i32.load16_s"),
  load16_u: loadHelper("i32.load16_u"),
  store: (
    address: WasmNumericFor<"i32">,
    value: WasmNumericFor<"i32">
  ): WasmStoreOp<"i32"> => ({ op: "i32.store", address, value }),

  "~type": "i32",
} satisfies Builder<"i32">;

const i64 = {
  const: (value: number | bigint): WasmConst<"i64"> => ({
    op: "i64.const",
    value: BigInt(value),
  }),
  ...binaryOp("i64", [...intBinaryOp, ...intComparisonOp]),
  ...unaryOp("i64", [...i64ConversionOp, ...intConversionOp, ...intTestOp]),
  load: loadHelper("i64.load"),
  load8_s: loadHelper("i64.load8_s"),
  load8_u: loadHelper("i64.load8_u"),
  load16_s: loadHelper("i64.load16_s"),
  load16_u: loadHelper("i64.load16_u"),
  load32_s: loadHelper("i64.load32_s"),
  load32_u: loadHelper("i64.load32_u"),
  store: (
    address: WasmNumericFor<"i32">,
    value: WasmNumericFor<"i64">
  ): WasmStoreOp<"i64"> => ({ op: "i64.store", address, value }),

  "~type": "i64",
} satisfies Builder<"i64">;

const f32 = {
  const: (value: number): WasmConst<"f32"> => ({
    op: "f32.const",
    value,
  }),
  ...binaryOp("f32", [...floatBinaryOp, ...floatComparisonOp]),
  ...unaryOp("f32", [
    ...f32ConversionOp,
    ...floatConversionOp,
    ...floatUnaryOp,
  ]),
  load: (address: WasmNumericFor<"i32">): WasmLoadOp<"f32"> => ({
    op: "f32.load",
    address,
  }),
  store: (
    address: WasmNumericFor<"i32">,
    value: WasmNumericFor<"f32">
  ): WasmStoreOp<"f32"> => ({ op: "f32.store", address, value }),

  "~type": "f32",
} satisfies Builder<"f32">;

const f64 = {
  const: (value: number): WasmConst<"f64"> => ({
    op: "f64.const",
    value,
  }),
  ...binaryOp("f64", [...floatBinaryOp, ...floatComparisonOp]),
  ...unaryOp("f64", [
    ...f64ConversionOp,
    ...floatConversionOp,
    ...floatUnaryOp,
  ]),
  load: (address: WasmNumericFor<"i32">): WasmLoadOp<"f64"> => ({
    op: "f64.load",
    address,
  }),
  store: (
    address: WasmNumericFor<"i32">,
    value: WasmNumericFor<"f64">
  ): WasmStoreOp<"f64"> => ({ op: "f64.store", address, value }),

  "~type": "f64",
} satisfies Builder<"f64">;

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
} satisfies Builder<"local">;

const global = {
  get: (label: WasmLabel): WasmGlobalGet => ({ op: "global.get", label }),
  set: (label: WasmLabel, right: WasmNumeric): WasmGlobalSet => ({
    op: "global.set",
    label,
    right,
  }),
} satisfies Builder<"global">;

const memory = {
  copy: (
    destination: WasmNumericFor<"i32">,
    source: WasmNumericFor<"i32">,
    size: WasmNumericFor<"i32">
  ): WasmMemoryCopy => ({ op: "memory.copy", destination, source, size }),

  fill: (
    address: WasmNumericFor<"i32">,
    value: WasmNumericFor<"i32">,
    numOfBytes: WasmNumericFor<"i32">
  ): WasmMemoryFill => ({ op: "memory.fill", address, value, numOfBytes }),
} satisfies Builder<"memory">;

type WasmBlockTypeHelper<T extends WasmBlock | WasmLoop> = {
  params(...params: BuilderAsType[]): WasmBlockTypeHelper<T>;
  results(...results: BuilderAsType[]): WasmBlockTypeHelper<T>;
  locals(...locals: BuilderAsType[]): WasmBlockTypeHelper<T>;

  body(...instrs: WasmInstruction[]): T;
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
  params(params: Record<WasmLabel, BuilderAsType>): WasmFuncTypeHelper;
  locals(locals: Record<WasmLabel, BuilderAsType>): WasmFuncTypeHelper;
  results(...results: BuilderAsType[]): WasmFuncTypeHelper;

  body(...instrs: WasmInstruction[]): WasmFunction;
};

type WasmModuleHelper = {
  imports(...imports: WasmImport[]): WasmModuleHelper;
  globals(...globals: WasmGlobal[]): WasmModuleHelper;
  datas(...datas: WasmData[]): WasmModuleHelper;
  funcs(...funcs: WasmFunction[]): WasmModuleHelper;
  startFunc(startFunc: WasmLabel): Omit<WasmModuleHelper, "startFunc">;
  exports(...exports: WasmExport[]): WasmModuleHelper;

  build(): WasmModule;
};

const blockLoopHelper =
  <T extends "block" | "loop">(type: T) =>
  (
    label?: WasmLabel
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
      locals(...locals) {
        blockType.localTypes.push(...locals.map((l) => l["~type"]));
        return this;
      },
      results(...results) {
        blockType.resultTypes.push(...results.map((r) => r["~type"]));
        return this;
      },

      body(...instrs: WasmInstruction[]) {
        return { op: type, label, blockType, body: instrs } as T extends "block"
          ? WasmBlock
          : WasmLoop;
      },
    };
  };

type BuilderMutableType<T extends WasmNumericType> = {
  "~type": `mut ${T}`;
};
const mut: { [T in WasmNumericType]: BuilderMutableType<T> } = {
  i32: { "~type": "mut i32" },
  i64: { "~type": "mut i64" },
  f32: { "~type": "mut f32" },
  f64: { "~type": "mut f64" },
};

const wasm = {
  block: blockLoopHelper("block"),
  loop: blockLoopHelper("loop"),
  if: (predicate: WasmNumeric, label?: WasmLabel): WasmIfBlockTypeHelper => {
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
    };
  },
  drop: (value?: WasmInstruction): WasmDrop => ({ op: "drop", value }),
  unreachable: (): WasmUnreachable => ({ op: "unreachable" }),
  nop: (): WasmNop => ({ op: "nop" }),
  br: (label: WasmLabel): WasmBr => ({ op: "br", label }),
  br_table: (
    value: WasmNumeric,
    ...labels: (WasmLabel | number)[]
  ): WasmBrTable => ({ op: "br_table", labels, value }),

  call: (
    functionName: WasmLabel | WasmFunction
  ): WasmCall & { args(...args: WasmNumeric[]): WasmCall } => ({
    op: "call",
    function:
      typeof functionName === "string" ? functionName : functionName.name,
    arguments: [],
    args(...args: WasmNumeric[]): WasmCall {
      return { ...this, arguments: args };
    },
  }),

  return: (...values: WasmInstruction[]): WasmReturn => ({
    op: "return",
    values,
  }),
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

    func(name: WasmLabel) {
      const funcType: Required<WasmBlockType> = {
        paramTypes: [],
        resultTypes: [],
        localTypes: [],
      };
      const importInstr: WasmImport = {
        op: "import",
        moduleName,
        itemName,
        externType: { type: "func", name, funcType },
      };

      return {
        ...importInstr,
        params(...params: BuilderAsType[]) {
          funcType.paramTypes.push(...params.map((p) => p["~type"]));
          return this;
        },
        locals(...locals: BuilderAsType[]) {
          funcType.localTypes.push(...locals.map((l) => l["~type"]));
          return this;
        },
        results(...results: BuilderAsType[]) {
          funcType.resultTypes.push(...results.map((r) => r["~type"]));
          return this;
        },
      };
    },
  }),

  global: <T extends WasmNumericType>(
    name: WasmLabel,
    valueType: BuilderAsType<T> | BuilderMutableType<T>
  ) => ({
    init: (initialValue: WasmNumericFor<T>): WasmGlobalFor<T> => ({
      op: "global",
      name,
      valueType: valueType["~type"],
      initialValue,
    }),
  }),

  data: (offset: WasmNumericFor<"i32">, data: string): WasmData => ({
    op: "data",
    offset,
    data,
  }),

  func(name: WasmLabel): WasmFuncTypeHelper {
    const funcType: WasmFuncType = {
      paramTypes: {},
      resultTypes: [],
      localTypes: {},
    };
    return {
      params(params) {
        for (const [key, val] of Object.entries(params))
          funcType.paramTypes[key as WasmLabel] = val["~type"];

        return this;
      },
      locals(locals) {
        for (const [key, val] of Object.entries(locals))
          funcType.localTypes[key as WasmLabel] = val["~type"];
        return this;
      },
      results(...results) {
        funcType.resultTypes.push(...results.map((r) => r["~type"]));
        return this;
      },

      body(...instrs) {
        return { op: "func", name, funcType, body: instrs };
      },
    };
  },

  export: (name: string) => ({
    memory: (index: number): WasmExport => ({
      op: "export",
      name,
      externType: { type: "memory", index },
    }),
    func: (identifier: WasmLabel): WasmExport => ({
      op: "export",
      name,
      externType: { type: "func", identifier },
    }),
  }),

  module(): WasmModuleHelper {
    const definitions: Omit<WasmModule, "op"> = {
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
        definitions.startFunc = { op: "start", functionName: startFunc };
        return this;
      },
      exports(...exports) {
        definitions.exports.push(...exports);
        return this;
      },

      build() {
        return { op: "module", ...definitions };
      },
    };
  },

  // not a WASM instruction, but a helper to build br_table with blocks
  buildBrTableBlocks: (
    { labels, value }: WasmBrTable,
    ...bodies: (WasmInstruction | WasmInstruction[])[]
  ) => {
    if (labels.length !== bodies.length) {
      throw new Error(
        `Number of labels in br_table (${labels.length}) does not match number of blocks (${bodies.length})`
      );
    }

    const buildBlock = (index: number): [WasmBlock, ...WasmInstruction[]] => {
      const body = bodies[bodies.length - index - 1];
      if (!body) {
        throw new Error(
          `No body found for block at index ${index} in br_table`
        );
      }

      return [
        wasm
          .block(typeof labels[index] === "string" ? labels[index] : undefined)
          .body(
            ...(index === labels.length - 1
              ? [wasm.br_table(value, ...labels)]
              : buildBlock(index + 1))
          ),
        ...(Array.isArray(body) ? body : [body]),
      ];
    };

    return buildBlock(0);
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
  "memory.fill": "visitMemoryFillOp",

  // control
  unreachable: "visitUnreachableOp",
  drop: "visitDropOp",
  nop: "visitNopOp",
  block: "visitBlockOp",
  loop: "visitLoopOp",
  if: "visitIfOp",
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
  mut,
  wasm,
  type WatVisitor,
};
