import { compileToWasmAndRun } from "../../engines/wasm";
import { ERROR_MAP, TYPE_TAG } from "../../engines/wasm/runtime";
import linkedList from "../../stdlib/linked-list";
import list from "../../stdlib/list";
import pairMutator from "../../stdlib/pairmutator";

it = it.concurrent;

describe("Pair tests", () => {
  const compileWithLinkedList = (pythonCode: string) =>
    compileToWasmAndRun(pythonCode, true, { groups: [linkedList, pairMutator] });

  it("pairs are lists", async () => {
    const pythonCode = `pair(1, 2)`;
    const { rawResult, renderedResult } = await compileWithLinkedList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.LIST);
    expect(renderedResult).toBe("[1, 2]");
  });

  it("construct pair and read head/tail", async () => {
    const pythonCode = `
p = pair(1, 2)
head(p) + tail(p)
`;
    const { rawResult, renderedResult } = await compileWithLinkedList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("3");
  });

  it("set_head mutates pair", async () => {
    const pythonCode = `
p = pair(10, 20)
set_head(p, 99)
head(p)
`;
    const { rawResult, renderedResult } = await compileWithLinkedList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("99");
  });

  it("set_tail mutates pair", async () => {
    const pythonCode = `
p = pair(10, 20)
set_tail(p, 7)
tail(p)
`;
    const { rawResult, renderedResult } = await compileWithLinkedList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("7");
  });

  it("nested pairs form linked list", async () => {
    const pythonCode = `
p = pair(1, pair(2, pair(3, None)))
head(tail(tail(p)))
`;
    const { rawResult, renderedResult } = await compileWithLinkedList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("3");
  });

  it("is_pair identifies pairs correctly", async () => {
    const pythonCode = `is_pair(pair(1, 2))`;
    const { rawResult, renderedResult } = await compileWithLinkedList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("is_pair identifies list of length 2 as pair", async () => {
    const pythonCode = `is_pair([1, 2])`;
    const { rawResult, renderedResult } = await compileWithLinkedList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("is_pair identifies list of length != 2 as non-pair", async () => {
    const pythonCode = `is_pair([1, 2, 3])`;
    const { rawResult, renderedResult } = await compileWithLinkedList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("False");
  });

  it("is_pair identifies non-pairs correctly", async () => {
    const pythonCode = `is_pair(42)`;
    const { rawResult, renderedResult } = await compileWithLinkedList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("False");
  });

  it("head on non-list should error", async () => {
    const pythonCode = `head(42)`;
    await expect(compileWithLinkedList(pythonCode)).rejects.toThrow(
      new Error(ERROR_MAP.HEAD_NOT_PAIR),
    );
  });

  it("tail on non-list should error", async () => {
    const pythonCode = `tail(42)`;
    await expect(compileWithLinkedList(pythonCode)).rejects.toThrow(
      new Error(ERROR_MAP.TAIL_NOT_PAIR),
    );
  });
});

describe("Linked list tests", () => {
  const compileWithLinkedList = (pythonCode: string) =>
    compileToWasmAndRun(pythonCode, true, { groups: [linkedList, pairMutator] });

  it("linked_list constructs a linked list from a Python list", async () => {
    const pythonCode = `head(tail(linked_list(1, 2, 3)))`;
    const { rawResult, renderedResult } = await compileWithLinkedList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("2");
  });

  it("set_head mutates linked list", async () => {
    const pythonCode = `
l = linked_list(10, 20, 30)
set_head(l, 99)
head(l)
`;
    const { rawResult, renderedResult } = await compileWithLinkedList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("99");
  });

  it("is_none identifies None correctly", async () => {
    const pythonCode = `is_none(None)`;
    const { rawResult, renderedResult } = await compileWithLinkedList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("is_none identifies non-None correctly", async () => {
    const pythonCode = `is_none(42)`;
    const { rawResult, renderedResult } = await compileWithLinkedList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("False");
  });

  it("is_linked_list identifies linked list correctly", async () => {
    const pythonCode = `is_linked_list(linked_list(1, 2, 3))`;
    const { rawResult, renderedResult } = await compileWithLinkedList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("is_linked_list identifies linked lists created with nested pairs", async () => {
    const pythonCode = `is_linked_list(pair(1, pair(2, pair(3, None))))`;
    const { rawResult, renderedResult } = await compileWithLinkedList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("is_linked_list identifies non-linked lists correctly", async () => {
    const pythonCode = `is_linked_list([1, 2, 3])`;
    const { rawResult, renderedResult } = await compileWithLinkedList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("False");
  });

  it("is_linked_list identifies non-linked lists created with pairs correctly", async () => {
    const pythonCode = `is_linked_list(pair(1, pair(2, pair(3, 4))))`;
    const { rawResult, renderedResult } = await compileWithLinkedList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("False");
  });
});

describe("List semantics tests", () => {
  const compileWithList = (pythonCode: string) =>
    compileToWasmAndRun(pythonCode, true, { groups: [linkedList, list] });

  it("list literal creation", async () => {
    const pythonCode = `
x = [1, 2, 3]
x[0] + x[1] + x[2]
`;
    const { rawResult, renderedResult } = await compileWithList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("6");
  });

  it("list indexing", async () => {
    const pythonCode = `
x = [10, 20, 30]
x[1]
`;
    const { rawResult, renderedResult } = await compileWithList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("20");
  });

  it("list index mutation", async () => {
    const pythonCode = `
x = [1, 2, 3]
x[1] = 100
x[0] + x[1] + x[2]
  `;
    const { rawResult, renderedResult } = await compileWithList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("104");
  });

  it("indexing a non-list should error", async () => {
    const pythonCode = `
x = 42
x[0]
`;
    await expect(compileWithList(pythonCode)).rejects.toThrow(
      new Error(ERROR_MAP.GET_ELEMENT_NOT_LIST),
    );
  });

  it("setting an element on a non-list should error", async () => {
    const pythonCode = `
x = 42
x[0] = 1
`;
    await expect(compileWithList(pythonCode)).rejects.toThrow(
      new Error(ERROR_MAP.SET_ELEMENT_NOT_LIST),
    );
  });

  it("list indexing with a non-integer index should error", async () => {
    const pythonCode = `
x = [1, 2, 3]
x[1.5]
`;
    await expect(compileWithList(pythonCode)).rejects.toThrow(new Error(ERROR_MAP.INDEX_NOT_INT));
  });

  it("list indexing out of range should error", async () => {
    const pythonCode = `
x = [1, 2, 3]
x[3]
`;
    await expect(compileWithList(pythonCode)).rejects.toThrow(
      new Error(ERROR_MAP.LIST_OUT_OF_RANGE),
    );
  });

  it("nested lists indexing", async () => {
    const pythonCode = `
x = [[1, 2], [3, 4]]
x[1][0]
`;
    const { rawResult, renderedResult } = await compileWithList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("3");
  });

  it("nested list mutation", async () => {
    const pythonCode = `
x = [[1, 2], [3, 4]]
x[0][1] = 9
x[0][0] + x[0][1]
  `;
    const { rawResult, renderedResult } = await compileWithList(pythonCode);
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
    const { rawResult, renderedResult } = await compileWithList(pythonCode);
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
    const { rawResult, renderedResult } = await compileWithList(pythonCode);
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
    const { rawResult, renderedResult } = await compileWithList(pythonCode);
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
    const { rawResult, renderedResult } = await compileWithList(pythonCode);
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
    const { rawResult, renderedResult } = await compileWithList(pythonCode);
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
    const { rawResult, renderedResult } = await compileWithList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("3");
  });

  it("list can store mixed types", async () => {
    const pythonCode = `
x = [1, True, 3]
x[0] + x[2]
`;
    const { rawResult, renderedResult } = await compileWithList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("4");
  });

  it("is_list identifies lists correctly", async () => {
    const pythonCode = `is_list([1, 2, 3])`;
    const { rawResult, renderedResult } = await compileWithList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("is_list identifies pairs as lists", async () => {
    const pythonCode = `is_list(pair(1, 2))`;
    const { rawResult, renderedResult } = await compileWithList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("is_list identifies non-lists correctly", async () => {
    const pythonCode = `is_list(42)`;
    const { rawResult, renderedResult } = await compileWithList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("False");
  });

  it("is_list identifies varargs tuples as lists", async () => {
    const pythonCode = `
def f(*args):
    return is_list(args)

f(1, 2, 3)
`;
    const { rawResult, renderedResult } = await compileWithList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.BOOL);
    expect(renderedResult).toBe("True");
  });

  it("list length function", async () => {
    const pythonCode = `list_length([10, 20, 30])`;
    const { rawResult, renderedResult } = await compileWithList(pythonCode);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("3");
  });

  it("list length on non-list should error", async () => {
    const pythonCode = `list_length(42)`;
    await expect(compileWithList(pythonCode)).rejects.toThrow(
      new Error(ERROR_MAP.GET_LENGTH_NOT_LIST),
    );
  });
});
