import { compileToWasmAndRun } from "../../engines/wasm";
import { ERROR_MAP, TYPE_TAG } from "../../engines/wasm/runtime";
import { FeatureNotSupportedError } from "../../validator";

it = it.concurrent;

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
    expect((await compileToWasmAndRun(pythonCode, true)).errors).toContainEqual(
      expect.any(FeatureNotSupportedError),
    );
  });

  it("for loop: range() requires at least one argument", async () => {
    const pythonCode = `
for i in range():
    pass
`;
    expect((await compileToWasmAndRun(pythonCode, true)).errors).toContainEqual(
      expect.any(FeatureNotSupportedError),
    );
  });

  it("for loop: range() accepts at most 3 arguments", async () => {
    const pythonCode = `
for i in range(1, 2, 3, 4):
    pass
`;
    expect((await compileToWasmAndRun(pythonCode, true)).errors).toContainEqual(
      expect.any(FeatureNotSupportedError),
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
