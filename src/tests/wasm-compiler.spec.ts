import { compileToWasmAndRun } from "../wasm-compiler";
import { TYPE_TAG } from "../wasm-compiler/constants";

it = it.concurrent;

describe("Arithmetic operator tests (int, float, complex, string)", () => {
  // --- INT ARITHMETIC ---
  it("int addition", async () => {
    const pythonCode = `1 + 2`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(3)]);
  });

  it("mixed int arithmetic with precedence", async () => {
    const pythonCode = `2 + 3 * 4 - 5`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(9)]);
  });

  it("int division (floor div semantics unsupported -> float?)", async () => {
    const pythonCode = `5 / 2`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result[0]).toBe(TYPE_TAG.FLOAT);
  });

  // --- FLOAT ARITHMETIC ---
  it("float addition", async () => {
    const pythonCode = `1.5 + 2.25`;
    const result = await compileToWasmAndRun(pythonCode, true);

    // expect float tag + stored f64 bits
    expect(result[0]).toBe(TYPE_TAG.FLOAT);
  });

  it("mixed int + float -> float", async () => {
    const pythonCode = `3 + 2.5`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result[0]).toBe(TYPE_TAG.FLOAT);
  });

  it("float multiplication", async () => {
    const pythonCode = `1.2 * 3.4`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result[0]).toBe(TYPE_TAG.FLOAT);
  });

  // --- COMPLEX ARITHMETIC ---
  it("complex addition", async () => {
    const pythonCode = `
(1+2j) + (3+4j)
`;
    const result = await compileToWasmAndRun(pythonCode, true);

    expect(result[0]).toBe(TYPE_TAG.COMPLEX);
  });

  it("complex multiplication", async () => {
    const pythonCode = `
(2+3j) * (4+5j)
`;
    const result = await compileToWasmAndRun(pythonCode, true);

    expect(result[0]).toBe(TYPE_TAG.COMPLEX);
  });

  it("complex with real (int) -> complex", async () => {
    const pythonCode = `
(1+2j) + 10
`;
    const result = await compileToWasmAndRun(pythonCode, true);

    expect(result[0]).toBe(TYPE_TAG.COMPLEX);
  });

  // --- STRING ARITHMETIC ---
  it("string concatenation with +", async () => {
    const pythonCode = `"hello" + " world"`;
    const result = await compileToWasmAndRun(pythonCode, true);

    expect(result[0]).toBe(TYPE_TAG.STRING);
  });

  //   it("string repetition with *", async () => {
  //     const pythonCode = `"ab" * 3`;
  //     const result = await compileToWasmAndRun(pythonCode, true);

  //     expect(result[0]).toBe(TYPE_TAG.STRING);
  //   });

  it("string + int should error (type mismatch)", async () => {
    const pythonCode = `"a" + 1`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow();
  });
});

