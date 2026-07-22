/**
 * py2js engine — module interop.
 *
 * Conversion layer between py2js's native (unboxed) values and conductor's
 * module protocol (`TypedValue<DataType>`/`IDataHandler`) — the py2js
 * analogue of src/engines/cse/modules.ts, mirroring the same value mapping
 * (NUMBER<->float, none<->EMPTY_LIST, OPAQUE<->PyOpaque, CLOSURE<->function)
 * so a module behaves identically whichever engine the student runs on.
 * `IDataHandler` itself (the pair/array/closure/opaque bookkeeping) is
 * `GenericDataHandler` — engine-agnostic, shared with the CSE evaluator; see
 * conductor/GenericDataHandler.ts.
 *
 * Closures crossing the module boundary, in EITHER direction, are
 * async-generator calls by conductor's own contract (`ExternCallable` is
 * `(...args) => AsyncGenerator<...>`) — not an implementation choice of any
 * particular engine. Concretely:
 *
 *  - Python calling an imported module function (`from math import sqrt`):
 *    wrapped as a `PyFunction` whose body runs `dh.closure_call_unchecked`
 *    and iterates the generator. `.next()` on an async generator always
 *    resolves via microtask, so this is unavoidably async — the function is
 *    `asyncOnly` (see runtime.ts), callable only through `acall`/dual mode,
 *    never through a sync module callback.
 *  - A module calling a Python-defined function (the sound-module scenario:
 *    `play(wave, duration)` samples `wave` many times): the Python closure is
 *    wrapped via `dh.closure_make(sig, func, ...)`, where conductor requires
 *    `func` itself to be an async generator. Its *body*, though, is authored
 *    here, and does a single direct, synchronous `rt.callSync` — no
 *    interpreter re-entry (unlike the CSE machine's `modules.ts`, whose
 *    equivalent closure wrapper pushes onto `control`/`stash` and resumes the
 *    whole step loop per call). One microtask per call is unavoidable
 *    (conductor's contract, not py2js's), but the work inside it is a plain
 *    JS function call — see the engine README's module-interop notes for the
 *    measured cost.
 *
 * Chapter 1 has no list type (NoListsValidator) and no way to construct or
 * consume one, so DataType.PAIR round-trips through PyList — a pair and a
 * 2-element list are the same runtime value here (see runtime.ts's PyList
 * doc comment), so pythonToModule's array check below handles a chapter-2
 * pair() and a chapter-3+ literal list identically, mirroring the CSE
 * converter's "list" case, which makes exactly the same non-distinction.
 * DataType.ARRAY (an untyped, recursively-converted module array — e.g.
 * scrabble's word lists) round-trips as a genuine PyValue[] on the way out,
 * mirroring CSE's/PVML's identical DataType.ARRAY handling; there's no
 * ARRAY-consuming direction yet (pythonToModule never constructs one - no
 * module currently takes a Python list as an ARRAY-typed argument). Complex
 * numbers are likewise not supported crossing the boundary (matching the CSE
 * converter's identical restriction).
 */
import { DataType, IDataHandler, TypedValue } from "@sourceacademy/conductor/types";
import { ModuleLoaderRunnerPlugin } from "@sourceacademy/runner-module-loader";
import { StmtNS } from "../../ast-types";
import { Py2JsRuntime, Py2JsRuntimeError, PyOpaque, PyValue } from "./runtime";

/**
 * Synchronous, scalar-only counterparts to moduleToPython/pythonToModule -
 * used only by the `.sync` fast path a Python closure crossing into a module
 * gets below (see GenericDataHandler.closure_call_sync's doc for the overall
 * design). Cover exactly the value shapes a scalar-in/scalar-out closure (a
 * wave function, sampled 44100x/sec by the sound module) needs: numbers,
 * booleans, strings, None. Return `undefined` for anything else (pairs,
 * closures, opaques, complex) - the "no sync path" signal, safe to use for
 * *arguments* (nothing has run yet) but not for the *result* once the real
 * call has already happened - see pyClosureFunc.sync below.
 */
function moduleToPythonSync(value: TypedValue<DataType>): PyValue | undefined {
  switch (value.type) {
    case DataType.NUMBER:
      return value.value;
    case DataType.BOOLEAN:
      return value.value;
    case DataType.CONST_STRING:
      return value.value;
    case DataType.VOID:
    case DataType.EMPTY_LIST:
      return null;
    default:
      return undefined;
  }
}

