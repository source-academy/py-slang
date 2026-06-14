import { compileToWasmAndRun } from "../../engines/wasm";
import { ERROR_MAP, TYPE_TAG } from "../../engines/wasm/runtime";
import { ResolverErrors } from "../../resolver/errors";
import linkedList from "../../stdlib/linked-list";
import list from "../../stdlib/list";

it = it.concurrent;

describe("Environment tests", () => {
  it("captures outer variable by reference (mutation after definition visible)", async () => {
    const pythonCode = `
def outer():
    x = 1
    def inner():
        return x
    x = 2
    return inner()
outer()
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("2");
  });

  it("nested closures capture correct lexical frame", async () => {
    const pythonCode = `
def outer():
    x = 10
    def mid():
        y = 20
        def inner():
            return x + y
        return inner()
    return mid()
outer()
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("30");
  });

  it("multiple inner functions share same captured variable (mutation reflected)", async () => {
    const pythonCode = `
def outer():
    x = 5
    def a():
        return x
    def b():
        nonlocal x
        x = 9
    b()
    return a()
outer()
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("9");
  });

  it("nonlocal used before declaration throws error", async () => {
    const pythonCode = `
def f():
    def g():
        return x
    nonlocal x
    x = 1
    return g()
f()
`;
    expect((await compileToWasmAndRun(pythonCode, true)).errors).toContainEqual(
      expect.any(ResolverErrors.NameNotFoundError),
    );
  });

  it("nonlocal fails when no binding in outer scopes exists", async () => {
    const pythonCode = `
def f():
    nonlocal x
    x = 3
    return x
f()
`;
    expect((await compileToWasmAndRun(pythonCode, true)).errors).toContainEqual(
      expect.any(ResolverErrors.NameNotFoundError),
    );
  });

  it("name used before nonlocal declaration throws error", async () => {
    const pythonCode = `
def f():
    x = 1
    def g():
        x = 2 
        nonlocal x
        x = 3
        return x
    return g()
f()
`;

    expect((await compileToWasmAndRun(pythonCode, true)).errors).toContainEqual(
      new Error("Name x is used prior to nonlocal declaration!"),
    );
  });

  it("cannot declare parameter as nonlocal", async () => {
    const pythonCode = `
def f(x):
    nonlocal x
    x = 1
    return x
f(5)
`;
    expect((await compileToWasmAndRun(pythonCode, true)).errors).toContainEqual(
      expect.any(ResolverErrors.NameNotFoundError),
    );
  });

  it("undefined name error", async () => {
    const pythonCode = `undefined_variable`;
    expect((await compileToWasmAndRun(pythonCode, true)).errors).toContainEqual(
      expect.any(ResolverErrors.NameNotFoundError),
    );
  });

  it("shadowing local variable hides outer variable", async () => {
    const pythonCode = `
x = 7
def f():
    x = 2
    return x
f()
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("2");
  });

  it("multiple function calls preserve each own environment", async () => {
    const pythonCode = `
def counter():
    x = 0
    def inc():
        nonlocal x
        x = x + 1
        return x
    return inc

a = counter()
b = counter()
a()
a()
b()
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT); // last expr => b()
    expect(renderedResult).toBe("1");
  });

  it("multiple levels of nesting with nonlocal select correct variable", async () => {
    const pythonCode = `
def f():
    x = 0
    def g():
        x = 1
        def h():
            nonlocal x
            return x
        return h()
    return g()
f()
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("1");
  });

  it("lambda single parameter", async () => {
    const pythonCode = `
f = lambda x: x + 1
f(5)
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("6");
  });

  it("lambda multiple parameters", async () => {
    const pythonCode = `
f = lambda a, b: a + b
f(3, 4)
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("7");
  });

  it("lambda closure captures outer variable by reference", async () => {
    const pythonCode = `
x = 10
f = lambda y: x + y
x = 20
f(5)
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("25");
  });

  it("lambda used inline", async () => {
    const pythonCode = `
(lambda x: x * 2)(6)
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("12");
  });

  it("calling a non-function value should error", async () => {
    const pythonCode = `
x = 42
x()
`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error(ERROR_MAP.CALL_NOT_FX),
    );
  });

  it("function should error when given too few arguments", async () => {
    const pythonCode = `
def f(a, b):
    return a + b

f(1)
`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error(ERROR_MAP.FUNC_WRONG_ARITY),
    );
  });

  it("function should error when given too many arguments", async () => {
    const pythonCode = `
def f(a, b):
    return a + b

f(1, 2, 3)
`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error(ERROR_MAP.FUNC_WRONG_ARITY),
    );
  });
});

