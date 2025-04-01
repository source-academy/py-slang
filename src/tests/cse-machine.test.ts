import { Value } from "../cse-machine/stash";
import { runCSEMachine } from "./utils";
import { toPythonString } from "../stdlib";

test('Simple tail call returns work in Python', () => {
    const code = `
def f(x, y):
    if x <= 0:
        return y
    else:
        return f(x-1, y+1)

f(5000, 5000)
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('10000');
});

test('Tail call in conditional expressions work', () => {
    const code = `
def f(x, y):
    return y if x <= 0 else f(x - 1, y + 1)

f(5000, 5000)
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('10000');
});

test('Tail call in boolean operators work', () => {
    const code = `
def f(x, y):
    if x <= 0:
        return y
    else:
        return False or f(x - 1, y + 1)

f(5000, 5000)
`;

    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('10000');
});

test('Tail call in nested mix of conditional expressions boolean operators work', () => {
    const code = `
def f(x, y):
    return y if x <= 0 else (False or f(x - 1, y + 1) if x > 0 else 'unreachable')

f(5000, 5000)
`;
    
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('10000');
});
  
test('Tail calls in arrow functions work', () => {
    const code = `
def f(x, y):
    return y if x <= 0 else f(x - 1, y + 1)

f(5000, 5000)
`;
    
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('10000');
});
  
test('Tail calls in arrow block functions work', () => {
    const code = `
def f(x, y):
    if x <= 0:
        return y
    else:
        return f(x - 1, y + 1)

f(5000, 5000)
`;
    
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('10000');
});
  
test('Tail calls in mutual recursion work', () => {
    const code = `
def f(x, y):
    if x <= 0:
        return y
    else:
        return g(x - 1, y + 1)

def g(x, y):
    if x <= 0:
        return y
    else:
        return f(x - 1, y + 1)

f(5000, 5000)
`;
    
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('10000');
});
  
test('Tail calls in mutual recursion with arrow functions work', () => {
    const code = `
def f(x, y):
    return y if x <= 0 else g(x - 1, y + 1)

def g(x, y):
    return y if x <= 0 else f(x - 1, y + 1)

f(5000, 5000)
`;
    
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('10000');
});
  
test('Tail calls in mixed tail-call/non-tail-call recursion work', () => {
    const code = `
def f(x, y, z):
    if x <= 0:
        return y
    else:
        return f(x - 1, y + f(0, z, 0), z)

f(5000, 5000, 2)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('15000');
});
  
// test('const uses block scoping instead of function scoping', () => {
//     const code = `
// def test():
//     x = True
//     if True:
//         x_local = False
//     else:
//         x_local = False
//     return x

// test()
// `;
//     const result = runCSEMachine(code);
//     expect((result as Value).value).toBe(true);
// });
  
// test('let uses block scoping instead of function scoping', () => {
//     const code = `
// def test():
//     x = True
//     if True:
//         x_local = False
//     else:
//         x_local = False
//     return x

// test()
// `;
//     const result = runCSEMachine(code);
//     expect((result as Value).value).toBe(true);
// });
