import { toEstreeAST, toEstreeAstAndResolve } from "./utils";

describe('Regression tests for py-slang', () => {
    test('Issue #2', () => {
        const text = `
def foo():
    pass

    pass
`;
        toEstreeAST(text);
    })
    test('Issue #5', () => {
        const text = `
print("hi")
        
print("world")
`;
        toEstreeAST(text);
    })
    test('Issue #3', () => {
        const text = `
def foo(
    a,
    b
):
    pass

    pass
`;
        toEstreeAST(text);
    })
    test('Issue #9', () => {
        const text = `
add_one = lambda : None
add_one = lambda : True
add_one = lambda : False
`;
        toEstreeAST(text);
    })

    test('Issue #35', () => {
        const text = `
def f():
    return g()

def g():
    return 3
`;
        toEstreeAstAndResolve(text);
    })
})