import { i32, wasm } from "@sourceacademy/wasm-util";
import { CompileOptions, compileToWasmAndRun } from "../engines/wasm";
import {
  APPLY_FX_NAME,
  ARITHMETIC_OP_FX,
  COLLECT_FX,
  ERROR_MAP,
  GET_LAST_EXPR_RESULT_FX,
  GET_LEX_ADDR_FX,
  MAKE_CLOSURE_FX,
  MAKE_COMPLEX_FX,
  MAKE_LIST_FX,
  MAKE_STRING_FX,
  PEEK_SHADOW_STACK_FX,
  SET_CONTIGUOUS_BLOCK_FX,
  SHADOW_STACK_TAG,
  SILENT_PUSH_SHADOW_STACK_FX,
  TYPE_TAG,
} from "../engines/wasm/constants";
import {
  insertInArray,
  isFunctionCall,
  isFunctionOfName,
  isIfInstruction,
} from "../engines/wasm/irHelpers";

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

  it("pure imaginary output omits leading zero real part", async () => {
    const pythonCode = `2j`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.COMPLEX);
    expect(renderedResult).toBe("2j");
  });

  it("complex output prints minus sign for negative imaginary part", async () => {
    const pythonCode = `1-2j`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.COMPLEX);
    expect(renderedResult).toBe("1 - 2j");
  });

  // --- STRING ARITHMETIC ---
  it("string concatenation with +", async () => {
    const pythonCode = `"hello" + " world"`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.STRING);
    expect(renderedResult).toBe("hello world");
  });

  it("string literal with multibyte UTF-8 characters", async () => {
    const pythonCode = `"😀"`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.STRING);
    expect(renderedResult).toBe("😀");
  });

  it("string concatenation with multibyte UTF-8 characters", async () => {
    const pythonCode = `"😀" + "é"`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.STRING);
    expect(renderedResult).toBe("😀é");
  });

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
  const expectComparisonToBe = async (pythonCode: string, expected: "True" | "False") => {
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe(expected);
  };

  const expectComparisonToError = async (pythonCode: string, errorMessage: string) => {
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(new Error(errorMessage));
  };

  // --- INT COMPARE ---
  it("int ==", async () => expectComparisonToBe(`3 == 3`, "True"));
  it("int !=", async () => expectComparisonToBe(`3 != 4`, "True"));
  it("int <", async () => expectComparisonToBe(`5 < 1`, "False"));
  it("int <=", async () => expectComparisonToBe(`5 <= 5`, "True"));
  it("int >", async () => expectComparisonToBe(`7 > 2`, "True"));
  it("int >=", async () => expectComparisonToBe(`2 >= 9`, "False"));

  // --- FLOAT/INT MIXED COMPARE ---
  it("float/int ==", async () => expectComparisonToBe(`1.5 == 1.5`, "True"));
  it("float/int !=", async () => expectComparisonToBe(`1.5 != 2`, "True"));
  it("float/int <", async () => expectComparisonToBe(`1.5 < 2`, "True"));
  it("float/int <=", async () => expectComparisonToBe(`2.0 <= 2`, "True"));
  it("float/int >", async () => expectComparisonToBe(`3.25 > 3`, "True"));
  it("float/int >=", async () => expectComparisonToBe(`3.0 >= 4`, "False"));

  // --- COMPLEX COMPARE ---
  it("complex ==", async () => expectComparisonToBe(`(1+2j) == (1+2j)`, "True"));
  it("complex !=", async () => expectComparisonToBe(`(1+2j) != (2+1j)`, "True"));

  it("complex < must error", async () =>
    expectComparisonToError(`(1+1j) < (2+2j)`, ERROR_MAP.COMPLEX_COMPARISON));
  it("complex <= must error", async () =>
    expectComparisonToError(`(1+1j) <= (2+2j)`, ERROR_MAP.COMPLEX_COMPARISON));
  it("complex > must error", async () =>
    expectComparisonToError(`(1+1j) > (2+2j)`, ERROR_MAP.COMPLEX_COMPARISON));
  it("complex >= must error", async () =>
    expectComparisonToError(`(1+1j) >= (2+2j)`, ERROR_MAP.COMPLEX_COMPARISON));

  // --- STRING COMPARE ---
  it("string ==", async () => expectComparisonToBe(`"abc" == "abc"`, "True"));
  it("string !=", async () => expectComparisonToBe(`"abc" != "abd"`, "True"));
  it("string <", async () => expectComparisonToBe(`"apple" < "banana"`, "True"));
  it("string <=", async () => expectComparisonToBe(`"apple" <= "apple"`, "True"));
  it("string >", async () => expectComparisonToBe(`"pear" > "orange"`, "True"));
  it("string >=", async () => expectComparisonToBe(`"pear" >= "zebra"`, "False"));

  it("string < non-string must error", async () =>
    expectComparisonToError(`"x" < 3`, ERROR_MAP.COMPARE_OP_UNKNOWN_TYPE));
  it("string <= non-string must error", async () =>
    expectComparisonToError(`"x" <= 3`, ERROR_MAP.COMPARE_OP_UNKNOWN_TYPE));
  it("string > non-string must error", async () =>
    expectComparisonToError(`"x" > 3`, ERROR_MAP.COMPARE_OP_UNKNOWN_TYPE));
  it("string >= non-string must error", async () =>
    expectComparisonToError(`"x" >= 3`, ERROR_MAP.COMPARE_OP_UNKNOWN_TYPE));
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

    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
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
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error("x is a parameter and cannot be declared nonlocal!"),
    );
  });

  it("undefined name error", async () => {
    const pythonCode = `undefined_variable`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error("Name undefined_variable not defined!"),
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
  it("for loop: only range() is supported", async () => {
    const pythonCode = `
for i in [1, 2, 3]:
    pass
`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error("Only range() is supported in for loops"),
    );
  });

  it("for loop: range() requires at least one argument", async () => {
    const pythonCode = `
for i in range():
    pass
`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error("range() requires at least one argument"),
    );
  });

  it("for loop: range() accepts at most 3 arguments", async () => {
    const pythonCode = `
for i in range(1, 2, 3, 4):
    pass
`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error("range() accepts at most 3 arguments"),
    );
  });

  it("for loop: range(stop) requires integer stop", async () => {
    const pythonCode = `
for i in range(3.5):
    pass
`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error(ERROR_MAP.RANGE_ARG_NOT_INT),
    );
  });

  it("for loop: range(start, stop) requires integer start", async () => {
    const pythonCode = `
for i in range(1.5, 4):
    pass
`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error(ERROR_MAP.RANGE_ARG_NOT_INT),
    );
  });

  it("for loop: range(start, stop) requires integer stop", async () => {
    const pythonCode = `
for i in range(1, 4.5):
    pass
`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error(ERROR_MAP.RANGE_ARG_NOT_INT),
    );
  });

  it("for loop: range(start, stop, step) requires integer step", async () => {
    const pythonCode = `
for i in range(1, 5, 0.5):
    pass
`;
    await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
      new Error(ERROR_MAP.RANGE_ARG_NOT_INT),
    );
  });

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

  it("is_list identifies varargs tuples as lists", async () => {
    const pythonCode = `
def f(*args):
    return is_list(args)

f(1, 2, 3)
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
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
  describe("*args tests", () => {
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

    it("only one *args allowed", async () => {
      const pythonCode = `
def f(*args1, *args2):
    return list_length(args1) + list_length(args2)

f(1, 2, 3)
`;
      await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
        new Error("Only one starred parameter is allowed"),
      );
    });

    it("lambda with fixed arg and *args", async () => {
      const pythonCode = `
f = lambda a, *args: args[0] + args[1]
f(1, 2, 3)
`;
      const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
      expect(rawResult[0]).toBe(TYPE_TAG.INT);
      expect(renderedResult).toBe("5");
    });

    it("lambda with only *args", async () => {
      const pythonCode = `
f = lambda *args: list_length(args)
f(1, 2, 3)
`;
      const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
      expect(rawResult[0]).toBe(TYPE_TAG.INT);
      expect(renderedResult).toBe("3");
    });

    it("lambda with fixed arg and *args still enforces minimum arity", async () => {
      const pythonCode = `
f = lambda a, *args: a
f()
`;
      await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
        new Error(ERROR_MAP.FUNC_WRONG_ARITY),
      );
    });

    it("lambda only one *args allowed", async () => {
      const pythonCode = `
f = lambda *args1, *args2: list_length(args1)
f(1, 2, 3)
`;
      await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
        new Error("Only one starred parameter is allowed"),
      );
    });

    it("lambda *args must be last parameter", async () => {
      const pythonCode = `
f = lambda *args, a: a
f(1, 2, 3)
`;
      await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
        new Error("Starred parameter must be the last parameter"),
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
      const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
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
      await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
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
      const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
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
      await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
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
      await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
        new Error(ERROR_MAP.FUNC_WRONG_ARITY),
      );
    });

    it("lambda can be called with unpacked list arguments", async () => {
      const pythonCode = `
f = lambda a, b, c: a + b + c
args = [2, 3]
f(1, *args)
`;
      const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
      expect(rawResult[0]).toBe(TYPE_TAG.INT);
      expect(renderedResult).toBe("6");
    });

    it("lambda unpacking a non-list should error", async () => {
      const pythonCode = `
f = lambda a, b: a + b
f(1, *42)
`;
      await expect(compileToWasmAndRun(pythonCode, true)).rejects.toThrow(
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
      const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
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
      const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
      expect(rawResult[0]).toBe(TYPE_TAG.INT);
      expect(renderedResult).toBe("5");
    });

    it("lambda with *args accepts unpacked arguments", async () => {
      const pythonCode = `
f = lambda a, *args: a + args[0] + args[1]
rest = [2, 3]
f(1, *rest)
`;
      const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
      expect(rawResult[0]).toBe(TYPE_TAG.INT);
      expect(renderedResult).toBe("6");
    });
  });
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

  it("tokenizes multibyte UTF-8 string lexemes", async () => {
    const { renderedResult } = await compileToWasmAndRun(`tokenize('"😀é"')`, true);
    expect(renderedResult).toBe(linkedListBuilder('"😀é"'));
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

  it("parse on non-string should error", async () => {
    await expect(compileToWasmAndRun(`parse(42)`, true)).rejects.toThrow(
      new Error(ERROR_MAP.PARSE_NOT_STRING),
    );
  });

  it("empty input returns sequence(None)", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("")`, true);
    expect(renderedResult).toBe(linkedListBuilder("sequence", linkedListBuilder("None")));
  });

  it("integer literal", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("42")`, true);
    expect(renderedResult).toBe(linkedListBuilder("literal", "42"));
  });

  it("float literal", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("3.5")`, true);
    expect(renderedResult).toBe(linkedListBuilder("literal", "3.5"));
  });

  it("complex literal (pure imaginary)", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("2j")`, true);
    expect(renderedResult).toBe(linkedListBuilder("literal", "2j"));
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

  it("string literal with multibyte UTF-8 characters", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse('"😀é"')`, true);
    expect(renderedResult).toBe(linkedListBuilder("literal", '"😀é"'));
  });

  it("name", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("x")`, true);
    expect(renderedResult).toBe(linkedListBuilder("name", '"x"'));
  });

  it("grouping expression unwraps to inner expression", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("(1)")`, true);
    expect(renderedResult).toBe(linkedListBuilder("literal", "1"));
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

  it("bare return statement returns None", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("return")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder("return_statement", linkedListBuilder("literal", "None")),
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

  it("if-else statement", async () => {
    const { renderedResult } = await compileToWasmAndRun(
      `parse("if True:\\n    1\\nelse:\\n    2")`,
      true,
    );
    expect(renderedResult).toBe(
      linkedListBuilder(
        "conditional_statement",
        linkedListBuilder("literal", "True"),
        linkedListBuilder("literal", "1"),
        linkedListBuilder("literal", "2"),
      ),
    );
  });

  it("if statement without else uses None as else branch", async () => {
    const { renderedResult } = await compileToWasmAndRun(`parse("if True:\\n    1")`, true);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "conditional_statement",
        linkedListBuilder("literal", "True"),
        linkedListBuilder("literal", "1"),
        "None",
      ),
    );
  });

  it("if-else statement with multiple statements per branch", async () => {
    const { renderedResult } = await compileToWasmAndRun(
      `parse("if True:\\n    x = 1\\n    y\\nelse:\\n    pass\\n    z")`,
      true,
    );
    expect(renderedResult).toBe(
      linkedListBuilder(
        "conditional_statement",
        linkedListBuilder("literal", "True"),
        linkedListBuilder(
          "sequence",
          linkedListBuilder(
            linkedListBuilder(
              "assignment",
              linkedListBuilder("name", '"x"'),
              linkedListBuilder("literal", "1"),
            ),
            linkedListBuilder("name", '"y"'),
          ),
        ),
        linkedListBuilder(
          "sequence",
          linkedListBuilder(linkedListBuilder("pass_statement"), linkedListBuilder("name", '"z"')),
        ),
      ),
    );
  });

  it("while loop is not supported in parse tree generation", async () => {
    await expect(compileToWasmAndRun(`parse("while True:\\n    1")`, true)).rejects.toThrow(
      new Error("While loops are not supported in parse tree generation"),
    );
  });

  it("for loop is not supported in parse tree generation", async () => {
    await expect(compileToWasmAndRun(`parse("for i in range(5):\\n    1")`, true)).rejects.toThrow(
      new Error("For loops are not supported in parse tree generation"),
    );
  });

  it("function declaration with starred parameter is not supported in parse tree generation", async () => {
    await expect(
      compileToWasmAndRun(`parse("def f(*args):\\n    return 1")`, true),
    ).rejects.toThrow(new Error("Starred parameters are not supported in parse tree generation"));
  });

  it("lambda with starred parameter is not supported in parse tree generation", async () => {
    await expect(compileToWasmAndRun(`parse("lambda *args: 1")`, true)).rejects.toThrow(
      new Error("Starred parameters are not supported in parse tree generation"),
    );
  });

  it("starred expression in call is not supported in parse tree generation", async () => {
    await expect(compileToWasmAndRun(`parse("f(*x)")`, true)).rejects.toThrow(
      new Error("Starred expressions are not supported in parse tree generation"),
    );
  });

  it("multiple starred expressions in call are not supported in parse tree generation", async () => {
    await expect(compileToWasmAndRun(`parse("f(*x, *y)")`, true)).rejects.toThrow(
      new Error("Starred expressions are not supported in parse tree generation"),
    );
  });
});

