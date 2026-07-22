import {
  DataType,
  type ExternCallable,
  type IDataHandler,
  type IFunctionSignature,
  type TypedValue,
} from "@sourceacademy/conductor/types";
import { ExprNS, StmtNS } from "../ast-types";
import { Closure } from "../engines/cse/closure";
import { Context } from "../engines/cse/context";
import { listLiteralValues, moduleToPython, pythonToModule } from "../engines/cse/modules";
import { BuiltinValue, ListValue, Value } from "../engines/cse/stash";
import { toPythonAst } from "./utils";

type StoredClosure = {
  sig: IFunctionSignature<readonly DataType[], DataType>;
  func: (...args: TypedValue<DataType>[]) => AsyncGenerator<void, TypedValue<DataType>, undefined>;
};

class TestDataHandler {
  readonly hasDataInterface = true as const;

  private nextId = 1;
  private arrays = new Map<
    TypedValue<DataType.ARRAY>,
    { type: DataType; elements: TypedValue<DataType>[] }
  >();
  private pairs = new Map<
    TypedValue<DataType.PAIR>,
    { head: TypedValue<DataType>; tail: TypedValue<DataType> }
  >();
  private closures = new Map<TypedValue<DataType.CLOSURE>, StoredClosure>();
  private opaques = new Map<TypedValue<DataType.OPAQUE>, { value: unknown; immutable: boolean }>();

  pair_make(
    head: TypedValue<DataType>,
    tail: TypedValue<DataType>,
  ): Promise<TypedValue<DataType.PAIR>> {
    const pair: TypedValue<DataType.PAIR> = { type: DataType.PAIR, value: this.nextId++ as never };
    this.pairs.set(pair, { head, tail });
    return Promise.resolve(pair);
  }

  pair_head(pair: TypedValue<DataType.PAIR>): Promise<TypedValue<DataType>> {
    return Promise.resolve(this.getPair(pair).head);
  }

  pair_tail(pair: TypedValue<DataType.PAIR>): Promise<TypedValue<DataType>> {
    return Promise.resolve(this.getPair(pair).tail);
  }

  array_make<T extends DataType>(
    type: T,
    len: number,
    init?: TypedValue<NoInfer<T>>,
  ): Promise<TypedValue<DataType.ARRAY, NoInfer<T>>> {
    const array: TypedValue<DataType.ARRAY, NoInfer<T>> = {
      type: DataType.ARRAY,
      value: this.nextId++ as never,
    };
    this.arrays.set(array, {
      type,
      elements: Array.from({ length: len }, () => init ?? ({ type, value: undefined } as never)),
    });
    return Promise.resolve(array);
  }

  array_length(array: TypedValue<DataType.ARRAY>): Promise<number> {
    return Promise.resolve(this.getArray(array).elements.length);
  }

  array_get(
    array: TypedValue<DataType.ARRAY, DataType.VOID>,
    idx: number,
  ): Promise<TypedValue<DataType>>;
  array_get<T extends DataType>(
    array: TypedValue<DataType.ARRAY, T>,
    idx: number,
  ): Promise<TypedValue<NoInfer<T>>>;
  array_get(array: TypedValue<DataType.ARRAY>, idx: number): Promise<TypedValue<DataType>> {
    return Promise.resolve(this.getArray(array).elements[idx]);
  }

  array_set(
    array: TypedValue<DataType.ARRAY, DataType.VOID>,
    idx: number,
    value: TypedValue<DataType>,
  ): Promise<void>;
  array_set<T extends DataType>(
    array: TypedValue<DataType.ARRAY, T>,
    idx: number,
    value: TypedValue<NoInfer<T>>,
  ): Promise<void>;
  array_set(
    array: TypedValue<DataType.ARRAY>,
    idx: number,
    value: TypedValue<DataType>,
  ): Promise<void> {
    this.getArray(array).elements[idx] = value;
    return Promise.resolve();
  }

  closure_make<const Arg extends readonly DataType[], const Ret extends DataType>(
    sig: IFunctionSignature<Arg, Ret>,
    func: ExternCallable<Arg, Ret>,
  ): Promise<TypedValue<DataType.CLOSURE, Ret>> {
    const closure: TypedValue<DataType.CLOSURE, Ret> = {
      type: DataType.CLOSURE,
      value: this.nextId++ as never,
    };
    this.closures.set(closure, {
      sig,
      func: func as unknown as StoredClosure["func"],
    });
    return Promise.resolve(closure);
  }

