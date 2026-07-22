import type { IEvaluator, IInterfacableEvaluator } from "@sourceacademy/conductor/runner";
import {
  ArrayIdentifier,
  ClosureIdentifier,
  DataType,
  ExternCallable,
  IDataHandler,
  IFunctionSignature,
  OpaqueIdentifier,
  PairIdentifier,
  TypedValue,
} from "@sourceacademy/conductor/types";

/**
 * A conductor `IDataHandler` implementation with no engine-specific logic:
 * pairs, arrays, closures and opaques are all just bookkeeping over plain
 * Maps keyed by an incrementing id, and the list helpers (`list`/`is_list`/
 * `list_to_vec`/`accumulate`/`length`) walk that pair structure generically.
 * The only place an engine's own semantics enter the picture is the
 * `ExternCallable` passed to `closure_make` (authored by that engine's own
 * module-interop layer) and the arguments/results flowing through
 * `closure_call`/`closure_call_unchecked` — this class never inspects them.
 *
 * Originally written inline in PyCseEvaluatorBase (see PyCseEvaluator.ts);
 * extracted so every evaluator that talks to conductor modules (CSE, py2js,
 * and eventually WASM/PVML) shares one implementation instead of
 * re-deriving the same identifier-table bookkeeping per engine. An evaluator
 * holds one instance (`private dataHandler = new GenericDataHandler()`) and
 * hands it to both `context.evaluator` (or the engine's equivalent) and
 * `conductor.registerPlugin(ModuleLoaderRunnerPlugin, conductor, dataHandler)`.
 */
