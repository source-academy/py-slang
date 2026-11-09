# Python §4 Typed

Status: project plan. Phase 0 (language design) in progress: the specification draft is
`docs/specs/python_4_typed.tex` (with `python_4_typed_bnf.tex` and `python_static_typing.tex`).

## Goal

Add a new Source Academy language, **Python §4 Typed**: Python §4 plus type annotations, checked
statically before the program runs. It is listed in the language directory next to Python §4, runs
SICPy §1–§4 programs once they are annotated, and reports type errors with line and column, like
any other Source error.

A type-correct Python §4 Typed program, with its annotations erased, is an ordinary Python §4
program, and it behaves exactly as one. The type checker only accepts or rejects programs; it never
changes what they do. Annotated programs are also valid CPython 3.13, so the CPython parity harness
still applies, provided the `sicp` package defines the type names as well (`Pair`, `LList`,
`Stream`, and `Callable` re-exported from `typing`): CPython 3.13 evaluates a function's
annotations when the `def` runs, so a program that uses `LList[int]` fails with a `NameError`
without them. See phase 2.

## Approach: embed pyright, don't write a checker

The checker is [basedpyright](https://github.com/DetachHead/basedpyright) (an MIT-licensed fork of
pyright, the TypeScript checker behind Pylance), in its browser build `browser-basedpyright`. We
don't write our own type checker and don't port mypy.

