# py2js — compile-to-JavaScript evaluator experiment

A feasibility experiment for a fourth py-slang execution engine (alongside the
CSE machine, PVML and WASM): compile SICPy **chapter 1** to JavaScript source
and run it natively, in the style of js-slang's transpiler
(`js-slang/src/transpiler/transpiler.ts`).

```
yarn tsx experiments/py2js/compare.ts       # differential conformance vs the CSE machine
yarn tsx experiments/py2js/bench.ts         # benchmark vs CSE machine and PVML interpreter
yarn tsx experiments/py2js/module-bench.ts  # sound-module scenario: dual compilation
```

Nothing here is wired into the build, tests, or exports — it is an experiment.

## Design

| piece | file | idea |
|---|---|---|
| runtime | `runtime.ts` | Unboxed JS values: int→`bigint`, float→`number`, bool→`boolean`, str→`string`, None→`null`, functions→JS closures with `pyName`/`pyArity` metadata. Python semantics live in `binop`/`unop`/`truth` helpers that mirror `src/engines/cse/operators.ts` at chapter 1 (§1 equality excludes bool/function; `and`/`or` need a bool left operand; if/ternary use Python truthiness, per the BRANCH instruction). Reuses `pythonMod`/`numericCompare` from `src/engines/cse/utils` and `toPythonFloat` from `src/stdlib/utils`, so numeric edge cases agree with the other engines by construction. |
| compiler | `compiler.ts` | Direct AST→string codegen over `ExprNS`/`StmtNS` (~200 lines). User identifiers are mangled with `$` (impossible in Python identifiers), all runtime services hang off one `__py` parameter, so no free-identifier collision handling is needed — much simpler than js-slang's `getUniqueId` machinery. |
| tail calls | both | Returns in tail position compile to `__py.tail(f, args)` markers; `__py.call` runs the trampoline. The transform recurses through ternaries, groupings and `and`/`or` right operands — the same scheme as js-slang's `isTail` transform, but done during codegen instead of by AST rewriting. |

Generated code for `fact`:

```js
$fact = __py.def("fact", 1, ($n) => {
  return (__py.truth(__py.binop("==", $n, 0n)) ? 1n
          : __py.binop("*", $n, __py.call($fact, [__py.binop("-", $n, 1n)])));
});
__py.call($print, [__py.call($fact, [20n])]);
```

## Results

**Conformance** (`compare.ts`): **59/59** chapter-1 programs agree with the CSE
machine — value semantics (int/float coercion, floor-div/mod signs, `**`,
Python float formatting incl. `-0.0`/`1e+30`), chained comparisons,
short-circuiting, closures, higher-order functions, deep (100k) and mutual
tail recursion, and 14 negative cases where both engines must raise
(§1 equality restrictions, non-bool `and`, ZeroDivision, arity, …).

**Performance** (`bench.ts`, Node 20, M-series):

| workload | CSE machine | PVML interpreter | py2js |
|---|---|---|---|
| `fib(20)` | 258 ms (74×) | 128 ms (37×) | **3.5 ms** |
| tail sum 100k | 1136 ms (205×) | 1156 ms (208×) | **5.6 ms** |
| newton 100k (float) | 2154 ms (189×) | 2204 ms (194×) | **11.4 ms** |

Against hand-written native JS, py2js is within 2.3–3.3× (`fib(27)`,
tail-sum 3M). Parse+compile is ~0.5 ms for a small program — compilation cost
is negligible next to CSE startup.

## Limitations found

- **Non-tail recursion depth**: real JS stack frames, overflow between 1k and
  5k Python frames (each Python call costs several JS frames). Tail recursion
  is unbounded thanks to the trampoline. Notably CPython itself raises
  `RecursionError` at a default limit of 1000 — a real engine should count
  frames and raise `RecursionError` deliberately rather than leak `RangeError`,
  making this *more* faithful than the CSE machine's unbounded recursion, and
  SICP-style iterative processes are tail-recursive anyway.
- **No source locations in errors** yet. The js-slang answer: emit
  line/col literals into the runtime-helper calls (and/or source maps).
