/**
 * py2js chapter 3: native list literals, subscript access/assignment,
 * is_list/list_length, and the pair-mutator/stream builtins.
 *
 * The list.test.ts fixtures are the CSE/PVML/native-Pynter/CPython
 * conformance suite for these constructs (an expression-value form there,
 * since those engines are expression-oriented); py2js is exec-style only, so
 * each is wrapped in print() here instead — same adaptation
 * operator-conformance-py2js.test.ts already makes.
 *
 * A chapter-2 pair and a chapter-3+ list literal are the same runtime type
 * in py2js — a plain mutable PyValue[] (PyList; see runtime.ts's doc
 * comment) — matching the CSE machine, which represents both as the same
 * flat `{type:"list", value: Value[]}`. "Is this a pair" is a structural
 * question (length === 2), not a type-level one.
 */
import { runCodePy2Js } from "../engines/py2js";
import { runCode } from "../runner";

test.each([
  ["print(is_list([]))", "True\n"],
  ["print(is_list([1, 2, 3]))", "True\n"],
  ["print(is_list(1))", "False\n"],
  ["print(is_list(None))", "False\n"],
  ["print(is_list('x'))", "False\n"],
  ["print(list_length([]))", "0\n"],
  ["print(list_length([1, 2, 3]))", "3\n"],
  ["print(list_length([1, [2, 3], 4]))", "3\n"],
])("is_list/list_length: %s", (code, expected) => {
  expect(runCodePy2Js(code, 3).output).toBe(expected);
});

test.each([
  ["print([] == [])", "True\n"],
  ["print([1, 2, 3] == [1, 2, 3])", "True\n"],
  ["print([1, [2, 3], 4] == [1, [2, 3], 4])", "True\n"],
  ["print([1, 2] == [2, 1])", "False\n"],
  ["print([1, 2, 3] == [1, 2])", "False\n"],
  ["print([1, [2, 3]] == [1, [2, 4]])", "False\n"],
  ["xs = [10, 20, 30]\nys = [10, 20, 30]\nprint(xs == ys)", "True\n"],
  ["xs = [[0, 1], [1, 2], [2, 3]]\nys = [[0, 1], [1, 2], [2, 3]]\nprint(xs == ys)", "True\n"],
  ["xs = [0, 1, 2, 3]\nys = [1, 2, 3, 4]\nprint(xs == ys)", "False\n"],
])("structural == on lists: %s", (code, expected) => {
  expect(runCodePy2Js(code, 3).output).toBe(expected);
});

test.each([
  // pair(1, 2) and [1, 2] are the exact same runtime value in py2js (a
  // 2-element PyList) as they are on the CSE machine — originally a
  // dedicated cross-type case (Gemini review on #282) before py2js unified
  // pair/list into one representation; kept as a regression test.
  ["print(pair(1, 2) == [1, 2])", "True\n"],
  ["print([1, 2] == pair(1, 2))", "True\n"],
  ["print(pair(1, 2) == [1, 3])", "False\n"],
  ["print(pair(1, 2) == [1, 2, 3])", "False\n"],
  ["print(pair([1, 2], 3) == [[1, 2], 3])", "True\n"],
])("structural == between a pair and a 2-element list: %s", (code, expected) => {
  expect(runCodePy2Js(code, 3).output).toBe(expected);
});

test.each([
  ["xs = [10, 20, 30]\nprint(xs[1])", "20\n"],
  ["xs = [10, 20, 30]\nxs[1] = 99\nprint(xs)", "[10, 99, 30]\n"],
  ["xs = [1, 2, 3]\nprint(list_length(xs))", "3\n"],
  ["xs = [1, 2, 3]\nxs[0] = 100\nprint(list_length(xs))", "3\n"],
  ["xs = [1, 2, 3, 4]\nprint(xs)", "[1, 2, 3, 4]\n"],
  ["xs = [1, 2, 3, 4]\nprint(xs[2])", "3\n"],
  ["xs = [1, 2, 3, 4]\nxs[2] = 42\nprint(xs)", "[1, 2, 42, 4]\n"],
])("subscript access/assignment: %s", (code, expected) => {
  expect(runCodePy2Js(code, 3).output).toBe(expected);
});

test("list subscript out of range is an IndexError (CSE parity)", async () => {
  const code = "xs = [1, 2, 3]\nxs[5]";
  await expect(runCode(code, 3)).rejects.toThrow();
  expect(() => runCodePy2Js(`${code}\nprint(1)`, 3)).toThrow(/IndexError/);
});

