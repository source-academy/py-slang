/**
 * py2js chapter 3: `global`/`nonlocal`.
 *
 * The interesting case here is the one the CSE machine's own environment
 * model handles for free but a naive compile-to-JS backend does not: Python
 * has no TDZ, its environments grow dynamically, but JS `let` does have a
 * TDZ. compiler.ts's fix (see its file header and boundNames/
 * scanScopeDeclarations/collectAllGlobalDecls) is to hoist every name a scope
 * will ever bind — module or function — as an uninitialized `let` *before*
 * any code in that scope runs, and exclude a `global`/`nonlocal`-declared
 * name from its own function's hoisted locals so it falls through to the
 * outer binding instead of shadowing it. In particular, a function that
 * declares `global x` and assigns it with no top-level `x = ...` statement
 * anywhere in the program must still resolve correctly — Python's module
 * namespace can grow a name that was never declared at the top level at all.
 */
import { runCodePy2Js } from "../engines/py2js";
import { runCode } from "../runner";

test("a function's global write is visible to another function reading the same global", async () => {
  const code = `
def g():
    global x
    x = 42

def f():
    return x

g()
print(f())
`;
  await expect(runCode(code, 3)).resolves.not.toThrow();
  expect(runCodePy2Js(code, 3).output).toBe("42\n");
});

test("a global introduced only inside a function (no top-level assignment anywhere) still resolves", async () => {
  // The module namespace grows dynamically: `y` is never assigned at the top
  // level of the program textually, only inside f() via `global y`.
  const code = `
def f():
    global y
    y = 7

f()
print(y)
`;
  await expect(runCode(code, 3)).resolves.not.toThrow();
  expect(runCodePy2Js(code, 3).output).toBe("7\n");
});

test("reading a function-introduced global before it's ever been assigned is a NameError", async () => {
  const code = `
def f():
    global y
    return y

print(f())
`;
  await expect(runCode(code, 3)).rejects.toThrow();
  expect(() => runCodePy2Js(code, 3)).toThrow(/NameError/);
});

test("global lets a function see a later redefinition, matching the CSE machine's global environment", () => {
  const code = `
counter = 0

def bump():
    global counter
    counter = counter + 1

bump()
bump()
bump()
print(counter)
`;
  expect(runCodePy2Js(code, 3).output).toBe("3\n");
});

test("nonlocal binds to the nearest enclosing function scope, shared across calls (closure counter)", async () => {
  const code = `
def make_counter():
    count = 0
    def inc():
        nonlocal count
        count = count + 1
        return count
    return inc

c = make_counter()
print(c())
print(c())
print(c())
`;
  await expect(runCode(code, 3)).resolves.not.toThrow();
  expect(runCodePy2Js(code, 3).output).toBe("1\n2\n3\n");
});

test("nonlocal skips a non-binding intermediate scope to reach the nearest function that actually binds the name", () => {
  const code = `
def outer():
    x = 1
    def middle():
        def inner():
            nonlocal x
            x = x + 1
            return x
        return inner()
    return middle()

print(outer())
`;
  expect(runCodePy2Js(code, 3).output).toBe("2\n");
});

test("two independently-made counters via make_counter() do not share state", () => {
  const code = `
def make_counter():
    count = 0
    def inc():
        nonlocal count
        count = count + 1
        return count
    return inc

a = make_counter()
b = make_counter()
print(a())
print(a())
print(b())
`;
  expect(runCodePy2Js(code, 3).output).toBe("1\n2\n1\n");
});