describe("Comparison operator tests (int, float, complex, string)", () => {
  // --- INT COMPARE ---
  it("int eq true", async () => {
    const pythonCode = `3 == 3`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("int lt false", async () => {
    const pythonCode = `5 < 1`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(0)]);
  });

  // --- FLOAT COMPARE ---
  it("float == float", async () => {
    const pythonCode = `1.25 == 1.25`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("float < int", async () => {
    const pythonCode = `1.5 < 2`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  // --- COMPLEX COMPARE ---
  it("complex == complex (Python: only equal works)", async () => {
    const pythonCode = `(1+2j) == (1+2j)`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("complex ordering (<, >, etc.) must error", async () => {
    const pythonCode = `(1+1j) < (2+2j)`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow();
  });

  // --- STRING COMPARE ---
  it("string equality true", async () => {
    const pythonCode = `"abc" == "abc"`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("string ordering lexicographically", async () => {
    const pythonCode = `"apple" < "banana"`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("string compare with non-string errors", async () => {
    const pythonCode = `"x" < 3`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow();
  });
});

describe("Boolean tests", () => {
  // --- BASIC BOOL() SEMANTICS ---
  it("bool(0) -> False", async () => {
    const pythonCode = `bool(0)`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(0)]);
  });

  it("bool(5) -> True", async () => {
    const pythonCode = `bool(5)`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("bool(0.0) -> False", async () => {
    const pythonCode = `bool(0.0)`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(0)]);
  });

  it("bool(nonzero float) -> True", async () => {
    const pythonCode = `bool(3.14)`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("bool(0+0j) -> False", async () => {
    const pythonCode = `bool(0+0j)`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(0)]);
  });

  it("bool(complex with nonzero part) -> True", async () => {
    const pythonCode = `bool(1+0j)`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("bool('') -> False", async () => {
    const pythonCode = `bool("")`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(0)]);
  });

  it("bool(non-empty string) -> True", async () => {
    const pythonCode = `bool("x")`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("bool(pair) -> always True", async () => {
    const pythonCode = `
p = pair(1, 2)
bool(p)
  `;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("bool(None) -> False", async () => {
    const pythonCode = `bool(None)`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(0)]);
  });

  // --- NOT OPERATOR ---
  it("not True", async () => {
    const pythonCode = `not True`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(0)]);
  });

  it("not 0", async () => {
    const pythonCode = `not 0`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("not nonzero", async () => {
    const pythonCode = `not 5`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(0)]);
  });

  // --- AND ---
  it("0 and 5 -> 0 (first falsy)", async () => {
    const pythonCode = `0 and 5`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(0)]);
  });

  it("5 and 0 -> 0", async () => {
    const pythonCode = `5 and 0`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(0)]);
  });

  it("5 and 3 -> 3 (last truthy)", async () => {
    const pythonCode = `5 and 3`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(3)]);
  });

  it("'hello' and 10 -> 10", async () => {
    const pythonCode = `"hello" and 10`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(10)]);
  });

  it("'hello' and '' -> ''", async () => {
    const pythonCode = `"hello" and ""`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result[0]).toBe(TYPE_TAG.STRING);
  });

  it("pair and None -> None", async () => {
    const pythonCode = `
p = pair(1,2)
p and None
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result[0]).toBe(TYPE_TAG.NONE);
  });

  // --- OR ---
  it("0 or 5 -> 5 (first truthy)", async () => {
    const pythonCode = `0 or 5`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(5)]);
  });

  it("'' or 'abc' -> 'abc'", async () => {
    const pythonCode = `"" or "abc"`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result[0]).toBe(TYPE_TAG.STRING);
  });

  it("'x' or 100 -> 'x'", async () => {
    const pythonCode = `"x" or 100`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result[0]).toBe(TYPE_TAG.STRING);
  });

  it("None or pair(1,2) -> pair", async () => {
    const pythonCode = `
None or pair(1,2)
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result[0]).not.toBe(TYPE_TAG.NONE);
  });

  // --- SHORT CIRCUITING ---
  it("and short-circuits (second expr not evaluated)", async () => {
    const pythonCode = `
x = 0
def boom():
    x = x + 1  # would error if executed
0 and boom()
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    // must return 0 (falsy) without calling boom()
    expect(result).toEqual([TYPE_TAG.INT, BigInt(0)]);
  });

  it("or short-circuits (second expr not evaluated)", async () => {
    const pythonCode = `
x = 0
def boom():
    x = x + 1  # would error if executed
1 or boom()
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(1)]);
  });
});