test.each([
  ["xs = [10, 20, 30]\nprint(xs[-1])", "30\n"],
  ["xs = [10, 20, 30]\nprint(xs[-3])", "10\n"],
  ["xs = [10, 20, 30]\nxs[-1] = 99\nprint(xs)", "[10, 20, 99]\n"],
  ["xs = [10, 20, 30]\nxs[-3] = 99\nprint(xs)", "[99, 20, 30]\n"],
])("negative-index wraparound: %s", (code, expected) => {
  expect(runCodePy2Js(code, 3).output).toBe(expected);
});

test.each([
  ["[1, 2][2]", /IndexError/],
  ["[1, 2][-3]", /IndexError/],
  ["xs = [0, 0]\nxs[2] = 5", /IndexError/],
  ["xs = [0, 0]\nxs[-3] = 5", /IndexError/],
  ["[1, 2][0.0]", /TypeError/],
  ["[1, 2][True]", /TypeError/],
  ["xs = [1, 2]\nxs[0.0] = 5", /TypeError/],
  ["xs = [1, 2]\nxs[True] = 5", /TypeError/],
])("bad-index errors: %s", (code, pattern) => {
  expect(() => runCodePy2Js(`${code}\nprint(1)`, 3)).toThrow(pattern);
});

test.each([
  ["print([1, 2] * 3)", "[1, 2, 1, 2, 1, 2]\n"],
  ["print(3 * [1, 2])", "[1, 2, 1, 2, 1, 2]\n"],
  ["print([1, 2] * 0)", "[]\n"],
  ["print([1, 2] * -1)", "[]\n"],
])("list multiplication: %s", (code, expected) => {
  expect(runCodePy2Js(code, 3).output).toBe(expected);
});

test.each([
  ["[1, 2] * True", /TypeError/],
  ["True * [1, 2]", /TypeError/],
  ["[1, 2] * 2.0", /TypeError/],
  ["[1, 2] * [1, 2]", /TypeError/],
])("list multiplication by a non-integer errors: %s", (code, pattern) => {
  expect(() => runCodePy2Js(`print(${code})`, 3)).toThrow(pattern);
});

test("list multiplication makes shallow copies", () => {
  const code = "x = [[1, 2]] * 4\nprint(x[0] is x[1])";
  expect(runCodePy2Js(code, 3).output).toBe("True\n");
});

test("list assignment aliases: mutating through one reference is visible through another", () => {
  // A native list is a reference type — no copy-on-assign — matching CSE's
  // own array-backed ListValue and ordinary Python list semantics.
  const code = "xs = [1, 2, 3]\nys = xs\nys[0] = 99\nprint(xs)";
  expect(runCodePy2Js(code, 3).output).toBe("[99, 2, 3]\n");
});

describe("pair mutators (set_head/set_tail mutate in place, not a fresh copy)", () => {
  test("set_head/set_tail on a pair()", () => {
    const code = `p = pair(1, 2)
set_head(p, 99)
set_tail(p, 100)
print(head(p))
print(tail(p))
`;
    expect(runCodePy2Js(code, 3).output).toBe("99\n100\n");
  });

  test("set_head on a 2-element native list (CSE cannot tell a pair from a 2-list either)", () => {
    const code = "xs = [1, 2]\nset_head(xs, 99)\nprint(xs)";
    expect(runCodePy2Js(code, 3).output).toBe("[99, 2]\n");
  });

  test("a mutation is visible through every alias to the same pair", () => {
    const code = `p = pair(1, 2)
q = p
set_head(q, 42)
print(head(p))
`;
    expect(runCodePy2Js(code, 3).output).toBe("42\n");
  });
});

describe("stream() — the group's one native primitive; the rest is prelude Python", () => {
  test("stream(1, 2, 3): head is immediate, tail is a thunk", () => {
    const code = `s = stream(1, 2, 3)
print(head(s))
print(head(tail(s)()))
print(head(tail(tail(s)())()))
`;
    expect(runCodePy2Js(code, 3).output).toBe("1\n2\n3\n");
  });

  test("stream() with no arguments is None", () => {
    expect(runCodePy2Js("print(stream())", 3).output).toBe("None\n");
  });

  test("stream_to_llist (pure-Python prelude) round-trips through the one native primitive", () => {
    // print() shows a proper list in bracket notation, matching the CSE
    // machine exactly (print_llist's box-and-pointer "llist(...)" rendering
    // is a distinct, dedicated builtin — not what plain print() does).
    const code = "print(stream_to_llist(stream(1, 2, 3)))";
    expect(runCodePy2Js(code, 3).output).toBe("[1, [2, [3, None]]]\n");
  });

  test("a longer stream still yields elements in order (regression: nativeStream is index-based, not args.slice(1))", () => {
    const code = `s = stream(10, 20, 30, 40, 50)
print(stream_length(s))
print(stream_ref(s, 0))
print(stream_ref(s, 4))
`;
    expect(runCodePy2Js(code, 3).output).toBe("5\n10\n50\n");
  });
});

