//
// // // Forbidden identifier
// // text =
// // `
// // async def y():
// //     pass
// // `;
// //
// // Non four indent
// // let text =
// // `
// // def x():
// //    pass
// // `;
//
// // // Unrecognised token
// // text = `
// //             ?
// // `;
//
// // Unterminated string
// // text = `\
// //
// // "abc" "abcdef`;
//
// // // Forbidden operator
// // text =`
// // a @= b
// // `
//
// // // Expected token
// // text = `
// // def a(c, d)
// //     pass
// // `
//
// // // Expected else block
// // text = `
// // if y:
// //     pass
// //
// // `;
//
// // // Expected colon after lambda:
// // text = `
// // x = lambda a
// // `;
//
// // // Expected import
// // text = `
// // from x
// // `;
//
// // // Bad identifier
// // text = `
// // def a(1, 2):
// //     pass
// // `;
//
// // // Missing closing parentheses:
// // text = `
// // def a(a, b:
// //     pass
// // `;
//
// // // @TODO Invalid assign target
// // text = `
// //
// // 1 = 2 def a(b, c):
// //     pass
// // `;
//
// // Variable declaration hoisting
// // text = `
// // x = 1
// // def a():
// //     if True:
// //         x = 1
// //     else:
// //         y = 2
// //     def b():
// //         x = 1
// // `
// // // Undeclared variable
// // text = `
// // x = display(a)
// // `
// // Misspelled name
// // text = `
// // displar(1)
// // `
//
// // // Mispelled name 2
//
// // text = `
// // def y(param):
// //     def z():
// //         var = display(barams)
// // `
//
// // // Name reassignment
//
// // text = `
// // x = 1
// // while True:
// //     pass
// // x = lambda a:a
// // `;
//
// // text = `
// // # !x
// // not x
// // `
//
// // text = `
// // (lambda a:a)(1)
// //
// // `;
//
// // text = `
// // (x)(1)
// // `;
//
// // text = `
// // def a(b,c):
// //     pass
// // `;
//
/* Use as a command line script */
/* npm run start:dev -- test.py */

import {Tokenizer} from "./tokenizer";
import {Parser} from "./parser";
import {Translator} from "./translator";
import {Program} from "estree";
import {Resolver} from "./resolver";

export function parsePythonToEstreeAst(code: string,
                                       variant: number = 1,
                                       doValidate: boolean = false) : Program {
    const script = code + '\n'
    const tokenizer = new Tokenizer(script)
    const tokens = tokenizer.scanEverything()
    const pyParser = new Parser(script, tokens)
    const ast = pyParser.parse()
    if (doValidate) {
        new Resolver(script, ast).resolve(ast);
    }
    const translator = new Translator(script)
    return translator.resolve(ast) as unknown as Program
}

export * from './errors';


// import {ParserErrors, ResolverErrors, TokenizerErrors} from "./errors";
// import fs from "fs";
// const BaseParserError = ParserErrors.BaseParserError;
// const BaseTokenizerError = TokenizerErrors.BaseTokenizerError;
// const BaseResolverError = ResolverErrors.BaseResolverError;
// if (process.argv.length > 2) {
//     try {
//         let text = fs.readFileSync(process.argv[2], 'utf8');
//         // Add a new line just in case
//         text += '\n';
//         const tokenizer = new Tokenizer(text);
//         const tokens = tokenizer.scanEverything();
//         tokenizer.printTokens();
//         const parser = new Parser(text, tokens);
//         const ast = parser.parse();
//         // const resolver = new Resolver(text, ast);
//         // resolver.resolve(ast);
//         console.dir(ast, { depth: null });
//         const translator = new Translator(text);
//         const estreeAst = translator.resolve(ast);
//         console.dir(estreeAst, { depth: null });
//     } catch (e) {
//         if (e instanceof BaseTokenizerError
//             || e instanceof BaseParserError
//             || e instanceof BaseResolverError) {
//             console.error(e.message);
//         } else {
//             throw e;
//         }
//     }
// }
