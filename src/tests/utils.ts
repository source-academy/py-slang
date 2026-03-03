import {
    Expression,
    Statement,
} from "estree";

import {Tokenizer} from '../tokenizer';
import {NearleyParser} from '../parser/parser-adapter';
import {Resolver} from '../resolver';
import {StmtNS} from "../ast-types";
import Stmt = StmtNS.Stmt;

export function toPythonAst(text: string): Stmt {
    const script = text + '\n';
    const tokenizer = new Tokenizer(script);
    const tokens = tokenizer.scanEverything();
    const parser = new NearleyParser(script, tokens);
    return parser.parse();
}

export function toPythonAstAndResolve(text: string): Stmt {
    const script = text + '\n';
    const ast = toPythonAst(text);
    const resolver = new Resolver(script, ast);
    resolver.resolve(ast);
    return ast;
}
