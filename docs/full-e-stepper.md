# The environment stepper for full Python ("full e-stepper")

Status: design note; the parser is done (py-slang#556) and the engine's first slice is in. Tracking project: **full-e-stepper** (source-academy GitHub organization).
Builds on the e-stepper for Python §3/§4: [docs/e-stepper.md](e-stepper.md).

## Motivation

The e-stepper shows a Python §3/§4 program running: the program is rewritten one step at a time,
function bodies under evaluation are marked with the frame they run in, and frames and heap
objects are drawn as in the CSE machine. Its rules are small because the sublanguages are small.

The playground also offers full **Python**, run by CPython (in Pyodide). Programs there use classes,
tuples, dictionaries, iterators, exceptions, keyword arguments and comprehensions, and their
students meet the same questions the e-stepper answers for §3: which frame does this run in, what
does this name refer to, which object is changed. The full e-stepper answers them for full Python.

## Decisions

1. **A new engine, not an extension of the §3/§4 engine.** The sublanguages' rules are part of what
   they teach. In §3 a `for` loop over `range` is "assign the loop variable, run the body, continue
   with the rest of the range". In full Python, `for` calls `iter()` and then `next()` until
   `StopIteration`, on an iterator object in the heap. One engine for both would either show §3
   students the full rules or carry two versions of every rule. The two engines share the protocol,
   the display and helpers (labels, serialization), not their rules.
2. **Written in TypeScript, in py-slang, with no CPython at run time.** The engine is ours, so every
   step is under our control, and it does not depend on Pyodide's start-up, its JavaScript bridge,
   or CPython's internals (which the steps should not show anyway). It lives in
   `src/conductor/full-estepper/`, next to `src/conductor/estepper/`, and reuses py-slang's
   tokenizer, parser, error types and SICP library.
3. **CPython is the reference, in CI.** Every test program is also run by `python3`; output and the
   kind of exception must agree (see *Testing*). Where the engine does not implement a feature, it
   says so ("not supported in the environment stepper") instead of guessing.
4. **One tool for students.** Like the §3/§4 e-stepper, the full e-stepper is an evaluator of its
   own in the language directory (`pythonFullEStepper`, capability `E_STEPPER`), next to
   `pythonFullPyodide`. Running a program still uses CPython; stepping it uses the new engine. The
   frontend and the web plugin treat it like the §3/§4 e-stepper.
5. **Language-agnostic parts stay in plugins.** The new kinds of heap objects (below) extend
   `@sourceacademy/common-e-stepper` and the drawing, so other languages can use them too.

## Scope

Full Python is large. The engine grows in stages; each stage is usable on its own.

| Stage | Adds |
|---|---|
| 1 | everything in Python §4 (`for` still over `range` only); tuples (with unpacking), dicts, keyword arguments and default values; strings and lists with their common methods |
| 2 | `for` over any iterable, by the iterator protocol; `raise`, `try`/`except`/`else`/`finally`, exception objects |
| 3 | classes: `class` statements, instances, attributes, methods and `self`, `__init__`, single inheritance and `super()`, `isinstance` |
| 4 | generators (`yield`), comprehensions, `with`, operator overloading by dunder methods (`__add__`, `__eq__`, `__iter__`, `__next__`, `__str__`, …), decorators |

Out of scope: `async`/`await`, metaclasses, descriptors beyond methods and `property`, `exec` and
`eval`, threads, imports other than Source Academy modules and the SICP library.

The SICP library that the full Python evaluator preloads (all of Python §3's functions, except
`input` and `set_timeout`, from the `sourceacademy-sicp` package in `python/`) is predeclared in
the full e-stepper too, implemented by py-slang's own library (`src/stdlib/`).

## Parsing

py-slang's grammar (`src/parser/python.ne`) and AST (`src/ast-types.ts`) cover the sublanguages:
there is no `class`, `try`, `raise`, `yield`, tuple or dict display, comprehension, keyword argument
or decorator. The full e-stepper needs them, so the first work item is a parser for full Python.
Two ways:

- **extend the existing grammar and AST**, with new node types; the sublanguage validators keep
  rejecting what Python §1–§4 do not allow, so the other evaluators are unaffected;
- **a separate parser** written from CPython's grammar (`Grammar/python.gram`), producing its own
  AST.

The first keeps one parser and lets the full e-stepper reuse the sublanguage translation where the
syntax agrees. The second isolates the sublanguages completely. Decided in the parser issue;
extending is the default.

## The model

As in the §3/§4 e-stepper, a step shows a configuration ⟨P, Σ⟩: the program P, in which values are
primitives or references `#k` and bodies under evaluation are `EnvBlock(E, body)`, and the store Σ of
frames and heap objects. Names resolve by Python's LEGB rule, decided statically.

New heap objects:

| Object | Drawn as |
|---|---|
| tuple | a box-and-pointer row like a list, marked immutable |
| dict | a two-column table of keys and values |
| class | a box with the class's name, its attributes (methods are function objects) and an arrow to its base class |
| instance | a box with its attributes and an arrow to its class |
| bound method | a pair: the instance and the function |
| iterator | its source (a list, tuple, dict, `range`, …) and its position |
| generator | a suspended function call: its frame and the rest of its body |
| exception | an instance of an exception class, with its message |

New rules (sketches; the full table goes in the specification):

- **`for x in e`.** `e` is evaluated, then `iter(v)` is a step that allocates an iterator `#k`. The
  loop becomes `for x in #k`. Each iteration is a step `next(#k)`: if it gives a value, the program
  gets `x = value`, the body and the loop again; if it raises `StopIteration`, the loop disappears.
  For a list the iterator is "list `#3` at index 2"; the drawing shows the position.
- **Attribute lookup `o.a`.** One step: the value is found in the instance, else in its class, else
  in its base classes (method resolution order); the explanation says where ("Looked up deposit in
  class Account"). A function found in a class gives a bound method `#k`.
- **Method call `o.m(args)`.** `o.m` is looked up as above; calling the bound method is a call with
  `self` bound to the instance. Its frame extends the frame the class was defined in, not the class:
  class bodies are not enclosing scopes for methods.
- **`class C(B): body`.** The body runs in a frame of its own (drawn like a frame, labelled by the
  class), whose bindings become the class's attributes when the body ends; the class object `#k` is
  bound to `C`.
- **`raise e`** replaces the innermost statement by a *raising* marker that unwinds: each step
  removes the rest of the innermost block. `EnvBlock`s are removed one by one (their frames stay in
  the store), until a `try` whose `except` matches; `finally` blocks run on the way out.
- **Keyword arguments and defaults.** The call step binds the parameters as Python does; defaults
  are values stored with the function object (evaluated once, at `def`), which is why a mutable
  default is shared between calls, and the drawing shows it.
- **Generators.** Calling a generator function allocates a generator `#k` holding a new frame and
  the body. `next(#k)` runs the body in an `EnvBlock` until `yield v`; the rest of the body goes back
  into `#k` and the call gives `v`.

## Step granularity

Decided for the first slices: **the same granularity as the e-stepper for §3/§4**. Every name that is
not a built-in is looked up in a step of its own, left to right; every operator, call, assignment and
statement is a step; a built-in's name is looked up in the step that applies it (no drawn frame binds
it); a `while` loop unfolds into the textbook's `if`; a call of a function whose frame would have no
bindings runs in the frame that the function extends. Students who know the e-stepper from §3/§4 see
the same rules, and the display code of the host is the same.

The cost is long traces: a full Python program takes more steps than a §4 program of the same size.
That is for the step limit and, later, a *coarse* mode as a switch (lookups, `iter`/`next` of built-in
iterators and operators on built-in types part of the step that uses them) and perhaps statement-level
steps, as in Python Tutor. Neither changes the engine's rules; both are about what a host shows. To
be revisited with programs from the course, once the engine is connected to the playground.

The differences from §3/§4 follow from Python, and the engine does what CPython does:

- a condition is any value's truth value (`if []:`, `x or y` gives an operand), not a bool only;
- **no tail-call elimination**, as in CPython: a call in tail position keeps its caller's frame, and
  the depth of calls is limited to CPython's 1000 (`RecursionError`);
- a list is iterated live: `for x in xs` sees what the body appends to `xs`;
- `+=` on a list changes it in place and keeps its identity; on a number or a string it rebinds;
- **`is` on numbers and strings compares values.** CPython's answer depends on the implementation
  (small ints are shared and equal constants of a code object are merged, but `float(1) is float(1)`
  is `False`), and Python 3.8 and later warn about `is` with a literal. Lists, functions and ranges
  keep their identity. Giving every number and string an identity would show students distinctions
  that CPython does not promise; to be revisited if a course needs it.
- **a range longer than 10 million is not built as a list in one step**: `list(range(n))`, `min`,
  `+=` and the like stop with a `MemoryError` (CPython would try, and for lengths beyond an index
  raises `OverflowError`, which the engine does too). A `for` loop over any range is lazy.

## Decisions for the engine

These were open when the note was first written; the first slice of the engine
(`src/conductor/full-estepper/`) settles them.

1. **The engine has its own values, not the CSE machine's.** The §3/§4 e-stepper runs on the CSE
   machine's store (its environments, closures, values and operators), which keeps its results in
   line with the CSE machine by construction. For full Python that is the wrong reference: the CSE
   machine's operators encode the restrictions of the sublanguages (a list index must be a
   non-negative integer, `==` rejects booleans in §1/§2, a condition must be a bool, `//` and `%` are
   restricted), and it has no values for tuples, dictionaries, classes or iterators. The values
   (`values.ts`) are Python's: `int` (a `bigint`), `float`, `bool`, `str`, `None`, `list`, function
   objects, built-in functions and `range`, with the others to come. Objects with an identity (lists,
   function objects) are heap objects; the rest are compared by value.
