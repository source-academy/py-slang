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
export * from './errors';
import { PyRunCSEMachine } from "./runner/pyRunner";
import { StmtNS } from "./ast-types";
import { PyContext } from "./cse-machine/py_context";

type Stmt = StmtNS.Stmt;

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
    const estreeAst = parsePythonToEstreeAst(code, 1, true);
    const result = runCSEMachine(code, estreeAst, context, options);
    return result;
}



export async function runPyAST(
    code: string,
    context: PyContext,
    options: RecursivePartial<IOptions> = {}
): Promise<Stmt> {
    const script = code + "\n";
    const tokenizer = new Tokenizer(script);
    const tokens = tokenizer.scanEverything();
    const pyParser = new Parser(script, tokens);
    const ast = pyParser.parse();
    return ast;
};

export async function PyRunInContext(
    code: string,
    context: PyContext,
    options: RecursivePartial<IOptions> = {}
): Promise<Result> {
    const ast = await runPyAST(code, context, options);
    const result = PyRunCSEMachine(code, ast, context, options);
    return result;
}

export * from "./errors";
import * as fs from "fs";

if (require.main === module) {
    (async () => {
      if (process.argv.length < 3) {
        console.error("Usage: npm run start:dev -- <python-file>");
        process.exit(1);
      }
      const options = {};
      const context = new Context();

      const filePath = process.argv[2];
  
      try {
        //await loadModulesFromServer(context, "http://localhost:8022");

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
// const {runnerPlugin, conduit} = initialise(PyEvaluator);
