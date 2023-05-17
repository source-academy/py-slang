/*
* Full disclosure: some of the functions and general layout of the file is
* from my own implementation of a parser
* in Rust.
* https://github.com/Fidget-Spinner/crafting_interpreters/blob/main/rust/src/parser.rs
*
* That is in turn an implementation of the book "Crafting Interpreters" by
* Robert Nystrom, which implements an interpreter in Java.
* https://craftinginterpreters.com/parsing-expressions.html.
* I've included the MIT license that code snippets from
* the book is licensed under down below. See
* https://github.com/munificent/craftinginterpreters/blob/master/LICENSE
*
*
* My changes:
*   - The book was written in Java. I have written this in TypeScript.
*   - My Rust implementation uses pattern matching, but the visitor pattern is
*     used here.
*   - Additionally, the production rules are completely different
*     from the book as a whole different language is being parsed.
*
*
    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to
    deal in the Software without restriction, including without limitation the
    rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
    sell copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
    IN THE SOFTWARE.
**/

import {SPECIAL_IDENTIFIER_TOKENS, Token} from "./tokenizer";
import {TokenType} from "./tokens";
import {ExprNS, StmtNS} from "./ast-types";
import {ParserErrors} from "./errors";

type Expr = ExprNS.Expr;
type Stmt = StmtNS.Stmt;

const PSEUD_NAMES = [
    TokenType.TRUE,
    TokenType.FALSE,
    TokenType.NONE,
]

export class Parser {
    private readonly source: string;
    private readonly tokens: Token[];
    private current: number;

    constructor(source: string, tokens: Token[]) {
        this.source = source;
        this.tokens = tokens;
        this.current = 0;
    }

    // Consumes tokens while tokenTypes matches.
    private match(...tokenTypes: TokenType[]): boolean {
        for (const tokenType of tokenTypes) {
            if (this.check(tokenType)) {
                this.advance();
                return true;
            }
        }
        return false;
    }

    private check(...type: TokenType[]): boolean {
        if (this.isAtEnd()) {
            return false;
        }
        for (const tokenType of type) {
            if (this.peek().type === tokenType) {
                return true;
            }
        }
        return false;
    }

    private advance(): Token {
        if (!this.isAtEnd()) {
            this.current += 1;
        }
        return this.previous();
    }

    private isAtEnd(): boolean {
        return this.peek().type === TokenType.ENDMARKER;
    }


    private peek(): Token {
        return this.tokens[this.current];
    }

    private previous(): Token {
        return this.tokens[this.current - 1];
    }

    private consume(type: TokenType, message: string): Token {
        if (this.check(type)) return this.advance();
        const token = this.tokens[this.current];
        throw new ParserErrors.ExpectedTokenError(this.source, token, message);
    }

    private synchronize() {
        this.advance();
        while (!this.isAtEnd()) {
            if (this.match(TokenType.NEWLINE)) {
                return false;
            }
            if (this.match(TokenType.FOR,
                TokenType.WHILE, TokenType.DEF,
                TokenType.IF, TokenType.ELIF,
                TokenType.ELSE, TokenType.RETURN)) {
                return true;
            }
            this.advance();
        }
        return false;
    }

    parse(): Stmt {
        return this.file_input();
        // return this.expression();
    }

    //// THE NAMES OF THE FOLLOWING FUNCTIONS FOLLOW THE PRODUCTION RULES IN THE GRAMMAR.
    //// HENCE THEIR NAMES MIGHT NOT BE COMPLIANT WITH CAMELCASE
    private file_input(): Stmt {
        const startToken = this.peek();
        const statements: Stmt[] = [];
        while (!this.isAtEnd()) {
            if (this.match(TokenType.NEWLINE)) {
                continue;
            }
            statements.push(this.stmt());
        }
        const endToken = this.peek();
        return new StmtNS.FileInput(startToken, endToken, statements, []);
    }

