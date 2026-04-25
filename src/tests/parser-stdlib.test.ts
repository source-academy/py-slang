import { TypeError } from "../errors";
import linkedList from "../stdlib/linked-list";
import list from "../stdlib/list";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import pairmutator from "../stdlib/pairmutator";
import parser from "../stdlib/parser";
import stream from "../stdlib/stream";
import { generateTestCases, TestCases } from "./utils";

const groups = [misc, math, linkedList, list, pairmutator, stream, parser];

describe("Parser Stdlib Tests", () => {
  // parse — Literals
  const literalTests: TestCases = {
    "parse — integer literals": [
      ['print(parse("42"))', null, ["['literal', [42, None]]"]],
      ['print(parse("0"))', null, ["['literal', [0, None]]"]],
      ['print(parse("1"))', null, ["['literal', [1, None]]"]],
      ['print(parse("999"))', null, ["['literal', [999, None]]"]],
    ],
    "parse — float literal": [['print(parse("3.14"))', null, ["['literal', [3.14, None]]"]]],
    "parse — boolean literals": [
      ['print(parse("True"))', null, ["['literal', [True, None]]"]],
      ['print(parse("False"))', null, ["['literal', [False, None]]"]],
    ],
    "parse — None literal": [['print(parse("None"))', null, ["['literal', [None, None]]"]]],
    "parse — string literal": [
      ['print(parse("\\"hello\\""))', null, ["['literal', ['hello', None]]"]],
    ],
    "parse — big integer literal": [
      ['print(parse("99999999999999999999"))', null, ["['literal', [99999999999999999999, None]]"]],
    ],
    "parse — complex literal": [['print(parse("3j"))', null, ["['literal', [3j, None]]"]]],
    "parse — complex expression": [
      [
        'print(parse("2+3j"))',
        null,
        [
          "[ 'binary_operator_combination',\n['+', [['literal', [2, None]], [['literal', [3j, None]], None]]]]",
        ],
      ],
    ],
  };

  // parse — Names
  const nameTests: TestCases = {
    "parse — variable names": [
      ['print(parse("x"))', null, ["['name', ['x', None]]"]],
      ['print(parse("foo"))', null, ["['name', ['foo', None]]"]],
    ],
  };

  // parse — Binary operators
  const binaryTests: TestCases = {
    "parse — arithmetic operators": [
      [
        'print(parse("1 + 2"))',
        null,
        [
          "[ 'binary_operator_combination',\n['+', [['literal', [1, None]], [['literal', [2, None]], None]]]]",
        ],
      ],
      [
        'print(parse("3 - 1"))',
        null,
        [
          "[ 'binary_operator_combination',\n['-', [['literal', [3, None]], [['literal', [1, None]], None]]]]",
        ],
      ],
      [
        'print(parse("2 * 3"))',
        null,
        [
          "[ 'binary_operator_combination',\n['*', [['literal', [2, None]], [['literal', [3, None]], None]]]]",
        ],
      ],
      [
        'print(parse("6 / 2"))',
        null,
        [
          "[ 'binary_operator_combination',\n['/', [['literal', [6, None]], [['literal', [2, None]], None]]]]",
        ],
      ],
      [
        'print(parse("7 // 3"))',
        null,
        [
          "[ 'binary_operator_combination',\n['//', [['literal', [7, None]], [['literal', [3, None]], None]]]]",
        ],
      ],
      [
        'print(parse("7 % 3"))',
        null,
        [
          "[ 'binary_operator_combination',\n['%', [['literal', [7, None]], [['literal', [3, None]], None]]]]",
        ],
      ],
      [
        'print(parse("2 ** 3"))',
        null,
        [
          "[ 'binary_operator_combination',\n['**', [['literal', [2, None]], [['literal', [3, None]], None]]]]",
        ],
      ],
    ],
  };

  // parse — Unary operators
  const unaryTests: TestCases = {
    "parse — unary operators": [
      [
        'print(parse("-1"))',
        null,
        ["['unary_operator_combination', ['-', [['literal', [1, None]], None]]]"],
      ],
      [
        'print(parse("not True"))',
        null,
        ["['unary_operator_combination', ['not', [['literal', [True, None]], None]]]"],
      ],
    ],
  };

  // parse — Boolean operators
  const boolOpTests: TestCases = {
    "parse — logical composition": [
      [
        'print(parse("True and False"))',
        null,
        [
          "[ 'logical_composition',\n['and', [['literal', [True, None]], [['literal', [False, None]], None]]]]",
        ],
      ],
      [
        'print(parse("True or False"))',
        null,
        [
          "[ 'logical_composition',\n['or', [['literal', [True, None]], [['literal', [False, None]], None]]]]",
        ],
      ],
    ],
  };

  // parse — Comparison operators
  const compareTests: TestCases = {
    "parse — comparison operators": [
      [
        'print(parse("1 == 2"))',
        null,
        ["['comparison', ['==', [['literal', [1, None]], [['literal', [2, None]], None]]]]"],
      ],
      [
        'print(parse("1 != 2"))',
        null,
        ["['comparison', ['!=', [['literal', [1, None]], [['literal', [2, None]], None]]]]"],
      ],
      [
        'print(parse("1 < 2"))',
        null,
        ["['comparison', ['<', [['literal', [1, None]], [['literal', [2, None]], None]]]]"],
      ],
      [
        'print(parse("1 <= 2"))',
        null,
        ["['comparison', ['<=', [['literal', [1, None]], [['literal', [2, None]], None]]]]"],
      ],
      [
        'print(parse("1 > 2"))',
        null,
        ["['comparison', ['>', [['literal', [1, None]], [['literal', [2, None]], None]]]]"],
      ],
      [
        'print(parse("1 >= 2"))',
        null,
        ["['comparison', ['>=', [['literal', [1, None]], [['literal', [2, None]], None]]]]"],
      ],
    ],
  };

  // parse — Conditionals
  const conditionalTests: TestCases = {
    "parse — conditional statement (if/else)": [
      [
        'print(parse("if True:\\n    1\\nelse:\\n    2\\n"))',
        null,
        [
          "[ 'conditional_statement',\n[ ['literal', [True, None]],\n[['literal', [1, None]], [['literal', [2, None]], None]]]]",
        ],
      ],
    ],
    "parse — conditional expression (ternary)": [
      [
        'print(parse("1 if True else 2"))',
        null,
        [
          "[ 'conditional_expression',\n[ ['literal', [True, None]],\n[['literal', [1, None]], [['literal', [2, None]], None]]]]",
        ],
      ],
    ],
  };

  // parse — Loops
  const loopTests: TestCases = {
    "parse — while loop": [
      [
        'print(parse("while True:\\n    pass\\n"))',
        null,
        ["['while_loop', [['literal', [True, None]], [['pass_statement', None], None]]]"],
      ],
    ],
    "parse — while with break": [
      [
        'print(parse("while True:\\n    break\\n"))',
        null,
        ["['while_loop', [['literal', [True, None]], [['break_statement', None], None]]]"],
      ],
    ],
    "parse — while with continue": [
      [
        'print(parse("while True:\\n    continue\\n"))',
        null,
        ["['while_loop', [['literal', [True, None]], [['continue_statement', None], None]]]"],
      ],
    ],
    "parse — for loop": [
      [
        'print(parse("for i in range(3):\\n    pass\\n"))',
        null,
        [
          "[ 'for_loop',\n[ ['name', ['i', None]],\n[ [ 'application',\n  [['name', ['range', None]], [[['literal', [3, None]], None], None]]],\n[['pass_statement', None], None]]]]",
        ],
      ],
    ],
  };

  // parse — Functions
  const functionTests: TestCases = {
    "parse — function definition single param": [
      [
        'print(parse("def f(x):\\n    return x\\n"))',
        null,
        [
          "[ 'function_declaration',\n[ ['name', ['f', None]],\n[ [['name', ['x', None]], None],\n[['return_statement', [['name', ['x', None]], None]], None]]]]",
        ],
      ],
    ],
    "parse — function definition multiple params": [
      [
        'print(parse("def f(x, y):\\n    return x\\n"))',
        null,
        [
          "[ 'function_declaration',\n[ ['name', ['f', None]],\n[ [['name', ['x', None]], [['name', ['y', None]], None]],\n[['return_statement', [['name', ['x', None]], None]], None]]]]",
        ],
      ],
    ],
    "parse — function definition no params": [
      [
        'print(parse("def f():\\n    return 1\\n"))',
        null,
        [
          "[ 'function_declaration',\n[ ['name', ['f', None]],\n[None, [['return_statement', [['literal', [1, None]], None]], None]]]]",
        ],
      ],
    ],
    "parse — function definition with rest params": [
      [
        'print(parse("def f(*args):\\n    return args\\n"))',
        null,
        [
          "[ 'function_declaration',\n[ ['name', ['f', None]],\n[ [['rest_element', [['name', ['args', None]], None]], None],\n[['return_statement', [['name', ['args', None]], None]], None]]]]",
        ],
      ],
    ],
    "parse — function body with block (declarations)": [
      [
        'print(parse("def f():\\n    x = 1\\n    return x\\n"))',
        null,
        [
          "[ 'function_declaration',\n[ ['name', ['f', None]],\n[ None,\n[ [ 'block',\n  [ [ 'sequence',\n    [ [ ['declaration', [['name', ['x', None]], [['literal', [1, None]], None]]],\n      [['return_statement', [['name', ['x', None]], None]], None]],\n    None]],\n  None]],\nNone]]]]",
        ],
      ],
    ],
  };

  // parse — Lambda
  const lambdaTests: TestCases = {
    "parse — lambda single param": [
      [
        'print(parse("lambda x: x"))',
        null,
        [
          "[ 'lambda_expression',\n[ [['name', ['x', None]], None],\n[['return_statement', [['name', ['x', None]], None]], None]]]",
        ],
      ],
    ],
    "parse — lambda multiple params": [
      [
        'print(parse("lambda x, y: x"))',
        null,
        [
          "[ 'lambda_expression',\n[ [['name', ['x', None]], [['name', ['y', None]], None]],\n[['return_statement', [['name', ['x', None]], None]], None]]]",
        ],
      ],
    ],
    "parse — lambda no params": [
      [
        'print(parse("lambda: 1"))',
        null,
        [
          "[ 'lambda_expression',\n[None, [['return_statement', [['literal', [1, None]], None]], None]]]",
        ],
      ],
    ],
  };

  // parse — Application (function calls)
  const applicationTests: TestCases = {
    "parse — application with args": [
      [
        'print(parse("f(1, 2)"))',
        null,
        [
          "[ 'application',\n[ ['name', ['f', None]],\n[[['literal', [1, None]], [['literal', [2, None]], None]], None]]]",
        ],
      ],
    ],
    "parse — application no args": [
      ['print(parse("f()"))', null, ["['application', [['name', ['f', None]], [None, None]]]"]],
    ],
    "parse — application single arg": [
      [
        'print(parse("f(1)"))',
        null,
        ["['application', [['name', ['f', None]], [[['literal', [1, None]], None], None]]]"],
      ],
    ],
  };

  // parse — Assignment and declaration
  const assignTests: TestCases = {
    "parse — single declaration": [
      [
        'print(parse("x = 1"))',
        null,
        ["['declaration', [['name', ['x', None]], [['literal', [1, None]], None]]]"],
      ],
    ],
    "parse — declaration then assignment": [
      [
        'print(parse("x = 1\\nx = 2\\n"))',
        null,
        [
          "[ 'sequence',\n[ [ ['declaration', [['name', ['x', None]], [['literal', [1, None]], None]]],\n  [['assignment', [['name', ['x', None]], [['literal', [2, None]], None]]], None]],\nNone]]",
        ],
      ],
    ],
  };

  // parse — List and subscript
  const listTests: TestCases = {
    "parse — list expression": [
      [
        'print(parse("[1, 2, 3]"))',
        null,
        [
          "[ 'array_expression',\n[ [['literal', [1, None]], [['literal', [2, None]], [['literal', [3, None]], None]]],\nNone]]",
        ],
      ],
    ],
    "parse — empty list": [['print(parse("[]"))', null, ["['array_expression', [None, None]]"]]],
    "parse — single element list": [
      [
        'print(parse("[1]"))',
        null,
        ["['array_expression', [[['literal', [1, None]], None], None]]"],
      ],
    ],
    "parse — subscript access": [
      [
        'print(parse("x[0]"))',
        null,
        ["['object_access', [['name', ['x', None]], [['literal', [0, None]], None]]]"],
      ],
    ],
  };

  // parse — Starred expression
  const starredTests: TestCases = {
    "parse — starred expression in call": [
      [
        'print(parse("def f(a):\\n    pass\\nx = [1]\\nf(*x)"))',
        null,
        [
          "[ 'sequence',\n[ [ [ 'function_declaration',\n    [ ['name', ['f', None]],\n    [[['name', ['a', None]], None], [['pass_statement', None], None]]]],\n  [ [ 'declaration',\n    [ ['name', ['x', None]],\n    [['array_expression', [[['literal', [1, None]], None], None]], None]]],\n  [ [ 'application',\n    [ ['name', ['f', None]],\n    [[['starred_expression', [['name', ['x', None]], None]], None], None]]],\n  None]]],\nNone]]",
        ],
      ],
    ],
  };

  // parse — Control flow statements
  const controlFlowTests: TestCases = {
    "parse — pass statement": [['print(parse("pass"))', null, ["['pass_statement', None]"]]],
    "parse — return statement": [
      [
        'print(parse("def f():\\n    return 1\\n"))',
        null,
        [
          "[ 'function_declaration',\n[ ['name', ['f', None]],\n[None, [['return_statement', [['literal', [1, None]], None]], None]]]]",
        ],
      ],
    ],
    "parse — return None (no value)": [
      [
        'print(parse("def f():\\n    return\\n"))',
        null,
        [
          "[ 'function_declaration',\n[['name', ['f', None]], [None, [['return_statement', [None, None]], None]]]]",
        ],
      ],
    ],
  };

  // parse — Scope statements
  const scopeTests: TestCases = {
    "parse — global statement": [
      [
        'print(parse("def f():\\n    global x\\n"))',
        null,
        [
          "[ 'function_declaration',\n[['name', ['f', None]], [None, [['global_statement', ['x', None]], None]]]]",
        ],
      ],
    ],
    "parse — nonlocal statement": [
      [
        'print(parse("def f():\\n    x = 1\\n    def g():\\n        nonlocal x\\n"))',
        null,
        [
          "[ 'function_declaration',\n[ ['name', ['f', None]],\n[ None,\n[ [ 'block',\n  [ [ 'sequence',\n    [ [ ['declaration', [['name', ['x', None]], [['literal', [1, None]], None]]],\n      [ [ 'function_declaration',\n        [['name', ['g', None]], [None, [['nonlocal_statement', ['x', None]], None]]]],\n      None]],\n    None]],\n  None]],\nNone]]]]",
        ],
      ],
    ],
  };

  // parse — Assert
  const assertTests: TestCases = {
    "parse — assert statement": [
      [
        'print(parse("assert True"))',
        null,
        ["['assert_statement', [['literal', [True, None]], None]]"],
      ],
      [
        'print(parse("assert 1 == 1"))',
        null,
        [
          "[ 'assert_statement',\n[ ['comparison', ['==', [['literal', [1, None]], [['literal', [1, None]], None]]]],\nNone]]",
        ],
      ],
    ],
  };

  // parse — Import
  const importTests: TestCases = {
    "parse — from import single name": [
      [
        'print(parse("from math import sqrt"))',
        null,
        ["['import_from', ['math', [['sqrt', None], None]]]"],
      ],
    ],
    "parse — from import multiple names": [
      [
        'print(parse("from math import sqrt, cos"))',
        null,
        ["['import_from', ['math', [['sqrt', ['cos', None]], None]]]"],
      ],
    ],
  };

  // parse — Sequence
  const sequenceTests: TestCases = {
    "parse — sequence of expressions": [
      [
        'print(parse("1\\n2\\n3\\n"))',
        null,
        [
          "[ 'sequence',\n[ [['literal', [1, None]], [['literal', [2, None]], [['literal', [3, None]], None]]],\nNone]]",
        ],
      ],
    ],
    "parse — single statement (no sequence)": [
      ['print(parse("1"))', null, ["['literal', [1, None]]"]],
    ],
  };

  // parse — Nested / complex
  const nestedTests: TestCases = {
    "parse — nested binary": [
      [
        'print(parse("1 + 2 + 3"))',
        null,
        [
          "[ 'binary_operator_combination',\n[ '+',\n[ [ 'binary_operator_combination',\n  ['+', [['literal', [1, None]], [['literal', [2, None]], None]]]],\n[['literal', [3, None]], None]]]]",
        ],
      ],
    ],
    "parse — nested function call": [
      [
        'print(parse("f(g(1))"))',
        null,
        [
          "[ 'application',\n[ ['name', ['f', None]],\n[ [ ['application', [['name', ['g', None]], [[['literal', [1, None]], None], None]]],\n  None],\nNone]]]",
        ],
      ],
    ],
    "parse — if without else": [
      [
        'print(parse("if True:\\n    1\\n"))',
        null,
        [
          "[ 'conditional_statement',\n[['literal', [True, None]], [['literal', [1, None]], [None, None]]]]",
        ],
      ],
    ],
    "parse — multiple statements in function body": [
      [
        'print(parse("def f():\\n    x = 1\\n    y = 2\\n    return x\\n"))',
        null,
        [
          "[ 'function_declaration',\n[ ['name', ['f', None]],\n[ None,\n[ [ 'block',\n  [ [ 'sequence',\n    [ [ ['declaration', [['name', ['x', None]], [['literal', [1, None]], None]]],\n      [ ['declaration', [['name', ['y', None]], [['literal', [2, None]], None]]],\n      [['return_statement', [['name', ['x', None]], None]], None]]],\n    None]],\n  None]],\nNone]]]]",
        ],
      ],
    ],
    "parse — while with multiple body statements": [
      [
        'print(parse("while True:\\n    1\\n    2\\n"))',
        null,
        [
          "[ 'while_loop',\n[ ['literal', [True, None]],\n[ ['sequence', [[['literal', [1, None]], [['literal', [2, None]], None]], None]],\nNone]]]",
        ],
      ],
    ],
    "parse — for with body": [
      [
        'print(parse("for i in range(3):\\n    i\\n"))',
        null,
        [
          "[ 'for_loop',\n[ ['name', ['i', None]],\n[ [ 'application',\n  [['name', ['range', None]], [[['literal', [3, None]], None], None]]],\n[['name', ['i', None]], None]]]]",
        ],
      ],
    ],
  };

  // parse — Type errors
  const parseErrorTests: TestCases = {
    "parse — type errors": [
      ["parse(1)", TypeError, null],
      ["parse(True)", TypeError, null],
      ["parse(False)", TypeError, null],
      ["parse(None)", TypeError, null],
      ["parse([])", TypeError, null],
    ],
  };

  // tokenize
  const tokenizeTests: TestCases = {
    "tokenize — basic tokens": [
      ['print(tokenize("x = 1 + 2"))', null, ["['x', ['=', ['1', ['+', ['2', None]]]]]"]],
      ['print(tokenize("42"))', null, ["['42', None]"]],
      ['print(tokenize("x"))', null, ["['x', None]"]],
    ],
    "tokenize — type errors": [
      ["tokenize(1)", TypeError, null],
      ["tokenize(True)", TypeError, null],
      ["tokenize(None)", TypeError, null],
    ],
  };

  // apply_in_underlying_python
  const applyTests: TestCases = {
    "apply_in_underlying_python — single arg builtins": [
      ["apply_in_underlying_python(abs, linked_list(-5))", 5n, null],
      ["apply_in_underlying_python(abs, linked_list(-42))", 42n, null],
      ["apply_in_underlying_python(abs, linked_list(0))", 0n, null],
    ],
    "apply_in_underlying_python — multi arg builtins": [
      ["apply_in_underlying_python(max, linked_list(1, 2, 3))", 3n, null],
      ["apply_in_underlying_python(min, linked_list(5, 2, 8))", 2n, null],
      ["apply_in_underlying_python(max, linked_list(-1, -5, -2))", -1n, null],
    ],
    "apply_in_underlying_python — empty args": [
      ["apply_in_underlying_python(linked_list, None)", null, null],
    ],
    "apply_in_underlying_python — type errors": [
      ["apply_in_underlying_python(1, linked_list(1))", TypeError, null],
      ['apply_in_underlying_python("abs", linked_list(1))', TypeError, null],
      ["apply_in_underlying_python(True, linked_list(1))", TypeError, null],
      ["apply_in_underlying_python(None, linked_list(1))", TypeError, null],
    ],
    "apply_in_underlying_python — non-primitive functions": [
      ["apply_in_underlying_python(lambda x: x + 1, linked_list(5))", 6n, null],
      [
        "def f(x, y, *args):\n    return x + y + (f(*args) if len(args) > 0 else 0)\napply_in_underlying_python(f, linked_list(1, 2, 3, 4))",
        10n,
        null,
      ],
      [
        'def g(x, y): return x + " " + y\napply_in_underlying_python(g, linked_list("hello", "world"))',
        "hello world",
        null,
      ],
    ],
  };

  generateTestCases(literalTests, 4, groups);
  generateTestCases(nameTests, 4, groups);
  generateTestCases(binaryTests, 4, groups);
  generateTestCases(unaryTests, 4, groups);
  generateTestCases(boolOpTests, 4, groups);
  generateTestCases(compareTests, 4, groups);
  generateTestCases(conditionalTests, 4, groups);
  generateTestCases(loopTests, 4, groups);
  generateTestCases(functionTests, 4, groups);
  generateTestCases(lambdaTests, 4, groups);
  generateTestCases(applicationTests, 4, groups);
  generateTestCases(assignTests, 4, groups);
  generateTestCases(listTests, 4, groups);
  generateTestCases(starredTests, 4, groups);
  generateTestCases(controlFlowTests, 4, groups);
  generateTestCases(scopeTests, 4, groups);
  generateTestCases(assertTests, 4, groups);
  generateTestCases(importTests, 4, groups);
  generateTestCases(sequenceTests, 4, groups);
  generateTestCases(nestedTests, 4, groups);
  generateTestCases(parseErrorTests, 4, groups);
  generateTestCases(tokenizeTests, 4, groups);
  generateTestCases(applyTests, 4, groups);
});
