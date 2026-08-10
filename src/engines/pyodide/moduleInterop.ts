/**
 * Pyodide engine — conductor module interop.
 *
 * Conversion layer between real CPython objects (running inside pyodide) and
 * conductor's module protocol (`TypedValue<DataType>`/`IDataHandler`) — the
 * pyodide analogue of src/engines/{cse,py2js,pvml,wasm}/moduleInterop.ts (or
 * modules.ts), letting Source Academy's own JS-backed modules (Rune, Curve,
 * ...) be `from`-imported on "Python Full" the same way they already work on
 * every other engine.
 *
 * Unlike the other four engines, this one doesn't need an invented pair/
 * opaque/closure object model: pyodide already runs a real, independently
 * tested implementation of Source's data types via the bridged
 * `sourceacademy-sicp` package (python/sicp/linked_list.py) — a pair is a
 * genuine 2-element Python `list`, the empty list is `None`. So PAIR/
 * EMPTY_LIST conversion leans on that package's own `pair`/`is_pair`/`head`/
 * `tail` (imported directly here as `sicp.linked_list`, independent of
 * whichever submodules a chapter bridges into the *student's* global
 * namespace — see PyodideEvaluator.ts's SICP_MODULE_BY_GROUP) rather than
 * a hand-rolled representation.
 *
 * Empirically verified (not assumed) against this repo's pinned pyodide
 * (0.29.4), since pyodide's exact FFI marshaling rules are load-bearing here:
 *  - A Python value passed as an argument to a plain JS function is left as a
 *    PyProxy for anything beyond int/float/str/bool/None (including a plain
 *    `list`) — pyodide does NOT auto-convert a Python list into a JS Array at
 *    the call boundary. That only means a single conversion step can recurse
 *    into a pair's real structure instead of an eagerly-flattened copy; it is
 *    NOT a claim that round-tripping a value through a module call returns
 *    the same object. PAIR (and every other structural DataType) crosses via
 *    `{type, value}`, reconstructed fresh on each conversion — same as every
 *    other engine, `r(x) is r(x)` is `False` here too for a module closure
 *    that hands a pair/list back out, exactly as it is on py2js. Only
 *    OPAQUE/CLOSURE preserve identity across a round trip, and only because
 *    they carry GenericDataHandler's own identifier through unchanged (see
 *    pythonToModule's `_SaOpaque`/`_SaClosure` pass-through below) rather
 *    than being rebuilt from structural data.
 *  - `pyodide.ffi.run_sync` (used below to let non-`async` Python call an
 *    async JS module function) only works inside a Python coroutine invoked
 *    via `PyCallable.callPromising()`, and needs actual WASM JS-Promise-
 *    Integration support in the host JS engine (Chrome/V8 today; Node needs
 *    `--experimental-wasm-jspi`). `callPromising()` itself fails atomically,
 *    before any Python code runs, when JSPI is unavailable — so a whole chunk
 *    routed through it would break even for a `from mod import CONST`-only
 *    import that never calls anything. `isJspiAvailable` below probes this
 *    once per evaluator instance so PyodideEvaluatorBase can choose, per
 *    chunk, between the (`callPromising`-wrapped) path that supports calling
 *    into a module function, and the plain `runPythonAsync` path that still
 *    supports everything else when JSPI isn't available.
 *
 * The one asymmetry worth calling out: only Python-calls-INTO-a-module-
 * function needs any of the run_sync/JSPI machinery. A module calling back
 * into a Python-authored closure (e.g. sampling a student's wave function) is
 * plain PyProxy-calls-a-Python-callable, which is already synchronous from
 * JS — no bridge needed, exactly like every other engine's own "module calls
 * back into student code" direction.
 */
import type { PyodideInterface } from "pyodide";
import type { PyProxy } from "pyodide/ffi";
import { DataType, IDataHandler, TypedValue } from "@sourceacademy/conductor/types";

