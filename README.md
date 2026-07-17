# Python variant for SICP

## What is py-slang?

`py-slang` is a Python implementation developed specifically for the Source Academy online learning environment. Unlike previous versions where Python was treated as a subset within [js-slang](https://github.com/source-academy/js-slang), py-slang now stands as an independent language implementation. It features its own parser, csemachine, and runtime, designed to process a tailored subset of Python for educational purposes.

It contains multiple [engines](https://github.com/source-academy/py-slang/tree/main/src/engines) including the CSE machine, a WASM compiler and a PVML compiler.

## Usage

To create a production build, run

```shell
# prompts for the evaluator to build
yarn build

# OR

# specifies the evaluator to build (list given below)
yarn build --evaluator PyCseEvaluator1

# OR

# builds all evaluators
yarn build --all
```

For development builds, run

```shell
yarn dev

# OR

yarn dev --evaluator PyCseEvaluator1

# OR

yarn dev --all
```

The difference between `yarn build` and `yarn dev` is that `yarn dev` enters [watch mode](https://rollupjs.org/command-line-interface/#w-watch) after building the initial changes. It monitors source files for any changes and automatically rebuilds only affected code when files are modified, making builds much faster during development.

In either case, the evaluator is compiled to `dist/<evaluatorName>.js` and `dist/<evaluatorName>.cjs`.

### List of evaluators

| Name                                                                                                                                             | Description                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [PyCseEvaluator1](https://github.com/source-academy/py-slang/blob/36351039fcd1f6dfbac3df10bf1ef084a44f029b/src/conductor/PyCseEvaluator.ts#L95)  | Interprets Python §1 programs using the CSE machine                                                                                                                                                                                                                                       |
| [PyCseEvaluator2](https://github.com/source-academy/py-slang/blob/36351039fcd1f6dfbac3df10bf1ef084a44f029b/src/conductor/PyCseEvaluator.ts#L101) | Interprets Python §2 programs using the CSE machine                                                                                                                                                                                                                                       |
| [PyCseEvaluator3](https://github.com/source-academy/py-slang/blob/36351039fcd1f6dfbac3df10bf1ef084a44f029b/src/conductor/PyCseEvaluator.ts#L107) | Interprets Python §3 programs using the CSE machine                                                                                                                                                                                                                                       |
| [PyCseEvaluator4](https://github.com/source-academy/py-slang/blob/36351039fcd1f6dfbac3df10bf1ef084a44f029b/src/conductor/PyCseEvaluator.ts#L113) | Interprets Python §4 programs using the CSE machine                                                                                                                                                                                                                                       |
| [PyWasmEvaluator](https://github.com/source-academy/py-slang/tree/main/src/conductor/PyWasmEvaluator.ts)                                         | Compiles Python §4 programs into WebAssembly and runs it                                                                                                                                                                                                                                  |
| [PyPvmlEvaluator1](https://github.com/source-academy/py-slang/tree/main/src/conductor/PyPvmlEvaluator.ts)                                        | Compiles Python §1 programs to PVML bytecode and runs them on a handwritten, pure-TypeScript compiler/interpreter ("PVML-in-browser") — no WASM, no native binary                                                                                                                         |
| [PyPvmlEvaluator2](https://github.com/source-academy/py-slang/tree/main/src/conductor/PyPvmlEvaluator.ts)                                        | Same as `PyPvmlEvaluator1`, for Python §2                                                                                                                                                                                                                                                 |
| [PyPvmlEvaluator3](https://github.com/source-academy/py-slang/tree/main/src/conductor/PyPvmlEvaluator.ts)                                        | Same as `PyPvmlEvaluator1`, for Python §3                                                                                                                                                                                                                                                 |
| [PyPvmlEvaluator4](https://github.com/source-academy/py-slang/tree/main/src/conductor/PyPvmlEvaluator.ts)                                        | Same as `PyPvmlEvaluator1`, for Python §4. `PyPvmlEvaluator` is a deprecated alias for this one, kept for existing callers                                                                                                                                                                |
| [PyPvmlPynterEvaluator](https://github.com/source-academy/py-slang/tree/main/src/conductor/PyPvmlPynterEvaluator.ts)                             | Compiles Python §3 programs with the same PVML compiler as `PyPvmlEvaluator1..4`, but runs them on the WebAssembly port of [Sinter](https://github.com/source-academy/sinter)/Pynter instead. Currently only wires up the `misc` and `math` stdlib groups, unlike the other PVML pathways |

### Using the evaluators

Refer to the [Conductor's Quick Start Guide](https://github.com/source-academy/conductor?tab=readme-ov-file#quick-start-guide)

### Using your py-slang in your local Source Academy

A common issue when developing modifications to py-slang is how to test it using your own local frontend. Unlike [js-slang](https://github.com/source-academy/js-slang), py-slang isn't a build-time npm dependency of the frontend — it's loaded at runtime as a Conductor evaluator bundle, resolved via a URL from the [Language Directory](https://github.com/source-academy/language-directory).

First, build the evaluator you want to test (or run it in watch mode using yarn dev) and serve it locally, e.g.:

```shell
yarn build --evaluator PyCseEvaluator4
## OR
yarn dev --evaluator PyCseEvaluator4
npx http-server dist -p 4001 --cors
```

This serves the built bundle at `http://localhost:4001/PyCseEvaluator4.js`. Then run your own local copy of the [Language Directory](https://github.com/source-academy/language-directory) with the relevant Python evaluator's `path` pointed at that URL instead of the deployed one, and configure your local frontend to use it — see the Language Directory's [Local testing](https://github.com/source-academy/language-directory#local-testing) instructions for how to wire this up.

### Running the Wasm evaluator locally

To run the Wasm compiler locally, run

```shell
yarn wasm <path to python file>
```

### Running the standalone CLI (repl)

`py-slang` can also be run as a standalone CLI, outside of Conductor, via `src/repl.ts`. It supports three engines, selected with `-e`/`--engine` (or the `PY_SLANG_ENGINE` environment variable — an explicit `--engine` flag takes precedence over it):

```shell
yarn build:repl
yarn repl <path to python file> [-v <1-4>]                       # cse (default): the tree-walking CSE machine
yarn repl <path to python file> --engine pvml-browser [-v <1-4>] # PVML bytecode on PVMLInterpreter, pure TypeScript
yarn repl <path to python file> --engine pvml --pynter <path> -v 3 # PVML bytecode on a native Pynter binary
```

`--engine pvml-browser` compiles the file to PVML bytecode and runs it directly on `PVMLInterpreter` — the same pure-TypeScript, no-native-binary-required VM `PyPvmlEvaluator1..4` use in the Conductor pathway (see the evaluator table above). It supports all four SICPy chapters, the same stdlib groups as the CSE machine at each chapter (`VARIANT_GROUPS` in `src/runner.ts`), and — like the other two engines — proper tail-call optimization (see below).

`--engine pvml` instead compiles the file to PVML bytecode and runs it on a native [Pynter](https://github.com/source-academy/pynter) `runner` binary — the same compiler as `--engine pvml-browser`, but executed by a native C VM instead of the TypeScript interpreter. Pynter is a fork of [Sinter](https://github.com/source-academy/sinter), kept as a separate sister project so that giving the native VM Python-specific semantics doesn't risk destabilizing Sinter, which remains the fallback engine for the Source curriculum. This requires building `runner` from the Pynter repo separately (see its [build instructions](https://github.com/source-academy/pynter#build-locally)) and pointing `--pynter` at the resulting binary, and only supports `-v 3` (SICPy §3) — the CLI exits with an error for any other variant, or if `--pynter` is omitted:

```shell
yarn repl <path to python file> --engine pvml --pynter <path to pynter's runner binary> -v 3
```

For example, if `pynter` is checked out as a sibling of `py-slang` (i.e. both under the same parent directory) and its `runner` has been built there per the instructions linked above, run from `py-slang`'s root:

```shell
yarn repl <path to python file> --engine pvml --pynter ../pynter/build/runner/runner -v 3
```

`src/tests/utils.ts`'s `generateNativePynterTestCases()` reruns the existing CSE test suite against `--engine pvml`-equivalent code when `PYNTER_RUNNER_PATH` is set to a built `runner` binary — a convenient way to see current pass/fail coverage; see "Running the test suite" below.

The bytecode format itself — currently identical to SVML, the format [Sinter](https://github.com/source-academy/sinter) executes — is documented in the [py-slang wiki](https://github.com/source-academy/py-slang/wiki), forked from the [js-slang SVML wiki](https://github.com/source-academy/js-slang/wiki/SVML-Specification) so it can be edited to describe PVML (py-slang's own bytecode target) without touching the canonical SVML docs. See [PVML-Specification](https://github.com/source-academy/py-slang/wiki/PVML-Specification) for the wire format and [PVML-Instruction-Set](https://github.com/source-academy/py-slang/wiki/PVML-Instruction-Set) for the opcode reference — the latter also documents a known mismatch between py-slang's primitive-function index table and the one built into Sinter/Pynter today.

#### Tail-call optimization

Both the CSE machine and the PVML compiler perform tail-call optimization: a call in tail position (the direct value of a `return`, including through both branches of a ternary) reuses the current call frame instead of growing the call stack, so tail-recursive SICPy programs run in constant stack space regardless of recursion depth. On the PVML side this is a compile-time decision (`PVMLCompiler.compileTail` emits `CALLT`/`CALLTP`/`CALLTA` instead of `CALL`/`CALLP`/`CALLA`), reused unchanged by all three PVML pathways (`PyPvmlEvaluator1..4`, `PyPvmlPynterEvaluator`, and both `--engine pvml`/`--engine pvml-browser` CLI paths) — native Pynter's own VM (`vm.c`) has always correctly implemented the `CALLT`/`CALLTP` opcodes themselves, so this only needed a compiler-side fix, not a native Pynter change.

### Running the test suite

Ensure that all tests pass before committing.

```shell
yarn test
```

`yarn test` always runs two engines' worth of tests, no extra setup required:

- The CSE machine's own test suite.
- The PVML-in-browser pathway's test suite (`pvml.test.ts`, `pvml-compiler.test.ts`,
  `pvml-interpreter.test.ts`, `pvml-assembler.test.ts`, `PyPvmlEvaluator.test.ts`, and others) —
  compiles to PVML bytecode and runs it on `PVMLInterpreter`, the pure-TypeScript VM (see
  "Running the standalone CLI (repl)" above), so it needs no native binary either.

A third, opt-in suite reruns test cases against a native Pynter binary instead — see below.

#### Running the PVML/Pynter native parity suite

`generateNativePynterTestCases()` in `src/tests/utils.ts`, used by the `stdlib`, `global-keyword`,
`nonlocal`, `loops`, `linked-list`, `pairmutator`, `list`, `stream`, and `parser-stdlib` test files
— reruns the same test cases through the PVML compiler and a native
[Pynter](https://github.com/source-academy/pynter) `runner` binary instead of `PVMLInterpreter`
(see "Running the standalone CLI (repl)" above for background). It's skipped by default, since it
needs a locally built Pynter binary that CI doesn't have. `src/tests/pvml-tco-pynter.test.ts` (see
"Tail-call optimization" above) and `src/tests/operator-conformance-pynter.test.ts` are opt-in the
same way, for the same reason.

To run these, build `runner` from the Pynter repo (see its
[build instructions](https://github.com/source-academy/pynter#build-locally)) and point
`PYNTER_RUNNER_PATH` at the resulting binary:

```shell
PYNTER_RUNNER_PATH=../pynter/build/runner/runner yarn test
```

Failures here are expected and informative, not a sign of broken infra: they reflect real, current
gaps between the PVML/Pynter pathway and the CSE machine (a feature the compiler or native Pynter
doesn't support yet, not usually a wholesale missing stdlib group — the PVML compiler wires up the
same `VARIANT_GROUPS` as the CSE machine by default). Complex-number cases are cleanly skipped
rather than counted as failures or passes, since Pynter's VM has no complex number type at all. To
see just this suite's results, filter by its test-name tag:

```shell
PYNTER_RUNNER_PATH=../pynter/build/runner/runner yarn jest -t "\[pvml/pynter\]"
```

Alternatively, `yarn pynter:report` (`scripts/pynter-parity-report.ts`) runs the whole suite and prints
a Markdown table of pass/attempted counts and pass rate per test file — handy for seeing what to
work on at a glance, or pasting into a PR description:

```shell
PYNTER_RUNNER_PATH=../pynter/build/runner/runner yarn pynter:report
```

Pass `--failures` to also list the full name of every failing test, grouped by suite.

#### Testing `sourceacademy-sicp` against the CSE machine's own test suite

`yarn test` also includes `generateCPythonTestCases()` (`src/tests/utils.ts`, used by the same test
files as the Pynter suite above), which reruns the same test cases through plain CPython instead,
using [`sourceacademy-sicp`](#sourceacademy-sicp--the-standard-library-for-plain-cpython) (the
`python/` package in this repo) to provide the standard library. This is the most thorough test
`sourceacademy-sicp` gets: rather than a small hand-written smoke suite, it's exercised against
every CSE-machine test case in this repo that's valid plain Python, using CPython itself as ground
truth. Unlike the Pynter suite, **this runs in CI** (`node.js.yml` sets `CPYTHON_PATH: python3` for
the `test-coverage` step) — `ubuntu-latest` ships Python 3 and `sourceacademy-sicp` has no
third-party dependencies, so there's no extra setup cost. It also has a secondary benefit for
py-slang itself: since it checks the CSE machine's test cases are true statements about Python, not
just that py-slang agrees with itself, it catches cases where a test's *expected value* is wrong.

To run it locally, point `CPYTHON_PATH` at a Python 3.10+ interpreter (any interpreter that can
`import` the `python/sicp` package works):

```shell
CPYTHON_PATH=python3 yarn test
```

Cases that test Source Academy Python's own pedagogical restrictions (chapter-gating, `bool`
excluded from arithmetic builtins) are cleanly skipped rather than counted as failures, since
CPython — unlike Pynter — is *more* permissive than this dialect, not less, and has no equivalent
restriction to check against. Cases exercising `parse()`/`tokenize()` are skipped too, since those
are py-slang-only metacircular-evaluator features with no CPython equivalent. To see just this
suite's results, filter by its test-name tag:

```shell
CPYTHON_PATH=python3 yarn jest -t "\[cpython\]"
```

### Regenerating the AST types and Parser

The AST types need to be regenerated after changing
the AST type definitions in `generate-ast.ts`.

```shell
yarn regen
```

Similarly, the parser needs to be regenerated after changing
the Python grammar in `python.ne`.

```shell
yarn compile-grammar
```

## Documentation

Our Python languages are documented here: <https://docs.sourceacademy.org/python/>

### Requirements

- `bash`: known working version: GNU bash, version 5.0.16
- `latexmk`: Version 4.52c
- `pdflatex`: known working versions
  - pdfTeX 3.14159265-2.6-1.40.18 (TeX Live 2017)

To build the documentation, run

```bash
$ git clone https://github.com/source-academy/py-slang.git
$ cd py-slang
$ yarn
$ yarn install
$ yarn jsdoc  # to make the web pages in py-slang/docs/python and the PDF documents
```

**Note:** The documentation may not build on Windows, depending on your bash setup, [see above](https://github.com/source-academy/py-slang#requirements).

Documentation on the Python libraries are generated from inline documentation in the library sources, a copy of which are kept in `docs/lib/*.js`. The command `yarn jsdoc` generates the documentation and places it in the folder `docs/python`. You can test the documentation using a local server:

```bash
$ cd docs/python;  python -m http.server 8000
```

## `sourceacademy-sicp` — the standard library for plain CPython

The [`python/`](python/) directory contains **`sourceacademy-sicp`**, a companion
package that ports this Python standard library — `pair`, `head`, `tail`,
`llist`, the `math_*` functions, streams, and so on — to ordinary CPython. With
`from sicp import *`, CS1101S / SICP (Python edition) programs run the same way
outside Source Academy. It is kept here, next to the `src/stdlib/` groups it
mirrors, so the two do not drift apart.

Packaged for PyPI as `sourceacademy-sicp`. See
[`python/README.md`](python/README.md) for installation, usage, and
[releasing](python/README.md#releasing), and the
[Python §4 standard library reference](https://docs.sourceacademy.org/python/python_4/)
for per-function documentation.

Tested two ways in CI: its own smoke suite (`python/tests/test_sicp.py`, run by
`python-package.yml` across Python 3.10–3.13), and — the more thorough of the two — by
[replaying the CSE machine's own test suite through it](#testing-sourceacademy-sicp-against-the-cse-machines-own-test-suite),
run as part of `yarn test` in `node.js.yml`.

## Prior Reading

These repositories are relevant to `py-slang`, and may be useful if stuck

- The [Conductor](https://github.com/source-academy/conductor) repository -- the framework which provides a communication framework between languages and hosts
- The [Language Directory](https://github.com/source-academy/language-directory) -- the repository for languages using the Conductor framework

## How it works

The evaluation of the program generally consists of several stages

- The Conductor runner plugin's (`Py...Evaluator`) entry point -- gets called via RPC and calls the rest of the steps
- Tokenization (refer to `src/parser/lexer.ts`) -- splits the program into tokens using Moo.
- Parsing (refer to `src/parser/parser-adapter.ts`) -- converts the tokens into an AST using Nearley.
- Resolution (refer to `src/resolver/resolver.ts`) -- visits every node and checks variable bindings. It also runs the validators on every node.
- Validation (refer to `docs/parsing/validators.md`) -- restricts features based on the Python chapter (e.g., for loops banned in chapter 1).
- Execution -- the actual code execution, logically depends on the evaluator used.
- Output -- The outputs and errors are sent via the Conductor framework

_Note: the Wasm compiler uses a different resolver and validator, refer to `src/engines/wasm/builderGenerator.ts`_

## Acknowledgements

This project adapts the `Conductor Interface` from [source-academy/conductor](https://github.com/source-academy/conductor), which is part of the Source Academy ecosystem.

Specifically, all files under the following folders are derived from the conductor repository:

- `src/conductor/`
- `src/common/`
- `src/conduit/`

All credits go to the original authors of the Source Academy Conductor Interface.