- **Builtins are a minimal native set** (`print`, `abs`, `str`, `max`, `min`,
  a few `math_*`). The real stdlib (`src/stdlib/misc.ts`/`math.ts`) is written
  against the CSE machine's *tagged* `Value` union with `(args, source,
  command, context)` signatures. Building py2js in anger needs either a
  wrap/unwrap bridge at builtin call boundaries or (better, long-term) a
  representation-agnostic stdlib core.
- Not covered: complex numbers, MultiLambda, and everything ≥ chapter 2
  (lists, loops, reassignment — all of which map naturally onto JS arrays,
  loops and mutation; loops would *reduce* the trampoline's importance).
- The resolver/validators are not run (the CSE runner's `analyze()` should run
  first in a real engine — same as runner.ts does).

## The async/conductor-module question

In production the program runs in a web worker under conductor, and imported
modules talk to the frontend over **asynchronous** channels. Does the
transpiled code have to be entirely async?

Measured (async-everywhere compile shape — every user-level call `await`ed):

| workload | sync py2js | async-everywhere | overhead |
|---|---|---|---|
| `fib(25)` | 7.2 ms | 32.7 ms | 4.5× |
| tail sum 1M | 33.7 ms | 82.5 ms | 2.4× |

So async-everywhere costs ~2.5–4.5× — and is **still ~40–80× faster than the
CSE machine**. Also measured: `await` does *not* change the stack-depth story
(an async function runs synchronously until its first suspension point), so
async is purely about module interop, not about recursion depth.

But the async question is sharper than "is the program async": **modules are
where the speed is needed**. The sound module represents sounds as functions
of time and samples the *user-defined Python* wave function 44 100 times per
second of audio, from TS module code. If user functions only exist in async
form, every sample costs a promise + microtask hop — and the module hot loop
dies.

### Dual compilation (implemented and measured)

The answer that works: compile every user function **twice**, into two bodies
sharing one closure environment (`__py.def2(name, arity, syncBody,
asyncBody)`):

- the **async body** is used on the program's spine (`await __py.acall(...)`
  at every call site) so any module call can suspend on a channel round-trip;
- the **sync body** is the function object itself, so `__py.call` and — the
  point — TS modules invoking a Python callback (`rt.callSync(wave, [t])`)
  run promise-free at full speed.

Since *every* function value carries both bodies, first-class functions need
no static analysis: whichever side of the boundary picks the function up gets
the right body. Tail-call markers are shared (a marker is returned
synchronously in both modes; each trampoline bounces its own way). Locals are
per-body (fresh per invocation anyway); captured outer variables are shared
through the common closure — so the same `wave`/`scaled` closures work from
both sides.

Generated shape:

```js
$wave = __py.def2("wave", 1,
  ($t)       => { return __py.tail($math_sin, [ ... ]); },
  async ($t) => { return __py.tail($math_sin, [ ... ]); });
(await __py.acall($print, [(await __py.acall($play, [$wave, 1n]))]));
```

Measured on the sound scenario (`module-bench.ts`, 10 s of audio = 441 000
Python wave-callbacks from the TS module):

| configuration | time | per callback |
|---|---|---|
| dual compile + `callSync` (proposed) | **45.7 ms** | 104 ns |
| dual compile + `acall` per sample (async-only forces this) | 153.7 ms | 349 ns |
| sync compile + `callSync` (no-async reference) | 47.0 ms | 107 ns |
| native JS wave function (floor) | 8.6 ms | 20 ns |

Two conclusions: the async spine costs the module hot path **nothing**
(dual+callSync ≡ pure sync build), and even the per-sample cost is trivial
against real time (44 100 samples/s × 104 ns ≈ 0.5% of one second). All 59
differential cases also pass under dual compile (compare.ts runs every case
three ways: CSE, sync, dual), confirming the two bodies are semantically
identical.

One rule falls out: a module function that itself needs a frontend
round-trip (request/response over a channel) is marked `asyncOnly` and is
callable only on the async spine; calling it from inside a synchronously
sampled callback raises a clear `TypeError` ("needs a frontend round-trip
and cannot be called from a synchronous module callback") instead of leaking
an unawaited Promise — verified in module-bench.ts. That restriction is also
semantically honest: a wave function *shouldn't* block on the frontend per
sample. Fire-and-forget module calls (e.g. buffered output posts with no
reply) stay sync-callable.

Costs of dual compilation: 2× generated code and compile time (compile is
~0.5 ms, so irrelevant) and the discipline that module APIs receive the
runtime's `callSync` for callbacks. Remaining alternatives —
`Atomics.wait`-based sync RPC over SharedArrayBuffer (would let even
`asyncOnly` functions be called synchronously, needs COOP/COEP) and
Stopify-style CPS (solves pause/resume and stack depth too, at big
complexity/perf cost) — are fallbacks if requirements grow, not needed for
the sound-module case.

## Verdict

Feasible and very much worth building. ~700 lines total for a chapter-1
engine that agrees with the CSE machine on all 59 differential cases (in both
sync and dual compile modes) and runs two orders of magnitude faster — with
dual compilation demonstrated as the answer to async conductor modules that
must call user functions synchronously in hot loops. The main remaining open
design question is the stdlib bridge; that is engineering, not research.