describe("Pair tests", () => {
  it("pairs are lists", async () => {
    const pythonCode = `
pair(1, 2)
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result[0]).toBe(TYPE_TAG.LIST);
  });

  it("construct pair and read head/tail", async () => {
    const pythonCode = `
p = pair(1, 2)
head(p) + tail(p)
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(3)]);
  });

  it("set_head mutates pair", async () => {
    const pythonCode = `
p = pair(10, 20)
set_head(p, 99)
head(p)
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(99)]);
  });

  it("set_tail mutates pair", async () => {
    const pythonCode = `
p = pair(10, 20)
set_tail(p, 7)
tail(p)
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(7)]);
  });

  it("nested pairs form linked list", async () => {
    const pythonCode = `
p = pair(1, pair(2, pair(3, None)))
head(tail(tail(p)))
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(3)]);
  });

  it("is_pair identifies pairs correctly", async () => {
    const pythonCode = `
is_pair(pair(1, 2))
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("is_pair identifies list of length 2 as pair", async () => {
    const pythonCode = `
is_pair([1, 2])
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("is_pair identifies list of length != 2 as non-pair", async () => {
    const pythonCode = `
is_pair([1, 2, 3])
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(0)]);
  });

  it("is_pair identifies non-pairs correctly", async () => {
    const pythonCode = `
is_pair(42)
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(0)]);
  });
});

describe("Linked list tests", () => {
  it("linked_list constructs a linked list from a Python list", async () => {
    const pythonCode = `
head(tail(linked_list(1, 2, 3)))
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(2)]);
  });

  it("set_head mutates linked list", async () => {
    const pythonCode = `
l = linked_list(10, 20, 30)
set_head(l, 99)
head(l)
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(99)]);
  });

  it("is_none identifies None correctly", async () => {
    const pythonCode = `
is_none(None)
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("is_none identifies non-None correctly", async () => {
    const pythonCode = `
is_none(42)
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(0)]);
  });

  it("is_linked_list identifies linked list correctly", async () => {
    const pythonCode = `
is_linked_list(linked_list(1, 2, 3))
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("is_linked_list identifies linked lists created with nested pairs", async () => {
    const pythonCode = `
is_linked_list(pair(1, pair(2, pair(3, None))))
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("is_linked_list identifies non-linked lists correctly", async () => {
    const pythonCode = `
is_linked_list([1, 2, 3])
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(0)]);
  });

  it("is_linked_list identifies non-linked lists created with pairs correctly", async () => {
    const pythonCode = `
is_linked_list(pair(1, pair(2, pair(3, 4))))
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(0)]);
  });
});

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
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(2)]);
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
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(30)]);
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
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(9)]);
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
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error("No binding for nonlocal x found!"),
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
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error("No binding for nonlocal x found!"),
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
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(2)]);
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
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(1)]); // last expr => b()
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
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(1)]);
  });

  it("lambda single parameter", async () => {
    const pythonCode = `
f = lambda x: x + 1
f(5)
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(6)]);
  });

  it("lambda multiple parameters", async () => {
    const pythonCode = `
f = lambda a, b: a + b
f(3, 4)
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(7)]);
  });

  it("lambda closure captures outer variable by reference", async () => {
    const pythonCode = `
x = 10
f = lambda y: x + y
x = 20
f(5)
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(25)]);
  });

  it("lambda used inline", async () => {
    const pythonCode = `
(lambda x: x * 2)(6)
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(12)]);
  });

  it("function should error when given too few arguments", async () => {
    const pythonCode = `
def f(a, b):
    return a + b

f(1)
`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error("Calling function with wrong number of arguments."),
    );
  });

  it("function should error when given too many arguments", async () => {
    const pythonCode = `
def f(a, b):
    return a + b

f(1, 2, 3)
`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error("Calling function with wrong number of arguments."),
    );
  });
});

describe("If statement tests", () => {
  it("if true branch executes", async () => {
    const pythonCode = `
x = 0
if True:
    x = 5
else:
    pass
x
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(5)]);
  });

  it("if false branch skips body", async () => {
    const pythonCode = `
x = 0
if False:
    x = 5
else:
    pass
x
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(0)]);
  });

  it("if condition uses truthiness (nonzero int)", async () => {
    const pythonCode = `
x = 0
if 10:
    x = 7
else:
    pass
x
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(7)]);
  });

  it("if condition uses truthiness (zero is false)", async () => {
    const pythonCode = `
x = 1
if 0:
    x = 9
else:
    pass
x
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(1)]);
  });

  it("nested if statements", async () => {
    const pythonCode = `
x = 0
if True:
    if True:
        x = 3
    else:
        pass
else:
    pass
x
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(3)]);
  });

  it("mutation inside if does not leak incorrectly", async () => {
    const pythonCode = `
x = 1
if True:
    x = x + 4
else:
    pass
x
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(5)]);
  });
});

describe("Ternary operator tests", () => {
  it("ternary true branch", async () => {
    const pythonCode = `
x = 5 if True else 10
x
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(5)]);
  });

  it("ternary false branch", async () => {
    const pythonCode = `
x = 5 if False else 10
x
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(10)]);
  });

  it("ternary uses truthiness", async () => {
    const pythonCode = `
x = 1
y = 100 if x else 200
y
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(100)]);
  });

  it("does not evaluate else branch when condition is True", async () => {
    const pythonCode = `
def boom():
    x = x + 1  # would error if executed
    return 99

result = 5 if True else boom()
result
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(5)]);
  });

  it("does not evaluate true branch when condition is False", async () => {
    const pythonCode = `
def boom():
    x = x + 1  # would error if executed
    return 42

result = boom() if False else 7
result
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(7)]);
  });
});

