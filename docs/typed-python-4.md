# Typed Python §4

Status: project plan. Phase 0 (language design) in progress: the specification draft is
`docs/specs/python_4_typed.tex` (with `python_4_typed_bnf.tex` and `python_static_typing.tex`).

## Goal

Add a new Source Academy language, **Typed Python §4**: Python §4 plus type annotations, checked
statically before the program runs. It is listed in the language directory next to Python §4, runs
SICPy §1–§4 programs once they are annotated, and reports type errors with line and column, like
any other Source error.

A type-correct Typed Python §4 program, with its annotations erased, is an ordinary Python §4
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
| `Any` | *Proposed:* not part of the language (not in the prelude, and no `typing` imports). With opaque syntax types for §4 (below), nothing in the prelude needs it. Names from a module without stubs are unchecked. |
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
       ├─ Typed Python checker client  ──postMessage──►  checker worker (pyright, ~4.7 MB, lazy)
       │     file system = Source builtins.pyi + prelude      └─ background analysis worker
       │                   + module stubs + program files
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
  names that an earlier chunk defined. The checker sees the same view: the client keeps each
  accepted chunk as `chunk_k.py`, and checks the next chunk with explicit imports,
  `from .chunk_k import a, _b, ...`, of every top-level name that an earlier chunk binds, each from
  the last chunk that binds it (py-slang's resolver lists a chunk's top-level names).
  `from .chunk_k import *` would not do: it skips names that start with `_`, such as `_cache`. A
  rejected chunk is not added. Caveat: a declared type (`x: int = 0`) does not carry over to
  assignments to `x` in later chunks, since an imported name can be rebound. If that matters, the
  client can repeat the declaration (`x: int`) in the next chunk's header.
