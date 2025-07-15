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

import { Tokenizer } from "./tokenizer";
import { Parser } from "./parser";
import { Translator } from "./translator";
import { Program } from "estree";
import { Resolver } from "./resolver";
import { Context } from './cse-machine/context';
export * from './errors';
import { Finished, RecursivePartial, Result } from "./types";
import { runCSEMachine } from "./runner/pyRunner";
import { initialise } from "./conductor/runner/util/initialise";
import { PyEvaluator } from "./conductor/runner/types/PyEvaluator";
import { createContext, Chapter } from './createContext';
import * as fs from 'fs';
import * as path from 'path';
export * from './errors';

export function parsePythonToEstreeAst(code: string,
    variant: number = 1,
    doValidate: boolean = false): Program {
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

export interface IOptions {
    isPrelude: boolean,
    envSteps: number,
    stepLimit: number
};

export async function runInContext(
    code: string,
    context: Context,
    options: RecursivePartial<IOptions> = {}
): Promise<Result> {
    // Load and run the Python prelude first
    const preludeCode = loadPythonPrelude();
    if (preludeCode) {
        const preludeAst = parsePythonToEstreeAst(preludeCode, 1, true);
        await runCSEMachine(preludeCode, preludeAst, context, { ...options, isPrelude: true });
    }
    
    // Now run the main code
    const estreeAst = parsePythonToEstreeAst(code, 1, true);
    const result = runCSEMachine(code, estreeAst, context, options);
    return result;
}

/**
 * Runs Python code in a context with a specific chapter
 * @param code The Python code to run
 * @param chapter The chapter to use (1-4 or 'LIBRARY_PARSER')
 * @param options Additional options
 * @returns The result of running the code
 */
export async function runInChapter(
    code: string,
    chapter: Chapter = 2,
    options: RecursivePartial<IOptions> = {}
): Promise<Result> {
    const context = createContext(chapter);
    return runInContext(code, context, options);
}

/**
 * Loads and runs the Python prelude file containing list processing functions
 */
function loadPythonPrelude(): string {
    try {
        const preludePath = path.join(__dirname, 'conductor', 'stdlib', 'list', 'list.prelude.py');
        return fs.readFileSync(preludePath, 'utf8');
    } catch (error) {
        console.warn('Could not load Python prelude:', error);
        return '';
    }
}

if (require.main === module) {
    (async () => {
      if (process.argv.length < 3) {
        console.error("Usage: npm run start:dev -- <python-file>");
        process.exit(1);
      }
  
      const filePath = process.argv[2];
  
      try {
        const context = new Context();
        const options = {};
        const code = fs.readFileSync(filePath, "utf8") + "\n";
        console.log(`Parsing Python file: ${filePath}`);
  
        const result = await runInContext(code, context, options);
        console.info(result);
        console.info((result as Finished).value);
        console.info((result as Finished).representation.toString((result as Finished).value));
  
      } catch (e) {
        console.error("Error:", e);
      }

    })();
}