import { i32, wasm } from "@sourceacademy/wasm-util";
import { CompileOptions, compileToWasmAndRun } from "../wasm-compiler";
import {
  APPLY_FX_NAME,
  ERROR_MAP,
  MAKE_LIST_FX,
  PEEK_SHADOW_STACK_FX,
  SHADOW_STACK_TAG,
  SILENT_PUSH_SHADOW_STACK_FX,
  TYPE_TAG,
} from "../wasm-compiler/constants";
import { insertInArray, isFunctionOfName } from "../wasm-compiler/irHelpers";

it = it.concurrent;

describe("Arithmetic operator tests (int, float, complex, string)", () => {
  // --- INT ARITHMETIC ---
  it("int addition", async () => {
    const pythonCode = `1 + 2`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("3");
  });

  it("mixed int arithmetic with precedence", async () => {
    const pythonCode = `2 + 3 * 4 - 5`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("9");
  });

  it("int division (floor div semantics unsupported -> float?)", async () => {
    const pythonCode = `5 / 2`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.FLOAT);
    expect(renderedResult).toBe("2.5");
  });

  // --- FLOAT ARITHMETIC ---
  it("float addition", async () => {
    const pythonCode = `1.5 + 2.25`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.FLOAT);
    expect(renderedResult).toBe("3.75");
  });

  it("mixed int + float -> float", async () => {
    const pythonCode = `3 + 2.5`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.FLOAT);
    expect(renderedResult).toBe("5.5");
  });

  it("float multiplication", async () => {
    const pythonCode = `1.2 * 3.4`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.FLOAT);
    expect(renderedResult).toBe("4.08");
  });

  // --- COMPLEX ARITHMETIC ---
  it("complex addition", async () => {
    const pythonCode = `
(1+2j) + (3+4j)
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.COMPLEX);
    expect(renderedResult).toBe("4 + 6j");
  });

  it("complex multiplication", async () => {
    const pythonCode = `
(2+3j) * (4+5j)
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.COMPLEX);
    expect(renderedResult).toBe("-7 + 22j");
  });

  it("complex with real (int) -> complex", async () => {
    const pythonCode = `
(1+2j) + 10
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.COMPLEX);
    expect(renderedResult).toBe("11 + 2j");
  });

  // --- STRING ARITHMETIC ---
  it("string concatenation with +", async () => {
    const pythonCode = `"hello" + " world"`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.STRING);
    expect(renderedResult).toBe("hello world");
  });

  //   it("string repetition with *", async () => {
  //     const pythonCode = `"ab" * 3`;
  //     const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
  //     expect(rawResult[0]).toBe(TYPE_TAG.STRING);
  //   });

  it("string + int should error (type mismatch)", async () => {
    const pythonCode = `"a" + 1`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error(ERROR_MAP.ARITH_OP_UNKNOWN_TYPE),
    );
  });

  it("unary minus on string should error", async () => {
    const pythonCode = `-"a"`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error(ERROR_MAP.NEG_NOT_SUPPORT),
    );
  });
});

describe("Comparison operator tests (int, float, complex, string)", () => {
  // --- INT COMPARE ---
  it("int eq true", async () => {
    const pythonCode = `3 == 3`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("int lt false", async () => {
    const pythonCode = `5 < 1`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("False");
  });

  // --- FLOAT COMPARE ---
  it("float == float", async () => {
    const pythonCode = `1.25 == 1.25`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("float < int", async () => {
    const pythonCode = `1.5 < 2`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  // --- COMPLEX COMPARE ---
  it("complex == complex (Python: only equal works)", async () => {
    const pythonCode = `(1+2j) == (1+2j)`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("complex ordering (<, >, etc.) must error", async () => {
    const pythonCode = `(1+1j) < (2+2j)`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error(ERROR_MAP.COMPLEX_COMPARISON),
    );
  });

  // --- STRING COMPARE ---
  it("string equality true", async () => {
    const pythonCode = `"abc" == "abc"`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("string ordering lexicographically", async () => {
    const pythonCode = `"apple" < "banana"`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("string compare with non-string errors", async () => {
    const pythonCode = `"x" < 3`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error(ERROR_MAP.COMPARE_OP_UNKNOWN_TYPE),
    );
  });
});

describe("Boolean tests", () => {
  // --- BASIC BOOL() SEMANTICS ---
  it("bool(0) -> False", async () => {
    const pythonCode = `bool(0)`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("False");
  });

  it("bool(5) -> True", async () => {
    const pythonCode = `bool(5)`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("bool(0.0) -> False", async () => {
    const pythonCode = `bool(0.0)`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("False");
  });

  it("bool(nonzero float) -> True", async () => {
    const pythonCode = `bool(3.14)`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("bool(0+0j) -> False", async () => {
    const pythonCode = `bool(0+0j)`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("False");
  });

  it("bool(complex with nonzero part) -> True", async () => {
    const pythonCode = `bool(1+0j)`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("bool('') -> False", async () => {
    const pythonCode = `bool("")`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("False");
  });

  it("bool(non-empty string) -> True", async () => {
    const pythonCode = `bool("x")`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("bool(pair) -> always True", async () => {
    const pythonCode = `
p = pair(1, 2)
bool(p)
  `;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("bool(None) -> False", async () => {
    const pythonCode = `bool(None)`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("False");
  });

  // --- NOT OPERATOR ---
  it("not True", async () => {
    const pythonCode = `not True`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("False");
  });

  it("not 0", async () => {
    const pythonCode = `not 0`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("not nonzero", async () => {
    const pythonCode = `not 5`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("False");
  });

  // --- AND ---
  it("0 and 5 -> 0 (first falsy)", async () => {
    const pythonCode = `0 and 5`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("0");
  });

  it("5 and 0 -> 0", async () => {
    const pythonCode = `5 and 0`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("0");
  });

  it("5 and 3 -> 3 (last truthy)", async () => {
    const pythonCode = `5 and 3`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("3");
  });

  it("'hello' and 10 -> 10", async () => {
    const pythonCode = `"hello" and 10`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("10");
  });

  it("'hello' and '' -> ''", async () => {
    const pythonCode = `"hello" and ""`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.STRING);
    expect(renderedResult).toBe("");
  });

  it("pair and None -> None", async () => {
    const pythonCode = `
p = pair(1,2)
p and None
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.NONE);
    expect(renderedResult).toBe("None");
  });

  // --- OR ---
  it("0 or 5 -> 5 (first truthy)", async () => {
    const pythonCode = `0 or 5`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("5");
  });

  it("'' or 'abc' -> 'abc'", async () => {
    const pythonCode = `"" or "abc"`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.STRING);
    expect(renderedResult).toBe("abc");
  });

  it("'x' or 100 -> 'x'", async () => {
    const pythonCode = `"x" or 100`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.STRING);
    expect(renderedResult).toBe("x");
  });

  it("None or pair(1,2) -> pair", async () => {
    const pythonCode = `None or pair(1,2)`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).not.toBe(TYPE_TAG.NONE);
    expect(renderedResult).toBe("[1, 2]");
  });

  // --- SHORT CIRCUITING ---
  it("and short-circuits (second expr not evaluated)", async () => {
    const pythonCode = `
x = 0
def boom():
    x = x + 1  # would error if executed
0 and boom()
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    // must return 0 (falsy) without calling boom()
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("0");
  });

  it("or short-circuits (second expr not evaluated)", async () => {
    const pythonCode = `
x = 0
def boom():
    x = x + 1  # would error if executed
1 or boom()
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("1");
  });
});

