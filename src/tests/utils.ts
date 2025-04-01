import {
    Expression,
    Program,
    Statement,
} from "estree";

import {Tokenizer} from '../tokenizer';
import {Parser} from '../parser';
import {Resolver} from '../resolver';
import {Translator} from '../translator';
import {StmtNS} from "../ast-types";
import Stmt = StmtNS.Stmt;

import { Value } from "../cse-machine/stash";
import { Context } from "../cse-machine/context";
import { evaluate } from "../cse-machine/interpreter";
import { PyComplexNumber } from "../types";

export function toPythonAst(text: string): Stmt {
    const script = text + '\n'
    const tokenizer = new Tokenizer(script)
    const tokens = tokenizer.scanEverything()
    const pyParser = new Parser(script, tokens)
    const ast = pyParser.parse()
    // console.dir(ast);
    return ast;
}

export function toPythonAstAndResolve(text: string): Stmt {
    const ast = toPythonAst(text);
    new Resolver(text, ast).resolve(ast);
    return ast;
}

export function toEstreeAST(text: string): Expression | Statement {
    const ast = toPythonAst(text);
    return new Translator(text).resolve(ast);
}

export function toEstreeAstAndResolve(text: string): Expression | Statement {
    const ast = toPythonAst(text);
    new Resolver(text, ast).resolve(ast);
    return new Translator(text).resolve(ast);
}

// new feature for cse machine
export function runCSEMachine(code: string): Value {
    //const estreeAst = toPythonAstAndResolve(text) as unknown as Program;
    const script = code + '\n'
    const tokenizer = new Tokenizer(script)
    const tokens = tokenizer.scanEverything()
    const pyParser = new Parser(script, tokens)
    const ast = pyParser.parse()
    new Resolver(script, ast).resolve(ast);
    const translator = new Translator(script)
    const estreeAst = translator.resolve(ast) as unknown as Program
    
    const context = new Context();
    const options = {
        isPrelude: false,
        envSteps: 1000000,
        stepLimit: 1000000
    };
    
    const result = evaluate(estreeAst, context, options);
    return result;
}

export function toPythonFloat(num: number): string {
    if (Object.is(num, -0)) {
        return "-0.0";
    }
    if (num === 0) {
        return "0.0";
    }

    if (num === Infinity) {
        return "inf";
    }
    if (num === -Infinity) {
        return "-inf";
    }
    
    if (Math.abs(num) >= 1e16 || (num !== 0 && Math.abs(num) < 1e-4)) {
        return num.toExponential().replace(/e([+-])(\d)$/, 'e$10$2');
    }
    if (Number.isInteger(num)) {
        return num.toFixed(1).toString();
    }
    return num.toString();
}


// export function toPythonComplex(complex: PyComplexNumber){
//     if (complex.real === 0.0) {
//         return complex.imag
//     }
// }
