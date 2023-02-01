# Python variant for SICP

## What is py-slang?

`py-slang` is a language frontend for the
[js-slang](https://github.com/source-academy/js-slang) repository. It parses
a restricted subset of Python (enough to complete SICP), and outputs an
`estree`-compatible AST. [The grammar](./src/Grammar.gram) is a reduced
version of [Python 3.7's](https://docs.python.org/3.7/reference/grammar.html).

## Usage
For local testing:
```shell
npm run start:dev
```