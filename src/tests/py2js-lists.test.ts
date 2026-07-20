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
 * Lists are a *distinct* runtime type from chapter 2's pairs in py2js (a
 * bare mutable PyValue[] vs. PyPair — see runtime.ts's PyList doc comment),
 * unlike the CSE machine, which represents both as the same flat
 * `{type:"list", value: Value[]}`. is_list/list_length are bridged through
 * the same stdlib builtins either way (stdlibBridge.ts's toTagged converts
 * both PyPair and a native array to that one CSE shape), so the two
 * representations answer identically despite being different JS types.
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
  [
    "xs = [[0, 1], [1, 2], [2, 3]]\nys = [[0, 1], [1, 2], [2, 3]]\nprint(xs == ys)",
    "True\n",
  ],
  ["xs = [0, 1, 2, 3]\nys = [1, 2, 3, 4]\nprint(xs == ys)", "False\n"],
])("structural == on lists: %s", (code, expected) => {
  expect(runCodePy2Js(code, 3).output).toBe(expected);
});

test.each([
  // A pair and a 2-element native list have no representational difference
  // on the CSE machine (both are its flat {type:"list", value: Value[]}),
  // so they must compare equal here too, despite py2js keeping PyPair and
  // native lists as two distinct JS types (Gemini review on #282).
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