  closure_arity(closure: TypedValue<DataType.CLOSURE>): Promise<number> {
    return Promise.resolve(this.getClosure(closure).sig.args.length);
  }

  closure_call_unchecked<T extends DataType>(
    closure: TypedValue<DataType.CLOSURE, T>,
    args: TypedValue<DataType>[],
  ): AsyncGenerator<void, TypedValue<NoInfer<T>>, undefined> {
    return this.getClosure(closure).func(...args) as AsyncGenerator<
      void,
      TypedValue<NoInfer<T>>,
      undefined
    >;
  }

  opaque_make(value: unknown, immutable?: boolean): Promise<TypedValue<DataType.OPAQUE>> {
    const opaque: TypedValue<DataType.OPAQUE> = {
      type: DataType.OPAQUE,
      value: this.nextId++ as never,
    };
    this.opaques.set(opaque, { value, immutable: immutable ?? false });
    return Promise.resolve(opaque);
  }

  opaque_get(opaque: TypedValue<DataType.OPAQUE>): Promise<unknown> {
    return Promise.resolve(this.getOpaque(opaque).value);
  }

  opaque_update(opaque: TypedValue<DataType.OPAQUE>, value: unknown): Promise<void> {
    const stored = this.getOpaque(opaque);
    if (stored.immutable) {
      throw new Error("Cannot update immutable opaque value");
    }
    stored.value = value;
    return Promise.resolve();
  }

  private getArray(array: TypedValue<DataType.ARRAY>) {
    const stored = this.arrays.get(array);
    if (!stored) {
      throw new Error(`Invalid array identifier: ${array.value}`);
    }
    return stored;
  }

  private getPair(pair: TypedValue<DataType.PAIR>) {
    const stored = this.pairs.get(pair);
    if (!stored) {
      throw new Error(`Invalid pair identifier: ${pair.value}`);
    }
    return stored;
  }

  private getClosure(closure: TypedValue<DataType.CLOSURE>) {
    const stored = this.closures.get(closure);
    if (!stored) {
      throw new Error(`Invalid closure identifier: ${closure.value}`);
    }
    return stored;
  }

  private getOpaque(opaque: TypedValue<DataType.OPAQUE>) {
    const stored = this.opaques.get(opaque);
    if (!stored) {
      throw new Error(`Invalid opaque identifier: ${opaque.value}`);
    }
    return stored;
  }
}

function makeContext(): { context: Context; evaluator: TestDataHandler } {
  const context = new Context();
  const evaluator = new TestDataHandler();
  context.evaluator = evaluator as unknown as IDataHandler;
  return { context, evaluator };
}

/** Reads a DataType.ARRAY's elements via the raw array_length/array_get primitives - used instead
 * of list_to_vec since TestDataHandler (this file's isolated double) doesn't implement it. */
async function readArray(
  evaluator: TestDataHandler,
  array: TypedValue<DataType.ARRAY>,
): Promise<TypedValue<DataType>[]> {
  const length = await evaluator.array_length(array);
  return Promise.all(Array.from({ length }, (_, i) => evaluator.array_get(array, i)));
}

async function drainGenerator<T>(generator: AsyncGenerator<void, T, undefined>): Promise<T> {
  let next = await generator.next();
  while (!next.done) {
    next = await generator.next();
  }
  return next.value;
}

function parsedLambda(code: string): ExprNS.Lambda {
  const program = toPythonAst(code) as StmtNS.FileInput;
  const stmt = program.statements[0] as StmtNS.SimpleExpr;
  return stmt.expression as ExprNS.Lambda;
}

