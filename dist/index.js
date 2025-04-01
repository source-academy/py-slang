(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.PySlangRunner = {}));
})(this, (function (exports) { 'use strict';

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise, SuppressedError, Symbol, Iterator */


    function __esDecorate(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
        function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
        var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
        var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
        var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
        var _, done = false;
        for (var i = decorators.length - 1; i >= 0; i--) {
            var context = {};
            for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
            for (var p in contextIn.access) context.access[p] = contextIn.access[p];
            context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
            var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
            if (kind === "accessor") {
                if (result === void 0) continue;
                if (result === null || typeof result !== "object") throw new TypeError("Object expected");
                if (_ = accept(result.get)) descriptor.get = _;
                if (_ = accept(result.set)) descriptor.set = _;
                if (_ = accept(result.init)) initializers.unshift(_);
            }
            else if (_ = accept(result)) {
                if (kind === "field") initializers.unshift(_);
                else descriptor[key] = _;
            }
        }
        if (target) Object.defineProperty(target, contextIn.name, descriptor);
        done = true;
    }
    function __runInitializers(thisArg, initializers, value) {
        var useValue = arguments.length > 2;
        for (var i = 0; i < initializers.length; i++) {
            value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
        }
        return useValue ? value : void 0;
    }
    function __setFunctionName(f, name, prefix) {
        if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
        return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
    }
    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
        var e = new Error(message);
        return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
    };

    // Token names mostly identical to CPython https://github.com/python/cpython/blob/main/Lib/token.py.
    // Main difference is that keywords are also a token type while in CPython they are generic name.
    // We could also resolve special names at AST parse time.
    // Also renamed some token names to make more sense.
    var TokenType;
    (function (TokenType) {
        //// Source S1
        TokenType[TokenType["ENDMARKER"] = 0] = "ENDMARKER";
        TokenType[TokenType["NAME"] = 1] = "NAME";
        TokenType[TokenType["NUMBER"] = 2] = "NUMBER";
        TokenType[TokenType["BIGINT"] = 3] = "BIGINT";
        TokenType[TokenType["STRING"] = 4] = "STRING";
        TokenType[TokenType["NEWLINE"] = 5] = "NEWLINE";
        TokenType[TokenType["INDENT"] = 6] = "INDENT";
        TokenType[TokenType["DEDENT"] = 7] = "DEDENT";
        TokenType[TokenType["LPAR"] = 8] = "LPAR";
        TokenType[TokenType["RPAR"] = 9] = "RPAR";
        TokenType[TokenType["COLON"] = 10] = "COLON";
        TokenType[TokenType["DOUBLECOLON"] = 11] = "DOUBLECOLON";
        TokenType[TokenType["COMMA"] = 12] = "COMMA";
        TokenType[TokenType["PLUS"] = 13] = "PLUS";
        TokenType[TokenType["MINUS"] = 14] = "MINUS";
        TokenType[TokenType["BANG"] = 15] = "BANG";
        TokenType[TokenType["STAR"] = 16] = "STAR";
        TokenType[TokenType["SLASH"] = 17] = "SLASH";
        TokenType[TokenType["VBAR"] = 18] = "VBAR";
        TokenType[TokenType["AMPER"] = 19] = "AMPER";
        TokenType[TokenType["LESS"] = 20] = "LESS";
        TokenType[TokenType["GREATER"] = 21] = "GREATER";
        TokenType[TokenType["EQUAL"] = 22] = "EQUAL";
        TokenType[TokenType["PERCENT"] = 23] = "PERCENT";
        TokenType[TokenType["DOUBLEEQUAL"] = 24] = "DOUBLEEQUAL";
        TokenType[TokenType["NOTEQUAL"] = 25] = "NOTEQUAL";
        TokenType[TokenType["LESSEQUAL"] = 26] = "LESSEQUAL";
        TokenType[TokenType["GREATEREQUAL"] = 27] = "GREATEREQUAL";
        TokenType[TokenType["DOUBLESTAR"] = 28] = "DOUBLESTAR";
        TokenType[TokenType["COMPLEX"] = 29] = "COMPLEX";
        // Special identifiers
        TokenType[TokenType["AND"] = 30] = "AND";
        TokenType[TokenType["OR"] = 31] = "OR";
        TokenType[TokenType["FOR"] = 32] = "FOR";
        TokenType[TokenType["WHILE"] = 33] = "WHILE";
        TokenType[TokenType["NONE"] = 34] = "NONE";
        TokenType[TokenType["TRUE"] = 35] = "TRUE";
        TokenType[TokenType["FALSE"] = 36] = "FALSE";
        TokenType[TokenType["IS"] = 37] = "IS";
        TokenType[TokenType["NOT"] = 38] = "NOT";
        TokenType[TokenType["ISNOT"] = 39] = "ISNOT";
        TokenType[TokenType["PASS"] = 40] = "PASS";
        TokenType[TokenType["DEF"] = 41] = "DEF";
        TokenType[TokenType["LAMBDA"] = 42] = "LAMBDA";
        TokenType[TokenType["FROM"] = 43] = "FROM";
        TokenType[TokenType["DOUBLESLASH"] = 44] = "DOUBLESLASH";
        TokenType[TokenType["BREAK"] = 45] = "BREAK";
        TokenType[TokenType["CONTINUE"] = 46] = "CONTINUE";
        TokenType[TokenType["RETURN"] = 47] = "RETURN";
        TokenType[TokenType["ASSERT"] = 48] = "ASSERT";
        TokenType[TokenType["IMPORT"] = 49] = "IMPORT";
        TokenType[TokenType["GLOBAL"] = 50] = "GLOBAL";
        TokenType[TokenType["NONLOCAL"] = 51] = "NONLOCAL";
        TokenType[TokenType["IF"] = 52] = "IF";
        TokenType[TokenType["ELSE"] = 53] = "ELSE";
        TokenType[TokenType["ELIF"] = 54] = "ELIF";
        TokenType[TokenType["IN"] = 55] = "IN";
        TokenType[TokenType["NOTIN"] = 56] = "NOTIN";
        //// Source s3
        TokenType[TokenType["RSQB"] = 57] = "RSQB";
        TokenType[TokenType["LSQB"] = 58] = "LSQB";
        TokenType[TokenType["ELLIPSIS"] = 59] = "ELLIPSIS";
        //// Unusued - Found in normal Python
        TokenType[TokenType["SEMI"] = 60] = "SEMI";
        TokenType[TokenType["DOT"] = 61] = "DOT";
        TokenType[TokenType["LBRACE"] = 62] = "LBRACE";
        TokenType[TokenType["RBRACE"] = 63] = "RBRACE";
        TokenType[TokenType["TILDE"] = 64] = "TILDE";
        TokenType[TokenType["CIRCUMFLEX"] = 65] = "CIRCUMFLEX";
        TokenType[TokenType["LEFTSHIFT"] = 66] = "LEFTSHIFT";
        TokenType[TokenType["RIGHTSHIFT"] = 67] = "RIGHTSHIFT";
        TokenType[TokenType["PLUSEQUAL"] = 68] = "PLUSEQUAL";
        TokenType[TokenType["MINEQUAL"] = 69] = "MINEQUAL";
        TokenType[TokenType["STAREQUAL"] = 70] = "STAREQUAL";
        TokenType[TokenType["SLASHEQUAL"] = 71] = "SLASHEQUAL";
        TokenType[TokenType["PERCENTEQUAL"] = 72] = "PERCENTEQUAL";
        TokenType[TokenType["AMPEREQUAL"] = 73] = "AMPEREQUAL";
        TokenType[TokenType["VBAREQUAL"] = 74] = "VBAREQUAL";
        TokenType[TokenType["CIRCUMFLEXEQUAL"] = 75] = "CIRCUMFLEXEQUAL";
        TokenType[TokenType["LEFTSHIFTEQUAL"] = 76] = "LEFTSHIFTEQUAL";
        TokenType[TokenType["RIGHTSHIFTEQUAL"] = 77] = "RIGHTSHIFTEQUAL";
        TokenType[TokenType["DOUBLESTAREQUAL"] = 78] = "DOUBLESTAREQUAL";
        TokenType[TokenType["DOUBLESLASHEQUAL"] = 79] = "DOUBLESLASHEQUAL";
        TokenType[TokenType["AT"] = 80] = "AT";
        TokenType[TokenType["ATEQUAL"] = 81] = "ATEQUAL";
        TokenType[TokenType["RARROW"] = 82] = "RARROW";
        TokenType[TokenType["COLONEQUAL"] = 83] = "COLONEQUAL";
        TokenType[TokenType["OP"] = 84] = "OP";
        TokenType[TokenType["AWAIT"] = 85] = "AWAIT";
        TokenType[TokenType["ASYNC"] = 86] = "ASYNC";
        TokenType[TokenType["TYPE_IGNORE"] = 87] = "TYPE_IGNORE";
        TokenType[TokenType["TYPE_COMMENT"] = 88] = "TYPE_COMMENT";
        TokenType[TokenType["YIELD"] = 89] = "YIELD";
        TokenType[TokenType["WITH"] = 90] = "WITH";
        TokenType[TokenType["DEL"] = 91] = "DEL";
        TokenType[TokenType["TRY"] = 92] = "TRY";
        TokenType[TokenType["EXCEPT"] = 93] = "EXCEPT";
        TokenType[TokenType["FINALLY"] = 94] = "FINALLY";
        TokenType[TokenType["RAISE"] = 95] = "RAISE";
    })(TokenType || (TokenType = {}));

    /*
        The offset is calculated as follows:
        Current position is one after real position of end of token: 1
    */
    const MAGIC_OFFSET = 1;
    const SPECIAL_CHARS = new RegExp("[\\\\$'\"]", "g");
    function escape(unsafe) {
        // @TODO escape newlines
        return unsafe.replace(SPECIAL_CHARS, "\\$&");
    }
    /* Searches backwards and forwards till it hits a newline */
    function getFullLine(source, current) {
        let back = current;
        let forward = current;
        while (back > 0 && source[back] != '\n') {
            back--;
        }
        if (source[back] === '\n') {
            back++;
        }
        while (forward < source.length && source[forward] != '\n') {
            forward++;
        }
        return '\n' + source.slice(back, forward);
    }
    function toEstreeLocation(line, column, offset) {
        return { line, column, offset };
    }
    exports.TokenizerErrors = void 0;
    (function (TokenizerErrors) {
        class BaseTokenizerError extends SyntaxError {
            constructor(message, line, col) {
                super(`SyntaxError at line ${line} column ${col - 1}
                   ${message}`);
                this.line = line;
                this.col = col;
                this.name = "BaseTokenizerError";
                this.loc = toEstreeLocation(line, col, 0);
            }
        }
        TokenizerErrors.BaseTokenizerError = BaseTokenizerError;
        class UnknownTokenError extends BaseTokenizerError {
            constructor(token, line, col, source, current) {
                let msg = getFullLine(source, current - 1) + "\n";
                let hint = `${col > 1 ? '~' : ''}^~ Unknown token '${escape(token)}'`;
                // The extra `~` character takes up some space.
                hint = hint.padStart(hint.length + col - MAGIC_OFFSET - (col > 1 ? 1 : 0), " ");
                super(msg + hint, line, col);
                this.name = "UnknownTokenError";
            }
        }
        TokenizerErrors.UnknownTokenError = UnknownTokenError;
        class UnterminatedStringError extends BaseTokenizerError {
            constructor(line, col, source, start, current) {
                let msg = getFullLine(source, start) + "\n";
                let hint = `^ Unterminated string`;
                const diff = (current - start);
                // +1 because we want the arrow to point after the string (where we expect the closing ")
                hint = hint.padStart(hint.length + diff - MAGIC_OFFSET + 1, "~");
                hint = hint.padStart(hint.length + col - diff, " ");
                super(msg + hint, line, col);
                this.name = "UnterminatedStringError";
            }
        }
        TokenizerErrors.UnterminatedStringError = UnterminatedStringError;
        class NonFourIndentError extends BaseTokenizerError {
            constructor(line, col, source, start) {
                let msg = getFullLine(source, start) + "\n";
                let hint = `^ This indent should be a multiple of 4 spaces. It's currently ${col} spaces.`;
                hint = hint.padStart(hint.length + col - MAGIC_OFFSET, "-");
                super(msg + hint, line, col);
                this.name = "NonFourIndentError";
            }
        }
        TokenizerErrors.NonFourIndentError = NonFourIndentError;
        class InvalidNumberError extends BaseTokenizerError {
            constructor(line, col, source, start, current) {
                let msg = getFullLine(source, start) + "\n";
                let hint = `^ Invalid Number input.`;
                const diff = (current - start);
                // +1 because we want the arrow to point after the string (where we expect the closing ")
                hint = hint.padStart(hint.length + diff - MAGIC_OFFSET + 1, "~");
                hint = hint.padStart(hint.length + col - diff, " ");
                super(msg + hint, line, col);
                this.name = "InvalidNumberError";
            }
        }
        TokenizerErrors.InvalidNumberError = InvalidNumberError;
        class InconsistentIndentError extends BaseTokenizerError {
            constructor(line, col, source, start) {
                let msg = getFullLine(source, start) + "\n";
                let hint = `^ This indent/dedent is inconsistent with other indents/dedents. It's currently ${col} spaces.`;
                hint = hint.padStart(hint.length + col - MAGIC_OFFSET, "-");
                super(msg + hint, line, col);
                this.name = "InconsistentIndentError";
            }
        }
        TokenizerErrors.InconsistentIndentError = InconsistentIndentError;
        class ForbiddenIdentifierError extends BaseTokenizerError {
            constructor(line, col, source, start) {
                let msg = getFullLine(source, start) + "\n";
                let hint = `^ This identifier is reserved for use in Python. Consider using another identifier.`;
                hint = hint.padStart(hint.length + col - MAGIC_OFFSET, "^");
                super(msg + hint, line, col);
                this.name = "ForbiddenIdentifierError";
            }
        }
        TokenizerErrors.ForbiddenIdentifierError = ForbiddenIdentifierError;
        class ForbiddenOperatorError extends BaseTokenizerError {
            constructor(line, col, source, start, current) {
                let msg = getFullLine(source, start) + "\n";
                let hint = ` This operator is reserved for use in Python. It's not allowed to be used.`;
                const diff = (current - start);
                hint = hint.padStart(hint.length + diff - MAGIC_OFFSET + 1, "^");
                hint = hint.padStart(hint.length + col - diff, " ");
                super(msg + hint, line, col);
                this.name = "ForbiddenOperatorError";
            }
        }
        TokenizerErrors.ForbiddenOperatorError = ForbiddenOperatorError;
        class NonMatchingParenthesesError extends BaseTokenizerError {
            constructor(line, col, source, current) {
                let msg = getFullLine(source, current - 1) + "\n";
                let hint = `${col > 1 ? '~' : ''}^~ Non-matching closing parentheses.`;
                // The extra `~` character takes up some space.
                hint = hint.padStart(hint.length + col - MAGIC_OFFSET - (col > 1 ? 1 : 0), " ");
                super(msg + hint, line, col);
                this.name = "NonMatchingParenthesesError";
            }
        }
        TokenizerErrors.NonMatchingParenthesesError = NonMatchingParenthesesError;
    })(exports.TokenizerErrors || (exports.TokenizerErrors = {}));
    exports.ParserErrors = void 0;
    (function (ParserErrors) {
        class BaseParserError extends SyntaxError {
            constructor(message, line, col) {
                super(`SyntaxError at line ${line} column ${col - 1}
                   ${message}`);
                this.line = line;
                this.col = col;
                this.name = "BaseParserError";
                this.loc = toEstreeLocation(line, col, 0);
            }
        }
        ParserErrors.BaseParserError = BaseParserError;
        class ExpectedTokenError extends BaseParserError {
            constructor(source, current, expected) {
                let msg = getFullLine(source, current.indexInSource - current.lexeme.length) + "\n";
                let hint = `^ ${expected}. Found '${escape(current.lexeme)}'.`;
                hint = hint.padStart(hint.length + current.col - MAGIC_OFFSET, " ");
                super(msg + hint, current.line, current.col);
                this.name = "ExpectedTokenError";
            }
        }
        ParserErrors.ExpectedTokenError = ExpectedTokenError;
        class NoElseBlockError extends BaseParserError {
            constructor(source, current) {
                let msg = getFullLine(source, current.indexInSource) + "\n";
                let hint = `^ Expected else block after this if block.`;
                hint = hint.padStart(hint.length + current.col - MAGIC_OFFSET, " ");
                super(msg + hint, current.line, current.col);
                this.name = "ExpectedTokenError";
            }
        }
        ParserErrors.NoElseBlockError = NoElseBlockError;
        class GenericUnexpectedSyntaxError extends BaseParserError {
            constructor(line, col, source, start, current) {
                let msg = getFullLine(source, start) + "\n";
                let hint = ` Detected invalid syntax.`;
                const diff = (current - start);
                hint = hint.padStart(hint.length + diff - MAGIC_OFFSET, "^");
                hint = hint.padStart(hint.length + col - diff, " ");
                super(msg + hint, line, col);
                this.name = "GenericUnexpectedSyntaxError";
            }
        }
        ParserErrors.GenericUnexpectedSyntaxError = GenericUnexpectedSyntaxError;
    })(exports.ParserErrors || (exports.ParserErrors = {}));
    exports.ResolverErrors = void 0;
    (function (ResolverErrors) {
        class BaseResolverError extends SyntaxError {
            constructor(message, line, col) {
                super(`ResolverError at line ${line} column ${col - 1}
                   ${message}`);
                this.line = line;
                this.col = col;
                this.name = "BaseResolverError";
                this.loc = toEstreeLocation(line, col, 0);
            }
        }
        ResolverErrors.BaseResolverError = BaseResolverError;
        class NameNotFoundError extends BaseResolverError {
            constructor(line, col, source, start, current, suggestion) {
                let msg = getFullLine(source, start) + "\n";
                let hint = ` This name is not found in the current or enclosing environment(s).`;
                const diff = (current - start);
                hint = hint.padStart(hint.length + diff - MAGIC_OFFSET + 1, "^");
                hint = hint.padStart(hint.length + col - diff, " ");
                if (suggestion !== null) {
                    let sugg = ` Perhaps you meant to type '${suggestion}'?`;
                    sugg = sugg.padStart(sugg.length + col - MAGIC_OFFSET + 1, " ");
                    sugg = '\n' + sugg;
                    hint += sugg;
                }
                super(msg + hint, line, col);
                this.name = "NameNotFoundError";
            }
        }
        ResolverErrors.NameNotFoundError = NameNotFoundError;
        class NameReassignmentError extends BaseResolverError {
            constructor(line, col, source, start, current, oldName) {
                let msg = getFullLine(source, start) + "\n";
                let hint = ` A name has been declared here.`;
                const diff = (current - start);
                hint = hint.padStart(hint.length + diff - MAGIC_OFFSET + 1, "^");
                hint = hint.padStart(hint.length + col - diff, " ");
                let sugg = ` However, it has already been declared in the same environment at line ${oldName.line}, here:`;
                sugg = sugg.padStart(sugg.length + col - MAGIC_OFFSET + 1, " ");
                sugg = '\n' + sugg;
                hint += sugg;
                let oldNameLine = getFullLine(source, oldName.indexInSource);
                oldNameLine.padStart(oldNameLine.length + col - MAGIC_OFFSET + 1, " ");
                hint += oldNameLine;
                super(msg + hint, line, col);
                this.name = "NameReassignmentError";
            }
        }
        ResolverErrors.NameReassignmentError = NameReassignmentError;
    })(exports.ResolverErrors || (exports.ResolverErrors = {}));
    exports.TranslatorErrors = void 0;
    (function (TranslatorErrors) {
        class BaseTranslatorError extends SyntaxError {
            constructor(message, line, col) {
                super(`BaseTranslatorError at line ${line} column ${col - 1}
                   ${message}`);
                this.line = line;
                this.col = col;
                this.name = "BaseTranslatorError";
                this.loc = toEstreeLocation(line, col, 0);
            }
        }
        TranslatorErrors.BaseTranslatorError = BaseTranslatorError;
        class UnsupportedOperator extends BaseTranslatorError {
            constructor(line, col, source, start) {
                let msg = getFullLine(source, start) + "\n";
                let hint = `^ This operator is not yet supported by us.`;
                hint = hint.padStart(hint.length + col - MAGIC_OFFSET, " ");
                super(msg + hint, line, col);
                this.name = "UnsupportedOperator";
            }
        }
        TranslatorErrors.UnsupportedOperator = UnsupportedOperator;
    })(exports.TranslatorErrors || (exports.TranslatorErrors = {}));

    /*
    * Full disclosure: The general structure of this file is adapted from my own
    * Rust implementation of a scanner
    * https://github.com/Fidget-Spinner/crafting_interpreters/blob/main/rust/src/scanner.rs.
    * That is in turn is adapted from the Java code written by the excellent book,
    * "Crafting Interpreters" https://craftinginterpreters.com/scanning.html.
    * Said book's copyright is under Robert Nystrom.
    * I've included the MIT license that code snippets from
    * the book is licensed under down below. See
    * https://github.com/munificent/craftinginterpreters/blob/master/LICENSE
    *
    * The changes I've made: I have rewritten basically everything from scratch.
    * Only the method names and overall method APIs
    * are the same. Their internal behaviors are quite different as the scanner
    * in the book parses a JS-like language, not Python.
    *
    * - The book was written in Java. I have written this in TypeScript.
    * - The scanner supports a whitespace significant language now.
    * - Also added support for column numbers for better error messages in the future.
    * - Also added better errors.
    * - Also added forbidden identifiers.
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
    * */
    class Token {
        constructor(type, lexeme, line, col, indexInSource) {
            this.type = type;
            this.lexeme = lexeme;
            this.line = line;
            this.col = col;
            this.indexInSource = indexInSource;
        }
    }
    const specialIdentifiers = new Map([
        ["and", TokenType.AND],
        ["or", TokenType.OR],
        ["while", TokenType.WHILE],
        ["for", TokenType.FOR],
        ["None", TokenType.NONE],
        ["is", TokenType.IS],
        ["not", TokenType.NOT],
        ["pass", TokenType.PASS],
        ["def", TokenType.DEF],
        ["lambda", TokenType.LAMBDA],
        ["from", TokenType.FROM],
        ["True", TokenType.TRUE],
        ["False", TokenType.FALSE],
        ["break", TokenType.BREAK],
        ["continue", TokenType.CONTINUE],
        ["return", TokenType.RETURN],
        ["assert", TokenType.ASSERT],
        ["import", TokenType.IMPORT],
        ["global", TokenType.GLOBAL],
        ["nonlocal", TokenType.NONLOCAL],
        ["if", TokenType.IF],
        ["elif", TokenType.ELIF],
        ["else", TokenType.ELSE],
        ["in", TokenType.IN],
    ]);
    const SPECIAL_IDENTIFIER_TOKENS = Array.from(specialIdentifiers.values());
    class Tokenizer {
        // forbiddenOperators: Set<TokenType>;
        constructor(source) {
            this.lexemeBuffer = "";
            this.source = source;
            this.tokens = [];
            this.start = 0;
            this.current = 0;
            this.line = 0;
            this.col = 0;
            this.indentStack = [0];
            this.specialIdentifiers = specialIdentifiers;
            // Not used by us, but should be kept reserved as per Python spec
            this.forbiddenIdentifiers = new Map([
                ["async", TokenType.ASYNC],
                ["await", TokenType.AWAIT],
                ["yield", TokenType.YIELD],
                ["with", TokenType.WITH],
                ["del", TokenType.DEL],
                ["try", TokenType.TRY],
                ["except", TokenType.EXCEPT],
                ["finally", TokenType.FINALLY],
                ["raise", TokenType.RAISE],
            ]);
            // Operators that are valid in Python, but invalid for our use case.
            // this.forbiddenOperators = new Set([
            //     TokenType.AT,
            //     // Augmented assign e.g. *=
            //     TokenType.ATEQUAL,
            //     TokenType.PLUSEQUAL,
            //     TokenType.MINEQUAL,
            //     TokenType.STAREQUAL,
            //     TokenType.SLASHEQUAL,
            //     TokenType.PERCENTEQUAL,
            //     TokenType.AMPEREQUAL,
            //     TokenType.VBAREQUAL,
            //     TokenType.CIRCUMFLEXEQUAL,
            //     TokenType.LEFTSHIFTEQUAL,
            //     TokenType.RIGHTSHIFTEQUAL,
            //     TokenType.DOUBLESTAREQUAL,
            //     TokenType.DOUBLESLASHEQUAL,
            // ])
            this.parenthesesLevel = 0;
        }
        isAtEnd() {
            return this.current >= this.source.length;
        }
        advance() {
            const res = this.source[this.current];
            if (this.peek() == '\n') {
                this.line += 1;
            }
            this.current += 1;
            this.col += 1;
            return res;
        }
        advanceString(record) {
            const res = this.source[this.current];
            if (this.peek() == '\n') {
                this.line += 1;
            }
            this.current += 1;
            this.col += 1;
            if (record) {
                this.lexemeBuffer += res;
            }
            return res;
        }
        getBuffer() {
            console.info(this.lexemeBuffer);
        }
        addBuffer(c) {
            this.lexemeBuffer += c;
        }
        subtractBufferForThreeQuoteString() {
            if (this.lexemeBuffer.length >= 3) {
                this.lexemeBuffer = this.lexemeBuffer.slice(0, -3);
                return true;
            }
            else {
                return false;
            }
        }
        /* Single character lookahead. */
        peek() {
            return this.isAtEnd() ? '\0' : this.source[this.current];
        }
        /* Double character lookahead. */
        overwriteToken(type) {
            const previousToken = this.tokens[this.tokens.length - 1];
            const lexeme = this.source.slice(previousToken.indexInSource, this.current);
            this.tokens[this.tokens.length - 1] = new Token(type, lexeme, previousToken.line, previousToken.col, previousToken.indexInSource);
        }
        addToken(type) {
            const line = this.line;
            const col = this.col;
            const lexeme = this.source.slice(this.start, this.current);
            this.tokens.push(new Token(type, lexeme, line, col, this.current - lexeme.length));
        }
        addStringToken(type) {
            const line = this.line;
            const col = this.col;
            // Remove starting and ending quotes when slicing
            // Ensures that string is parsed properly
            const lexeme = this.source.slice(this.start + 1, this.current - 1);
            this.tokens.push(new Token(type, this.lexemeBuffer, line, col, this.current - lexeme.length));
            this.lexemeBuffer = "";
        }
        addMultiLineStringToken(type) {
            const line = this.line;
            const col = this.col;
            // Remove three starting and ending quotes when slicing
            const lexeme = this.source.slice(this.start + 3, this.current - 3);
            this.tokens.push(new Token(type, this.lexemeBuffer, line, col, this.current - lexeme.length));
            this.lexemeBuffer = "";
        }
        // Checks that the current character matches a pattern. If so the character is consumed, else nothing is consumed.
        matches(pattern) {
            if (this.isAtEnd()) {
                return false;
            }
            else {
                if (this.source[this.current] === pattern) {
                    this.col += 1;
                    this.current += 1;
                    return true;
                }
                return false;
            }
        }
        isLegalUnicode(c) {
            if (this.isDelimiter(c)) {
                return false;
            }
            return c.length === 1 && !/^\p{Nd}$/u.test(c);
        }
        isAlpha(c) {
            return /^[A-Za-z]$/i.test(c);
        }
        isDigit(c) {
            return /^[0-9]/.test(c);
        }
        isHexa(c) {
            return /^[0-9A-F]$/i.test(c);
        }
        isOcta(c) {
            return /^[0-7]/.test(c);
        }
        isBinary(c) {
            return /^[0-1]/.test(c);
        }
        // TODO: unicode
        isIdentifier(c) {
            if (/\s/.test(c)) {
                return false;
            }
            return c === '_' || this.isAlpha(c) || this.isDigit(c) || this.isLegalUnicode(c);
        }
        isDelimiter(c) {
            return /[\p{P}\p{S}]/u.test(c);
        }
        baseNumber() {
            switch (this.peek()) {
                case 'x':
                    this.advance();
                    if (!this.isHexa(this.peek())) {
                        throw new exports.TokenizerErrors.InvalidNumberError(this.line, this.col, this.source, this.start, this.current);
                    }
                    while (this.isHexa(this.peek())) {
                        this.advance();
                    }
                    this.addToken(TokenType.BIGINT);
                    break;
                case 'o':
                    this.advance();
                    if (!this.isOcta(this.peek())) {
                        throw new exports.TokenizerErrors.InvalidNumberError(this.line, this.col, this.source, this.start, this.current);
                    }
                    while (this.isOcta(this.peek())) {
                        this.advance();
                    }
                    this.addToken(TokenType.BIGINT);
                    break;
                case 'b':
                    this.advance();
                    if (!this.isBinary(this.peek())) {
                        throw new exports.TokenizerErrors.InvalidNumberError(this.line, this.col, this.source, this.start, this.current);
                    }
                    while (this.isBinary(this.peek())) {
                        this.advance();
                    }
                    this.addToken(TokenType.BIGINT);
                    break;
                default:
                    while (this.isDigit(this.peek())) {
                        this.advance();
                    }
                    if (this.peek() !== '.' && this.peek() !== 'e') {
                        // if ends with j and J then complex number
                        if (this.peek() === 'j' || this.peek() === 'J') {
                            this.advance();
                            this.addToken(TokenType.COMPLEX);
                            return;
                        }
                        this.addToken(TokenType.BIGINT);
                        return;
                    }
                    if (this.peek() === '.') {
                        this.advance();
                        if (this.peek() === '_') {
                            // TODO:
                            // throw new error
                            throw new Error('_ after .');
                        }
                        while (this.isDigit(this.peek())) {
                            this.advance();
                        }
                    }
                    if (this.peek() === '_') {
                        this.advance();
                    }
                    if (this.peek() === 'e') {
                        this.advance();
                        if (this.peek() === '-') {
                            this.advance();
                        }
                        if (this.peek() === '+') {
                            this.advance();
                        }
                        if (!this.isDigit(this.peek())) {
                            throw new exports.TokenizerErrors.InvalidNumberError(this.line, this.col, this.source, this.start, this.current);
                        }
                        while (this.isDigit(this.peek())) {
                            this.advance();
                        }
                    }
                    // if ends with j and J then complex number
                    if (this.peek() === 'j' || this.peek() === 'J') {
                        this.advance();
                        this.addToken(TokenType.COMPLEX);
                    }
                    else {
                        this.addToken(TokenType.NUMBER);
                    }
            }
        }
        number(c) {
            while ((this.isDigit(this.peek()) || this.peek() === '_') && c !== '.') {
                if (this.peek() === '_') {
                    this.advance();
                    if (!this.isDigit(this.peek())) {
                        throw new Error("Invalid use of underscore in number");
                    }
                }
                else {
                    this.advance();
                }
            }
            if (this.peek() !== '.' && this.peek() !== 'e' && c !== '.') {
                // if ends with j and J then complex number
                if (this.peek() === 'j' || this.peek() === 'J') {
                    this.advance();
                    this.addToken(TokenType.COMPLEX);
                    return;
                }
                this.addToken(TokenType.BIGINT);
                return;
            }
            // Fractional part
            if ((this.peek() === '.' && c !== '.') || (this.peek() !== '.' && c === '.')) {
                this.advance();
                if (this.peek() === '_') {
                    // TODO:
                    // throw new error
                    throw new Error('_ after .');
                }
                while (this.isDigit(this.peek()) || this.peek() === '_') {
                    if (this.peek() === '_') {
                        this.advance();
                        if (!this.isDigit(this.peek())) {
                            throw new Error("Invalid use of underscore in number");
                        }
                    }
                    else {
                        this.advance();
                    }
                }
            }
            // Exponent part
            if (this.peek() === 'e') {
                this.advance();
                if (this.peek() === '-') {
                    this.advance();
                }
                if (this.peek() === '+') {
                    this.advance();
                }
                if (!this.isDigit(this.peek())) {
                    throw new exports.TokenizerErrors.InvalidNumberError(this.line, this.col, this.source, this.start, this.current);
                }
                while (this.isDigit(this.peek()) || this.peek() === '_') {
                    if (this.peek() === '_') {
                        this.advance();
                        if (!this.isDigit(this.peek())) {
                            throw new Error("Invalid use of underscore in number");
                        }
                    }
                    else {
                        this.advance();
                    }
                }
            }
            // if ends with j and J then complex number
            if (this.peek() === 'j' || this.peek() === 'J') {
                this.advance();
                this.addToken(TokenType.COMPLEX);
            }
            else {
                this.addToken(TokenType.NUMBER);
            }
            //this.addToken(TokenType.NUMBER);
        }
        name() {
            while (this.isIdentifier(this.peek())) {
                this.advance();
            }
            const identifier = this.source.slice(this.start, this.current);
            if (!!this.forbiddenIdentifiers.get(identifier)) {
                throw new exports.TokenizerErrors.ForbiddenIdentifierError(this.line, this.col, this.source, this.start);
            }
            const specialIdent = this.specialIdentifiers.get(identifier);
            if (specialIdent !== undefined) {
                /* Merge multi-token operators, like 'is not', 'not in' */
                const previousToken = this.tokens[this.tokens.length - 1];
                switch (specialIdent) {
                    case TokenType.NOT:
                        if (previousToken.type === TokenType.IS) {
                            this.overwriteToken(TokenType.ISNOT);
                        }
                        else {
                            this.addToken(specialIdent);
                        }
                        return;
                    case TokenType.IN:
                        if (previousToken.type === TokenType.NOT) {
                            this.overwriteToken(TokenType.NOTIN);
                        }
                        else {
                            this.addToken(specialIdent);
                        }
                        return;
                    default:
                        this.addToken(specialIdent);
                }
            }
            else {
                this.addToken(TokenType.NAME);
            }
        }
        scanToken() {
            const c = this.advance();
            // KJ: I really hope the JS runtime optimizes this to a jump table...
            switch (c) {
                //// SPECIAL MARKERS
                // Comment -- advance to end of line.
                case '#':
                    while ((this.peek() !== '\n' && this.peek() !== '\r') && !this.isAtEnd()) {
                        this.advance();
                    }
                    break;
                case ':':
                    this.addToken(this.matches(':') ? TokenType.DOUBLECOLON : TokenType.COLON);
                    break;
                // All non-significant whitespace
                case ' ':
                    break;
                // CR LF on Windows
                case '\r':
                    if (this.matches('\n')) ;
                    else {
                        break;
                    }
                case '\n':
                    if (this.parenthesesLevel > 0) {
                        this.line += 1;
                        this.col = 0;
                        break;
                    }
                    this.addToken(TokenType.NEWLINE);
                    this.line += 1;
                    this.col = 0;
                    let accLeadingWhiteSpace = 0;
                    // Detect significant whitespace
                    while (this.peek() === " " && !this.isAtEnd()) {
                        accLeadingWhiteSpace += 1;
                        // Consume the rest of the line's leading whitespace.
                        this.advance();
                    }
                    // Handles comments
                    if (this.peek() === "#") {
                        while ((this.peek() !== '\n' && this.peek() !== '\r') && !this.isAtEnd()) {
                            this.advance();
                        }
                    }
                    // The following block handles things like
                    /*
                    def foo():
                        pass
                                 <---- this newline should be zapped
                        pass     <---- this should be part of the block
                     */
                    while ((this.peek() === "\n" || this.peek() === "\r") && !this.isAtEnd()) {
                        // Handle \r\n on Windows
                        if (this.peek() === "\r") {
                            this.advance();
                            if (this.peek() === "\n") {
                                this.advance();
                            }
                        }
                        else {
                            this.advance();
                        }
                        this.line += 1;
                        this.col = 0;
                        accLeadingWhiteSpace = 0;
                        // Detect significant whitespace
                        while (this.peek() === " " && !this.isAtEnd()) {
                            accLeadingWhiteSpace += 1;
                            // Consume the rest of the line's leading whitespace.
                            this.advance();
                        }
                    }
                    if (accLeadingWhiteSpace % 4 !== 0) {
                        throw new exports.TokenizerErrors.NonFourIndentError(this.line, this.col, this.source, this.current);
                    }
                    const tos = this.indentStack[this.indentStack.length - 1];
                    if (accLeadingWhiteSpace > tos) {
                        this.indentStack.push(accLeadingWhiteSpace);
                        const indents = Math.floor((accLeadingWhiteSpace - tos) / 4);
                        for (let i = 0; i < indents; ++i) {
                            this.addToken(TokenType.INDENT);
                        }
                    }
                    else if (accLeadingWhiteSpace < tos) {
                        if (this.indentStack.length == 0) {
                            throw new exports.TokenizerErrors.InconsistentIndentError(this.line, this.col, this.source, this.current);
                        }
                        const prev = this.indentStack[this.indentStack.length - 1];
                        if (prev === undefined || prev === null) {
                            throw new exports.TokenizerErrors.InconsistentIndentError(this.line, this.col, this.source, this.current);
                        }
                        const indents = Math.floor((prev - accLeadingWhiteSpace) / 4);
                        for (let i = 0; i < indents; ++i) {
                            this.indentStack.pop();
                            this.addToken(TokenType.DEDENT);
                        }
                    }
                    break;
                // String
                case '"':
                case "'":
                    let quote = c;
                    if (this.peek() == quote) { // handle multi-line string
                        this.advance(); // second quote found and consumed
                        if (this.peek() != quote) { // empty string ""
                            this.addStringToken(TokenType.STRING);
                            break;
                        }
                        this.advance(); // third quote consumed
                        let quote_sum = 0;
                        while (true) {
                            while (this.peek() != quote && !this.isAtEnd()) {
                                quote_sum = 0;
                                if (this.peek() === '\\') {
                                    this.advanceString(false);
                                    switch (this.peek()) {
                                        case '\n':
                                            break;
                                        case '\\':
                                            this.addBuffer('\\');
                                            break;
                                        case '\'':
                                            this.addBuffer('\'');
                                            break;
                                        case '\"':
                                            this.addBuffer('\"');
                                            break;
                                        case 'a':
                                            this.addBuffer('\a');
                                            break;
                                        case 'b':
                                            this.addBuffer('\b');
                                            break;
                                        case 'f':
                                            this.addBuffer('\f');
                                            break;
                                        case 'n':
                                            this.addBuffer('\n');
                                            break;
                                        case 'r':
                                            this.addBuffer('\r');
                                            break;
                                        case 't':
                                            this.addBuffer('\t');
                                            break;
                                        case 'v':
                                            this.addBuffer('\v');
                                            break;
                                        default:
                                            throw new Error("SyntaxWarning: invalid escape sequence");
                                    }
                                    this.advanceString(false);
                                }
                                else {
                                    this.advanceString(true);
                                }
                                //this.advance(); // advance until ending quote found
                            }
                            if (this.isAtEnd()) {
                                throw new exports.TokenizerErrors.UnterminatedStringError(this.line, this.col, this.source, this.start, this.current);
                            }
                            if (this.peek() == quote) {
                                this.advanceString(true);
                                quote_sum++;
                            }
                            //this.advance(); // consume first ending quote
                            // if (this.peek() != quote) {
                            //     throw new TokenizerErrors.UnterminatedStringError(this.line,
                            //         this.col, this.source, this.start, this.current);
                            // }
                            // this.advance();
                            if (quote_sum === 3) {
                                this.subtractBufferForThreeQuoteString();
                                // console.info('endof3quote');
                                // this.getBuffer();
                                break;
                            }
                        }
                        // // consume second ending quote
                        // if (this.peek() != quote) {
                        //     throw new TokenizerErrors.UnterminatedStringError(this.line,
                        //         this.col, this.source, this.start, this.current);
                        // }
                        // this.advance(); // consume third ending quote
                        this.addMultiLineStringToken(TokenType.STRING);
                    }
                    else { // other case, single-line string
                        while (this.peek() !== quote && this.peek() !== '\n' && !this.isAtEnd()) {
                            if (this.peek() === '\\') {
                                this.advanceString(false);
                                switch (this.peek()) {
                                    case '\n':
                                        break;
                                    case '\\':
                                        this.addBuffer('\\');
                                        break;
                                    case '\'':
                                        this.addBuffer('\'');
                                        break;
                                    case '\"':
                                        this.addBuffer('\"');
                                        break;
                                    case 'a':
                                        this.addBuffer('\a');
                                        break;
                                    case 'b':
                                        this.addBuffer('\b');
                                        break;
                                    case 'f':
                                        this.addBuffer('\f');
                                        break;
                                    case 'n':
                                        this.addBuffer('\n');
                                        break;
                                    case 'r':
                                        this.addBuffer('\r');
                                        break;
                                    case 't':
                                        this.addBuffer('\t');
                                        break;
                                    case 'v':
                                        this.addBuffer('\v');
                                        break;
                                    default:
                                        throw new Error("SyntaxWarning: invalid escape sequence");
                                }
                                this.advanceString(false);
                            }
                            else {
                                this.advanceString(true);
                            }
                        }
                        // should look for \\
                        if (this.peek() === '\n' || this.isAtEnd()) {
                            throw new exports.TokenizerErrors.UnterminatedStringError(this.line, this.col, this.source, this.start, this.current);
                        }
                        // Consume Closing "
                        this.advance();
                        this.addStringToken(TokenType.STRING);
                    }
                    break;
                // Number... I wish JS had match statements :(
                case '0':
                    this.baseNumber();
                    break;
                case '1':
                case '2':
                case '3':
                case '4':
                case '5':
                case '6':
                case '7':
                case '8':
                case '9':
                case '.':
                    this.number(c);
                    break;
                //// Everything else
                case '(':
                    this.addToken(TokenType.LPAR);
                    this.parenthesesLevel++;
                    break;
                case ')':
                    this.addToken(TokenType.RPAR);
                    if (this.parenthesesLevel === 0) {
                        throw new exports.TokenizerErrors.NonMatchingParenthesesError(this.line, this.col, this.source, this.current);
                    }
                    this.parenthesesLevel--;
                    break;
                case ',':
                    this.addToken(TokenType.COMMA);
                    break;
                //// OPERATORS
                case '-':
                    if (this.matches('=')) {
                        this.raiseForbiddenOperator();
                    }
                    this.addToken(TokenType.MINUS);
                    break;
                case '+':
                    if (this.matches('=')) {
                        this.raiseForbiddenOperator();
                    }
                    this.addToken(TokenType.PLUS);
                    break;
                case '*':
                    if (this.matches('=')) {
                        this.raiseForbiddenOperator();
                    }
                    this.addToken(this.matches('*') ? TokenType.DOUBLESTAR : TokenType.STAR);
                    break;
                case '/':
                    if (this.matches('=')) {
                        this.raiseForbiddenOperator();
                    }
                    this.addToken(this.matches('/') ? TokenType.DOUBLESLASH : TokenType.SLASH);
                    break;
                case '%':
                    if (this.matches('=')) {
                        this.raiseForbiddenOperator();
                    }
                    this.addToken(TokenType.PERCENT);
                    break;
                case '!':
                    this.addToken(this.matches('=') ? TokenType.NOTEQUAL : TokenType.BANG);
                    break;
                case '=':
                    this.addToken(this.matches('=') ? TokenType.DOUBLEEQUAL : TokenType.EQUAL);
                    break;
                case '<':
                    this.addToken(this.matches('=') ? TokenType.LESSEQUAL : TokenType.LESS);
                    break;
                case '>':
                    this.addToken(this.matches('=') ? TokenType.GREATEREQUAL : TokenType.GREATER);
                    break;
                default:
                    // Identifier start
                    // TODO: unicode
                    if (c === '_' || this.isAlpha(c) || this.isLegalUnicode(c)) {
                        this.name();
                        break;
                    }
                    this.matchForbiddenOperator(c);
                    throw new exports.TokenizerErrors.UnknownTokenError(c, this.line, this.col, this.source, this.current);
            }
        }
        matchForbiddenOperator(ch) {
            switch (ch) {
                case '@':
                case '|':
                case '&':
                case '~':
                case '^':
                    this.matches('=');
                    this.raiseForbiddenOperator();
                    break;
            }
        }
        scanEverything() {
            while (!this.isAtEnd()) {
                this.start = this.current;
                this.scanToken();
            }
            // Unravel the indent stack
            while (this.indentStack[this.indentStack.length - 1] !== 0) {
                this.indentStack.pop();
                this.addToken(TokenType.DEDENT);
            }
            this.tokens.push(new Token(TokenType.ENDMARKER, "", this.line, this.col, this.current));
            return this.tokens;
        }
        printTokens() {
            for (const token of this.tokens) {
                console.log(`${token.indexInSource}:${token.line}-${token.line},${token.indexInSource + token.lexeme.length}\t\t\t\
            ${TokenType[token.type]}\t\t\t'${token.lexeme}'`);
            }
        }
        raiseForbiddenOperator() {
            throw new exports.TokenizerErrors.ForbiddenOperatorError(this.line, this.col, this.source, this.start, this.current);
        }
    }

    function _extends() {
      return _extends = Object.assign ? Object.assign.bind() : function (n) {
        for (var e = 1; e < arguments.length; e++) {
          var t = arguments[e];
          for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
        }
        return n;
      }, _extends.apply(null, arguments);
    }

    var DEFAULT_CONFIG = {
      // minimum relative difference between two compared values,
      // used by all comparison functions
      relTol: 1e-12,
      // minimum absolute difference between two compared values,
      // used by all comparison functions
      absTol: 1e-15,
      // type of default matrix output. Choose 'matrix' (default) or 'array'
      matrix: 'Matrix',
      // type of default number output. Choose 'number' (default) 'BigNumber', 'bigint', or 'Fraction'
      number: 'number',
      // type of fallback used for config { number: 'bigint' } when a value cannot be represented
      // in the configured numeric type. Choose 'number' (default) or 'BigNumber'.
      numberFallback: 'number',
      // number of significant digits in BigNumbers
      precision: 64,
      // predictable output type of functions. When true, output type depends only
      // on the input types. When false (default), output type can vary depending
      // on input values. For example `math.sqrt(-4)` returns `complex('2i')` when
      // predictable is false, and returns `NaN` when true.
      predictable: false,
      // random seed for seeded pseudo random number generation
      // null = randomly seed
      randomSeed: null
    };

    /**
     * Get a property of a plain object
     * Throws an error in case the object is not a plain object or the
     * property is not defined on the object itself
     * @param {Object} object
     * @param {string} prop
     * @return {*} Returns the property value when safe
     */
    function getSafeProperty(object, prop) {
      // only allow getting safe properties of a plain object
      if (isSafeProperty(object, prop)) {
        return object[prop];
      }
      if (typeof object[prop] === 'function' && isSafeMethod(object, prop)) {
        throw new Error('Cannot access method "' + prop + '" as a property');
      }
      throw new Error('No access to property "' + prop + '"');
    }

    /**
     * Set a property on a plain object.
     * Throws an error in case the object is not a plain object or the
     * property would override an inherited property like .constructor or .toString
     * @param {Object} object
     * @param {string} prop
     * @param {*} value
     * @return {*} Returns the value
     */
    // TODO: merge this function into access.js?
    function setSafeProperty(object, prop, value) {
      // only allow setting safe properties of a plain object
      if (isSafeProperty(object, prop)) {
        object[prop] = value;
        return value;
      }
      throw new Error('No access to property "' + prop + '"');
    }

    /**
     * Test whether a property is safe to use on an object or Array.
     * For example .toString and .constructor are not safe
     * @param {Object | Array} object
     * @param {string} prop
     * @return {boolean} Returns true when safe
     */
    function isSafeProperty(object, prop) {
      if (!isPlainObject(object) && !Array.isArray(object)) {
        return false;
      }
      // SAFE: whitelisted
      // e.g length
      if (hasOwnProperty(safeNativeProperties, prop)) {
        return true;
      }
      // UNSAFE: inherited from Object prototype
      // e.g constructor
      if (prop in Object.prototype) {
        // 'in' is used instead of hasOwnProperty for nodejs v0.10
        // which is inconsistent on root prototypes. It is safe
        // here because Object.prototype is a root object
        return false;
      }
      // UNSAFE: inherited from Function prototype
      // e.g call, apply
      if (prop in Function.prototype) {
        // 'in' is used instead of hasOwnProperty for nodejs v0.10
        // which is inconsistent on root prototypes. It is safe
        // here because Function.prototype is a root object
        return false;
      }
      return true;
    }

    /**
     * Check whether a method is safe.
     * Throws an error when that's not the case (for example for `constructor`).
     * @param {Object} object
     * @param {string} method
     * @return {boolean} Returns true when safe, false otherwise
     */
    function isSafeMethod(object, method) {
      if (object === null || object === undefined || typeof object[method] !== 'function') {
        return false;
      }
      // UNSAFE: ghosted
      // e.g overridden toString
      // Note that IE10 doesn't support __proto__ and we can't do this check there.
      if (hasOwnProperty(object, method) && Object.getPrototypeOf && method in Object.getPrototypeOf(object)) {
        return false;
      }
      // SAFE: whitelisted
      // e.g toString
      if (hasOwnProperty(safeNativeMethods, method)) {
        return true;
      }
      // UNSAFE: inherited from Object prototype
      // e.g constructor
      if (method in Object.prototype) {
        // 'in' is used instead of hasOwnProperty for nodejs v0.10
        // which is inconsistent on root prototypes. It is safe
        // here because Object.prototype is a root object
        return false;
      }
      // UNSAFE: inherited from Function prototype
      // e.g call, apply
      if (method in Function.prototype) {
        // 'in' is used instead of hasOwnProperty for nodejs v0.10
        // which is inconsistent on root prototypes. It is safe
        // here because Function.prototype is a root object
        return false;
      }
      return true;
    }
    function isPlainObject(object) {
      return typeof object === 'object' && object && object.constructor === Object;
    }
    var safeNativeProperties = {
      length: true,
      name: true
    };
    var safeNativeMethods = {
      toString: true,
      valueOf: true,
      toLocaleString: true
    };

    /**
     * A map facade on a bare object.
     *
     * The small number of methods needed to implement a scope,
     * forwarding on to the SafeProperty functions. Over time, the codebase
     * will stop using this method, as all objects will be Maps, rather than
     * more security prone objects.
     */
    class ObjectWrappingMap {
      constructor(object) {
        this.wrappedObject = object;
        this[Symbol.iterator] = this.entries;
      }
      keys() {
        return Object.keys(this.wrappedObject).filter(key => this.has(key)).values();
      }
      get(key) {
        return getSafeProperty(this.wrappedObject, key);
      }
      set(key, value) {
        setSafeProperty(this.wrappedObject, key, value);
        return this;
      }
      has(key) {
        return isSafeProperty(this.wrappedObject, key) && key in this.wrappedObject;
      }
      entries() {
        return mapIterator(this.keys(), key => [key, this.get(key)]);
      }
      forEach(callback) {
        for (var key of this.keys()) {
          callback(this.get(key), key, this);
        }
      }
      delete(key) {
        if (isSafeProperty(this.wrappedObject, key)) {
          delete this.wrappedObject[key];
        }
      }
      clear() {
        for (var key of this.keys()) {
          this.delete(key);
        }
      }
      get size() {
        return Object.keys(this.wrappedObject).length;
      }
    }

    /**
     * Create a new iterator that maps over the provided iterator, applying a mapping function to each item
     */
    function mapIterator(it, callback) {
      return {
        next: () => {
          var n = it.next();
          return n.done ? n : {
            value: callback(n.value),
            done: false
          };
        }
      };
    }

    // type checks for all known types
    //
    // note that:
    //
    // - check by duck-typing on a property like `isUnit`, instead of checking instanceof.
    //   instanceof cannot be used because that would not allow to pass data from
    //   one instance of math.js to another since each has it's own instance of Unit.
    // - check the `isUnit` property via the constructor, so there will be no
    //   matches for "fake" instances like plain objects with a property `isUnit`.
    //   That is important for security reasons.
    // - It must not be possible to override the type checks used internally,
    //   for security reasons, so these functions are not exposed in the expression
    //   parser.

    function isNumber(x) {
      return typeof x === 'number';
    }
    function isBigNumber(x) {
      if (!x || typeof x !== 'object' || typeof x.constructor !== 'function') {
        return false;
      }
      if (x.isBigNumber === true && typeof x.constructor.prototype === 'object' && x.constructor.prototype.isBigNumber === true) {
        return true;
      }
      if (typeof x.constructor.isDecimal === 'function' && x.constructor.isDecimal(x) === true) {
        return true;
      }
      return false;
    }
    function isBigInt(x) {
      return typeof x === 'bigint';
    }
    function isComplex(x) {
      return x && typeof x === 'object' && Object.getPrototypeOf(x).isComplex === true || false;
    }
    function isFraction(x) {
      return x && typeof x === 'object' && Object.getPrototypeOf(x).isFraction === true || false;
    }
    function isUnit(x) {
      return x && x.constructor.prototype.isUnit === true || false;
    }
    function isString(x) {
      return typeof x === 'string';
    }
    var isArray = Array.isArray;
    function isMatrix(x) {
      return x && x.constructor.prototype.isMatrix === true || false;
    }

    /**
     * Test whether a value is a collection: an Array or Matrix
     * @param {*} x
     * @returns {boolean} isCollection
     */
    function isCollection(x) {
      return Array.isArray(x) || isMatrix(x);
    }
    function isDenseMatrix(x) {
      return x && x.isDenseMatrix && x.constructor.prototype.isMatrix === true || false;
    }
    function isSparseMatrix(x) {
      return x && x.isSparseMatrix && x.constructor.prototype.isMatrix === true || false;
    }
    function isRange(x) {
      return x && x.constructor.prototype.isRange === true || false;
    }
    function isIndex(x) {
      return x && x.constructor.prototype.isIndex === true || false;
    }
    function isBoolean(x) {
      return typeof x === 'boolean';
    }
    function isResultSet(x) {
      return x && x.constructor.prototype.isResultSet === true || false;
    }
    function isHelp(x) {
      return x && x.constructor.prototype.isHelp === true || false;
    }
    function isFunction(x) {
      return typeof x === 'function';
    }
    function isDate(x) {
      return x instanceof Date;
    }
    function isRegExp(x) {
      return x instanceof RegExp;
    }
    function isObject(x) {
      return !!(x && typeof x === 'object' && x.constructor === Object && !isComplex(x) && !isFraction(x));
    }

    /**
     * Returns `true` if the passed object appears to be a Map (i.e. duck typing).
     *
     * Methods looked for are `get`, `set`, `keys` and `has`.
     *
     * @param {Map | object} object
     * @returns
     */
    function isMap(object) {
      // We can use the fast instanceof, or a slower duck typing check.
      // The duck typing method needs to cover enough methods to not be confused with DenseMatrix.
      if (!object) {
        return false;
      }
      return object instanceof Map || object instanceof ObjectWrappingMap || typeof object.set === 'function' && typeof object.get === 'function' && typeof object.keys === 'function' && typeof object.has === 'function';
    }
    function isNull(x) {
      return x === null;
    }
    function isUndefined(x) {
      return x === undefined;
    }
    function isAccessorNode(x) {
      return x && x.isAccessorNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isArrayNode(x) {
      return x && x.isArrayNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isAssignmentNode(x) {
      return x && x.isAssignmentNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isBlockNode(x) {
      return x && x.isBlockNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isConditionalNode(x) {
      return x && x.isConditionalNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isConstantNode(x) {
      return x && x.isConstantNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isFunctionAssignmentNode(x) {
      return x && x.isFunctionAssignmentNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isFunctionNode(x) {
      return x && x.isFunctionNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isIndexNode(x) {
      return x && x.isIndexNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isNode$1(x) {
      return x && x.isNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isObjectNode(x) {
      return x && x.isObjectNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isOperatorNode(x) {
      return x && x.isOperatorNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isParenthesisNode(x) {
      return x && x.isParenthesisNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isRangeNode(x) {
      return x && x.isRangeNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isRelationalNode(x) {
      return x && x.isRelationalNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isSymbolNode(x) {
      return x && x.isSymbolNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isChain(x) {
      return x && x.constructor.prototype.isChain === true || false;
    }
    function typeOf(x) {
      var t = typeof x;
      if (t === 'object') {
        if (x === null) return 'null';
        if (isBigNumber(x)) return 'BigNumber'; // Special: weird mashup with Decimal
        if (x.constructor && x.constructor.name) return x.constructor.name;
        return 'Object'; // just in case
      }
      return t; // can be 'string', 'number', 'boolean', 'function', 'bigint', ...
    }

    /**
     * Clone an object
     *
     *     clone(x)
     *
     * Can clone any primitive type, array, and object.
     * If x has a function clone, this function will be invoked to clone the object.
     *
     * @param {*} x
     * @return {*} clone
     */
    function clone$2(x) {
      var type = typeof x;

      // immutable primitive types
      if (type === 'number' || type === 'bigint' || type === 'string' || type === 'boolean' || x === null || x === undefined) {
        return x;
      }

      // use clone function of the object when available
      if (typeof x.clone === 'function') {
        return x.clone();
      }

      // array
      if (Array.isArray(x)) {
        return x.map(function (value) {
          return clone$2(value);
        });
      }
      if (x instanceof Date) return new Date(x.valueOf());
      if (isBigNumber(x)) return x; // bignumbers are immutable

      // object
      if (isObject(x)) {
        return mapObject(x, clone$2);
      }
      if (type === 'function') {
        // we assume that the function is immutable
        return x;
      }
      throw new TypeError("Cannot clone: unknown type of value (value: ".concat(x, ")"));
    }

    /**
     * Apply map to all properties of an object
     * @param {Object} object
     * @param {function} callback
     * @return {Object} Returns a copy of the object with mapped properties
     */
    function mapObject(object, callback) {
      var clone = {};
      for (var key in object) {
        if (hasOwnProperty(object, key)) {
          clone[key] = callback(object[key]);
        }
      }
      return clone;
    }

    /**
     * Deep test equality of all fields in two pairs of arrays or objects.
     * Compares values and functions strictly (ie. 2 is not the same as '2').
     * @param {Array | Object} a
     * @param {Array | Object} b
     * @returns {boolean}
     */
    function deepStrictEqual(a, b) {
      var prop, i, len;
      if (Array.isArray(a)) {
        if (!Array.isArray(b)) {
          return false;
        }
        if (a.length !== b.length) {
          return false;
        }
        for (i = 0, len = a.length; i < len; i++) {
          if (!deepStrictEqual(a[i], b[i])) {
            return false;
          }
        }
        return true;
      } else if (typeof a === 'function') {
        return a === b;
      } else if (a instanceof Object) {
        if (Array.isArray(b) || !(b instanceof Object)) {
          return false;
        }
        for (prop in a) {
          // noinspection JSUnfilteredForInLoop
          if (!(prop in b) || !deepStrictEqual(a[prop], b[prop])) {
            return false;
          }
        }
        for (prop in b) {
          // noinspection JSUnfilteredForInLoop
          if (!(prop in a)) {
            return false;
          }
        }
        return true;
      } else {
        return a === b;
      }
    }

    /**
     * A safe hasOwnProperty
     * @param {Object} object
     * @param {string} property
     */
    function hasOwnProperty(object, property) {
      return object && Object.hasOwnProperty.call(object, property);
    }

    /**
     * Shallow version of pick, creating an object composed of the picked object properties
     * but not for nested properties
     * @param {Object} object
     * @param {string[]} properties
     * @return {Object}
     */
    function pickShallow(object, properties) {
      var copy = {};
      for (var i = 0; i < properties.length; i++) {
        var key = properties[i];
        var value = object[key];
        if (value !== undefined) {
          copy[key] = value;
        }
      }
      return copy;
    }

    var MATRIX_OPTIONS = ['Matrix', 'Array']; // valid values for option matrix
    var NUMBER_OPTIONS = ['number', 'BigNumber', 'Fraction']; // valid values for option number

    // create a read-only version of config
    var config$1 = function config(options) {
      if (options) {
        throw new Error('The global config is readonly. \n' + 'Please create a mathjs instance if you want to change the default configuration. \n' + 'Example:\n' + '\n' + '  import { create, all } from \'mathjs\';\n' + '  const mathjs = create(all);\n' + '  mathjs.config({ number: \'BigNumber\' });\n');
      }
      return Object.freeze(DEFAULT_CONFIG);
    };
    _extends(config$1, DEFAULT_CONFIG, {
      MATRIX_OPTIONS,
      NUMBER_OPTIONS
    });

    function ok() {
      return true;
    }
    function notOk() {
      return false;
    }
    function undef() {
      return undefined;
    }
    const NOT_TYPED_FUNCTION = 'Argument is not a typed-function.';

    /**
     * @typedef {{
     *   params: Param[],
     *   fn: function,
     *   test: function,
     *   implementation: function
     * }} Signature
     *
     * @typedef {{
     *   types: Type[],
     *   hasAny: boolean,
     *   hasConversion: boolean,
     *   restParam: boolean
     * }} Param
     *
     * @typedef {{
     *   name: string,
     *   typeIndex: number,
     *   test: function,
     *   isAny: boolean,
     *   conversion?: ConversionDef,
     *   conversionIndex: number,
     * }} Type
     *
     * @typedef {{
     *   from: string,
     *   to: string,
     *   convert: function (*) : *
     * }} ConversionDef
     *
     * @typedef {{
     *   name: string,
     *   test: function(*) : boolean,
     *   isAny?: boolean
     * }} TypeDef
     */

    /**
     * @returns {() => function}
     */
    function create() {
      // data type tests

      /**
       * Returns true if the argument is a non-null "plain" object
       */
      function isPlainObject(x) {
        return typeof x === 'object' && x !== null && x.constructor === Object;
      }
      const _types = [{
        name: 'number',
        test: function (x) {
          return typeof x === 'number';
        }
      }, {
        name: 'string',
        test: function (x) {
          return typeof x === 'string';
        }
      }, {
        name: 'boolean',
        test: function (x) {
          return typeof x === 'boolean';
        }
      }, {
        name: 'Function',
        test: function (x) {
          return typeof x === 'function';
        }
      }, {
        name: 'Array',
        test: Array.isArray
      }, {
        name: 'Date',
        test: function (x) {
          return x instanceof Date;
        }
      }, {
        name: 'RegExp',
        test: function (x) {
          return x instanceof RegExp;
        }
      }, {
        name: 'Object',
        test: isPlainObject
      }, {
        name: 'null',
        test: function (x) {
          return x === null;
        }
      }, {
        name: 'undefined',
        test: function (x) {
          return x === undefined;
        }
      }];
      const anyType = {
        name: 'any',
        test: ok,
        isAny: true
      };

      // Data structures to track the types. As these are local variables in
      // create(), each typed universe will get its own copy, but the variables
      // will only be accessible through the (closures of the) functions supplied
      // as properties of the typed object, not directly.
      // These will be initialized in clear() below
      let typeMap; // primary store of all types
      let typeList; // Array of just type names, for the sake of ordering

      // And similar data structures for the type conversions:
      let nConversions = 0;
      // the actual conversions are stored on a property of the destination types

      // This is a temporary object, will be replaced with a function at the end
      let typed = {
        createCount: 0
      };

      /**
       * Takes a type name and returns the corresponding official type object
       * for that type.
       *
       * @param {string} typeName
       * @returns {TypeDef} type
       */
      function findType(typeName) {
        const type = typeMap.get(typeName);
        if (type) {
          return type;
        }
        // Remainder is error handling
        let message = 'Unknown type "' + typeName + '"';
        const name = typeName.toLowerCase();
        let otherName;
        for (otherName of typeList) {
          if (otherName.toLowerCase() === name) {
            message += '. Did you mean "' + otherName + '" ?';
            break;
          }
        }
        throw new TypeError(message);
      }

      /**
       * Adds an array `types` of type definitions to this typed instance.
       * Each type definition should be an object with properties:
       * 'name' - a string giving the name of the type; 'test' - function
       * returning a boolean that tests membership in the type; and optionally
       * 'isAny' - true only for the 'any' type.
       *
       * The second optional argument, `before`, gives the name of a type that
       * these types should be added before. The new types are added in the
       * order specified.
       * @param {TypeDef[]} types
       * @param {string | boolean} [beforeSpec='any'] before
       */
      function addTypes(types) {
        let beforeSpec = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'any';
        const beforeIndex = beforeSpec ? findType(beforeSpec).index : typeList.length;
        const newTypes = [];
        for (let i = 0; i < types.length; ++i) {
          if (!types[i] || typeof types[i].name !== 'string' || typeof types[i].test !== 'function') {
            throw new TypeError('Object with properties {name: string, test: function} expected');
          }
          const typeName = types[i].name;
          if (typeMap.has(typeName)) {
            throw new TypeError('Duplicate type name "' + typeName + '"');
          }
          newTypes.push(typeName);
          typeMap.set(typeName, {
            name: typeName,
            test: types[i].test,
            isAny: types[i].isAny,
            index: beforeIndex + i,
            conversionsTo: [] // Newly added type can't have any conversions to it
          });
        }
        // update the typeList
        const affectedTypes = typeList.slice(beforeIndex);
        typeList = typeList.slice(0, beforeIndex).concat(newTypes).concat(affectedTypes);
        // Fix the indices
        for (let i = beforeIndex + newTypes.length; i < typeList.length; ++i) {
          typeMap.get(typeList[i]).index = i;
        }
      }

      /**
       * Removes all types and conversions from this typed instance.
       * May cause previously constructed typed-functions to throw
       * strange errors when they are called with types that do not
       * match any of their signatures.
       */
      function clear() {
        typeMap = new Map();
        typeList = [];
        nConversions = 0;
        addTypes([anyType], false);
      }

      // initialize the types to the default list
      clear();
      addTypes(_types);

      /**
       * Removes all conversions, leaving the types alone.
       */
      function clearConversions() {
        let typeName;
        for (typeName of typeList) {
          typeMap.get(typeName).conversionsTo = [];
        }
        nConversions = 0;
      }

      /**
       * Find the type names that match a value.
       * @param {*} value
       * @return {string[]} Array of names of types for which
       *                  the type test matches the value.
       */
      function findTypeNames(value) {
        const matches = typeList.filter(name => {
          const type = typeMap.get(name);
          return !type.isAny && type.test(value);
        });
        if (matches.length) {
          return matches;
        }
        return ['any'];
      }

      /**
       * Check if an entity is a typed function created by any instance
       * @param {any} entity
       * @returns {boolean}
       */
      function isTypedFunction(entity) {
        return entity && typeof entity === 'function' && '_typedFunctionData' in entity;
      }

      /**
       * Find a specific signature from a (composed) typed function, for example:
       *
       *   typed.findSignature(fn, ['number', 'string'])
       *   typed.findSignature(fn, 'number, string')
       *   typed.findSignature(fn, 'number,string', {exact: true})
       *
       * This function findSignature will by default return the best match to
       * the given signature, possibly employing type conversions.
       *
       * The (optional) third argument is a plain object giving options
       * controlling the signature search. Currently the only implemented
       * option is `exact`: if specified as true (default is false), only
       * exact matches will be returned (i.e. signatures for which `fn` was
       * directly defined). Note that a (possibly different) type matching
       * `any`, or one or more instances of TYPE matching `...TYPE` are
       * considered exact matches in this regard, as no conversions are used.
       *
       * This function returns a "signature" object, as does `typed.resolve()`,
       * which is a plain object with four keys: `params` (the array of parameters
       * for this signature), `fn` (the originally supplied function for this
       * signature), `test` (a generated function that determines if an argument
       * list matches this signature, and `implementation` (the function to call
       * on a matching argument list, that performs conversions if necessary and
       * then calls the originally supplied function).
       *
       * @param {Function} fn                   A typed-function
       * @param {string | string[]} signature
       *     Signature to be found, can be an array or a comma separated string.
       * @param {object} options  Controls the signature search as documented
       * @return {{ params: Param[], fn: function, test: function, implementation: function }}
       *     Returns the matching signature, or throws an error when no signature
       *     is found.
       */
      function findSignature(fn, signature, options) {
        if (!isTypedFunction(fn)) {
          throw new TypeError(NOT_TYPED_FUNCTION);
        }

        // Canonicalize input
        const exact = options && options.exact;
        const stringSignature = Array.isArray(signature) ? signature.join(',') : signature;
        const params = parseSignature(stringSignature);
        const canonicalSignature = stringifyParams(params);

        // First hope we get lucky and exactly match a signature
        if (!exact || canonicalSignature in fn.signatures) {
          // OK, we can check the internal signatures
          const match = fn._typedFunctionData.signatureMap.get(canonicalSignature);
          if (match) {
            return match;
          }
        }

        // Oh well, we did not; so we have to go back and check the parameters
        // one by one, in order to catch things like `any` and rest params.
        // Note here we can assume there is at least one parameter, because
        // the empty signature would have matched successfully above.
        const nParams = params.length;
        let remainingSignatures;
        if (exact) {
          remainingSignatures = [];
          let name;
          for (name in fn.signatures) {
            remainingSignatures.push(fn._typedFunctionData.signatureMap.get(name));
          }
        } else {
          remainingSignatures = fn._typedFunctionData.signatures;
        }
        for (let i = 0; i < nParams; ++i) {
          const want = params[i];
          const filteredSignatures = [];
          let possibility;
          for (possibility of remainingSignatures) {
            const have = getParamAtIndex(possibility.params, i);
            if (!have || want.restParam && !have.restParam) {
              continue;
            }
            if (!have.hasAny) {
              // have to check all of the wanted types are available
              const haveTypes = paramTypeSet(have);
              if (want.types.some(wtype => !haveTypes.has(wtype.name))) {
                continue;
              }
            }
            // OK, this looks good
            filteredSignatures.push(possibility);
          }
          remainingSignatures = filteredSignatures;
          if (remainingSignatures.length === 0) break;
        }
        // Return the first remaining signature that was totally matched:
        let candidate;
        for (candidate of remainingSignatures) {
          if (candidate.params.length <= nParams) {
            return candidate;
          }
        }
        throw new TypeError('Signature not found (signature: ' + (fn.name || 'unnamed') + '(' + stringifyParams(params, ', ') + '))');
      }

      /**
       * Find the proper function to call for a specific signature from
       * a (composed) typed function, for example:
       *
       *   typed.find(fn, ['number', 'string'])
       *   typed.find(fn, 'number, string')
       *   typed.find(fn, 'number,string', {exact: true})
       *
       * This function find will by default return the best match to
       * the given signature, possibly employing type conversions (and returning
       * a function that will perform those conversions as needed). The
       * (optional) third argument is a plain object giving options contolling
       * the signature search. Currently only the option `exact` is implemented,
       * which defaults to "false". If `exact` is specified as true, then only
       * exact matches will be returned (i.e. signatures for which `fn` was
       * directly defined). Uses of `any` and `...TYPE` are considered exact if
       * no conversions are necessary to apply the corresponding function.
       *
       * @param {Function} fn                   A typed-function
       * @param {string | string[]} signature
       *     Signature to be found, can be an array or a comma separated string.
       * @param {object} options  Controls the signature match as documented
       * @return {function}
       *     Returns the function to call for the given signature, or throws an
       *     error if no match is found.
       */
      function find(fn, signature, options) {
        return findSignature(fn, signature, options).implementation;
      }

      /**
       * Convert a given value to another data type, specified by type name.
       *
       * @param {*} value
       * @param {string} typeName
       */
      function convert(value, typeName) {
        // check conversion is needed
        const type = findType(typeName);
        if (type.test(value)) {
          return value;
        }
        const conversions = type.conversionsTo;
        if (conversions.length === 0) {
          throw new Error('There are no conversions to ' + typeName + ' defined.');
        }
        for (let i = 0; i < conversions.length; i++) {
          const fromType = findType(conversions[i].from);
          if (fromType.test(value)) {
            return conversions[i].convert(value);
          }
        }
        throw new Error('Cannot convert ' + value + ' to ' + typeName);
      }

      /**
       * Stringify parameters in a normalized way
       * @param {Param[]} params
       * @param {string} [','] separator
       * @return {string}
       */
      function stringifyParams(params) {
        let separator = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ',';
        return params.map(p => p.name).join(separator);
      }

      /**
       * Parse a parameter, like "...number | boolean"
       * @param {string} param
       * @return {Param} param
       */
      function parseParam(param) {
        const restParam = param.indexOf('...') === 0;
        const types = !restParam ? param : param.length > 3 ? param.slice(3) : 'any';
        const typeDefs = types.split('|').map(s => findType(s.trim()));
        let hasAny = false;
        let paramName = restParam ? '...' : '';
        const exactTypes = typeDefs.map(function (type) {
          hasAny = type.isAny || hasAny;
          paramName += type.name + '|';
          return {
            name: type.name,
            typeIndex: type.index,
            test: type.test,
            isAny: type.isAny,
            conversion: null,
            conversionIndex: -1
          };
        });
        return {
          types: exactTypes,
          name: paramName.slice(0, -1),
          // remove trailing '|' from above
          hasAny,
          hasConversion: false,
          restParam
        };
      }

      /**
       * Expands a parsed parameter with the types available from currently
       * defined conversions.
       * @param {Param} param
       * @return {Param} param
       */
      function expandParam(param) {
        const typeNames = param.types.map(t => t.name);
        const matchingConversions = availableConversions(typeNames);
        let hasAny = param.hasAny;
        let newName = param.name;
        const convertibleTypes = matchingConversions.map(function (conversion) {
          const type = findType(conversion.from);
          hasAny = type.isAny || hasAny;
          newName += '|' + conversion.from;
          return {
            name: conversion.from,
            typeIndex: type.index,
            test: type.test,
            isAny: type.isAny,
            conversion,
            conversionIndex: conversion.index
          };
        });
        return {
          types: param.types.concat(convertibleTypes),
          name: newName,
          hasAny,
          hasConversion: convertibleTypes.length > 0,
          restParam: param.restParam
        };
      }

      /**
       * Return the set of type names in a parameter.
       * Caches the result for efficiency
       *
       * @param {Param} param
       * @return {Set<string>} typenames
       */
      function paramTypeSet(param) {
        if (!param.typeSet) {
          param.typeSet = new Set();
          param.types.forEach(type => param.typeSet.add(type.name));
        }
        return param.typeSet;
      }

      /**
       * Parse a signature with comma separated parameters,
       * like "number | boolean, ...string"
       *
       * @param {string} signature
       * @return {Param[]} params
       */
      function parseSignature(rawSignature) {
        const params = [];
        if (typeof rawSignature !== 'string') {
          throw new TypeError('Signatures must be strings');
        }
        const signature = rawSignature.trim();
        if (signature === '') {
          return params;
        }
        const rawParams = signature.split(',');
        for (let i = 0; i < rawParams.length; ++i) {
          const parsedParam = parseParam(rawParams[i].trim());
          if (parsedParam.restParam && i !== rawParams.length - 1) {
            throw new SyntaxError('Unexpected rest parameter "' + rawParams[i] + '": ' + 'only allowed for the last parameter');
          }
          // if invalid, short-circuit (all the types may have been filtered)
          if (parsedParam.types.length === 0) {
            return null;
          }
          params.push(parsedParam);
        }
        return params;
      }

      /**
       * Test whether a set of params contains a restParam
       * @param {Param[]} params
       * @return {boolean} Returns true when the last parameter is a restParam
       */
      function hasRestParam(params) {
        const param = last(params);
        return param ? param.restParam : false;
      }

      /**
       * Create a type test for a single parameter, which can have one or multiple
       * types.
       * @param {Param} param
       * @return {function(x: *) : boolean} Returns a test function
       */
      function compileTest(param) {
        if (!param || param.types.length === 0) {
          // nothing to do
          return ok;
        } else if (param.types.length === 1) {
          return findType(param.types[0].name).test;
        } else if (param.types.length === 2) {
          const test0 = findType(param.types[0].name).test;
          const test1 = findType(param.types[1].name).test;
          return function or(x) {
            return test0(x) || test1(x);
          };
        } else {
          // param.types.length > 2
          const tests = param.types.map(function (type) {
            return findType(type.name).test;
          });
          return function or(x) {
            for (let i = 0; i < tests.length; i++) {
              if (tests[i](x)) {
                return true;
              }
            }
            return false;
          };
        }
      }

      /**
       * Create a test for all parameters of a signature
       * @param {Param[]} params
       * @return {function(args: Array<*>) : boolean}
       */
      function compileTests(params) {
        let tests, test0, test1;
        if (hasRestParam(params)) {
          // variable arguments like '...number'
          tests = initial(params).map(compileTest);
          const varIndex = tests.length;
          const lastTest = compileTest(last(params));
          const testRestParam = function (args) {
            for (let i = varIndex; i < args.length; i++) {
              if (!lastTest(args[i])) {
                return false;
              }
            }
            return true;
          };
          return function testArgs(args) {
            for (let i = 0; i < tests.length; i++) {
              if (!tests[i](args[i])) {
                return false;
              }
            }
            return testRestParam(args) && args.length >= varIndex + 1;
          };
        } else {
          // no variable arguments
          if (params.length === 0) {
            return function testArgs(args) {
              return args.length === 0;
            };
          } else if (params.length === 1) {
            test0 = compileTest(params[0]);
            return function testArgs(args) {
              return test0(args[0]) && args.length === 1;
            };
          } else if (params.length === 2) {
            test0 = compileTest(params[0]);
            test1 = compileTest(params[1]);
            return function testArgs(args) {
              return test0(args[0]) && test1(args[1]) && args.length === 2;
            };
          } else {
            // arguments.length > 2
            tests = params.map(compileTest);
            return function testArgs(args) {
              for (let i = 0; i < tests.length; i++) {
                if (!tests[i](args[i])) {
                  return false;
                }
              }
              return args.length === tests.length;
            };
          }
        }
      }

      /**
       * Find the parameter at a specific index of a Params list.
       * Handles rest parameters.
       * @param {Param[]} params
       * @param {number} index
       * @return {Param | null} Returns the matching parameter when found,
       *                        null otherwise.
       */
      function getParamAtIndex(params, index) {
        return index < params.length ? params[index] : hasRestParam(params) ? last(params) : null;
      }

      /**
       * Get all type names of a parameter
       * @param {Params[]} params
       * @param {number} index
       * @return {string[]} Returns an array with type names
       */
      function getTypeSetAtIndex(params, index) {
        const param = getParamAtIndex(params, index);
        if (!param) {
          return new Set();
        }
        return paramTypeSet(param);
      }

      /**
       * Test whether a type is an exact type or conversion
       * @param {Type} type
       * @return {boolean} Returns true when
       */
      function isExactType(type) {
        return type.conversion === null || type.conversion === undefined;
      }

      /**
       * Helper function for creating error messages: create an array with
       * all available types on a specific argument index.
       * @param {Signature[]} signatures
       * @param {number} index
       * @return {string[]} Returns an array with available types
       */
      function mergeExpectedParams(signatures, index) {
        const typeSet = new Set();
        signatures.forEach(signature => {
          const paramSet = getTypeSetAtIndex(signature.params, index);
          let name;
          for (name of paramSet) {
            typeSet.add(name);
          }
        });
        return typeSet.has('any') ? ['any'] : Array.from(typeSet);
      }

      /**
       * Create
       * @param {string} name             The name of the function
       * @param {array.<*>} args          The actual arguments passed to the function
       * @param {Signature[]} signatures  A list with available signatures
       * @return {TypeError} Returns a type error with additional data
       *                     attached to it in the property `data`
       */
      function createError(name, args, signatures) {
        let err, expected;
        const _name = name || 'unnamed';

        // test for wrong type at some index
        let matchingSignatures = signatures;
        let index;
        for (index = 0; index < args.length; index++) {
          const nextMatchingDefs = [];
          matchingSignatures.forEach(signature => {
            const param = getParamAtIndex(signature.params, index);
            const test = compileTest(param);
            if ((index < signature.params.length || hasRestParam(signature.params)) && test(args[index])) {
              nextMatchingDefs.push(signature);
            }
          });
          if (nextMatchingDefs.length === 0) {
            // no matching signatures anymore, throw error "wrong type"
            expected = mergeExpectedParams(matchingSignatures, index);
            if (expected.length > 0) {
              const actualTypes = findTypeNames(args[index]);
              err = new TypeError('Unexpected type of argument in function ' + _name + ' (expected: ' + expected.join(' or ') + ', actual: ' + actualTypes.join(' | ') + ', index: ' + index + ')');
              err.data = {
                category: 'wrongType',
                fn: _name,
                index,
                actual: actualTypes,
                expected
              };
              return err;
            }
          } else {
            matchingSignatures = nextMatchingDefs;
          }
        }

        // test for too few arguments
        const lengths = matchingSignatures.map(function (signature) {
          return hasRestParam(signature.params) ? Infinity : signature.params.length;
        });
        if (args.length < Math.min.apply(null, lengths)) {
          expected = mergeExpectedParams(matchingSignatures, index);
          err = new TypeError('Too few arguments in function ' + _name + ' (expected: ' + expected.join(' or ') + ', index: ' + args.length + ')');
          err.data = {
            category: 'tooFewArgs',
            fn: _name,
            index: args.length,
            expected
          };
          return err;
        }

        // test for too many arguments
        const maxLength = Math.max.apply(null, lengths);
        if (args.length > maxLength) {
          err = new TypeError('Too many arguments in function ' + _name + ' (expected: ' + maxLength + ', actual: ' + args.length + ')');
          err.data = {
            category: 'tooManyArgs',
            fn: _name,
            index: args.length,
            expectedLength: maxLength
          };
          return err;
        }

        // Generic error
        const argTypes = [];
        for (let i = 0; i < args.length; ++i) {
          argTypes.push(findTypeNames(args[i]).join('|'));
        }
        err = new TypeError('Arguments of type "' + argTypes.join(', ') + '" do not match any of the defined signatures of function ' + _name + '.');
        err.data = {
          category: 'mismatch',
          actual: argTypes
        };
        return err;
      }

      /**
       * Find the lowest index of all exact types of a parameter (no conversions)
       * @param {Param} param
       * @return {number} Returns the index of the lowest type in typed.types
       */
      function getLowestTypeIndex(param) {
        let min = typeList.length + 1;
        for (let i = 0; i < param.types.length; i++) {
          if (isExactType(param.types[i])) {
            min = Math.min(min, param.types[i].typeIndex);
          }
        }
        return min;
      }

      /**
       * Find the lowest index of the conversion of all types of the parameter
       * having a conversion
       * @param {Param} param
       * @return {number} Returns the lowest index of the conversions of this type
       */
      function getLowestConversionIndex(param) {
        let min = nConversions + 1;
        for (let i = 0; i < param.types.length; i++) {
          if (!isExactType(param.types[i])) {
            min = Math.min(min, param.types[i].conversionIndex);
          }
        }
        return min;
      }

      /**
       * Compare two params
       * @param {Param} param1
       * @param {Param} param2
       * @return {number} returns -1 when param1 must get a lower
       *                  index than param2, 1 when the opposite,
       *                  or zero when both are equal
       */
      function compareParams(param1, param2) {
        // We compare a number of metrics on a param in turn:
        // 1) 'any' parameters are the least preferred
        if (param1.hasAny) {
          if (!param2.hasAny) {
            return 1;
          }
        } else if (param2.hasAny) {
          return -1;
        }

        // 2) Prefer non-rest to rest parameters
        if (param1.restParam) {
          if (!param2.restParam) {
            return 1;
          }
        } else if (param2.restParam) {
          return -1;
        }

        // 3) Prefer exact type match to conversions
        if (param1.hasConversion) {
          if (!param2.hasConversion) {
            return 1;
          }
        } else if (param2.hasConversion) {
          return -1;
        }

        // 4) Prefer lower type index:
        const typeDiff = getLowestTypeIndex(param1) - getLowestTypeIndex(param2);
        if (typeDiff < 0) {
          return -1;
        }
        if (typeDiff > 0) {
          return 1;
        }

        // 5) Prefer lower conversion index
        const convDiff = getLowestConversionIndex(param1) - getLowestConversionIndex(param2);
        if (convDiff < 0) {
          return -1;
        }
        if (convDiff > 0) {
          return 1;
        }

        // Don't have a basis for preference
        return 0;
      }

      /**
       * Compare two signatures
       * @param {Signature} signature1
       * @param {Signature} signature2
       * @return {number} returns a negative number when param1 must get a lower
       *                  index than param2, a positive number when the opposite,
       *                  or zero when both are equal
       */
      function compareSignatures(signature1, signature2) {
        const pars1 = signature1.params;
        const pars2 = signature2.params;
        const last1 = last(pars1);
        const last2 = last(pars2);
        const hasRest1 = hasRestParam(pars1);
        const hasRest2 = hasRestParam(pars2);
        // We compare a number of metrics on signatures in turn:
        // 1) An "any rest param" is least preferred
        if (hasRest1 && last1.hasAny) {
          if (!hasRest2 || !last2.hasAny) {
            return 1;
          }
        } else if (hasRest2 && last2.hasAny) {
          return -1;
        }

        // 2) Minimize the number of 'any' parameters
        let any1 = 0;
        let conv1 = 0;
        let par;
        for (par of pars1) {
          if (par.hasAny) ++any1;
          if (par.hasConversion) ++conv1;
        }
        let any2 = 0;
        let conv2 = 0;
        for (par of pars2) {
          if (par.hasAny) ++any2;
          if (par.hasConversion) ++conv2;
        }
        if (any1 !== any2) {
          return any1 - any2;
        }

        // 3) A conversion rest param is less preferred
        if (hasRest1 && last1.hasConversion) {
          if (!hasRest2 || !last2.hasConversion) {
            return 1;
          }
        } else if (hasRest2 && last2.hasConversion) {
          return -1;
        }

        // 4) Minimize the number of conversions
        if (conv1 !== conv2) {
          return conv1 - conv2;
        }

        // 5) Prefer no rest param
        if (hasRest1) {
          if (!hasRest2) {
            return 1;
          }
        } else if (hasRest2) {
          return -1;
        }

        // 6) Prefer shorter with rest param, longer without
        const lengthCriterion = (pars1.length - pars2.length) * (hasRest1 ? -1 : 1);
        if (lengthCriterion !== 0) {
          return lengthCriterion;
        }

        // Signatures are identical in each of the above metrics.
        // In particular, they are the same length.
        // We can therefore compare the parameters one by one.
        // First we count which signature has more preferred parameters.
        const comparisons = [];
        let tc = 0;
        for (let i = 0; i < pars1.length; ++i) {
          const thisComparison = compareParams(pars1[i], pars2[i]);
          comparisons.push(thisComparison);
          tc += thisComparison;
        }
        if (tc !== 0) {
          return tc;
        }

        // They have the same number of preferred parameters, so go by the
        // earliest parameter in which we have a preference.
        // In other words, dispatch is driven somewhat more by earlier
        // parameters than later ones.
        let c;
        for (c of comparisons) {
          if (c !== 0) {
            return c;
          }
        }

        // It's a tossup:
        return 0;
      }

      /**
       * Produce a list of all conversions from distinct types to one of
       * the given types.
       *
       * @param {string[]} typeNames
       * @return {ConversionDef[]} Returns the conversions that are available
       *                        resulting in any given type (if any)
       */
      function availableConversions(typeNames) {
        if (typeNames.length === 0) {
          return [];
        }
        const types = typeNames.map(findType);
        if (typeNames.length > 1) {
          types.sort((t1, t2) => t1.index - t2.index);
        }
        let matches = types[0].conversionsTo;
        if (typeNames.length === 1) {
          return matches;
        }
        matches = matches.concat([]); // shallow copy the matches
        // Since the types are now in index order, we just want the first
        // occurrence of any from type:
        const knownTypes = new Set(typeNames);
        for (let i = 1; i < types.length; ++i) {
          let newMatch;
          for (newMatch of types[i].conversionsTo) {
            if (!knownTypes.has(newMatch.from)) {
              matches.push(newMatch);
              knownTypes.add(newMatch.from);
            }
          }
        }
        return matches;
      }

      /**
       * Preprocess arguments before calling the original function:
       * - if needed convert the parameters
       * - in case of rest parameters, move the rest parameters into an Array
       * @param {Param[]} params
       * @param {function} fn
       * @return {function} Returns a wrapped function
       */
      function compileArgsPreprocessing(params, fn) {
        let fnConvert = fn;

        // TODO: can we make this wrapper function smarter/simpler?

        if (params.some(p => p.hasConversion)) {
          const restParam = hasRestParam(params);
          const compiledConversions = params.map(compileArgConversion);
          fnConvert = function convertArgs() {
            const args = [];
            const last = restParam ? arguments.length - 1 : arguments.length;
            for (let i = 0; i < last; i++) {
              args[i] = compiledConversions[i](arguments[i]);
            }
            if (restParam) {
              args[last] = arguments[last].map(compiledConversions[last]);
            }
            return fn.apply(this, args);
          };
        }
        let fnPreprocess = fnConvert;
        if (hasRestParam(params)) {
          const offset = params.length - 1;
          fnPreprocess = function preprocessRestParams() {
            return fnConvert.apply(this, slice(arguments, 0, offset).concat([slice(arguments, offset)]));
          };
        }
        return fnPreprocess;
      }

      /**
       * Compile conversion for a parameter to the right type
       * @param {Param} param
       * @return {function} Returns the wrapped function that will convert arguments
       *
       */
      function compileArgConversion(param) {
        let test0, test1, conversion0, conversion1;
        const tests = [];
        const conversions = [];
        param.types.forEach(function (type) {
          if (type.conversion) {
            tests.push(findType(type.conversion.from).test);
            conversions.push(type.conversion.convert);
          }
        });

        // create optimized conversion functions depending on the number of conversions
        switch (conversions.length) {
          case 0:
            return function convertArg(arg) {
              return arg;
            };
          case 1:
            test0 = tests[0];
            conversion0 = conversions[0];
            return function convertArg(arg) {
              if (test0(arg)) {
                return conversion0(arg);
              }
              return arg;
            };
          case 2:
            test0 = tests[0];
            test1 = tests[1];
            conversion0 = conversions[0];
            conversion1 = conversions[1];
            return function convertArg(arg) {
              if (test0(arg)) {
                return conversion0(arg);
              }
              if (test1(arg)) {
                return conversion1(arg);
              }
              return arg;
            };
          default:
            return function convertArg(arg) {
              for (let i = 0; i < conversions.length; i++) {
                if (tests[i](arg)) {
                  return conversions[i](arg);
                }
              }
              return arg;
            };
        }
      }

      /**
       * Split params with union types in to separate params.
       *
       * For example:
       *
       *     splitParams([['Array', 'Object'], ['string', 'RegExp'])
       *     // returns:
       *     // [
       *     //   ['Array', 'string'],
       *     //   ['Array', 'RegExp'],
       *     //   ['Object', 'string'],
       *     //   ['Object', 'RegExp']
       *     // ]
       *
       * @param {Param[]} params
       * @return {Param[]}
       */
      function splitParams(params) {
        function _splitParams(params, index, paramsSoFar) {
          if (index < params.length) {
            const param = params[index];
            let resultingParams = [];
            if (param.restParam) {
              // split the types of a rest parameter in two:
              // one with only exact types, and one with exact types and conversions
              const exactTypes = param.types.filter(isExactType);
              if (exactTypes.length < param.types.length) {
                resultingParams.push({
                  types: exactTypes,
                  name: '...' + exactTypes.map(t => t.name).join('|'),
                  hasAny: exactTypes.some(t => t.isAny),
                  hasConversion: false,
                  restParam: true
                });
              }
              resultingParams.push(param);
            } else {
              // split all the types of a regular parameter into one type per param
              resultingParams = param.types.map(function (type) {
                return {
                  types: [type],
                  name: type.name,
                  hasAny: type.isAny,
                  hasConversion: type.conversion,
                  restParam: false
                };
              });
            }

            // recurse over the groups with types
            return flatMap(resultingParams, function (nextParam) {
              return _splitParams(params, index + 1, paramsSoFar.concat([nextParam]));
            });
          } else {
            // we've reached the end of the parameters.
            return [paramsSoFar];
          }
        }
        return _splitParams(params, 0, []);
      }

      /**
       * Test whether two param lists represent conflicting signatures
       * @param {Param[]} params1
       * @param {Param[]} params2
       * @return {boolean} Returns true when the signatures conflict, false otherwise.
       */
      function conflicting(params1, params2) {
        const ii = Math.max(params1.length, params2.length);
        for (let i = 0; i < ii; i++) {
          const typeSet1 = getTypeSetAtIndex(params1, i);
          const typeSet2 = getTypeSetAtIndex(params2, i);
          let overlap = false;
          let name;
          for (name of typeSet2) {
            if (typeSet1.has(name)) {
              overlap = true;
              break;
            }
          }
          if (!overlap) {
            return false;
          }
        }
        const len1 = params1.length;
        const len2 = params2.length;
        const restParam1 = hasRestParam(params1);
        const restParam2 = hasRestParam(params2);
        return restParam1 ? restParam2 ? len1 === len2 : len2 >= len1 : restParam2 ? len1 >= len2 : len1 === len2;
      }

      /**
       * Helper function for `resolveReferences` that returns a copy of
       * functionList wihe any prior resolutions cleared out, in case we are
       * recycling signatures from a prior typed function construction.
       *
       * @param {Array.<function|typed-reference>} functionList
       * @return {Array.<function|typed-reference>}
       */
      function clearResolutions(functionList) {
        return functionList.map(fn => {
          if (isReferToSelf(fn)) {
            return referToSelf(fn.referToSelf.callback);
          }
          if (isReferTo(fn)) {
            return makeReferTo(fn.referTo.references, fn.referTo.callback);
          }
          return fn;
        });
      }

      /**
       * Take a list of references, a list of functions functionList, and a
       * signatureMap indexing signatures into functionList, and return
       * the list of resolutions, or a false-y value if they don't all
       * resolve in a valid way (yet).
       *
       * @param {string[]} references
       * @param {Array<function|typed-reference} functionList
       * @param {Object.<string, integer>} signatureMap
       * @return {function[] | false} resolutions
       */
      function collectResolutions(references, functionList, signatureMap) {
        const resolvedReferences = [];
        let reference;
        for (reference of references) {
          let resolution = signatureMap[reference];
          if (typeof resolution !== 'number') {
            throw new TypeError('No definition for referenced signature "' + reference + '"');
          }
          resolution = functionList[resolution];
          if (typeof resolution !== 'function') {
            return false;
          }
          resolvedReferences.push(resolution);
        }
        return resolvedReferences;
      }

      /**
       * Resolve any references in the functionList for the typed function
       * itself. The signatureMap tells which index in the functionList a
       * given signature should be mapped to (for use in resolving typed.referTo)
       * and self provides the destions of a typed.referToSelf.
       *
       * @param {Array<function | typed-reference-object>} functionList
       * @param {Object.<string, function>} signatureMap
       * @param {function} self  The typed-function itself
       * @return {Array<function>} The list of resolved functions
       */
      function resolveReferences(functionList, signatureMap, self) {
        const resolvedFunctions = clearResolutions(functionList);
        const isResolved = new Array(resolvedFunctions.length).fill(false);
        let leftUnresolved = true;
        while (leftUnresolved) {
          leftUnresolved = false;
          let nothingResolved = true;
          for (let i = 0; i < resolvedFunctions.length; ++i) {
            if (isResolved[i]) continue;
            const fn = resolvedFunctions[i];
            if (isReferToSelf(fn)) {
              resolvedFunctions[i] = fn.referToSelf.callback(self);
              // Preserve reference in case signature is reused someday:
              resolvedFunctions[i].referToSelf = fn.referToSelf;
              isResolved[i] = true;
              nothingResolved = false;
            } else if (isReferTo(fn)) {
              const resolvedReferences = collectResolutions(fn.referTo.references, resolvedFunctions, signatureMap);
              if (resolvedReferences) {
                resolvedFunctions[i] = fn.referTo.callback.apply(this, resolvedReferences);
                // Preserve reference in case signature is reused someday:
                resolvedFunctions[i].referTo = fn.referTo;
                isResolved[i] = true;
                nothingResolved = false;
              } else {
                leftUnresolved = true;
              }
            }
          }
          if (nothingResolved && leftUnresolved) {
            throw new SyntaxError('Circular reference detected in resolving typed.referTo');
          }
        }
        return resolvedFunctions;
      }

      /**
       * Validate whether any of the function bodies contains a self-reference
       * usage like `this(...)` or `this.signatures`. This self-referencing is
       * deprecated since typed-function v3. It has been replaced with
       * the functions typed.referTo and typed.referToSelf.
       * @param {Object.<string, function>} signaturesMap
       */
      function validateDeprecatedThis(signaturesMap) {
        // TODO: remove this deprecation warning logic some day (it's introduced in v3)

        // match occurrences like 'this(' and 'this.signatures'
        const deprecatedThisRegex = /\bthis(\(|\.signatures\b)/;
        Object.keys(signaturesMap).forEach(signature => {
          const fn = signaturesMap[signature];
          if (deprecatedThisRegex.test(fn.toString())) {
            throw new SyntaxError('Using `this` to self-reference a function ' + 'is deprecated since typed-function@3. ' + 'Use typed.referTo and typed.referToSelf instead.');
          }
        });
      }

      /**
       * Create a typed function
       * @param {String} name               The name for the typed function
       * @param {Object.<string, function>} rawSignaturesMap
       *                                    An object with one or
       *                                    multiple signatures as key, and the
       *                                    function corresponding to the
       *                                    signature as value.
       * @return {function}  Returns the created typed function.
       */
      function createTypedFunction(name, rawSignaturesMap) {
        typed.createCount++;
        if (Object.keys(rawSignaturesMap).length === 0) {
          throw new SyntaxError('No signatures provided');
        }
        if (typed.warnAgainstDeprecatedThis) {
          validateDeprecatedThis(rawSignaturesMap);
        }

        // Main processing loop for signatures
        const parsedParams = [];
        const originalFunctions = [];
        const signaturesMap = {};
        const preliminarySignatures = []; // may have duplicates from conversions
        let signature;
        for (signature in rawSignaturesMap) {
          // A) Protect against polluted Object prototype:
          if (!Object.prototype.hasOwnProperty.call(rawSignaturesMap, signature)) {
            continue;
          }
          // B) Parse the signature
          const params = parseSignature(signature);
          if (!params) continue;
          // C) Check for conflicts
          parsedParams.forEach(function (pp) {
            if (conflicting(pp, params)) {
              throw new TypeError('Conflicting signatures "' + stringifyParams(pp) + '" and "' + stringifyParams(params) + '".');
            }
          });
          parsedParams.push(params);
          // D) Store the provided function and add conversions
          const functionIndex = originalFunctions.length;
          originalFunctions.push(rawSignaturesMap[signature]);
          const conversionParams = params.map(expandParam);
          // E) Split the signatures and collect them up
          let sp;
          for (sp of splitParams(conversionParams)) {
            const spName = stringifyParams(sp);
            preliminarySignatures.push({
              params: sp,
              name: spName,
              fn: functionIndex
            });
            if (sp.every(p => !p.hasConversion)) {
              signaturesMap[spName] = functionIndex;
            }
          }
        }
        preliminarySignatures.sort(compareSignatures);

        // Note the forward reference to theTypedFn
        const resolvedFunctions = resolveReferences(originalFunctions, signaturesMap, theTypedFn);

        // Fill in the proper function for each signature
        let s;
        for (s in signaturesMap) {
          if (Object.prototype.hasOwnProperty.call(signaturesMap, s)) {
            signaturesMap[s] = resolvedFunctions[signaturesMap[s]];
          }
        }
        const signatures = [];
        const internalSignatureMap = new Map(); // benchmarks faster than object
        for (s of preliminarySignatures) {
          // Note it's only safe to eliminate duplicates like this
          // _after_ the signature sorting step above; otherwise we might
          // remove the wrong one.
          if (!internalSignatureMap.has(s.name)) {
            s.fn = resolvedFunctions[s.fn];
            signatures.push(s);
            internalSignatureMap.set(s.name, s);
          }
        }

        // we create a highly optimized checks for the first couple of signatures with max 2 arguments
        const ok0 = signatures[0] && signatures[0].params.length <= 2 && !hasRestParam(signatures[0].params);
        const ok1 = signatures[1] && signatures[1].params.length <= 2 && !hasRestParam(signatures[1].params);
        const ok2 = signatures[2] && signatures[2].params.length <= 2 && !hasRestParam(signatures[2].params);
        const ok3 = signatures[3] && signatures[3].params.length <= 2 && !hasRestParam(signatures[3].params);
        const ok4 = signatures[4] && signatures[4].params.length <= 2 && !hasRestParam(signatures[4].params);
        const ok5 = signatures[5] && signatures[5].params.length <= 2 && !hasRestParam(signatures[5].params);
        const allOk = ok0 && ok1 && ok2 && ok3 && ok4 && ok5;

        // compile the tests
        for (let i = 0; i < signatures.length; ++i) {
          signatures[i].test = compileTests(signatures[i].params);
        }
        const test00 = ok0 ? compileTest(signatures[0].params[0]) : notOk;
        const test10 = ok1 ? compileTest(signatures[1].params[0]) : notOk;
        const test20 = ok2 ? compileTest(signatures[2].params[0]) : notOk;
        const test30 = ok3 ? compileTest(signatures[3].params[0]) : notOk;
        const test40 = ok4 ? compileTest(signatures[4].params[0]) : notOk;
        const test50 = ok5 ? compileTest(signatures[5].params[0]) : notOk;
        const test01 = ok0 ? compileTest(signatures[0].params[1]) : notOk;
        const test11 = ok1 ? compileTest(signatures[1].params[1]) : notOk;
        const test21 = ok2 ? compileTest(signatures[2].params[1]) : notOk;
        const test31 = ok3 ? compileTest(signatures[3].params[1]) : notOk;
        const test41 = ok4 ? compileTest(signatures[4].params[1]) : notOk;
        const test51 = ok5 ? compileTest(signatures[5].params[1]) : notOk;

        // compile the functions
        for (let i = 0; i < signatures.length; ++i) {
          signatures[i].implementation = compileArgsPreprocessing(signatures[i].params, signatures[i].fn);
        }
        const fn0 = ok0 ? signatures[0].implementation : undef;
        const fn1 = ok1 ? signatures[1].implementation : undef;
        const fn2 = ok2 ? signatures[2].implementation : undef;
        const fn3 = ok3 ? signatures[3].implementation : undef;
        const fn4 = ok4 ? signatures[4].implementation : undef;
        const fn5 = ok5 ? signatures[5].implementation : undef;
        const len0 = ok0 ? signatures[0].params.length : -1;
        const len1 = ok1 ? signatures[1].params.length : -1;
        const len2 = ok2 ? signatures[2].params.length : -1;
        const len3 = ok3 ? signatures[3].params.length : -1;
        const len4 = ok4 ? signatures[4].params.length : -1;
        const len5 = ok5 ? signatures[5].params.length : -1;

        // simple and generic, but also slow
        const iStart = allOk ? 6 : 0;
        const iEnd = signatures.length;
        // de-reference ahead for execution speed:
        const tests = signatures.map(s => s.test);
        const fns = signatures.map(s => s.implementation);
        const generic = function generic() {

          for (let i = iStart; i < iEnd; i++) {
            if (tests[i](arguments)) {
              return fns[i].apply(this, arguments);
            }
          }
          return typed.onMismatch(name, arguments, signatures);
        };

        // create the typed function
        // fast, specialized version. Falls back to the slower, generic one if needed
        function theTypedFn(arg0, arg1) {

          if (arguments.length === len0 && test00(arg0) && test01(arg1)) {
            return fn0.apply(this, arguments);
          }
          if (arguments.length === len1 && test10(arg0) && test11(arg1)) {
            return fn1.apply(this, arguments);
          }
          if (arguments.length === len2 && test20(arg0) && test21(arg1)) {
            return fn2.apply(this, arguments);
          }
          if (arguments.length === len3 && test30(arg0) && test31(arg1)) {
            return fn3.apply(this, arguments);
          }
          if (arguments.length === len4 && test40(arg0) && test41(arg1)) {
            return fn4.apply(this, arguments);
          }
          if (arguments.length === len5 && test50(arg0) && test51(arg1)) {
            return fn5.apply(this, arguments);
          }
          return generic.apply(this, arguments);
        }

        // attach name the typed function
        try {
          Object.defineProperty(theTypedFn, 'name', {
            value: name
          });
        } catch (err) {
          // old browsers do not support Object.defineProperty and some don't support setting the name property
          // the function name is not essential for the functioning, it's mostly useful for debugging,
          // so it's fine to have unnamed functions.
        }

        // attach signatures to the function.
        // This property is close to the original collection of signatures
        // used to create the typed-function, just with unions split:
        theTypedFn.signatures = signaturesMap;

        // Store internal data for functions like resolve, find, etc.
        // Also serves as the flag that this is a typed-function
        theTypedFn._typedFunctionData = {
          signatures,
          signatureMap: internalSignatureMap
        };
        return theTypedFn;
      }

      /**
       * Action to take on mismatch
       * @param {string} name      Name of function that was attempted to be called
       * @param {Array} args       Actual arguments to the call
       * @param {Array} signatures Known signatures of the named typed-function
       */
      function _onMismatch(name, args, signatures) {
        throw createError(name, args, signatures);
      }

      /**
       * Return all but the last items of an array or function Arguments
       * @param {Array | Arguments} arr
       * @return {Array}
       */
      function initial(arr) {
        return slice(arr, 0, arr.length - 1);
      }

      /**
       * return the last item of an array or function Arguments
       * @param {Array | Arguments} arr
       * @return {*}
       */
      function last(arr) {
        return arr[arr.length - 1];
      }

      /**
       * Slice an array or function Arguments
       * @param {Array | Arguments | IArguments} arr
       * @param {number} start
       * @param {number} [end]
       * @return {Array}
       */
      function slice(arr, start, end) {
        return Array.prototype.slice.call(arr, start, end);
      }

      /**
       * Return the first item from an array for which test(arr[i]) returns true
       * @param {Array} arr
       * @param {function} test
       * @return {* | undefined} Returns the first matching item
       *                         or undefined when there is no match
       */
      function findInArray(arr, test) {
        for (let i = 0; i < arr.length; i++) {
          if (test(arr[i])) {
            return arr[i];
          }
        }
        return undefined;
      }

      /**
       * Flat map the result invoking a callback for every item in an array.
       * https://gist.github.com/samgiles/762ee337dff48623e729
       * @param {Array} arr
       * @param {function} callback
       * @return {Array}
       */
      function flatMap(arr, callback) {
        return Array.prototype.concat.apply([], arr.map(callback));
      }

      /**
       * Create a reference callback to one or multiple signatures
       *
       * Syntax:
       *
       *     typed.referTo(signature1, signature2, ..., function callback(fn1, fn2, ...) {
       *       // ...
       *     })
       *
       * @returns {{referTo: {references: string[], callback}}}
       */
      function referTo() {
        const references = initial(arguments).map(s => stringifyParams(parseSignature(s)));
        const callback = last(arguments);
        if (typeof callback !== 'function') {
          throw new TypeError('Callback function expected as last argument');
        }
        return makeReferTo(references, callback);
      }
      function makeReferTo(references, callback) {
        return {
          referTo: {
            references,
            callback
          }
        };
      }

      /**
       * Create a reference callback to the typed-function itself
       *
       * @param {(self: function) => function} callback
       * @returns {{referToSelf: { callback: function }}}
       */
      function referToSelf(callback) {
        if (typeof callback !== 'function') {
          throw new TypeError('Callback function expected as first argument');
        }
        return {
          referToSelf: {
            callback
          }
        };
      }

      /**
       * Test whether something is a referTo object, holding a list with reference
       * signatures and a callback.
       *
       * @param {Object | function} objectOrFn
       * @returns {boolean}
       */
      function isReferTo(objectOrFn) {
        return objectOrFn && typeof objectOrFn.referTo === 'object' && Array.isArray(objectOrFn.referTo.references) && typeof objectOrFn.referTo.callback === 'function';
      }

      /**
       * Test whether something is a referToSelf object, holding a callback where
       * to pass `self`.
       *
       * @param {Object | function} objectOrFn
       * @returns {boolean}
       */
      function isReferToSelf(objectOrFn) {
        return objectOrFn && typeof objectOrFn.referToSelf === 'object' && typeof objectOrFn.referToSelf.callback === 'function';
      }

      /**
       * Check if name is (A) new, (B) a match, or (C) a mismatch; and throw
       * an error in case (C).
       *
       * @param { string | undefined } nameSoFar
       * @param { string | undefined } newName
       * @returns { string } updated name
       */
      function checkName(nameSoFar, newName) {
        if (!nameSoFar) {
          return newName;
        }
        if (newName && newName !== nameSoFar) {
          const err = new Error('Function names do not match (expected: ' + nameSoFar + ', actual: ' + newName + ')');
          err.data = {
            actual: newName,
            expected: nameSoFar
          };
          throw err;
        }
        return nameSoFar;
      }

      /**
       * Retrieve the implied name from an object with signature keys
       * and function values, checking whether all value names match
       *
       * @param { {string: function} } obj
       */
      function getObjectName(obj) {
        let name;
        for (const key in obj) {
          // Only pay attention to own properties, and only if their values
          // are typed functions or functions with a signature property
          if (Object.prototype.hasOwnProperty.call(obj, key) && (isTypedFunction(obj[key]) || typeof obj[key].signature === 'string')) {
            name = checkName(name, obj[key].name);
          }
        }
        return name;
      }

      /**
       * Copy all of the signatures from the second argument into the first,
       * which is modified by side effect, checking for conflicts
       *
       * @param {Object.<string, function|typed-reference>} dest
       * @param {Object.<string, function|typed-reference>} source
       */
      function mergeSignatures(dest, source) {
        let key;
        for (key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            if (key in dest) {
              if (source[key] !== dest[key]) {
                const err = new Error('Signature "' + key + '" is defined twice');
                err.data = {
                  signature: key,
                  sourceFunction: source[key],
                  destFunction: dest[key]
                };
                throw err;
              }
              // else: both signatures point to the same function, that's fine
            }
            dest[key] = source[key];
          }
        }
      }
      const saveTyped = typed;

      /**
       * Originally the main function was a typed function itself, but then
       * it might not be able to generate error messages if the client
       * replaced the type system with different names.
       *
       * Main entry: typed([name], functions/objects with signatures...)
       *
       * Assembles and returns a new typed-function from the given items
       * that provide signatures and implementations, each of which may be
       * * a plain object mapping (string) signatures to implementing functions,
       * * a previously constructed typed function, or
       * * any other single function with a string-valued property `signature`.
        * The name of the resulting typed-function will be given by the
       * string-valued name argument if present, or if not, by the name
       * of any of the arguments that have one, as long as any that do are
       * consistent with each other. If no name is specified, the name will be
       * an empty string.
       *
       * @param {string} maybeName [optional]
       * @param {(function|object)[]} signature providers
       * @returns {typed-function}
       */
      typed = function (maybeName) {
        const named = typeof maybeName === 'string';
        const start = named ? 1 : 0;
        let name = named ? maybeName : '';
        const allSignatures = {};
        for (let i = start; i < arguments.length; ++i) {
          const item = arguments[i];
          let theseSignatures = {};
          let thisName;
          if (typeof item === 'function') {
            thisName = item.name;
            if (typeof item.signature === 'string') {
              // Case 1: Ordinary function with a string 'signature' property
              theseSignatures[item.signature] = item;
            } else if (isTypedFunction(item)) {
              // Case 2: Existing typed function
              theseSignatures = item.signatures;
            }
          } else if (isPlainObject(item)) {
            // Case 3: Plain object, assume keys = signatures, values = functions
            theseSignatures = item;
            if (!named) {
              thisName = getObjectName(item);
            }
          }
          if (Object.keys(theseSignatures).length === 0) {
            const err = new TypeError('Argument to \'typed\' at index ' + i + ' is not a (typed) function, ' + 'nor an object with signatures as keys and functions as values.');
            err.data = {
              index: i,
              argument: item
            };
            throw err;
          }
          if (!named) {
            name = checkName(name, thisName);
          }
          mergeSignatures(allSignatures, theseSignatures);
        }
        return createTypedFunction(name || '', allSignatures);
      };
      typed.create = create;
      typed.createCount = saveTyped.createCount;
      typed.onMismatch = _onMismatch;
      typed.throwMismatchError = _onMismatch;
      typed.createError = createError;
      typed.clear = clear;
      typed.clearConversions = clearConversions;
      typed.addTypes = addTypes;
      typed._findType = findType; // For unit testing only
      typed.referTo = referTo;
      typed.referToSelf = referToSelf;
      typed.convert = convert;
      typed.findSignature = findSignature;
      typed.find = find;
      typed.isTypedFunction = isTypedFunction;
      typed.warnAgainstDeprecatedThis = true;

      /**
       * add a type (convenience wrapper for typed.addTypes)
       * @param {{name: string, test: function}} type
       * @param {boolean} [beforeObjectTest=true]
       *                          If true, the new test will be inserted before
       *                          the test with name 'Object' (if any), since
       *                          tests for Object match Array and classes too.
       */
      typed.addType = function (type, beforeObjectTest) {
        let before = 'any';
        if (beforeObjectTest !== false && typeMap.has('Object')) {
          before = 'Object';
        }
        typed.addTypes([type], before);
      };

      /**
       * Verify that the ConversionDef conversion has a valid format.
       *
       * @param {conversionDef} conversion
       * @return {void}
       * @throws {TypeError|SyntaxError}
       */
      function _validateConversion(conversion) {
        if (!conversion || typeof conversion.from !== 'string' || typeof conversion.to !== 'string' || typeof conversion.convert !== 'function') {
          throw new TypeError('Object with properties {from: string, to: string, convert: function} expected');
        }
        if (conversion.to === conversion.from) {
          throw new SyntaxError('Illegal to define conversion from "' + conversion.from + '" to itself.');
        }
      }

      /**
       * Add a conversion
       *
       * @param {ConversionDef} conversion
       * @param {{override: boolean}} [options]
       * @returns {void}
       * @throws {TypeError}
       */
      typed.addConversion = function (conversion) {
        let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {
          override: false
        };
        _validateConversion(conversion);
        const to = findType(conversion.to);
        const existing = to.conversionsTo.find(other => other.from === conversion.from);
        if (existing) {
          if (options && options.override) {
            typed.removeConversion({
              from: existing.from,
              to: conversion.to,
              convert: existing.convert
            });
          } else {
            throw new Error('There is already a conversion from "' + conversion.from + '" to "' + to.name + '"');
          }
        }
        to.conversionsTo.push({
          from: conversion.from,
          convert: conversion.convert,
          index: nConversions++
        });
      };

      /**
       * Convenience wrapper to call addConversion on each conversion in a list.
       *
       * @param {ConversionDef[]} conversions
       * @param {{override: boolean}} [options]
       * @returns {void}
       * @throws {TypeError}
       */
      typed.addConversions = function (conversions, options) {
        conversions.forEach(conversion => typed.addConversion(conversion, options));
      };

      /**
       * Remove the specified conversion. The format is the same as for
       * addConversion, and the convert function must match or an error
       * is thrown.
       *
       * @param {{from: string, to: string, convert: function}} conversion
       * @returns {void}
       * @throws {TypeError|SyntaxError|Error}
       */
      typed.removeConversion = function (conversion) {
        _validateConversion(conversion);
        const to = findType(conversion.to);
        const existingConversion = findInArray(to.conversionsTo, c => c.from === conversion.from);
        if (!existingConversion) {
          throw new Error('Attempt to remove nonexistent conversion from ' + conversion.from + ' to ' + conversion.to);
        }
        if (existingConversion.convert !== conversion.convert) {
          throw new Error('Conversion to remove does not match existing conversion');
        }
        const index = to.conversionsTo.indexOf(existingConversion);
        to.conversionsTo.splice(index, 1);
      };

      /**
       * Produce the specific signature that a typed function
       * will execute on the given arguments. Here, a "signature" is an
       * object with properties 'params', 'test', 'fn', and 'implementation'.
       * This last property is a function that converts params as necessary
       * and then calls 'fn'. Returns null if there is no matching signature.
       * @param {typed-function} tf
       * @param {any[]} argList
       * @returns {{params: string, test: function, fn: function, implementation: function}}
       */
      typed.resolve = function (tf, argList) {
        if (!isTypedFunction(tf)) {
          throw new TypeError(NOT_TYPED_FUNCTION);
        }
        const sigs = tf._typedFunctionData.signatures;
        for (let i = 0; i < sigs.length; ++i) {
          if (sigs[i].test(argList)) {
            return sigs[i];
          }
        }
        return null;
      };
      return typed;
    }
    var typedFunction = create();

    /**
     * Create a factory function, which can be used to inject dependencies.
     *
     * The created functions are memoized, a consecutive call of the factory
     * with the exact same inputs will return the same function instance.
     * The memoized cache is exposed on `factory.cache` and can be cleared
     * if needed.
     *
     * Example:
     *
     *     const name = 'log'
     *     const dependencies = ['config', 'typed', 'divideScalar', 'Complex']
     *
     *     export const createLog = factory(name, dependencies, ({ typed, config, divideScalar, Complex }) => {
     *       // ... create the function log here and return it
     *     }
     *
     * @param {string} name           Name of the function to be created
     * @param {string[]} dependencies The names of all required dependencies
     * @param {function} create       Callback function called with an object with all dependencies
     * @param {Object} [meta]
     *     Optional object with meta information that will be attached
     *     to the created factory function as property `meta`. For explanation
     *     of what meta properties can be specified and what they mean, see
     *     docs/core/extension.md.
     * @returns {function}
     */
    function factory(name, dependencies, create, meta) {
      function assertAndCreate(scope) {
        // we only pass the requested dependencies to the factory function
        // to prevent functions to rely on dependencies that are not explicitly
        // requested.
        var deps = pickShallow(scope, dependencies.map(stripOptionalNotation));
        assertDependencies(name, dependencies, scope);
        return create(deps);
      }
      assertAndCreate.isFactory = true;
      assertAndCreate.fn = name;
      assertAndCreate.dependencies = dependencies.slice().sort();
      if (meta) {
        assertAndCreate.meta = meta;
      }
      return assertAndCreate;
    }

    /**
     * Assert that all dependencies of a list with dependencies are available in the provided scope.
     *
     * Will throw an exception when there are dependencies missing.
     *
     * @param {string} name   Name for the function to be created. Used to generate a useful error message
     * @param {string[]} dependencies
     * @param {Object} scope
     */
    function assertDependencies(name, dependencies, scope) {
      var allDefined = dependencies.filter(dependency => !isOptionalDependency(dependency)) // filter optionals
      .every(dependency => scope[dependency] !== undefined);
      if (!allDefined) {
        var missingDependencies = dependencies.filter(dependency => scope[dependency] === undefined);

        // TODO: create a custom error class for this, a MathjsError or something like that
        throw new Error("Cannot create function \"".concat(name, "\", ") + "some dependencies are missing: ".concat(missingDependencies.map(d => "\"".concat(d, "\"")).join(', '), "."));
      }
    }
    function isOptionalDependency(dependency) {
      return dependency && dependency[0] === '?';
    }
    function stripOptionalNotation(dependency) {
      return dependency && dependency[0] === '?' ? dependency.slice(1) : dependency;
    }

    /**
     * @typedef {{sign: '+' | '-' | '', coefficients: number[], exponent: number}} SplitValue
     */

    /**
     * Check if a number is integer
     * @param {number | boolean} value
     * @return {boolean} isInteger
     */
    function isInteger(value) {
      if (typeof value === 'boolean') {
        return true;
      }
      return isFinite(value) ? value === Math.round(value) : false;
    }

    /**
     * Calculate the sign of a number
     * @param {number} x
     * @returns {number}
     */
    var sign$1 = Math.sign || function (x) {
      if (x > 0) {
        return 1;
      } else if (x < 0) {
        return -1;
      } else {
        return 0;
      }
    };

    /**
     * Formats a number in a given base
     * @param {number} n
     * @param {number} base
     * @param {number} size
     * @returns {string}
     */
    function formatNumberToBase(n, base, size) {
      var prefixes = {
        2: '0b',
        8: '0o',
        16: '0x'
      };
      var prefix = prefixes[base];
      var suffix = '';
      if (size) {
        if (size < 1) {
          throw new Error('size must be in greater than 0');
        }
        if (!isInteger(size)) {
          throw new Error('size must be an integer');
        }
        if (n > 2 ** (size - 1) - 1 || n < -(2 ** (size - 1))) {
          throw new Error("Value must be in range [-2^".concat(size - 1, ", 2^").concat(size - 1, "-1]"));
        }
        if (!isInteger(n)) {
          throw new Error('Value must be an integer');
        }
        if (n < 0) {
          n = n + 2 ** size;
        }
        suffix = "i".concat(size);
      }
      var sign = '';
      if (n < 0) {
        n = -n;
        sign = '-';
      }
      return "".concat(sign).concat(prefix).concat(n.toString(base)).concat(suffix);
    }

    /**
     * Convert a number to a formatted string representation.
     *
     * Syntax:
     *
     *    format(value)
     *    format(value, options)
     *    format(value, precision)
     *    format(value, fn)
     *
     * Where:
     *
     *    {number} value   The value to be formatted
     *    {Object} options An object with formatting options. Available options:
     *                     {string} notation
     *                         Number notation. Choose from:
     *                         'fixed'          Always use regular number notation.
     *                                          For example '123.40' and '14000000'
     *                         'exponential'    Always use exponential notation.
     *                                          For example '1.234e+2' and '1.4e+7'
     *                         'engineering'    Always use engineering notation.
     *                                          For example '123.4e+0' and '14.0e+6'
     *                         'auto' (default) Regular number notation for numbers
     *                                          having an absolute value between
     *                                          `lowerExp` and `upperExp` bounds, and
     *                                          uses exponential notation elsewhere.
     *                                          Lower bound is included, upper bound
     *                                          is excluded.
     *                                          For example '123.4' and '1.4e7'.
     *                         'bin', 'oct, or
     *                         'hex'            Format the number using binary, octal,
     *                                          or hexadecimal notation.
     *                                          For example '0b1101' and '0x10fe'.
     *                     {number} wordSize    The word size in bits to use for formatting
     *                                          in binary, octal, or hexadecimal notation.
     *                                          To be used only with 'bin', 'oct', or 'hex'
     *                                          values for 'notation' option. When this option
     *                                          is defined the value is formatted as a signed
     *                                          twos complement integer of the given word size
     *                                          and the size suffix is appended to the output.
     *                                          For example
     *                                          format(-1, {notation: 'hex', wordSize: 8}) === '0xffi8'.
     *                                          Default value is undefined.
     *                     {number} precision   A number between 0 and 16 to round
     *                                          the digits of the number.
     *                                          In case of notations 'exponential',
     *                                          'engineering', and 'auto',
     *                                          `precision` defines the total
     *                                          number of significant digits returned.
     *                                          In case of notation 'fixed',
     *                                          `precision` defines the number of
     *                                          significant digits after the decimal
     *                                          point.
     *                                          `precision` is undefined by default,
     *                                          not rounding any digits.
     *                     {number} lowerExp    Exponent determining the lower boundary
     *                                          for formatting a value with an exponent
     *                                          when `notation='auto`.
     *                                          Default value is `-3`.
     *                     {number} upperExp    Exponent determining the upper boundary
     *                                          for formatting a value with an exponent
     *                                          when `notation='auto`.
     *                                          Default value is `5`.
     *    {Function} fn    A custom formatting function. Can be used to override the
     *                     built-in notations. Function `fn` is called with `value` as
     *                     parameter and must return a string. Is useful for example to
     *                     format all values inside a matrix in a particular way.
     *
     * Examples:
     *
     *    format(6.4)                                        // '6.4'
     *    format(1240000)                                    // '1.24e6'
     *    format(1/3)                                        // '0.3333333333333333'
     *    format(1/3, 3)                                     // '0.333'
     *    format(21385, 2)                                   // '21000'
     *    format(12.071, {notation: 'fixed'})                // '12'
     *    format(2.3,    {notation: 'fixed', precision: 2})  // '2.30'
     *    format(52.8,   {notation: 'exponential'})          // '5.28e+1'
     *    format(12345678, {notation: 'engineering'})        // '12.345678e+6'
     *
     * @param {number} value
     * @param {Object | Function | number} [options]
     * @return {string} str The formatted value
     */
    function format$2(value, options) {
      if (typeof options === 'function') {
        // handle format(value, fn)
        return options(value);
      }

      // handle special cases
      if (value === Infinity) {
        return 'Infinity';
      } else if (value === -Infinity) {
        return '-Infinity';
      } else if (isNaN(value)) {
        return 'NaN';
      }
      var {
        notation,
        precision,
        wordSize
      } = normalizeFormatOptions(options);

      // handle the various notations
      switch (notation) {
        case 'fixed':
          return toFixed$1(value, precision);
        case 'exponential':
          return toExponential$1(value, precision);
        case 'engineering':
          return toEngineering$1(value, precision);
        case 'bin':
          return formatNumberToBase(value, 2, wordSize);
        case 'oct':
          return formatNumberToBase(value, 8, wordSize);
        case 'hex':
          return formatNumberToBase(value, 16, wordSize);
        case 'auto':
          // remove trailing zeros after the decimal point
          return toPrecision(value, precision, options).replace(/((\.\d*?)(0+))($|e)/, function () {
            var digits = arguments[2];
            var e = arguments[4];
            return digits !== '.' ? digits + e : e;
          });
        default:
          throw new Error('Unknown notation "' + notation + '". ' + 'Choose "auto", "exponential", "fixed", "bin", "oct", or "hex.');
      }
    }

    /**
     * Normalize format options into an object:
     *   {
     *     notation: string,
     *     precision: number | undefined,
     *     wordSize: number | undefined
     *   }
     */
    function normalizeFormatOptions(options) {
      // default values for options
      var notation = 'auto';
      var precision;
      var wordSize;
      if (options !== undefined) {
        if (isNumber(options)) {
          precision = options;
        } else if (isBigNumber(options)) {
          precision = options.toNumber();
        } else if (isObject(options)) {
          if (options.precision !== undefined) {
            precision = _toNumberOrThrow(options.precision, () => {
              throw new Error('Option "precision" must be a number or BigNumber');
            });
          }
          if (options.wordSize !== undefined) {
            wordSize = _toNumberOrThrow(options.wordSize, () => {
              throw new Error('Option "wordSize" must be a number or BigNumber');
            });
          }
          if (options.notation) {
            notation = options.notation;
          }
        } else {
          throw new Error('Unsupported type of options, number, BigNumber, or object expected');
        }
      }
      return {
        notation,
        precision,
        wordSize
      };
    }

    /**
     * Split a number into sign, coefficients, and exponent
     * @param {number | string} value
     * @return {SplitValue}
     *              Returns an object containing sign, coefficients, and exponent
     */
    function splitNumber(value) {
      // parse the input value
      var match = String(value).toLowerCase().match(/^(-?)(\d+\.?\d*)(e([+-]?\d+))?$/);
      if (!match) {
        throw new SyntaxError('Invalid number ' + value);
      }
      var sign = match[1];
      var digits = match[2];
      var exponent = parseFloat(match[4] || '0');
      var dot = digits.indexOf('.');
      exponent += dot !== -1 ? dot - 1 : digits.length - 1;
      var coefficients = digits.replace('.', '') // remove the dot (must be removed before removing leading zeros)
      .replace(/^0*/, function (zeros) {
        // remove leading zeros, add their count to the exponent
        exponent -= zeros.length;
        return '';
      }).replace(/0*$/, '') // remove trailing zeros
      .split('').map(function (d) {
        return parseInt(d);
      });
      if (coefficients.length === 0) {
        coefficients.push(0);
        exponent++;
      }
      return {
        sign,
        coefficients,
        exponent
      };
    }

    /**
     * Format a number in engineering notation. Like '1.23e+6', '2.3e+0', '3.500e-3'
     * @param {number | string} value
     * @param {number} [precision]        Optional number of significant figures to return.
     */
    function toEngineering$1(value, precision) {
      if (isNaN(value) || !isFinite(value)) {
        return String(value);
      }
      var split = splitNumber(value);
      var rounded = roundDigits(split, precision);
      var e = rounded.exponent;
      var c = rounded.coefficients;

      // find nearest lower multiple of 3 for exponent
      var newExp = e % 3 === 0 ? e : e < 0 ? e - 3 - e % 3 : e - e % 3;
      if (isNumber(precision)) {
        // add zeroes to give correct sig figs
        while (precision > c.length || e - newExp + 1 > c.length) {
          c.push(0);
        }
      } else {
        // concatenate coefficients with necessary zeros
        // add zeros if necessary (for example: 1e+8 -> 100e+6)
        var missingZeros = Math.abs(e - newExp) - (c.length - 1);
        for (var i = 0; i < missingZeros; i++) {
          c.push(0);
        }
      }

      // find difference in exponents
      var expDiff = Math.abs(e - newExp);
      var decimalIdx = 1;

      // push decimal index over by expDiff times
      while (expDiff > 0) {
        decimalIdx++;
        expDiff--;
      }

      // if all coefficient values are zero after the decimal point and precision is unset, don't add a decimal value.
      // otherwise concat with the rest of the coefficients
      var decimals = c.slice(decimalIdx).join('');
      var decimalVal = isNumber(precision) && decimals.length || decimals.match(/[1-9]/) ? '.' + decimals : '';
      var str = c.slice(0, decimalIdx).join('') + decimalVal + 'e' + (e >= 0 ? '+' : '') + newExp.toString();
      return rounded.sign + str;
    }

    /**
     * Format a number with fixed notation.
     * @param {number | string} value
     * @param {number} [precision=undefined]  Optional number of decimals after the
     *                                        decimal point. null by default.
     */
    function toFixed$1(value, precision) {
      if (isNaN(value) || !isFinite(value)) {
        return String(value);
      }
      var splitValue = splitNumber(value);
      var rounded = typeof precision === 'number' ? roundDigits(splitValue, splitValue.exponent + 1 + precision) : splitValue;
      var c = rounded.coefficients;
      var p = rounded.exponent + 1; // exponent may have changed

      // append zeros if needed
      var pp = p + (precision || 0);
      if (c.length < pp) {
        c = c.concat(zeros(pp - c.length));
      }

      // prepend zeros if needed
      if (p < 0) {
        c = zeros(-p + 1).concat(c);
        p = 1;
      }

      // insert a dot if needed
      if (p < c.length) {
        c.splice(p, 0, p === 0 ? '0.' : '.');
      }
      return rounded.sign + c.join('');
    }

    /**
     * Format a number in exponential notation. Like '1.23e+5', '2.3e+0', '3.500e-3'
     * @param {number | string} value
     * @param {number} [precision]  Number of digits in formatted output.
     *                              If not provided, the maximum available digits
     *                              is used.
     */
    function toExponential$1(value, precision) {
      if (isNaN(value) || !isFinite(value)) {
        return String(value);
      }

      // round if needed, else create a clone
      var split = splitNumber(value);
      var rounded = precision ? roundDigits(split, precision) : split;
      var c = rounded.coefficients;
      var e = rounded.exponent;

      // append zeros if needed
      if (c.length < precision) {
        c = c.concat(zeros(precision - c.length));
      }

      // format as `C.CCCe+EEE` or `C.CCCe-EEE`
      var first = c.shift();
      return rounded.sign + first + (c.length > 0 ? '.' + c.join('') : '') + 'e' + (e >= 0 ? '+' : '') + e;
    }

    /**
     * Format a number with a certain precision
     * @param {number | string} value
     * @param {number} [precision=undefined] Optional number of digits.
     * @param {{lowerExp: number | undefined, upperExp: number | undefined}} [options]
     *                                       By default:
     *                                         lowerExp = -3 (incl)
     *                                         upper = +5 (excl)
     * @return {string}
     */
    function toPrecision(value, precision, options) {
      if (isNaN(value) || !isFinite(value)) {
        return String(value);
      }

      // determine lower and upper bound for exponential notation.
      var lowerExp = _toNumberOrDefault$1(options === null || options === void 0 ? void 0 : options.lowerExp, -3);
      var upperExp = _toNumberOrDefault$1(options === null || options === void 0 ? void 0 : options.upperExp, 5);
      var split = splitNumber(value);
      var rounded = precision ? roundDigits(split, precision) : split;
      if (rounded.exponent < lowerExp || rounded.exponent >= upperExp) {
        // exponential notation
        return toExponential$1(value, precision);
      } else {
        var c = rounded.coefficients;
        var e = rounded.exponent;

        // append trailing zeros
        if (c.length < precision) {
          c = c.concat(zeros(precision - c.length));
        }

        // append trailing zeros
        // TODO: simplify the next statement
        c = c.concat(zeros(e - c.length + 1 + (c.length < precision ? precision - c.length : 0)));

        // prepend zeros
        c = zeros(-e).concat(c);
        var dot = e > 0 ? e : 0;
        if (dot < c.length - 1) {
          c.splice(dot + 1, 0, '.');
        }
        return rounded.sign + c.join('');
      }
    }

    /**
     * Round the number of digits of a number *
     * @param {SplitValue} split       A value split with .splitNumber(value)
     * @param {number} precision  A positive integer
     * @return {SplitValue}
     *              Returns an object containing sign, coefficients, and exponent
     *              with rounded digits
     */
    function roundDigits(split, precision) {
      // create a clone
      var rounded = {
        sign: split.sign,
        coefficients: split.coefficients,
        exponent: split.exponent
      };
      var c = rounded.coefficients;

      // prepend zeros if needed
      while (precision <= 0) {
        c.unshift(0);
        rounded.exponent++;
        precision++;
      }
      if (c.length > precision) {
        var removed = c.splice(precision, c.length - precision);
        if (removed[0] >= 5) {
          var i = precision - 1;
          c[i]++;
          while (c[i] === 10) {
            c.pop();
            if (i === 0) {
              c.unshift(0);
              rounded.exponent++;
              i++;
            }
            i--;
            c[i]++;
          }
        }
      }
      return rounded;
    }

    /**
     * Create an array filled with zeros.
     * @param {number} length
     * @return {Array}
     */
    function zeros(length) {
      var arr = [];
      for (var i = 0; i < length; i++) {
        arr.push(0);
      }
      return arr;
    }

    /**
     * Count the number of significant digits of a number.
     *
     * For example:
     *   2.34 returns 3
     *   0.0034 returns 2
     *   120.5e+30 returns 4
     *
     * @param {number} value
     * @return {number} digits   Number of significant digits
     */
    function digits(value) {
      return value.toExponential().replace(/e.*$/, '') // remove exponential notation
      .replace(/^0\.?0*|\./, '') // remove decimal point and leading zeros
      .length;
    }

    /**
     * Compares two floating point numbers.
     * @param {number} a - First value to compare
     * @param {number} b - Second value to compare
     * @param {number} [relTol=1e-09] - The relative tolerance, indicating the maximum allowed difference relative to the larger absolute value. Must be greater than 0.
     * @param {number} [absTol=1e-12] - The minimum absolute tolerance, useful for comparisons near zero. Must be at least 0.
     * @return {boolean} whether the two numbers are nearly equal
     *
     * @throws {Error} If `relTol` is less than or equal to 0.
     * @throws {Error} If `absTol` is less than 0.
     *
     * @example
     * nearlyEqual(1.000000001, 1.0, 1e-8);            // true
     * nearlyEqual(1.000000002, 1.0, 0);            // false
     * nearlyEqual(1.0, 1.009, undefined, 0.01);       // true
     * nearlyEqual(0.000000001, 0.0, undefined, 1e-8); // true
     */
    function nearlyEqual$1(a, b) {
      var relTol = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1e-8;
      var absTol = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
      if (relTol <= 0) {
        throw new Error('Relative tolerance must be greater than 0');
      }
      if (absTol < 0) {
        throw new Error('Absolute tolerance must be at least 0');
      }

      // NaN
      if (isNaN(a) || isNaN(b)) {
        return false;
      }
      if (!isFinite(a) || !isFinite(b)) {
        return a === b;
      }
      if (a === b) {
        return true;
      }

      // abs(a-b) <= max(rel_tol * max(abs(a), abs(b)), abs_tol)
      return Math.abs(a - b) <= Math.max(relTol * Math.max(Math.abs(a), Math.abs(b)), absTol);
    }

    /**
     * Returns a value with the magnitude of x and the sign of y.
     * @param {number} x
     * @param {number} y
     * @returns {number}
     */
    function copysign(x, y) {
      var signx = true ;
      var signy = y > 0 ? true : y < 0 ? false : 1 / y === Infinity;
      return signx ^ signy ? -6.283185307179586 : x;
    }
    function _toNumberOrThrow(value, onError) {
      if (isNumber(value)) {
        return value;
      } else if (isBigNumber(value)) {
        return value.toNumber();
      } else {
        onError();
      }
    }
    function _toNumberOrDefault$1(value, defaultValue) {
      if (isNumber(value)) {
        return value;
      } else if (isBigNumber(value)) {
        return value.toNumber();
      } else {
        return defaultValue;
      }
    }

    /**
     * Create a typed-function which checks the types of the arguments and
     * can match them against multiple provided signatures. The typed-function
     * automatically converts inputs in order to find a matching signature.
     * Typed functions throw informative errors in case of wrong input arguments.
     *
     * See the library [typed-function](https://github.com/josdejong/typed-function)
     * for detailed documentation.
     *
     * Syntax:
     *
     *     math.typed(name, signatures) : function
     *     math.typed(signatures) : function
     *
     * Examples:
     *
     *     // create a typed function with multiple types per argument (type union)
     *     const fn2 = typed({
     *       'number | boolean': function (b) {
     *         return 'b is a number or boolean'
     *       },
     *       'string, number | boolean': function (a, b) {
     *         return 'a is a string, b is a number or boolean'
     *       }
     *     })
     *
     *     // create a typed function with an any type argument
     *     const log = typed({
     *       'string, any': function (event, data) {
     *         console.log('event: ' + event + ', data: ' + JSON.stringify(data))
     *       }
     *     })
     *
     * @param {string} [name]                          Optional name for the typed-function
     * @param {Object<string, function>} signatures   Object with one or multiple function signatures
     * @returns {function} The created typed-function.
     */


    // returns a new instance of typed-function
    var _createTyped2 = function _createTyped() {
      // initially, return the original instance of typed-function
      // consecutively, return a new instance from typed.create.
      _createTyped2 = typedFunction.create;
      return typedFunction;
    };
    var dependencies$w = ['?BigNumber', '?Complex', '?DenseMatrix', '?Fraction'];

    /**
     * Factory function for creating a new typed instance
     * @param {Object} dependencies   Object with data types like Complex and BigNumber
     * @returns {Function}
     */
    var createTyped = /* #__PURE__ */factory('typed', dependencies$w, function createTyped(_ref) {
      var {
        BigNumber,
        Complex,
        DenseMatrix,
        Fraction
      } = _ref;
      // TODO: typed-function must be able to silently ignore signatures with unknown data types

      // get a new instance of typed-function
      var typed = _createTyped2();

      // define all types. The order of the types determines in which order function
      // arguments are type-checked (so for performance it's important to put the
      // most used types first).
      typed.clear();
      typed.addTypes([{
        name: 'number',
        test: isNumber
      }, {
        name: 'Complex',
        test: isComplex
      }, {
        name: 'BigNumber',
        test: isBigNumber
      }, {
        name: 'bigint',
        test: isBigInt
      }, {
        name: 'Fraction',
        test: isFraction
      }, {
        name: 'Unit',
        test: isUnit
      },
      // The following type matches a valid variable name, i.e., an alphanumeric
      // string starting with an alphabetic character. It is used (at least)
      // in the definition of the derivative() function, as the argument telling
      // what to differentiate over must (currently) be a variable.
      // TODO: deprecate the identifier type (it's not used anymore, see https://github.com/josdejong/mathjs/issues/3253)
      {
        name: 'identifier',
        test: s => isString && /^(?:[A-Za-z\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0560-\u0588\u05D0-\u05EA\u05EF-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u0870-\u0887\u0889-\u088E\u08A0-\u08C9\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u09FC\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C5D\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D04-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E86-\u0E8A\u0E8C-\u0EA3\u0EA5\u0EA7-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16F1-\u16F8\u1700-\u1711\u171F-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1878\u1880-\u1884\u1887-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4C\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C8A\u1C90-\u1CBA\u1CBD-\u1CBF\u1CE9-\u1CEC\u1CEE-\u1CF3\u1CF5\u1CF6\u1CFA\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2183\u2184\u2C00-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005\u3006\u3031-\u3035\u303B\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312F\u3131-\u318E\u31A0-\u31BF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6E5\uA717-\uA71F\uA722-\uA788\uA78B-\uA7CD\uA7D0\uA7D1\uA7D3\uA7D5-\uA7DC\uA7F2-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA8FE\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB69\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDE80-\uDE9C\uDEA0-\uDED0\uDF00-\uDF1F\uDF2D-\uDF40\uDF42-\uDF49\uDF50-\uDF75\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF]|\uD801[\uDC00-\uDC9D\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDD70-\uDD7A\uDD7C-\uDD8A\uDD8C-\uDD92\uDD94\uDD95\uDD97-\uDDA1\uDDA3-\uDDB1\uDDB3-\uDDB9\uDDBB\uDDBC\uDDC0-\uDDF3\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67\uDF80-\uDF85\uDF87-\uDFB0\uDFB2-\uDFBA]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00\uDE10-\uDE13\uDE15-\uDE17\uDE19-\uDE35\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE4\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2\uDD00-\uDD23\uDD4A-\uDD65\uDD6F-\uDD85\uDE80-\uDEA9\uDEB0\uDEB1\uDEC2-\uDEC4\uDF00-\uDF1C\uDF27\uDF30-\uDF45\uDF70-\uDF81\uDFB0-\uDFC4\uDFE0-\uDFF6]|\uD804[\uDC03-\uDC37\uDC71\uDC72\uDC75\uDC83-\uDCAF\uDCD0-\uDCE8\uDD03-\uDD26\uDD44\uDD47\uDD50-\uDD72\uDD76\uDD83-\uDDB2\uDDC1-\uDDC4\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE2B\uDE3F\uDE40\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEDE\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3D\uDF50\uDF5D-\uDF61\uDF80-\uDF89\uDF8B\uDF8E\uDF90-\uDFB5\uDFB7\uDFD1\uDFD3]|\uD805[\uDC00-\uDC34\uDC47-\uDC4A\uDC5F-\uDC61\uDC80-\uDCAF\uDCC4\uDCC5\uDCC7\uDD80-\uDDAE\uDDD8-\uDDDB\uDE00-\uDE2F\uDE44\uDE80-\uDEAA\uDEB8\uDF00-\uDF1A\uDF40-\uDF46]|\uD806[\uDC00-\uDC2B\uDCA0-\uDCDF\uDCFF-\uDD06\uDD09\uDD0C-\uDD13\uDD15\uDD16\uDD18-\uDD2F\uDD3F\uDD41\uDDA0-\uDDA7\uDDAA-\uDDD0\uDDE1\uDDE3\uDE00\uDE0B-\uDE32\uDE3A\uDE50\uDE5C-\uDE89\uDE9D\uDEB0-\uDEF8\uDFC0-\uDFE0]|\uD807[\uDC00-\uDC08\uDC0A-\uDC2E\uDC40\uDC72-\uDC8F\uDD00-\uDD06\uDD08\uDD09\uDD0B-\uDD30\uDD46\uDD60-\uDD65\uDD67\uDD68\uDD6A-\uDD89\uDD98\uDEE0-\uDEF2\uDF02\uDF04-\uDF10\uDF12-\uDF33\uDFB0]|\uD808[\uDC00-\uDF99]|\uD809[\uDC80-\uDD43]|\uD80B[\uDF90-\uDFF0]|[\uD80C\uD80E\uD80F\uD81C-\uD820\uD822\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872\uD874-\uD879\uD880-\uD883\uD885-\uD887][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2F\uDC41-\uDC46\uDC60-\uDFFF]|\uD810[\uDC00-\uDFFA]|\uD811[\uDC00-\uDE46]|\uD818[\uDD00-\uDD1D]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDE70-\uDEBE\uDED0-\uDEED\uDF00-\uDF2F\uDF40-\uDF43\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDD40-\uDD6C\uDE40-\uDE7F\uDF00-\uDF4A\uDF50\uDF93-\uDF9F\uDFE0\uDFE1\uDFE3]|\uD821[\uDC00-\uDFF7]|\uD823[\uDC00-\uDCD5\uDCFF-\uDD08]|\uD82B[\uDFF0-\uDFF3\uDFF5-\uDFFB\uDFFD\uDFFE]|\uD82C[\uDC00-\uDD22\uDD32\uDD50-\uDD52\uDD55\uDD64-\uDD67\uDD70-\uDEFB]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB]|\uD837[\uDF00-\uDF1E\uDF25-\uDF2A]|\uD838[\uDC30-\uDC6D\uDD00-\uDD2C\uDD37-\uDD3D\uDD4E\uDE90-\uDEAD\uDEC0-\uDEEB]|\uD839[\uDCD0-\uDCEB\uDDD0-\uDDED\uDDF0\uDFE0-\uDFE6\uDFE8-\uDFEB\uDFED\uDFEE\uDFF0-\uDFFE]|\uD83A[\uDC00-\uDCC4\uDD00-\uDD43\uDD4B]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDEDF\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF39\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1\uDEB0-\uDFFF]|\uD87A[\uDC00-\uDFE0\uDFF0-\uDFFF]|\uD87B[\uDC00-\uDE5D]|\uD87E[\uDC00-\uDE1D]|\uD884[\uDC00-\uDF4A\uDF50-\uDFFF]|\uD888[\uDC00-\uDFAF])(?:[0-9A-Za-z\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0560-\u0588\u05D0-\u05EA\u05EF-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u0870-\u0887\u0889-\u088E\u08A0-\u08C9\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u09FC\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C5D\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D04-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E86-\u0E8A\u0E8C-\u0EA3\u0EA5\u0EA7-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16F1-\u16F8\u1700-\u1711\u171F-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1878\u1880-\u1884\u1887-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4C\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C8A\u1C90-\u1CBA\u1CBD-\u1CBF\u1CE9-\u1CEC\u1CEE-\u1CF3\u1CF5\u1CF6\u1CFA\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2183\u2184\u2C00-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005\u3006\u3031-\u3035\u303B\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312F\u3131-\u318E\u31A0-\u31BF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6E5\uA717-\uA71F\uA722-\uA788\uA78B-\uA7CD\uA7D0\uA7D1\uA7D3\uA7D5-\uA7DC\uA7F2-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA8FE\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB69\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDE80-\uDE9C\uDEA0-\uDED0\uDF00-\uDF1F\uDF2D-\uDF40\uDF42-\uDF49\uDF50-\uDF75\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF]|\uD801[\uDC00-\uDC9D\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDD70-\uDD7A\uDD7C-\uDD8A\uDD8C-\uDD92\uDD94\uDD95\uDD97-\uDDA1\uDDA3-\uDDB1\uDDB3-\uDDB9\uDDBB\uDDBC\uDDC0-\uDDF3\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67\uDF80-\uDF85\uDF87-\uDFB0\uDFB2-\uDFBA]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00\uDE10-\uDE13\uDE15-\uDE17\uDE19-\uDE35\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE4\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2\uDD00-\uDD23\uDD4A-\uDD65\uDD6F-\uDD85\uDE80-\uDEA9\uDEB0\uDEB1\uDEC2-\uDEC4\uDF00-\uDF1C\uDF27\uDF30-\uDF45\uDF70-\uDF81\uDFB0-\uDFC4\uDFE0-\uDFF6]|\uD804[\uDC03-\uDC37\uDC71\uDC72\uDC75\uDC83-\uDCAF\uDCD0-\uDCE8\uDD03-\uDD26\uDD44\uDD47\uDD50-\uDD72\uDD76\uDD83-\uDDB2\uDDC1-\uDDC4\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE2B\uDE3F\uDE40\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEDE\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3D\uDF50\uDF5D-\uDF61\uDF80-\uDF89\uDF8B\uDF8E\uDF90-\uDFB5\uDFB7\uDFD1\uDFD3]|\uD805[\uDC00-\uDC34\uDC47-\uDC4A\uDC5F-\uDC61\uDC80-\uDCAF\uDCC4\uDCC5\uDCC7\uDD80-\uDDAE\uDDD8-\uDDDB\uDE00-\uDE2F\uDE44\uDE80-\uDEAA\uDEB8\uDF00-\uDF1A\uDF40-\uDF46]|\uD806[\uDC00-\uDC2B\uDCA0-\uDCDF\uDCFF-\uDD06\uDD09\uDD0C-\uDD13\uDD15\uDD16\uDD18-\uDD2F\uDD3F\uDD41\uDDA0-\uDDA7\uDDAA-\uDDD0\uDDE1\uDDE3\uDE00\uDE0B-\uDE32\uDE3A\uDE50\uDE5C-\uDE89\uDE9D\uDEB0-\uDEF8\uDFC0-\uDFE0]|\uD807[\uDC00-\uDC08\uDC0A-\uDC2E\uDC40\uDC72-\uDC8F\uDD00-\uDD06\uDD08\uDD09\uDD0B-\uDD30\uDD46\uDD60-\uDD65\uDD67\uDD68\uDD6A-\uDD89\uDD98\uDEE0-\uDEF2\uDF02\uDF04-\uDF10\uDF12-\uDF33\uDFB0]|\uD808[\uDC00-\uDF99]|\uD809[\uDC80-\uDD43]|\uD80B[\uDF90-\uDFF0]|[\uD80C\uD80E\uD80F\uD81C-\uD820\uD822\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872\uD874-\uD879\uD880-\uD883\uD885-\uD887][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2F\uDC41-\uDC46\uDC60-\uDFFF]|\uD810[\uDC00-\uDFFA]|\uD811[\uDC00-\uDE46]|\uD818[\uDD00-\uDD1D]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDE70-\uDEBE\uDED0-\uDEED\uDF00-\uDF2F\uDF40-\uDF43\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDD40-\uDD6C\uDE40-\uDE7F\uDF00-\uDF4A\uDF50\uDF93-\uDF9F\uDFE0\uDFE1\uDFE3]|\uD821[\uDC00-\uDFF7]|\uD823[\uDC00-\uDCD5\uDCFF-\uDD08]|\uD82B[\uDFF0-\uDFF3\uDFF5-\uDFFB\uDFFD\uDFFE]|\uD82C[\uDC00-\uDD22\uDD32\uDD50-\uDD52\uDD55\uDD64-\uDD67\uDD70-\uDEFB]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB]|\uD837[\uDF00-\uDF1E\uDF25-\uDF2A]|\uD838[\uDC30-\uDC6D\uDD00-\uDD2C\uDD37-\uDD3D\uDD4E\uDE90-\uDEAD\uDEC0-\uDEEB]|\uD839[\uDCD0-\uDCEB\uDDD0-\uDDED\uDDF0\uDFE0-\uDFE6\uDFE8-\uDFEB\uDFED\uDFEE\uDFF0-\uDFFE]|\uD83A[\uDC00-\uDCC4\uDD00-\uDD43\uDD4B]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDEDF\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF39\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1\uDEB0-\uDFFF]|\uD87A[\uDC00-\uDFE0\uDFF0-\uDFFF]|\uD87B[\uDC00-\uDE5D]|\uD87E[\uDC00-\uDE1D]|\uD884[\uDC00-\uDF4A\uDF50-\uDFFF]|\uD888[\uDC00-\uDFAF])*$/.test(s)
      }, {
        name: 'string',
        test: isString
      }, {
        name: 'Chain',
        test: isChain
      }, {
        name: 'Array',
        test: isArray
      }, {
        name: 'Matrix',
        test: isMatrix
      }, {
        name: 'DenseMatrix',
        test: isDenseMatrix
      }, {
        name: 'SparseMatrix',
        test: isSparseMatrix
      }, {
        name: 'Range',
        test: isRange
      }, {
        name: 'Index',
        test: isIndex
      }, {
        name: 'boolean',
        test: isBoolean
      }, {
        name: 'ResultSet',
        test: isResultSet
      }, {
        name: 'Help',
        test: isHelp
      }, {
        name: 'function',
        test: isFunction
      }, {
        name: 'Date',
        test: isDate
      }, {
        name: 'RegExp',
        test: isRegExp
      }, {
        name: 'null',
        test: isNull
      }, {
        name: 'undefined',
        test: isUndefined
      }, {
        name: 'AccessorNode',
        test: isAccessorNode
      }, {
        name: 'ArrayNode',
        test: isArrayNode
      }, {
        name: 'AssignmentNode',
        test: isAssignmentNode
      }, {
        name: 'BlockNode',
        test: isBlockNode
      }, {
        name: 'ConditionalNode',
        test: isConditionalNode
      }, {
        name: 'ConstantNode',
        test: isConstantNode
      }, {
        name: 'FunctionNode',
        test: isFunctionNode
      }, {
        name: 'FunctionAssignmentNode',
        test: isFunctionAssignmentNode
      }, {
        name: 'IndexNode',
        test: isIndexNode
      }, {
        name: 'Node',
        test: isNode$1
      }, {
        name: 'ObjectNode',
        test: isObjectNode
      }, {
        name: 'OperatorNode',
        test: isOperatorNode
      }, {
        name: 'ParenthesisNode',
        test: isParenthesisNode
      }, {
        name: 'RangeNode',
        test: isRangeNode
      }, {
        name: 'RelationalNode',
        test: isRelationalNode
      }, {
        name: 'SymbolNode',
        test: isSymbolNode
      }, {
        name: 'Map',
        test: isMap
      }, {
        name: 'Object',
        test: isObject
      } // order 'Object' last, it matches on other classes too
      ]);
      typed.addConversions([{
        from: 'number',
        to: 'BigNumber',
        convert: function convert(x) {
          if (!BigNumber) {
            throwNoBignumber(x);
          }

          // note: conversion from number to BigNumber can fail if x has >15 digits
          if (digits(x) > 15) {
            throw new TypeError('Cannot implicitly convert a number with >15 significant digits to BigNumber ' + '(value: ' + x + '). ' + 'Use function bignumber(x) to convert to BigNumber.');
          }
          return new BigNumber(x);
        }
      }, {
        from: 'number',
        to: 'Complex',
        convert: function convert(x) {
          if (!Complex) {
            throwNoComplex(x);
          }
          return new Complex(x, 0);
        }
      }, {
        from: 'BigNumber',
        to: 'Complex',
        convert: function convert(x) {
          if (!Complex) {
            throwNoComplex(x);
          }
          return new Complex(x.toNumber(), 0);
        }
      }, {
        from: 'bigint',
        to: 'number',
        convert: function convert(x) {
          if (x > Number.MAX_SAFE_INTEGER) {
            throw new TypeError('Cannot implicitly convert bigint to number: ' + 'value exceeds the max safe integer value (value: ' + x + ')');
          }
          return Number(x);
        }
      }, {
        from: 'bigint',
        to: 'BigNumber',
        convert: function convert(x) {
          if (!BigNumber) {
            throwNoBignumber(x);
          }
          return new BigNumber(x.toString());
        }
      }, {
        from: 'bigint',
        to: 'Fraction',
        convert: function convert(x) {
          if (!Fraction) {
            throwNoFraction(x);
          }
          return new Fraction(x);
        }
      }, {
        from: 'Fraction',
        to: 'BigNumber',
        convert: function convert(x) {
          throw new TypeError('Cannot implicitly convert a Fraction to BigNumber or vice versa. ' + 'Use function bignumber(x) to convert to BigNumber or fraction(x) to convert to Fraction.');
        }
      }, {
        from: 'Fraction',
        to: 'Complex',
        convert: function convert(x) {
          if (!Complex) {
            throwNoComplex(x);
          }
          return new Complex(x.valueOf(), 0);
        }
      }, {
        from: 'number',
        to: 'Fraction',
        convert: function convert(x) {
          if (!Fraction) {
            throwNoFraction(x);
          }
          var f = new Fraction(x);
          if (f.valueOf() !== x) {
            throw new TypeError('Cannot implicitly convert a number to a Fraction when there will be a loss of precision ' + '(value: ' + x + '). ' + 'Use function fraction(x) to convert to Fraction.');
          }
          return f;
        }
      }, {
        // FIXME: add conversion from Fraction to number, for example for `sqrt(fraction(1,3))`
        //  from: 'Fraction',
        //  to: 'number',
        //  convert: function (x) {
        //    return x.valueOf()
        //  }
        // }, {
        from: 'string',
        to: 'number',
        convert: function convert(x) {
          var n = Number(x);
          if (isNaN(n)) {
            throw new Error('Cannot convert "' + x + '" to a number');
          }
          return n;
        }
      }, {
        from: 'string',
        to: 'BigNumber',
        convert: function convert(x) {
          if (!BigNumber) {
            throwNoBignumber(x);
          }
          try {
            return new BigNumber(x);
          } catch (err) {
            throw new Error('Cannot convert "' + x + '" to BigNumber');
          }
        }
      }, {
        from: 'string',
        to: 'bigint',
        convert: function convert(x) {
          try {
            return BigInt(x);
          } catch (err) {
            throw new Error('Cannot convert "' + x + '" to BigInt');
          }
        }
      }, {
        from: 'string',
        to: 'Fraction',
        convert: function convert(x) {
          if (!Fraction) {
            throwNoFraction(x);
          }
          try {
            return new Fraction(x);
          } catch (err) {
            throw new Error('Cannot convert "' + x + '" to Fraction');
          }
        }
      }, {
        from: 'string',
        to: 'Complex',
        convert: function convert(x) {
          if (!Complex) {
            throwNoComplex(x);
          }
          try {
            return new Complex(x);
          } catch (err) {
            throw new Error('Cannot convert "' + x + '" to Complex');
          }
        }
      }, {
        from: 'boolean',
        to: 'number',
        convert: function convert(x) {
          return +x;
        }
      }, {
        from: 'boolean',
        to: 'BigNumber',
        convert: function convert(x) {
          if (!BigNumber) {
            throwNoBignumber(x);
          }
          return new BigNumber(+x);
        }
      }, {
        from: 'boolean',
        to: 'bigint',
        convert: function convert(x) {
          return BigInt(+x);
        }
      }, {
        from: 'boolean',
        to: 'Fraction',
        convert: function convert(x) {
          if (!Fraction) {
            throwNoFraction(x);
          }
          return new Fraction(+x);
        }
      }, {
        from: 'boolean',
        to: 'string',
        convert: function convert(x) {
          return String(x);
        }
      }, {
        from: 'Array',
        to: 'Matrix',
        convert: function convert(array) {
          if (!DenseMatrix) {
            throwNoMatrix();
          }
          return new DenseMatrix(array);
        }
      }, {
        from: 'Matrix',
        to: 'Array',
        convert: function convert(matrix) {
          return matrix.valueOf();
        }
      }]);

      // Provide a suggestion on how to call a function elementwise
      // This was added primarily as guidance for the v10 -> v11 transition,
      // and could potentially be removed in the future if it no longer seems
      // to be helpful.
      typed.onMismatch = (name, args, signatures) => {
        var usualError = typed.createError(name, args, signatures);
        if (['wrongType', 'mismatch'].includes(usualError.data.category) && args.length === 1 && isCollection(args[0]) &&
        // check if the function can be unary:
        signatures.some(sig => !sig.params.includes(','))) {
          var err = new TypeError("Function '".concat(name, "' doesn't apply to matrices. To call it ") + "elementwise on a matrix 'M', try 'map(M, ".concat(name, ")'."));
          err.data = usualError.data;
          throw err;
        }
        throw usualError;
      };

      // Provide a suggestion on how to call a function elementwise
      // This was added primarily as guidance for the v10 -> v11 transition,
      // and could potentially be removed in the future if it no longer seems
      // to be helpful.
      typed.onMismatch = (name, args, signatures) => {
        var usualError = typed.createError(name, args, signatures);
        if (['wrongType', 'mismatch'].includes(usualError.data.category) && args.length === 1 && isCollection(args[0]) &&
        // check if the function can be unary:
        signatures.some(sig => !sig.params.includes(','))) {
          var err = new TypeError("Function '".concat(name, "' doesn't apply to matrices. To call it ") + "elementwise on a matrix 'M', try 'map(M, ".concat(name, ")'."));
          err.data = usualError.data;
          throw err;
        }
        throw usualError;
      };
      return typed;
    });
    function throwNoBignumber(x) {
      throw new Error("Cannot convert value ".concat(x, " into a BigNumber: no class 'BigNumber' provided"));
    }
    function throwNoComplex(x) {
      throw new Error("Cannot convert value ".concat(x, " into a Complex number: no class 'Complex' provided"));
    }
    function throwNoMatrix() {
      throw new Error('Cannot convert array into a Matrix: no class \'DenseMatrix\' provided');
    }
    function throwNoFraction(x) {
      throw new Error("Cannot convert value ".concat(x, " into a Fraction, no class 'Fraction' provided."));
    }

    /*!
     *  decimal.js v10.5.0
     *  An arbitrary-precision Decimal type for JavaScript.
     *  https://github.com/MikeMcl/decimal.js
     *  Copyright (c) 2025 Michael Mclaughlin <M8ch88l@gmail.com>
     *  MIT Licence
     */


    // -----------------------------------  EDITABLE DEFAULTS  ------------------------------------ //


      // The maximum exponent magnitude.
      // The limit on the value of `toExpNeg`, `toExpPos`, `minE` and `maxE`.
    var EXP_LIMIT = 9e15,                      // 0 to 9e15

      // The limit on the value of `precision`, and on the value of the first argument to
      // `toDecimalPlaces`, `toExponential`, `toFixed`, `toPrecision` and `toSignificantDigits`.
      MAX_DIGITS = 1e9,                        // 0 to 1e9

      // Base conversion alphabet.
      NUMERALS = '0123456789abcdef',

      // The natural logarithm of 10 (1025 digits).
      LN10 = '2.3025850929940456840179914546843642076011014886287729760333279009675726096773524802359972050895982983419677840422862486334095254650828067566662873690987816894829072083255546808437998948262331985283935053089653777326288461633662222876982198867465436674744042432743651550489343149393914796194044002221051017141748003688084012647080685567743216228355220114804663715659121373450747856947683463616792101806445070648000277502684916746550586856935673420670581136429224554405758925724208241314695689016758940256776311356919292033376587141660230105703089634572075440370847469940168269282808481184289314848524948644871927809676271275775397027668605952496716674183485704422507197965004714951050492214776567636938662976979522110718264549734772662425709429322582798502585509785265383207606726317164309505995087807523710333101197857547331541421808427543863591778117054309827482385045648019095610299291824318237525357709750539565187697510374970888692180205189339507238539205144634197265287286965110862571492198849978748873771345686209167058',

      // Pi (1025 digits).
      PI = '3.1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679821480865132823066470938446095505822317253594081284811174502841027019385211055596446229489549303819644288109756659334461284756482337867831652712019091456485669234603486104543266482133936072602491412737245870066063155881748815209209628292540917153643678925903600113305305488204665213841469519415116094330572703657595919530921861173819326117931051185480744623799627495673518857527248912279381830119491298336733624406566430860213949463952247371907021798609437027705392171762931767523846748184676694051320005681271452635608277857713427577896091736371787214684409012249534301465495853710507922796892589235420199561121290219608640344181598136297747713099605187072113499999983729780499510597317328160963185950244594553469083026425223082533446850352619311881710100031378387528865875332083814206171776691473035982534904287554687311595628638823537875937519577818577805321712268066130019278766111959092164201989380952572010654858632789',


      // The initial configuration properties of the Decimal constructor.
      DEFAULTS = {

        // These values must be integers within the stated ranges (inclusive).
        // Most of these values can be changed at run-time using the `Decimal.config` method.

        // The maximum number of significant digits of the result of a calculation or base conversion.
        // E.g. `Decimal.config({ precision: 20 });`
        precision: 20,                         // 1 to MAX_DIGITS

        // The rounding mode used when rounding to `precision`.
        //
        // ROUND_UP         0 Away from zero.
        // ROUND_DOWN       1 Towards zero.
        // ROUND_CEIL       2 Towards +Infinity.
        // ROUND_FLOOR      3 Towards -Infinity.
        // ROUND_HALF_UP    4 Towards nearest neighbour. If equidistant, up.
        // ROUND_HALF_DOWN  5 Towards nearest neighbour. If equidistant, down.
        // ROUND_HALF_EVEN  6 Towards nearest neighbour. If equidistant, towards even neighbour.
        // ROUND_HALF_CEIL  7 Towards nearest neighbour. If equidistant, towards +Infinity.
        // ROUND_HALF_FLOOR 8 Towards nearest neighbour. If equidistant, towards -Infinity.
        //
        // E.g.
        // `Decimal.rounding = 4;`
        // `Decimal.rounding = Decimal.ROUND_HALF_UP;`
        rounding: 4,                           // 0 to 8

        // The modulo mode used when calculating the modulus: a mod n.
        // The quotient (q = a / n) is calculated according to the corresponding rounding mode.
        // The remainder (r) is calculated as: r = a - n * q.
        //
        // UP         0 The remainder is positive if the dividend is negative, else is negative.
        // DOWN       1 The remainder has the same sign as the dividend (JavaScript %).
        // FLOOR      3 The remainder has the same sign as the divisor (Python %).
        // HALF_EVEN  6 The IEEE 754 remainder function.
        // EUCLID     9 Euclidian division. q = sign(n) * floor(a / abs(n)). Always positive.
        //
        // Truncated division (1), floored division (3), the IEEE 754 remainder (6), and Euclidian
        // division (9) are commonly used for the modulus operation. The other rounding modes can also
        // be used, but they may not give useful results.
        modulo: 1,                             // 0 to 9

        // The exponent value at and beneath which `toString` returns exponential notation.
        // JavaScript numbers: -7
        toExpNeg: -7,                          // 0 to -EXP_LIMIT

        // The exponent value at and above which `toString` returns exponential notation.
        // JavaScript numbers: 21
        toExpPos:  21,                         // 0 to EXP_LIMIT

        // The minimum exponent value, beneath which underflow to zero occurs.
        // JavaScript numbers: -324  (5e-324)
        minE: -9e15,                      // -1 to -EXP_LIMIT

        // The maximum exponent value, above which overflow to Infinity occurs.
        // JavaScript numbers: 308  (1.7976931348623157e+308)
        maxE: EXP_LIMIT,                       // 1 to EXP_LIMIT

        // Whether to use cryptographically-secure random number generation, if available.
        crypto: false                          // true/false
      },


    // ----------------------------------- END OF EDITABLE DEFAULTS ------------------------------- //


      inexact, quadrant,
      external = true,

      decimalError = '[DecimalError] ',
      invalidArgument = decimalError + 'Invalid argument: ',
      precisionLimitExceeded = decimalError + 'Precision limit exceeded',
      cryptoUnavailable = decimalError + 'crypto unavailable',
      tag = '[object Decimal]',

      mathfloor = Math.floor,
      mathpow = Math.pow,

      isBinary = /^0b([01]+(\.[01]*)?|\.[01]+)(p[+-]?\d+)?$/i,
      isHex = /^0x([0-9a-f]+(\.[0-9a-f]*)?|\.[0-9a-f]+)(p[+-]?\d+)?$/i,
      isOctal = /^0o([0-7]+(\.[0-7]*)?|\.[0-7]+)(p[+-]?\d+)?$/i,
      isDecimal = /^(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i,

      BASE = 1e7,
      LOG_BASE = 7,
      MAX_SAFE_INTEGER = 9007199254740991,

      LN10_PRECISION = LN10.length - 1,
      PI_PRECISION = PI.length - 1,

      // Decimal.prototype object
      P$3 = { toStringTag: tag };


    // Decimal prototype methods


    /*
     *  absoluteValue             abs
     *  ceil
     *  clampedTo                 clamp
     *  comparedTo                cmp
     *  cosine                    cos
     *  cubeRoot                  cbrt
     *  decimalPlaces             dp
     *  dividedBy                 div
     *  dividedToIntegerBy        divToInt
     *  equals                    eq
     *  floor
     *  greaterThan               gt
     *  greaterThanOrEqualTo      gte
     *  hyperbolicCosine          cosh
     *  hyperbolicSine            sinh
     *  hyperbolicTangent         tanh
     *  inverseCosine             acos
     *  inverseHyperbolicCosine   acosh
     *  inverseHyperbolicSine     asinh
     *  inverseHyperbolicTangent  atanh
     *  inverseSine               asin
     *  inverseTangent            atan
     *  isFinite
     *  isInteger                 isInt
     *  isNaN
     *  isNegative                isNeg
     *  isPositive                isPos
     *  isZero
     *  lessThan                  lt
     *  lessThanOrEqualTo         lte
     *  logarithm                 log
     *  [maximum]                 [max]
     *  [minimum]                 [min]
     *  minus                     sub
     *  modulo                    mod
     *  naturalExponential        exp
     *  naturalLogarithm          ln
     *  negated                   neg
     *  plus                      add
     *  precision                 sd
     *  round
     *  sine                      sin
     *  squareRoot                sqrt
     *  tangent                   tan
     *  times                     mul
     *  toBinary
     *  toDecimalPlaces           toDP
     *  toExponential
     *  toFixed
     *  toFraction
     *  toHexadecimal             toHex
     *  toNearest
     *  toNumber
     *  toOctal
     *  toPower                   pow
     *  toPrecision
     *  toSignificantDigits       toSD
     *  toString
     *  truncated                 trunc
     *  valueOf                   toJSON
     */


    /*
     * Return a new Decimal whose value is the absolute value of this Decimal.
     *
     */
    P$3.absoluteValue = P$3.abs = function () {
      var x = new this.constructor(this);
      if (x.s < 0) x.s = 1;
      return finalise(x);
    };


    /*
     * Return a new Decimal whose value is the value of this Decimal rounded to a whole number in the
     * direction of positive Infinity.
     *
     */
    P$3.ceil = function () {
      return finalise(new this.constructor(this), this.e + 1, 2);
    };


    /*
     * Return a new Decimal whose value is the value of this Decimal clamped to the range
     * delineated by `min` and `max`.
     *
     * min {number|string|bigint|Decimal}
     * max {number|string|bigint|Decimal}
     *
     */
    P$3.clampedTo = P$3.clamp = function (min, max) {
      var k,
        x = this,
        Ctor = x.constructor;
      min = new Ctor(min);
      max = new Ctor(max);
      if (!min.s || !max.s) return new Ctor(NaN);
      if (min.gt(max)) throw Error(invalidArgument + max);
      k = x.cmp(min);
      return k < 0 ? min : x.cmp(max) > 0 ? max : new Ctor(x);
    };


    /*
     * Return
     *   1    if the value of this Decimal is greater than the value of `y`,
     *  -1    if the value of this Decimal is less than the value of `y`,
     *   0    if they have the same value,
     *   NaN  if the value of either Decimal is NaN.
     *
     */
    P$3.comparedTo = P$3.cmp = function (y) {
      var i, j, xdL, ydL,
        x = this,
        xd = x.d,
        yd = (y = new x.constructor(y)).d,
        xs = x.s,
        ys = y.s;

      // Either NaN or ±Infinity?
      if (!xd || !yd) {
        return !xs || !ys ? NaN : xs !== ys ? xs : xd === yd ? 0 : !xd ^ xs < 0 ? 1 : -1;
      }

      // Either zero?
      if (!xd[0] || !yd[0]) return xd[0] ? xs : yd[0] ? -ys : 0;

      // Signs differ?
      if (xs !== ys) return xs;

      // Compare exponents.
      if (x.e !== y.e) return x.e > y.e ^ xs < 0 ? 1 : -1;

      xdL = xd.length;
      ydL = yd.length;

      // Compare digit by digit.
      for (i = 0, j = xdL < ydL ? xdL : ydL; i < j; ++i) {
        if (xd[i] !== yd[i]) return xd[i] > yd[i] ^ xs < 0 ? 1 : -1;
      }

      // Compare lengths.
      return xdL === ydL ? 0 : xdL > ydL ^ xs < 0 ? 1 : -1;
    };


    /*
     * Return a new Decimal whose value is the cosine of the value in radians of this Decimal.
     *
     * Domain: [-Infinity, Infinity]
     * Range: [-1, 1]
     *
     * cos(0)         = 1
     * cos(-0)        = 1
     * cos(Infinity)  = NaN
     * cos(-Infinity) = NaN
     * cos(NaN)       = NaN
     *
     */
    P$3.cosine = P$3.cos = function () {
      var pr, rm,
        x = this,
        Ctor = x.constructor;

      if (!x.d) return new Ctor(NaN);

      // cos(0) = cos(-0) = 1
      if (!x.d[0]) return new Ctor(1);

      pr = Ctor.precision;
      rm = Ctor.rounding;
      Ctor.precision = pr + Math.max(x.e, x.sd()) + LOG_BASE;
      Ctor.rounding = 1;

      x = cosine(Ctor, toLessThanHalfPi(Ctor, x));

      Ctor.precision = pr;
      Ctor.rounding = rm;

      return finalise(quadrant == 2 || quadrant == 3 ? x.neg() : x, pr, rm, true);
    };


    /*
     *
     * Return a new Decimal whose value is the cube root of the value of this Decimal, rounded to
     * `precision` significant digits using rounding mode `rounding`.
     *
     *  cbrt(0)  =  0
     *  cbrt(-0) = -0
     *  cbrt(1)  =  1
     *  cbrt(-1) = -1
     *  cbrt(N)  =  N
     *  cbrt(-I) = -I
     *  cbrt(I)  =  I
     *
     * Math.cbrt(x) = (x < 0 ? -Math.pow(-x, 1/3) : Math.pow(x, 1/3))
     *
     */
    P$3.cubeRoot = P$3.cbrt = function () {
      var e, m, n, r, rep, s, sd, t, t3, t3plusx,
        x = this,
        Ctor = x.constructor;

      if (!x.isFinite() || x.isZero()) return new Ctor(x);
      external = false;

      // Initial estimate.
      s = x.s * mathpow(x.s * x, 1 / 3);

       // Math.cbrt underflow/overflow?
       // Pass x to Math.pow as integer, then adjust the exponent of the result.
      if (!s || Math.abs(s) == 1 / 0) {
        n = digitsToString(x.d);
        e = x.e;

        // Adjust n exponent so it is a multiple of 3 away from x exponent.
        if (s = (e - n.length + 1) % 3) n += (s == 1 || s == -2 ? '0' : '00');
        s = mathpow(n, 1 / 3);

        // Rarely, e may be one less than the result exponent value.
        e = mathfloor((e + 1) / 3) - (e % 3 == (e < 0 ? -1 : 2));

        if (s == 1 / 0) {
          n = '5e' + e;
        } else {
          n = s.toExponential();
          n = n.slice(0, n.indexOf('e') + 1) + e;
        }

        r = new Ctor(n);
        r.s = x.s;
      } else {
        r = new Ctor(s.toString());
      }

      sd = (e = Ctor.precision) + 3;

      // Halley's method.
      // TODO? Compare Newton's method.
      for (;;) {
        t = r;
        t3 = t.times(t).times(t);
        t3plusx = t3.plus(x);
        r = divide(t3plusx.plus(x).times(t), t3plusx.plus(t3), sd + 2, 1);

        // TODO? Replace with for-loop and checkRoundingDigits.
        if (digitsToString(t.d).slice(0, sd) === (n = digitsToString(r.d)).slice(0, sd)) {
          n = n.slice(sd - 3, sd + 1);

          // The 4th rounding digit may be in error by -1 so if the 4 rounding digits are 9999 or 4999
          // , i.e. approaching a rounding boundary, continue the iteration.
          if (n == '9999' || !rep && n == '4999') {

            // On the first iteration only, check to see if rounding up gives the exact result as the
            // nines may infinitely repeat.
            if (!rep) {
              finalise(t, e + 1, 0);

              if (t.times(t).times(t).eq(x)) {
                r = t;
                break;
              }
            }

            sd += 4;
            rep = 1;
          } else {

            // If the rounding digits are null, 0{0,4} or 50{0,3}, check for an exact result.
            // If not, then there are further digits and m will be truthy.
            if (!+n || !+n.slice(1) && n.charAt(0) == '5') {

              // Truncate to the first rounding digit.
              finalise(r, e + 1, 1);
              m = !r.times(r).times(r).eq(x);
            }

            break;
          }
        }
      }

      external = true;

      return finalise(r, e, Ctor.rounding, m);
    };


    /*
     * Return the number of decimal places of the value of this Decimal.
     *
     */
    P$3.decimalPlaces = P$3.dp = function () {
      var w,
        d = this.d,
        n = NaN;

      if (d) {
        w = d.length - 1;
        n = (w - mathfloor(this.e / LOG_BASE)) * LOG_BASE;

        // Subtract the number of trailing zeros of the last word.
        w = d[w];
        if (w) for (; w % 10 == 0; w /= 10) n--;
        if (n < 0) n = 0;
      }

      return n;
    };


    /*
     *  n / 0 = I
     *  n / N = N
     *  n / I = 0
     *  0 / n = 0
     *  0 / 0 = N
     *  0 / N = N
     *  0 / I = 0
     *  N / n = N
     *  N / 0 = N
     *  N / N = N
     *  N / I = N
     *  I / n = I
     *  I / 0 = I
     *  I / N = N
     *  I / I = N
     *
     * Return a new Decimal whose value is the value of this Decimal divided by `y`, rounded to
     * `precision` significant digits using rounding mode `rounding`.
     *
     */
    P$3.dividedBy = P$3.div = function (y) {
      return divide(this, new this.constructor(y));
    };


    /*
     * Return a new Decimal whose value is the integer part of dividing the value of this Decimal
     * by the value of `y`, rounded to `precision` significant digits using rounding mode `rounding`.
     *
     */
    P$3.dividedToIntegerBy = P$3.divToInt = function (y) {
      var x = this,
        Ctor = x.constructor;
      return finalise(divide(x, new Ctor(y), 0, 1, 1), Ctor.precision, Ctor.rounding);
    };


    /*
     * Return true if the value of this Decimal is equal to the value of `y`, otherwise return false.
     *
     */
    P$3.equals = P$3.eq = function (y) {
      return this.cmp(y) === 0;
    };


    /*
     * Return a new Decimal whose value is the value of this Decimal rounded to a whole number in the
     * direction of negative Infinity.
     *
     */
    P$3.floor = function () {
      return finalise(new this.constructor(this), this.e + 1, 3);
    };


    /*
     * Return true if the value of this Decimal is greater than the value of `y`, otherwise return
     * false.
     *
     */
    P$3.greaterThan = P$3.gt = function (y) {
      return this.cmp(y) > 0;
    };


    /*
     * Return true if the value of this Decimal is greater than or equal to the value of `y`,
     * otherwise return false.
     *
     */
    P$3.greaterThanOrEqualTo = P$3.gte = function (y) {
      var k = this.cmp(y);
      return k == 1 || k === 0;
    };


    /*
     * Return a new Decimal whose value is the hyperbolic cosine of the value in radians of this
     * Decimal.
     *
     * Domain: [-Infinity, Infinity]
     * Range: [1, Infinity]
     *
     * cosh(x) = 1 + x^2/2! + x^4/4! + x^6/6! + ...
     *
     * cosh(0)         = 1
     * cosh(-0)        = 1
     * cosh(Infinity)  = Infinity
     * cosh(-Infinity) = Infinity
     * cosh(NaN)       = NaN
     *
     *  x        time taken (ms)   result
     * 1000      9                 9.8503555700852349694e+433
     * 10000     25                4.4034091128314607936e+4342
     * 100000    171               1.4033316802130615897e+43429
     * 1000000   3817              1.5166076984010437725e+434294
     * 10000000  abandoned after 2 minute wait
     *
     * TODO? Compare performance of cosh(x) = 0.5 * (exp(x) + exp(-x))
     *
     */
    P$3.hyperbolicCosine = P$3.cosh = function () {
      var k, n, pr, rm, len,
        x = this,
        Ctor = x.constructor,
        one = new Ctor(1);

      if (!x.isFinite()) return new Ctor(x.s ? 1 / 0 : NaN);
      if (x.isZero()) return one;

      pr = Ctor.precision;
      rm = Ctor.rounding;
      Ctor.precision = pr + Math.max(x.e, x.sd()) + 4;
      Ctor.rounding = 1;
      len = x.d.length;

      // Argument reduction: cos(4x) = 1 - 8cos^2(x) + 8cos^4(x) + 1
      // i.e. cos(x) = 1 - cos^2(x/4)(8 - 8cos^2(x/4))

      // Estimate the optimum number of times to use the argument reduction.
      // TODO? Estimation reused from cosine() and may not be optimal here.
      if (len < 32) {
        k = Math.ceil(len / 3);
        n = (1 / tinyPow(4, k)).toString();
      } else {
        k = 16;
        n = '2.3283064365386962890625e-10';
      }

      x = taylorSeries(Ctor, 1, x.times(n), new Ctor(1), true);

      // Reverse argument reduction
      var cosh2_x,
        i = k,
        d8 = new Ctor(8);
      for (; i--;) {
        cosh2_x = x.times(x);
        x = one.minus(cosh2_x.times(d8.minus(cosh2_x.times(d8))));
      }

      return finalise(x, Ctor.precision = pr, Ctor.rounding = rm, true);
    };


    /*
     * Return a new Decimal whose value is the hyperbolic sine of the value in radians of this
     * Decimal.
     *
     * Domain: [-Infinity, Infinity]
     * Range: [-Infinity, Infinity]
     *
     * sinh(x) = x + x^3/3! + x^5/5! + x^7/7! + ...
     *
     * sinh(0)         = 0
     * sinh(-0)        = -0
     * sinh(Infinity)  = Infinity
     * sinh(-Infinity) = -Infinity
     * sinh(NaN)       = NaN
     *
     * x        time taken (ms)
     * 10       2 ms
     * 100      5 ms
     * 1000     14 ms
     * 10000    82 ms
     * 100000   886 ms            1.4033316802130615897e+43429
     * 200000   2613 ms
     * 300000   5407 ms
     * 400000   8824 ms
     * 500000   13026 ms          8.7080643612718084129e+217146
     * 1000000  48543 ms
     *
     * TODO? Compare performance of sinh(x) = 0.5 * (exp(x) - exp(-x))
     *
     */
    P$3.hyperbolicSine = P$3.sinh = function () {
      var k, pr, rm, len,
        x = this,
        Ctor = x.constructor;

      if (!x.isFinite() || x.isZero()) return new Ctor(x);

      pr = Ctor.precision;
      rm = Ctor.rounding;
      Ctor.precision = pr + Math.max(x.e, x.sd()) + 4;
      Ctor.rounding = 1;
      len = x.d.length;

      if (len < 3) {
        x = taylorSeries(Ctor, 2, x, x, true);
      } else {

        // Alternative argument reduction: sinh(3x) = sinh(x)(3 + 4sinh^2(x))
        // i.e. sinh(x) = sinh(x/3)(3 + 4sinh^2(x/3))
        // 3 multiplications and 1 addition

        // Argument reduction: sinh(5x) = sinh(x)(5 + sinh^2(x)(20 + 16sinh^2(x)))
        // i.e. sinh(x) = sinh(x/5)(5 + sinh^2(x/5)(20 + 16sinh^2(x/5)))
        // 4 multiplications and 2 additions

        // Estimate the optimum number of times to use the argument reduction.
        k = 1.4 * Math.sqrt(len);
        k = k > 16 ? 16 : k | 0;

        x = x.times(1 / tinyPow(5, k));
        x = taylorSeries(Ctor, 2, x, x, true);

        // Reverse argument reduction
        var sinh2_x,
          d5 = new Ctor(5),
          d16 = new Ctor(16),
          d20 = new Ctor(20);
        for (; k--;) {
          sinh2_x = x.times(x);
          x = x.times(d5.plus(sinh2_x.times(d16.times(sinh2_x).plus(d20))));
        }
      }

      Ctor.precision = pr;
      Ctor.rounding = rm;

      return finalise(x, pr, rm, true);
    };


    /*
     * Return a new Decimal whose value is the hyperbolic tangent of the value in radians of this
     * Decimal.
     *
     * Domain: [-Infinity, Infinity]
     * Range: [-1, 1]
     *
     * tanh(x) = sinh(x) / cosh(x)
     *
     * tanh(0)         = 0
     * tanh(-0)        = -0
     * tanh(Infinity)  = 1
     * tanh(-Infinity) = -1
     * tanh(NaN)       = NaN
     *
     */
    P$3.hyperbolicTangent = P$3.tanh = function () {
      var pr, rm,
        x = this,
        Ctor = x.constructor;

      if (!x.isFinite()) return new Ctor(x.s);
      if (x.isZero()) return new Ctor(x);

      pr = Ctor.precision;
      rm = Ctor.rounding;
      Ctor.precision = pr + 7;
      Ctor.rounding = 1;

      return divide(x.sinh(), x.cosh(), Ctor.precision = pr, Ctor.rounding = rm);
    };


    /*
     * Return a new Decimal whose value is the arccosine (inverse cosine) in radians of the value of
     * this Decimal.
     *
     * Domain: [-1, 1]
     * Range: [0, pi]
     *
     * acos(x) = pi/2 - asin(x)
     *
     * acos(0)       = pi/2
     * acos(-0)      = pi/2
     * acos(1)       = 0
     * acos(-1)      = pi
     * acos(1/2)     = pi/3
     * acos(-1/2)    = 2*pi/3
     * acos(|x| > 1) = NaN
     * acos(NaN)     = NaN
     *
     */
    P$3.inverseCosine = P$3.acos = function () {
      var x = this,
        Ctor = x.constructor,
        k = x.abs().cmp(1),
        pr = Ctor.precision,
        rm = Ctor.rounding;

      if (k !== -1) {
        return k === 0
          // |x| is 1
          ? x.isNeg() ? getPi(Ctor, pr, rm) : new Ctor(0)
          // |x| > 1 or x is NaN
          : new Ctor(NaN);
      }

      if (x.isZero()) return getPi(Ctor, pr + 4, rm).times(0.5);

      // TODO? Special case acos(0.5) = pi/3 and acos(-0.5) = 2*pi/3

      Ctor.precision = pr + 6;
      Ctor.rounding = 1;

      // See https://github.com/MikeMcl/decimal.js/pull/217
      x = new Ctor(1).minus(x).div(x.plus(1)).sqrt().atan();

      Ctor.precision = pr;
      Ctor.rounding = rm;

      return x.times(2);
    };


    /*
     * Return a new Decimal whose value is the inverse of the hyperbolic cosine in radians of the
     * value of this Decimal.
     *
     * Domain: [1, Infinity]
     * Range: [0, Infinity]
     *
     * acosh(x) = ln(x + sqrt(x^2 - 1))
     *
     * acosh(x < 1)     = NaN
     * acosh(NaN)       = NaN
     * acosh(Infinity)  = Infinity
     * acosh(-Infinity) = NaN
     * acosh(0)         = NaN
     * acosh(-0)        = NaN
     * acosh(1)         = 0
     * acosh(-1)        = NaN
     *
     */
    P$3.inverseHyperbolicCosine = P$3.acosh = function () {
      var pr, rm,
        x = this,
        Ctor = x.constructor;

      if (x.lte(1)) return new Ctor(x.eq(1) ? 0 : NaN);
      if (!x.isFinite()) return new Ctor(x);

      pr = Ctor.precision;
      rm = Ctor.rounding;
      Ctor.precision = pr + Math.max(Math.abs(x.e), x.sd()) + 4;
      Ctor.rounding = 1;
      external = false;

      x = x.times(x).minus(1).sqrt().plus(x);

      external = true;
      Ctor.precision = pr;
      Ctor.rounding = rm;

      return x.ln();
    };


    /*
     * Return a new Decimal whose value is the inverse of the hyperbolic sine in radians of the value
     * of this Decimal.
     *
     * Domain: [-Infinity, Infinity]
     * Range: [-Infinity, Infinity]
     *
     * asinh(x) = ln(x + sqrt(x^2 + 1))
     *
     * asinh(NaN)       = NaN
     * asinh(Infinity)  = Infinity
     * asinh(-Infinity) = -Infinity
     * asinh(0)         = 0
     * asinh(-0)        = -0
     *
     */
    P$3.inverseHyperbolicSine = P$3.asinh = function () {
      var pr, rm,
        x = this,
        Ctor = x.constructor;

      if (!x.isFinite() || x.isZero()) return new Ctor(x);

      pr = Ctor.precision;
      rm = Ctor.rounding;
      Ctor.precision = pr + 2 * Math.max(Math.abs(x.e), x.sd()) + 6;
      Ctor.rounding = 1;
      external = false;

      x = x.times(x).plus(1).sqrt().plus(x);

      external = true;
      Ctor.precision = pr;
      Ctor.rounding = rm;

      return x.ln();
    };


    /*
     * Return a new Decimal whose value is the inverse of the hyperbolic tangent in radians of the
     * value of this Decimal.
     *
     * Domain: [-1, 1]
     * Range: [-Infinity, Infinity]
     *
     * atanh(x) = 0.5 * ln((1 + x) / (1 - x))
     *
     * atanh(|x| > 1)   = NaN
     * atanh(NaN)       = NaN
     * atanh(Infinity)  = NaN
     * atanh(-Infinity) = NaN
     * atanh(0)         = 0
     * atanh(-0)        = -0
     * atanh(1)         = Infinity
     * atanh(-1)        = -Infinity
     *
     */
    P$3.inverseHyperbolicTangent = P$3.atanh = function () {
      var pr, rm, wpr, xsd,
        x = this,
        Ctor = x.constructor;

      if (!x.isFinite()) return new Ctor(NaN);
      if (x.e >= 0) return new Ctor(x.abs().eq(1) ? x.s / 0 : x.isZero() ? x : NaN);

      pr = Ctor.precision;
      rm = Ctor.rounding;
      xsd = x.sd();

      if (Math.max(xsd, pr) < 2 * -x.e - 1) return finalise(new Ctor(x), pr, rm, true);

      Ctor.precision = wpr = xsd - x.e;

      x = divide(x.plus(1), new Ctor(1).minus(x), wpr + pr, 1);

      Ctor.precision = pr + 4;
      Ctor.rounding = 1;

      x = x.ln();

      Ctor.precision = pr;
      Ctor.rounding = rm;

      return x.times(0.5);
    };


    /*
     * Return a new Decimal whose value is the arcsine (inverse sine) in radians of the value of this
     * Decimal.
     *
     * Domain: [-Infinity, Infinity]
     * Range: [-pi/2, pi/2]
     *
     * asin(x) = 2*atan(x/(1 + sqrt(1 - x^2)))
     *
     * asin(0)       = 0
     * asin(-0)      = -0
     * asin(1/2)     = pi/6
     * asin(-1/2)    = -pi/6
     * asin(1)       = pi/2
     * asin(-1)      = -pi/2
     * asin(|x| > 1) = NaN
     * asin(NaN)     = NaN
     *
     * TODO? Compare performance of Taylor series.
     *
     */
    P$3.inverseSine = P$3.asin = function () {
      var halfPi, k,
        pr, rm,
        x = this,
        Ctor = x.constructor;

      if (x.isZero()) return new Ctor(x);

      k = x.abs().cmp(1);
      pr = Ctor.precision;
      rm = Ctor.rounding;

      if (k !== -1) {

        // |x| is 1
        if (k === 0) {
          halfPi = getPi(Ctor, pr + 4, rm).times(0.5);
          halfPi.s = x.s;
          return halfPi;
        }

        // |x| > 1 or x is NaN
        return new Ctor(NaN);
      }

      // TODO? Special case asin(1/2) = pi/6 and asin(-1/2) = -pi/6

      Ctor.precision = pr + 6;
      Ctor.rounding = 1;

      x = x.div(new Ctor(1).minus(x.times(x)).sqrt().plus(1)).atan();

      Ctor.precision = pr;
      Ctor.rounding = rm;

      return x.times(2);
    };


    /*
     * Return a new Decimal whose value is the arctangent (inverse tangent) in radians of the value
     * of this Decimal.
     *
     * Domain: [-Infinity, Infinity]
     * Range: [-pi/2, pi/2]
     *
     * atan(x) = x - x^3/3 + x^5/5 - x^7/7 + ...
     *
     * atan(0)         = 0
     * atan(-0)        = -0
     * atan(1)         = pi/4
     * atan(-1)        = -pi/4
     * atan(Infinity)  = pi/2
     * atan(-Infinity) = -pi/2
     * atan(NaN)       = NaN
     *
     */
    P$3.inverseTangent = P$3.atan = function () {
      var i, j, k, n, px, t, r, wpr, x2,
        x = this,
        Ctor = x.constructor,
        pr = Ctor.precision,
        rm = Ctor.rounding;

      if (!x.isFinite()) {
        if (!x.s) return new Ctor(NaN);
        if (pr + 4 <= PI_PRECISION) {
          r = getPi(Ctor, pr + 4, rm).times(0.5);
          r.s = x.s;
          return r;
        }
      } else if (x.isZero()) {
        return new Ctor(x);
      } else if (x.abs().eq(1) && pr + 4 <= PI_PRECISION) {
        r = getPi(Ctor, pr + 4, rm).times(0.25);
        r.s = x.s;
        return r;
      }

      Ctor.precision = wpr = pr + 10;
      Ctor.rounding = 1;

      // TODO? if (x >= 1 && pr <= PI_PRECISION) atan(x) = halfPi * x.s - atan(1 / x);

      // Argument reduction
      // Ensure |x| < 0.42
      // atan(x) = 2 * atan(x / (1 + sqrt(1 + x^2)))

      k = Math.min(28, wpr / LOG_BASE + 2 | 0);

      for (i = k; i; --i) x = x.div(x.times(x).plus(1).sqrt().plus(1));

      external = false;

      j = Math.ceil(wpr / LOG_BASE);
      n = 1;
      x2 = x.times(x);
      r = new Ctor(x);
      px = x;

      // atan(x) = x - x^3/3 + x^5/5 - x^7/7 + ...
      for (; i !== -1;) {
        px = px.times(x2);
        t = r.minus(px.div(n += 2));

        px = px.times(x2);
        r = t.plus(px.div(n += 2));

        if (r.d[j] !== void 0) for (i = j; r.d[i] === t.d[i] && i--;);
      }

      if (k) r = r.times(2 << (k - 1));

      external = true;

      return finalise(r, Ctor.precision = pr, Ctor.rounding = rm, true);
    };


    /*
     * Return true if the value of this Decimal is a finite number, otherwise return false.
     *
     */
    P$3.isFinite = function () {
      return !!this.d;
    };


    /*
     * Return true if the value of this Decimal is an integer, otherwise return false.
     *
     */
    P$3.isInteger = P$3.isInt = function () {
      return !!this.d && mathfloor(this.e / LOG_BASE) > this.d.length - 2;
    };


    /*
     * Return true if the value of this Decimal is NaN, otherwise return false.
     *
     */
    P$3.isNaN = function () {
      return !this.s;
    };


    /*
     * Return true if the value of this Decimal is negative, otherwise return false.
     *
     */
    P$3.isNegative = P$3.isNeg = function () {
      return this.s < 0;
    };


    /*
     * Return true if the value of this Decimal is positive, otherwise return false.
     *
     */
    P$3.isPositive = P$3.isPos = function () {
      return this.s > 0;
    };


    /*
     * Return true if the value of this Decimal is 0 or -0, otherwise return false.
     *
     */
    P$3.isZero = function () {
      return !!this.d && this.d[0] === 0;
    };


    /*
     * Return true if the value of this Decimal is less than `y`, otherwise return false.
     *
     */
    P$3.lessThan = P$3.lt = function (y) {
      return this.cmp(y) < 0;
    };


    /*
     * Return true if the value of this Decimal is less than or equal to `y`, otherwise return false.
     *
     */
    P$3.lessThanOrEqualTo = P$3.lte = function (y) {
      return this.cmp(y) < 1;
    };


    /*
     * Return the logarithm of the value of this Decimal to the specified base, rounded to `precision`
     * significant digits using rounding mode `rounding`.
     *
     * If no base is specified, return log[10](arg).
     *
     * log[base](arg) = ln(arg) / ln(base)
     *
     * The result will always be correctly rounded if the base of the log is 10, and 'almost always'
     * otherwise:
     *
     * Depending on the rounding mode, the result may be incorrectly rounded if the first fifteen
     * rounding digits are [49]99999999999999 or [50]00000000000000. In that case, the maximum error
     * between the result and the correctly rounded result will be one ulp (unit in the last place).
     *
     * log[-b](a)       = NaN
     * log[0](a)        = NaN
     * log[1](a)        = NaN
     * log[NaN](a)      = NaN
     * log[Infinity](a) = NaN
     * log[b](0)        = -Infinity
     * log[b](-0)       = -Infinity
     * log[b](-a)       = NaN
     * log[b](1)        = 0
     * log[b](Infinity) = Infinity
     * log[b](NaN)      = NaN
     *
     * [base] {number|string|bigint|Decimal} The base of the logarithm.
     *
     */
    P$3.logarithm = P$3.log = function (base) {
      var isBase10, d, denominator, k, inf, num, sd, r,
        arg = this,
        Ctor = arg.constructor,
        pr = Ctor.precision,
        rm = Ctor.rounding,
        guard = 5;

      // Default base is 10.
      if (base == null) {
        base = new Ctor(10);
        isBase10 = true;
      } else {
        base = new Ctor(base);
        d = base.d;

        // Return NaN if base is negative, or non-finite, or is 0 or 1.
        if (base.s < 0 || !d || !d[0] || base.eq(1)) return new Ctor(NaN);

        isBase10 = base.eq(10);
      }

      d = arg.d;

      // Is arg negative, non-finite, 0 or 1?
      if (arg.s < 0 || !d || !d[0] || arg.eq(1)) {
        return new Ctor(d && !d[0] ? -1 / 0 : arg.s != 1 ? NaN : d ? 0 : 1 / 0);
      }

      // The result will have a non-terminating decimal expansion if base is 10 and arg is not an
      // integer power of 10.
      if (isBase10) {
        if (d.length > 1) {
          inf = true;
        } else {
          for (k = d[0]; k % 10 === 0;) k /= 10;
          inf = k !== 1;
        }
      }

      external = false;
      sd = pr + guard;
      num = naturalLogarithm(arg, sd);
      denominator = isBase10 ? getLn10(Ctor, sd + 10) : naturalLogarithm(base, sd);

      // The result will have 5 rounding digits.
      r = divide(num, denominator, sd, 1);

      // If at a rounding boundary, i.e. the result's rounding digits are [49]9999 or [50]0000,
      // calculate 10 further digits.
      //
      // If the result is known to have an infinite decimal expansion, repeat this until it is clear
      // that the result is above or below the boundary. Otherwise, if after calculating the 10
      // further digits, the last 14 are nines, round up and assume the result is exact.
      // Also assume the result is exact if the last 14 are zero.
      //
      // Example of a result that will be incorrectly rounded:
      // log[1048576](4503599627370502) = 2.60000000000000009610279511444746...
      // The above result correctly rounded using ROUND_CEIL to 1 decimal place should be 2.7, but it
      // will be given as 2.6 as there are 15 zeros immediately after the requested decimal place, so
      // the exact result would be assumed to be 2.6, which rounded using ROUND_CEIL to 1 decimal
      // place is still 2.6.
      if (checkRoundingDigits(r.d, k = pr, rm)) {

        do {
          sd += 10;
          num = naturalLogarithm(arg, sd);
          denominator = isBase10 ? getLn10(Ctor, sd + 10) : naturalLogarithm(base, sd);
          r = divide(num, denominator, sd, 1);

          if (!inf) {

            // Check for 14 nines from the 2nd rounding digit, as the first may be 4.
            if (+digitsToString(r.d).slice(k + 1, k + 15) + 1 == 1e14) {
              r = finalise(r, pr + 1, 0);
            }

            break;
          }
        } while (checkRoundingDigits(r.d, k += 10, rm));
      }

      external = true;

      return finalise(r, pr, rm);
    };


    /*
     * Return a new Decimal whose value is the maximum of the arguments and the value of this Decimal.
     *
     * arguments {number|string|bigint|Decimal}
     *
    P.max = function () {
      Array.prototype.push.call(arguments, this);
      return maxOrMin(this.constructor, arguments, -1);
    };
     */


    /*
     * Return a new Decimal whose value is the minimum of the arguments and the value of this Decimal.
     *
     * arguments {number|string|bigint|Decimal}
     *
    P.min = function () {
      Array.prototype.push.call(arguments, this);
      return maxOrMin(this.constructor, arguments, 1);
    };
     */


    /*
     *  n - 0 = n
     *  n - N = N
     *  n - I = -I
     *  0 - n = -n
     *  0 - 0 = 0
     *  0 - N = N
     *  0 - I = -I
     *  N - n = N
     *  N - 0 = N
     *  N - N = N
     *  N - I = N
     *  I - n = I
     *  I - 0 = I
     *  I - N = N
     *  I - I = N
     *
     * Return a new Decimal whose value is the value of this Decimal minus `y`, rounded to `precision`
     * significant digits using rounding mode `rounding`.
     *
     */
    P$3.minus = P$3.sub = function (y) {
      var d, e, i, j, k, len, pr, rm, xd, xe, xLTy, yd,
        x = this,
        Ctor = x.constructor;

      y = new Ctor(y);

      // If either is not finite...
      if (!x.d || !y.d) {

        // Return NaN if either is NaN.
        if (!x.s || !y.s) y = new Ctor(NaN);

        // Return y negated if x is finite and y is ±Infinity.
        else if (x.d) y.s = -y.s;

        // Return x if y is finite and x is ±Infinity.
        // Return x if both are ±Infinity with different signs.
        // Return NaN if both are ±Infinity with the same sign.
        else y = new Ctor(y.d || x.s !== y.s ? x : NaN);

        return y;
      }

      // If signs differ...
      if (x.s != y.s) {
        y.s = -y.s;
        return x.plus(y);
      }

      xd = x.d;
      yd = y.d;
      pr = Ctor.precision;
      rm = Ctor.rounding;

      // If either is zero...
      if (!xd[0] || !yd[0]) {

        // Return y negated if x is zero and y is non-zero.
        if (yd[0]) y.s = -y.s;

        // Return x if y is zero and x is non-zero.
        else if (xd[0]) y = new Ctor(x);

        // Return zero if both are zero.
        // From IEEE 754 (2008) 6.3: 0 - 0 = -0 - -0 = -0 when rounding to -Infinity.
        else return new Ctor(rm === 3 ? -0 : 0);

        return external ? finalise(y, pr, rm) : y;
      }

      // x and y are finite, non-zero numbers with the same sign.

      // Calculate base 1e7 exponents.
      e = mathfloor(y.e / LOG_BASE);
      xe = mathfloor(x.e / LOG_BASE);

      xd = xd.slice();
      k = xe - e;

      // If base 1e7 exponents differ...
      if (k) {
        xLTy = k < 0;

        if (xLTy) {
          d = xd;
          k = -k;
          len = yd.length;
        } else {
          d = yd;
          e = xe;
          len = xd.length;
        }

        // Numbers with massively different exponents would result in a very high number of
        // zeros needing to be prepended, but this can be avoided while still ensuring correct
        // rounding by limiting the number of zeros to `Math.ceil(pr / LOG_BASE) + 2`.
        i = Math.max(Math.ceil(pr / LOG_BASE), len) + 2;

        if (k > i) {
          k = i;
          d.length = 1;
        }

        // Prepend zeros to equalise exponents.
        d.reverse();
        for (i = k; i--;) d.push(0);
        d.reverse();

      // Base 1e7 exponents equal.
      } else {

        // Check digits to determine which is the bigger number.

        i = xd.length;
        len = yd.length;
        xLTy = i < len;
        if (xLTy) len = i;

        for (i = 0; i < len; i++) {
          if (xd[i] != yd[i]) {
            xLTy = xd[i] < yd[i];
            break;
          }
        }

        k = 0;
      }

      if (xLTy) {
        d = xd;
        xd = yd;
        yd = d;
        y.s = -y.s;
      }

      len = xd.length;

      // Append zeros to `xd` if shorter.
      // Don't add zeros to `yd` if shorter as subtraction only needs to start at `yd` length.
      for (i = yd.length - len; i > 0; --i) xd[len++] = 0;

      // Subtract yd from xd.
      for (i = yd.length; i > k;) {

        if (xd[--i] < yd[i]) {
          for (j = i; j && xd[--j] === 0;) xd[j] = BASE - 1;
          --xd[j];
          xd[i] += BASE;
        }

        xd[i] -= yd[i];
      }

      // Remove trailing zeros.
      for (; xd[--len] === 0;) xd.pop();

      // Remove leading zeros and adjust exponent accordingly.
      for (; xd[0] === 0; xd.shift()) --e;

      // Zero?
      if (!xd[0]) return new Ctor(rm === 3 ? -0 : 0);

      y.d = xd;
      y.e = getBase10Exponent(xd, e);

      return external ? finalise(y, pr, rm) : y;
    };


    /*
     *   n % 0 =  N
     *   n % N =  N
     *   n % I =  n
     *   0 % n =  0
     *  -0 % n = -0
     *   0 % 0 =  N
     *   0 % N =  N
     *   0 % I =  0
     *   N % n =  N
     *   N % 0 =  N
     *   N % N =  N
     *   N % I =  N
     *   I % n =  N
     *   I % 0 =  N
     *   I % N =  N
     *   I % I =  N
     *
     * Return a new Decimal whose value is the value of this Decimal modulo `y`, rounded to
     * `precision` significant digits using rounding mode `rounding`.
     *
     * The result depends on the modulo mode.
     *
     */
    P$3.modulo = P$3.mod = function (y) {
      var q,
        x = this,
        Ctor = x.constructor;

      y = new Ctor(y);

      // Return NaN if x is ±Infinity or NaN, or y is NaN or ±0.
      if (!x.d || !y.s || y.d && !y.d[0]) return new Ctor(NaN);

      // Return x if y is ±Infinity or x is ±0.
      if (!y.d || x.d && !x.d[0]) {
        return finalise(new Ctor(x), Ctor.precision, Ctor.rounding);
      }

      // Prevent rounding of intermediate calculations.
      external = false;

      if (Ctor.modulo == 9) {

        // Euclidian division: q = sign(y) * floor(x / abs(y))
        // result = x - q * y    where  0 <= result < abs(y)
        q = divide(x, y.abs(), 0, 3, 1);
        q.s *= y.s;
      } else {
        q = divide(x, y, 0, Ctor.modulo, 1);
      }

      q = q.times(y);

      external = true;

      return x.minus(q);
    };


    /*
     * Return a new Decimal whose value is the natural exponential of the value of this Decimal,
     * i.e. the base e raised to the power the value of this Decimal, rounded to `precision`
     * significant digits using rounding mode `rounding`.
     *
     */
    P$3.naturalExponential = P$3.exp = function () {
      return naturalExponential(this);
    };


    /*
     * Return a new Decimal whose value is the natural logarithm of the value of this Decimal,
     * rounded to `precision` significant digits using rounding mode `rounding`.
     *
     */
    P$3.naturalLogarithm = P$3.ln = function () {
      return naturalLogarithm(this);
    };


    /*
     * Return a new Decimal whose value is the value of this Decimal negated, i.e. as if multiplied by
     * -1.
     *
     */
    P$3.negated = P$3.neg = function () {
      var x = new this.constructor(this);
      x.s = -x.s;
      return finalise(x);
    };


    /*
     *  n + 0 = n
     *  n + N = N
     *  n + I = I
     *  0 + n = n
     *  0 + 0 = 0
     *  0 + N = N
     *  0 + I = I
     *  N + n = N
     *  N + 0 = N
     *  N + N = N
     *  N + I = N
     *  I + n = I
     *  I + 0 = I
     *  I + N = N
     *  I + I = I
     *
     * Return a new Decimal whose value is the value of this Decimal plus `y`, rounded to `precision`
     * significant digits using rounding mode `rounding`.
     *
     */
    P$3.plus = P$3.add = function (y) {
      var carry, d, e, i, k, len, pr, rm, xd, yd,
        x = this,
        Ctor = x.constructor;

      y = new Ctor(y);

      // If either is not finite...
      if (!x.d || !y.d) {

        // Return NaN if either is NaN.
        if (!x.s || !y.s) y = new Ctor(NaN);

        // Return x if y is finite and x is ±Infinity.
        // Return x if both are ±Infinity with the same sign.
        // Return NaN if both are ±Infinity with different signs.
        // Return y if x is finite and y is ±Infinity.
        else if (!x.d) y = new Ctor(y.d || x.s === y.s ? x : NaN);

        return y;
      }

       // If signs differ...
      if (x.s != y.s) {
        y.s = -y.s;
        return x.minus(y);
      }

      xd = x.d;
      yd = y.d;
      pr = Ctor.precision;
      rm = Ctor.rounding;

      // If either is zero...
      if (!xd[0] || !yd[0]) {

        // Return x if y is zero.
        // Return y if y is non-zero.
        if (!yd[0]) y = new Ctor(x);

        return external ? finalise(y, pr, rm) : y;
      }

      // x and y are finite, non-zero numbers with the same sign.

      // Calculate base 1e7 exponents.
      k = mathfloor(x.e / LOG_BASE);
      e = mathfloor(y.e / LOG_BASE);

      xd = xd.slice();
      i = k - e;

      // If base 1e7 exponents differ...
      if (i) {

        if (i < 0) {
          d = xd;
          i = -i;
          len = yd.length;
        } else {
          d = yd;
          e = k;
          len = xd.length;
        }

        // Limit number of zeros prepended to max(ceil(pr / LOG_BASE), len) + 1.
        k = Math.ceil(pr / LOG_BASE);
        len = k > len ? k + 1 : len + 1;

        if (i > len) {
          i = len;
          d.length = 1;
        }

        // Prepend zeros to equalise exponents. Note: Faster to use reverse then do unshifts.
        d.reverse();
        for (; i--;) d.push(0);
        d.reverse();
      }

      len = xd.length;
      i = yd.length;

      // If yd is longer than xd, swap xd and yd so xd points to the longer array.
      if (len - i < 0) {
        i = len;
        d = yd;
        yd = xd;
        xd = d;
      }

      // Only start adding at yd.length - 1 as the further digits of xd can be left as they are.
      for (carry = 0; i;) {
        carry = (xd[--i] = xd[i] + yd[i] + carry) / BASE | 0;
        xd[i] %= BASE;
      }

      if (carry) {
        xd.unshift(carry);
        ++e;
      }

      // Remove trailing zeros.
      // No need to check for zero, as +x + +y != 0 && -x + -y != 0
      for (len = xd.length; xd[--len] == 0;) xd.pop();

      y.d = xd;
      y.e = getBase10Exponent(xd, e);

      return external ? finalise(y, pr, rm) : y;
    };


    /*
     * Return the number of significant digits of the value of this Decimal.
     *
     * [z] {boolean|number} Whether to count integer-part trailing zeros: true, false, 1 or 0.
     *
     */
    P$3.precision = P$3.sd = function (z) {
      var k,
        x = this;

      if (z !== void 0 && z !== !!z && z !== 1 && z !== 0) throw Error(invalidArgument + z);

      if (x.d) {
        k = getPrecision(x.d);
        if (z && x.e + 1 > k) k = x.e + 1;
      } else {
        k = NaN;
      }

      return k;
    };


    /*
     * Return a new Decimal whose value is the value of this Decimal rounded to a whole number using
     * rounding mode `rounding`.
     *
     */
    P$3.round = function () {
      var x = this,
        Ctor = x.constructor;

      return finalise(new Ctor(x), x.e + 1, Ctor.rounding);
    };


    /*
     * Return a new Decimal whose value is the sine of the value in radians of this Decimal.
     *
     * Domain: [-Infinity, Infinity]
     * Range: [-1, 1]
     *
     * sin(x) = x - x^3/3! + x^5/5! - ...
     *
     * sin(0)         = 0
     * sin(-0)        = -0
     * sin(Infinity)  = NaN
     * sin(-Infinity) = NaN
     * sin(NaN)       = NaN
     *
     */
    P$3.sine = P$3.sin = function () {
      var pr, rm,
        x = this,
        Ctor = x.constructor;

      if (!x.isFinite()) return new Ctor(NaN);
      if (x.isZero()) return new Ctor(x);

      pr = Ctor.precision;
      rm = Ctor.rounding;
      Ctor.precision = pr + Math.max(x.e, x.sd()) + LOG_BASE;
      Ctor.rounding = 1;

      x = sine(Ctor, toLessThanHalfPi(Ctor, x));

      Ctor.precision = pr;
      Ctor.rounding = rm;

      return finalise(quadrant > 2 ? x.neg() : x, pr, rm, true);
    };


    /*
     * Return a new Decimal whose value is the square root of this Decimal, rounded to `precision`
     * significant digits using rounding mode `rounding`.
     *
     *  sqrt(-n) =  N
     *  sqrt(N)  =  N
     *  sqrt(-I) =  N
     *  sqrt(I)  =  I
     *  sqrt(0)  =  0
     *  sqrt(-0) = -0
     *
     */
    P$3.squareRoot = P$3.sqrt = function () {
      var m, n, sd, r, rep, t,
        x = this,
        d = x.d,
        e = x.e,
        s = x.s,
        Ctor = x.constructor;

      // Negative/NaN/Infinity/zero?
      if (s !== 1 || !d || !d[0]) {
        return new Ctor(!s || s < 0 && (!d || d[0]) ? NaN : d ? x : 1 / 0);
      }

      external = false;

      // Initial estimate.
      s = Math.sqrt(+x);

      // Math.sqrt underflow/overflow?
      // Pass x to Math.sqrt as integer, then adjust the exponent of the result.
      if (s == 0 || s == 1 / 0) {
        n = digitsToString(d);

        if ((n.length + e) % 2 == 0) n += '0';
        s = Math.sqrt(n);
        e = mathfloor((e + 1) / 2) - (e < 0 || e % 2);

        if (s == 1 / 0) {
          n = '5e' + e;
        } else {
          n = s.toExponential();
          n = n.slice(0, n.indexOf('e') + 1) + e;
        }

        r = new Ctor(n);
      } else {
        r = new Ctor(s.toString());
      }

      sd = (e = Ctor.precision) + 3;

      // Newton-Raphson iteration.
      for (;;) {
        t = r;
        r = t.plus(divide(x, t, sd + 2, 1)).times(0.5);

        // TODO? Replace with for-loop and checkRoundingDigits.
        if (digitsToString(t.d).slice(0, sd) === (n = digitsToString(r.d)).slice(0, sd)) {
          n = n.slice(sd - 3, sd + 1);

          // The 4th rounding digit may be in error by -1 so if the 4 rounding digits are 9999 or
          // 4999, i.e. approaching a rounding boundary, continue the iteration.
          if (n == '9999' || !rep && n == '4999') {

            // On the first iteration only, check to see if rounding up gives the exact result as the
            // nines may infinitely repeat.
            if (!rep) {
              finalise(t, e + 1, 0);

              if (t.times(t).eq(x)) {
                r = t;
                break;
              }
            }

            sd += 4;
            rep = 1;
          } else {

            // If the rounding digits are null, 0{0,4} or 50{0,3}, check for an exact result.
            // If not, then there are further digits and m will be truthy.
            if (!+n || !+n.slice(1) && n.charAt(0) == '5') {

              // Truncate to the first rounding digit.
              finalise(r, e + 1, 1);
              m = !r.times(r).eq(x);
            }

            break;
          }
        }
      }

      external = true;

      return finalise(r, e, Ctor.rounding, m);
    };


    /*
     * Return a new Decimal whose value is the tangent of the value in radians of this Decimal.
     *
     * Domain: [-Infinity, Infinity]
     * Range: [-Infinity, Infinity]
     *
     * tan(0)         = 0
     * tan(-0)        = -0
     * tan(Infinity)  = NaN
     * tan(-Infinity) = NaN
     * tan(NaN)       = NaN
     *
     */
    P$3.tangent = P$3.tan = function () {
      var pr, rm,
        x = this,
        Ctor = x.constructor;

      if (!x.isFinite()) return new Ctor(NaN);
      if (x.isZero()) return new Ctor(x);

      pr = Ctor.precision;
      rm = Ctor.rounding;
      Ctor.precision = pr + 10;
      Ctor.rounding = 1;

      x = x.sin();
      x.s = 1;
      x = divide(x, new Ctor(1).minus(x.times(x)).sqrt(), pr + 10, 0);

      Ctor.precision = pr;
      Ctor.rounding = rm;

      return finalise(quadrant == 2 || quadrant == 4 ? x.neg() : x, pr, rm, true);
    };


    /*
     *  n * 0 = 0
     *  n * N = N
     *  n * I = I
     *  0 * n = 0
     *  0 * 0 = 0
     *  0 * N = N
     *  0 * I = N
     *  N * n = N
     *  N * 0 = N
     *  N * N = N
     *  N * I = N
     *  I * n = I
     *  I * 0 = N
     *  I * N = N
     *  I * I = I
     *
     * Return a new Decimal whose value is this Decimal times `y`, rounded to `precision` significant
     * digits using rounding mode `rounding`.
     *
     */
    P$3.times = P$3.mul = function (y) {
      var carry, e, i, k, r, rL, t, xdL, ydL,
        x = this,
        Ctor = x.constructor,
        xd = x.d,
        yd = (y = new Ctor(y)).d;

      y.s *= x.s;

       // If either is NaN, ±Infinity or ±0...
      if (!xd || !xd[0] || !yd || !yd[0]) {

        return new Ctor(!y.s || xd && !xd[0] && !yd || yd && !yd[0] && !xd

          // Return NaN if either is NaN.
          // Return NaN if x is ±0 and y is ±Infinity, or y is ±0 and x is ±Infinity.
          ? NaN

          // Return ±Infinity if either is ±Infinity.
          // Return ±0 if either is ±0.
          : !xd || !yd ? y.s / 0 : y.s * 0);
      }

      e = mathfloor(x.e / LOG_BASE) + mathfloor(y.e / LOG_BASE);
      xdL = xd.length;
      ydL = yd.length;

      // Ensure xd points to the longer array.
      if (xdL < ydL) {
        r = xd;
        xd = yd;
        yd = r;
        rL = xdL;
        xdL = ydL;
        ydL = rL;
      }

      // Initialise the result array with zeros.
      r = [];
      rL = xdL + ydL;
      for (i = rL; i--;) r.push(0);

      // Multiply!
      for (i = ydL; --i >= 0;) {
        carry = 0;
        for (k = xdL + i; k > i;) {
          t = r[k] + yd[i] * xd[k - i - 1] + carry;
          r[k--] = t % BASE | 0;
          carry = t / BASE | 0;
        }

        r[k] = (r[k] + carry) % BASE | 0;
      }

      // Remove trailing zeros.
      for (; !r[--rL];) r.pop();

      if (carry) ++e;
      else r.shift();

      y.d = r;
      y.e = getBase10Exponent(r, e);

      return external ? finalise(y, Ctor.precision, Ctor.rounding) : y;
    };


    /*
     * Return a string representing the value of this Decimal in base 2, round to `sd` significant
     * digits using rounding mode `rm`.
     *
     * If the optional `sd` argument is present then return binary exponential notation.
     *
     * [sd] {number} Significant digits. Integer, 1 to MAX_DIGITS inclusive.
     * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
     *
     */
    P$3.toBinary = function (sd, rm) {
      return toStringBinary(this, 2, sd, rm);
    };


    /*
     * Return a new Decimal whose value is the value of this Decimal rounded to a maximum of `dp`
     * decimal places using rounding mode `rm` or `rounding` if `rm` is omitted.
     *
     * If `dp` is omitted, return a new Decimal whose value is the value of this Decimal.
     *
     * [dp] {number} Decimal places. Integer, 0 to MAX_DIGITS inclusive.
     * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
     *
     */
    P$3.toDecimalPlaces = P$3.toDP = function (dp, rm) {
      var x = this,
        Ctor = x.constructor;

      x = new Ctor(x);
      if (dp === void 0) return x;

      checkInt32(dp, 0, MAX_DIGITS);

      if (rm === void 0) rm = Ctor.rounding;
      else checkInt32(rm, 0, 8);

      return finalise(x, dp + x.e + 1, rm);
    };


    /*
     * Return a string representing the value of this Decimal in exponential notation rounded to
     * `dp` fixed decimal places using rounding mode `rounding`.
     *
     * [dp] {number} Decimal places. Integer, 0 to MAX_DIGITS inclusive.
     * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
     *
     */
    P$3.toExponential = function (dp, rm) {
      var str,
        x = this,
        Ctor = x.constructor;

      if (dp === void 0) {
        str = finiteToString(x, true);
      } else {
        checkInt32(dp, 0, MAX_DIGITS);

        if (rm === void 0) rm = Ctor.rounding;
        else checkInt32(rm, 0, 8);

        x = finalise(new Ctor(x), dp + 1, rm);
        str = finiteToString(x, true, dp + 1);
      }

      return x.isNeg() && !x.isZero() ? '-' + str : str;
    };


    /*
     * Return a string representing the value of this Decimal in normal (fixed-point) notation to
     * `dp` fixed decimal places and rounded using rounding mode `rm` or `rounding` if `rm` is
     * omitted.
     *
     * As with JavaScript numbers, (-0).toFixed(0) is '0', but e.g. (-0.00001).toFixed(0) is '-0'.
     *
     * [dp] {number} Decimal places. Integer, 0 to MAX_DIGITS inclusive.
     * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
     *
     * (-0).toFixed(0) is '0', but (-0.1).toFixed(0) is '-0'.
     * (-0).toFixed(1) is '0.0', but (-0.01).toFixed(1) is '-0.0'.
     * (-0).toFixed(3) is '0.000'.
     * (-0.5).toFixed(0) is '-0'.
     *
     */
    P$3.toFixed = function (dp, rm) {
      var str, y,
        x = this,
        Ctor = x.constructor;

      if (dp === void 0) {
        str = finiteToString(x);
      } else {
        checkInt32(dp, 0, MAX_DIGITS);

        if (rm === void 0) rm = Ctor.rounding;
        else checkInt32(rm, 0, 8);

        y = finalise(new Ctor(x), dp + x.e + 1, rm);
        str = finiteToString(y, false, dp + y.e + 1);
      }

      // To determine whether to add the minus sign look at the value before it was rounded,
      // i.e. look at `x` rather than `y`.
      return x.isNeg() && !x.isZero() ? '-' + str : str;
    };


    /*
     * Return an array representing the value of this Decimal as a simple fraction with an integer
     * numerator and an integer denominator.
     *
     * The denominator will be a positive non-zero value less than or equal to the specified maximum
     * denominator. If a maximum denominator is not specified, the denominator will be the lowest
     * value necessary to represent the number exactly.
     *
     * [maxD] {number|string|bigint|Decimal} Maximum denominator. Integer >= 1 and < Infinity.
     *
     */
    P$3.toFraction = function (maxD) {
      var d, d0, d1, d2, e, k, n, n0, n1, pr, q, r,
        x = this,
        xd = x.d,
        Ctor = x.constructor;

      if (!xd) return new Ctor(x);

      n1 = d0 = new Ctor(1);
      d1 = n0 = new Ctor(0);

      d = new Ctor(d1);
      e = d.e = getPrecision(xd) - x.e - 1;
      k = e % LOG_BASE;
      d.d[0] = mathpow(10, k < 0 ? LOG_BASE + k : k);

      if (maxD == null) {

        // d is 10**e, the minimum max-denominator needed.
        maxD = e > 0 ? d : n1;
      } else {
        n = new Ctor(maxD);
        if (!n.isInt() || n.lt(n1)) throw Error(invalidArgument + n);
        maxD = n.gt(d) ? (e > 0 ? d : n1) : n;
      }

      external = false;
      n = new Ctor(digitsToString(xd));
      pr = Ctor.precision;
      Ctor.precision = e = xd.length * LOG_BASE * 2;

      for (;;)  {
        q = divide(n, d, 0, 1, 1);
        d2 = d0.plus(q.times(d1));
        if (d2.cmp(maxD) == 1) break;
        d0 = d1;
        d1 = d2;
        d2 = n1;
        n1 = n0.plus(q.times(d2));
        n0 = d2;
        d2 = d;
        d = n.minus(q.times(d2));
        n = d2;
      }

      d2 = divide(maxD.minus(d0), d1, 0, 1, 1);
      n0 = n0.plus(d2.times(n1));
      d0 = d0.plus(d2.times(d1));
      n0.s = n1.s = x.s;

      // Determine which fraction is closer to x, n0/d0 or n1/d1?
      r = divide(n1, d1, e, 1).minus(x).abs().cmp(divide(n0, d0, e, 1).minus(x).abs()) < 1
          ? [n1, d1] : [n0, d0];

      Ctor.precision = pr;
      external = true;

      return r;
    };


    /*
     * Return a string representing the value of this Decimal in base 16, round to `sd` significant
     * digits using rounding mode `rm`.
     *
     * If the optional `sd` argument is present then return binary exponential notation.
     *
     * [sd] {number} Significant digits. Integer, 1 to MAX_DIGITS inclusive.
     * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
     *
     */
    P$3.toHexadecimal = P$3.toHex = function (sd, rm) {
      return toStringBinary(this, 16, sd, rm);
    };


    /*
     * Returns a new Decimal whose value is the nearest multiple of `y` in the direction of rounding
     * mode `rm`, or `Decimal.rounding` if `rm` is omitted, to the value of this Decimal.
     *
     * The return value will always have the same sign as this Decimal, unless either this Decimal
     * or `y` is NaN, in which case the return value will be also be NaN.
     *
     * The return value is not affected by the value of `precision`.
     *
     * y {number|string|bigint|Decimal} The magnitude to round to a multiple of.
     * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
     *
     * 'toNearest() rounding mode not an integer: {rm}'
     * 'toNearest() rounding mode out of range: {rm}'
     *
     */
    P$3.toNearest = function (y, rm) {
      var x = this,
        Ctor = x.constructor;

      x = new Ctor(x);

      if (y == null) {

        // If x is not finite, return x.
        if (!x.d) return x;

        y = new Ctor(1);
        rm = Ctor.rounding;
      } else {
        y = new Ctor(y);
        if (rm === void 0) {
          rm = Ctor.rounding;
        } else {
          checkInt32(rm, 0, 8);
        }

        // If x is not finite, return x if y is not NaN, else NaN.
        if (!x.d) return y.s ? x : y;

        // If y is not finite, return Infinity with the sign of x if y is Infinity, else NaN.
        if (!y.d) {
          if (y.s) y.s = x.s;
          return y;
        }
      }

      // If y is not zero, calculate the nearest multiple of y to x.
      if (y.d[0]) {
        external = false;
        x = divide(x, y, 0, rm, 1).times(y);
        external = true;
        finalise(x);

      // If y is zero, return zero with the sign of x.
      } else {
        y.s = x.s;
        x = y;
      }

      return x;
    };


    /*
     * Return the value of this Decimal converted to a number primitive.
     * Zero keeps its sign.
     *
     */
    P$3.toNumber = function () {
      return +this;
    };


    /*
     * Return a string representing the value of this Decimal in base 8, round to `sd` significant
     * digits using rounding mode `rm`.
     *
     * If the optional `sd` argument is present then return binary exponential notation.
     *
     * [sd] {number} Significant digits. Integer, 1 to MAX_DIGITS inclusive.
     * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
     *
     */
    P$3.toOctal = function (sd, rm) {
      return toStringBinary(this, 8, sd, rm);
    };


    /*
     * Return a new Decimal whose value is the value of this Decimal raised to the power `y`, rounded
     * to `precision` significant digits using rounding mode `rounding`.
     *
     * ECMAScript compliant.
     *
     *   pow(x, NaN)                           = NaN
     *   pow(x, ±0)                            = 1

     *   pow(NaN, non-zero)                    = NaN
     *   pow(abs(x) > 1, +Infinity)            = +Infinity
     *   pow(abs(x) > 1, -Infinity)            = +0
     *   pow(abs(x) == 1, ±Infinity)           = NaN
     *   pow(abs(x) < 1, +Infinity)            = +0
     *   pow(abs(x) < 1, -Infinity)            = +Infinity
     *   pow(+Infinity, y > 0)                 = +Infinity
     *   pow(+Infinity, y < 0)                 = +0
     *   pow(-Infinity, odd integer > 0)       = -Infinity
     *   pow(-Infinity, even integer > 0)      = +Infinity
     *   pow(-Infinity, odd integer < 0)       = -0
     *   pow(-Infinity, even integer < 0)      = +0
     *   pow(+0, y > 0)                        = +0
     *   pow(+0, y < 0)                        = +Infinity
     *   pow(-0, odd integer > 0)              = -0
     *   pow(-0, even integer > 0)             = +0
     *   pow(-0, odd integer < 0)              = -Infinity
     *   pow(-0, even integer < 0)             = +Infinity
     *   pow(finite x < 0, finite non-integer) = NaN
     *
     * For non-integer or very large exponents pow(x, y) is calculated using
     *
     *   x^y = exp(y*ln(x))
     *
     * Assuming the first 15 rounding digits are each equally likely to be any digit 0-9, the
     * probability of an incorrectly rounded result
     * P([49]9{14} | [50]0{14}) = 2 * 0.2 * 10^-14 = 4e-15 = 1/2.5e+14
     * i.e. 1 in 250,000,000,000,000
     *
     * If a result is incorrectly rounded the maximum error will be 1 ulp (unit in last place).
     *
     * y {number|string|bigint|Decimal} The power to which to raise this Decimal.
     *
     */
    P$3.toPower = P$3.pow = function (y) {
      var e, k, pr, r, rm, s,
        x = this,
        Ctor = x.constructor,
        yn = +(y = new Ctor(y));

      // Either ±Infinity, NaN or ±0?
      if (!x.d || !y.d || !x.d[0] || !y.d[0]) return new Ctor(mathpow(+x, yn));

      x = new Ctor(x);

      if (x.eq(1)) return x;

      pr = Ctor.precision;
      rm = Ctor.rounding;

      if (y.eq(1)) return finalise(x, pr, rm);

      // y exponent
      e = mathfloor(y.e / LOG_BASE);

      // If y is a small integer use the 'exponentiation by squaring' algorithm.
      if (e >= y.d.length - 1 && (k = yn < 0 ? -yn : yn) <= MAX_SAFE_INTEGER) {
        r = intPow(Ctor, x, k, pr);
        return y.s < 0 ? new Ctor(1).div(r) : finalise(r, pr, rm);
      }

      s = x.s;

      // if x is negative
      if (s < 0) {

        // if y is not an integer
        if (e < y.d.length - 1) return new Ctor(NaN);

        // Result is positive if x is negative and the last digit of integer y is even.
        if ((y.d[e] & 1) == 0) s = 1;

        // if x.eq(-1)
        if (x.e == 0 && x.d[0] == 1 && x.d.length == 1) {
          x.s = s;
          return x;
        }
      }

      // Estimate result exponent.
      // x^y = 10^e,  where e = y * log10(x)
      // log10(x) = log10(x_significand) + x_exponent
      // log10(x_significand) = ln(x_significand) / ln(10)
      k = mathpow(+x, yn);
      e = k == 0 || !isFinite(k)
        ? mathfloor(yn * (Math.log('0.' + digitsToString(x.d)) / Math.LN10 + x.e + 1))
        : new Ctor(k + '').e;

      // Exponent estimate may be incorrect e.g. x: 0.999999999999999999, y: 2.29, e: 0, r.e: -1.

      // Overflow/underflow?
      if (e > Ctor.maxE + 1 || e < Ctor.minE - 1) return new Ctor(e > 0 ? s / 0 : 0);

      external = false;
      Ctor.rounding = x.s = 1;

      // Estimate the extra guard digits needed to ensure five correct rounding digits from
      // naturalLogarithm(x). Example of failure without these extra digits (precision: 10):
      // new Decimal(2.32456).pow('2087987436534566.46411')
      // should be 1.162377823e+764914905173815, but is 1.162355823e+764914905173815
      k = Math.min(12, (e + '').length);

      // r = x^y = exp(y*ln(x))
      r = naturalExponential(y.times(naturalLogarithm(x, pr + k)), pr);

      // r may be Infinity, e.g. (0.9999999999999999).pow(-1e+40)
      if (r.d) {

        // Truncate to the required precision plus five rounding digits.
        r = finalise(r, pr + 5, 1);

        // If the rounding digits are [49]9999 or [50]0000 increase the precision by 10 and recalculate
        // the result.
        if (checkRoundingDigits(r.d, pr, rm)) {
          e = pr + 10;

          // Truncate to the increased precision plus five rounding digits.
          r = finalise(naturalExponential(y.times(naturalLogarithm(x, e + k)), e), e + 5, 1);

          // Check for 14 nines from the 2nd rounding digit (the first rounding digit may be 4 or 9).
          if (+digitsToString(r.d).slice(pr + 1, pr + 15) + 1 == 1e14) {
            r = finalise(r, pr + 1, 0);
          }
        }
      }

      r.s = s;
      external = true;
      Ctor.rounding = rm;

      return finalise(r, pr, rm);
    };


    /*
     * Return a string representing the value of this Decimal rounded to `sd` significant digits
     * using rounding mode `rounding`.
     *
     * Return exponential notation if `sd` is less than the number of digits necessary to represent
     * the integer part of the value in normal notation.
     *
     * [sd] {number} Significant digits. Integer, 1 to MAX_DIGITS inclusive.
     * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
     *
     */
    P$3.toPrecision = function (sd, rm) {
      var str,
        x = this,
        Ctor = x.constructor;

      if (sd === void 0) {
        str = finiteToString(x, x.e <= Ctor.toExpNeg || x.e >= Ctor.toExpPos);
      } else {
        checkInt32(sd, 1, MAX_DIGITS);

        if (rm === void 0) rm = Ctor.rounding;
        else checkInt32(rm, 0, 8);

        x = finalise(new Ctor(x), sd, rm);
        str = finiteToString(x, sd <= x.e || x.e <= Ctor.toExpNeg, sd);
      }

      return x.isNeg() && !x.isZero() ? '-' + str : str;
    };


    /*
     * Return a new Decimal whose value is the value of this Decimal rounded to a maximum of `sd`
     * significant digits using rounding mode `rm`, or to `precision` and `rounding` respectively if
     * omitted.
     *
     * [sd] {number} Significant digits. Integer, 1 to MAX_DIGITS inclusive.
     * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
     *
     * 'toSD() digits out of range: {sd}'
     * 'toSD() digits not an integer: {sd}'
     * 'toSD() rounding mode not an integer: {rm}'
     * 'toSD() rounding mode out of range: {rm}'
     *
     */
    P$3.toSignificantDigits = P$3.toSD = function (sd, rm) {
      var x = this,
        Ctor = x.constructor;

      if (sd === void 0) {
        sd = Ctor.precision;
        rm = Ctor.rounding;
      } else {
        checkInt32(sd, 1, MAX_DIGITS);

        if (rm === void 0) rm = Ctor.rounding;
        else checkInt32(rm, 0, 8);
      }

      return finalise(new Ctor(x), sd, rm);
    };


    /*
     * Return a string representing the value of this Decimal.
     *
     * Return exponential notation if this Decimal has a positive exponent equal to or greater than
     * `toExpPos`, or a negative exponent equal to or less than `toExpNeg`.
     *
     */
    P$3.toString = function () {
      var x = this,
        Ctor = x.constructor,
        str = finiteToString(x, x.e <= Ctor.toExpNeg || x.e >= Ctor.toExpPos);

      return x.isNeg() && !x.isZero() ? '-' + str : str;
    };


    /*
     * Return a new Decimal whose value is the value of this Decimal truncated to a whole number.
     *
     */
    P$3.truncated = P$3.trunc = function () {
      return finalise(new this.constructor(this), this.e + 1, 1);
    };


    /*
     * Return a string representing the value of this Decimal.
     * Unlike `toString`, negative zero will include the minus sign.
     *
     */
    P$3.valueOf = P$3.toJSON = function () {
      var x = this,
        Ctor = x.constructor,
        str = finiteToString(x, x.e <= Ctor.toExpNeg || x.e >= Ctor.toExpPos);

      return x.isNeg() ? '-' + str : str;
    };


    // Helper functions for Decimal.prototype (P) and/or Decimal methods, and their callers.


    /*
     *  digitsToString           P.cubeRoot, P.logarithm, P.squareRoot, P.toFraction, P.toPower,
     *                           finiteToString, naturalExponential, naturalLogarithm
     *  checkInt32               P.toDecimalPlaces, P.toExponential, P.toFixed, P.toNearest,
     *                           P.toPrecision, P.toSignificantDigits, toStringBinary, random
     *  checkRoundingDigits      P.logarithm, P.toPower, naturalExponential, naturalLogarithm
     *  convertBase              toStringBinary, parseOther
     *  cos                      P.cos
     *  divide                   P.atanh, P.cubeRoot, P.dividedBy, P.dividedToIntegerBy,
     *                           P.logarithm, P.modulo, P.squareRoot, P.tan, P.tanh, P.toFraction,
     *                           P.toNearest, toStringBinary, naturalExponential, naturalLogarithm,
     *                           taylorSeries, atan2, parseOther
     *  finalise                 P.absoluteValue, P.atan, P.atanh, P.ceil, P.cos, P.cosh,
     *                           P.cubeRoot, P.dividedToIntegerBy, P.floor, P.logarithm, P.minus,
     *                           P.modulo, P.negated, P.plus, P.round, P.sin, P.sinh, P.squareRoot,
     *                           P.tan, P.times, P.toDecimalPlaces, P.toExponential, P.toFixed,
     *                           P.toNearest, P.toPower, P.toPrecision, P.toSignificantDigits,
     *                           P.truncated, divide, getLn10, getPi, naturalExponential,
     *                           naturalLogarithm, ceil, floor, round, trunc
     *  finiteToString           P.toExponential, P.toFixed, P.toPrecision, P.toString, P.valueOf,
     *                           toStringBinary
     *  getBase10Exponent        P.minus, P.plus, P.times, parseOther
     *  getLn10                  P.logarithm, naturalLogarithm
     *  getPi                    P.acos, P.asin, P.atan, toLessThanHalfPi, atan2
     *  getPrecision             P.precision, P.toFraction
     *  getZeroString            digitsToString, finiteToString
     *  intPow                   P.toPower, parseOther
     *  isOdd                    toLessThanHalfPi
     *  maxOrMin                 max, min
     *  naturalExponential       P.naturalExponential, P.toPower
     *  naturalLogarithm         P.acosh, P.asinh, P.atanh, P.logarithm, P.naturalLogarithm,
     *                           P.toPower, naturalExponential
     *  nonFiniteToString        finiteToString, toStringBinary
     *  parseDecimal             Decimal
     *  parseOther               Decimal
     *  sin                      P.sin
     *  taylorSeries             P.cosh, P.sinh, cos, sin
     *  toLessThanHalfPi         P.cos, P.sin
     *  toStringBinary           P.toBinary, P.toHexadecimal, P.toOctal
     *  truncate                 intPow
     *
     *  Throws:                  P.logarithm, P.precision, P.toFraction, checkInt32, getLn10, getPi,
     *                           naturalLogarithm, config, parseOther, random, Decimal
     */


    function digitsToString(d) {
      var i, k, ws,
        indexOfLastWord = d.length - 1,
        str = '',
        w = d[0];

      if (indexOfLastWord > 0) {
        str += w;
        for (i = 1; i < indexOfLastWord; i++) {
          ws = d[i] + '';
          k = LOG_BASE - ws.length;
          if (k) str += getZeroString(k);
          str += ws;
        }

        w = d[i];
        ws = w + '';
        k = LOG_BASE - ws.length;
        if (k) str += getZeroString(k);
      } else if (w === 0) {
        return '0';
      }

      // Remove trailing zeros of last w.
      for (; w % 10 === 0;) w /= 10;

      return str + w;
    }


    function checkInt32(i, min, max) {
      if (i !== ~~i || i < min || i > max) {
        throw Error(invalidArgument + i);
      }
    }


    /*
     * Check 5 rounding digits if `repeating` is null, 4 otherwise.
     * `repeating == null` if caller is `log` or `pow`,
     * `repeating != null` if caller is `naturalLogarithm` or `naturalExponential`.
     */
    function checkRoundingDigits(d, i, rm, repeating) {
      var di, k, r, rd;

      // Get the length of the first word of the array d.
      for (k = d[0]; k >= 10; k /= 10) --i;

      // Is the rounding digit in the first word of d?
      if (--i < 0) {
        i += LOG_BASE;
        di = 0;
      } else {
        di = Math.ceil((i + 1) / LOG_BASE);
        i %= LOG_BASE;
      }

      // i is the index (0 - 6) of the rounding digit.
      // E.g. if within the word 3487563 the first rounding digit is 5,
      // then i = 4, k = 1000, rd = 3487563 % 1000 = 563
      k = mathpow(10, LOG_BASE - i);
      rd = d[di] % k | 0;

      if (repeating == null) {
        if (i < 3) {
          if (i == 0) rd = rd / 100 | 0;
          else if (i == 1) rd = rd / 10 | 0;
          r = rm < 4 && rd == 99999 || rm > 3 && rd == 49999 || rd == 50000 || rd == 0;
        } else {
          r = (rm < 4 && rd + 1 == k || rm > 3 && rd + 1 == k / 2) &&
            (d[di + 1] / k / 100 | 0) == mathpow(10, i - 2) - 1 ||
              (rd == k / 2 || rd == 0) && (d[di + 1] / k / 100 | 0) == 0;
        }
      } else {
        if (i < 4) {
          if (i == 0) rd = rd / 1000 | 0;
          else if (i == 1) rd = rd / 100 | 0;
          else if (i == 2) rd = rd / 10 | 0;
          r = (repeating || rm < 4) && rd == 9999 || !repeating && rm > 3 && rd == 4999;
        } else {
          r = ((repeating || rm < 4) && rd + 1 == k ||
          (!repeating && rm > 3) && rd + 1 == k / 2) &&
            (d[di + 1] / k / 1000 | 0) == mathpow(10, i - 3) - 1;
        }
      }

      return r;
    }


    // Convert string of `baseIn` to an array of numbers of `baseOut`.
    // Eg. convertBase('255', 10, 16) returns [15, 15].
    // Eg. convertBase('ff', 16, 10) returns [2, 5, 5].
    function convertBase(str, baseIn, baseOut) {
      var j,
        arr = [0],
        arrL,
        i = 0,
        strL = str.length;

      for (; i < strL;) {
        for (arrL = arr.length; arrL--;) arr[arrL] *= baseIn;
        arr[0] += NUMERALS.indexOf(str.charAt(i++));
        for (j = 0; j < arr.length; j++) {
          if (arr[j] > baseOut - 1) {
            if (arr[j + 1] === void 0) arr[j + 1] = 0;
            arr[j + 1] += arr[j] / baseOut | 0;
            arr[j] %= baseOut;
          }
        }
      }

      return arr.reverse();
    }


    /*
     * cos(x) = 1 - x^2/2! + x^4/4! - ...
     * |x| < pi/2
     *
     */
    function cosine(Ctor, x) {
      var k, len, y;

      if (x.isZero()) return x;

      // Argument reduction: cos(4x) = 8*(cos^4(x) - cos^2(x)) + 1
      // i.e. cos(x) = 8*(cos^4(x/4) - cos^2(x/4)) + 1

      // Estimate the optimum number of times to use the argument reduction.
      len = x.d.length;
      if (len < 32) {
        k = Math.ceil(len / 3);
        y = (1 / tinyPow(4, k)).toString();
      } else {
        k = 16;
        y = '2.3283064365386962890625e-10';
      }

      Ctor.precision += k;

      x = taylorSeries(Ctor, 1, x.times(y), new Ctor(1));

      // Reverse argument reduction
      for (var i = k; i--;) {
        var cos2x = x.times(x);
        x = cos2x.times(cos2x).minus(cos2x).times(8).plus(1);
      }

      Ctor.precision -= k;

      return x;
    }


    /*
     * Perform division in the specified base.
     */
    var divide = (function () {

      // Assumes non-zero x and k, and hence non-zero result.
      function multiplyInteger(x, k, base) {
        var temp,
          carry = 0,
          i = x.length;

        for (x = x.slice(); i--;) {
          temp = x[i] * k + carry;
          x[i] = temp % base | 0;
          carry = temp / base | 0;
        }

        if (carry) x.unshift(carry);

        return x;
      }

      function compare(a, b, aL, bL) {
        var i, r;

        if (aL != bL) {
          r = aL > bL ? 1 : -1;
        } else {
          for (i = r = 0; i < aL; i++) {
            if (a[i] != b[i]) {
              r = a[i] > b[i] ? 1 : -1;
              break;
            }
          }
        }

        return r;
      }

      function subtract(a, b, aL, base) {
        var i = 0;

        // Subtract b from a.
        for (; aL--;) {
          a[aL] -= i;
          i = a[aL] < b[aL] ? 1 : 0;
          a[aL] = i * base + a[aL] - b[aL];
        }

        // Remove leading zeros.
        for (; !a[0] && a.length > 1;) a.shift();
      }

      return function (x, y, pr, rm, dp, base) {
        var cmp, e, i, k, logBase, more, prod, prodL, q, qd, rem, remL, rem0, sd, t, xi, xL, yd0,
          yL, yz,
          Ctor = x.constructor,
          sign = x.s == y.s ? 1 : -1,
          xd = x.d,
          yd = y.d;

        // Either NaN, Infinity or 0?
        if (!xd || !xd[0] || !yd || !yd[0]) {

          return new Ctor(// Return NaN if either NaN, or both Infinity or 0.
            !x.s || !y.s || (xd ? yd && xd[0] == yd[0] : !yd) ? NaN :

            // Return ±0 if x is 0 or y is ±Infinity, or return ±Infinity as y is 0.
            xd && xd[0] == 0 || !yd ? sign * 0 : sign / 0);
        }

        if (base) {
          logBase = 1;
          e = x.e - y.e;
        } else {
          base = BASE;
          logBase = LOG_BASE;
          e = mathfloor(x.e / logBase) - mathfloor(y.e / logBase);
        }

        yL = yd.length;
        xL = xd.length;
        q = new Ctor(sign);
        qd = q.d = [];

        // Result exponent may be one less than e.
        // The digit array of a Decimal from toStringBinary may have trailing zeros.
        for (i = 0; yd[i] == (xd[i] || 0); i++);

        if (yd[i] > (xd[i] || 0)) e--;

        if (pr == null) {
          sd = pr = Ctor.precision;
          rm = Ctor.rounding;
        } else if (dp) {
          sd = pr + (x.e - y.e) + 1;
        } else {
          sd = pr;
        }

        if (sd < 0) {
          qd.push(1);
          more = true;
        } else {

          // Convert precision in number of base 10 digits to base 1e7 digits.
          sd = sd / logBase + 2 | 0;
          i = 0;

          // divisor < 1e7
          if (yL == 1) {
            k = 0;
            yd = yd[0];
            sd++;

            // k is the carry.
            for (; (i < xL || k) && sd--; i++) {
              t = k * base + (xd[i] || 0);
              qd[i] = t / yd | 0;
              k = t % yd | 0;
            }

            more = k || i < xL;

          // divisor >= 1e7
          } else {

            // Normalise xd and yd so highest order digit of yd is >= base/2
            k = base / (yd[0] + 1) | 0;

            if (k > 1) {
              yd = multiplyInteger(yd, k, base);
              xd = multiplyInteger(xd, k, base);
              yL = yd.length;
              xL = xd.length;
            }

            xi = yL;
            rem = xd.slice(0, yL);
            remL = rem.length;

            // Add zeros to make remainder as long as divisor.
            for (; remL < yL;) rem[remL++] = 0;

            yz = yd.slice();
            yz.unshift(0);
            yd0 = yd[0];

            if (yd[1] >= base / 2) ++yd0;

            do {
              k = 0;

              // Compare divisor and remainder.
              cmp = compare(yd, rem, yL, remL);

              // If divisor < remainder.
              if (cmp < 0) {

                // Calculate trial digit, k.
                rem0 = rem[0];
                if (yL != remL) rem0 = rem0 * base + (rem[1] || 0);

                // k will be how many times the divisor goes into the current remainder.
                k = rem0 / yd0 | 0;

                //  Algorithm:
                //  1. product = divisor * trial digit (k)
                //  2. if product > remainder: product -= divisor, k--
                //  3. remainder -= product
                //  4. if product was < remainder at 2:
                //    5. compare new remainder and divisor
                //    6. If remainder > divisor: remainder -= divisor, k++

                if (k > 1) {
                  if (k >= base) k = base - 1;

                  // product = divisor * trial digit.
                  prod = multiplyInteger(yd, k, base);
                  prodL = prod.length;
                  remL = rem.length;

                  // Compare product and remainder.
                  cmp = compare(prod, rem, prodL, remL);

                  // product > remainder.
                  if (cmp == 1) {
                    k--;

                    // Subtract divisor from product.
                    subtract(prod, yL < prodL ? yz : yd, prodL, base);
                  }
                } else {

                  // cmp is -1.
                  // If k is 0, there is no need to compare yd and rem again below, so change cmp to 1
                  // to avoid it. If k is 1 there is a need to compare yd and rem again below.
                  if (k == 0) cmp = k = 1;
                  prod = yd.slice();
                }

                prodL = prod.length;
                if (prodL < remL) prod.unshift(0);

                // Subtract product from remainder.
                subtract(rem, prod, remL, base);

                // If product was < previous remainder.
                if (cmp == -1) {
                  remL = rem.length;

                  // Compare divisor and new remainder.
                  cmp = compare(yd, rem, yL, remL);

                  // If divisor < new remainder, subtract divisor from remainder.
                  if (cmp < 1) {
                    k++;

                    // Subtract divisor from remainder.
                    subtract(rem, yL < remL ? yz : yd, remL, base);
                  }
                }

                remL = rem.length;
              } else if (cmp === 0) {
                k++;
                rem = [0];
              }    // if cmp === 1, k will be 0

              // Add the next digit, k, to the result array.
              qd[i++] = k;

              // Update the remainder.
              if (cmp && rem[0]) {
                rem[remL++] = xd[xi] || 0;
              } else {
                rem = [xd[xi]];
                remL = 1;
              }

            } while ((xi++ < xL || rem[0] !== void 0) && sd--);

            more = rem[0] !== void 0;
          }

          // Leading zero?
          if (!qd[0]) qd.shift();
        }

        // logBase is 1 when divide is being used for base conversion.
        if (logBase == 1) {
          q.e = e;
          inexact = more;
        } else {

          // To calculate q.e, first get the number of digits of qd[0].
          for (i = 1, k = qd[0]; k >= 10; k /= 10) i++;
          q.e = i + e * logBase - 1;

          finalise(q, dp ? pr + q.e + 1 : pr, rm, more);
        }

        return q;
      };
    })();


    /*
     * Round `x` to `sd` significant digits using rounding mode `rm`.
     * Check for over/under-flow.
     */
     function finalise(x, sd, rm, isTruncated) {
      var digits, i, j, k, rd, roundUp, w, xd, xdi,
        Ctor = x.constructor;

      // Don't round if sd is null or undefined.
      out: if (sd != null) {
        xd = x.d;

        // Infinity/NaN.
        if (!xd) return x;

        // rd: the rounding digit, i.e. the digit after the digit that may be rounded up.
        // w: the word of xd containing rd, a base 1e7 number.
        // xdi: the index of w within xd.
        // digits: the number of digits of w.
        // i: what would be the index of rd within w if all the numbers were 7 digits long (i.e. if
        // they had leading zeros)
        // j: if > 0, the actual index of rd within w (if < 0, rd is a leading zero).

        // Get the length of the first word of the digits array xd.
        for (digits = 1, k = xd[0]; k >= 10; k /= 10) digits++;
        i = sd - digits;

        // Is the rounding digit in the first word of xd?
        if (i < 0) {
          i += LOG_BASE;
          j = sd;
          w = xd[xdi = 0];

          // Get the rounding digit at index j of w.
          rd = w / mathpow(10, digits - j - 1) % 10 | 0;
        } else {
          xdi = Math.ceil((i + 1) / LOG_BASE);
          k = xd.length;
          if (xdi >= k) {
            if (isTruncated) {

              // Needed by `naturalExponential`, `naturalLogarithm` and `squareRoot`.
              for (; k++ <= xdi;) xd.push(0);
              w = rd = 0;
              digits = 1;
              i %= LOG_BASE;
              j = i - LOG_BASE + 1;
            } else {
              break out;
            }
          } else {
            w = k = xd[xdi];

            // Get the number of digits of w.
            for (digits = 1; k >= 10; k /= 10) digits++;

            // Get the index of rd within w.
            i %= LOG_BASE;

            // Get the index of rd within w, adjusted for leading zeros.
            // The number of leading zeros of w is given by LOG_BASE - digits.
            j = i - LOG_BASE + digits;

            // Get the rounding digit at index j of w.
            rd = j < 0 ? 0 : w / mathpow(10, digits - j - 1) % 10 | 0;
          }
        }

        // Are there any non-zero digits after the rounding digit?
        isTruncated = isTruncated || sd < 0 ||
          xd[xdi + 1] !== void 0 || (j < 0 ? w : w % mathpow(10, digits - j - 1));

        // The expression `w % mathpow(10, digits - j - 1)` returns all the digits of w to the right
        // of the digit at (left-to-right) index j, e.g. if w is 908714 and j is 2, the expression
        // will give 714.

        roundUp = rm < 4
          ? (rd || isTruncated) && (rm == 0 || rm == (x.s < 0 ? 3 : 2))
          : rd > 5 || rd == 5 && (rm == 4 || isTruncated || rm == 6 &&

            // Check whether the digit to the left of the rounding digit is odd.
            ((i > 0 ? j > 0 ? w / mathpow(10, digits - j) : 0 : xd[xdi - 1]) % 10) & 1 ||
              rm == (x.s < 0 ? 8 : 7));

        if (sd < 1 || !xd[0]) {
          xd.length = 0;
          if (roundUp) {

            // Convert sd to decimal places.
            sd -= x.e + 1;

            // 1, 0.1, 0.01, 0.001, 0.0001 etc.
            xd[0] = mathpow(10, (LOG_BASE - sd % LOG_BASE) % LOG_BASE);
            x.e = -sd || 0;
          } else {

            // Zero.
            xd[0] = x.e = 0;
          }

          return x;
        }

        // Remove excess digits.
        if (i == 0) {
          xd.length = xdi;
          k = 1;
          xdi--;
        } else {
          xd.length = xdi + 1;
          k = mathpow(10, LOG_BASE - i);

          // E.g. 56700 becomes 56000 if 7 is the rounding digit.
          // j > 0 means i > number of leading zeros of w.
          xd[xdi] = j > 0 ? (w / mathpow(10, digits - j) % mathpow(10, j) | 0) * k : 0;
        }

        if (roundUp) {
          for (;;) {

            // Is the digit to be rounded up in the first word of xd?
            if (xdi == 0) {

              // i will be the length of xd[0] before k is added.
              for (i = 1, j = xd[0]; j >= 10; j /= 10) i++;
              j = xd[0] += k;
              for (k = 1; j >= 10; j /= 10) k++;

              // if i != k the length has increased.
              if (i != k) {
                x.e++;
                if (xd[0] == BASE) xd[0] = 1;
              }

              break;
            } else {
              xd[xdi] += k;
              if (xd[xdi] != BASE) break;
              xd[xdi--] = 0;
              k = 1;
            }
          }
        }

        // Remove trailing zeros.
        for (i = xd.length; xd[--i] === 0;) xd.pop();
      }

      if (external) {

        // Overflow?
        if (x.e > Ctor.maxE) {

          // Infinity.
          x.d = null;
          x.e = NaN;

        // Underflow?
        } else if (x.e < Ctor.minE) {

          // Zero.
          x.e = 0;
          x.d = [0];
          // Ctor.underflow = true;
        } // else Ctor.underflow = false;
      }

      return x;
    }


    function finiteToString(x, isExp, sd) {
      if (!x.isFinite()) return nonFiniteToString(x);
      var k,
        e = x.e,
        str = digitsToString(x.d),
        len = str.length;

      if (isExp) {
        if (sd && (k = sd - len) > 0) {
          str = str.charAt(0) + '.' + str.slice(1) + getZeroString(k);
        } else if (len > 1) {
          str = str.charAt(0) + '.' + str.slice(1);
        }

        str = str + (x.e < 0 ? 'e' : 'e+') + x.e;
      } else if (e < 0) {
        str = '0.' + getZeroString(-e - 1) + str;
        if (sd && (k = sd - len) > 0) str += getZeroString(k);
      } else if (e >= len) {
        str += getZeroString(e + 1 - len);
        if (sd && (k = sd - e - 1) > 0) str = str + '.' + getZeroString(k);
      } else {
        if ((k = e + 1) < len) str = str.slice(0, k) + '.' + str.slice(k);
        if (sd && (k = sd - len) > 0) {
          if (e + 1 === len) str += '.';
          str += getZeroString(k);
        }
      }

      return str;
    }


    // Calculate the base 10 exponent from the base 1e7 exponent.
    function getBase10Exponent(digits, e) {
      var w = digits[0];

      // Add the number of digits of the first word of the digits array.
      for ( e *= LOG_BASE; w >= 10; w /= 10) e++;
      return e;
    }


    function getLn10(Ctor, sd, pr) {
      if (sd > LN10_PRECISION) {

        // Reset global state in case the exception is caught.
        external = true;
        if (pr) Ctor.precision = pr;
        throw Error(precisionLimitExceeded);
      }
      return finalise(new Ctor(LN10), sd, 1, true);
    }


    function getPi(Ctor, sd, rm) {
      if (sd > PI_PRECISION) throw Error(precisionLimitExceeded);
      return finalise(new Ctor(PI), sd, rm, true);
    }


    function getPrecision(digits) {
      var w = digits.length - 1,
        len = w * LOG_BASE + 1;

      w = digits[w];

      // If non-zero...
      if (w) {

        // Subtract the number of trailing zeros of the last word.
        for (; w % 10 == 0; w /= 10) len--;

        // Add the number of digits of the first word.
        for (w = digits[0]; w >= 10; w /= 10) len++;
      }

      return len;
    }


    function getZeroString(k) {
      var zs = '';
      for (; k--;) zs += '0';
      return zs;
    }


    /*
     * Return a new Decimal whose value is the value of Decimal `x` to the power `n`, where `n` is an
     * integer of type number.
     *
     * Implements 'exponentiation by squaring'. Called by `pow` and `parseOther`.
     *
     */
    function intPow(Ctor, x, n, pr) {
      var isTruncated,
        r = new Ctor(1),

        // Max n of 9007199254740991 takes 53 loop iterations.
        // Maximum digits array length; leaves [28, 34] guard digits.
        k = Math.ceil(pr / LOG_BASE + 4);

      external = false;

      for (;;) {
        if (n % 2) {
          r = r.times(x);
          if (truncate(r.d, k)) isTruncated = true;
        }

        n = mathfloor(n / 2);
        if (n === 0) {

          // To ensure correct rounding when r.d is truncated, increment the last word if it is zero.
          n = r.d.length - 1;
          if (isTruncated && r.d[n] === 0) ++r.d[n];
          break;
        }

        x = x.times(x);
        truncate(x.d, k);
      }

      external = true;

      return r;
    }


    function isOdd(n) {
      return n.d[n.d.length - 1] & 1;
    }


    /*
     * Handle `max` (`n` is -1) and `min` (`n` is 1).
     */
    function maxOrMin(Ctor, args, n) {
      var k, y,
        x = new Ctor(args[0]),
        i = 0;

      for (; ++i < args.length;) {
        y = new Ctor(args[i]);

        // NaN?
        if (!y.s) {
          x = y;
          break;
        }

        k = x.cmp(y);

        if (k === n || k === 0 && x.s === n) {
          x = y;
        }
      }

      return x;
    }


    /*
     * Return a new Decimal whose value is the natural exponential of `x` rounded to `sd` significant
     * digits.
     *
     * Taylor/Maclaurin series.
     *
     * exp(x) = x^0/0! + x^1/1! + x^2/2! + x^3/3! + ...
     *
     * Argument reduction:
     *   Repeat x = x / 32, k += 5, until |x| < 0.1
     *   exp(x) = exp(x / 2^k)^(2^k)
     *
     * Previously, the argument was initially reduced by
     * exp(x) = exp(r) * 10^k  where r = x - k * ln10, k = floor(x / ln10)
     * to first put r in the range [0, ln10], before dividing by 32 until |x| < 0.1, but this was
     * found to be slower than just dividing repeatedly by 32 as above.
     *
     * Max integer argument: exp('20723265836946413') = 6.3e+9000000000000000
     * Min integer argument: exp('-20723265836946411') = 1.2e-9000000000000000
     * (Math object integer min/max: Math.exp(709) = 8.2e+307, Math.exp(-745) = 5e-324)
     *
     *  exp(Infinity)  = Infinity
     *  exp(-Infinity) = 0
     *  exp(NaN)       = NaN
     *  exp(±0)        = 1
     *
     *  exp(x) is non-terminating for any finite, non-zero x.
     *
     *  The result will always be correctly rounded.
     *
     */
    function naturalExponential(x, sd) {
      var denominator, guard, j, pow, sum, t, wpr,
        rep = 0,
        i = 0,
        k = 0,
        Ctor = x.constructor,
        rm = Ctor.rounding,
        pr = Ctor.precision;

      // 0/NaN/Infinity?
      if (!x.d || !x.d[0] || x.e > 17) {

        return new Ctor(x.d
          ? !x.d[0] ? 1 : x.s < 0 ? 0 : 1 / 0
          : x.s ? x.s < 0 ? 0 : x : 0 / 0);
      }

      if (sd == null) {
        external = false;
        wpr = pr;
      } else {
        wpr = sd;
      }

      t = new Ctor(0.03125);

      // while abs(x) >= 0.1
      while (x.e > -2) {

        // x = x / 2^5
        x = x.times(t);
        k += 5;
      }

      // Use 2 * log10(2^k) + 5 (empirically derived) to estimate the increase in precision
      // necessary to ensure the first 4 rounding digits are correct.
      guard = Math.log(mathpow(2, k)) / Math.LN10 * 2 + 5 | 0;
      wpr += guard;
      denominator = pow = sum = new Ctor(1);
      Ctor.precision = wpr;

      for (;;) {
        pow = finalise(pow.times(x), wpr, 1);
        denominator = denominator.times(++i);
        t = sum.plus(divide(pow, denominator, wpr, 1));

        if (digitsToString(t.d).slice(0, wpr) === digitsToString(sum.d).slice(0, wpr)) {
          j = k;
          while (j--) sum = finalise(sum.times(sum), wpr, 1);

          // Check to see if the first 4 rounding digits are [49]999.
          // If so, repeat the summation with a higher precision, otherwise
          // e.g. with precision: 18, rounding: 1
          // exp(18.404272462595034083567793919843761) = 98372560.1229999999 (should be 98372560.123)
          // `wpr - guard` is the index of first rounding digit.
          if (sd == null) {

            if (rep < 3 && checkRoundingDigits(sum.d, wpr - guard, rm, rep)) {
              Ctor.precision = wpr += 10;
              denominator = pow = t = new Ctor(1);
              i = 0;
              rep++;
            } else {
              return finalise(sum, Ctor.precision = pr, rm, external = true);
            }
          } else {
            Ctor.precision = pr;
            return sum;
          }
        }

        sum = t;
      }
    }


    /*
     * Return a new Decimal whose value is the natural logarithm of `x` rounded to `sd` significant
     * digits.
     *
     *  ln(-n)        = NaN
     *  ln(0)         = -Infinity
     *  ln(-0)        = -Infinity
     *  ln(1)         = 0
     *  ln(Infinity)  = Infinity
     *  ln(-Infinity) = NaN
     *  ln(NaN)       = NaN
     *
     *  ln(n) (n != 1) is non-terminating.
     *
     */
    function naturalLogarithm(y, sd) {
      var c, c0, denominator, e, numerator, rep, sum, t, wpr, x1, x2,
        n = 1,
        guard = 10,
        x = y,
        xd = x.d,
        Ctor = x.constructor,
        rm = Ctor.rounding,
        pr = Ctor.precision;

      // Is x negative or Infinity, NaN, 0 or 1?
      if (x.s < 0 || !xd || !xd[0] || !x.e && xd[0] == 1 && xd.length == 1) {
        return new Ctor(xd && !xd[0] ? -1 / 0 : x.s != 1 ? NaN : xd ? 0 : x);
      }

      if (sd == null) {
        external = false;
        wpr = pr;
      } else {
        wpr = sd;
      }

      Ctor.precision = wpr += guard;
      c = digitsToString(xd);
      c0 = c.charAt(0);

      if (Math.abs(e = x.e) < 1.5e15) {

        // Argument reduction.
        // The series converges faster the closer the argument is to 1, so using
        // ln(a^b) = b * ln(a),   ln(a) = ln(a^b) / b
        // multiply the argument by itself until the leading digits of the significand are 7, 8, 9,
        // 10, 11, 12 or 13, recording the number of multiplications so the sum of the series can
        // later be divided by this number, then separate out the power of 10 using
        // ln(a*10^b) = ln(a) + b*ln(10).

        // max n is 21 (gives 0.9, 1.0 or 1.1) (9e15 / 21 = 4.2e14).
        //while (c0 < 9 && c0 != 1 || c0 == 1 && c.charAt(1) > 1) {
        // max n is 6 (gives 0.7 - 1.3)
        while (c0 < 7 && c0 != 1 || c0 == 1 && c.charAt(1) > 3) {
          x = x.times(y);
          c = digitsToString(x.d);
          c0 = c.charAt(0);
          n++;
        }

        e = x.e;

        if (c0 > 1) {
          x = new Ctor('0.' + c);
          e++;
        } else {
          x = new Ctor(c0 + '.' + c.slice(1));
        }
      } else {

        // The argument reduction method above may result in overflow if the argument y is a massive
        // number with exponent >= 1500000000000000 (9e15 / 6 = 1.5e15), so instead recall this
        // function using ln(x*10^e) = ln(x) + e*ln(10).
        t = getLn10(Ctor, wpr + 2, pr).times(e + '');
        x = naturalLogarithm(new Ctor(c0 + '.' + c.slice(1)), wpr - guard).plus(t);
        Ctor.precision = pr;

        return sd == null ? finalise(x, pr, rm, external = true) : x;
      }

      // x1 is x reduced to a value near 1.
      x1 = x;

      // Taylor series.
      // ln(y) = ln((1 + x)/(1 - x)) = 2(x + x^3/3 + x^5/5 + x^7/7 + ...)
      // where x = (y - 1)/(y + 1)    (|x| < 1)
      sum = numerator = x = divide(x.minus(1), x.plus(1), wpr, 1);
      x2 = finalise(x.times(x), wpr, 1);
      denominator = 3;

      for (;;) {
        numerator = finalise(numerator.times(x2), wpr, 1);
        t = sum.plus(divide(numerator, new Ctor(denominator), wpr, 1));

        if (digitsToString(t.d).slice(0, wpr) === digitsToString(sum.d).slice(0, wpr)) {
          sum = sum.times(2);

          // Reverse the argument reduction. Check that e is not 0 because, besides preventing an
          // unnecessary calculation, -0 + 0 = +0 and to ensure correct rounding -0 needs to stay -0.
          if (e !== 0) sum = sum.plus(getLn10(Ctor, wpr + 2, pr).times(e + ''));
          sum = divide(sum, new Ctor(n), wpr, 1);

          // Is rm > 3 and the first 4 rounding digits 4999, or rm < 4 (or the summation has
          // been repeated previously) and the first 4 rounding digits 9999?
          // If so, restart the summation with a higher precision, otherwise
          // e.g. with precision: 12, rounding: 1
          // ln(135520028.6126091714265381533) = 18.7246299999 when it should be 18.72463.
          // `wpr - guard` is the index of first rounding digit.
          if (sd == null) {
            if (checkRoundingDigits(sum.d, wpr - guard, rm, rep)) {
              Ctor.precision = wpr += guard;
              t = numerator = x = divide(x1.minus(1), x1.plus(1), wpr, 1);
              x2 = finalise(x.times(x), wpr, 1);
              denominator = rep = 1;
            } else {
              return finalise(sum, Ctor.precision = pr, rm, external = true);
            }
          } else {
            Ctor.precision = pr;
            return sum;
          }
        }

        sum = t;
        denominator += 2;
      }
    }


    // ±Infinity, NaN.
    function nonFiniteToString(x) {
      // Unsigned.
      return String(x.s * x.s / 0);
    }


    /*
     * Parse the value of a new Decimal `x` from string `str`.
     */
    function parseDecimal(x, str) {
      var e, i, len;

      // TODO BigInt str: no need to check for decimal point, exponential form or leading zeros.
      // Decimal point?
      if ((e = str.indexOf('.')) > -1) str = str.replace('.', '');

      // Exponential form?
      if ((i = str.search(/e/i)) > 0) {

        // Determine exponent.
        if (e < 0) e = i;
        e += +str.slice(i + 1);
        str = str.substring(0, i);
      } else if (e < 0) {

        // Integer.
        e = str.length;
      }

      // Determine leading zeros.
      for (i = 0; str.charCodeAt(i) === 48; i++);

      // Determine trailing zeros.
      for (len = str.length; str.charCodeAt(len - 1) === 48; --len);
      str = str.slice(i, len);

      if (str) {
        len -= i;
        x.e = e = e - i - 1;
        x.d = [];

        // Transform base

        // e is the base 10 exponent.
        // i is where to slice str to get the first word of the digits array.
        i = (e + 1) % LOG_BASE;
        if (e < 0) i += LOG_BASE;

        if (i < len) {
          if (i) x.d.push(+str.slice(0, i));
          for (len -= LOG_BASE; i < len;) x.d.push(+str.slice(i, i += LOG_BASE));
          str = str.slice(i);
          i = LOG_BASE - str.length;
        } else {
          i -= len;
        }

        for (; i--;) str += '0';
        x.d.push(+str);

        if (external) {

          // Overflow?
          if (x.e > x.constructor.maxE) {

            // Infinity.
            x.d = null;
            x.e = NaN;

          // Underflow?
          } else if (x.e < x.constructor.minE) {

            // Zero.
            x.e = 0;
            x.d = [0];
            // x.constructor.underflow = true;
          } // else x.constructor.underflow = false;
        }
      } else {

        // Zero.
        x.e = 0;
        x.d = [0];
      }

      return x;
    }


    /*
     * Parse the value of a new Decimal `x` from a string `str`, which is not a decimal value.
     */
    function parseOther(x, str) {
      var base, Ctor, divisor, i, isFloat, len, p, xd, xe;

      if (str.indexOf('_') > -1) {
        str = str.replace(/(\d)_(?=\d)/g, '$1');
        if (isDecimal.test(str)) return parseDecimal(x, str);
      } else if (str === 'Infinity' || str === 'NaN') {
        if (!+str) x.s = NaN;
        x.e = NaN;
        x.d = null;
        return x;
      }

      if (isHex.test(str))  {
        base = 16;
        str = str.toLowerCase();
      } else if (isBinary.test(str))  {
        base = 2;
      } else if (isOctal.test(str))  {
        base = 8;
      } else {
        throw Error(invalidArgument + str);
      }

      // Is there a binary exponent part?
      i = str.search(/p/i);

      if (i > 0) {
        p = +str.slice(i + 1);
        str = str.substring(2, i);
      } else {
        str = str.slice(2);
      }

      // Convert `str` as an integer then divide the result by `base` raised to a power such that the
      // fraction part will be restored.
      i = str.indexOf('.');
      isFloat = i >= 0;
      Ctor = x.constructor;

      if (isFloat) {
        str = str.replace('.', '');
        len = str.length;
        i = len - i;

        // log[10](16) = 1.2041... , log[10](88) = 1.9444....
        divisor = intPow(Ctor, new Ctor(base), i, i * 2);
      }

      xd = convertBase(str, base, BASE);
      xe = xd.length - 1;

      // Remove trailing zeros.
      for (i = xe; xd[i] === 0; --i) xd.pop();
      if (i < 0) return new Ctor(x.s * 0);
      x.e = getBase10Exponent(xd, xe);
      x.d = xd;
      external = false;

      // At what precision to perform the division to ensure exact conversion?
      // maxDecimalIntegerPartDigitCount = ceil(log[10](b) * otherBaseIntegerPartDigitCount)
      // log[10](2) = 0.30103, log[10](8) = 0.90309, log[10](16) = 1.20412
      // E.g. ceil(1.2 * 3) = 4, so up to 4 decimal digits are needed to represent 3 hex int digits.
      // maxDecimalFractionPartDigitCount = {Hex:4|Oct:3|Bin:1} * otherBaseFractionPartDigitCount
      // Therefore using 4 * the number of digits of str will always be enough.
      if (isFloat) x = divide(x, divisor, len * 4);

      // Multiply by the binary exponent part if present.
      if (p) x = x.times(Math.abs(p) < 54 ? mathpow(2, p) : Decimal.pow(2, p));
      external = true;

      return x;
    }


    /*
     * sin(x) = x - x^3/3! + x^5/5! - ...
     * |x| < pi/2
     *
     */
    function sine(Ctor, x) {
      var k,
        len = x.d.length;

      if (len < 3) {
        return x.isZero() ? x : taylorSeries(Ctor, 2, x, x);
      }

      // Argument reduction: sin(5x) = 16*sin^5(x) - 20*sin^3(x) + 5*sin(x)
      // i.e. sin(x) = 16*sin^5(x/5) - 20*sin^3(x/5) + 5*sin(x/5)
      // and  sin(x) = sin(x/5)(5 + sin^2(x/5)(16sin^2(x/5) - 20))

      // Estimate the optimum number of times to use the argument reduction.
      k = 1.4 * Math.sqrt(len);
      k = k > 16 ? 16 : k | 0;

      x = x.times(1 / tinyPow(5, k));
      x = taylorSeries(Ctor, 2, x, x);

      // Reverse argument reduction
      var sin2_x,
        d5 = new Ctor(5),
        d16 = new Ctor(16),
        d20 = new Ctor(20);
      for (; k--;) {
        sin2_x = x.times(x);
        x = x.times(d5.plus(sin2_x.times(d16.times(sin2_x).minus(d20))));
      }

      return x;
    }


    // Calculate Taylor series for `cos`, `cosh`, `sin` and `sinh`.
    function taylorSeries(Ctor, n, x, y, isHyperbolic) {
      var j, t, u, x2,
        pr = Ctor.precision,
        k = Math.ceil(pr / LOG_BASE);

      external = false;
      x2 = x.times(x);
      u = new Ctor(y);

      for (;;) {
        t = divide(u.times(x2), new Ctor(n++ * n++), pr, 1);
        u = isHyperbolic ? y.plus(t) : y.minus(t);
        y = divide(t.times(x2), new Ctor(n++ * n++), pr, 1);
        t = u.plus(y);

        if (t.d[k] !== void 0) {
          for (j = k; t.d[j] === u.d[j] && j--;);
          if (j == -1) break;
        }

        j = u;
        u = y;
        y = t;
        t = j;
      }

      external = true;
      t.d.length = k + 1;

      return t;
    }


    // Exponent e must be positive and non-zero.
    function tinyPow(b, e) {
      var n = b;
      while (--e) n *= b;
      return n;
    }


    // Return the absolute value of `x` reduced to less than or equal to half pi.
    function toLessThanHalfPi(Ctor, x) {
      var t,
        isNeg = x.s < 0,
        pi = getPi(Ctor, Ctor.precision, 1),
        halfPi = pi.times(0.5);

      x = x.abs();

      if (x.lte(halfPi)) {
        quadrant = isNeg ? 4 : 1;
        return x;
      }

      t = x.divToInt(pi);

      if (t.isZero()) {
        quadrant = isNeg ? 3 : 2;
      } else {
        x = x.minus(t.times(pi));

        // 0 <= x < pi
        if (x.lte(halfPi)) {
          quadrant = isOdd(t) ? (isNeg ? 2 : 3) : (isNeg ? 4 : 1);
          return x;
        }

        quadrant = isOdd(t) ? (isNeg ? 1 : 4) : (isNeg ? 3 : 2);
      }

      return x.minus(pi).abs();
    }


    /*
     * Return the value of Decimal `x` as a string in base `baseOut`.
     *
     * If the optional `sd` argument is present include a binary exponent suffix.
     */
    function toStringBinary(x, baseOut, sd, rm) {
      var base, e, i, k, len, roundUp, str, xd, y,
        Ctor = x.constructor,
        isExp = sd !== void 0;

      if (isExp) {
        checkInt32(sd, 1, MAX_DIGITS);
        if (rm === void 0) rm = Ctor.rounding;
        else checkInt32(rm, 0, 8);
      } else {
        sd = Ctor.precision;
        rm = Ctor.rounding;
      }

      if (!x.isFinite()) {
        str = nonFiniteToString(x);
      } else {
        str = finiteToString(x);
        i = str.indexOf('.');

        // Use exponential notation according to `toExpPos` and `toExpNeg`? No, but if required:
        // maxBinaryExponent = floor((decimalExponent + 1) * log[2](10))
        // minBinaryExponent = floor(decimalExponent * log[2](10))
        // log[2](10) = 3.321928094887362347870319429489390175864

        if (isExp) {
          base = 2;
          if (baseOut == 16) {
            sd = sd * 4 - 3;
          } else if (baseOut == 8) {
            sd = sd * 3 - 2;
          }
        } else {
          base = baseOut;
        }

        // Convert the number as an integer then divide the result by its base raised to a power such
        // that the fraction part will be restored.

        // Non-integer.
        if (i >= 0) {
          str = str.replace('.', '');
          y = new Ctor(1);
          y.e = str.length - i;
          y.d = convertBase(finiteToString(y), 10, base);
          y.e = y.d.length;
        }

        xd = convertBase(str, 10, base);
        e = len = xd.length;

        // Remove trailing zeros.
        for (; xd[--len] == 0;) xd.pop();

        if (!xd[0]) {
          str = isExp ? '0p+0' : '0';
        } else {
          if (i < 0) {
            e--;
          } else {
            x = new Ctor(x);
            x.d = xd;
            x.e = e;
            x = divide(x, y, sd, rm, 0, base);
            xd = x.d;
            e = x.e;
            roundUp = inexact;
          }

          // The rounding digit, i.e. the digit after the digit that may be rounded up.
          i = xd[sd];
          k = base / 2;
          roundUp = roundUp || xd[sd + 1] !== void 0;

          roundUp = rm < 4
            ? (i !== void 0 || roundUp) && (rm === 0 || rm === (x.s < 0 ? 3 : 2))
            : i > k || i === k && (rm === 4 || roundUp || rm === 6 && xd[sd - 1] & 1 ||
              rm === (x.s < 0 ? 8 : 7));

          xd.length = sd;

          if (roundUp) {

            // Rounding up may mean the previous digit has to be rounded up and so on.
            for (; ++xd[--sd] > base - 1;) {
              xd[sd] = 0;
              if (!sd) {
                ++e;
                xd.unshift(1);
              }
            }
          }

          // Determine trailing zeros.
          for (len = xd.length; !xd[len - 1]; --len);

          // E.g. [4, 11, 15] becomes 4bf.
          for (i = 0, str = ''; i < len; i++) str += NUMERALS.charAt(xd[i]);

          // Add binary exponent suffix?
          if (isExp) {
            if (len > 1) {
              if (baseOut == 16 || baseOut == 8) {
                i = baseOut == 16 ? 4 : 3;
                for (--len; len % i; len++) str += '0';
                xd = convertBase(str, base, baseOut);
                for (len = xd.length; !xd[len - 1]; --len);

                // xd[0] will always be be 1
                for (i = 1, str = '1.'; i < len; i++) str += NUMERALS.charAt(xd[i]);
              } else {
                str = str.charAt(0) + '.' + str.slice(1);
              }
            }

            str =  str + (e < 0 ? 'p' : 'p+') + e;
          } else if (e < 0) {
            for (; ++e;) str = '0' + str;
            str = '0.' + str;
          } else {
            if (++e > len) for (e -= len; e-- ;) str += '0';
            else if (e < len) str = str.slice(0, e) + '.' + str.slice(e);
          }
        }

        str = (baseOut == 16 ? '0x' : baseOut == 2 ? '0b' : baseOut == 8 ? '0o' : '') + str;
      }

      return x.s < 0 ? '-' + str : str;
    }


    // Does not strip trailing zeros.
    function truncate(arr, len) {
      if (arr.length > len) {
        arr.length = len;
        return true;
      }
    }


    // Decimal methods


    /*
     *  abs
     *  acos
     *  acosh
     *  add
     *  asin
     *  asinh
     *  atan
     *  atanh
     *  atan2
     *  cbrt
     *  ceil
     *  clamp
     *  clone
     *  config
     *  cos
     *  cosh
     *  div
     *  exp
     *  floor
     *  hypot
     *  ln
     *  log
     *  log2
     *  log10
     *  max
     *  min
     *  mod
     *  mul
     *  pow
     *  random
     *  round
     *  set
     *  sign
     *  sin
     *  sinh
     *  sqrt
     *  sub
     *  sum
     *  tan
     *  tanh
     *  trunc
     */


    /*
     * Return a new Decimal whose value is the absolute value of `x`.
     *
     * x {number|string|bigint|Decimal}
     *
     */
    function abs$2(x) {
      return new this(x).abs();
    }


    /*
     * Return a new Decimal whose value is the arccosine in radians of `x`.
     *
     * x {number|string|bigint|Decimal}
     *
     */
    function acos(x) {
      return new this(x).acos();
    }


    /*
     * Return a new Decimal whose value is the inverse of the hyperbolic cosine of `x`, rounded to
     * `precision` significant digits using rounding mode `rounding`.
     *
     * x {number|string|bigint|Decimal} A value in radians.
     *
     */
    function acosh(x) {
      return new this(x).acosh();
    }


    /*
     * Return a new Decimal whose value is the sum of `x` and `y`, rounded to `precision` significant
     * digits using rounding mode `rounding`.
     *
     * x {number|string|bigint|Decimal}
     * y {number|string|bigint|Decimal}
     *
     */
    function add(x, y) {
      return new this(x).plus(y);
    }


    /*
     * Return a new Decimal whose value is the arcsine in radians of `x`, rounded to `precision`
     * significant digits using rounding mode `rounding`.
     *
     * x {number|string|bigint|Decimal}
     *
     */
    function asin(x) {
      return new this(x).asin();
    }


    /*
     * Return a new Decimal whose value is the inverse of the hyperbolic sine of `x`, rounded to
     * `precision` significant digits using rounding mode `rounding`.
     *
     * x {number|string|bigint|Decimal} A value in radians.
     *
     */
    function asinh(x) {
      return new this(x).asinh();
    }


    /*
     * Return a new Decimal whose value is the arctangent in radians of `x`, rounded to `precision`
     * significant digits using rounding mode `rounding`.
     *
     * x {number|string|bigint|Decimal}
     *
     */
    function atan(x) {
      return new this(x).atan();
    }


    /*
     * Return a new Decimal whose value is the inverse of the hyperbolic tangent of `x`, rounded to
     * `precision` significant digits using rounding mode `rounding`.
     *
     * x {number|string|bigint|Decimal} A value in radians.
     *
     */
    function atanh(x) {
      return new this(x).atanh();
    }


    /*
     * Return a new Decimal whose value is the arctangent in radians of `y/x` in the range -pi to pi
     * (inclusive), rounded to `precision` significant digits using rounding mode `rounding`.
     *
     * Domain: [-Infinity, Infinity]
     * Range: [-pi, pi]
     *
     * y {number|string|bigint|Decimal} The y-coordinate.
     * x {number|string|bigint|Decimal} The x-coordinate.
     *
     * atan2(±0, -0)               = ±pi
     * atan2(±0, +0)               = ±0
     * atan2(±0, -x)               = ±pi for x > 0
     * atan2(±0, x)                = ±0 for x > 0
     * atan2(-y, ±0)               = -pi/2 for y > 0
     * atan2(y, ±0)                = pi/2 for y > 0
     * atan2(±y, -Infinity)        = ±pi for finite y > 0
     * atan2(±y, +Infinity)        = ±0 for finite y > 0
     * atan2(±Infinity, x)         = ±pi/2 for finite x
     * atan2(±Infinity, -Infinity) = ±3*pi/4
     * atan2(±Infinity, +Infinity) = ±pi/4
     * atan2(NaN, x) = NaN
     * atan2(y, NaN) = NaN
     *
     */
    function atan2(y, x) {
      y = new this(y);
      x = new this(x);
      var r,
        pr = this.precision,
        rm = this.rounding,
        wpr = pr + 4;

      // Either NaN
      if (!y.s || !x.s) {
        r = new this(NaN);

      // Both ±Infinity
      } else if (!y.d && !x.d) {
        r = getPi(this, wpr, 1).times(x.s > 0 ? 0.25 : 0.75);
        r.s = y.s;

      // x is ±Infinity or y is ±0
      } else if (!x.d || y.isZero()) {
        r = x.s < 0 ? getPi(this, pr, rm) : new this(0);
        r.s = y.s;

      // y is ±Infinity or x is ±0
      } else if (!y.d || x.isZero()) {
        r = getPi(this, wpr, 1).times(0.5);
        r.s = y.s;

      // Both non-zero and finite
      } else if (x.s < 0) {
        this.precision = wpr;
        this.rounding = 1;
        r = this.atan(divide(y, x, wpr, 1));
        x = getPi(this, wpr, 1);
        this.precision = pr;
        this.rounding = rm;
        r = y.s < 0 ? r.minus(x) : r.plus(x);
      } else {
        r = this.atan(divide(y, x, wpr, 1));
      }

      return r;
    }


    /*
     * Return a new Decimal whose value is the cube root of `x`, rounded to `precision` significant
     * digits using rounding mode `rounding`.
     *
     * x {number|string|bigint|Decimal}
     *
     */
    function cbrt(x) {
      return new this(x).cbrt();
    }


    /*
     * Return a new Decimal whose value is `x` rounded to an integer using `ROUND_CEIL`.
     *
     * x {number|string|bigint|Decimal}
     *
     */
    function ceil(x) {
      return finalise(x = new this(x), x.e + 1, 2);
    }


    /*
     * Return a new Decimal whose value is `x` clamped to the range delineated by `min` and `max`.
     *
     * x {number|string|bigint|Decimal}
     * min {number|string|bigint|Decimal}
     * max {number|string|bigint|Decimal}
     *
     */
    function clamp(x, min, max) {
      return new this(x).clamp(min, max);
    }


    /*
     * Configure global settings for a Decimal constructor.
     *
     * `obj` is an object with one or more of the following properties,
     *
     *   precision  {number}
     *   rounding   {number}
     *   toExpNeg   {number}
     *   toExpPos   {number}
     *   maxE       {number}
     *   minE       {number}
     *   modulo     {number}
     *   crypto     {boolean|number}
     *   defaults   {true}
     *
     * E.g. Decimal.config({ precision: 20, rounding: 4 })
     *
     */
    function config(obj) {
      if (!obj || typeof obj !== 'object') throw Error(decimalError + 'Object expected');
      var i, p, v,
        useDefaults = obj.defaults === true,
        ps = [
          'precision', 1, MAX_DIGITS,
          'rounding', 0, 8,
          'toExpNeg', -9e15, 0,
          'toExpPos', 0, EXP_LIMIT,
          'maxE', 0, EXP_LIMIT,
          'minE', -9e15, 0,
          'modulo', 0, 9
        ];

      for (i = 0; i < ps.length; i += 3) {
        if (p = ps[i], useDefaults) this[p] = DEFAULTS[p];
        if ((v = obj[p]) !== void 0) {
          if (mathfloor(v) === v && v >= ps[i + 1] && v <= ps[i + 2]) this[p] = v;
          else throw Error(invalidArgument + p + ': ' + v);
        }
      }

      if (p = 'crypto', useDefaults) this[p] = DEFAULTS[p];
      if ((v = obj[p]) !== void 0) {
        if (v === true || v === false || v === 0 || v === 1) {
          if (v) {
            if (typeof crypto != 'undefined' && crypto &&
              (crypto.getRandomValues || crypto.randomBytes)) {
              this[p] = true;
            } else {
              throw Error(cryptoUnavailable);
            }
          } else {
            this[p] = false;
          }
        } else {
          throw Error(invalidArgument + p + ': ' + v);
        }
      }

      return this;
    }


    /*
     * Return a new Decimal whose value is the cosine of `x`, rounded to `precision` significant
     * digits using rounding mode `rounding`.
     *
     * x {number|string|bigint|Decimal} A value in radians.
     *
     */
    function cos(x) {
      return new this(x).cos();
    }


    /*
     * Return a new Decimal whose value is the hyperbolic cosine of `x`, rounded to precision
     * significant digits using rounding mode `rounding`.
     *
     * x {number|string|bigint|Decimal} A value in radians.
     *
     */
    function cosh$1(x) {
      return new this(x).cosh();
    }


    /*
     * Create and return a Decimal constructor with the same configuration properties as this Decimal
     * constructor.
     *
     */
    function clone$1(obj) {
      var i, p, ps;

      /*
       * The Decimal constructor and exported function.
       * Return a new Decimal instance.
       *
       * v {number|string|bigint|Decimal} A numeric value.
       *
       */
      function Decimal(v) {
        var e, i, t,
          x = this;

        // Decimal called without new.
        if (!(x instanceof Decimal)) return new Decimal(v);

        // Retain a reference to this Decimal constructor, and shadow Decimal.prototype.constructor
        // which points to Object.
        x.constructor = Decimal;

        if (isDecimalInstance(v)) {
          x.s = v.s;

          if (external) {
            if (!v.d || v.e > Decimal.maxE) {

              // Infinity.
              x.e = NaN;
              x.d = null;
            } else if (v.e < Decimal.minE) {

              // Zero.
              x.e = 0;
              x.d = [0];
            } else {
              x.e = v.e;
              x.d = v.d.slice();
            }
          } else {
            x.e = v.e;
            x.d = v.d ? v.d.slice() : v.d;
          }

          return;
        }

        t = typeof v;

        if (t === 'number') {
          if (v === 0) {
            x.s = 1 / v < 0 ? -1 : 1;
            x.e = 0;
            x.d = [0];
            return;
          }

          if (v < 0) {
            v = -v;
            x.s = -1;
          } else {
            x.s = 1;
          }

          // Fast path for small integers.
          if (v === ~~v && v < 1e7) {
            for (e = 0, i = v; i >= 10; i /= 10) e++;

            if (external) {
              if (e > Decimal.maxE) {
                x.e = NaN;
                x.d = null;
              } else if (e < Decimal.minE) {
                x.e = 0;
                x.d = [0];
              } else {
                x.e = e;
                x.d = [v];
              }
            } else {
              x.e = e;
              x.d = [v];
            }

            return;
          }

          // Infinity or NaN?
          if (v * 0 !== 0) {
            if (!v) x.s = NaN;
            x.e = NaN;
            x.d = null;
            return;
          }

          return parseDecimal(x, v.toString());
        }

        if (t === 'string') {
          if ((i = v.charCodeAt(0)) === 45) {  // minus sign
            v = v.slice(1);
            x.s = -1;
          } else {
            if (i === 43) v = v.slice(1);  // plus sign
            x.s = 1;
          }

          return isDecimal.test(v) ? parseDecimal(x, v) : parseOther(x, v);
        }

        if (t === 'bigint') {
          if (v < 0) {
            v = -v;
            x.s = -1;
          } else {
            x.s = 1;
          }

          return parseDecimal(x, v.toString());
        }

        throw Error(invalidArgument + v);
      }

      Decimal.prototype = P$3;

      Decimal.ROUND_UP = 0;
      Decimal.ROUND_DOWN = 1;
      Decimal.ROUND_CEIL = 2;
      Decimal.ROUND_FLOOR = 3;
      Decimal.ROUND_HALF_UP = 4;
      Decimal.ROUND_HALF_DOWN = 5;
      Decimal.ROUND_HALF_EVEN = 6;
      Decimal.ROUND_HALF_CEIL = 7;
      Decimal.ROUND_HALF_FLOOR = 8;
      Decimal.EUCLID = 9;

      Decimal.config = Decimal.set = config;
      Decimal.clone = clone$1;
      Decimal.isDecimal = isDecimalInstance;

      Decimal.abs = abs$2;
      Decimal.acos = acos;
      Decimal.acosh = acosh;        // ES6
      Decimal.add = add;
      Decimal.asin = asin;
      Decimal.asinh = asinh;        // ES6
      Decimal.atan = atan;
      Decimal.atanh = atanh;        // ES6
      Decimal.atan2 = atan2;
      Decimal.cbrt = cbrt;          // ES6
      Decimal.ceil = ceil;
      Decimal.clamp = clamp;
      Decimal.cos = cos;
      Decimal.cosh = cosh$1;          // ES6
      Decimal.div = div;
      Decimal.exp = exp;
      Decimal.floor = floor;
      Decimal.hypot = hypot$1;        // ES6
      Decimal.ln = ln;
      Decimal.log = log;
      Decimal.log10 = log10;        // ES6
      Decimal.log2 = log2;          // ES6
      Decimal.max = max$1;
      Decimal.min = min$1;
      Decimal.mod = mod$1;
      Decimal.mul = mul;
      Decimal.pow = pow$1;
      Decimal.random = random;
      Decimal.round = round$1;
      Decimal.sign = sign;          // ES6
      Decimal.sin = sin;
      Decimal.sinh = sinh$1;          // ES6
      Decimal.sqrt = sqrt;
      Decimal.sub = sub;
      Decimal.sum = sum;
      Decimal.tan = tan;
      Decimal.tanh = tanh;          // ES6
      Decimal.trunc = trunc$1;        // ES6

      if (obj === void 0) obj = {};
      if (obj) {
        if (obj.defaults !== true) {
          ps = ['precision', 'rounding', 'toExpNeg', 'toExpPos', 'maxE', 'minE', 'modulo', 'crypto'];
          for (i = 0; i < ps.length;) if (!obj.hasOwnProperty(p = ps[i++])) obj[p] = this[p];
        }
      }

      Decimal.config(obj);

      return Decimal;
    }


    /*
     * Return a new Decimal whose value is `x` divided by `y`, rounded to `precision` significant
     * digits using rounding mode `rounding`.
     *
     * x {number|string|bigint|Decimal}
     * y {number|string|bigint|Decimal}
     *
     */
    function div(x, y) {
      return new this(x).div(y);
    }


    /*
     * Return a new Decimal whose value is the natural exponential of `x`, rounded to `precision`
     * significant digits using rounding mode `rounding`.
     *
     * x {number|string|bigint|Decimal} The power to which to raise the base of the natural log.
     *
     */
    function exp(x) {
      return new this(x).exp();
    }


    /*
     * Return a new Decimal whose value is `x` round to an integer using `ROUND_FLOOR`.
     *
     * x {number|string|bigint|Decimal}
     *
     */
    function floor(x) {
      return finalise(x = new this(x), x.e + 1, 3);
    }


    /*
     * Return a new Decimal whose value is the square root of the sum of the squares of the arguments,
     * rounded to `precision` significant digits using rounding mode `rounding`.
     *
     * hypot(a, b, ...) = sqrt(a^2 + b^2 + ...)
     *
     * arguments {number|string|bigint|Decimal}
     *
     */
    function hypot$1() {
      var i, n,
        t = new this(0);

      external = false;

      for (i = 0; i < arguments.length;) {
        n = new this(arguments[i++]);
        if (!n.d) {
          if (n.s) {
            external = true;
            return new this(1 / 0);
          }
          t = n;
        } else if (t.d) {
          t = t.plus(n.times(n));
        }
      }

      external = true;

      return t.sqrt();
    }


    /*
     * Return true if object is a Decimal instance (where Decimal is any Decimal constructor),
     * otherwise return false.
     *
     */
    function isDecimalInstance(obj) {
      return obj instanceof Decimal || obj && obj.toStringTag === tag || false;
    }


    /*
     * Return a new Decimal whose value is the natural logarithm of `x`, rounded to `precision`
     * significant digits using rounding mode `rounding`.
     *
     * x {number|string|bigint|Decimal}
     *
     */
    function ln(x) {
      return new this(x).ln();
    }


    /*
     * Return a new Decimal whose value is the log of `x` to the base `y`, or to base 10 if no base
     * is specified, rounded to `precision` significant digits using rounding mode `rounding`.
     *
     * log[y](x)
     *
     * x {number|string|bigint|Decimal} The argument of the logarithm.
     * y {number|string|bigint|Decimal} The base of the logarithm.
     *
     */
    function log(x, y) {
      return new this(x).log(y);
    }


    /*
     * Return a new Decimal whose value is the base 2 logarithm of `x`, rounded to `precision`
     * significant digits using rounding mode `rounding`.
     *
     * x {number|string|bigint|Decimal}
     *
     */
    function log2(x) {
      return new this(x).log(2);
    }


    /*
     * Return a new Decimal whose value is the base 10 logarithm of `x`, rounded to `precision`
     * significant digits using rounding mode `rounding`.
     *
     * x {number|string|bigint|Decimal}
     *
     */
    function log10(x) {
      return new this(x).log(10);
    }


    /*
     * Return a new Decimal whose value is the maximum of the arguments.
     *
     * arguments {number|string|bigint|Decimal}
     *
     */
    function max$1() {
      return maxOrMin(this, arguments, -1);
    }


    /*
     * Return a new Decimal whose value is the minimum of the arguments.
     *
     * arguments {number|string|bigint|Decimal}
     *
     */
    function min$1() {
      return maxOrMin(this, arguments, 1);
    }


    /*
     * Return a new Decimal whose value is `x` modulo `y`, rounded to `precision` significant digits
     * using rounding mode `rounding`.
     *
     * x {number|string|bigint|Decimal}
     * y {number|string|bigint|Decimal}
     *
     */
    function mod$1(x, y) {
      return new this(x).mod(y);
    }


    /*
     * Return a new Decimal whose value is `x` multiplied by `y`, rounded to `precision` significant
     * digits using rounding mode `rounding`.
     *
     * x {number|string|bigint|Decimal}
     * y {number|string|bigint|Decimal}
     *
     */
    function mul(x, y) {
      return new this(x).mul(y);
    }


    /*
     * Return a new Decimal whose value is `x` raised to the power `y`, rounded to precision
     * significant digits using rounding mode `rounding`.
     *
     * x {number|string|bigint|Decimal} The base.
     * y {number|string|bigint|Decimal} The exponent.
     *
     */
    function pow$1(x, y) {
      return new this(x).pow(y);
    }


    /*
     * Returns a new Decimal with a random value equal to or greater than 0 and less than 1, and with
     * `sd`, or `Decimal.precision` if `sd` is omitted, significant digits (or less if trailing zeros
     * are produced).
     *
     * [sd] {number} Significant digits. Integer, 0 to MAX_DIGITS inclusive.
     *
     */
    function random(sd) {
      var d, e, k, n,
        i = 0,
        r = new this(1),
        rd = [];

      if (sd === void 0) sd = this.precision;
      else checkInt32(sd, 1, MAX_DIGITS);

      k = Math.ceil(sd / LOG_BASE);

      if (!this.crypto) {
        for (; i < k;) rd[i++] = Math.random() * 1e7 | 0;

      // Browsers supporting crypto.getRandomValues.
      } else if (crypto.getRandomValues) {
        d = crypto.getRandomValues(new Uint32Array(k));

        for (; i < k;) {
          n = d[i];

          // 0 <= n < 4294967296
          // Probability n >= 4.29e9, is 4967296 / 4294967296 = 0.00116 (1 in 865).
          if (n >= 4.29e9) {
            d[i] = crypto.getRandomValues(new Uint32Array(1))[0];
          } else {

            // 0 <= n <= 4289999999
            // 0 <= (n % 1e7) <= 9999999
            rd[i++] = n % 1e7;
          }
        }

      // Node.js supporting crypto.randomBytes.
      } else if (crypto.randomBytes) {

        // buffer
        d = crypto.randomBytes(k *= 4);

        for (; i < k;) {

          // 0 <= n < 2147483648
          n = d[i] + (d[i + 1] << 8) + (d[i + 2] << 16) + ((d[i + 3] & 0x7f) << 24);

          // Probability n >= 2.14e9, is 7483648 / 2147483648 = 0.0035 (1 in 286).
          if (n >= 2.14e9) {
            crypto.randomBytes(4).copy(d, i);
          } else {

            // 0 <= n <= 2139999999
            // 0 <= (n % 1e7) <= 9999999
            rd.push(n % 1e7);
            i += 4;
          }
        }

        i = k / 4;
      } else {
        throw Error(cryptoUnavailable);
      }

      k = rd[--i];
      sd %= LOG_BASE;

      // Convert trailing digits to zeros according to sd.
      if (k && sd) {
        n = mathpow(10, LOG_BASE - sd);
        rd[i] = (k / n | 0) * n;
      }

      // Remove trailing words which are zero.
      for (; rd[i] === 0; i--) rd.pop();

      // Zero?
      if (i < 0) {
        e = 0;
        rd = [0];
      } else {
        e = -1;

        // Remove leading words which are zero and adjust exponent accordingly.
        for (; rd[0] === 0; e -= LOG_BASE) rd.shift();

        // Count the digits of the first word of rd to determine leading zeros.
        for (k = 1, n = rd[0]; n >= 10; n /= 10) k++;

        // Adjust the exponent for leading zeros of the first word of rd.
        if (k < LOG_BASE) e -= LOG_BASE - k;
      }

      r.e = e;
      r.d = rd;

      return r;
    }


    /*
     * Return a new Decimal whose value is `x` rounded to an integer using rounding mode `rounding`.
     *
     * To emulate `Math.round`, set rounding to 7 (ROUND_HALF_CEIL).
     *
     * x {number|string|bigint|Decimal}
     *
     */
    function round$1(x) {
      return finalise(x = new this(x), x.e + 1, this.rounding);
    }


    /*
     * Return
     *   1    if x > 0,
     *  -1    if x < 0,
     *   0    if x is 0,
     *  -0    if x is -0,
     *   NaN  otherwise
     *
     * x {number|string|bigint|Decimal}
     *
     */
    function sign(x) {
      x = new this(x);
      return x.d ? (x.d[0] ? x.s : 0 * x.s) : x.s || NaN;
    }


    /*
     * Return a new Decimal whose value is the sine of `x`, rounded to `precision` significant digits
     * using rounding mode `rounding`.
     *
     * x {number|string|bigint|Decimal} A value in radians.
     *
     */
    function sin(x) {
      return new this(x).sin();
    }


    /*
     * Return a new Decimal whose value is the hyperbolic sine of `x`, rounded to `precision`
     * significant digits using rounding mode `rounding`.
     *
     * x {number|string|bigint|Decimal} A value in radians.
     *
     */
    function sinh$1(x) {
      return new this(x).sinh();
    }


    /*
     * Return a new Decimal whose value is the square root of `x`, rounded to `precision` significant
     * digits using rounding mode `rounding`.
     *
     * x {number|string|bigint|Decimal}
     *
     */
    function sqrt(x) {
      return new this(x).sqrt();
    }


    /*
     * Return a new Decimal whose value is `x` minus `y`, rounded to `precision` significant digits
     * using rounding mode `rounding`.
     *
     * x {number|string|bigint|Decimal}
     * y {number|string|bigint|Decimal}
     *
     */
    function sub(x, y) {
      return new this(x).sub(y);
    }


    /*
     * Return a new Decimal whose value is the sum of the arguments, rounded to `precision`
     * significant digits using rounding mode `rounding`.
     *
     * Only the result is rounded, not the intermediate calculations.
     *
     * arguments {number|string|bigint|Decimal}
     *
     */
    function sum() {
      var i = 0,
        args = arguments,
        x = new this(args[i]);

      external = false;
      for (; x.s && ++i < args.length;) x = x.plus(args[i]);
      external = true;

      return finalise(x, this.precision, this.rounding);
    }


    /*
     * Return a new Decimal whose value is the tangent of `x`, rounded to `precision` significant
     * digits using rounding mode `rounding`.
     *
     * x {number|string|bigint|Decimal} A value in radians.
     *
     */
    function tan(x) {
      return new this(x).tan();
    }


    /*
     * Return a new Decimal whose value is the hyperbolic tangent of `x`, rounded to `precision`
     * significant digits using rounding mode `rounding`.
     *
     * x {number|string|bigint|Decimal} A value in radians.
     *
     */
    function tanh(x) {
      return new this(x).tanh();
    }


    /*
     * Return a new Decimal whose value is `x` truncated to an integer.
     *
     * x {number|string|bigint|Decimal}
     *
     */
    function trunc$1(x) {
      return finalise(x = new this(x), x.e + 1, 1);
    }


    P$3[Symbol.for('nodejs.util.inspect.custom')] = P$3.toString;
    P$3[Symbol.toStringTag] = 'Decimal';

    // Create and configure initial Decimal constructor.
    var Decimal = P$3.constructor = clone$1(DEFAULTS);

    // Create the internal constants from their string values.
    LN10 = new Decimal(LN10);
    PI = new Decimal(PI);

    var name$v = 'BigNumber';
    var dependencies$v = ['?on', 'config'];
    var createBigNumberClass = /* #__PURE__ */factory(name$v, dependencies$v, _ref => {
      var {
        on,
        config
      } = _ref;
      var BigNumber = Decimal.clone({
        precision: config.precision,
        modulo: Decimal.EUCLID
      });
      BigNumber.prototype = Object.create(BigNumber.prototype);

      /**
       * Attach type information
       */
      BigNumber.prototype.type = 'BigNumber';
      BigNumber.prototype.isBigNumber = true;

      /**
       * Get a JSON representation of a BigNumber containing
       * type information
       * @returns {Object} Returns a JSON object structured as:
       *                   `{"mathjs": "BigNumber", "value": "0.2"}`
       */
      BigNumber.prototype.toJSON = function () {
        return {
          mathjs: 'BigNumber',
          value: this.toString()
        };
      };

      /**
       * Instantiate a BigNumber from a JSON object
       * @param {Object} json  a JSON object structured as:
       *                       `{"mathjs": "BigNumber", "value": "0.2"}`
       * @return {BigNumber}
       */
      BigNumber.fromJSON = function (json) {
        return new BigNumber(json.value);
      };
      if (on) {
        // listen for changed in the configuration, automatically apply changed precision
        on('config', function (curr, prev) {
          if (curr.precision !== prev.precision) {
            BigNumber.config({
              precision: curr.precision
            });
          }
        });
      }
      return BigNumber;
    }, {
      isClass: true
    });

    /**
     *
     * This class allows the manipulation of complex numbers.
     * You can pass a complex number in different formats. Either as object, double, string or two integer parameters.
     *
     * Object form
     * { re: <real>, im: <imaginary> }
     * { arg: <angle>, abs: <radius> }
     * { phi: <angle>, r: <radius> }
     *
     * Array / Vector form
     * [ real, imaginary ]
     *
     * Double form
     * 99.3 - Single double value
     *
     * String form
     * '23.1337' - Simple real number
     * '15+3i' - a simple complex number
     * '3-i' - a simple complex number
     *
     * Example:
     *
     * const c = new Complex('99.3+8i');
     * c.mul({r: 3, i: 9}).div(4.9).sub(3, 2);
     *
     */


    const cosh = Math.cosh || function (x) {
      return Math.abs(x) < 1e-9 ? 1 - x : (Math.exp(x) + Math.exp(-x)) * 0.5;
    };

    const sinh = Math.sinh || function (x) {
      return Math.abs(x) < 1e-9 ? x : (Math.exp(x) - Math.exp(-x)) * 0.5;
    };

    /**
     * Calculates cos(x) - 1 using Taylor series if x is small (-¼π ≤ x ≤ ¼π).
     *
     * @param {number} x
     * @returns {number} cos(x) - 1
     */
    const cosm1 = function (x) {

      const b = Math.PI / 4;
      if (-b > x || x > b) {
        return Math.cos(x) - 1.0;
      }

      /* Calculate horner form of polynomial of taylor series in Q
      let fac = 1, alt = 1, pol = {};
      for (let i = 0; i <= 16; i++) {
        fac*= i || 1;
        if (i % 2 == 0) {
          pol[i] = new Fraction(1, alt * fac);
          alt = -alt;
        }
      }
      console.log(new Polynomial(pol).toHorner()); // (((((((1/20922789888000x^2-1/87178291200)x^2+1/479001600)x^2-1/3628800)x^2+1/40320)x^2-1/720)x^2+1/24)x^2-1/2)x^2+1
      */

      const xx = x * x;
      return xx * (
        xx * (
          xx * (
            xx * (
              xx * (
                xx * (
                  xx * (
                    xx / 20922789888000
                    - 1 / 87178291200)
                  + 1 / 479001600)
                - 1 / 3628800)
              + 1 / 40320)
            - 1 / 720)
          + 1 / 24)
        - 1 / 2);
    };

    const hypot = function (x, y) {

      x = Math.abs(x);
      y = Math.abs(y);

      // Ensure `x` is the larger value
      if (x < y) [x, y] = [y, x];

      // If both are below the threshold, use straightforward Pythagoras
      if (x < 1e8) return Math.sqrt(x * x + y * y);

      // For larger values, scale to avoid overflow
      y /= x;
      return x * Math.sqrt(1 + y * y);
    };

    const parser_exit = function () {
      throw SyntaxError('Invalid Param');
    };

    /**
     * Calculates log(sqrt(a^2+b^2)) in a way to avoid overflows
     *
     * @param {number} a
     * @param {number} b
     * @returns {number}
     */
    function logHypot(a, b) {

      const _a = Math.abs(a);
      const _b = Math.abs(b);

      if (a === 0) {
        return Math.log(_b);
      }

      if (b === 0) {
        return Math.log(_a);
      }

      if (_a < 3000 && _b < 3000) {
        return Math.log(a * a + b * b) * 0.5;
      }

      /* I got 4 ideas to compute this property without overflow:
       *
       * Testing 1000000 times with random samples for a,b ∈ [1, 1000000000] against a big decimal library to get an error estimate
       *
       * 1. Only eliminate the square root: (OVERALL ERROR: 3.9122483030951116e-11)

       Math.log(a * a + b * b) / 2

       *
       *
       * 2. Try to use the non-overflowing pythagoras: (OVERALL ERROR: 8.889760039210159e-10)

       const fn = function(a, b) {
       a = Math.abs(a);
       b = Math.abs(b);
       let t = Math.min(a, b);
       a = Math.max(a, b);
       t = t / a;

       return Math.log(a) + Math.log(1 + t * t) / 2;
       };

       * 3. Abuse the identity cos(atan(y/x) = x / sqrt(x^2+y^2): (OVERALL ERROR: 3.4780178737037204e-10)

       Math.log(a / Math.cos(Math.atan2(b, a)))

       * 4. Use 3. and apply log rules: (OVERALL ERROR: 1.2014087502620896e-9)

       Math.log(a) - Math.log(Math.cos(Math.atan2(b, a)))

       */

      a = a * 0.5;
      b = b * 0.5;

      return 0.5 * Math.log(a * a + b * b) + Math.LN2;
    }

    const P$2 = { 're': 0, 'im': 0 };
    const parse$1 = function (a, b) {

      const z = P$2;

      if (a === undefined || a === null) {
        z['re'] =
          z['im'] = 0;
      } else if (b !== undefined) {
        z['re'] = a;
        z['im'] = b;
      } else
        switch (typeof a) {

          case 'object':

            if ('im' in a && 're' in a) {
              z['re'] = a['re'];
              z['im'] = a['im'];
            } else if ('abs' in a && 'arg' in a) {
              if (!isFinite(a['abs']) && isFinite(a['arg'])) {
                return Complex$1['INFINITY'];
              }
              z['re'] = a['abs'] * Math.cos(a['arg']);
              z['im'] = a['abs'] * Math.sin(a['arg']);
            } else if ('r' in a && 'phi' in a) {
              if (!isFinite(a['r']) && isFinite(a['phi'])) {
                return Complex$1['INFINITY'];
              }
              z['re'] = a['r'] * Math.cos(a['phi']);
              z['im'] = a['r'] * Math.sin(a['phi']);
            } else if (a.length === 2) { // Quick array check
              z['re'] = a[0];
              z['im'] = a[1];
            } else {
              parser_exit();
            }
            break;

          case 'string':

            z['im'] = /* void */
            z['re'] = 0;

            const tokens = a.replace(/_/g, '')
              .match(/\d+\.?\d*e[+-]?\d+|\d+\.?\d*|\.\d+|./g);
            let plus = 1;
            let minus = 0;

            if (tokens === null) {
              parser_exit();
            }

            for (let i = 0; i < tokens.length; i++) {

              const c = tokens[i];

              if (c === ' ' || c === '\t' || c === '\n') ; else if (c === '+') {
                plus++;
              } else if (c === '-') {
                minus++;
              } else if (c === 'i' || c === 'I') {

                if (plus + minus === 0) {
                  parser_exit();
                }

                if (tokens[i + 1] !== ' ' && !isNaN(tokens[i + 1])) {
                  z['im'] += parseFloat((minus % 2 ? '-' : '') + tokens[i + 1]);
                  i++;
                } else {
                  z['im'] += parseFloat((minus % 2 ? '-' : '') + '1');
                }
                plus = minus = 0;

              } else {

                if (plus + minus === 0 || isNaN(c)) {
                  parser_exit();
                }

                if (tokens[i + 1] === 'i' || tokens[i + 1] === 'I') {
                  z['im'] += parseFloat((minus % 2 ? '-' : '') + c);
                  i++;
                } else {
                  z['re'] += parseFloat((minus % 2 ? '-' : '') + c);
                }
                plus = minus = 0;
              }
            }

            // Still something on the stack
            if (plus + minus > 0) {
              parser_exit();
            }
            break;

          case 'number':
            z['im'] = 0;
            z['re'] = a;
            break;

          default:
            parser_exit();
        }

      if (isNaN(z['re']) || isNaN(z['im'])) ;

      return z;
    };

    /**
     * @constructor
     * @returns {Complex}
     */
    function Complex$1(a, b) {

      if (!(this instanceof Complex$1)) {
        return new Complex$1(a, b);
      }

      const z = parse$1(a, b);

      this['re'] = z['re'];
      this['im'] = z['im'];
    }

    Complex$1.prototype = {

      're': 0,
      'im': 0,

      /**
       * Calculates the sign of a complex number, which is a normalized complex
       *
       * @returns {Complex}
       */
      'sign': function () {

        const abs = hypot(this['re'], this['im']);

        return new Complex$1(
          this['re'] / abs,
          this['im'] / abs);
      },

      /**
       * Adds two complex numbers
       *
       * @returns {Complex}
       */
      'add': function (a, b) {

        const z = parse$1(a, b);

        const tInfin = this['isInfinite']();
        const zInfin = !(isFinite(z['re']) && isFinite(z['im']));

        if (tInfin || zInfin) {

          if (tInfin && zInfin) {
            // Infinity + Infinity = NaN
            return Complex$1['NAN'];
          }
          // Infinity + z = Infinity { where z != Infinity }
          return Complex$1['INFINITY'];
        }

        return new Complex$1(
          this['re'] + z['re'],
          this['im'] + z['im']);
      },

      /**
       * Subtracts two complex numbers
       *
       * @returns {Complex}
       */
      'sub': function (a, b) {

        const z = parse$1(a, b);

        const tInfin = this['isInfinite']();
        const zInfin = !(isFinite(z['re']) && isFinite(z['im']));

        if (tInfin || zInfin) {

          if (tInfin && zInfin) {
            // Infinity - Infinity = NaN
            return Complex$1['NAN'];
          }
          // Infinity - z = Infinity { where z != Infinity }
          return Complex$1['INFINITY'];
        }

        return new Complex$1(
          this['re'] - z['re'],
          this['im'] - z['im']);
      },

      /**
       * Multiplies two complex numbers
       *
       * @returns {Complex}
       */
      'mul': function (a, b) {

        const z = parse$1(a, b);

        const tInfin = this['isInfinite']();
        const zInfin = !(isFinite(z['re']) && isFinite(z['im']));
        const tIsZero = this['re'] === 0 && this['im'] === 0;
        const zIsZero = z['re'] === 0 && z['im'] === 0;

        // Infinity * 0 = NaN
        if (tInfin && zIsZero || zInfin && tIsZero) {
          return Complex$1['NAN'];
        }

        // Infinity * z = Infinity { where z != 0 }
        if (tInfin || zInfin) {
          return Complex$1['INFINITY'];
        }

        // Shortcut for real values
        if (z['im'] === 0 && this['im'] === 0) {
          return new Complex$1(this['re'] * z['re'], 0);
        }

        return new Complex$1(
          this['re'] * z['re'] - this['im'] * z['im'],
          this['re'] * z['im'] + this['im'] * z['re']);
      },

      /**
       * Divides two complex numbers
       *
       * @returns {Complex}
       */
      'div': function (a, b) {

        const z = parse$1(a, b);

        const tInfin = this['isInfinite']();
        const zInfin = !(isFinite(z['re']) && isFinite(z['im']));
        const tIsZero = this['re'] === 0 && this['im'] === 0;
        const zIsZero = z['re'] === 0 && z['im'] === 0;

        // 0 / 0 = NaN and Infinity / Infinity = NaN
        if (tIsZero && zIsZero || tInfin && zInfin) {
          return Complex$1['NAN'];
        }

        // Infinity / 0 = Infinity
        if (zIsZero || tInfin) {
          return Complex$1['INFINITY'];
        }

        // 0 / Infinity = 0
        if (tIsZero || zInfin) {
          return Complex$1['ZERO'];
        }

        if (0 === z['im']) {
          // Divisor is real
          return new Complex$1(this['re'] / z['re'], this['im'] / z['re']);
        }

        if (Math.abs(z['re']) < Math.abs(z['im'])) {

          const x = z['re'] / z['im'];
          const t = z['re'] * x + z['im'];

          return new Complex$1(
            (this['re'] * x + this['im']) / t,
            (this['im'] * x - this['re']) / t);

        } else {

          const x = z['im'] / z['re'];
          const t = z['im'] * x + z['re'];

          return new Complex$1(
            (this['re'] + this['im'] * x) / t,
            (this['im'] - this['re'] * x) / t);
        }
      },

      /**
       * Calculate the power of two complex numbers
       *
       * @returns {Complex}
       */
      'pow': function (a, b) {

        const z = parse$1(a, b);

        const tIsZero = this['re'] === 0 && this['im'] === 0;
        const zIsZero = z['re'] === 0 && z['im'] === 0;

        if (zIsZero) {
          return Complex$1['ONE'];
        }

        // If the exponent is real
        if (z['im'] === 0) {

          if (this['im'] === 0 && this['re'] > 0) {

            return new Complex$1(Math.pow(this['re'], z['re']), 0);

          } else if (this['re'] === 0) { // If base is fully imaginary

            switch ((z['re'] % 4 + 4) % 4) {
              case 0:
                return new Complex$1(Math.pow(this['im'], z['re']), 0);
              case 1:
                return new Complex$1(0, Math.pow(this['im'], z['re']));
              case 2:
                return new Complex$1(-Math.pow(this['im'], z['re']), 0);
              case 3:
                return new Complex$1(0, -Math.pow(this['im'], z['re']));
            }
          }
        }

        /* I couldn't find a good formula, so here is a derivation and optimization
         *
         * z_1^z_2 = (a + bi)^(c + di)
         *         = exp((c + di) * log(a + bi)
         *         = pow(a^2 + b^2, (c + di) / 2) * exp(i(c + di)atan2(b, a))
         * =>...
         * Re = (pow(a^2 + b^2, c / 2) * exp(-d * atan2(b, a))) * cos(d * log(a^2 + b^2) / 2 + c * atan2(b, a))
         * Im = (pow(a^2 + b^2, c / 2) * exp(-d * atan2(b, a))) * sin(d * log(a^2 + b^2) / 2 + c * atan2(b, a))
         *
         * =>...
         * Re = exp(c * log(sqrt(a^2 + b^2)) - d * atan2(b, a)) * cos(d * log(sqrt(a^2 + b^2)) + c * atan2(b, a))
         * Im = exp(c * log(sqrt(a^2 + b^2)) - d * atan2(b, a)) * sin(d * log(sqrt(a^2 + b^2)) + c * atan2(b, a))
         *
         * =>
         * Re = exp(c * logsq2 - d * arg(z_1)) * cos(d * logsq2 + c * arg(z_1))
         * Im = exp(c * logsq2 - d * arg(z_1)) * sin(d * logsq2 + c * arg(z_1))
         *
         */

        if (tIsZero && z['re'] > 0) { // Same behavior as Wolframalpha, Zero if real part is zero
          return Complex$1['ZERO'];
        }

        const arg = Math.atan2(this['im'], this['re']);
        const loh = logHypot(this['re'], this['im']);

        let re = Math.exp(z['re'] * loh - z['im'] * arg);
        let im = z['im'] * loh + z['re'] * arg;
        return new Complex$1(
          re * Math.cos(im),
          re * Math.sin(im));
      },

      /**
       * Calculate the complex square root
       *
       * @returns {Complex}
       */
      'sqrt': function () {

        const a = this['re'];
        const b = this['im'];

        if (b === 0) {
          // Real number case
          if (a >= 0) {
            return new Complex$1(Math.sqrt(a), 0);
          } else {
            return new Complex$1(0, Math.sqrt(-a));
          }
        }

        const r = hypot(a, b);

        let re = Math.sqrt(0.5 * (r + Math.abs(a))); // sqrt(2x) / 2 = sqrt(x / 2)
        let im = Math.abs(b) / (2 * re);

        if (a >= 0) {
          return new Complex$1(re, b < 0 ? -im : im);
        } else {
          return new Complex$1(im, b < 0 ? -re : re);
        }
      },

      /**
       * Calculate the complex exponent
       *
       * @returns {Complex}
       */
      'exp': function () {

        const er = Math.exp(this['re']);

        if (this['im'] === 0) {
          return new Complex$1(er, 0);
        }
        return new Complex$1(
          er * Math.cos(this['im']),
          er * Math.sin(this['im']));
      },

      /**
       * Calculate the complex exponent and subtracts one.
       *
       * This may be more accurate than `Complex(x).exp().sub(1)` if
       * `x` is small.
       *
       * @returns {Complex}
       */
      'expm1': function () {

        /**
         * exp(a + i*b) - 1
         = exp(a) * (cos(b) + j*sin(b)) - 1
         = expm1(a)*cos(b) + cosm1(b) + j*exp(a)*sin(b)
         */

        const a = this['re'];
        const b = this['im'];

        return new Complex$1(
          Math.expm1(a) * Math.cos(b) + cosm1(b),
          Math.exp(a) * Math.sin(b));
      },

      /**
       * Calculate the natural log
       *
       * @returns {Complex}
       */
      'log': function () {

        const a = this['re'];
        const b = this['im'];

        if (b === 0 && a > 0) {
          return new Complex$1(Math.log(a), 0);
        }

        return new Complex$1(
          logHypot(a, b),
          Math.atan2(b, a));
      },

      /**
       * Calculate the magnitude of the complex number
       *
       * @returns {number}
       */
      'abs': function () {

        return hypot(this['re'], this['im']);
      },

      /**
       * Calculate the angle of the complex number
       *
       * @returns {number}
       */
      'arg': function () {

        return Math.atan2(this['im'], this['re']);
      },

      /**
       * Calculate the sine of the complex number
       *
       * @returns {Complex}
       */
      'sin': function () {

        // sin(z) = ( e^iz - e^-iz ) / 2i 
        //        = sin(a)cosh(b) + i cos(a)sinh(b)

        const a = this['re'];
        const b = this['im'];

        return new Complex$1(
          Math.sin(a) * cosh(b),
          Math.cos(a) * sinh(b));
      },

      /**
       * Calculate the cosine
       *
       * @returns {Complex}
       */
      'cos': function () {

        // cos(z) = ( e^iz + e^-iz ) / 2 
        //        = cos(a)cosh(b) - i sin(a)sinh(b)

        const a = this['re'];
        const b = this['im'];

        return new Complex$1(
          Math.cos(a) * cosh(b),
          -Math.sin(a) * sinh(b));
      },

      /**
       * Calculate the tangent
       *
       * @returns {Complex}
       */
      'tan': function () {

        // tan(z) = sin(z) / cos(z) 
        //        = ( e^iz - e^-iz ) / ( i( e^iz + e^-iz ) )
        //        = ( e^2iz - 1 ) / i( e^2iz + 1 )
        //        = ( sin(2a) + i sinh(2b) ) / ( cos(2a) + cosh(2b) )

        const a = 2 * this['re'];
        const b = 2 * this['im'];
        const d = Math.cos(a) + cosh(b);

        return new Complex$1(
          Math.sin(a) / d,
          sinh(b) / d);
      },

      /**
       * Calculate the cotangent
       *
       * @returns {Complex}
       */
      'cot': function () {

        // cot(c) = i(e^(ci) + e^(-ci)) / (e^(ci) - e^(-ci))

        const a = 2 * this['re'];
        const b = 2 * this['im'];
        const d = Math.cos(a) - cosh(b);

        return new Complex$1(
          -Math.sin(a) / d,
          sinh(b) / d);
      },

      /**
       * Calculate the secant
       *
       * @returns {Complex}
       */
      'sec': function () {

        // sec(c) = 2 / (e^(ci) + e^(-ci))

        const a = this['re'];
        const b = this['im'];
        const d = 0.5 * cosh(2 * b) + 0.5 * Math.cos(2 * a);

        return new Complex$1(
          Math.cos(a) * cosh(b) / d,
          Math.sin(a) * sinh(b) / d);
      },

      /**
       * Calculate the cosecans
       *
       * @returns {Complex}
       */
      'csc': function () {

        // csc(c) = 2i / (e^(ci) - e^(-ci))

        const a = this['re'];
        const b = this['im'];
        const d = 0.5 * cosh(2 * b) - 0.5 * Math.cos(2 * a);

        return new Complex$1(
          Math.sin(a) * cosh(b) / d,
          -Math.cos(a) * sinh(b) / d);
      },

      /**
       * Calculate the complex arcus sinus
       *
       * @returns {Complex}
       */
      'asin': function () {

        // asin(c) = -i * log(ci + sqrt(1 - c^2))

        const a = this['re'];
        const b = this['im'];

        const t1 = new Complex$1(
          b * b - a * a + 1,
          -2 * a * b)['sqrt']();

        const t2 = new Complex$1(
          t1['re'] - b,
          t1['im'] + a)['log']();

        return new Complex$1(t2['im'], -t2['re']);
      },

      /**
       * Calculate the complex arcus cosinus
       *
       * @returns {Complex}
       */
      'acos': function () {

        // acos(c) = i * log(c - i * sqrt(1 - c^2))

        const a = this['re'];
        const b = this['im'];

        const t1 = new Complex$1(
          b * b - a * a + 1,
          -2 * a * b)['sqrt']();

        const t2 = new Complex$1(
          t1['re'] - b,
          t1['im'] + a)['log']();

        return new Complex$1(Math.PI / 2 - t2['im'], t2['re']);
      },

      /**
       * Calculate the complex arcus tangent
       *
       * @returns {Complex}
       */
      'atan': function () {

        // atan(c) = i / 2 log((i + x) / (i - x))

        const a = this['re'];
        const b = this['im'];

        if (a === 0) {

          if (b === 1) {
            return new Complex$1(0, Infinity);
          }

          if (b === -1) {
            return new Complex$1(0, -Infinity);
          }
        }

        const d = a * a + (1.0 - b) * (1.0 - b);

        const t1 = new Complex$1(
          (1 - b * b - a * a) / d,
          -2 * a / d).log();

        return new Complex$1(-0.5 * t1['im'], 0.5 * t1['re']);
      },

      /**
       * Calculate the complex arcus cotangent
       *
       * @returns {Complex}
       */
      'acot': function () {

        // acot(c) = i / 2 log((c - i) / (c + i))

        const a = this['re'];
        const b = this['im'];

        if (b === 0) {
          return new Complex$1(Math.atan2(1, a), 0);
        }

        const d = a * a + b * b;
        return (d !== 0)
          ? new Complex$1(
            a / d,
            -b / d).atan()
          : new Complex$1(
            (a !== 0) ? a / 0 : 0,
            (b !== 0) ? -b / 0 : 0).atan();
      },

      /**
       * Calculate the complex arcus secant
       *
       * @returns {Complex}
       */
      'asec': function () {

        // asec(c) = -i * log(1 / c + sqrt(1 - i / c^2))

        const a = this['re'];
        const b = this['im'];

        if (a === 0 && b === 0) {
          return new Complex$1(0, Infinity);
        }

        const d = a * a + b * b;
        return (d !== 0)
          ? new Complex$1(
            a / d,
            -b / d).acos()
          : new Complex$1(
            (a !== 0) ? a / 0 : 0,
            (b !== 0) ? -b / 0 : 0).acos();
      },

      /**
       * Calculate the complex arcus cosecans
       *
       * @returns {Complex}
       */
      'acsc': function () {

        // acsc(c) = -i * log(i / c + sqrt(1 - 1 / c^2))

        const a = this['re'];
        const b = this['im'];

        if (a === 0 && b === 0) {
          return new Complex$1(Math.PI / 2, Infinity);
        }

        const d = a * a + b * b;
        return (d !== 0)
          ? new Complex$1(
            a / d,
            -b / d).asin()
          : new Complex$1(
            (a !== 0) ? a / 0 : 0,
            (b !== 0) ? -b / 0 : 0).asin();
      },

      /**
       * Calculate the complex sinh
       *
       * @returns {Complex}
       */
      'sinh': function () {

        // sinh(c) = (e^c - e^-c) / 2

        const a = this['re'];
        const b = this['im'];

        return new Complex$1(
          sinh(a) * Math.cos(b),
          cosh(a) * Math.sin(b));
      },

      /**
       * Calculate the complex cosh
       *
       * @returns {Complex}
       */
      'cosh': function () {

        // cosh(c) = (e^c + e^-c) / 2

        const a = this['re'];
        const b = this['im'];

        return new Complex$1(
          cosh(a) * Math.cos(b),
          sinh(a) * Math.sin(b));
      },

      /**
       * Calculate the complex tanh
       *
       * @returns {Complex}
       */
      'tanh': function () {

        // tanh(c) = (e^c - e^-c) / (e^c + e^-c)

        const a = 2 * this['re'];
        const b = 2 * this['im'];
        const d = cosh(a) + Math.cos(b);

        return new Complex$1(
          sinh(a) / d,
          Math.sin(b) / d);
      },

      /**
       * Calculate the complex coth
       *
       * @returns {Complex}
       */
      'coth': function () {

        // coth(c) = (e^c + e^-c) / (e^c - e^-c)

        const a = 2 * this['re'];
        const b = 2 * this['im'];
        const d = cosh(a) - Math.cos(b);

        return new Complex$1(
          sinh(a) / d,
          -Math.sin(b) / d);
      },

      /**
       * Calculate the complex coth
       *
       * @returns {Complex}
       */
      'csch': function () {

        // csch(c) = 2 / (e^c - e^-c)

        const a = this['re'];
        const b = this['im'];
        const d = Math.cos(2 * b) - cosh(2 * a);

        return new Complex$1(
          -2 * sinh(a) * Math.cos(b) / d,
          2 * cosh(a) * Math.sin(b) / d);
      },

      /**
       * Calculate the complex sech
       *
       * @returns {Complex}
       */
      'sech': function () {

        // sech(c) = 2 / (e^c + e^-c)

        const a = this['re'];
        const b = this['im'];
        const d = Math.cos(2 * b) + cosh(2 * a);

        return new Complex$1(
          2 * cosh(a) * Math.cos(b) / d,
          -2 * sinh(a) * Math.sin(b) / d);
      },

      /**
       * Calculate the complex asinh
       *
       * @returns {Complex}
       */
      'asinh': function () {

        // asinh(c) = log(c + sqrt(c^2 + 1))

        let tmp = this['im'];
        this['im'] = -this['re'];
        this['re'] = tmp;
        const res = this['asin']();

        this['re'] = -this['im'];
        this['im'] = tmp;
        tmp = res['re'];

        res['re'] = -res['im'];
        res['im'] = tmp;
        return res;
      },

      /**
       * Calculate the complex acosh
       *
       * @returns {Complex}
       */
      'acosh': function () {

        // acosh(c) = log(c + sqrt(c^2 - 1))

        const res = this['acos']();
        if (res['im'] <= 0) {
          const tmp = res['re'];
          res['re'] = -res['im'];
          res['im'] = tmp;
        } else {
          const tmp = res['im'];
          res['im'] = -res['re'];
          res['re'] = tmp;
        }
        return res;
      },

      /**
       * Calculate the complex atanh
       *
       * @returns {Complex}
       */
      'atanh': function () {

        // atanh(c) = log((1+c) / (1-c)) / 2

        const a = this['re'];
        const b = this['im'];

        const noIM = a > 1 && b === 0;
        const oneMinus = 1 - a;
        const onePlus = 1 + a;
        const d = oneMinus * oneMinus + b * b;

        const x = (d !== 0)
          ? new Complex$1(
            (onePlus * oneMinus - b * b) / d,
            (b * oneMinus + onePlus * b) / d)
          : new Complex$1(
            (a !== -1) ? (a / 0) : 0,
            (b !== 0) ? (b / 0) : 0);

        const temp = x['re'];
        x['re'] = logHypot(x['re'], x['im']) / 2;
        x['im'] = Math.atan2(x['im'], temp) / 2;
        if (noIM) {
          x['im'] = -x['im'];
        }
        return x;
      },

      /**
       * Calculate the complex acoth
       *
       * @returns {Complex}
       */
      'acoth': function () {

        // acoth(c) = log((c+1) / (c-1)) / 2

        const a = this['re'];
        const b = this['im'];

        if (a === 0 && b === 0) {
          return new Complex$1(0, Math.PI / 2);
        }

        const d = a * a + b * b;
        return (d !== 0)
          ? new Complex$1(
            a / d,
            -b / d).atanh()
          : new Complex$1(
            (a !== 0) ? a / 0 : 0,
            (b !== 0) ? -b / 0 : 0).atanh();
      },

      /**
       * Calculate the complex acsch
       *
       * @returns {Complex}
       */
      'acsch': function () {

        // acsch(c) = log((1+sqrt(1+c^2))/c)

        const a = this['re'];
        const b = this['im'];

        if (b === 0) {

          return new Complex$1(
            (a !== 0)
              ? Math.log(a + Math.sqrt(a * a + 1))
              : Infinity, 0);
        }

        const d = a * a + b * b;
        return (d !== 0)
          ? new Complex$1(
            a / d,
            -b / d).asinh()
          : new Complex$1(
            (a !== 0) ? a / 0 : 0,
            (b !== 0) ? -b / 0 : 0).asinh();
      },

      /**
       * Calculate the complex asech
       *
       * @returns {Complex}
       */
      'asech': function () {

        // asech(c) = log((1+sqrt(1-c^2))/c)

        const a = this['re'];
        const b = this['im'];

        if (this['isZero']()) {
          return Complex$1['INFINITY'];
        }

        const d = a * a + b * b;
        return (d !== 0)
          ? new Complex$1(
            a / d,
            -b / d).acosh()
          : new Complex$1(
            (a !== 0) ? a / 0 : 0,
            (b !== 0) ? -b / 0 : 0).acosh();
      },

      /**
       * Calculate the complex inverse 1/z
       *
       * @returns {Complex}
       */
      'inverse': function () {

        // 1 / 0 = Infinity and 1 / Infinity = 0
        if (this['isZero']()) {
          return Complex$1['INFINITY'];
        }

        if (this['isInfinite']()) {
          return Complex$1['ZERO'];
        }

        const a = this['re'];
        const b = this['im'];

        const d = a * a + b * b;

        return new Complex$1(a / d, -b / d);
      },

      /**
       * Returns the complex conjugate
       *
       * @returns {Complex}
       */
      'conjugate': function () {

        return new Complex$1(this['re'], -this['im']);
      },

      /**
       * Gets the negated complex number
       *
       * @returns {Complex}
       */
      'neg': function () {

        return new Complex$1(-this['re'], -this['im']);
      },

      /**
       * Ceils the actual complex number
       *
       * @returns {Complex}
       */
      'ceil': function (places) {

        places = Math.pow(10, places || 0);

        return new Complex$1(
          Math.ceil(this['re'] * places) / places,
          Math.ceil(this['im'] * places) / places);
      },

      /**
       * Floors the actual complex number
       *
       * @returns {Complex}
       */
      'floor': function (places) {

        places = Math.pow(10, places || 0);

        return new Complex$1(
          Math.floor(this['re'] * places) / places,
          Math.floor(this['im'] * places) / places);
      },

      /**
       * Ceils the actual complex number
       *
       * @returns {Complex}
       */
      'round': function (places) {

        places = Math.pow(10, places || 0);

        return new Complex$1(
          Math.round(this['re'] * places) / places,
          Math.round(this['im'] * places) / places);
      },

      /**
       * Compares two complex numbers
       *
       * **Note:** new Complex(Infinity).equals(Infinity) === false
       *
       * @returns {boolean}
       */
      'equals': function (a, b) {

        const z = parse$1(a, b);

        return Math.abs(z['re'] - this['re']) <= Complex$1['EPSILON'] &&
          Math.abs(z['im'] - this['im']) <= Complex$1['EPSILON'];
      },

      /**
       * Clones the actual object
       *
       * @returns {Complex}
       */
      'clone': function () {

        return new Complex$1(this['re'], this['im']);
      },

      /**
       * Gets a string of the actual complex number
       *
       * @returns {string}
       */
      'toString': function () {

        let a = this['re'];
        let b = this['im'];
        let ret = "";

        if (this['isNaN']()) {
          return 'NaN';
        }

        if (this['isInfinite']()) {
          return 'Infinity';
        }

        if (Math.abs(a) < Complex$1['EPSILON']) {
          a = 0;
        }

        if (Math.abs(b) < Complex$1['EPSILON']) {
          b = 0;
        }

        // If is real number
        if (b === 0) {
          return ret + a;
        }

        if (a !== 0) {
          ret += a;
          ret += " ";
          if (b < 0) {
            b = -b;
            ret += "-";
          } else {
            ret += "+";
          }
          ret += " ";
        } else if (b < 0) {
          b = -b;
          ret += "-";
        }

        if (1 !== b) { // b is the absolute imaginary part
          ret += b;
        }
        return ret + "i";
      },

      /**
       * Returns the actual number as a vector
       *
       * @returns {Array}
       */
      'toVector': function () {

        return [this['re'], this['im']];
      },

      /**
       * Returns the actual real value of the current object
       *
       * @returns {number|null}
       */
      'valueOf': function () {

        if (this['im'] === 0) {
          return this['re'];
        }
        return null;
      },

      /**
       * Determines whether a complex number is not on the Riemann sphere.
       *
       * @returns {boolean}
       */
      'isNaN': function () {
        return isNaN(this['re']) || isNaN(this['im']);
      },

      /**
       * Determines whether or not a complex number is at the zero pole of the
       * Riemann sphere.
       *
       * @returns {boolean}
       */
      'isZero': function () {
        return this['im'] === 0 && this['re'] === 0;
      },

      /**
       * Determines whether a complex number is not at the infinity pole of the
       * Riemann sphere.
       *
       * @returns {boolean}
       */
      'isFinite': function () {
        return isFinite(this['re']) && isFinite(this['im']);
      },

      /**
       * Determines whether or not a complex number is at the infinity pole of the
       * Riemann sphere.
       *
       * @returns {boolean}
       */
      'isInfinite': function () {
        return !this['isFinite']();
      }
    };

    Complex$1['ZERO'] = new Complex$1(0, 0);
    Complex$1['ONE'] = new Complex$1(1, 0);
    Complex$1['I'] = new Complex$1(0, 1);
    Complex$1['PI'] = new Complex$1(Math.PI, 0);
    Complex$1['E'] = new Complex$1(Math.E, 0);
    Complex$1['INFINITY'] = new Complex$1(Infinity, Infinity);
    Complex$1['NAN'] = new Complex$1(NaN, NaN);
    Complex$1['EPSILON'] = 1e-15;

    var name$u = 'Complex';
    var dependencies$u = [];
    var createComplexClass = /* #__PURE__ */factory(name$u, dependencies$u, () => {
      /**
       * Attach type information
       */
      Object.defineProperty(Complex$1, 'name', {
        value: 'Complex'
      });
      Complex$1.prototype.constructor = Complex$1;
      Complex$1.prototype.type = 'Complex';
      Complex$1.prototype.isComplex = true;

      /**
       * Get a JSON representation of the complex number
       * @returns {Object} Returns a JSON object structured as:
       *                   `{"mathjs": "Complex", "re": 2, "im": 3}`
       */
      Complex$1.prototype.toJSON = function () {
        return {
          mathjs: 'Complex',
          re: this.re,
          im: this.im
        };
      };

      /*
       * Return the value of the complex number in polar notation
       * The angle phi will be set in the interval of [-pi, pi].
       * @return {{r: number, phi: number}} Returns and object with properties r and phi.
       */
      Complex$1.prototype.toPolar = function () {
        return {
          r: this.abs(),
          phi: this.arg()
        };
      };

      /**
       * Get a string representation of the complex number,
       * with optional formatting options.
       * @param {Object | number | Function} [options]  Formatting options. See
       *                                                lib/utils/number:format for a
       *                                                description of the available
       *                                                options.
       * @return {string} str
       */
      Complex$1.prototype.format = function (options) {
        var str = '';
        var im = this.im;
        var re = this.re;
        var strRe = format$2(this.re, options);
        var strIm = format$2(this.im, options);

        // round either re or im when smaller than the configured precision
        var precision = isNumber(options) ? options : options ? options.precision : null;
        if (precision !== null) {
          var epsilon = Math.pow(10, -precision);
          if (Math.abs(re / im) < epsilon) {
            re = 0;
          }
          if (Math.abs(im / re) < epsilon) {
            im = 0;
          }
        }
        if (im === 0) {
          // real value
          str = strRe;
        } else if (re === 0) {
          // purely complex value
          if (im === 1) {
            str = 'i';
          } else if (im === -1) {
            str = '-i';
          } else {
            str = strIm + 'i';
          }
        } else {
          // complex value
          if (im < 0) {
            if (im === -1) {
              str = strRe + ' - i';
            } else {
              str = strRe + ' - ' + strIm.substring(1) + 'i';
            }
          } else {
            if (im === 1) {
              str = strRe + ' + i';
            } else {
              str = strRe + ' + ' + strIm + 'i';
            }
          }
        }
        return str;
      };

      /**
       * Create a complex number from polar coordinates
       *
       * Usage:
       *
       *     Complex.fromPolar(r: number, phi: number) : Complex
       *     Complex.fromPolar({r: number, phi: number}) : Complex
       *
       * @param {*} args...
       * @return {Complex}
       */
      Complex$1.fromPolar = function (args) {
        switch (arguments.length) {
          case 1:
            {
              var arg = arguments[0];
              if (typeof arg === 'object') {
                return Complex$1(arg);
              } else {
                throw new TypeError('Input has to be an object with r and phi keys.');
              }
            }
          case 2:
            {
              var r = arguments[0];
              var phi = arguments[1];
              if (isNumber(r)) {
                if (isUnit(phi) && phi.hasBase('ANGLE')) {
                  // convert unit to a number in radians
                  phi = phi.toNumber('rad');
                }
                if (isNumber(phi)) {
                  return new Complex$1({
                    r,
                    phi
                  });
                }
                throw new TypeError('Phi is not a number nor an angle unit.');
              } else {
                throw new TypeError('Radius r is not a number.');
              }
            }
          default:
            throw new SyntaxError('Wrong number of arguments in function fromPolar');
        }
      };
      Complex$1.prototype.valueOf = Complex$1.prototype.toString;

      /**
       * Create a Complex number from a JSON object
       * @param {Object} json  A JSON Object structured as
       *                       {"mathjs": "Complex", "re": 2, "im": 3}
       *                       All properties are optional, default values
       *                       for `re` and `im` are 0.
       * @return {Complex} Returns a new Complex number
       */
      Complex$1.fromJSON = function (json) {
        return new Complex$1(json);
      };

      /**
       * Compare two complex numbers, `a` and `b`:
       *
       * - Returns 1 when the real part of `a` is larger than the real part of `b`
       * - Returns -1 when the real part of `a` is smaller than the real part of `b`
       * - Returns 1 when the real parts are equal
       *   and the imaginary part of `a` is larger than the imaginary part of `b`
       * - Returns -1 when the real parts are equal
       *   and the imaginary part of `a` is smaller than the imaginary part of `b`
       * - Returns 0 when both real and imaginary parts are equal.
       *
       * @params {Complex} a
       * @params {Complex} b
       * @returns {number} Returns the comparison result: -1, 0, or 1
       */
      Complex$1.compare = function (a, b) {
        if (a.re > b.re) {
          return 1;
        }
        if (a.re < b.re) {
          return -1;
        }
        if (a.im > b.im) {
          return 1;
        }
        if (a.im < b.im) {
          return -1;
        }
        return 0;
      };
      return Complex$1;
    }, {
      isClass: true
    });

    /**
     *
     * This class offers the possibility to calculate fractions.
     * You can pass a fraction in different formats. Either as array, as double, as string or as an integer.
     *
     * Array/Object form
     * [ 0 => <numerator>, 1 => <denominator> ]
     * { n => <numerator>, d => <denominator> }
     *
     * Integer form
     * - Single integer value as BigInt or Number
     *
     * Double form
     * - Single double value as Number
     *
     * String form
     * 123.456 - a simple double
     * 123/456 - a string fraction
     * 123.'456' - a double with repeating decimal places
     * 123.(456) - synonym
     * 123.45'6' - a double with repeating last place
     * 123.45(6) - synonym
     *
     * Example:
     * let f = new Fraction("9.4'31'");
     * f.mul([-4, 3]).div(4.9);
     *
     */

    // Set Identity function to downgrade BigInt to Number if needed
    if (typeof BigInt === 'undefined') BigInt = function (n) { if (isNaN(n)) throw new Error(""); return n; };

    const C_ZERO = BigInt(0);
    const C_ONE = BigInt(1);
    const C_TWO = BigInt(2);
    const C_FIVE = BigInt(5);
    const C_TEN = BigInt(10);

    // Maximum search depth for cyclic rational numbers. 2000 should be more than enough.
    // Example: 1/7 = 0.(142857) has 6 repeating decimal places.
    // If MAX_CYCLE_LEN gets reduced, long cycles will not be detected and toString() only gets the first 10 digits
    const MAX_CYCLE_LEN = 2000;

    // Parsed data to avoid calling "new" all the time
    const P$1 = {
      "s": C_ONE,
      "n": C_ZERO,
      "d": C_ONE
    };

    function assign(n, s) {

      try {
        n = BigInt(n);
      } catch (e) {
        throw InvalidParameter();
      }
      return n * s;
    }

    function trunc(x) {
      return typeof x === 'bigint' ? x : Math.floor(x);
    }

    // Creates a new Fraction internally without the need of the bulky constructor
    function newFraction(n, d) {

      if (d === C_ZERO) {
        throw DivisionByZero();
      }

      const f = Object.create(Fraction$1.prototype);
      f["s"] = n < C_ZERO ? -C_ONE : C_ONE;

      n = n < C_ZERO ? -n : n;

      const a = gcd(n, d);

      f["n"] = n / a;
      f["d"] = d / a;
      return f;
    }

    function factorize(num) {

      const factors = {};

      let n = num;
      let i = C_TWO;
      let s = C_FIVE - C_ONE;

      while (s <= n) {

        while (n % i === C_ZERO) {
          n /= i;
          factors[i] = (factors[i] || C_ZERO) + C_ONE;
        }
        s += C_ONE + C_TWO * i++;
      }

      if (n !== num) {
        if (n > 1)
          factors[n] = (factors[n] || C_ZERO) + C_ONE;
      } else {
        factors[num] = (factors[num] || C_ZERO) + C_ONE;
      }
      return factors;
    }

    const parse = function (p1, p2) {

      let n = C_ZERO, d = C_ONE, s = C_ONE;

      if (p1 === undefined || p1 === null) ; else if (p2 !== undefined) { // Two arguments

        if (typeof p1 === "bigint") {
          n = p1;
        } else if (isNaN(p1)) {
          throw InvalidParameter();
        } else if (p1 % 1 !== 0) {
          throw NonIntegerParameter();
        } else {
          n = BigInt(p1);
        }

        if (typeof p2 === "bigint") {
          d = p2;
        } else if (isNaN(p2)) {
          throw InvalidParameter();
        } else if (p2 % 1 !== 0) {
          throw NonIntegerParameter();
        } else {
          d = BigInt(p2);
        }

        s = n * d;

      } else if (typeof p1 === "object") {
        if ("d" in p1 && "n" in p1) {
          n = BigInt(p1["n"]);
          d = BigInt(p1["d"]);
          if ("s" in p1)
            n *= BigInt(p1["s"]);
        } else if (0 in p1) {
          n = BigInt(p1[0]);
          if (1 in p1)
            d = BigInt(p1[1]);
        } else if (typeof p1 === "bigint") {
          n = p1;
        } else {
          throw InvalidParameter();
        }
        s = n * d;
      } else if (typeof p1 === "number") {

        if (isNaN(p1)) {
          throw InvalidParameter();
        }

        if (p1 < 0) {
          s = -C_ONE;
          p1 = -p1;
        }

        if (p1 % 1 === 0) {
          n = BigInt(p1);
        } else {

          let z = 1;

          let A = 0, B = 1;
          let C = 1, D = 1;

          let N = 10000000;

          if (p1 >= 1) {
            z = 10 ** Math.floor(1 + Math.log10(p1));
            p1 /= z;
          }

          // Using Farey Sequences

          while (B <= N && D <= N) {
            let M = (A + C) / (B + D);

            if (p1 === M) {
              if (B + D <= N) {
                n = A + C;
                d = B + D;
              } else if (D > B) {
                n = C;
                d = D;
              } else {
                n = A;
                d = B;
              }
              break;

            } else {

              if (p1 > M) {
                A += C;
                B += D;
              } else {
                C += A;
                D += B;
              }

              if (B > N) {
                n = C;
                d = D;
              } else {
                n = A;
                d = B;
              }
            }
          }
          n = BigInt(n) * BigInt(z);
          d = BigInt(d);
        }

      } else if (typeof p1 === "string") {

        let ndx = 0;

        let v = C_ZERO, w = C_ZERO, x = C_ZERO, y = C_ONE, z = C_ONE;

        let match = p1.replace(/_/g, '').match(/\d+|./g);

        if (match === null)
          throw InvalidParameter();

        if (match[ndx] === '-') {// Check for minus sign at the beginning
          s = -C_ONE;
          ndx++;
        } else if (match[ndx] === '+') {// Check for plus sign at the beginning
          ndx++;
        }

        if (match.length === ndx + 1) { // Check if it's just a simple number "1234"
          w = assign(match[ndx++], s);
        } else if (match[ndx + 1] === '.' || match[ndx] === '.') { // Check if it's a decimal number

          if (match[ndx] !== '.') { // Handle 0.5 and .5
            v = assign(match[ndx++], s);
          }
          ndx++;

          // Check for decimal places
          if (ndx + 1 === match.length || match[ndx + 1] === '(' && match[ndx + 3] === ')' || match[ndx + 1] === "'" && match[ndx + 3] === "'") {
            w = assign(match[ndx], s);
            y = C_TEN ** BigInt(match[ndx].length);
            ndx++;
          }

          // Check for repeating places
          if (match[ndx] === '(' && match[ndx + 2] === ')' || match[ndx] === "'" && match[ndx + 2] === "'") {
            x = assign(match[ndx + 1], s);
            z = C_TEN ** BigInt(match[ndx + 1].length) - C_ONE;
            ndx += 3;
          }

        } else if (match[ndx + 1] === '/' || match[ndx + 1] === ':') { // Check for a simple fraction "123/456" or "123:456"
          w = assign(match[ndx], s);
          y = assign(match[ndx + 2], C_ONE);
          ndx += 3;
        } else if (match[ndx + 3] === '/' && match[ndx + 1] === ' ') { // Check for a complex fraction "123 1/2"
          v = assign(match[ndx], s);
          w = assign(match[ndx + 2], s);
          y = assign(match[ndx + 4], C_ONE);
          ndx += 5;
        }

        if (match.length <= ndx) { // Check for more tokens on the stack
          d = y * z;
          s = /* void */
            n = x + d * v + z * w;
        } else {
          throw InvalidParameter();
        }

      } else if (typeof p1 === "bigint") {
        n = p1;
        s = p1;
        d = C_ONE;
      } else {
        throw InvalidParameter();
      }

      if (d === C_ZERO) {
        throw DivisionByZero();
      }

      P$1["s"] = s < C_ZERO ? -C_ONE : C_ONE;
      P$1["n"] = n < C_ZERO ? -n : n;
      P$1["d"] = d < C_ZERO ? -d : d;
    };

    function modpow(b, e, m) {

      let r = C_ONE;
      for (; e > C_ZERO; b = (b * b) % m, e >>= C_ONE) {

        if (e & C_ONE) {
          r = (r * b) % m;
        }
      }
      return r;
    }

    function cycleLen(n, d) {

      for (; d % C_TWO === C_ZERO;
        d /= C_TWO) {
      }

      for (; d % C_FIVE === C_ZERO;
        d /= C_FIVE) {
      }

      if (d === C_ONE) // Catch non-cyclic numbers
        return C_ZERO;

      // If we would like to compute really large numbers quicker, we could make use of Fermat's little theorem:
      // 10^(d-1) % d == 1
      // However, we don't need such large numbers and MAX_CYCLE_LEN should be the capstone,
      // as we want to translate the numbers to strings.

      let rem = C_TEN % d;
      let t = 1;

      for (; rem !== C_ONE; t++) {
        rem = rem * C_TEN % d;

        if (t > MAX_CYCLE_LEN)
          return C_ZERO; // Returning 0 here means that we don't print it as a cyclic number. It's likely that the answer is `d-1`
      }
      return BigInt(t);
    }

    function cycleStart(n, d, len) {

      let rem1 = C_ONE;
      let rem2 = modpow(C_TEN, len, d);

      for (let t = 0; t < 300; t++) { // s < ~log10(Number.MAX_VALUE)
        // Solve 10^s == 10^(s+t) (mod d)

        if (rem1 === rem2)
          return BigInt(t);

        rem1 = rem1 * C_TEN % d;
        rem2 = rem2 * C_TEN % d;
      }
      return 0;
    }

    function gcd(a, b) {

      if (!a)
        return b;
      if (!b)
        return a;

      while (1) {
        a %= b;
        if (!a)
          return b;
        b %= a;
        if (!b)
          return a;
      }
    }

    /**
     * Module constructor
     *
     * @constructor
     * @param {number|Fraction=} a
     * @param {number=} b
     */
    function Fraction$1(a, b) {

      parse(a, b);

      if (this instanceof Fraction$1) {
        a = gcd(P$1["d"], P$1["n"]); // Abuse a
        this["s"] = P$1["s"];
        this["n"] = P$1["n"] / a;
        this["d"] = P$1["d"] / a;
      } else {
        return newFraction(P$1['s'] * P$1['n'], P$1['d']);
      }
    }

    var DivisionByZero = function () { return new Error("Division by Zero"); };
    var InvalidParameter = function () { return new Error("Invalid argument"); };
    var NonIntegerParameter = function () { return new Error("Parameters must be integer"); };

    Fraction$1.prototype = {

      "s": C_ONE,
      "n": C_ZERO,
      "d": C_ONE,

      /**
       * Calculates the absolute value
       *
       * Ex: new Fraction(-4).abs() => 4
       **/
      "abs": function () {

        return newFraction(this["n"], this["d"]);
      },

      /**
       * Inverts the sign of the current fraction
       *
       * Ex: new Fraction(-4).neg() => 4
       **/
      "neg": function () {

        return newFraction(-this["s"] * this["n"], this["d"]);
      },

      /**
       * Adds two rational numbers
       *
       * Ex: new Fraction({n: 2, d: 3}).add("14.9") => 467 / 30
       **/
      "add": function (a, b) {

        parse(a, b);
        return newFraction(
          this["s"] * this["n"] * P$1["d"] + P$1["s"] * this["d"] * P$1["n"],
          this["d"] * P$1["d"]
        );
      },

      /**
       * Subtracts two rational numbers
       *
       * Ex: new Fraction({n: 2, d: 3}).add("14.9") => -427 / 30
       **/
      "sub": function (a, b) {

        parse(a, b);
        return newFraction(
          this["s"] * this["n"] * P$1["d"] - P$1["s"] * this["d"] * P$1["n"],
          this["d"] * P$1["d"]
        );
      },

      /**
       * Multiplies two rational numbers
       *
       * Ex: new Fraction("-17.(345)").mul(3) => 5776 / 111
       **/
      "mul": function (a, b) {

        parse(a, b);
        return newFraction(
          this["s"] * P$1["s"] * this["n"] * P$1["n"],
          this["d"] * P$1["d"]
        );
      },

      /**
       * Divides two rational numbers
       *
       * Ex: new Fraction("-17.(345)").inverse().div(3)
       **/
      "div": function (a, b) {

        parse(a, b);
        return newFraction(
          this["s"] * P$1["s"] * this["n"] * P$1["d"],
          this["d"] * P$1["n"]
        );
      },

      /**
       * Clones the actual object
       *
       * Ex: new Fraction("-17.(345)").clone()
       **/
      "clone": function () {
        return newFraction(this['s'] * this['n'], this['d']);
      },

      /**
       * Calculates the modulo of two rational numbers - a more precise fmod
       *
       * Ex: new Fraction('4.(3)').mod([7, 8]) => (13/3) % (7/8) = (5/6)
       * Ex: new Fraction(20, 10).mod().equals(0) ? "is Integer"
       **/
      "mod": function (a, b) {

        if (a === undefined) {
          return newFraction(this["s"] * this["n"] % this["d"], C_ONE);
        }

        parse(a, b);
        if (C_ZERO === P$1["n"] * this["d"]) {
          throw DivisionByZero();
        }

        /**
         * I derived the rational modulo similar to the modulo for integers
         *
         * https://raw.org/book/analysis/rational-numbers/
         *
         *    n1/d1 = (n2/d2) * q + r, where 0 ≤ r < n2/d2
         * => d2 * n1 = n2 * d1 * q + d1 * d2 * r
         * => r = (d2 * n1 - n2 * d1 * q) / (d1 * d2)
         *      = (d2 * n1 - n2 * d1 * floor((d2 * n1) / (n2 * d1))) / (d1 * d2)
         *      = ((d2 * n1) % (n2 * d1)) / (d1 * d2)
         */
        return newFraction(
          this["s"] * (P$1["d"] * this["n"]) % (P$1["n"] * this["d"]),
          P$1["d"] * this["d"]);
      },

      /**
       * Calculates the fractional gcd of two rational numbers
       *
       * Ex: new Fraction(5,8).gcd(3,7) => 1/56
       */
      "gcd": function (a, b) {

        parse(a, b);

        // https://raw.org/book/analysis/rational-numbers/
        // gcd(a / b, c / d) = gcd(a, c) / lcm(b, d)

        return newFraction(gcd(P$1["n"], this["n"]) * gcd(P$1["d"], this["d"]), P$1["d"] * this["d"]);
      },

      /**
       * Calculates the fractional lcm of two rational numbers
       *
       * Ex: new Fraction(5,8).lcm(3,7) => 15
       */
      "lcm": function (a, b) {

        parse(a, b);

        // https://raw.org/book/analysis/rational-numbers/
        // lcm(a / b, c / d) = lcm(a, c) / gcd(b, d)

        if (P$1["n"] === C_ZERO && this["n"] === C_ZERO) {
          return newFraction(C_ZERO, C_ONE);
        }
        return newFraction(P$1["n"] * this["n"], gcd(P$1["n"], this["n"]) * gcd(P$1["d"], this["d"]));
      },

      /**
       * Gets the inverse of the fraction, means numerator and denominator are exchanged
       *
       * Ex: new Fraction([-3, 4]).inverse() => -4 / 3
       **/
      "inverse": function () {
        return newFraction(this["s"] * this["d"], this["n"]);
      },

      /**
       * Calculates the fraction to some integer exponent
       *
       * Ex: new Fraction(-1,2).pow(-3) => -8
       */
      "pow": function (a, b) {

        parse(a, b);

        // Trivial case when exp is an integer

        if (P$1['d'] === C_ONE) {

          if (P$1['s'] < C_ZERO) {
            return newFraction((this['s'] * this["d"]) ** P$1['n'], this["n"] ** P$1['n']);
          } else {
            return newFraction((this['s'] * this["n"]) ** P$1['n'], this["d"] ** P$1['n']);
          }
        }

        // Negative roots become complex
        //     (-a/b)^(c/d) = x
        // ⇔ (-1)^(c/d) * (a/b)^(c/d) = x
        // ⇔ (cos(pi) + i*sin(pi))^(c/d) * (a/b)^(c/d) = x
        // ⇔ (cos(c*pi/d) + i*sin(c*pi/d)) * (a/b)^(c/d) = x       # DeMoivre's formula
        // From which follows that only for c=0 the root is non-complex
        if (this['s'] < C_ZERO) return null;

        // Now prime factor n and d
        let N = factorize(this['n']);
        let D = factorize(this['d']);

        // Exponentiate and take root for n and d individually
        let n = C_ONE;
        let d = C_ONE;
        for (let k in N) {
          if (k === '1') continue;
          if (k === '0') {
            n = C_ZERO;
            break;
          }
          N[k] *= P$1['n'];

          if (N[k] % P$1['d'] === C_ZERO) {
            N[k] /= P$1['d'];
          } else return null;
          n *= BigInt(k) ** N[k];
        }

        for (let k in D) {
          if (k === '1') continue;
          D[k] *= P$1['n'];

          if (D[k] % P$1['d'] === C_ZERO) {
            D[k] /= P$1['d'];
          } else return null;
          d *= BigInt(k) ** D[k];
        }

        if (P$1['s'] < C_ZERO) {
          return newFraction(d, n);
        }
        return newFraction(n, d);
      },

      /**
       * Calculates the logarithm of a fraction to a given rational base
       *
       * Ex: new Fraction(27, 8).log(9, 4) => 3/2
       */
      "log": function (a, b) {

        parse(a, b);

        if (this['s'] <= C_ZERO || P$1['s'] <= C_ZERO) return null;

        const allPrimes = {};

        const baseFactors = factorize(P$1['n']);
        const T1 = factorize(P$1['d']);

        const numberFactors = factorize(this['n']);
        const T2 = factorize(this['d']);

        for (const prime in T1) {
          baseFactors[prime] = (baseFactors[prime] || C_ZERO) - T1[prime];
        }
        for (const prime in T2) {
          numberFactors[prime] = (numberFactors[prime] || C_ZERO) - T2[prime];
        }

        for (const prime in baseFactors) {
          if (prime === '1') continue;
          allPrimes[prime] = true;
        }
        for (const prime in numberFactors) {
          if (prime === '1') continue;
          allPrimes[prime] = true;
        }

        let retN = null;
        let retD = null;

        // Iterate over all unique primes to determine if a consistent ratio exists
        for (const prime in allPrimes) {

          const baseExponent = baseFactors[prime] || C_ZERO;
          const numberExponent = numberFactors[prime] || C_ZERO;

          if (baseExponent === C_ZERO) {
            if (numberExponent !== C_ZERO) {
              return null; // Logarithm cannot be expressed as a rational number
            }
            continue; // Skip this prime since both exponents are zero
          }

          // Calculate the ratio of exponents for this prime
          let curN = numberExponent;
          let curD = baseExponent;

          // Simplify the current ratio
          const gcdValue = gcd(curN, curD);
          curN /= gcdValue;
          curD /= gcdValue;

          // Check if this is the first ratio; otherwise, ensure ratios are consistent
          if (retN === null && retD === null) {
            retN = curN;
            retD = curD;
          } else if (curN * retD !== retN * curD) {
            return null; // Ratios do not match, logarithm cannot be rational
          }
        }

        return retN !== null && retD !== null
          ? newFraction(retN, retD)
          : null;
      },

      /**
       * Check if two rational numbers are the same
       *
       * Ex: new Fraction(19.6).equals([98, 5]);
       **/
      "equals": function (a, b) {

        parse(a, b);
        return this["s"] * this["n"] * P$1["d"] === P$1["s"] * P$1["n"] * this["d"];
      },

      /**
       * Check if this rational number is less than another
       *
       * Ex: new Fraction(19.6).lt([98, 5]);
       **/
      "lt": function (a, b) {

        parse(a, b);
        return this["s"] * this["n"] * P$1["d"] < P$1["s"] * P$1["n"] * this["d"];
      },

      /**
       * Check if this rational number is less than or equal another
       *
       * Ex: new Fraction(19.6).lt([98, 5]);
       **/
      "lte": function (a, b) {

        parse(a, b);
        return this["s"] * this["n"] * P$1["d"] <= P$1["s"] * P$1["n"] * this["d"];
      },

      /**
       * Check if this rational number is greater than another
       *
       * Ex: new Fraction(19.6).lt([98, 5]);
       **/
      "gt": function (a, b) {

        parse(a, b);
        return this["s"] * this["n"] * P$1["d"] > P$1["s"] * P$1["n"] * this["d"];
      },

      /**
       * Check if this rational number is greater than or equal another
       *
       * Ex: new Fraction(19.6).lt([98, 5]);
       **/
      "gte": function (a, b) {

        parse(a, b);
        return this["s"] * this["n"] * P$1["d"] >= P$1["s"] * P$1["n"] * this["d"];
      },

      /**
       * Compare two rational numbers
       * < 0 iff this < that
       * > 0 iff this > that
       * = 0 iff this = that
       *
       * Ex: new Fraction(19.6).compare([98, 5]);
       **/
      "compare": function (a, b) {

        parse(a, b);
        let t = this["s"] * this["n"] * P$1["d"] - P$1["s"] * P$1["n"] * this["d"];

        return (C_ZERO < t) - (t < C_ZERO);
      },

      /**
       * Calculates the ceil of a rational number
       *
       * Ex: new Fraction('4.(3)').ceil() => (5 / 1)
       **/
      "ceil": function (places) {

        places = C_TEN ** BigInt(places || 0);

        return newFraction(trunc(this["s"] * places * this["n"] / this["d"]) +
          (places * this["n"] % this["d"] > C_ZERO && this["s"] >= C_ZERO ? C_ONE : C_ZERO),
          places);
      },

      /**
       * Calculates the floor of a rational number
       *
       * Ex: new Fraction('4.(3)').floor() => (4 / 1)
       **/
      "floor": function (places) {

        places = C_TEN ** BigInt(places || 0);

        return newFraction(trunc(this["s"] * places * this["n"] / this["d"]) -
          (places * this["n"] % this["d"] > C_ZERO && this["s"] < C_ZERO ? C_ONE : C_ZERO),
          places);
      },

      /**
       * Rounds a rational numbers
       *
       * Ex: new Fraction('4.(3)').round() => (4 / 1)
       **/
      "round": function (places) {

        places = C_TEN ** BigInt(places || 0);

        /* Derivation:

        s >= 0:
          round(n / d) = trunc(n / d) + (n % d) / d >= 0.5 ? 1 : 0
                       = trunc(n / d) + 2(n % d) >= d ? 1 : 0
        s < 0:
          round(n / d) =-trunc(n / d) - (n % d) / d > 0.5 ? 1 : 0
                       =-trunc(n / d) - 2(n % d) > d ? 1 : 0

        =>:

        round(s * n / d) = s * trunc(n / d) + s * (C + 2(n % d) > d ? 1 : 0)
            where C = s >= 0 ? 1 : 0, to fix the >= for the positve case.
        */

        return newFraction(trunc(this["s"] * places * this["n"] / this["d"]) +
          this["s"] * ((this["s"] >= C_ZERO ? C_ONE : C_ZERO) + C_TWO * (places * this["n"] % this["d"]) > this["d"] ? C_ONE : C_ZERO),
          places);
      },

      /**
        * Rounds a rational number to a multiple of another rational number
        *
        * Ex: new Fraction('0.9').roundTo("1/8") => 7 / 8
        **/
      "roundTo": function (a, b) {

        /*
        k * x/y ≤ a/b < (k+1) * x/y
        ⇔ k ≤ a/b / (x/y) < (k+1)
        ⇔ k = floor(a/b * y/x)
        ⇔ k = floor((a * y) / (b * x))
        */

        parse(a, b);

        const n = this['n'] * P$1['d'];
        const d = this['d'] * P$1['n'];
        const r = n % d;

        // round(n / d) = trunc(n / d) + 2(n % d) >= d ? 1 : 0
        let k = trunc(n / d);
        if (r + r >= d) {
          k++;
        }
        return newFraction(this['s'] * k * P$1['n'], P$1['d']);
      },

      /**
       * Check if two rational numbers are divisible
       *
       * Ex: new Fraction(19.6).divisible(1.5);
       */
      "divisible": function (a, b) {

        parse(a, b);
        return !(!(P$1["n"] * this["d"]) || ((this["n"] * P$1["d"]) % (P$1["n"] * this["d"])));
      },

      /**
       * Returns a decimal representation of the fraction
       *
       * Ex: new Fraction("100.'91823'").valueOf() => 100.91823918239183
       **/
      'valueOf': function () {
        // Best we can do so far
        return Number(this["s"] * this["n"]) / Number(this["d"]);
      },

      /**
       * Creates a string representation of a fraction with all digits
       *
       * Ex: new Fraction("100.'91823'").toString() => "100.(91823)"
       **/
      'toString': function (dec) {

        let N = this["n"];
        let D = this["d"];

        dec = dec || 15; // 15 = decimal places when no repetition

        let cycLen = cycleLen(N, D); // Cycle length
        let cycOff = cycleStart(N, D, cycLen); // Cycle start

        let str = this['s'] < C_ZERO ? "-" : "";

        // Append integer part
        str += trunc(N / D);

        N %= D;
        N *= C_TEN;

        if (N)
          str += ".";

        if (cycLen) {

          for (let i = cycOff; i--;) {
            str += trunc(N / D);
            N %= D;
            N *= C_TEN;
          }
          str += "(";
          for (let i = cycLen; i--;) {
            str += trunc(N / D);
            N %= D;
            N *= C_TEN;
          }
          str += ")";
        } else {
          for (let i = dec; N && i--;) {
            str += trunc(N / D);
            N %= D;
            N *= C_TEN;
          }
        }
        return str;
      },

      /**
       * Returns a string-fraction representation of a Fraction object
       *
       * Ex: new Fraction("1.'3'").toFraction() => "4 1/3"
       **/
      'toFraction': function (showMixed) {

        let n = this["n"];
        let d = this["d"];
        let str = this['s'] < C_ZERO ? "-" : "";

        if (d === C_ONE) {
          str += n;
        } else {
          let whole = trunc(n / d);
          if (showMixed && whole > C_ZERO) {
            str += whole;
            str += " ";
            n %= d;
          }

          str += n;
          str += '/';
          str += d;
        }
        return str;
      },

      /**
       * Returns a latex representation of a Fraction object
       *
       * Ex: new Fraction("1.'3'").toLatex() => "\frac{4}{3}"
       **/
      'toLatex': function (showMixed) {

        let n = this["n"];
        let d = this["d"];
        let str = this['s'] < C_ZERO ? "-" : "";

        if (d === C_ONE) {
          str += n;
        } else {
          let whole = trunc(n / d);
          if (showMixed && whole > C_ZERO) {
            str += whole;
            n %= d;
          }

          str += "\\frac{";
          str += n;
          str += '}{';
          str += d;
          str += '}';
        }
        return str;
      },

      /**
       * Returns an array of continued fraction elements
       *
       * Ex: new Fraction("7/8").toContinued() => [0,1,7]
       */
      'toContinued': function () {

        let a = this['n'];
        let b = this['d'];
        let res = [];

        do {
          res.push(trunc(a / b));
          let t = a % b;
          a = b;
          b = t;
        } while (a !== C_ONE);

        return res;
      },

      "simplify": function (eps) {

        const ieps = BigInt(1 / (eps || 0.001) | 0);

        const thisABS = this['abs']();
        const cont = thisABS['toContinued']();

        for (let i = 1; i < cont.length; i++) {

          let s = newFraction(cont[i - 1], C_ONE);
          for (let k = i - 2; k >= 0; k--) {
            s = s['inverse']()['add'](cont[k]);
          }

          let t = s['sub'](thisABS);
          if (t['n'] * ieps < t['d']) { // More robust than Math.abs(t.valueOf()) < eps
            return s['mul'](this['s']);
          }
        }
        return this;
      }
    };

    var name$t = 'Fraction';
    var dependencies$t = [];
    var createFractionClass = /* #__PURE__ */factory(name$t, dependencies$t, () => {
      /**
       * Attach type information
       */
      Object.defineProperty(Fraction$1, 'name', {
        value: 'Fraction'
      });
      Fraction$1.prototype.constructor = Fraction$1;
      Fraction$1.prototype.type = 'Fraction';
      Fraction$1.prototype.isFraction = true;

      /**
       * Get a JSON representation of a Fraction containing type information
       * @returns {Object} Returns a JSON object structured as:
       *                   `{"mathjs": "Fraction", "n": "3", "d": "8"}`
       */
      Fraction$1.prototype.toJSON = function () {
        return {
          mathjs: 'Fraction',
          n: String(this.s * this.n),
          d: String(this.d)
        };
      };

      /**
       * Instantiate a Fraction from a JSON object
       * @param {Object} json  a JSON object structured as:
       *                       `{"mathjs": "Fraction", "n": "3", "d": "8"}`
       * @return {BigNumber}
       */
      Fraction$1.fromJSON = function (json) {
        return new Fraction$1(json);
      };
      return Fraction$1;
    }, {
      isClass: true
    });

    var name$s = 'Matrix';
    var dependencies$s = [];
    var createMatrixClass = /* #__PURE__ */factory(name$s, dependencies$s, () => {
      /**
       * @constructor Matrix
       *
       * A Matrix is a wrapper around an Array. A matrix can hold a multi dimensional
       * array. A matrix can be constructed as:
       *
       *     let matrix = math.matrix(data)
       *
       * Matrix contains the functions to resize, get and set values, get the size,
       * clone the matrix and to convert the matrix to a vector, array, or scalar.
       * Furthermore, one can iterate over the matrix using map and forEach.
       * The internal Array of the Matrix can be accessed using the function valueOf.
       *
       * Example usage:
       *
       *     let matrix = math.matrix([[1, 2], [3, 4]])
       *     matix.size()              // [2, 2]
       *     matrix.resize([3, 2], 5)
       *     matrix.valueOf()          // [[1, 2], [3, 4], [5, 5]]
       *     matrix.subset([1,2])       // 3 (indexes are zero-based)
       *
       */
      function Matrix() {
        if (!(this instanceof Matrix)) {
          throw new SyntaxError('Constructor must be called with the new operator');
        }
      }

      /**
       * Attach type information
       */
      Matrix.prototype.type = 'Matrix';
      Matrix.prototype.isMatrix = true;

      /**
       * Get the storage format used by the matrix.
       *
       * Usage:
       *     const format = matrix.storage()   // retrieve storage format
       *
       * @return {string}           The storage format.
       */
      Matrix.prototype.storage = function () {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke storage on a Matrix interface');
      };

      /**
       * Get the datatype of the data stored in the matrix.
       *
       * Usage:
       *     const format = matrix.datatype()    // retrieve matrix datatype
       *
       * @return {string}           The datatype.
       */
      Matrix.prototype.datatype = function () {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke datatype on a Matrix interface');
      };

      /**
       * Create a new Matrix With the type of the current matrix instance
       * @param {Array | Object} data
       * @param {string} [datatype]
       */
      Matrix.prototype.create = function (data, datatype) {
        throw new Error('Cannot invoke create on a Matrix interface');
      };

      /**
       * Get a subset of the matrix, or replace a subset of the matrix.
       *
       * Usage:
       *     const subset = matrix.subset(index)               // retrieve subset
       *     const value = matrix.subset(index, replacement)   // replace subset
       *
       * @param {Index} index
       * @param {Array | Matrix | *} [replacement]
       * @param {*} [defaultValue=0]      Default value, filled in on new entries when
       *                                  the matrix is resized. If not provided,
       *                                  new matrix elements will be filled with zeros.
       */
      Matrix.prototype.subset = function (index, replacement, defaultValue) {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke subset on a Matrix interface');
      };

      /**
       * Get a single element from the matrix.
       * @param {number[]} index   Zero-based index
       * @return {*} value
       */
      Matrix.prototype.get = function (index) {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke get on a Matrix interface');
      };

      /**
       * Replace a single element in the matrix.
       * @param {number[]} index   Zero-based index
       * @param {*} value
       * @param {*} [defaultValue]        Default value, filled in on new entries when
       *                                  the matrix is resized. If not provided,
       *                                  new matrix elements will be left undefined.
       * @return {Matrix} self
       */
      Matrix.prototype.set = function (index, value, defaultValue) {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke set on a Matrix interface');
      };

      /**
       * Resize the matrix to the given size. Returns a copy of the matrix when
       * `copy=true`, otherwise return the matrix itself (resize in place).
       *
       * @param {number[]} size           The new size the matrix should have.
       * @param {*} [defaultValue=0]      Default value, filled in on new entries.
       *                                  If not provided, the matrix elements will
       *                                  be filled with zeros.
       * @param {boolean} [copy]          Return a resized copy of the matrix
       *
       * @return {Matrix}                 The resized matrix
       */
      Matrix.prototype.resize = function (size, defaultValue) {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke resize on a Matrix interface');
      };

      /**
       * Reshape the matrix to the given size. Returns a copy of the matrix when
       * `copy=true`, otherwise return the matrix itself (reshape in place).
       *
       * @param {number[]} size           The new size the matrix should have.
       * @param {boolean} [copy]          Return a reshaped copy of the matrix
       *
       * @return {Matrix}                 The reshaped matrix
       */
      Matrix.prototype.reshape = function (size, defaultValue) {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke reshape on a Matrix interface');
      };

      /**
       * Create a clone of the matrix
       * @return {Matrix} clone
       */
      Matrix.prototype.clone = function () {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke clone on a Matrix interface');
      };

      /**
       * Retrieve the size of the matrix.
       * @returns {number[]} size
       */
      Matrix.prototype.size = function () {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke size on a Matrix interface');
      };

      /**
       * Create a new matrix with the results of the callback function executed on
       * each entry of the matrix.
       * @param {Function} callback   The callback function is invoked with three
       *                              parameters: the value of the element, the index
       *                              of the element, and the Matrix being traversed.
       * @param {boolean} [skipZeros] Invoke callback function for non-zero values only.
       *
       * @return {Matrix} matrix
       */
      Matrix.prototype.map = function (callback, skipZeros) {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke map on a Matrix interface');
      };

      /**
       * Execute a callback function on each entry of the matrix.
       * @param {Function} callback   The callback function is invoked with three
       *                              parameters: the value of the element, the index
       *                              of the element, and the Matrix being traversed.
       */
      Matrix.prototype.forEach = function (callback) {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke forEach on a Matrix interface');
      };

      /**
       * Iterate over the matrix elements
       * @return {Iterable<{ value, index: number[] }>}
       */
      Matrix.prototype[Symbol.iterator] = function () {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot iterate a Matrix interface');
      };

      /**
       * Create an Array with a copy of the data of the Matrix
       * @returns {Array} array
       */
      Matrix.prototype.toArray = function () {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke toArray on a Matrix interface');
      };

      /**
       * Get the primitive value of the Matrix: a multidimensional array
       * @returns {Array} array
       */
      Matrix.prototype.valueOf = function () {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke valueOf on a Matrix interface');
      };

      /**
       * Get a string representation of the matrix, with optional formatting options.
       * @param {Object | number | Function} [options]  Formatting options. See
       *                                                lib/utils/number:format for a
       *                                                description of the available
       *                                                options.
       * @returns {string} str
       */
      Matrix.prototype.format = function (options) {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke format on a Matrix interface');
      };

      /**
       * Get a string representation of the matrix
       * @returns {string} str
       */
      Matrix.prototype.toString = function () {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke toString on a Matrix interface');
      };
      return Matrix;
    }, {
      isClass: true
    });

    /**
     * Formats a BigNumber in a given base
     * @param {BigNumber} n
     * @param {number} base
     * @param {number} size
     * @returns {string}
     */
    function formatBigNumberToBase(n, base, size) {
      var BigNumberCtor = n.constructor;
      var big2 = new BigNumberCtor(2);
      var suffix = '';
      if (size) {
        if (size < 1) {
          throw new Error('size must be in greater than 0');
        }
        if (!isInteger(size)) {
          throw new Error('size must be an integer');
        }
        if (n.greaterThan(big2.pow(size - 1).sub(1)) || n.lessThan(big2.pow(size - 1).mul(-1))) {
          throw new Error("Value must be in range [-2^".concat(size - 1, ", 2^").concat(size - 1, "-1]"));
        }
        if (!n.isInteger()) {
          throw new Error('Value must be an integer');
        }
        if (n.lessThan(0)) {
          n = n.add(big2.pow(size));
        }
        suffix = "i".concat(size);
      }
      switch (base) {
        case 2:
          return "".concat(n.toBinary()).concat(suffix);
        case 8:
          return "".concat(n.toOctal()).concat(suffix);
        case 16:
          return "".concat(n.toHexadecimal()).concat(suffix);
        default:
          throw new Error("Base ".concat(base, " not supported "));
      }
    }

    /**
     * Convert a BigNumber to a formatted string representation.
     *
     * Syntax:
     *
     *    format(value)
     *    format(value, options)
     *    format(value, precision)
     *    format(value, fn)
     *
     * Where:
     *
     *    {number} value   The value to be formatted
     *    {Object} options An object with formatting options. Available options:
     *                     {string} notation
     *                         Number notation. Choose from:
     *                         'fixed'          Always use regular number notation.
     *                                          For example '123.40' and '14000000'
     *                         'exponential'    Always use exponential notation.
     *                                          For example '1.234e+2' and '1.4e+7'
     *                         'auto' (default) Regular number notation for numbers
     *                                          having an absolute value between
     *                                          `lower` and `upper` bounds, and uses
     *                                          exponential notation elsewhere.
     *                                          Lower bound is included, upper bound
     *                                          is excluded.
     *                                          For example '123.4' and '1.4e7'.
     *                         'bin', 'oct, or
     *                         'hex'            Format the number using binary, octal,
     *                                          or hexadecimal notation.
     *                                          For example '0b1101' and '0x10fe'.
     *                     {number} wordSize    The word size in bits to use for formatting
     *                                          in binary, octal, or hexadecimal notation.
     *                                          To be used only with 'bin', 'oct', or 'hex'
     *                                          values for 'notation' option. When this option
     *                                          is defined the value is formatted as a signed
     *                                          twos complement integer of the given word size
     *                                          and the size suffix is appended to the output.
     *                                          For example
     *                                          format(-1, {notation: 'hex', wordSize: 8}) === '0xffi8'.
     *                                          Default value is undefined.
     *                     {number} precision   A number between 0 and 16 to round
     *                                          the digits of the number.
     *                                          In case of notations 'exponential',
     *                                          'engineering', and 'auto',
     *                                          `precision` defines the total
     *                                          number of significant digits returned.
     *                                          In case of notation 'fixed',
     *                                          `precision` defines the number of
     *                                          significant digits after the decimal
     *                                          point.
     *                                          `precision` is undefined by default.
     *                     {number} lowerExp    Exponent determining the lower boundary
     *                                          for formatting a value with an exponent
     *                                          when `notation='auto`.
     *                                          Default value is `-3`.
     *                     {number} upperExp    Exponent determining the upper boundary
     *                                          for formatting a value with an exponent
     *                                          when `notation='auto`.
     *                                          Default value is `5`.
     *    {Function} fn    A custom formatting function. Can be used to override the
     *                     built-in notations. Function `fn` is called with `value` as
     *                     parameter and must return a string. Is useful for example to
     *                     format all values inside a matrix in a particular way.
     *
     * Examples:
     *
     *    format(6.4)                                        // '6.4'
     *    format(1240000)                                    // '1.24e6'
     *    format(1/3)                                        // '0.3333333333333333'
     *    format(1/3, 3)                                     // '0.333'
     *    format(21385, 2)                                   // '21000'
     *    format(12e8, {notation: 'fixed'})                  // returns '1200000000'
     *    format(2.3,    {notation: 'fixed', precision: 4})  // returns '2.3000'
     *    format(52.8,   {notation: 'exponential'})          // returns '5.28e+1'
     *    format(12400,  {notation: 'engineering'})          // returns '12.400e+3'
     *
     * @param {BigNumber} value
     * @param {Object | Function | number | BigNumber} [options]
     * @return {string} str The formatted value
     */
    function format$1(value, options) {
      if (typeof options === 'function') {
        // handle format(value, fn)
        return options(value);
      }

      // handle special cases
      if (!value.isFinite()) {
        return value.isNaN() ? 'NaN' : value.gt(0) ? 'Infinity' : '-Infinity';
      }
      var {
        notation,
        precision,
        wordSize
      } = normalizeFormatOptions(options);

      // handle the various notations
      switch (notation) {
        case 'fixed':
          return toFixed(value, precision);
        case 'exponential':
          return toExponential(value, precision);
        case 'engineering':
          return toEngineering(value, precision);
        case 'bin':
          return formatBigNumberToBase(value, 2, wordSize);
        case 'oct':
          return formatBigNumberToBase(value, 8, wordSize);
        case 'hex':
          return formatBigNumberToBase(value, 16, wordSize);
        case 'auto':
          {
            // determine lower and upper bound for exponential notation.
            // TODO: implement support for upper and lower to be BigNumbers themselves
            var lowerExp = _toNumberOrDefault(options === null || options === void 0 ? void 0 : options.lowerExp, -3);
            var upperExp = _toNumberOrDefault(options === null || options === void 0 ? void 0 : options.upperExp, 5);

            // handle special case zero
            if (value.isZero()) return '0';

            // determine whether or not to output exponential notation
            var str;
            var rounded = value.toSignificantDigits(precision);
            var exp = rounded.e;
            if (exp >= lowerExp && exp < upperExp) {
              // normal number notation
              str = rounded.toFixed();
            } else {
              // exponential notation
              str = toExponential(value, precision);
            }

            // remove trailing zeros after the decimal point
            return str.replace(/((\.\d*?)(0+))($|e)/, function () {
              var digits = arguments[2];
              var e = arguments[4];
              return digits !== '.' ? digits + e : e;
            });
          }
        default:
          throw new Error('Unknown notation "' + notation + '". ' + 'Choose "auto", "exponential", "fixed", "bin", "oct", or "hex.');
      }
    }

    /**
     * Format a BigNumber in engineering notation. Like '1.23e+6', '2.3e+0', '3.500e-3'
     * @param {BigNumber} value
     * @param {number} [precision]        Optional number of significant figures to return.
     */
    function toEngineering(value, precision) {
      // find nearest lower multiple of 3 for exponent
      var e = value.e;
      var newExp = e % 3 === 0 ? e : e < 0 ? e - 3 - e % 3 : e - e % 3;

      // find difference in exponents, and calculate the value without exponent
      var valueWithoutExp = value.mul(Math.pow(10, -newExp));
      var valueStr = valueWithoutExp.toPrecision(precision);
      if (valueStr.includes('e')) {
        var BigNumber = value.constructor;
        valueStr = new BigNumber(valueStr).toFixed();
      }
      return valueStr + 'e' + (e >= 0 ? '+' : '') + newExp.toString();
    }

    /**
     * Format a number in exponential notation. Like '1.23e+5', '2.3e+0', '3.500e-3'
     * @param {BigNumber} value
     * @param {number} [precision]  Number of digits in formatted output.
     *                              If not provided, the maximum available digits
     *                              is used.
     * @returns {string} str
     */
    function toExponential(value, precision) {
      if (precision !== undefined) {
        return value.toExponential(precision - 1); // Note the offset of one
      } else {
        return value.toExponential();
      }
    }

    /**
     * Format a number with fixed notation.
     * @param {BigNumber} value
     * @param {number} [precision=undefined] Optional number of decimals after the
     *                                       decimal point. Undefined by default.
     */
    function toFixed(value, precision) {
      return value.toFixed(precision);
    }
    function _toNumberOrDefault(value, defaultValue) {
      if (isNumber(value)) {
        return value;
      } else if (isBigNumber(value)) {
        return value.toNumber();
      } else {
        return defaultValue;
      }
    }

    /**
     * Format a value of any type into a string.
     *
     * Usage:
     *     math.format(value)
     *     math.format(value, precision)
     *     math.format(value, options)
     *
     * When value is a function:
     *
     * - When the function has a property `syntax`, it returns this
     *   syntax description.
     * - In other cases, a string `'function'` is returned.
     *
     * When `value` is an Object:
     *
     * - When the object contains a property `format` being a function, this
     *   function is invoked as `value.format(options)` and the result is returned.
     * - When the object has its own `toString` method, this method is invoked
     *   and the result is returned.
     * - In other cases the function will loop over all object properties and
     *   return JSON object notation like '{"a": 2, "b": 3}'.
     *
     * Example usage:
     *     math.format(2/7)                // '0.2857142857142857'
     *     math.format(math.pi, 3)         // '3.14'
     *     math.format(new Complex(2, 3))  // '2 + 3i'
     *     math.format('hello')            // '"hello"'
     *
     * @param {*} value             Value to be stringified
     * @param {Object | number | Function} [options]
     *     Formatting options. See src/utils/number.js:format for a
     *     description of the available options controlling number output.
     *     This generic "format" also supports the option property `truncate: NN`
     *     giving the maximum number NN of characters to return (if there would
     *     have been more, they are deleted and replaced by an ellipsis).
     * @return {string} str
     */
    function format(value, options) {
      var result = _format(value, options);
      if (options && typeof options === 'object' && 'truncate' in options && result.length > options.truncate) {
        return result.substring(0, options.truncate - 3) + '...';
      }
      return result;
    }
    function _format(value, options) {
      if (typeof value === 'number') {
        return format$2(value, options);
      }
      if (isBigNumber(value)) {
        return format$1(value, options);
      }

      // note: we use unsafe duck-typing here to check for Fractions, this is
      // ok here since we're only invoking toString or concatenating its values
      if (looksLikeFraction(value)) {
        if (!options || options.fraction !== 'decimal') {
          // output as ratio, like '1/3'
          return "".concat(value.s * value.n, "/").concat(value.d);
        } else {
          // output as decimal, like '0.(3)'
          return value.toString();
        }
      }
      if (Array.isArray(value)) {
        return formatArray(value, options);
      }
      if (isString(value)) {
        return stringify(value);
      }
      if (typeof value === 'function') {
        return value.syntax ? String(value.syntax) : 'function';
      }
      if (value && typeof value === 'object') {
        if (typeof value.format === 'function') {
          return value.format(options);
        } else if (value && value.toString(options) !== {}.toString()) {
          // this object has a non-native toString method, use that one
          return value.toString(options);
        } else {
          var entries = Object.keys(value).map(key => {
            return stringify(key) + ': ' + format(value[key], options);
          });
          return '{' + entries.join(', ') + '}';
        }
      }
      return String(value);
    }

    /**
     * Stringify a value into a string enclosed in double quotes.
     * Unescaped double quotes and backslashes inside the value are escaped.
     * @param {*} value
     * @return {string}
     */
    function stringify(value) {
      var text = String(value);
      var escaped = '';
      var i = 0;
      while (i < text.length) {
        var c = text.charAt(i);
        escaped += c in controlCharacters ? controlCharacters[c] : c;
        i++;
      }
      return '"' + escaped + '"';
    }
    var controlCharacters = {
      '"': '\\"',
      '\\': '\\\\',
      '\b': '\\b',
      '\f': '\\f',
      '\n': '\\n',
      '\r': '\\r',
      '\t': '\\t'
    };

    /**
     * Recursively format an n-dimensional matrix
     * Example output: "[[1, 2], [3, 4]]"
     * @param {Array} array
     * @param {Object | number | Function} [options]  Formatting options. See
     *                                                lib/utils/number:format for a
     *                                                description of the available
     *                                                options.
     * @returns {string} str
     */
    function formatArray(array, options) {
      if (Array.isArray(array)) {
        var str = '[';
        var len = array.length;
        for (var i = 0; i < len; i++) {
          if (i !== 0) {
            str += ', ';
          }
          str += formatArray(array[i], options);
        }
        str += ']';
        return str;
      } else {
        return format(array, options);
      }
    }

    /**
     * Check whether a value looks like a Fraction (unsafe duck-type check)
     * @param {*} value
     * @return {boolean}
     */
    function looksLikeFraction(value) {
      return value && typeof value === 'object' && typeof value.s === 'bigint' && typeof value.n === 'bigint' && typeof value.d === 'bigint' || false;
    }

    /**
     * Create a range error with the message:
     *     'Dimension mismatch (<actual size> != <expected size>)'
     * @param {number | number[]} actual        The actual size
     * @param {number | number[]} expected      The expected size
     * @param {string} [relation='!=']          Optional relation between actual
     *                                          and expected size: '!=', '<', etc.
     * @extends RangeError
     */
    function DimensionError(actual, expected, relation) {
      if (!(this instanceof DimensionError)) {
        throw new SyntaxError('Constructor must be called with the new operator');
      }
      this.actual = actual;
      this.expected = expected;
      this.relation = relation;
      this.message = 'Dimension mismatch (' + (Array.isArray(actual) ? '[' + actual.join(', ') + ']' : actual) + ' ' + (this.relation || '!=') + ' ' + (Array.isArray(expected) ? '[' + expected.join(', ') + ']' : expected) + ')';
      this.stack = new Error().stack;
    }
    DimensionError.prototype = new RangeError();
    DimensionError.prototype.constructor = RangeError;
    DimensionError.prototype.name = 'DimensionError';
    DimensionError.prototype.isDimensionError = true;

    /**
     * Create a range error with the message:
     *     'Index out of range (index < min)'
     *     'Index out of range (index < max)'
     *
     * @param {number} index     The actual index
     * @param {number} [min=0]   Minimum index (included)
     * @param {number} [max]     Maximum index (excluded)
     * @extends RangeError
     */
    function IndexError(index, min, max) {
      if (!(this instanceof IndexError)) {
        throw new SyntaxError('Constructor must be called with the new operator');
      }
      this.index = index;
      if (arguments.length < 3) {
        this.min = 0;
        this.max = min;
      } else {
        this.min = min;
        this.max = max;
      }
      if (this.min !== undefined && this.index < this.min) {
        this.message = 'Index out of range (' + this.index + ' < ' + this.min + ')';
      } else if (this.max !== undefined && this.index >= this.max) {
        this.message = 'Index out of range (' + this.index + ' > ' + (this.max - 1) + ')';
      } else {
        this.message = 'Index out of range (' + this.index + ')';
      }
      this.stack = new Error().stack;
    }
    IndexError.prototype = new RangeError();
    IndexError.prototype.constructor = RangeError;
    IndexError.prototype.name = 'IndexError';
    IndexError.prototype.isIndexError = true;

    /**
     * Calculate the size of a multi dimensional array.
     * This function checks the size of the first entry, it does not validate
     * whether all dimensions match. (use function `validate` for that)
     * @param {Array} x
     * @return {number[]} size
     */
    function arraySize(x) {
      var s = [];
      while (Array.isArray(x)) {
        s.push(x.length);
        x = x[0];
      }
      return s;
    }

    /**
     * Recursively validate whether each element in a multi dimensional array
     * has a size corresponding to the provided size array.
     * @param {Array} array    Array to be validated
     * @param {number[]} size  Array with the size of each dimension
     * @param {number} dim     Current dimension
     * @throws DimensionError
     * @private
     */
    function _validate(array, size, dim) {
      var i;
      var len = array.length;
      if (len !== size[dim]) {
        throw new DimensionError(len, size[dim]);
      }
      if (dim < size.length - 1) {
        // recursively validate each child array
        var dimNext = dim + 1;
        for (i = 0; i < len; i++) {
          var child = array[i];
          if (!Array.isArray(child)) {
            throw new DimensionError(size.length - 1, size.length, '<');
          }
          _validate(array[i], size, dimNext);
        }
      } else {
        // last dimension. none of the children may be an array
        for (i = 0; i < len; i++) {
          if (Array.isArray(array[i])) {
            throw new DimensionError(size.length + 1, size.length, '>');
          }
        }
      }
    }

    /**
     * Validate whether each element in a multi dimensional array has
     * a size corresponding to the provided size array.
     * @param {Array} array    Array to be validated
     * @param {number[]} size  Array with the size of each dimension
     * @throws DimensionError
     */
    function validate(array, size) {
      var isScalar = size.length === 0;
      if (isScalar) {
        // scalar
        if (Array.isArray(array)) {
          throw new DimensionError(array.length, 0);
        }
      } else {
        // array
        _validate(array, size, 0);
      }
    }

    /**
     * Test whether index is an integer number with index >= 0 and index < length
     * when length is provided
     * @param {number} index    Zero-based index
     * @param {number} [length] Length of the array
     */
    function validateIndex(index, length) {
      if (index !== undefined) {
        if (!isNumber(index) || !isInteger(index)) {
          throw new TypeError('Index must be an integer (value: ' + index + ')');
        }
        if (index < 0 || typeof length === 'number' && index >= length) {
          throw new IndexError(index, length);
        }
      }
    }

    /**
     * Resize a multi dimensional array. The resized array is returned.
     * @param {Array | number} array         Array to be resized
     * @param {number[]} size Array with the size of each dimension
     * @param {*} [defaultValue=0]  Value to be filled in new entries,
     *                              zero by default. Specify for example `null`,
     *                              to clearly see entries that are not explicitly
     *                              set.
     * @return {Array} array         The resized array
     */
    function resize(array, size, defaultValue) {
      // check the type of the arguments
      if (!Array.isArray(size)) {
        throw new TypeError('Array expected');
      }
      if (size.length === 0) {
        throw new Error('Resizing to scalar is not supported');
      }

      // check whether size contains positive integers
      size.forEach(function (value) {
        if (!isNumber(value) || !isInteger(value) || value < 0) {
          throw new TypeError('Invalid size, must contain positive integers ' + '(size: ' + format(size) + ')');
        }
      });

      // convert number to an array
      if (isNumber(array) || isBigNumber(array)) {
        array = [array];
      }

      // recursively resize the array
      var _defaultValue = defaultValue !== undefined ? defaultValue : 0;
      _resize(array, size, 0, _defaultValue);
      return array;
    }

    /**
     * Recursively resize a multi dimensional array
     * @param {Array} array         Array to be resized
     * @param {number[]} size       Array with the size of each dimension
     * @param {number} dim          Current dimension
     * @param {*} [defaultValue]    Value to be filled in new entries,
     *                              undefined by default.
     * @private
     */
    function _resize(array, size, dim, defaultValue) {
      var i;
      var elem;
      var oldLen = array.length;
      var newLen = size[dim];
      var minLen = Math.min(oldLen, newLen);

      // apply new length
      array.length = newLen;
      if (dim < size.length - 1) {
        // non-last dimension
        var dimNext = dim + 1;

        // resize existing child arrays
        for (i = 0; i < minLen; i++) {
          // resize child array
          elem = array[i];
          if (!Array.isArray(elem)) {
            elem = [elem]; // add a dimension
            array[i] = elem;
          }
          _resize(elem, size, dimNext, defaultValue);
        }

        // create new child arrays
        for (i = minLen; i < newLen; i++) {
          // get child array
          elem = [];
          array[i] = elem;

          // resize new child array
          _resize(elem, size, dimNext, defaultValue);
        }
      } else {
        // last dimension

        // remove dimensions of existing values
        for (i = 0; i < minLen; i++) {
          while (Array.isArray(array[i])) {
            array[i] = array[i][0];
          }
        }

        // fill new elements with the default value
        for (i = minLen; i < newLen; i++) {
          array[i] = defaultValue;
        }
      }
    }

    /**
     * Re-shape a multi dimensional array to fit the specified dimensions
     * @param {Array} array           Array to be reshaped
     * @param {number[]} sizes        List of sizes for each dimension
     * @returns {Array}               Array whose data has been formatted to fit the
     *                                specified dimensions
     *
     * @throws {DimensionError}       If the product of the new dimension sizes does
     *                                not equal that of the old ones
     */
    function reshape(array, sizes) {
      var flatArray = flatten(array, true); // since it has rectangular
      var currentLength = flatArray.length;
      if (!Array.isArray(array) || !Array.isArray(sizes)) {
        throw new TypeError('Array expected');
      }
      if (sizes.length === 0) {
        throw new DimensionError(0, currentLength, '!=');
      }
      sizes = processSizesWildcard(sizes, currentLength);
      var newLength = product$1(sizes);
      if (currentLength !== newLength) {
        throw new DimensionError(newLength, currentLength, '!=');
      }
      try {
        return _reshape(flatArray, sizes);
      } catch (e) {
        if (e instanceof DimensionError) {
          throw new DimensionError(newLength, currentLength, '!=');
        }
        throw e;
      }
    }

    /**
     * Replaces the wildcard -1 in the sizes array.
     * @param {number[]} sizes  List of sizes for each dimension. At most one wildcard.
     * @param {number} currentLength  Number of elements in the array.
     * @throws {Error}                If more than one wildcard or unable to replace it.
     * @returns {number[]}      The sizes array with wildcard replaced.
     */
    function processSizesWildcard(sizes, currentLength) {
      var newLength = product$1(sizes);
      var processedSizes = sizes.slice();
      var WILDCARD = -1;
      var wildCardIndex = sizes.indexOf(WILDCARD);
      var isMoreThanOneWildcard = sizes.indexOf(WILDCARD, wildCardIndex + 1) >= 0;
      if (isMoreThanOneWildcard) {
        throw new Error('More than one wildcard in sizes');
      }
      var hasWildcard = wildCardIndex >= 0;
      var canReplaceWildcard = currentLength % newLength === 0;
      if (hasWildcard) {
        if (canReplaceWildcard) {
          processedSizes[wildCardIndex] = -currentLength / newLength;
        } else {
          throw new Error('Could not replace wildcard, since ' + currentLength + ' is no multiple of ' + -newLength);
        }
      }
      return processedSizes;
    }

    /**
     * Computes the product of all array elements.
     * @param {number[]} array Array of factors
     * @returns {number}            Product of all elements
     */
    function product$1(array) {
      return array.reduce((prev, curr) => prev * curr, 1);
    }

    /**
     * Iteratively re-shape a multi dimensional array to fit the specified dimensions
     * @param {Array} array           Array to be reshaped
     * @param {number[]} sizes  List of sizes for each dimension
     * @returns {Array}               Array whose data has been formatted to fit the
     *                                specified dimensions
     */

    function _reshape(array, sizes) {
      // testing if there are enough elements for the requested shape
      var tmpArray = array;
      var tmpArray2;
      // for each dimension starting by the last one and ignoring the first one
      for (var sizeIndex = sizes.length - 1; sizeIndex > 0; sizeIndex--) {
        var size = sizes[sizeIndex];
        tmpArray2 = [];

        // aggregate the elements of the current tmpArray in elements of the requested size
        var length = tmpArray.length / size;
        for (var i = 0; i < length; i++) {
          tmpArray2.push(tmpArray.slice(i * size, (i + 1) * size));
        }
        // set it as the new tmpArray for the next loop turn or for return
        tmpArray = tmpArray2;
      }
      return tmpArray;
    }

    /**
     * Unsqueeze a multi dimensional array: add dimensions when missing
     *
     * Parameter `size` will be mutated to match the new, unsqueezed matrix size.
     *
     * @param {Array} array
     * @param {number} dims       Desired number of dimensions of the array
     * @param {number} [outer]    Number of outer dimensions to be added
     * @param {Array} [size] Current size of array.
     * @returns {Array} returns the array itself
     * @private
     */
    function unsqueeze(array, dims, outer, size) {
      var s = size || arraySize(array);

      // unsqueeze outer dimensions
      if (outer) {
        for (var i = 0; i < outer; i++) {
          array = [array];
          s.unshift(1);
        }
      }

      // unsqueeze inner dimensions
      array = _unsqueeze(array, dims, 0);
      while (s.length < dims) {
        s.push(1);
      }
      return array;
    }

    /**
     * Recursively unsqueeze a multi dimensional array
     * @param {Array} array
     * @param {number} dims Required number of dimensions
     * @param {number} dim  Current dimension
     * @returns {Array | *} Returns the unsqueezed array
     * @private
     */
    function _unsqueeze(array, dims, dim) {
      var i, ii;
      if (Array.isArray(array)) {
        var next = dim + 1;
        for (i = 0, ii = array.length; i < ii; i++) {
          array[i] = _unsqueeze(array[i], dims, next);
        }
      } else {
        for (var d = dim; d < dims; d++) {
          array = [array];
        }
      }
      return array;
    }
    /**
     * Flatten a multi dimensional array, put all elements in a one dimensional
     * array
     * @param {Array} array   A multi dimensional array
     * @param {boolean} isRectangular Optional. If the array is rectangular (not jagged)
     * @return {Array}        The flattened array (1 dimensional)
     */
    function flatten(array) {
      var isRectangular = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
      if (!Array.isArray(array)) {
        // if not an array, return as is
        return array;
      }
      if (typeof isRectangular !== 'boolean') {
        throw new TypeError('Boolean expected for second argument of flatten');
      }
      var flat = [];
      if (isRectangular) {
        _flattenRectangular(array);
      } else {
        _flatten(array);
      }
      return flat;
      function _flatten(array) {
        for (var i = 0; i < array.length; i++) {
          var item = array[i];
          if (Array.isArray(item)) {
            _flatten(item);
          } else {
            flat.push(item);
          }
        }
      }
      function _flattenRectangular(array) {
        if (Array.isArray(array[0])) {
          for (var i = 0; i < array.length; i++) {
            _flattenRectangular(array[i]);
          }
        } else {
          for (var _i = 0; _i < array.length; _i++) {
            flat.push(array[_i]);
          }
        }
      }
    }

    /**
     * Check the datatype of a given object
     * This is a low level implementation that should only be used by
     * parent Matrix classes such as SparseMatrix or DenseMatrix
     * This method does not validate Array Matrix shape
     * @param {Array} array
     * @param {function} typeOf   Callback function to use to determine the type of a value
     * @return {string}
     */
    function getArrayDataType(array, typeOf) {
      var type; // to hold type info
      var length = 0; // to hold length value to ensure it has consistent sizes

      for (var i = 0; i < array.length; i++) {
        var item = array[i];
        var _isArray = Array.isArray(item);

        // Saving the target matrix row size
        if (i === 0 && _isArray) {
          length = item.length;
        }

        // If the current item is an array but the length does not equal the targetVectorSize
        if (_isArray && item.length !== length) {
          return undefined;
        }
        var itemType = _isArray ? getArrayDataType(item, typeOf) // recurse into a nested array
        : typeOf(item);
        if (type === undefined) {
          type = itemType; // first item
        } else if (type !== itemType) {
          return 'mixed';
        } else ;
      }
      return type;
    }

    /**
     * Recursively concatenate two matrices.
     * The contents of the matrices are not cloned.
     * @param {Array} a             Multi dimensional array
     * @param {Array} b             Multi dimensional array
     * @param {number} concatDim    The dimension on which to concatenate (zero-based)
     * @param {number} dim          The current dim (zero-based)
     * @return {Array} c            The concatenated matrix
     * @private
     */
    function concatRecursive(a, b, concatDim, dim) {
      if (dim < concatDim) {
        // recurse into next dimension
        if (a.length !== b.length) {
          throw new DimensionError(a.length, b.length);
        }
        var c = [];
        for (var i = 0; i < a.length; i++) {
          c[i] = concatRecursive(a[i], b[i], concatDim, dim + 1);
        }
        return c;
      } else {
        // concatenate this dimension
        return a.concat(b);
      }
    }

    /**
     * Concatenates many arrays in the specified direction
     * @param {...Array} arrays All the arrays to concatenate
     * @param {number} concatDim The dimension on which to concatenate (zero-based)
     * @returns {Array}
     */
    function concat() {
      var arrays = Array.prototype.slice.call(arguments, 0, -1);
      var concatDim = Array.prototype.slice.call(arguments, -1);
      if (arrays.length === 1) {
        return arrays[0];
      }
      if (arrays.length > 1) {
        return arrays.slice(1).reduce(function (A, B) {
          return concatRecursive(A, B, concatDim, 0);
        }, arrays[0]);
      } else {
        throw new Error('Wrong number of arguments in function concat');
      }
    }

    /**
     * Receives two or more sizes and gets the broadcasted size for both.
     * @param  {...number[]} sizes Sizes to broadcast together
     * @returns {number[]} The broadcasted size
     */
    function broadcastSizes() {
      for (var _len = arguments.length, sizes = new Array(_len), _key = 0; _key < _len; _key++) {
        sizes[_key] = arguments[_key];
      }
      var dimensions = sizes.map(s => s.length);
      var N = Math.max(...dimensions);
      var sizeMax = new Array(N).fill(null);
      // check for every size
      for (var i = 0; i < sizes.length; i++) {
        var size = sizes[i];
        var dim = dimensions[i];
        for (var j = 0; j < dim; j++) {
          var n = N - dim + j;
          if (size[j] > sizeMax[n]) {
            sizeMax[n] = size[j];
          }
        }
      }
      for (var _i2 = 0; _i2 < sizes.length; _i2++) {
        checkBroadcastingRules(sizes[_i2], sizeMax);
      }
      return sizeMax;
    }

    /**
     * Checks if it's possible to broadcast a size to another size
     * @param {number[]} size The size of the array to check
     * @param {number[]} toSize The size of the array to validate if it can be broadcasted to
     */
    function checkBroadcastingRules(size, toSize) {
      var N = toSize.length;
      var dim = size.length;
      for (var j = 0; j < dim; j++) {
        var n = N - dim + j;
        if (size[j] < toSize[n] && size[j] > 1 || size[j] > toSize[n]) {
          throw new Error("shape mismatch: mismatch is found in arg with shape (".concat(size, ") not possible to broadcast dimension ").concat(dim, " with size ").concat(size[j], " to size ").concat(toSize[n]));
        }
      }
    }

    /**
     * Broadcasts a single array to a certain size
     * @param {Array} array Array to be broadcasted
     * @param {number[]} toSize Size to broadcast the array
     * @returns {Array} The broadcasted array
     */
    function broadcastTo(array, toSize) {
      var Asize = arraySize(array);
      if (deepStrictEqual(Asize, toSize)) {
        return array;
      }
      checkBroadcastingRules(Asize, toSize);
      var broadcastedSize = broadcastSizes(Asize, toSize);
      var N = broadcastedSize.length;
      var paddedSize = [...Array(N - Asize.length).fill(1), ...Asize];
      var A = clone(array);
      // reshape A if needed to make it ready for concat
      if (Asize.length < N) {
        A = reshape(A, paddedSize);
        Asize = arraySize(A);
      }

      // stretches the array on each dimension to make it the same size as index
      for (var dim = 0; dim < N; dim++) {
        if (Asize[dim] < broadcastedSize[dim]) {
          A = stretch(A, broadcastedSize[dim], dim);
          Asize = arraySize(A);
        }
      }
      return A;
    }

    /**
     * Stretches a matrix up to a certain size in a certain dimension
     * @param {Array} arrayToStretch
     * @param {number[]} sizeToStretch
     * @param {number} dimToStretch
     * @returns {Array} The stretched array
     */
    function stretch(arrayToStretch, sizeToStretch, dimToStretch) {
      return concat(...Array(sizeToStretch).fill(arrayToStretch), dimToStretch);
    }

    /**
    * Retrieves a single element from an array given an index.
    *
    * @param {Array} array - The array from which to retrieve the value.
    * @param {Array<number>} index - An array of indices specifying the position of the desired element in each dimension.
    * @returns {*} - The value at the specified position in the array.
    *
    * @example
    * const arr = [[[1, 2], [3, 4]], [[5, 6], [7, 8]]];
    * const index = [1, 0, 1];
    * console.log(get(arr, index)); // 6
    */
    function get(array, index) {
      if (!Array.isArray(array)) {
        throw new Error('Array expected');
      }
      var size = arraySize(array);
      if (index.length !== size.length) {
        throw new DimensionError(index.length, size.length);
      }
      for (var x = 0; x < index.length; x++) {
        validateIndex(index[x], size[x]);
      }
      return index.reduce((acc, curr) => acc[curr], array);
    }

    /**
     * Recursively maps over each element of nested array using a provided callback function.
     *
     * @param {Array} array - The array to be mapped.
     * @param {Function} callback - The function to execute on each element, taking three arguments:
     *   - `value` (any): The current element being processed in the array.
     *   - `index` (Array<number>): The index of the current element being processed in the array.
     *   - `array` (Array): The array `deepMap` was called upon.
     * @param {boolean} [skipIndex=false] - If true, the callback function is called with only the value.
     * @returns {Array} A new array with each element being the result of the callback function.
     */
    function deepMap$1(array, callback) {
      var skipIndex = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
      if (array.length === 0) {
        return [];
      }
      if (skipIndex) {
        return recursiveMap(array);
      }
      var index = [];
      return recursiveMapWithIndex(array, 0);
      function recursiveMapWithIndex(value, depth) {
        if (Array.isArray(value)) {
          var N = value.length;
          var result = Array(N);
          for (var i = 0; i < N; i++) {
            index[depth] = i;
            result[i] = recursiveMapWithIndex(value[i], depth + 1);
          }
          return result;
        } else {
          return callback(value, index.slice(0, depth), array);
        }
      }
      function recursiveMap(value) {
        if (Array.isArray(value)) {
          var N = value.length;
          var result = Array(N);
          for (var i = 0; i < N; i++) {
            result[i] = recursiveMap(value[i]);
          }
          return result;
        } else {
          return callback(value);
        }
      }
    }

    /**
     * Deep clones a multidimensional array
     * @param {Array} array
     * @returns {Array} cloned array
     */
    function clone(array) {
      return _extends([], array);
    }

    /**
     * Simplifies a callback function by reducing its complexity and potentially improving its performance.
     *
     * @param {Function} callback The original callback function to simplify.
     * @param {Array|Matrix} array The array that will be used with the callback function.
     * @param {string} name The name of the function that is using the callback.
     * @param {boolean} [isUnary=false] If true, the callback function is unary and will be optimized as such.
     * @returns {Function} Returns a simplified version of the callback function.
     */
    function optimizeCallback(callback, array, name) {
      var isUnary = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
      if (typedFunction.isTypedFunction(callback)) {
        var numberOfArguments;
        if (isUnary) {
          numberOfArguments = 1;
        } else {
          var firstIndex = (array.isMatrix ? array.size() : arraySize(array)).map(() => 0);
          var firstValue = array.isMatrix ? array.get(firstIndex) : get(array, firstIndex);
          numberOfArguments = _findNumberOfArgumentsTyped(callback, firstValue, firstIndex, array);
        }
        var fastCallback;
        if (array.isMatrix && array.dataType !== 'mixed' && array.dataType !== undefined) {
          var singleSignature = _findSingleSignatureWithArity(callback, numberOfArguments);
          fastCallback = singleSignature !== undefined ? singleSignature : callback;
        } else {
          fastCallback = callback;
        }
        if (numberOfArguments >= 1 && numberOfArguments <= 3) {
          return {
            isUnary: numberOfArguments === 1,
            fn: function fn() {
              for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
                args[_key] = arguments[_key];
              }
              return _tryFunctionWithArgs(fastCallback, args.slice(0, numberOfArguments), name, callback.name);
            }
          };
        }
        return {
          isUnary: false,
          fn: function fn() {
            for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
              args[_key2] = arguments[_key2];
            }
            return _tryFunctionWithArgs(fastCallback, args, name, callback.name);
          }
        };
      }
      if (isUnary === undefined) {
        return {
          isUnary: _findIfCallbackIsUnary(callback),
          fn: callback
        };
      } else {
        return {
          isUnary,
          fn: callback
        };
      }
    }
    function _findSingleSignatureWithArity(callback, arity) {
      var matchingFunctions = [];
      Object.entries(callback.signatures).forEach(_ref => {
        var [signature, func] = _ref;
        if (signature.split(',').length === arity) {
          matchingFunctions.push(func);
        }
      });
      if (matchingFunctions.length === 1) {
        return matchingFunctions[0];
      }
    }

    /**
     * Determines if a given callback function is unary (i.e., takes exactly one argument).
     *
     * This function checks the following conditions to determine if the callback is unary:
     * 1. The callback function should have exactly one parameter.
     * 2. The callback function should not use the `arguments` object.
     * 3. The callback function should not use rest parameters (`...`).
     * If in doubt, this function shall return `false` to be safe
     *
     * @param {Function} callback - The callback function to be checked.
     * @returns {boolean} - Returns `true` if the callback is unary, otherwise `false`.
     */
    function _findIfCallbackIsUnary(callback) {
      if (callback.length !== 1) return false;
      var callbackStr = callback.toString();
      // Check if the callback function uses `arguments`
      if (/arguments/.test(callbackStr)) return false;

      // Extract the parameters of the callback function
      var paramsStr = callbackStr.match(/\(.*?\)/);
      // Check if the callback function uses rest parameters
      if (/\.\.\./.test(paramsStr)) return false;
      return true;
    }
    function _findNumberOfArgumentsTyped(callback, value, index, array) {
      var testArgs = [value, index, array];
      for (var i = 3; i > 0; i--) {
        var args = testArgs.slice(0, i);
        if (typedFunction.resolve(callback, args) !== null) {
          return i;
        }
      }
    }

    /**
       * @param {function} func The selected function taken from one of the signatures of the callback function
       * @param {Array} args List with arguments to apply to the selected signature
       * @param {string} mappingFnName the name of the function that is using the callback
       * @param {string} callbackName the name of the callback function
       * @returns {*} Returns the return value of the invoked signature
       * @throws {TypeError} Throws an error when no matching signature was found
       */
    function _tryFunctionWithArgs(func, args, mappingFnName, callbackName) {
      try {
        return func(...args);
      } catch (err) {
        _createCallbackError(err, args, mappingFnName, callbackName);
      }
    }

    /**
     * Creates and throws a detailed TypeError when a callback function fails.
     *
     * @param {Error} err The original error thrown by the callback function.
     * @param {Array} args The arguments that were passed to the callback function.
     * @param {string} mappingFnName The name of the function that is using the callback.
     * @param {string} callbackName The name of the callback function.
     * @throws {TypeError} Throws a detailed TypeError with enriched error message.
     */
    function _createCallbackError(err, args, mappingFnName, callbackName) {
      var _err$data;
      // Enrich the error message so the user understands that it took place inside the callback function
      if (err instanceof TypeError && ((_err$data = err.data) === null || _err$data === void 0 ? void 0 : _err$data.category) === 'wrongType') {
        var argsDesc = [];
        argsDesc.push("value: ".concat(typeOf(args[0])));
        if (args.length >= 2) {
          argsDesc.push("index: ".concat(typeOf(args[1])));
        }
        if (args.length >= 3) {
          argsDesc.push("array: ".concat(typeOf(args[2])));
        }
        throw new TypeError("Function ".concat(mappingFnName, " cannot apply callback arguments ") + "".concat(callbackName, "(").concat(argsDesc.join(', '), ") at index ").concat(JSON.stringify(args[1])));
      } else {
        throw new TypeError("Function ".concat(mappingFnName, " cannot apply callback arguments ") + "to function ".concat(callbackName, ": ").concat(err.message));
      }
    }

    // deno-lint-ignore-file no-this-alias
    var name$r = 'DenseMatrix';
    var dependencies$r = ['Matrix'];
    var createDenseMatrixClass = /* #__PURE__ */factory(name$r, dependencies$r, _ref => {
      var {
        Matrix
      } = _ref;
      /**
       * Dense Matrix implementation. A regular, dense matrix, supporting multi-dimensional matrices. This is the default matrix type.
       * @class DenseMatrix
       * @enum {{ value, index: number[] }}
       */
      function DenseMatrix(data, datatype) {
        if (!(this instanceof DenseMatrix)) {
          throw new SyntaxError('Constructor must be called with the new operator');
        }
        if (datatype && !isString(datatype)) {
          throw new Error('Invalid datatype: ' + datatype);
        }
        if (isMatrix(data)) {
          // check data is a DenseMatrix
          if (data.type === 'DenseMatrix') {
            // clone data & size
            this._data = clone$2(data._data);
            this._size = clone$2(data._size);
            this._datatype = datatype || data._datatype;
          } else {
            // build data from existing matrix
            this._data = data.toArray();
            this._size = data.size();
            this._datatype = datatype || data._datatype;
          }
        } else if (data && isArray(data.data) && isArray(data.size)) {
          // initialize fields from JSON representation
          this._data = data.data;
          this._size = data.size;
          // verify the dimensions of the array
          validate(this._data, this._size);
          this._datatype = datatype || data.datatype;
        } else if (isArray(data)) {
          // replace nested Matrices with Arrays
          this._data = preprocess(data);
          // get the dimensions of the array
          this._size = arraySize(this._data);
          // verify the dimensions of the array, TODO: compute size while processing array
          validate(this._data, this._size);
          // data type unknown
          this._datatype = datatype;
        } else if (data) {
          // unsupported type
          throw new TypeError('Unsupported type of data (' + typeOf(data) + ')');
        } else {
          // nothing provided
          this._data = [];
          this._size = [0];
          this._datatype = datatype;
        }
      }
      DenseMatrix.prototype = new Matrix();

      /**
       * Create a new DenseMatrix
       */
      DenseMatrix.prototype.createDenseMatrix = function (data, datatype) {
        return new DenseMatrix(data, datatype);
      };

      /**
       * Attach type information
       */
      Object.defineProperty(DenseMatrix, 'name', {
        value: 'DenseMatrix'
      });
      DenseMatrix.prototype.constructor = DenseMatrix;
      DenseMatrix.prototype.type = 'DenseMatrix';
      DenseMatrix.prototype.isDenseMatrix = true;

      /**
       * Get the matrix type
       *
       * Usage:
       *    const matrixType = matrix.getDataType()  // retrieves the matrix type
       *
       * @memberOf DenseMatrix
       * @return {string}   type information; if multiple types are found from the Matrix, it will return "mixed"
       */
      DenseMatrix.prototype.getDataType = function () {
        return getArrayDataType(this._data, typeOf);
      };

      /**
       * Get the storage format used by the matrix.
       *
       * Usage:
       *     const format = matrix.storage()  // retrieve storage format
       *
       * @memberof DenseMatrix
       * @return {string}           The storage format.
       */
      DenseMatrix.prototype.storage = function () {
        return 'dense';
      };

      /**
       * Get the datatype of the data stored in the matrix.
       *
       * Usage:
       *     const format = matrix.datatype()   // retrieve matrix datatype
       *
       * @memberof DenseMatrix
       * @return {string}           The datatype.
       */
      DenseMatrix.prototype.datatype = function () {
        return this._datatype;
      };

      /**
       * Create a new DenseMatrix
       * @memberof DenseMatrix
       * @param {Array} data
       * @param {string} [datatype]
       */
      DenseMatrix.prototype.create = function (data, datatype) {
        return new DenseMatrix(data, datatype);
      };

      /**
       * Get a subset of the matrix, or replace a subset of the matrix.
       *
       * Usage:
       *     const subset = matrix.subset(index)               // retrieve subset
       *     const value = matrix.subset(index, replacement)   // replace subset
       *
       * @memberof DenseMatrix
       * @param {Index} index
       * @param {Array | Matrix | *} [replacement]
       * @param {*} [defaultValue=0]      Default value, filled in on new entries when
       *                                  the matrix is resized. If not provided,
       *                                  new matrix elements will be filled with zeros.
       */
      DenseMatrix.prototype.subset = function (index, replacement, defaultValue) {
        switch (arguments.length) {
          case 1:
            return _get(this, index);

          // intentional fall through
          case 2:
          case 3:
            return _set(this, index, replacement, defaultValue);
          default:
            throw new SyntaxError('Wrong number of arguments');
        }
      };

      /**
       * Get a single element from the matrix.
       * @memberof DenseMatrix
       * @param {number[]} index   Zero-based index
       * @return {*} value
       */
      DenseMatrix.prototype.get = function (index) {
        return get(this._data, index);
      };

      /**
       * Replace a single element in the matrix.
       * @memberof DenseMatrix
       * @param {number[]} index   Zero-based index
       * @param {*} value
       * @param {*} [defaultValue]        Default value, filled in on new entries when
       *                                  the matrix is resized. If not provided,
       *                                  new matrix elements will be left undefined.
       * @return {DenseMatrix} self
       */
      DenseMatrix.prototype.set = function (index, value, defaultValue) {
        if (!isArray(index)) {
          throw new TypeError('Array expected');
        }
        if (index.length < this._size.length) {
          throw new DimensionError(index.length, this._size.length, '<');
        }
        var i, ii, indexI;

        // enlarge matrix when needed
        var size = index.map(function (i) {
          return i + 1;
        });
        _fit(this, size, defaultValue);

        // traverse over the dimensions
        var data = this._data;
        for (i = 0, ii = index.length - 1; i < ii; i++) {
          indexI = index[i];
          validateIndex(indexI, data.length);
          data = data[indexI];
        }

        // set new value
        indexI = index[index.length - 1];
        validateIndex(indexI, data.length);
        data[indexI] = value;
        return this;
      };

      /**
       * Get a submatrix of this matrix
       * @memberof DenseMatrix
       * @param {DenseMatrix} matrix
       * @param {Index} index   Zero-based index
       * @private
       */
      function _get(matrix, index) {
        if (!isIndex(index)) {
          throw new TypeError('Invalid index');
        }
        var isScalar = index.isScalar();
        if (isScalar) {
          // return a scalar
          return matrix.get(index.min());
        } else {
          // validate dimensions
          var size = index.size();
          if (size.length !== matrix._size.length) {
            throw new DimensionError(size.length, matrix._size.length);
          }

          // validate if any of the ranges in the index is out of range
          var min = index.min();
          var max = index.max();
          for (var i = 0, ii = matrix._size.length; i < ii; i++) {
            validateIndex(min[i], matrix._size[i]);
            validateIndex(max[i], matrix._size[i]);
          }

          // retrieve submatrix
          // TODO: more efficient when creating an empty matrix and setting _data and _size manually
          return new DenseMatrix(_getSubmatrix(matrix._data, index, size.length, 0), matrix._datatype);
        }
      }

      /**
       * Recursively get a submatrix of a multi dimensional matrix.
       * Index is not checked for correct number or length of dimensions.
       * @memberof DenseMatrix
       * @param {Array} data
       * @param {Index} index
       * @param {number} dims   Total number of dimensions
       * @param {number} dim    Current dimension
       * @return {Array} submatrix
       * @private
       */
      function _getSubmatrix(data, index, dims, dim) {
        var last = dim === dims - 1;
        var range = index.dimension(dim);
        if (last) {
          return range.map(function (i) {
            validateIndex(i, data.length);
            return data[i];
          }).valueOf();
        } else {
          return range.map(function (i) {
            validateIndex(i, data.length);
            var child = data[i];
            return _getSubmatrix(child, index, dims, dim + 1);
          }).valueOf();
        }
      }

      /**
       * Replace a submatrix in this matrix
       * Indexes are zero-based.
       * @memberof DenseMatrix
       * @param {DenseMatrix} matrix
       * @param {Index} index
       * @param {DenseMatrix | Array | *} submatrix
       * @param {*} defaultValue          Default value, filled in on new entries when
       *                                  the matrix is resized.
       * @return {DenseMatrix} matrix
       * @private
       */
      function _set(matrix, index, submatrix, defaultValue) {
        if (!index || index.isIndex !== true) {
          throw new TypeError('Invalid index');
        }

        // get index size and check whether the index contains a single value
        var iSize = index.size();
        var isScalar = index.isScalar();

        // calculate the size of the submatrix, and convert it into an Array if needed
        var sSize;
        if (isMatrix(submatrix)) {
          sSize = submatrix.size();
          submatrix = submatrix.valueOf();
        } else {
          sSize = arraySize(submatrix);
        }
        if (isScalar) {
          // set a scalar

          // check whether submatrix is a scalar
          if (sSize.length !== 0) {
            throw new TypeError('Scalar expected');
          }
          matrix.set(index.min(), submatrix, defaultValue);
        } else {
          // set a submatrix

          // broadcast submatrix
          if (!deepStrictEqual(sSize, iSize)) {
            try {
              if (sSize.length === 0) {
                submatrix = broadcastTo([submatrix], iSize);
              } else {
                submatrix = broadcastTo(submatrix, iSize);
              }
              sSize = arraySize(submatrix);
            } catch (_unused) {}
          }

          // validate dimensions
          if (iSize.length < matrix._size.length) {
            throw new DimensionError(iSize.length, matrix._size.length, '<');
          }
          if (sSize.length < iSize.length) {
            // calculate number of missing outer dimensions
            var i = 0;
            var outer = 0;
            while (iSize[i] === 1 && sSize[i] === 1) {
              i++;
            }
            while (iSize[i] === 1) {
              outer++;
              i++;
            }

            // unsqueeze both outer and inner dimensions
            submatrix = unsqueeze(submatrix, iSize.length, outer, sSize);
          }

          // check whether the size of the submatrix matches the index size
          if (!deepStrictEqual(iSize, sSize)) {
            throw new DimensionError(iSize, sSize, '>');
          }

          // enlarge matrix when needed
          var size = index.max().map(function (i) {
            return i + 1;
          });
          _fit(matrix, size, defaultValue);

          // insert the sub matrix
          var dims = iSize.length;
          var dim = 0;
          _setSubmatrix(matrix._data, index, submatrix, dims, dim);
        }
        return matrix;
      }

      /**
       * Replace a submatrix of a multi dimensional matrix.
       * @memberof DenseMatrix
       * @param {Array} data
       * @param {Index} index
       * @param {Array} submatrix
       * @param {number} dims   Total number of dimensions
       * @param {number} dim
       * @private
       */
      function _setSubmatrix(data, index, submatrix, dims, dim) {
        var last = dim === dims - 1;
        var range = index.dimension(dim);
        if (last) {
          range.forEach(function (dataIndex, subIndex) {
            validateIndex(dataIndex);
            data[dataIndex] = submatrix[subIndex[0]];
          });
        } else {
          range.forEach(function (dataIndex, subIndex) {
            validateIndex(dataIndex);
            _setSubmatrix(data[dataIndex], index, submatrix[subIndex[0]], dims, dim + 1);
          });
        }
      }

      /**
       * Resize the matrix to the given size. Returns a copy of the matrix when
       * `copy=true`, otherwise return the matrix itself (resize in place).
       *
       * @memberof DenseMatrix
       * @param {number[] || Matrix} size The new size the matrix should have.
       * @param {*} [defaultValue=0]      Default value, filled in on new entries.
       *                                  If not provided, the matrix elements will
       *                                  be filled with zeros.
       * @param {boolean} [copy]          Return a resized copy of the matrix
       *
       * @return {Matrix}                 The resized matrix
       */
      DenseMatrix.prototype.resize = function (size, defaultValue, copy) {
        // validate arguments
        if (!isCollection(size)) {
          throw new TypeError('Array or Matrix expected');
        }

        // SparseMatrix input is always 2d, flatten this into 1d if it's indeed a vector
        var sizeArray = size.valueOf().map(value => {
          return Array.isArray(value) && value.length === 1 ? value[0] : value;
        });

        // matrix to resize
        var m = copy ? this.clone() : this;
        // resize matrix
        return _resize(m, sizeArray, defaultValue);
      };
      function _resize(matrix, size, defaultValue) {
        // check size
        if (size.length === 0) {
          // first value in matrix
          var v = matrix._data;
          // go deep
          while (isArray(v)) {
            v = v[0];
          }
          return v;
        }
        // resize matrix
        matrix._size = size.slice(0); // copy the array
        matrix._data = resize(matrix._data, matrix._size, defaultValue);
        // return matrix
        return matrix;
      }

      /**
       * Reshape the matrix to the given size. Returns a copy of the matrix when
       * `copy=true`, otherwise return the matrix itself (reshape in place).
       *
       * NOTE: This might be better suited to copy by default, instead of modifying
       *       in place. For now, it operates in place to remain consistent with
       *       resize().
       *
       * @memberof DenseMatrix
       * @param {number[]} size           The new size the matrix should have.
       * @param {boolean} [copy]          Return a reshaped copy of the matrix
       *
       * @return {Matrix}                 The reshaped matrix
       */
      DenseMatrix.prototype.reshape = function (size, copy) {
        var m = copy ? this.clone() : this;
        m._data = reshape(m._data, size);
        var currentLength = m._size.reduce((length, size) => length * size);
        m._size = processSizesWildcard(size, currentLength);
        return m;
      };

      /**
       * Enlarge the matrix when it is smaller than given size.
       * If the matrix is larger or equal sized, nothing is done.
       * @memberof DenseMatrix
       * @param {DenseMatrix} matrix           The matrix to be resized
       * @param {number[]} size
       * @param {*} defaultValue          Default value, filled in on new entries.
       * @private
       */
      function _fit(matrix, size, defaultValue) {
        var
        // copy the array
        newSize = matrix._size.slice(0);
        var changed = false;

        // add dimensions when needed
        while (newSize.length < size.length) {
          newSize.push(0);
          changed = true;
        }

        // enlarge size when needed
        for (var i = 0, ii = size.length; i < ii; i++) {
          if (size[i] > newSize[i]) {
            newSize[i] = size[i];
            changed = true;
          }
        }
        if (changed) {
          // resize only when size is changed
          _resize(matrix, newSize, defaultValue);
        }
      }

      /**
       * Create a clone of the matrix
       * @memberof DenseMatrix
       * @return {DenseMatrix} clone
       */
      DenseMatrix.prototype.clone = function () {
        var m = new DenseMatrix({
          data: clone$2(this._data),
          size: clone$2(this._size),
          datatype: this._datatype
        });
        return m;
      };

      /**
       * Retrieve the size of the matrix.
       * @memberof DenseMatrix
       * @returns {number[]} size
       */
      DenseMatrix.prototype.size = function () {
        return this._size.slice(0); // return a clone of _size
      };

      /**
       * Applies a callback function to a reference to each element of the matrix
       * @memberof DenseMatrix
       * @param {Function} callback   The callback function is invoked with three
       *                              parameters: the array containing the element,
       *                              the index of the element within that array (as an integer),
       *                              and for non unarry callbacks copy of the current index (as an array of integers).
       */
      DenseMatrix.prototype._forEach = function (callback) {
        var isUnary = callback.length === 2; // callback has 2 parameters: value, index
        var maxDepth = this._size.length - 1;
        if (maxDepth < 0) return;
        if (isUnary) {
          iterateUnary(this._data);
          return;
        }
        if (maxDepth === 0) {
          for (var i = 0; i < this._data.length; i++) {
            callback(this._data, i, [i]);
          }
          return;
        }
        var index = new Array(maxDepth + 1);
        iterate(this._data);
        function iterate(data) {
          var depth = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
          if (depth < maxDepth) {
            for (var _i = 0; _i < data.length; _i++) {
              index[depth] = _i;
              iterate(data[_i], depth + 1);
            }
          } else {
            for (var _i2 = 0; _i2 < data.length; _i2++) {
              index[depth] = _i2;
              callback(data, _i2, index.slice());
            }
          }
        }
        function iterateUnary(data) {
          var depth = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
          if (depth < maxDepth) {
            for (var _i3 = 0; _i3 < data.length; _i3++) {
              iterateUnary(data[_i3], depth + 1);
            }
          } else {
            for (var _i4 = 0; _i4 < data.length; _i4++) {
              callback(data, _i4);
            }
          }
        }
      };

      /**
       * Create a new matrix with the results of the callback function executed on
       * each entry of the matrix.
       * @memberof DenseMatrix
       * @param {Function} callback   The callback function is invoked with three
       *                              parameters: the value of the element, the index
       *                              of the element, and the Matrix being traversed.
       * @param {boolean} skipZeros   If true, the callback function is invoked only for non-zero entries
       * @param {boolean} isUnary     If true, the callback function is invoked with one parameter
       *
       * @return {DenseMatrix} matrix
       */
      DenseMatrix.prototype.map = function (callback) {
        var isUnary = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
        var me = this;
        var result = new DenseMatrix(me);
        var fastCallback = optimizeCallback(callback, me._data, 'map', isUnary);
        var applyCallback = isUnary || fastCallback.isUnary ? (arr, i) => {
          arr[i] = fastCallback.fn(arr[i]);
        } : (arr, i, index) => {
          arr[i] = fastCallback.fn(arr[i], index, me);
        };
        result._forEach(applyCallback);
        return result;
      };

      /**
       * Execute a callback function on each entry of the matrix.
       * @memberof DenseMatrix
       * @param {Function} callback   The callback function is invoked with three
       *                              parameters: the value of the element, the index
       *                              of the element, and the Matrix being traversed.
       * @param {boolean} skipZeros   If true, the callback function is invoked only for non-zero entries
       * @param {boolean} isUnary     If true, the callback function is invoked with one parameter
       */
      DenseMatrix.prototype.forEach = function (callback) {
        var isUnary = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
        var me = this;
        var fastCallback = optimizeCallback(callback, me._data, 'map', isUnary);
        var applyCallback = isUnary || fastCallback.isUnary ? (arr, i) => {
          fastCallback.fn(arr[i]);
        } : (arr, i, index) => {
          fastCallback.fn(arr[i], index, me);
        };
        me._forEach(applyCallback);
      };

      /**
       * Iterate over the matrix elements
       * @return {Iterable<{ value, index: number[] }>}
       */
      DenseMatrix.prototype[Symbol.iterator] = function* () {
        var maxDepth = this._size.length - 1;
        if (maxDepth < 0) {
          return;
        }
        if (maxDepth === 0) {
          for (var i = 0; i < this._data.length; i++) {
            yield {
              value: this._data[i],
              index: [i]
            };
          }
          return;
        }
        var index = [];
        var _recurse = function* recurse(value, depth) {
          if (depth < maxDepth) {
            for (var _i5 = 0; _i5 < value.length; _i5++) {
              index[depth] = _i5;
              yield* _recurse(value[_i5], depth + 1);
            }
          } else {
            for (var _i6 = 0; _i6 < value.length; _i6++) {
              index[depth] = _i6;
              yield {
                value: value[_i6],
                index: index.slice()
              };
            }
          }
        };
        yield* _recurse(this._data, 0);
      };

      /**
       * Returns an array containing the rows of a 2D matrix
       * @returns {Array<Matrix>}
       */
      DenseMatrix.prototype.rows = function () {
        var result = [];
        var s = this.size();
        if (s.length !== 2) {
          throw new TypeError('Rows can only be returned for a 2D matrix.');
        }
        var data = this._data;
        for (var row of data) {
          result.push(new DenseMatrix([row], this._datatype));
        }
        return result;
      };

      /**
       * Returns an array containing the columns of a 2D matrix
       * @returns {Array<Matrix>}
       */
      DenseMatrix.prototype.columns = function () {
        var _this = this;
        var result = [];
        var s = this.size();
        if (s.length !== 2) {
          throw new TypeError('Rows can only be returned for a 2D matrix.');
        }
        var data = this._data;
        var _loop = function _loop(i) {
          var col = data.map(row => [row[i]]);
          result.push(new DenseMatrix(col, _this._datatype));
        };
        for (var i = 0; i < s[1]; i++) {
          _loop(i);
        }
        return result;
      };

      /**
       * Create an Array with a copy of the data of the DenseMatrix
       * @memberof DenseMatrix
       * @returns {Array} array
       */
      DenseMatrix.prototype.toArray = function () {
        return clone$2(this._data);
      };

      /**
       * Get the primitive value of the DenseMatrix: a multidimensional array
       * @memberof DenseMatrix
       * @returns {Array} array
       */
      DenseMatrix.prototype.valueOf = function () {
        return this._data;
      };

      /**
       * Get a string representation of the matrix, with optional formatting options.
       * @memberof DenseMatrix
       * @param {Object | number | Function} [options]  Formatting options. See
       *                                                lib/utils/number:format for a
       *                                                description of the available
       *                                                options.
       * @returns {string} str
       */
      DenseMatrix.prototype.format = function (options) {
        return format(this._data, options);
      };

      /**
       * Get a string representation of the matrix
       * @memberof DenseMatrix
       * @returns {string} str
       */
      DenseMatrix.prototype.toString = function () {
        return format(this._data);
      };

      /**
       * Get a JSON representation of the matrix
       * @memberof DenseMatrix
       * @returns {Object}
       */
      DenseMatrix.prototype.toJSON = function () {
        return {
          mathjs: 'DenseMatrix',
          data: this._data,
          size: this._size,
          datatype: this._datatype
        };
      };

      /**
       * Get the kth Matrix diagonal.
       *
       * @memberof DenseMatrix
       * @param {number | BigNumber} [k=0]     The kth diagonal where the vector will retrieved.
       *
       * @returns {Matrix}                     The matrix with the diagonal values.
       */
      DenseMatrix.prototype.diagonal = function (k) {
        // validate k if any
        if (k) {
          // convert BigNumber to a number
          if (isBigNumber(k)) {
            k = k.toNumber();
          }
          // is must be an integer
          if (!isNumber(k) || !isInteger(k)) {
            throw new TypeError('The parameter k must be an integer number');
          }
        } else {
          // default value
          k = 0;
        }
        var kSuper = k > 0 ? k : 0;
        var kSub = k < 0 ? -k : 0;

        // rows & columns
        var rows = this._size[0];
        var columns = this._size[1];

        // number diagonal values
        var n = Math.min(rows - kSub, columns - kSuper);

        // x is a matrix get diagonal from matrix
        var data = [];

        // loop rows
        for (var i = 0; i < n; i++) {
          data[i] = this._data[i + kSub][i + kSuper];
        }

        // create DenseMatrix
        return new DenseMatrix({
          data,
          size: [n],
          datatype: this._datatype
        });
      };

      /**
       * Create a diagonal matrix.
       *
       * @memberof DenseMatrix
       * @param {Array} size                     The matrix size.
       * @param {number | Matrix | Array } value The values for the diagonal.
       * @param {number | BigNumber} [k=0]       The kth diagonal where the vector will be filled in.
       * @param {number} [defaultValue]          The default value for non-diagonal
       * @param {string} [datatype]              The datatype for the diagonal
       *
       * @returns {DenseMatrix}
       */
      DenseMatrix.diagonal = function (size, value, k, defaultValue) {
        if (!isArray(size)) {
          throw new TypeError('Array expected, size parameter');
        }
        if (size.length !== 2) {
          throw new Error('Only two dimensions matrix are supported');
        }

        // map size & validate
        size = size.map(function (s) {
          // check it is a big number
          if (isBigNumber(s)) {
            // convert it
            s = s.toNumber();
          }
          // validate arguments
          if (!isNumber(s) || !isInteger(s) || s < 1) {
            throw new Error('Size values must be positive integers');
          }
          return s;
        });

        // validate k if any
        if (k) {
          // convert BigNumber to a number
          if (isBigNumber(k)) {
            k = k.toNumber();
          }
          // is must be an integer
          if (!isNumber(k) || !isInteger(k)) {
            throw new TypeError('The parameter k must be an integer number');
          }
        } else {
          // default value
          k = 0;
        }
        var kSuper = k > 0 ? k : 0;
        var kSub = k < 0 ? -k : 0;

        // rows and columns
        var rows = size[0];
        var columns = size[1];

        // number of non-zero items
        var n = Math.min(rows - kSub, columns - kSuper);

        // value extraction function
        var _value;

        // check value
        if (isArray(value)) {
          // validate array
          if (value.length !== n) {
            // number of values in array must be n
            throw new Error('Invalid value array length');
          }
          // define function
          _value = function _value(i) {
            // return value @ i
            return value[i];
          };
        } else if (isMatrix(value)) {
          // matrix size
          var ms = value.size();
          // validate matrix
          if (ms.length !== 1 || ms[0] !== n) {
            // number of values in array must be n
            throw new Error('Invalid matrix length');
          }
          // define function
          _value = function _value(i) {
            // return value @ i
            return value.get([i]);
          };
        } else {
          // define function
          _value = function _value() {
            // return value
            return value;
          };
        }

        // discover default value if needed
        if (!defaultValue) {
          // check first value in array
          defaultValue = isBigNumber(_value(0)) ? _value(0).mul(0) // trick to create a BigNumber with value zero
          : 0;
        }

        // empty array
        var data = [];

        // check we need to resize array
        if (size.length > 0) {
          // resize array
          data = resize(data, size, defaultValue);
          // fill diagonal
          for (var d = 0; d < n; d++) {
            data[d + kSub][d + kSuper] = _value(d);
          }
        }

        // create DenseMatrix
        return new DenseMatrix({
          data,
          size: [rows, columns]
        });
      };

      /**
       * Generate a matrix from a JSON object
       * @memberof DenseMatrix
       * @param {Object} json  An object structured like
       *                       `{"mathjs": "DenseMatrix", data: [], size: []}`,
       *                       where mathjs is optional
       * @returns {DenseMatrix}
       */
      DenseMatrix.fromJSON = function (json) {
        return new DenseMatrix(json);
      };

      /**
       * Swap rows i and j in Matrix.
       *
       * @memberof DenseMatrix
       * @param {number} i       Matrix row index 1
       * @param {number} j       Matrix row index 2
       *
       * @return {Matrix}        The matrix reference
       */
      DenseMatrix.prototype.swapRows = function (i, j) {
        // check index
        if (!isNumber(i) || !isInteger(i) || !isNumber(j) || !isInteger(j)) {
          throw new Error('Row index must be positive integers');
        }
        // check dimensions
        if (this._size.length !== 2) {
          throw new Error('Only two dimensional matrix is supported');
        }
        // validate index
        validateIndex(i, this._size[0]);
        validateIndex(j, this._size[0]);

        // swap rows
        DenseMatrix._swapRows(i, j, this._data);
        // return current instance
        return this;
      };

      /**
       * Swap rows i and j in Dense Matrix data structure.
       *
       * @param {number} i       Matrix row index 1
       * @param {number} j       Matrix row index 2
       * @param {Array} data     Matrix data
       */
      DenseMatrix._swapRows = function (i, j, data) {
        // swap values i <-> j
        var vi = data[i];
        data[i] = data[j];
        data[j] = vi;
      };

      /**
       * Preprocess data, which can be an Array or DenseMatrix with nested Arrays and
       * Matrices. Clones all (nested) Arrays, and replaces all nested Matrices with Arrays
       * @memberof DenseMatrix
       * @param {Array | Matrix} data
       * @return {Array} data
       */
      function preprocess(data) {
        if (isMatrix(data)) {
          return preprocess(data.valueOf());
        }
        if (isArray(data)) {
          return data.map(preprocess);
        }
        return data;
      }
      return DenseMatrix;
    }, {
      isClass: true
    });

    /**
     * Execute the callback function element wise for each element in array and any
     * nested array
     * Returns an array with the results
     * @param {Array | Matrix} array
     * @param {Function} callback   The callback is called with two parameters:
     *                              value1 and value2, which contain the current
     *                              element of both arrays.
     * @param {boolean} [skipZeros] Invoke callback function for non-zero values only.
     *
     * @return {Array | Matrix} res
     */
    function deepMap(array, callback, skipZeros) {
      if (!skipZeros) {
        if (isMatrix(array)) {
          return array.map(x => callback(x), false, true);
        } else {
          return deepMap$1(array, callback, true);
        }
      }
      var skipZerosCallback = x => x === 0 ? x : callback(x);
      if (isMatrix(array)) {
        return array.map(x => skipZerosCallback(x), false, true);
      } else {
        return deepMap$1(array, skipZerosCallback, true);
      }
    }

    var n1 = 'number';
    var n2 = 'number, number';
    function absNumber(a) {
      return Math.abs(a);
    }
    absNumber.signature = n1;
    function addNumber(a, b) {
      return a + b;
    }
    addNumber.signature = n2;
    function subtractNumber(a, b) {
      return a - b;
    }
    subtractNumber.signature = n2;
    function multiplyNumber(a, b) {
      return a * b;
    }
    multiplyNumber.signature = n2;
    function unaryMinusNumber(x) {
      return -x;
    }
    unaryMinusNumber.signature = n1;

    /**
     * Calculates the power of x to y, x^y, for two numbers.
     * @param {number} x
     * @param {number} y
     * @return {number} res
     */
    function powNumber(x, y) {
      // x^Infinity === 0 if -1 < x < 1
      // A real number 0 is returned instead of complex(0)
      if (x * x < 1 && y === Infinity || x * x > 1 && y === -Infinity) {
        return 0;
      }
      return Math.pow(x, y);
    }
    powNumber.signature = n2;

    /** @param {number} i
     *  @param {number} n
     *  @returns {number} product of i to n
     */
    function product(i, n) {
      if (n < i) {
        return 1;
      }
      if (n === i) {
        return n;
      }
      var half = n + i >> 1; // divide (n + i) by 2 and truncate to integer
      return product(i, half) * product(half + 1, n);
    }

    /* eslint-disable no-loss-of-precision */

    function gammaNumber(n) {
      var x;
      if (isInteger(n)) {
        if (n <= 0) {
          return isFinite(n) ? Infinity : NaN;
        }
        if (n > 171) {
          return Infinity; // Will overflow
        }
        return product(1, n - 1);
      }
      if (n < 0.5) {
        return Math.PI / (Math.sin(Math.PI * n) * gammaNumber(1 - n));
      }
      if (n >= 171.35) {
        return Infinity; // will overflow
      }
      if (n > 85.0) {
        // Extended Stirling Approx
        var twoN = n * n;
        var threeN = twoN * n;
        var fourN = threeN * n;
        var fiveN = fourN * n;
        return Math.sqrt(2 * Math.PI / n) * Math.pow(n / Math.E, n) * (1 + 1 / (12 * n) + 1 / (288 * twoN) - 139 / (51840 * threeN) - 571 / (2488320 * fourN) + 163879 / (209018880 * fiveN) + 5246819 / (75246796800 * fiveN * n));
      }
      --n;
      x = gammaP[0];
      for (var i = 1; i < gammaP.length; ++i) {
        x += gammaP[i] / (n + i);
      }
      var t = n + gammaG + 0.5;
      return Math.sqrt(2 * Math.PI) * Math.pow(t, n + 0.5) * Math.exp(-t) * x;
    }
    gammaNumber.signature = 'number';

    // TODO: comment on the variables g and p

    var gammaG = 4.7421875;
    var gammaP = [0.99999999999999709182, 57.156235665862923517, -59.59796035547549, 14.136097974741747174, -0.4919138160976202, 0.33994649984811888699e-4, 0.46523628927048575665e-4, -9837447530487956e-20, 0.15808870322491248884e-3, -21026444172410488e-20, 0.21743961811521264320e-3, -1643181065367639e-19, 0.84418223983852743293e-4, -26190838401581408e-21, 0.36899182659531622704e-5];

    // lgamma implementation ref: https://mrob.com/pub/ries/lanczos-gamma.html#code

    // log(2 * pi) / 2
    var lnSqrt2PI = 0.91893853320467274178;
    var lgammaG = 5; // Lanczos parameter "g"
    var lgammaN = 7; // Range of coefficients "n"

    var lgammaSeries = [1.000000000190015, 76.18009172947146, -86.50532032941678, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -5395239384953e-18];
    function lgammaNumber(n) {
      if (n < 0) return NaN;
      if (n === 0) return Infinity;
      if (!isFinite(n)) return n;
      if (n < 0.5) {
        // Use Euler's reflection formula:
        // gamma(z) = PI / (sin(PI * z) * gamma(1 - z))
        return Math.log(Math.PI / Math.sin(Math.PI * n)) - lgammaNumber(1 - n);
      }

      // Compute the logarithm of the Gamma function using the Lanczos method

      n = n - 1;
      var base = n + lgammaG + 0.5; // Base of the Lanczos exponential
      var sum = lgammaSeries[0];

      // We start with the terms that have the smallest coefficients and largest denominator
      for (var i = lgammaN - 1; i >= 1; i--) {
        sum += lgammaSeries[i] / (n + i);
      }
      return lnSqrt2PI + (n + 0.5) * Math.log(base) - base + Math.log(sum);
    }
    lgammaNumber.signature = 'number';

    /**
     * Compares two BigNumbers.
     * @param {BigNumber} a - First value to compare
     * @param {BigNumber} b - Second value to compare
     * @param {number} [relTol=1e-09] - The relative tolerance, indicating the maximum allowed difference relative to the larger absolute value. Must be greater than 0.
     * @param {number} [absTol=0] - The minimum absolute tolerance, useful for comparisons near zero. Must be at least 0.
     * @returns {boolean} whether the two numbers are nearly equal
     * @throws {Error} If `relTol` is less than or equal to 0.
     * @throws {Error} If `absTol` is less than 0.
     *
     * @example
     * nearlyEqual(1.000000001, 1.0, 1e-9);            // true
     * nearlyEqual(1.000000002, 1.0, 0);            // false
     * nearlyEqual(1.0, 1.009, undefined, 0.02);       // true
     * nearlyEqual(0.000000001, 0.0, undefined, 1e-8); // true
     */
    function nearlyEqual(a, b) {
      var relTol = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1e-9;
      var absTol = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
      if (relTol <= 0) {
        throw new Error('Relative tolerance must be greater than 0');
      }
      if (absTol < 0) {
        throw new Error('Absolute tolerance must be at least 0');
      }
      // NaN
      if (a.isNaN() || b.isNaN()) {
        return false;
      }
      if (!a.isFinite() || !b.isFinite()) {
        return a.eq(b);
      }
      // use "==" operator, handles infinities
      if (a.eq(b)) {
        return true;
      }
      // abs(a-b) <= max(relTol * max(abs(a), abs(b)), absTol)
      return a.minus(b).abs().lte(a.constructor.max(a.constructor.max(a.abs(), b.abs()).mul(relTol), absTol));
    }

    var name$q = 'isZero';
    var dependencies$q = ['typed', 'equalScalar'];
    var createIsZero = /* #__PURE__ */factory(name$q, dependencies$q, _ref => {
      var {
        typed,
        equalScalar
      } = _ref;
      /**
       * Test whether a value is zero.
       * The function can check for zero for types `number`, `BigNumber`, `Fraction`,
       * `Complex`, and `Unit`.
       *
       * The function is evaluated element-wise in case of Array or Matrix input.
       *
       * Syntax:
       *
       *     math.isZero(x)
       *
       * Examples:
       *
       *    math.isZero(0)                      // returns true
       *    math.isZero(2)                      // returns false
       *    math.isZero(0.5)                    // returns false
       *    math.isZero(math.bignumber(0))      // returns true
       *    math.isZero(math.fraction(0))       // returns true
       *    math.isZero(math.fraction(1,3))     // returns false
       *    math.isZero(math.complex('2 - 4i')) // returns false
       *    math.isZero(math.complex('0i'))     // returns true
       *    math.isZero('0')                    // returns true
       *    math.isZero('2')                    // returns false
       *    math.isZero([2, 0, -3])             // returns [false, true, false]
       *
       * See also:
       *
       *    isNumeric, isPositive, isNegative, isInteger
       *
       * @param {number | BigNumber | bigint | Complex | Fraction | Unit | Array | Matrix} x       Value to be tested
       * @return {boolean}  Returns true when `x` is zero.
       *                    Throws an error in case of an unknown data type.
       */
      return typed(name$q, {
        'number | BigNumber | Complex | Fraction': x => equalScalar(x, 0),
        bigint: x => x === 0n,
        Unit: typed.referToSelf(self => x => typed.find(self, x.valueType())(x.value)),
        'Array | Matrix': typed.referToSelf(self => x => deepMap(x, self))
      });
    });

    /**
     * Test whether two complex values are equal provided a given relTol and absTol.
     * Does not use or change the global Complex.EPSILON setting
     * @param {Complex} x - The first complex number for comparison.
     * @param {Complex} y - The second complex number for comparison.
     * @param {number} relTol - The relative tolerance for comparison.
     * @param {number} absTol - The absolute tolerance for comparison.
     * @returns {boolean} - Returns true if the two complex numbers are equal within the given tolerances, otherwise returns false.
     */
    function complexEquals(x, y, relTol, absTol) {
      return nearlyEqual$1(x.re, y.re, relTol, absTol) && nearlyEqual$1(x.im, y.im, relTol, absTol);
    }

    var createCompareUnits = /* #__PURE__ */factory('compareUnits', ['typed'], _ref => {
      var {
        typed
      } = _ref;
      return {
        'Unit, Unit': typed.referToSelf(self => (x, y) => {
          if (!x.equalBase(y)) {
            throw new Error('Cannot compare units with different base');
          }
          return typed.find(self, [x.valueType(), y.valueType()])(x.value, y.value);
        })
      };
    });

    var name$p = 'equalScalar';
    var dependencies$p = ['typed', 'config'];
    var createEqualScalar = /* #__PURE__ */factory(name$p, dependencies$p, _ref => {
      var {
        typed,
        config
      } = _ref;
      var compareUnits = createCompareUnits({
        typed
      });

      /**
       * Test whether two scalar values are nearly equal.
       *
       * @param  {number | BigNumber | bigint | Fraction | boolean | Complex | Unit} x   First value to compare
       * @param  {number | BigNumber | bigint | Fraction | boolean | Complex} y          Second value to compare
       * @return {boolean}                                                  Returns true when the compared values are equal, else returns false
       * @private
       */
      return typed(name$p, {
        'boolean, boolean': function boolean_boolean(x, y) {
          return x === y;
        },
        'number, number': function number_number(x, y) {
          return nearlyEqual$1(x, y, config.relTol, config.absTol);
        },
        'BigNumber, BigNumber': function BigNumber_BigNumber(x, y) {
          return x.eq(y) || nearlyEqual(x, y, config.relTol, config.absTol);
        },
        'bigint, bigint': function bigint_bigint(x, y) {
          return x === y;
        },
        'Fraction, Fraction': function Fraction_Fraction(x, y) {
          return x.equals(y);
        },
        'Complex, Complex': function Complex_Complex(x, y) {
          return complexEquals(x, y, config.relTol, config.absTol);
        }
      }, compareUnits);
    });
    factory(name$p, ['typed', 'config'], _ref2 => {
      var {
        typed,
        config
      } = _ref2;
      return typed(name$p, {
        'number, number': function number_number(x, y) {
          return nearlyEqual$1(x, y, config.relTol, config.absTol);
        }
      });
    });

    var name$o = 'SparseMatrix';
    var dependencies$o = ['typed', 'equalScalar', 'Matrix'];
    var createSparseMatrixClass = /* #__PURE__ */factory(name$o, dependencies$o, _ref => {
      var {
        typed,
        equalScalar,
        Matrix
      } = _ref;
      /**
       * Sparse Matrix implementation. This type implements
       * a [Compressed Column Storage](https://en.wikipedia.org/wiki/Sparse_matrix#Compressed_sparse_column_(CSC_or_CCS))
       * format for two-dimensional sparse matrices.
       * @class SparseMatrix
       */
      function SparseMatrix(data, datatype) {
        if (!(this instanceof SparseMatrix)) {
          throw new SyntaxError('Constructor must be called with the new operator');
        }
        if (datatype && !isString(datatype)) {
          throw new Error('Invalid datatype: ' + datatype);
        }
        if (isMatrix(data)) {
          // create from matrix
          _createFromMatrix(this, data, datatype);
        } else if (data && isArray(data.index) && isArray(data.ptr) && isArray(data.size)) {
          // initialize fields
          this._values = data.values;
          this._index = data.index;
          this._ptr = data.ptr;
          this._size = data.size;
          this._datatype = datatype || data.datatype;
        } else if (isArray(data)) {
          // create from array
          _createFromArray(this, data, datatype);
        } else if (data) {
          // unsupported type
          throw new TypeError('Unsupported type of data (' + typeOf(data) + ')');
        } else {
          // nothing provided
          this._values = [];
          this._index = [];
          this._ptr = [0];
          this._size = [0, 0];
          this._datatype = datatype;
        }
      }
      function _createFromMatrix(matrix, source, datatype) {
        // check matrix type
        if (source.type === 'SparseMatrix') {
          // clone arrays
          matrix._values = source._values ? clone$2(source._values) : undefined;
          matrix._index = clone$2(source._index);
          matrix._ptr = clone$2(source._ptr);
          matrix._size = clone$2(source._size);
          matrix._datatype = datatype || source._datatype;
        } else {
          // build from matrix data
          _createFromArray(matrix, source.valueOf(), datatype || source._datatype);
        }
      }
      function _createFromArray(matrix, data, datatype) {
        // initialize fields
        matrix._values = [];
        matrix._index = [];
        matrix._ptr = [];
        matrix._datatype = datatype;
        // discover rows & columns, do not use math.size() to avoid looping array twice
        var rows = data.length;
        var columns = 0;

        // equal signature to use
        var eq = equalScalar;
        // zero value
        var zero = 0;
        if (isString(datatype)) {
          // find signature that matches (datatype, datatype)
          eq = typed.find(equalScalar, [datatype, datatype]) || equalScalar;
          // convert 0 to the same datatype
          zero = typed.convert(0, datatype);
        }

        // check we have rows (empty array)
        if (rows > 0) {
          // column index
          var j = 0;
          do {
            // store pointer to values index
            matrix._ptr.push(matrix._index.length);
            // loop rows
            for (var i = 0; i < rows; i++) {
              // current row
              var row = data[i];
              // check row is an array
              if (isArray(row)) {
                // update columns if needed (only on first column)
                if (j === 0 && columns < row.length) {
                  columns = row.length;
                }
                // check row has column
                if (j < row.length) {
                  // value
                  var v = row[j];
                  // check value != 0
                  if (!eq(v, zero)) {
                    // store value
                    matrix._values.push(v);
                    // index
                    matrix._index.push(i);
                  }
                }
              } else {
                // update columns if needed (only on first column)
                if (j === 0 && columns < 1) {
                  columns = 1;
                }
                // check value != 0 (row is a scalar)
                if (!eq(row, zero)) {
                  // store value
                  matrix._values.push(row);
                  // index
                  matrix._index.push(i);
                }
              }
            }
            // increment index
            j++;
          } while (j < columns);
        }
        // store number of values in ptr
        matrix._ptr.push(matrix._index.length);
        // size
        matrix._size = [rows, columns];
      }
      SparseMatrix.prototype = new Matrix();

      /**
       * Create a new SparseMatrix
       */
      SparseMatrix.prototype.createSparseMatrix = function (data, datatype) {
        return new SparseMatrix(data, datatype);
      };

      /**
       * Attach type information
       */
      Object.defineProperty(SparseMatrix, 'name', {
        value: 'SparseMatrix'
      });
      SparseMatrix.prototype.constructor = SparseMatrix;
      SparseMatrix.prototype.type = 'SparseMatrix';
      SparseMatrix.prototype.isSparseMatrix = true;

      /**
       * Get the matrix type
       *
       * Usage:
       *    const matrixType = matrix.getDataType()  // retrieves the matrix type
       *
       * @memberOf SparseMatrix
       * @return {string}   type information; if multiple types are found from the Matrix, it will return "mixed"
       */
      SparseMatrix.prototype.getDataType = function () {
        return getArrayDataType(this._values, typeOf);
      };

      /**
       * Get the storage format used by the matrix.
       *
       * Usage:
       *     const format = matrix.storage()   // retrieve storage format
       *
       * @memberof SparseMatrix
       * @return {string}           The storage format.
       */
      SparseMatrix.prototype.storage = function () {
        return 'sparse';
      };

      /**
       * Get the datatype of the data stored in the matrix.
       *
       * Usage:
       *     const format = matrix.datatype()    // retrieve matrix datatype
       *
       * @memberof SparseMatrix
       * @return {string}           The datatype.
       */
      SparseMatrix.prototype.datatype = function () {
        return this._datatype;
      };

      /**
       * Create a new SparseMatrix
       * @memberof SparseMatrix
       * @param {Array} data
       * @param {string} [datatype]
       */
      SparseMatrix.prototype.create = function (data, datatype) {
        return new SparseMatrix(data, datatype);
      };

      /**
       * Get the matrix density.
       *
       * Usage:
       *     const density = matrix.density()                   // retrieve matrix density
       *
       * @memberof SparseMatrix
       * @return {number}           The matrix density.
       */
      SparseMatrix.prototype.density = function () {
        // rows & columns
        var rows = this._size[0];
        var columns = this._size[1];
        // calculate density
        return rows !== 0 && columns !== 0 ? this._index.length / (rows * columns) : 0;
      };

      /**
       * Get a subset of the matrix, or replace a subset of the matrix.
       *
       * Usage:
       *     const subset = matrix.subset(index)               // retrieve subset
       *     const value = matrix.subset(index, replacement)   // replace subset
       *
       * @memberof SparseMatrix
       * @param {Index} index
       * @param {Array | Matrix | *} [replacement]
       * @param {*} [defaultValue=0]      Default value, filled in on new entries when
       *                                  the matrix is resized. If not provided,
       *                                  new matrix elements will be filled with zeros.
       */
      SparseMatrix.prototype.subset = function (index, replacement, defaultValue) {
        // check it is a pattern matrix
        if (!this._values) {
          throw new Error('Cannot invoke subset on a Pattern only matrix');
        }

        // check arguments
        switch (arguments.length) {
          case 1:
            return _getsubset(this, index);

          // intentional fall through
          case 2:
          case 3:
            return _setsubset(this, index, replacement, defaultValue);
          default:
            throw new SyntaxError('Wrong number of arguments');
        }
      };
      function _getsubset(matrix, idx) {
        // check idx
        if (!isIndex(idx)) {
          throw new TypeError('Invalid index');
        }
        var isScalar = idx.isScalar();
        if (isScalar) {
          // return a scalar
          return matrix.get(idx.min());
        }
        // validate dimensions
        var size = idx.size();
        if (size.length !== matrix._size.length) {
          throw new DimensionError(size.length, matrix._size.length);
        }

        // vars
        var i, ii, k, kk;

        // validate if any of the ranges in the index is out of range
        var min = idx.min();
        var max = idx.max();
        for (i = 0, ii = matrix._size.length; i < ii; i++) {
          validateIndex(min[i], matrix._size[i]);
          validateIndex(max[i], matrix._size[i]);
        }

        // matrix arrays
        var mvalues = matrix._values;
        var mindex = matrix._index;
        var mptr = matrix._ptr;

        // rows & columns dimensions for result matrix
        var rows = idx.dimension(0);
        var columns = idx.dimension(1);

        // workspace & permutation vector
        var w = [];
        var pv = [];

        // loop rows in resulting matrix
        rows.forEach(function (i, r) {
          // update permutation vector
          pv[i] = r[0];
          // mark i in workspace
          w[i] = true;
        });

        // result matrix arrays
        var values = mvalues ? [] : undefined;
        var index = [];
        var ptr = [];

        // loop columns in result matrix
        columns.forEach(function (j) {
          // update ptr
          ptr.push(index.length);
          // loop values in column j
          for (k = mptr[j], kk = mptr[j + 1]; k < kk; k++) {
            // row
            i = mindex[k];
            // check row is in result matrix
            if (w[i] === true) {
              // push index
              index.push(pv[i]);
              // check we need to process values
              if (values) {
                values.push(mvalues[k]);
              }
            }
          }
        });
        // update ptr
        ptr.push(index.length);

        // return matrix
        return new SparseMatrix({
          values,
          index,
          ptr,
          size,
          datatype: matrix._datatype
        });
      }
      function _setsubset(matrix, index, submatrix, defaultValue) {
        // check index
        if (!index || index.isIndex !== true) {
          throw new TypeError('Invalid index');
        }

        // get index size and check whether the index contains a single value
        var iSize = index.size();
        var isScalar = index.isScalar();

        // calculate the size of the submatrix, and convert it into an Array if needed
        var sSize;
        if (isMatrix(submatrix)) {
          // submatrix size
          sSize = submatrix.size();
          // use array representation
          submatrix = submatrix.toArray();
        } else {
          // get submatrix size (array, scalar)
          sSize = arraySize(submatrix);
        }

        // check index is a scalar
        if (isScalar) {
          // verify submatrix is a scalar
          if (sSize.length !== 0) {
            throw new TypeError('Scalar expected');
          }
          // set value
          matrix.set(index.min(), submatrix, defaultValue);
        } else {
          // validate dimensions, index size must be one or two dimensions
          if (iSize.length !== 1 && iSize.length !== 2) {
            throw new DimensionError(iSize.length, matrix._size.length, '<');
          }

          // check submatrix and index have the same dimensions
          if (sSize.length < iSize.length) {
            // calculate number of missing outer dimensions
            var i = 0;
            var outer = 0;
            while (iSize[i] === 1 && sSize[i] === 1) {
              i++;
            }
            while (iSize[i] === 1) {
              outer++;
              i++;
            }
            // unsqueeze both outer and inner dimensions
            submatrix = unsqueeze(submatrix, iSize.length, outer, sSize);
          }

          // check whether the size of the submatrix matches the index size
          if (!deepStrictEqual(iSize, sSize)) {
            throw new DimensionError(iSize, sSize, '>');
          }

          // insert the sub matrix
          if (iSize.length === 1) {
            // if the replacement index only has 1 dimension, go trough each one and set its value
            var range = index.dimension(0);
            range.forEach(function (dataIndex, subIndex) {
              validateIndex(dataIndex);
              matrix.set([dataIndex, 0], submatrix[subIndex[0]], defaultValue);
            });
          } else {
            // if the replacement index has 2 dimensions, go through each one and set the value in the correct index
            var firstDimensionRange = index.dimension(0);
            var secondDimensionRange = index.dimension(1);
            firstDimensionRange.forEach(function (firstDataIndex, firstSubIndex) {
              validateIndex(firstDataIndex);
              secondDimensionRange.forEach(function (secondDataIndex, secondSubIndex) {
                validateIndex(secondDataIndex);
                matrix.set([firstDataIndex, secondDataIndex], submatrix[firstSubIndex[0]][secondSubIndex[0]], defaultValue);
              });
            });
          }
        }
        return matrix;
      }

      /**
       * Get a single element from the matrix.
       * @memberof SparseMatrix
       * @param {number[]} index   Zero-based index
       * @return {*} value
       */
      SparseMatrix.prototype.get = function (index) {
        if (!isArray(index)) {
          throw new TypeError('Array expected');
        }
        if (index.length !== this._size.length) {
          throw new DimensionError(index.length, this._size.length);
        }

        // check it is a pattern matrix
        if (!this._values) {
          throw new Error('Cannot invoke get on a Pattern only matrix');
        }

        // row and column
        var i = index[0];
        var j = index[1];

        // check i, j are valid
        validateIndex(i, this._size[0]);
        validateIndex(j, this._size[1]);

        // find value index
        var k = _getValueIndex(i, this._ptr[j], this._ptr[j + 1], this._index);
        // check k is prior to next column k and it is in the correct row
        if (k < this._ptr[j + 1] && this._index[k] === i) {
          return this._values[k];
        }
        return 0;
      };

      /**
       * Replace a single element in the matrix.
       * @memberof SparseMatrix
       * @param {number[]} index   Zero-based index
       * @param {*} v
       * @param {*} [defaultValue]        Default value, filled in on new entries when
       *                                  the matrix is resized. If not provided,
       *                                  new matrix elements will be set to zero.
       * @return {SparseMatrix} self
       */
      SparseMatrix.prototype.set = function (index, v, defaultValue) {
        if (!isArray(index)) {
          throw new TypeError('Array expected');
        }
        if (index.length !== this._size.length) {
          throw new DimensionError(index.length, this._size.length);
        }

        // check it is a pattern matrix
        if (!this._values) {
          throw new Error('Cannot invoke set on a Pattern only matrix');
        }

        // row and column
        var i = index[0];
        var j = index[1];

        // rows & columns
        var rows = this._size[0];
        var columns = this._size[1];

        // equal signature to use
        var eq = equalScalar;
        // zero value
        var zero = 0;
        if (isString(this._datatype)) {
          // find signature that matches (datatype, datatype)
          eq = typed.find(equalScalar, [this._datatype, this._datatype]) || equalScalar;
          // convert 0 to the same datatype
          zero = typed.convert(0, this._datatype);
        }

        // check we need to resize matrix
        if (i > rows - 1 || j > columns - 1) {
          // resize matrix
          _resize(this, Math.max(i + 1, rows), Math.max(j + 1, columns), defaultValue);
          // update rows & columns
          rows = this._size[0];
          columns = this._size[1];
        }

        // check i, j are valid
        validateIndex(i, rows);
        validateIndex(j, columns);

        // find value index
        var k = _getValueIndex(i, this._ptr[j], this._ptr[j + 1], this._index);
        // check k is prior to next column k and it is in the correct row
        if (k < this._ptr[j + 1] && this._index[k] === i) {
          // check value != 0
          if (!eq(v, zero)) {
            // update value
            this._values[k] = v;
          } else {
            // remove value from matrix
            _remove(k, j, this._values, this._index, this._ptr);
          }
        } else {
          if (!eq(v, zero)) {
            // insert value @ (i, j)
            _insert(k, i, j, v, this._values, this._index, this._ptr);
          }
        }
        return this;
      };
      function _getValueIndex(i, top, bottom, index) {
        // check row is on the bottom side
        if (bottom - top === 0) {
          return bottom;
        }
        // loop rows [top, bottom[
        for (var r = top; r < bottom; r++) {
          // check we found value index
          if (index[r] === i) {
            return r;
          }
        }
        // we did not find row
        return top;
      }
      function _remove(k, j, values, index, ptr) {
        // remove value @ k
        values.splice(k, 1);
        index.splice(k, 1);
        // update pointers
        for (var x = j + 1; x < ptr.length; x++) {
          ptr[x]--;
        }
      }
      function _insert(k, i, j, v, values, index, ptr) {
        // insert value
        values.splice(k, 0, v);
        // update row for k
        index.splice(k, 0, i);
        // update column pointers
        for (var x = j + 1; x < ptr.length; x++) {
          ptr[x]++;
        }
      }

      /**
       * Resize the matrix to the given size. Returns a copy of the matrix when
       * `copy=true`, otherwise return the matrix itself (resize in place).
       *
       * @memberof SparseMatrix
       * @param {number[] | Matrix} size  The new size the matrix should have.
       *                                  Since sparse matrices are always two-dimensional,
       *                                  size must be two numbers in either an array or a matrix
       * @param {*} [defaultValue=0]      Default value, filled in on new entries.
       *                                  If not provided, the matrix elements will
       *                                  be filled with zeros.
       * @param {boolean} [copy]          Return a resized copy of the matrix
       *
       * @return {Matrix}                 The resized matrix
       */
      SparseMatrix.prototype.resize = function (size, defaultValue, copy) {
        // validate arguments
        if (!isCollection(size)) {
          throw new TypeError('Array or Matrix expected');
        }

        // SparseMatrix input is always 2d, flatten this into 1d if it's indeed a vector
        var sizeArray = size.valueOf().map(value => {
          return Array.isArray(value) && value.length === 1 ? value[0] : value;
        });
        if (sizeArray.length !== 2) {
          throw new Error('Only two dimensions matrix are supported');
        }

        // check sizes
        sizeArray.forEach(function (value) {
          if (!isNumber(value) || !isInteger(value) || value < 0) {
            throw new TypeError('Invalid size, must contain positive integers ' + '(size: ' + format(sizeArray) + ')');
          }
        });

        // matrix to resize
        var m = copy ? this.clone() : this;
        // resize matrix
        return _resize(m, sizeArray[0], sizeArray[1], defaultValue);
      };
      function _resize(matrix, rows, columns, defaultValue) {
        // value to insert at the time of growing matrix
        var value = defaultValue || 0;

        // equal signature to use
        var eq = equalScalar;
        // zero value
        var zero = 0;
        if (isString(matrix._datatype)) {
          // find signature that matches (datatype, datatype)
          eq = typed.find(equalScalar, [matrix._datatype, matrix._datatype]) || equalScalar;
          // convert 0 to the same datatype
          zero = typed.convert(0, matrix._datatype);
          // convert value to the same datatype
          value = typed.convert(value, matrix._datatype);
        }

        // should we insert the value?
        var ins = !eq(value, zero);

        // old columns and rows
        var r = matrix._size[0];
        var c = matrix._size[1];
        var i, j, k;

        // check we need to increase columns
        if (columns > c) {
          // loop new columns
          for (j = c; j < columns; j++) {
            // update matrix._ptr for current column
            matrix._ptr[j] = matrix._values.length;
            // check we need to insert matrix._values
            if (ins) {
              // loop rows
              for (i = 0; i < r; i++) {
                // add new matrix._values
                matrix._values.push(value);
                // update matrix._index
                matrix._index.push(i);
              }
            }
          }
          // store number of matrix._values in matrix._ptr
          matrix._ptr[columns] = matrix._values.length;
        } else if (columns < c) {
          // truncate matrix._ptr
          matrix._ptr.splice(columns + 1, c - columns);
          // truncate matrix._values and matrix._index
          matrix._values.splice(matrix._ptr[columns], matrix._values.length);
          matrix._index.splice(matrix._ptr[columns], matrix._index.length);
        }
        // update columns
        c = columns;

        // check we need to increase rows
        if (rows > r) {
          // check we have to insert values
          if (ins) {
            // inserts
            var n = 0;
            // loop columns
            for (j = 0; j < c; j++) {
              // update matrix._ptr for current column
              matrix._ptr[j] = matrix._ptr[j] + n;
              // where to insert matrix._values
              k = matrix._ptr[j + 1] + n;
              // pointer
              var p = 0;
              // loop new rows, initialize pointer
              for (i = r; i < rows; i++, p++) {
                // add value
                matrix._values.splice(k + p, 0, value);
                // update matrix._index
                matrix._index.splice(k + p, 0, i);
                // increment inserts
                n++;
              }
            }
            // store number of matrix._values in matrix._ptr
            matrix._ptr[c] = matrix._values.length;
          }
        } else if (rows < r) {
          // deletes
          var d = 0;
          // loop columns
          for (j = 0; j < c; j++) {
            // update matrix._ptr for current column
            matrix._ptr[j] = matrix._ptr[j] - d;
            // where matrix._values start for next column
            var k0 = matrix._ptr[j];
            var k1 = matrix._ptr[j + 1] - d;
            // loop matrix._index
            for (k = k0; k < k1; k++) {
              // row
              i = matrix._index[k];
              // check we need to delete value and matrix._index
              if (i > rows - 1) {
                // remove value
                matrix._values.splice(k, 1);
                // remove item from matrix._index
                matrix._index.splice(k, 1);
                // increase deletes
                d++;
              }
            }
          }
          // update matrix._ptr for current column
          matrix._ptr[j] = matrix._values.length;
        }
        // update matrix._size
        matrix._size[0] = rows;
        matrix._size[1] = columns;
        // return matrix
        return matrix;
      }

      /**
       * Reshape the matrix to the given size. Returns a copy of the matrix when
       * `copy=true`, otherwise return the matrix itself (reshape in place).
       *
       * NOTE: This might be better suited to copy by default, instead of modifying
       *       in place. For now, it operates in place to remain consistent with
       *       resize().
       *
       * @memberof SparseMatrix
       * @param {number[]} sizes          The new size the matrix should have.
       *                                  Since sparse matrices are always two-dimensional,
       *                                  size must be two numbers in either an array or a matrix
       * @param {boolean} [copy]          Return a reshaped copy of the matrix
       *
       * @return {Matrix}                 The reshaped matrix
       */
      SparseMatrix.prototype.reshape = function (sizes, copy) {
        // validate arguments
        if (!isArray(sizes)) {
          throw new TypeError('Array expected');
        }
        if (sizes.length !== 2) {
          throw new Error('Sparse matrices can only be reshaped in two dimensions');
        }

        // check sizes
        sizes.forEach(function (value) {
          if (!isNumber(value) || !isInteger(value) || value <= -2 || value === 0) {
            throw new TypeError('Invalid size, must contain positive integers or -1 ' + '(size: ' + format(sizes) + ')');
          }
        });
        var currentLength = this._size[0] * this._size[1];
        sizes = processSizesWildcard(sizes, currentLength);
        var newLength = sizes[0] * sizes[1];

        // m * n must not change
        if (currentLength !== newLength) {
          throw new Error('Reshaping sparse matrix will result in the wrong number of elements');
        }

        // matrix to reshape
        var m = copy ? this.clone() : this;

        // return unchanged if the same shape
        if (this._size[0] === sizes[0] && this._size[1] === sizes[1]) {
          return m;
        }

        // Convert to COO format (generate a column index)
        var colIndex = [];
        for (var i = 0; i < m._ptr.length; i++) {
          for (var j = 0; j < m._ptr[i + 1] - m._ptr[i]; j++) {
            colIndex.push(i);
          }
        }

        // Clone the values array
        var values = m._values.slice();

        // Clone the row index array
        var rowIndex = m._index.slice();

        // Transform the (row, column) indices
        for (var _i = 0; _i < m._index.length; _i++) {
          var r1 = rowIndex[_i];
          var c1 = colIndex[_i];
          var flat = r1 * m._size[1] + c1;
          colIndex[_i] = flat % sizes[1];
          rowIndex[_i] = Math.floor(flat / sizes[1]);
        }

        // Now reshaping is supposed to preserve the row-major order, BUT these sparse matrices are stored
        // in column-major order, so we have to reorder the value array now. One option is to use a multisort,
        // sorting several arrays based on some other array.

        // OR, we could easily just:

        // 1. Remove all values from the matrix
        m._values.length = 0;
        m._index.length = 0;
        m._ptr.length = sizes[1] + 1;
        m._size = sizes.slice();
        for (var _i2 = 0; _i2 < m._ptr.length; _i2++) {
          m._ptr[_i2] = 0;
        }

        // 2. Re-insert all elements in the proper order (simplified code from SparseMatrix.prototype.set)
        // This step is probably the most time-consuming
        for (var h = 0; h < values.length; h++) {
          var _i3 = rowIndex[h];
          var _j = colIndex[h];
          var v = values[h];
          var k = _getValueIndex(_i3, m._ptr[_j], m._ptr[_j + 1], m._index);
          _insert(k, _i3, _j, v, m._values, m._index, m._ptr);
        }

        // The value indices are inserted out of order, but apparently that's... still OK?

        return m;
      };

      /**
       * Create a clone of the matrix
       * @memberof SparseMatrix
       * @return {SparseMatrix} clone
       */
      SparseMatrix.prototype.clone = function () {
        var m = new SparseMatrix({
          values: this._values ? clone$2(this._values) : undefined,
          index: clone$2(this._index),
          ptr: clone$2(this._ptr),
          size: clone$2(this._size),
          datatype: this._datatype
        });
        return m;
      };

      /**
       * Retrieve the size of the matrix.
       * @memberof SparseMatrix
       * @returns {number[]} size
       */
      SparseMatrix.prototype.size = function () {
        return this._size.slice(0); // copy the Array
      };

      /**
       * Create a new matrix with the results of the callback function executed on
       * each entry of the matrix.
       * @memberof SparseMatrix
       * @param {Function} callback   The callback function is invoked with three
       *                              parameters: the value of the element, the index
       *                              of the element, and the Matrix being traversed.
       * @param {boolean} [skipZeros] Invoke callback function for non-zero values only.
       *
       * @return {SparseMatrix} matrix
       */
      SparseMatrix.prototype.map = function (callback, skipZeros) {
        // check it is a pattern matrix
        if (!this._values) {
          throw new Error('Cannot invoke map on a Pattern only matrix');
        }
        // matrix instance
        var me = this;
        // rows and columns
        var rows = this._size[0];
        var columns = this._size[1];
        var fastCallback = optimizeCallback(callback, me, 'map');
        // invoke callback
        var invoke = function invoke(v, i, j) {
          // invoke callback
          return fastCallback.fn(v, [i, j], me);
        };
        // invoke _map
        return _map(this, 0, rows - 1, 0, columns - 1, invoke, skipZeros);
      };

      /**
       * Create a new matrix with the results of the callback function executed on the interval
       * [minRow..maxRow, minColumn..maxColumn].
       */
      function _map(matrix, minRow, maxRow, minColumn, maxColumn, callback, skipZeros) {
        // result arrays
        var values = [];
        var index = [];
        var ptr = [];

        // equal signature to use
        var eq = equalScalar;
        // zero value
        var zero = 0;
        if (isString(matrix._datatype)) {
          // find signature that matches (datatype, datatype)
          eq = typed.find(equalScalar, [matrix._datatype, matrix._datatype]) || equalScalar;
          // convert 0 to the same datatype
          zero = typed.convert(0, matrix._datatype);
        }

        // invoke callback
        var invoke = function invoke(v, x, y) {
          // invoke callback
          var value = callback(v, x, y);
          // check value != 0
          if (!eq(value, zero)) {
            // store value
            values.push(value);
            // index
            index.push(x);
          }
        };
        // loop columns
        for (var j = minColumn; j <= maxColumn; j++) {
          // store pointer to values index
          ptr.push(values.length);
          // k0 <= k < k1 where k0 = _ptr[j] && k1 = _ptr[j+1]
          var k0 = matrix._ptr[j];
          var k1 = matrix._ptr[j + 1];
          if (skipZeros) {
            // loop k within [k0, k1[
            for (var k = k0; k < k1; k++) {
              // row index
              var i = matrix._index[k];
              // check i is in range
              if (i >= minRow && i <= maxRow) {
                // value @ k
                invoke(matrix._values[k], i - minRow, j - minColumn);
              }
            }
          } else {
            // create a cache holding all defined values
            var _values = {};
            for (var _k = k0; _k < k1; _k++) {
              var _i4 = matrix._index[_k];
              _values[_i4] = matrix._values[_k];
            }

            // loop over all rows (indexes can be unordered so we can't use that),
            // and either read the value or zero
            for (var _i5 = minRow; _i5 <= maxRow; _i5++) {
              var value = _i5 in _values ? _values[_i5] : 0;
              invoke(value, _i5 - minRow, j - minColumn);
            }
          }
        }

        // store number of values in ptr
        ptr.push(values.length);
        // return sparse matrix
        return new SparseMatrix({
          values,
          index,
          ptr,
          size: [maxRow - minRow + 1, maxColumn - minColumn + 1]
        });
      }

      /**
       * Execute a callback function on each entry of the matrix.
       * @memberof SparseMatrix
       * @param {Function} callback   The callback function is invoked with three
       *                              parameters: the value of the element, the index
       *                              of the element, and the Matrix being traversed.
       * @param {boolean} [skipZeros] Invoke callback function for non-zero values only.
       *                              If false, the indices are guaranteed to be in order,
       *                              if true, the indices can be unordered.
       */
      SparseMatrix.prototype.forEach = function (callback, skipZeros) {
        // check it is a pattern matrix
        if (!this._values) {
          throw new Error('Cannot invoke forEach on a Pattern only matrix');
        }
        // matrix instance
        var me = this;
        // rows and columns
        var rows = this._size[0];
        var columns = this._size[1];
        var fastCallback = optimizeCallback(callback, me, 'forEach');
        // loop columns
        for (var j = 0; j < columns; j++) {
          // k0 <= k < k1 where k0 = _ptr[j] && k1 = _ptr[j+1]
          var k0 = this._ptr[j];
          var k1 = this._ptr[j + 1];
          if (skipZeros) {
            // loop k within [k0, k1[
            for (var k = k0; k < k1; k++) {
              // row index
              var i = this._index[k];

              // value @ k
              // TODO apply a non indexed version of algorithm in case fastCallback is not optimized
              fastCallback.fn(this._values[k], [i, j], me);
            }
          } else {
            // create a cache holding all defined values
            var values = {};
            for (var _k2 = k0; _k2 < k1; _k2++) {
              var _i6 = this._index[_k2];
              values[_i6] = this._values[_k2];
            }

            // loop over all rows (indexes can be unordered so we can't use that),
            // and either read the value or zero
            for (var _i7 = 0; _i7 < rows; _i7++) {
              var value = _i7 in values ? values[_i7] : 0;
              fastCallback.fn(value, [_i7, j], me);
            }
          }
        }
      };

      /**
       * Iterate over the matrix elements, skipping zeros
       * @return {Iterable<{ value, index: number[] }>}
       */
      SparseMatrix.prototype[Symbol.iterator] = function* () {
        if (!this._values) {
          throw new Error('Cannot iterate a Pattern only matrix');
        }
        var columns = this._size[1];
        for (var j = 0; j < columns; j++) {
          var k0 = this._ptr[j];
          var k1 = this._ptr[j + 1];
          for (var k = k0; k < k1; k++) {
            // row index
            var i = this._index[k];
            yield {
              value: this._values[k],
              index: [i, j]
            };
          }
        }
      };

      /**
       * Create an Array with a copy of the data of the SparseMatrix
       * @memberof SparseMatrix
       * @returns {Array} array
       */
      SparseMatrix.prototype.toArray = function () {
        return _toArray(this._values, this._index, this._ptr, this._size, true);
      };

      /**
       * Get the primitive value of the SparseMatrix: a two dimensions array
       * @memberof SparseMatrix
       * @returns {Array} array
       */
      SparseMatrix.prototype.valueOf = function () {
        return _toArray(this._values, this._index, this._ptr, this._size, false);
      };
      function _toArray(values, index, ptr, size, copy) {
        // rows and columns
        var rows = size[0];
        var columns = size[1];
        // result
        var a = [];
        // vars
        var i, j;
        // initialize array
        for (i = 0; i < rows; i++) {
          a[i] = [];
          for (j = 0; j < columns; j++) {
            a[i][j] = 0;
          }
        }

        // loop columns
        for (j = 0; j < columns; j++) {
          // k0 <= k < k1 where k0 = _ptr[j] && k1 = _ptr[j+1]
          var k0 = ptr[j];
          var k1 = ptr[j + 1];
          // loop k within [k0, k1[
          for (var k = k0; k < k1; k++) {
            // row index
            i = index[k];
            // set value (use one for pattern matrix)
            a[i][j] = values ? copy ? clone$2(values[k]) : values[k] : 1;
          }
        }
        return a;
      }

      /**
       * Get a string representation of the matrix, with optional formatting options.
       * @memberof SparseMatrix
       * @param {Object | number | Function} [options]  Formatting options. See
       *                                                lib/utils/number:format for a
       *                                                description of the available
       *                                                options.
       * @returns {string} str
       */
      SparseMatrix.prototype.format = function (options) {
        // rows and columns
        var rows = this._size[0];
        var columns = this._size[1];
        // density
        var density = this.density();
        // rows & columns
        var str = 'Sparse Matrix [' + format(rows, options) + ' x ' + format(columns, options) + '] density: ' + format(density, options) + '\n';
        // loop columns
        for (var j = 0; j < columns; j++) {
          // k0 <= k < k1 where k0 = _ptr[j] && k1 = _ptr[j+1]
          var k0 = this._ptr[j];
          var k1 = this._ptr[j + 1];
          // loop k within [k0, k1[
          for (var k = k0; k < k1; k++) {
            // row index
            var i = this._index[k];
            // append value
            str += '\n    (' + format(i, options) + ', ' + format(j, options) + ') ==> ' + (this._values ? format(this._values[k], options) : 'X');
          }
        }
        return str;
      };

      /**
       * Get a string representation of the matrix
       * @memberof SparseMatrix
       * @returns {string} str
       */
      SparseMatrix.prototype.toString = function () {
        return format(this.toArray());
      };

      /**
       * Get a JSON representation of the matrix
       * @memberof SparseMatrix
       * @returns {Object}
       */
      SparseMatrix.prototype.toJSON = function () {
        return {
          mathjs: 'SparseMatrix',
          values: this._values,
          index: this._index,
          ptr: this._ptr,
          size: this._size,
          datatype: this._datatype
        };
      };

      /**
       * Get the kth Matrix diagonal.
       *
       * @memberof SparseMatrix
       * @param {number | BigNumber} [k=0]     The kth diagonal where the vector will retrieved.
       *
       * @returns {Matrix}                     The matrix vector with the diagonal values.
       */
      SparseMatrix.prototype.diagonal = function (k) {
        // validate k if any
        if (k) {
          // convert BigNumber to a number
          if (isBigNumber(k)) {
            k = k.toNumber();
          }
          // is must be an integer
          if (!isNumber(k) || !isInteger(k)) {
            throw new TypeError('The parameter k must be an integer number');
          }
        } else {
          // default value
          k = 0;
        }
        var kSuper = k > 0 ? k : 0;
        var kSub = k < 0 ? -k : 0;

        // rows & columns
        var rows = this._size[0];
        var columns = this._size[1];

        // number diagonal values
        var n = Math.min(rows - kSub, columns - kSuper);

        // diagonal arrays
        var values = [];
        var index = [];
        var ptr = [];
        // initial ptr value
        ptr[0] = 0;
        // loop columns
        for (var j = kSuper; j < columns && values.length < n; j++) {
          // k0 <= k < k1 where k0 = _ptr[j] && k1 = _ptr[j+1]
          var k0 = this._ptr[j];
          var k1 = this._ptr[j + 1];
          // loop x within [k0, k1[
          for (var x = k0; x < k1; x++) {
            // row index
            var i = this._index[x];
            // check row
            if (i === j - kSuper + kSub) {
              // value on this column
              values.push(this._values[x]);
              // store row
              index[values.length - 1] = i - kSub;
              // exit loop
              break;
            }
          }
        }
        // close ptr
        ptr.push(values.length);
        // return matrix
        return new SparseMatrix({
          values,
          index,
          ptr,
          size: [n, 1]
        });
      };

      /**
       * Generate a matrix from a JSON object
       * @memberof SparseMatrix
       * @param {Object} json  An object structured like
       *                       `{"mathjs": "SparseMatrix", "values": [], "index": [], "ptr": [], "size": []}`,
       *                       where mathjs is optional
       * @returns {SparseMatrix}
       */
      SparseMatrix.fromJSON = function (json) {
        return new SparseMatrix(json);
      };

      /**
       * Create a diagonal matrix.
       *
       * @memberof SparseMatrix
       * @param {Array} size                       The matrix size.
       * @param {number | Array | Matrix } value   The values for the diagonal.
       * @param {number | BigNumber} [k=0]         The kth diagonal where the vector will be filled in.
       * @param {number} [defaultValue]            The default value for non-diagonal
       * @param {string} [datatype]                The Matrix datatype, values must be of this datatype.
       *
       * @returns {SparseMatrix}
       */
      SparseMatrix.diagonal = function (size, value, k, defaultValue, datatype) {
        if (!isArray(size)) {
          throw new TypeError('Array expected, size parameter');
        }
        if (size.length !== 2) {
          throw new Error('Only two dimensions matrix are supported');
        }

        // map size & validate
        size = size.map(function (s) {
          // check it is a big number
          if (isBigNumber(s)) {
            // convert it
            s = s.toNumber();
          }
          // validate arguments
          if (!isNumber(s) || !isInteger(s) || s < 1) {
            throw new Error('Size values must be positive integers');
          }
          return s;
        });

        // validate k if any
        if (k) {
          // convert BigNumber to a number
          if (isBigNumber(k)) {
            k = k.toNumber();
          }
          // is must be an integer
          if (!isNumber(k) || !isInteger(k)) {
            throw new TypeError('The parameter k must be an integer number');
          }
        } else {
          // default value
          k = 0;
        }

        // equal signature to use
        var eq = equalScalar;
        // zero value
        var zero = 0;
        if (isString(datatype)) {
          // find signature that matches (datatype, datatype)
          eq = typed.find(equalScalar, [datatype, datatype]) || equalScalar;
          // convert 0 to the same datatype
          zero = typed.convert(0, datatype);
        }
        var kSuper = k > 0 ? k : 0;
        var kSub = k < 0 ? -k : 0;

        // rows and columns
        var rows = size[0];
        var columns = size[1];

        // number of non-zero items
        var n = Math.min(rows - kSub, columns - kSuper);

        // value extraction function
        var _value;

        // check value
        if (isArray(value)) {
          // validate array
          if (value.length !== n) {
            // number of values in array must be n
            throw new Error('Invalid value array length');
          }
          // define function
          _value = function _value(i) {
            // return value @ i
            return value[i];
          };
        } else if (isMatrix(value)) {
          // matrix size
          var ms = value.size();
          // validate matrix
          if (ms.length !== 1 || ms[0] !== n) {
            // number of values in array must be n
            throw new Error('Invalid matrix length');
          }
          // define function
          _value = function _value(i) {
            // return value @ i
            return value.get([i]);
          };
        } else {
          // define function
          _value = function _value() {
            // return value
            return value;
          };
        }

        // create arrays
        var values = [];
        var index = [];
        var ptr = [];

        // loop items
        for (var j = 0; j < columns; j++) {
          // number of rows with value
          ptr.push(values.length);
          // diagonal index
          var i = j - kSuper;
          // check we need to set diagonal value
          if (i >= 0 && i < n) {
            // get value @ i
            var v = _value(i);
            // check for zero
            if (!eq(v, zero)) {
              // column
              index.push(i + kSub);
              // add value
              values.push(v);
            }
          }
        }
        // last value should be number of values
        ptr.push(values.length);
        // create SparseMatrix
        return new SparseMatrix({
          values,
          index,
          ptr,
          size: [rows, columns]
        });
      };

      /**
       * Swap rows i and j in Matrix.
       *
       * @memberof SparseMatrix
       * @param {number} i       Matrix row index 1
       * @param {number} j       Matrix row index 2
       *
       * @return {Matrix}        The matrix reference
       */
      SparseMatrix.prototype.swapRows = function (i, j) {
        // check index
        if (!isNumber(i) || !isInteger(i) || !isNumber(j) || !isInteger(j)) {
          throw new Error('Row index must be positive integers');
        }
        // check dimensions
        if (this._size.length !== 2) {
          throw new Error('Only two dimensional matrix is supported');
        }
        // validate index
        validateIndex(i, this._size[0]);
        validateIndex(j, this._size[0]);

        // swap rows
        SparseMatrix._swapRows(i, j, this._size[1], this._values, this._index, this._ptr);
        // return current instance
        return this;
      };

      /**
       * Loop rows with data in column j.
       *
       * @param {number} j            Column
       * @param {Array} values        Matrix values
       * @param {Array} index         Matrix row indeces
       * @param {Array} ptr           Matrix column pointers
       * @param {Function} callback   Callback function invoked for every row in column j
       */
      SparseMatrix._forEachRow = function (j, values, index, ptr, callback) {
        // indeces for column j
        var k0 = ptr[j];
        var k1 = ptr[j + 1];

        // loop
        for (var k = k0; k < k1; k++) {
          // invoke callback
          callback(index[k], values[k]);
        }
      };

      /**
       * Swap rows x and y in Sparse Matrix data structures.
       *
       * @param {number} x         Matrix row index 1
       * @param {number} y         Matrix row index 2
       * @param {number} columns   Number of columns in matrix
       * @param {Array} values     Matrix values
       * @param {Array} index      Matrix row indeces
       * @param {Array} ptr        Matrix column pointers
       */
      SparseMatrix._swapRows = function (x, y, columns, values, index, ptr) {
        // loop columns
        for (var j = 0; j < columns; j++) {
          // k0 <= k < k1 where k0 = _ptr[j] && k1 = _ptr[j+1]
          var k0 = ptr[j];
          var k1 = ptr[j + 1];
          // find value index @ x
          var kx = _getValueIndex(x, k0, k1, index);
          // find value index @ x
          var ky = _getValueIndex(y, k0, k1, index);
          // check both rows exist in matrix
          if (kx < k1 && ky < k1 && index[kx] === x && index[ky] === y) {
            // swap values (check for pattern matrix)
            if (values) {
              var v = values[kx];
              values[kx] = values[ky];
              values[ky] = v;
            }
            // next column
            continue;
          }
          // check x row exist & no y row
          if (kx < k1 && index[kx] === x && (ky >= k1 || index[ky] !== y)) {
            // value @ x (check for pattern matrix)
            var vx = values ? values[kx] : undefined;
            // insert value @ y
            index.splice(ky, 0, y);
            if (values) {
              values.splice(ky, 0, vx);
            }
            // remove value @ x (adjust array index if needed)
            index.splice(ky <= kx ? kx + 1 : kx, 1);
            if (values) {
              values.splice(ky <= kx ? kx + 1 : kx, 1);
            }
            // next column
            continue;
          }
          // check y row exist & no x row
          if (ky < k1 && index[ky] === y && (kx >= k1 || index[kx] !== x)) {
            // value @ y (check for pattern matrix)
            var vy = values ? values[ky] : undefined;
            // insert value @ x
            index.splice(kx, 0, x);
            if (values) {
              values.splice(kx, 0, vy);
            }
            // remove value @ y (adjust array index if needed)
            index.splice(kx <= ky ? ky + 1 : ky, 1);
            if (values) {
              values.splice(kx <= ky ? ky + 1 : ky, 1);
            }
          }
        }
      };
      return SparseMatrix;
    }, {
      isClass: true
    });

    var name$n = 'number';
    var dependencies$n = ['typed'];

    /**
     * Separates the radix, integer part, and fractional part of a non decimal number string
     * @param {string} input string to parse
     * @returns {object} the parts of the string or null if not a valid input
     */
    function getNonDecimalNumberParts(input) {
      var nonDecimalWithRadixMatch = input.match(/(0[box])([0-9a-fA-F]*)\.([0-9a-fA-F]*)/);
      if (nonDecimalWithRadixMatch) {
        var radix = {
          '0b': 2,
          '0o': 8,
          '0x': 16
        }[nonDecimalWithRadixMatch[1]];
        var integerPart = nonDecimalWithRadixMatch[2];
        var fractionalPart = nonDecimalWithRadixMatch[3];
        return {
          input,
          radix,
          integerPart,
          fractionalPart
        };
      } else {
        return null;
      }
    }

    /**
     * Makes a number from a radix, and integer part, and a fractional part
     * @param {parts} [x] parts of the number string (from getNonDecimalNumberParts)
     * @returns {number} the number
     */
    function makeNumberFromNonDecimalParts(parts) {
      var n = parseInt(parts.integerPart, parts.radix);
      var f = 0;
      for (var i = 0; i < parts.fractionalPart.length; i++) {
        var digitValue = parseInt(parts.fractionalPart[i], parts.radix);
        f += digitValue / Math.pow(parts.radix, i + 1);
      }
      var result = n + f;
      if (isNaN(result)) {
        throw new SyntaxError('String "' + parts.input + '" is not a valid number');
      }
      return result;
    }
    var createNumber = /* #__PURE__ */factory(name$n, dependencies$n, _ref => {
      var {
        typed
      } = _ref;
      /**
       * Create a number or convert a string, boolean, or unit to a number.
       * When value is a matrix, all elements will be converted to number.
       *
       * Syntax:
       *
       *    math.number(value)
       *    math.number(unit, valuelessUnit)
       *
       * Examples:
       *
       *    math.number(2)                         // returns number 2
       *    math.number('7.2')                     // returns number 7.2
       *    math.number(true)                      // returns number 1
       *    math.number([true, false, true, true]) // returns [1, 0, 1, 1]
       *    math.number(math.unit('52cm'), 'm')    // returns 0.52
       *
       * See also:
       *
       *    bignumber, bigint, boolean, numeric, complex, index, matrix, string, unit
       *
       * @param {string | number | BigNumber | Fraction | boolean | Array | Matrix | Unit | null} [value]  Value to be converted
       * @param {Unit | string} [valuelessUnit] A valueless unit, used to convert a unit to a number
       * @return {number | Array | Matrix} The created number
       */
      var number = typed('number', {
        '': function _() {
          return 0;
        },
        number: function number(x) {
          return x;
        },
        string: function string(x) {
          if (x === 'NaN') return NaN;
          var nonDecimalNumberParts = getNonDecimalNumberParts(x);
          if (nonDecimalNumberParts) {
            return makeNumberFromNonDecimalParts(nonDecimalNumberParts);
          }
          var size = 0;
          var wordSizeSuffixMatch = x.match(/(0[box][0-9a-fA-F]*)i([0-9]*)/);
          if (wordSizeSuffixMatch) {
            // x includes a size suffix like 0xffffi32, so we extract
            // the suffix and remove it from x
            size = Number(wordSizeSuffixMatch[2]);
            x = wordSizeSuffixMatch[1];
          }
          var num = Number(x);
          if (isNaN(num)) {
            throw new SyntaxError('String "' + x + '" is not a valid number');
          }
          if (wordSizeSuffixMatch) {
            // x is a signed bin, oct, or hex literal
            // num is the value of string x if x is interpreted as unsigned
            if (num > 2 ** size - 1) {
              // literal is too large for size suffix
              throw new SyntaxError("String \"".concat(x, "\" is out of range"));
            }
            // check if the bit at index size - 1 is set and if so do the twos complement
            if (num >= 2 ** (size - 1)) {
              num = num - 2 ** size;
            }
          }
          return num;
        },
        BigNumber: function BigNumber(x) {
          return x.toNumber();
        },
        bigint: function bigint(x) {
          return Number(x);
        },
        Fraction: function Fraction(x) {
          return x.valueOf();
        },
        Unit: typed.referToSelf(self => x => {
          var clone = x.clone();
          clone.value = self(x.value);
          return clone;
        }),
        null: function _null(x) {
          return 0;
        },
        'Unit, string | Unit': function Unit_string__Unit(unit, valuelessUnit) {
          return unit.toNumber(valuelessUnit);
        },
        'Array | Matrix': typed.referToSelf(self => x => deepMap(x, self))
      });

      // reviver function to parse a JSON object like:
      //
      //     {"mathjs":"number","value":"2.3"}
      //
      // into a number 2.3
      number.fromJSON = function (json) {
        return parseFloat(json.value);
      };
      return number;
    });

    var name$m = 'bignumber';
    var dependencies$m = ['typed', 'BigNumber'];
    var createBignumber = /* #__PURE__ */factory(name$m, dependencies$m, _ref => {
      var {
        typed,
        BigNumber
      } = _ref;
      /**
       * Create a BigNumber, which can store numbers with arbitrary precision.
       * When a matrix is provided, all elements will be converted to BigNumber.
       *
       * Syntax:
       *
       *    math.bignumber(x)
       *
       * Examples:
       *
       *    0.1 + 0.2                                  // returns number 0.30000000000000004
       *    math.bignumber(0.1) + math.bignumber(0.2)  // returns BigNumber 0.3
       *
       *
       *    7.2e500                                    // returns number Infinity
       *    math.bignumber('7.2e500')                  // returns BigNumber 7.2e500
       *
       * See also:
       *
       *    number, bigint, boolean, complex, index, matrix, string, unit
       *
       * @param {number | string | Fraction | BigNumber | bigint | Array | Matrix | boolean | null} [value]  Value for the big number,
       *                                                    0 by default.
       * @returns {BigNumber} The created bignumber
       */
      return typed('bignumber', {
        '': function _() {
          return new BigNumber(0);
        },
        number: function number(x) {
          // convert to string to prevent errors in case of >15 digits
          return new BigNumber(x + '');
        },
        string: function string(x) {
          var wordSizeSuffixMatch = x.match(/(0[box][0-9a-fA-F]*)i([0-9]*)/);
          if (wordSizeSuffixMatch) {
            // x has a word size suffix
            var size = wordSizeSuffixMatch[2];
            var n = BigNumber(wordSizeSuffixMatch[1]);
            var twoPowSize = new BigNumber(2).pow(Number(size));
            if (n.gt(twoPowSize.sub(1))) {
              throw new SyntaxError("String \"".concat(x, "\" is out of range"));
            }
            var twoPowSizeSubOne = new BigNumber(2).pow(Number(size) - 1);
            if (n.gte(twoPowSizeSubOne)) {
              return n.sub(twoPowSize);
            } else {
              return n;
            }
          }
          return new BigNumber(x);
        },
        BigNumber: function BigNumber(x) {
          // we assume a BigNumber is immutable
          return x;
        },
        bigint: function bigint(x) {
          return new BigNumber(x.toString());
        },
        Unit: typed.referToSelf(self => x => {
          var clone = x.clone();
          clone.value = self(x.value);
          return clone;
        }),
        Fraction: function Fraction(x) {
          return new BigNumber(String(x.n)).div(String(x.d)).times(String(x.s));
        },
        null: function _null(_x) {
          return new BigNumber(0);
        },
        'Array | Matrix': typed.referToSelf(self => x => deepMap(x, self))
      });
    });

    var name$l = 'fraction';
    var dependencies$l = ['typed', 'Fraction'];
    var createFraction = /* #__PURE__ */factory(name$l, dependencies$l, _ref => {
      var {
        typed,
        Fraction
      } = _ref;
      /**
       * Create a fraction or convert a value to a fraction.
       *
       * With one numeric argument, produces the closest rational approximation to the
       * input.
       * With two arguments, the first is the numerator and the second is the denominator,
       * and creates the corresponding fraction. Both numerator and denominator must be
       * integers.
       * With one object argument, looks for the integer numerator as the value of property
       * 'n' and the integer denominator as the value of property 'd'.
       * With a matrix argument, creates a matrix of the same shape with entries
       * converted into fractions.
       *
       * Syntax:
       *     math.fraction(value)
       *     math.fraction(numerator, denominator)
       *     math.fraction({n: numerator, d: denominator})
       *     math.fraction(matrix: Array | Matrix)
       *
       * Examples:
       *
       *     math.fraction(6.283)             // returns Fraction 6283/1000
       *     math.fraction(1, 3)              // returns Fraction 1/3
       *     math.fraction('2/3')             // returns Fraction 2/3
       *     math.fraction({n: 2, d: 3})      // returns Fraction 2/3
       *     math.fraction([0.2, 0.25, 1.25]) // returns Array [1/5, 1/4, 5/4]
       *     math.fraction(4, 5.1)            // throws Error: Parameters must be integer
       *
       * See also:
       *
       *    bignumber, number, string, unit
       *
       * @param {number | string | Fraction | BigNumber | bigint | Unit | Array | Matrix} [args]
       *            Arguments specifying the value, or numerator and denominator of
       *            the fraction
       * @return {Fraction | Array | Matrix} Returns a fraction
       */
      return typed('fraction', {
        number: function number(x) {
          if (!isFinite(x) || isNaN(x)) {
            throw new Error(x + ' cannot be represented as a fraction');
          }
          return new Fraction(x);
        },
        string: function string(x) {
          return new Fraction(x);
        },
        'number, number': function number_number(numerator, denominator) {
          return new Fraction(numerator, denominator);
        },
        'bigint, bigint': function bigint_bigint(numerator, denominator) {
          return new Fraction(numerator, denominator);
        },
        null: function _null(x) {
          return new Fraction(0);
        },
        BigNumber: function BigNumber(x) {
          return new Fraction(x.toString());
        },
        bigint: function bigint(x) {
          return new Fraction(x.toString());
        },
        Fraction: function Fraction(x) {
          return x; // fractions are immutable
        },
        Unit: typed.referToSelf(self => x => {
          var clone = x.clone();
          clone.value = self(x.value);
          return clone;
        }),
        Object: function Object(x) {
          return new Fraction(x);
        },
        'Array | Matrix': typed.referToSelf(self => x => deepMap(x, self))
      });
    });

    var name$k = 'matrix';
    var dependencies$k = ['typed', 'Matrix', 'DenseMatrix', 'SparseMatrix'];
    var createMatrix = /* #__PURE__ */factory(name$k, dependencies$k, _ref => {
      var {
        typed,
        Matrix,
        DenseMatrix,
        SparseMatrix
      } = _ref;
      /**
       * Create a Matrix. The function creates a new `math.Matrix` object from
       * an `Array`. A Matrix has utility functions to manipulate the data in the
       * matrix, like getting the size and getting or setting values in the matrix.
       * Supported storage formats are 'dense' and 'sparse'.
       *
       * Syntax:
       *
       *    math.matrix()                         // creates an empty matrix using default storage format (dense).
       *    math.matrix(data)                     // creates a matrix with initial data using default storage format (dense).
       *    math.matrix('dense')                  // creates an empty matrix using the given storage format.
       *    math.matrix(data, 'dense')            // creates a matrix with initial data using the given storage format.
       *    math.matrix(data, 'sparse')           // creates a sparse matrix with initial data.
       *    math.matrix(data, 'sparse', 'number') // creates a sparse matrix with initial data, number data type.
       *
       * Examples:
       *
       *    let m = math.matrix([[1, 2], [3, 4]])
       *    m.size()                        // Array [2, 2]
       *    m.resize([3, 2], 5)
       *    m.valueOf()                     // Array [[1, 2], [3, 4], [5, 5]]
       *    m.get([1, 0])                    // number 3
       *
       * See also:
       *
       *    bignumber, boolean, complex, index, number, string, unit, sparse
       *
       * @param {Array | Matrix} [data]    A multi dimensional array
       * @param {string} [format]          The Matrix storage format, either `'dense'` or `'sparse'`
       * @param {string} [datatype]        Type of the values
       *
       * @return {Matrix} The created matrix
       */
      return typed(name$k, {
        '': function _() {
          return _create([]);
        },
        string: function string(format) {
          return _create([], format);
        },
        'string, string': function string_string(format, datatype) {
          return _create([], format, datatype);
        },
        Array: function Array(data) {
          return _create(data);
        },
        Matrix: function Matrix(data) {
          return _create(data, data.storage());
        },
        'Array | Matrix, string': _create,
        'Array | Matrix, string, string': _create
      });

      /**
       * Create a new Matrix with given storage format
       * @param {Array} data
       * @param {string} [format]
       * @param {string} [datatype]
       * @returns {Matrix} Returns a new Matrix
       * @private
       */
      function _create(data, format, datatype) {
        // get storage format constructor
        if (format === 'dense' || format === 'default' || format === undefined) {
          return new DenseMatrix(data, datatype);
        }
        if (format === 'sparse') {
          return new SparseMatrix(data, datatype);
        }
        throw new TypeError('Unknown matrix type ' + JSON.stringify(format) + '.');
      }
    });

    var name$j = 'unaryMinus';
    var dependencies$j = ['typed'];
    var createUnaryMinus = /* #__PURE__ */factory(name$j, dependencies$j, _ref => {
      var {
        typed
      } = _ref;
      /**
       * Inverse the sign of a value, apply a unary minus operation.
       *
       * For matrices, the function is evaluated element wise. Boolean values and
       * strings will be converted to a number. For complex numbers, both real and
       * complex value are inverted.
       *
       * Syntax:
       *
       *    math.unaryMinus(x)
       *
       * Examples:
       *
       *    math.unaryMinus(3.5)      // returns -3.5
       *    math.unaryMinus(-4.2)     // returns 4.2
       *
       * See also:
       *
       *    add, subtract, unaryPlus
       *
       * @param  {number | BigNumber | bigint | Fraction | Complex | Unit | Array | Matrix} x Number to be inverted.
       * @return {number | BigNumber | bigint | Fraction | Complex | Unit | Array | Matrix} Returns the value with inverted sign.
       */
      return typed(name$j, {
        number: unaryMinusNumber,
        'Complex | BigNumber | Fraction': x => x.neg(),
        bigint: x => -x,
        Unit: typed.referToSelf(self => x => {
          var res = x.clone();
          res.value = typed.find(self, res.valueType())(x.value);
          return res;
        }),
        // deep map collection, skip zeros since unaryMinus(0) = 0
        'Array | Matrix': typed.referToSelf(self => x => deepMap(x, self, true))

        // TODO: add support for string
      });
    });

    var name$i = 'abs';
    var dependencies$i = ['typed'];
    var createAbs = /* #__PURE__ */factory(name$i, dependencies$i, _ref => {
      var {
        typed
      } = _ref;
      /**
       * Calculate the absolute value of a number. For matrices, the function is
       * evaluated element wise.
       *
       * Syntax:
       *
       *    math.abs(x)
       *
       * Examples:
       *
       *    math.abs(3.5)                // returns number 3.5
       *    math.abs(-4.2)               // returns number 4.2
       *
       *    math.abs([3, -5, -1, 0, 2])  // returns Array [3, 5, 1, 0, 2]
       *
       * See also:
       *
       *    sign
       *
       * @param  {number | BigNumber | bigint | Fraction | Complex | Array | Matrix | Unit} x
       *            A number or matrix for which to get the absolute value
       * @return {number | BigNumber | bigint | Fraction | Complex | Array | Matrix | Unit}
       *            Absolute value of `x`
       */
      return typed(name$i, {
        number: absNumber,
        'Complex | BigNumber | Fraction | Unit': x => x.abs(),
        bigint: x => x < 0n ? -x : x,
        // deep map collection, skip zeros since abs(0) = 0
        'Array | Matrix': typed.referToSelf(self => x => deepMap(x, self, true))
      });
    });

    var name$h = 'addScalar';
    var dependencies$h = ['typed'];
    var createAddScalar = /* #__PURE__ */factory(name$h, dependencies$h, _ref => {
      var {
        typed
      } = _ref;
      /**
       * Add two scalar values, `x + y`.
       * This function is meant for internal use: it is used by the public function
       * `add`
       *
       * This function does not support collections (Array or Matrix).
       *
       * @param  {number | BigNumber | bigint | Fraction | Complex | Unit} x   First value to add
       * @param  {number | BigNumber | bigint | Fraction | Complex} y          Second value to add
       * @return {number | BigNumber | bigint | Fraction | Complex | Unit}     Sum of `x` and `y`
       * @private
       */
      return typed(name$h, {
        'number, number': addNumber,
        'Complex, Complex': function Complex_Complex(x, y) {
          return x.add(y);
        },
        'BigNumber, BigNumber': function BigNumber_BigNumber(x, y) {
          return x.plus(y);
        },
        'bigint, bigint': function bigint_bigint(x, y) {
          return x + y;
        },
        'Fraction, Fraction': function Fraction_Fraction(x, y) {
          return x.add(y);
        },
        'Unit, Unit': typed.referToSelf(self => (x, y) => {
          if (x.value === null || x.value === undefined) {
            throw new Error('Parameter x contains a unit with undefined value');
          }
          if (y.value === null || y.value === undefined) {
            throw new Error('Parameter y contains a unit with undefined value');
          }
          if (!x.equalBase(y)) throw new Error('Units do not match');
          var res = x.clone();
          res.value = typed.find(self, [res.valueType(), y.valueType()])(res.value, y.value);
          res.fixPrefix = false;
          return res;
        })
      });
    });

    var name$g = 'subtractScalar';
    var dependencies$g = ['typed'];
    var createSubtractScalar = /* #__PURE__ */factory(name$g, dependencies$g, _ref => {
      var {
        typed
      } = _ref;
      /**
       * Subtract two scalar values, `x - y`.
       * This function is meant for internal use: it is used by the public function
       * `subtract`
       *
       * This function does not support collections (Array or Matrix).
       *
       * @param  {number | BigNumber | bigint | Fraction | Complex | Unit} x   First value
       * @param  {number | BigNumber | bigint | Fraction | Complex} y          Second value to be subtracted from `x`
       * @return {number | BigNumber | bigint | Fraction | Complex | Unit}     Difference of `x` and `y`
       * @private
       */
      return typed(name$g, {
        'number, number': subtractNumber,
        'Complex, Complex': function Complex_Complex(x, y) {
          return x.sub(y);
        },
        'BigNumber, BigNumber': function BigNumber_BigNumber(x, y) {
          return x.minus(y);
        },
        'bigint, bigint': function bigint_bigint(x, y) {
          return x - y;
        },
        'Fraction, Fraction': function Fraction_Fraction(x, y) {
          return x.sub(y);
        },
        'Unit, Unit': typed.referToSelf(self => (x, y) => {
          if (x.value === null || x.value === undefined) {
            throw new Error('Parameter x contains a unit with undefined value');
          }
          if (y.value === null || y.value === undefined) {
            throw new Error('Parameter y contains a unit with undefined value');
          }
          if (!x.equalBase(y)) throw new Error('Units do not match');
          var res = x.clone();
          res.value = typed.find(self, [res.valueType(), y.valueType()])(res.value, y.value);
          res.fixPrefix = false;
          return res;
        })
      });
    });

    var name$f = 'matAlgo11xS0s';
    var dependencies$f = ['typed', 'equalScalar'];
    var createMatAlgo11xS0s = /* #__PURE__ */factory(name$f, dependencies$f, _ref => {
      var {
        typed,
        equalScalar
      } = _ref;
      /**
       * Iterates over SparseMatrix S nonzero items and invokes the callback function f(Sij, b).
       * Callback function invoked NZ times (number of nonzero items in S).
       *
       *
       *          ┌  f(Sij, b)  ; S(i,j) !== 0
       * C(i,j) = ┤
       *          └  0          ; otherwise
       *
       *
       * @param {Matrix}   s                 The SparseMatrix instance (S)
       * @param {Scalar}   b                 The Scalar value
       * @param {Function} callback          The f(Aij,b) operation to invoke
       * @param {boolean}  inverse           A true value indicates callback should be invoked f(b,Sij)
       *
       * @return {Matrix}                    SparseMatrix (C)
       *
       * https://github.com/josdejong/mathjs/pull/346#issuecomment-97626813
       */
      return function matAlgo11xS0s(s, b, callback, inverse) {
        // sparse matrix arrays
        var avalues = s._values;
        var aindex = s._index;
        var aptr = s._ptr;
        var asize = s._size;
        var adt = s._datatype;

        // sparse matrix cannot be a Pattern matrix
        if (!avalues) {
          throw new Error('Cannot perform operation on Pattern Sparse Matrix and Scalar value');
        }

        // rows & columns
        var rows = asize[0];
        var columns = asize[1];

        // datatype
        var dt;
        // equal signature to use
        var eq = equalScalar;
        // zero value
        var zero = 0;
        // callback signature to use
        var cf = callback;

        // process data types
        if (typeof adt === 'string') {
          // datatype
          dt = adt;
          // find signature that matches (dt, dt)
          eq = typed.find(equalScalar, [dt, dt]);
          // convert 0 to the same datatype
          zero = typed.convert(0, dt);
          // convert b to the same datatype
          b = typed.convert(b, dt);
          // callback
          cf = typed.find(callback, [dt, dt]);
        }

        // result arrays
        var cvalues = [];
        var cindex = [];
        var cptr = [];

        // loop columns
        for (var j = 0; j < columns; j++) {
          // initialize ptr
          cptr[j] = cindex.length;
          // values in j
          for (var k0 = aptr[j], k1 = aptr[j + 1], k = k0; k < k1; k++) {
            // row
            var i = aindex[k];
            // invoke callback
            var v = inverse ? cf(b, avalues[k]) : cf(avalues[k], b);
            // check value is zero
            if (!eq(v, zero)) {
              // push index & value
              cindex.push(i);
              cvalues.push(v);
            }
          }
        }
        // update ptr
        cptr[columns] = cindex.length;

        // return sparse matrix
        return s.createSparseMatrix({
          values: cvalues,
          index: cindex,
          ptr: cptr,
          size: [rows, columns],
          datatype: dt
        });
      };
    });

    var name$e = 'matAlgo14xDs';
    var dependencies$e = ['typed'];
    var createMatAlgo14xDs = /* #__PURE__ */factory(name$e, dependencies$e, _ref => {
      var {
        typed
      } = _ref;
      /**
       * Iterates over DenseMatrix items and invokes the callback function f(Aij..z, b).
       * Callback function invoked MxN times.
       *
       * C(i,j,...z) = f(Aij..z, b)
       *
       * @param {Matrix}   a                 The DenseMatrix instance (A)
       * @param {Scalar}   b                 The Scalar value
       * @param {Function} callback          The f(Aij..z,b) operation to invoke
       * @param {boolean}  inverse           A true value indicates callback should be invoked f(b,Aij..z)
       *
       * @return {Matrix}                    DenseMatrix (C)
       *
       * https://github.com/josdejong/mathjs/pull/346#issuecomment-97659042
       */
      return function matAlgo14xDs(a, b, callback, inverse) {
        // a arrays
        var adata = a._data;
        var asize = a._size;
        var adt = a._datatype;

        // datatype
        var dt;
        // callback signature to use
        var cf = callback;

        // process data types
        if (typeof adt === 'string') {
          // datatype
          dt = adt;
          // convert b to the same datatype
          b = typed.convert(b, dt);
          // callback
          cf = typed.find(callback, [dt, dt]);
        }

        // populate cdata, iterate through dimensions
        var cdata = asize.length > 0 ? _iterate(cf, 0, asize, asize[0], adata, b, inverse) : [];

        // c matrix
        return a.createDenseMatrix({
          data: cdata,
          size: clone$2(asize),
          datatype: dt
        });
      };

      // recursive function
      function _iterate(f, level, s, n, av, bv, inverse) {
        // initialize array for this level
        var cv = [];
        // check we reach the last level
        if (level === s.length - 1) {
          // loop arrays in last level
          for (var i = 0; i < n; i++) {
            // invoke callback and store value
            cv[i] = inverse ? f(bv, av[i]) : f(av[i], bv);
          }
        } else {
          // iterate current level
          for (var j = 0; j < n; j++) {
            // iterate next level
            cv[j] = _iterate(f, level + 1, s, s[level + 1], av[j], bv, inverse);
          }
        }
        return cv;
      }
    });

    var name$d = 'multiplyScalar';
    var dependencies$d = ['typed'];
    var createMultiplyScalar = /* #__PURE__ */factory(name$d, dependencies$d, _ref => {
      var {
        typed
      } = _ref;
      /**
       * Multiply two scalar values, `x * y`.
       * This function is meant for internal use: it is used by the public function
       * `multiply`
       *
       * This function does not support collections (Array or Matrix).
       *
       * @param  {number | BigNumber | bigint | Fraction | Complex | Unit} x   First value to multiply
       * @param  {number | BigNumber | bigint | Fraction | Complex} y          Second value to multiply
       * @return {number | BigNumber | bigint | Fraction | Complex | Unit}     Multiplication of `x` and `y`
       * @private
       */
      return typed('multiplyScalar', {
        'number, number': multiplyNumber,
        'Complex, Complex': function Complex_Complex(x, y) {
          return x.mul(y);
        },
        'BigNumber, BigNumber': function BigNumber_BigNumber(x, y) {
          return x.times(y);
        },
        'bigint, bigint': function bigint_bigint(x, y) {
          return x * y;
        },
        'Fraction, Fraction': function Fraction_Fraction(x, y) {
          return x.mul(y);
        },
        'number | Fraction | BigNumber | Complex, Unit': (x, y) => y.multiply(x),
        'Unit, number | Fraction | BigNumber | Complex | Unit': (x, y) => x.multiply(y)
      });
    });

    var name$c = 'multiply';
    var dependencies$c = ['typed', 'matrix', 'addScalar', 'multiplyScalar', 'equalScalar', 'dot'];
    var createMultiply = /* #__PURE__ */factory(name$c, dependencies$c, _ref => {
      var {
        typed,
        matrix,
        addScalar,
        multiplyScalar,
        equalScalar,
        dot
      } = _ref;
      var matAlgo11xS0s = createMatAlgo11xS0s({
        typed,
        equalScalar
      });
      var matAlgo14xDs = createMatAlgo14xDs({
        typed
      });
      function _validateMatrixDimensions(size1, size2) {
        // check left operand dimensions
        switch (size1.length) {
          case 1:
            // check size2
            switch (size2.length) {
              case 1:
                // Vector x Vector
                if (size1[0] !== size2[0]) {
                  // throw error
                  throw new RangeError('Dimension mismatch in multiplication. Vectors must have the same length');
                }
                break;
              case 2:
                // Vector x Matrix
                if (size1[0] !== size2[0]) {
                  // throw error
                  throw new RangeError('Dimension mismatch in multiplication. Vector length (' + size1[0] + ') must match Matrix rows (' + size2[0] + ')');
                }
                break;
              default:
                throw new Error('Can only multiply a 1 or 2 dimensional matrix (Matrix B has ' + size2.length + ' dimensions)');
            }
            break;
          case 2:
            // check size2
            switch (size2.length) {
              case 1:
                // Matrix x Vector
                if (size1[1] !== size2[0]) {
                  // throw error
                  throw new RangeError('Dimension mismatch in multiplication. Matrix columns (' + size1[1] + ') must match Vector length (' + size2[0] + ')');
                }
                break;
              case 2:
                // Matrix x Matrix
                if (size1[1] !== size2[0]) {
                  // throw error
                  throw new RangeError('Dimension mismatch in multiplication. Matrix A columns (' + size1[1] + ') must match Matrix B rows (' + size2[0] + ')');
                }
                break;
              default:
                throw new Error('Can only multiply a 1 or 2 dimensional matrix (Matrix B has ' + size2.length + ' dimensions)');
            }
            break;
          default:
            throw new Error('Can only multiply a 1 or 2 dimensional matrix (Matrix A has ' + size1.length + ' dimensions)');
        }
      }

      /**
       * C = A * B
       *
       * @param {Matrix} a            Dense Vector   (N)
       * @param {Matrix} b            Dense Vector   (N)
       *
       * @return {number}             Scalar value
       */
      function _multiplyVectorVector(a, b, n) {
        // check empty vector
        if (n === 0) {
          throw new Error('Cannot multiply two empty vectors');
        }
        return dot(a, b);
      }

      /**
       * C = A * B
       *
       * @param {Matrix} a            Dense Vector   (M)
       * @param {Matrix} b            Matrix         (MxN)
       *
       * @return {Matrix}             Dense Vector   (N)
       */
      function _multiplyVectorMatrix(a, b) {
        // process storage
        if (b.storage() !== 'dense') {
          throw new Error('Support for SparseMatrix not implemented');
        }
        return _multiplyVectorDenseMatrix(a, b);
      }

      /**
       * C = A * B
       *
       * @param {Matrix} a            Dense Vector   (M)
       * @param {Matrix} b            Dense Matrix   (MxN)
       *
       * @return {Matrix}             Dense Vector   (N)
       */
      function _multiplyVectorDenseMatrix(a, b) {
        // a dense
        var adata = a._data;
        var asize = a._size;
        var adt = a._datatype || a.getDataType();
        // b dense
        var bdata = b._data;
        var bsize = b._size;
        var bdt = b._datatype || b.getDataType();
        // rows & columns
        var alength = asize[0];
        var bcolumns = bsize[1];

        // datatype
        var dt;
        // addScalar signature to use
        var af = addScalar;
        // multiplyScalar signature to use
        var mf = multiplyScalar;

        // process data types
        if (adt && bdt && adt === bdt && typeof adt === 'string' && adt !== 'mixed') {
          // datatype
          dt = adt;
          // find signatures that matches (dt, dt)
          af = typed.find(addScalar, [dt, dt]);
          mf = typed.find(multiplyScalar, [dt, dt]);
        }

        // result
        var c = [];

        // loop matrix columns
        for (var j = 0; j < bcolumns; j++) {
          // sum (do not initialize it with zero)
          var sum = mf(adata[0], bdata[0][j]);
          // loop vector
          for (var i = 1; i < alength; i++) {
            // multiply & accumulate
            sum = af(sum, mf(adata[i], bdata[i][j]));
          }
          c[j] = sum;
        }

        // return matrix
        return a.createDenseMatrix({
          data: c,
          size: [bcolumns],
          datatype: adt === a._datatype && bdt === b._datatype ? dt : undefined
        });
      }

      /**
       * C = A * B
       *
       * @param {Matrix} a            Matrix         (MxN)
       * @param {Matrix} b            Dense Vector   (N)
       *
       * @return {Matrix}             Dense Vector   (M)
       */
      var _multiplyMatrixVector = typed('_multiplyMatrixVector', {
        'DenseMatrix, any': _multiplyDenseMatrixVector,
        'SparseMatrix, any': _multiplySparseMatrixVector
      });

      /**
       * C = A * B
       *
       * @param {Matrix} a            Matrix         (MxN)
       * @param {Matrix} b            Matrix         (NxC)
       *
       * @return {Matrix}             Matrix         (MxC)
       */
      var _multiplyMatrixMatrix = typed('_multiplyMatrixMatrix', {
        'DenseMatrix, DenseMatrix': _multiplyDenseMatrixDenseMatrix,
        'DenseMatrix, SparseMatrix': _multiplyDenseMatrixSparseMatrix,
        'SparseMatrix, DenseMatrix': _multiplySparseMatrixDenseMatrix,
        'SparseMatrix, SparseMatrix': _multiplySparseMatrixSparseMatrix
      });

      /**
       * C = A * B
       *
       * @param {Matrix} a            DenseMatrix  (MxN)
       * @param {Matrix} b            Dense Vector (N)
       *
       * @return {Matrix}             Dense Vector (M)
       */
      function _multiplyDenseMatrixVector(a, b) {
        // a dense
        var adata = a._data;
        var asize = a._size;
        var adt = a._datatype || a.getDataType();
        // b dense
        var bdata = b._data;
        var bdt = b._datatype || b.getDataType();
        // rows & columns
        var arows = asize[0];
        var acolumns = asize[1];

        // datatype
        var dt;
        // addScalar signature to use
        var af = addScalar;
        // multiplyScalar signature to use
        var mf = multiplyScalar;

        // process data types
        if (adt && bdt && adt === bdt && typeof adt === 'string' && adt !== 'mixed') {
          // datatype
          dt = adt;
          // find signatures that matches (dt, dt)
          af = typed.find(addScalar, [dt, dt]);
          mf = typed.find(multiplyScalar, [dt, dt]);
        }

        // result
        var c = [];

        // loop matrix a rows
        for (var i = 0; i < arows; i++) {
          // current row
          var row = adata[i];
          // sum (do not initialize it with zero)
          var sum = mf(row[0], bdata[0]);
          // loop matrix a columns
          for (var j = 1; j < acolumns; j++) {
            // multiply & accumulate
            sum = af(sum, mf(row[j], bdata[j]));
          }
          c[i] = sum;
        }

        // return matrix
        return a.createDenseMatrix({
          data: c,
          size: [arows],
          datatype: adt === a._datatype && bdt === b._datatype ? dt : undefined
        });
      }

      /**
       * C = A * B
       *
       * @param {Matrix} a            DenseMatrix    (MxN)
       * @param {Matrix} b            DenseMatrix    (NxC)
       *
       * @return {Matrix}             DenseMatrix    (MxC)
       */
      function _multiplyDenseMatrixDenseMatrix(a, b) {
        // getDataType()
        // a dense
        var adata = a._data;
        var asize = a._size;
        var adt = a._datatype || a.getDataType();
        // b dense
        var bdata = b._data;
        var bsize = b._size;
        var bdt = b._datatype || b.getDataType();
        // rows & columns
        var arows = asize[0];
        var acolumns = asize[1];
        var bcolumns = bsize[1];

        // datatype
        var dt;
        // addScalar signature to use
        var af = addScalar;
        // multiplyScalar signature to use
        var mf = multiplyScalar;

        // process data types
        if (adt && bdt && adt === bdt && typeof adt === 'string' && adt !== 'mixed' && adt !== 'mixed') {
          // datatype
          dt = adt;
          // find signatures that matches (dt, dt)
          af = typed.find(addScalar, [dt, dt]);
          mf = typed.find(multiplyScalar, [dt, dt]);
        }

        // result
        var c = [];

        // loop matrix a rows
        for (var i = 0; i < arows; i++) {
          // current row
          var row = adata[i];
          // initialize row array
          c[i] = [];
          // loop matrix b columns
          for (var j = 0; j < bcolumns; j++) {
            // sum (avoid initializing sum to zero)
            var sum = mf(row[0], bdata[0][j]);
            // loop matrix a columns
            for (var x = 1; x < acolumns; x++) {
              // multiply & accumulate
              sum = af(sum, mf(row[x], bdata[x][j]));
            }
            c[i][j] = sum;
          }
        }

        // return matrix
        return a.createDenseMatrix({
          data: c,
          size: [arows, bcolumns],
          datatype: adt === a._datatype && bdt === b._datatype ? dt : undefined
        });
      }

      /**
       * C = A * B
       *
       * @param {Matrix} a            DenseMatrix    (MxN)
       * @param {Matrix} b            SparseMatrix   (NxC)
       *
       * @return {Matrix}             SparseMatrix   (MxC)
       */
      function _multiplyDenseMatrixSparseMatrix(a, b) {
        // a dense
        var adata = a._data;
        var asize = a._size;
        var adt = a._datatype || a.getDataType();
        // b sparse
        var bvalues = b._values;
        var bindex = b._index;
        var bptr = b._ptr;
        var bsize = b._size;
        var bdt = b._datatype || b._data === undefined ? b._datatype : b.getDataType();
        // validate b matrix
        if (!bvalues) {
          throw new Error('Cannot multiply Dense Matrix times Pattern only Matrix');
        }
        // rows & columns
        var arows = asize[0];
        var bcolumns = bsize[1];

        // datatype
        var dt;
        // addScalar signature to use
        var af = addScalar;
        // multiplyScalar signature to use
        var mf = multiplyScalar;
        // equalScalar signature to use
        var eq = equalScalar;
        // zero value
        var zero = 0;

        // process data types
        if (adt && bdt && adt === bdt && typeof adt === 'string' && adt !== 'mixed') {
          // datatype
          dt = adt;
          // find signatures that matches (dt, dt)
          af = typed.find(addScalar, [dt, dt]);
          mf = typed.find(multiplyScalar, [dt, dt]);
          eq = typed.find(equalScalar, [dt, dt]);
          // convert 0 to the same datatype
          zero = typed.convert(0, dt);
        }

        // result
        var cvalues = [];
        var cindex = [];
        var cptr = [];
        // c matrix
        var c = b.createSparseMatrix({
          values: cvalues,
          index: cindex,
          ptr: cptr,
          size: [arows, bcolumns],
          datatype: adt === a._datatype && bdt === b._datatype ? dt : undefined
        });

        // loop b columns
        for (var jb = 0; jb < bcolumns; jb++) {
          // update ptr
          cptr[jb] = cindex.length;
          // indeces in column jb
          var kb0 = bptr[jb];
          var kb1 = bptr[jb + 1];
          // do not process column jb if no data exists
          if (kb1 > kb0) {
            // last row mark processed
            var last = 0;
            // loop a rows
            for (var i = 0; i < arows; i++) {
              // column mark
              var mark = i + 1;
              // C[i, jb]
              var cij = void 0;
              // values in b column j
              for (var kb = kb0; kb < kb1; kb++) {
                // row
                var ib = bindex[kb];
                // check value has been initialized
                if (last !== mark) {
                  // first value in column jb
                  cij = mf(adata[i][ib], bvalues[kb]);
                  // update mark
                  last = mark;
                } else {
                  // accumulate value
                  cij = af(cij, mf(adata[i][ib], bvalues[kb]));
                }
              }
              // check column has been processed and value != 0
              if (last === mark && !eq(cij, zero)) {
                // push row & value
                cindex.push(i);
                cvalues.push(cij);
              }
            }
          }
        }
        // update ptr
        cptr[bcolumns] = cindex.length;

        // return sparse matrix
        return c;
      }

      /**
       * C = A * B
       *
       * @param {Matrix} a            SparseMatrix    (MxN)
       * @param {Matrix} b            Dense Vector (N)
       *
       * @return {Matrix}             SparseMatrix    (M, 1)
       */
      function _multiplySparseMatrixVector(a, b) {
        // a sparse
        var avalues = a._values;
        var aindex = a._index;
        var aptr = a._ptr;
        var adt = a._datatype || a._data === undefined ? a._datatype : a.getDataType();
        // validate a matrix
        if (!avalues) {
          throw new Error('Cannot multiply Pattern only Matrix times Dense Matrix');
        }
        // b dense
        var bdata = b._data;
        var bdt = b._datatype || b.getDataType();
        // rows & columns
        var arows = a._size[0];
        var brows = b._size[0];
        // result
        var cvalues = [];
        var cindex = [];
        var cptr = [];

        // datatype
        var dt;
        // addScalar signature to use
        var af = addScalar;
        // multiplyScalar signature to use
        var mf = multiplyScalar;
        // equalScalar signature to use
        var eq = equalScalar;
        // zero value
        var zero = 0;

        // process data types
        if (adt && bdt && adt === bdt && typeof adt === 'string' && adt !== 'mixed') {
          // datatype
          dt = adt;
          // find signatures that matches (dt, dt)
          af = typed.find(addScalar, [dt, dt]);
          mf = typed.find(multiplyScalar, [dt, dt]);
          eq = typed.find(equalScalar, [dt, dt]);
          // convert 0 to the same datatype
          zero = typed.convert(0, dt);
        }

        // workspace
        var x = [];
        // vector with marks indicating a value x[i] exists in a given column
        var w = [];

        // update ptr
        cptr[0] = 0;
        // rows in b
        for (var ib = 0; ib < brows; ib++) {
          // b[ib]
          var vbi = bdata[ib];
          // check b[ib] != 0, avoid loops
          if (!eq(vbi, zero)) {
            // A values & index in ib column
            for (var ka0 = aptr[ib], ka1 = aptr[ib + 1], ka = ka0; ka < ka1; ka++) {
              // a row
              var ia = aindex[ka];
              // check value exists in current j
              if (!w[ia]) {
                // ia is new entry in j
                w[ia] = true;
                // add i to pattern of C
                cindex.push(ia);
                // x(ia) = A
                x[ia] = mf(vbi, avalues[ka]);
              } else {
                // i exists in C already
                x[ia] = af(x[ia], mf(vbi, avalues[ka]));
              }
            }
          }
        }
        // copy values from x to column jb of c
        for (var p1 = cindex.length, p = 0; p < p1; p++) {
          // row
          var ic = cindex[p];
          // copy value
          cvalues[p] = x[ic];
        }
        // update ptr
        cptr[1] = cindex.length;

        // matrix to return
        return a.createSparseMatrix({
          values: cvalues,
          index: cindex,
          ptr: cptr,
          size: [arows, 1],
          datatype: adt === a._datatype && bdt === b._datatype ? dt : undefined
        });
      }

      /**
       * C = A * B
       *
       * @param {Matrix} a            SparseMatrix      (MxN)
       * @param {Matrix} b            DenseMatrix       (NxC)
       *
       * @return {Matrix}             SparseMatrix      (MxC)
       */
      function _multiplySparseMatrixDenseMatrix(a, b) {
        // a sparse
        var avalues = a._values;
        var aindex = a._index;
        var aptr = a._ptr;
        var adt = a._datatype || a._data === undefined ? a._datatype : a.getDataType();
        // validate a matrix
        if (!avalues) {
          throw new Error('Cannot multiply Pattern only Matrix times Dense Matrix');
        }
        // b dense
        var bdata = b._data;
        var bdt = b._datatype || b.getDataType();
        // rows & columns
        var arows = a._size[0];
        var brows = b._size[0];
        var bcolumns = b._size[1];

        // datatype
        var dt;
        // addScalar signature to use
        var af = addScalar;
        // multiplyScalar signature to use
        var mf = multiplyScalar;
        // equalScalar signature to use
        var eq = equalScalar;
        // zero value
        var zero = 0;

        // process data types
        if (adt && bdt && adt === bdt && typeof adt === 'string' && adt !== 'mixed') {
          // datatype
          dt = adt;
          // find signatures that matches (dt, dt)
          af = typed.find(addScalar, [dt, dt]);
          mf = typed.find(multiplyScalar, [dt, dt]);
          eq = typed.find(equalScalar, [dt, dt]);
          // convert 0 to the same datatype
          zero = typed.convert(0, dt);
        }

        // result
        var cvalues = [];
        var cindex = [];
        var cptr = [];
        // c matrix
        var c = a.createSparseMatrix({
          values: cvalues,
          index: cindex,
          ptr: cptr,
          size: [arows, bcolumns],
          datatype: adt === a._datatype && bdt === b._datatype ? dt : undefined
        });

        // workspace
        var x = [];
        // vector with marks indicating a value x[i] exists in a given column
        var w = [];

        // loop b columns
        for (var jb = 0; jb < bcolumns; jb++) {
          // update ptr
          cptr[jb] = cindex.length;
          // mark in workspace for current column
          var mark = jb + 1;
          // rows in jb
          for (var ib = 0; ib < brows; ib++) {
            // b[ib, jb]
            var vbij = bdata[ib][jb];
            // check b[ib, jb] != 0, avoid loops
            if (!eq(vbij, zero)) {
              // A values & index in ib column
              for (var ka0 = aptr[ib], ka1 = aptr[ib + 1], ka = ka0; ka < ka1; ka++) {
                // a row
                var ia = aindex[ka];
                // check value exists in current j
                if (w[ia] !== mark) {
                  // ia is new entry in j
                  w[ia] = mark;
                  // add i to pattern of C
                  cindex.push(ia);
                  // x(ia) = A
                  x[ia] = mf(vbij, avalues[ka]);
                } else {
                  // i exists in C already
                  x[ia] = af(x[ia], mf(vbij, avalues[ka]));
                }
              }
            }
          }
          // copy values from x to column jb of c
          for (var p0 = cptr[jb], p1 = cindex.length, p = p0; p < p1; p++) {
            // row
            var ic = cindex[p];
            // copy value
            cvalues[p] = x[ic];
          }
        }
        // update ptr
        cptr[bcolumns] = cindex.length;

        // return sparse matrix
        return c;
      }

      /**
       * C = A * B
       *
       * @param {Matrix} a            SparseMatrix      (MxN)
       * @param {Matrix} b            SparseMatrix      (NxC)
       *
       * @return {Matrix}             SparseMatrix      (MxC)
       */
      function _multiplySparseMatrixSparseMatrix(a, b) {
        // a sparse
        var avalues = a._values;
        var aindex = a._index;
        var aptr = a._ptr;
        var adt = a._datatype || a._data === undefined ? a._datatype : a.getDataType();
        // b sparse
        var bvalues = b._values;
        var bindex = b._index;
        var bptr = b._ptr;
        var bdt = b._datatype || b._data === undefined ? b._datatype : b.getDataType();

        // rows & columns
        var arows = a._size[0];
        var bcolumns = b._size[1];
        // flag indicating both matrices (a & b) contain data
        var values = avalues && bvalues;

        // datatype
        var dt;
        // addScalar signature to use
        var af = addScalar;
        // multiplyScalar signature to use
        var mf = multiplyScalar;

        // process data types
        if (adt && bdt && adt === bdt && typeof adt === 'string' && adt !== 'mixed') {
          // datatype
          dt = adt;
          // find signatures that matches (dt, dt)
          af = typed.find(addScalar, [dt, dt]);
          mf = typed.find(multiplyScalar, [dt, dt]);
        }

        // result
        var cvalues = values ? [] : undefined;
        var cindex = [];
        var cptr = [];
        // c matrix
        var c = a.createSparseMatrix({
          values: cvalues,
          index: cindex,
          ptr: cptr,
          size: [arows, bcolumns],
          datatype: adt === a._datatype && bdt === b._datatype ? dt : undefined
        });

        // workspace
        var x = values ? [] : undefined;
        // vector with marks indicating a value x[i] exists in a given column
        var w = [];
        // variables
        var ka, ka0, ka1, kb, kb0, kb1, ia, ib;
        // loop b columns
        for (var jb = 0; jb < bcolumns; jb++) {
          // update ptr
          cptr[jb] = cindex.length;
          // mark in workspace for current column
          var mark = jb + 1;
          // B values & index in j
          for (kb0 = bptr[jb], kb1 = bptr[jb + 1], kb = kb0; kb < kb1; kb++) {
            // b row
            ib = bindex[kb];
            // check we need to process values
            if (values) {
              // loop values in a[:,ib]
              for (ka0 = aptr[ib], ka1 = aptr[ib + 1], ka = ka0; ka < ka1; ka++) {
                // row
                ia = aindex[ka];
                // check value exists in current j
                if (w[ia] !== mark) {
                  // ia is new entry in j
                  w[ia] = mark;
                  // add i to pattern of C
                  cindex.push(ia);
                  // x(ia) = A
                  x[ia] = mf(bvalues[kb], avalues[ka]);
                } else {
                  // i exists in C already
                  x[ia] = af(x[ia], mf(bvalues[kb], avalues[ka]));
                }
              }
            } else {
              // loop values in a[:,ib]
              for (ka0 = aptr[ib], ka1 = aptr[ib + 1], ka = ka0; ka < ka1; ka++) {
                // row
                ia = aindex[ka];
                // check value exists in current j
                if (w[ia] !== mark) {
                  // ia is new entry in j
                  w[ia] = mark;
                  // add i to pattern of C
                  cindex.push(ia);
                }
              }
            }
          }
          // check we need to process matrix values (pattern matrix)
          if (values) {
            // copy values from x to column jb of c
            for (var p0 = cptr[jb], p1 = cindex.length, p = p0; p < p1; p++) {
              // row
              var ic = cindex[p];
              // copy value
              cvalues[p] = x[ic];
            }
          }
        }
        // update ptr
        cptr[bcolumns] = cindex.length;

        // return sparse matrix
        return c;
      }

      /**
       * Multiply two or more values, `x * y`.
       * For matrices, the matrix product is calculated.
       *
       * Syntax:
       *
       *    math.multiply(x, y)
       *    math.multiply(x, y, z, ...)
       *
       * Examples:
       *
       *    math.multiply(4, 5.2)        // returns number 20.8
       *    math.multiply(2, 3, 4)       // returns number 24
       *
       *    const a = math.complex(2, 3)
       *    const b = math.complex(4, 1)
       *    math.multiply(a, b)          // returns Complex 5 + 14i
       *
       *    const c = [[1, 2], [4, 3]]
       *    const d = [[1, 2, 3], [3, -4, 7]]
       *    math.multiply(c, d)          // returns Array [[7, -6, 17], [13, -4, 33]]
       *
       *    const e = math.unit('2.1 km')
       *    math.multiply(3, e)          // returns Unit 6.3 km
       *
       * See also:
       *
       *    divide, prod, cross, dot
       *
       * @param  {number | BigNumber | bigint | Fraction | Complex | Unit | Array | Matrix} x First value to multiply
       * @param  {number | BigNumber | bigint | Fraction | Complex | Unit | Array | Matrix} y Second value to multiply
       * @return {number | BigNumber | bigint | Fraction | Complex | Unit | Array | Matrix} Multiplication of `x` and `y`
       */
      return typed(name$c, multiplyScalar, {
        // we extend the signatures of multiplyScalar with signatures dealing with matrices

        'Array, Array': typed.referTo('Matrix, Matrix', selfMM => (x, y) => {
          // check dimensions
          _validateMatrixDimensions(arraySize(x), arraySize(y));

          // use dense matrix implementation
          var m = selfMM(matrix(x), matrix(y));
          // return array or scalar
          return isMatrix(m) ? m.valueOf() : m;
        }),
        'Matrix, Matrix': function Matrix_Matrix(x, y) {
          // dimensions
          var xsize = x.size();
          var ysize = y.size();

          // check dimensions
          _validateMatrixDimensions(xsize, ysize);

          // process dimensions
          if (xsize.length === 1) {
            // process y dimensions
            if (ysize.length === 1) {
              // Vector * Vector
              return _multiplyVectorVector(x, y, xsize[0]);
            }
            // Vector * Matrix
            return _multiplyVectorMatrix(x, y);
          }
          // process y dimensions
          if (ysize.length === 1) {
            // Matrix * Vector
            return _multiplyMatrixVector(x, y);
          }
          // Matrix * Matrix
          return _multiplyMatrixMatrix(x, y);
        },
        'Matrix, Array': typed.referTo('Matrix,Matrix', selfMM => (x, y) => selfMM(x, matrix(y))),
        'Array, Matrix': typed.referToSelf(self => (x, y) => {
          // use Matrix * Matrix implementation
          return self(matrix(x, y.storage()), y);
        }),
        'SparseMatrix, any': function SparseMatrix_any(x, y) {
          return matAlgo11xS0s(x, y, multiplyScalar, false);
        },
        'DenseMatrix, any': function DenseMatrix_any(x, y) {
          return matAlgo14xDs(x, y, multiplyScalar, false);
        },
        'any, SparseMatrix': function any_SparseMatrix(x, y) {
          return matAlgo11xS0s(y, x, multiplyScalar, true);
        },
        'any, DenseMatrix': function any_DenseMatrix(x, y) {
          return matAlgo14xDs(y, x, multiplyScalar, true);
        },
        'Array, any': function Array_any(x, y) {
          // use matrix implementation
          return matAlgo14xDs(matrix(x), y, multiplyScalar, false).valueOf();
        },
        'any, Array': function any_Array(x, y) {
          // use matrix implementation
          return matAlgo14xDs(matrix(y), x, multiplyScalar, true).valueOf();
        },
        'any, any': multiplyScalar,
        'any, any, ...any': typed.referToSelf(self => (x, y, rest) => {
          var result = self(x, y);
          for (var i = 0; i < rest.length; i++) {
            result = self(result, rest[i]);
          }
          return result;
        })
      });
    });

    var name$b = 'conj';
    var dependencies$b = ['typed'];
    var createConj = /* #__PURE__ */factory(name$b, dependencies$b, _ref => {
      var {
        typed
      } = _ref;
      /**
       * Compute the complex conjugate of a complex value.
       * If `x = a+bi`, the complex conjugate of `x` is `a - bi`.
       *
       * For matrices, the function is evaluated element wise.
       *
       * Syntax:
       *
       *    math.conj(x)
       *
       * Examples:
       *
       *    math.conj(math.complex('2 + 3i'))  // returns Complex 2 - 3i
       *    math.conj(math.complex('2 - 3i'))  // returns Complex 2 + 3i
       *    math.conj(math.complex('-5.2i'))  // returns Complex 5.2i
       *
       * See also:
       *
       *    re, im, arg, abs
       *
       * @param {number | BigNumber | Complex | Array | Matrix} x
       *            A complex number or array with complex numbers
       * @return {number | BigNumber | Complex | Array | Matrix}
       *            The complex conjugate of x
       */
      return typed(name$b, {
        'number | BigNumber | Fraction': x => x,
        Complex: x => x.conjugate(),
        'Array | Matrix': typed.referToSelf(self => x => deepMap(x, self))
      });
    });

    var name$a = 'identity';
    var dependencies$a = ['typed', 'config', 'matrix', 'BigNumber', 'DenseMatrix', 'SparseMatrix'];
    var createIdentity = /* #__PURE__ */factory(name$a, dependencies$a, _ref => {
      var {
        typed,
        config,
        matrix,
        BigNumber,
        DenseMatrix,
        SparseMatrix
      } = _ref;
      /**
       * Create a 2-dimensional identity matrix with size m x n or n x n.
       * The matrix has ones on the diagonal and zeros elsewhere.
       *
       * Syntax:
       *
       *    math.identity(n)
       *    math.identity(n, format)
       *    math.identity(m, n)
       *    math.identity(m, n, format)
       *    math.identity([m, n])
       *    math.identity([m, n], format)
       *
       * Examples:
       *
       *    math.identity(3)                    // returns [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
       *    math.identity(3, 2)                 // returns [[1, 0], [0, 1], [0, 0]]
       *
       *    const A = [[1, 2, 3], [4, 5, 6]]
       *    math.identity(math.size(A))         // returns [[1, 0, 0], [0, 1, 0]]
       *
       * See also:
       *
       *    diag, ones, zeros, size, range
       *
       * @param {...number | Matrix | Array} size   The size for the matrix
       * @param {string} [format]                   The Matrix storage format
       *
       * @return {Matrix | Array | number} A matrix with ones on the diagonal.
       */
      return typed(name$a, {
        '': function _() {
          return config.matrix === 'Matrix' ? matrix([]) : [];
        },
        string: function string(format) {
          return matrix(format);
        },
        'number | BigNumber': function number__BigNumber(rows) {
          return _identity(rows, rows, config.matrix === 'Matrix' ? 'dense' : undefined);
        },
        'number | BigNumber, string': function number__BigNumber_string(rows, format) {
          return _identity(rows, rows, format);
        },
        'number | BigNumber, number | BigNumber': function number__BigNumber_number__BigNumber(rows, cols) {
          return _identity(rows, cols, config.matrix === 'Matrix' ? 'dense' : undefined);
        },
        'number | BigNumber, number | BigNumber, string': function number__BigNumber_number__BigNumber_string(rows, cols, format) {
          return _identity(rows, cols, format);
        },
        Array: function Array(size) {
          return _identityVector(size);
        },
        'Array, string': function Array_string(size, format) {
          return _identityVector(size, format);
        },
        Matrix: function Matrix(size) {
          return _identityVector(size.valueOf(), size.storage());
        },
        'Matrix, string': function Matrix_string(size, format) {
          return _identityVector(size.valueOf(), format);
        }
      });
      function _identityVector(size, format) {
        switch (size.length) {
          case 0:
            return format ? matrix(format) : [];
          case 1:
            return _identity(size[0], size[0], format);
          case 2:
            return _identity(size[0], size[1], format);
          default:
            throw new Error('Vector containing two values expected');
        }
      }

      /**
       * Create an identity matrix
       * @param {number | BigNumber} rows
       * @param {number | BigNumber} cols
       * @param {string} [format]
       * @returns {Matrix}
       * @private
       */
      function _identity(rows, cols, format) {
        // BigNumber constructor with the right precision
        var Big = isBigNumber(rows) || isBigNumber(cols) ? BigNumber : null;
        if (isBigNumber(rows)) rows = rows.toNumber();
        if (isBigNumber(cols)) cols = cols.toNumber();
        if (!isInteger(rows) || rows < 1) {
          throw new Error('Parameters in function identity must be positive integers');
        }
        if (!isInteger(cols) || cols < 1) {
          throw new Error('Parameters in function identity must be positive integers');
        }
        var one = Big ? new BigNumber(1) : 1;
        var defaultValue = Big ? new Big(0) : 0;
        var size = [rows, cols];

        // check we need to return a matrix
        if (format) {
          // create diagonal matrix (use optimized implementation for storage format)
          if (format === 'sparse') {
            return SparseMatrix.diagonal(size, one, 0, defaultValue);
          }
          if (format === 'dense') {
            return DenseMatrix.diagonal(size, one, 0, defaultValue);
          }
          throw new TypeError("Unknown matrix type \"".concat(format, "\""));
        }

        // create and resize array
        var res = resize([], size, defaultValue);
        // fill in ones on the diagonal
        var minimum = rows < cols ? rows : cols;
        // fill diagonal
        for (var d = 0; d < minimum; d++) {
          res[d][d] = one;
        }
        return res;
      }
    });

    function noBignumber() {
      throw new Error('No "bignumber" implementation available');
    }
    function noFraction() {
      throw new Error('No "fraction" implementation available');
    }
    function noMatrix() {
      throw new Error('No "matrix" implementation available');
    }

    var name$9 = 'size';
    var dependencies$9 = ['typed', 'config', '?matrix'];
    var createSize = /* #__PURE__ */factory(name$9, dependencies$9, _ref => {
      var {
        typed,
        config,
        matrix
      } = _ref;
      /**
       * Calculate the size of a matrix or scalar.
       *
       * Syntax:
       *
       *     math.size(x)
       *
       * Examples:
       *
       *     math.size(2.3)                       // returns []
       *     math.size('hello world')             // returns [11]
       *
       *     const A = [[1, 2, 3], [4, 5, 6]]
       *     math.size(A)                         // returns [2, 3]
       *     math.size(math.range(1,6).toArray()) // returns [5]
       *
       * See also:
       *
       *     count, resize, squeeze, subset
       *
       * @param {boolean | number | Complex | Unit | string | Array | Matrix} x  A matrix
       * @return {Array | Matrix} A vector with size of `x`.
       */
      return typed(name$9, {
        Matrix: function Matrix(x) {
          return x.create(x.size(), 'number');
        },
        Array: arraySize,
        string: function string(x) {
          return config.matrix === 'Array' ? [x.length] : matrix([x.length], 'dense', 'number');
        },
        'number | Complex | BigNumber | Unit | boolean | null': function number__Complex__BigNumber__Unit__boolean__null(x) {
          // scalar
          return config.matrix === 'Array' ? [] : matrix ? matrix([], 'dense', 'number') : noMatrix();
        }
      });
    });

    /* eslint-disable no-loss-of-precision */

    var name$8 = 'erf';
    var dependencies$8 = ['typed'];
    var createErf = /* #__PURE__ */factory(name$8, dependencies$8, _ref => {
      var {
        typed
      } = _ref;
      /**
       * Compute the erf function of a value using a rational Chebyshev
       * approximations for different intervals of x.
       *
       * This is a translation of W. J. Cody's Fortran implementation from 1987
       * ( https://www.netlib.org/specfun/erf ). See the AMS publication
       * "Rational Chebyshev Approximations for the Error Function" by W. J. Cody
       * for an explanation of this process.
       *
       * For matrices, the function is evaluated element wise.
       *
       * Syntax:
       *
       *    math.erf(x)
       *
       * Examples:
       *
       *    math.erf(0.2)    // returns 0.22270258921047847
       *    math.erf(-0.5)   // returns -0.5204998778130465
       *    math.erf(4)      // returns 0.9999999845827421
       *
       * See also:
       *    zeta
       *
       * @param {number | Array | Matrix} x   A real number
       * @return {number | Array | Matrix}    The erf of `x`
       */
      return typed('name', {
        number: function number(x) {
          var y = Math.abs(x);
          if (y >= MAX_NUM) {
            return sign$1(x);
          }
          if (y <= THRESH) {
            return sign$1(x) * erf1(y);
          }
          if (y <= 4.0) {
            return sign$1(x) * (1 - erfc2(y));
          }
          return sign$1(x) * (1 - erfc3(y));
        },
        'Array | Matrix': typed.referToSelf(self => n => deepMap(n, self))

        // TODO: For complex numbers, use the approximation for the Faddeeva function
        //  from "More Efficient Computation of the Complex Error Function" (AMS)
      });

      /**
       * Approximates the error function erf() for x <= 0.46875 using this function:
       *               n
       * erf(x) = x * sum (p_j * x^(2j)) / (q_j * x^(2j))
       *              j=0
       */
      function erf1(y) {
        var ysq = y * y;
        var xnum = P[0][4] * ysq;
        var xden = ysq;
        var i;
        for (i = 0; i < 3; i += 1) {
          xnum = (xnum + P[0][i]) * ysq;
          xden = (xden + Q[0][i]) * ysq;
        }
        return y * (xnum + P[0][3]) / (xden + Q[0][3]);
      }

      /**
       * Approximates the complement of the error function erfc() for
       * 0.46875 <= x <= 4.0 using this function:
       *                       n
       * erfc(x) = e^(-x^2) * sum (p_j * x^j) / (q_j * x^j)
       *                      j=0
       */
      function erfc2(y) {
        var xnum = P[1][8] * y;
        var xden = y;
        var i;
        for (i = 0; i < 7; i += 1) {
          xnum = (xnum + P[1][i]) * y;
          xden = (xden + Q[1][i]) * y;
        }
        var result = (xnum + P[1][7]) / (xden + Q[1][7]);
        var ysq = parseInt(y * 16) / 16;
        var del = (y - ysq) * (y + ysq);
        return Math.exp(-ysq * ysq) * Math.exp(-del) * result;
      }

      /**
       * Approximates the complement of the error function erfc() for x > 4.0 using
       * this function:
       *
       * erfc(x) = (e^(-x^2) / x) * [ 1/sqrt(pi) +
       *               n
       *    1/(x^2) * sum (p_j * x^(-2j)) / (q_j * x^(-2j)) ]
       *              j=0
       */
      function erfc3(y) {
        var ysq = 1 / (y * y);
        var xnum = P[2][5] * ysq;
        var xden = ysq;
        var i;
        for (i = 0; i < 4; i += 1) {
          xnum = (xnum + P[2][i]) * ysq;
          xden = (xden + Q[2][i]) * ysq;
        }
        var result = ysq * (xnum + P[2][4]) / (xden + Q[2][4]);
        result = (SQRPI - result) / y;
        ysq = parseInt(y * 16) / 16;
        var del = (y - ysq) * (y + ysq);
        return Math.exp(-ysq * ysq) * Math.exp(-del) * result;
      }
    });

    /**
     * Upper bound for the first approximation interval, 0 <= x <= THRESH
     * @constant
     */
    var THRESH = 0.46875;

    /**
     * Constant used by W. J. Cody's Fortran77 implementation to denote sqrt(pi)
     * @constant
     */
    var SQRPI = 5.6418958354775628695e-1;

    /**
     * Coefficients for each term of the numerator sum (p_j) for each approximation
     * interval (see W. J. Cody's paper for more details)
     * @constant
     */
    var P = [[3.16112374387056560e00, 1.13864154151050156e02, 3.77485237685302021e02, 3.20937758913846947e03, 1.85777706184603153e-1], [5.64188496988670089e-1, 8.88314979438837594e00, 6.61191906371416295e01, 2.98635138197400131e02, 8.81952221241769090e02, 1.71204761263407058e03, 2.05107837782607147e03, 1.23033935479799725e03, 2.15311535474403846e-8], [3.05326634961232344e-1, 3.60344899949804439e-1, 1.25781726111229246e-1, 1.60837851487422766e-2, 6.58749161529837803e-4, 1.63153871373020978e-2]];

    /**
     * Coefficients for each term of the denominator sum (q_j) for each approximation
     * interval (see W. J. Cody's paper for more details)
     * @constant
     */
    var Q = [[2.36012909523441209e01, 2.44024637934444173e02, 1.28261652607737228e03, 2.84423683343917062e03], [1.57449261107098347e01, 1.17693950891312499e02, 5.37181101862009858e02, 1.62138957456669019e03, 3.29079923573345963e03, 4.36261909014324716e03, 3.43936767414372164e03, 1.23033935480374942e03], [2.56852019228982242e00, 1.87295284992346047e00, 5.27905102951428412e-1, 6.05183413124413191e-2, 2.33520497626869185e-3]];

    /**
     * Maximum/minimum safe numbers to input to erf() (in ES6+, this number is
     * Number.[MAX|MIN]_SAFE_INTEGER). erf() for all numbers beyond this limit will
     * return 1
     */
    var MAX_NUM = Math.pow(2, 53);

    var name$7 = 'numeric';
    var dependencies$7 = ['number', '?bignumber', '?fraction'];
    var createNumeric = /* #__PURE__ */factory(name$7, dependencies$7, _ref => {
      var {
        number: _number,
        bignumber,
        fraction
      } = _ref;
      var validInputTypes = {
        string: true,
        number: true,
        BigNumber: true,
        Fraction: true
      };

      // Load the conversion functions for each output type
      var validOutputTypes = {
        number: x => _number(x),
        BigNumber: bignumber ? x => bignumber(x) : noBignumber,
        bigint: x => BigInt(x),
        Fraction: fraction ? x => fraction(x) : noFraction
      };

      /**
       * Convert a numeric input to a specific numeric type: number, BigNumber, bigint, or Fraction.
       *
       * Syntax:
       *
       *    math.numeric(x)
       *
       * Examples:
       *
       *    math.numeric('4')                           // returns 4
       *    math.numeric('4', 'number')                 // returns 4
       *    math.numeric('4', 'bigint')                 // returns 4n
       *    math.numeric('4', 'BigNumber')              // returns BigNumber 4
       *    math.numeric('4', 'Fraction')               // returns Fraction 4
       *    math.numeric(4, 'Fraction')                 // returns Fraction 4
       *    math.numeric(math.fraction(2, 5), 'number') // returns 0.4
       *
       * See also:
       *
       *    number, fraction, bignumber, bigint, string, format
       *
       * @param {string | number | BigNumber | bigint | Fraction } value
       *              A numeric value or a string containing a numeric value
       * @param {string} outputType
       *              Desired numeric output type.
       *              Available values: 'number', 'BigNumber', or 'Fraction'
       * @return {number | BigNumber | bigint | Fraction}
       *              Returns an instance of the numeric in the requested type
       */
      return function numeric(value) {
        var outputType = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'number';
        var check = arguments.length > 2 ? arguments[2] : undefined;
        if (check !== undefined) {
          throw new SyntaxError('numeric() takes one or two arguments');
        }
        var inputType = typeOf(value);
        if (!(inputType in validInputTypes)) {
          throw new TypeError('Cannot convert ' + value + ' of type "' + inputType + '"; valid input types are ' + Object.keys(validInputTypes).join(', '));
        }
        if (!(outputType in validOutputTypes)) {
          throw new TypeError('Cannot convert ' + value + ' to type "' + outputType + '"; valid output types are ' + Object.keys(validOutputTypes).join(', '));
        }
        if (outputType === inputType) {
          return value;
        } else {
          return validOutputTypes[outputType](value);
        }
      };
    });

    var name$6 = 'divideScalar';
    var dependencies$6 = ['typed', 'numeric'];
    var createDivideScalar = /* #__PURE__ */factory(name$6, dependencies$6, _ref => {
      var {
        typed,
        numeric
      } = _ref;
      /**
       * Divide two scalar values, `x / y`.
       * This function is meant for internal use: it is used by the public functions
       * `divide` and `inv`.
       *
       * This function does not support collections (Array or Matrix).
       *
       * @param  {number | BigNumber | bigint | Fraction | Complex | Unit} x   Numerator
       * @param  {number | BigNumber | bigint | Fraction | Complex} y          Denominator
       * @return {number | BigNumber | bigint | Fraction | Complex | Unit}     Quotient, `x / y`
       * @private
       */
      return typed(name$6, {
        'number, number': function number_number(x, y) {
          return x / y;
        },
        'Complex, Complex': function Complex_Complex(x, y) {
          return x.div(y);
        },
        'BigNumber, BigNumber': function BigNumber_BigNumber(x, y) {
          return x.div(y);
        },
        'bigint, bigint': function bigint_bigint(x, y) {
          return x / y;
        },
        'Fraction, Fraction': function Fraction_Fraction(x, y) {
          return x.div(y);
        },
        'Unit, number | Complex | Fraction | BigNumber | Unit': (x, y) => x.divide(y),
        'number | Fraction | Complex | BigNumber, Unit': (x, y) => y.divideInto(x)
      });
    });

    var name$5 = 'pow';
    var dependencies$5 = ['typed', 'config', 'identity', 'multiply', 'matrix', 'inv', 'fraction', 'number', 'Complex'];
    var createPow = /* #__PURE__ */factory(name$5, dependencies$5, _ref => {
      var {
        typed,
        config,
        identity,
        multiply,
        matrix,
        inv,
        number,
        fraction,
        Complex
      } = _ref;
      /**
       * Calculates the power of x to y, `x ^ y`.
       *
       * Matrix exponentiation is supported for square matrices `x` and integers `y`:
       * when `y` is nonnegative, `x` may be any square matrix; and when `y` is
       * negative, `x` must be invertible, and then this function returns
       * inv(x)^(-y).
       *
       * For cubic roots of negative numbers, the function returns the principal
       * root by default. In order to let the function return the real root,
       * math.js can be configured with `math.config({predictable: true})`.
       * To retrieve all cubic roots of a value, use `math.cbrt(x, true)`.
       *
       * Syntax:
       *
       *    math.pow(x, y)
       *
       * Examples:
       *
       *    math.pow(2, 3)               // returns number 8
       *
       *    const a = math.complex(2, 3)
       *    math.pow(a, 2)                // returns Complex -5 + 12i
       *
       *    const b = [[1, 2], [4, 3]]
       *    math.pow(b, 2)               // returns Array [[9, 8], [16, 17]]
       *
       *    const c = [[1, 2], [4, 3]]
       *    math.pow(c, -1)               // returns Array [[-0.6, 0.4], [0.8, -0.2]]
       *
       * See also:
       *
       *    multiply, sqrt, cbrt, nthRoot
       *
       * @param  {number | BigNumber | bigint | Complex | Unit | Array | Matrix} x  The base
       * @param  {number | BigNumber | bigint | Complex} y                          The exponent
       * @return {number | BigNumber | bigint | Complex | Array | Matrix} The value of `x` to the power `y`
       */
      return typed(name$5, {
        'number, number': _pow,
        'Complex, Complex': function Complex_Complex(x, y) {
          return x.pow(y);
        },
        'BigNumber, BigNumber': function BigNumber_BigNumber(x, y) {
          if (y.isInteger() || x >= 0 || config.predictable) {
            return x.pow(y);
          } else {
            return new Complex(x.toNumber(), 0).pow(y.toNumber(), 0);
          }
        },
        'bigint, bigint': (x, y) => x ** y,
        'Fraction, Fraction': function Fraction_Fraction(x, y) {
          var result = x.pow(y);
          if (result != null) {
            return result;
          }
          if (config.predictable) {
            throw new Error('Result of pow is non-rational and cannot be expressed as a fraction');
          } else {
            return _pow(x.valueOf(), y.valueOf());
          }
        },
        'Array, number': _powArray,
        'Array, BigNumber': function Array_BigNumber(x, y) {
          return _powArray(x, y.toNumber());
        },
        'Matrix, number': _powMatrix,
        'Matrix, BigNumber': function Matrix_BigNumber(x, y) {
          return _powMatrix(x, y.toNumber());
        },
        'Unit, number | BigNumber': function Unit_number__BigNumber(x, y) {
          return x.pow(y);
        }
      });

      /**
       * Calculates the power of x to y, x^y, for two numbers.
       * @param {number} x
       * @param {number} y
       * @return {number | Complex} res
       * @private
       */
      function _pow(x, y) {
        // Alternatively could define a 'realmode' config option or something, but
        // 'predictable' will work for now
        if (config.predictable && !isInteger(y) && x < 0) {
          // Check to see if y can be represented as a fraction
          try {
            var yFrac = fraction(y);
            var yNum = number(yFrac);
            if (y === yNum || Math.abs((y - yNum) / y) < 1e-14) {
              if (yFrac.d % 2n === 1n) {
                return (yFrac.n % 2n === 0n ? 1 : -1) * Math.pow(-x, y);
              }
            }
          } catch (ex) {
            // fraction() throws an error if y is Infinity, etc.
          }

          // Unable to express y as a fraction, so continue on
        }

        // **for predictable mode** x^Infinity === NaN if x < -1
        // N.B. this behavour is different from `Math.pow` which gives
        // (-2)^Infinity === Infinity
        if (config.predictable && (x < -1 && y === Infinity || x > -1 && x < 0 && y === -Infinity)) {
          return NaN;
        }
        if (isInteger(y) || x >= 0 || config.predictable) {
          return powNumber(x, y);
        } else {
          // TODO: the following infinity checks are duplicated from powNumber. Deduplicate this somehow

          // x^Infinity === 0 if -1 < x < 1
          // A real number 0 is returned instead of complex(0)
          if (x * x < 1 && y === Infinity || x * x > 1 && y === -Infinity) {
            return 0;
          }
          return new Complex(x, 0).pow(y, 0);
        }
      }

      /**
       * Calculate the power of a 2d array
       * @param {Array} x     must be a 2 dimensional, square matrix
       * @param {number} y    a integer value (positive if `x` is not invertible)
       * @returns {Array}
       * @private
       */
      function _powArray(x, y) {
        if (!isInteger(y)) {
          throw new TypeError('For A^b, b must be an integer (value is ' + y + ')');
        }
        // verify that A is a 2 dimensional square matrix
        var s = arraySize(x);
        if (s.length !== 2) {
          throw new Error('For A^b, A must be 2 dimensional (A has ' + s.length + ' dimensions)');
        }
        if (s[0] !== s[1]) {
          throw new Error('For A^b, A must be square (size is ' + s[0] + 'x' + s[1] + ')');
        }
        if (y < 0) {
          try {
            return _powArray(inv(x), -y);
          } catch (error) {
            if (error.message === 'Cannot calculate inverse, determinant is zero') {
              throw new TypeError('For A^b, when A is not invertible, b must be a positive integer (value is ' + y + ')');
            }
            throw error;
          }
        }
        var res = identity(s[0]).valueOf();
        var px = x;
        while (y >= 1) {
          if ((y & 1) === 1) {
            res = multiply(px, res);
          }
          y >>= 1;
          px = multiply(px, px);
        }
        return res;
      }

      /**
       * Calculate the power of a 2d matrix
       * @param {Matrix} x     must be a 2 dimensional, square matrix
       * @param {number} y    a positive, integer value
       * @returns {Matrix}
       * @private
       */
      function _powMatrix(x, y) {
        return matrix(_powArray(x.valueOf(), y));
      }
    });

    function getDefaultExportFromCjs (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
    }

    function getAugmentedNamespace(n) {
      if (Object.prototype.hasOwnProperty.call(n, '__esModule')) return n;
      var f = n.default;
    	if (typeof f == "function") {
    		var a = function a () {
    			if (this instanceof a) {
            return Reflect.construct(f, arguments, this.constructor);
    			}
    			return f.apply(this, arguments);
    		};
    		a.prototype = f.prototype;
      } else a = {};
      Object.defineProperty(a, '__esModule', {value: true});
    	Object.keys(n).forEach(function (k) {
    		var d = Object.getOwnPropertyDescriptor(n, k);
    		Object.defineProperty(a, k, d.get ? d : {
    			enumerable: true,
    			get: function () {
    				return n[k];
    			}
    		});
    	});
    	return a;
    }

    var name$4 = 'dot';
    var dependencies$4 = ['typed', 'addScalar', 'multiplyScalar', 'conj', 'size'];
    var createDot = /* #__PURE__ */factory(name$4, dependencies$4, _ref => {
      var {
        typed,
        addScalar,
        multiplyScalar,
        conj,
        size
      } = _ref;
      /**
       * Calculate the dot product of two vectors. The dot product of
       * `A = [a1, a2, ..., an]` and `B = [b1, b2, ..., bn]` is defined as:
       *
       *    dot(A, B) = conj(a1) * b1 + conj(a2) * b2 + ... + conj(an) * bn
       *
       * Syntax:
       *
       *    math.dot(x, y)
       *
       * Examples:
       *
       *    math.dot([2, 4, 1], [2, 2, 3])       // returns number 15
       *    math.multiply([2, 4, 1], [2, 2, 3])  // returns number 15
       *
       * See also:
       *
       *    multiply, cross
       *
       * @param  {Array | Matrix} x     First vector
       * @param  {Array | Matrix} y     Second vector
       * @return {number}               Returns the dot product of `x` and `y`
       */
      return typed(name$4, {
        'Array | DenseMatrix, Array | DenseMatrix': _denseDot,
        'SparseMatrix, SparseMatrix': _sparseDot
      });
      function _validateDim(x, y) {
        var xSize = _size(x);
        var ySize = _size(y);
        var xLen, yLen;
        if (xSize.length === 1) {
          xLen = xSize[0];
        } else if (xSize.length === 2 && xSize[1] === 1) {
          xLen = xSize[0];
        } else {
          throw new RangeError('Expected a column vector, instead got a matrix of size (' + xSize.join(', ') + ')');
        }
        if (ySize.length === 1) {
          yLen = ySize[0];
        } else if (ySize.length === 2 && ySize[1] === 1) {
          yLen = ySize[0];
        } else {
          throw new RangeError('Expected a column vector, instead got a matrix of size (' + ySize.join(', ') + ')');
        }
        if (xLen !== yLen) throw new RangeError('Vectors must have equal length (' + xLen + ' != ' + yLen + ')');
        if (xLen === 0) throw new RangeError('Cannot calculate the dot product of empty vectors');
        return xLen;
      }
      function _denseDot(a, b) {
        var N = _validateDim(a, b);
        var adata = isMatrix(a) ? a._data : a;
        var adt = isMatrix(a) ? a._datatype || a.getDataType() : undefined;
        var bdata = isMatrix(b) ? b._data : b;
        var bdt = isMatrix(b) ? b._datatype || b.getDataType() : undefined;

        // are these 2-dimensional column vectors? (as opposed to 1-dimensional vectors)
        var aIsColumn = _size(a).length === 2;
        var bIsColumn = _size(b).length === 2;
        var add = addScalar;
        var mul = multiplyScalar;

        // process data types
        if (adt && bdt && adt === bdt && typeof adt === 'string' && adt !== 'mixed') {
          var dt = adt;
          // find signatures that matches (dt, dt)
          add = typed.find(addScalar, [dt, dt]);
          mul = typed.find(multiplyScalar, [dt, dt]);
        }

        // both vectors 1-dimensional
        if (!aIsColumn && !bIsColumn) {
          var c = mul(conj(adata[0]), bdata[0]);
          for (var i = 1; i < N; i++) {
            c = add(c, mul(conj(adata[i]), bdata[i]));
          }
          return c;
        }

        // a is 1-dim, b is column
        if (!aIsColumn && bIsColumn) {
          var _c = mul(conj(adata[0]), bdata[0][0]);
          for (var _i = 1; _i < N; _i++) {
            _c = add(_c, mul(conj(adata[_i]), bdata[_i][0]));
          }
          return _c;
        }

        // a is column, b is 1-dim
        if (aIsColumn && !bIsColumn) {
          var _c2 = mul(conj(adata[0][0]), bdata[0]);
          for (var _i2 = 1; _i2 < N; _i2++) {
            _c2 = add(_c2, mul(conj(adata[_i2][0]), bdata[_i2]));
          }
          return _c2;
        }

        // both vectors are column
        if (aIsColumn && bIsColumn) {
          var _c3 = mul(conj(adata[0][0]), bdata[0][0]);
          for (var _i3 = 1; _i3 < N; _i3++) {
            _c3 = add(_c3, mul(conj(adata[_i3][0]), bdata[_i3][0]));
          }
          return _c3;
        }
      }
      function _sparseDot(x, y) {
        _validateDim(x, y);
        var xindex = x._index;
        var xvalues = x._values;
        var yindex = y._index;
        var yvalues = y._values;

        // TODO optimize add & mul using datatype
        var c = 0;
        var add = addScalar;
        var mul = multiplyScalar;
        var i = 0;
        var j = 0;
        while (i < xindex.length && j < yindex.length) {
          var I = xindex[i];
          var J = yindex[j];
          if (I < J) {
            i++;
            continue;
          }
          if (I > J) {
            j++;
            continue;
          }
          if (I === J) {
            c = add(c, mul(xvalues[i], yvalues[j]));
            i++;
            j++;
          }
        }
        return c;
      }

      // TODO remove this once #1771 is fixed
      function _size(x) {
        return isMatrix(x) ? x.size() : size(x);
      }
    });

    var name$3 = 'det';
    var dependencies$3 = ['typed', 'matrix', 'subtractScalar', 'multiply', 'divideScalar', 'isZero', 'unaryMinus'];
    var createDet = /* #__PURE__ */factory(name$3, dependencies$3, _ref => {
      var {
        typed,
        matrix,
        subtractScalar,
        multiply,
        divideScalar,
        isZero,
        unaryMinus
      } = _ref;
      /**
       * Calculate the determinant of a matrix.
       *
       * Syntax:
       *
       *    math.det(x)
       *
       * Examples:
       *
       *    math.det([[1, 2], [3, 4]]) // returns -2
       *
       *    const A = [
       *      [-2, 2, 3],
       *      [-1, 1, 3],
       *      [2, 0, -1]
       *    ]
       *    math.det(A) // returns 6
       *
       * See also:
       *
       *    inv
       *
       * @param {Array | Matrix} x  A matrix
       * @return {number} The determinant of `x`
       */
      return typed(name$3, {
        any: function any(x) {
          return clone$2(x);
        },
        'Array | Matrix': function det(x) {
          var size;
          if (isMatrix(x)) {
            size = x.size();
          } else if (Array.isArray(x)) {
            x = matrix(x);
            size = x.size();
          } else {
            // a scalar
            size = [];
          }
          switch (size.length) {
            case 0:
              // scalar
              return clone$2(x);
            case 1:
              // vector
              if (size[0] === 1) {
                return clone$2(x.valueOf()[0]);
              }
              if (size[0] === 0) {
                return 1; // det of an empty matrix is per definition 1
              } else {
                throw new RangeError('Matrix must be square ' + '(size: ' + format(size) + ')');
              }
            case 2:
              {
                // two-dimensional array
                var rows = size[0];
                var cols = size[1];
                if (rows === cols) {
                  return _det(x.clone().valueOf(), rows);
                }
                if (cols === 0) {
                  return 1; // det of an empty matrix is per definition 1
                } else {
                  throw new RangeError('Matrix must be square ' + '(size: ' + format(size) + ')');
                }
              }
            default:
              // multi dimensional array
              throw new RangeError('Matrix must be two dimensional ' + '(size: ' + format(size) + ')');
          }
        }
      });

      /**
       * Calculate the determinant of a matrix
       * @param {Array[]} matrix  A square, two dimensional matrix
       * @param {number} rows     Number of rows of the matrix (zero-based)
       * @param {number} cols     Number of columns of the matrix (zero-based)
       * @returns {number} det
       * @private
       */
      function _det(matrix, rows, cols) {
        if (rows === 1) {
          // this is a 1 x 1 matrix
          return clone$2(matrix[0][0]);
        } else if (rows === 2) {
          // this is a 2 x 2 matrix
          // the determinant of [a11,a12;a21,a22] is det = a11*a22-a21*a12
          return subtractScalar(multiply(matrix[0][0], matrix[1][1]), multiply(matrix[1][0], matrix[0][1]));
        } else {
          // Bareiss algorithm
          // this algorithm have same complexity as LUP decomposition (O(n^3))
          // but it preserve precision of floating point more relative to the LUP decomposition
          var negated = false;
          var rowIndices = new Array(rows).fill(0).map((_, i) => i); // matrix index of row i
          for (var k = 0; k < rows; k++) {
            var k_ = rowIndices[k];
            if (isZero(matrix[k_][k])) {
              var _k = void 0;
              for (_k = k + 1; _k < rows; _k++) {
                if (!isZero(matrix[rowIndices[_k]][k])) {
                  k_ = rowIndices[_k];
                  rowIndices[_k] = rowIndices[k];
                  rowIndices[k] = k_;
                  negated = !negated;
                  break;
                }
              }
              if (_k === rows) return matrix[k_][k]; // some zero of the type
            }
            var piv = matrix[k_][k];
            var piv_ = k === 0 ? 1 : matrix[rowIndices[k - 1]][k - 1];
            for (var i = k + 1; i < rows; i++) {
              var i_ = rowIndices[i];
              for (var j = k + 1; j < rows; j++) {
                matrix[i_][j] = divideScalar(subtractScalar(multiply(matrix[i_][j], piv), multiply(matrix[i_][k], matrix[k_][j])), piv_);
              }
            }
          }
          var det = matrix[rowIndices[rows - 1]][rows - 1];
          return negated ? unaryMinus(det) : det;
        }
      }
    });

    var name$2 = 'inv';
    var dependencies$2 = ['typed', 'matrix', 'divideScalar', 'addScalar', 'multiply', 'unaryMinus', 'det', 'identity', 'abs'];
    var createInv = /* #__PURE__ */factory(name$2, dependencies$2, _ref => {
      var {
        typed,
        matrix,
        divideScalar,
        addScalar,
        multiply,
        unaryMinus,
        det,
        identity,
        abs
      } = _ref;
      /**
       * Calculate the inverse of a square matrix.
       *
       * Syntax:
       *
       *     math.inv(x)
       *
       * Examples:
       *
       *     math.inv([[1, 2], [3, 4]])  // returns [[-2, 1], [1.5, -0.5]]
       *     math.inv(4)                 // returns 0.25
       *     1 / 4                       // returns 0.25
       *
       * See also:
       *
       *     det, transpose
       *
       * @param {number | Complex | Array | Matrix} x     Matrix to be inversed
       * @return {number | Complex | Array | Matrix} The inverse of `x`.
       */
      return typed(name$2, {
        'Array | Matrix': function Array__Matrix(x) {
          var size = isMatrix(x) ? x.size() : arraySize(x);
          switch (size.length) {
            case 1:
              // vector
              if (size[0] === 1) {
                if (isMatrix(x)) {
                  return matrix([divideScalar(1, x.valueOf()[0])]);
                } else {
                  return [divideScalar(1, x[0])];
                }
              } else {
                throw new RangeError('Matrix must be square ' + '(size: ' + format(size) + ')');
              }
            case 2:
              // two dimensional array
              {
                var rows = size[0];
                var cols = size[1];
                if (rows === cols) {
                  if (isMatrix(x)) {
                    return matrix(_inv(x.valueOf(), rows, cols), x.storage());
                  } else {
                    // return an Array
                    return _inv(x, rows, cols);
                  }
                } else {
                  throw new RangeError('Matrix must be square ' + '(size: ' + format(size) + ')');
                }
              }
            default:
              // multi dimensional array
              throw new RangeError('Matrix must be two dimensional ' + '(size: ' + format(size) + ')');
          }
        },
        any: function any(x) {
          // scalar
          return divideScalar(1, x); // FIXME: create a BigNumber one when configured for bignumbers
        }
      });

      /**
       * Calculate the inverse of a square matrix
       * @param {Array[]} mat     A square matrix
       * @param {number} rows     Number of rows
       * @param {number} cols     Number of columns, must equal rows
       * @return {Array[]} inv    Inverse matrix
       * @private
       */
      function _inv(mat, rows, cols) {
        var r, s, f, value, temp;
        if (rows === 1) {
          // this is a 1 x 1 matrix
          value = mat[0][0];
          if (value === 0) {
            throw Error('Cannot calculate inverse, determinant is zero');
          }
          return [[divideScalar(1, value)]];
        } else if (rows === 2) {
          // this is a 2 x 2 matrix
          var d = det(mat);
          if (d === 0) {
            throw Error('Cannot calculate inverse, determinant is zero');
          }
          return [[divideScalar(mat[1][1], d), divideScalar(unaryMinus(mat[0][1]), d)], [divideScalar(unaryMinus(mat[1][0]), d), divideScalar(mat[0][0], d)]];
        } else {
          // this is a matrix of 3 x 3 or larger
          // calculate inverse using gauss-jordan elimination
          //      https://en.wikipedia.org/wiki/Gaussian_elimination
          //      http://mathworld.wolfram.com/MatrixInverse.html
          //      http://math.uww.edu/~mcfarlat/inverse.htm

          // make a copy of the matrix (only the arrays, not of the elements)
          var A = mat.concat();
          for (r = 0; r < rows; r++) {
            A[r] = A[r].concat();
          }

          // create an identity matrix which in the end will contain the
          // matrix inverse
          var B = identity(rows).valueOf();

          // loop over all columns, and perform row reductions
          for (var c = 0; c < cols; c++) {
            // Pivoting: Swap row c with row r, where row r contains the largest element A[r][c]
            var ABig = abs(A[c][c]);
            var rBig = c;
            r = c + 1;
            while (r < rows) {
              if (abs(A[r][c]) > ABig) {
                ABig = abs(A[r][c]);
                rBig = r;
              }
              r++;
            }
            if (ABig === 0) {
              throw Error('Cannot calculate inverse, determinant is zero');
            }
            r = rBig;
            if (r !== c) {
              temp = A[c];
              A[c] = A[r];
              A[r] = temp;
              temp = B[c];
              B[c] = B[r];
              B[r] = temp;
            }

            // eliminate non-zero values on the other rows at column c
            var Ac = A[c];
            var Bc = B[c];
            for (r = 0; r < rows; r++) {
              var Ar = A[r];
              var Br = B[r];
              if (r !== c) {
                // eliminate value at column c and row r
                if (Ar[c] !== 0) {
                  f = divideScalar(unaryMinus(Ar[c]), Ac[c]);

                  // add (f * row c) to row r to eliminate the value
                  // at column c
                  for (s = c; s < cols; s++) {
                    Ar[s] = addScalar(Ar[s], multiply(f, Ac[s]));
                  }
                  for (s = 0; s < cols; s++) {
                    Br[s] = addScalar(Br[s], multiply(f, Bc[s]));
                  }
                }
              } else {
                // normalize value at Acc to 1,
                // divide each value on row r with the value at Acc
                f = Ac[c];
                for (s = c; s < cols; s++) {
                  Ar[s] = divideScalar(Ar[s], f);
                }
                for (s = 0; s < cols; s++) {
                  Br[s] = divideScalar(Br[s], f);
                }
              }
            }
          }
          return B;
        }
      }
    });

    var name$1 = 'gamma';
    var dependencies$1 = ['typed', 'config', 'multiplyScalar', 'pow', 'BigNumber', 'Complex'];
    var createGamma = /* #__PURE__ */factory(name$1, dependencies$1, _ref => {
      var {
        typed,
        config,
        multiplyScalar,
        pow,
        BigNumber: _BigNumber,
        Complex
      } = _ref;
      /**
       * Compute the gamma function of a value using Lanczos approximation for
       * small values, and an extended Stirling approximation for large values.
       *
       * To avoid confusion with the matrix Gamma function, this function does
       * not apply to matrices.
       *
       * Syntax:
       *
       *    math.gamma(n)
       *
       * Examples:
       *
       *    math.gamma(5)       // returns 24
       *    math.gamma(-0.5)    // returns -3.5449077018110335
       *    math.gamma(math.i)  // returns -0.15494982830180973 - 0.49801566811835596i
       *
       * See also:
       *
       *    combinations, factorial, permutations
       *
       * @param {number | BigNumber | Complex} n   A real or complex number
       * @return {number | BigNumber | Complex}    The gamma of `n`
       */

      function gammaComplex(n) {
        if (n.im === 0) {
          return gammaNumber(n.re);
        }

        // Lanczos approximation doesn't work well with real part lower than 0.5
        // So reflection formula is required
        if (n.re < 0.5) {
          // Euler's reflection formula
          // gamma(1-z) * gamma(z) = PI / sin(PI * z)
          // real part of Z should not be integer [sin(PI) == 0 -> 1/0 - undefined]
          // thanks to imperfect sin implementation sin(PI * n) != 0
          // we can safely use it anyway
          var _t = new Complex(1 - n.re, -n.im);
          var r = new Complex(Math.PI * n.re, Math.PI * n.im);
          return new Complex(Math.PI).div(r.sin()).div(gammaComplex(_t));
        }

        // Lanczos approximation
        // z -= 1
        n = new Complex(n.re - 1, n.im);

        // x = gammaPval[0]
        var x = new Complex(gammaP[0], 0);
        // for (i, gammaPval) in enumerate(gammaP):
        for (var i = 1; i < gammaP.length; ++i) {
          // x += gammaPval / (z + i)
          var gammaPval = new Complex(gammaP[i], 0);
          x = x.add(gammaPval.div(n.add(i)));
        }
        // t = z + gammaG + 0.5
        var t = new Complex(n.re + gammaG + 0.5, n.im);

        // y = sqrt(2 * pi) * t ** (z + 0.5) * exp(-t) * x
        var twoPiSqrt = Math.sqrt(2 * Math.PI);
        var tpow = t.pow(n.add(0.5));
        var expt = t.neg().exp();

        // y = [x] * [sqrt(2 * pi)] * [t ** (z + 0.5)] * [exp(-t)]
        return x.mul(twoPiSqrt).mul(tpow).mul(expt);
      }
      return typed(name$1, {
        number: gammaNumber,
        Complex: gammaComplex,
        BigNumber: function BigNumber(n) {
          if (n.isInteger()) {
            return n.isNegative() || n.isZero() ? new _BigNumber(Infinity) : bigFactorial(n.minus(1));
          }
          if (!n.isFinite()) {
            return new _BigNumber(n.isNegative() ? NaN : Infinity);
          }
          throw new Error('Integer BigNumber expected');
        }
      });

      /**
       * Calculate factorial for a BigNumber
       * @param {BigNumber} n
       * @returns {BigNumber} Returns the factorial of n
       */
      function bigFactorial(n) {
        if (n < 8) {
          return new _BigNumber([1, 1, 2, 6, 24, 120, 720, 5040][n]);
        }
        var precision = config.precision + (Math.log(n.toNumber()) | 0);
        var Big = _BigNumber.clone({
          precision
        });
        if (n % 2 === 1) {
          return n.times(bigFactorial(new _BigNumber(n - 1)));
        }
        var p = n;
        var prod = new Big(n);
        var sum = n.toNumber();
        while (p > 2) {
          p -= 2;
          sum += p;
          prod = prod.times(sum);
        }
        return new _BigNumber(prod.toPrecision(_BigNumber.precision));
      }
    });

    /* eslint-disable no-loss-of-precision */

    var name = 'lgamma';
    var dependencies = ['Complex', 'typed'];
    var createLgamma = /* #__PURE__ */factory(name, dependencies, _ref => {
      var {
        Complex,
        typed
      } = _ref;
      // Stirling series is non-convergent, we need to use the recurrence `lgamma(z) = lgamma(z+1) - log z` to get
      // sufficient accuracy.
      //
      // These two values are copied from Scipy implementation:
      // https://github.com/scipy/scipy/blob/v1.8.0/scipy/special/_loggamma.pxd#L37
      var SMALL_RE = 7;
      var SMALL_IM = 7;

      /**
       * The coefficients are B[2*n]/(2*n*(2*n - 1)) where B[2*n] is the (2*n)th Bernoulli number. See (1.1) in [1].
       *
       * If you cannot access the paper, can also get these values from the formula in [2].
       *
       *    1 /     12 = 0.00833333333333333333333333333333
       *    1 /    360 = 0.00277777777777777777777777777778
       * ...
       * 3617 / 133400 = 0.02955065359477124183006535947712
       */
      var coeffs = [-0.029550653594771242, 6.4102564102564102564e-3, -0.0019175269175269176, 8.4175084175084175084e-4, -5952380952380953e-19, 7.9365079365079365079e-4, -0.002777777777777778, 8.3333333333333333333e-2];

      /**
       * Logarithm of the gamma function for real, positive numbers and complex numbers,
       * using Lanczos approximation for numbers and Stirling series for complex numbers.
       *
       * Syntax:
       *
       *    math.lgamma(n)
       *
       * Examples:
       *
       *    math.lgamma(5)       // returns 3.178053830347945
       *    math.lgamma(0)       // returns Infinity
       *    math.lgamma(-0.5)    // returns NaN
       *    math.lgamma(math.i)  // returns -0.6509231993018536 - 1.8724366472624294i
       *
       * See also:
       *
       *    gamma
       *
       * @param {number | Complex} n   A real or complex number
       * @return {number | Complex}    The log gamma of `n`
       */
      return typed(name, {
        number: lgammaNumber,
        Complex: lgammaComplex,
        BigNumber: function BigNumber() {
          throw new Error("mathjs doesn't yet provide an implementation of the algorithm lgamma for BigNumber");
        }
      });
      function lgammaComplex(n) {
        var TWOPI = 6.2831853071795864769252842; // 2*pi
        var LOGPI = 1.1447298858494001741434262; // log(pi)

        var REFLECTION = 0.1;
        if (n.isNaN()) {
          return new Complex(NaN, NaN);
        } else if (n.im === 0) {
          return new Complex(lgammaNumber(n.re), 0);
        } else if (n.re >= SMALL_RE || Math.abs(n.im) >= SMALL_IM) {
          return lgammaStirling(n);
        } else if (n.re <= REFLECTION) {
          // Reflection formula. see Proposition 3.1 in [1]
          var tmp = copysign(TWOPI, n.im) * Math.floor(0.5 * n.re + 0.25);
          var a = n.mul(Math.PI).sin().log();
          var b = lgammaComplex(new Complex(1 - n.re, -n.im));
          return new Complex(LOGPI, tmp).sub(a).sub(b);
        } else if (n.im >= 0) {
          return lgammaRecurrence(n);
        } else {
          return lgammaRecurrence(n.conjugate()).conjugate();
        }
      }
      function lgammaStirling(z) {
        // formula ref in [2]
        // computation ref:
        // https://github.com/scipy/scipy/blob/v1.8.0/scipy/special/_loggamma.pxd#L101

        // left part

        // x (log(x) - 1) + 1/2 (log(2PI) - log(x))
        // => (x - 0.5) * log(x) - x + log(2PI) / 2
        var leftPart = z.sub(0.5).mul(z.log()).sub(z).add(lnSqrt2PI);

        // right part

        var rz = new Complex(1, 0).div(z);
        var rzz = rz.div(z);
        var a = coeffs[0];
        var b = coeffs[1];
        var r = 2 * rzz.re;
        var s = rzz.re * rzz.re + rzz.im * rzz.im;
        for (var i = 2; i < 8; i++) {
          var tmp = b;
          b = -s * a + coeffs[i];
          a = r * a + tmp;
        }
        var rightPart = rz.mul(rzz.mul(a).add(b));

        // plus left and right

        return leftPart.add(rightPart);
      }
      function lgammaRecurrence(z) {
        // computation ref:
        // https://github.com/scipy/scipy/blob/v1.8.0/scipy/special/_loggamma.pxd#L78

        var signflips = 0;
        var sb = 0;
        var shiftprod = z;
        z = z.add(1);
        while (z.re <= SMALL_RE) {
          shiftprod = shiftprod.mul(z);
          var nsb = shiftprod.im < 0 ? 1 : 0;
          if (nsb !== 0 && sb === 0) signflips++;
          sb = nsb;
          z = z.add(1);
        }
        return lgammaStirling(z).sub(shiftprod.log()).sub(new Complex(0, signflips * 2 * Math.PI * 1));
      }
    });

    /**
     * THIS FILE IS AUTO-GENERATED
     * DON'T MAKE CHANGES HERE
     */
    var BigNumber = /* #__PURE__ */createBigNumberClass({
      config: config$1
    });
    var Complex = /* #__PURE__ */createComplexClass({});
    var Fraction = /* #__PURE__ */createFractionClass({});
    var Matrix = /* #__PURE__ */createMatrixClass({});
    var DenseMatrix = /* #__PURE__ */createDenseMatrixClass({
      Matrix
    });
    var typed = /* #__PURE__ */createTyped({
      BigNumber,
      Complex,
      DenseMatrix,
      Fraction
    });
    var abs$1 = /* #__PURE__ */createAbs({
      typed
    });
    var addScalar = /* #__PURE__ */createAddScalar({
      typed
    });
    var conj = /* #__PURE__ */createConj({
      typed
    });
    var equalScalar = /* #__PURE__ */createEqualScalar({
      config: config$1,
      typed
    });
    var erf = /* #__PURE__ */createErf({
      typed
    });
    var isZero = /* #__PURE__ */createIsZero({
      equalScalar,
      typed
    });
    var lgamma = /* #__PURE__ */createLgamma({
      Complex,
      typed
    });
    var multiplyScalar = /* #__PURE__ */createMultiplyScalar({
      typed
    });
    var number = /* #__PURE__ */createNumber({
      typed
    });
    var SparseMatrix = /* #__PURE__ */createSparseMatrixClass({
      Matrix,
      equalScalar,
      typed
    });
    var subtractScalar = /* #__PURE__ */createSubtractScalar({
      typed
    });
    var bignumber = /* #__PURE__ */createBignumber({
      BigNumber,
      typed
    });
    var matrix = /* #__PURE__ */createMatrix({
      DenseMatrix,
      Matrix,
      SparseMatrix,
      typed
    });
    var fraction = /* #__PURE__ */createFraction({
      Fraction,
      typed
    });
    var identity = /* #__PURE__ */createIdentity({
      BigNumber,
      DenseMatrix,
      SparseMatrix,
      config: config$1,
      matrix,
      typed
    });
    var numeric = /* #__PURE__ */createNumeric({
      bignumber,
      fraction,
      number
    });
    var size = /* #__PURE__ */createSize({
      matrix,
      config: config$1,
      typed
    });
    var unaryMinus = /* #__PURE__ */createUnaryMinus({
      typed
    });
    var divideScalar = /* #__PURE__ */createDivideScalar({
      numeric,
      typed
    });
    var dot = /* #__PURE__ */createDot({
      addScalar,
      conj,
      multiplyScalar,
      size,
      typed
    });
    var multiply = /* #__PURE__ */createMultiply({
      addScalar,
      dot,
      equalScalar,
      matrix,
      multiplyScalar,
      typed
    });
    var det = /* #__PURE__ */createDet({
      divideScalar,
      isZero,
      matrix,
      multiply,
      subtractScalar,
      typed,
      unaryMinus
    });
    var inv = /* #__PURE__ */createInv({
      abs: abs$1,
      addScalar,
      det,
      divideScalar,
      identity,
      matrix,
      multiply,
      typed,
      unaryMinus
    });
    var pow = /* #__PURE__ */createPow({
      Complex,
      config: config$1,
      fraction,
      identity,
      inv,
      matrix,
      multiply,
      number,
      typed
    });
    var gamma = /* #__PURE__ */createGamma({
      BigNumber,
      Complex,
      config: config$1,
      multiplyScalar,
      pow,
      typed
    });

    class Stack {
        constructor() {
            // Bottom of the array is at index 0
            this.storage = [];
        }
        push(...items) {
            for (const item of items) {
                this.storage.push(item);
            }
        }
        pop() {
            return this.storage.pop();
        }
        peek() {
            if (this.isEmpty()) {
                return undefined;
            }
            return this.storage[this.size() - 1];
        }
        size() {
            return this.storage.length;
        }
        isEmpty() {
            return this.size() == 0;
        }
        getStack() {
            // return a copy of the stack's contents
            return [...this.storage];
        }
        some(predicate) {
            return this.storage.some(predicate);
        }
        // required for first-class continuations,
        // which directly mutate this stack globally.
        setTo(otherStack) {
            this.storage = otherStack.storage;
        }
    }

    /**
     * Create a StatementSequence node.
     */
    const statementSequence = (body, loc) => ({
        type: 'StatementSequence',
        body,
        loc,
        innerComments: undefined,
    });
    const isNode = (item) => {
        return typeof item === 'object' && item !== null && 'type' in item;
    };
    const isBlockStatement = (node) => {
        return node.type === 'BlockStatement';
    };
    const hasDeclarations = (node) => {
        return node.body.some(stmt => stmt.type === 'VariableDeclaration' || stmt.type === 'FunctionDeclaration');
    };
    const blockArrowFunction = (params, body, loc) => ({
        type: 'ArrowFunctionExpression',
        expression: false,
        generator: false,
        params,
        body: Array.isArray(body) ? blockStatement(body) : body,
        loc
    });
    const blockStatement = (body, loc) => ({
        type: 'BlockStatement',
        body,
        loc
    });
    const constantDeclaration = (name, init, loc) => declaration(name, 'declaration', init, loc);
    const declaration = (name, kind, init, loc) => ({
        type: 'VariableDeclaration',
        declarations: [
            {
                type: 'VariableDeclarator',
                id: identifier(name),
                init
            }
        ],
        kind: 'declaration',
        loc
    });
    const identifier = (name, loc) => ({
        type: 'Identifier',
        name,
        loc
    });
    const returnStatement = (argument, loc) => ({
        type: 'ReturnStatement',
        argument,
        loc
    });
    const hasReturnStatement = (block) => {
        let hasReturn = false;
        for (const statement of block.body) {
            if (isReturnStatement(statement)) {
                hasReturn = true;
            }
            else if (isIfStatement(statement)) {
                // Parser enforces that if/else have braces (block statement)
                hasReturn = hasReturn || hasReturnStatementIf(statement);
            }
            else if (isBlockStatement(statement) || isStatementSequence$1(statement)) {
                hasReturn = hasReturn && hasReturnStatement(statement);
            }
        }
        return hasReturn;
    };
    const isReturnStatement = (node) => {
        return node.type == 'ReturnStatement';
    };
    const isIfStatement = (node) => {
        return node.type == 'IfStatement';
    };
    const hasReturnStatementIf = (statement) => {
        let hasReturn = true;
        // Parser enforces that if/else have braces (block statement)
        hasReturn = hasReturn && hasReturnStatement(statement.consequent);
        if (statement.alternate) {
            if (isIfStatement(statement.alternate)) {
                hasReturn = hasReturn && hasReturnStatementIf(statement.alternate);
            }
            else if (isBlockStatement(statement.alternate) || isStatementSequence$1(statement.alternate)) {
                hasReturn = hasReturn && hasReturnStatement(statement.alternate);
            }
        }
        return hasReturn;
    };
    const isStatementSequence$1 = (node) => {
        return node.type == 'StatementSequence';
    };
    const literal = (value, loc) => ({
        type: 'Literal',
        value,
        loc
    });

    /**
     * The heap stores all objects in each environment.
     */
    class Heap {
        constructor() {
            this.storage = null;
        }
        add(...items) {
            var _a;
            (_a = this.storage) !== null && _a !== void 0 ? _a : (this.storage = new Set());
            for (const item of items) {
                this.storage.add(item);
            }
        }
        /** Checks the existence of `item` in the heap. */
        contains(item) {
            var _a, _b;
            return (_b = (_a = this.storage) === null || _a === void 0 ? void 0 : _a.has(item)) !== null && _b !== void 0 ? _b : false;
        }
        /** Gets the number of items in the heap. */
        size() {
            var _a, _b;
            return (_b = (_a = this.storage) === null || _a === void 0 ? void 0 : _a.size) !== null && _b !== void 0 ? _b : 0;
        }
        /**
         * Removes `item` from current heap and adds it to `otherHeap`.
         * If the current heap does not contain `item`, nothing happens.
         * @returns whether the item transfer is successful
         */
        move(item, otherHeap) {
            if (!this.contains(item))
                return false;
            this.storage.delete(item);
            otherHeap.add(item);
            return true;
        }
        /** Returns a copy of the heap's contents. */
        getHeap() {
            return new Set(this.storage);
        }
    }

    const uniqueId = (context) => {
        return `${context.runtime.objectCount++}`;
    };
    const createEnvironment = (context, closure, args, callExpression) => {
        const environment = {
            // TODO: name
            name: '',
            tail: closure.environment,
            head: {},
            heap: new Heap(),
            id: uniqueId(context),
            callExpression: Object.assign({}, callExpression)
        };
        // console.info('closure.node.params:', closure.node.params);
        // console.info('Number of params:', closure.node.params.length);
        closure.node.params.forEach((param, index) => {
            if (isRestElement(param)) {
                const array = args.slice(index);
                handleArrayCreation(context, array, environment);
                environment.head[param.argument.name] = array;
            }
            else {
                environment.head[param.name] = args[index];
            }
        });
        return environment;
    };
    const createSimpleEnvironment = (context, name, tail = null) => {
        return {
            id: uniqueId(context),
            name,
            tail,
            head: {},
            heap: new Heap(),
            // callExpression 和 thisContext 可选，根据需要传递
        };
    };
    const createProgramEnvironment = (context, isPrelude) => {
        return createSimpleEnvironment(context, isPrelude ? 'prelude' : 'programEnvironment');
    };
    const createBlockEnvironment = (context, name = 'blockEnvironment') => {
        return {
            name,
            tail: currentEnvironment(context),
            head: {},
            heap: new Heap(),
            id: uniqueId(context)
        };
    };
    const isRestElement = (node) => {
        return node.type === 'RestElement';
    };
    const handleArrayCreation = (context, array, envOverride) => {
        const environment = envOverride !== null && envOverride !== void 0 ? envOverride : currentEnvironment(context);
        Object.defineProperties(array, {
            id: { value: uniqueId(context) },
            environment: { value: environment, writable: true }
        });
        environment.heap.add(array); // 假设 heap.add 已定义
    };
    const currentEnvironment = (context) => {
        return context.runtime.environments[0];
    };
    const popEnvironment = (context) => context.runtime.environments.shift();
    const pushEnvironment = (context, environment) => {
        context.runtime.environments.unshift(environment);
        context.runtime.environmentTree.insert(environment);
    };

    var InstrType;
    (function (InstrType) {
        InstrType["RESET"] = "Reset";
        InstrType["WHILE"] = "While";
        InstrType["FOR"] = "For";
        InstrType["ASSIGNMENT"] = "Assignment";
        InstrType["ANN_ASSIGNMENT"] = "AnnAssignment";
        InstrType["APPLICATION"] = "Application";
        InstrType["UNARY_OP"] = "UnaryOperation";
        InstrType["BINARY_OP"] = "BinaryOperation";
        InstrType["BOOL_OP"] = "BoolOperation";
        InstrType["COMPARE"] = "Compare";
        InstrType["CALL"] = "Call";
        InstrType["RETURN"] = "Return";
        InstrType["BREAK"] = "Break";
        InstrType["CONTINUE"] = "Continue";
        InstrType["IF"] = "If";
        InstrType["FUNCTION_DEF"] = "FunctionDef";
        InstrType["LAMBDA"] = "Lambda";
        InstrType["MULTI_LAMBDA"] = "MultiLambda";
        InstrType["GROUPING"] = "Grouping";
        InstrType["LITERAL"] = "Literal";
        InstrType["VARIABLE"] = "Variable";
        InstrType["TERNARY"] = "Ternary";
        InstrType["PASS"] = "Pass";
        InstrType["ASSERT"] = "Assert";
        InstrType["IMPORT"] = "Import";
        InstrType["GLOBAL"] = "Global";
        InstrType["NONLOCAL"] = "NonLocal";
        InstrType["Program"] = "Program";
        InstrType["BRANCH"] = "Branch";
        InstrType["POP"] = "Pop";
        InstrType["ENVIRONMENT"] = "environment";
        InstrType["MARKER"] = "marker";
    })(InstrType || (InstrType = {}));

    const popInstr = (srcNode) => ({ instrType: InstrType.POP, srcNode });
    const assmtInstr = (symbol, constant, declaration, srcNode) => ({
        instrType: InstrType.ASSIGNMENT,
        symbol,
        constant,
        declaration,
        srcNode
    });
    const appInstr = (numOfArgs, srcNode) => ({
        instrType: InstrType.APPLICATION,
        numOfArgs,
        srcNode
    });
    const envInstr = (env, srcNode) => ({
        instrType: InstrType.ENVIRONMENT,
        env,
        srcNode
    });
    const markerInstr = (srcNode) => ({
        instrType: InstrType.MARKER,
        srcNode
    });
    const binOpInstr = (symbol, srcNode) => ({
        instrType: InstrType.BINARY_OP,
        symbol,
        srcNode
    });
    const resetInstr = (srcNode) => ({
        instrType: InstrType.RESET,
        srcNode
    });
    const branchInstr = (consequent, alternate, srcNode) => ({
        instrType: InstrType.BRANCH,
        consequent,
        alternate,
        srcNode
    });
    const conditionalExpression = (test, consequent, alternate, loc) => ({
        type: 'ConditionalExpression',
        test,
        consequent,
        alternate,
        loc
    });
    const unOpInstr = (symbol, srcNode) => ({
        instrType: InstrType.UNARY_OP,
        symbol,
        srcNode
    });

    // closure.ts
    class Closure {
        constructor(node, environment, context, predefined = false) {
            this.node = node;
            this.environment = environment;
            this.context = context;
            this.predefined = predefined;
            this.originalNode = node;
        }
        static makeFromArrowFunction(node, environment, context, dummyReturn = false, predefined = false) {
            const functionBody = !isBlockStatement(node.body) && !isStatementSequence(node.body)
                ? blockStatement([returnStatement(node.body, node.body.loc)], node.body.loc)
                : dummyReturn && !hasReturnStatement(node.body)
                    ? blockStatement([
                        ...node.body.body,
                        returnStatement(identifier('undefined', node.body.loc), node.body.loc)
                    ], node.body.loc)
                    : node.body;
            const closure = new Closure(blockArrowFunction(node.params, functionBody, node.loc), environment, context, predefined);
            closure.originalNode = node;
            return closure;
        }
    }
    const isStatementSequence = (node) => {
        return node.type == 'StatementSequence';
    };

    // todo
    // just put on here temporarily
    const UNKNOWN_LOCATION = {
        start: {
            line: -1,
            column: -1
        },
        end: {
            line: -1,
            column: -1
        }
    };
    class RuntimeSourceError {
        constructor(node) {
            var _a;
            this.type = ErrorType.RUNTIME;
            this.severity = ErrorSeverity.ERROR;
            this.message = 'Error';
            this.location = (_a = node === null || node === void 0 ? void 0 : node.loc) !== null && _a !== void 0 ? _a : UNKNOWN_LOCATION;
        }
        explain() {
            return '';
        }
        elaborate() {
            return this.explain();
        }
    }

    class TypeConcatenateError extends RuntimeSourceError {
        constructor(node) {
            super(node);
            this.type = ErrorType.TYPE;
        }
        explain() {
            return `TypeError: can only concatenate str (not "int") to str.`;
        }
        elaborate() {
            return `You are trying to concatenate a string with an integer. To fix this, convert the integer to a string using str(), or ensure both operands are of the same type.`;
        }
    }
    class MissingRequiredPositionalError extends RuntimeSourceError {
        constructor(node, functionName, params, args) {
            super(node);
            this.type = ErrorType.TYPE;
            this.functionName = functionName;
            this.missingParamCnt = params.length - args.length;
            const missingNames = [];
            for (let i = args.length; i < params.length; i++) {
                const param = params[i];
                missingNames.push("\'" + param.name + "\'");
            }
            this.missingParamName = this.joinWithCommasAndAnd(missingNames);
        }
        explain() {
            return `TypeError: ${this.functionName}() missing ${this.missingParamCnt} required positional argument: ${this.missingParamName}`;
        }
        elaborate() {
            return `You called ${this.functionName}() without providing the required positional argument ${this.missingParamName}. Make sure to pass all required arguments when calling ${this.functionName}.`;
        }
        joinWithCommasAndAnd(names) {
            if (names.length === 0) {
                return '';
            }
            else if (names.length === 1) {
                return names[0];
            }
            else if (names.length === 2) {
                return `${names[0]} and ${names[1]}`;
            }
            else {
                const last = names.pop();
                return `${names.join(', ')} and ${last}`;
            }
        }
    }
    class TooManyPositionalArgumentsError extends RuntimeSourceError {
        constructor(node, functionName, params, args) {
            super(node);
            this.type = ErrorType.TYPE;
            this.functionName = functionName;
            this.expectedCount = params.length;
            this.givenCount = args.length;
        }
        explain() {
            return `TypeError: ${this.functionName}() takes ${this.expectedCount} positional arguments but ${this.givenCount} were given`;
        }
        elaborate() {
            return `You called ${this.functionName}() with ${this.givenCount} positional arguments, but it only expects ${this.expectedCount}. Make sure to pass the correct number of arguments when calling ${this.functionName}.`;
        }
    }

    const isIdentifier = (node) => {
        return node.name !== undefined;
    };
    const setToTrue = (item) => {
        item.isEnvDependent = true;
        return item;
    };
    const setToFalse = (item) => {
        item.isEnvDependent = false;
        return item;
    };
    const propertySetter = new Map([
        // AST Nodes
        [
            'Program',
            (item) => {
                const node = item;
                node.isEnvDependent = node.body.some(elem => isEnvDependent(elem));
                return node;
            }
        ],
        ['Literal', setToFalse],
        ['ImportDeclaration', setToFalse],
        ['BreakStatement', setToFalse],
        ['ContinueStatement', setToFalse],
        ['DebuggerStatement', setToFalse],
        ['VariableDeclaration', setToTrue],
        ['FunctionDeclaration', setToTrue],
        ['ArrowFunctionExpression', setToTrue],
        ['Identifier', setToTrue],
        [
            'LogicalExpression',
            (item) => {
                const node = item;
                node.isEnvDependent = isEnvDependent(node.left) || isEnvDependent(node.right);
                return node;
            }
        ],
        [
            'BinaryExpression',
            (item) => {
                const node = item;
                node.isEnvDependent = isEnvDependent(node.left) || isEnvDependent(node.right);
                return node;
            }
        ],
        [
            'UnaryExpression',
            (item) => {
                const node = item;
                node.isEnvDependent = isEnvDependent(node.argument);
                return node;
            }
        ],
        [
            'ConditionalExpression',
            (item) => {
                const node = item;
                node.isEnvDependent =
                    isEnvDependent(node.consequent) ||
                        isEnvDependent(node.alternate) ||
                        isEnvDependent(node.test);
                return node;
            }
        ],
        [
            'MemberExpression',
            (item) => {
                const node = item;
                node.isEnvDependent = isEnvDependent(node.property) || isEnvDependent(node.object);
                return node;
            }
        ],
        [
            'ArrayExpression',
            (item) => {
                const node = item;
                node.isEnvDependent = node.elements.some(elem => isEnvDependent(elem));
                return node;
            }
        ],
        [
            'AssignmentExpression',
            (item) => {
                const node = item;
                node.isEnvDependent = isEnvDependent(node.left) || isEnvDependent(node.right);
                return node;
            }
        ],
        [
            'ReturnStatement',
            (item) => {
                const node = item;
                node.isEnvDependent = isEnvDependent(node.argument);
                return node;
            }
        ],
        [
            'CallExpression',
            (item) => {
                const node = item;
                node.isEnvDependent =
                    isEnvDependent(node.callee) || node.arguments.some(arg => isEnvDependent(arg));
                return node;
            }
        ],
        [
            'ExpressionStatement',
            (item) => {
                const node = item;
                node.isEnvDependent = isEnvDependent(node.expression);
                return node;
            }
        ],
        [
            'IfStatement',
            (item) => {
                const node = item;
                node.isEnvDependent =
                    isEnvDependent(node.test) ||
                        isEnvDependent(node.consequent) ||
                        isEnvDependent(node.alternate);
                return node;
            }
        ],
        [
            'ForStatement',
            (item) => {
                const node = item;
                node.isEnvDependent =
                    isEnvDependent(node.body) ||
                        isEnvDependent(node.init) ||
                        isEnvDependent(node.test) ||
                        isEnvDependent(node.update);
                return node;
            }
        ],
        [
            'WhileStatement',
            (item) => {
                const node = item;
                node.isEnvDependent = isEnvDependent(node.body) || isEnvDependent(node.test);
                return node;
            }
        ],
        [
            'BlockStatement',
            (item) => {
                const node = item;
                node.isEnvDependent = node.body.some(stm => isEnvDependent(stm));
                return node;
            }
        ],
        [
            'StatementSequence',
            (item) => {
                const node = item;
                node.isEnvDependent = node.body.some(stm => isEnvDependent(stm));
                return node;
            }
        ],
        ['ImportSpecifier', setToTrue],
        ['ImportDefaultSpecifier', setToTrue],
        // InstrType
        [InstrType.RESET, setToFalse],
        [InstrType.UNARY_OP, setToFalse],
        [InstrType.BINARY_OP, setToFalse],
        [InstrType.CONTINUE, setToFalse],
        [InstrType.ASSIGNMENT, setToTrue],
        [
            InstrType.WHILE,
            (item) => {
                const instr = item;
                instr.isEnvDependent = isEnvDependent(instr.test) || isEnvDependent(instr.body);
                return instr;
            }
        ],
        [
            InstrType.FOR,
            (item) => {
                const instr = item;
                instr.isEnvDependent =
                    isEnvDependent(instr.init) ||
                        isEnvDependent(instr.test) ||
                        isEnvDependent(instr.update) ||
                        isEnvDependent(instr.body);
                return instr;
            }
        ],
        [
            InstrType.BRANCH,
            (item) => {
                const instr = item;
                instr.isEnvDependent = isEnvDependent(instr.consequent) || isEnvDependent(instr.alternate);
                return instr;
            }
        ]
    ]);
    /**
     * Checks whether the evaluation of the given control item depends on the current environment.
     * The item is also considered environment dependent if its evaluation introduces
     * environment dependent items
     * @param item The control item to be checked
     * @return `true` if the item is environment depedent, else `false`.
     */
    function isEnvDependent(item) {
        var _a, _b;
        if (item === null || item === undefined) {
            return false;
        }
        // If result is already calculated, return it
        if (item.isEnvDependent !== undefined) {
            return item.isEnvDependent;
        }
        let setter;
        if (isNode(item)) {
            setter = propertySetter.get(item.type);
        }
        else if (isInstr(item)) {
            setter = propertySetter.get(item.instrType);
        }
        if (setter) {
            return (_b = (_a = setter(item)) === null || _a === void 0 ? void 0 : _a.isEnvDependent) !== null && _b !== void 0 ? _b : false;
        }
        return false;
    }
    // function isInstr(item: ControlItem): item is Instr & { isEnvDependent?: boolean } {
    //   return (item as Instr).instrType !== undefined;
    // }
    // export const envChanging = (command: ControlItem): boolean => {
    //   if (isNode(command)) {
    //     const type = command.type
    //     return (
    //       type === 'Program' ||
    //       type === 'BlockStatement' ||
    //       type === 'ArrowFunctionExpression' ||
    //       (type === 'ExpressionStatement' && command.expression.type === 'ArrowFunctionExpression')
    //     )
    //   } else {
    //     const type = command.instrType
    //     return (
    //       type === InstrType.ENVIRONMENT ||
    //       type === InstrType.ARRAY_LITERAL ||
    //       type === InstrType.ASSIGNMENT ||
    //       type === InstrType.ARRAY_ASSIGNMENT ||
    //       (type === InstrType.APPLICATION && (command as AppInstr).numOfArgs > 0)
    //     )
    //   }
    // }
    const envChanging = (command) => {
        if (isNode(command)) {
            const type = command.type;
            return (type === 'Program' ||
                type === 'BlockStatement' ||
                type === 'ArrowFunctionExpression' ||
                (type === 'ExpressionStatement' && command.expression.type === 'ArrowFunctionExpression'));
        }
        else if (isInstr(command)) {
            command.instrType;
            return (false);
        }
        else {
            return false;
        }
    };
    function declareFunctionsAndVariables(context, node, environment) {
        for (const statement of node.body) {
            switch (statement.type) {
                case 'VariableDeclaration':
                    declareVariables(context, statement, environment);
                    break;
                case 'FunctionDeclaration':
                    // FunctionDeclaration is always of type constant
                    declareIdentifier(context, statement.id.name, statement, environment, true);
                    break;
            }
        }
    }
    function declareVariables(context, node, environment) {
        for (const declaration of node.declarations) {
            // Retrieve declaration type from node
            const constant = node.kind === 'const';
            declareIdentifier(context, declaration.id.name, node, environment, constant);
        }
    }
    function declareIdentifier(context, name, node, environment, constant = false) {
        if (environment.head.hasOwnProperty(name)) {
            Object.getOwnPropertyDescriptors(environment.head);
            // return handleRuntimeError(
            //   context,
            //   new errors.VariableRedeclaration(node, name, descriptors[name].writable)
            // )
        }
        //environment.head[name] = constant ? UNASSIGNED_CONST : UNASSIGNED_LET
        environment.head[name] = 'declaration';
        return environment;
    }
    const handleSequence = (seq) => {
        const result = [];
        let valueProduced = false;
        for (const command of seq) {
            //if (!isImportDeclaration(command)) {
            if (valueProducing(command)) {
                // Value producing statements have an extra pop instruction
                if (valueProduced) {
                    result.push(popInstr(command));
                }
                else {
                    valueProduced = true;
                }
            }
            result.push(command);
            //}
        }
        // Push statements in reverse order
        return result.reverse();
    };
    const valueProducing = (command) => {
        const type = command.type;
        return (type !== 'VariableDeclaration' &&
            type !== 'FunctionDeclaration' &&
            type !== 'ContinueStatement' &&
            type !== 'BreakStatement' &&
            type !== 'DebuggerStatement' &&
            (type !== 'BlockStatement' || command.body.some(valueProducing)));
    };
    function defineVariable(context, name, value, constant = false, node) {
        const environment = currentEnvironment(context);
        if (environment.head[name] !== 'declaration') ;
        if (constant && value instanceof Closure) {
            value.declaredName = name;
        }
        Object.defineProperty(environment.head, name, {
            value,
            writable: !constant,
            enumerable: true
        });
        return environment;
    }
    const getVariable = (context, name, node) => {
        let environment = currentEnvironment(context);
        while (environment) {
            if (environment.head.hasOwnProperty(name)) {
                if (environment.head[name] === 'declaration') ;
                else {
                    return environment.head[name];
                }
            }
            else {
                environment = environment.tail;
            }
        }
        //return handleRuntimeError(context, new errors.UndefinedVariable(name, node))
    };
    const checkNumberOfArguments = (command, context, callee, args, exp) => {
        if (callee instanceof Closure) {
            // User-defined or Pre-defined functions
            const params = callee.node.params;
            // console.info("params: ", params);
            // console.info("args: ", args);
            //const hasVarArgs = params[params.length - 1]?.type === 'RestElement'
            if (params.length > args.length) {
                handleRuntimeError(context, new MissingRequiredPositionalError(command, callee.declaredName, params, args));
            }
            else if (params.length !== args.length) {
                handleRuntimeError(context, new TooManyPositionalArgumentsError(command, callee.declaredName, params, args));
            }
            //}
            // if (hasVarArgs ? params.length - 1 > args.length : params.length !== args.length) {
            //   // error
            //   // return handleRuntimeError(
            //   //   context,
            //   //   new errors.InvalidNumberOfArguments(
            //   //     exp,
            //   //     hasVarArgs ? params.length - 1 : params.length,
            //   //     args.length,
            //   //     hasVarArgs
            //   //   )
            //   // )
            // }
        }
        else {
            // Pre-built functions
            const hasVarArgs = callee.minArgsNeeded != undefined;
            if (hasVarArgs ? callee.minArgsNeeded > args.length : callee.length !== args.length) ;
        }
        return undefined;
    };
    const isInstr = (command) => {
        return command.instrType !== undefined;
    };
    const isSimpleFunction = (node) => {
        if (node.body.type !== 'BlockStatement' && node.body.type !== 'StatementSequence') {
            return true;
        }
        else {
            const block = node.body;
            return block.body.length === 1 && block.body[0].type === 'ReturnStatement';
        }
    };
    const reduceConditional = (node) => {
        return [branchInstr(node.consequent, node.alternate, node), node.test];
    };
    const handleRuntimeError = (context, error) => {
        context.errors.push(error);
        console.error(error.explain());
        console.error(error.elaborate());
        //console.log("Location:", `Line ${e.location.start.line}, Column ${e.location.start.column}`);
        throw error;
    };
    function pythonMod(a, b) {
        const mod = a % b;
        if ((mod >= 0 && b > 0) || (mod <= 0 && b < 0)) {
            return mod;
        }
        else {
            return mod + b;
        }
    }
    function hasImportDeclarations(node) {
        for (const statement of node.body) {
            if (statement.type === 'ImportDeclaration') {
                return true;
            }
        }
        return false;
    }
    const isImportDeclaration = (node) => node.type === 'ImportDeclaration';
    function getModuleDeclarationSource(node) {
        var _a, _b;
        assert(typeof ((_a = node.source) === null || _a === void 0 ? void 0 : _a.value) === 'string', `Expected ${node.type} to have a source value of type string, got ${(_b = node.source) === null || _b === void 0 ? void 0 : _b.value}`);
        return node.source.value;
    }
    class AssertionError extends RuntimeSourceError {
        constructor(message) {
            super();
            this.message = message;
        }
        explain() {
            return this.message;
        }
        elaborate() {
            return 'Please contact the administrators to let them know that this error has occurred';
        }
    }
    function assert(condition, message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }

    class Control extends Stack {
        constructor(program) {
            super();
            this.numEnvDependentItems = 0;
            // Load program into control stack
            program ? this.push(program) : null;
        }
        canAvoidEnvInstr() {
            return this.numEnvDependentItems === 0;
        }
        // For testing purposes
        getNumEnvDependentItems() {
            return this.numEnvDependentItems;
        }
        pop() {
            const item = super.pop();
            if (item !== undefined && isEnvDependent(item)) {
                this.numEnvDependentItems--;
            }
            return item;
        }
        push(...items) {
            const itemsNew = Control.simplifyBlocksWithoutDeclarations(...items);
            itemsNew.forEach((item) => {
                if (isEnvDependent(item)) {
                    this.numEnvDependentItems++;
                }
            });
            super.push(...itemsNew);
        }
        /**
         * Before pushing block statements on the control stack, we check if the block statement has any declarations.
         * If not, the block is converted to a StatementSequence.
         * @param items The items being pushed on the control.
         * @returns The same set of control items, but with block statements without declarations converted to StatementSequences.
         * NOTE: this function handles any case where StatementSequence has to be converted back into BlockStatement due to type issues
         */
        static simplifyBlocksWithoutDeclarations(...items) {
            const itemsNew = [];
            items.forEach(item => {
                if (isNode(item) && isBlockStatement(item) && !hasDeclarations(item)) {
                    // Push block body as statement sequence
                    const seq = statementSequence(item.body, item.loc);
                    itemsNew.push(seq);
                }
                else {
                    itemsNew.push(item);
                }
            });
            return itemsNew;
        }
        copy() {
            const newControl = new Control();
            const stackCopy = super.getStack();
            newControl.push(...stackCopy);
            return newControl;
        }
    }

    class Stash extends Stack {
        constructor() {
            super();
        }
        copy() {
            const newStash = new Stash();
            const stackCopy = super.getStack();
            newStash.push(...stackCopy);
            return newStash;
        }
    }

    // export function evaluateBinaryExpression(operator: BinaryOperator, left: any, right: any) {
    //     switch (operator) {
    //       case '+':
    //         return left + right
    //       case '-':
    //         return left - right
    //       case '*':
    //         return left * right
    //       case '/':
    //         return left / right
    //       case '%':
    //         return left % right
    //       case '===':
    //         return left === right
    //       case '!==':
    //         return left !== right
    //       case '<=':
    //         return left <= right
    //       case '<':
    //         return left < right
    //       case '>':
    //         return left > right
    //       case '>=':
    //         return left >= right
    //       default:
    //         return undefined
    //     }
    //   }
    function evaluateUnaryExpression(operator, value) {
        if (operator === '!') {
            if (value.type === 'bool') {
                return {
                    type: 'bool',
                    value: !(Boolean(value.value))
                };
            }
        }
        else if (operator === '-') {
            if (value.type === 'bigint') {
                return {
                    type: 'bigint',
                    value: -value.value
                };
            }
            else if (value.type === 'number') {
                return {
                    type: 'number',
                    value: -Number(value.value)
                };
            }
            else ;
            // else if (value.type === 'bool') {
            //     return {
            //         type: 'bigint',
            //         value: Boolean(value.value)?BigInt(-1):BigInt(0)
            //     };
            // }
        }
        else if (operator === 'typeof') {
            // todo
            return {
                type: String,
                value: typeof value.value
            };
        }
        else {
            return value;
        }
    }
    function evaluateBinaryExpression(context, identifier, left, right) {
        //if(isIdentifier(identifier)){
        //if(identifier.name === '__py_adder') {
        if (left.type === 'string' && right.type === 'string' && identifier.name === '__py_adder') {
            if (isIdentifier(identifier) && identifier.name === '__py_adder') {
                return {
                    type: 'string',
                    value: left.value + right.value
                };
            }
            else {
                let ret_value;
                if (identifier === '>') {
                    ret_value = left.value > right.value;
                }
                else if (identifier === '>=') {
                    ret_value = left.value >= right.value;
                }
                else if (identifier === '<') {
                    ret_value = left.value < right.value;
                }
                else if (identifier === '<=') {
                    ret_value = left.value <= right.value;
                }
                else if (identifier === '===') {
                    ret_value = left.value === right.value;
                }
                else if (identifier === '!==') {
                    ret_value = left.value !== right.value;
                }
                else ;
                return {
                    type: 'bool',
                    value: ret_value
                };
            }
        }
        else {
            // numbers: only int and float, not bool
            const numericTypes = ['number', 'bigint', 'complex']; //, 'bool'
            if (!numericTypes.includes(left.type) || !numericTypes.includes(right.type)) ;
            // if (left.type === 'bool') {
            //     left.type = 'bigint';
            //     left.value = left.value?BigInt(1):BigInt(0);
            // }
            // if (right.type === 'bool') {
            //     right.type = 'bigint';
            //     right.value = right.value?BigInt(1):BigInt(0);
            // }
            let originalLeft = { type: left.type, value: left.value };
            let originalRight = { type: right.type, value: right.value };
            if (left.type !== right.type) {
                // left.type = 'number';
                // left.value = Number(left.value);
                // right.type = 'number';
                // right.value = Number(right.value);
                if (left.type === 'complex' || right.type === 'complex') {
                    left.type = 'complex';
                    right.type = 'complex';
                    left.value = PyComplexNumber.fromValue(left.value);
                    right.value = PyComplexNumber.fromValue(right.value);
                }
                else if (left.type === 'number' || right.type === 'number') {
                    left.type = 'number';
                    right.type = 'number';
                    left.value = Number(left.value);
                    right.value = Number(right.value);
                }
            }
            let ret_value;
            let ret_type = left.type;
            if (isIdentifier(identifier)) {
                if (identifier.name === '__py_adder') {
                    if (left.type === 'complex' || right.type === 'complex') {
                        const leftComplex = PyComplexNumber.fromValue(left.value);
                        const rightComplex = PyComplexNumber.fromValue(right.value);
                        ret_value = leftComplex.add(rightComplex);
                    }
                    else {
                        ret_value = left.value + right.value;
                    }
                }
                else if (identifier.name === '__py_minuser') {
                    if (left.type === 'complex' || right.type === 'complex') {
                        const leftComplex = PyComplexNumber.fromValue(left.value);
                        const rightComplex = PyComplexNumber.fromValue(right.value);
                        ret_value = leftComplex.sub(rightComplex);
                    }
                    else {
                        ret_value = left.value - right.value;
                    }
                }
                else if (identifier.name === '__py_multiplier') {
                    if (left.type === 'complex' || right.type === 'complex') {
                        const leftComplex = PyComplexNumber.fromValue(left.value);
                        const rightComplex = PyComplexNumber.fromValue(right.value);
                        ret_value = leftComplex.mul(rightComplex);
                    }
                    else {
                        ret_value = left.value * right.value;
                    }
                }
                else if (identifier.name === '__py_divider') {
                    if (left.type === 'complex' || right.type === 'complex') {
                        const leftComplex = PyComplexNumber.fromValue(left.value);
                        const rightComplex = PyComplexNumber.fromValue(right.value);
                        ret_value = leftComplex.div(rightComplex);
                    }
                    else {
                        if (right.value !== 0) {
                            ret_type = 'number';
                            ret_value = Number(left.value) / Number(right.value);
                        }
                    }
                }
                else if (identifier.name === '__py_modder') {
                    if (left.type === 'complex') ;
                    ret_value = pythonMod(left.value, right.value);
                }
                else if (identifier.name === '__py_floorer') {
                    // TODO: floorer not in python now
                    ret_value = 0;
                }
                else if (identifier.name === '__py_powerer') {
                    if (left.type === 'complex') {
                        const leftComplex = PyComplexNumber.fromValue(left.value);
                        const rightComplex = PyComplexNumber.fromValue(right.value);
                        ret_value = leftComplex.pow(rightComplex);
                    }
                    else {
                        if (left.type === 'bigint' && right.value < 0) {
                            ret_value = Number(left.value) ** Number(right.value);
                            ret_type = 'number';
                        }
                        else {
                            ret_value = left.value ** right.value;
                        }
                    }
                }
                else ;
            }
            else {
                ret_type = 'bool';
                // one of them is complex, convert all to complex then compare
                // for complex, only '==' and '!=' valid
                if (left.type === 'complex') {
                    const leftComplex = PyComplexNumber.fromValue(left.value);
                    const rightComplex = PyComplexNumber.fromValue(right.value);
                    if (identifier === '===') {
                        ret_value = leftComplex.equals(rightComplex);
                    }
                    else if (identifier === '!==') {
                        ret_value = !leftComplex.equals(rightComplex);
                    }
                    else ;
                }
                else if (originalLeft.type !== originalRight.type) {
                    let int_num;
                    let floatNum;
                    let compare_res;
                    if (originalLeft.type === 'bigint') {
                        int_num = originalLeft;
                        floatNum = originalRight;
                        compare_res = pyCompare(int_num, floatNum);
                    }
                    else {
                        int_num = originalRight;
                        floatNum = originalLeft;
                        compare_res = -pyCompare(int_num, floatNum);
                    }
                    if (identifier === '>') {
                        ret_value = compare_res > 0;
                    }
                    else if (identifier === '>=') {
                        ret_value = compare_res >= 0;
                    }
                    else if (identifier === '<') {
                        ret_value = compare_res < 0;
                    }
                    else if (identifier === '<=') {
                        ret_value = compare_res <= 0;
                    }
                    else if (identifier === '===') {
                        ret_value = compare_res === 0;
                    }
                    else if (identifier === '!==') {
                        ret_value = compare_res !== 0;
                    }
                    else ;
                }
                else {
                    if (identifier === '>') {
                        ret_value = left.value > right.value;
                    }
                    else if (identifier === '>=') {
                        ret_value = left.value >= right.value;
                    }
                    else if (identifier === '<') {
                        ret_value = left.value < right.value;
                    }
                    else if (identifier === '<=') {
                        ret_value = left.value <= right.value;
                    }
                    else if (identifier === '===') {
                        ret_value = left.value === right.value;
                    }
                    else if (identifier === '!==') {
                        ret_value = left.value !== right.value;
                    }
                    else ;
                }
            }
            return {
                type: ret_type,
                value: ret_value
            };
        }
    }
    function pyCompare(int_num, float_num) {
        // int_num.value < float_num.value => -1
        // int_num.value = float_num.value => 0
        // int_num.value > float_num.value => 1
        // If float_num is positive Infinity, then int_num is considered smaller.
        if (float_num.value === Infinity) {
            return -1;
        }
        if (float_num.value === -Infinity) {
            return 1;
        }
        const signInt = (int_num.value < 0) ? -1 : (int_num.value > 0 ? 1 : 0);
        const signFlt = Math.sign(float_num.value); // -1, 0, or 1
        if (signInt < signFlt)
            return -1; // e.g. int<0, float>=0 => int < float
        if (signInt > signFlt)
            return 1; // e.g. int>=0, float<0 => int > float
        // Both have the same sign (including 0).
        // If both are zero, treat them as equal.
        if (signInt === 0 && signFlt === 0) {
            return 0;
        }
        // Both are either positive or negative.
        // If |int_num.value| is within 2^53, it can be safely converted to a JS number for an exact comparison.
        const absInt = int_num.value < 0 ? -int_num.value : int_num.value;
        const MAX_SAFE = 9007199254740991; // 2^53 - 1
        if (absInt <= MAX_SAFE) {
            // Safe conversion to double.
            const intAsNum = Number(int_num.value);
            const diff = intAsNum - float_num.value;
            if (diff === 0)
                return 0;
            return diff < 0 ? -1 : 1;
        }
        // For large integers exceeding 2^53, we need to distinguish more carefully.
        // General idea: Determine the order of magnitude of float_num.value (via log10) and compare it with
        // the number of digits of int_num.value. An approximate comparison can indicate whether
        // int_num.value is greater or less than float_num.value.
        // First, check if float_num.value is nearly zero (but not zero).
        if (float_num.value === 0) {
            // Although signFlt would be 0 and handled above, just to be safe:
            return signInt;
        }
        const absFlt = Math.abs(float_num.value);
        // Determine the order of magnitude.
        const exponent = Math.floor(Math.log10(absFlt));
        // For example, if float_num.value = 3.333333e49, exponent = 49, indicating roughly 50 digits in its integer part.
        // Get the decimal string representation of the absolute integer.
        const intStr = absInt.toString();
        const intDigits = intStr.length;
        // If exponent + 1 is less than intDigits, then |int_num.value| has more digits
        // and is larger (if positive) or smaller (if negative) than float_num.value.
        // Conversely, if exponent + 1 is greater than intDigits, int_num.value has fewer digits.
        const integerPartLen = exponent + 1;
        if (integerPartLen < intDigits) {
            // length of int_num.value is larger => all positive => int_num.value > float_num.value
            //                => all negative => int_num.value < float_num.value
            return (signInt > 0) ? 1 : -1;
        }
        else if (integerPartLen > intDigits) {
            // length of int_num.value is smaller => all positive => int_num.value < float_num.value
            //                => all negative => int_num.value > float_num.value
            return (signInt > 0) ? -1 : 1;
        }
        else {
            // (5.2) If the number of digits is the same, they may be extremely close.
            // Method: Convert float_num.value into an approximate BigInt string and perform a lexicographical comparison.
            const floatApproxStr = approximateBigIntString(absFlt, 30);
            const aTrim = intStr.replace(/^0+/, '');
            const bTrim = floatApproxStr.replace(/^0+/, '');
            // If lengths differ after trimming, the one with more digits is larger.
            if (aTrim.length > bTrim.length) {
                return (signInt > 0) ? 1 : -1;
            }
            else if (aTrim.length < bTrim.length) {
                return (signInt > 0) ? -1 : 1;
            }
            else {
                // Same length: use lexicographical comparison.
                const cmp = aTrim.localeCompare(bTrim);
                if (cmp === 0) {
                    return 0;
                }
                // cmp>0 => aTrim > bTrim => aVal > bVal
                return (cmp > 0) ? (signInt > 0 ? 1 : -1)
                    : (signInt > 0 ? -1 : 1);
            }
        }
    }
    function approximateBigIntString(num, precision) {
        // Use scientific notation to obtain a string in the form "3.333333333333333e+49"
        const s = num.toExponential(precision);
        // Split into mantissa and exponent parts.
        // The regular expression matches strings of the form: /^([\d.]+)e([+\-]\d+)$/
        const match = s.match(/^([\d.]+)e([+\-]\d+)$/);
        if (!match) {
            // For extremely small or extremely large numbers, toExponential() should follow this format.
            // As a fallback, return Math.floor(num).toString()
            return Math.floor(num).toString();
        }
        let mantissaStr = match[1]; // "3.3333333333..."
        const exp = parseInt(match[2], 10); // e.g. +49
        // Remove the decimal point
        mantissaStr = mantissaStr.replace('.', '');
        // Get the current length of the mantissa string
        const len = mantissaStr.length;
        // Calculate the required integer length: for exp ≥ 0, we want the integer part
        // to have (1 + exp) digits.
        const integerLen = 1 + exp;
        if (integerLen <= 0) {
            // This indicates num < 1 (e.g., exponent = -1, mantissa = "3" results in 0.xxx)
            // For big integer comparison, such a number is very small, so simply return "0"
            return "0";
        }
        if (len < integerLen) {
            // The mantissa is not long enough; pad with zeros at the end.
            return mantissaStr.padEnd(integerLen, '0');
        }
        // If the mantissa is too long, truncate it (this is equivalent to taking the floor).
        // Rounding could be applied if necessary, but truncation is sufficient for comparison.
        return mantissaStr.slice(0, integerLen);
    }

    class CseError {
        constructor(message) {
            this.message = message;
        }
    }

    /**
     * Python style dictionary
     */
    class Dict {
        constructor(internalMap = new Map()) {
            this.internalMap = internalMap;
        }
        get size() {
            return this.internalMap.size;
        }
        [Symbol.iterator]() {
            return this.internalMap[Symbol.iterator]();
        }
        get(key) {
            return this.internalMap.get(key);
        }
        set(key, value) {
            return this.internalMap.set(key, value);
        }
        has(key) {
            return this.internalMap.has(key);
        }
        /**
         * Similar to how the python dictionary's setdefault function works:
         * If the key is not present, it is set to the given value, then that value is returned
         * Otherwise, `setdefault` returns the value stored in the dictionary without
         * modifying it
         */
        setdefault(key, value) {
            if (!this.has(key)) {
                this.set(key, value);
            }
            return this.get(key);
        }
        update(key, defaultVal, updater) {
            const value = this.setdefault(key, defaultVal);
            const newValue = updater(value);
            this.set(key, newValue);
            return newValue;
        }
        entries() {
            return [...this.internalMap.entries()];
        }
        forEach(func) {
            this.internalMap.forEach((v, k) => func(k, v));
        }
        /**
         * Similar to `mapAsync`, but for an async mapping function that does not return any value
         */
        forEachAsync(func) {
            return __awaiter(this, void 0, void 0, function* () {
                yield Promise.all(this.map((key, value, i) => func(key, value, i)));
            });
        }
        map(func) {
            return this.entries().map(([k, v], i) => func(k, v, i));
        }
        /**
         * Using a mapping function that returns a promise, transform a map
         * to another map with different keys and values. All calls to the mapping function
         * execute asynchronously
         */
        mapAsync(func) {
            return Promise.all(this.map((key, value, i) => func(key, value, i)));
        }
        flatMap(func) {
            return this.entries().flatMap(([k, v], i) => func(k, v, i));
        }
    }
    /**
     * Convenience class for maps that store an array of values
     */
    class ArrayMap extends Dict {
        add(key, item) {
            this.setdefault(key, []).push(item);
        }
    }
    function filterImportDeclarations({ body }) {
        return body.reduce(([importNodes, otherNodes], node) => {
            if (!isImportDeclaration(node))
                return [importNodes, [...otherNodes, node]];
            const moduleName = getModuleDeclarationSource(node);
            importNodes.add(moduleName, node);
            return [importNodes, otherNodes];
        }, [new ArrayMap(), []]);
    }

    /**
     * This interpreter implements an explicit-control evaluator.
     *
     * Heavily adapted from https://github.com/source-academy/JSpike/
     */
    let cseFinalPrint = "";
    function addPrint(str) {
        cseFinalPrint = cseFinalPrint + str + "\n";
    }
    /**
     * Function that returns the appropriate Promise<Result> given the output of CSE machine evaluating, depending
     * on whether the program is finished evaluating, ran into a breakpoint or ran into an error.
     * @param context The context of the program.
     * @param value The value of CSE machine evaluating the program.
     * @returns The corresponding promise.
     */
    function CSEResultPromise(context, value) {
        return new Promise((resolve, reject) => {
            if (value instanceof CSEBreak) {
                resolve({ status: 'suspended-cse-eval', context });
            }
            else if (value instanceof CseError) {
                resolve({ status: 'error' });
            }
            else {
                //const rep: Value = { type: "string", value: cseFinalPrint };
                const representation = new Representation(value);
                resolve({ status: 'finished', context, value, representation });
            }
        });
    }
    /**
     * Function to be called when a program is to be interpreted using
     * the explicit control evaluator.
     *
     * @param program The program to evaluate.
     * @param context The context to evaluate the program in.
     * @param options Evaluation options.
     * @returns The result of running the CSE machine.
     */
    function evaluate(program, context, options = {}) {
        // TODO: should call transformer like in js-slang
        // seq.transform(program)
        try {
            context.runtime.isRunning = true;
            context.control = new Control(program);
            context.stash = new Stash();
            // Adaptation for new feature
            const result = runCSEMachine$1(context, context.control, context.stash, options.envSteps, options.stepLimit, options.isPrelude);
            const rep = { type: "string", value: cseFinalPrint };
            return rep;
        }
        catch (error) {
            context.errors.push(new CseError(error.message));
            return { type: 'error', message: error.message };
        }
        finally {
            context.runtime.isRunning = false;
        }
    }
    function evaluateImports(program, context) {
        try {
            const [importNodeMap] = filterImportDeclarations(program);
            const environment = currentEnvironment(context);
            for (const [moduleName, nodes] of importNodeMap) {
                const functions = context.nativeStorage.loadedModules[moduleName];
                for (const node of nodes) {
                    for (const spec of node.specifiers) {
                        declareIdentifier(context, spec.local.name, node, environment);
                        let obj;
                        switch (spec.type) {
                            case 'ImportSpecifier': {
                                if (spec.imported.type === 'Identifier') {
                                    obj = functions[spec.imported.name];
                                }
                                else {
                                    throw new Error(`Unexpected literal import: ${spec.imported.value}`);
                                }
                                //obj = functions[(spec.imported).name]
                                break;
                            }
                            case 'ImportDefaultSpecifier': {
                                obj = functions.default;
                                break;
                            }
                            case 'ImportNamespaceSpecifier': {
                                obj = functions;
                                break;
                            }
                        }
                        defineVariable(context, spec.local.name, obj, true, node);
                    }
                }
            }
        }
        catch (error) {
            handleRuntimeError(context, error);
        }
    }
    /**
     * The primary runner/loop of the explicit control evaluator.
     *
     * @param context The context to evaluate the program in.
     * @param control Points to the current Control stack.
     * @param stash Points to the current Stash.
     * @param envSteps Number of environment steps to run.
     * @param stepLimit Maximum number of steps to execute.
     * @param isPrelude Whether the program is the prelude.
     * @returns The top value of the stash after execution.
     */
    function runCSEMachine$1(context, control, stash, envSteps, stepLimit, isPrelude = false) {
        const eceState = generateCSEMachineStateStream(context, control, stash, envSteps, stepLimit, isPrelude);
        // Execute the generator until it completes
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const value of eceState) {
        }
        // Return the value at the top of the storage as the result
        const result = stash.peek();
        return result !== undefined ? result : { type: 'undefined' };
    }
    /**
     * Generator function that yields the state of the CSE Machine at each step.
     *
     * @param context The context of the program.
     * @param control The control stack.
     * @param stash The stash storage.
     * @param envSteps Number of environment steps to run.
     * @param stepLimit Maximum number of steps to execute.
     * @param isPrelude Whether the program is the prelude.
     * @yields The current state of the stash, control stack, and step count.
     */
    function* generateCSEMachineStateStream(context, control, stash, envSteps, stepLimit, isPrelude = false) {
        // steps: number of steps completed
        let steps = 0;
        let command = control.peek();
        // Push first node to be evaluated into context.
        // The typeguard is there to guarantee that we are pushing a node (which should always be the case)
        if (command && isNode(command)) {
            context.runtime.nodes.unshift(command);
        }
        while (command) {
            // For local debug only
            // console.info('next command to be evaluated');
            // console.info(command);
            // Return to capture a snapshot of the control and stash after the target step count is reached
            if (!isPrelude && steps === envSteps) {
                yield { stash, control, steps };
                return;
            }
            // Step limit reached, stop further evaluation
            if (!isPrelude && steps === stepLimit) {
                break;
            }
            if (!isPrelude && envChanging(command)) {
                // command is evaluated on the next step
                // Hence, next step will change the environment
                context.runtime.changepointSteps.push(steps + 1);
            }
            control.pop();
            if (isNode(command)) {
                context.runtime.nodes.shift();
                context.runtime.nodes.unshift(command);
                //checkEditorBreakpoints(context, command)
                cmdEvaluators[command.type](command, context, control, stash, isPrelude);
                if (context.runtime.break && context.runtime.debuggerOn) ;
            }
            else {
                // Command is an instruction
                cmdEvaluators[command.instrType](command, context, control, stash, isPrelude);
            }
            // Push undefined into the stack if both control and stash is empty
            if (control.isEmpty() && stash.isEmpty()) ;
            command = control.peek();
            steps += 1;
            if (!isPrelude) {
                context.runtime.envStepsTotal = steps;
            }
            // printEnvironmentVariables(context.runtime.environments);
            yield { stash, control, steps };
        }
    }
    const cmdEvaluators = {
        /**
         * AST Nodes
         */
        Program: function (command, context, control, stash, isPrelude) {
            // Clean up non-global, non-program, and non-preparation environments
            while (currentEnvironment(context).name !== 'global' &&
                currentEnvironment(context).name !== 'programEnvironment' &&
                currentEnvironment(context).name !== 'prelude') {
                popEnvironment(context);
            }
            if (hasDeclarations(command) || hasImportDeclarations(command)) {
                if (currentEnvironment(context).name != 'programEnvironment') {
                    const programEnv = createProgramEnvironment(context, isPrelude);
                    pushEnvironment(context, programEnv);
                }
                const environment = currentEnvironment(context);
                evaluateImports(command, context);
                declareFunctionsAndVariables(context, command, environment);
            }
            if (command.body.length === 1) {
                // If the program contains only a single statement, execute it immediately
                const next = command.body[0];
                cmdEvaluators[next.type](next, context, control, stash, isPrelude);
            }
            else {
                // Push the block body as a sequence of statements onto the control stack
                const seq = statementSequence(command.body, command.loc);
                control.push(seq);
            }
        },
        BlockStatement: function (command, context, control) {
            const next = control.peek();
            // for some of the block statements, such as if, for,
            // no need to create a new environment
            if (!command.skipEnv) {
                // If environment instructions need to be pushed
                if (next &&
                    !(isInstr(next) && next.instrType === InstrType.ENVIRONMENT) &&
                    !control.canAvoidEnvInstr()) {
                    control.push(envInstr(currentEnvironment(context), command));
                }
                // create new block environment (for function)
                const environment = createBlockEnvironment(context, 'blockEnvironment');
                declareFunctionsAndVariables(context, command, environment);
                pushEnvironment(context, environment);
            }
            // Push the block body onto the control stack as a sequence of statements
            const seq = statementSequence(command.body, command.loc);
            control.push(seq);
        },
        StatementSequence: function (command, context, control, stash, isPrelude) {
            if (command.body.length === 1) {
                // If the program contains only a single statement, execute it immediately
                const next = command.body[0];
                cmdEvaluators[next.type](next, context, control, stash, isPrelude);
            }
            else {
                // Split and push individual nodes
                control.push(...handleSequence(command.body));
            }
        },
        // WhileStatement: function (
        //   command: es.WhileStatement,
        //   context: Context,
        //   control: Control,
        //   stash: Stash
        // ) {
        //   if (hasBreakStatement(command.body as es.BlockStatement)) {
        //     control.push(instr.breakMarkerInstr(command));
        //   }
        //   control.push(instr.whileInstr(command.test, command.body, command));
        //   control.push(command.test);
        //   control.push(ast.identifier('undefined', command.loc)); // 如果没有循环执行，返回 undefined
        // },
        // ForStatement: function (
        //   command: es.ForStatement,
        //   context: Context,
        //   control: Control
        // ) {
        //   const init = command.init!;
        //   const test = command.test!;
        //   const update = command.update!;
        //   if (init.type === 'VariableDeclaration' && init.kind === 'let') {
        //     const id = init.declarations[0].id as es.Identifier;
        //     const valueExpression = init.declarations[0].init!;
        //     control.push(
        //       ast.blockStatement(
        //         [
        //           init,
        //           ast.forStatement(
        //             ast.assignmentExpression(id, valueExpression, command.loc),
        //             test,
        //             update,
        //             ast.blockStatement(
        //               [
        //                 ast.variableDeclaration(
        //                   [
        //                     ast.variableDeclarator(
        //                       ast.identifier(`_copy_of_${id.name}`, command.loc),
        //                       ast.identifier(id.name, command.loc),
        //                       command.loc
        //                     )
        //                   ],
        //                   command.loc
        //                 ),
        //                 ast.blockStatement(
        //                   [
        //                     ast.variableDeclaration(
        //                       [
        //                         ast.variableDeclarator(
        //                           ast.identifier(id.name, command.loc),
        //                           ast.identifier(`_copy_of_${id.name}`, command.loc),
        //                           command.loc
        //                         )
        //                       ],
        //                       command.loc
        //                     ),
        //                     command.body
        //                   ],
        //                   command.loc
        //                 )
        //               ],
        //               command.loc
        //             ),
        //             command.loc
        //           )
        //         ],
        //         command.loc
        //       )
        //     );
        //   } else {
        //     if (hasBreakStatement(command.body as es.BlockStatement)) {
        //       control.push(instr.breakMarkerInstr(command));
        //     }
        //     control.push(instr.forInstr(init, test, update, command.body, command));
        //     control.push(test);
        //     control.push(instr.popInstr(command)); // Pop value from init assignment
        //     control.push(init);
        //     control.push(ast.identifier('undefined', command.loc)); // Return undefined if there is no loop execution
        //   }
        // },
        IfStatement: function (command, //es.IfStatement,
        context, control, stash) {
            control.push(...reduceConditional(command));
        },
        ExpressionStatement: function (command, //es.ExpressionStatement,
        context, control, stash, isPrelude) {
            cmdEvaluators[command.expression.type](command.expression, context, control, stash, isPrelude);
        },
        // DebuggerStatement: function (
        //   command: es.DebuggerStatement,
        //   context: Context
        // ) {
        //   context.runtime.break = true;
        // },
        VariableDeclaration: function (command, context, control) {
            const declaration = command.declarations[0];
            const id = declaration.id;
            const init = declaration.init;
            control.push(popInstr(command));
            control.push(assmtInstr(id.name, command.kind === 'const', true, command));
            control.push(init);
        },
        FunctionDeclaration: function (command, //es.FunctionDeclaration,
        context, control) {
            const lambdaExpression = blockArrowFunction(command.params, command.body, command.loc);
            const lambdaDeclaration = constantDeclaration(command.id.name, lambdaExpression, command.loc);
            control.push(lambdaDeclaration);
        },
        ReturnStatement: function (command, //as es.ReturnStatement,
        context, control) {
            const next = control.peek();
            if (next && isInstr(next) && next.instrType === InstrType.MARKER) {
                control.pop();
            }
            else {
                control.push(resetInstr(command));
            }
            if (command.argument) {
                control.push(command.argument);
            }
        },
        // ContinueStatement: function (
        //   command: es.ContinueStatement,
        //   context: Context,
        //   control: Control,
        //   stash: Stash
        // ) {
        //   control.push(instr.contInstr(command));
        // },
        // BreakStatement: function (
        //   command: es.BreakStatement,
        //   context: Context,
        //   control: Control,
        //   stash: Stash
        // ) {
        //   control.push(instr.breakInstr(command));
        // },
        ImportDeclaration: function () { },
        /**
         * Expressions
         */
        Literal: function (command, //es.Literal
        context, control, stash) {
            const literalValue = command.value;
            const bigintValue = command.bigint;
            const complexValue = command.complex;
            if (literalValue !== undefined) {
                let value;
                if (typeof literalValue === 'number') {
                    value = { type: 'number', value: literalValue };
                }
                else if (typeof literalValue === 'string') {
                    value = { type: 'string', value: literalValue };
                }
                else if (typeof literalValue === 'boolean') {
                    value = { type: 'bool', value: literalValue };
                    //value = literalValue;
                }
                else {
                    //handleRuntimeError(context, new CseError('Unsupported literal type'));
                    return;
                }
                stash.push(value);
            }
            else if (bigintValue !== undefined) {
                let fixedBigintValue = bigintValue.toString().replace(/_/g, "");
                let value;
                try {
                    value = { type: 'bigint', value: BigInt(fixedBigintValue) };
                }
                catch (e) {
                    //handleRuntimeError(context, new CseError('Invalid BigInt literal'));
                    return;
                }
                stash.push(value);
            }
            else if (complexValue !== undefined) {
                let value;
                let pyComplexNumber = new PyComplexNumber(complexValue.real, complexValue.imag);
                try {
                    value = { type: 'complex', value: pyComplexNumber };
                }
                catch (e) {
                    //handleRuntimeError(context, new CseError('Invalid BigInt literal'));
                    return;
                }
                stash.push(value);
            }
            else ;
        },
        NoneType: function (command, //es.Literal
        context, control, stash) {
            stash.push({ type: 'NoneType', value: undefined });
        },
        // AssignmentExpression: function (
        //   command: es.AssignmentExpression,
        //   context: Context,
        //   control: Control
        // ) {
        //   if (command.left.type === 'MemberExpression') {
        //     control.push(instr.arrAssmtInstr(command));
        //     control.push(command.right);
        //     control.push(command.left.property);
        //     control.push(command.left.object);
        //   } else if (command.left.type === 'Identifier') {
        //     const id = command.left;
        //     control.push(instr.assmtInstr(id.name, false, false, command));
        //     control.push(command.right);
        //   }
        // },
        // ArrayExpression: function (
        //   command: es.ArrayExpression,
        //   context: Context,
        //   control: Control
        // ) {
        //   const elems = command.elements as es.Expression[];
        //   reverse(elems);
        //   const len = elems.length;
        //   control.push(instr.arrLitInstr(len, command));
        //   for (const elem of elems) {
        //     control.push(elem);
        //   }
        // },
        // MemberExpression: function (
        //   command: es.MemberExpression,
        //   context: Context,
        //   control: Control,
        //   stash: Stash
        // ) {
        //   control.push(instr.arrAccInstr(command));
        //   control.push(command.property);
        //   control.push(command.object);
        // },
        ConditionalExpression: function (command, //es.ConditionalExpression,
        context, control, stash) {
            control.push(...reduceConditional(command));
        },
        Identifier: function (command, //es.Identifier,
        context, control, stash) {
            if (builtInConstants.has(command.name)) {
                const builtinCons = builtInConstants.get(command.name);
                try {
                    stash.push(builtinCons);
                    return;
                }
                catch (error) {
                    // Error
                    if (error instanceof Error) {
                        throw new Error(error.message);
                    }
                    else {
                        throw new Error();
                    }
                    // if (error instanceof RuntimeSourceError) {
                    //   throw error;
                    // } else {
                    //   throw new RuntimeSourceError(`Error in builtin function ${funcName}: ${error}`);
                    // }
                }
            }
            else {
                stash.push(getVariable(context, command.name));
            }
        },
        UnaryExpression: function (command, //es.UnaryExpression,
        context, control) {
            control.push(unOpInstr(command.operator, command));
            control.push(command.argument);
        },
        BinaryExpression: function (command, //es.BinaryExpression,
        context, control) {
            // currently for if statement
            control.push(binOpInstr(command.operator, command));
            control.push(command.right);
            control.push(command.left);
        },
        LogicalExpression: function (command, //es.LogicalExpression,
        context, control) {
            if (command.operator === '&&') {
                control.push(conditionalExpression(command.left, command.right, literal(false), command.loc));
            }
            else {
                control.push(conditionalExpression(command.left, literal(true), command.right, command.loc));
            }
        },
        ArrowFunctionExpression: function (command, //es.ArrowFunctionExpression,
        context, control, stash, isPrelude) {
            const closure = Closure.makeFromArrowFunction(command, currentEnvironment(context), context, true, isPrelude);
            stash.push(closure);
        },
        CallExpression: function (command, //es.CallExpression,
        context, control) {
            // add
            if (isIdentifier(command.callee)) {
                let name = command.callee.name;
                if (name === '__py_adder' || name === '__py_minuser' ||
                    name === '__py_multiplier' || name === '__py_divider' ||
                    name === '__py_modder' || name === '__py_floorer' ||
                    name === '__py_powerer') {
                    control.push(binOpInstr(command.callee, command));
                    control.push(command.arguments[1]);
                    control.push(command.arguments[0]);
                    return;
                }
            }
            control.push(appInstr(command.arguments.length, command));
            for (let index = command.arguments.length - 1; index >= 0; index--) {
                control.push(command.arguments[index]);
            }
            control.push(command.callee);
        },
        // /**
        //  * Instructions
        //  */
        [InstrType.RESET]: function (command, //Instr,
        context, control, stash) {
            const cmdNext = control.pop();
            if (cmdNext && (isNode(cmdNext) || cmdNext.instrType !== InstrType.MARKER)) {
                control.push(resetInstr(command.srcNode));
            }
        },
        // [InstrType.WHILE]: function (
        //   command: WhileInstr,
        //   context: Context,
        //   control: Control,
        //   stash: Stash
        // ) {
        //   const test = stash.pop();
        //   const error = rttc.checkIfStatement(command.srcNode, test, context.chapter);
        //   if (error) {
        //     handleRuntimeError(context, error);
        //   }
        //   if (test) {
        //     control.push(command);
        //     control.push(command.test);
        //     if (hasContinueStatement(command.body as es.BlockStatement)) {
        //       control.push(instr.contMarkerInstr(command.srcNode));
        //     }
        //     if (!valueProducing(command.body)) {
        //       control.push(ast.identifier('undefined', command.body.loc));
        //     }
        //     control.push(command.body);
        //     control.push(instr.popInstr(command.srcNode)); // Pop previous body value
        //   }
        // },
        // [InstrType.FOR]: function (
        //   command: ForInstr,
        //   context: Context,
        //   control: Control,
        //   stash: Stash
        // ) {
        //   const test = stash.pop();
        //   const error = rttc.checkIfStatement(command.srcNode, test, context.chapter);
        //   if (error) {
        //     handleRuntimeError(context, error);
        //   }
        //   if (test) {
        //     control.push(command);
        //     control.push(command.test);
        //     control.push(instr.popInstr(command.srcNode)); // Pop value from update
        //     control.push(command.update);
        //     if (hasContinueStatement(command.body as es.BlockStatement)) {
        //       control.push(instr.contMarkerInstr(command.srcNode));
        //     }
        //     if (!valueProducing(command.body)) {
        //       control.push(ast.identifier('undefined', command.body.loc));
        //     }
        //     control.push(command.body);
        //     control.push(instr.popInstr(command.srcNode)); // Pop previous body value
        //   }
        // },
        [InstrType.ASSIGNMENT]: function (command, //AssmtInstr,
        context, control, stash) {
            if (command.declaration) {
                //if ()
                defineVariable(context, command.symbol, stash.peek(), command.constant, command.srcNode);
            }
        },
        [InstrType.UNARY_OP]: function (command, //UnOpInstr,
        context, control, stash) {
            const argument = stash.pop();
            // const error = rttc.checkUnaryExpression(
            //   command.srcNode,
            //   command.symbol as es.UnaryOperator,
            //   argument,
            //   context.chapter
            // );
            // if (error) {
            //   handleRuntimeError(context, error);
            // }
            stash.push(evaluateUnaryExpression(command.symbol, argument));
        },
        [InstrType.BINARY_OP]: function (command, //BinOpInstr,
        context, control, stash) {
            const right = stash.pop();
            const left = stash.pop();
            // const error = rttc.checkBinaryExpression(
            //   command.srcNode,
            //   command.symbol as es.BinaryOperator,
            //   context.chapter,
            //   left,
            //   right
            // );
            // if (error) {
            //   handleRuntimeError(context, error);
            // }
            if ((left.type === 'string' && right.type !== 'string') ||
                (left.type !== 'string' && right.type === 'string')) {
                handleRuntimeError(context, new TypeConcatenateError(command));
            }
            stash.push(evaluateBinaryExpression(context, command.symbol, left, right));
        },
        [InstrType.POP]: function (command, //Instr,
        context, control, stash) {
            stash.pop();
        },
        [InstrType.APPLICATION]: function (command, //AppInstr,
        context, control, stash) {
            var _a;
            const args = [];
            for (let index = 0; index < command.numOfArgs; index++) {
                args.unshift(stash.pop());
            }
            const func = stash.pop();
            // continuation in python?
            // func instanceof Closure
            if (func instanceof Closure) {
                // Check for number of arguments mismatch error
                checkNumberOfArguments(command, context, func, args, command.srcNode);
                const next = control.peek();
                // Push ENVIRONMENT instruction if needed - if next control stack item
                // exists and is not an environment instruction, OR the control only contains
                // environment indepedent items
                if (next &&
                    !(isInstr(next) && next.instrType === InstrType.ENVIRONMENT) &&
                    !control.canAvoidEnvInstr()) {
                    control.push(envInstr(currentEnvironment(context), command.srcNode));
                }
                // Create environment for function parameters if the function isn't nullary.
                // Name the environment if the function call expression is not anonymous
                if (args.length > 0) {
                    const environment = createEnvironment(context, func, args, command.srcNode);
                    pushEnvironment(context, environment);
                }
                else {
                    context.runtime.environments.unshift(func.environment);
                }
                // Handle special case if function is simple
                if (isSimpleFunction(func.node)) {
                    // Closures convert ArrowExpressionStatements to BlockStatements
                    const block = func.node.body;
                    const returnStatement = block.body[0];
                    control.push((_a = returnStatement.argument) !== null && _a !== void 0 ? _a : identifier('undefined', returnStatement.loc));
                }
                else {
                    if (control.peek()) {
                        // push marker if control not empty
                        control.push(markerInstr(command.srcNode));
                    }
                    control.push(func.node.body);
                    // console.info((func as Closure).node.body);
                }
                return;
            }
            // Value is a built-in function
            let function_name = command.srcNode.callee.name;
            if (builtIns.has(function_name)) {
                const builtinFunc = builtIns.get(function_name);
                try {
                    stash.push(builtinFunc(args));
                    return;
                }
                catch (error) {
                    // Error
                    if (error instanceof Error) {
                        throw new Error(error.message);
                    }
                    else {
                        throw new Error();
                    }
                    // if (error instanceof RuntimeSourceError) {
                    //   throw error;
                    // } else {
                    //   throw new RuntimeSourceError(`Error in builtin function ${funcName}: ${error}`);
                    // }
                }
            }
        },
        [InstrType.BRANCH]: function (command, //BranchInstr,
        context, control, stash) {
            const test = stash.pop();
            // const error = rttc.checkIfStatement(command.srcNode, test, context.chapter);
            // if (error) {
            //   handleRuntimeError(context, error);
            // }
            if (test.value) {
                if (!valueProducing(command.consequent)) {
                    control.push(identifier('undefined', command.consequent.loc));
                }
                command.consequent.skipEnv = true;
                control.push(command.consequent);
            }
            else if (command.alternate) {
                if (!valueProducing(command.alternate)) {
                    control.push(identifier('undefined', command.alternate.loc));
                }
                command.alternate.skipEnv = true;
                control.push(command.alternate);
            }
            else {
                control.push(identifier('undefined', command.srcNode.loc));
            }
        },
        [InstrType.ENVIRONMENT]: function (command, //EnvInstr,
        context) {
            while (currentEnvironment(context).id !== command.env.id) {
                popEnvironment(context);
            }
        },
        // [InstrType.ARRAY_LITERAL]: function (
        //   command: ArrLitInstr,
        //   context: Context,
        //   control: Control,
        //   stash: Stash
        // ) {
        //   const arity = command.arity;
        //   const array: any[] = [];
        //   for (let i = 0; i < arity; ++i) {
        //     array.unshift(stash.pop());
        //   }
        //   handleArrayCreation(context, array);
        //   stash.push(array);
        // },
        // [InstrType.ARRAY_ACCESS]: function (
        //   command: Instr,
        //   context: Context,
        //   control: Control,
        //   stash: Stash
        // ) {
        //   const index = stash.pop();
        //   const array = stash.pop();
        //   stash.push(array[index]);
        // },
        // [InstrType.ARRAY_ASSIGNMENT]: function (
        //   command: Instr,
        //   context: Context,
        //   control: Control,
        //   stash: Stash
        // ) {
        //   const value = stash.pop();
        //   const index = stash.pop();
        //   const array = stash.pop();
        //   array[index] = value;
        //   stash.push(value);
        // },
        // [InstrType.CONTINUE]: function (
        //   command: Instr,
        //   context: Context,
        //   control: Control,
        //   stash: Stash
        // ) {
        //   const next = control.pop() as ControlItem;
        //   if (isInstr(next) && next.instrType === InstrType.CONTINUE_MARKER) {
        //   } else if (isInstr(next) && next.instrType === InstrType.ENVIRONMENT) {
        //     control.push(command);
        //     control.push(next); 
        //   } else {
        //     control.push(command);
        //   }
        // },
        // [InstrType.CONTINUE_MARKER]: function () {
        // },
        // [InstrType.BREAK]: function (
        //   command: Instr,
        //   context: Context,
        //   control: Control,
        //   stash: Stash
        // ) {
        //   const next = control.pop() as ControlItem;
        //   if (isInstr(next) && next.instrType === InstrType.BREAK_MARKER) {
        //   } else if (isInstr(next) && next.instrType === InstrType.ENVIRONMENT) {
        //     control.push(command);
        //     control.push(next);
        //   } else {
        //     control.push(command);
        //   }
        // },
        // [InstrType.BREAK_MARKER]: function () {
        // }
    };

    // npm install mathjs
    /*
        Create a map to hold built-in constants.
        Each constant is stored with a string key and its corresponding value object.
    */
    const builtInConstants = new Map();
    const math_e = { type: 'number', value: Math.E };
    const math_inf = { type: 'number', value: Infinity };
    const math_nan = { type: 'number', value: NaN };
    const math_pi = { type: 'number', value: Math.PI };
    const math_tau = { type: 'number', value: 2 * Math.PI };
    builtInConstants.set('math_e', math_e);
    builtInConstants.set('math_inf', math_inf);
    builtInConstants.set('math_nan', math_nan);
    builtInConstants.set('math_pi', math_pi);
    builtInConstants.set('math_tau', math_tau);
    /*
        Create a map to hold built-in functions.
        The keys are strings (function names) and the values are functions that can take any arguments.
    */
    const builtIns = new Map();
    builtIns.set('_int', _int);
    builtIns.set('_int_from_string', _int_from_string);
    builtIns.set('abs', abs);
    builtIns.set('char_at', char_at);
    builtIns.set('error', error);
    builtIns.set('input', input);
    builtIns.set('isinstance', isinstance);
    builtIns.set('math_acos', math_acos);
    builtIns.set('math_acosh', math_acosh);
    builtIns.set('math_asin', math_asin);
    builtIns.set('math_asinh', math_asinh);
    builtIns.set('math_atan', math_atan);
    builtIns.set('math_atan2', math_atan2);
    builtIns.set('math_atanh', math_atanh);
    builtIns.set('math_cbrt', math_cbrt);
    builtIns.set('math_ceil', math_ceil);
    builtIns.set('math_comb', math_comb);
    builtIns.set('math_copysign', math_copysign);
    builtIns.set('math_cos', math_cos);
    builtIns.set('math_cosh', math_cosh);
    builtIns.set('math_degrees', math_degrees);
    builtIns.set('math_erf', math_erf);
    builtIns.set('math_erfc', math_erfc);
    builtIns.set('math_exp', math_exp);
    builtIns.set('math_exp2', math_exp2);
    builtIns.set('math_expm1', math_expm1);
    builtIns.set('math_fabs', math_fabs);
    builtIns.set('math_factorial', math_factorial);
    builtIns.set('math_floor', math_floor);
    builtIns.set('math_fma', math_fma);
    builtIns.set('math_fmod', math_fmod);
    builtIns.set('math_gamma', math_gamma);
    builtIns.set('math_lgamma', math_lgamma);
    builtIns.set('math_gcd', math_gcd);
    builtIns.set('math_isfinite', math_isfinite);
    builtIns.set('math_isinf', math_isinf);
    builtIns.set('math_isnan', math_isnan);
    builtIns.set('math_isqrt', math_isqrt);
    builtIns.set('math_lcm', math_lcm);
    builtIns.set('math_ldexp', math_ldexp);
    builtIns.set('math_log', math_log);
    builtIns.set('math_log10', math_log10);
    builtIns.set('math_log1p', math_log1p);
    builtIns.set('math_log2', math_log2);
    builtIns.set('math_nextafter', math_nextafter);
    builtIns.set('math_perm', math_perm);
    builtIns.set('math_pow', math_pow);
    builtIns.set('math_radians', math_radians);
    builtIns.set('math_remainder', math_remainder);
    builtIns.set('math_sin', math_sin);
    builtIns.set('math_sinh', math_sinh);
    builtIns.set('math_sqrt', math_sqrt);
    builtIns.set('math_tan', math_tan);
    builtIns.set('math_tanh', math_tanh);
    builtIns.set('math_trunc', math_trunc);
    builtIns.set('math_ulp', math_ulp);
    builtIns.set('max', max);
    builtIns.set('min', min);
    builtIns.set('print', print);
    builtIns.set('random_random', random_random);
    builtIns.set('round', round);
    builtIns.set('str', str);
    builtIns.set('time_time', time_time);
    function _int(args) {
        if (args.length === 0) {
            return { type: 'bigint', value: '0' };
        }
        if (args.length > 1) {
            throw new Error(`_int() expects at most 1 argument, but got ${args.length}`);
        }
        const arg = args[0];
        // If the value is a number, use Math.trunc to truncate toward zero.
        if (arg.type === 'number') {
            const truncated = Math.trunc(arg.value);
            return { type: 'bigint', value: BigInt(truncated) };
        }
        // If the value is a bigint, simply return the same value.
        if (arg.type === 'bigint') {
            return { type: 'bigint', value: arg.value };
        }
        throw new Error(`_int() expects a numeric argument (number or bigint), but got ${arg.type}`);
    }
    function _int_from_string(args) {
        if (args.length < 1) {
            throw new Error(`_int_from_string() expects at least 1 argument, but got 0`);
        }
        if (args.length > 2) {
            throw new Error(`_int_from_string() expects at most 2 arguments, but got ${args.length}`);
        }
        const strVal = args[0];
        if (strVal.type !== 'string') {
            throw new Error(`_int_from_string: first argument must be a string, got ${strVal.type}`);
        }
        let base = 10;
        if (args.length === 2) {
            // The second argument must be either a bigint or a number (it will be converted to a number for uniform processing).
            const baseVal = args[1];
            if (baseVal.type === 'bigint') {
                base = Number(baseVal.value);
            }
            else {
                throw new Error(`_int_from_string: second argument must be an integer (number or bigint), got ${baseVal.type}`);
            }
        }
        // base should be in between 2 and 36
        if (base < 2 || base > 36) {
            throw new Error(`_int_from_string: base must be in [2..36], got ${base}`);
        }
        let str = strVal.value;
        str = str.trim();
        str = str.replace(/_/g, '');
        // Parse the sign (determine if the value is positive or negative)
        let sign = BigInt(1);
        if (str.startsWith('+')) {
            str = str.slice(1);
        }
        else if (str.startsWith('-')) {
            sign = BigInt(-1);
            str = str.slice(1);
        }
        // The remaining portion must consist of valid characters for the specified base.
        const parsedNumber = parseInt(str, base);
        if (isNaN(parsedNumber)) {
            throw new Error(`_int_from_string: cannot parse "${strVal.value}" with base ${base}`);
        }
        const result = sign * BigInt(parsedNumber);
        return { type: 'bigint', value: result };
    }
    function abs(args) {
        if (args.length !== 1) {
            throw new Error(`abs expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        switch (x.type) {
            case 'bigint': {
                const intVal = x.value;
                const result = intVal < 0 ? -intVal : intVal;
                return { type: 'int', value: result };
            }
            case 'number': {
                return { type: 'number', value: Math.abs(x.value) };
            }
            case 'complex': {
                // Calculate the modulus (absolute value) of a complex number.
                const real = x.value.real;
                const imag = x.value.imag;
                const modulus = Math.sqrt(real * real + imag * imag);
                return { type: 'number', value: modulus };
            }
            default:
                throw new Error(`abs: unsupported type ${x.type}`);
        }
    }
    function toStr(val) {
        return String(val.value);
    }
    function error(args) {
        const output = "Error: " + args.map(arg => toStr(arg)).join(' ') + '\n';
        throw new Error(output);
    }
    function isinstance(args) {
        if (args.length !== 2) {
            throw new Error(`isinstance expects exactly 2 arguments, but got ${args.length}`);
        }
        const obj = args[0];
        const classinfo = args[1];
        let expectedType;
        if (classinfo.type === 'string') {
            switch (classinfo.value) {
                case 'int':
                    expectedType = 'bigint';
                    break;
                case 'float':
                    expectedType = 'number';
                    break;
                case 'string':
                    expectedType = 'string';
                    break;
                case 'bool':
                    expectedType = 'bool';
                    break;
                case 'complex':
                    expectedType = 'complex';
                    break;
                case 'NoneType':
                    expectedType = 'NoneType';
                    break;
                default:
                    throw new Error(`isinstance: unknown type '${classinfo.value}'`);
            }
        }
        else {
            // TODO: If the value is not in string format, additional handling can be added as needed.
            throw new Error(`isinstance: second argument must be a string representing a type, got ${classinfo.type}`);
        }
        const result = obj.type === expectedType;
        return { type: 'bool', value: result };
    }
    function math_acos(args) {
        if (args.length !== 1) {
            throw new Error(`math_acos expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type !== 'number' && x.type !== 'bigint') {
            throw new Error(`math_acos: argument must be a number, int, or bigint, but got ${x.type}`);
        }
        let num;
        if (x.type === 'number') {
            num = x.value;
        }
        else {
            num = Number(x.value);
        }
        if (num < -1 || num > 1) {
            throw new Error(`math_acos: argument must be in the interval [-1, 1], but got ${num}`);
        }
        const result = Math.acos(num);
        return { type: 'number', value: result };
    }
    function math_acosh(args) {
        if (args.length !== 1) {
            throw new Error(`math_acosh expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type !== 'number' && x.type !== 'bigint') {
            throw new Error(`math_acosh: argument must be a number, int, or bigint, but got ${x.type}`);
        }
        let num;
        if (x.type === 'number') {
            num = x.value;
        }
        else {
            num = Number(x.value);
        }
        if (num < 1) {
            throw new Error(`math_acosh: argument must be greater than or equal to 1, but got ${num}`);
        }
        const result = Math.acosh(num);
        return { type: 'number', value: result };
    }
    function math_asin(args) {
        if (args.length !== 1) {
            throw new Error(`math_asin expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type !== 'number' && x.type !== 'bigint') {
            throw new Error(`math_asin: argument must be a number, int, or bigint, but got ${x.type}`);
        }
        let num;
        if (x.type === 'number') {
            num = x.value;
        }
        else {
            num = Number(x.value);
        }
        if (num < -1 || num > 1) {
            throw new Error(`math_asin: argument must be in the interval [-1, 1], but got ${num}`);
        }
        const result = Math.asin(num);
        return { type: 'number', value: result };
    }
    function math_asinh(args) {
        if (args.length !== 1) {
            throw new Error(`math_asinh expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type !== 'number' && x.type !== 'bigint') {
            throw new Error(`math_asinh: argument must be a number, int, or bigint, but got ${x.type}`);
        }
        let num;
        if (x.type === 'number') {
            num = x.value;
        }
        else {
            num = Number(x.value);
        }
        const result = Math.asinh(num);
        return { type: 'number', value: result };
    }
    function math_atan(args) {
        if (args.length !== 1) {
            throw new Error(`math_atan expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type !== 'number' && x.type !== 'int' && x.type !== 'bigint') {
            throw new Error(`math_atan: argument must be a number, int, or bigint, but got ${x.type}`);
        }
        let num;
        if (x.type === 'number') {
            num = x.value;
        }
        else {
            num = Number(x.value);
        }
        const result = Math.atan(num);
        return { type: 'number', value: result };
    }
    function math_atan2(args) {
        if (args.length !== 2) {
            throw new Error(`math_atan2 expects exactly 2 arguments, but got ${args.length}`);
        }
        const y = args[0];
        const x = args[1];
        if ((y.type !== 'number' && y.type !== 'bigint') ||
            (x.type !== 'number' && x.type !== 'bigint')) {
            throw new Error(`math_atan2: both arguments must be a number, int, or bigint`);
        }
        let yNum, xNum;
        if (y.type === 'number') {
            yNum = y.value;
        }
        else {
            yNum = Number(y.value);
        }
        if (x.type === 'number') {
            xNum = x.value;
        }
        else {
            xNum = Number(x.value);
        }
        const result = Math.atan2(yNum, xNum);
        return { type: 'number', value: result };
    }
    function math_atanh(args) {
        if (args.length !== 1) {
            throw new Error(`math_atanh expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type !== 'number' && x.type !== 'bigint') {
            throw new Error(`math_atanh: argument must be a number, int, or bigint, but got ${x.type}`);
        }
        let num;
        if (x.type === 'number') {
            num = x.value;
        }
        else {
            num = Number(x.value);
        }
        if (num <= -1 || num >= 1) {
            throw new Error(`math_atanh: argument must be in the interval (-1, 1), but got ${num}`);
        }
        const result = Math.atanh(num);
        return { type: 'number', value: result };
    }
    function math_cos(args) {
        if (args.length !== 1) {
            throw new Error(`math_cos expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type !== 'number' && x.type !== 'bigint') {
            throw new Error(`math_cos: argument must be a number, int, or bigint, but got ${x.type}`);
        }
        let num;
        if (x.type === 'number') {
            num = x.value;
        }
        else {
            num = Number(x.value);
        }
        const result = Math.cos(num);
        return { type: 'number', value: result };
    }
    function math_cosh(args) {
        if (args.length !== 1) {
            throw new Error(`math_cosh expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type !== 'number' && x.type !== 'bigint') {
            throw new Error(`math_cosh: argument must be a number, int, or bigint, but got ${x.type}`);
        }
        let num;
        if (x.type === 'number') {
            num = x.value;
        }
        else {
            num = Number(x.value);
        }
        const result = Math.cosh(num);
        return { type: 'number', value: result };
    }
    function math_degrees(args) {
        if (args.length !== 1) {
            throw new Error(`math_degrees expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type !== 'number' && x.type !== 'bigint') {
            throw new Error(`math_degrees: argument must be a number, int, or bigint, but got ${x.type}`);
        }
        let num;
        if (x.type === 'number') {
            num = x.value;
        }
        else {
            num = Number(x.value);
        }
        const result = num * 180 / Math.PI;
        return { type: 'number', value: result };
    }
    function math_erf(args) {
        if (args.length !== 1) {
            throw new Error(`math_erf expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type !== 'number' && x.type !== 'bigint') {
            throw new Error(`math_erf: argument must be a number, int, or bigint, but got ${x.type}`);
        }
        let num;
        if (x.type === 'number') {
            num = x.value;
        }
        else {
            num = Number(x.value);
        }
        const erfnum = erf(num);
        return { type: 'number', value: erfnum };
    }
    function math_erfc(args) {
        if (args.length !== 1) {
            throw new Error(`math_erfc expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type !== 'number' && x.type !== 'bigint') {
            throw new Error(`math_erfc: argument must be a number, int, or bigint, but got ${x.type}`);
        }
        const erfc = 1 - math_erf(args[0]).value;
        return { type: 'number', value: erfc };
    }
    function char_at(args) {
        if (args.length !== 2) {
            throw new Error(`char_at expects exactly 2 arguments, but got ${args.length}`);
        }
        const s = args[0];
        const i = args[1];
        if (s.type !== 'string') {
            throw new Error(`char_at: first argument must be a string, but got ${typeof s}`);
        }
        if (i.type !== 'number' && i.type !== 'bigint') {
            throw new Error(`char_at: second argument must be a number, but got ${typeof i}`);
        }
        const index = i.value;
        return { type: 'string', value: (s.value)[index] };
    }
    function math_comb(args) {
        if (args.length !== 2) {
            throw new Error(`comb expects exactly 2 arguments, but got ${args.length}`);
        }
        const n = args[0];
        const k = args[1];
        if (n.type !== 'bigint' || k.type !== 'bigint') {
            throw new Error(`comb: both arguments must be 'bigint', but got n=${n.type}, k=${k.type}`);
        }
        const nVal = BigInt(n.value);
        const kVal = BigInt(k.value);
        if (nVal < 0 || kVal < 0) {
            throw new Error(`comb: n and k must be non-negative, got n=${nVal}, k=${kVal}`);
        }
        if (kVal > nVal) {
            return { type: 'bigint', value: BigInt(0) };
        }
        let result = BigInt(1);
        let kk = kVal > nVal - kVal ? nVal - kVal : kVal;
        for (let i = BigInt(0); i < kk; i++) {
            result = result * (nVal - i) / (i + BigInt(1));
        }
        return { type: 'bigint', value: result };
    }
    function math_factorial(args) {
        if (args.length !== 1) {
            throw new Error(`factorial expects exactly 1 argument, but got ${args.length}`);
        }
        const n = args[0];
        if (n.type !== 'bigint') {
            throw new Error(`factorial: argument must be an integer (bigint), but got ${n.type}`);
        }
        const nVal = BigInt(n.value);
        if (nVal < 0) {
            throw new Error(`factorial: argument must be non-negative, but got ${nVal}`);
        }
        // 0! = 1
        if (nVal === BigInt(0)) {
            return { type: 'bigint', value: BigInt(1) };
        }
        let result = BigInt(1);
        for (let i = BigInt(1); i <= nVal; i++) {
            result *= i;
        }
        return { type: 'bigint', value: result };
    }
    function math_gcd(args) {
        if (args.length === 0) {
            return { type: 'bigint', value: BigInt(0) };
        }
        const values = args.map((v, idx) => {
            if (v.type !== 'bigint') {
                throw new Error(`gcd: argument #${idx + 1} must be an integer (bigint), got ${v.type}`);
            }
            return BigInt(v.value);
        });
        const allZero = values.every(val => val === BigInt(0));
        if (allZero) {
            return { type: 'bigint', value: BigInt(0) };
        }
        let currentGcd = values[0] < 0 ? -values[0] : values[0];
        for (let i = 1; i < values.length; i++) {
            currentGcd = gcdOfTwo(currentGcd, values[i] < 0 ? -values[i] : values[i]);
            if (currentGcd === BigInt(1)) {
                break;
            }
        }
        return { type: 'bigint', value: currentGcd };
    }
    function gcdOfTwo(a, b) {
        let x = a;
        let y = b;
        while (y !== BigInt(0)) {
            const temp = x % y;
            x = y;
            y = temp;
        }
        return x < 0 ? -x : x;
    }
    function math_isqrt(args) {
        if (args.length !== 1) {
            throw new Error(`isqrt expects exactly 1 argument, but got ${args.length}`);
        }
        const nValObj = args[0];
        if (nValObj.type !== 'bigint') {
            throw new Error(`isqrt: argument must be a nonnegative integer (bigint), but got ${nValObj.type}`);
        }
        const n = nValObj.value;
        if (n < 0) {
            throw new Error(`isqrt: argument must be nonnegative, but got ${n}`);
        }
        if (n < 2) {
            return { type: 'bigint', value: n };
        }
        let low = BigInt(1);
        let high = n;
        while (low < high) {
            const mid = (low + high + BigInt(1)) >> BigInt(1);
            const sq = mid * mid;
            if (sq <= n) {
                low = mid;
            }
            else {
                high = mid - BigInt(1);
            }
        }
        return { type: 'bigint', value: low };
    }
    function math_lcm(args) {
        if (args.length === 0) {
            return { type: 'bigint', value: BigInt(1) };
        }
        const values = args.map((val, idx) => {
            if (val.type !== 'bigint') {
                throw new Error(`lcm: argument #${idx + 1} must be a bigint, got ${val.type}`);
            }
            return BigInt(val.value);
        });
        if (values.some(v => v === BigInt(0))) {
            return { type: 'bigint', value: BigInt(0) };
        }
        let currentLcm = absBigInt(values[0]);
        for (let i = 1; i < values.length; i++) {
            currentLcm = lcmOfTwo(currentLcm, absBigInt(values[i]));
            if (currentLcm === BigInt(0)) {
                break;
            }
        }
        return { type: 'bigint', value: currentLcm };
    }
    function lcmOfTwo(a, b) {
        const gcdVal = gcdOfTwo(a, b);
        return BigInt((a / gcdVal) * b);
    }
    function absBigInt(x) {
        return x < 0 ? -x : x;
    }
    function math_perm(args) {
        if (args.length < 1 || args.length > 2) {
            throw new Error(`perm expects 1 or 2 arguments, but got ${args.length}`);
        }
        const nValObj = args[0];
        if (nValObj.type !== 'bigint') {
            throw new Error(`perm: first argument n must be an integer (bigint), but got ${nValObj.type}`);
        }
        const n = BigInt(nValObj.value);
        let k = n;
        if (args.length === 2) {
            const kValObj = args[1];
            if (kValObj.type === 'null' || kValObj.type === 'undefined') {
                k = n;
            }
            else if (kValObj.type === 'bigint') {
                k = BigInt(kValObj.value);
            }
            else {
                throw new Error(`perm: second argument k must be an integer (bigint) or None, but got ${kValObj.type}`);
            }
        }
        if (n < 0 || k < 0) {
            throw new Error(`perm: n and k must be non-negative, got n=${n}, k=${k}`);
        }
        if (k > n) {
            return { type: 'bigint', value: BigInt(0) };
        }
        let result = BigInt(1);
        for (let i = BigInt(0); i < k; i++) {
            result *= (n - i);
        }
        return { type: 'bigint', value: result };
    }
    function math_ceil(args) {
        if (args.length !== 1) {
            throw new Error(`ceil expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type === 'bigint') {
            return x;
        }
        if (x.type === 'number') {
            const numVal = x.value;
            if (typeof numVal !== 'number') {
                throw new Error(`ceil: value must be a JavaScript number, got ${typeof numVal}`);
            }
            const ceiled = BigInt(Math.ceil(numVal));
            return { type: 'bigint', value: ceiled };
        }
        throw new Error(`ceil: unsupported type '${x.type}'. If simulating Python, implement x.__ceil__.`);
    }
    function math_fabs(args) {
        if (args.length !== 1) {
            throw new Error(`fabs expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type === 'bigint') {
            const bigVal = BigInt(x.value);
            const absVal = bigVal < 0 ? -Number(bigVal) : Number(bigVal);
            return { type: 'number', value: absVal };
        }
        if (x.type === 'number') {
            const numVal = x.value;
            if (typeof numVal !== 'number') {
                throw new Error(`fabs: expected a JavaScript number, got ${typeof numVal}`);
            }
            const absVal = Math.abs(numVal);
            return { type: 'number', value: absVal };
        }
        throw new Error(`fabs: unsupported type '${x.type}'. Implement x.__abs__ if needed.`);
    }
    function math_floor(args) {
        if (args.length !== 1) {
            throw new Error(`floor expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type === 'bigint') {
            return x;
        }
        if (x.type === 'number') {
            const numVal = x.value;
            if (typeof numVal !== 'number') {
                throw new Error(`floor: expected a JavaScript number, got ${typeof numVal}`);
            }
            const floored = BigInt(Math.floor(numVal));
            return { type: 'bigint', value: floored };
        }
        throw new Error(`floor: unsupported type '${x.type}'. Implement x.__floor__ if needed.`);
    }
    // Computes the product of a and b along with the rounding error using Dekker's algorithm.
    function twoProd(a, b) {
        const prod = a * b;
        const c = 134217729; // 2^27 + 1
        const a_hi = (a * c) - ((a * c) - a);
        const a_lo = a - a_hi;
        const b_hi = (b * c) - ((b * c) - b);
        const b_lo = b - b_hi;
        const err = a_lo * b_lo - (((prod - a_hi * b_hi) - a_lo * b_hi) - a_hi * b_lo);
        return { prod, err };
    }
    // Computes the sum of a and b along with the rounding error using Fast TwoSum.
    function twoSum(a, b) {
        const sum = a + b;
        const v = sum - a;
        const err = (a - (sum - v)) + (b - v);
        return { sum, err };
    }
    // Performs a fused multiply-add operation: computes (x * y) + z with a single rounding.
    function fusedMultiplyAdd(x, y, z) {
        const { prod, err: prodErr } = twoProd(x, y);
        const { sum, err: sumErr } = twoSum(prod, z);
        const result = sum + (prodErr + sumErr);
        return result;
    }
    function toNumber(val) {
        if (val.type === 'bigint') {
            return Number(val.value);
        }
        else if (val.type === 'number') {
            return val.value;
        }
        else {
            throw new Error(`unsupported type '${val.type}'`);
        }
    }
    function math_fma(args) {
        if (args.length !== 3) {
            throw new Error(`fma expects exactly 3 arguments, but got ${args.length}`);
        }
        const xVal = toNumber(args[0]);
        const yVal = toNumber(args[1]);
        const zVal = toNumber(args[2]);
        // Special-case handling: According to the IEEE 754 standard, fma(0, inf, nan)
        // and fma(inf, 0, nan) should return NaN.
        if (isNaN(xVal) || isNaN(yVal) || isNaN(zVal)) {
            return { type: 'number', value: NaN };
        }
        if (xVal === 0 && !isFinite(yVal) && isNaN(zVal)) {
            return { type: 'number', value: NaN };
        }
        if (yVal === 0 && !isFinite(xVal) && isNaN(zVal)) {
            return { type: 'number', value: NaN };
        }
        const result = fusedMultiplyAdd(xVal, yVal, zVal);
        return { type: 'number', value: result };
    }
    function math_fmod(args) {
        if (args.length !== 2) {
            throw new Error(`fmod expects exactly 2 arguments, but got ${args.length}`);
        }
        // Convert inputs to numbers
        const xVal = toNumber(args[0]);
        const yVal = toNumber(args[1]);
        // Divisor cannot be zero
        if (yVal === 0) {
            throw new Error("fmod: divisor (y) must not be zero");
        }
        // JavaScript's % operator behaves similarly to C's fmod
        // in that the sign of the result is the same as the sign of x.
        // For corner cases (NaN, Infinity), JavaScript remainder
        // yields results consistent with typical C library fmod behavior.
        const remainder = xVal % yVal;
        return { type: 'number', value: remainder };
    }
    function roundToEven(num) {
        const floorVal = Math.floor(num);
        const ceilVal = Math.ceil(num);
        const diffFloor = num - floorVal;
        const diffCeil = ceilVal - num;
        if (diffFloor < diffCeil) {
            return floorVal;
        }
        else if (diffCeil < diffFloor) {
            return ceilVal;
        }
        else {
            return (floorVal % 2 === 0) ? floorVal : ceilVal;
        }
    }
    function math_remainder(args) {
        if (args.length !== 2) {
            throw new Error(`remainder expects exactly 2 arguments, but got ${args.length}`);
        }
        const x = args[0];
        const y = args[1];
        let xValue;
        if (x.type === 'bigint') {
            xValue = Number(x.value);
        }
        else if (x.type === 'number') {
            xValue = x.value;
        }
        else {
            throw new Error(`remainder: unsupported type '${x.type}' for first argument`);
        }
        let yValue;
        if (y.type === 'bigint') {
            yValue = Number(y.value);
        }
        else if (y.type === 'number') {
            yValue = y.value;
        }
        else {
            throw new Error(`remainder: unsupported type '${y.type}' for second argument`);
        }
        if (yValue === 0) {
            throw new Error(`remainder: divisor y must not be zero`);
        }
        const quotient = xValue / yValue;
        const n = roundToEven(quotient);
        const remainder = xValue - n * yValue;
        return { type: 'number', value: remainder };
    }
    function math_trunc(args) {
        if (args.length !== 1) {
            throw new Error(`trunc expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type === 'bigint') {
            return x;
        }
        if (x.type === 'number') {
            const numVal = x.value;
            if (typeof numVal !== 'number') {
                throw new Error(`trunc: argument must be a number, got ${typeof numVal}`);
            }
            let truncated;
            if (numVal === 0) {
                truncated = 0;
            }
            else if (numVal < 0) {
                truncated = Math.ceil(numVal);
            }
            else {
                truncated = Math.floor(numVal);
            }
            return { type: 'bigint', value: BigInt(truncated) };
        }
        throw new Error(`trunc: unsupported type '${x.type}'. Implement x.__trunc__ if needed.`);
    }
    function math_copysign(args) {
        if (args.length !== 2) {
            throw new Error(`copysign expects exactly 2 arguments, but got ${args.length}`);
        }
        const [x, y] = args;
        if ((x.type !== 'number' && x.type !== 'bigint') ||
            (y.type !== 'number' && y.type !== 'bigint')) {
            throw new Error(`copysign: both x and y must be of type 'number'`);
        }
        const xVal = Number(x.value);
        const yVal = Number(y.value);
        const absVal = Math.abs(xVal);
        const isNegative = yVal < 0 || (Object.is(yVal, -0));
        const result = isNegative ? -absVal : absVal;
        return { type: 'number', value: Number(result) };
    }
    function math_isfinite(args) {
        if (args.length !== 1) {
            throw new Error(`isfinite expects exactly 1 argument, but got ${args.length}`);
        }
        const xValObj = args[0];
        if (xValObj.type !== 'number') {
            throw new Error(`isfinite: argument must be 'number', got '${xValObj.type}'`);
        }
        const x = xValObj.value;
        const result = Number.isFinite(x);
        return { type: 'bool', value: result };
    }
    function math_isinf(args) {
        if (args.length !== 1) {
            throw new Error(`isinf expects exactly 1 argument, but got ${args.length}`);
        }
        const xValObj = args[0];
        if (xValObj.type !== 'number') {
            throw new Error(`isinf: argument must be 'number', got '${xValObj.type}'`);
        }
        const x = xValObj.value;
        const result = (x === Infinity || x === -Infinity);
        return { type: 'bool', value: result };
    }
    function math_isnan(args) {
        if (args.length !== 1) {
            throw new Error(`isnan expects exactly 1 argument, but got ${args.length}`);
        }
        const xValObj = args[0];
        if (xValObj.type !== 'number') {
            throw new Error(`isnan: argument must be 'number', got '${xValObj.type}'`);
        }
        const x = xValObj.value;
        const result = Number.isNaN(x);
        return { type: 'bool', value: result };
    }
    function math_ldexp(args) {
        if (args.length !== 2) {
            throw new Error(`ldexp expects exactly 2 arguments, but got ${args.length}`);
        }
        const xVal = toNumber(args[0]);
        if (args[1].type !== 'bigint') {
            throw new Error(`ldexp: argument must be 'int', got '${args[1].type}'`);
        }
        const expVal = args[1].value;
        // Perform x * 2^expVal
        // In JavaScript, 2**expVal may overflow or underflow, yielding Infinity or 0 respectively.
        // That behavior parallels typical C library rules for ldexp.
        const result = xVal * Math.pow(2, Number(expVal));
        return { type: 'number', value: result };
    }
    function math_nextafter(args) {
        // TODO: Implement math_nextafter using proper bit-level manipulation and handling special cases (NaN, Infinity, steps, etc.)
        throw new Error("math_nextafter not implemented");
    }
    function math_ulp(args) {
        // TODO: Implement math_ulp to return the unit in the last place (ULP) of the given floating-point number.
        throw new Error("math_ulp not implemented");
    }
    function math_cbrt(args) {
        if (args.length !== 1) {
            throw new Error(`math_cbrt expects exactly 1 argument, but got ${args.length}`);
        }
        const xVal = args[0];
        let x;
        if (xVal.type !== 'number') {
            if (xVal.type === 'bigint') {
                x = Number(xVal.value);
            }
            else {
                throw new Error(`math_cbrt: argument must be a number, got ${xVal.type}`);
            }
        }
        else {
            x = xVal.value;
        }
        const result = Math.cbrt(x);
        return { type: 'number', value: result };
    }
    function math_exp(args) {
        if (args.length !== 1) {
            throw new Error(`math_exp expects exactly 1 argument, but got ${args.length}`);
        }
        const xVal = args[0];
        let x;
        if (xVal.type !== 'number') {
            if (xVal.type === 'bigint') {
                x = Number(xVal.value);
            }
            else {
                throw new Error(`math_cbrt: argument must be a number, got ${xVal.type}`);
            }
        }
        else {
            x = xVal.value;
        }
        const result = Math.exp(x);
        return { type: 'number', value: result };
    }
    function math_exp2(args) {
        if (args.length !== 1) {
            throw new Error(`math_exp2 expects exactly 1 argument, but got ${args.length}`);
        }
        const xVal = args[0];
        let x;
        if (xVal.type !== 'number') {
            if (xVal.type === 'bigint') {
                x = Number(xVal.value);
            }
            else {
                throw new Error(`math_cbrt: argument must be a number, got ${xVal.type}`);
            }
        }
        else {
            x = xVal.value;
        }
        const result = Math.pow(2, x);
        return { type: 'number', value: result };
    }
    function math_expm1(args) {
        if (args.length !== 1) {
            throw new Error(`math_expm1 expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type !== 'number' && x.type !== 'bigint') {
            throw new Error(`math_expm1: argument must be a number, int, or bigint, but got ${x.type}`);
        }
        let num;
        if (x.type === 'number') {
            num = x.value;
        }
        else {
            num = Number(x.value);
        }
        const result = Math.expm1(num);
        return { type: 'number', value: result };
    }
    function math_gamma(args) {
        if (args.length !== 1) {
            throw new Error(`gamma expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type !== 'number' && x.type !== 'bigint') {
            throw new Error(`gamma: argument must be a number, int, or bigint, but got ${x.type}`);
        }
        const z = toNumber(x);
        const result = gamma(z);
        return { type: 'number', value: result };
    }
    function math_lgamma(args) {
        if (args.length !== 1) {
            throw new Error(`gamma expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type !== 'number' && x.type !== 'bigint') {
            throw new Error(`gamma: argument must be a number, int, or bigint, but got ${x.type}`);
        }
        const z = toNumber(x);
        const result = lgamma(z);
        return { type: 'number', value: result };
    }
    function math_log(args) {
        if (args.length < 1 || args.length > 2) {
            throw new Error(`math_log expects 1 or 2 arguments, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type !== 'number' && x.type !== 'bigint') {
            throw new Error(`math_log: first argument must be a number, int, or bigint, but got ${x.type}`);
        }
        let num;
        if (x.type === 'number') {
            num = x.value;
        }
        else {
            num = Number(x.value);
        }
        if (num <= 0) {
            throw new Error(`math_log: argument must be positive, but got ${num}`);
        }
        if (args.length === 1) {
            return { type: 'number', value: Math.log(num) };
        }
        const baseArg = args[1];
        if (baseArg.type !== 'number' && baseArg.type !== 'int' && baseArg.type !== 'bigint') {
            throw new Error(`math_log: base argument must be a number, int, or bigint, but got ${baseArg.type}`);
        }
        let baseNum;
        if (baseArg.type === 'number') {
            baseNum = baseArg.value;
        }
        else {
            baseNum = Number(baseArg.value);
        }
        if (baseNum <= 0) {
            throw new Error(`math_log: base must be positive, but got ${baseNum}`);
        }
        const result = Math.log(num) / Math.log(baseNum);
        return { type: 'number', value: result };
    }
    function math_log10(args) {
        if (args.length !== 1) {
            throw new Error(`math_log10 expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type !== 'number' && x.type !== 'bigint') {
            throw new Error(`math_log10: argument must be a number, int, or bigint, but got ${x.type}`);
        }
        let num;
        if (x.type === 'number') {
            num = x.value;
        }
        else {
            num = Number(x.value);
        }
        if (num <= 0) {
            throw new Error(`math_log10: argument must be positive, but got ${num}`);
        }
        const result = Math.log10(num);
        return { type: 'number', value: result };
    }
    function math_log1p(args) {
        if (args.length !== 1) {
            throw new Error(`math_log1p expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type !== 'number' && x.type !== 'bigint') {
            throw new Error(`math_log1p: argument must be a number, int, or bigint, but got ${x.type}`);
        }
        let num;
        if (x.type === 'number') {
            num = x.value;
        }
        else {
            num = Number(x.value);
        }
        if (1 + num <= 0) {
            throw new Error(`math_log1p: 1 + argument must be positive, but got 1 + ${num} = ${1 + num}`);
        }
        const result = Math.log1p(num);
        return { type: 'number', value: result };
    }
    function math_log2(args) {
        if (args.length !== 1) {
            throw new Error(`math_log2 expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type !== 'number' && x.type !== 'bigint') {
            throw new Error(`math_log2: argument must be a number, int, or bigint, but got ${x.type}`);
        }
        let num;
        if (x.type === 'number') {
            num = x.value;
        }
        else {
            num = Number(x.value);
        }
        if (num <= 0) {
            throw new Error(`math_log2: argument must be positive, but got ${num}`);
        }
        const result = Math.log2(num);
        return { type: 'number', value: result };
    }
    function math_pow(args) {
        if (args.length !== 2) {
            throw new Error(`math_pow expects exactly 2 arguments, but got ${args.length}`);
        }
        const base = args[0];
        const exp = args[1];
        if ((base.type !== 'number' && base.type !== 'bigint') ||
            (exp.type !== 'number' && exp.type !== 'bigint')) {
            throw new Error(`math_pow: both arguments must be a number or bigint`);
        }
        let baseNum;
        if (base.type === 'number') {
            baseNum = base.value;
        }
        else { // 'bigint'
            baseNum = Number(base.value);
        }
        let expNum;
        if (exp.type === 'number') {
            expNum = exp.value;
        }
        else {
            expNum = Number(exp.value);
        }
        const result = Math.pow(baseNum, expNum);
        return { type: 'number', value: result };
    }
    function math_radians(args) {
        if (args.length !== 1) {
            throw new Error(`math_radians expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type !== 'number' && x.type !== 'bigint') {
            throw new Error(`math_radians: argument must be a number, int, or bigint, but got ${x.type}`);
        }
        let deg;
        if (x.type === 'number') {
            deg = x.value;
        }
        else {
            deg = Number(x.value);
        }
        const radians = deg * Math.PI / 180;
        return { type: 'number', value: radians };
    }
    function math_sin(args) {
        if (args.length !== 1) {
            throw new Error(`math_sin expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type !== 'number' && x.type !== 'bigint') {
            throw new Error(`math_sin: argument must be a number, int, or bigint, but got ${x.type}`);
        }
        let num;
        if (x.type === 'number') {
            num = x.value;
        }
        else {
            num = Number(x.value);
        }
        const result = Math.sin(num);
        return { type: 'number', value: result };
    }
    function math_sinh(args) {
        if (args.length !== 1) {
            throw new Error(`math_sinh expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type !== 'number' && x.type !== 'bigint') {
            throw new Error(`math_sinh: argument must be a number, int, or bigint, but got ${x.type}`);
        }
        let num;
        if (x.type === 'number') {
            num = x.value;
        }
        else {
            num = Number(x.value);
        }
        const result = Math.sinh(num);
        return { type: 'number', value: result };
    }
    function math_tan(args) {
        if (args.length !== 1) {
            throw new Error(`math_tan expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type !== 'number' && x.type !== 'bigint') {
            throw new Error(`math_tan: argument must be a number, int, or bigint, but got ${x.type}`);
        }
        let num;
        if (x.type === 'number') {
            num = x.value;
        }
        else {
            num = Number(x.value);
        }
        const result = Math.tan(num);
        return { type: 'number', value: result };
    }
    function math_tanh(args) {
        if (args.length !== 1) {
            throw new Error(`math_tanh expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type !== 'number' && x.type !== 'bigint') {
            throw new Error(`math_tanh: argument must be a number, int, or bigint, but got ${x.type}`);
        }
        let num;
        if (x.type === 'number') {
            num = x.value;
        }
        else {
            num = Number(x.value);
        }
        const result = Math.tanh(num);
        return { type: 'number', value: result };
    }
    function math_sqrt(args) {
        if (args.length !== 1) {
            throw new Error(`math_sqrt expects exactly 1 argument, but got ${args.length}`);
        }
        const x = args[0];
        if (x.type !== 'number' && x.type !== 'int' && x.type !== 'bigint') {
            throw new Error(`math_sqrt: argument must be a number, int, or bigint, but got ${x.type}`);
        }
        let num;
        if (x.type === 'number') {
            num = x.value;
        }
        else {
            num = Number(x.value);
        }
        if (num < 0) {
            throw new Error(`math_sqrt: argument must be non-negative, but got ${num}`);
        }
        const result = Math.sqrt(num);
        return { type: 'number', value: result };
    }
    function max(args) {
        if (args.length < 2) {
            throw new Error(`max expects at least 2 arguments, but got ${args.length}`);
        }
        const numericTypes = ['bigint', 'number'];
        const firstType = args[0].type;
        let isNumeric = numericTypes.includes(firstType);
        let isString = firstType === 'string';
        for (let i = 1; i < args.length; i++) {
            const t = args[i].type;
            if (isNumeric && !numericTypes.includes(t)) {
                throw new Error(`max: all arguments must be mutually comparable (all numeric or all string)`);
            }
            if (isString && t !== 'string') {
                throw new Error(`max: all arguments must be mutually comparable (all numeric or all string)`);
            }
        }
        let useFloat = false;
        if (isNumeric) {
            for (const arg of args) {
                if (arg.type === 'number') {
                    useFloat = true;
                    break;
                }
            }
        }
        let maxIndex = 0;
        if (isNumeric) {
            if (useFloat) {
                let maxVal = Number(args[0].value);
                for (let i = 1; i < args.length; i++) {
                    const curr = Number(args[i].value);
                    if (curr > maxVal) {
                        maxVal = curr;
                        maxIndex = i;
                    }
                }
            }
            else {
                let maxVal = args[0].value;
                for (let i = 1; i < args.length; i++) {
                    const curr = args[i].value;
                    if (curr > maxVal) {
                        maxVal = curr;
                        maxIndex = i;
                    }
                }
            }
        }
        else if (isString) {
            let maxVal = args[0].value;
            for (let i = 1; i < args.length; i++) {
                const curr = args[i].value;
                if (curr > maxVal) {
                    maxVal = curr;
                    maxIndex = i;
                }
            }
        }
        else {
            throw new Error(`max: unsupported type ${firstType}`);
        }
        return args[maxIndex];
    }
    function min(args) {
        if (args.length < 2) {
            throw new Error(`min expects at least 2 arguments, but got ${args.length}`);
        }
        const numericTypes = ['bigint', 'number'];
        const firstType = args[0].type;
        let isNumeric = numericTypes.includes(firstType);
        let isString = firstType === 'string';
        for (let i = 1; i < args.length; i++) {
            const t = args[i].type;
            if (isNumeric && !numericTypes.includes(t)) {
                throw new Error(`min: all arguments must be mutually comparable (all numeric or all string)`);
            }
            if (isString && t !== 'string') {
                throw new Error(`min: all arguments must be mutually comparable (all numeric or all string)`);
            }
        }
        let useFloat = false;
        if (isNumeric) {
            for (const arg of args) {
                if (arg.type === 'number') {
                    useFloat = true;
                    break;
                }
            }
        }
        let maxIndex = 0;
        if (isNumeric) {
            if (useFloat) {
                let maxVal = Number(args[0].value);
                for (let i = 1; i < args.length; i++) {
                    const curr = Number(args[i].value);
                    if (curr < maxVal) {
                        maxVal = curr;
                        maxIndex = i;
                    }
                }
            }
            else {
                let maxVal = args[0].value;
                for (let i = 1; i < args.length; i++) {
                    const curr = args[i].value;
                    if (curr < maxVal) {
                        maxVal = curr;
                        maxIndex = i;
                    }
                }
            }
        }
        else if (isString) {
            let maxVal = args[0].value;
            for (let i = 1; i < args.length; i++) {
                const curr = args[i].value;
                if (curr < maxVal) {
                    maxVal = curr;
                    maxIndex = i;
                }
            }
        }
        else {
            throw new Error(`min: unsupported type ${firstType}`);
        }
        return args[maxIndex];
    }
    function random_random(args) {
        if (args.length !== 0) {
            throw new Error(`random_random expects exactly 0 arguments, but got ${args.length}`);
        }
        const result = Math.random();
        return { type: 'number', value: result };
    }
    function round(args) {
        if (args.length < 1 || args.length > 2) {
            throw new Error(`round expects 1 or 2 arguments, but got ${args.length}`);
        }
        const numArg = args[0];
        if (numArg.type !== 'number' && numArg.type !== 'bigint') {
            throw new Error(`round: first argument must be a number, int, or bigint, but got ${numArg.type}`);
        }
        let ndigitsArg = { value: BigInt(0) };
        if (args.length === 2 && args[1].type !== 'NoneType') {
            ndigitsArg = args[1];
        }
        if (numArg.type === 'number') {
            let numberValue = numArg.value;
            if (ndigitsArg.value > 0) {
                const shifted = Number(numberValue.toFixed(Number(ndigitsArg.value)));
                return { type: 'number', value: shifted };
            }
            else if (ndigitsArg.value === BigInt(0)) {
                const shifted = Math.round(numArg.value);
                return { type: 'bigint', value: BigInt(shifted) };
            }
            else {
                const shifted = Math.round(numArg.value / (10 ** (-Number(ndigitsArg.value)))) * (10 ** (-Number(ndigitsArg.value)));
                return { type: 'number', value: shifted };
            }
        }
        else {
            if (ndigitsArg.value >= 0) {
                return numArg;
            }
            else {
                const shifted = numArg.value / (BigInt(10) ** (-ndigitsArg.value)) * (BigInt(10) ** (-ndigitsArg.value));
                return { type: 'bigint', value: shifted };
            }
        }
    }
    function time_time(args) {
        if (args.length !== 0) {
            throw new Error(`time_time expects 0 arguments, but got ${args.length}`);
        }
        const currentTime = Date.now();
        return { type: 'number', value: currentTime };
    }
    function toPythonFloat(num) {
        //num = Number(num);
        //console.info(typeof(num));
        if (Object.is(num, -0)) {
            return "-0.0";
        }
        if (num === 0) {
            return "0.0";
        }
        if (num === Infinity) {
            return "inf";
        }
        if (num === -Infinity) {
            return "-inf";
        }
        if (Number.isNaN(num)) {
            return "nan";
        }
        if (Math.abs(num) >= 1e16 || (num !== 0 && Math.abs(num) < 1e-4)) {
            return num.toExponential().replace(/e([+-])(\d)$/, 'e$10$2');
        }
        if (Number.isInteger(num)) {
            return num.toFixed(1).toString();
        }
        return num.toString();
    }
    function toPythonString(obj) {
        let ret;
        if (obj.type === 'bigint' || obj.type === 'complex') {
            ret = obj.value.toString();
        }
        else if (obj.type === 'number') {
            ret = toPythonFloat(obj.value);
        }
        else if (obj.type === 'bool') {
            if (obj.value === true) {
                return "True";
            }
            else {
                return "False";
            }
        }
        else if (obj.type === 'error') {
            return obj.message;
        }
        else if (obj.node) {
            for (let name in obj.environment.head) {
                if (obj.environment.head[name] === obj) {
                    return '<function ' + name + '>';
                }
            }
        }
        else if (obj === undefined || obj.value === undefined) {
            ret = 'None';
        }
        else {
            ret = obj.value.toString();
        }
        return ret;
    }
    function str(args) {
        if (args.length === 0) {
            return { type: 'string', value: "" };
        }
        const obj = args[0];
        const result = toPythonString(obj);
        return { type: 'string', value: result };
    }
    function input(args) {
        // TODO: 
        // nodejs
        // readline
        // distinguish between browser and commandline
    }
    function print(args) {
        // Convert each argument using toPythonString (an assumed helper function).
        const pieces = args.map(arg => toPythonString(arg));
        // Join them with spaces.
        const output = pieces.join(' ');
        // Actually print to console (you can replace this with any desired output).
        // console.info(output);
        addPrint(output);
        //return { type: 'string', value: output };
    }

    class CSEBreak {
    }
    // export class CseError {
    //     constructor(public readonly error: any) {}
    // }
    var ErrorType;
    (function (ErrorType) {
        ErrorType["IMPORT"] = "Import";
        ErrorType["RUNTIME"] = "Runtime";
        ErrorType["SYNTAX"] = "Syntax";
        ErrorType["TYPE"] = "Type";
    })(ErrorType || (ErrorType = {}));
    var ErrorSeverity;
    (function (ErrorSeverity) {
        ErrorSeverity["WARNING"] = "Warning";
        ErrorSeverity["ERROR"] = "Error";
    })(ErrorSeverity || (ErrorSeverity = {}));
    class PyComplexNumber {
        constructor(real, imag) {
            this.real = real;
            this.imag = imag;
        }
        static fromNumber(value) {
            return new PyComplexNumber(value, 0);
        }
        static fromBigInt(value) {
            return new PyComplexNumber(Number(value), 0);
        }
        static fromString(str) {
            if (!/[jJ]/.test(str)) {
                const realVal = Number(str);
                if (isNaN(realVal)) {
                    throw new Error(`Invalid complex string: ${str}`);
                }
                return new PyComplexNumber(realVal, 0);
            }
            const lower = str.toLowerCase();
            if (lower.endsWith('j')) {
                const numericPart = str.substring(0, str.length - 1);
                if (numericPart === '' || numericPart === '+' || numericPart === '-') {
                    const sign = (numericPart === '-') ? -1 : 1;
                    return new PyComplexNumber(0, sign * 1);
                }
                const imagVal = Number(numericPart);
                if (isNaN(imagVal)) {
                    throw new Error(`Invalid complex string: ${str}`);
                }
                return new PyComplexNumber(0, imagVal);
            }
            const match = str.match(/^([\+\-]?\d+(\.\d+)?([eE][+\-]?\d+)?)([\+\-]\d+(\.\d+)?([eE][+\-]?\d+)?)?[jJ]?$/);
            if (!match) {
                throw new Error(`Invalid complex string: ${str}`);
            }
            const realPart = Number(match[1]);
            let imagPart = 0;
            if (match[4]) {
                imagPart = Number(match[4]);
            }
            return new PyComplexNumber(realPart, imagPart);
        }
        static fromValue(value) {
            if (value instanceof PyComplexNumber) {
                return new PyComplexNumber(value.real, value.imag);
            }
            if (typeof value === "number") {
                return PyComplexNumber.fromNumber(value);
            }
            if (typeof value === "bigint") {
                return PyComplexNumber.fromBigInt(value);
            }
            return PyComplexNumber.fromString(value);
        }
        /**
         * operations
         */
        add(other) {
            return new PyComplexNumber(this.real + other.real, this.imag + other.imag);
        }
        sub(other) {
            return new PyComplexNumber(this.real - other.real, this.imag - other.imag);
        }
        mul(other) {
            // (a+bi)*(c+di) = (ac - bd) + (bc + ad)i
            const realPart = this.real * other.real - this.imag * other.imag;
            const imagPart = this.real * other.imag + this.imag * other.real;
            return new PyComplexNumber(realPart, imagPart);
        }
        // https://github.com/python/cpython/blob/main/Objects/complexobject.c#L986
        // In the CPython source code, a branch algorithm is used for complex division.
        // It first compares the magnitudes of the dividend and divisor, and if some components are too large or too small, 
        // appropriate scaling is applied before performing the operation. 
        // This approach can significantly reduce overflow or underflow, thereby ensuring that the results remain more consistent with Python.
        div(other) {
            // (a+bi)/(c+di) = ((a+bi)*(c-di)) / (c^2 + d^2)
            const denominator = other.real * other.real + other.imag * other.imag;
            if (denominator === 0) {
                throw new Error(`Division by zero in complex number.`);
            }
            const a = this.real;
            const b = this.imag;
            const c = other.real;
            const d = other.imag;
            const absC = Math.abs(c);
            const absD = Math.abs(d);
            let real;
            let imag;
            if (absD < absC) {
                const ratio = d / c;
                const denom = c + d * ratio; // c + d*(d/c) = c + d^2/c
                real = (a + b * ratio) / denom;
                imag = (b - a * ratio) / denom;
            }
            else {
                const ratio = c / d;
                const denom = d + c * ratio; // d + c*(c/d) = d + c^2/d
                real = (a * ratio + b) / denom;
                imag = (b * ratio - a) / denom;
            }
            return new PyComplexNumber(real, imag);
            //const numerator = this.mul(new PyComplexNumber(other.real, -other.imag));
            //return new PyComplexNumber(numerator.real / denominator, numerator.imag / denominator);
        }
        pow(other) {
            // z = this (a+bi), w = other (A+Bi)
            const a = this.real;
            const b = this.imag;
            const A = other.real;
            const B = other.imag;
            const r = Math.sqrt(a * a + b * b);
            const theta = Math.atan2(b, a);
            if (r === 0) {
                // In Python, raising 0 to a negative or complex power raises an error.
                // For example, 0**(1j) in CPython directly raises ValueError: complex power.
                if (A < 0 || B !== 0) {
                    throw new Error('0 cannot be raised to a negative or complex power');
                }
                // Otherwise, 0**(positive number) = 0.
                return new PyComplexNumber(0, 0);
            }
            const logR = Math.log(r);
            // realExpPart = A*ln(r) - B*theta
            // imagExpPart = B*ln(r) + A*theta
            const realExpPart = A * logR - B * theta;
            const imagExpPart = B * logR + A * theta;
            // e^(x + i y) = e^x [cos(y) + i sin(y)]
            const expOfReal = Math.exp(realExpPart);
            const c = expOfReal * Math.cos(imagExpPart);
            const d = expOfReal * Math.sin(imagExpPart);
            return new PyComplexNumber(c, d);
        }
        toString() {
            if (this.real === 0) {
                return `${this.imag}j`;
            }
            // if (this.imag === 0) {
            //     return `${this.real}`;
            // }
            const sign = (this.imag >= 0) ? "+" : "";
            // return `(${this.real}${sign}${this.imag}j)`;
            return `(${this.toPythonComplexFloat(this.real)}${sign}${this.toPythonComplexFloat(this.imag)}j)`;
        }
        toPythonComplexFloat(num) {
            if (num === Infinity) {
                return "inf";
            }
            if (num === -Infinity) {
                return "-inf";
            }
            if (Math.abs(num) >= 1e16 || (num !== 0 && Math.abs(num) < 1e-4)) {
                return num.toExponential().replace(/e([+-])(\d)$/, 'e$10$2');
            }
            return num.toString();
        }
        equals(other) {
            return (Number(this.real) === Number(other.real) && Number(this.imag) === Number(other.imag));
        }
    }
    // export class Representation {
    //     constructor(public representation: string) {}
    //     toString() {
    //         return this.representation
    //     }
    // }
    class Representation {
        constructor(representation) {
            this.representation = representation;
        }
        toString(value) {
            // call str(value) in stdlib
            // TODO: mapping
            const result = toPythonString(value);
            return result;
        }
    }

    var ExprNS;
    (function (ExprNS) {
        class Expr {
            constructor(startToken, endToken) {
                this.startToken = startToken;
                this.endToken = endToken;
            }
        }
        ExprNS.Expr = Expr;
        class None extends Expr {
            constructor(startToken, endToken, value = "None") {
                super(startToken, endToken);
            }
            accept(visitor) {
                return visitor.visitNoneExpr(this);
            }
        }
        ExprNS.None = None;
        class BigIntLiteral extends Expr {
            constructor(startToken, endToken, value) {
                super(startToken, endToken);
                this.value = value;
            }
            accept(visitor) {
                return visitor.visitBigIntLiteralExpr(this);
            }
        }
        ExprNS.BigIntLiteral = BigIntLiteral;
        class Complex extends Expr {
            constructor(startToken, endToken, value) {
                super(startToken, endToken);
                this.value = PyComplexNumber.fromString(value);
            }
            accept(visitor) {
                return visitor.visitComplexExpr(this);
            }
        }
        ExprNS.Complex = Complex;
        class Binary extends Expr {
            constructor(startToken, endToken, left, operator, right) {
                super(startToken, endToken);
                this.left = left;
                this.operator = operator;
                this.right = right;
            }
            accept(visitor) {
                return visitor.visitBinaryExpr(this);
            }
        }
        ExprNS.Binary = Binary;
        class Compare extends Expr {
            constructor(startToken, endToken, left, operator, right) {
                super(startToken, endToken);
                this.left = left;
                this.operator = operator;
                this.right = right;
            }
            accept(visitor) {
                return visitor.visitCompareExpr(this);
            }
        }
        ExprNS.Compare = Compare;
        class BoolOp extends Expr {
            constructor(startToken, endToken, left, operator, right) {
                super(startToken, endToken);
                this.left = left;
                this.operator = operator;
                this.right = right;
            }
            accept(visitor) {
                return visitor.visitBoolOpExpr(this);
            }
        }
        ExprNS.BoolOp = BoolOp;
        class Grouping extends Expr {
            constructor(startToken, endToken, expression) {
                super(startToken, endToken);
                this.expression = expression;
            }
            accept(visitor) {
                return visitor.visitGroupingExpr(this);
            }
        }
        ExprNS.Grouping = Grouping;
        class Literal extends Expr {
            constructor(startToken, endToken, value) {
                super(startToken, endToken);
                this.value = value;
            }
            accept(visitor) {
                return visitor.visitLiteralExpr(this);
            }
        }
        ExprNS.Literal = Literal;
        class Unary extends Expr {
            constructor(startToken, endToken, operator, right) {
                super(startToken, endToken);
                this.operator = operator;
                this.right = right;
            }
            accept(visitor) {
                return visitor.visitUnaryExpr(this);
            }
        }
        ExprNS.Unary = Unary;
        class Ternary extends Expr {
            constructor(startToken, endToken, predicate, consequent, alternative) {
                super(startToken, endToken);
                this.predicate = predicate;
                this.consequent = consequent;
                this.alternative = alternative;
            }
            accept(visitor) {
                return visitor.visitTernaryExpr(this);
            }
        }
        ExprNS.Ternary = Ternary;
        class Lambda extends Expr {
            constructor(startToken, endToken, parameters, body) {
                super(startToken, endToken);
                this.parameters = parameters;
                this.body = body;
            }
            accept(visitor) {
                return visitor.visitLambdaExpr(this);
            }
        }
        ExprNS.Lambda = Lambda;
        class MultiLambda extends Expr {
            constructor(startToken, endToken, parameters, body, varDecls) {
                super(startToken, endToken);
                this.parameters = parameters;
                this.body = body;
                this.varDecls = varDecls;
            }
            accept(visitor) {
                return visitor.visitMultiLambdaExpr(this);
            }
        }
        ExprNS.MultiLambda = MultiLambda;
        class Variable extends Expr {
            constructor(startToken, endToken, name) {
                super(startToken, endToken);
                this.name = name;
            }
            accept(visitor) {
                return visitor.visitVariableExpr(this);
            }
        }
        ExprNS.Variable = Variable;
        class Call extends Expr {
            constructor(startToken, endToken, callee, args) {
                super(startToken, endToken);
                this.callee = callee;
                this.args = args;
            }
            accept(visitor) {
                return visitor.visitCallExpr(this);
            }
        }
        ExprNS.Call = Call;
    })(ExprNS || (ExprNS = {}));
    var StmtNS;
    (function (StmtNS) {
        class Stmt {
            constructor(startToken, endToken) {
                this.startToken = startToken;
                this.endToken = endToken;
            }
        }
        StmtNS.Stmt = Stmt;
        class Indent extends Stmt {
            constructor(startToken, endToken) {
                super(startToken, endToken);
            }
            accept(visitor) {
                return visitor.visitIndentCreation(this);
            }
        }
        StmtNS.Indent = Indent;
        class Dedent extends Stmt {
            constructor(startToken, endToken) {
                super(startToken, endToken);
            }
            accept(visitor) {
                return visitor.visitDedentCreation(this);
            }
        }
        StmtNS.Dedent = Dedent;
        class Pass extends Stmt {
            constructor(startToken, endToken) {
                super(startToken, endToken);
            }
            accept(visitor) {
                return visitor.visitPassStmt(this);
            }
        }
        StmtNS.Pass = Pass;
        class Assign extends Stmt {
            constructor(startToken, endToken, name, value) {
                super(startToken, endToken);
                this.name = name;
                this.value = value;
            }
            accept(visitor) {
                return visitor.visitAssignStmt(this);
            }
        }
        StmtNS.Assign = Assign;
        class AnnAssign extends Stmt {
            constructor(startToken, endToken, name, value, ann) {
                super(startToken, endToken);
                this.name = name;
                this.value = value;
                this.ann = ann;
            }
            accept(visitor) {
                return visitor.visitAnnAssignStmt(this);
            }
        }
        StmtNS.AnnAssign = AnnAssign;
        class Break extends Stmt {
            constructor(startToken, endToken) {
                super(startToken, endToken);
            }
            accept(visitor) {
                return visitor.visitBreakStmt(this);
            }
        }
        StmtNS.Break = Break;
        class Continue extends Stmt {
            constructor(startToken, endToken) {
                super(startToken, endToken);
            }
            accept(visitor) {
                return visitor.visitContinueStmt(this);
            }
        }
        StmtNS.Continue = Continue;
        class Return extends Stmt {
            constructor(startToken, endToken, value) {
                super(startToken, endToken);
                this.value = value;
            }
            accept(visitor) {
                return visitor.visitReturnStmt(this);
            }
        }
        StmtNS.Return = Return;
        class FromImport extends Stmt {
            constructor(startToken, endToken, module, names) {
                super(startToken, endToken);
                this.module = module;
                this.names = names;
            }
            accept(visitor) {
                return visitor.visitFromImportStmt(this);
            }
        }
        StmtNS.FromImport = FromImport;
        class Global extends Stmt {
            constructor(startToken, endToken, name) {
                super(startToken, endToken);
                this.name = name;
            }
            accept(visitor) {
                return visitor.visitGlobalStmt(this);
            }
        }
        StmtNS.Global = Global;
        class NonLocal extends Stmt {
            constructor(startToken, endToken, name) {
                super(startToken, endToken);
                this.name = name;
            }
            accept(visitor) {
                return visitor.visitNonLocalStmt(this);
            }
        }
        StmtNS.NonLocal = NonLocal;
        class Assert extends Stmt {
            constructor(startToken, endToken, value) {
                super(startToken, endToken);
                this.value = value;
            }
            accept(visitor) {
                return visitor.visitAssertStmt(this);
            }
        }
        StmtNS.Assert = Assert;
        class If extends Stmt {
            constructor(startToken, endToken, condition, body, elseBlock) {
                super(startToken, endToken);
                this.condition = condition;
                this.body = body;
                this.elseBlock = elseBlock;
            }
            accept(visitor) {
                return visitor.visitIfStmt(this);
            }
        }
        StmtNS.If = If;
        class While extends Stmt {
            constructor(startToken, endToken, condition, body) {
                super(startToken, endToken);
                this.condition = condition;
                this.body = body;
            }
            accept(visitor) {
                return visitor.visitWhileStmt(this);
            }
        }
        StmtNS.While = While;
        class For extends Stmt {
            constructor(startToken, endToken, target, iter, body) {
                super(startToken, endToken);
                this.target = target;
                this.iter = iter;
                this.body = body;
            }
            accept(visitor) {
                return visitor.visitForStmt(this);
            }
        }
        StmtNS.For = For;
        class FunctionDef extends Stmt {
            constructor(startToken, endToken, name, parameters, body, varDecls) {
                super(startToken, endToken);
                this.name = name;
                this.parameters = parameters;
                this.body = body;
                this.varDecls = varDecls;
            }
            accept(visitor) {
                return visitor.visitFunctionDefStmt(this);
            }
        }
        StmtNS.FunctionDef = FunctionDef;
        class SimpleExpr extends Stmt {
            constructor(startToken, endToken, expression) {
                super(startToken, endToken);
                this.expression = expression;
            }
            accept(visitor) {
                return visitor.visitSimpleExprStmt(this);
            }
        }
        StmtNS.SimpleExpr = SimpleExpr;
        class FileInput extends Stmt {
            constructor(startToken, endToken, statements, varDecls) {
                super(startToken, endToken);
                this.statements = statements;
                this.varDecls = varDecls;
            }
            accept(visitor) {
                return visitor.visitFileInputStmt(this);
            }
        }
        StmtNS.FileInput = FileInput;
    })(StmtNS || (StmtNS = {}));

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
    const PSEUD_NAMES = [
        TokenType.TRUE,
        TokenType.FALSE,
        TokenType.NONE,
    ];
    class Parser {
        constructor(source, tokens) {
            this.source = source;
            this.tokens = tokens;
            this.current = 0;
        }
        // Consumes tokens while tokenTypes matches.
        match(...tokenTypes) {
            for (const tokenType of tokenTypes) {
                if (this.check(tokenType)) {
                    this.advance();
                    return true;
                }
            }
            return false;
        }
        check(...type) {
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
        advance() {
            if (!this.isAtEnd()) {
                this.current += 1;
            }
            return this.previous();
        }
        isAtEnd() {
            return this.peek().type === TokenType.ENDMARKER;
        }
        peek() {
            return this.tokens[this.current];
        }
        previous() {
            return this.tokens[this.current - 1];
        }
        consume(type, message) {
            if (this.check(type))
                return this.advance();
            const token = this.tokens[this.current];
            throw new exports.ParserErrors.ExpectedTokenError(this.source, token, message);
        }
        synchronize() {
            this.advance();
            while (!this.isAtEnd()) {
                if (this.match(TokenType.NEWLINE)) {
                    return false;
                }
                if (this.match(TokenType.FOR, TokenType.WHILE, TokenType.DEF, TokenType.IF, TokenType.ELIF, TokenType.ELSE, TokenType.RETURN)) {
                    return true;
                }
                this.advance();
            }
            return false;
        }
        parse() {
            return this.file_input();
            // return this.expression();
        }
        //// THE NAMES OF THE FOLLOWING FUNCTIONS FOLLOW THE PRODUCTION RULES IN THE GRAMMAR.
        //// HENCE THEIR NAMES MIGHT NOT BE COMPLIANT WITH CAMELCASE
        file_input() {
            const startToken = this.peek();
            const statements = [];
            while (!this.isAtEnd()) {
                if (this.match(TokenType.NEWLINE) || this.match(TokenType.DEDENT)) {
                    continue;
                }
                statements.push(this.stmt());
            }
            const endToken = this.peek();
            return new StmtNS.FileInput(startToken, endToken, statements, []);
        }
        stmt() {
            if (this.check(TokenType.DEF, TokenType.FOR, TokenType.IF, TokenType.WHILE)) {
                return this.compound_stmt();
            }
            else if (this.check(TokenType.NAME, ...PSEUD_NAMES, TokenType.NUMBER, TokenType.PASS, TokenType.BREAK, TokenType.CONTINUE, TokenType.MINUS, TokenType.PLUS, TokenType.INDENT, TokenType.DEDENT, TokenType.RETURN, TokenType.FROM, TokenType.GLOBAL, TokenType.NONLOCAL, TokenType.ASSERT, TokenType.LPAR, TokenType.STRING, TokenType.BIGINT, ...SPECIAL_IDENTIFIER_TOKENS)) {
                return this.simple_stmt();
            }
            const startToken = this.peek();
            const endToken = this.synchronize() ? this.previous() : this.peek();
            try {
                this.parse_invalid(startToken, endToken);
            }
            catch (e) {
                if (e instanceof exports.ParserErrors.BaseParserError) {
                    throw (e);
                }
            }
            throw new exports.ParserErrors.GenericUnexpectedSyntaxError(startToken.line, startToken.col, this.source, startToken.indexInSource, endToken.indexInSource);
        }
        compound_stmt() {
            if (this.match(TokenType.IF)) {
                return this.if_stmt();
            }
            else if (this.match(TokenType.WHILE)) {
                return this.while_stmt();
            }
            else if (this.match(TokenType.FOR)) {
                return this.for_stmt();
            }
            else if (this.match(TokenType.DEF)) {
                return this.funcdef();
            }
            throw new Error("Unreachable code path");
        }
        if_stmt() {
            const startToken = this.previous();
            let start = this.previous();
            let cond = this.test();
            this.consume(TokenType.COLON, "Expected ':' after if");
            let block = this.suite();
            let elseStmt = null;
            if (this.match(TokenType.ELIF)) {
                elseStmt = [this.if_stmt()];
            }
            else if (this.match(TokenType.ELSE)) {
                this.consume(TokenType.COLON, "Expect ':' after else");
                elseStmt = this.suite();
            }
            else {
                throw new exports.ParserErrors.NoElseBlockError(this.source, start);
            }
            const endToken = this.previous();
            return new StmtNS.If(startToken, endToken, cond, block, elseStmt);
        }
        while_stmt() {
            const startToken = this.peek();
            let cond = this.test();
            this.consume(TokenType.COLON, "Expected ':' after while");
            let block = this.suite();
            const endToken = this.previous();
            return new StmtNS.While(startToken, endToken, cond, block);
        }
        for_stmt() {
            const startToken = this.peek();
            let target = this.advance();
            this.consume(TokenType.IN, "Expected in after for");
            let iter = this.test();
            this.consume(TokenType.COLON, "Expected ':' after for");
            let block = this.suite();
            const endToken = this.previous();
            return new StmtNS.For(startToken, endToken, target, iter, block);
        }
        funcdef() {
            const startToken = this.peek();
            let name = this.advance();
            let args = this.parameters();
            this.consume(TokenType.COLON, "Expected ':' after def");
            let block = this.suite();
            const endToken = this.previous();
            return new StmtNS.FunctionDef(startToken, endToken, name, args, block, []);
        }
        simple_stmt() {
            const startToken = this.peek();
            let res = null;
            if (this.match(TokenType.NAME)) {
                res = this.assign_stmt();
            }
            else if (this.match(TokenType.INDENT)) {
                res = new StmtNS.Indent(startToken, startToken);
            }
            else if (this.match(TokenType.DEDENT)) {
                res = new StmtNS.Dedent(startToken, startToken);
            }
            else if (this.match(TokenType.PASS)) {
                res = new StmtNS.Pass(startToken, startToken);
            }
            else if (this.match(TokenType.BREAK)) {
                res = new StmtNS.Break(startToken, startToken);
            }
            else if (this.match(TokenType.CONTINUE)) {
                res = new StmtNS.Continue(startToken, startToken);
            }
            else if (this.match(TokenType.RETURN)) {
                res = new StmtNS.Return(startToken, startToken, this.check(TokenType.NEWLINE) ? null : this.test());
            }
            else if (this.match(TokenType.FROM)) {
                res = this.import_from();
            }
            else if (this.match(TokenType.GLOBAL)) {
                res = new StmtNS.Global(startToken, startToken, this.advance());
            }
            else if (this.match(TokenType.NONLOCAL)) {
                res = new StmtNS.NonLocal(startToken, startToken, this.advance());
            }
            else if (this.match(TokenType.ASSERT)) {
                res = new StmtNS.Assert(startToken, startToken, this.test());
            }
            else if (this.check(TokenType.LPAR, TokenType.NUMBER, TokenType.STRING, TokenType.BIGINT, TokenType.MINUS, TokenType.PLUS, ...SPECIAL_IDENTIFIER_TOKENS)) {
                res = new StmtNS.SimpleExpr(startToken, startToken, this.test());
            }
            else {
                throw new Error("Unreachable code path");
            }
            this.consume(TokenType.NEWLINE, "Expected newline");
            return res;
        }
        assign_stmt() {
            const startToken = this.previous();
            const name = this.previous();
            if (this.check(TokenType.COLON)) {
                const ann = this.test();
                this.consume(TokenType.EQUAL, "Expect equal in assignment");
                const expr = this.test();
                return new StmtNS.AnnAssign(startToken, this.previous(), name, expr, ann);
            }
            else if (this.check(TokenType.EQUAL)) {
                this.advance();
                const expr = this.test();
                return new StmtNS.Assign(startToken, this.previous(), name, expr);
            }
            else {
                this.current--;
                const expr = this.test();
                return new StmtNS.SimpleExpr(startToken, this.previous(), expr);
            }
        }
        import_from() {
            const startToken = this.previous();
            const module = this.advance();
            this.consume(TokenType.IMPORT, "Expected import keyword");
            let params;
            if (this.check(TokenType.NAME)) {
                params = [this.advance()];
            }
            else {
                params = this.parameters();
            }
            return new StmtNS.FromImport(startToken, this.previous(), module, params);
        }
        parameters() {
            this.consume(TokenType.LPAR, "Expected opening parentheses");
            let res = this.varparamslist();
            this.consume(TokenType.RPAR, "Expected closing parentheses");
            return res;
        }
        test() {
            if (this.match(TokenType.LAMBDA)) {
                return this.lambdef();
            }
            else {
                const startToken = this.peek();
                let consequent = this.or_test();
                if (this.match(TokenType.IF)) {
                    const predicate = this.or_test();
                    this.consume(TokenType.ELSE, "Expected else");
                    const alternative = this.test();
                    return new ExprNS.Ternary(startToken, this.previous(), predicate, consequent, alternative);
                }
                return consequent;
            }
        }
        lambdef() {
            const startToken = this.previous();
            let args = this.varparamslist();
            if (this.match(TokenType.COLON)) {
                let test = this.test();
                return new ExprNS.Lambda(startToken, this.previous(), args, test);
            }
            else if (this.match(TokenType.DOUBLECOLON)) {
                let block = this.suite();
                return new ExprNS.MultiLambda(startToken, this.previous(), args, block, []);
            }
            this.consume(TokenType.COLON, "Expected ':' after lambda");
            throw new Error("unreachable code path");
        }
        suite() {
            let stmts = [];
            if (this.match(TokenType.NEWLINE)) {
                this.consume(TokenType.INDENT, "Expected indent");
                while (!this.match(TokenType.DEDENT)) {
                    stmts.push(this.stmt());
                }
            }
            return stmts;
        }
        varparamslist() {
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
        or_test() {
            const startToken = this.peek();
            let expr = this.and_test();
            while (this.match(TokenType.OR)) {
                const operator = this.previous();
                const right = this.and_test();
                expr = new ExprNS.BoolOp(startToken, this.previous(), expr, operator, right);
            }
            return expr;
        }
        and_test() {
            const startToken = this.peek();
            let expr = this.not_test();
            while (this.match(TokenType.AND)) {
                const operator = this.previous();
                const right = this.not_test();
                expr = new ExprNS.BoolOp(startToken, this.previous(), expr, operator, right);
            }
            return expr;
        }
        not_test() {
            const startToken = this.peek();
            if (this.match(TokenType.NOT, TokenType.BANG)) {
                const operator = this.previous();
                return new ExprNS.Unary(startToken, this.previous(), operator, this.not_test());
            }
            return this.comparison();
        }
        comparison() {
            const startToken = this.peek();
            let expr = this.arith_expr();
            // @TODO: Add the rest of the comparisons
            while (this.match(TokenType.LESS, TokenType.GREATER, TokenType.DOUBLEEQUAL, TokenType.GREATEREQUAL, TokenType.LESSEQUAL, TokenType.NOTEQUAL, TokenType.IS, TokenType.ISNOT, TokenType.IN, TokenType.NOTIN)) {
                const operator = this.previous();
                const right = this.arith_expr();
                expr = new ExprNS.Compare(startToken, this.previous(), expr, operator, right);
            }
            return expr;
        }
        arith_expr() {
            const startToken = this.peek();
            let expr = this.term();
            while (this.match(TokenType.PLUS, TokenType.MINUS)) {
                const token = this.previous();
                const right = this.term();
                expr = new ExprNS.Binary(startToken, this.previous(), expr, token, right);
            }
            return expr;
        }
        term() {
            const startToken = this.peek();
            let expr = this.factor();
            while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT, TokenType.DOUBLESLASH)) {
                const token = this.previous();
                const right = this.factor();
                expr = new ExprNS.Binary(startToken, this.previous(), expr, token, right);
            }
            return expr;
        }
        factor() {
            const startToken = this.peek();
            if (this.match(TokenType.PLUS, TokenType.MINUS)) {
                const op = this.previous();
                const factor = this.factor();
                const endToken = this.previous();
                return new ExprNS.Unary(startToken, endToken, op, factor);
            }
            return this.power();
        }
        power() {
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
        atom_expr() {
            let startToken = this.peek();
            let ato = this.atom();
            let res;
            if (this.match(TokenType.LPAR)) {
                let args = this.arglist();
                const endToken = this.previous();
                res = new ExprNS.Call(startToken, endToken, ato, args);
            }
            else {
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
        arglist() {
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
        atom() {
            const startToken = this.peek();
            if (this.match(TokenType.TRUE))
                return new ExprNS.Literal(startToken, this.previous(), true);
            if (this.match(TokenType.FALSE))
                return new ExprNS.Literal(startToken, this.previous(), false);
            if (this.match(TokenType.NONE))
                return new ExprNS.None(startToken, this.previous());
            if (this.match(TokenType.STRING)) {
                return new ExprNS.Literal(startToken, this.previous(), this.previous().lexeme);
            }
            if (this.match(TokenType.NUMBER)) {
                return new ExprNS.Literal(startToken, this.previous(), Number(this.previous().lexeme.replace(/_/g, "")));
            }
            if (this.match(TokenType.BIGINT)) {
                return new ExprNS.BigIntLiteral(startToken, this.previous(), this.previous().lexeme);
            }
            if (this.match(TokenType.COMPLEX)) {
                return new ExprNS.Complex(startToken, this.previous(), this.previous().lexeme);
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
            throw new exports.ParserErrors.GenericUnexpectedSyntaxError(startToken.line, startToken.col, this.source, startTokenInvalid.indexInSource, endTokenInvalid.indexInSource);
        }
        //// INVALID RULES
        parse_invalid(startToken, endToken) {
            // @TODO invalid rules
        }
    }

    /*
    * Translate our AST to estree AST (Source's AST)
    * */
    class Translator {
        constructor(source) {
            this.source = source;
        }
        tokenToEstreeLocation(token) {
            // Convert zero-based to one-based.
            const line = token.line + 1;
            const start = {
                line,
                column: token.col - token.lexeme.length
            };
            const end = {
                line,
                column: token.col
            };
            const source = token.lexeme;
            return { source, start, end };
        }
        toEstreeLocation(stmt) {
            const start = {
                // Convert zero-based to one-based.
                line: stmt.startToken.line + 1,
                column: stmt.startToken.col - stmt.startToken.lexeme.length
            };
            const end = {
                // Convert zero-based to one-based.
                line: stmt.endToken.line + 1,
                column: stmt.endToken.col
            };
            const source = this.source.slice(stmt.startToken.indexInSource, stmt.endToken.indexInSource + stmt.endToken.lexeme.length);
            return { source, start, end };
        }
        resolve(stmt) {
            return stmt.accept(this);
        }
        // Ugly, but just to support proper typing
        resolveStmt(stmt) {
            return stmt.accept(this);
        }
        resolveManyStmt(stmts) {
            const res = [];
            for (const stmt of stmts) {
                res.push(this.resolveStmt(stmt));
            }
            return res;
        }
        resolveExpr(expr) {
            return expr.accept(this);
        }
        resolveManyExpr(exprs) {
            const res = [];
            for (const expr of exprs) {
                res.push(this.resolveExpr(expr));
            }
            return res;
        }
        // Converts our internal identifier to estree identifier.
        rawStringToIdentifier(name, stmtOrExpr) {
            const keywords = new Set(['abstract', 'arguments', 'await', 'boolean', 'byte',
                'case', 'catch', 'char', 'const', 'debugger', 'default', 'delete', 'do', 'double', 'enum',
                'eval', 'export', 'extends', 'false', 'final', 'float', 'function', 'goto', 'implements',
                'instanceof', 'int', 'interface', 'let', 'long', 'native', 'new', 'null', 'package',
                'private', 'protected', 'public', 'short', 'static', 'super', 'switch', 'synchronized', 'this',
                'throw', 'throws', 'transient', 'true', 'typeof', 'var', 'void', 'volatile']);
            return {
                type: 'Identifier',
                name: keywords.has(name) ? '$' + name : name,
                loc: this.toEstreeLocation(stmtOrExpr),
            };
        }
        // Token to estree identifier.
        convertToIdentifier(name) {
            const keywords = new Set(['abstract', 'arguments', 'await', 'boolean', 'byte',
                'case', 'catch', 'char', 'const', 'debugger', 'default', 'delete', 'do', 'double', 'enum',
                'eval', 'export', 'extends', 'false', 'final', 'float', 'function', 'goto', 'implements',
                'instanceof', 'int', 'interface', 'let', 'long', 'native', 'new', 'null', 'package',
                'private', 'protected', 'public', 'short', 'static', 'super', 'switch', 'synchronized', 'this',
                'throw', 'throws', 'transient', 'true', 'typeof', 'var', 'void', 'volatile']);
            return {
                type: 'Identifier',
                name: keywords.has(name.lexeme) ? '$' + name.lexeme : name.lexeme,
                loc: this.tokenToEstreeLocation(name),
            };
        }
        convertToIdentifiers(names) {
            return names.map(name => this.convertToIdentifier(name));
        }
        // private convertToExpressionStatement(expr: Expression): ExpressionStatement {
        //     return {
        //         type: 'ExpressionStatement',
        //         expression: expr,
        //         // loc: this.toEstreeLocation(),
        //     }
        // }
        // private converTokenstoDecls(varDecls: Token[]): VariableDeclaration {
        //     return {
        //         type: 'VariableDeclaration',
        //         declarations: varDecls?.map((token): VariableDeclarator => {
        //             return {
        //                 type: 'VariableDeclarator',
        //                 id: this.convertToIdentifier(token),
        //                 loc: this.tokenToEstreeLocation(token),
        //             }
        //         }),
        //         kind: 'var',
        //         loc: this.toEstreeLocation(),
        //     };
        // }
        // Wraps an array of statements to a block.
        // WARNING: THIS CREATES A NEW BLOCK IN
        // JS AST. THIS ALSO MEANS A NEW NAMESPACE. BE CAREFUL!
        wrapInBlock(stmt, stmts) {
            return {
                type: 'BlockStatement',
                body: this.resolveManyStmt(stmts),
                loc: this.toEstreeLocation(stmt),
            };
        }
        //// STATEMENTS
        visitFileInputStmt(stmt) {
            const newBody = this.resolveManyStmt(stmt.statements);
            // if (stmt.varDecls !== null && stmt.varDecls.length > 0) {
            //     const decls = this.converTokenstoDecls(stmt.varDecls);
            //     newBody.unshift(decls);
            // }
            return {
                type: 'Program',
                sourceType: 'module',
                body: newBody,
                loc: this.toEstreeLocation(stmt),
            };
        }
        visitIndentCreation(stmt) {
            return {
                type: 'EmptyStatement',
                loc: this.toEstreeLocation(stmt),
            };
        }
        visitDedentCreation(stmt) {
            return {
                type: 'EmptyStatement',
                loc: this.toEstreeLocation(stmt),
            };
        }
        visitFunctionDefStmt(stmt) {
            const newBody = this.resolveManyStmt(stmt.body);
            // if (stmt.varDecls !== null && stmt.varDecls.length > 0) {
            //     const decls = this.converTokenstoDecls(stmt.varDecls);
            //     newBody.unshift(decls);
            // }
            return {
                type: 'FunctionDeclaration',
                id: this.convertToIdentifier(stmt.name),
                params: this.convertToIdentifiers(stmt.parameters),
                body: {
                    type: 'BlockStatement',
                    body: newBody,
                },
                loc: this.toEstreeLocation(stmt),
            };
        }
        visitAnnAssignStmt(stmt) {
            return {
                type: 'AssignmentExpression',
                // We only have one type of assignment in restricted Python.
                operator: '=',
                left: this.convertToIdentifier(stmt.name),
                right: this.resolveExpr(stmt.value),
                loc: this.toEstreeLocation(stmt),
            };
        }
        // Note: assignments are expressions in JS.
        visitAssignStmt(stmt) {
            // return this.convertToExpressionStatement({
            //     type: 'AssignmentExpression',
            //     // We only have one type of assignment in restricted Python.
            //     operator: '=',
            //     left: this.convertToIdentifier(stmt.name),
            //     right: this.resolveExpr(stmt.value),
            //     loc: this.toEstreeLocation(stmt),
            // })
            const declaration = {
                type: 'VariableDeclarator',
                id: this.convertToIdentifier(stmt.name),
                loc: this.tokenToEstreeLocation(stmt.name),
                init: this.resolveExpr(stmt.value),
            };
            return {
                type: 'VariableDeclaration',
                declarations: [declaration],
                // Note: we abuse the fact that var is function and module scoped
                // which is exactly the same as how Python assignments are scoped!
                kind: 'var',
                loc: this.toEstreeLocation(stmt),
            };
        }
        // Convert to source's built-in assert function.
        visitAssertStmt(stmt) {
            return {
                type: 'CallExpression',
                optional: false,
                callee: this.rawStringToIdentifier('assert', stmt),
                arguments: [this.resolveExpr(stmt.value)],
                // @TODO, this needs to come after callee
                loc: this.toEstreeLocation(stmt),
            };
        }
        // @TODO decide how to do for loops
        // For now, empty block
        visitForStmt(stmt) {
            return {
                type: 'EmptyStatement',
                loc: this.toEstreeLocation(stmt),
            };
        }
        visitIfStmt(stmt) {
            return {
                type: 'IfStatement',
                test: this.resolveExpr(stmt.condition),
                consequent: this.wrapInBlock(stmt, stmt.body),
                alternate: stmt.elseBlock !== null ? this.wrapInBlock(stmt, stmt.elseBlock) : null,
                loc: this.toEstreeLocation(stmt),
            };
        }
        visitGlobalStmt(stmt) {
            return {
                type: 'EmptyStatement',
                loc: this.toEstreeLocation(stmt),
            };
        }
        visitNonLocalStmt(stmt) {
            return {
                type: 'EmptyStatement',
                loc: this.toEstreeLocation(stmt),
            };
        }
        visitReturnStmt(stmt) {
            return {
                type: 'ReturnStatement',
                argument: stmt.value == null ? null : this.resolveExpr(stmt.value),
                loc: this.toEstreeLocation(stmt),
            };
        }
        visitWhileStmt(stmt) {
            return {
                type: 'WhileStatement',
                test: this.resolveExpr(stmt.condition),
                body: this.wrapInBlock(stmt, stmt.body),
                loc: this.toEstreeLocation(stmt),
            };
        }
        visitSimpleExprStmt(stmt) {
            return {
                type: 'ExpressionStatement',
                expression: this.resolveExpr(stmt.expression),
                loc: this.toEstreeLocation(stmt),
            };
        }
        // @TODO
        visitFromImportStmt(stmt) {
            const specifiers = stmt.names.map(name => {
                const ident = this.convertToIdentifier(name);
                return {
                    type: 'ImportSpecifier',
                    imported: ident,
                    local: ident,
                };
            });
            return {
                type: 'ImportDeclaration',
                specifiers: specifiers,
                source: {
                    type: 'Literal',
                    value: stmt.module.lexeme,
                    loc: this.tokenToEstreeLocation(stmt.module)
                },
                attributes: []
            };
        }
        visitContinueStmt(stmt) {
            return {
                type: 'ContinueStatement',
                loc: this.toEstreeLocation(stmt),
            };
        }
        visitBreakStmt(stmt) {
            return {
                type: 'BreakStatement',
                loc: this.toEstreeLocation(stmt),
            };
        }
        visitPassStmt(stmt) {
            return {
                type: 'EmptyStatement',
                loc: this.toEstreeLocation(stmt),
            };
        }
        //// EXPRESSIONS
        visitVariableExpr(expr) {
            return this.convertToIdentifier(expr.name);
        }
        visitLambdaExpr(expr) {
            return {
                type: 'ArrowFunctionExpression',
                expression: true,
                params: this.convertToIdentifiers(expr.parameters),
                body: this.resolveExpr(expr.body),
                loc: this.toEstreeLocation(expr),
            };
        }
        // disabled for now
        visitMultiLambdaExpr(expr) {
            return {
                type: 'EmptyStatement',
                loc: this.toEstreeLocation(expr),
            };
        }
        visitUnaryExpr(expr) {
            const op = expr.operator.type;
            let res = '-';
            let plus = false;
            switch (op) {
                case TokenType.NOT:
                    res = '!';
                    break;
                case TokenType.PLUS:
                    res = '+';
                    plus = true;
                    break;
                case TokenType.MINUS:
                    res = '-';
                    break;
                default:
                    throw new Error("Unreachable code path in translator");
            }
            if (plus) {
                return {
                    type: 'CallExpression',
                    optional: false,
                    callee: {
                        type: 'Identifier',
                        name: '__py_unary_plus',
                        loc: this.toEstreeLocation(expr),
                    },
                    arguments: [this.resolveExpr(expr.right)],
                    loc: this.toEstreeLocation(expr),
                };
            }
            return {
                type: 'UnaryExpression',
                // To satisfy the type checker.
                operator: res,
                prefix: true,
                argument: this.resolveExpr(expr.right),
                loc: this.toEstreeLocation(expr),
            };
        }
        visitGroupingExpr(expr) {
            return this.resolveExpr(expr.expression);
        }
        visitBinaryExpr(expr) {
            const op = expr.operator.type;
            let res = '';
            // To make the type checker happy.
            switch (op) {
                case TokenType.PLUS:
                    res = '__py_adder';
                    break;
                case TokenType.MINUS:
                    res = '__py_minuser';
                    break;
                case TokenType.STAR:
                    res = '__py_multiplier';
                    break;
                case TokenType.SLASH:
                    res = '__py_divider';
                    break;
                case TokenType.PERCENT:
                    res = '__py_modder';
                    break;
                // @TODO double slash and power needs to convert to math exponent/floor divide
                case TokenType.DOUBLESLASH:
                    res = '__py_floorer';
                    break;
                case TokenType.DOUBLESTAR:
                    res = '__py_powerer';
                    break;
                default:
                    throw new Error("Unreachable binary code path in translator");
            }
            return {
                type: 'CallExpression',
                optional: false,
                callee: {
                    type: 'Identifier',
                    name: res,
                    loc: this.toEstreeLocation(expr),
                },
                arguments: [this.resolveExpr(expr.left), this.resolveExpr(expr.right)],
                loc: this.toEstreeLocation(expr),
            };
        }
        visitCompareExpr(expr) {
            const op = expr.operator.type;
            let res = '+';
            // To make the type checker happy.
            switch (op) {
                case TokenType.LESS:
                    res = '<';
                    break;
                case TokenType.GREATER:
                    res = '>';
                    break;
                case TokenType.DOUBLEEQUAL:
                    res = '===';
                    break;
                case TokenType.GREATEREQUAL:
                    res = '>=';
                    break;
                case TokenType.LESSEQUAL:
                    res = '<=';
                    break;
                case TokenType.NOTEQUAL:
                    res = '!==';
                    break;
                // @TODO we need to convert these to builtin function applications.
                case TokenType.IS:
                case TokenType.ISNOT:
                case TokenType.IN:
                case TokenType.NOTIN:
                    throw new exports.TranslatorErrors.UnsupportedOperator(expr.operator.line, expr.operator.col, this.source, expr.operator.indexInSource);
                default:
                    throw new Error("Unreachable binary code path in translator");
            }
            return {
                type: 'BinaryExpression',
                operator: res,
                left: this.resolveExpr(expr.left),
                right: this.resolveExpr(expr.right),
                loc: this.toEstreeLocation(expr),
            };
        }
        visitBoolOpExpr(expr) {
            const op = expr.operator.type;
            let res = '||';
            // To make the type checker happy.
            switch (op) {
                case TokenType.AND:
                    res = '&&';
                    break;
                case TokenType.OR:
                    res = '||';
                    break;
                default:
                    throw new Error("Unreachable binary code path in translator");
            }
            return {
                type: 'LogicalExpression',
                operator: res,
                left: this.resolveExpr(expr.left),
                right: this.resolveExpr(expr.right),
                loc: this.toEstreeLocation(expr),
            };
        }
        visitCallExpr(expr) {
            return {
                type: 'CallExpression',
                optional: false,
                callee: this.resolveExpr(expr.callee),
                arguments: this.resolveManyExpr(expr.args),
                loc: this.toEstreeLocation(expr),
            };
        }
        visitTernaryExpr(expr) {
            return {
                type: 'ConditionalExpression',
                test: this.resolveExpr(expr.predicate),
                alternate: this.resolveExpr(expr.alternative),
                consequent: this.resolveExpr(expr.consequent),
                loc: this.toEstreeLocation(expr),
            };
        }
        visitLiteralExpr(expr) {
            return {
                type: 'Literal',
                value: expr.value,
                loc: this.toEstreeLocation(expr),
            };
        }
        visitBigIntLiteralExpr(expr) {
            return {
                type: 'Literal',
                bigint: expr.value,
                loc: this.toEstreeLocation(expr),
            };
        }
        visitNoneExpr(expr) {
            return {
                type: 'NoneType',
                loc: this.toEstreeLocation(expr)
            };
        }
        visitComplexExpr(expr) {
            return {
                // 你可以复用 "Literal"，也可以用别的 type 标记
                // 这里保持和 BigInt 的风格一致
                type: 'Literal',
                // 和 visitBigIntLiteralExpr 类似，这里用一个字段来保存复数内容
                // 比如把它叫做 "complex"
                // expr.value 是一个 PyComplexNumber, 你可以用 toString(), 或者直接存 real/imag
                complex: {
                    real: expr.value.real,
                    imag: expr.value.imag
                },
                // 和其它 literal 一样，加上位置信息
                loc: this.toEstreeLocation(expr),
            };
        }
    }

    var levenshtein$1 = {exports: {}};

    const peq = new Uint32Array(0x10000);
    const myers_32 = (a, b) => {
        const n = a.length;
        const m = b.length;
        const lst = 1 << (n - 1);
        let pv = -1;
        let mv = 0;
        let sc = n;
        let i = n;
        while (i--) {
            peq[a.charCodeAt(i)] |= 1 << i;
        }
        for (i = 0; i < m; i++) {
            let eq = peq[b.charCodeAt(i)];
            const xv = eq | mv;
            eq |= ((eq & pv) + pv) ^ pv;
            mv |= ~(eq | pv);
            pv &= eq;
            if (mv & lst) {
                sc++;
            }
            if (pv & lst) {
                sc--;
            }
            mv = (mv << 1) | 1;
            pv = (pv << 1) | ~(xv | mv);
            mv &= xv;
        }
        i = n;
        while (i--) {
            peq[a.charCodeAt(i)] = 0;
        }
        return sc;
    };
    const myers_x = (b, a) => {
        const n = a.length;
        const m = b.length;
        const mhc = [];
        const phc = [];
        const hsize = Math.ceil(n / 32);
        const vsize = Math.ceil(m / 32);
        for (let i = 0; i < hsize; i++) {
            phc[i] = -1;
            mhc[i] = 0;
        }
        let j = 0;
        for (; j < vsize - 1; j++) {
            let mv = 0;
            let pv = -1;
            const start = j * 32;
            const vlen = Math.min(32, m) + start;
            for (let k = start; k < vlen; k++) {
                peq[b.charCodeAt(k)] |= 1 << k;
            }
            for (let i = 0; i < n; i++) {
                const eq = peq[a.charCodeAt(i)];
                const pb = (phc[(i / 32) | 0] >>> i) & 1;
                const mb = (mhc[(i / 32) | 0] >>> i) & 1;
                const xv = eq | mv;
                const xh = ((((eq | mb) & pv) + pv) ^ pv) | eq | mb;
                let ph = mv | ~(xh | pv);
                let mh = pv & xh;
                if ((ph >>> 31) ^ pb) {
                    phc[(i / 32) | 0] ^= 1 << i;
                }
                if ((mh >>> 31) ^ mb) {
                    mhc[(i / 32) | 0] ^= 1 << i;
                }
                ph = (ph << 1) | pb;
                mh = (mh << 1) | mb;
                pv = mh | ~(xv | ph);
                mv = ph & xv;
            }
            for (let k = start; k < vlen; k++) {
                peq[b.charCodeAt(k)] = 0;
            }
        }
        let mv = 0;
        let pv = -1;
        const start = j * 32;
        const vlen = Math.min(32, m - start) + start;
        for (let k = start; k < vlen; k++) {
            peq[b.charCodeAt(k)] |= 1 << k;
        }
        let score = m;
        for (let i = 0; i < n; i++) {
            const eq = peq[a.charCodeAt(i)];
            const pb = (phc[(i / 32) | 0] >>> i) & 1;
            const mb = (mhc[(i / 32) | 0] >>> i) & 1;
            const xv = eq | mv;
            const xh = ((((eq | mb) & pv) + pv) ^ pv) | eq | mb;
            let ph = mv | ~(xh | pv);
            let mh = pv & xh;
            score += (ph >>> (m - 1)) & 1;
            score -= (mh >>> (m - 1)) & 1;
            if ((ph >>> 31) ^ pb) {
                phc[(i / 32) | 0] ^= 1 << i;
            }
            if ((mh >>> 31) ^ mb) {
                mhc[(i / 32) | 0] ^= 1 << i;
            }
            ph = (ph << 1) | pb;
            mh = (mh << 1) | mb;
            pv = mh | ~(xv | ph);
            mv = ph & xv;
        }
        for (let k = start; k < vlen; k++) {
            peq[b.charCodeAt(k)] = 0;
        }
        return score;
    };
    const distance = (a, b) => {
        if (a.length < b.length) {
            const tmp = b;
            b = a;
            a = tmp;
        }
        if (b.length === 0) {
            return a.length;
        }
        if (a.length <= 32) {
            return myers_32(a, b);
        }
        return myers_x(a, b);
    };
    const closest = (str, arr) => {
        let min_distance = Infinity;
        let min_index = 0;
        for (let i = 0; i < arr.length; i++) {
            const dist = distance(str, arr[i]);
            if (dist < min_distance) {
                min_distance = dist;
                min_index = i;
            }
        }
        return arr[min_index];
    };

    var mod = /*#__PURE__*/Object.freeze({
        __proto__: null,
        closest: closest,
        distance: distance
    });

    var require$$0 = /*@__PURE__*/getAugmentedNamespace(mod);

    var hasRequiredLevenshtein;

    function requireLevenshtein () {
    	if (hasRequiredLevenshtein) return levenshtein$1.exports;
    	hasRequiredLevenshtein = 1;
    	(function (module, exports) {
    		(function() {
    		  
    		  var collator;
    		  try {
    		    collator = (typeof Intl !== "undefined" && typeof Intl.Collator !== "undefined") ? Intl.Collator("generic", { sensitivity: "base" }) : null;
    		  } catch (err){
    		    console.log("Collator could not be initialized and wouldn't be used");
    		  }

    		  var levenshtein = require$$0;

    		  // arrays to re-use
    		  var prevRow = [],
    		    str2Char = [];
    		  
    		  /**
    		   * Based on the algorithm at http://en.wikipedia.org/wiki/Levenshtein_distance.
    		   */
    		  var Levenshtein = {
    		    /**
    		     * Calculate levenshtein distance of the two strings.
    		     *
    		     * @param str1 String the first string.
    		     * @param str2 String the second string.
    		     * @param [options] Additional options.
    		     * @param [options.useCollator] Use `Intl.Collator` for locale-sensitive string comparison.
    		     * @return Integer the levenshtein distance (0 and above).
    		     */
    		    get: function(str1, str2, options) {
    		      var useCollator = (options && collator && options.useCollator);
    		      
    		      if (useCollator) {
    		        var str1Len = str1.length,
    		          str2Len = str2.length;
    		        
    		        // base cases
    		        if (str1Len === 0) return str2Len;
    		        if (str2Len === 0) return str1Len;

    		        // two rows
    		        var curCol, nextCol, i, j, tmp;

    		        // initialise previous row
    		        for (i=0; i<str2Len; ++i) {
    		          prevRow[i] = i;
    		          str2Char[i] = str2.charCodeAt(i);
    		        }
    		        prevRow[str2Len] = str2Len;

    		        var strCmp;
    		        // calculate current row distance from previous row using collator
    		        for (i = 0; i < str1Len; ++i) {
    		          nextCol = i + 1;

    		          for (j = 0; j < str2Len; ++j) {
    		            curCol = nextCol;

    		            // substution
    		            strCmp = 0 === collator.compare(str1.charAt(i), String.fromCharCode(str2Char[j]));

    		            nextCol = prevRow[j] + (strCmp ? 0 : 1);

    		            // insertion
    		            tmp = curCol + 1;
    		            if (nextCol > tmp) {
    		              nextCol = tmp;
    		            }
    		            // deletion
    		            tmp = prevRow[j + 1] + 1;
    		            if (nextCol > tmp) {
    		              nextCol = tmp;
    		            }

    		            // copy current col value into previous (in preparation for next iteration)
    		            prevRow[j] = curCol;
    		          }

    		          // copy last col value into previous (in preparation for next iteration)
    		          prevRow[j] = nextCol;
    		        }
    		        return nextCol;
    		      }
    		      return levenshtein.distance(str1, str2);
    		    }

    		  };

    		  // amd
    		  if (module !== null && 'object' !== "undefined" && module.exports === exports) {
    		    module.exports = Levenshtein;
    		  }
    		  // web worker
    		  else if (typeof self !== "undefined" && typeof self.postMessage === 'function' && typeof self.importScripts === 'function') {
    		    self.Levenshtein = Levenshtein;
    		  }
    		  // browser main thread
    		  else if (typeof window !== "undefined" && window !== null) {
    		    window.Levenshtein = Levenshtein;
    		  }
    		}()); 
    	} (levenshtein$1, levenshtein$1.exports));
    	return levenshtein$1.exports;
    }

    var levenshteinExports = requireLevenshtein();
    var levenshtein = /*@__PURE__*/getDefaultExportFromCjs(levenshteinExports);

    // const levenshtein = require('fast-levenshtein');
    const RedefineableTokenSentinel = new Token(TokenType.AT, "", 0, 0, 0);
    class Environment {
        constructor(source, enclosing, names) {
            this.source = source;
            this.enclosing = enclosing;
            this.names = names;
            this.functions = new Set();
            this.moduleBindings = new Set();
        }
        /*
        * Does a full lookup up the environment chain for a name.
        * Returns the distance of the name from the current environment.
        * If name isn't found, return -1.
        * */
        lookupName(identifier) {
            const name = identifier.lexeme;
            let distance = 0;
            let curr = this;
            while (curr !== null) {
                if (curr.names.has(name)) {
                    break;
                }
                distance += 1;
                curr = curr.enclosing;
            }
            return (curr === null) ? -1 : distance;
        }
        /* Looks up the name but only for the current environment. */
        lookupNameCurrentEnv(identifier) {
            return this.names.get(identifier.lexeme);
        }
        lookupNameCurrentEnvWithError(identifier) {
            if (this.lookupName(identifier) < 0) {
                throw new exports.ResolverErrors.NameNotFoundError(identifier.line, identifier.col, this.source, identifier.indexInSource, identifier.indexInSource + identifier.lexeme.length, this.suggestName(identifier));
            }
        }
        lookupNameParentEnvWithError(identifier) {
            const name = identifier.lexeme;
            let parent = this.enclosing;
            if (parent === null || !parent.names.has(name)) {
                throw new exports.ResolverErrors.NameNotFoundError(identifier.line, identifier.col, this.source, identifier.indexInSource, identifier.indexInSource + name.length, this.suggestName(identifier));
            }
        }
        declareName(identifier) {
            const lookup = this.lookupNameCurrentEnv(identifier);
            if (lookup !== undefined && lookup !== RedefineableTokenSentinel) {
                throw new exports.ResolverErrors.NameReassignmentError(identifier.line, identifier.col, this.source, identifier.indexInSource, identifier.indexInSource + identifier.lexeme.length, lookup);
            }
            this.names.set(identifier.lexeme, identifier);
        }
        // Same as declareName but allowed to re-declare later.
        declarePlaceholderName(identifier) {
            const lookup = this.lookupNameCurrentEnv(identifier);
            if (lookup !== undefined) {
                throw new exports.ResolverErrors.NameReassignmentError(identifier.line, identifier.col, this.source, identifier.indexInSource, identifier.indexInSource + identifier.lexeme.length, lookup);
            }
            this.names.set(identifier.lexeme, RedefineableTokenSentinel);
        }
        suggestNameCurrentEnv(identifier) {
            const name = identifier.lexeme;
            let minDistance = Infinity;
            let minName = null;
            for (const declName of this.names.keys()) {
                const dist = levenshtein.get(name, declName);
                if (dist < minDistance) {
                    minDistance = dist;
                    minName = declName;
                }
            }
            return minName;
        }
        /*
        * Finds name closest to name in all environments up to builtin environment.
        * Calculated using min levenshtein distance.
        * */
        suggestName(identifier) {
            const name = identifier.lexeme;
            let minDistance = Infinity;
            let minName = null;
            let curr = this;
            while (curr !== null) {
                for (const declName of curr.names.keys()) {
                    const dist = levenshtein.get(name, declName);
                    if (dist < minDistance) {
                        minDistance = dist;
                        minName = declName;
                    }
                }
                curr = curr.enclosing;
            }
            if (minDistance >= 4) {
                // This is pretty far, so just return null
                return null;
            }
            return minName;
        }
    }
    class Resolver {
        constructor(source, ast) {
            this.source = source;
            this.ast = ast;
            // The global environment
            this.environment = new Environment(source, null, new Map([
                // misc library
                ["_int", new Token(TokenType.NAME, "_int", 0, 0, 0)],
                ["_int_from_string", new Token(TokenType.NAME, "_int_from_string", 0, 0, 0)],
                ["abs", new Token(TokenType.NAME, "abs", 0, 0, 0)],
                ["char_at", new Token(TokenType.NAME, "char_at", 0, 0, 0)],
                ["error", new Token(TokenType.NAME, "error", 0, 0, 0)],
                ["input", new Token(TokenType.NAME, "input", 0, 0, 0)],
                ["isinstance", new Token(TokenType.NAME, "isinstance", 0, 0, 0)],
                ["max", new Token(TokenType.NAME, "max", 0, 0, 0)],
                ["min", new Token(TokenType.NAME, "min", 0, 0, 0)],
                ["print", new Token(TokenType.NAME, "print", 0, 0, 0)],
                ["random_random", new Token(TokenType.NAME, "random_random", 0, 0, 0)],
                ["round", new Token(TokenType.NAME, "round", 0, 0, 0)],
                ["str", new Token(TokenType.NAME, "str", 0, 0, 0)],
                ["time_time", new Token(TokenType.NAME, "time_time", 0, 0, 0)],
                // math constants
                ["math_pi", new Token(TokenType.NAME, "math_pi", 0, 0, 0)],
                ["math_e", new Token(TokenType.NAME, "math_e", 0, 0, 0)],
                ["math_inf", new Token(TokenType.NAME, "math_inf", 0, 0, 0)],
                ["math_nan", new Token(TokenType.NAME, "math_nan", 0, 0, 0)],
                ["math_tau", new Token(TokenType.NAME, "math_tau", 0, 0, 0)],
                // math library
                ["math_acos", new Token(TokenType.NAME, "math_acos", 0, 0, 0)],
                ["math_acosh", new Token(TokenType.NAME, "math_acosh", 0, 0, 0)],
                ["math_asin", new Token(TokenType.NAME, "math_asin", 0, 0, 0)],
                ["math_asinh", new Token(TokenType.NAME, "math_asinh", 0, 0, 0)],
                ["math_atan", new Token(TokenType.NAME, "math_atan", 0, 0, 0)],
                ["math_atan2", new Token(TokenType.NAME, "math_atan2", 0, 0, 0)],
                ["math_atanh", new Token(TokenType.NAME, "math_atanh", 0, 0, 0)],
                ["math_cbrt", new Token(TokenType.NAME, "math_cbrt", 0, 0, 0)],
                ["math_ceil", new Token(TokenType.NAME, "math_ceil", 0, 0, 0)],
                ["math_comb", new Token(TokenType.NAME, "math_comb", 0, 0, 0)],
                ["math_copysign", new Token(TokenType.NAME, "math_copysign", 0, 0, 0)],
                ["math_cos", new Token(TokenType.NAME, "math_cos", 0, 0, 0)],
                ["math_cosh", new Token(TokenType.NAME, "math_cosh", 0, 0, 0)],
                ["math_degrees", new Token(TokenType.NAME, "math_degrees", 0, 0, 0)],
                ["math_erf", new Token(TokenType.NAME, "math_erf", 0, 0, 0)],
                ["math_erfc", new Token(TokenType.NAME, "math_erfc", 0, 0, 0)],
                ["math_exp", new Token(TokenType.NAME, "math_exp", 0, 0, 0)],
                ["math_exp2", new Token(TokenType.NAME, "math_exp2", 0, 0, 0)],
                ["math_expm1", new Token(TokenType.NAME, "math_expm1", 0, 0, 0)],
                ["math_fabs", new Token(TokenType.NAME, "math_fabs", 0, 0, 0)],
                ["math_factorial", new Token(TokenType.NAME, "math_factorial", 0, 0, 0)],
                ["math_floor", new Token(TokenType.NAME, "math_floor", 0, 0, 0)],
                ["math_fma", new Token(TokenType.NAME, "math_fma", 0, 0, 0)],
                ["math_fmod", new Token(TokenType.NAME, "math_fmod", 0, 0, 0)],
                ["math_gamma", new Token(TokenType.NAME, "math_gamma", 0, 0, 0)],
                ["math_gcd", new Token(TokenType.NAME, "math_gcd", 0, 0, 0)],
                ["math_isfinite", new Token(TokenType.NAME, "math_isfinite", 0, 0, 0)],
                ["math_isinf", new Token(TokenType.NAME, "math_isinf", 0, 0, 0)],
                ["math_isnan", new Token(TokenType.NAME, "math_isnan", 0, 0, 0)],
                ["math_isqrt", new Token(TokenType.NAME, "math_isqrt", 0, 0, 0)],
                ["math_lcm", new Token(TokenType.NAME, "math_lcm", 0, 0, 0)],
                ["math_ldexp", new Token(TokenType.NAME, "math_ldexp", 0, 0, 0)],
                ["math_lgamma", new Token(TokenType.NAME, "math_lgamma", 0, 0, 0)],
                ["math_log", new Token(TokenType.NAME, "math_log", 0, 0, 0)],
                ["math_log10", new Token(TokenType.NAME, "math_log10", 0, 0, 0)],
                ["math_log1p", new Token(TokenType.NAME, "math_log1p", 0, 0, 0)],
                ["math_log2", new Token(TokenType.NAME, "math_log2", 0, 0, 0)],
                ["math_nextafter", new Token(TokenType.NAME, "math_nextafter", 0, 0, 0)],
                ["math_perm", new Token(TokenType.NAME, "math_perm", 0, 0, 0)],
                ["math_pow", new Token(TokenType.NAME, "math_pow", 0, 0, 0)],
                ["math_radians", new Token(TokenType.NAME, "math_radians", 0, 0, 0)],
                ["math_remainder", new Token(TokenType.NAME, "math_remainder", 0, 0, 0)],
                ["math_sin", new Token(TokenType.NAME, "math_sin", 0, 0, 0)],
                ["math_sinh", new Token(TokenType.NAME, "math_sinh", 0, 0, 0)],
                ["math_sqrt", new Token(TokenType.NAME, "math_sqrt", 0, 0, 0)],
                ["math_tan", new Token(TokenType.NAME, "math_tan", 0, 0, 0)],
                ["math_tanh", new Token(TokenType.NAME, "math_tanh", 0, 0, 0)],
                ["math_trunc", new Token(TokenType.NAME, "math_trunc", 0, 0, 0)],
                ["math_ulp", new Token(TokenType.NAME, "math_ulp", 0, 0, 0)]
            ]));
            this.functionScope = null;
        }
        resolve(stmt) {
            var _a;
            if (stmt === null) {
                return;
            }
            if (stmt instanceof Array) {
                // Resolve all top-level functions first. Python allows functions declared after
                // another function to be used in that function.
                for (const st of stmt) {
                    if (st instanceof StmtNS.FunctionDef) {
                        (_a = this.environment) === null || _a === void 0 ? void 0 : _a.declarePlaceholderName(st.name);
                    }
                }
                for (const st of stmt) {
                    st.accept(this);
                }
            }
            else {
                stmt.accept(this);
            }
        }
        varDeclNames(names) {
            const res = Array.from(names.values())
                .filter(name => {
                var _a, _b;
                return (
                // Filter out functions and module bindings.
                // Those will be handled separately, so they don't
                // need to be hoisted.
                !((_a = this.environment) === null || _a === void 0 ? void 0 : _a.functions.has(name.lexeme))
                    && !((_b = this.environment) === null || _b === void 0 ? void 0 : _b.moduleBindings.has(name.lexeme)));
            });
            return res.length === 0 ? null : res;
        }
        functionVarConstraint(identifier) {
            var _a;
            if (this.functionScope == null) {
                return;
            }
            let curr = this.environment;
            while (curr !== this.functionScope) {
                if (curr !== null && curr.names.has(identifier.lexeme)) {
                    const token = curr.names.get(identifier.lexeme);
                    if (token === undefined) {
                        throw new Error("placeholder error");
                    }
                    throw new exports.ResolverErrors.NameReassignmentError(identifier.line, identifier.col, this.source, identifier.indexInSource, identifier.indexInSource + identifier.lexeme.length, token);
                }
                curr = (_a = curr === null || curr === void 0 ? void 0 : curr.enclosing) !== null && _a !== void 0 ? _a : null;
            }
        }
        //// STATEMENTS
        visitFileInputStmt(stmt) {
            // Create a new environment.
            const oldEnv = this.environment;
            this.environment = new Environment(this.source, this.environment, new Map());
            this.resolve(stmt.statements);
            // Grab identifiers from that new environment. That are NOT functions.
            // stmt.varDecls = this.varDeclNames(this.environment.names)
            this.environment = oldEnv;
        }
        visitIndentCreation(stmt) {
            // Create a new environment
            this.environment = new Environment(this.source, this.environment, new Map());
        }
        visitDedentCreation(stmt) {
            var _a;
            // Switch to the previous environment.
            if (((_a = this.environment) === null || _a === void 0 ? void 0 : _a.enclosing) !== undefined) {
                this.environment = this.environment.enclosing;
            }
        }
        visitFunctionDefStmt(stmt) {
            var _a, _b;
            (_a = this.environment) === null || _a === void 0 ? void 0 : _a.declareName(stmt.name);
            (_b = this.environment) === null || _b === void 0 ? void 0 : _b.functions.add(stmt.name.lexeme);
            // Create a new environment.
            // const oldEnv = this.environment;
            // Assign the parameters to the new environment.
            const newEnv = new Map(stmt.parameters.map(param => [param.lexeme, param]));
            this.environment = new Environment(this.source, this.environment, newEnv);
            // const params = new Map(
            //     stmt.parameters.map(param => [param.lexeme, param])
            // );
            // if (this.environment !== null) {
            //     this.environment.names = params;
            // }
            this.functionScope = this.environment;
            this.resolve(stmt.body);
            // Grab identifiers from that new environment. That are NOT functions.
            // stmt.varDecls = this.varDeclNames(this.environment.names)
            // Restore old environment
            // this.environment = oldEnv;
        }
        visitAnnAssignStmt(stmt) {
            var _a;
            this.resolve(stmt.ann);
            this.resolve(stmt.value);
            this.functionVarConstraint(stmt.name);
            (_a = this.environment) === null || _a === void 0 ? void 0 : _a.declareName(stmt.name);
        }
        visitAssignStmt(stmt) {
            var _a;
            this.resolve(stmt.value);
            this.functionVarConstraint(stmt.name);
            (_a = this.environment) === null || _a === void 0 ? void 0 : _a.declareName(stmt.name);
        }
        visitAssertStmt(stmt) {
            this.resolve(stmt.value);
        }
        visitForStmt(stmt) {
            var _a;
            (_a = this.environment) === null || _a === void 0 ? void 0 : _a.declareName(stmt.target);
            this.resolve(stmt.iter);
            this.resolve(stmt.body);
        }
        visitIfStmt(stmt) {
            this.resolve(stmt.condition);
            this.resolve(stmt.body);
            this.resolve(stmt.elseBlock);
        }
        // @TODO we need to treat all global statements as variable declarations in the global
        // scope.
        visitGlobalStmt(stmt) {
            // Do nothing because global can also be declared in our
            // own scope.
        }
        // @TODO nonlocals mean that any variable following that name in the current env
        // should not create a variable declaration, but instead point to an outer variable.
        visitNonLocalStmt(stmt) {
            var _a;
            (_a = this.environment) === null || _a === void 0 ? void 0 : _a.lookupNameParentEnvWithError(stmt.name);
        }
        visitReturnStmt(stmt) {
            if (stmt.value !== null) {
                this.resolve(stmt.value);
            }
        }
        visitWhileStmt(stmt) {
            this.resolve(stmt.condition);
            this.resolve(stmt.body);
        }
        visitSimpleExprStmt(stmt) {
            this.resolve(stmt.expression);
        }
        visitFromImportStmt(stmt) {
            var _a, _b;
            for (const name of stmt.names) {
                (_a = this.environment) === null || _a === void 0 ? void 0 : _a.declareName(name);
                (_b = this.environment) === null || _b === void 0 ? void 0 : _b.moduleBindings.add(name.lexeme);
            }
        }
        visitContinueStmt(stmt) {
        }
        visitBreakStmt(stmt) {
        }
        visitPassStmt(stmt) {
        }
        //// EXPRESSIONS
        visitVariableExpr(expr) {
            var _a;
            (_a = this.environment) === null || _a === void 0 ? void 0 : _a.lookupNameCurrentEnvWithError(expr.name);
        }
        visitLambdaExpr(expr) {
            // Create a new environment.
            const oldEnv = this.environment;
            // Assign the parameters to the new environment.
            const newEnv = new Map(expr.parameters.map(param => [param.lexeme, param]));
            this.environment = new Environment(this.source, this.environment, newEnv);
            this.resolve(expr.body);
            // Restore old environment
            this.environment = oldEnv;
        }
        visitMultiLambdaExpr(expr) {
            // Create a new environment.
            const oldEnv = this.environment;
            // Assign the parameters to the new environment.
            const newEnv = new Map(expr.parameters.map(param => [param.lexeme, param]));
            this.environment = new Environment(this.source, this.environment, newEnv);
            this.resolve(expr.body);
            // Grab identifiers from that new environment.
            expr.varDecls = Array.from(this.environment.names.values());
            // Restore old environment
            this.environment = oldEnv;
        }
        visitUnaryExpr(expr) {
            this.resolve(expr.right);
        }
        visitGroupingExpr(expr) {
            this.resolve(expr.expression);
        }
        visitBinaryExpr(expr) {
            this.resolve(expr.left);
            this.resolve(expr.right);
        }
        visitBoolOpExpr(expr) {
            this.resolve(expr.left);
            this.resolve(expr.right);
        }
        visitCompareExpr(expr) {
            this.resolve(expr.left);
            this.resolve(expr.right);
        }
        visitCallExpr(expr) {
            this.resolve(expr.callee);
            this.resolve(expr.args);
        }
        visitTernaryExpr(expr) {
            this.resolve(expr.predicate);
            this.resolve(expr.consequent);
            this.resolve(expr.alternative);
        }
        visitNoneExpr(expr) {
        }
        visitLiteralExpr(expr) {
        }
        visitBigIntLiteralExpr(expr) {
        }
        visitComplexExpr(expr) {
        }
    }

    function runCSEMachine(program, context, options = {}) {
        const result = evaluate(program, context, options);
        return CSEResultPromise(context, result);
    }

    /**
     * Generic Conductor Error.
     */
    class ConductorError extends Error {
        constructor(message) {
            super(message);
            this.name = "ConductorError";
            this.errorType = "__unknown" /* ErrorType.UNKNOWN */;
        }
    }

    /**
     * Conductor internal error, probably caused by developer oversight.
     */
    class ConductorInternalError extends ConductorError {
        constructor(message) {
            super(message);
            this.name = "ConductorInternalError";
            this.errorType = "__internal" /* ErrorType.INTERNAL */;
        }
    }

    class BasicEvaluator {
        startEvaluator(entryPoint) {
            return __awaiter(this, void 0, void 0, function* () {
                const initialChunk = yield this.conductor.requestFile(entryPoint);
                if (!initialChunk)
                    throw new ConductorInternalError("Cannot load entrypoint file");
                yield this.evaluateFile(entryPoint, initialChunk);
                while (true) {
                    const chunk = yield this.conductor.requestChunk();
                    yield this.evaluateChunk(chunk);
                }
            });
        }
        /**
         * Evaluates a file.
         * @param fileName The name of the file to be evaluated.
         * @param fileContent The content of the file to be evaluated.
         * @returns A promise that resolves when the evaluation is complete.
         */
        evaluateFile(fileName, fileContent) {
            return __awaiter(this, void 0, void 0, function* () {
                return this.evaluateChunk(fileContent);
            });
        }
        constructor(conductor) {
            this.conductor = conductor;
        }
    }

    /**
     * Imports an external plugin from a given location.
     * @param location Where to find the external plugin.
     * @returns A promise resolving to the imported plugin.
     */
    function importExternalPlugin(location) {
        return __awaiter(this, void 0, void 0, function* () {
            const plugin = (yield import(/* webpackIgnore: true */ location)).plugin;
            // TODO: verify it is actually a plugin
            return plugin;
        });
    }

    /**
     * Imports an external module from a given location.
     * @param location Where to find the external module.
     * @returns A promise resolving to the imported module.
     */
    function importExternalModule(location) {
        return __awaiter(this, void 0, void 0, function* () {
            const plugin = yield importExternalPlugin(location);
            // TODO: additional verification it is a module
            return plugin;
        });
    }

    class Channel {
        send(message, transfer) {
            this.__verifyAlive();
            this.__port.postMessage(message, transfer !== null && transfer !== void 0 ? transfer : []);
        }
        subscribe(subscriber) {
            this.__verifyAlive();
            this.__subscribers.add(subscriber);
            if (this.__waitingMessages) {
                for (const data of this.__waitingMessages) {
                    subscriber(data);
                }
                delete this.__waitingMessages;
            }
        }
        unsubscribe(subscriber) {
            this.__verifyAlive();
            this.__subscribers.delete(subscriber);
        }
        close() {
            var _a;
            this.__verifyAlive();
            this.__isAlive = false;
            (_a = this.__port) === null || _a === void 0 ? void 0 : _a.close();
        }
        /**
         * Check if this Channel is allowed to be used.
         * @throws Throws an error if the Channel has been closed.
         */
        __verifyAlive() {
            if (!this.__isAlive)
                throw new ConductorInternalError(`Channel ${this.name} has been closed`);
        }
        /**
         * Dispatch some data to subscribers.
         * @param data The data to be dispatched to subscribers.
         */
        __dispatch(data) {
            this.__verifyAlive();
            if (this.__waitingMessages) {
                this.__waitingMessages.push(data);
            }
            else {
                for (const subscriber of this.__subscribers) {
                    subscriber(data);
                }
            }
        }
        /**
         * Listens to the port's message event, and starts the port.
         * Messages will be buffered until the first subscriber listens to the Channel.
         * @param port The MessagePort to listen to.
         */
        listenToPort(port) {
            port.addEventListener("message", e => this.__dispatch(e.data));
            port.start();
        }
        /**
         * Replaces the underlying MessagePort of this Channel and closes it, and starts the new port.
         * @param port The new port to use.
         */
        replacePort(port) {
            var _a;
            this.__verifyAlive();
            (_a = this.__port) === null || _a === void 0 ? void 0 : _a.close();
            this.__port = port;
            this.listenToPort(port);
        }
        constructor(name, port) {
            /** The callbacks subscribed to this Channel. */
            this.__subscribers = new Set(); // TODO: use WeakRef? but callbacks tend to be thrown away and leaking is better than incorrect behaviour
            /** Is the Channel allowed to be used? */
            this.__isAlive = true;
            this.__waitingMessages = [];
            this.name = name;
            this.replacePort(port);
        }
    }

    /**
     * A stack-based queue implementation.
     * `push` and `pop` run in amortized constant time.
     */
    class Queue {
        constructor() {
            /** The output stack. */
            this.__s1 = [];
            /** The input stack. */
            this.__s2 = [];
        }
        /**
         * Adds an item to the queue.
         * @param item The item to be added to the queue.
         */
        push(item) {
            this.__s2.push(item);
        }
        /**
         * Removes an item from the queue.
         * @returns The item removed from the queue.
         * @throws If the queue is empty.
         */
        pop() {
            if (this.__s1.length === 0) {
                if (this.__s2.length === 0)
                    throw new Error("queue is empty");
                let temp = this.__s1;
                this.__s1 = this.__s2.reverse();
                this.__s2 = temp;
            }
            return this.__s1.pop(); // as the length is nonzero
        }
        /**
         * The length of the queue.
         */
        get length() {
            return this.__s1.length + this.__s2.length;
        }
        /**
         * Makes a copy of the queue.
         * @returns A copy of the queue.
         */
        clone() {
            const newQueue = new Queue();
            newQueue.__s1 = [...this.__s1];
            newQueue.__s2 = [...this.__s2];
            return newQueue;
        }
    }

    class MessageQueue {
        push(item) {
            if (this.__promiseQueue.length !== 0)
                this.__promiseQueue.pop()(item);
            else
                this.__inputQueue.push(item);
        }
        pop() {
            return __awaiter(this, void 0, void 0, function* () {
                if (this.__inputQueue.length !== 0)
                    return this.__inputQueue.pop();
                return new Promise((resolve, _reject) => {
                    this.__promiseQueue.push(resolve);
                });
            });
        }
        tryPop() {
            if (this.__inputQueue.length !== 0)
                return this.__inputQueue.pop();
            return undefined;
        }
        constructor() {
            this.__inputQueue = new Queue();
            this.__promiseQueue = new Queue();
            this.push = this.push.bind(this);
        }
    }

    class ChannelQueue {
        receive() {
            return __awaiter(this, void 0, void 0, function* () {
                return this.__messageQueue.pop();
            });
        }
        tryReceive() {
            return this.__messageQueue.tryPop();
        }
        send(message, transfer) {
            this.__channel.send(message, transfer);
        }
        close() {
            this.__channel.unsubscribe(this.__messageQueue.push);
        }
        constructor(channel) {
            this.__messageQueue = new MessageQueue();
            this.name = channel.name;
            this.__channel = channel;
            this.__channel.subscribe(this.__messageQueue.push);
        }
    }

    class Conduit {
        __negotiateChannel(channelName) {
            const { port1, port2 } = new MessageChannel();
            const channel = new Channel(channelName, port1);
            this.__link.postMessage([channelName, port2], [port2]); // TODO: update communication protocol?
            this.__channels.set(channelName, channel);
        }
        __verifyAlive() {
            if (!this.__alive)
                throw new ConductorInternalError("Conduit already terminated");
        }
        registerPlugin(pluginClass, ...arg) {
            this.__verifyAlive();
            const attachedChannels = [];
            for (const channelName of pluginClass.channelAttach) {
                if (!this.__channels.has(channelName))
                    this.__negotiateChannel(channelName);
                attachedChannels.push(this.__channels.get(channelName)); // as the Channel has been negotiated
            }
            const plugin = new pluginClass(this, attachedChannels, ...arg);
            if (plugin.name !== undefined) {
                if (this.__pluginMap.has(plugin.name))
                    throw new ConductorInternalError(`Plugin ${plugin.name} already registered`);
                this.__pluginMap.set(plugin.name, plugin);
            }
            this.__plugins.push(plugin);
            return plugin;
        }
        unregisterPlugin(plugin) {
            var _a;
            this.__verifyAlive();
            let p = 0;
            for (let i = 0; i < this.__plugins.length; ++i) {
                if (this.__plugins[p] === plugin)
                    ++p;
                this.__plugins[i] = this.__plugins[i + p];
            }
            for (let i = this.__plugins.length - 1, e = this.__plugins.length - p; i >= e; --i) {
                delete this.__plugins[i];
            }
            if (plugin.name) {
                this.__pluginMap.delete(plugin.name);
            }
            (_a = plugin.destroy) === null || _a === void 0 ? void 0 : _a.call(plugin);
        }
        lookupPlugin(pluginName) {
            this.__verifyAlive();
            if (!this.__pluginMap.has(pluginName))
                throw new ConductorInternalError(`Plugin ${pluginName} not registered`);
            return this.__pluginMap.get(pluginName); // as the map has been checked
        }
        terminate() {
            var _a, _b, _c;
            this.__verifyAlive();
            for (const plugin of this.__plugins) {
                //this.unregisterPlugin(plugin);
                (_a = plugin.destroy) === null || _a === void 0 ? void 0 : _a.call(plugin);
            }
            (_c = (_b = this.__link).terminate) === null || _c === void 0 ? void 0 : _c.call(_b);
            this.__alive = false;
        }
        __handlePort(data) {
            const [channelName, port] = data;
            if (this.__channels.has(channelName)) { // uh-oh, we already have a port for this channel
                const channel = this.__channels.get(channelName); // as the map has been checked
                if (this.__parent) { // extract the data and discard the messageport; child's Channel will close it
                    channel.listenToPort(port);
                }
                else { // replace our messageport; Channel will close it
                    channel.replacePort(port);
                }
            }
            else { // register the new channel
                const channel = new Channel(channelName, port);
                this.__channels.set(channelName, channel);
            }
        }
        constructor(link, parent = false) {
            this.__alive = true;
            this.__channels = new Map();
            this.__pluginMap = new Map();
            this.__plugins = [];
            this.__link = link;
            link.addEventListener("message", e => this.__handlePort(e.data));
            this.__parent = parent;
        }
    }

    class RpcCallMessage {
        constructor(fn, args, invokeId) {
            this.type = 0 /* RpcMessageType.CALL */;
            this.data = { fn, args, invokeId };
        }
    }

    class RpcErrorMessage {
        constructor(invokeId, err) {
            this.type = 2 /* RpcMessageType.RETURN_ERR */;
            this.data = { invokeId, err };
        }
    }

    class RpcReturnMessage {
        constructor(invokeId, res) {
            this.type = 1 /* RpcMessageType.RETURN */;
            this.data = { invokeId, res };
        }
    }

    function makeRpc(channel, self) {
        const waiting = [];
        let invocations = 0;
        const otherCallbacks = {};
        channel.subscribe((rpcMessage) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            switch (rpcMessage.type) {
                case 0 /* RpcMessageType.CALL */:
                    {
                        const { fn, args, invokeId } = rpcMessage.data;
                        try {
                            // @ts-expect-error
                            const res = yield self[fn](...args);
                            if (invokeId > 0)
                                channel.send(new RpcReturnMessage(invokeId, res));
                        }
                        catch (err) {
                            if (invokeId > 0)
                                channel.send(new RpcErrorMessage(invokeId, err));
                        }
                        break;
                    }
                case 1 /* RpcMessageType.RETURN */:
                    {
                        const { invokeId, res } = rpcMessage.data;
                        (_b = (_a = waiting[invokeId]) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.call(_a, res);
                        delete waiting[invokeId];
                        break;
                    }
                case 2 /* RpcMessageType.RETURN_ERR */:
                    {
                        const { invokeId, err } = rpcMessage.data;
                        (_d = (_c = waiting[invokeId]) === null || _c === void 0 ? void 0 : _c[1]) === null || _d === void 0 ? void 0 : _d.call(_c, err);
                        delete waiting[invokeId];
                        break;
                    }
            }
        }));
        return new Proxy(otherCallbacks, {
            get(target, p, receiver) {
                const cb = Reflect.get(target, p, receiver);
                if (cb)
                    return cb;
                const newCallback = typeof p === "string" && p.charAt(0) === "$"
                    ? (...args) => {
                        channel.send(new RpcCallMessage(p, args, 0));
                    }
                    : (...args) => {
                        const invokeId = ++invocations;
                        channel.send(new RpcCallMessage(p, args, invokeId));
                        return new Promise((resolve, reject) => {
                            waiting[invokeId] = [resolve, reject];
                        });
                    };
                Reflect.set(target, p, newCallback, receiver);
                return newCallback;
            },
        });
    }

    /**
     * Typechecking utility decorator.
     * It is recommended that usage of this decorator is removed
     * before or during the build process, as some tools
     * (e.g. terser) do not have good support for class decorators.
     * @param _pluginClass The Class to be typechecked.
     */
    function checkIsPluginClass(_pluginClass) {
    }

    var DataType;
    (function (DataType) {
        /** The return type of functions with no returned value. As a convention, the associated JS value is undefined. */
        DataType[DataType["VOID"] = 0] = "VOID";
        /** A Boolean value. */
        DataType[DataType["BOOLEAN"] = 1] = "BOOLEAN";
        /** A numerical value. */
        DataType[DataType["NUMBER"] = 2] = "NUMBER";
        /** An immutable string of characters. */
        DataType[DataType["CONST_STRING"] = 3] = "CONST_STRING";
        /** The empty list. As a convention, the associated JS value is null. */
        DataType[DataType["EMPTY_LIST"] = 4] = "EMPTY_LIST";
        /** A pair of values. Reference type. */
        DataType[DataType["PAIR"] = 5] = "PAIR";
        /** An array of values of a single type. Reference type. */
        DataType[DataType["ARRAY"] = 6] = "ARRAY";
        /** A value that can be called with fixed arity. Reference type. */
        DataType[DataType["CLOSURE"] = 7] = "CLOSURE";
        /** An opaque value that cannot be manipulated from user code. */
        DataType[DataType["OPAQUE"] = 8] = "OPAQUE";
        /** A list (either a pair or the empty list). */
        DataType[DataType["LIST"] = 9] = "LIST";
    })(DataType || (DataType = {}));

    class AbortServiceMessage {
        constructor(minVersion) {
            this.type = 1 /* ServiceMessageType.ABORT */;
            this.data = { minVersion: minVersion };
        }
    }

    class HelloServiceMessage {
        constructor() {
            this.type = 0 /* ServiceMessageType.HELLO */;
            this.data = { version: 0 /* Constant.PROTOCOL_VERSION */ };
        }
    }

    class PluginServiceMessage {
        constructor(pluginName) {
            this.type = 3 /* ServiceMessageType.PLUGIN */;
            this.data = pluginName;
        }
    }

    let RunnerPlugin = (() => {
        let _classDecorators = [checkIsPluginClass];
        let _classDescriptor;
        let _classExtraInitializers = [];
        let _classThis;
        _classThis = class {
            requestFile(fileName) {
                return this.__fileRpc.requestFile(fileName);
            }
            requestChunk() {
                return __awaiter(this, void 0, void 0, function* () {
                    return (yield this.__chunkQueue.receive()).chunk;
                });
            }
            requestInput() {
                return __awaiter(this, void 0, void 0, function* () {
                    const { message } = yield this.__ioQueue.receive();
                    return message;
                });
            }
            tryRequestInput() {
                const out = this.__ioQueue.tryReceive();
                return out === null || out === void 0 ? void 0 : out.message;
            }
            sendOutput(message) {
                this.__ioQueue.send({ message });
            }
            sendError(error) {
                this.__errorChannel.send({ error });
            }
            updateStatus(status, isActive) {
                this.__statusChannel.send({ status, isActive });
            }
            hostLoadPlugin(pluginName) {
                this.__serviceChannel.send(new PluginServiceMessage(pluginName));
            }
            registerPlugin(pluginClass, ...arg) {
                return this.__conduit.registerPlugin(pluginClass, ...arg);
            }
            unregisterPlugin(plugin) {
                this.__conduit.unregisterPlugin(plugin);
            }
            registerModule(moduleClass) {
                if (!this.__isCompatibleWithModules)
                    throw new ConductorInternalError("Evaluator has no data interface");
                return this.registerPlugin(moduleClass, this.__evaluator);
            }
            unregisterModule(module) {
                this.unregisterPlugin(module);
            }
            importAndRegisterExternalPlugin(location, ...arg) {
                return __awaiter(this, void 0, void 0, function* () {
                    const pluginClass = yield importExternalPlugin(location);
                    return this.registerPlugin(pluginClass, ...arg);
                });
            }
            importAndRegisterExternalModule(location) {
                return __awaiter(this, void 0, void 0, function* () {
                    const moduleClass = yield importExternalModule(location);
                    return this.registerModule(moduleClass);
                });
            }
            constructor(conduit, [fileChannel, chunkChannel, serviceChannel, ioChannel, errorChannel, statusChannel], evaluatorClass) {
                var _a;
                this.name = "__runner_main" /* InternalPluginName.RUNNER_MAIN */;
                // @ts-expect-error TODO: figure proper way to typecheck this
                this.__serviceHandlers = new Map([
                    [0 /* ServiceMessageType.HELLO */, function helloServiceHandler(message) {
                            if (message.data.version < 0 /* Constant.PROTOCOL_MIN_VERSION */) {
                                this.__serviceChannel.send(new AbortServiceMessage(0 /* Constant.PROTOCOL_MIN_VERSION */));
                                console.error(`Host's protocol version (${message.data.version}) must be at least ${0 /* Constant.PROTOCOL_MIN_VERSION */}`);
                            }
                            else {
                                console.log(`Host is using protocol version ${message.data.version}`);
                            }
                        }],
                    [1 /* ServiceMessageType.ABORT */, function abortServiceHandler(message) {
                            console.error(`Host expects at least protocol version ${message.data.minVersion}, but we are on version ${0 /* Constant.PROTOCOL_VERSION */}`);
                            this.__conduit.terminate();
                        }],
                    [2 /* ServiceMessageType.ENTRY */, function entryServiceHandler(message) {
                            this.__evaluator.startEvaluator(message.data);
                        }]
                ]);
                this.__conduit = conduit;
                this.__fileRpc = makeRpc(fileChannel, {});
                this.__chunkQueue = new ChannelQueue(chunkChannel);
                this.__serviceChannel = serviceChannel;
                this.__ioQueue = new ChannelQueue(ioChannel);
                this.__errorChannel = errorChannel;
                this.__statusChannel = statusChannel;
                this.__serviceChannel.send(new HelloServiceMessage());
                this.__serviceChannel.subscribe(message => {
                    var _a;
                    (_a = this.__serviceHandlers.get(message.type)) === null || _a === void 0 ? void 0 : _a.call(this, message);
                });
                this.__evaluator = new evaluatorClass(this);
                this.__isCompatibleWithModules = (_a = this.__evaluator.hasDataInterface) !== null && _a !== void 0 ? _a : false;
            }
        };
        __setFunctionName(_classThis, "RunnerPlugin");
        (() => {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })();
        _classThis.channelAttach = ["__file_rpc" /* InternalChannelName.FILE */, "__chunk" /* InternalChannelName.CHUNK */, "__service" /* InternalChannelName.SERVICE */, "__stdio" /* InternalChannelName.STANDARD_IO */, "__error" /* InternalChannelName.ERROR */, "__status" /* InternalChannelName.STATUS */];
        (() => {
            __runInitializers(_classThis, _classExtraInitializers);
        })();
        return _classThis;
    })();

    /**
     * Initialise this runner with the evaluator to be used.
     * @param evaluatorClass The Evaluator to be used on this runner.
     * @param link The underlying communication link.
     * @returns The initialised `runnerPlugin` and `conduit`.
     */
    function initialise(evaluatorClass, link = self) {
        const conduit = new Conduit(link, false);
        const runnerPlugin = conduit.registerPlugin(RunnerPlugin, evaluatorClass);
        return { runnerPlugin, conduit };
    }

    class Context {
        constructor(program, context) {
            //public environment: Environment;
            this.errors = [];
            this.createGlobalEnvironment = () => ({
                tail: null,
                name: 'global',
                head: {},
                heap: new Heap(),
                id: '-1'
            });
            this.createEmptyRuntime = () => ({
                break: false,
                debuggerOn: true,
                isRunning: false,
                environmentTree: new EnvTree(),
                environments: [],
                value: undefined,
                nodes: [],
                control: null,
                stash: null,
                objectCount: 0,
                envSteps: -1,
                envStepsTotal: 0,
                breakpointSteps: [],
                changepointSteps: []
            });
            this.control = new Control(program);
            this.stash = new Stash();
            this.runtime = this.createEmptyRuntime();
            //this.environment = createProgramEnvironment(context || this, false);
            if (this.runtime.environments.length === 0) {
                const globalEnvironment = this.createGlobalEnvironment();
                this.runtime.environments.push(globalEnvironment);
                this.runtime.environmentTree.insert(globalEnvironment);
            }
            this.nativeStorage = {
                builtins: new Map(),
                previousProgramsIdentifiers: new Set(),
                operators: new Map(),
                maxExecTime: 1000,
                evaller: null,
                loadedModules: {},
                loadedModuleTypes: {}
            };
        }
        reset(program) {
            this.control = new Control(program);
            this.stash = new Stash();
            //this.environment = createProgramEnvironment(this, false);
            this.errors = [];
        }
        copy() {
            const newContext = new Context();
            newContext.control = this.control.copy();
            newContext.stash = this.stash.copy();
            //newContext.environments = this.copyEnvironment(this.environments);
            return newContext;
        }
        copyEnvironment(env) {
            const newTail = env.tail ? this.copyEnvironment(env.tail) : null;
            const newEnv = {
                id: env.id,
                name: env.name,
                tail: newTail,
                head: Object.assign({}, env.head),
                heap: new Heap(),
                callExpression: env.callExpression,
                thisContext: env.thisContext
            };
            return newEnv;
        }
    }
    class EnvTree {
        constructor() {
            this._root = null;
            this.map = new Map();
        }
        get root() {
            return this._root;
        }
        insert(environment) {
            const tailEnvironment = environment.tail;
            if (tailEnvironment === null) {
                if (this._root === null) {
                    this._root = new EnvTreeNode(environment, null);
                    this.map.set(environment, this._root);
                }
            }
            else {
                const parentNode = this.map.get(tailEnvironment);
                if (parentNode) {
                    const childNode = new EnvTreeNode(environment, parentNode);
                    parentNode.addChild(childNode);
                    this.map.set(environment, childNode);
                }
            }
        }
        getTreeNode(environment) {
            return this.map.get(environment);
        }
    }
    class EnvTreeNode {
        constructor(environment, parent) {
            this.environment = environment;
            this.parent = parent;
            this._children = [];
        }
        get children() {
            return this._children;
        }
        resetChildren(newChildren) {
            this.clearChildren();
            this.addChildren(newChildren);
            newChildren.forEach(c => (c.parent = this));
        }
        clearChildren() {
            this._children = [];
        }
        addChildren(newChildren) {
            this._children.push(...newChildren);
        }
        addChild(newChild) {
            this._children.push(newChild);
            return newChild;
        }
    }

    const defaultContext = new Context();
    const defaultOptions = {
        isPrelude: false,
        envSteps: 100000,
        stepLimit: 100000
    };
    class PyEvaluator extends BasicEvaluator {
        constructor(conductor) {
            super(conductor);
            this.context = defaultContext;
            this.options = defaultOptions;
        }
        evaluateChunk(chunk) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield runInContext(chunk, // Code
                    this.context, this.options);
                    this.conductor.sendOutput(`${result.representation.toString(result.value)}`);
                }
                catch (error) {
                    this.conductor.sendOutput(`Error: ${error instanceof Error ? error.message : error}`);
                }
            });
        }
    }
    // runInContext
    // IOptions
    // Context
    // BasicEvaluator;
    // IRunnerPlugin

    /* Use as a command line script */
    /* npm run start:dev -- test.py */
    /* npm run start:dev -- test.py tsc --maxErrors 1 */
    function parsePythonToEstreeAst(code, variant = 1, doValidate = false) {
        const script = code + '\n';
        const tokenizer = new Tokenizer(script);
        const tokens = tokenizer.scanEverything();
        const pyParser = new Parser(script, tokens);
        const ast = pyParser.parse();
        if (doValidate) {
            new Resolver(script, ast).resolve(ast);
        }
        const translator = new Translator(script);
        return translator.resolve(ast);
    }
    function runInContext(code_1, context_1) {
        return __awaiter(this, arguments, void 0, function* (code, context, options = {}) {
            const estreeAst = parsePythonToEstreeAst(code, 1, true);
            const result = runCSEMachine(estreeAst, context, options);
            return result;
        });
    }
    //local test only
    // const context = new Context();
    // const options: IOptions = {
    //     isPrelude: false,
    //     envSteps: 100000,
    //     stepLimit: 100000
    // };
    // import { promises as fs1 } from 'fs';
    // import * as os from 'os';
    // async function loadModulesFromServer(context: Context, baseURL: string): Promise<void> {
    //     // 先获取 modules.json 文件
    //     const modulesJsonUrl = `${baseURL}/modules.json`;
    //     const response = await fetch(modulesJsonUrl);
    //     if (!response.ok) {
    //       throw new Error(`Failed to load modules.json from ${modulesJsonUrl}`);
    //     }
    //     const modulesData: Record<string, any> = await response.json();
    //     // modulesData 假定格式为 { moduleName1: {...}, moduleName2: {...}, ... }
    //     // 遍历每个模块名，加载对应模块
    //     for (const moduleName in modulesData) {
    //       // 构造模块文件的 URL，假设文件名与模块名相同，并以 .js 结尾
    //       const moduleUrl = `${baseURL}/bundles/${moduleName}.js`;
    //       const moduleResponse = await fetch(moduleUrl);
    //       if (!moduleResponse.ok) {
    //         console.warn(`Failed to load module ${moduleName} from ${moduleUrl}`);
    //         continue;
    //       }
    //       const moduleSource = await moduleResponse.text();
    //       // 评估模块文件，获取其导出对象
    //       // 注意：这里使用 eval 仅作为示例，实际项目中应考虑安全和沙箱策略
    //     //   let moduleExports;
    //     //   try {
    //     //     moduleExports = eval(moduleSource);
    //     //   } catch (e) {
    //     //     console.error(`Error evaluating module ${moduleName}:`, e);
    //     //     continue;
    //     //   }
    //     const tmpFile = path.join(os.tmpdir(), path.basename(moduleUrl));
    //         fs1.writeFile(tmpFile, moduleSource);
    //         // 动态 import 使用 file:// 协议
    //         const moduleExports =  await import('file://' + tmpFile);
    //       // 将模块导出对象存入 nativeStorage.loadedModules
    //       context.nativeStorage.loadedModules[moduleName] = moduleExports;
    //     }
    //     console.info(context.nativeStorage);
    // }
    // const BaseParserError = ParserErrors.BaseParserError;
    // const BaseTokenizerError = TokenizerErrors.BaseTokenizerError;
    // const BaseResolverError = ResolverErrors.BaseResolverError;
    // async function getResult(code: string,
    //     context: Context,
    //     options: RecursivePartial<IOptions> = {}): Promise<Result>  {
    //     const result = ;
    //     return result;
    // }
    // if (require.main === module) {
    //     if (process.argv.length < 3) {
    //         console.error("Usage: npm run start:dev -- <python-file>");
    //         process.exit(1);
    //     }
    //     const filePath = process.argv[2];
    //     try {
    //         const code = fs.readFileSync(filePath, "utf8") + "\n";
    //         console.log(`Parsing Python file: ${filePath}`);
    //         const result = await runInContext(code, context, options);
    //         console.info(result);
    //     } catch (e) {
    //     }
    //     //console.log(process.versions.v8);
    // }
    // if (require.main === module) {
    //     (async () => {
    //       if (process.argv.length < 3) {
    //         console.error("Usage: npm run start:dev -- <python-file>");
    //         process.exit(1);
    //       }
    //       const filePath = process.argv[2];
    //       try {
    //         //await loadModulesFromServer(context, "http://localhost:8022");
    //         const code = fs.readFileSync(filePath, "utf8") + "\n";
    //         console.log(`Parsing Python file: ${filePath}`);
    //         const result = await runInContext(code, context, options);
    //         console.info(result);
    //         console.info((result as Finished).value);
    //         console.info((result as Finished).representation.toString((result as Finished).value));
    //       } catch (e) {
    //         console.error("Error:", e);
    //       }
    //     })();
    // }
    initialise(PyEvaluator);

    exports.parsePythonToEstreeAst = parsePythonToEstreeAst;
    exports.runInContext = runInContext;

}));
//# sourceMappingURL=index.js.map
