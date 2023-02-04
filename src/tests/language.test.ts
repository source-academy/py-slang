import {
    ArrowFunctionExpression,
    AssignmentExpression,
    BaseNode, BinaryExpression, BinaryOperator,
    BlockStatement,
    BreakStatement,
    CallExpression, ConditionalExpression,
    ContinueStatement,
    EmptyStatement,
    Expression,
    ExpressionStatement,
    FunctionDeclaration,
    Identifier,
    IfStatement, LogicalExpression, LogicalOperator,
    Program,
    ReturnStatement, SimpleLiteral,
    Statement, UnaryExpression, UnaryOperator, VariableDeclaration, VariableDeclarator,
    WhileStatement
} from "estree";

import {Token, Tokenizer} from '../tokenizer';
import {Parser} from '../parser';
import {Resolver} from '../resolver';
import {Translator} from '../translator';
import {StmtNS} from "../ast-types";
import Stmt = StmtNS.Stmt;
import FileInput = StmtNS.FileInput;
import FromImport = StmtNS.FromImport;
import {TokenType} from "../tokens";


function toPythonAst(text: string): Stmt {
    const tok = new Tokenizer(text);
    const tokens = tok.scanEverything();
    // tok.printTokens();
    const ast = (new Parser(text, tokens)).parse();
    console.log(ast);
    return ast;
}

function toPythonAstAndResolve(text: string): Stmt {
    const ast = toPythonAst(text);
    new Resolver(text, ast).resolve(ast);
    return ast;
}

function toEstreeAST(text: string): Expression | Statement {
    const ast = toPythonAst(text);
    return new Translator(text, ast).resolve(ast);
}

function toEstreeAstAndResolve(text: string): Expression | Statement {
    const ast = toPythonAst(text);
    new Resolver(text, ast).resolve(ast);
    return new Translator(text, ast).resolve(ast);
}

describe('Test of Python language constructs', () => {
    describe('Imports', () => {
        test('From imports', () => {
            const text = `from x import (y)\n`;

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
                            16,
                            15)])],
                    null)
            )
        })
    });
});