# Python variant for SICP

## What is py-slang?

`py-slang` is a language frontend for the
[js-slang](https://github.com/source-academy/js-slang) repository. It parses
a restricted subset of Python (enough to complete SICP), and outputs an
`estree`-compatible AST. [The grammar](./src/Grammar.gram) is a reduced
version of [Python 3.7's](https://docs.python.org/3.7/reference/grammar.html).
This project does not aim to be a full Python to JS transpiler, but aims
to transpile just a small enough subset of Python.

## Usage
For local testing:
```shell
npm run start:dev # Add `-- <file.py>` to run a file
```

### Consuming the API and generating an estree AST
```javascript
import {parsePythonToEstreeAst} from 'py-slang';

// Sample Python code
const text = `
(lambda a: print(a))("Hello World!")
`;
// Arguments:
// Code to translate
// SICPy chapter number
// Whether to validate the code using a resolver.
console.dir(parsePythonToEstreeAst(text, 1, false));
```

### Running the test suite

Ensure that all tests pass before committing.

```shell
npm run test
```

### Regenerating the AST types
The AST types need to be regenerated after changing
the AST type definitions in `generate-ast.ts`.
```shell
npm run regen
```