describe("Shadow stack manipulation tests", () => {
  const expectShadowStackToEqual = async (
    pythonCode: string,
    expectedTags: number[],
    compileOptions: CompileOptions = {},
    interactiveMode: boolean = true,
  ) => {
    const results = interactiveMode
      ? await compileToWasmAndRun(pythonCode, true, compileOptions)
      : await compileToWasmAndRun(pythonCode, false, compileOptions);

    // Check each frame's tag on the stack
    expectedTags.forEach((expectedTag, index) =>
      expect(results.debugFunctions.getStackAt(index)[0]).toBe(expectedTag),
    );

    // Verify accessing one position past the stack throws STACK_UNDERFLOW
    expect(() => results.debugFunctions.getStackAt(expectedTags.length)).toThrow(
      new Error(ERROR_MAP.STACK_UNDERFLOW),
    );

    return results;
  };

  describe("simple expression statement cleanup (non-interactive)", () => {
    it("last simple expression statement with list literal leaves stack clean", async () => {
      const pythonCode = `[1, 2, 3]`;
      await expectShadowStackToEqual(pythonCode, [], {}, false);
    });

    it("last simple expression statement with GCable variable access leaves stack clean", async () => {
      const pythonCode = `
x = [1, 2, 3]
x
`;
      await expectShadowStackToEqual(pythonCode, [], {}, false);
    });

    it("multiple simple expression statements with GCable finals leave stack clean", async () => {
      const pythonCode = `
1
"hello"
[1, 2, 3]
`;
      await expectShadowStackToEqual(pythonCode, [], {}, false);
    });
  });

  describe("simple expression statement cleanup (interactive)", () => {
    it("keeps only the final GCable expression on stack", async () => {
      const pythonCode = `
[1]
"hello"
[2, 3]
`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("keeps stack clean when final expression is non-GCable", async () => {
      const pythonCode = `
[1, 2]
"hello"
42
`;
      await expectShadowStackToEqual(pythonCode, []);
    });
  });

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
    it("LIST_STATE tracks stable pointer and total length during list construction", async () => {
      const pythonCode = `[1, 2, 3]`;

      const log = wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0)));

      const afterListStatePush = insertInArray(
        node => isFunctionCall(node, MAKE_LIST_FX) && node.arguments,
        instruction => isFunctionCall(instruction, SILENT_PUSH_SHADOW_STACK_FX),
        [log],
      );
      const afterSet0 = insertInArray(
        node => isFunctionCall(node, MAKE_LIST_FX) && node.arguments,
        instruction => isFunctionCall(instruction, SET_CONTIGUOUS_BLOCK_FX),
        [log],
        { matchIndex: 0 },
      );
      const afterSet1 = insertInArray(
        node => isFunctionCall(node, MAKE_LIST_FX) && node.arguments,
        instruction => isFunctionCall(instruction, SET_CONTIGUOUS_BLOCK_FX),
        [log],
        { matchIndex: 1 },
      );
      const afterSet2 = insertInArray(
        node => isFunctionCall(node, MAKE_LIST_FX) && node.arguments,
        instruction => isFunctionCall(instruction, SET_CONTIGUOUS_BLOCK_FX),
        [log],
        { matchIndex: 2 },
      );

      const { rawOutputs, rawResult } = await expectShadowStackToEqual(
        pythonCode,
        [TYPE_TAG.LIST],
        { irPasses: [afterListStatePush, afterSet0, afterSet1, afterSet2] },
      );

      expect(rawOutputs).toHaveLength(4);
      rawOutputs.forEach(([tag]) => expect(tag).toBe(SHADOW_STACK_TAG.LIST_STATE));

      rawOutputs.forEach(([, val]) => {
        const pointer = (val >> 32n) & 0xffffffffn;
        const length = Number(val & 0xffffffffn);

        expect(pointer).toBe(rawResult![1] >> 32n);
        expect(length).toBe(3);
      });
    });

    it("while creating list, list pointer should be on stack until SET_CONTIGUOUS", async () => {
      const pythonCode = `[1, 2, 3]`;

      const irPass = insertInArray(
        node => isFunctionCall(node, MAKE_LIST_FX) && node.arguments,
        instruction => isFunctionCall(instruction, SILENT_PUSH_SHADOW_STACK_FX),
        [wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0)))],
      );

      const { rawOutputs } = await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST], {
        irPasses: [irPass],
      });

      expect(rawOutputs[0][0]).toBe(SHADOW_STACK_TAG.LIST_STATE);
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
          instruction.op === "i64.shl",
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

    it("CALL_NEW_ENV tracks stable pointer during call setup", async () => {
      const pythonCode = `
def f(a, b, c):
    return a
f(10, 20, 30)
`;

      const log = wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0)));

      const afterCallStatePush = insertInArray(
        node => isFunctionCall(node, APPLY_FX_NAME) && node.arguments,
        instruction => isFunctionCall(instruction, SILENT_PUSH_SHADOW_STACK_FX),
        [log],
        { matchIndex: 1 },
      );
      const afterSet0 = insertInArray(
        node => isFunctionCall(node, APPLY_FX_NAME) && node.arguments,
        instruction => isFunctionCall(instruction, SET_CONTIGUOUS_BLOCK_FX),
        [log],
        { matchIndex: 0 },
      );
      const afterSet1 = insertInArray(
        node => isFunctionCall(node, APPLY_FX_NAME) && node.arguments,
        instruction => isFunctionCall(instruction, SET_CONTIGUOUS_BLOCK_FX),
        [log],
        { matchIndex: 1 },
      );
      const afterSet2 = insertInArray(
        node => isFunctionCall(node, APPLY_FX_NAME) && node.arguments,
        instruction => isFunctionCall(instruction, SET_CONTIGUOUS_BLOCK_FX),
        [log],
        { matchIndex: 2 },
      );

      const { rawOutputs } = await expectShadowStackToEqual(pythonCode, [], {
        irPasses: [afterCallStatePush, afterSet0, afterSet1, afterSet2],
      });

      expect(rawOutputs).toHaveLength(4);
      rawOutputs.forEach(([tag]) => expect(tag).toBe(SHADOW_STACK_TAG.CALL_NEW_ENV));

      const basePointer = (rawOutputs[0][1] >> 32n) & 0xffffffffn;

      rawOutputs.forEach(([, val]) => {
        const pointer = (val >> 32n) & 0xffffffffn;
        expect(pointer).toBe(basePointer);
      });
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

    it("linked_list function should push resultant list onto stack", async () => {
      const pythonCode = `linked_list(1, 2, 3)`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("is_linked_list function should leave stack clean (not push result onto stack)", async () => {
      const pythonCode = `is_linked_list(linked_list(1, 2, 3))`;
      await expectShadowStackToEqual(pythonCode, []);
    });

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

    it("list_length function should leave stack clean (not push result onto stack)", async () => {
      const pythonCode = `list_length([1, 2, 3])`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("is_list function should leave stack clean (not push result onto stack)", async () => {
      const pythonCode = `is_list([1, 2, 3])`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("bool function should leave stack clean (not push result onto stack)", async () => {
      const pythonCode = `bool([1, 2, 3])`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("is_none function with GC argument should leave stack clean (not push result onto stack)", async () => {
      const pythonCode = `is_none([1, 2, 3])`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("is_none function with non-GC argument should leave stack clean (not push result onto stack)", async () => {
      const pythonCode = `is_none(42)`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("tokenize function should push resultant list onto stack", async () => {
      const pythonCode = `tokenize("1 + 2")`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("parse function should push resultant list onto stack", async () => {
      const pythonCode = `parse("1 + 2")`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("more complex parse should push resultant list onto stack", async () => {
      const pythonCode = `parse("def f():\\n    nonlocal x\\n    x = 5\\n    return x")`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });
  });
});

describe("GC collect/copy tests", () => {
  const topOfShadowStack = wasm
    .call("$_log_raw")
    .args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0)));

  it("moves list payload and preserves logical value", async () => {
    const pythonCode = `[1, 2, 3]`;

    const forceCollectAfterListCreate = insertInArray(
      node => isFunctionCall(node, GET_LAST_EXPR_RESULT_FX) && node.arguments,
      instruction => isFunctionCall(instruction, MAKE_LIST_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
    );

    const {
      rawOutputs,
      rawResult,
      renderedResult,
      debugFunctions: { getListElement },
    } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectAfterListCreate],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(TYPE_TAG.LIST);
    expect(rawOutputs[1][0]).toBe(TYPE_TAG.LIST);

    const beforePtr = rawOutputs[0][1] >> 32n;
    const afterPtr = rawOutputs[1][1] >> 32n;
    const beforeLen = Number(rawOutputs[0][1] & 0xffffffffn);
    const afterLen = Number(rawOutputs[1][1] & 0xffffffffn);

    // GC copies from FROM-space to TO-space. TO-space is initially at a higher base address, so
    // forwarded pointers should increase after collection.
    expect(afterPtr).toBeGreaterThan(beforePtr);
    expect(afterLen).toBe(beforeLen);
    expect(rawResult[0]).toBe(TYPE_TAG.LIST);
    expect(renderedResult).toBe("[1, 2, 3]");

    expect(getListElement(TYPE_TAG.LIST, rawResult[1], 0)).toEqual([TYPE_TAG.INT, 1n]);
    expect(getListElement(TYPE_TAG.LIST, rawResult[1], 1)).toEqual([TYPE_TAG.INT, 2n]);
    expect(getListElement(TYPE_TAG.LIST, rawResult[1], 2)).toEqual([TYPE_TAG.INT, 3n]);
  });

  it("moves list payload even when first element value at +4 matches forwarding bit", async () => {
    // For a list element layout [tag:i32][value:i64], ptr + 4 reads the lower 32 bits
    // of the first element's i64 value. 1073741824 = 0x40000000 matches the forwarding bit.
    const pythonCode = `[1073741824, 1]`;

    const forceCollectAfterListCreate = insertInArray(
      node => isFunctionCall(node, GET_LAST_EXPR_RESULT_FX) && node.arguments,
      instruction => isFunctionCall(instruction, MAKE_LIST_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
    );

    const {
      rawOutputs,
      rawResult,
      renderedResult,
      debugFunctions: { getListElement },
    } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectAfterListCreate],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(TYPE_TAG.LIST);
    expect(rawOutputs[1][0]).toBe(TYPE_TAG.LIST);

    const beforePtr = rawOutputs[0][1] >> 32n;
    const afterPtr = rawOutputs[1][1] >> 32n;
    const beforeLen = Number(rawOutputs[0][1] & 0xffffffffn);
    const afterLen = Number(rawOutputs[1][1] & 0xffffffffn);

    expect(afterPtr).toBeGreaterThan(beforePtr);
    expect(afterLen).toBe(beforeLen);
    expect(rawResult[0]).toBe(TYPE_TAG.LIST);
    expect(renderedResult).toBe("[1073741824, 1]");

    expect(getListElement(TYPE_TAG.LIST, rawResult[1], 0)).toEqual([TYPE_TAG.INT, 1073741824n]);
    expect(getListElement(TYPE_TAG.LIST, rawResult[1], 1)).toEqual([TYPE_TAG.INT, 1n]);
  });

  it("copies LIST_STATE root even when list payload at +4 matches forwarding bit", async () => {
    const pythonCode = `[1073741824, 1]`;

    const forceCollectDuringListBuild = insertInArray(
      node => isFunctionCall(node, MAKE_LIST_FX) && node.arguments,
      instruction => isFunctionCall(instruction, SET_CONTIGUOUS_BLOCK_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
      { matchIndex: 0 },
    );

    const {
      rawOutputs,
      rawResult,
      renderedResult,
      debugFunctions: { getListElement },
    } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectDuringListBuild],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(SHADOW_STACK_TAG.LIST_STATE);
    expect(rawOutputs[1][0]).toBe(SHADOW_STACK_TAG.LIST_STATE);

    const beforePtr = rawOutputs[0][1] >> 32n;
    const afterPtr = rawOutputs[1][1] >> 32n;
    const beforeLen = Number(rawOutputs[0][1] & 0xffffffffn);
    const afterLen = Number(rawOutputs[1][1] & 0xffffffffn);

    expect(afterPtr).toBeGreaterThan(beforePtr);
    expect(beforeLen).toBe(2);
    expect(afterLen).toBe(2);

    expect(rawResult[0]).toBe(TYPE_TAG.LIST);
    expect(renderedResult).toBe("[1073741824, 1]");
    expect(getListElement(TYPE_TAG.LIST, rawResult[1], 0)).toEqual([TYPE_TAG.INT, 1073741824n]);
    expect(getListElement(TYPE_TAG.LIST, rawResult[1], 1)).toEqual([TYPE_TAG.INT, 1n]);
  });

  it("preserves list capacity when GC runs during LIST_STATE build", async () => {
    const pythonCode = `
x = [11, 99]
"a" + "b"
x[1]
`;

    const forceCollectDuringListBuild = insertInArray(
      node => isFunctionCall(node, MAKE_LIST_FX) && node.arguments,
      instruction => isFunctionCall(instruction, SET_CONTIGUOUS_BLOCK_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
      { matchIndex: 0 },
    );

    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectDuringListBuild],
    });

    // expect(rawOutputs).toHaveLength(2);
    // expect(rawOutputs[0][0]).toBe(SHADOW_STACK_TAG.LIST_STATE);
    // expect(rawOutputs[1][0]).toBe(SHADOW_STACK_TAG.LIST_STATE);

    // const beforePtr = rawOutputs[0][1] >> 32n;
    // const afterPtr = rawOutputs[1][1] >> 32n;
    // const beforeLen = Number(rawOutputs[0][1] & 0xffffffffn);
    // const afterLen = Number(rawOutputs[1][1] & 0xffffffffn);

    // expect(afterPtr).toBeGreaterThan(beforePtr);
    // expect(beforeLen).toBe(2);
    // expect(afterLen).toBe(2);

    // Correct behavior: GC during list construction must preserve full backing capacity.
    // The later heap allocation for string concat must not overlap list slots.
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("99");
  });

  it("preserves argument capacity when GC runs during CALL_NEW_ENV build", async () => {
    const pythonCode = `
def second(a, b):
    return b

x = second(11, 99)
"a" + "b"
x
`;

    const forceCollectDuringCallBuild = insertInArray(
      node => isFunctionCall(node, APPLY_FX_NAME) && node.arguments,
      instruction => isFunctionCall(instruction, SET_CONTIGUOUS_BLOCK_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
      { matchIndex: 0 },
    );

    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectDuringCallBuild],
    });

    // expect(rawOutputs).toHaveLength(2);
    // expect(rawOutputs[0][0]).toBe(SHADOW_STACK_TAG.CALL_NEW_ENV);
    // expect(rawOutputs[1][0]).toBe(SHADOW_STACK_TAG.CALL_NEW_ENV);

    // const beforePtr = rawOutputs[0][1] >> 32n;
    // const afterPtr = rawOutputs[1][1] >> 32n;
    // const beforeLen = Number(rawOutputs[0][1] & 0xffffffffn);
    // const afterLen = Number(rawOutputs[1][1] & 0xffffffffn);

    // expect(afterPtr).toBeGreaterThan(beforePtr);
    // expect(beforeLen).toBe(2);
    // expect(afterLen).toBe(2);

    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("99");
  });

  it("moves tuple payload from variadic call even when first element value at +4 matches forwarding bit", async () => {
    const pythonCode = `
def f(*args):
    return args

f(1073741824, 1)
`;

    const forceCollectAfterApply = insertInArray(
      node => isFunctionCall(node, GET_LAST_EXPR_RESULT_FX) && node.arguments,
      instruction => isFunctionCall(instruction, APPLY_FX_NAME),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
    );

    const {
      rawOutputs,
      rawResult,
      renderedResult,
      debugFunctions: { getListElement },
    } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectAfterApply],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(TYPE_TAG.TUPLE);
    expect(rawOutputs[1][0]).toBe(TYPE_TAG.TUPLE);

    const beforePtr = rawOutputs[0][1] >> 32n;
    const afterPtr = rawOutputs[1][1] >> 32n;
    const beforeLen = Number(rawOutputs[0][1] & 0xffffffffn);
    const afterLen = Number(rawOutputs[1][1] & 0xffffffffn);

    expect(afterPtr).toBeGreaterThan(beforePtr);
    expect(afterLen).toBe(beforeLen);
    expect(rawResult[0]).toBe(TYPE_TAG.TUPLE);
    expect(renderedResult).toBe("[1073741824, 1]");

    expect(getListElement(TYPE_TAG.TUPLE, rawResult[1], 0)).toEqual([TYPE_TAG.INT, 1073741824n]);
    expect(getListElement(TYPE_TAG.TUPLE, rawResult[1], 1)).toEqual([TYPE_TAG.INT, 1n]);
  });

  it("moves heap string payload and preserves bytes", async () => {
    const pythonCode = `"foo" + "bar"`;

    const forceCollectAfterConcat = insertInArray(
      node => isFunctionCall(node, GET_LAST_EXPR_RESULT_FX) && node.arguments,
      instruction => isFunctionCall(instruction, ARITHMETIC_OP_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
    );

    const { rawOutputs, rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectAfterConcat],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(TYPE_TAG.STRING);
    expect(rawOutputs[1][0]).toBe(TYPE_TAG.STRING);

    const beforePtr = rawOutputs[0][1] >> 32n;
    const afterPtr = rawOutputs[1][1] >> 32n;
    const beforeLen = Number(rawOutputs[0][1] & 0xffffffffn);
    const afterLen = Number(rawOutputs[1][1] & 0xffffffffn);

    expect(afterPtr).toBeGreaterThan(beforePtr);
    expect(beforeLen).toBe(6);
    expect(afterLen).toBe(6);
    expect(rawResult[0]).toBe(TYPE_TAG.STRING);
    expect(renderedResult).toBe("foobar");
  });

  it("keeps both string operands on shadow stack until concat malloc", async () => {
    const pythonCode = `"foo" + "bar"`;

    const inspectShadowStackBeforeConcatMalloc = insertInArray(
      node => {
        const body = isFunctionOfName(node, ARITHMETIC_OP_FX) && node.body;
        const ifBody = body && body.filter(isIfInstruction)[0];
        return ifBody && ifBody.thenBody;
      },
      instruction =>
        instruction != null &&
        typeof instruction === "object" &&
        "op" in instruction &&
        instruction.op === "local.set",
      [
        wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0))),
        wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(1))),
      ],
      { before: true },
    );

    const { rawOutputs, rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [inspectShadowStackBeforeConcatMalloc],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(TYPE_TAG.STRING);
    expect(rawOutputs[1][0]).toBe(TYPE_TAG.STRING);
    expect(Number(rawOutputs[0][1] & 0xffffffffn)).toBe(3);
    expect(Number(rawOutputs[1][1] & 0xffffffffn)).toBe(3);
    expect(rawResult[0]).toBe(TYPE_TAG.STRING);
    expect(renderedResult).toBe("foobar");
  });

  it("moves heap string payload even when bytes at +4 match forwarding bit", async () => {
    // Resulting heap string bytes are:
    // 0x10 0x00 0x00 0x00 0x00 0x00 0x00 0x40
    // so i32.load(ptr + 4) == 0x40000000 (same as forwarding bit pattern).
    const pythonCode = `"\x00\x00\x00\x00" + "\x00\x00\x00@"`;

    const forceCollectAfterConcat = insertInArray(
      node => isFunctionCall(node, GET_LAST_EXPR_RESULT_FX) && node.arguments,
      instruction => isFunctionCall(instruction, ARITHMETIC_OP_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
    );

    const { rawOutputs, rawResult } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectAfterConcat],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(TYPE_TAG.STRING);
    expect(rawOutputs[1][0]).toBe(TYPE_TAG.STRING);

    const beforePtr = rawOutputs[0][1] >> 32n;
    const afterPtr = rawOutputs[1][1] >> 32n;
    const beforeLen = Number(rawOutputs[0][1] & 0xffffffffn);
    const afterLen = Number(rawOutputs[1][1] & 0xffffffffn);

    expect(afterPtr).toBeGreaterThan(beforePtr);
    expect(afterLen).toBe(beforeLen);
    expect(beforeLen).toBe(8);
    expect(rawResult[0]).toBe(TYPE_TAG.STRING);
  });

  it("moves complex payload and preserves numeric value", async () => {
    const pythonCode = `2j`;

    const forceCollectAfterComplexCreate = insertInArray(
      node => isFunctionCall(node, GET_LAST_EXPR_RESULT_FX) && node.arguments,
      instruction => isFunctionCall(instruction, MAKE_COMPLEX_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
    );

    const { rawOutputs, rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectAfterComplexCreate],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(TYPE_TAG.COMPLEX);
    expect(rawOutputs[1][0]).toBe(TYPE_TAG.COMPLEX);

    const beforePtr = rawOutputs[0][1];
    const afterPtr = rawOutputs[1][1];

    expect(afterPtr).toBeGreaterThan(beforePtr);
    expect(rawResult[0]).toBe(TYPE_TAG.COMPLEX);
    expect(renderedResult).toBe("2j");
  });

  it("moves complex payload even when real f64 upper word matches forwarding bit at +4", async () => {
    // 2 as f64 is 0x4000000000000000, which means the upper word of the real
    // part will have the forwarding bit set. This tests that we don't
    // accidentally skip copying the complex number in this case due to a false
    // forwarding pointer match.
    const pythonCode = `2.0 + 3j`;

    const forceCollectAfterComplexCreate = insertInArray(
      node => isFunctionCall(node, GET_LAST_EXPR_RESULT_FX) && node.arguments,
      instruction => isFunctionCall(instruction, ARITHMETIC_OP_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
    );

    const { rawOutputs, rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectAfterComplexCreate],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(TYPE_TAG.COMPLEX);
    expect(rawOutputs[1][0]).toBe(TYPE_TAG.COMPLEX);

    const beforePtr = rawOutputs[0][1];
    const afterPtr = rawOutputs[1][1];

    expect(afterPtr).toBeGreaterThan(beforePtr);
    expect(rawResult[0]).toBe(TYPE_TAG.COMPLEX);
    expect(renderedResult).toBe("2 + 3j");
  });

  it("does not forward complex aliases during collect (duplicate copies are expected)", async () => {
    // Complex forwarding is intentionally disabled. If we want to forward
    // complex numbers in the future, we need to add a dedicated complex
    // object header to hold forwarding metadata.

    // This is because it's rare that we would have multiple references to the
    // same complex number (complex numbers are probably themselves rare).
    // Not worth to handle forwarding logic and metadata updates for this edge
    // case.
    const pythonCode = `
z = 2j
[0, z, z]
`;

    const forceCollectAfterListCreate = insertInArray(
      node => isFunctionCall(node, GET_LAST_EXPR_RESULT_FX) && node.arguments,
      instruction => isFunctionCall(instruction, MAKE_LIST_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
    );

    const {
      rawOutputs,
      rawResult,
      renderedResult,
      debugFunctions: { getListElement },
    } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectAfterListCreate],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(TYPE_TAG.LIST);
    expect(rawOutputs[1][0]).toBe(TYPE_TAG.LIST);

    const beforeList = rawOutputs[0][1];
    const afterList = rawOutputs[1][1];

    // LIST forwarding metadata might overwrite from-space bytes at ptr+0/+4.
    // Keep a dummy first element so the complex numbers under test are at
    // indices 1 and 2 and are protected no matter what.
    const beforeElem1 = getListElement(TYPE_TAG.LIST, beforeList, 1);
    const beforeElem2 = getListElement(TYPE_TAG.LIST, beforeList, 2);
    const afterElem1 = getListElement(TYPE_TAG.LIST, afterList, 1);
    const afterElem2 = getListElement(TYPE_TAG.LIST, afterList, 2);

    expect(beforeElem1[0]).toBe(TYPE_TAG.COMPLEX);
    expect(beforeElem2[0]).toBe(TYPE_TAG.COMPLEX);
    expect(afterElem1[0]).toBe(TYPE_TAG.COMPLEX);
    expect(afterElem2[0]).toBe(TYPE_TAG.COMPLEX);

    // Before collect, both list entries alias the same complex payload.
    expect(beforeElem1[1]).toBe(beforeElem2[1]);

    // Without forwarding, each aliased reference is copied independently.
    expect(afterElem1[1]).not.toBe(afterElem2[1]);
    expect(afterElem1[1]).toBeGreaterThan(beforeElem1[1]);
    expect(afterElem2[1]).toBeGreaterThan(beforeElem2[1]);

    expect(rawResult[0]).toBe(TYPE_TAG.LIST);
    expect(renderedResult).toBe("[0, 2j, 2j]");
  });

  it("rewrites closure parent env after collect", async () => {
    const pythonCode = `lambda x: x + 1`;

    const forceCollectAfterClosureCreate = insertInArray(
      node => isFunctionCall(node, GET_LAST_EXPR_RESULT_FX) && node.arguments,
      instruction => isFunctionCall(instruction, MAKE_CLOSURE_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
    );

    const { rawOutputs, rawResult } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectAfterClosureCreate],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(TYPE_TAG.CLOSURE);
    expect(rawOutputs[1][0]).toBe(TYPE_TAG.CLOSURE);

    const beforeMeta = rawOutputs[0][1] & 0xffffffff00000000n;
    const afterMeta = rawOutputs[1][1] & 0xffffffff00000000n;
    const beforeParent = Number(rawOutputs[0][1] & 0xffffffffn);
    const afterParent = Number(rawOutputs[1][1] & 0xffffffffn);

    expect(afterMeta).toBe(beforeMeta);
    expect(beforeParent).not.toBe(afterParent);
    expect(afterParent).toBeGreaterThan(beforeParent);
    expect(rawResult[0]).toBe(TYPE_TAG.CLOSURE);
  });

  it("does not move data-section string payload during collect", async () => {
    const pythonCode = `"hello"`;

    const forceCollectAfterLiteral = insertInArray(
      node => isFunctionCall(node, GET_LAST_EXPR_RESULT_FX) && node.arguments,
      instruction => isFunctionCall(instruction, MAKE_STRING_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
    );

    const { rawOutputs, rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectAfterLiteral],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(TYPE_TAG.STRING);
    expect(rawOutputs[1][0]).toBe(TYPE_TAG.STRING);
    expect(rawOutputs[1][1]).toBe(rawOutputs[0][1]);
    expect(rawResult[0]).toBe(TYPE_TAG.STRING);
    expect(renderedResult).toBe("hello");
  });

  it("rewrites closure parent env after collect for function declaration closure", async () => {
    const pythonCode = `
def inc(x):
    return x + 1
inc
`;

    const forceCollectAfterFunctionValueRead = insertInArray(
      node => isFunctionCall(node, GET_LAST_EXPR_RESULT_FX) && node.arguments,
      instruction => isFunctionCall(instruction, GET_LEX_ADDR_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
    );

    const { rawOutputs, rawResult } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectAfterFunctionValueRead],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(TYPE_TAG.CLOSURE);
    expect(rawOutputs[1][0]).toBe(TYPE_TAG.CLOSURE);

    const beforeMeta = rawOutputs[0][1] & 0xffffffff00000000n;
    const afterMeta = rawOutputs[1][1] & 0xffffffff00000000n;
    const beforeParent = Number(rawOutputs[0][1] & 0xffffffffn);
    const afterParent = Number(rawOutputs[1][1] & 0xffffffffn);

    expect(afterMeta).toBe(beforeMeta);
    expect(beforeParent).not.toBe(afterParent);
    expect(afterParent).toBeGreaterThan(beforeParent);
    expect(rawResult[0]).toBe(TYPE_TAG.CLOSURE);
  });

  it("nested lists survive collect after outer list creation (testing recursive copy)", async () => {
    const pythonCode = `[[1, 2], [3, 4]]`;

    const collectAfterOuterCreation = insertInArray(
      node => isFunctionCall(node, GET_LAST_EXPR_RESULT_FX) && node.arguments,
      instruction => isFunctionCall(instruction, MAKE_LIST_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
    );

    const {
      rawOutputs,
      rawResult,
      renderedResult,
      debugFunctions: { getListElement },
    } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [collectAfterOuterCreation],
    });

    const beforeOuterValue = rawOutputs[0];
    const afterOuterValue = rawOutputs[1];

    expect(rawResult[0]).toBe(TYPE_TAG.LIST);
    expect(renderedResult).toBe("[[1, 2], [3, 4]]");

    expect(rawOutputs).toHaveLength(2);
    expect(beforeOuterValue[0]).toBe(TYPE_TAG.LIST);
    expect(afterOuterValue[0]).toBe(TYPE_TAG.LIST);

    // Verify outer list pointer is different after collect
    expect(afterOuterValue[1] >> 32n).toBeGreaterThan(beforeOuterValue[1] >> 32n);

    const beforeInner1 = getListElement(TYPE_TAG.LIST, beforeOuterValue[1], 0);
    const beforeInner2 = getListElement(TYPE_TAG.LIST, beforeOuterValue[1], 1);

    const afterInner1 = getListElement(TYPE_TAG.LIST, afterOuterValue[1], 0);
    const afterInner2 = getListElement(TYPE_TAG.LIST, afterOuterValue[1], 1);

    // Verify inner values are still lists (after, not before: forwarding metadata)
    expect(afterInner1[0]).toBe(TYPE_TAG.LIST);
    expect(afterInner2[0]).toBe(TYPE_TAG.LIST);

    // Verify inner list pointers are different after collect
    expect(afterInner1[1] >> 32n).toBeGreaterThan(beforeInner1[1] >> 32n);
    expect(afterInner2[1] >> 32n).toBeGreaterThan(beforeInner2[1] >> 32n);
  });

  it("fib(30) with GC should work", async () => {
    const pythonCode = `
def fib(n):
    if n <= 1:
        return n
    else:
        return fib(n-1) + fib(n-2)
fib(30)
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(rawResult[1]).toBe(832040n);
    expect(renderedResult).toBe("832040");
  });

  it("fib(30) without GC should OOM", async () => {
    const pythonCode = `
def fib(n):
    if n <= 1:
        return n
    else:
        return fib(n-1) + fib(n-2)
fib(30)
`;
    await expect(compileToWasmAndRun(pythonCode, false, { disableGC: true })).rejects.toThrow(
      new Error(ERROR_MAP.OUT_OF_MEMORY),
    );
  });

  it("native reverse(50) with GC should work", async () => {
    const pythonCode = `
def append(xs, ys):
    if is_none(xs):
        return ys
    return pair(head(xs), append(tail(xs), ys))


def reverse(xs):
    if is_none(xs):
        return None
    return append(reverse(tail(xs)), pair(head(xs), None))

reverse(linked_list(${[...Array(50).keys()].join(", ")}))
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.LIST);

    const frontPart = [...Array(50).keys()].map(i => `[${49 - i}`).join(", ");
    expect(renderedResult).toBe(`${frontPart}, None${"]".repeat(50)}`);
  });

  it("native reverse(50) without GC should OOM", async () => {
    const pythonCode = `
def append(xs, ys):
    if is_none(xs):
        return ys
    return pair(head(xs), append(tail(xs), ys))

def reverse(xs):
    if is_none(xs):
        return None
    return append(reverse(tail(xs)), pair(head(xs), None))

reverse(linked_list(${[...Array(50).keys()].join(", ")}))
`;
    await expect(compileToWasmAndRun(pythonCode, false, { disableGC: true })).rejects.toThrow(
      new Error(ERROR_MAP.OUT_OF_MEMORY),
    );
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

  it("empty program should produce None in interactive mode", async () => {
    const { rawResult, renderedResult } = await compileToWasmAndRun(``, true);
    expect(rawResult[0]).toBe(TYPE_TAG.NONE);
    expect(renderedResult).toBe("None");
  });

  it("empty program should not do anything in non-interactive mode", async () => {
    const { rawResult, renderedResult } = await compileToWasmAndRun(``);
    expect(rawResult).toBeNull();
    expect(renderedResult).toBeNull();
  });
});
