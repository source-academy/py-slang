import {
    Expression,
    Statement,
} from "estree";

import { parse } from '../parser/parser-adapter';
import { Resolver } from '../resolver';
import { Translator } from '../translator';
import { StmtNS } from '../ast-types';
import Stmt = StmtNS.Stmt;

export function toPythonAst(text: string): Stmt {
    const script = text + '\n';
    return parse(script);
}

export function toPythonAstAndResolve(text: string): Stmt {
    const script = text + '\n';
    const ast = parse(script);
    new Resolver(script, ast).resolve(ast);
    return ast;
}

export function toEstreeAST(text: string): Expression | Statement {
    const ast = toPythonAst(text);
    return new Translator(text + '\n').resolve(ast);
}

export function toEstreeAstAndResolve(text: string): Expression | Statement {
    const script = text + '\n';
    const ast = parse(script);
    new Resolver(script, ast).resolve(ast);
    return new Translator(script).resolve(ast);
}
