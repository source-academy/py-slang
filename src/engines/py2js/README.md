# py2js — compile-to-JavaScript SICPy engine

py2js compiles the py-slang AST directly to a JavaScript source string and
runs it natively (`new Function`/`AsyncFunction`), in the style of
js-slang's transpiler — a fourth execution engine alongside the CSE machine,
PVML, and WASM. It exists because the other three all keep an explicit
interpreter loop (control/stash stepping, or a bytecode VM) between the
program and the CPU; compiling straight to JS lets V8's own JIT do that work
instead. Measured 37–208× faster than the CSE machine and PVML on
chapter-1-shaped workloads (see `experiments/py2js/README.md` for the
original differential/benchmark harness that motivated building this for
real), and the module-interop numbers below.

Supports the full SICPy language, chapters 1–4 (`docs/specs/python_1.tex`
through `python_4.tex`). Entry points: `runCodePy2Js`/`runCodePy2JsDual`
(one-shot), `Py2JsSession` (persistent multi-chunk REPL/conductor sessions),
`compilePy2Js` (compile-only, for inspecting generated code).

## Design

**Exec-style only**, like PVML-in-browser: a program has no "final value" —
everything observable goes through `print()`. Matches real Python's own
execution model (unlike the CSE machine, which is expression-oriented for
REPL/stepper purposes).

