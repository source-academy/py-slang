import { compileToWasmAndRun } from "../wasm-compiler";
import { TYPE_TAG } from "../wasm-compiler/constants";

describe("Arithmetic operator tests (int, float, complex, string)", () => {
  // --- INT ARITHMETIC ---
  it("int addition", async () => {
    const pythonCode = `1 + 2`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(3)]);
  });

  it("mixed int arithmetic with precedence", async () => {
    const pythonCode = `2 + 3 * 4 - 5`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(9)]);
  });

  it("int division (floor div semantics unsupported -> float?)", async () => {
    const pythonCode = `5 / 2`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result[0]).toBe(TYPE_TAG.FLOAT);
  });

  // --- FLOAT ARITHMETIC ---
  it("float addition", async () => {
    const pythonCode = `1.5 + 2.25`;
    const result = await compileToWasmAndRun(pythonCode);

    // expect float tag + stored f64 bits
    expect(result[0]).toBe(TYPE_TAG.FLOAT);
  });

  it("mixed int + float -> float", async () => {
    const pythonCode = `3 + 2.5`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result[0]).toBe(TYPE_TAG.FLOAT);
  });

  it("float multiplication", async () => {
    const pythonCode = `1.2 * 3.4`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result[0]).toBe(TYPE_TAG.FLOAT);
  });

  // --- COMPLEX ARITHMETIC ---
  it("complex addition", async () => {
    const pythonCode = `
(1+2j) + (3+4j)
`;
    const result = await compileToWasmAndRun(pythonCode);

    expect(result[0]).toBe(TYPE_TAG.COMPLEX);
  });

  it("complex multiplication", async () => {
    const pythonCode = `
(2+3j) * (4+5j)
`;
    const result = await compileToWasmAndRun(pythonCode);

    expect(result[0]).toBe(TYPE_TAG.COMPLEX);
  });

  it("complex with real (int) -> complex", async () => {
    const pythonCode = `
(1+2j) + 10
`;
    const result = await compileToWasmAndRun(pythonCode);

    expect(result[0]).toBe(TYPE_TAG.COMPLEX);
  });

  // --- STRING ARITHMETIC ---
  it("string concatenation with +", async () => {
    const pythonCode = `"hello" + " world"`;
    const result = await compileToWasmAndRun(pythonCode);

    expect(result[0]).toBe(TYPE_TAG.STRING);
  });

  //   it("string repetition with *", async () => {
  //     const pythonCode = `"ab" * 3`;
  //     const result = await compileToWasmAndRun(pythonCode);

  //     expect(result[0]).toBe(TYPE_TAG.STRING);
  //   });

  it("string + int should error (type mismatch)", async () => {
    const pythonCode = `"a" + 1`;
    await expect(compileToWasmAndRun(pythonCode)).rejects.toThrow();
  });
});

