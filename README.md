# Python variant for SICP

## What is py-slang?

`py-slang` is a Python implementation developed specifically for the Source Academy online learning environment. Unlike previous versions where Python was treated as a subset within [js-slang](https://github.com/source-academy/js-slang), py-slang now stands as an independent language implementation. It features its own parser, csemachine, and runtime, designed to process a tailored subset of Python for educational purposes.

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