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
    const tok = new Tokenizer(text);
    const tokens = tok.scanEverything();
    // tok.printTokens();
    const ast = (new Parser(text, tokens)).parse();
    console.log(ast);
    return ast;
}

export function toPythonAstAndResolve(text: string): Stmt {
    const ast = toPythonAst(text);
    new Resolver(text, ast).resolve(ast);
    return ast;
}

export function toEstreeAST(text: string): Expression | Statement {
    const ast = toPythonAst(text);
    return new Translator().resolve(ast);
}

export function toEstreeAstAndResolve(text: string): Expression | Statement {
    const ast = toPythonAst(text);
    return new Translator().resolve(ast);
}