function pythonToModuleSync(value: PyValue): TypedValue<DataType> | undefined {
  switch (typeof value) {
    case "bigint":
      return { type: DataType.NUMBER, value: Number(value) };
    case "number":
      return { type: DataType.NUMBER, value };
    case "boolean":
      return { type: DataType.BOOLEAN, value };
    case "string":
      return { type: DataType.CONST_STRING, value };
    case "object":
      return value === null ? { type: DataType.EMPTY_LIST, value: null } : undefined;
    default:
      return undefined;
  }
}

/** Converts a py2js native value into a conductor TypedValue, for passing
 * INTO a module — as a call argument, or the value a module holds after
 * receiving it. Mirrors pythonToModule in src/engines/cse/modules.ts. */
export async function pythonToModule(
  rt: Py2JsRuntime,
  dh: IDataHandler,
  value: PyValue,
): Promise<TypedValue<DataType>> {
  switch (typeof value) {
    case "bigint":
      return { type: DataType.NUMBER, value: Number(value) };
    case "number":
      return { type: DataType.NUMBER, value };
    case "boolean":
      return { type: DataType.BOOLEAN, value };
    case "string":
      return { type: DataType.CONST_STRING, value };
    case "function": {
      const fn = value;
      // A pass-through of a module closure moduleToPython previously handed
      // into Python (e.g. a Sound's wave function created by sine_sound,
      // now being passed to play): return the original identifier unchanged
      // rather than wrapping a *new* closure whose body assumes fn is a
      // genuine Python function it can rt.callSync. fn isn't callable that
      // way — it's still ultimately the module's own closure — and the
      // module receiving it back can now sample it directly, no different
      // from CSE's identical `.id` pass-through in modules.ts.
      if (fn.moduleClosure) return fn.moduleClosure;
      async function* pyClosureFunc(
        ...args: TypedValue<DataType>[]
      ): AsyncGenerator<void, TypedValue<DataType>, undefined> {
        const nativeArgs = await Promise.all(args.map(a => moduleToPython(rt, dh, a)));
        const result = rt.callSync(fn, nativeArgs);
        return pythonToModule(rt, dh, result);
      }
      // The fast path: rt.callSync(fn, ...) is already synchronous (py2js's
      // whole point) - the only async part of the body above is argument/
      // result conversion, and that's only async because moduleToPython/
      // pythonToModule are written uniformly with the closure case (which
      // genuinely needs `await dh.closure_make(...)`). For a scalar-in/
      // scalar-out closure (the wave-sampling shape), conversion never
      // actually needs to await anything, so this restricted synchronous
      // twin removes the last microtask too. Bailing to `undefined` for an
      // unsupported *argument* is safe (fn hasn't run yet); once fn has
      // actually run, a result that doesn't fit is a hard error, not a
      // fallback signal - falling back to the async path at that point would
      // call fn a second time, double-running any side effects (print(),
      // mutation) it has.
      (
        pyClosureFunc as typeof pyClosureFunc & {
          sync?: (...a: TypedValue<DataType>[]) => TypedValue<DataType> | undefined;
        }
      ).sync = (...args: TypedValue<DataType>[]): TypedValue<DataType> | undefined => {
        const nativeArgs: PyValue[] = [];
        for (const a of args) {
          const converted = moduleToPythonSync(a);
          if (converted === undefined) return undefined;
          nativeArgs.push(converted);
        }
        const result = rt.callSync(fn, nativeArgs);
        const converted = pythonToModuleSync(result);
        if (converted === undefined) {
          throw new Py2JsRuntimeError(
            "TypeError",
            `${fn.pyName}() returned a value that cannot be produced by a synchronous module callback`,
          );
        }
        return converted;
      };
      const arity = Math.max(0, fn.pyArity);
      return dh.closure_make(
        { returnType: DataType.VOID, args: Array(arity).fill(DataType.VOID) },
        pyClosureFunc,
      );
    }
    case "object":
      if (value === null) return { type: DataType.EMPTY_LIST, value: null };
      if (value instanceof PyOpaque) return value.typed;
      if (Array.isArray(value)) {
        // Untyped and recursive: per Martin, a pair is just an array of length 2, not a distinct
        // concept - build every PyList (of any length, 2 included, whether it's a fresh literal, a
        // pair()/llist() result, or a module PAIR round-tripped back through Python) the same way,
        // as a flat DataType.ARRAY, recursively converting each element. No more length-based
        // rejection needed - list_to_vec/pair_head/pair_tail (see GenericDataHandler) already read
        // an ARRAY the same as a PAIR/EMPTY_LIST chain, so a module declaring LIST or PAIR still
        // works unchanged.
        //
        // No empty-list special case: EMPTY_LIST is also what Python's None maps to (see
        // moduleToPython's own EMPTY_LIST case), so returning it here for [] would make [] and
        // None collide on the way back out - exactly the kind of ambiguity this whole redesign
        // exists to remove. A genuine 0-length ARRAY round-trips back through moduleToPython's
        // ARRAY case as a real [], not None.
        const elements = await Promise.all(value.map(el => pythonToModule(rt, dh, el)));
        const array = await dh.array_make(DataType.ANY, elements.length, {
          type: DataType.VOID,
          value: undefined,
        });
        for (let i = 0; i < elements.length; i++) {
          await dh.array_set(
            array as unknown as TypedValue<DataType.ARRAY, DataType.VOID>,
            i,
            elements[i],
          );
        }
        return array;
      }
      throw new Py2JsRuntimeError(
        "TypeError",
        "complex values are not supported in module interop",
      );
    default:
      throw new Py2JsRuntimeError("TypeError", "unsupported value in module interop");
  }
}

