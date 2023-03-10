// import {Token} from '../tokenizer';
// import {ExprNS, StmtNS} from "../ast-types";
// import {TokenType} from "../tokens";

import {toPythonAst} from "./utils";
// import FileInput = StmtNS.FileInput;
// import FromImport = StmtNS.FromImport;
// import Ternary = ExprNS.Ternary;
// import SimpleExpr = StmtNS.SimpleExpr;
// import Variable = ExprNS.Variable;
// import Literal = ExprNS.Literal;
// import Lambda = ExprNS.Lambda;
// import Binary = ExprNS.Binary;
// import FunctionDef = StmtNS.FunctionDef;
// import Pass = StmtNS.Pass;
// import If = StmtNS.If;
// import Return = StmtNS.Return;
// import Assign = StmtNS.Assign;

//@TODO all the columns offsets for tokens are off. They should be the value
// *before* the token, not *after*.

describe('Tests for Python language constructs', () => {
    describe('Script', () => {
        test('An entire Python script', () => {
            const text = `
from x import (y)
x = 1 if 2 else 3

1 is not 2
3 not in 4
y = lambda a:a

def z(a, b, c, d):
    pass

while x:
    pass

for _ in range(10):
    pass

if x:
    pass
elif y:
    pass
elif z:
    pass
else:
    pass
`;
            toPythonAst(text);
        })
    })
    describe('Imports', () => {
        test('From imports: single binding', () => {
            const text = `from x import y\n`;

            expect(toPythonAst(text)).toMatchObject({})
        })
        test('From imports: multiple binding', () => {
            const text = `from x import (a, b, c)\n`;

            expect(toPythonAst(text)).toMatchObject({})
        });
    });

    describe('Ternary', () => {
        test('Simple ternary', () => {
            const text = `x if y else 1\n`;
            expect(toPythonAst(text)).toMatchObject({})
        })
        test('Nested ternary', () => {
            const text = `1 if A else 2 if B else 3\n`;
            expect(toPythonAst(text)).toMatchObject({})
        })
    });

    describe('Lambda', () => {
        test('Simple lambda', () => {
            const text = `lambda a:a\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        test('Nested lambda', () => {
            const text = `lambda a: lambda b: b + a\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        test('Ultra nested lambda', () => {
            const text = `increment_repeater = lambda repeater: lambda f: lambda x: f(repeater(f)(x))\n`;
            expect(toPythonAst(text)).toMatchObject({})
        })
    });

    describe('Function definitions', () => {
        test('Function definition', () => {
            const text = `\
def y(a, b, c):
    pass
    pass
`
            expect(toPythonAst(text)).toMatchObject({});
        });

        test('Nested function definition', () => {
            const text = `\
def y(a, b, c):
    def z(d):
        x = 2
        return a + b + c + d
    return z
`
            expect(toPythonAst(text)).toMatchObject({});
        });
        // @TODO fix me
//         test('Function definition empty lines', () => {
//             const text = `\
// def y(a, b, c):
//     pass
//     pass
//
//     pass
// `
//             expect(toPythonAst(text)).toMatchObject(
//                 new FileInput([new FunctionDef(
//                     new Token(TokenType.NAME, 'y', 0, 5, 4),
//                     [new Token(TokenType.NAME, 'a', 0, 7, 6),
//                         new Token(TokenType.NAME, 'b', 0, 10, 9),
//                         new Token(TokenType.NAME, 'c', 0, 13, 12)],
//                     [new Pass(), new Pass()],
//                     null
//                 )], null)
//             );
//         });
    });

    describe('Conditional statements', () => {
        test('If-elif-else', () => {
            const text = `
if x:
    pass
elif y:
    pass
elif z:
    pass
else:
    pass
`;
            expect(toPythonAst(text)).toMatchObject({})
        })
    })
})