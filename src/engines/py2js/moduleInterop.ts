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
 * Chapter 1 has no list/pair type (NoListsValidator) and no way to construct
 * or consume one, so DataType.PAIR/ARRAY module values are rejected with a
 * clear error rather than represented — there is nothing chapter-1 code
 * could do with one anyway. Complex numbers are likewise not supported
 * crossing the boundary (matching the CSE converter's identical restriction).
 */
import { DataType, IDataHandler, TypedValue } from "@sourceacademy/conductor/types";
import { ModuleLoaderRunnerPlugin } from "@sourceacademy/runner-module-loader";
import { StmtNS } from "../../ast-types";
import { Py2JsRuntime, Py2JsRuntimeError, PyOpaque, PyValue } from "./runtime";

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
      // Module signatures only know NUMBER; crosses as a float, same as
      // every other engine's converter (CSE's modules.ts, WASM's
      // moduleInterop.ts).
      return { type: DataType.NUMBER, value: Number(value) };
    case "number":
      return { type: DataType.NUMBER, value };
    case "boolean":
      return { type: DataType.BOOLEAN, value };
    case "string":
      return { type: DataType.CONST_STRING, value };
    case "function": {
      const fn = value;
      async function* pyClosureFunc(
        ...args: TypedValue<DataType>[]
      ): AsyncGenerator<void, TypedValue<DataType>, undefined> {
        const nativeArgs = await Promise.all(args.map(a => moduleToPython(rt, dh, a)));
        const result = rt.callSync(fn, nativeArgs);
        return pythonToModule(rt, dh, result);
      }
      const arity = Math.max(0, fn.pyArity);
      return dh.closure_make(
        { returnType: DataType.VOID, args: Array(arity).fill(DataType.VOID) },
        pyClosureFunc,
      );
    }
    case "object":
      if (value === null) return { type: DataType.EMPTY_LIST, value: null };
      if (value instanceof PyOpaque) return value.typed;
      throw new Py2JsRuntimeError(
        "TypeError",
        "complex values are not supported in module interop",
      );
    default:
      throw new Py2JsRuntimeError("TypeError", "unsupported value in module interop");
  }
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
      return f;
    }
    case DataType.PAIR:
    case DataType.ARRAY:
      // See file header: chapter 1 has no list/pair type to represent this
      // as, and no way to consume one anyway. Extend when py2js grows list
      // support (chapter 3+), mirroring the CSE/WASM converters. (DataType
      // also has a LIST member, but it's a type-level PAIR-or-EMPTY_LIST
      // marker, not a tag any concrete TypedValue ever actually carries —
      // TypeScript's own TypedValue<DataType> union excludes it, so there
      // is no runtime case for it here.)
      throw new Py2JsRuntimeError(
        "TypeError",
        `module values of type "${DataType[value.type]}" are not supported by py2js at chapter 1`,
      );
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
