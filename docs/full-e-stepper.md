# The environment stepper for full Python ("full e-stepper")

Status: design note, draft. Tracking project: **full-e-stepper** (source-academy GitHub organization).
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

The §3/§4 e-stepper looks up every name in a step of its own. With attribute lookups, iterator
calls and dunder methods, full Python programs would take many more steps. Options:

- the same granularity as §3/§4, with a step limit;
- a *coarse* mode, the default, in which lookups, `iter`/`next` of built-in iterators and
  operators on built-in types are part of the step that uses them, and a *fine* mode as in §3/§4;
- statement-level steps (as in Python Tutor), with the program shown and the current statement
  highlighted, not rewritten.

To be decided after stage 1, with programs from the course.

## Architecture

| Repo | Work |
|---|---|
| py-slang | parser for full Python; the engine (`src/conductor/full-estepper/`); `PyFullEStepperEvaluator` bundle; differential tests against CPython in CI |
| plugins | `common-e-stepper`: the new heap object kinds; drawing them |
| frontend | the e-stepper draws with the host's CSE machine diagram (`CseSnapshot`): instances, classes, tuples, dicts, iterators and generators need to be drawn there |
| language-directory (source-academy and NUS-CS1101S) | the `pythonFullEStepper` evaluator with the `E_STEPPER` capability |
| py-slang docs | a guide for students, like [the e-stepper's](md/README_ESTEPPER.md) |

## Testing

- Unit tests per rule, on small programs.
- **Differential tests against CPython**: for every program in the corpus, the engine's output and
  the kind of exception (if any) equal those of `python3` running the same program with the SICP
  library predeclared, from `sourceacademy-sicp` (`python/`), the package that the full Python
  evaluator loads into Pyodide. CI installs CPython and that package, as the `python-package`
  workflow already does for the package's own tests.
- Golden step sequences for the teaching examples: a bank account class, an iterator class, a
  generator, a `try`/`finally`.

## Plan

1. This design note.
2. py-slang: parser for full Python (stage 1 syntax, then the rest).
3. py-slang: engine, stage 1, with evaluator and differential tests.
4. plugins, frontend: the new heap objects (tuple, dict first).
5. language-directory: `pythonFullEStepper` (both directories).
6. py-slang: stages 2, 3 and 4, each with the heap objects it needs.
7. Documentation for students.

## Open questions

- Step granularity (above).
- Parser: extend py-slang's grammar, or a separate one?
- How should a class's frame be drawn while its body runs, and the class object afterwards, so that
  students do not take the class for an enclosing scope of its methods?
- Strings: immutable objects or primitives in the drawing? (The CSE machine shows them inline.)
- Which built-in functions and methods are in stage 1, and what does the e-stepper show for one that
  is not supported?
