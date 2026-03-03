import { expect, test } from '@jest/globals';

import { Tokenizer } from '../tokenizer';
import { Parser } from '../parser';
import { Resolver } from '../resolver';
// import {Translator} from '../translator';
import { StmtNS } from "../ast-types";
import Stmt = StmtNS.Stmt;
import { Context } from "../cse-machine/context";
import { runInContext } from "../runner/pyRunner";
import { Group } from "../stdlib/utils";
import { RuntimeSourceError } from '../errors';

type Class<T> = new (...args: any[]) => T;

export type TestExpectedValue = bigint | number | boolean | string | null | Class<RuntimeSourceError> | Class<Error>;
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
        test.each(tests)(`${funcName}: %s should return %s`, async (code, expected) => {
            const context = new Context();
            const result = await runInContext(code, context, { variant, groups });
            expect(result).toBeDefined();
            expect(result.status).toBe('finished');

            if (typeof expected === 'function' && expected.prototype instanceof RuntimeSourceError) {
                expect(result).toHaveProperty('value.message', expect.stringContaining(expected.name));
                return;
            }

            if (typeof expected === 'function' && expected.prototype instanceof Error) {
                expect(result).toHaveProperty('value.message', expect.stringContaining(expected.name));
                return;
            }


            if (expected === null) {
                expect(context.stash.peek()).toHaveProperty('type', 'none');
                return;
            }

            if (typeof expected === 'bigint') {
                expect(context.stash.peek()).toHaveProperty('type', 'bigint');
                expect(context.stash.peek()).toHaveProperty('value', expected);
                return;
            }

            if (typeof expected === 'number') {
                expect(context.stash.peek()).toHaveProperty('type', 'number');
                expect(context.stash.peek()).toHaveProperty('value', expected);
                return;
            }

            if (typeof expected === 'boolean') {
                expect(context.stash.peek()).toHaveProperty('type', 'bool');
                expect(context.stash.peek()).toHaveProperty('value', expected);
                return;
            }

            expect(context.stash.peek()).toHaveProperty('type', 'string');
            expect(context.stash.peek()).toHaveProperty('value', expected);
            return;
        });
    }
}