The spike, kept on the branch `spike/pyright-typecheck` and not merged
([`experiments/pyright-spike/` at cf51566](https://github.com/source-academy/py-slang/tree/cf51566dce91f69f40dfa2ee6dec84eec364b260/experiments/pyright-spike), see its
[README](https://github.com/source-academy/py-slang/blob/cf51566dce91f69f40dfa2ee6dec84eec364b260/experiments/pyright-spike/README.md)), established:

* It runs unchanged in Chromium, Firefox and WebKit as a web worker with an in-memory file system,
  and under Node through a small `worker_threads` shim (for jest).
* The Source prelude can be declared in a stub file that pyright treats as part of builtins.
  Pairs are an opaque `Pair[H, T]`, linked lists are the recursive alias
  `LList[T] = Pair[T, LList[T]] | None`, and `Stream[T]` is defined the same way. Predicates such
  as `is_none` return `TypeIs[...]`, so `0 if is_none(xs) else head(xs)` narrows `xs`.
* Corpus results in `standard` mode: no false positives on four clean SICP-style programs
  (recursion, higher-order functions, linked lists, streams, `nonlocal`, loops, Python lists, pair
  mutation), and all 14 planted errors found.
* A patched `builtins.pyi` enforces most of Source's strict-bool rules: non-bool conditions in
  `if`/`while`/ternary/`not`, and `True + 1`. It misses only the left operand of `and`/`or`.
* With third-party stubs and unused stdlib stubs removed, the bundle is 4.7 MB raw, 1.0 MB gzip,
  0.77 MB brotli. Worker startup is 180–280 ms, the first check 210–330 ms, later checks 10–40 ms.

On unannotated code pyright finds little (parameters have the unknown type), which is why this is a
separate, annotated language and not an extra pass on Python §4.

## Language design

### What students write

```python
def length(xs: LList[int]) -> int:
    return 0 if is_none(xs) else 1 + length(tail(xs))

def map_llist[A, B](f: Callable[[A], B], xs: LList[A]) -> LList[B]:
    return None if is_none(xs) else pair(f(head(xs)), map_llist(f, tail(xs)))

def make_counter() -> Callable[[], int]:
    count: int = 0
    def inc() -> int:
        nonlocal count
        count = count + 1
        return count
    return inc
```

### Rules

Decided in phase 0 unless marked *proposed*. Each rule was tried on the spike's checker
(`npm run cases:typed` in the spike).

| Question | Decision |
|---|---|
| Must every `def` annotate parameters and return type? | Yes. Parameters: `reportMissingParameterType`. Return type: a py-slang validator, since pyright accepts `def f(x: int):`. |
| Lambdas | Unannotated (Python has no syntax for annotating lambdas). Their parameter types come from the context: an argument position with a function type (`map(lambda x: x + 1, xs)`), or a name with a declared type (`square: Callable[[int], int] = lambda x: x * x`). A lambda without such a context is an error (`reportUnknownLambdaType`, `reportUnknownParameterType`). |
| Variables | `x: T = e` declares `x`'s type; every assignment, also through `nonlocal`/`global`, must respect it. Without an annotation, `x` has at each use the type of the value assigned last (pyright's flow typing). An empty `[]` needs a declared type (`reportUnknownVariableType`, `reportUnknownArgumentType`). |
| Type syntax | `int`, `float`, `complex`, `str`, `bool`, `None`, `list[T]`, `Callable[[A, B], R]`, `Pair[H, T]`, `LList[T]`, `Stream[T]`, unions `A \| B`, generic functions in PEP 695 form (`def f[T](...)`), and type aliases (`type Rational = Pair[int, int]`, also generic and recursive: `type Tree[T] = Pair[T, LList[Tree[T]]]`). No `typing` imports needed. |
| `Any` | Decided: not part of the language. It is not a name (the prelude has it only as a private alias of its own); `from typing import …` is rejected by py-slang (`NoTypingImportsValidator`, with a message that says that types need no import), and an `Any` that gets in nevertheless is an error where it is used (`reportExplicitAny`). A function that works for any type has a type parameter. With opaque syntax types for §4 (below), nothing in the prelude needs it. Names from a module without stubs are unchecked. |
| `Pair` variance | Invariant, which is correct once `set_head`/`set_tail` exist. It makes some error messages longer. Consider a covariant `Pair` for a later Typed §2. |
| Pair indexing (`p[0]`) | A type error: pairs are not lists to the checker. Python §4 programs that index pairs must use `head`/`tail`. |
| `**` | Follows Python §4's operator table instead of typeshed's `Any`: `int ** int` is `int` for a non-negative literal exponent, `float` for a negative one, and `int \| float` otherwise; with a `float` operand (and no `complex`), `float`. So `def expt(b: int, n: int) -> int: return b ** n` is rejected (`expt(2, -1)` is `0.5`); declare `-> float` or use the recursive `expt`. |
| What a type error does | Blocks the run, as a syntax error does. All errors are reported, not just the first. |
| Checker strictness | basedpyright `standard` mode plus Source rules. `recommended`/`all` are too noisy for students. |

### Source rules on top of pyright

* **Strict bool**: ship a Source `builtins.pyi` where `int`, `float`, `complex`, `str`, `list`,
  `tuple` and `dict` have `__bool__ -> None`, and `bool` does not subclass `int`. So `True + 1`,
  `xs[True]` and `[0] * True` are errors, as in Python §4. `bool` keeps `<`, `<=`, `>`, `>=` with
  `int`/`float`, because Python §4 compares bools with numbers as 1 and 0
  (`docs/specs/python_typing_tail_34.tex`). Only the *left* operand of `and`/`or` must be a bool
  (`True and 4` is `4`); pyright does not check it, so that needs a small rule (see phase 2).
* **`**`**: the Source `builtins.pyi` also replaces typeshed's `Any` results of `int.__pow__` and
  `float.__pow__` (see the rules table).
* **Builtins**: only the Python §4 builtins and the Source prelude are in scope. Python builtins
  that Python §4 does not provide are removed from the Source `builtins.pyi`, so a name like
  `sorted` gives "not defined" instead of type-checking and then failing at run time.
* **Imports**: only Source Academy modules and local files resolve. The trimmed stdlib stubs make
  `import os` an error.

### The §4 evaluator (`mce`) and heterogeneous data

SICPy §4 represents programs as tagged linked lists, e.g. `llist("application", f, args)`, and
`parse` returns such lists. Under `LList[T]` these lists have mixed element types. Options:

1. `parse(s: str) -> Any`, and `Any` stays in the language: easy, but the evaluator chapter then
   gets little checking.
2. Opaque syntax types (`SyntaxTree`, with typed accessors `operator(e)`, `operands(e)`), matching
   the abstraction barriers SICPy builds anyway.
3. A recursive union alias for parse results.

**Decision: option 2.** The design of the syntax types and their accessors is a separate follow-up,
#631; until it is done, the specification leaves the types of `tokenize`, `parse` and
`apply_in_underlying_python` open.

## Architecture

```
frontend (unchanged)
  └─ evaluator worker: TypedPy2JsEvaluator4.js           (blob: URL, created by the frontend)
       ├─ py-slang parse + Python §4 validators            (annotations allowed)
       ├─ Python §4 Typed checker client  ──postMessage──►  checker worker (pyright, ~4.7 MB, lazy)
       │     file system = Source builtins.pyi + prelude      └─ background analysis worker
       │                   + stubs of the imported modules + program files
       └─ on no errors: Py2JsSession(variant 4) runs the program (annotations ignored)
```

* **Placement.** The checker lives in py-slang (`src/typecheck/`). The frontend and conductor stay
  language-agnostic: type errors reach the frontend through `conductor.sendError(new EvaluatorError(...))`
  with `line`/`column`, exactly like resolver errors.
* **Loading.** The frontend starts evaluators from `blob:` URLs
  (`frontend/src/commons/sagas/helpers/conductorEvaluatorCache.ts`), so the evaluator cannot start
  a cross-origin `new Worker(url)`. It fetches the checker bundle, published next to the evaluators
  on GitHub Pages (which sends `Access-Control-Allow-Origin: *`), and starts it from a `blob:` URL.
  The background-analysis worker that pyright asks for (`browser/newWorker`) is started from the
  same blob. Fetching begins when the evaluator starts, so the download overlaps with the student
  typing. The bundle is published as a separate file so that Python §4 users never download it.
* **REPL chunks.** `evaluateChunk` keeps one Py2JsSession across chunks, so a later chunk can use
  names that an earlier chunk defined. The checker sees the same view: `checkChunk` checks each
  accepted chunk as a file of its own, with imports of the names of the earlier ones (phase 2 has
  the details). A rejected chunk is not added.
* **Folder imports.** Local imports (`from .foo import x`, PR #379) map to files in the checker's
  file system. The client fetches them through the same `onRequestFile` path the engine already uses.
* **Positions.** The program text is passed to pyright unchanged, so its 0-based line and character
  map directly to Source's 1-based line and 0-based column.

## Phases

### Phase 0: language design (≈ 3 days)

Settle the rules in the table above and the §4 evaluator question, with the SICPy authors.
Output: this document, revised and merged, and a draft of the Python §4 Typed specification
(`docs/specs`, like the other chapters).

Done so far:

* The rules table, decided except where marked *proposed*. The §4 evaluator question: opaque
  syntax types (option 2), designed separately in #631.
* Specification draft: `docs/specs/python_4_typed.tex`, built with `make python_4_typed.pdf` in
  `docs/specs`. It is Python §4's specification with the grammar of annotations, type parameters,
  `type` aliases and types (`python_4_typed_bnf.tex`), and a new section "Static Type Checking"
  (`python_static_typing.tex`): types, assignability, annotations, generic functions and aliases,
  conditions and narrowing, operators, and the types of the predeclared functions.
* Phase 0 found that the spike's `builtins.pyi` patch was too strict (it rejected `True < 1`,
  which Python §4 allows) and that pyright's `**` on two `int`s is `Any`. Both are fixed in
  the spike's [`patch-builtins.cjs`](https://github.com/source-academy/py-slang/blob/cf51566dce91f69f40dfa2ee6dec84eec364b260/experiments/pyright-spike/patch-builtins.cjs), and the rules table records them.

Still to do: review of the rules and the specification with the SICPy authors. (`Any` is decided:
there is none.)

### Phase 1: annotations in py-slang's parser (≈ 3–4 days)

Done. What was built, and where it differs from the first sketch:

* Grammar (`src/parser/python.ne`): parameter annotations (`name: T`, `name: T = default`,
  `*name: T`, `**name: T`) for `def` only, return annotations (`-> T`; `->` is now one token in the
  lexer), type parameters (`def f[T](...)`), and `type X[T] = ...` statements, as in
  `docs/specs/python_4_typed_bnf.tex`. `type` stays a soft keyword (`type = 1` is an assignment).
  A subscript with several items (`Callable[[int], int]`, `Pair[int, int]`) is a subscript with a
  tuple as its index, as in Python; the sublanguages still reject tuples in a program. The
  parameters of a lambda cannot be annotated, as in Python.
* AST (`src/ast-types.ts`, generated by `src/generate.ts`): optional `annotation` on
  `FunctionParam`; `returns` and `typeParams` on `FunctionDef`; a new `TypeAlias` statement. The
  engines need no change for annotations, but the new statement needed a `visitTypeAliasStmt` in
  every visitor (the resolver does not look at types; the PVML and wasm compilers refuse it) and an
  entry in the CSE machine's list of statements that it does not evaluate.
* Validators: not a flag on the chapters, as first sketched. Python §1–§4 reject the new syntax
  (`NoTypeAnnotationsValidator`, with the existing `NoAnnAssignValidator`). Typed §4 has its own
  rules (`makeTypedChapter4Validators`: every `def` annotates its parameters and return type, and a
  declaration needs a value), which run on the parsed program with `traverseAST`, because the
  Resolver would look up the names in annotations (`LList`, `Callable`), which are not values.
  `prepareTypedProgram` (`src/typecheck/`) checks the rules and then erases the types
  (`eraseTypes`: annotated assignments become assignments, `type` statements become `pass`), and the
  result goes through the usual §4 pipeline.
* `parse()` (the §4 builtin) and the full e-stepper reject the new syntax with a clear message
  instead of dropping it, as before, when it was a syntax error. (The full e-stepper cannot run it
  until it evaluates annotations as CPython does.)
* Tests (`src/tests/typed-python.test.ts`): parsing, rejection in §1–§4, the typed rules, erasure,
  and the same output with and without types on the CSE machine, py2js and PVML in the browser.

**For phase 3.** The engines' entry points (`runCode`, `Py2JsSession.runChunk`,
`runCodePvmlInterpreter`) take source text and parse it themselves, so there is no place to call
`prepareTypedProgram` between parsing and running. The tests wrap `parse` for that. The evaluator
needs a real hook after parsing (for example an option of the session that takes the parsed
program), and that is the first thing to design in phase 3.

### Phase 2: the checker package `src/typecheck/` (≈ 1.5 weeks)

Done. What was built, and where it differs from the first sketch:

* **Build** (`scripts/build-typecheck.ts`, `yarn build:typecheck`; the code is in
  `src/typecheck/bundler/`): `dist/TypedPy4Checker.js`, 4.7 MB (1.0 MB gzip, 0.77 MB brotli), one
  self-contained file. It is pyright's worker with the third-party stubs and all but 59 standard
  library stubs removed, and with Source Python's `builtins.pyi` and `types.pyi`, the prelude and the
  configuration baked in: a host starts it and sends programs, and there is nothing else to load.
  `browser-basedpyright` is pinned (1.40.2) as a dev dependency; its polyfill dependencies add
  about 90 packages to `yarn.lock`, which the worker does not need. Each change to typeshed's files
  checks that typeshed has the shape that it expects, and fails the build, saying what to update, if
  a newer typeshed does not. The worker is rebuilt when one of its sources changes (a stamp at the
  end of the file); the tests build it when needed, and a lock lets test files that run at the same
  time wait for one build.
* **No removal of builtins.** The sketch had the Source `builtins.pyi` lose the builtins that §4
  lacks. That is not needed: the Resolver rejects a name that §4 does not have, so a program that
  uses `sorted` is rejected whether or not the checker knows it. (Which comes first, the Resolver
  or the checker, is for phase 3.)
* **Prelude** (`src/typecheck/prelude.pyi`): every name of §4 but `tokenize`, `parse` and
  `apply_in_underlying_python`, whose types wait for #631. The names that typeshed has (`print`,
  `len`, `abs`, `max`, `min`, `round`, `input`, `repr`, `str`, `complex`) keep its types. The
  functions are generic in the PEP 695 form, so that messages say `H@head` and not `_H@head`;
  `Pair` is a classic class with invariant type parameters (PEP 695 would infer the variance).
  A test checks that every name of §4 is known to the checker and that the prelude declares no name
  that §4 lacks.
