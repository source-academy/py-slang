declare module 'moo-peekable-lexer' {
    import * as moo from 'moo';
    class MooPeekableLexer implements moo.Lexer {
        constructor(options: { lexer: moo.Lexer });
        peek(): moo.Token | undefined;
        clone(): MooPeekableLexer;
        reset(chunk?: string, state?: moo.LexerState): this;
        next(): moo.Token | undefined;
        save(): moo.LexerState;
        formatError(token: moo.Token, message?: string): string;
        has(tokenType: string): boolean;
        setState(state: string): void;
        popState(): void;
        pushState(state: string): void;
        [Symbol.iterator](): Iterator<moo.Token>;
    }
    export = MooPeekableLexer;
}
