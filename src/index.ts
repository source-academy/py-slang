// import fs from "fs";
//
// import {Tokenizer, Token} from "./tokenizer";
// // import {AstPrinter} from "./ast-printer";
// import {ExprNS} from "./ast-types";
// import {TokenType} from "./tokens";
// import {Parser} from "./parser";
// import {ParserErrors, ResolverErrors, TokenizerErrors} from "./errors";
// import {Resolver} from "./resolver";
// import BaseParserError = ParserErrors.BaseParserError;
// import BaseTokenizerError = TokenizerErrors.BaseTokenizerError;
// import BaseResolverError = ResolverErrors.BaseResolverError;
// import {Translator} from "./translator";
//
// let text;
// // Basic syntax
// text =
// `
// from x import (y)
// x = 1 if 2 else 3
//
// 1 is not 2
// 3 not in 4
// y = lambda a:a
//
// def z(a, b, c, d):
//     pass
//
// while x:
//     pass
//
// for _ in range(10):
//     pass
//
// if x:
//     pass
// elif y:
//     pass
// elif z:
//     pass
// else:
//     pass
// `;
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
// try {
//     if (process.argv.length > 2) {
//         text = fs.readFileSync(process.argv[2], 'utf8');
//     }
//     text = text ?? "";
//     text += '\n';
//     const tokenizer = new Tokenizer(text);
//     tokenizer.scanEverything();
//     tokenizer.printTokens();
//     const parser = new Parser(text, tokenizer.tokens);
//     const ast = parser.parse();
//     const resolver = new Resolver(text, ast);
//     resolver.resolve(ast);
//     console.log(ast);
//     // const translator = new Translator(text, ast);
//     // const estreeAst = translator.resolve(ast);
//     // console.log(estreeAst);
// } catch (e) {
//     if (e instanceof BaseTokenizerError || e instanceof BaseParserError || e instanceof BaseResolverError) {
//         console.error(e.message);
//     } else {
//         throw e;
//     }
// }
//

export * from './errors';
export {Tokenizer} from './tokenizer';
export {Parser} from './parser';
export {Resolver} from './resolver';
export {Translator} from './translator';