**Unboxed value model** (`runtime.ts`'s `PyValue`): `int → bigint`,
`float → number`, `bool → boolean`, `str → string`, `None → null`,
`complex → PyComplexNumber`, `list → PyList` (a plain `PyValue[]`),
`function → JS closure with pyName/pyArity metadata`, opaque module values →
`PyOpaque`. Values stay unboxed so V8 can JIT the compiled program; the
operator/stdlib semantics (`binop`/`unop`/`pyEquals`/`pyOrder`/`pyIdentical`
in `runtime.ts`) are written to mirror
`evaluateBinaryExpression`/`evaluateUnaryExpression` in
`src/engines/cse/operators.ts` — same dispatch order, same per-chapter
typing rules — so the two engines agree by construction rather than by
coincidence. A chapter-2 pair and a chapter-3+ list literal are the _same_
`PyList`, one representation for both, matching the CSE machine exactly
(which represents both as the same flat `{type:"list", value: Value[]}` —
`src/engines/cse/stash.ts`) — there is no separate pair type here either.
"Is this a pair" is therefore a structural question (length === 2), not a
type-level one, on both engines; `is_list`/`list_length`/subscripting can't
tell a pair from a 2-element list apart because there is nothing to tell
apart. Error messages still say "pair" at chapters 1-2 and "list" at
chapter 3+ for a list-shaped value (`pyTypeName`'s `sayPair` parameter,
matching CSE's `friendlyTypeName(name, variant)`) — the chapter decides the
word, not the value, since chapters 1-2 have no list-literal syntax at all
(so any array-shaped value there can only have come from pair()
construction, unambiguously).

**Compile pipeline** (`index.ts`): parse (the shared py-slang parser) →
resolve with the chapter's validators (the same `Resolver` every other
engine uses — chapter-gating, name resolution, and feature restrictions
like "no `is` before chapter 3" are entirely the resolver's job, not
`compiler.ts`'s) → compile to a JS source string (`compiler.ts`) →
instantiate via `new Function`/`AsyncFunction` → run against a fresh
`Py2JsRuntime`, collecting `print()` output.

**Compile modes** (`compiler.ts`):

- **sync** (default): every user function gets one sync body; the whole
  program is synchronous. Fastest; a module call needing an async
  frontend round-trip has nowhere to `await`.
- **dual**: every user function gets _two_ bodies over one shared closure
  environment (`__py.def2`) — a sync body (used by `rt.call` and by TS
  modules calling back into Python, e.g. sampling a sound wave) and an
  async body in which every call is `await __py.acall(...)` (used on the
  program's async spine, so a module round-trip can suspend). `Py2JsSession`
  picks dual mode automatically, but only for chunks that actually import
  something (`hasImports` in `moduleInterop.ts`) — everything else stays on
  the fast sync path.
- **REPL** (`options.repl`, used by `Py2JsSession`): one chunk of a
  persistent session. Top-level bindings — this chunk's and every earlier
  chunk's — live in the runtime's `globals` dictionary instead of `let`
  declarations; a name resolves through `__py.gref`/`__py.globals[...]`
  rather than a hoisted local. This is what makes a function defined in
  chunk 1 see chunk 3's _redefinition_ of a helper it calls, matching the
  CSE machine's global-environment semantics, rather than freezing values
  into per-chunk `const`s the way js-slang's transpiler does.

**No JS TDZ vs. Python's dynamically-growing environments.** This is the
single trickiest piece of the whole engine, and worth its own note. JS `let`
has a temporal dead zone; Python's environments have none — a name is
either bound or not, checked dynamically at read time, regardless of
textual position. The fix, used uniformly everywhere a name is declared
(module scope, function scope): hoist _every_ name a scope will ever bind
as an uninitialized `let` before any code in that scope runs (`emitDecls`),
and guard every read of a non-parameter binding with an inline
`=== undefined` check (`emitName` in `compiler.ts`) that raises
`UnboundLocalError` (function-local) or `NameError` (module-level) —
`undefined` is never a legitimate `PyValue` (`None` is `null`), so the
check is exact and costs one perfectly-predicted comparison. `global`/
`nonlocal` (chapter 3+) generalize this: a name a function declares
`global`/`nonlocal` is _excluded_ from that function's own hoisted locals,
so the same `emitName` scope-chain walk falls through to the outer binding
(the module globals table, or an enclosing function's own hoisted `let`)
instead of shadowing it. A whole-program pre-scan
(`collectAllGlobalDecls`) folds every `global`-declared name into the
module's name set even with no top-level assignment anywhere in the
program (`def f(): global x; x = 5`, no `x = ...` at module level) —
mirroring the Resolver's own `visitFunctionDefStmt` pre-registration of
such names into the module environment.

**`for` loops** (chapter 3+) desugar exactly per
`docs/specs/python_loops.tex`: a hidden counter distinct from the
user-visible loop target, so the loop body may freely reassign the target
without perturbing iteration (`for i in range(5): i = 0` leaves `i` as `0`
after the loop, not `4`). The counter's advance is a JS `for(;;)` **update
clause**, not a trailing statement after a `while` body — a `continue`
jumps straight to the condition check, so a trailing increment would be
skipped and the loop would hang forever the first time the body actually
continued (a real bug caught by `loops.test.ts`'s own fixtures during
development, now a dedicated regression test in `py2js-loops.test.ts`).

**Proper tail calls**: `return`-position calls compile to `__py.tail(f,
args)` trampoline markers (`emitTailPosition`) instead of real calls,
bounced by `call`/`acall`'s trampoline loop in `runtime.ts` — unbounded
tail recursion, verified to depth 1M.

## Stdlib

py2js runs the **real stdlib** — the same `misc`/`math`/`linked-list`/
`list`/`pairmutator`/`stream`/`parser` builtin implementations every other
engine uses — instead of a reimplemented set, so stdlib semantics can never
drift between engines. `stdlibBridge.ts` converts native (unboxed) py2js
values to the CSE machine's tagged `Value` union at the call boundary and
back for the result. Most builtins need no special-casing at all: since the
CSE tagged `Value` union's list shape (`{type:"list", value: Value[]}`) is
always built from nested 2-element cons cells, the same `toTagged`/
`fromTagged` round-trip that handles a chapter-2 pair also reconstructs an
arbitrary-length parse tree correctly — this is why `tokenize`/`parse`
(chapter 4) needed zero new bridging code, just adding the `parser` group
to `PY2JS_GROUPS[4]`.

A few builtins are **native** (bypass the generic bridge) because the
bridge's tagged round-trip is structurally the wrong shape for them:

- `print`/`input`/`arity` — chapter-1 native core. `print` is stream-based
  (async) in the CSE machine but plain synchronous code here; `input` is
  dual-bodied (`def2`) and `asyncOnly`, exactly like an imported module
  function, round-tripping through the conductor evaluator's `requestInput`
  hook — a REPL chunk that calls it, at any nesting depth, compiles in dual
  mode even with no imports of its own (`Resolver.referencedNames`); `arity`
  is native because py2js functions aren't CSE closures.
- `set_head`/`set_tail` (chapter 3) — the generic bridge converts an
  argument into a _fresh_ CSE-side value, so a mutation the CSE builtin
  performs on it would be silently lost rather than visible on the
  caller's original `PyList`.
- `stream()` (chapter 3) — CSE's own implementation fabricates a brand-new
  closure (the lazy tail thunk) on every call; the bridge's function-value
  handling only passes through a function that either originated in py2js
  or crosses unchanged, with no way to wrap one a CSE builtin invents on
  the spot. Every other stream function (`stream_map`, `stream_filter`,
  `enum_stream`, …) is pure Python in `stream.prelude.ts`, already runnable
  through the generic group-prelude mechanism once pairs/closures work, so
  none of those need native treatment.
- `apply_in_underlying_python` (chapter 4) — CSE's own implementation
  pushes onto its own control/stash for the CSE step loop to process
  later, rather than returning a value synchronously; incompatible with a
  bridge that expects a builtin to return synchronously. Walks its
  argument list exactly as permissively as CSE does (any 2-element-list-
  shaped chain) and calls through the runtime's own `callSync` trampoline.

List-processing primitives (`map`/`filter`/`reduce`/`is_list`/`length`/
etc., wherever they live — the stdlib groups above, or
`GenericDataHandler`'s own `is_list`/`list_to_vec`/`accumulate`/`length`
for the module-interop layer) deliberately have **no cycle detection**: a
circular structure built via `set_head`/`set_tail`/`pair_sethead`/
`pair_settail` makes them loop forever rather than raising an error. This
is an intentional stance (matching the reference engine, not a gap) —
contrast with `apply_in_underlying_python`'s argument-list walk
(`stdlibBridge.ts`'s `walkArgList`), which _does_ guard against cycles: an
unbounded argument list there doesn't just spin, it crashes the process
(unbounded array growth → V8 OOM), and it's a one-shot call-argument
collection rather than a general sequence operation.

## Module interop

`moduleInterop.ts` is the py2js analogue of `src/engines/cse/modules.ts` —
conversion between py2js's native values and conductor's module protocol
(`TypedValue<DataType>`/`IDataHandler`), so a module behaves identically
regardless of which engine the student is running on. `IDataHandler`
itself (pair/array/closure/opaque bookkeeping) is `GenericDataHandler`
(`src/conductor/GenericDataHandler.ts`) — engine-agnostic, shared with the
CSE evaluator, originally extracted from what used to be inline in
`PyCseEvaluatorBase`.

**Closures crossing the module boundary are `AsyncGenerator` calls by
conductor's own contract** (`ExternCallable` is
`(...args) => AsyncGenerator<...>`) — not a choice either engine or this
module-interop layer gets to make:

- Python calling an imported module function (`from math import sqrt`):
  wrapped as a `PyFunction` whose body iterates
  `dh.closure_call_unchecked`'s generator. `.next()` on an async generator
  always resolves via microtask, so this is unavoidably async — the
  function is `asyncOnly`, callable only through `acall`/dual mode.
- A module calling a Python-defined closure (the sound-module scenario:
  `play(wave, duration)` samples `wave` many times): wrapped via
  `dh.closure_make(sig, func)`, where conductor requires `func` itself to
  be an async generator (`pyClosureFunc`). Its _body_, though (outside the
  `.sync` fast path below), runs `fn` via `rt.acall` — no interpreter
  re-entry (unlike the CSE machine's own closure wrapper in `modules.ts`,
  which pushes onto `control`/`stash` and resumes the whole step loop per
  call), but still able to await a nested `asyncOnly` module call `fn`
  itself makes — e.g. a `stacking_adsr` envelope lambda calling `adsr`
  (source-academy/py-slang#348). Using `rt.acall` here costs nothing extra
  over the old `rt.callSync`: this generator body already only runs when the
  `.sync` fast path below has failed or wasn't attempted, so a microtask per
  call is already being paid, and `acall` degrades to essentially the same
  cost as a plain call when `fn` makes no nested async-needing call.

**The synchronous fast path** (`GenericDataHandler.closure_call_sync`,
`pyClosureFunc.sync` in `moduleInterop.ts`): the `AsyncGenerator` shell
above is mandatory by conductor's type contract, but for a closure that
provably never needs a real host round-trip — a scalar-in/scalar-out wave
function is the canonical case — even the mandatory shell costs real,
measurable time at high call counts, for reasons that have nothing to do
with any actual cross-boundary work: entering the async generator,
`Promise.all`-converting arguments (even a single one), and awaiting the
converted result are all pure allocation-and-microtask-scheduling
overhead. Isolated in a microbenchmark (Node, this repo, 926,000 calls of
a trivial `Math.sin(t) * 0.5`, only the calling convention varied):

```
plain synchronous call:                    ~15-20 ns/call
plain async function (Promise.all x1):     ~330-340 ns/call   (~16-20x)
async generator (matches pyClosureFunc):   ~390-420 ns/call   (~18-23x)
```

— roughly 300–400ms of pure calling-convention tax for 926K samples, none
of it real work and none of it a genuine cross-thread hop (conductor
modules load via dynamic `import()` into the _same_ JS realm as the
evaluator that requested them — see `runner-module-loader`'s
`requestModule`, which passes the live evaluator object straight into the
module plugin's constructor; a real worker boundary couldn't do that
without serialization). The async-generator shape specifically costs
~15-20% more than a plain `Promise`-returning async function, consistent
with V8 optimizing async generators less aggressively than plain async
functions.

`GenericDataHandler.closure_call_sync(closureId, args)` is the escape
hatch a module can use to skip that tax: it looks up the stored closure
and, if the underlying function carries a `.sync` twin, calls it directly
— no generator, no `Promise`. Returns `undefined` when there isn't one
(the "fall back to `closure_call_unchecked`" signal), which today means
every CSE-machine closure (only py2js sets `.sync` so far) and any py2js
closure whose arguments/result aren't in the restricted synchronous
converters' scalar coverage (`moduleToPythonSync`/`pythonToModuleSync`
in `moduleInterop.ts`: number/bool/string/None only — the shapes a wave
function actually needs).

One correctness point that shaped the implementation: once
`rt.callSync(fn, ...)` has actually run — real Python code, real side
effects like `print()` — there is no safe way to fall back to the async
path if the _result_ can't be represented, because that would call `fn` a
second time. So an unsupported _argument_ type safely returns `undefined`
before `fn` ever runs (nothing has happened yet); an unsupported _result_
type throws instead, after the fact, rather than silently risking a
double invocation.

**Module values crossing the boundary**: `NUMBER`/`BOOLEAN`/
`CONST_STRING`/`EMPTY_LIST`/`VOID` map to the obvious native types;
`OPAQUE` becomes `PyOpaque` (held and passed around, not otherwise
inspectable); `CLOSURE` becomes an `asyncOnly` `PyFunction` (tagged with
`.moduleClosure`, the original identifier, so passing that same closure
back into a module — e.g. a `Sound`'s wave function created by
`sine_sound` and later sampled by `play` — hands the identifier back
unchanged instead of wrapping a _new_, incorrectly-assumed-synchronous
closure around it); `PAIR` round-trips through a 2-element `PyList` — not
necessarily a proper list, same as the CSE converter's identical case, and
a genuine chapter-3+ `[a, b]` literal crosses exactly the same way, since
there's no representational difference for this conversion to even
distinguish them by (an N-element, N≠2, list has no module representation
and throws clearly rather than silently truncating); `ARRAY` and complex
numbers are rejected — no py-slang Python chapter has a native
fixed-length array or supports complex numbers crossing the module
boundary (matching the CSE converter's identical restrictions).

## Chapter coverage

| Chapter | Adds                                                                                                                                                                                                                                                             |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | straight-line arithmetic, conditionals, function application/recursion, lambdas, `misc`/`math`                                                                                                                                                                   |
| 2       | pairs (a 2-element `PyList`), linked-list stdlib, `from X import y` module loading                                                                                                                                                                               |
| 3       | reassignment, `while`/`for`/`break`/`continue`, native list literals + subscript access/assignment, `global`/`nonlocal`, universal `==`/`!=`/`is`/`is not`, `list`/`pairmutator`/`stream` groups                                                                 |
| 4       | `tokenize`/`parse`/`apply_in_underlying_python`, predeclared `__program__` (available at every chapter in py2js, matching the CSE reference and the spec's "predeclared in all Python languages" wording, not gated to chapter 4 despite being documented there) |

## Testing

- `src/tests/operator-conformance-py2js.test.ts` — the full operator × type
  × type cross product from `docs/specs/python_typing_*.tex`, swept against
  a **live, freshly-computed CSE machine reference** for every case (not a
  second hand-written copy of the semantics that could drift) — currently
  ~2800 cases across chapters 1–3.
- `src/tests/stdlib-conformance-py2js.test.ts` — every bridged builtin and
  constant over the chapter's type universe, same live-CSE-reference
  approach.
- Directed suites per feature area (`py2js-loops`, `py2js-lists`,
  `py2js-global-nonlocal`, `py2js-identity`, `py2js-interpreter-support`,
  `py2js-unbound`, `py2js-dual-mode`, `py2js-from-import`,
  `py2js-module-interop`, `py2js-host-functions`, `Py2JsEvaluator`), several
  reusing the exact same fixtures as the CSE/PVML/native-Pynter/CPython
  conformance suites (`loops.test.ts`, `list.test.ts`) rather than
  hand-rolling parallel cases that could drift from them.
- `yarn jest` for the full suite; `yarn jest src/tests/<file>` for one.

## Known limitations / future work

- **Error source locations are not attached yet.** Errors carry the
  correct Python error-class name (matching the CSE machine) but not a
  source position; the stdlib bridge's synthetic `command` nodes point at
  the program start.
- **Negative list indexing (`xs[-1]`) is unsupported**, matching a gap in
  the CSE reference itself (`LIST_ACCESS` has no negative-index handling;
  `LIST_ASSIGNMENT`'s attempt is a JS `%`, not Python's modulo, and
  silently no-ops on an empty list rather than raising `IndexError`) —
  intentionally _not_ fixed here in isolation, since doing so would make
  the two engines disagree.
- **A bridged stdlib builtin error can render as `"[object Object]"`**
  instead of a real message (source-academy/py-slang#295) — CSE's
  `RuntimeSourceError` doesn't extend JS `Error`, so it fails the
  `instanceof Error` check in `index.ts`'s catch blocks. Pre-existing since
  chapter 2, not py2js-chapter-specific.
- `input()` round-trips through the conductor evaluator's `requestInput` hook
  (`Py2JsEvaluator.ts`); `runCodePy2Js`/`runCodePy2JsDual` (no conductor) have
  no such hook wired, so `input()` there raises `RuntimeError`.
- `DataType.ARRAY` and complex numbers do not cross the module boundary in
  either direction (see Module interop above).
- No chapter 5 — SICPy has four chapters.