describe("Loop semantics tests", () => {
  it("for loop: range(stop)", async () => {
    const pythonCode = `
sum = 0
for i in range(5):
    sum = sum + i
sum
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(10)]);
  });

  it("for loop: range(start, stop)", async () => {
    const pythonCode = `
sum = 0
for i in range(2, 5):
    sum = sum + i
sum
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(9)]);
  });

  it("for loop: range(start, stop, step) positive step", async () => {
    const pythonCode = `
sum = 0
for i in range(1, 6, 2):
    sum = sum + i
sum
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(9)]);
  });

  it("for loop: range(start, stop, step) negative step", async () => {
    const pythonCode = `
sum = 0
for i in range(5, 0, -2):
    sum = sum + i
sum
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(9)]);
  });

  it("for loop: loop variable mutation does not affect iteration", async () => {
    const pythonCode = `
sum = 0
for i in range(5):
    i = 100
    sum = sum + i
sum
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(500)]);
  });

  it("for loop: loop variable reassignment does not leak across iterations", async () => {
    const pythonCode = `
last = 0
for i in range(3):
    last = i
    i = 999
last
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(2)]);
  });

  it("for loop: range expression evaluated once", async () => {
    const pythonCode = `
def outer():
    x = 0
    def f():
        nonlocal x
        x = x + 1
        return 3

    for i in range(f()):
        pass
    return x
outer()
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(1)]);
  });

  it("for loop: start and stop expressions evaluated once", async () => {
    const pythonCode = `
def outer():
    x = 0
    def f():
        nonlocal x
        x = x + 1
        return 3

    for i in range(0, f()):
        pass
    return x
outer()
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(1)]);
  });

  it("for loop: step expression evaluated once", async () => {
    const pythonCode = `
def outer():
    x = 0
    def f():
        nonlocal x
        x = x + 1
        return 2

    for i in range(0, 10, f()):
        pass
    return x
outer()
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(1)]);
  });

  it("while loop: basic iteration", async () => {
    const pythonCode = `
i = 0
sum = 0
while i < 5:
    sum = sum + i
    i = i + 1
sum
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(10)]);
  });

  it("while loop: condition re-evaluated every iteration", async () => {
    const pythonCode = `
def outer():
    x = 0
    def f():
        nonlocal x
        x = x + 1
        return 3
    i = 0
    while i < f():
        i = i + 1
    return x
outer()
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(4)]);
  });

  it("nested for loops: independent loop variables", async () => {
    const pythonCode = `
sum = 0
for i in range(3):
    for j in range(2):
        sum = sum + i + j
sum
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(9)]);
  });

  it("nested for loops: mutating inner loop variable does not affect iteration", async () => {
    const pythonCode = `
sum = 0
for i in range(3):
    for j in range(3):
        j = 100
        sum = sum + j
sum
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(900)]);
  });

  it("nested for loops: mutating outer loop variable inside inner loop does not affect outer iteration", async () => {
    const pythonCode = `
sum = 0
for i in range(3):
    for j in range(2):
        i = 50
        sum = sum + i
sum
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(300)]);
  });

  it("nested loops: while inside for with loop variable mutation", async () => {
    const pythonCode = `
sum = 0
for i in range(3):
    j = 0
    while j < 2:
        i = 10
        sum = sum + i
        j = j + 1
sum
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(60)]);
  });

  it("nested loops: while loop re-evaluates condition using mutated variable", async () => {
    const pythonCode = `
i = 0
count = 0
while i < 3:
    j = 0
    while j < 3:
        j = j + 1
        count = count + 1
    i = i + 1
count
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(9)]);
  });

  it("break statement with while loops", async () => {
    const pythonCode = `
x = 0
i = 0
while i < 10:
    if i == 5:
        break
    else:
        pass
    x = i
    i = i + 1
x
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(4)]);
  });

  it("break statement with for loops", async () => {
    const pythonCode = `
x = 0
for i in range(10):
    if i == 5:
        break
    else:
        pass
    x = i
x
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(4)]);
  });

  it("break only exits innermost loop", async () => {
    const pythonCode = `
x = 0
for i in range(3):
    for j in range(3):
        if i == 1 and j == 1:
            break
        else:
            pass
        x = x + 1
x
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(7)]);
  });

  it("continue statement with while loops", async () => {
    const pythonCode = `
x = 0
i = 0
while i < 5:
    i = i + 1
    if i == 0:
        continue
    else:
        pass
    x = x + 1
x
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(5)]);
  });

  it("continue statement with for loops", async () => {
    const pythonCode = `
x = 0
for i in range(5):
    if i == 0:
        continue
    else:
        pass
    x = x + 1
x
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(4)]);
  });

  it("continue only affects innermost loop", async () => {
    const pythonCode = `
x = 0
for i in range(3):
    for j in range(3):
        if i == 1 and j == 1:
            continue
        else:
            pass
        x = x + 1
x
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(8)]);
  });
});

