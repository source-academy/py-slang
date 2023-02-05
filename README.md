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
npm run start:dev # Add `-- <file.py>` to run a file
```

### Consuming the API and generating an estree AST
```ecmascript 6
import {Tokenizer, Parser, Resolver, Translator} from 'py-slang';

// Sample Python code
const text = `
(lambda a:display(a))("Hello World!")
`;

// Scan the text.
const tokenizer = new Tokenizer(text);
tokenizer.scanEverything();
// If you want to view the tokens, you can.
// tokenizer.printTokens();

// Parse the tokens.
const parser = new Parser(text, tokenizer.tokens);
const ast = parser.parse();

// Validate and resolve symbols in namespaces.
// This step may throw false errors.
// This is when we detect variable declarations
// and hoist them out of blocks.
const resolver = new Resolver(text, ast);
resolver.resolve(ast);

// Finally, translate the AST to estree AST.
const translator = new Translator(text, ast);
const estreeAst = translator.resolve(ast);
```

### Regenerating the AST types
The AST types need to be regenerated after changing
the AST type definitions in `generate-ast.ts`.
```shell
npm run regen
```