export class GenericDataHandler implements IDataHandler {
  hasDataInterface = true as const;
  private pairMap = new Map<
    PairIdentifier,
    { head: TypedValue<DataType>; tail: TypedValue<DataType> }
  >();
  private arrayMap = new Map<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ArrayIdentifier<any>,
    { type: DataType; elements: TypedValue<DataType>[] }
  >();
  private closureMap = new Map<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ClosureIdentifier<any>,
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sig: IFunctionSignature<any, any>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      func: ExternCallable<any, any>;
      dependsOn?: (TypedValue<DataType> | null)[];
      isVararg?: boolean;
    }
  >();
  private opaqueMap = new Map<OpaqueIdentifier, { value: unknown; immutable: boolean }>();
  private uniqueId = 0;
  pair_make(
    head: TypedValue<DataType>,
    tail: TypedValue<DataType>,
  ): Promise<TypedValue<DataType.PAIR>> {
    this.pairMap.set(this.uniqueId++ as PairIdentifier, { head, tail });
    return Promise.resolve({ type: DataType.PAIR, value: (this.uniqueId - 1) as PairIdentifier });
  }
  /**
   * Bridges pair_head/pair_tail/pair_sethead/pair_settail/pair_assert onto a DataType.ARRAY value
   * too, not just a genuine PAIR: per Martin, a pair is just a 2-element array, and module code is
   * free to keep calling pair_head/pair_tail for clarity even once the underlying value it's
   * handed is array-backed (e.g. a value pythonToModule built directly as an ARRAY). Reads/writes
   * index 0/1 directly; throws the same "Invalid pair identifier" a genuine dangling PAIR would,
   * for a dangling/too-short array.
   */
  private resolvePairView(
    p: TypedValue<DataType.PAIR>,
  ): { head: TypedValue<DataType>; tail: TypedValue<DataType> } & (
    | { kind: "pair"; pair: { head: TypedValue<DataType>; tail: TypedValue<DataType> } }
    | { kind: "array"; array: { type: DataType; elements: TypedValue<DataType>[] } }
  ) {
    if ((p.type as DataType) === DataType.ARRAY) {
      const array = this.arrayMap.get(p.value as unknown as ArrayIdentifier<DataType>);
      if (!array || array.elements.length < 2) {
        throw new Error(`Invalid pair identifier: ${p.value}`);
      }
      return { kind: "array", array, head: array.elements[0], tail: array.elements[1] };
    }
    const pair = this.pairMap.get(p.value);
    if (!pair) {
      throw new Error(`Invalid pair identifier: ${p.value}`);
    }
    return { kind: "pair", pair, head: pair.head, tail: pair.tail };
  }
  pair_head(p: TypedValue<DataType.PAIR>): Promise<TypedValue<DataType>> {
    return Promise.resolve(this.resolvePairView(p).head);
  }
  pair_sethead(p: TypedValue<DataType.PAIR>, tv: TypedValue<DataType>): Promise<void> {
    const view = this.resolvePairView(p);
    if (view.kind === "array") {
      view.array.elements[0] = tv;
    } else {
      view.pair.head = tv;
    }
    return Promise.resolve();
  }
  pair_tail(p: TypedValue<DataType.PAIR>): Promise<TypedValue<DataType>> {
    return Promise.resolve(this.resolvePairView(p).tail);
  }
  pair_settail(p: TypedValue<DataType.PAIR>, tv: TypedValue<DataType>): Promise<void> {
    const view = this.resolvePairView(p);
    if (view.kind === "array") {
      view.array.elements[1] = tv;
    } else {
      view.pair.tail = tv;
    }
    return Promise.resolve();
  }
  pair_assert(
    p: TypedValue<DataType.PAIR>,
    headType?: DataType,
    tailType?: DataType,
  ): Promise<void> {
    const { head, tail } = this.resolvePairView(p);
    if (headType && head.type !== headType) {
      throw new Error(`Expected head of type ${headType}, got ${head.type}`);
    }
    if (tailType && tail.type !== tailType) {
      throw new Error(`Expected tail of type ${tailType}, got ${tail.type}`);
    }
    return Promise.resolve();
  }
  array_make<T extends DataType>(
    t: T,
    len: number,
    init?: TypedValue<NoInfer<T>>,
  ): Promise<TypedValue<DataType.ARRAY, NoInfer<T>>> {
    const elements = new Array(len).fill(init ?? { type: t, value: undefined }) as TypedValue<
      NoInfer<T>
    >[];
    const arrayValue: TypedValue<DataType.ARRAY, NoInfer<T>> = {
      type: DataType.ARRAY,
      value: this.uniqueId++ as ArrayIdentifier<typeof t>,
    };
    this.arrayMap.set(arrayValue.value, { type: t, elements });
    return Promise.resolve(arrayValue);
  }
  array_length(a: TypedValue<DataType.ARRAY>): Promise<number> {
    const array = this.arrayMap.get(a.value);
    if (!array) {
      throw new Error(`Invalid array identifier: ${a.value}`);
    }
    return Promise.resolve(array.elements.length);
  }
  array_get<T extends DataType>(
    a: TypedValue<DataType.ARRAY, T>,
    idx: number,
  ): Promise<TypedValue<NoInfer<T>>>;
  array_get(
    a: TypedValue<DataType.ARRAY, DataType.VOID>,
    idx: number,
  ): Promise<TypedValue<DataType>> {
    const array = this.arrayMap.get(a.value);

    if (!array) {
      throw new Error(`Invalid array identifier: ${a.value}`);
    }

    if (idx < 0 || idx >= array.elements.length) {
      throw new Error(`Index out of bounds: ${idx}`);
    }

    const value = array.elements[idx];

    if (!value) {
      throw new Error(`Missing element at index ${idx}`);
    }

    return Promise.resolve(value);
  }

  array_type<T extends DataType>(a: TypedValue<DataType.ARRAY, T>): Promise<NoInfer<T>> {
    const array = this.arrayMap.get(a.value);
    if (array === undefined) {
      throw new Error(`Invalid array identifier: ${a.value}`);
    }
    return Promise.resolve(array.type as NoInfer<T>);
  }
  array_set(
    a: TypedValue<DataType.ARRAY, DataType.VOID>,
    idx: number,
    tv: TypedValue<DataType>,
  ): Promise<void>;
  array_set<T extends DataType>(
    a: TypedValue<DataType.ARRAY, T>,
    idx: number,
    tv: TypedValue<NoInfer<T>>,
  ): Promise<void> {
    const array = this.arrayMap.get(a.value) as
      | { type: T; elements: TypedValue<NoInfer<T>>[] }
      | undefined;

    if (!array) {
      throw new Error(`Invalid array identifier: ${a.value}`);
    }

    if (idx < 0 || idx >= array.elements.length) {
      throw new Error(`Index out of bounds: ${idx}`);
    }

    array.elements[idx] = tv;

    return Promise.resolve();
  }
  array_assert<T extends DataType>(
    a: TypedValue<DataType.ARRAY>,
    type?: T,
    length?: number,
  ): Promise<void> {
    const array = this.arrayMap.get(a.value);
    if (!array) {
      throw new Error(`Invalid array identifier: ${a.value}`);
    }
    if (type !== undefined && array.type !== type) {
      throw new Error(`Expected array of type ${type}, got ${array.type}`);
    }
    if (length !== undefined && array.elements.length !== length) {
      throw new Error(`Expected array of length ${length}, got ${array.elements.length}`);
    }
    return Promise.resolve();
  }
  closure_make<const Arg extends readonly DataType[], const Ret extends DataType>(
    sig: IFunctionSignature<Arg, Ret>,
    func: ExternCallable<Arg, Ret>,
    dependsOn?: (TypedValue<DataType> | null)[],
  ): Promise<TypedValue<DataType.CLOSURE, Ret>> {
    const closureValue: TypedValue<DataType.CLOSURE, Ret> = {
      type: DataType.CLOSURE,
      value: this.uniqueId++ as ClosureIdentifier<Ret>,
    };
    this.closureMap.set(closureValue.value, { sig, func, dependsOn });
    return Promise.resolve(closureValue);
  }
  closure_is_vararg(c: TypedValue<DataType.CLOSURE>): Promise<boolean> {
    return Promise.resolve(this.closureMap.get(c.value)?.isVararg ?? false);
  }
  closure_arity(c: TypedValue<DataType.CLOSURE>): Promise<number> {
    return Promise.resolve(this.closureMap.get(c.value)?.sig.args.length ?? 0);
  }
  closure_call<T extends DataType>(
    c: TypedValue<DataType.CLOSURE, T>,
    args: TypedValue<DataType>[],
    returnType: T,
  ): AsyncGenerator<void, TypedValue<NoInfer<T>>, undefined> {
    const closure = this.closureMap.get(c.value);
    if (closure === undefined) {
      throw new Error(`Invalid closure identifier: ${c.value}`);
    }
    if (closure.sig.returnType !== returnType) {
      throw new Error(`Expected return type ${returnType}, got ${closure.sig.returnType}`);
    }
    return closure.func(...args) as AsyncGenerator<void, TypedValue<NoInfer<T>>, undefined>;
  }
  closure_call_unchecked<T extends DataType>(
    c: TypedValue<DataType.CLOSURE, T>,
    args: TypedValue<DataType>[],
  ): AsyncGenerator<void, TypedValue<NoInfer<T>>, undefined> {
    const closure = this.closureMap.get(c.value);
    if (closure === undefined) {
      throw new Error(`Invalid closure identifier: ${c.value}`);
    }
    return closure.func(...args) as AsyncGenerator<void, TypedValue<NoInfer<T>>, undefined>;
  }
  /**
   * Fast path for a closure that provably never needs to leave the current
   * synchronous call - e.g. a scalar-in/scalar-out wave function sampled
   * 44100x/sec by the sound module. `func` (an `ExternCallable`, normally
   * only callable as an AsyncGenerator per conductor's own contract) may
   * additionally carry a `.sync` escape hatch: a plain function computing
   * the exact same result with no Promise/generator indirection at all. An
   * engine's module-interop layer sets `.sync` only when it can prove the
   * closure never needs a real host round-trip (see py2js's moduleInterop.ts
   * pyClosureFunc); a closure with no such proof (every CSE-machine closure
   * today, or a py2js closure that touches something asyncOnly) simply never
   * gets one.
   *
   * Returns `undefined` when the closure has no sync form - the signal for
   * "fall back to closure_call_unchecked" - which is unambiguous because a
   * TypedValue always wraps a real `{ type, value }` pair, even for
   * DataType.VOID; the bare JS value `undefined` is never a legitimate
   * closure result.
   */
  closure_call_sync<T extends DataType>(
    c: TypedValue<DataType.CLOSURE, T>,
    args: TypedValue<DataType>[],
  ): TypedValue<NoInfer<T>> | undefined {
    const func = this.closureMap.get(c.value)?.func as
      | (ExternCallable<DataType[], T> & {
          sync?: (...a: TypedValue<DataType>[]) => TypedValue<DataType> | undefined;
        })
      | undefined;
    return func?.sync?.(...args) as TypedValue<NoInfer<T>> | undefined;
  }
  closure_arity_assert(c: TypedValue<DataType.CLOSURE>, arity: number): Promise<void> {
    const closure = this.closureMap.get(c.value);
    if (!closure) {
      throw new Error(`Invalid closure identifier: ${c.value}`);
    }
    if (closure.sig.args.length !== arity && !closure.isVararg) {
      throw new Error(`Expected closure of arity ${arity}, got ${closure.sig.args.length}`);
    }
    return Promise.resolve();
  }
  opaque_make(v: unknown, immutable?: boolean): Promise<TypedValue<DataType.OPAQUE>> {
    const opaqueValue: TypedValue<DataType.OPAQUE> = {
      type: DataType.OPAQUE,
      value: this.uniqueId++ as OpaqueIdentifier,
    };
    this.opaqueMap.set(opaqueValue.value, { value: v, immutable: immutable || false });
    return Promise.resolve(opaqueValue);
  }
  opaque_get(o: TypedValue<DataType.OPAQUE>): Promise<unknown> {
    const opaque = this.opaqueMap.get(o.value);
    if (!opaque) {
      throw new Error(`Invalid opaque identifier: ${o.value}`);
    }
    return Promise.resolve(opaque.value);
  }
  opaque_update(o: TypedValue<DataType.OPAQUE>, v: unknown): Promise<void> {
    const opaque = this.opaqueMap.get(o.value);
    if (!opaque) {
      throw new Error(`Invalid opaque identifier: ${o.value}`);
    }
    if (opaque.immutable) {
      throw new Error(`Cannot update immutable opaque value with identifier: ${o.value}`);
    }
    opaque.value = v;
    return Promise.resolve();
  }
  tie(_dependent: TypedValue<DataType>, _dependee: TypedValue<DataType> | null): Promise<void> {
    throw new Error("Method not implemented.");
  }
  untie(_dependent: TypedValue<DataType>, _dependee: TypedValue<DataType> | null): Promise<void> {
    throw new Error("Method not implemented.");
  }
  async list(...elements: TypedValue<DataType>[]): Promise<TypedValue<DataType.LIST>> {
    const list = await elements.reduceRight(
      async (acc, el) => {
        return this.pair_make(el, await acc);
      },
      Promise.resolve({ type: DataType.EMPTY_LIST, value: null }) as Promise<
        TypedValue<DataType.LIST>
      >,
    );
    return list;
  }
  /**
   * Reads every generic list helper's elements uniformly: an ARRAY is already flat (its elements
   * read straight off array_get, no walking needed), while a PAIR/EMPTY_LIST chain is walked node
   * by node the old way. Per Martin: a pair is just a 2-element array, not a distinct concept, so
   * these helpers treat both shapes as equally valid "list" inputs rather than only recognizing
   * the PAIR/EMPTY_LIST chain - this is what lets pythonToModule (CSE/PVML/py2js) freely encode a
   * Python list as DataType.ARRAY without breaking a module that calls list_to_vec/is_list/length/
   * accumulate on it (sound, midi, ...), with zero changes needed on the module's side. Throws the
   * same "Expected a list, got type X" a caller relying on that message already handles.
   */
  private readListElements(xs: TypedValue<DataType>): TypedValue<DataType>[] {
    if (xs.type === DataType.ARRAY) {
      const array = this.arrayMap.get(xs.value);
      if (!array) {
        throw new Error(`Invalid array identifier: ${xs.value}`);
      }
      return array.elements;
    }
    const result: TypedValue<DataType>[] = [];
    let current: TypedValue<DataType> = xs;
    while (current.type !== DataType.EMPTY_LIST) {
      if (current.type !== DataType.PAIR) {
        throw new Error(`Expected a list, got type ${current.type}`);
      }
      const pair = this.pairMap.get(current.value);
      if (!pair) {
        throw new Error(`Invalid pair identifier: ${current.value}`);
      }
      result.push(pair.head);
      current = pair.tail;
    }
    return result;
  }
  is_list(xs: TypedValue<DataType.LIST>): Promise<boolean> {
    try {
      this.readListElements(xs);
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  }
  list_to_vec(xs: TypedValue<DataType.LIST>): Promise<TypedValue<DataType>[]> {
    try {
      return Promise.resolve(this.readListElements(xs));
    } catch (e) {
      return Promise.reject(e);
    }
  }
  async *accumulate<T extends Exclude<DataType, DataType.VOID>>(
    op: TypedValue<DataType.CLOSURE, T>,
    initial: TypedValue<T>,
    sequence: TypedValue<DataType.LIST>,
    _resultType: T,
  ): AsyncGenerator<void, TypedValue<NoInfer<T>>, undefined> {
    let acc = initial;
    for (const element of this.readListElements(sequence)) {
      acc = yield* this.closure_call_unchecked(op, [acc, element]);
    }
    return acc;
  }
  length(xs: TypedValue<DataType.LIST>): Promise<number> {
    return Promise.resolve(this.readListElements(xs).length);
  }
}

