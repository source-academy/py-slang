import { ErrorType } from "@sourceacademy/conductor/common";
import { BasicEvaluator, IRunnerPlugin } from "@sourceacademy/conductor/runner";
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
import { CseMachinePlugin } from "@sourceacademy/runner-cse-machine";
import { ModuleLoaderRunnerPlugin } from "@sourceacademy/runner-module-loader";
import { Context } from "../engines/cse/context";
import { Control } from "../engines/cse/control";
import { evaluate } from "../engines/cse/interpreter";
import { Stash } from "../engines/cse/stash";
import {
  createBufferedOutputStream,
  createErrorStream,
  createInputStream,
  destroyStreams,
  displayError,
} from "../engines/cse/streams";
import { parse } from "../parser/parser-adapter";
import { analyze } from "../resolver/analysis";
import linkedList from "../stdlib/linked-list";
import list from "../stdlib/list";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import pairmutator from "../stdlib/pairmutator";
import parser from "../stdlib/parser";
import stream from "../stdlib/stream";
import { Group } from "../stdlib/utils";
import { collectSnapshots } from "./plugins/PyCseMachinePlugin";

function once<T>(fn: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | undefined;
  return () => (promise ??= fn());
}

/**
 * The abstract class PyCseEvaluatorBase implements the common logic for all variants of
 * the CSE evaluator, which includes setting up the context, loading preludes, and evaluating chunks of code.
 */
abstract class PyCseEvaluatorBase extends BasicEvaluator implements IDataHandler {
  private context = new Context();
  private readonly variant: number;
  private readonly groups: Group[];
  private readonly preludeText: string;
  private readonly ensurePreludesLoaded: () => Promise<void>;
  private readonly csePlugin: CseMachinePlugin;

  protected constructor(conductor: IRunnerPlugin, variant: number, groups: Group[]) {
    super(conductor);
    this.variant = variant;
    this.groups = groups;
    this.preludeText = groups.map(g => g.prelude ?? "").join("\n");

    // Cast bridges the IPlugin type difference between this repo's (local/portal)
    // conductor and the one @sourceacademy/runner-cse-machine builds against. Once both
    // use the same published conductor, the cast can be removed.
    this.csePlugin = conductor.registerPlugin(
      CseMachinePlugin as never,
    ) as unknown as CseMachinePlugin;

    for (const group of this.groups) {
      for (const [name, value] of group.builtins) {
        this.context.nativeStorage.builtins.set(name, value);
      }
    }
    this.conductor.registerPlugin(ModuleLoaderRunnerPlugin, this.conductor, this);

    this.ensurePreludesLoaded = once(async () => {
      if (this.preludeText.trim()) {
        const ast = parse(this.preludeText + "\n");
        await evaluate(this.preludeText + "\n", ast, this.context, {
          isPrelude: true,
          variant: this.variant,
          groups: [],
        });
      }
      if (this.context.errors.length > 0) {
        throw this.context.errors;
      }
    });
  }