/**
 * Reads a PAIR or ARRAY's elements uniformly: a PAIR is always exactly 2 (head, tail - whatever
 * they are, not necessarily a proper list continuation - e.g. sound's Sound is (wave, duration),
 * a dotted pair whose second element is a plain NUMBER), an ARRAY is however many array_length
 * reports. Deliberately NOT list_to_vec: that walks a chain expecting it to terminate in
 * EMPTY_LIST (a *proper list* invariant), which a raw dotted pair doesn't satisfy - this is a
 * flat "give me this compound value's N elements" read, nothing more.
 */
async function readCompoundElements(
  dh: IDataHandler,
  value: TypedValue<DataType.ARRAY> | TypedValue<DataType.PAIR>,
): Promise<TypedValue<DataType>[]> {
  if (value.type === DataType.PAIR) {
    return [await dh.pair_head(value), await dh.pair_tail(value)];
  }
  const length = await dh.array_length(value);
  return Promise.all(Array.from({ length }, (_, i) => dh.array_get(value, i)));
}

/**
 * Converts a conductor TypedValue into a py2js native value, for a module
 * export flowing into Python (FromImport bindings) or an argument a module
 * passes to a Python closure it calls back. `name` is used to render an
 * imported function nicely (`<built-in function sqrt>`); defaults to a
 * generic label for values reached indirectly (e.g. one module function
 * returning another as its result). Mirrors moduleToPython in
 * src/engines/cse/modules.ts.
 */
export async function moduleToPython(
  rt: Py2JsRuntime,
  dh: IDataHandler,
  value: TypedValue<DataType>,
  name = "<module function>",
): Promise<PyValue> {
  switch (value.type) {
    case DataType.NUMBER:
      return value.value;
    case DataType.INTEGER:
      // py-slang never produces DataType.INTEGER itself (see pythonToModule's "bigint" case
      // above) - per Martin, integers stay out of the module interface entirely, numbers crossing
      // a module boundary are always floats. Only here for switch exhaustiveness over conductor's
      // DataType enum.
      return Number(value.value);
    case DataType.BOOLEAN:
      return value.value;
    case DataType.CONST_STRING:
      return value.value;
    case DataType.VOID:
    case DataType.EMPTY_LIST:
      return null;
    case DataType.OPAQUE:
      return new PyOpaque(value);
    case DataType.CLOSURE: {
      const arity = await dh.closure_arity(value);
      const f = rt.def(name, arity, () => {
        // Defensive backstop: the asyncOnly guard in call()/checkCallable
        // already rejects this before the body would run through the
        // normal call path; this only fires on a direct raw invocation that
        // bypasses the runtime (e.g. module code calling the JS function
        // value itself instead of going through rt.call/rt.acall).
        throw new Py2JsRuntimeError(
          "TypeError",
          `${name}() needs a frontend round-trip and cannot be called from a synchronous module callback`,
        );
      });
      // Renders as a built-in function (matching the spirit of the CSE
      // machine's own convention for module closures — see the file header
      // comment on threading the real symbol name through, an improvement
      // over CSE's literal "closure" placeholder name there).
      f.pyBuiltin = true;
      f.asyncOnly = true;
      f.asyncBody = async (...args: PyValue[]) => {
        const typedArgs = await Promise.all(args.map(a => pythonToModule(rt, dh, a)));
        const gen = dh.closure_call_unchecked(value, typedArgs);
        let step = await gen.next();
        while (!step.done) step = await gen.next();
        return moduleToPython(rt, dh, step.value);
      };
      // Pass-through identifier: see PyFunction.moduleClosure's doc comment
      // in runtime.ts. Lets pythonToModule hand this straight back to a
      // module unchanged instead of wrapping a new (incorrectly assumed
      // synchronous) closure around it.
      f.moduleClosure = value;
      return f;
    }
    case DataType.PAIR:
    case DataType.ARRAY: {
      // Untyped and recursive, uniformly for both: per Martin, a PAIR is just a 2-element array,
      // not a distinct concept - one shared conversion, not a separate case per DataType. A
      // Python list here is just a plain PyValue[] (see runtime.ts's PyList doc comment).
      // Deliberately NOT list_to_vec: that expects a chain terminating in EMPTY_LIST (a *proper
      // list*), which a raw dotted pair (e.g. sound's Sound, a (wave, duration) pair) doesn't
      // satisfy - this reads exactly the compound value's own elements, nothing more.
      const elements = await readCompoundElements(dh, value);
      const result: PyValue[] = [];
      for (const el of elements) {
        result.push(await moduleToPython(rt, dh, el, name));
      }
      return result;
    }
  }
}

