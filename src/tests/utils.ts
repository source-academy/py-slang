import {
    Expression,
    Statement,
} from "estree";

import {Tokenizer} from '../tokenizer';
import {Parser} from '../parser';
import {Resolver} from '../resolver';
import {Translator} from '../translator';
import {StmtNS} from "../ast-types";
import Stmt = StmtNS.Stmt;

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
    return new Translator(text).resolve(ast);
}