/**
 * Defines `_sa_jspi_probe`, a no-op coroutine, in its own tiny script with NO
 * `sourceacademy-sicp` dependency — isJspiAvailable's whole point is to
 * answer a general JS-engine-capability question ("does callPromising work
 * at all here?"), unrelated to Source's pair library, and deliberately
 * usable before/without that package ever being installed (a pyodide
 * instance PyodideEvaluatorBase constructs always installs it before running
 * any chunk, but isJspiAvailable itself makes no such assumption about its
 * caller). Caught the hard way: this used to be folded into the same script
 * as MODULE_INTEROP_HELPER_PY below (which genuinely does need sicp for
 * PAIR conversion), which meant isJspiAvailable transitively broke with a
 * `ModuleNotFoundError: No module named 'sicp'` on any pyodide instance
 * that hadn't happened to install it yet.
 */
const JSPI_PROBE_PY = `
async def _sa_jspi_probe():
    pass
`;

/**
 * Defines, once per pyodide instance, the small set of Python-side helpers
 * this converter needs: wrapper classes for OPAQUE/CLOSURE values crossing
 * from a module into Python (so they can be recognised and unwrapped again
 * if passed back into another module call), and pair helpers bound directly
 * to `sicp.linked_list` rather than whatever a chapter bridges into student
 * globals (see class doc). Mirrors importAnalyzer.ts's ANALYZE_IMPORTS_PY /
 * ensureHelper pattern: runs in a private namespace, never `pyodide.globals`,
 * so none of these names can collide with (or be shadowed by) student code.
 *
 * `_SaOpaque`/`_SaClosure` instances carry their original TypedValue's `type`
 * and `value` (a plain number identifier — see conductor's Identifier.d.ts)
 * as plain attributes, not a live JS reference: a TypedValue for a reference
 * type is just `{type, value}` where `value` is an opaque integer key into
 * GenericDataHandler's own Maps, so it survives an ordinary attribute
 * get/set (pyodide's default JS<->Python conversion) with no special
 * handling needed to preserve identity — the *identifier* is the identity.
 *
 * Requires `sourceacademy-sicp` to already be installed (for `_sa_ll`) —
 * true of any PyodideEvaluatorBase instance by the time a chunk runs, since
 * that install happens in the constructor. See JSPI_PROBE_PY above for why
 * that dependency is NOT shared with the JSPI-availability check.
 */
const MODULE_INTEROP_HELPER_PY = `
import sicp.linked_list as _sa_ll
from pyodide.ffi import run_sync as _sa_run_sync

_SA_NO_SYNC = object()

class _SaOpaque:
    __slots__ = ("sa_type", "sa_value")
    def __init__(self, sa_type, sa_value):
        self.sa_type = sa_type
        self.sa_value = sa_value

class _SaClosure:
    """A module-exported function, callable directly from Python. __call__
    first tries the module's own synchronous fast path (dh.closure_call_sync
    - set only when the module proves a particular call never needs a real
    host round-trip); only a closure with no such proof needs run_sync, which
    requires this whole chunk to have been invoked via callPromising (see
    isJspiAvailable/PyodideEvaluatorBase)."""
    __slots__ = ("sa_type", "sa_value", "_call_sync", "_call_async")
    def __init__(self, sa_type, sa_value, call_sync, call_async):
        self.sa_type = sa_type
        self.sa_value = sa_value
        self._call_sync = call_sync
        self._call_async = call_async
    def __call__(self, *args):
        result = self._call_sync(*args)
        if result is _SA_NO_SYNC:
            return _sa_run_sync(self._call_async(*args))
        return result

import inspect as _sa_inspect

def _sa_callable_arity(fn):
    """Number of fixed positional parameters fn accepts - needed because a
    module calling a Python callback through the CHECKED dh.closure_call (not
    closure_call_unchecked) validates the caller's argument count against the
    signature closure_make was given; an under-declared arity throws
    InvalidArityError there (confirmed empirically - a placeholder 0-arg
    signature broke a real two-argument callback call). Falls back to 0 on
    any signature that can't be inspected (e.g. a pyodide-wrapped builtin) -
    paired with treating the same case as vararg below, so an uninspectable
    callable never trips the checked arity path at all."""
    try:
        return sum(
            1
            for p in _sa_inspect.signature(fn).parameters.values()
            if p.kind in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD)
        )
    except (TypeError, ValueError):
        return 0

def _sa_callable_is_vararg(fn):
    try:
        return any(
            p.kind == p.VAR_POSITIONAL
            for p in _sa_inspect.signature(fn).parameters.values()
        )
    except (TypeError, ValueError):
        return True

def _sa_is_pair(x):
    return _sa_ll.is_pair(x)

def _sa_is_opaque(x):
    return isinstance(x, _SaOpaque)

def _sa_is_closure(x):
    return isinstance(x, _SaClosure)

def _sa_make_pair(head, tail):
    return _sa_ll.pair(head, tail)

def _sa_pair_head(x):
    return _sa_ll.head(x)

def _sa_pair_tail(x):
    return _sa_ll.tail(x)

def _sa_set_attr(obj, name, value):
    setattr(obj, name, value)
`;