* **Client** (`client.ts`, `checker.ts`): `PyrightClient` speaks the language server protocol with
  the worker (it boots the worker and starts the second worker that pyright asks for);
  `TypedPythonChecker` has `check(source)` for a program and `checkChunk(source)` for a REPL chunk,
  and returns `TypeDiagnostic`s: line from 1 and column from 0, severity, the message for the
  student, the rule, and pyright's own message. A browser starts the worker with `new Worker(url)`;
  Node (the tests, a command line) with `nodeWorkerFactory`. Two things differ from the spike. A
  file that is checked again is closed and opened, which takes 10–25 ms, and not changed, which makes
  the server wait a quarter of a second. And the answer for a file is found from what the server
  publishes. The server analyzes in batches and publishes the files of each batch, so a file can be
  published once, before the end of the analysis, or first with what it has found so far and again
  after the end (`pyright/endProgress`), and which of the two happens depends on how fast the
  processor is: a first version of the client expected the second, and hung on the busy runner of
  CI. What is certain is that the server sends what it publishes at the end in the same turn as the
  end, and that it handles what it receives one at a time, in order. So the answer is the latest
  publication for the version of the file once the analysis has ended and the server has answered a
  request that was sent after the end (any request: it is a barrier). `src/tests/typecheck-protocol.test.ts`
  plays each order of messages with a scripted server. (The other way, asking for the diagnostics
  with `textDocument/diagnostic`, works under Node, but in Chromium, Firefox and WebKit the server
  did not answer; the cause was not found.) Checks run one at
  a time and time out after 30 s.