describe("Pair tests", () => {
  it("pairs are lists", async () => {
    const pythonCode = `pair(1, 2)`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.LIST);
    expect(renderedResult).toBe("[1, 2]");
  });

  it("construct pair and read head/tail", async () => {
    const pythonCode = `
p = pair(1, 2)
head(p) + tail(p)
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("3");
  });

  it("set_head mutates pair", async () => {
    const pythonCode = `
p = pair(10, 20)
set_head(p, 99)
head(p)
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("99");
  });

  it("set_tail mutates pair", async () => {
    const pythonCode = `
p = pair(10, 20)
set_tail(p, 7)
tail(p)
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("7");
  });

  it("nested pairs form linked list", async () => {
    const pythonCode = `
p = pair(1, pair(2, pair(3, None)))
head(tail(tail(p)))
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("3");
  });

  it("is_pair identifies pairs correctly", async () => {
    const pythonCode = `is_pair(pair(1, 2))`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("is_pair identifies list of length 2 as pair", async () => {
    const pythonCode = `is_pair([1, 2])`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("is_pair identifies list of length != 2 as non-pair", async () => {
    const pythonCode = `is_pair([1, 2, 3])`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("False");
  });

  it("is_pair identifies non-pairs correctly", async () => {
    const pythonCode = `is_pair(42)`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("False");
  });

  it("head on non-list should error", async () => {
    const pythonCode = `head(42)`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error(ERROR_MAP.HEAD_NOT_PAIR),
    );
  });

  it("tail on non-list should error", async () => {
    const pythonCode = `tail(42)`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error(ERROR_MAP.TAIL_NOT_PAIR),
    );
  });
});

describe("Linked list tests", () => {
  it("linked_list constructs a linked list from a Python list", async () => {
    const pythonCode = `head(tail(linked_list(1, 2, 3)))`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("2");
  });

  it("set_head mutates linked list", async () => {
    const pythonCode = `
l = linked_list(10, 20, 30)
set_head(l, 99)
head(l)
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("99");
  });

  it("is_none identifies None correctly", async () => {
    const pythonCode = `is_none(None)`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("is_none identifies non-None correctly", async () => {
    const pythonCode = `is_none(42)`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("False");
  });

  it("is_linked_list identifies linked list correctly", async () => {
    const pythonCode = `is_linked_list(linked_list(1, 2, 3))`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("is_linked_list identifies linked lists created with nested pairs", async () => {
    const pythonCode = `is_linked_list(pair(1, pair(2, pair(3, None))))`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("is_linked_list identifies non-linked lists correctly", async () => {
    const pythonCode = `is_linked_list([1, 2, 3])`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("False");
  });

  it("is_linked_list identifies non-linked lists created with pairs correctly", async () => {
    const pythonCode = `is_linked_list(pair(1, pair(2, pair(3, 4))))`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("False");
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("5");
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("0");
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("7");
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("1");
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("3");
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("5");
  });
});

describe("Ternary operator tests", () => {
  it("ternary true branch", async () => {
    const pythonCode = `
x = 5 if True else 10
x
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("5");
  });

  it("ternary false branch", async () => {
    const pythonCode = `
x = 5 if False else 10
x
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("10");
  });

  it("ternary uses truthiness", async () => {
    const pythonCode = `
x = 1
y = 100 if x else 200
y
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("100");
  });

  it("does not evaluate else branch when condition is True", async () => {
    const pythonCode = `
def boom():
    x = x + 1  # would error if executed
    return 99

result = 5 if True else boom()
result
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("5");
  });

  it("does not evaluate true branch when condition is False", async () => {
    const pythonCode = `
def boom():
    x = x + 1  # would error if executed
    return 42

result = boom() if False else 7
result
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("7");
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("10");
  });

  it("for loop: range(start, stop)", async () => {
    const pythonCode = `
sum = 0
for i in range(2, 5):
    sum = sum + i
sum
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("9");
  });

  it("for loop: range(start, stop, step) positive step", async () => {
    const pythonCode = `
sum = 0
for i in range(1, 6, 2):
    sum = sum + i
sum
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("9");
  });

  it("for loop: range(start, stop, step) negative step", async () => {
    const pythonCode = `
sum = 0
for i in range(5, 0, -2):
    sum = sum + i
sum
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("9");
  });

  it("for loop: loop variable mutation does not affect iteration", async () => {
    const pythonCode = `
sum = 0
for i in range(5):
    i = 100
    sum = sum + i
sum
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("500");
  });

  it("for loop: loop variable reassignment does not leak across iterations", async () => {
    const pythonCode = `
last = 0
for i in range(3):
    last = i
    i = 999
last
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("2");
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("1");
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("1");
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("1");
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("10");
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("4");
  });

  it("nested for loops: independent loop variables", async () => {
    const pythonCode = `
sum = 0
for i in range(3):
    for j in range(2):
        sum = sum + i + j
sum
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("9");
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("900");
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("300");
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("60");
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("9");
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("4");
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("4");
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("7");
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("5");
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("4");
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("8");
  });
});

describe("List semantics tests", () => {
  it("list literal creation", async () => {
    const pythonCode = `
x = [1, 2, 3]
x[0] + x[1] + x[2]
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("6");
  });

  it("list indexing", async () => {
    const pythonCode = `
x = [10, 20, 30]
x[1]
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("20");
  });

  it("list index mutation", async () => {
    const pythonCode = `
x = [1, 2, 3]
x[1] = 100
x[0] + x[1] + x[2]
  `;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("104");
  });

  it("indexing a non-list should error", async () => {
    const pythonCode = `
x = 42
x[0]
`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error(ERROR_MAP.GET_ELEMENT_NOT_LIST),
    );
  });

  it("setting an element on a non-list should error", async () => {
    const pythonCode = `
x = 42
x[0] = 1
`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error(ERROR_MAP.SET_ELEMENT_NOT_LIST),
    );
  });

  it("list indexing with a non-integer index should error", async () => {
    const pythonCode = `
x = [1, 2, 3]
x[1.5]
`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error(ERROR_MAP.INDEX_NOT_INT),
    );
  });

  it("list indexing out of range should error", async () => {
    const pythonCode = `
x = [1, 2, 3]
x[3]
`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error(ERROR_MAP.LIST_OUT_OF_RANGE),
    );
  });

  //   it("list length grows via append", async () => {
  //     const pythonCode = `
  // x = [1]
  // x.append(2)
  // x.append(3)
  // x[2]
  // `;
  //     const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
  //     expect(rawResult[0]).toBe(TYPE_TAG.INT);
  //     expect(renderedResult).toBe("3");
  //   });

  it("nested lists indexing", async () => {
    const pythonCode = `
x = [[1, 2], [3, 4]]
x[1][0]
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("3");
  });

  it("nested list mutation", async () => {
    const pythonCode = `
x = [[1, 2], [3, 4]]
x[0][1] = 9
x[0][0] + x[0][1]
  `;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("10");
  });

  it("lists are reference types (aliasing)", async () => {
    const pythonCode = `
x = [1, 2, 3]
y = x
y[0] = 100
x[0]
  `;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("100");
  });

  it("mutating through function affects caller", async () => {
    const pythonCode = `
def change(a):
    a[0] = 42

x = [1, 2]
change(x)
x[0]
  `;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("42");
  });

  it("reassigning parameter does not affect caller", async () => {
    const pythonCode = `
def change(a):
    a = [9, 9]

x = [1, 2]
change(x)
x[0]
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("1");
  });

  it("list used inside for loop", async () => {
    const pythonCode = `
x = [1, 2, 3]
sum = 0
for i in range(3):
    sum = sum + x[i]
sum
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("6");
  });

  it("list mutation during loop", async () => {
    const pythonCode = `
x = [0, 0, 0]
for i in range(3):
    x[i] = i
x[0] + x[1] + x[2]
  `;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("3");
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("3");
  });

  it("list can store mixed types", async () => {
    const pythonCode = `
x = [1, True, 3]
x[0] + x[2]
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("4");
  });

  it("is_list identifies lists correctly", async () => {
    const pythonCode = `is_list([1, 2, 3])`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("is_list identifies pairs as lists", async () => {
    const pythonCode = `is_list(pair(1, 2))`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("is_list identifies non-lists correctly", async () => {
    const pythonCode = `is_list(42)`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("False");
  });

  it("list length function", async () => {
    const pythonCode = `list_length([10, 20, 30])`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("3");
  });

  it("list length on non-list should error", async () => {
    const pythonCode = `list_length(42)`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error(ERROR_MAP.GET_LENGTH_NOT_LIST),
    );
  });
});

describe("Function *args & unpacking tests", () => {
  it("no extra arguments: *args is empty", async () => {
    const pythonCode = `
def f(a, b, *c):
    return list_length(c)

f(1, 2)
  `;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("0");
  });

  it("extra arguments are packed into *args", async () => {
    const pythonCode = `
def f(a, b, *c):
    return c[0] + c[1]

f(1, 2, 10, 20)
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("9");
  });

  it("*args in function with no fixed parameters", async () => {
    const pythonCode = `
def f(*args):
    return args[0] + args[1]

f(7, 8)
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("15");
  });

  it("*args with mixed types", async () => {
    const pythonCode = `
def f(a, *args):
    return args[0] + args[1]

f(0, 3, 4.5)
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.FLOAT);
    expect(renderedResult).toBe("7.5");
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
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error(ERROR_MAP.UNBOUND),
    );
  });

  it("*args cannot be mutated inside function", async () => {
    const pythonCode = `
def f(*args):
    args[0] = 100

f(1, 2, 3)
`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error(ERROR_MAP.SET_ELEMENT_TUPLE),
    );
  });

  //   it("lists can be unpacked into function arguments", async () => {
  //     const pythonCode = `
  // def f(a, b, c):
  //     return a + b + c

  // args = [2, 3]
  // f(1, *args)
  // `;
  //     const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
  //     expect(rawResult[0]).toBe(TYPE_TAG.INT);
  //     expect(renderedResult).toBe("6");
  //   });

  //   it("unpacking a non-list should error", async () => {
  //     const pythonCode = `
  // def f(a, b):
  //     return a + b

  // not_a_list = 42
  // f(1, *not_a_list)
  // `;
  //     await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
  //       new Error(ERROR_MAP.STARRED_NOT_LIST),
  //     );
  //   });

  //   it("multiple unpacking operators in call", async () => {
  //     const pythonCode = `
  // def f(a, b, c, d):
  //     return a + b + c + d

  // args1 = [2, 3]
  // args2 = [4]
  // f(1, *args1, *args2)
  // `;
  //     const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
  //     expect(rawResult[0]).toBe(TYPE_TAG.INT);
  //     expect(renderedResult).toBe("10");
  //   });

  //   it("arity check accounts for unpacked arguments (too few)", async () => {
  //     const pythonCode = `
  // def f(a, b, c):
  //     return a + b + c

  // args = [2]
  // f(1, *args)
  // `;
  //     await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
  //       new Error(ERROR_MAP.FUNC_WRONG_ARITY),
  //     );
  //   });

  //   it("arity check accounts for unpacked arguments (too many)", async () => {
  //     const pythonCode = `
  // def f(a, b, c):
  //     return a + b + c

  // args = [2, 3]
  // f(1, *args, 4)
  // `;
  //     await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
  //       new Error(ERROR_MAP.FUNC_WRONG_ARITY),
  //     );
  //   });

  //   it("unpacking operator with varargs", async () => {
  //     const pythonCode = `
  // def f(a, *args):
  //     sum = a
  //     for i in range(list_length(args)):
  //         sum = sum + args[i]
  //     return sum

  // args = [2, 3, 4]
  // f(1, *args)
  // `;
  //     const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
  //     expect(rawResult[0]).toBe(TYPE_TAG.INT);
  //     expect(renderedResult).toBe("10");
  //   });

  //   it("after copying environment for unpacking operator, should reserve space for locals", async () => {
  //     const pythonCode = `
  // def f(a, b):
  //     test2 = 4
  //     test = 5

  //     def g():
  //         pass

  //     g()
  //     return test
  // f(*[1, 2])
  // `;
  //     const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
  //     expect(rawResult[0]).toBe(TYPE_TAG.INT);
  //     expect(renderedResult).toBe("5");
  //   });
});

const linkedListBuilder = (...elements: string[]) => {
  let expected = "None";
  for (let i = elements.length - 1; i >= 0; i--) {
    expected = `[${elements[i]}, ${expected}]`;
  }
  return expected;
};

describe("tokenize function tests", () => {
  it("returns tokens in source order", async () => {
    const { renderedResult } = await compileToWasmAndRun(`tokenize("x = 1 + 2")`, true);
    expect(renderedResult).toBe(linkedListBuilder("x", "=", "1", "+", "2"));
  });

  it("ignores redundant whitespace", async () => {
    const { renderedResult } = await compileToWasmAndRun(`tokenize("x    +   y   ")`, true);
    expect(renderedResult).toBe(linkedListBuilder("x", "+", "y"));
  });

  it("returns None for empty input", async () => {
    const { rawResult, renderedResult } = await compileToWasmAndRun(`tokenize("")`, true);
    expect(rawResult[0]).toBe(TYPE_TAG.NONE);
    expect(renderedResult).toBe("None");
  });

  it("tokenizes punctuation-heavy expressions", async () => {
    const { renderedResult } = await compileToWasmAndRun(`tokenize("f(x, y[0])")`, true);
    expect(renderedResult).toBe(linkedListBuilder("f", "(", "x", ",", "y", "[", "0", "]", ")"));
  });

  it("tokenize on non-string should error", async () => {
    await expect(compileToWasmAndRun(`tokenize(42)`, true)).rejects.toThrow(
      new Error(ERROR_MAP.PARSE_NOT_STRING),
    );
  });
});

describe("parse function tests", () => {
  // A single top-level statement is returned directly; multiple statements are wrapped in a sequence.
  const seqOf = (...stmt: string[]) => linkedListBuilder("sequence", linkedListBuilder(...stmt));

  it("integer literal", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("42")`, true);
    expect(renderedResult).toBe(linkedListBuilder("literal", "42"));
  });

  it("parse on non-string should error", async () => {
    await expect(compileToWasmAndRun(`parse(42)`, true)).rejects.toThrow(
      new Error(ERROR_MAP.PARSE_NOT_STRING),
    );
  });

  it("float literal", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("3.5")`, true);
    expect(renderedResult).toBe(linkedListBuilder("literal", "3.5"));
  });

  it("bool literal True", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("True")`, true);
    expect(renderedResult).toBe(linkedListBuilder("literal", "True"));
  });

  it("bool literal False", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("False")`, true);
    expect(renderedResult).toBe(linkedListBuilder("literal", "False"));
  });

  it("None literal", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("None")`, true);
    expect(renderedResult).toBe(linkedListBuilder("literal", "None"));
  });

  it("string literal", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse('"hello"')`, true);
    expect(renderedResult).toBe(linkedListBuilder("literal", '"hello"'));
  });

  it("name", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("x")`, true);
    expect(renderedResult).toBe(linkedListBuilder("name", '"x"'));
  });

  it("multiple top-level statements", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("x = 1\\ny")`, true);
    expect(renderedResult).toBe(
      seqOf(
        linkedListBuilder(
          "assignment",
          linkedListBuilder("name", '"x"'),
          linkedListBuilder("literal", "1"),
        ),
        linkedListBuilder("name", '"y"'),
      ),
    );
  });

  it("binary addition", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("1 + 2")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "binary_operator_combination",
        '"+"',
        linkedListBuilder("literal", "1"),
        linkedListBuilder("literal", "2"),
      ),
    );
  });

  it("binary subtraction", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("5 - 3")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "binary_operator_combination",
        '"-"',
        linkedListBuilder("literal", "5"),
        linkedListBuilder("literal", "3"),
      ),
    );
  });

  it("binary multiplication", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("5 * 3")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "binary_operator_combination",
        '"*"',
        linkedListBuilder("literal", "5"),
        linkedListBuilder("literal", "3"),
      ),
    );
  });

  it("binary division", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("5 / 3")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "binary_operator_combination",
        '"/"',
        linkedListBuilder("literal", "5"),
        linkedListBuilder("literal", "3"),
      ),
    );
  });

  it("comparison equal", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("1 == 2")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "binary_operator_combination",
        '"=="',
        linkedListBuilder("literal", "1"),
        linkedListBuilder("literal", "2"),
      ),
    );
  });

  it("comparison not equal", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("1 != 2")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "binary_operator_combination",
        '"!="',
        linkedListBuilder("literal", "1"),
        linkedListBuilder("literal", "2"),
      ),
    );
  });

  it("comparison less than", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("1 < 2")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "binary_operator_combination",
        '"<"',
        linkedListBuilder("literal", "1"),
        linkedListBuilder("literal", "2"),
      ),
    );
  });

  it("comparison less than or equal", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("1 <= 2")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "binary_operator_combination",
        '"<="',
        linkedListBuilder("literal", "1"),
        linkedListBuilder("literal", "2"),
      ),
    );
  });

  it("comparison greater than", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("1 > 2")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "binary_operator_combination",
        '">"',
        linkedListBuilder("literal", "1"),
        linkedListBuilder("literal", "2"),
      ),
    );
  });

  it("comparison greater than or equal", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("1 >= 2")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "binary_operator_combination",
        '">="',
        linkedListBuilder("literal", "1"),
        linkedListBuilder("literal", "2"),
      ),
    );
  });

  it("unary not", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("not True")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "unary_operator_combination",
        '"not"',
        linkedListBuilder("literal", "True"),
      ),
    );
  });

  it("unary negation", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("-x")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder("unary_operator_combination", '"-unary"', linkedListBuilder("name", '"x"')),
    );
  });

  it("logical and", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("True and False")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "logical_composition",
        '"and"',
        linkedListBuilder("literal", "True"),
        linkedListBuilder("literal", "False"),
      ),
    );
  });

  it("logical or", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("True or False")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "logical_composition",
        '"or"',
        linkedListBuilder("literal", "True"),
        linkedListBuilder("literal", "False"),
      ),
    );
  });

  it("ternary (conditional expression)", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("1 if True else 2")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "conditional_expression",
        linkedListBuilder("literal", "True"),
        linkedListBuilder("literal", "1"),
        linkedListBuilder("literal", "2"),
      ),
    );
  });

  it("assignment", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("x = 5")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "assignment",
        linkedListBuilder("name", '"x"'),
        linkedListBuilder("literal", "5"),
      ),
    );
  });

  it("object assignment", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("x[0] = 5")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "object_assignment",
        linkedListBuilder(
          "object_access",
          linkedListBuilder("name", '"x"'),
          linkedListBuilder("literal", "0"),
        ),
        linkedListBuilder("literal", "5"),
      ),
    );
  });

  it("function declaration: single statement body (no sequence)", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("def f(x):\\n    return x")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "function_declaration",
        linkedListBuilder("name", '"f"'),
        linkedListBuilder('"x"'),
        linkedListBuilder("return_statement", linkedListBuilder("name", '"x"')),
      ),
    );
  });

  it("function declaration: multiple statement body (sequence)", async () => {
    const { renderedResult } = await compileToWasmAndRun(
      `parse("def f(x, y):\\n    return x\\n    return y")`,
      true,
    );
    expect(renderedResult).toBe(
      linkedListBuilder(
        "function_declaration",
        linkedListBuilder("name", '"f"'),
        linkedListBuilder('"x"', '"y"'),
        linkedListBuilder(
          "sequence",
          linkedListBuilder(
            linkedListBuilder("return_statement", linkedListBuilder("name", '"x"')),
            linkedListBuilder("return_statement", linkedListBuilder("name", '"y"')),
          ),
        ),
      ),
    );
  });

  it("function declaration: local declaration wraps body in block", async () => {
    const { renderedResult } = await compileToWasmAndRun(
      `parse("def f():\\n    x = 5\\n    return x")`,
      true,
    );
    expect(renderedResult).toBe(
      linkedListBuilder(
        "function_declaration",
        linkedListBuilder("name", '"f"'),
        "None",
        linkedListBuilder(
          "block",
          linkedListBuilder(
            "sequence",
            linkedListBuilder(
              linkedListBuilder(
                "assignment",
                linkedListBuilder("name", '"x"'),
                linkedListBuilder("literal", "5"),
              ),
              linkedListBuilder("return_statement", linkedListBuilder("name", '"x"')),
            ),
          ),
        ),
      ),
    );
  });

  it("function declaration: only one local declaration (block but no sequence)", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("def f():\\n    x = 5")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "function_declaration",
        linkedListBuilder("name", '"f"'),
        "None",
        linkedListBuilder(
          "block",
          linkedListBuilder(
            "assignment",
            linkedListBuilder("name", '"x"'),
            linkedListBuilder("literal", "5"),
          ),
        ),
      ),
    );
  });

  it("function declaration: nonlocal exempts name from block wrapping", async () => {
    const { renderedResult } = await compileToWasmAndRun(
      `parse("def f():\\n    nonlocal x\\n    x = 5\\n    return x")`,
      true,
    );
    expect(renderedResult).toBe(
      linkedListBuilder(
        "function_declaration",
        linkedListBuilder("name", '"f"'),
        "None",
        linkedListBuilder(
          "sequence",
          linkedListBuilder(
            linkedListBuilder("nonlocal_declaration", linkedListBuilder("name", '"x"')),
            linkedListBuilder(
              "assignment",
              linkedListBuilder("name", '"x"'),
              linkedListBuilder("literal", "5"),
            ),
            linkedListBuilder("return_statement", linkedListBuilder("name", '"x"')),
          ),
        ),
      ),
    );
  });

  it("lambda expression", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("lambda x, y: x + y")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "lambda_expression",
        linkedListBuilder('"x"', '"y"'),
        linkedListBuilder(
          "return_statement",
          linkedListBuilder(
            "binary_operator_combination",
            '"+"',
            linkedListBuilder("name", '"x"'),
            linkedListBuilder("name", '"y"'),
          ),
        ),
      ),
    );
  });

  it("return statement", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("return 1")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder("return_statement", linkedListBuilder("literal", "1")),
    );
  });

  it("break statement", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("break")`, true);
    expect(renderedResult).toBe(linkedListBuilder("break_statement"));
  });

  it("continue statement", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("continue")`, true);
    expect(renderedResult).toBe(linkedListBuilder("continue_statement"));
  });

  it("pass statement", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("pass")`, true);
    expect(renderedResult).toBe(linkedListBuilder("pass_statement"));
  });

  it("nonlocal declaration", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("nonlocal x")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder("nonlocal_declaration", linkedListBuilder("name", '"x"')),
    );
  });

  it("list expression", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("[1, 2, 3]")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "list_expression",
        linkedListBuilder(
          linkedListBuilder("literal", "1"),
          linkedListBuilder("literal", "2"),
          linkedListBuilder("literal", "3"),
        ),
      ),
    );
  });

  it("subscript (object access)", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("x[0]")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "object_access",
        linkedListBuilder("name", '"x"'),
        linkedListBuilder("literal", "0"),
      ),
    );
  });

  it("function call (application)", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("f(1, 2)")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "application",
        linkedListBuilder("name", '"f"'),
        linkedListBuilder(linkedListBuilder("literal", "1"), linkedListBuilder("literal", "2")),
      ),
    );
  });

  // it("if-else statement", async () => {
  //   const { renderedResult } = await compileToWasmAndRun(
  //     `parse("if True:\\n    1\\nelse:\\n    2")`,
  //     true,
  //   );
  //   expect(renderedResult).toBe(
  //     linkedListBuilder(
  //       "conditional_statement",
  //       linkedListBuilder("literal", "True"),
  //       linkedListBuilder("literal", "1"),
  //       linkedListBuilder("literal", "2"),
  //     ),
  //   );
  // });

  // it("if-else statement with multiple statements per branch", async () => {
  //   const { renderedResult } = await compileToWasmAndRun(
  //     `parse("if True:\\n    x = 1\\n    y\\nelse:\\n    pass\\n    z")`,
  //     true,
  //   );
  //   expect(renderedResult).toBe(
  //     linkedListBuilder(
  //       "conditional_statement",
  //       linkedListBuilder("literal", "True"),
  //       linkedListBuilder(
  //         "sequence",
  //         linkedListBuilder(
  //           linkedListBuilder(
  //             "assignment",
  //             linkedListBuilder("name", '"x"'),
  //             linkedListBuilder("literal", "1"),
  //           ),
  //           linkedListBuilder("name", '"y"'),
  //         ),
  //       ),
  //       linkedListBuilder(
  //         "sequence",
  //         linkedListBuilder(linkedListBuilder("pass_statement"), linkedListBuilder("name", '"z"')),
  //       ),
  //     ),
  //   );
  // });

  it("while loop: single statement body (no sequence)", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("while True:\\n    1")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "while_loop",
        linkedListBuilder("literal", "True"),
        linkedListBuilder("literal", "1"),
      ),
    );
  });

  it("while loop: multiple statement body (sequence)", async () => {
    const { renderedResult } = await compileToWasmAndRun(
      `parse("while True:\\n    x = 1\\n    x")`,
      true,
    );
    expect(renderedResult).toBe(
      linkedListBuilder(
        "while_loop",
        linkedListBuilder("literal", "True"),
        linkedListBuilder(
          "sequence",
          linkedListBuilder(
            linkedListBuilder(
              "assignment",
              linkedListBuilder("name", '"x"'),
              linkedListBuilder("literal", "1"),
            ),
            linkedListBuilder("name", '"x"'),
          ),
        ),
      ),
    );
  });

  it("for loop: range(stop)", async () => {
    const { renderedResult } = await compileToWasmAndRun(
      `parse("for i in range(5):\\n    1")`,
      true,
    );
    expect(renderedResult).toBe(
      linkedListBuilder(
        "for_loop",
        linkedListBuilder("name", '"i"'),
        linkedListBuilder("range_args", linkedListBuilder("literal", "5")),
        linkedListBuilder("literal", "1"),
      ),
    );
  });

  it("for loop: range(start, stop)", async () => {
    const { renderedResult } = await compileToWasmAndRun(
      `parse("for i in range(2, 5):\\n    1")`,
      true,
    );
    expect(renderedResult).toBe(
      linkedListBuilder(
        "for_loop",
        linkedListBuilder("name", '"i"'),
        linkedListBuilder(
          "range_args",
          linkedListBuilder("literal", "2"),
          linkedListBuilder("literal", "5"),
        ),
        linkedListBuilder("literal", "1"),
      ),
    );
  });

  it("for loop: range(start, stop, step)", async () => {
    const { renderedResult } = await compileToWasmAndRun(
      `parse("for i in range(1, 10, 2):\\n    1")`,
      true,
    );
    expect(renderedResult).toBe(
      linkedListBuilder(
        "for_loop",
        linkedListBuilder("name", '"i"'),
        linkedListBuilder(
          "range_args",
          linkedListBuilder("literal", "1"),
          linkedListBuilder("literal", "10"),
          linkedListBuilder("literal", "2"),
        ),
        linkedListBuilder("literal", "1"),
      ),
    );
  });

  it("for loop with multiple statements in body", async () => {
    const { renderedResult } = await compileToWasmAndRun(
      `parse("for i in range(5):\\n    x = 1\\n    i")`,
      true,
    );
    expect(renderedResult).toBe(
      linkedListBuilder(
        "for_loop",
        linkedListBuilder("name", '"i"'),
        linkedListBuilder("range_args", linkedListBuilder("literal", "5")),
        linkedListBuilder(
          "sequence",
          linkedListBuilder(
            linkedListBuilder(
              "assignment",
              linkedListBuilder("name", '"x"'),
              linkedListBuilder("literal", "1"),
            ),
            linkedListBuilder("name", '"i"'),
          ),
        ),
      ),
    );
  });
});

describe("GC/Shadow stack manipulation tests", () => {
  const expectShadowStackToEqual = async (
    pythonCode: string,
    expectedTags: number[],
    compileOptions: CompileOptions = {},
    interactiveMode: boolean = true,
  ) => {
    const { getStackAt, ...rest } = interactiveMode
      ? await compileToWasmAndRun(pythonCode, true, compileOptions)
      : await compileToWasmAndRun(pythonCode, false, compileOptions);

    // Check each frame's tag on the stack
    expectedTags.forEach((expectedTag, index) => expect(getStackAt(index)[0]).toBe(expectedTag));

    // Verify accessing one position past the stack throws STACK_UNDERFLOW
    expect(() => getStackAt(expectedTags.length)).toThrow(new Error(ERROR_MAP.STACK_UNDERFLOW));

    return rest;
  };

  describe("MAKE_* tests", () => {
    it("MAKE_STRING pushes returned string to stack top", async () => {
      await expectShadowStackToEqual(`"hello"`, [TYPE_TAG.STRING]);
    });

    it("MAKE_COMPLEX pushes returned complex to stack top", async () => {
      await expectShadowStackToEqual(`2j`, [TYPE_TAG.COMPLEX]);
    });

    it("MAKE_CLOSURE pushes returned closure to stack top", async () => {
      await expectShadowStackToEqual(`lambda x: x + 1`, [TYPE_TAG.CLOSURE]);
    });

    it("MAKE_LIST pushes returned list to stack top", async () => {
      await expectShadowStackToEqual(`[1, 2, 3]`, [TYPE_TAG.LIST]);
    });

    it("MAKE_PAIR pushes returned pair to stack top", async () => {
      await expectShadowStackToEqual(`pair(1, 2)`, [TYPE_TAG.LIST]);
    });

    it("adding non-complex with complex pushes result to stack top", async () => {
      await expectShadowStackToEqual(`3 + 2j`, [TYPE_TAG.COMPLEX]);
    });
  });

  describe("binary operator tests", () => {
    it("adding two complexes pushes result to stack top", async () => {
      await expectShadowStackToEqual(`2j + 3j`, [TYPE_TAG.COMPLEX]);
    });

    it("concatenating two strings pushes result to stack top", async () => {
      await expectShadowStackToEqual(`"foo" + "bar"`, [TYPE_TAG.STRING]);
    });
  });

  describe("GET/SET_LEX_ADDRESS", () => {
    it("setting variable to GCable object should pop GCable object off stack", async () => {
      const pythonCode = `x = [1, 2, 3]`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("getting GCable variable should push variable's value onto stack", async () => {
      const pythonCode = `
x = [1, 2, 3]
x
`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("getting non-GCable variable should push not push anything onto stack", async () => {
      const pythonCode = `
x = 42
x
`;
      await expectShadowStackToEqual(pythonCode, []);
    });
  });

  describe("list-related tests", () => {
    it("while creating list, list pointer should be on stack until SET_CONTIGUOUS", async () => {
      const pythonCode = `[1, 2, 3]`;

      const irPass = insertInArray(
        node => isFunctionCall(node, MAKE_LIST_FX) && node.arguments,
        instruction => isFunctionCall(instruction, SILENT_PUSH_SHADOW_STACK_FX),
        [wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0)))],
      );

      const { rawOutputs, rawResult } = await expectShadowStackToEqual(
        pythonCode,
        [TYPE_TAG.LIST],
        { irPasses: [irPass] },
      );

      // without intervening GC, the list state pointer should be the same as the resultant list
      // pointer, and should be on stack until SET_CONTIGUOUS
      expect(rawOutputs[0][0]).toBe(SHADOW_STACK_TAG.LIST_STATE);
      expect((rawOutputs[0][1] << 32n) | 3n).toBe(rawResult![1]);
    });

    it("GCable element in list should NOT be on stack (already popped by SET_CONTIGUOUS)", async () => {
      const pythonCode = `[1, 2, [3, 4]]`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("accessing list element that is not GCable should not push anything onto stack", async () => {
      const pythonCode = `x = [10, 20, 30]
x[1]
`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("accessing list element that is GCable should push element onto stack", async () => {
      const pythonCode = `
x = [10, [1, 2], 30]
x[1]
`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("accessing list element that is GCable should push element onto stack (direct access)", async () => {
      const pythonCode = `[10, [1, 2], 30][1]`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("setting list element should not push anything onto stack", async () => {
      const pythonCode = `
x = [10, 20, 30]
x[1] = 25
`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("setting list element that is GCable (list) should not push anything onto stack", async () => {
      const pythonCode = `
x = [10, 20, 30]
x[1] = [3, 4]
`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("setting list element that is GCable (string) should not push anything onto stack", async () => {
      const pythonCode = `
x = [10, 20, 30]
x[1] = "hello"
`;
      await expectShadowStackToEqual(pythonCode, []);
    });
  });

  describe("closure-related tests", () => {
    it("while calling function: before PRE_APPLY, return address should be on stack", async () => {
      const pythonCode = `
def f(x):
    return x + 1
f(10)
`;

      const irPass = insertInArray(
        node => isFunctionCall(node, APPLY_FX_NAME) && node.arguments,
        instruction => isFunctionCall(instruction, SILENT_PUSH_SHADOW_STACK_FX),
        [wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0)))],
      );

      const { rawOutputs } = await expectShadowStackToEqual(pythonCode, [], {
        irPasses: [irPass],
      });

      expect(rawOutputs[0][0]).toBe(SHADOW_STACK_TAG.CALL_RETURN_ADDR);
    });

    it("while calling function: after PRE_APPLY, return address + callee value should be on stack", async () => {
      const pythonCode = `
def f(x):
    return x + 1
f(10)
`;

      const irPass = insertInArray(
        node => {
          const secondPush =
            isFunctionCall(node, APPLY_FX_NAME) &&
            node.arguments &&
            node.arguments.filter(arg => isFunctionCall(arg, SILENT_PUSH_SHADOW_STACK_FX))[1];

          return secondPush && secondPush.arguments;
        },
        instruction =>
          instruction != null &&
          typeof instruction === "object" &&
          "op" in instruction &&
          instruction.op === "i64.extend_i32_u",
        [
          wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0))),
          wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(1))),
        ],
      );

      const { rawOutputs } = await expectShadowStackToEqual(pythonCode, [], {
        irPasses: [irPass],
      });

      expect(rawOutputs[0][0]).toBe(TYPE_TAG.CLOSURE);
      expect(rawOutputs[1][0]).toBe(SHADOW_STACK_TAG.CALL_RETURN_ADDR);
    });

    it("while calling function: before SET_CONTIGUOUS_BLOCK, return address + callee value + new env pointer should be on stack", async () => {
      const pythonCode = `
def f(x):
    return x + 1
f(10)
`;

      const irPass = insertInArray(
        node => isFunctionCall(node, APPLY_FX_NAME) && node.arguments,
        instruction => isFunctionCall(instruction, SILENT_PUSH_SHADOW_STACK_FX),
        [
          wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0))),
          wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(1))),
          wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(2))),
        ],
        { matchIndex: 1 },
      );

      const { rawOutputs } = await expectShadowStackToEqual(pythonCode, [], {
        irPasses: [irPass],
      });

      expect(rawOutputs[0][0]).toBe(SHADOW_STACK_TAG.CALL_NEW_ENV);
      expect(rawOutputs[1][0]).toBe(TYPE_TAG.CLOSURE);
      expect(rawOutputs[2][0]).toBe(SHADOW_STACK_TAG.CALL_RETURN_ADDR);
    });

    it("function definition should NOT push closure to stack", async () => {
      const pythonCode = `
def f(x):
    return x + 1
`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("function value should push closure to stack", async () => {
      const pythonCode = `
def f(x):
    return x + 1
f
`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.CLOSURE]);
    });

    it("creating lambda should push closure to stack", async () => {
      const pythonCode = `lambda x: x + 1`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.CLOSURE]);
    });

    it("calling non-GCable-producing function should not push anything onto stack", async () => {
      const pythonCode = `
def f(x):
    return x + 1
f(10)
`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("calling function that returns GCable should push returned GCable onto stack", async () => {
      const pythonCode = `
def f(x):
    return [x]
f(10)
`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("GCable argument should NOT be on stack (already popped by SET_CONTIGUOUS)", async () => {
      const pythonCode = `
def f(x):
    return
f([1, 2])
`;

      await expectShadowStackToEqual(pythonCode, []);
    });
  });

  describe("APPLY function special handling tests", () => {
    it("before any MALLOC in APPLY, stack should only contain return address", async () => {
      const pythonCode = `
def f(x):
    return x + 1
f(10)
`;

      const irPass = insertInArray(
        node => isFunctionOfName(node, APPLY_FX_NAME) && node.body,
        instruction =>
          instruction != null &&
          typeof instruction === "object" &&
          "op" in instruction &&
          instruction.op === "local.set",
        [wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0)))],
        { before: true },
      );

      const { rawOutputs } = await expectShadowStackToEqual(pythonCode, [], {
        irPasses: [irPass],
      });

      expect(rawOutputs[0][0]).toBe(SHADOW_STACK_TAG.CALL_RETURN_ADDR);
    });

    it("before any MALLOC in APPLY for varargs, stack should only contain return address", async () => {
      const pythonCode = `
def f(*x):
    return x[0]
f(10, 20)
    `;

      const irPass = insertInArray(
        node => isFunctionOfName(node, APPLY_FX_NAME) && node.body,
        instruction =>
          instruction != null &&
          typeof instruction === "object" &&
          "op" in instruction &&
          instruction.op === "if",
        [wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0)))],
        { matchIndex: 1, before: true },
      );

      const { rawOutputs } = await expectShadowStackToEqual(pythonCode, [], {
        irPasses: [irPass],
      });

      expect(rawOutputs[0][0]).toBe(SHADOW_STACK_TAG.CALL_RETURN_ADDR);
    });
  });

  describe("library function tests", () => {
    it("pair function with non-GCable arguments should push resultant list onto stack", async () => {
      const pythonCode = `pair(1, 2)`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("pair function with one GCable argument should push resultant list onto stack", async () => {
      const pythonCode = `pair(1, "test")`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("pair function with two GCable arguments should push resultant list onto stack", async () => {
      const pythonCode = `pair([1, 2], [3, 4])`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("nested pair should push resultant list onto stack (only one)", async () => {
      const pythonCode = `pair(1, pair(2, None))`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("is_pair function should leave stack clean (not push result onto stack)", async () => {
      const pythonCode = `is_pair(pair(1, 2))`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("head function should NOT push result onto stack if it's not GCable", async () => {
      const pythonCode = `head(pair(1, 2))`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("head function should push result onto stack if it's GCable", async () => {
      const pythonCode = `head(pair([1, 2], 3))`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("tail function should NOT push result onto stack if it's not GCable", async () => {
      const pythonCode = `tail(pair(1, 2))`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("tail function should push result onto stack if it's GCable", async () => {
      const pythonCode = `tail(pair(3, [1, 2]))`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    // it("linked_list function should push resultant list onto stack", async () => {
    //   const pythonCode = `linked_list(1, 2, 3)`;
    //   await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    // });

    it("set_head function should NOT push anything onto stack if new head is not GCable", async () => {
      const pythonCode = `
x = pair(1, 2)
set_head(x, 3)
`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("set_head function should NOT push new head onto stack if it's GCable", async () => {
      const pythonCode = `
x = pair(1, 2)
set_head(x, [3, 4])
`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("set_tail function should NOT push anything onto stack if new tail is not GCable", async () => {
      const pythonCode = `
x = pair(1, 2)
set_tail(x, 3)
`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("set_tail function should NOT push new tail onto stack if it's GCable", async () => {
      const pythonCode = `
x = pair(1, 2)
set_tail(x, [3, 4])
`;
      await expectShadowStackToEqual(pythonCode, []);
    });
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
      new Error(ERROR_MAP.UNBOUND),
    );
  });

  it("non-expression statements should return None in interactive mode", async () => {
    const pythonCode = `
x = 5
y = 10
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.NONE);
    expect(renderedResult).toBe("None");
  });
});