/** One namespace per pyodide instance, shared by both scripts below (each
 * runs into it independently — see ensureJspiProbe/ensureHelper) — not
 * `pyodide.globals`, so neither script's names can collide with student
 * code either. */
let namespaces = new WeakMap<PyodideInterface, PyProxy>();
let jspiProbeReady = new WeakSet<PyodideInterface>();
let moduleHelperReady = new WeakSet<PyodideInterface>();
let jspiAvailable = new WeakMap<PyodideInterface, boolean>();

interface PairHelpers {
  makePair: PyProxy & ((head: unknown, tail: unknown) => unknown);
  isPair: PyProxy & ((x: unknown) => boolean);
  pairHead: PyProxy & ((x: unknown) => unknown);
  pairTail: PyProxy & ((x: unknown) => unknown);
}

/** `_sa_make_pair`/`_sa_is_pair`/`_sa_pair_head`/`_sa_pair_tail`, fetched via
 * `ns.get` once per pyodide instance rather than on every PAIR conversion -
 * `moduleToPython`'s PAIR case recurses per pair node, so a long list was
 * re-fetching (and implicitly re-creating) all four PyProxy wrappers once
 * per element. */
let pairHelpers = new WeakMap<PyodideInterface, PairHelpers>();

/** Test-only: forget every namespace/JSPI-probe result this module has
 * cached, mirroring importAnalyzer.ts's identical resetHelperState. */
export function resetModuleInteropState(): void {
  namespaces = new WeakMap();
  jspiProbeReady = new WeakSet();
  moduleHelperReady = new WeakSet();
  jspiAvailable = new WeakMap();
  pairHelpers = new WeakMap();
}

function getNamespace(pyodide: PyodideInterface): PyProxy {
  let ns = namespaces.get(pyodide);
  if (!ns) {
    ns = pyodide.toPy({}) as PyProxy;
    namespaces.set(pyodide, ns);
  }
  return ns;
}

/** Defines just `_sa_jspi_probe` — deliberately independent of
 * MODULE_INTEROP_HELPER_PY below (see JSPI_PROBE_PY's doc comment). */
async function ensureJspiProbe(pyodide: PyodideInterface): Promise<PyProxy> {
  const ns = getNamespace(pyodide);
  if (!jspiProbeReady.has(pyodide)) {
    await pyodide.runPythonAsync(JSPI_PROBE_PY, { globals: ns });
    jspiProbeReady.add(pyodide);
  }
  return ns;
}

async function ensureHelper(pyodide: PyodideInterface): Promise<PyProxy> {
  const ns = getNamespace(pyodide);
  if (!moduleHelperReady.has(pyodide)) {
    await pyodide.runPythonAsync(MODULE_INTEROP_HELPER_PY, { globals: ns });
    moduleHelperReady.add(pyodide);
  }
  return ns;
}

