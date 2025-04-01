import { Value } from "../cse-machine/stash";
import { runCSEMachine } from "./utils";
import { toPythonString } from "../stdlib";

test('Function call creates a new environment', () => {
    const code = `
x = 1
def func():
    x = 2

func()
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('1');
});

test('If statement does not create a new environment', () => {
    const code = `
flag = True
x = 100
if flag:
    y = 200
else:
    z = 0

res = x + y
res
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('300');
});
