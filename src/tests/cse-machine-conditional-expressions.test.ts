import { Value } from "../cse-machine/stash";
import { runCSEMachine } from "./utils";
import { toPythonString } from "../stdlib";

test('if-else statement with simple logical expression and ends with if', () => {
    const code = `
a = True
if a:
    x1 = 1
else:
    x2 = 2
x1
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('1');
});

test('if-else statement with simple logical expression and ends with else', () => {
    const code = `
a = True
if not a:
    x1 = 1
else:
    x2 = 2
x2
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('2');
});

// test('if-else statement with complex logical expression', () => {
//     const code = `
// a = True
// b = False
// c = True
// d = False
// if a and b or c and not d:  # (a and b) or (c and (not d))
//     x1 = 1
// else:
//     x2 = 2
// x1
// `;
  
//     const result = runCSEMachine(code);
//     expect(toPythonString(result as Value)).toBe('1');
// });

test('if-elif-else statement and ends with if', () => {
    const code = `
a = True
b = False
if a:
    x1 = 1
elif b:
    x2 = 2
else:
    x3 = 3
x1
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('1');
});

test('if-elif-else statement and ends with elif', () => {
    const code = `
a = True
b = False
if not a:
    x1 = 1
elif not b:
    x2 = 2
else:
    x3 = 3
x2
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('2');
});

test('if-elif-else statement and ends with else', () => {
    const code = `
a = True
b = False
if not a:
    x1 = 1
elif b:
    x2 = 2
else:
    x3 = 3
x3
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('3');
});

test('Conditional expression and ends with if', () => {
    const code = `
a = True
c = 1 if a else 2
c
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('1');
});

test('Conditional expression and ends with if', () => {
    const code = `
a = True
c = 1 if not a else 2
c
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('2');
});