async function getPairHelpers(pyodide: PyodideInterface): Promise<PairHelpers> {
  let helpers = pairHelpers.get(pyodide);
  if (!helpers) {
    const ns = await ensureHelper(pyodide);
    helpers = {
      makePair: ns.get("_sa_make_pair") as PyProxy & ((h: unknown, t: unknown) => unknown),
      isPair: ns.get("_sa_is_pair") as PyProxy & ((x: unknown) => boolean),
      pairHead: ns.get("_sa_pair_head") as PyProxy & ((x: unknown) => unknown),
      pairTail: ns.get("_sa_pair_tail") as PyProxy & ((x: unknown) => unknown),
    };
    pairHelpers.set(pyodide, helpers);
  }
  return helpers;
}

/** Probes, once per pyodide instance, whether this JS engine can actually
 * run a `callPromising()`-invoked coroutine at all (independent of whether
 * that coroutine ever calls run_sync — see the class doc: callPromising
 * fails atomically before any Python code runs when JSPI is unavailable).
 * Cached: repeating the probe per chunk would cost a real (if small) round
 * trip for no reason, since JSPI support cannot change mid-session. */
export async function isJspiAvailable(pyodide: PyodideInterface): Promise<boolean> {
  const cached = jspiAvailable.get(pyodide);
  if (cached !== undefined) return cached;
  const ns = await ensureJspiProbe(pyodide);
  const probe = ns.get("_sa_jspi_probe") as PyProxy & { callPromising(): Promise<unknown> };
  let available: boolean;
  try {
    await probe.callPromising();
    available = true;
  } catch {
    available = false;
  }
  jspiAvailable.set(pyodide, available);
  return available;
}

/** Sentinel distinguishing "converted to undefined/None" from "cannot be
 * converted synchronously" — plain `undefined` is ambiguous between the two
 * (None legitimately converts to it), so a dedicated marker is needed here
 * (Python's own `_SA_NO_SYNC` sentinel plays the identical role on the other
 * side of the boundary). */
const NO_SYNC_MARKER = Symbol("no-sync");

/** pyodide converts a Python `int` outside JS's safe integer range to a JS
 * `BigInt` rather than `Number` (see type-conversions.html) - `typeof` on
 * that value is `"bigint"`, a third numeric primitive `pythonToModule`'s
 * number/boolean/string switch doesn't cover, which used to fall through
 * to the PyProxy checks below and end up misreported as "complex values
 * are not supported". */
const MIN_SAFE_BIGINT = BigInt(Number.MIN_SAFE_INTEGER);
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

/** Restricted, scalar-only synchronous counterpart to moduleToPython, used
 * only by pythonToModule's CLOSURE `.sync` fast path below — mirrors
 * py2js/moduleInterop.ts's moduleToPythonSync exactly (same restriction, same
 * reasoning: this only needs to cover what a provably-synchronous module
 * closure's *arguments*, or a result already known to have been produced by
 * one, can be — not the general case). Returns NO_SYNC_MARKER, never plain
 * `undefined`, when a value can't be represented this way. */
function typedToPySync(value: TypedValue<DataType>): unknown {
  switch (value.type) {
    case DataType.NUMBER:
      return value.value;
    case DataType.BOOLEAN:
      return value.value;
    case DataType.CONST_STRING:
      return value.value;
    case DataType.VOID:
    case DataType.EMPTY_LIST:
      return undefined; // pyodide's own None <-> undefined convention
    default:
      return NO_SYNC_MARKER;
  }
}

function pyToTypedSync(value: unknown): TypedValue<DataType> | undefined {
  if (value === undefined) return { type: DataType.EMPTY_LIST, value: null };
  switch (typeof value) {
    case "number":
      return { type: DataType.NUMBER, value };
    case "boolean":
      return { type: DataType.BOOLEAN, value };
    case "string":
      return { type: DataType.CONST_STRING, value };
    default:
      return undefined;
  }
}

/** `dh`, widened with two GenericDataHandler extras beyond conductor's own
 * IDataHandler contract — accessed via a local cast, exactly like
 * py2js/moduleInterop.ts's identical `syncCall` cast:
 *  - `closure_call_sync`, the synchronous fast-path escape hatch.
 *  - `closure_make`'s 4th `isVararg` parameter, needed so a Python callback
 *    with a real `*args` parameter doesn't get an under/over-counted fixed
 *    arity that a checked `dh.closure_call` would then reject. */