* **REPL chunks** (`checkChunk`): as sketched, a file for each chunk with imports of the names of
  the earlier ones, and a better result than the caveat of the sketch: the functions and types that a
  chunk defines are not imported (the old one would win in later chunks), a variable that a chunk
  only assigns is (`count = count + 1`), a declared type carries over (the old value is imported
  under a private name and the variable is declared again with the same annotation, so that
  `count = "many"` is an error), and names that start with an underscore, type aliases, loop
  variables and `global` names work. Lines in diagnostics are lines of the chunk.
* **Messages** (`messages.ts`, `diagnostics.ts`): `Literal['five']` is shown as `str`; `H@head` as
  `H`; `Pair[int, LList] | None` as `LList[int]`; the second line of detail is left out; and the
  mistakes that students make most have messages of their own (a wrong argument, `if 1:`,
  indexing a pair, a type that cannot be determined), with a hint when the value can be `None`
  (`head(xs)` for a linked list: "test for that first, for example with is_none(...)"). The unknown
  types that follow from another mistake on the same line are left out. Each rewrite has an example
  in `src/tests/typecheck-messages.test.ts`.
* **Configuration** (`config.ts`): `standard` mode, the unknown-type rules as errors,
  `reportRedeclaration` off (a name can be defined again in §3 and §4) and `reportUnusedExpression`
  off (`1 + 2` in a REPL).