    private stmt(): Stmt {
        if (this.check(TokenType.DEF, TokenType.FOR, TokenType.IF, TokenType.WHILE)) {
            return this.compound_stmt();
        } else if (this.check(TokenType.NAME, ...PSEUD_NAMES, TokenType.NUMBER,
            TokenType.PASS, TokenType.BREAK, TokenType.CONTINUE,
            TokenType.RETURN, TokenType.FROM, TokenType.GLOBAL, TokenType.NONLOCAL,
            TokenType.ASSERT, TokenType.LPAR, ...SPECIAL_IDENTIFIER_TOKENS)) {
            return this.simple_stmt();
        }
        const startToken = this.peek();
        const endToken = this.synchronize() ? this.previous() : this.peek();
        try {
            this.parse_invalid(startToken, endToken);
        } catch (e) {
            if (e instanceof ParserErrors.BaseParserError) {
                throw(e)
            }
        }
        throw new ParserErrors.GenericUnexpectedSyntaxError(startToken.line, startToken.col, this.source,
            startToken.indexInSource, endToken.indexInSource);
    }

    private compound_stmt(): Stmt {
        if (this.match(TokenType.IF)) {
            return this.if_stmt();
        } else if (this.match(TokenType.WHILE)) {
            return this.while_stmt();
        } else if (this.match(TokenType.FOR)) {
            return this.for_stmt();
        } else if (this.match(TokenType.DEF)) {
            return this.funcdef();
        }
        throw new Error("Unreachable code path");
    }

    private if_stmt(): Stmt {
        const startToken = this.previous();
        let start = this.previous();
        let cond = this.test();
        this.consume(TokenType.COLON, "Expected ':' after if");
        let block = this.suite();
        let elseStmt = null;
        if (this.match(TokenType.ELIF)) {
            elseStmt = [this.if_stmt()];
        } else if (this.match(TokenType.ELSE)) {
            this.consume(TokenType.COLON, "Expect ':' after else");
            elseStmt = this.suite();
        } else {
            throw new ParserErrors.NoElseBlockError(this.source, start);
        }
        const endToken = this.previous();
        return new StmtNS.If(startToken, endToken, cond, block, elseStmt);
    }

    private while_stmt(): Stmt {
        const startToken = this.peek();
        let cond = this.test();
        this.consume(TokenType.COLON, "Expected ':' after while");
        let block = this.suite();
        const endToken = this.previous();
        return new StmtNS.While(startToken, endToken, cond, block);
    }

    private for_stmt(): Stmt {
        const startToken = this.peek();
        let target = this.advance();
        this.consume(TokenType.IN, "Expected in after for");
        let iter = this.test();
        this.consume(TokenType.COLON, "Expected ':' after for");
        let block = this.suite();
        const endToken = this.previous();
        return new StmtNS.For(startToken, endToken, target, iter, block);
    }

    private funcdef(): Stmt {
        const startToken = this.peek();
        let name = this.advance();
        let args = this.parameters();
        this.consume(TokenType.COLON, "Expected ':' after def");
        let block = this.suite();
        const endToken = this.previous();
        return new StmtNS.FunctionDef(startToken, endToken, name, args, block, []);
    }

    private simple_stmt(): Stmt {
        const startToken = this.peek();
        let res = null;
        if (this.match(TokenType.NAME)) {
            res = this.assign_stmt();
        } else if (this.match(TokenType.PASS)) {
            res = new StmtNS.Pass(startToken, startToken);
        } else if (this.match(TokenType.BREAK)) {
            res = new StmtNS.Break(startToken, startToken);
        } else if (this.match(TokenType.CONTINUE)) {
            res = new StmtNS.Continue(startToken, startToken);
        } else if (this.match(TokenType.RETURN)) {
            res = new StmtNS.Return(startToken, startToken, this.check(TokenType.NEWLINE) ? null : this.test());
        } else if (this.match(TokenType.FROM)) {
            res = this.import_from();
        } else if (this.match(TokenType.GLOBAL)) {
            res = new StmtNS.Global(startToken, startToken, this.advance());
        } else if (this.match(TokenType.NONLOCAL)) {
            res = new StmtNS.NonLocal(startToken, startToken, this.advance());
        } else if (this.match(TokenType.ASSERT)) {
            res = new StmtNS.Assert(startToken, startToken, this.test());
        } else if (this.check(TokenType.LPAR, TokenType.NUMBER, ...SPECIAL_IDENTIFIER_TOKENS)) {
            res = new StmtNS.SimpleExpr(startToken, startToken, this.test());
        } else {
            throw new Error("Unreachable code path");
        }
        this.consume(TokenType.NEWLINE, "Expected newline");
        return res;
    }

