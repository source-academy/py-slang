import {Token} from '../tokenizer';
import {ExprNS, StmtNS} from "../ast-types";
import {TokenType} from "../tokens";

import {toPythonAst} from "./utils";
import FileInput = StmtNS.FileInput;
import FromImport = StmtNS.FromImport;
import Ternary = ExprNS.Ternary;
import SimpleExpr = StmtNS.SimpleExpr;
import Variable = ExprNS.Variable;
import Literal = ExprNS.Literal;
import Lambda = ExprNS.Lambda;
import Binary = ExprNS.Binary;
import FunctionDef = StmtNS.FunctionDef;
import Pass = StmtNS.Pass;

//@TODO all the columns offsets for tokens are off. They should be the value
// *before* the token, not *after*.

describe('Tests for Python language constructs', () => {
    describe('Imports', () => {
        test('From imports: single binding', () => {
            const text = `from x import y\n`;

            expect(toPythonAst(text)).toMatchObject(
                new FileInput(
                    [new FromImport(
                        new Token(TokenType.NAME,
                            'x',
                            0,
                            6,
                            5),
                        [new Token(TokenType.NAME,
                            'y',
                            0,
                            15,
                            14)])],
                    null)
            )
        })
        test('From imports: multiple binding', () => {
            const text = `from x import (a, b, c)\n`;

            expect(toPythonAst(text)).toMatchObject(
                new FileInput(
                    [new FromImport(
                        new Token(TokenType.NAME,
                            'x',
                            0,
                            6,
                            5),
                        // @ts-ignore
                        // the names aren't important, what is import is there
                        // are 3
                        [{}, {}, {}])],
                    null)
            )
        })
    });

    describe('Ternary', () => {
        test('Simple ternary', () => {
            const text = `x if y else 1\n`;
            expect(toPythonAst(text)).toMatchObject(
                new FileInput(
                    [new SimpleExpr(new Ternary(
                        new Variable(new Token(TokenType.NAME, 'y', 0, 6, 5)),
                        new Variable(new Token(TokenType.NAME, 'x', 0, 1, 0)),
                        new Literal(1)))],
                    null)
            )
        })
        test('Nested ternary', () => {
            const text = `1 if A else 2 if B else 3\n`;
            expect(toPythonAst(text)).toMatchObject(
                new FileInput(
                    [new SimpleExpr(new Ternary(
                        new Variable(new Token(TokenType.NAME, 'A', 0, 6, 5)),
                        new Literal(1),
                        new Ternary(
                            new Variable(new Token(TokenType.NAME, 'B', 0, 18, 17)),
                            new Literal(2),
                            new Literal(3)
                        )))],
                    null)
            )
        })
    });

    describe('Lambda', () => {
        test('Simple lambda', () => {
            const text = `lambda a:a\n`;
            expect(toPythonAst(text)).toMatchObject(
                new FileInput(
                    [new SimpleExpr(new Lambda(
                        [new Token(TokenType.NAME, 'a', 0, 8, 7)],
                        new Variable(new Token(TokenType.NAME, 'a', 0, 10, 9))))],
                    null)
            )
        });

        test('Nested lambda', () => {
            const text = `lambda a: lambda b: b + a\n`;
            expect(toPythonAst(text)).toMatchObject(
                new FileInput(
                    [new SimpleExpr(new Lambda(
                        [new Token(TokenType.NAME, 'a', 0, 8, 7)],
                        new Lambda([new Token(TokenType.NAME, 'b', 0, 18, 17)],
                            new Binary(new Variable(new Token(TokenType.NAME, 'b', 0, 21, 20)),
                                new Token(TokenType.PLUS, '+', 0, 23, 22),
                                new Variable(new Token(TokenType.NAME, 'a', 0, 25, 24))))))],
                    null)
            )
        });
    });

    describe('Function definitions', () => {
        test('Function definition', () => {
const text = `\
def y(a, b, c):
    pass
    pass
`
            expect(toPythonAst(text)).toMatchObject(
                new FileInput([new FunctionDef(
                    new Token(TokenType.NAME, 'y', 0, 5, 4),
                    [new Token(TokenType.NAME, 'a', 0, 7, 6),
                        new Token(TokenType.NAME, 'b', 0, 10, 9),
                        new Token(TokenType.NAME, 'c', 0, 13, 12)],
                    [new Pass(), new Pass()],
                    null
                    )], null)
            );
        });
    });
});