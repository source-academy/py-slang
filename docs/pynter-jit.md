# A JIT for pynter-wasm

Status: project plan, draft. Tracking project: [**pynter-jit**](https://github.com/orgs/source-academy/projects/60) (source-academy GitHub organization).

## Goal

Make pynter-wasm, the pynter VM (C, in the [source-academy/pynter](https://github.com/source-academy/pynter)
repository) compiled to WebAssembly, tier up hot
functions and loops to WebAssembly generated at run time. Cold code keeps running in the
interpreter. The aim is a large speedup on numeric loops and recursion, without changing any
program's observable behavior.

This is first a research and teaching project: a small, complete tiering JIT, with hotness
counters, type feedback, guards and bailout. Performance alone does not justify it, since py2js
already runs SICPy programs at the speed of V8's optimized JavaScript.

## Why pynter-wasm, and not PVML-in-browser

PVML-in-browser (`src/engines/pvml/pvml-interpreter.ts`) represents values as JS heap values
(`PVMLBoxType`: `bigint`, `string`, closure objects, …). Wasm can only hold these as opaque
`externref`s, so compiled code would call back into JS for every generic operation. Compiling
PVML bytecode to JavaScript instead would mostly reproduce py2js.

pynter keeps its values NaN-boxed in linear memory (`vm/include/pynter/nanbox.h` in the pynter repository), which is
the representation a wasm JIT wants. Generated modules import pynter's memory and function table,
read and write VM values directly, and call pynter's own C helpers without going through JS.

## Architecture

```
pynter (C, in wasm)                         JIT (TypeScript, in py-slang)
──────────────────                          ─────────────────────────────
interpret, count calls/back edges,
record type feedback in linear memory
counter trips ──── jit_compile(fn) ──────►  read bytecode + feedback from memory
                                            choose specializations, emit wasm bytes
                                            new WebAssembly.Module / Instance
                                              (imports: pynter memory, table, helpers)
                                            table.set(slot, export)
store entry slot ◄──── returns slot ──────
call compiled code via call_indirect
on bailout status: rebuild frame, resume at pc
```

The split is forced by wasm itself: wasm code cannot create modules, only JS can
(`WebAssembly.Module` / `Instance`). Since a JS step is needed anyway, the code generator is
written in TypeScript. A native pynter build gains nothing from a C code generator (native would
need a machine-code JIT), and TypeScript gives us vitest, py-slang's opcode definitions
(`src/engines/pvml/opcodes.ts`) and easy inspection of the generated code.

PVML-in-browser and pynter-wasm both run in a web worker, so compiling synchronously in the
middle of a run is allowed. The code generator emits the wasm binary format directly; going
through WAT and `wabt`, as the wasm engine does (`src/engines/wasm/compiler.ts`), is too slow
for a JIT.

### In pynter (C), behind `#ifdef PYNTER_JIT`

- Call counters per function and back-edge counters per loop.
- Type feedback: a few bits per arithmetic and comparison instruction, recording which operand
  tags have been seen (small int, float, bool, pointer).
- The `jit_compile` import, and dispatch to a function's compiled entry when one exists.
- Bailout handling: compiled code returns a status, plus the live values in a buffer, and the
  interpreter rebuilds the frame and resumes at the given pc.
- Exported memory and function table, plus helpers exported for compiled code to call
  (allocation, refcounting, faults, primitives).

The native build compiles all of this out.

### In py-slang (TypeScript), under `src/engines/pvml/pynter/jit/`

py-slang's `src/engines/pvml/pynter/` is only the integration point: TypeScript adapters around the
`@sourceacademy/pynter-wasm` package. The C VM and its Wasm build live in the pynter repository,
so the C-side work above happens there.

- A wasm binary encoder.
- A code generator from pynter bytecode plus feedback to wasm.
- The installer: compile, instantiate, `table.set`.

### The ABI contract

Generated code must match pynter's layouts exactly: NaN-box tags, frame and environment structs,
heap object headers, and the table indices of the helpers it calls. The pynter build generates
a description of these (`offsetof` values, tag constants, helper indices) that the TypeScript
code generator imports, so the two sides cannot drift apart silently.

## Semantics to preserve

The pynter interpreter is the reference for the JIT. The JIT is written against pynter's
64-bit value representation (see "The value representation" below), so pynter's semantics
are Python's:

- **Ints** are 32-bit small ints in the NaN-box, overflowing to heap bigints. Specialized int code
  widens to `i64` for the operation (add, subtract and multiply of two 32-bit operands can wrap an
  `i32`: `65536 * 65536` wraps to 0), then checks that the result fits a small int and otherwise calls
  the bigint helper. The check must never run on a wrapped `i32` result.
- **Floats** are `f64`, so specialized float code matches the interpreter, py2js and CPython bit
  for bit.
- **Faults**: type errors, index errors and the like must raise the same `pynter_fault_t`
  from compiled code as from the interpreter.
- **Memory management**: pynter uses refcounting (`siheap_refbox` / `siheap_derefbox`) plus
  mark-sweep (`siheap_mark_sweep`). Compiled code must keep refcounts correct, and must never hold
  a heap pointer only in a wasm local across a call that can allocate, because the collector cannot
  see wasm locals. The first version keeps heap values on the VM stack or in VM frames and
  unboxes only numbers.

The differential test (phase 2) is the safety net for all of this: run py-slang's pynter test
suite with the JIT forced on everything, and require identical output and faults.

## The value representation

Before pynter#54, pynter's NaN-box was 32 bits, which gave it three restrictions: `f32` floats,
21-bit ints that became floats on overflow, and 22-bit heap offsets (a heap of at most 4 MB). These
showed up as wrong results independently of the JIT, and they fix the layout every piece of
generated code is written against, so they are removed before the JIT's ABI is defined:

- **64-bit NaN-boxing by default** (pynter#54, done, pynter v0.3.0): `f64` floats, 32-bit small
  ints, 32-bit heap offsets, for wasm, EV3 and ESP32. The 32-bit layout stays as an opt-in
  `PYNTER_NANBOX32` for AVR Arduino (selected automatically there). On EV3 (64 MB of RAM, no FPU,
  soft-float either way), the cost is about 2× on float arithmetic only.
- **Bigints on small-int overflow** (pynter#55, not started), using libtommath, behind
  `PYNTER_BIGINT`.
- **py-slang adapts** (py-slang#576, done, PR #584): reads `f64` results, the complex literal is two
  `f64` (17 bytes), and the float32 test skips are gone. The skip for ints beyond 32 bits stays
  until bigints land.

The layout is selected in `vm/include/pynter/layout.h` (`sifloat_t`, `SIFL(fn)`, `sinanbox_bits_t`).
`pynter_value_t` has its union at offset 8 (16 bytes on wasm32). Heap blocks are 8-byte aligned (the
EV3's ARM9 needs it). Emscripten forbids `isnan` in extern-inline functions (use
`NANBOX_OFFLOAT_NOTNAN`).

## Status

Last updated 2026-10-18. Track the work on the
[pynter-jit project](https://github.com/orgs/source-academy/projects/60).

- Done: this plan (#567), 64-bit NaN-boxing (pynter#54, pynter#58, released as v0.3.0), py-slang
  adapted (py-slang#576, #584).
- Next: bigints (pynter#55). It blocks the specializing code generator (py-slang#572) but not phases
  0 and 1, which can start straight away: pynter#47 (release build for benchmarking), py-slang#568
  (benchmark set), pynter#48 (the go/no-go experiment).
- Not tested: the EV3, ESP32 and Arduino builds (no toolchains were available). Only the host
  compilers (GCC, Clang), ASan/UBSan, Emscripten and the py-slang parity suite were run.
- Known limits: pynter's printer uses `%f`/`%g` (about six digits), so the native-Pynter tests
  compare floats at that precision. Pynter is offered in the playground for Python §3 only, as an
  experimental evaluator with just the `misc` and `math` libraries (language-directory#77).

Practicalities for whoever resumes:

- pynter's default branch is `master`. A release is a GitHub Release: tag `vX.Y.Z` publishes
  `@sourceacademy/pynter-wasm@X.Y.Z` to npm through `NPM_TOKEN` (a new token was set on 2026-10-17;
  if the publish fails with a 404 on the PUT, the token is the first suspect).
- py-slang's de-facto test framework for pynter is its own suite: build pynter's `runner` and run
  `PYNTER_RUNNER_PATH=<runner> yarn pynter:report`. It passed 1711/1711 on v0.3.0.
- The current wasm build has `PYNTER_DEBUG` on, so benchmark against a release build (pynter#47).

## Phases

Each phase ends with something measurable. Phase 1 is a go/no-go gate. Phases 0 and 1 can
proceed alongside the representation change, since the speedup ceiling barely depends on `f32`
vs `f64`. Phase 2 (pynter#49) waited for 64-bit boxing (pynter#54, done). Phase 3's specializing code
generator (py-slang#572) waits for bigints (pynter#55).

### Phase 0: baseline and benchmarks

- A release build of pynter-wasm. The current build sets `PYNTER_DEBUG` and
  `PYNTER_DEBUG_MEMORY_CHECK` (`devices/wasm/wasm/CMakeLists.txt` in the pynter repository), and measuring against it would
  overstate every speedup.
- A benchmark set: a float loop, an int loop, recursive `fib`, a loop over a list, and an
  iterative SICPy-style process (e.g. `fast_expt`, `sqrt_iter`).
- A harness that runs each benchmark on pynter-wasm (debug and release), PVML-in-browser, py2js
  and the CSE machine, and reports times.

### Phase 1: feasibility experiment (go/no-go)

Hand-write the wasm for the float loop and for `fib` against pynter's memory layout, install it in
pynter's table, and call it from the interpreter. This gives the speedup ceiling, and checks the
mechanics (table export, table growth, helper calls, instantiation cost) before anything is
generated automatically.

Expected outcome, to be confirmed:

| Situation | Rough speedup over release pynter-wasm |
|---|---|
| Dispatch removed only (stack stays in memory) | 2–4× |
| Plus unboxed locals, pure numeric loop | 20–50× |
| Loop calls C helpers each iteration (lists, allocation) | 3–8× |
| Recursive `fib`, direct compiled-to-compiled calls | 5–15× |
| Recursive `fib`, calls through the interpreter | 2–3× |

Go if the numeric loop gains at least 10× and `fib` at least 3×.

### Phase 2: ABI and baseline JIT

- pynter: export memory and table (`-sALLOW_TABLE_GROWTH`), export the helpers, generate the
  ABI description.
- pynter: call counters, the `jit_compile` import, dispatch to compiled entries.
- py-slang: the wasm binary encoder.
- py-slang: a baseline code generator that translates each opcode into a call to its C helper,
  or into inline code operating on the VM stack in memory. No type specialization and no bailout:
  every type is handled, just without the interpreter's dispatch overhead.
- Differential testing: a mode that compiles every function on first call (threshold 0), running
  py-slang's pynter test suite against the interpreter's results in CI.

### Phase 3: type specialization and bailout

- pynter: type feedback recording.
- pynter: the bailout protocol and frame reconstruction.
- py-slang: a specializing code generator. Locals are held in wasm locals (32-bit small ints, operated on as `i64`
  with a range check that calls the bigint helper on overflow, and `f64` floats), with a guard at every point where feedback was assumed and a bailout
  when a guard fails.

### Phase 4: calls and loops

- Direct calls between compiled functions, using the wasm call stack and respecting pynter's call
  depth limit.
- On-stack replacement for hot loops, so a long loop at the top level, or in a function called only
  once, gets compiled while it runs. Student programs often look like this.

### Phase 5: integration

- Enable the JIT for the pynter-wasm evaluator (`src/conductor/PyPvmlPynterEvaluator.ts`) behind a
  flag, off by default.
- Make sure fault reporting works for compiled code (related: pynter#15, fault information not
  reaching the JS side).
- Document the JIT for students and contributors.

## Risks and open questions

- **Instantiation cost.** Each module has a fixed setup cost, so compiling one function per module
  may be too expensive for short programs. Batch several hot functions per module if phase 1
  shows this matters.
- **Garbage collection.** Mark-sweep must see every live heap reference (see Semantics). pynter#30
  (a segfault in mark-sweep mid-construction) suggests this part of pynter is already fragile.
- **Step limit.** Visualizers need a step limit. Pynter is not used by a visualizer, so compiled
  code does not need to count steps, but if that changes, back edges must count too.
- **Async externs (modules).** Calls to imported module functions go through JS and may await.
  Compiled code bails out to the interpreter at such calls rather than handling them itself.
- **Maintenance.** The JIT doubles the places where an opcode's semantics live. The differential
  test in CI is what keeps them in agreement.