/** True iff a chunk's top-level statements include at least one FromImport —
 * the signal Py2JsSession uses to pick dual (async) compile mode; a chunk
 * with none stays on the fast sync path (see index.ts, compiler.ts's mode
 * doc). */
export function hasImports(statements: StmtNS.Stmt[]): boolean {
  return statements.some(s => s.kind === "FromImport");
}

/**
 * Loads and converts every module this chunk imports, before compilation —
 * mirroring src/engines/cse/modules.ts's loadModules/evaluateImports (module
 * *loading* happens once per chunk, ahead of running the chunk's own code,
 * matching every other py-slang evaluator's two-phase model). Returns the
 * resolved bindings keyed by bound (aliased) name, ready for
 * `rt.setPendingImports` — the compiled FromImport statement just reads them
 * back via `__py.importedValue(name)`.
 */
export async function loadChunkImports(
  rt: Py2JsRuntime,
  dh: IDataHandler,
  statements: StmtNS.Stmt[],
): Promise<Record<string, PyValue>> {
  const imports = statements.filter((s): s is StmtNS.FromImport => s.kind === "FromImport");
  if (imports.length === 0) return {};

  if (!ModuleLoaderRunnerPlugin.instance) {
    throw new Py2JsRuntimeError(
      "SystemError",
      "py2js: ModuleLoaderRunnerPlugin is not initialized (no module loader registered)",
    );
  }
  const loader = ModuleLoaderRunnerPlugin.instance;

  const moduleNames = [...new Set(imports.map(node => node.module.lexeme))];
  const plugins = new Map(
    await Promise.all(
      moduleNames.map(async moduleName => {
        try {
          return [moduleName, await loader.requestModule(moduleName)] as const;
        } catch {
          throw new Py2JsRuntimeError("ModuleNotFoundError", `Module "${moduleName}" not found.`);
        }
      }),
    ),
  );

  // Modules are already pre-loaded above concurrently; binding itself runs
  // sequentially in source order so that two imports binding the same name
  // (e.g. `from a import x` then `from b import x`) resolve deterministically
  // — last one in source order wins, matching plain reassignment — rather
  // than racing on whichever moduleToPython() conversion happens to finish
  // last under concurrent Promise.all.
  const bindings: Record<string, PyValue> = Object.create(null) as Record<string, PyValue>;
  for (const node of imports) {
    const moduleName = node.module.lexeme;
    const exports = new Map(plugins.get(moduleName)!.exports.map(e => [e.symbol, e.value]));
    for (const spec of node.names) {
      const exportValue = exports.get(spec.name.lexeme);
      if (exportValue === undefined) {
        throw new Py2JsRuntimeError(
          "ImportError",
          `cannot import name '${spec.name.lexeme}' from '${moduleName}'`,
        );
      }
      const bound = (spec.alias ?? spec.name).lexeme;
      bindings[bound] = await moduleToPython(rt, dh, exportValue, spec.name.lexeme);
    }
  }
  return bindings;
}
