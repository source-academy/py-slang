import {toEstreeAST} from "./utils";

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
})