import { ResolverErrors } from "../resolver/errors";
import { toPythonAstAndResolve } from "./utils";

describe('Resolver Tests', () => {
    describe('Variable Resolution', () => {
        test('Unbound name should throw error', () => {
            const code = 'print(x)';
            expect(() => toPythonAstAndResolve(code, 1)).toThrow(ResolverErrors.NameNotFoundError)
        });
        
        test('Unbound name in function should throw error', () => {
            const code = `
def foo():
    print(y)
foo()
            `;
            expect(() => toPythonAstAndResolve(code, 1)).toThrow(ResolverErrors.NameNotFoundError)
        });
        test('Unbound name in nested function should throw error', () => {
            const code = `
def foo():
    def bar():
        z = 3
    print(z)
foo()
    `;
            expect(() => toPythonAstAndResolve(code, 1)).toThrow(ResolverErrors.NameNotFoundError)
        });

        test('Variable in outer scope should resolve', () => {
            const code = `
x = 10
def foo():
    print(x)
foo()
            `;
            expect(toPythonAstAndResolve(code, 1)).toMatchObject({})
        })
    })


    describe('Variant Specific Syntax', () => {
//         test('For loops throw errors for Python 1 and 2', () => {
//             const code = `
// for i in range(5):
//     print(i)
//             `;
//             expect(() => toPythonAstAndResolve(code, 1)).toThrow()
//             expect(() => toPythonAstAndResolve(code, 2)).toThrow()
//             expect(toPythonAstAndResolve(code, 3)).toMatchObject({})
//         })

        test('While loops throw errors for Python 1 and 2', () => {
            const code = `
i = 0
while i < 5:
    print(i)
            `;
            expect(() => toPythonAstAndResolve(code, 1)).toThrow()
            expect(() => toPythonAstAndResolve(code, 2)).toThrow()
            expect(toPythonAstAndResolve(code, 3)).toMatchObject({})
        })

        test('Break and continue throw errors for Python 1 and 2', () => {
            const code = `
break
`;
            const code2 = `
continue     
`
            // expect(() => toPythonAstAndResolve(code, 1)).toThrow(ResolverErrors.UnsupportedFeatureError)
            // expect(() => toPythonAstAndResolve(code, 2)).toThrow(ResolverErrors.UnsupportedFeatureError)
            expect(() => toPythonAstAndResolve(code, 3)).toThrow(ResolverErrors.InvalidSyntaxError)
            // expect(() => toPythonAstAndResolve(code2, 1)).toThrow(ResolverErrors.UnsupportedFeatureError)
            // expect(() => toPythonAstAndResolve(code2, 2)).toThrow(ResolverErrors.UnsupportedFeatureError)
            expect(() => toPythonAstAndResolve(code2, 3)).toThrow(ResolverErrors.InvalidSyntaxError)
        })

        test('Annotated assignments throw errors for Python 1, 2, 3, 4', () => {
            const code = `
x: _int = 5
            `;
            expect(() => toPythonAstAndResolve(code, 1)).toThrow(ResolverErrors.UnsupportedFeatureError)
            expect(() => toPythonAstAndResolve(code, 2)).toThrow(ResolverErrors.UnsupportedFeatureError)
            expect(() => toPythonAstAndResolve(code, 3)).toThrow(ResolverErrors.UnsupportedFeatureError)
            expect(() => toPythonAstAndResolve(code, 4)).toThrow(ResolverErrors.UnsupportedFeatureError)
            expect(toPythonAstAndResolve(code, 5)).toMatchObject({})
        })

        test('Augmented assignments throw errors for Python 1,2,3,4', () => {
            const code = `
x = 5
x += 2
x *= 2
x /= 2
x -= 2
x |= 2
x &= 2
x ^= 2
x @= 2
            `;
            expect(() => toPythonAstAndResolve(code, 1)).toThrow(ResolverErrors.UnsupportedFeatureError)
            expect(() => toPythonAstAndResolve(code, 2)).toThrow(ResolverErrors.UnsupportedFeatureError)
            expect(() => toPythonAstAndResolve(code, 3)).toThrow(ResolverErrors.UnsupportedFeatureError)
            expect(() => toPythonAstAndResolve(code, 4)).toThrow(ResolverErrors.UnsupportedFeatureError)
            expect(toPythonAstAndResolve(code, 5)).toMatchObject({})
        })

        test('Forbidden operators throw errors for Python 1,2,3,4', () => {
            const code = `
x = 5
x ^ 2
x | 2
x & 2
x @ 2
`
            expect(() => toPythonAstAndResolve(code, 1)).toThrow(ResolverErrors.UnsupportedFeatureError)
            expect(() => toPythonAstAndResolve(code, 2)).toThrow(ResolverErrors.UnsupportedFeatureError)
            expect(() => toPythonAstAndResolve(code, 3)).toThrow(ResolverErrors.UnsupportedFeatureError)
            expect(() => toPythonAstAndResolve(code, 4)).toThrow(ResolverErrors.UnsupportedFeatureError)
            expect(toPythonAstAndResolve(code, 5)).toMatchObject({})
        })

        test('Lists throw errors for Python 1 and 2', () => {
            const code = `
x = [1, 2, 3]
            `;
            expect(() => toPythonAstAndResolve(code, 1)).toThrow(ResolverErrors.UnsupportedFeatureError)
            expect(() => toPythonAstAndResolve(code, 2)).toThrow(ResolverErrors.UnsupportedFeatureError)
            expect(toPythonAstAndResolve(code, 3)).toMatchObject({})
        })
        
        test('List access throw errors for Python 1 and 2', () => {
            const code = `
x = [1, 2, 3]
print(x[0])
            `;
            expect(() => toPythonAstAndResolve(code, 1)).toThrow(ResolverErrors.UnsupportedFeatureError)
            expect(() => toPythonAstAndResolve(code, 2)).toThrow(ResolverErrors.UnsupportedFeatureError)
            expect(toPythonAstAndResolve(code, 3)).toMatchObject({})
        });

        test('List assignment throw errors for Python 1 and 2', () => {
            const code = `
x = [1, 2, 3]
x[0] = 10
            `;
            expect(() => toPythonAstAndResolve(code, 1)).toThrow(ResolverErrors.UnsupportedFeatureError)
            expect(() => toPythonAstAndResolve(code, 2)).toThrow(ResolverErrors.UnsupportedFeatureError)
            expect(toPythonAstAndResolve(code, 3)).toMatchObject({})
        });

        test('Variadic arguments throw errors for Python 1 and 2', () => {
            const code = `
def foo(*args):
    print(args)
foo(1, 2, 3)
            `;
            expect(() => toPythonAstAndResolve(code, 1)).toThrow(ResolverErrors.UnsupportedFeatureError)
            expect(() => toPythonAstAndResolve(code, 2)).toThrow(ResolverErrors.UnsupportedFeatureError)
            expect(toPythonAstAndResolve(code, 3)).toMatchObject({})
        });

        test('Variadic arguments with lambdas throw errors for Python 1 and 2', () => {
            const code = `
foo = lambda *args: args
print(foo(1, 2, 3))
            `;
            expect(() => toPythonAstAndResolve(code, 1)).toThrow(ResolverErrors.UnsupportedFeatureError)
            expect(() => toPythonAstAndResolve(code, 2)).toThrow(ResolverErrors.UnsupportedFeatureError)
            expect(toPythonAstAndResolve(code, 3)).toMatchObject({})
        });
    })
    describe('Break and Continue Syntax Errors', () => {
        test('Break outside of loop should throw syntax error', () => {
            const code = `
break
            `;
            expect(() => toPythonAstAndResolve(code, 3)).toThrow(ResolverErrors.InvalidSyntaxError)
        });

        test('Continue outside of loop should throw syntax error', () => {
            const code = `
continue
            `;
            expect(() => toPythonAstAndResolve(code, 3)).toThrow(ResolverErrors.InvalidSyntaxError)
        });
    })
})