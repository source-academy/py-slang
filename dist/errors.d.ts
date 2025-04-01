import { Token } from "./tokenizer";
import { Position } from "estree";
export declare namespace TokenizerErrors {
    class BaseTokenizerError extends SyntaxError {
        line: number;
        col: number;
        loc: Position;
        constructor(message: string, line: number, col: number);
    }
    class UnknownTokenError extends BaseTokenizerError {
        constructor(token: string, line: number, col: number, source: string, current: number);
    }
    class UnterminatedStringError extends BaseTokenizerError {
        constructor(line: number, col: number, source: string, start: number, current: number);
    }
    class NonFourIndentError extends BaseTokenizerError {
        constructor(line: number, col: number, source: string, start: number);
    }
    class InvalidNumberError extends BaseTokenizerError {
        constructor(line: number, col: number, source: string, start: number, current: number);
    }
    class InconsistentIndentError extends BaseTokenizerError {
        constructor(line: number, col: number, source: string, start: number);
    }
    class ForbiddenIdentifierError extends BaseTokenizerError {
        constructor(line: number, col: number, source: string, start: number);
    }
    class ForbiddenOperatorError extends BaseTokenizerError {
        constructor(line: number, col: number, source: string, start: number, current: number);
    }
    class NonMatchingParenthesesError extends BaseTokenizerError {
        constructor(line: number, col: number, source: string, current: number);
    }
}
export declare namespace ParserErrors {
    class BaseParserError extends SyntaxError {
        line: number;
        col: number;
        loc: Position;
        constructor(message: string, line: number, col: number);
    }
    class ExpectedTokenError extends BaseParserError {
        constructor(source: string, current: Token, expected: string);
    }
    class NoElseBlockError extends BaseParserError {
        constructor(source: string, current: Token);
    }
    class GenericUnexpectedSyntaxError extends BaseParserError {
        constructor(line: number, col: number, source: string, start: number, current: number);
    }
}
export declare namespace ResolverErrors {
    class BaseResolverError extends SyntaxError {
        line: number;
        col: number;
        loc: Position;
        constructor(message: string, line: number, col: number);
    }
    class NameNotFoundError extends BaseResolverError {
        constructor(line: number, col: number, source: string, start: number, current: number, suggestion: string | null);
    }
    class NameReassignmentError extends BaseResolverError {
        constructor(line: number, col: number, source: string, start: number, current: number, oldName: Token);
    }
}
export declare namespace TranslatorErrors {
    class BaseTranslatorError extends SyntaxError {
        line: number;
        col: number;
        loc: Position;
        constructor(message: string, line: number, col: number);
    }
    class UnsupportedOperator extends BaseTranslatorError {
        constructor(line: number, col: number, source: string, start: number);
    }
}