describe("Function *args & unpacking tests", () => {
  const compileWithList = (pythonCode: string) =>
    compileToWasmAndRun(pythonCode, true, { groups: [linkedList, list] });

  describe("*args tests", () => {
    it("no extra arguments: *args is empty", async () => {
      const pythonCode = `
def f(a, b, *c):
    return list_length(c)

f(1, 2)
  `;
      const { rawResult, renderedResult } = await compileWithList(pythonCode);
      expect(rawResult[0]).toBe(TYPE_TAG.INT);
      expect(renderedResult).toBe("0");
    });

    it("extra arguments are packed into *args", async () => {
      const pythonCode = `
def f(a, b, *c):
    return c[0] + c[1]

f(1, 2, 10, 20)
`;
      const { rawResult, renderedResult } = await compileWithList(pythonCode);
      expect(rawResult[0]).toBe(TYPE_TAG.INT);
      expect(renderedResult).toBe("30");
    });

    it("*args contains all extra arguments beyond defined params", async () => {
      const pythonCode = `
def f(a, *args):
    sum = 0
    for i in range(list_length(args)):
        sum = sum + args[i]
    return sum

f(1, 2, 3, 4)
  `;
      const { rawResult, renderedResult } = await compileWithList(pythonCode);
      expect(rawResult[0]).toBe(TYPE_TAG.INT);
      expect(renderedResult).toBe("9");
    });

    it("*args in function with no fixed parameters", async () => {
      const pythonCode = `
def f(*args):
    return args[0] + args[1]

f(7, 8)
`;
      const { rawResult, renderedResult } = await compileWithList(pythonCode);
      expect(rawResult[0]).toBe(TYPE_TAG.INT);
      expect(renderedResult).toBe("15");
    });

    it("*args with mixed types", async () => {
      const pythonCode = `
def f(a, *args):
    return args[0] + args[1]

f(0, 3, 4.5)
`;
      const { rawResult, renderedResult } = await compileWithList(pythonCode);
      expect(rawResult[0]).toBe(TYPE_TAG.FLOAT);
      expect(renderedResult).toBe("7.5");
    });

    it("*args must be last parameter", async () => {
      const pythonCode = `
def f(*args, a):
    return a

f(1, 2, 3)
`;
      expect((await compileWithList(pythonCode)).errors).toContainEqual(
        expect.objectContaining(new Error("Starred parameter must be the last parameter")),
      );
    });

    it("function with *args must be called with at least the fixed parameters", async () => {
      const pythonCode = `
def f(a, b, *args):
    return a + b

f(1)
`;
      await expect(compileWithList(pythonCode)).rejects.toThrow(
        new Error(ERROR_MAP.FUNC_WRONG_ARITY),
      );
    });

    it("local declarations unbound should error even if *args is present", async () => {
      const pythonCode = `
def f(*args):
    x = x + 1
    return args[0]

f(10, 20, 30)
`;
      await expect(compileWithList(pythonCode)).rejects.toThrow(new Error(ERROR_MAP.UNBOUND));
    });

    it("*args cannot be mutated inside function", async () => {
      const pythonCode = `
def f(*args):
    args[0] = 100

f(1, 2, 3)
`;
      await expect(compileWithList(pythonCode)).rejects.toThrow(
        new Error(ERROR_MAP.SET_ELEMENT_TUPLE),
      );
    });

    it("only one *args allowed", async () => {
      const pythonCode = `
def f(*args1, *args2):
    return list_length(args1) + list_length(args2)

f(1, 2, 3)
`;
      expect((await compileWithList(pythonCode)).errors).toContainEqual(
        expect.objectContaining(new Error("Only one starred parameter is allowed")),
      );
    });

    it("lambda with fixed arg and *args", async () => {
      const pythonCode = `
f = lambda a, *args: args[0] + args[1]
f(1, 2, 3)
`;
      const { rawResult, renderedResult } = await compileWithList(pythonCode);
      expect(rawResult[0]).toBe(TYPE_TAG.INT);
      expect(renderedResult).toBe("5");
    });

    it("lambda with only *args", async () => {
      const pythonCode = `
f = lambda *args: list_length(args)
f(1, 2, 3)
`;
      const { rawResult, renderedResult } = await compileWithList(pythonCode);
      expect(rawResult[0]).toBe(TYPE_TAG.INT);
      expect(renderedResult).toBe("3");
    });

    it("lambda with fixed arg and *args still enforces minimum arity", async () => {
      const pythonCode = `
f = lambda a, *args: a
f()
`;
      await expect(compileWithList(pythonCode)).rejects.toThrow(
        new Error(ERROR_MAP.FUNC_WRONG_ARITY),
      );
    });

    it("lambda only one *args allowed", async () => {
      const pythonCode = `
f = lambda *args1, *args2: list_length(args1)
f(1, 2, 3)
`;
      expect((await compileWithList(pythonCode)).errors).toContainEqual(
        expect.objectContaining(new Error("Only one starred parameter is allowed")),
      );
    });

    it("lambda *args must be last parameter", async () => {
      const pythonCode = `
f = lambda *args, a: a
f(1, 2, 3)
`;
      expect((await compileWithList(pythonCode)).errors).toContainEqual(
        expect.objectContaining(new Error("Starred parameter must be the last parameter")),
      );
    });
  });

  describe("unpacking tests", () => {
    it("lists can be unpacked into function arguments", async () => {
      const pythonCode = `
def f(a, b, c):
    return a + b + c

args = [2, 3]
f(1, *args)
  `;
      const { rawResult, renderedResult } = await compileWithList(pythonCode);
      expect(rawResult[0]).toBe(TYPE_TAG.INT);
      expect(renderedResult).toBe("6");
    });

    it("unpacking a non-list should error", async () => {
      const pythonCode = `
def f(a, b):
    return a + b

not_a_list = 42
f(1, *not_a_list)
  `;
      await expect(compileWithList(pythonCode)).rejects.toThrow(
        new Error(ERROR_MAP.STARRED_NOT_LIST),
      );
    });

    it("multiple unpacking operators in call", async () => {
      const pythonCode = `
def f(a, b, c, d):
    return a + b + c + d

args1 = [2, 3]
args2 = [4]
f(1, *args1, *args2)
  `;
      const { rawResult, renderedResult } = await compileWithList(pythonCode);
      expect(rawResult[0]).toBe(TYPE_TAG.INT);
      expect(renderedResult).toBe("10");
    });

    it("arity check accounts for unpacked arguments (too few)", async () => {
      const pythonCode = `
def f(a, b, c):
    return a + b + c

args = [2]
f(1, *args)
  `;
      await expect(compileWithList(pythonCode)).rejects.toThrow(
        new Error(ERROR_MAP.FUNC_WRONG_ARITY),
      );
    });

    it("arity check accounts for unpacked arguments (too many)", async () => {
      const pythonCode = `
def f(a, b, c):
    return a + b + c

args = [2, 3]
f(1, *args, 4)
  `;
      await expect(compileWithList(pythonCode)).rejects.toThrow(
        new Error(ERROR_MAP.FUNC_WRONG_ARITY),
      );
    });

    it("lambda can be called with unpacked list arguments", async () => {
      const pythonCode = `
f = lambda a, b, c: a + b + c
args = [2, 3]
f(1, *args)
`;
      const { rawResult, renderedResult } = await compileWithList(pythonCode);
      expect(rawResult[0]).toBe(TYPE_TAG.INT);
      expect(renderedResult).toBe("6");
    });

    it("lambda unpacking a non-list should error", async () => {
      const pythonCode = `
f = lambda a, b: a + b
f(1, *42)
`;
      await expect(compileWithList(pythonCode)).rejects.toThrow(
        new Error(ERROR_MAP.STARRED_NOT_LIST),
      );
    });
  });

  describe("combined tests", () => {
    it("unpacking operator with varargs", async () => {
      const pythonCode = `
def f(a, *args):
    sum = a
    for i in range(list_length(args)):
        sum = sum + args[i]
    return sum

args = [2, 3, 4]
f(1, *args)
  `;
      const { rawResult, renderedResult } = await compileWithList(pythonCode);
      expect(rawResult[0]).toBe(TYPE_TAG.INT);
      expect(renderedResult).toBe("10");
    });

    it("after copying environment for unpacking operator, should reserve space for locals", async () => {
      const pythonCode = `
def f(a, b):
    test2 = 4
    test = 5

    def g():
        pass

    g()
    return test
f(*[1, 2])
  `;
      const { rawResult, renderedResult } = await compileWithList(pythonCode);
      expect(rawResult[0]).toBe(TYPE_TAG.INT);
      expect(renderedResult).toBe("5");
    });

    it("lambda with *args accepts unpacked arguments", async () => {
      const pythonCode = `
f = lambda a, *args: a + args[0] + args[1]
rest = [2, 3]
f(1, *rest)
`;
      const { rawResult, renderedResult } = await compileWithList(pythonCode);
      expect(rawResult[0]).toBe(TYPE_TAG.INT);
      expect(renderedResult).toBe("6");
    });
  });
});