2. **Operators and built-ins are CPython's, and the tests prove it.** `operators.ts` and
   `builtins.ts` implement Python's semantics: the floor division and modulo of negative numbers, the
   result of `int ** negative int`, `bool` as an `int`, mixed int/float comparison without rounding, `and`
   and `or` giving an operand, negative indices, `+=` on lists. `repr` writes floats as CPython does
   (`1e-05`, `1e+16`, `inf`), and refuses to turn an int of more than 4300 digits into a string, as
   CPython does. Where JavaScript's numbers are not CPython's, the engine does the arithmetic itself:
   true division of big ints is correctly rounded, `//` of floats follows CPython's algorithm (`1 // 0.1`
   is `9.0`), and an integer power of a float is computed exactly with `BigInt` and rounded once (the
   `**` of V8 and the C library that CPython uses differ in the last digit, as in `7 ** -2`). Not yet:
   complex numbers (a negative number to a fractional power stops with a `NotImplementedError`), and
   fractional powers are `Math.pow`'s, not exactly the C library's.
3. **The engine does its own static scoping** (`scope.ts`), by Python's rules, and does not reuse py-slang's
   resolver, whose scope handling is built around the sublanguages (and provisional for the new
   syntax). A name in a function body is local if the body assigns it or it is a parameter, unless
   `global` or `nonlocal` says otherwise; a function's frame has all its locals from the start,
   unassigned until assigned (`UnboundLocalError`); a free name is looked up in the enclosing function
   frames, whose static locals decide, then in the module frame, then in the built-ins; the module
   frame grows as names are assigned. CPython's compile-time errors (`return` outside a function, `break`
   outside a loop) are reported before anything runs.