type DataHandlerWithSync = IDataHandler & {
  closure_call_sync?<T extends DataType>(
    c: TypedValue<DataType.CLOSURE, T>,
    args: TypedValue<DataType>[],
  ): TypedValue<T> | undefined;
  closure_make<const Arg extends readonly DataType[], const Ret extends DataType>(
    sig: { args: Arg; returnType: Ret },
    func: (...args: TypedValue<DataType>[]) => AsyncGenerator<void, TypedValue<Ret>, undefined>,
    dependsOn: undefined,
    isVararg: boolean,
  ): Promise<TypedValue<DataType.CLOSURE, Ret>>;
};

/**
 * Converts a conductor TypedValue into a real Python object (a PyProxy for
 * anything but a scalar), for a module export flowing into Python
 * (FromImport bindings) or an argument a module passes to a Python closure
 * it calls back. Mirrors moduleToPython in the other engines' moduleInterop
 * files. `name` labels a CLOSURE for error messages only.
 */
export async function moduleToPython(
  pyodide: PyodideInterface,
  dh: IDataHandler,
  value: TypedValue<DataType>,
  name = "<module function>",
): Promise<unknown> {
  const ns = await ensureHelper(pyodide);
  switch (value.type) {
    case DataType.NUMBER:
      return value.value;
    case DataType.INTEGER:
      // Module signatures only traffic in NUMBER for every other engine too
      // (see wasm/moduleInterop.ts's identical TODO) - kept lossy, just for
      // switch exhaustiveness over DataType.
      return Number(value.value);
    case DataType.BOOLEAN:
      return value.value;
    case DataType.CONST_STRING:
      return value.value;
    case DataType.VOID:
    case DataType.EMPTY_LIST:
      return undefined;
    case DataType.OPAQUE: {
      // PyProxy classes are called directly to construct an instance (not
      // `new`'d) - same calling convention as any other PyProxy callable.
      const makeOpaque = ns.get("_SaOpaque") as PyProxy & ((t: number, v: number) => unknown);
      return makeOpaque(value.type, value.value as unknown as number);
    }
    case DataType.PAIR: {
      const { makePair } = await getPairHelpers(pyodide);
      const head = await moduleToPython(pyodide, dh, await dh.pair_head(value), name);
      const tail = await moduleToPython(pyodide, dh, await dh.pair_tail(value), name);
      return makePair(head, tail);
    }
    case DataType.CLOSURE: {
      const makeClosure = ns.get("_SaClosure") as PyProxy &
        ((
          t: number,
          v: number,
          callSync: (...args: unknown[]) => unknown,
          callAsync: (...args: unknown[]) => Promise<unknown>,
        ) => unknown);
      const dhSync = dh as DataHandlerWithSync;
      // The value callSync must actually RETURN to signal "no sync path" -
      // NOT the internal NO_SYNC_MARKER symbol. A JS Symbol returned to
      // Python crosses as a foreign JsProxy wrapper, which is never `is`
      // Python's own `_SA_NO_SYNC = object()` sentinel, so `_SaClosure`'s
      // `result is _SA_NO_SYNC` check would silently never match and this
      // would always look "synchronous", returning the marker itself as if
      // it were a real value (caught empirically: every call came back as
      // literally `Symbol(no-sync)` before this fix). Fetching the real
      // Python object once and handing it straight back out keeps identity
      // intact across the round trip.
      const pyNoSync = ns.get("_SA_NO_SYNC") as unknown;

      const callSync = (...pyArgs: unknown[]): unknown => {
        const typedArgs: TypedValue<DataType>[] = [];
        for (const a of pyArgs) {
          // Bailing to pyNoSync here is safe - nothing has run yet, so
          // falling back to callAsync (the Python wrapper's job, not this
          // function's) simply means the call hasn't been attempted at all.
          const converted = pyToTypedSync(a);
          if (converted === undefined) return pyNoSync;
          typedArgs.push(converted);
        }
        const result = dhSync.closure_call_sync?.(value, typedArgs);
        // No `.sync` twin exists for this closure at all - safe fallback,
        // same reasoning as above (the call never actually ran).
        if (result === undefined) return pyNoSync;
        // The sync twin DID run - real module-side effects may already have
        // happened. There is no safe fallback left if the result doesn't fit
        // typedToPySync's restricted scalar set; falling back to callAsync
        // now would invoke the closure a second time, double-running any
        // side effects. Matches py2js/moduleInterop.ts's identical stance.
        const pyResult = typedToPySync(result);
        if (pyResult === NO_SYNC_MARKER) {
          throw new Error(
            "a module function's synchronous result cannot be produced for a synchronous caller",
          );
        }
        return pyResult;
      };

      const callAsync = async (...pyArgs: unknown[]): Promise<unknown> => {
        const typedArgs = await Promise.all(pyArgs.map(a => pythonToModule(pyodide, dh, a)));
        const gen = dh.closure_call_unchecked(value, typedArgs);
        let step = await gen.next();
        while (!step.done) step = await gen.next();
        return moduleToPython(pyodide, dh, step.value, name);
      };

      return makeClosure(value.type, value.value as unknown as number, callSync, callAsync);
    }
    case DataType.ARRAY:
      // No SICPy module traffics in ARRAY today - same scope cut the WASM
      // converter currently makes (src/engines/wasm/moduleInterop.ts).
      throw new Error(`Module value "${name}": ARRAY module values are not supported yet`);
  }
}

