import { compileToWasmAndRun } from "../../engines/wasm";
import { ERROR_MAP, TYPE_TAG } from "../../engines/wasm/runtime";
import mce from "../../stdlib/parser";

const linkedListBuilder = (...elements: string[]) => {
  let expected = "None";
  for (let i = elements.length - 1; i >= 0; i--) {
    expected = `[${elements[i]}, ${expected}]`;
  }
  return expected;
};

describe("tokenize function tests", () => {
  const compileWithMce = async (pythonCode: string) =>
    compileToWasmAndRun(pythonCode, true, { groups: [mce] });

  it("returns tokens in source order", async () => {
    const { renderedResult } = await compileWithMce(`tokenize("x = 1 + 2")`);
    expect(renderedResult).toBe(linkedListBuilder("x", "=", "1", "+", "2"));
  });

  it("ignores redundant whitespace", async () => {
    const { renderedResult } = await compileWithMce(`tokenize("x    +   y   ")`);
    expect(renderedResult).toBe(linkedListBuilder("x", "+", "y"));
  });

  it("returns None for empty input", async () => {
    const { rawResult, renderedResult } = await compileWithMce(`tokenize("")`);
    expect(rawResult[0]).toBe(TYPE_TAG.NONE);
    expect(renderedResult).toBe("None");
  });

  it("tokenizes punctuation-heavy expressions", async () => {
    const { renderedResult } = await compileWithMce(`tokenize("f(x, y[0])")`);
    expect(renderedResult).toBe(linkedListBuilder("f", "(", "x", ",", "y", "[", "0", "]", ")"));
  });

  it("tokenizes multibyte UTF-8 string lexemes", async () => {
    const { renderedResult } = await compileWithMce(`tokenize('"😀é"')`);
    expect(renderedResult).toBe(linkedListBuilder('"😀é"'));
  });

  it("tokenize on non-string should error", async () => {
    await expect(compileWithMce(`tokenize(42)`)).rejects.toThrow(
      new Error(ERROR_MAP.PARSE_NOT_STRING),
    );
  });
});