describe("List semantics tests", () => {
  it("list literal creation", async () => {
    const pythonCode = `
x = [1, 2, 3]
x[0] + x[1] + x[2]
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(6)]);
  });

  it("list indexing", async () => {
    const pythonCode = `
x = [10, 20, 30]
x[1]
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(20)]);
  });

  it("list index mutation", async () => {
    const pythonCode = `
x = [1, 2, 3]
x[1] = 100
x[0] + x[1] + x[2]
  `;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(104)]);
  });

  //   it("list length grows via append", async () => {
  //     const pythonCode = `
  // x = [1]
  // x.append(2)
  // x.append(3)
  // x[2]
  // `;
  //     const result = await compileToWasmAndRun(pythonCode, true);
  //     expect(result).toEqual([TYPE_TAG.INT, BigInt(3)]);
  //   });

  it("nested lists indexing", async () => {
    const pythonCode = `
x = [[1, 2], [3, 4]]
x[1][0]
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(3)]);
  });

  it("nested list mutation", async () => {
    const pythonCode = `
x = [[1, 2], [3, 4]]
x[0][1] = 9
x[0][0] + x[0][1]
  `;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(10)]);
  });

  it("lists are reference types (aliasing)", async () => {
    const pythonCode = `
x = [1, 2, 3]
y = x
y[0] = 100
x[0]
  `;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(100)]);
  });

  it("mutating through function affects caller", async () => {
    const pythonCode = `
def change(a):
    a[0] = 42

x = [1, 2]
change(x)
x[0]
  `;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(42)]);
  });

  it("reassigning parameter does not affect caller", async () => {
    const pythonCode = `
def change(a):
    a = [9, 9]

x = [1, 2]
change(x)
x[0]
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(1)]);
  });

  it("list used inside for loop", async () => {
    const pythonCode = `
x = [1, 2, 3]
sum = 0
for i in range(3):
    sum = sum + x[i]
sum
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(6)]);
  });

  it("list mutation during loop", async () => {
    const pythonCode = `
x = [0, 0, 0]
for i in range(3):
    x[i] = i
x[0] + x[1] + x[2]
  `;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(3)]);
  });

  it("expression inside list literal evaluated left to right", async () => {
    const pythonCode = `
def outer():
    x = 0
    def f():
        nonlocal x
        x = x + 1
        return x

    arr = [f(), f(), f()]
    return x
outer()
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(3)]);
  });

  it("list can store mixed types", async () => {
    const pythonCode = `
x = [1, True, 3]
x[0] + x[2]
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(4)]);
  });

  it("is_list identifies lists correctly", async () => {
    const pythonCode = `
is_list([1, 2, 3])
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("is_list identifies pairs as lists", async () => {
    const pythonCode = `
is_list(pair(1, 2))
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("is_list identifies non-lists correctly", async () => {
    const pythonCode = `
is_list(42)
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(0)]);
  });

  it("list length function", async () => {
    const pythonCode = `
list_length([10, 20, 30])
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(3)]);
  });
});

describe("Function *args & unpacking tests", () => {
  it("no extra arguments: *args is empty", async () => {
    const pythonCode = `
def f(a, b, *c):
    return list_length(c)

f(1, 2)
  `;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(0)]);
  });

  it("extra arguments are packed into *args", async () => {
    const pythonCode = `
def f(a, b, *c):
    return c[0] + c[1]

f(1, 2, 10, 20)
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(30)]);
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
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(9)]);
  });

  it("*args in function with no fixed parameters", async () => {
    const pythonCode = `
def f(*args):
    return args[0] + args[1]

f(7, 8)
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(15)]);
  });

  it("*args with mixed types", async () => {
    const pythonCode = `
def f(a, *args):
    return args[0] + args[1]

f(0, 3, 4.5)
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result[0]).toBe(TYPE_TAG.FLOAT);
  });

  it("*args must be last parameter", async () => {
    const pythonCode = `
def f(*args, a):
    return a

f(1, 2, 3)
`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error("Starred parameter must be the last parameter"),
    );
  });

  it("function with *args must be called with at least the fixed parameters", async () => {
    const pythonCode = `
def f(a, b, *args):
    return a + b

f(1)
`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error("Calling function with wrong number of arguments."),
    );
  });

  it("local declarations unbound should error even if *args is present", async () => {
    const pythonCode = `
def f(*args):
    x = x + 1
    return args[0]

f(10, 20, 30)
`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error("Accessing an unbound value."),
    );
  });

  it("lists can be unpacked into function arguments", async () => {
    const pythonCode = `
def f(a, b, c):
    return a + b + c

args = [2, 3]
f(1, *args)
`;
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(6)]);
  });

  it("unpacking a non-list should error", async () => {
    const pythonCode = `
def f(a, b):
    return a + b

not_a_list = 42
f(1, *not_a_list)
`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error("Trying to unpack a non-list value."),
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
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(10)]);
  });

  it("arity check accounts for unpacked arguments (too few)", async () => {
    const pythonCode = `
def f(a, b, c):
    return a + b + c

args = [2]
f(1, *args)
`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error("Calling function with wrong number of arguments."),
    );
  });

  it("arity check accounts for unpacked arguments (too many)", async () => {
    const pythonCode = `
def f(a, b, c):
    return a + b + c

args = [2, 3]
f(1, *args, 4)
`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error("Calling function with wrong number of arguments."),
    );
  });

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
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(10)]);
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
    const result = await compileToWasmAndRun(pythonCode, true);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(5)]);
  });
});

describe("Miscellaneous tests", () => {
  it("Temporal dead zone for local variables", async () => {
    const pythonCode = `
y = 1
def f(x):
    print(y)
    if True:
        print("true")
        y = 3
    else:
        print("false")
    print(y)
    
f(4)
`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error("Accessing an unbound value."),
    );
  });
});
