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
import Expr = ExprNS.Expr;
import Stmt = StmtNS.Stmt;


export class Parser {
    private readonly source: string;
    private readonly pass: StmtNS.Pass;
    private readonly tokens: Token[];
    private current: number;

    constructor(source: string, tokens: Token[]) {
        this.source = source;
        this.pass = new StmtNS.Pass();
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
        const statements: Stmt[] = [];
        while (!this.isAtEnd()) {
            if (this.match(TokenType.NEWLINE)) {
                continue;
            }
            statements.push(this.stmt());
        }
        return new StmtNS.FileInput(statements.length > 0 ? statements : null, null);
    }

    private stmt(): Stmt {
        if (this.check(TokenType.DEF, TokenType.FOR, TokenType.IF, TokenType.WHILE)) {
            console.log("Compound")
            console.log(this.tokens[this.current]);
            return this.compound_stmt();
        } else if (this.check(TokenType.NAME, TokenType.NUMBER, TokenType.PASS, TokenType.BREAK, TokenType.CONTINUE,
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
        return new StmtNS.If(cond, block, elseStmt);
    }

    private while_stmt(): Stmt {
        let cond = this.test();
        this.consume(TokenType.COLON, "Expected ':' after while");
        let block = this.suite();
        return new StmtNS.While(cond, block);
    }

    private for_stmt(): Stmt {
        let target = this.advance();
        this.consume(TokenType.IN, "Expected in after for");
        let iter = this.test();
        this.consume(TokenType.COLON, "Expected ':' after for");
        let block = this.suite();
        return new StmtNS.For(target, iter, block);
    }

    private funcdef(): Stmt {
        let name = this.advance();
        let args = this.parameters();
        this.consume(TokenType.COLON, "Expected ':' after def");
        let block = this.suite();
        return new StmtNS.FunctionDef(name, args, block, null);
    }

    private simple_stmt(): Stmt {
        let res = null;
        if (this.match(TokenType.NAME)) {
            res = this.assign_stmt();
        } else if (this.match(TokenType.PASS)) {
            res = this.pass;
        } else if (this.match(TokenType.BREAK)) {
            res = new StmtNS.Break();
        } else if (this.match(TokenType.CONTINUE)) {
            res = new StmtNS.Continue();
        } else if (this.match(TokenType.RETURN)) {
            res = new StmtNS.Return(this.check(TokenType.NEWLINE) ? null : this.test());
        } else if (this.match(TokenType.FROM)) {
            res = this.import_from();
        } else if (this.match(TokenType.GLOBAL)) {
            res = new StmtNS.Global(this.advance());
        } else if (this.match(TokenType.NONLOCAL)) {
            res = new StmtNS.NonLocal(this.advance());
        } else if (this.match(TokenType.ASSERT)) {
            res = new StmtNS.Assert(this.test());
        } else if (this.check(TokenType.LPAR, TokenType.NUMBER, ...SPECIAL_IDENTIFIER_TOKENS)){
            res = new StmtNS.SimpleExpr(this.test());
        } else {
            throw new Error("Unreachable code path");
        }
        this.consume(TokenType.NEWLINE, "Expected newline");
        return res;
    }

    private assign_stmt(): Stmt {
        const name = this.previous();
        if (this.check(TokenType.COLON)) {
            const ann = this.test();
            this.consume(TokenType.EQUAL, "Expect equal in assignment");
            return new StmtNS.AnnAssign(name,  this.test(), ann);
        } else if (this.check(TokenType.EQUAL)) {
            this.advance();
            return new StmtNS.Assign(name, this.test());
        } else {
            this.current--;
            return new StmtNS.SimpleExpr(this.test());
        }
    }

    private import_from(): Stmt {
        const module = this.advance();
        this.consume(TokenType.IMPORT, "Expected import keyword");
        let params;
        if (this.check(TokenType.NAME)) {
            params = [this.advance()];
        } else {
            params = this.parameters();
        }
        return new StmtNS.FromImport(module, params);
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
            let consequent = this.or_test();
            if (this.match(TokenType.IF)) {
                const predicate = this.or_test();
                this.consume(TokenType.ELSE, "Expected else")
                const alternative = this.test();
                return new ExprNS.Ternary(predicate, consequent, alternative);
            }
            return consequent;
        }
    }

    private lambdef(): Expr {
        let args = this.varparamslist();
        if (this.match(TokenType.COLON)) {
            let test = this.test();
            return new ExprNS.Lambda(args, test);
        } else if (this.match(TokenType.DOUBLECOLON)) {
            let block = this.suite();
            return new ExprNS.MultiLambda(args, block, null);
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
        let expr = this.and_test();
        while (this.match(TokenType.OR)) {
            const operator = this.previous();
            const right = this.and_test();
            expr = new ExprNS.BoolOp(expr, operator, right);
        }
        return expr;
    }

    private and_test(): Expr {
        let expr = this.not_test();
        while (this.match(TokenType.AND)) {
            const operator = this.previous();
            const right = this.not_test();
            expr = new ExprNS.BoolOp(expr, operator, right);
        }
        return expr;
    }

    private not_test(): Expr {
        if (this.match(TokenType.NOT, TokenType.BANG)) {
            const operator = this.previous();
            return new ExprNS.Unary(operator, this.not_test());
        }
        return this.comparison();
    }

    private comparison(): Expr {
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
            expr = new ExprNS.Compare(expr, operator, right);
        }
        return expr;
    }

    private arith_expr(): Expr {
        let expr = this.term();
        while (this.match(TokenType.PLUS, TokenType.MINUS)) {
            const token = this.previous();
            const right = this.term();
            expr = new ExprNS.Binary(expr, token, right);
        }
        return expr;
    }

    private term(): Expr {
        let expr = this.factor();
        while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT, TokenType.DOUBLESLASH)) {
            const token = this.previous();
            const right = this.factor();
            expr = new ExprNS.Binary(expr, token, right);
        }
        return expr;
    }

    private factor(): Expr {
        if (this.match(TokenType.PLUS, TokenType.MINUS)) {
            return new ExprNS.Unary(this.previous(), this.factor());
        }
        return this.power();
    }

    private power(): Expr {
        let expr = this.atom_expr();
        if (this.match(TokenType.DOUBLESTAR)) {
            const token = this.previous();
            const right = this.factor();
            return new ExprNS.Binary(expr, token, right);
        }
        return expr;
    }


    private atom_expr(): Expr {
        let ato = this.atom();
        if (this.check(TokenType.LPAR)) {
            this.advance();
            let args = this.arglist();
            return new ExprNS.Call(ato, args);
        }
        return ato;
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
        if (this.match(TokenType.TRUE)) return new ExprNS.Literal(true);
        if (this.match(TokenType.FALSE)) return new ExprNS.Literal(false);

        if (this.match(TokenType.STRING)) {
            return new ExprNS.Literal(this.previous().lexeme);
        }
        if (this.match(TokenType.NUMBER)) {
            return new ExprNS.Literal(Number(this.previous().lexeme));
        }

        if (this.match(TokenType.NAME)) {
            return new ExprNS.Variable(this.previous());
        }

        if (this.match(TokenType.LPAR)) {
            let expr = this.test();
            this.consume(TokenType.RPAR, "Expected closing ')'");
            return new ExprNS.Grouping(expr);
        }
        const startToken = this.peek();
        this.synchronize();
        const endToken = this.peek();
        throw new ParserErrors.GenericUnexpectedSyntaxError(startToken.line, startToken.col, this.source,
            startToken.indexInSource, endToken.indexInSource);
    }

    //// INVALID RULES
    private parse_invalid(startToken: Token, endToken: Token) {
        // @TODO invalid rules

    }
}