* **Not done, and documented:** the rule that the left operand of `and` and `or` must be a `bool`.
  Pyright has no rule for it, and typeshed cannot be patched to give one (`and` calls no method of the
  operand's type that could be changed: making `__bool__` an error is what rejects `if 1:`, and it has
  no effect on `and`), so `3 and 4` has no static error and is rejected when it runs, which the
  specification says ("Static Type Checking") and a test shows. Only a workaround outside pyright could
  check it: py-slang asking for the type of each such operand (hover requests, which may meet the
  problem of the browsers that `textDocument/diagnostic` had), rewriting the text that pyright sees
  (which moves columns), or changing pyright's checker in the bundle (fragile); none is worth it while
  the dynamic check stays.
* **`python/sicp`:** the type names `Pair`, `LList`, `Stream` and `Callable`, as aliases of `typing`
  (not `type` statements, because the package supports Python 3.10), so that annotated programs run
  in CPython. This also fixed a mistake in the package that typed programs show: `from sicp import *`
  bound `list` and `math` to the package's submodules, which hid Python's own `list` (`list[int]`
  failed); the package now has an `__all__`. The version of the package is not changed here: a
  release is a separate decision.
* **Tests:** `src/tests/typecheck-*.test.ts`. Programs in `src/tests/typecheck-cases/` (a line that
  ends with `# ERROR: text` must have an error with that text, the other lines none): errors,
  the rules of §4 that differ from Python, unknown types, `**`, and eight correct programs of
  the kind that SICP has (recursion, linked lists, streams, higher-order functions, sorting, state)
  with no false positive. The correct programs also satisfy the typed rules of py-slang, run on the
  CSE machine and py2js with the same output, and with `CPYTHON_PATH` set (Python 3.12 or later)
  print the same under CPython.

  The browsers are not part of the tests (that needs Playwright). They were tried by hand, with the
  client bundled as an evaluator would be and the worker started with `new Worker(url)`: Chromium
  153, Firefox 155 and WebKit 26.6 give the same diagnostics and chunks as Node, with the worker
  starting in 160–230 ms, the first check taking 250–365 ms and the next ones 10–25 ms. That check
  found that asking for diagnostics (see the client) does not work in a browser; the Node host
  of the tests is also given no `SharedArrayBuffer`, as a page that is not cross-origin isolated has
  none.