  async evaluateChunk(chunk: string): Promise<void> {
    const { context: stdout, flush: flushOutput } = createBufferedOutputStream();
    try {
      this.context.streams = {
        initialised: true,
        stdout,
        stderr: createErrorStream(this.conductor),
        stdin: createInputStream(this.conductor),
      };
      this.context.conductor = this.conductor;
      this.context.evaluator = this;
      await this.ensurePreludesLoaded();

      const script = chunk + "\n";
      const ast = parse(script);
      const errors = analyze(
        ast,
        script,
        this.variant,
        this.groups,
        Object.keys(this.context.runtime.environments[0].head),
      );

      if (errors.length > 0) {
        throw errors;
      }

      const control = new Control(ast);
      const stash = new Stash();
      this.context.control = control;
      this.context.stash = stash;

      // CSE chapters (3+): collect snapshots up to the step cap, then stop.
      // Output produced after the step cap is not emitted — that's intentional.
      // Chapters 1-2: run to completion via the generator (maxSnapshots=0 → no
      // snapshots collected, CSE tab never appears) so stdout/errors are emitted.
      if (this.variant >= 3) {
        const configRaw = await this.conductor.requestFile("/__cse_config__");
        let maxSnapshots = 1000;
        if (configRaw) {
          try {
            maxSnapshots = (JSON.parse(configRaw) as { stepLimit?: number }).stepLimit ?? 1000;
          } catch {
            // malformed config — fall back to default step limit
          }
        }

        const snapshots = await collectSnapshots(
          this.context,
          control,
          stash,
          100000,
          -1,
          this.variant,
          script,
          maxSnapshots,
        );
        flushOutput(this.conductor);
        this.csePlugin.sendSnapshots(snapshots);
      } else {
        await collectSnapshots(this.context, control, stash, 100000, -1, this.variant, script, 0);
        flushOutput(this.conductor);
      }
    } catch (e) {
      flushOutput(this.conductor);
      const errors = Array.isArray(e) ? e : [e];
      await Promise.all(
        errors.map(e => {
          if (e instanceof SyntaxError) {
            return displayError(this.context, e, ErrorType.EVALUATOR_SYNTAX);
          }
          return displayError(this.context, e, ErrorType.INTERNAL);
        }),
      );
    } finally {
      await destroyStreams(this.context);
    }
  }
  hasDataInterface = true as const;
  private pairMap = new Map<
    PairIdentifier,
    { head: TypedValue<DataType>; tail: TypedValue<DataType> }
  >();
  private arrayMap = new Map<
    TypedValue<DataType.ARRAY>,
    { type: DataType; elements: TypedValue<DataType>[] }
  >();
  private closureMap = new Map<
    TypedValue<DataType.CLOSURE>,
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sig: IFunctionSignature<any, any>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      func: ExternCallable<any, any>;
      dependsOn?: (TypedValue<DataType> | null)[];
      isVararg?: boolean;
    }
  >();
  private opaqueMap = new Map<
    TypedValue<DataType.OPAQUE>,
    { value: unknown; immutable: boolean }
  >();
  private uniqueId = 0;
  pair_make(
    head: TypedValue<DataType>,
    tail: TypedValue<DataType>,
  ): Promise<TypedValue<DataType.PAIR>> {
    this.pairMap.set(this.uniqueId++ as PairIdentifier, { head, tail });
    return Promise.resolve({ type: DataType.PAIR, value: (this.uniqueId - 1) as PairIdentifier });
  }
  pair_head(p: TypedValue<DataType.PAIR>): Promise<TypedValue<DataType>> {
    const pair = this.pairMap.get(p.value);
    if (!pair) {
      throw new Error(`Invalid pair identifier: ${p.value}`);
    }
    return Promise.resolve(pair.head);
  }
  pair_sethead(p: TypedValue<DataType.PAIR>, tv: TypedValue<DataType>): Promise<void> {
    const pair = this.pairMap.get(p.value);
    if (!pair) {
      throw new Error(`Invalid pair identifier: ${p.value}`);
    }
    pair.head = tv;
    return Promise.resolve();
  }
  pair_tail(p: TypedValue<DataType.PAIR>): Promise<TypedValue<DataType>> {
    const pair = this.pairMap.get(p.value);
    if (!pair) {
      throw new Error(`Invalid pair identifier: ${p.value}`);
    }
    return Promise.resolve(pair.tail);
  }
  pair_settail(p: TypedValue<DataType.PAIR>, tv: TypedValue<DataType>): Promise<void> {
    const pair = this.pairMap.get(p.value);
    if (!pair) {
      throw new Error(`Invalid pair identifier: ${p.value}`);
    }
    pair.tail = tv;
    return Promise.resolve();
  }
  pair_assert(
    p: TypedValue<DataType.PAIR>,
    headType?: DataType,
    tailType?: DataType,
  ): Promise<void> {
    const pair = this.pairMap.get(p.value);
    if (!pair) {
      throw new Error(`Invalid pair identifier: ${p.value}`);
    }
    if (headType && pair.head.type !== headType) {
      throw new Error(`Expected head of type ${headType}, got ${pair.head.type}`);
    }
    if (tailType && pair.tail.type !== tailType) {
      throw new Error(`Expected tail of type ${tailType}, got ${pair.tail.type}`);
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
    this.arrayMap.set(arrayValue, { type: t, elements });
    return Promise.resolve(arrayValue);
  }
  array_length(a: TypedValue<DataType.ARRAY>): Promise<number> {
    const array = this.arrayMap.get(a);
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
    const array = this.arrayMap.get(a);

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
    return Promise.resolve(a.value.__type);
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
    const array = this.arrayMap.get(a) as
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
    const array = this.arrayMap.get(a);
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
    this.closureMap.set(closureValue, { sig, func, dependsOn });
    return Promise.resolve(closureValue);
  }
  closure_is_vararg(c: TypedValue<DataType.CLOSURE>): Promise<boolean> {
    return Promise.resolve(this.closureMap.get(c)?.isVararg ?? false);
  }
  closure_arity(c: TypedValue<DataType.CLOSURE>): Promise<number> {
    return Promise.resolve(this.closureMap.get(c)?.sig.args.length ?? 0);
  }
  closure_call<T extends DataType>(
    c: TypedValue<DataType.CLOSURE, T>,
    args: TypedValue<DataType>[],
    returnType: T,
  ): AsyncGenerator<void, TypedValue<NoInfer<T>>, undefined> {
    const value = this.closureMap.get(c)?.func(...args);
    if (value === undefined) {
      throw new Error(`Invalid closure identifier: ${c.value}`);
    }
    if (c.value.__ret !== returnType) {
      const expectedReturnType = this.closureMap.get(c)?.sig.returnType;
      if (expectedReturnType !== returnType) {
        throw new Error(`Expected return type ${returnType}, got ${expectedReturnType}`);
      }
    }
    return value as AsyncGenerator<void, TypedValue<NoInfer<T>>, undefined>;
  }
  closure_call_unchecked<T extends DataType>(
    c: TypedValue<DataType.CLOSURE, T>,
    args: TypedValue<DataType>[],
  ): AsyncGenerator<void, TypedValue<NoInfer<T>>, undefined> {
    return this.closureMap.get(c)?.func(...args) as AsyncGenerator<
      void,
      TypedValue<NoInfer<T>>,
      undefined
    >;
  }
  closure_arity_assert(c: TypedValue<DataType.CLOSURE>, arity: number): Promise<void> {
    const closure = this.closureMap.get(c);
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
    this.opaqueMap.set(opaqueValue, { value: v, immutable: immutable || false });
    return Promise.resolve(opaqueValue);
  }
  opaque_get(o: TypedValue<DataType.OPAQUE>): Promise<unknown> {
    const opaque = this.opaqueMap.get(o);
    if (!opaque) {
      throw new Error(`Invalid opaque identifier: ${o.value}`);
    }
    return Promise.resolve(opaque.value);
  }
  opaque_update(o: TypedValue<DataType.OPAQUE>, v: unknown): Promise<void> {
    const opaque = this.opaqueMap.get(o);
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
  is_list(xs: TypedValue<DataType.LIST>): Promise<boolean> {
    return Promise.resolve(
      xs.type === DataType.EMPTY_LIST ||
        (xs.type === DataType.PAIR &&
          this.pairMap.has(xs.value) &&
          this.is_list(this.pairMap.get(xs.value)!.tail as TypedValue<DataType.LIST>)),
    );
  }
  list_to_vec(xs: TypedValue<DataType.LIST>): Promise<TypedValue<DataType>[]> {
    return new Promise((resolve, reject) => {
      const result: TypedValue<DataType>[] = [];
      let current: TypedValue<DataType> = xs;
      while (current.type !== DataType.EMPTY_LIST) {
        if (current.type !== DataType.PAIR) {
          reject(new Error(`Expected a list, got type ${current.type}`));
          return;
        }
        const pair = this.pairMap.get(current.value);
        if (!pair) {
          reject(new Error(`Invalid pair identifier: ${current.value}`));
          return;
        }
        result.push(pair.head);
        current = pair.tail;
      }
      resolve(result);
    });
  }
  async *accumulate<T extends Exclude<DataType, DataType.VOID>>(
    op: TypedValue<DataType.CLOSURE, T>,
    initial: TypedValue<T>,
    sequence: TypedValue<DataType.LIST>,
    _resultType: T,
  ): AsyncGenerator<void, TypedValue<NoInfer<T>>, undefined> {
    let acc = initial;
    let current: TypedValue<DataType> = sequence;
    while (current.type !== DataType.EMPTY_LIST) {
      if (current.type !== DataType.PAIR) {
        throw new Error(`Expected a list, got type ${current.type}`);
      }
      const pair = this.pairMap.get(current.value);
      if (!pair) {
        throw new Error(`Invalid pair identifier: ${current.value}`);
      }
      acc = yield* this.closure_call_unchecked(op, [acc, pair.head]);
      current = pair.tail;
    }
    return acc;
  }
  length(xs: TypedValue<DataType.LIST>): Promise<number> {
    let length = 0;
    let current: TypedValue<DataType> = xs;
    while (current.type !== DataType.EMPTY_LIST) {
      if (current.type !== DataType.PAIR) {
        throw new Error(`Expected a list, got type ${current.type}`);
      }
      const pair = this.pairMap.get(current.value);
      if (!pair) {
        throw new Error(`Invalid pair identifier: ${current.value}`);
      }
      length++;
      current = pair.tail;
    }
    return Promise.resolve(length);
  }
}

export class PyCseEvaluator1 extends PyCseEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 1, [misc, math]);
  }
}

export class PyCseEvaluator2 extends PyCseEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 2, [misc, math, linkedList]);
  }
}

export class PyCseEvaluator3 extends PyCseEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 3, [misc, math, linkedList, list, pairmutator, stream]);
  }
}

export class PyCseEvaluator4 extends PyCseEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 4, [misc, math, linkedList, list, pairmutator, stream, parser]);
  }
}
