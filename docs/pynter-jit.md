# A JIT for pynter-wasm

Status: project plan, draft. Tracking project: **pynter-jit** (source-academy GitHub organization).

## Goal

Make pynter-wasm, the pynter VM compiled to WebAssembly (`src/engines/pvml/pynter/`), tier up hot
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

pynter keeps its values NaN-boxed in linear memory (`vm/include/pynter/nanbox.h`), which is
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

- A wasm binary encoder.
- A code generator from pynter bytecode plus feedback to wasm.
- The installer: compile, instantiate, `table.set`.

### The ABI contract

Generated code must match pynter's layouts exactly: NaN-box tags, frame and environment structs,
heap object headers, and the table indices of the helpers it calls. The pynter build generates
a description of these (`offsetof` values, tag constants, helper indices) that the TypeScript
code generator imports, so the two sides cannot drift apart silently.

## Semantics to preserve

pynter's semantics, not CPython's, are the reference for the JIT:

- **Ints are 21-bit** (`NANBOX_INTMIN`..`NANBOX_INTMAX`) and overflow to float
  (`NANBOX_WRAP_INT`). Specialized int code uses `i32` arithmetic followed by a range check that
  falls through to the float conversion. This is cheaper than a bigint guard.
- **Floats are 32-bit.** Specialized float code uses `f32`, not `f64`, so results match the
  interpreter bit for bit.
- **Faults**: type errors, index errors and the like must raise the same `pynter_fault_t`
  from compiled code as from the interpreter.
- **Memory management**: pynter uses refcounting (`siheap_refbox` / `siheap_derefbox`) plus
  mark-sweep (`siheap_mark_sweep`). Compiled code must keep refcounts correct, and must never hold
  a heap pointer only in a wasm local across a call that can allocate, because the collector cannot
  see wasm locals. The first version keeps heap values on the VM stack or in VM frames and
  unboxes only numbers.

The differential test (phase 2) is the safety net for all of this: run py-slang's pynter test
suite with the JIT forced on everything, and require identical output and faults.

## Phases

Each phase ends with something measurable. Phase 1 is a go/no-go gate.

### Phase 0: baseline and benchmarks

- A release build of pynter-wasm. The current build sets `PYNTER_DEBUG` and
  `PYNTER_DEBUG_MEMORY_CHECK` (`devices/wasm/wasm/CMakeLists.txt`), and measuring against it would
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
- py-slang: a specializing code generator. Locals are held in wasm locals (`i32` small ints with a
  range guard, `f32` floats), with a guard at every point where feedback was assumed and a bailout
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