### Phase 3: the evaluators (≈ 1 week)

Done, for three engines. What was built, and the decisions on the way:

* **The type checker runs with whichever engine the student chooses.** `TypedPy2JsEvaluator4`,
  `TypedPyCseEvaluator4` and `TypedPyEStepperEvaluator4` (`src/conductor/`, built as evaluators by
  `scripts/build.ts`): each parses a chunk, checks it, and hands the engine a chunk of Python §4.
  The engines are those of Python §4, unchanged.
* **The check is a step of validation, but not a `FeatureValidator`.** It sits where each engine
  already validates, right after parsing and before the engine's own checks (the Resolver in py2js,
  `analyze` in the CSE machine, `checkEStepperProgram` in the stepper). It cannot be one of the
  validators that the Resolver runs: those are synchronous and look at one node at a time, and the
  checker is asynchronous (a worker), looks at the whole text, and keeps what it has seen from chunk
  to chunk. The rules of Typed §4 on annotations (`makeTypedChapter4Validators`) are validators, and
  they run first. Each engine takes the step as an option, `beforeValidation` (the session of py2js,
  the base classes of the CSE machine and the stepper), which is called with the text and the parsed
  program of each chunk (never with a group's prelude, which is Python §4 already), may throw, and
  may change the program; `checkTypedChunk` is the one function that all three call.
* **In order**: the rules of Typed §4 on annotations (the first violation is reported); the checker,
  with the text as written (all its errors are reported, with line and column; warnings and hints
  do not stop a program); the erasure of the types; then the engine's own validation, which rejects
  the names that §4 lacks. A program that is not checked is not run: if the checker cannot be
  started (a network error), the chunk is rejected with that said, and the next run tries again.
* **The session: a chunk is proposed, and accepted when the engine accepts it.** The checker
  remembers the chunks of a REPL session (their names and declared types), but the types are not the
  only thing that can reject a chunk: the Resolver rejects a name that Python §4 lacks, such as
  `sorted`, after the types are checked. So `checkChunk` is split: `proposeChunk` checks and remembers
  nothing, and the engine calls the function that `beforeValidation` returns once the chunk has passed
  its own validation (py2js after the Resolver, the CSE machine after `analyze`). Otherwise a chunk
  that never ran would leave `xs: list[int]` behind, and a later `xs = ["a"]` would be wrongly
  rejected. The environment stepper has no session (it steps each program from the start), so it
  checks each program on its own (`checkTypedProgram`, `check`), and does not know the names of an
  earlier program, as the stepper does not.
* **A checker that fails is replaced.** If the worker dies or a check times out, that run is rejected
  (`TypeCheckerUnavailableError`) and the checker is dropped; the next run starts another, which
  `LazyChecker` tells the chunks that were accepted, so that the names of the earlier chunks are
  still known.
* **Reporting.** py2js and the stepper send each error with its `line` and `column` and the type
  `EVALUATOR_TYPE`; the CSE machine can say where an error is only in its message, so a type error
  there has the line of the program and what is wrong marked, as its other errors do. Program texts
  are the student's, with the annotations: the engines' error spans and the stepper's text are of
  the typed text, because erasing a type removes nodes and moves none.
* **Starting the checker.** `LazyChecker` fetches `TypedPy4Checker.js` (published next to the
  evaluators) and starts it as a worker from a `blob:` URL when it is first needed, and starts that
  at once when the evaluator is made, so that it loads while the student types. It was tried in
  Chromium, Firefox and WebKit from inside a web worker that was itself started from a `blob:` URL,
  with the script on another origin: it works, and the first check, with the fetch, takes 400–600
  ms. `yarn build` builds the checker (`yarn build:typecheck`), and what `yarn build --all` makes is
  what is deployed.
* **Tests**: `typecheck-evaluator.test.ts` (py2js: running, every error, the rules, REPL chunks, a
  file, hints, run-time errors, a checker that cannot be started) and `typecheck-engines.test.ts`
  (the CSE machine and the stepper: running or stepping, the message and the line and column of an
  error, every error, REPL chunks, the erased program that the stepper gets).
* **Not done**: autocomplete from pyright; and local imports (`from .foo import x`) are checked as
  the flattened text that py2js makes of them, so a type error in an imported file is reported with
  a line of that text, as the other errors of such a program are. Both could be better later.

Carried over to the later phases:

* A program that imports a Source Academy module (`from rune import heart`) is an error for the
  checker until the module has a description of its types (phase 4): pyright cannot resolve the import. Phase 4 comes
  before the language is released.
* The language-directory entry (phase 5) lists the three evaluators of the language: py2js, the CSE
  machine (capability `CSE`) and the environment stepper (capability `E_STEPPER`).

### Phase 4: the types of the Source Academy modules (≈ 1 week, and more as modules are described)

The problem: a program that imports a module (`from rune import show`) cannot be checked, because
the module is loaded at run time and the checker sees only the text. Today such a program is rejected.

The decision: **modules are language-agnostic, so their types are described once, in a language-neutral
form, and each typed language maps that description to its own types.** The alternative, a stub file
for each module in each typed language, grows with modules × languages and drifts from the modules.
The design question is open in [source-academy/modules#996](https://github.com/source-academy/modules/issues/996).

* **The description** (in the `modules` repository, published with each version of a module, next to
  its manifest): for each export, its name and type, in the conductor's `DataType` vocabulary
  (`void`, `boolean`, `number`, `integer`, `string`, `pair`, `list`, `array`, `closure`, `opaque`)
  extended with what the vocabulary lacks: named opaque types (a rune is not a curve), function types
  (so that a callback is described), and the element types of lists, pairs and arrays. A conductor
  module already declares a `{ args, returnType }` signature for each method
  (`attachModuleMethod`), so a description can be generated from those and made more precise by
  hand; a consumer cannot read these signatures today.
* **The mapper** (py-slang, `src/typecheck/`): turns a description into the text of a Python stub:
  an opaque type is a class, a function type is `Callable`, a list is `LList[T]`, a pair is
  `Pair[A, B]`, an array is `list[T]`, `number` is `float` and `integer` is `int` (an `int` is
  accepted where a `float` is wanted). The stub is a file of the checker's file system, for each
  module that a program imports (`checker.ts` already has files for the chunks of a session).
* **Loading**: before a chunk is checked, the evaluator fetches the description of each module that it
  imports, as it fetches the module, and gives the stubs to the checker. A module with no description
  is an error (there is no `Any` to give its names a type).
* **Until descriptions exist**: a few hand-written stubs for the most used modules (`rune`, `curve`,
  `sound`, `binary_tree`), in py-slang and marked as temporary, removed as the descriptions arrive.
* **Backward compatible**: nothing changes for existing languages and bundles.
  * A description is a new, optional file next to `index.js` and `docs.json`; the build tools of the
    `modules` repository read manifests by key and reject no extra field or file.
  * `attachModuleMethod(Class, name, args, returnType)` keeps working; richer type information is kept
    apart from `method.signature`, which the runner and host read (`closure_arity`, `closure_is_vararg`).
  * `DataType` is not extended in the first version: that is the one change that could make an old host
    and a new module disagree.
  * A description has a `version`; the mapper rejects an unknown version or kind with a clear message.
  * A module without a description cannot be imported from a typed language, and nothing else changes.
* **A second source**: a bundle's `dist/docs.json` is TypeDoc JSON with the full TypeScript signatures,
  including the shapes that a module exports dynamically (`rune`'s `heart`). It describes the TypeScript
  API, not the conductor-level surface that Python sees, so it is compared with the hand-written
  description on `rune` before it is relied on.
* **Open**, and for the issue above: the format and who defines it (the modules or the conductor);
  whether `DataType` itself gets the new distinctions (later, with a version); and how much can be
  generated (from `attachModuleMethod` calls, or from `docs.json`).

**Done so far (first part of phase 4):**

* `src/typecheck/module-description.ts`: the description format (version 1: `number`, `integer`, `string`,
  `boolean`, `void`, opaque types, `list`, `pair`, `array`, `function`) and `toStub`, the mapper to a Python
  stub. An unknown version or kind is rejected with a message that says so.
* The checker gives the stub of each module that a program imports (`from rune import show`) to pyright as
  `rune.pyi`, once, for checks and for REPL chunks. A module with no description is the error "The module
  X cannot be imported: its types are not known to Python §4 Typed".
* `src/typecheck/modules/`: the temporary description of `rune`. `curve`, `sound` and `binary_tree` follow,
  and all of them go when the modules publish their own descriptions (modules#996).
* Not yet: fetching a published description at run time (needs the format agreed in modules#996).

### Phase 5: language directory, documentation, release (≈ 3 days)

* language-directory: add `src/languages/python/python4Typed.ts` and register it in
  `src/languages/python/index.ts`. Sketch:

  ```ts
  const python4TypedPy2js: IEvaluatorDefinition = {
      id: "python4TypedPy2js",
      name: "py2js",
      path: "https://source-academy.github.io/py-slang/TypedPy2JsEvaluator4.js",
      capabilities: [],
  };

  export const python4TypedLanguage: ILanguageDefinition = {
      id: "python4Typed",
      name: "Python §4 Typed",
      textbook: { url: "https://sicp.sourceacademy.org/json_py/", name: "SICPy", route: "/sicpy",
                  titleImageUrl: "https://source-academy.github.io/sicp/sicpy.png" },
      documentation: { languageUrl: "https://docs.sourceacademy.org/python/python_4_typed/" },
      evaluators: [python4TypedPy2js],
      defaultFileExtension: "py",
      defaultProgram: "# Type your program in here!\n\n",
      welcome: "…",
  };
  ```

* Documentation: `README_4_typed.md` and a `run_jsdoc "Python §4 Typed" … "python_4_typed"` entry
  in `scripts/jsdoc.sh`, with a page on the type language (`Pair`, `LList`, `Stream`, `Callable`,
  generics) and the specification in `docs/specs`.
* Frontend: no changes are expected, since languages come from the directory. Check this against
  the frontend's chapter/variant handling for Python before release.
* Release: py-slang minor version, then language-directory, then a frontend bump of the directory
  through its lockfile (no floating versions).

### Later (not in this project)

* **Squiggles while typing.** This needs a conductor feature that sends diagnostics to the host
  without running the program, and a frontend editor plugin. The checker already supports it;
  frontend and conductor work is needed.
* **Full Python with types**: #632. Use the full typeshed bundle and CPython's builtins,
  together with the Pyodide evaluator.

Python §1–§3 Typed are not planned.

## Effort

About **5–6 weeks** for one experienced developer: phase 0, 3 days; phase 1, 3–4 days; phase 2,
1.5 weeks; phase 3, 1 week; phase 4, 1 week; phase 5, 3 days. Phase 4 can run in parallel with
phases 2 and 3.

## Risks and open questions

* **Upstream.** browser-basedpyright is a side build of a fork with one main maintainer, and its
  README says it may not work outside the basedpyright playground. Mitigation: pin the version and
  publish the trimmed bundle ourselves (a single self-contained file). Fallback: build our own
  browser bundle from upstream pyright, following microbit-foundation's fork, which the browser
  build came from.
* **Two pictures of a pair.** Types show `Pair[int, int]`, while printing shows `[1, 2]`. Either
  explain this in the documentation or change how pairs print (a separate decision that affects
  all engines).
* **Message quality** decides whether students find this useful. Budget time for the rewrite table,
  and try it with students before release.
* **SICPy §4 code** (the evaluator chapter): see "The §4 evaluator (`mce`) and heterogeneous
  data". With no `Any`, the syntax types of #631 have to be enough for the evaluator chapter.
* **Bundle and memory.** The worker is 4.7 MB (0.77 MB brotli), built into `dist/`. Memory use per
  tab is not measured; measure it in phase 3, with two workers (foreground and background
  analysis). Running analysis in the foreground worker only would remove one of them.
* **Semantic drift between pyright and py-slang.** Pyright models CPython. Where py-slang differs
  (strict bool, missing builtins, number semantics), the Source `builtins.pyi` must follow
  py-slang. `src/tests/typecheck-run.test.ts` runs every correct program of the corpus on the CSE
  machine and py2js (and, with `CPYTHON_PATH`, under CPython), so that a program that the checker
  accepts does not fail at run time with an error that the types should have prevented. The corpus
  has to grow with the language.