describe("parse function tests", () => {
  const compileWithMce = async (pythonCode: string) =>
    compileToWasmAndRun(pythonCode, true, { groups: [mce] });

  // A single top-level statement is returned directly; multiple statements are wrapped in a sequence.
  const seqOf = (...stmt: string[]) => linkedListBuilder("sequence", linkedListBuilder(...stmt));

  it("parse on non-string should error", async () => {
    await expect(compileWithMce(`parse(42)`)).rejects.toThrow(
      new Error(ERROR_MAP.PARSE_NOT_STRING),
    );
  });

  it("empty input returns sequence(None)", async () => {
    const { renderedResult } = await compileWithMce(`parse("")`);
    expect(renderedResult).toBe(linkedListBuilder("sequence", linkedListBuilder("None")));
  });

  it("integer literal", async () => {
    const { renderedResult } = await compileWithMce(`parse("42")`);
    expect(renderedResult).toBe(linkedListBuilder("literal", "42"));
  });

  it("float literal", async () => {
    const { renderedResult } = await compileWithMce(`parse("3.5")`);
    expect(renderedResult).toBe(linkedListBuilder("literal", "3.5"));
  });

  it("complex literal (pure imaginary)", async () => {
    const { renderedResult } = await compileWithMce(`parse("2j")`);
    expect(renderedResult).toBe(linkedListBuilder("literal", "2j"));
  });

  it("bool literal True", async () => {
    const { renderedResult } = await compileWithMce(`parse("True")`);
    expect(renderedResult).toBe(linkedListBuilder("literal", "True"));
  });

  it("bool literal False", async () => {
    const { renderedResult } = await compileWithMce(`parse("False")`);
    expect(renderedResult).toBe(linkedListBuilder("literal", "False"));
  });

  it("None literal", async () => {
    const { renderedResult } = await compileWithMce(`parse("None")`);
    expect(renderedResult).toBe(linkedListBuilder("literal", "None"));
  });

  it("string literal", async () => {
    const { renderedResult } = await compileWithMce(`parse('"hello"')`);
    expect(renderedResult).toBe(linkedListBuilder("literal", '"hello"'));
  });

  it("string literal with multibyte UTF-8 characters", async () => {
    const { renderedResult } = await compileWithMce(`parse('"😀é"')`);
    expect(renderedResult).toBe(linkedListBuilder("literal", '"😀é"'));
  });

  it("name", async () => {
    const { renderedResult } = await compileWithMce(`parse("x")`);
    expect(renderedResult).toBe(linkedListBuilder("name", '"x"'));
  });

  it("grouping expression unwraps to inner expression", async () => {
    const { renderedResult } = await compileWithMce(`parse("(1)")`);
    expect(renderedResult).toBe(linkedListBuilder("literal", "1"));
  });

  it("multiple top-level statements", async () => {
    const { renderedResult } = await compileWithMce(`parse("x = 1\\ny")`);
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
    const { renderedResult } = await compileWithMce(`parse("1 + 2")`);
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
    const { renderedResult } = await compileWithMce(`parse("5 - 3")`);
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
    const { renderedResult } = await compileWithMce(`parse("5 * 3")`);
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
    const { renderedResult } = await compileWithMce(`parse("5 / 3")`);
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
    const { renderedResult } = await compileWithMce(`parse("1 == 2")`);
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
    const { renderedResult } = await compileWithMce(`parse("1 != 2")`);
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
    const { renderedResult } = await compileWithMce(`parse("1 < 2")`);
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
    const { renderedResult } = await compileWithMce(`parse("1 <= 2")`);
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
    const { renderedResult } = await compileWithMce(`parse("1 > 2")`);
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
    const { renderedResult } = await compileWithMce(`parse("1 >= 2")`);
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
    const { renderedResult } = await compileWithMce(`parse("not True")`);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "unary_operator_combination",
        '"not"',
        linkedListBuilder("literal", "True"),
      ),
    );
  });

  it("unary negation", async () => {
    const { renderedResult } = await compileWithMce(`parse("-x")`);
    expect(renderedResult).toBe(
      linkedListBuilder("unary_operator_combination", '"-unary"', linkedListBuilder("name", '"x"')),
    );
  });

  it("logical and", async () => {
    const { renderedResult } = await compileWithMce(`parse("True and False")`);
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
    const { renderedResult } = await compileWithMce(`parse("True or False")`);
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
    const { renderedResult } = await compileWithMce(`parse("1 if True else 2")`);
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
    const { renderedResult } = await compileWithMce(`parse("x = 5")`);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "assignment",
        linkedListBuilder("name", '"x"'),
        linkedListBuilder("literal", "5"),
      ),
    );
  });

  it("object assignment", async () => {
    const { renderedResult } = await compileWithMce(`parse("x[0] = 5")`);
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
    const { renderedResult } = await compileWithMce(`parse("def f(x):\\n    return x")`);
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
    const { renderedResult } = await compileWithMce(
      `parse("def f(x, y):\\n    return x\\n    return y")`,
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
    const { renderedResult } = await compileWithMce(`parse("def f():\\n    x = 5\\n    return x")`);
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
    const { renderedResult } = await compileWithMce(`parse("def f():\\n    x = 5")`);
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
    const { renderedResult } = await compileWithMce(
      `parse("def f():\\n    nonlocal x\\n    x = 5\\n    return x")`,
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
    const { renderedResult } = await compileWithMce(`parse("lambda x, y: x + y")`);
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
    const { renderedResult } = await compileWithMce(`parse("return 1")`);
    expect(renderedResult).toBe(
      linkedListBuilder("return_statement", linkedListBuilder("literal", "1")),
    );
  });

  it("bare return statement returns None", async () => {
    const { renderedResult } = await compileWithMce(`parse("return")`);
    expect(renderedResult).toBe(
      linkedListBuilder("return_statement", linkedListBuilder("literal", "None")),
    );
  });

  it("break statement", async () => {
    const { renderedResult } = await compileWithMce(`parse("break")`);
    expect(renderedResult).toBe(linkedListBuilder("break_statement"));
  });

  it("continue statement", async () => {
    const { renderedResult } = await compileWithMce(`parse("continue")`);
    expect(renderedResult).toBe(linkedListBuilder("continue_statement"));
  });

  it("pass statement", async () => {
    const { renderedResult } = await compileWithMce(`parse("pass")`);
    expect(renderedResult).toBe(linkedListBuilder("pass_statement"));
  });

  it("nonlocal declaration", async () => {
    const { renderedResult } = await compileWithMce(`parse("nonlocal x")`);
    expect(renderedResult).toBe(
      linkedListBuilder("nonlocal_declaration", linkedListBuilder("name", '"x"')),
    );
  });

  it("list expression", async () => {
    const { renderedResult } = await compileWithMce(`parse("[1, 2, 3]")`);
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
    const { renderedResult } = await compileWithMce(`parse("x[0]")`);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "object_access",
        linkedListBuilder("name", '"x"'),
        linkedListBuilder("literal", "0"),
      ),
    );
  });

  it("function call (application)", async () => {
    const { renderedResult } = await compileWithMce(`parse("f(1, 2)")`);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "application",
        linkedListBuilder("name", '"f"'),
        linkedListBuilder(linkedListBuilder("literal", "1"), linkedListBuilder("literal", "2")),
      ),
    );
  });

  it("if-else statement", async () => {
    const { renderedResult } = await compileWithMce(`parse("if True:\\n    1\\nelse:\\n    2")`);
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
    const { renderedResult } = await compileWithMce(`parse("if True:\\n    1")`);
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
    const { renderedResult } = await compileWithMce(
      `parse("if True:\\n    x = 1\\n    y\\nelse:\\n    pass\\n    z")`,
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

  it("while loop: single statement body (no sequence)", async () => {
    const { renderedResult } = await compileWithMce(`parse("while True:\\n    1")`);
    expect(renderedResult).toBe(
      linkedListBuilder(
        "while_loop",
        linkedListBuilder("literal", "True"),
        linkedListBuilder("literal", "1"),
      ),
    );
  });

  it("while loop: multiple statement body (sequence)", async () => {
    const { renderedResult } = await compileWithMce(`parse("while True:\\n    x = 1\\n    x")`);
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
    const { renderedResult } = await compileWithMce(`parse("for i in range(5):\\n    1")`);
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
    const { renderedResult } = await compileWithMce(`parse("for i in range(2, 5):\\n    1")`);
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
    const { renderedResult } = await compileWithMce(`parse("for i in range(1, 10, 2):\\n    1")`);
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
    const { renderedResult } = await compileWithMce(
      `parse("for i in range(5):\\n    x = 1\\n    i")`,
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

  it("function declaration with starred parameter is not supported in parse tree generation", async () => {
    await expect(compileWithMce(`parse("def f(*args):\\n    return 1")`)).rejects.toThrow(
      new Error("Starred parameters are not supported in parse tree generation"),
    );
  });

  it("lambda with starred parameter is not supported in parse tree generation", async () => {
    await expect(compileWithMce(`parse("lambda *args: 1")`)).rejects.toThrow(
      new Error("Starred parameters are not supported in parse tree generation"),
    );
  });

  it("starred expression in call is not supported in parse tree generation", async () => {
    await expect(compileWithMce(`parse("f(*x)")`)).rejects.toThrow(
      new Error("Starred expressions are not supported in parse tree generation"),
    );
  });

  it("multiple starred expressions in call are not supported in parse tree generation", async () => {
    await expect(compileWithMce(`parse("f(*x, *y)")`)).rejects.toThrow(
      new Error("Starred expressions are not supported in parse tree generation"),
    );
  });
});
