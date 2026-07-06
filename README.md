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

| Name                                                                                                                                             | Description                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [PyCseEvaluator1](https://github.com/source-academy/py-slang/blob/36351039fcd1f6dfbac3df10bf1ef084a44f029b/src/conductor/PyCseEvaluator.ts#L95)  | Interprets Python §1 programs using the CSE machine                                                                                                                                                |
| [PyCseEvaluator2](https://github.com/source-academy/py-slang/blob/36351039fcd1f6dfbac3df10bf1ef084a44f029b/src/conductor/PyCseEvaluator.ts#L101) | Interprets Python §2 programs using the CSE machine                                                                                                                                                |
| [PyCseEvaluator3](https://github.com/source-academy/py-slang/blob/36351039fcd1f6dfbac3df10bf1ef084a44f029b/src/conductor/PyCseEvaluator.ts#L107) | Interprets Python §3 programs using the CSE machine                                                                                                                                                |
| [PyCseEvaluator4](https://github.com/source-academy/py-slang/blob/36351039fcd1f6dfbac3df10bf1ef084a44f029b/src/conductor/PyCseEvaluator.ts#L113) | Interprets Python §4 programs using the CSE machine                                                                                                                                                |
| [PyWasmEvaluator](https://github.com/source-academy/py-slang/tree/main/src/conductor/PyWasmEvaluator.ts)                                         | Compiles Python §4 programs into WebAssembly and runs it                                                                                                                                           |
| [PyPvmlEvaluator](https://github.com/source-academy/py-slang/tree/main/src/conductor/PyPvmlEvaluator.ts)                                         | Evaluates the Python AST via a handwritten Typescript compiler and interpreter                                                                                                                     |
| [PyPvmlPynterEvaluator](https://github.com/source-academy/py-slang/tree/main/src/conductor/PyPvmlPynterEvaluator.ts)                             | Evaluates the Python AST with the same compiler as `PyPvmlEvaluator`, but a different interpreter. It uses the WebAssembly port of the [Sinter](https://github.com/source-academy/sinter) project. |

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

`py-slang` can also be run as a standalone CLI, outside of Conductor, via `src/repl.ts`. By default it evaluates a SICPy file through the CSE machine:

```shell
yarn build:repl
yarn repl <path to python file> [-v <1-4>]
```

Alternatively, `--engine pvml` compiles the file to PVML bytecode and runs it on a native [Pynter](https://github.com/source-academy/pynter) `runner` binary instead of the CSE machine — the same compiler used by `PyPvmlEvaluator`/`PyPvmlPynterEvaluator`, but executed by a native C VM rather than a WASM port or the TypeScript interpreter. Pynter is a fork of [Sinter](https://github.com/source-academy/sinter), kept as a separate sister project so that giving the native VM Python-specific semantics doesn't risk destabilizing Sinter, which remains the fallback engine for the Source curriculum. This requires building `runner` from the Pynter repo separately (see its [build instructions](https://github.com/source-academy/pynter#build-locally)) and pointing `--pynter` at the resulting binary:

```shell
yarn repl <path to python file> --engine pvml --pynter <path to pynter's runner binary> -v 3
```

`--engine pvml` only supports `-v 3` (SICPy §3) today; the CLI exits with an error for any other variant.

For example, if `pynter` is checked out as a sibling of `py-slang` (i.e. both under the same parent directory) and its `runner` has been built there per the instructions linked above, run from `py-slang`'s root:

```shell
yarn repl <path to python file> --engine pvml --pynter ../pynter/build/runner/runner -v 3
```

Note that the PVML compiler currently only wires up the `misc` and `math` stdlib groups (matching `PyPvmlEvaluator`/`PyPvmlPynterEvaluator`), so even within §3 many programs relying on linked lists, streams, or mutable pairs/lists aren't supported via `--engine pvml` yet. `src/tests/utils.ts`'s `generateNativePynterTestCases()` reruns the existing CSE test suite against `--engine pvml`-equivalent code when `PYNTER_RUNNER_PATH` is set to a built `runner` binary — a convenient way to see current pass/fail coverage as the PVML compiler and Pynter itself gain features.

The bytecode format itself — currently identical to SVML, the format [Sinter](https://github.com/source-academy/sinter) executes — is documented under [`docs/pvml/`](./docs/pvml/), forked from the [js-slang SVML wiki](https://github.com/source-academy/js-slang/wiki/SVML-Specification) so it can be edited to describe PVML (py-slang's own bytecode target) without touching the canonical SVML docs. See `docs/pvml/PVML-Specification.md` for the wire format and `docs/pvml/PVML-Instruction-Set.wiki` for the opcode reference — the latter also documents a known mismatch between py-slang's primitive-function index table and the one built into Sinter/Pynter today.

### Running the test suite

Ensure that all tests pass before committing.

```shell
yarn test
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