/**
 * `ModuleLoaderRunnerPlugin`'s constructor requires a single object
 * satisfying `IInterfacableEvaluator` (`IEvaluator & IDataHandler`) — but an
 * evaluator built around `GenericDataHandler` has those two halves on two
 * different objects (the evaluator itself, extending `BasicEvaluator`, is
 * the `IEvaluator`; its `dataHandler` field is the `IDataHandler`). A Proxy
 * combines them into the one object the registration call needs, so
 * combining stays a one-line call at each registration site instead of ~20
 * lines of per-evaluator forwarding methods duplicated alongside the
 * bookkeeping this class already centralizes.
 */
export function asInterfacableEvaluator(
  evaluator: IEvaluator,
  dataHandler: GenericDataHandler,
): IInterfacableEvaluator {
  return new Proxy(evaluator, {
    get(target, prop, receiver) {
      if (prop in dataHandler) {
        // Bind so stateful methods (this.uniqueId++ in pair_make etc.) read
        // and write dataHandler, not the proxy — a plain Reflect.get returns
        // the method unbound, so calling it here would set `this` to the
        // proxy and (absent a `set` trap) silently write to `evaluator`.
        const value = Reflect.get(dataHandler, prop, dataHandler);
        return typeof value === "function" ? value.bind(dataHandler) : value;
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as unknown as IInterfacableEvaluator;
}