4. **The step granularity** is that of §3/§4 (above).
5. **Unsupported constructs stop the program when they are reached**, with a `NotImplementedError` that
   names the construct ("The environment stepper does not support tuples yet"): output that comes
   before is kept, and a branch that is not taken does not matter. The syntax tree is translated to
   terms (`terms.ts`) in which what the engine does not do yet is an `unsupported` term.

## What the first slice has

The core of the engine, with no connection to the host yet: its trace is text.

| In the slice | Not yet |
|---|---|
| values: int, float, bool, str, None, list, function, built-in, range | tuples, dictionaries, sets, complex numbers, string and list methods |
| expressions: literals, names, unary and binary operators, comparisons (also `in` and `is`), `and`/`or`, conditional expressions, calls with positional arguments, `lambda`, list displays, subscripts | keyword arguments, defaults, `*args`, `**kwargs`, slices, comprehensions, chained comparisons, attributes |
| statements: expression, assignment (names and items), augmented assignment, `if`/`elif`/`else`, `while`, `for` over lists, strings and `range`, `def`, `return`, `pass`, `break`, `continue`, `global`, `nonlocal` | assignment to several names, `for` with unpacking, `class`, `try`, `raise`, `with`, `del`, `import`, `assert`, decorators |
| built-ins: `print`, `len`, `range`, `abs`, `min`, `max`, `str`, `repr`, `int`, `float`, `bool`, `list` | the rest of the SICP library and of Python's built-ins |
| a text trace (`runFullEStepper`, `formatTrace`), and `--engine full-estepper [--trace]` in the CLI | the protocol of the host's e-stepper tab, the evaluator `pythonFullEStepper`, garbage frames and objects, breakpoints |

