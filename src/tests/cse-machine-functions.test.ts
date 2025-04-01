import { Value } from "../cse-machine/stash";
import { runCSEMachine } from "./utils";
import { toPythonString } from "../stdlib";

test('Simple function declaration and call', () => {
    const code = `
def func():
    return 'sourceacademy'

result = func()
result
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('sourceacademy');
});

test('Function with parameters', () => {
    const code = `
def add_numbers(a, b):
    return a + b

result = add_numbers(100, 200)
result
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('300');
});

test('Function called as parameter', () => {
    const code = `
def ret_a():
    return 100
def add_numbers(a, b):
    return a + b

result = add_numbers(ret_a(), 200)
result
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('300');
});

test('Function defined in another function', () => {
    const code = `
def func_1(a):
    def func_2():
        return 200
    return a + func_2()

result = func_1(100)
result
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('300');
});

test('Recursive function', () => {
    const code = `
def sum_1(term, a, next, b):
    return 0 if a > b else term(a) + sum_1(term, next(a), next, b)

def pi_sum(a, b):
    def pi_term(x):
        return 1 / (x * (x + 2))
    def pi_next(x):
        return x + 4
    return sum_1(pi_term, a , pi_next, b)

res = 8 * pi_sum(1, 1000)
res
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('3.139592655589783');
});