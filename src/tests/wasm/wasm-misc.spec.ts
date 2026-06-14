import { compileToWasmAndRun } from "../../engines/wasm";
import { ERROR_MAP, TYPE_TAG } from "../../engines/wasm/runtime";
import { FeatureNotSupportedError } from "../../validator";

it = it.concurrent;
describe("Feature gate tests", () => {
  const expectFeatureGateError = async (pythonCode: string, chapter: number) => {
    const result = await compileToWasmAndRun(pythonCode, true, { chapter });
    expect(result.errors).toContainEqual(expect.any(FeatureNotSupportedError));
  };

  const expectFeatureGateOk = async (pythonCode: string, chapter: number) => {
    const result = await compileToWasmAndRun(pythonCode, true, { chapter });
    expect(result.errors).toEqual([]);
  };

  describe("Chapter 1 — most restrictive", () => {
    it("simple function definition passes", async () => {
      await expectFeatureGateOk("def f(x):\n    x", 1);
    });

    it("while loop is banned", async () => {
      await expectFeatureGateError("while True:\n    pass", 1);
    });

    it("for loop is banned", async () => {
      await expectFeatureGateError("xs = 1\nfor i in xs:\n    pass", 1);
    });

    it("list literal is banned", async () => {
      await expectFeatureGateError("x = []", 1);
    });

    it("subscript assignment is banned", async () => {
      await expectFeatureGateError("xs = 1\nxs[0] = 3", 1);
    });

    it("break and continue are banned", async () => {
      await expectFeatureGateError("def f():\n    break", 1);
      await expectFeatureGateError("def f():\n    continue", 1);
    });

    it("nonlocal is banned", async () => {
      await expectFeatureGateError("def f():\n    x = 1\n    def g():\n        nonlocal x", 1);
    });

    it("rest params are banned", async () => {
      await expectFeatureGateError("def f(*args):\n    pass", 1);
    });

    it("spread in call is banned", async () => {
      await expectFeatureGateError("def f(a):\n    pass\nf(*f)", 1);
    });

    it("lambda *args is banned", async () => {
      await expectFeatureGateError("f = lambda *args: args", 1);
    });
  });

  describe("Chapter 2 — loops and reassignment still banned", () => {
    it("while loop is banned", async () => {
      await expectFeatureGateError("while True:\n    pass", 2);
    });

    it("for loop is banned", async () => {
      await expectFeatureGateError("xs = 1\nfor i in xs:\n    pass", 2);
    });

    it("list literal is banned", async () => {
      await expectFeatureGateError("x = []", 2);
    });

    it("nonlocal is banned", async () => {
      await expectFeatureGateError("def f():\n    x = 1\n    def g():\n        nonlocal x", 2);
    });

    it("rest params are banned", async () => {
      await expectFeatureGateError("def f(*args):\n    pass", 2);
    });

    it("spread in call is banned", async () => {
      await expectFeatureGateError("def f(a):\n    pass\nf(*f)", 2);
    });

    it("lambda *args is banned", async () => {
      await expectFeatureGateError("f = lambda *args: args", 2);
    });
  });

  describe("Chapter 3 — loops and lists allowed", () => {
    it("while loop is allowed", async () => {
      await expectFeatureGateOk("while False:\n    pass", 3);
    });

    it("list literal is allowed", async () => {
      await expectFeatureGateOk("x = []", 3);
    });

    it("nonlocal is allowed", async () => {
      await expectFeatureGateOk("def f():\n    x = 1\n    def g():\n        nonlocal x", 3);
    });

    it("for with range() is allowed", async () => {
      await expectFeatureGateOk("for i in range(3):\n    pass", 3);
    });

    it("for without range() is banned", async () => {
      await expectFeatureGateError("xs = 1\nfor i in xs:\n    pass", 3);
    });

    it("subscript assignment is allowed", async () => {
      await expectFeatureGateOk("xs = [1, 2]\nxs[0] = 3", 3);
    });

    it("rest params are allowed", async () => {
      await expectFeatureGateOk("def f(*args):\n    pass", 3);
    });

    it("spread in call is allowed", async () => {
      await expectFeatureGateOk("def f(a):\n    pass\nx = [1]\nf(*x)", 3);
    });

    it("lambda *args is allowed", async () => {
      await expectFeatureGateOk("f = lambda *args: args", 3);
    });
  });

  describe("Chapter 4 — no restrictions", () => {
    it("while loop is allowed", async () => {
      await expectFeatureGateOk("while False:\n    pass", 4);
    });

    it("list literal is allowed", async () => {
      await expectFeatureGateOk("x = [1, 2, 3]", 4);
    });

    it("lambda is allowed", async () => {
      await expectFeatureGateOk("f = lambda x: x", 4);
    });

    it("annotated assignment is banned", async () => {
      await expectFeatureGateError("x: abs = 5", 4);
    });

    it("annotated assignment is banned after normal assignment", async () => {
      await expectFeatureGateError("x = 5\nx: abs = 10", 4);
    });
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