    private assign_stmt(): Stmt {
        const startToken = this.previous();
        const name = this.previous();
        if (this.check(TokenType.COLON)) {
            const ann = this.test();
            this.consume(TokenType.EQUAL, "Expect equal in assignment");
            const expr = this.test();
            return new StmtNS.AnnAssign(startToken, this.previous(), name, expr, ann);
        } else if (this.check(TokenType.EQUAL)) {
            this.advance();
            const expr = this.test();
            return new StmtNS.Assign(startToken, this.previous(), name, expr);
        } else {
            this.current--;
            const expr = this.test();
            return new StmtNS.SimpleExpr(startToken, this.previous(), expr);
        }
    }

    private import_from(): Stmt {
        const startToken = this.previous();
        const module = this.advance();
        this.consume(TokenType.IMPORT, "Expected import keyword");
        let params;
        if (this.check(TokenType.NAME)) {
            params = [this.advance()];
        } else {
            params = this.parameters();
        }
        return new StmtNS.FromImport(startToken, this.previous(), module, params);
    }

    private parameters(): Token[] {
        this.consume(TokenType.LPAR, "Expected opening parentheses");
        let res = this.varparamslist();
        this.consume(TokenType.RPAR, "Expected closing parentheses");
        return res;
    }

    private test(): Expr {
        if (this.match(TokenType.LAMBDA)) {
            return this.lambdef();
        } else {
            const startToken = this.peek();
            let consequent = this.or_test();
            if (this.match(TokenType.IF)) {
                const predicate = this.or_test();
                this.consume(TokenType.ELSE, "Expected else")
                const alternative = this.test();
                return new ExprNS.Ternary(startToken, this.previous(), predicate, consequent, alternative);
            }
            return consequent;
        }
    }

    private lambdef(): Expr {
        const startToken = this.previous();
        let args = this.varparamslist();
        if (this.match(TokenType.COLON)) {
            let test = this.test();
            return new ExprNS.Lambda(startToken, this.previous(), args, test);
        } else if (this.match(TokenType.DOUBLECOLON)) {
            let block = this.suite();
            return new ExprNS.MultiLambda(startToken, this.previous(), args, block, []);
        }
        this.consume(TokenType.COLON, "Expected ':' after lambda");
        throw new Error("unreachable code path");
    }

    private suite(): Stmt[] {
        let stmts = [];
        if (this.match(TokenType.NEWLINE)) {
            this.consume(TokenType.INDENT, "Expected indent");
            while (!this.match(TokenType.DEDENT)) {
                stmts.push(this.stmt());
            }
        }
        return stmts;
    }

    private varparamslist(): Token[] {
        let params = [];
        while (!this.check(TokenType.COLON) && !this.check(TokenType.RPAR)) {
            let name = this.consume(TokenType.NAME, "Expected a proper identifier in parameter");
            params.push(name);
            if (!this.match(TokenType.COMMA)) {
                break;
            }
        }
        return params;
    }

    private or_test(): Expr {
        const startToken = this.peek();
        let expr = this.and_test();
        while (this.match(TokenType.OR)) {
            const operator = this.previous();
            const right = this.and_test();
            expr = new ExprNS.BoolOp(startToken, this.previous(), expr, operator, right);
        }
        return expr;
    }

    private and_test(): Expr {
        const startToken = this.peek();
        let expr = this.not_test();
        while (this.match(TokenType.AND)) {
            const operator = this.previous();
            const right = this.not_test();
            expr = new ExprNS.BoolOp(startToken, this.previous(), expr, operator, right);
        }
        return expr;
    }

    private not_test(): Expr {
        const startToken = this.peek();
        if (this.match(TokenType.NOT, TokenType.BANG)) {
            const operator = this.previous();
            return new ExprNS.Unary(startToken, this.previous(), operator, this.not_test());
        }
        return this.comparison();
    }