describe("module interop conversions", () => {
  describe("pythonToModule", () => {
    test("converts Python primitives to module typed values", async () => {
      const { context } = makeContext();

      await expect(
        pythonToModule(context, "", undefined, { type: "number", value: 1.5 }),
      ).resolves.toEqual({ type: DataType.NUMBER, value: 1.5 });
      await expect(
        pythonToModule(context, "", undefined, { type: "bool", value: true }),
      ).resolves.toEqual({ type: DataType.BOOLEAN, value: true });
      await expect(
        pythonToModule(context, "", undefined, { type: "string", value: "hello" }),
      ).resolves.toEqual({ type: DataType.CONST_STRING, value: "hello" });
      await expect(pythonToModule(context, "", undefined, { type: "none" })).resolves.toEqual({
        type: DataType.EMPTY_LIST,
        value: null,
      });
    });

    test("converts a Python list literal of any length into a flat DataType.ARRAY, recursively", async () => {
      // Per Martin: a pair is just an array of length 2, not a distinct concept - every Python
      // list (any length, 2 included) becomes a flat ARRAY now, with no origin-tagging or
      // length-based branching. GenericDataHandler's list_to_vec/pair_head/pair_tail bridging onto
      // ARRAY is covered separately in GenericDataHandler.test.ts; this file's TestDataHandler
      // double only implements the raw array_length/array_get primitives, used directly here.
      const { context, evaluator } = makeContext();
      const pythonList: Value = {
        type: "list",
        value: [
          { type: "number", value: 1 },
          { type: "list", value: [{ type: "string", value: "nested" }] },
          { type: "bool", value: false },
        ],
      };

      const moduleList = await pythonToModule(context, "", undefined, pythonList);

      expect(moduleList.type).toBe(DataType.ARRAY);
      const elements = await readArray(evaluator, moduleList as TypedValue<DataType.ARRAY>);
      expect(elements).toEqual([
        { type: DataType.NUMBER, value: 1 },
        expect.objectContaining({ type: DataType.ARRAY }),
        { type: DataType.BOOLEAN, value: false },
      ]);

      // The single-element nested list is itself a flat 1-element ARRAY.
      const nested = elements[1] as TypedValue<DataType.ARRAY>;
      await expect(readArray(evaluator, nested)).resolves.toEqual([
        { type: DataType.CONST_STRING, value: "nested" },
      ]);
    });

    test("converts an empty Python list literal into EMPTY_LIST, not an empty ARRAY", async () => {
      const { context } = makeContext();
      await expect(
        pythonToModule(context, "", undefined, { type: "list", value: [] }),
      ).resolves.toEqual({ type: DataType.EMPTY_LIST, value: null });
    });

    test("a 2-element list becomes a flat ARRAY too - no more special-casing by length or listLiteralValues tagging", async () => {
      const { context, evaluator } = makeContext();
      const literal: ListValue = {
        type: "list",
        value: [
          { type: "number", value: 1 },
          { type: "number", value: 2 },
        ],
      };
      // Tagging listLiteralValues (or not) no longer changes anything - kept here only to show
      // that explicitly, since older code paths still tag literals at construction time.
      listLiteralValues.add(literal);

      const moduleList = await pythonToModule(context, "", undefined, literal);

      expect(moduleList.type).toBe(DataType.ARRAY);
      await expect(readArray(evaluator, moduleList as TypedValue<DataType.ARRAY>)).resolves.toEqual(
        [
          { type: DataType.NUMBER, value: 1 },
          { type: DataType.NUMBER, value: 2 },
        ],
      );
    });

    test("round-trips a module PAIR (e.g. sound's Sound, a dotted (wave, duration) pair) back into an ARRAY", async () => {
      // A module may return a PAIR whose second element is arbitrary data, not another list link
      // (sound's Sound is exactly this shape). moduleToPython turns that into a 2-element Python
      // list; passing it back into another module call now builds an ARRAY (uniformly, like any
      // other list) rather than reconstructing a PAIR. (That pair_head/pair_tail still read the
      // same two elements off an ARRAY - so a module calling them for clarity keeps working
      // unchanged - is GenericDataHandler-specific behavior, covered in GenericDataHandler.test.ts;
      // TestDataHandler here doesn't implement that bridge.)
      const { context, evaluator } = makeContext();
      const pair = await evaluator.pair_make(
        { type: DataType.NUMBER, value: 1 },
        { type: DataType.NUMBER, value: 2 },
      );

      const asPython = await moduleToPython(context, "", undefined, pair);
      const roundTripped = await pythonToModule(context, "", undefined, asPython);

      expect(roundTripped.type).toBe(DataType.ARRAY);
      await expect(
        readArray(evaluator, roundTripped as TypedValue<DataType.ARRAY>),
      ).resolves.toEqual([
        { type: DataType.NUMBER, value: 1 },
        { type: DataType.NUMBER, value: 2 },
      ]);
    });

    test("wraps Python builtins as module closures", async () => {
      const { context, evaluator } = makeContext();
      const add: BuiltinValue = {
        type: "builtin",
        name: "add",
        minArgs: 2,
        func: args => {
          const [left, right] = args;
          if (left?.type !== "number" || right?.type !== "number") {
            throw new Error("Expected number arguments");
          }
          return { type: "number", value: left.value + right.value };
        },
      };

      const closure = await pythonToModule(context, "", undefined, add);
      const result = await drainGenerator(
        evaluator.closure_call_unchecked(closure as TypedValue<DataType.CLOSURE>, [
          { type: DataType.NUMBER, value: 2 },
          { type: DataType.NUMBER, value: 3 },
        ]),
      );

      expect(await evaluator.closure_arity(closure as TypedValue<DataType.CLOSURE>)).toBe(2);
      expect(result).toEqual({ type: DataType.NUMBER, value: 5 });
    });

    test("uses fixed parameters before a starred parameter as closure arity", async () => {
      const { context, evaluator } = makeContext();
      const lambda = parsedLambda("lambda x, y, *rest: x");
      const closureValue: Value = {
        type: "closure",
        closure: new Closure(lambda, context.runtime.environments[0], context),
      };

      const closure = await pythonToModule(context, "", undefined, closureValue);

      expect(await evaluator.closure_arity(closure as TypedValue<DataType.CLOSURE>)).toBe(2);
    });

    test("uses zero arity for closures with only a starred parameter", async () => {
      const { context, evaluator } = makeContext();
      const lambda = parsedLambda("lambda *args: args");
      const closureValue: Value = {
        type: "closure",
        closure: new Closure(lambda, context.runtime.environments[0], context),
      };

      const closure = await pythonToModule(context, "", undefined, closureValue);

      expect(await evaluator.closure_arity(closure as TypedValue<DataType.CLOSURE>)).toBe(0);
    });
  });

  describe("moduleToPython", () => {
    test("converts module primitives to Python values", async () => {
      const { context } = makeContext();

      await expect(
        moduleToPython(context, "", undefined, { type: DataType.NUMBER, value: 1.5 }),
      ).resolves.toEqual({ type: "number", value: 1.5 });
      await expect(
        moduleToPython(context, "", undefined, { type: DataType.BOOLEAN, value: false }),
      ).resolves.toEqual({ type: "bool", value: false });
      await expect(
        moduleToPython(context, "", undefined, { type: DataType.CONST_STRING, value: "hello" }),
      ).resolves.toEqual({ type: "string", value: "hello" });
      await expect(
        moduleToPython(context, "", undefined, { type: DataType.VOID, value: undefined }),
      ).resolves.toEqual({ type: "none" });
    });

    test("converts module pairs to Python lists", async () => {
      const { context, evaluator } = makeContext();
      const pair = await evaluator.pair_make(
        { type: DataType.NUMBER, value: 1 },
        { type: DataType.CONST_STRING, value: "tail" },
      );

      await expect(moduleToPython(context, "", undefined, pair)).resolves.toEqual({
        type: "list",
        value: [
          { type: "number", value: 1 },
          { type: "string", value: "tail" },
        ],
      });
    });

    test("wraps module closures as Python builtins", async () => {
      const { context, evaluator } = makeContext();
      const closure = await evaluator.closure_make(
        { returnType: DataType.NUMBER, args: [DataType.NUMBER] },
        async function* (arg) {
          await Promise.resolve();
          return { type: DataType.NUMBER, value: arg.value * 2 };
        },
      );

      const pythonValue = await moduleToPython(context, "", undefined, closure);

      expect(pythonValue).toEqual(
        expect.objectContaining({ type: "builtin", minArgs: 1, name: "closure" }),
      );
      if (pythonValue.type !== "builtin") {
        throw new Error("Expected builtin value");
      }
      const result = await drainGenerator(
        pythonValue.func(
          [{ type: "number", value: 4 }],
          "",
          undefined as never,
          context,
        ) as AsyncGenerator<void, TypedValue<DataType>, undefined>,
      );

      expect(result).toEqual({ type: DataType.NUMBER, value: 8 });
    });

    test("preserves opaque identifiers through moduleToPython then pythonToModule", async () => {
      const { context } = makeContext();
      const opaqueValue: TypedValue<DataType.OPAQUE> = {
        type: DataType.OPAQUE,
        value: 123 as never,
      };

      const roundTripped = await pythonToModule(
        context,
        "",
        undefined,
        await moduleToPython(context, "", undefined, opaqueValue),
      );

      expect(roundTripped).toEqual(opaqueValue);
      expect(roundTripped.value).toBe(opaqueValue.value);
    });
  });
});
