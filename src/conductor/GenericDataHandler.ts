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
import { isSameType } from "@sourceacademy/conductor/util";
import { ExprNS } from "../ast-types";
import {
  InvalidArityError,
  InvalidArrayCreationError,
  InvalidIdentifierError,
  InvalidIndexError,
  InvalidLengthError,
  InvalidOpaqueUpdateError,
  InvalidTypeError,
} from "./errors";
const DEFAULT_VALUES = {
  [DataType.NUMBER]: { type: DataType.NUMBER, value: 0 },
  [DataType.CONST_STRING]: { type: DataType.CONST_STRING, value: "" },
  [DataType.BOOLEAN]: { type: DataType.BOOLEAN, value: false },
  [DataType.VOID]: { type: DataType.VOID, value: undefined },
  [DataType.EMPTY_LIST]: { type: DataType.EMPTY_LIST, value: null },
  [DataType.INTEGER]: { type: DataType.INTEGER, value: 0n },
};

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
 * holds one instance (`private dataHandler = new GenericDataHandler(variant)`) and
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
    ArrayIdentifier<DataType>,
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

  private currentCall: ExprNS.Call | undefined = undefined;
  private currentSource: string | undefined = undefined;

  private getTypeName<T extends DataType>(type: T, value?: TypedValue<T>): string {
    switch (type) {
      case DataType.NUMBER:
        return "'int' or 'float'";
      case DataType.CONST_STRING:
        return "'str'";
      case DataType.BOOLEAN:
        return "'bool'";
      case DataType.VOID:
      case DataType.EMPTY_LIST:
        return "'NoneType'";
      case DataType.INTEGER:
        return "'int'";
      case DataType.ARRAY:
        return this.variant >= 3 ? "'list'" : "'pair'";
      case DataType.LIST:
        return "'llist'";
      case DataType.PAIR:
        return "'pair'";
      case DataType.CLOSURE:
        return "'function'";
      case DataType.ANY:
        return "'any'";
      case DataType.OPAQUE: {
        if (value === undefined) {
          return "'opaque'";
        }
        const opaque = this.opaqueMap.get(value.value as OpaqueIdentifier);
        if (!opaque) {
          return "'opaque'";
        }
        const name = opaque.value;
        if (typeof name === "object" && name !== null && name.constructor.name !== "Object") {
          return name.constructor.name;
        }
        return "'opaque'";
      }
    }
  }

  constructor(public readonly variant: number) {}

  getCurrentModuleName(): string | undefined {
    return undefined;
  }

  setCurrentCall(call: ExprNS.Call | undefined): void {
    this.currentCall = call;
  }

  /**
   * Records a generated evaluator's call site.  Unlike the CSE evaluator,
   * compiled evaluators cannot retain the AST object at runtime, but the
   * diagnostic code only needs its source span.
   */
  setCurrentCallLocation(start: number, end: number): void {
    const source = this.currentSource;
    if (!source || start < 0 || end < start || end > source.length) {
      this.currentCall = undefined;
      return;
    }
    const lineStart = source.lastIndexOf("\n", start - 1) + 1;
    const line = source.slice(0, lineStart).split("\n").length;
    this.currentCall = {
      startToken: { indexInSource: start, line, column: start - lineStart, lexeme: source[start] },
      endToken: {
        indexInSource: Math.max(start, end - 1),
        line,
        column: Math.max(0, end - 1 - lineStart),
        lexeme: source.slice(Math.max(start, end - 1), end),
      },
    } as unknown as ExprNS.Call;
  }

  setCurrentSource(source: string | undefined): void {
    this.currentSource = source;
    // A call node is meaningful only within the source it came from.  In
    // persistent evaluators, retaining it across chunks/files would point a
    // later module-loading error at an unrelated earlier program.
    this.currentCall = undefined;
  }

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
        throw new InvalidIdentifierError(
          this.currentCall,
          this.currentSource,

          p.value,
          "pair",
        );
      }
      return { kind: "array", array, head: array.elements[0], tail: array.elements[1] };
    }
    const pair = this.pairMap.get(p.value);
    if (!pair) {
      throw new InvalidIdentifierError(this.currentCall, this.currentSource, p.value, "pair");
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
      throw new InvalidTypeError(
        this.currentCall,
        this.currentSource,
        "head of",
        this.getTypeName(headType),
        this.getTypeName(head.type, head),
      );
    }
    if (tailType && tail.type !== tailType) {
      throw new InvalidTypeError(
        this.currentCall,
        this.currentSource,
        "tail of",
        this.getTypeName(tailType),
        this.getTypeName(tail.type, tail),
      );
    }
    return Promise.resolve();
  }
  array_make<T extends DataType>(
    t: T,
    len: number,
    init?: TypedValue<NoInfer<T>>,
  ): Promise<TypedValue<DataType.ARRAY, NoInfer<T>>> {
    if (init === undefined && !(t in DEFAULT_VALUES)) {
      throw new InvalidArrayCreationError(
        this.currentCall,
        this.currentSource,
        this.getTypeName(t),
      );
    }
    const elements = new Array(len).fill(init ?? DEFAULT_VALUES[t as keyof typeof DEFAULT_VALUES]);
    const arrayValue: TypedValue<DataType.ARRAY, NoInfer<T>> = {
      type: DataType.ARRAY,
      value: this.uniqueId++ as ArrayIdentifier<T>,
    };
    this.arrayMap.set(arrayValue.value, { type: t, elements });
    return Promise.resolve(arrayValue);
  }
  array_length(a: TypedValue<DataType.ARRAY>): Promise<number> {
    const array = this.arrayMap.get(a.value);
    if (!array) {
      throw new InvalidIdentifierError(this.currentCall, this.currentSource, a.value, "array");
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
      throw new InvalidIdentifierError(this.currentCall, this.currentSource, a.value, "array");
    }

    if (idx < 0 || idx >= array.elements.length) {
      throw new InvalidIndexError(this.currentCall, this.currentSource, idx, array.elements.length);
    }

    const value = array.elements[idx];

    return Promise.resolve(value);
  }

  array_type<T extends DataType>(a: TypedValue<DataType.ARRAY, T>): Promise<NoInfer<T>> {
    const array = this.arrayMap.get(a.value);
    if (array === undefined) {
      throw new InvalidIdentifierError(this.currentCall, this.currentSource, a.value, "array");
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
    const array = this.arrayMap.get(a.value);

    if (!array) {
      throw new InvalidIdentifierError(this.currentCall, this.currentSource, a.value, "array");
    }

    if (idx < 0 || idx >= array.elements.length) {
      throw new InvalidIndexError(
        this.currentCall,
        this.currentSource,
        idx,
        array.elements.length,
        true,
      );
    }

    if (tv.type !== array.type && array.type !== DataType.ANY) {
      throw new InvalidTypeError(
        this.currentCall,
        this.currentSource,
        `element at index ${idx}'s`,
        this.getTypeName(array.type),
        this.getTypeName(tv.type, tv),
      );
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
      throw new InvalidIdentifierError(this.currentCall, this.currentSource, a.value, "array");
    }
    if (type !== undefined && array.type !== type) {
      throw new InvalidTypeError(
        this.currentCall,
        this.currentSource,
        `array`,
        this.getTypeName(type),
        this.getTypeName(array.type),
      );
    }
    if (length !== undefined && array.elements.length !== length) {
      throw new InvalidLengthError(
        this.currentCall,
        this.currentSource,
        "array",
        length,
        array.elements.length,
      );
    }
    return Promise.resolve();
  }
  closure_make<const Arg extends readonly DataType[], const Ret extends DataType>(
    sig: IFunctionSignature<Arg, Ret>,
    func: ExternCallable<Arg, Ret>,
    dependsOn?: (TypedValue<DataType> | null)[],
    isVararg?: boolean,
  ): Promise<TypedValue<DataType.CLOSURE, Ret>> {
    const closureValue: TypedValue<DataType.CLOSURE, Ret> = {
      type: DataType.CLOSURE,
      value: this.uniqueId++ as ClosureIdentifier<Ret>,
    };
    this.closureMap.set(closureValue.value, { sig, func, dependsOn, isVararg });
    return Promise.resolve(closureValue);
  }
  closure_is_vararg(c: TypedValue<DataType.CLOSURE>): Promise<boolean> {
    return Promise.resolve(this.closureMap.get(c.value)?.isVararg ?? false);
  }
  closure_arity(c: TypedValue<DataType.CLOSURE>): Promise<number> {
    return Promise.resolve(this.closureMap.get(c.value)?.sig.args.length ?? 0);
  }
  async *closure_call<T extends DataType>(
    c: TypedValue<DataType.CLOSURE, T>,
    args: TypedValue<DataType>[],
    returnType: T,
  ): AsyncGenerator<void, TypedValue<NoInfer<T>>, undefined> {
    const closure = this.closureMap.get(c.value);
    if (closure === undefined) {
      throw new InvalidIdentifierError(this.currentCall, this.currentSource, c.value, "closure");
    }
    if (
      args.length < closure.sig.args.length ||
      (!closure.isVararg && args.length > closure.sig.args.length)
    ) {
      throw new InvalidArityError(
        this.currentCall,
        this.currentSource,
        closure.sig.args.length,
        args.length,
      );
    }
    for (const [i, arg] of args.entries()) {
      if (i >= closure.sig.args.length) {
        break;
      }
      if (closure.sig.args[i] === DataType.ANY) {
        continue;
      }
      // If the argument is a pair or list type and the return type is an array (or vice-versa), skip for now till we remove the pair type.
      if (
        (closure.sig.args[i] === DataType.PAIR || closure.sig.args[i] === DataType.LIST) &&
        arg.type === DataType.ARRAY
      ) {
        continue;
      }
      if (closure.sig.args[i] === DataType.ARRAY && arg.type == DataType.PAIR) {
        continue;
      }
      if (!isSameType(arg.type, closure.sig.args[i])) {
        throw new InvalidTypeError(
          this.currentCall,
          this.currentSource,
          `argument ${i}`,
          this.getTypeName(closure.sig.args[i]),
          this.getTypeName(arg.type, arg),
        );
      }
    }
    const result = yield* closure.func(...args);
    if (
      result.type !== returnType &&
      returnType !== DataType.ANY &&
      !(
        (returnType === DataType.PAIR || returnType === DataType.LIST) &&
        result.type === DataType.ARRAY
      ) &&
      !(returnType === DataType.ARRAY && result.type === DataType.PAIR)
    ) {
      throw new InvalidTypeError(
        this.currentCall,
        this.currentSource,
        "return",
        this.getTypeName(returnType),
        this.getTypeName(result.type, result),
      );
    }
    return result as TypedValue<NoInfer<T>>;
  }
  async *closure_call_unchecked<T extends DataType>(
    c: TypedValue<DataType.CLOSURE, T>,
    args: TypedValue<DataType>[],
  ): AsyncGenerator<void, TypedValue<NoInfer<T>>, undefined> {
    const closure = this.closureMap.get(c.value);
    if (closure === undefined) {
      throw new InvalidIdentifierError(this.currentCall, this.currentSource, c.value, "closure");
    }
    return (yield* closure.func(...args)) as TypedValue<NoInfer<T>>;
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
      throw new InvalidIdentifierError(this.currentCall, this.currentSource, c.value, "closure");
    }
    if (closure.sig.args.length !== arity && !closure.isVararg) {
      throw new InvalidArityError(
        this.currentCall,
        this.currentSource,
        arity,
        closure.sig.args.length,
      );
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
      throw new InvalidIdentifierError(this.currentCall, this.currentSource, o.value, "opaque");
    }
    return Promise.resolve(opaque.value);
  }
  opaque_update(o: TypedValue<DataType.OPAQUE>, v: unknown): Promise<void> {
    const opaque = this.opaqueMap.get(o.value);
    if (!opaque) {
      throw new InvalidIdentifierError(this.currentCall, this.currentSource, o.value, "opaque");
    }
    if (opaque.immutable) {
      throw new InvalidOpaqueUpdateError(this.currentCall, this.currentSource, o.value);
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
        throw new InvalidIdentifierError(
          this.currentCall,
          this.currentSource,

          xs.value,
          "array",
        );
      }
      return array.elements;
    }
    const result: TypedValue<DataType>[] = [];
    let current: TypedValue<DataType> = xs;
    while (current.type !== DataType.EMPTY_LIST) {
      if (current.type !== DataType.PAIR) {
        throw new InvalidTypeError(
          this.currentCall,
          this.currentSource,

          "a list",
          this.getTypeName(DataType.LIST),
          this.getTypeName(current.type, current),
        );
      }
      const pair = this.pairMap.get(current.value);
      if (!pair) {
        throw new InvalidIdentifierError(
          this.currentCall,
          this.currentSource,

          current.value,
          "pair",
        );
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
  async *accumulate<T extends DataType>(
    op: TypedValue<DataType.CLOSURE, T>,
    initial: TypedValue<T>,
    sequence: TypedValue<DataType.LIST>,
    resultType: T,
  ): AsyncGenerator<void, TypedValue<NoInfer<T>>, undefined> {
    let acc = initial;
    for (const element of this.readListElements(sequence)) {
      acc = yield* this.closure_call(op, [acc, element], resultType);
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