describe("Comparison operator tests (int, float, complex, string)", () => {
  // --- INT COMPARE ---
  it("int eq true", async () => {
    const pythonCode = `3 == 3`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("int lt false", async () => {
    const pythonCode = `5 < 1`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(0)]);
  });

  // --- FLOAT COMPARE ---
  it("float == float", async () => {
    const pythonCode = `1.25 == 1.25`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("float < int", async () => {
    const pythonCode = `1.5 < 2`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  // --- COMPLEX COMPARE ---
  it("complex == complex (Python: only equal works)", async () => {
    const pythonCode = `(1+2j) == (1+2j)`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("complex ordering (<, >, etc.) must error", async () => {
    const pythonCode = `(1+1j) < (2+2j)`;
    await expect(compileToWasmAndRun(pythonCode)).rejects.toThrow();
  });

  // --- STRING COMPARE ---
  it("string equality true", async () => {
    const pythonCode = `"abc" == "abc"`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("string ordering lexicographically", async () => {
    const pythonCode = `"apple" < "banana"`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("string compare with non-string errors", async () => {
    const pythonCode = `"x" < 3`;
    await expect(compileToWasmAndRun(pythonCode)).rejects.toThrow();
  });
});

describe("Boolean tests", () => {
  // --- BASIC BOOL() SEMANTICS ---
  it("bool(0) -> False", async () => {
    const pythonCode = `bool(0)`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(0)]);
  });

  it("bool(5) -> True", async () => {
    const pythonCode = `bool(5)`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("bool(0.0) -> False", async () => {
    const pythonCode = `bool(0.0)`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(0)]);
  });

  it("bool(nonzero float) -> True", async () => {
    const pythonCode = `bool(3.14)`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("bool(0+0j) -> False", async () => {
    const pythonCode = `bool(0+0j)`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(0)]);
  });

  it("bool(complex with nonzero part) -> True", async () => {
    const pythonCode = `bool(1+0j)`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("bool('') -> False", async () => {
    const pythonCode = `bool("")`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(0)]);
  });

  it("bool(non-empty string) -> True", async () => {
    const pythonCode = `bool("x")`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("bool(pair) -> always True", async () => {
    const pythonCode = `
p = pair(1, 2)
bool(p)
  `;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("bool(None) -> False", async () => {
    const pythonCode = `bool(None)`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(0)]);
  });

  // --- NOT OPERATOR ---
  it("not True", async () => {
    const pythonCode = `not True`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(0)]);
  });

  it("not 0", async () => {
    const pythonCode = `not 0`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(1)]);
  });

  it("not nonzero", async () => {
    const pythonCode = `not 5`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.BOOL, BigInt(0)]);
  });

  // --- AND ---
  it("0 and 5 -> 0 (first falsy)", async () => {
    const pythonCode = `0 and 5`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(0)]);
  });

  it("5 and 0 -> 0", async () => {
    const pythonCode = `5 and 0`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(0)]);
  });

  it("5 and 3 -> 3 (last truthy)", async () => {
    const pythonCode = `5 and 3`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(3)]);
  });

  it("'hello' and 10 -> 10", async () => {
    const pythonCode = `"hello" and 10`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(10)]);
  });

  it("'hello' and '' -> ''", async () => {
    const pythonCode = `"hello" and ""`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result[0]).toBe(TYPE_TAG.STRING);
  });

  it("pair and None -> None", async () => {
    const pythonCode = `
p = pair(1,2)
p and None
`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result[0]).toBe(TYPE_TAG.NONE);
  });

  // --- OR ---
  it("0 or 5 -> 5 (first truthy)", async () => {
    const pythonCode = `0 or 5`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(5)]);
  });

  it("'' or 'abc' -> 'abc'", async () => {
    const pythonCode = `"" or "abc"`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result[0]).toBe(TYPE_TAG.STRING);
  });

  it("'x' or 100 -> 'x'", async () => {
    const pythonCode = `"x" or 100`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result[0]).toBe(TYPE_TAG.STRING);
  });

  it("None or pair(1,2) -> pair", async () => {
    const pythonCode = `
None or pair(1,2)
`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result[0]).toBe(TYPE_TAG.PAIR);
  });

  // --- SHORT CIRCUITING ---
  it("and short-circuits (second expr not evaluated)", async () => {
    const pythonCode = `
x = 0
def boom():
    x = x + 1  # would error if executed
0 and boom()
`;
    const result = await compileToWasmAndRun(pythonCode);
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
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(1)]);
  });
});

describe("Pair tests", () => {
  it("construct pair and read head/tail", async () => {
    const pythonCode = `
p = pair(1, 2)
head(p) + tail(p)
`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([0, BigInt(3)]);
  });

  it("set_head mutates pair", async () => {
    const pythonCode = `
p = pair(10, 20)
set_head(p, 99)
head(p)
`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([0, BigInt(99)]);
  });

  it("set_tail mutates pair", async () => {
    const pythonCode = `
p = pair(10, 20)
set_tail(p, 7)
tail(p)
`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([0, BigInt(7)]);
  });

  it("nested pairs form linked list", async () => {
    const pythonCode = `
p = pair(1, pair(2, pair(3, None)))
head(tail(tail(p)))
`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([0, BigInt(3)]);
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
    const result = await compileToWasmAndRun(pythonCode);
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
    const result = await compileToWasmAndRun(pythonCode);
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
    const result = await compileToWasmAndRun(pythonCode);
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
    await expect(compileToWasmAndRun(pythonCode)).rejects.toThrow(
      "No binding for nonlocal x found!"
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
    await expect(compileToWasmAndRun(pythonCode)).rejects.toThrow(
      "No binding for nonlocal x found!"
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
    const result = await compileToWasmAndRun(pythonCode);
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
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([TYPE_TAG.INT, BigInt(1)]); // last expr => b()
  });
});
