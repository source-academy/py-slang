import { tidy, toTypeDiagnostic, type TypeDiagnostic } from "../typecheck/diagnostics";
import { studentMessage } from "../typecheck/messages";

describe("messages for students", () => {
  test("an argument of the wrong type: the function, the parameter and the types", () => {
    expect(
      studentMessage(
        `Argument of type "Literal['five']" cannot be assigned to parameter "n" of type "int" in function "factorial"\n  "Literal['five']" is not assignable to "int"`,
      ),
    ).toBe("factorial expects n to be int, but got str");
  });

  test("a literal is shown as its type", () => {
    expect(
      studentMessage(`Operator "+" not supported for types "Literal[1]" and "Literal['a']"`),
    ).toBe(`Operator "+" not supported for types "int" and "str"`);
    expect(studentMessage(`Type "Literal[True]" is not assignable to declared type "int"`)).toBe(
      `Type "bool" is not assignable to declared type "int"`,
    );
    expect(studentMessage(`Type "Literal[1, 2]" is not assignable to declared type "str"`)).toBe(
      `Type "int" is not assignable to declared type "str"`,
    );
    expect(studentMessage(`Type "Literal[1, 'a']" is not assignable to declared type "None"`)).toBe(
      `Type "int | str" is not assignable to declared type "None"`,
    );
    // A string that looks like a literal type is left alone.
    expect(studentMessage(`Type "int" is not assignable to "Literal"`)).toBe(
      `Type "int" is not assignable to "Literal"`,
    );
  });

  test("a type parameter is shown without the function that it belongs to", () => {
    expect(studentMessage(`Cannot use "Pair[H@head, T@head]" here`)).toBe(
      `Cannot use "Pair[H, T]" here`,
    );
    expect(studentMessage(`Cannot use "_T@Pair"`)).toBe(`Cannot use "T"`);
  });

  test("the names of the aliases are shown", () => {
    expect(studentMessage(`Type "Pair[int, LList] | None" is wrong`)).toBe(
      `Type "LList[int]" is wrong`,
    );
    expect(studentMessage(`Type "Pair[int, () -> Stream] | None" is wrong`)).toBe(
      `Type "Stream[int]" is wrong`,
    );
    expect(
      studentMessage(`A "Pair[Pair[int, int], LList] | None" and a "Pair[str, LList] | None"`),
    ).toBe(`A "LList[Pair[int, int]]" and a "LList[str]"`);
    expect(studentMessage(`Type "Pair[int, Callable[[int], int]]" is wrong`)).toBe(
      `Type "Pair[int, Callable[[int], int]]" is wrong`,
    );
  });

  test("the type of a linked list that can be None: a hint", () => {
    expect(
      studentMessage(
        `Argument of type "LList[int]" cannot be assigned to parameter "p" of type "Pair[H@head, T@head]" in function "head"\n  Type "LList[int]" is not assignable to type "Pair[int, T@head]"\n    "None" is not assignable to "Pair[int, T@head]"`,
      ),
    ).toBe(
      "head expects p to be Pair[H, T], but got LList[int]. The value can be None: test for that first, for example with is_none(...)",
    );
  });

  test("a condition that is not a bool", () => {
    const detail = `\n  Method __bool__ for type "Literal[1]" returns type "None" rather than "bool"`;
    expect(studentMessage(`Invalid conditional operand of type "Literal[1]"${detail}`)).toBe(
      "A condition must be a bool, but this is an int",
    );
    expect(studentMessage(`Invalid conditional operand of type "list[int]"`)).toBe(
      "A condition must be a bool, but this is a list[int]",
    );
  });

  test("the list that is_list finds in an object is shown as list[object]", () => {
    expect(studentMessage(`Type "Sequence[object]" is not assignable to declared type "int"`)).toBe(
      `Type "list[object]" is not assignable to declared type "int"`,
    );
    // A list[object] of the student's own is not a Sequence[object]: its messages are not changed.
    expect(studentMessage(`Cannot access attribute "appendd" for class "list[object]"`)).toBe(
      `Cannot access attribute "appendd" for class "list[object]"`,
    );
  });

  test("changing the list that is_list finds in an object: what to do", () => {
    expect(studentMessage(`"__setitem__" method not defined on type "Sequence[object]"`)).toContain(
      "cannot be assigned: its type is not known. Declare the variable with a list type",
    );
    expect(
      studentMessage(`Cannot access attribute "append" for class "Sequence[object]"`),
    ).toContain("append cannot be used on a list that is_list found in an object");
  });

  test("indexing a pair", () => {
    expect(studentMessage(`"__getitem__" method not defined on type "Pair[int, int]"`)).toBe(
      "A pair cannot be indexed (Pair[int, int]): use head(...) and tail(...)",
    );
    expect(studentMessage(`"__getitem__" method not defined on type "int"`)).toBe(
      "A value of type int cannot be indexed",
    );
  });

  test("a type that cannot be determined", () => {
    expect(
      studentMessage(`Type of "zs" is partially unknown\n  Type of "zs" is "list[Unknown]"`),
    ).toBe("The type of zs cannot be determined: declare it, as in zs: list[int] = []");
    expect(studentMessage(`Type of parameter "x" is unknown`)).toMatch(
      /^The type of the parameter x cannot be determined: a lambda gets its parameter types from where it is used/,
    );
    expect(studentMessage(`Return type of lambda is unknown`)).toBe(
      "The type of what this lambda returns cannot be determined",
    );
    expect(
      studentMessage(`Argument type is partially unknown\n  Argument corresponds to parameter "x"`),
    ).toBe("The type of this argument cannot be determined");
  });

  test("Any is not available", () => {
    expect(studentMessage("Type `Any` is not allowed")).toBe(
      "The type Any is not available: for a function that works for any type, use a type parameter, as in def f[A](x: A) -> A",
    );
  });

  test("other messages keep their first line, without the detail", () => {
    expect(studentMessage("Expected 1 positional argument")).toBe("Expected 1 positional argument");
    expect(
      studentMessage(`Object of type "int" is not callable\n  Attribute "__call__" is unknown`),
    ).toBe(`Object of type "int" is not callable`);
    expect(studentMessage(`"undefined_name" is not defined`)).toBe(
      `"undefined_name" is not defined`,
    );
  });
});

