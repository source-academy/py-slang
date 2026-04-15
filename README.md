# Python variant for SICP

## What is py-slang?

`py-slang` is a Python implementation developed specifically for the Source Academy online learning environment. Unlike previous versions where Python was treated as a subset within [js-slang](https://github.com/source-academy/js-slang), py-slang now stands as an independent language implementation. It features its own parser, csemachine, and runtime, designed to process a tailored subset of Python for educational purposes.

It contains multiple [engines](https://github.com/source-academy/py-slang/tree/main/src/engines) including the CSE machine, a WASM compiler and an SVML compiler.

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
| [PySvmlEvaluator](https://github.com/source-academy/py-slang/tree/main/src/conductor/PySvmlEvaluator.ts)                                         | Evaluates the Python AST via a handwritten Typescript compiler and interpreter                                                                                                                     |
| [PySvmlSinterEvaluator](https://github.com/source-academy/py-slang/tree/main/src/conductor/PySvmlSinterEvaluator.ts)                             | Evaluates the Python AST with the same compiler as `PySvmlEvaluator`, but a different interpreter. It uses the WebAssembly port of the [Sinter](https://github.com/source-academy/sinter) project. |

### Using the evaluators

Refer to the [Conductor's Quick Start Guide](https://github.com/source-academy/conductor?tab=readme-ov-file#quick-start-guide)

### Running the Wasm evaluator locally

To run the Wasm compiler locally, run

```shell
yarn wasm <path to python file>
```

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