/**
 * Converts a real Python object into a conductor TypedValue, for a value
 * flowing INTO a module - a call argument, or a value a module holds after
 * receiving it. Mirrors pythonToModule in the other engines' moduleInterop
 * files.
 */
export async function pythonToModule(
  pyodide: PyodideInterface,
  dh: IDataHandler,
  value: unknown,
): Promise<TypedValue<DataType>> {
  if (value === undefined) return { type: DataType.EMPTY_LIST, value: null };
  switch (typeof value) {
    case "number":
      return { type: DataType.NUMBER, value };
    case "boolean":
      return { type: DataType.BOOLEAN, value };
    case "string":
      return { type: DataType.CONST_STRING, value };
    case "bigint":
      if (value >= MIN_SAFE_BIGINT && value <= MAX_SAFE_BIGINT) {
        return { type: DataType.NUMBER, value: Number(value) };
      }
      throw new Error(
        `integer ${value} is outside the range module interop can represent (must fit within Number.MAX_SAFE_INTEGER)`,
      );
  }
  const proxy = value as PyProxy & Record<string, unknown>;
  const ns = await ensureHelper(pyodide);

  // A value this converter itself produced earlier (moduleToPython's
  // _SaOpaque/_SaClosure) round-trips by its original identifier, unchanged
  // - not re-wrapped - exactly like every other engine's identical
  // pass-through for a module value handed back to a module (e.g. py2js's
  // `fn.moduleClosure` check in moduleInterop.ts). Checked via an isinstance
  // predicate, not by probing `.sa_type` directly: attribute access on a
  // PyProxy for a name the underlying Python object doesn't have raises
  // (mirrors Python's own AttributeError for getattr), it doesn't return
  // undefined the way a missing JS property would.
  const isOpaque = ns.get("_sa_is_opaque") as PyProxy & ((x: unknown) => boolean);
  const isClosure = ns.get("_sa_is_closure") as PyProxy & ((x: unknown) => boolean);
  if (isOpaque(proxy) || isClosure(proxy)) {
    return { type: proxy.sa_type as DataType, value: proxy.sa_value } as TypedValue<DataType>;
  }

  if (typeof proxy === "function") {
    // `proxy` is borrowed: pyodide auto-destroys it once the JS call it was
    // passed into (this whole pythonToModule call, invoked from an async
    // Python->JS boundary - e.g. inside run_sync) resolves. pyCallbackFunc
    // below is stashed in dh via closure_make and may be invoked much later
    // (e.g. by a closure this module function returns, called from a
    // separate top-level statement) - by then the borrowed proxy is already
    // dead, surfacing as pyodide's own "This borrowed proxy was
    // automatically destroyed..." JsException. `.copy()` makes an
    // independent proxy to the same Python callable, unaffected by the
    // original being destroyed - confirmed empirically against the "repeat"
    // pattern (a function returning a new closure over a captured callback).
    const fn = (proxy as unknown as PyProxy).copy() as unknown as (...args: unknown[]) => unknown;
    async function* pyCallbackFunc(
      ...args: TypedValue<DataType>[]
    ): AsyncGenerator<void, TypedValue<DataType>, undefined> {
      const nativeArgs = await Promise.all(args.map(a => moduleToPython(pyodide, dh, a)));
      const result = fn(...nativeArgs);
      return pythonToModule(pyodide, dh, result);
    }
    // A real arity is required here, NOT a placeholder: confirmed empirically
    // that a module calling this callback through the CHECKED dh.closure_call
    // (as real module code does - see wasm-modules.test.ts's own applyTwice
    // fixture) validates the caller's argument count against exactly what
    // closure_make was told here, and an under-declared arity throws
    // InvalidArityError (which, thrown from inside a run_sync-driven call,
    // surfaced as an opaque pyodide-internal "invalid exception object"
    // failure rather than a catchable error - the WASM engine's identical
    // placeholder-signature choice only gets away with this because it always
    // calls such a callback through closure_call_unchecked instead, which
    // skips this validation entirely).
    const arityFn = ns.get("_sa_callable_arity") as PyProxy & ((f: unknown) => number);
    const isVarargFn = ns.get("_sa_callable_is_vararg") as PyProxy & ((f: unknown) => boolean);
    const arity = arityFn(proxy);
    const isVararg = isVarargFn(proxy);
    return (dh as DataHandlerWithSync).closure_make(
      { returnType: DataType.ANY, args: Array(arity).fill(DataType.ANY) },
      pyCallbackFunc,
      undefined,
      isVararg,
    );
  }

  const { isPair, pairHead, pairTail } = await getPairHelpers(pyodide);
  if (isPair(proxy)) {
    return dh.pair_make(
      await pythonToModule(pyodide, dh, pairHead(proxy)),
      await pythonToModule(pyodide, dh, pairTail(proxy)),
    );
  }

  throw new Error("complex values are not supported in module interop");
}