describe("diagnostics", () => {
  const at = (line: number, severity: 1 | 2 | 3 | 4, code: string, message = "m") =>
    toTypeDiagnostic({
      range: { start: { line: line - 1, character: 2 }, end: { line: line - 1, character: 5 } },
      severity,
      code,
      message,
    });

  test("lines count from 1, columns from 0, and a header of lines is not counted", () => {
    const diagnostic = toTypeDiagnostic(
      {
        range: { start: { line: 4, character: 7 }, end: { line: 4, character: 9 } },
        severity: 2,
        code: "reportX",
        message: "m",
      },
      3,
    );
    expect(diagnostic).toMatchObject({
      severity: "warning",
      line: 2,
      column: 7,
      endLine: 2,
      endColumn: 9,
      rule: "reportX",
    });
  });

  test("a diagnostic without a severity is an error", () => {
    expect(
      toTypeDiagnostic({
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
        message: "m",
      }).severity,
    ).toBe("error");
  });

  test("the unknown types that follow from a mistake are left out, the others are not", () => {
    const result = tidy([
      at(3, 1, "reportUnknownVariableType"),
      at(3, 1, "reportOperatorIssue"),
      at(5, 1, "reportUnknownVariableType"),
      at(1, 2, "reportUnusedImport"),
    ]);
    expect(result.map((d: TypeDiagnostic) => [d.line, d.rule])).toEqual([
      [1, "reportUnusedImport"],
      [3, "reportOperatorIssue"],
      [5, "reportUnknownVariableType"],
    ]);
  });

  test("'No overloads' is left out when the error about the argument follows it, and kept alone", () => {
    const both = tidy([
      at(2, 1, "reportCallIssue", 'No overloads for "tail" match the provided arguments'),
      at(
        2,
        1,
        "reportArgumentType",
        'Argument of type "Literal[5]" cannot be assigned to parameter "p"',
      ),
    ]);
    expect(both.map((d: TypeDiagnostic) => d.rule)).toEqual(["reportArgumentType"]);
    const alone = tidy([
      at(2, 1, "reportCallIssue", 'No overloads for "tail" match the provided arguments'),
    ]);
    expect(alone.map((d: TypeDiagnostic) => d.rule)).toEqual(["reportCallIssue"]);
  });
});
