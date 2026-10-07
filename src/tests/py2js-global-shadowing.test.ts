/**
 * `global x` in a nested function must reach the module variable even when an
 * enclosing function has its own local `x` (py-slang#503). Program mode needs
 * a distinct JS identifier for such module names, since JS cannot name a
 * shadowed outer binding; REPL mode resolves through the globals table.
 */
import { runCodePy2Js, Py2JsSession } from "../engines/py2js";

const SHADOWED = `balance = 200
def outer():
    balance = 100

    def middle():
        balance = 50

        def inner():
            global balance
            balance = balance - 10

        inner()
        print(balance)

    middle()
    print(balance)
outer()
print(balance)
`;

describe("global declaration skips enclosing function locals", () => {
  test("program mode", () => {
    expect(runCodePy2Js(SHADOWED, 3).output).toBe("50\n100\n190\n");
  });

  test("REPL mode", async () => {
    const output: string[] = [];
    const session = new Py2JsSession(3, { onOutput: line => output.push(line) });
    await session.runChunk(SHADOWED);
    expect(output.join("\n")).toBe("50\n100\n190");
  });

  test("module name only introduced by a nested global, shadowed in between", () => {
    const code = `def outer():
    x = 1
    def inner():
        global x
        x = 7
    inner()
    print(x)
outer()
print(x)
`;
    expect(runCodePy2Js(code, 3).output).toBe("1\n7\n");
  });

  test("top-level read of a global-declared name after a function mutates it", () => {
    const code = `n = 0
def bump():
    global n
    n = n + 1
bump()
bump()
print(n)
`;
    expect(runCodePy2Js(code, 3).output).toBe("2\n");
  });

  test("nonlocal still binds the enclosing local", () => {
    const code = `x = 0
def f():
    x = 1
    def g():
        nonlocal x
        x = x + 1
    g()
    print(x)
f()
print(x)
`;
    expect(runCodePy2Js(code, 3).output).toBe("2\n0\n");
  });
});
