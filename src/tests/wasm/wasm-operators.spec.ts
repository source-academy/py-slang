import { compileToWasmAndRun } from "../../engines/wasm";
import { ERROR_MAP, TYPE_TAG } from "../../engines/wasm/runtime";
import linkedList from "../../stdlib/linked-list";

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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true, {
      groups: [linkedList],
    });
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true, {
      groups: [linkedList],
    });
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
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true, {
      groups: [linkedList],
    });
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