* **Folder imports.** Local imports (`from .foo import x`, PR #379) map to files in the checker's
  file system. The client fetches them through the same `onRequestFile` path the engine already uses.
* **Positions.** The program text is passed to pyright unchanged, so its 0-based line and character
  map directly to Source's 1-based line and 0-based column.

## Phases

### Phase 0: language design (≈ 3 days)

Settle the rules in the table above and the §4 evaluator question, with the SICPy authors.
Output: this document, revised and merged, and a draft of the Typed Python §4 specification
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

Still to do: review of the rules and the specification with the SICPy authors, and a decision on
`Any`.

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

* `scripts/build-typecheck.ts`: from a pinned `browser-basedpyright` version, build the trimmed
  bundle (the spike's [`trim.cjs`](https://github.com/source-academy/py-slang/blob/cf51566dce91f69f40dfa2ee6dec84eec364b260/experiments/pyright-spike/trim.cjs) and [`closure.cjs`](https://github.com/source-academy/py-slang/blob/cf51566dce91f69f40dfa2ee6dec84eec364b260/experiments/pyright-spike/closure.cjs)) and the
  Source `builtins.pyi` and `types.pyi` ([`patch-builtins.cjs`](https://github.com/source-academy/py-slang/blob/cf51566dce91f69f40dfa2ee6dec84eec364b260/experiments/pyright-spike/patch-builtins.cjs),
  extended to remove builtins that Python §4 lacks). Both are build artifacts, not checked in.
* `src/typecheck/prelude.pyi`: the Source prelude stub (starting from the spike's
  [`__builtins__.pyi`](https://github.com/source-academy/py-slang/blob/cf51566dce91f69f40dfa2ee6dec84eec364b260/experiments/pyright-spike/prelude/__builtins__.pyi)), covering all of `linked-list`, `list`,
  `misc`, `math`, `pairmutator`, `stream` and `mce`. Use readable type-variable names (`H`, `T`,
  `A`, `B`) so messages don't show `_H@head`. Add a completeness test: every builtin that §4
  provides (from the stdlib groups) has a stub.
* `src/typecheck/client.ts`: the worker host from the spike ([`client.mjs`](https://github.com/source-academy/py-slang/blob/cf51566dce91f69f40dfa2ee6dec84eec364b260/experiments/pyright-spike/client.mjs) for Node,
  [`web/checker.js`](https://github.com/source-academy/py-slang/blob/cf51566dce91f69f40dfa2ee6dec84eec364b260/experiments/pyright-spike/web/checker.js) for browsers), plus the blob-URL loading, chunk
  accumulation, a timeout, and a `check(files): Diagnostic[]` API.
* Diagnostics: translate pyright messages into Source-style ones where they leak internals (for
  example, show `LList[int]` instead of the expanded `Pair[int, LList] | None`, and drop
  "Type parameter is invariant" lines). This is a table of rewrites, tested against a corpus.
* The `and`/`or` strict-bool rule: the left operand must be a `bool`. A py-slang pass over the
  AST that asks the checker for that operand's type (LSP hover). Defer it if it turns out to be
  costly; the dynamic check stays in any case.
* A py-slang validator that requires a return annotation on every `def`.
* `python/sicp`: define the type names `Pair` (a generic class), `LList`, `Stream` (PEP 695
  `type` aliases, which CPython evaluates lazily) and `Callable`, so that annotated programs run
  in CPython 3.13 and the parity harness covers Typed §4 programs. Students who run their programs
  with the `sourceacademy-sicp` package at home need this too.
* Tests: the spike's [corpus](https://github.com/source-academy/py-slang/tree/cf51566dce91f69f40dfa2ee6dec84eec364b260/experiments/pyright-spike/cases) moved to jest (Node shim), plus annotated versions of the Python §4 test
  programs. Requirements: no false positives on correct programs, and each planted error reported
  on the right line.

### Phase 3: the evaluator (≈ 1 week)

* `src/conductor/TypedPy2JsEvaluator.ts`: check, then run. Built as `TypedPy2JsEvaluator4` in
  `scripts/build.ts`, and the checker bundle is published next to it.
* Wiring: REPL chunks, folder imports, `input()`, and modules work as in Py2JsEvaluator4.
* Autocomplete: reuse `registerAutoCompletePlugin`. Later, pyright's own completions could be
  offered through it.
* Optional, later: a Typed §4 e-stepper evaluator (`PyEStepperEvaluator4` behind the same check).

### Phase 4: Source Academy module stubs (≈ 1 week)

Generate `.pyi` stubs (`typings/<module>/__init__.pyi`) for the modules from their TypeScript
declarations in the modules repository, mapping JS types to Python ones (`number` to `float`,
opaque module values such as `Rune` to opaque classes). Publish them with the modules, or vendor
them into the checker's file system. As a stop-gap, hand-write stubs for `rune`, `curve`, `sound`
and `binary_tree`. A module without a stub is typed as `Any` (pyright's own behaviour), with a
warning rather than an error.

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
      name: "Typed Python §4",
      textbook: { url: "https://sicp.sourceacademy.org/json_py/", name: "SICPy", route: "/sicpy",
                  titleImageUrl: "https://source-academy.github.io/sicp/sicpy.png" },
      documentation: { languageUrl: "https://docs.sourceacademy.org/python/python_4_typed/" },
      evaluators: [python4TypedPy2js],
      defaultFileExtension: "py",
      defaultProgram: "# Type your program in here!\n\n",
      welcome: "…",
  };
  ```

* Documentation: `README_4_typed.md` and a `run_jsdoc "Typed Python §4" … "python_4_typed"` entry
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

Typed Python §1–§3 are not planned.

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
  data". How many textbook programs need `Any` will show how good the type language is.
* **Bundle and memory.** 0.77 MB brotli is measured. Memory use per tab is not; measure it in
  phase 3, with two workers (foreground and background analysis). Running analysis in the
  foreground worker only would remove one of them.
* **Semantic drift between pyright and py-slang.** Pyright models CPython. Where py-slang differs
  (strict bool, missing builtins, number semantics), the Source `builtins.pyi` must follow
  py-slang. Add a test that runs every checked corpus program on py2js, so that a program the
  checker accepts never fails at run time with a type error the checker could have caught.