/**
 * Builds a real Python module object exposing `exports` and registers it
 * into `sys.modules[moduleName]`, so a chunk's own `from <moduleName> import
 * x` executes as completely ordinary CPython import machinery - no source
 * rewriting needed. Called once per module name per evaluator instance (see
 * PyodideEvaluatorBase's REPL-persistence note): once registered, later
 * chunks re-importing the same module resolve for free, the same way a
 * repeated `import` of any already-loaded module does in real Python.
 */
export async function registerModule(
  pyodide: PyodideInterface,
  dh: IDataHandler,
  moduleName: string,
  exportsList: { symbol: string; value: TypedValue<DataType> }[],
): Promise<void> {
  // moduleToPython below calls ensureHelper itself (cached, so this doesn't
  // duplicate the work) - the helper classes/functions must exist before any
  // export can be converted, which is what makes this await meaningful here.
  const ns = await ensureHelper(pyodide);
  const moduleObj = pyodide.pyimport("types").ModuleType(moduleName) as PyProxy &
    Record<string, unknown>;
  // Assigned through _sa_set_attr's real Python `setattr`, NOT a plain JS
  // property set on the PyProxy: pyodide's PyProxy gives its own built-in
  // methods (copy/destroy/toJs/type/...) priority over same-named Python
  // attributes, so a module exporting e.g. a function called `copy` would
  // otherwise silently overwrite the proxy's own method instead of landing
  // in the module's actual namespace.
  const setAttr = ns.get("_sa_set_attr") as PyProxy &
    ((obj: unknown, name: string, value: unknown) => void);
  for (const { symbol, value } of exportsList) {
    setAttr(moduleObj, symbol, await moduleToPython(pyodide, dh, value, symbol));
  }
  const sys = pyodide.pyimport("sys") as PyProxy & {
    modules: PyProxy & { set(name: string, mod: unknown): void };
  };
  sys.modules.set(moduleName, moduleObj);
}
