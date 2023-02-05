import {toPythonAstAndResolve} from "./utils";
import {Token} from "../tokenizer";
import {TokenType} from "../tokens";
import {ExprNS, StmtNS} from "../ast-types";
import FileInput = StmtNS.FileInput;

describe('Tests for the resolver/validator', () => {
    describe('Imports', () => {
        test('Test imports are name bindings', () => {
const text = `
from x import y

y()
`;
            expect(toPythonAstAndResolve(text)).toMatchObject(
                // The objects here are not important, what's import is the
                // that we didn't error but still produced some result.
                new FileInput(
                    // @ts-ignore
                    [{}, {}],
                    null)
            )
        })
    });
});