## The code

| File | Contents |
|---|---|
| `values.ts` | the values, frames, `repr` and `str` |
| `operators.ts` | Python's operators, subscripts, iteration |
| `builtins.ts` | the built-in functions |
| `scope.ts` | static scoping; CPython's compile-time errors |
| `terms.ts` | the program terms, and the translation from the syntax tree |
| `store.ts` | frames, name lookup and assignment, labels (`Global`, `E1`, `#1`) |
| `engine.ts` | `Machine`: one contraction per `step()`, with its explanations |
| `text.ts` | terms and values as text |
| `run.ts` | `runFullEStepper` (the trace), `evaluate` (no trace, for the tests) |

## Architecture

| Repo | Work |
|---|---|
| py-slang | parser for full Python; the engine (`src/conductor/full-estepper/`); `PyFullEStepperEvaluator` bundle; differential tests against CPython in CI |
| plugins | `common-e-stepper`: the new heap object kinds; drawing them |
| frontend | the e-stepper draws with the host's CSE machine diagram (`CseSnapshot`): instances, classes, tuples, dicts, iterators and generators need to be drawn there |
| language-directory (source-academy and NUS-CS1101S) | the `pythonFullEStepper` evaluator with the `E_STEPPER` capability |
| py-slang docs | a guide for students, like [the e-stepper's](md/README_ESTEPPER.md) |

## Testing

- **Differential tests against CPython** (`src/tests/full-estepper/`): a corpus of programs
  (expressions, errors, statements, scoping, closures, recursion, errors of programs), each run by
  `python3` and by the engine; what it prints and the name of the exception that stops it (if any)
  must be the same. The messages of exceptions differ between versions of CPython and are not
  compared. The tests need `python3`, and skip themselves without it.
- **Random arithmetic**: expressions over ints, booleans and floats with every operator, evaluated by
  CPython (one process) and by the engine, 700 per seed; `FUZZ_SEEDS=150` runs 105,000 and found the
  differences that the arithmetic above works around.
- **Trace tests**: the explanations, the program after each step, the frames and heap objects of the
  `make_withdraw` example of the guide, frames that are not drawn, errors, the step limit, and what
  is not supported.
- Golden step sequences for the teaching examples of the later stages: a bank account class, an
  iterator class, a generator, a `try`/`finally`.
- The library of the course (`sourceacademy-sicp`, `python/`) as the reference for its functions
  when they are added.

## Plan

1. This design note.
2. py-slang: parser for full Python. Done (#562, #564, #565, #577).
3. py-slang: engine, stage 1, in slices:
   1. **the core** (the first slice, above): values, operators, scoping, the machine, a text trace,
      the differential tests;
   2. tuples, dictionaries and sets; keyword arguments, defaults, `*args`/`**kwargs`; slices and
      chained comparisons; string and list methods; complex numbers;
   3. the host: the protocol (`EStepperStep`: program, frames, heap, the store as a CSE machine
      snapshot), garbage, breakpoints, the evaluator `pythonFullEStepper`.
4. plugins, frontend: the new heap objects (tuple, dict first).
5. language-directory: `pythonFullEStepper` (both directories).
6. py-slang: stages 2, 3 and 4, each with the heap objects it needs.
7. Documentation for students.

## Open questions

- A *coarse* mode, or statement-level steps (see *Step granularity*), once there are programs of the
  course to try.
- How should a class's frame be drawn while its body runs, and the class object afterwards, so that
  students do not take the class for an enclosing scope of its methods?
- Strings: immutable objects or primitives in the drawing? (The CSE machine shows them inline.)
- How are the SICP library's functions provided: by the engine's built-ins, or by running the
  library's own Python code (`sourceacademy-sicp`) as ordinary steps?
- Fractional powers of floats exactly as the C library gives them, if it matters to anyone.