    private comparison(): Expr {
        const startToken = this.peek();
        let expr = this.arith_expr();
        // @TODO: Add the rest of the comparisons
        while (this.match(
            TokenType.LESS,
            TokenType.GREATER,
            TokenType.DOUBLEEQUAL,
            TokenType.GREATEREQUAL,
            TokenType.LESSEQUAL,
            TokenType.NOTEQUAL,
            TokenType.IS,
            TokenType.ISNOT,
            TokenType.IN,
            TokenType.NOTIN,
        )) {
            const operator = this.previous();
            const right = this.arith_expr();
            expr = new ExprNS.Compare(startToken, this.previous(), expr, operator, right);
        }
        return expr;
    }

    private arith_expr(): Expr {
        const startToken = this.peek();
        let expr = this.term();
        while (this.match(TokenType.PLUS, TokenType.MINUS)) {
            const token = this.previous();
            const right = this.term();
            expr = new ExprNS.Binary(startToken, this.previous(), expr, token, right);
        }
        return expr;
    }

    private term(): Expr {
        const startToken = this.peek();
        let expr = this.factor();
        while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT, TokenType.DOUBLESLASH)) {
            const token = this.previous();
            const right = this.factor();
            expr = new ExprNS.Binary(startToken, this.previous(), expr, token, right);
        }
        return expr;
    }

    private factor(): Expr {
        const startToken = this.peek();
        if (this.match(TokenType.PLUS, TokenType.MINUS)) {
            const op = this.previous();
            const factor = this.factor();
            const endToken = this.previous();
            return new ExprNS.Unary(startToken, endToken, op, factor);
        }
        return this.power();
    }

    private power(): Expr {
        const startToken = this.peek();
        let expr = this.atom_expr();
        if (this.match(TokenType.DOUBLESTAR)) {
            const token = this.previous();
            const right = this.factor();
            const endToken = this.previous();
            return new ExprNS.Binary(startToken, endToken, expr, token, right);
        }
        return expr;
    }


    private atom_expr(): Expr {
        let startToken = this.peek();
        let ato = this.atom();
        let res;
        if (this.match(TokenType.LPAR)) {
            let args = this.arglist();
            const endToken = this.previous();
            res = new ExprNS.Call(startToken, endToken, ato, args);
        } else {
            return ato;
        }
        // To handle things like x()()()
        startToken = this.peek();
        while (this.match(TokenType.LPAR)) {
            let args = this.arglist();
            res = new ExprNS.Call(startToken, this.previous(), res, args);
            startToken = this.peek();
        }
        return res;
    }

    private arglist(): Expr[] {
        let args = [];
        while (!this.check(TokenType.RPAR)) {
            let arg = this.test();
            args.push(arg);
            if (!this.match(TokenType.COMMA)) {
                break;
            }
        }
        this.consume(TokenType.RPAR, "Expected closing ')' after function application");
        return args;
    }

    private atom(): Expr {
        const startToken = this.peek();
        if (this.match(TokenType.TRUE)) return new ExprNS.Literal(startToken, this.previous(), true);
        if (this.match(TokenType.FALSE)) return new ExprNS.Literal(startToken, this.previous(), false);

        if (this.match(TokenType.STRING)) {
            return new ExprNS.Literal(startToken, this.previous(), this.previous().lexeme);
        }
        if (this.match(TokenType.NUMBER)) {
            return new ExprNS.Literal(startToken, this.previous(), Number(this.previous().lexeme));
        }

        if (this.match(TokenType.NAME, ...PSEUD_NAMES)) {
            return new ExprNS.Variable(startToken, this.previous(), this.previous());
        }

        if (this.match(TokenType.LPAR)) {
            let expr = this.test();
            this.consume(TokenType.RPAR, "Expected closing ')'");
            return new ExprNS.Grouping(startToken, this.previous(), expr);
        }
        const startTokenInvalid = this.peek();
        this.synchronize();
        const endTokenInvalid = this.peek();
        throw new ParserErrors.GenericUnexpectedSyntaxError(startToken.line, startToken.col, this.source,
            startTokenInvalid.indexInSource, endTokenInvalid.indexInSource);
    }

    //// INVALID RULES
    private parse_invalid(startToken: Token, endToken: Token) {
        // @TODO invalid rules

    }
}

