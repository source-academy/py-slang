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
            const text = `1 if a else 2 if b else 3\n`;
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
        test('If-else statement', () => {
            const text = `
if x > 10:
    print("x is greater than 10")
else:
    print("x is less than or equal to 10")
`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        test('If-elif-else statement', () => {
            const text = `
if x > 10:
    print("x is greater than 10")
elif x == 10:
    print("x is equal to 10")
else:
    print("x is less than 10")
`;
            expect(toPythonAst(text)).toMatchObject({})
        });
    });

    describe('N-base numbers', () => {
        test('Binary number', () => {
            const text = `0b101010\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        test('Octal number', () => {
            const text = `0o1234567\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        test('Hexadecimal number', () => {
            const text = `0xabcdef\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });
    });

    describe('Binary operators', () => {
        test('Addition', () => {
            const text = `1 + 1\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        test('Large Number Addition', () => {
            const text = `100000000 ** 100000000 + 1\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        test('Subtraction', () => {
            const text = `1 - 1\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        test('Multiplication', () => {
            const text = `1 * 1\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        test('Large Number Multiplication', () => {
            const text = `100000000 ** 100000000 * 5\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        test('Division', () => {
            const text = `1 / 1\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        test('Modulus', () => {
            const text = `1 % 1\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        test('Exponent', () => {
            const text = `2 ** 2\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        test('Less than', () => {
            const text = `1 < 2\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        test('Greater than', () => {
            const text = `2 > 1\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        test('Less than or equal to', () => {
            const text = `1 <= 2\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        test('Greater than or equal to', () => {
            const text = `2 >= 1\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        test('Equality', () => {
            const text = `1 == 2\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        test('Inequality', () => {
            const text = `1 != 2\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });
    });

    describe('Unary operators', () => {
        test('Negation', () => {
            const text = `-1\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        // TODO: FIX THIS
//        test('Logical NOT', () => {
//            const text = `not 1\n`;
//            expect(toPythonAst(text)).toMatchObject({})
//        });
    });

    describe('Binary logical operators', () => {
        test('Logical AND', () => {
            const text = `1 and 2\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        test('Logical OR', () => {
            const text = `1 or 2\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });
    });

    describe('Complex expressions', () => {
        test('Nested function call', () => {
            const text = `
def f1(x, y):
    return 1

def f2(x, y):
    return y

f1(f2(1, 2), 2)
`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        test('Binary operation with parentheses', () => {
            const text = `(1 + 2) * 3\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });
    });

    describe('Primitive expressions', () => {
        test('Number literal', () => {
            const text = `42\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        test('Large Number literal', () => {
            const text = `1000000000 ** 100000000\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        test('Boolean literal True', () => {
            const text = `True\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        test('Boolean literal False', () => {
            const text = `False\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });

        test('String literal', () => {
            const text = `"Hello, World!"\n`;
            expect(toPythonAst(text)).toMatchObject({})
        });
    });
});
