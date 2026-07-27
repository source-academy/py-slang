import { compileToWasmAndRun } from "../../engines/wasm";
import { ERROR_MAP, TYPE_TAG } from "../../engines/wasm/runtime";
import linkedList from "../../stdlib/linked-list";

// Basic single-op arithmetic/comparison cases for every type combination are
// covered far more rigorously by operator-conformance-wasm.test.ts's
// spec-table sweep (all four chapters, cross-checked against a live CSE
// reference instead of hand-typed expected values -- it's what caught the
// complex-division and GEN_LIST_FX bugs this suite's own hand-picked cases
// missed). What's left here is coverage that sweep can't provide by
// construction: parser precedence (a compound expression, not a single binary
// op), literal-rendering edge cases the sweep's fixed representative literals
// never hit, and UTF-8/multibyte string handling.
describe("Arithmetic operator tests (int, float, complex, string)", () => {
  it("mixed int arithmetic with precedence", async () => {
    const pythonCode = `2 + 3 * 4 - 5`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("9");
  });

  // --- COMPLEX LITERAL RENDERING ---
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

  // --- STRING: UTF-8 ---
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
});

// Precise error *messages* (not just success-vs-error, which the sweep
// already checks across the full type matrix) for a couple of named failure
// paths worth pinning down explicitly.
describe("Named error messages", () => {
  it("complex ordering comparisons report COMPLEX_COMPARISON", async () => {
    await expect(compileToWasmAndRun(`(1+1j) < (2+2j)`, true)).rejects.toThrow(
      new Error(ERROR_MAP.COMPLEX_COMPARISON),
    );
  });

  it("string ordering against a non-string reports COMPARE_OP_UNKNOWN_TYPE", async () => {
    await expect(compileToWasmAndRun(`"x" < 3`, true)).rejects.toThrow(
      new Error(ERROR_MAP.COMPARE_OP_UNKNOWN_TYPE),
    );
  });
});

// `and`/`or`'s *left* operand, and `not`'s sole operand, must be an actual
// bool -- see docs/specs/python_typing_back.tex: `and`/`or` are typed
// `bool, any -> any` (only the *right* operand of `and`/`or` is `any`), and
// `not` is `bool -> bool`. Unlike real Python (where any value's truthiness
// is valid here), this SICPy dialect deliberately restricts these three
// operators' bool-typed operand to an actual bool -- see CSE's
// evaluateUnaryExpression / BOOL_OP instruction handler, which reject e.g.
// `not 5` and `5 and 3` outright.
describe("Boolean tests", () => {
  // --- NOT OPERATOR ---
  it("not True", async () => {
    const pythonCode = `not True`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("False");
  });

  it("not False", async () => {
    const pythonCode = `not False`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("not on a non-bool operand errors", async () => {
    await expect(compileToWasmAndRun(`not 5`, true)).rejects.toThrow(
      new Error(ERROR_MAP.EXPECTED_BOOL_OPERAND),
    );
  });

  // --- AND ---
  it("False and 5 -> False (short-circuits on the falsy left operand)", async () => {
    const pythonCode = `False and 5`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("False");
  });

  it("True and 0 -> 0", async () => {
    const pythonCode = `True and 0`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("0");
  });

  it("True and 3 -> 3", async () => {
    const pythonCode = `True and 3`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("3");
  });

  it("True and 'hello' -> 'hello'", async () => {
    const pythonCode = `True and "hello"`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.STRING);
    expect(renderedResult).toBe("hello");
  });

  it("True and '' -> ''", async () => {
    const pythonCode = `True and ""`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.STRING);
    expect(renderedResult).toBe("");
  });

  it("True and None -> None", async () => {
    const pythonCode = `
p = pair(1,2)
True and None
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true, {
      groups: [linkedList],
    });
    expect(rawResult[0]).toBe(TYPE_TAG.NONE);
    expect(renderedResult).toBe("None");
  });

  it("and with a non-bool left operand errors", async () => {
    await expect(compileToWasmAndRun(`5 and 3`, true)).rejects.toThrow(
      new Error(ERROR_MAP.EXPECTED_BOOL_OPERAND),
    );
  });

  // --- OR ---
  it("False or 5 -> 5", async () => {
    const pythonCode = `False or 5`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("5");
  });

  it("False or 'abc' -> 'abc'", async () => {
    const pythonCode = `False or "abc"`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.STRING);
    expect(renderedResult).toBe("abc");
  });

  it("True or 100 -> True (short-circuits on the truthy left operand)", async () => {
    const pythonCode = `True or 100`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("False or pair(1,2) -> pair", async () => {
    const pythonCode = `False or pair(1,2)`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true, {
      groups: [linkedList],
    });
    expect(rawResult[0]).not.toBe(TYPE_TAG.NONE);
    expect(renderedResult).toBe("[1, 2]");
  });

  it("or with a non-bool left operand errors", async () => {
    await expect(compileToWasmAndRun(`5 or 3`, true)).rejects.toThrow(
      new Error(ERROR_MAP.EXPECTED_BOOL_OPERAND),
    );
  });

  // --- SHORT CIRCUITING ---
  it("and short-circuits (second expr not evaluated)", async () => {
    const pythonCode = `
x = 0
def boom():
    x = x + 1  # would error if executed
False and boom()
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    // must return False without calling boom()
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("False");
  });

  it("or short-circuits (second expr not evaluated)", async () => {
    const pythonCode = `
x = 0
def boom():
    x = x + 1  # would error if executed
True or boom()
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    // must return True without calling boom()
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });
});
