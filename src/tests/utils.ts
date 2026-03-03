import { expect, test } from '@jest/globals';

import {Tokenizer} from '../tokenizer';
import {Parser} from '../parser';
import {Resolver} from '../resolver';
// import {Translator} from '../translator';
import {StmtNS} from "../ast-types";
import Stmt = StmtNS.Stmt;
import { Context } from "../cse-machine/context";
import { runInContext } from "../runner/pyRunner";
import { Group } from "../stdlib/utils";

type Class<T> = new (...args: any[]) => T;

export type TestExpectedValue = bigint | number | boolean | string | null | Class<Error>;
export type TestCases = Record<string, [string, TestExpectedValue][]>;

export function toPythonAst(text: string, chapter: number = 1): Stmt {
    const script = text + '\n'
    const tokenizer = new Tokenizer(script)
    const tokens = tokenizer.scanEverything()
    const pyParser = new Parser(script, tokens, chapter)
    const ast = pyParser.parse()
    // console.dir(ast);
    return ast;
}

export function toPythonAstAndResolve(text: string, chapter: number): Stmt {
    const ast = toPythonAst(text, chapter);
    new Resolver(text, ast, [], []).resolve(ast);
    return ast;
}

// export function toEstreeAST(text: string): Expression | Statement {
//     const ast = toPythonAst(text);
//     return new Translator(text).resolve(ast);
// }

// export function toEstreeAstAndResolve(text: string): Expression | Statement {
//     const ast = toPythonAst(text);
//     new Resolver(text, ast).resolve(ast);
//     return new Translator(text).resolve(ast);
// }

export const generateTestCases = (testCases: TestCases, variant: number, groups: Group[]) => {
    for (const [funcName, tests] of Object.entries(testCases)) {
        test.each(tests)(`${funcName}: %s should return %s`, (code, expected) => {
            const context = new Context();
            if (typeof expected === 'function' && (expected as Class<Error>).prototype instanceof Error) {
                return expect(runInContext(code, context, { variant, groups })).resolves.toHaveProperty('value.message', expect.stringContaining((expected as Class<Error>).name));
            }

            if (expected === null) {
                return expect(runInContext(code, context, { variant, groups })).resolves.toHaveProperty('value', { type: 'none' });
            }

            if (typeof expected === 'bigint') {
                return expect(runInContext(code, context, { variant, groups })).resolves.toHaveProperty('value', { type: 'bigint', value: expected });
            }

            if (typeof expected === 'number') {
                return expect(runInContext(code, context, { variant, groups })).resolves.toHaveProperty('value', { type: 'number', value: expected });
            }

            if (typeof expected === 'boolean') {
                return expect(runInContext(code, context, { variant, groups })).resolves.toHaveProperty('value', { type: 'bool', value: expected });
            }

            return expect(runInContext(code, context, { variant, groups })).resolves.toHaveProperty('value', { type: 'string', value: expected });
        });
    }
}