describe("pair() and a list literal are one representation (no separate PyPair type)", () => {
  // The motivating case: before py2js unified pairs and lists into one
  // PyList representation, subscripting a pair()-built value threw (only
  // Array.isArray was ever taught to listAccess/listAssign) even though CSE
  // allows it — pairs and lists share its one representation there too.
  test.each([
    ["p = pair(1, 2)\nprint(p[0])", "1\n"],
    ["p = pair(1, 2)\nprint(p[1])", "2\n"],
  ])("subscript read on a pair matches CSE: %s", async (code, expected) => {
    expect(await runCode(code, 3)).toBe(expected);
    expect(runCodePy2Js(code, 3).output).toBe(expected);
  });

  test("subscript write on a pair matches CSE (mutates in place, same as set_head/set_tail)", () => {
    const code = "p = pair(1, 2)\np[0] = 99\nprint(p)";
    expect(runCodePy2Js(code, 3).output).toBe("[99, 2]\n");
  });

  test("a pair still fails is_list/list_length's normal cousins the same way a list would if malformed — sanity check both directions work through the exact same code path", () => {
    // xs[0] on a literal list and p[0] on a pair go through the identical
    // listAccess call — this just confirms neither direction regressed.
    const code =
      "xs = [10, 20]\np = pair(30, 40)\nprint(xs[0])\nprint(p[0])\nxs[0] = 1\np[0] = 2\nprint(xs)\nprint(p)";
    expect(runCodePy2Js(code, 3).output).toBe("10\n30\n[1, 20]\n[2, 40]\n");
  });
});

describe("print_llist boundary cases (isProperList/printLlist walk 2-element-array chains, not a PyPair type)", () => {
  test.each([
    // A genuine pair chain (llist()): proper list notation.
    ["print_llist(llist(1, 2, 3))", "llist(1, 2, 3)\n"],
    // An improper pair (tail isn't None or another pair): bracket notation.
    ["print_llist(pair(1, 2))", "[1, 2]\n"],
    // A coincidentally-2-element *literal* list: structurally identical to a
    // pair (py2js and CSE can't tell them apart either), so it renders as a
    // pair would — bracket notation, not a leaf repr.
    ["print_llist([1, 2])", "[1, 2]\n"],
    // A genuine N-element (N != 2) literal list: never chain-shaped at any
    // step, so it falls straight to the general repr, not bracket-nesting.
    ["print_llist([1, 2, 3])", "[1, 2, 3]\n"],
    ["print_llist([1])", "[1]\n"],
    ["print_llist([])", "[]\n"],
  ])("%s", async (code, expected) => {
    expect(await runCode(code, 3)).toBe(expected);
    expect(runCodePy2Js(code, 3).output).toBe(expected);
  });
});

describe('error messages say "pair" at chapter 2, "list" at chapter 3+ (matching CSE\'s friendlyTypeName)', () => {
  test("chapter 2: unsupported operand type(s) says 'pair'", async () => {
    const code = "1 + pair(1, 2)";
    await expect(runCode(code, 2)).rejects.toThrow(/integer and pair/);
    expect(() => runCodePy2Js(code, 2)).toThrow(/'int' and 'pair'/);
  });

  test("chapter 3: the exact same construction says 'list'", async () => {
    const code = "1 + pair(1, 2)";
    await expect(runCode(code, 3)).rejects.toThrow(/integer and list/);
    expect(() => runCodePy2Js(code, 3)).toThrow(/'int' and 'list'/);
  });

  test("chapter 3: a genuine list literal also says 'list' (not 'pair')", () => {
    expect(() => runCodePy2Js("1 + [1, 2]", 3)).toThrow(/'int' and 'list'/);
  });

  test("set_head's error message (nativeSetPairSlot) also follows the chapter, not just binop's unsupported()", () => {
    expect(() => runCodePy2Js("set_head(1, 2)", 3)).toThrow(/got 'int'/);
    // The wrong-argument-type is an int either way; the pair-vs-list wording
    // only differs when the *value itself* is list-shaped, which isn't the
    // case here — this just confirms nativeSetPairSlot's threaded sayPair
    // parameter didn't break the ordinary (non-list) error path.
  });
});
