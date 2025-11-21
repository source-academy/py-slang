import { compileToWasmAndRun } from "../wasm-compiler";

describe("Environment tests", () => {
  it("captures outer variable by reference (mutation after definition visible)", async () => {
    const pythonCode = `
def outer():
    x = 1
    def inner():
        return x
    x = 2
    return inner()
outer()
`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([0, BigInt(2)]);
  });

  it("inner variable shadows outer variable", async () => {
    const pythonCode = `
def outer():
    x = 5
    def inner():
        x = 7
        return x
    return inner()
outer()
`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([0, BigInt(7)]);
  });

  it("inner function reads variable from outer scope", async () => {
    const pythonCode = `
def outer():
    x = 5
    def inner():
        return x
    return inner()
outer()
`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([0, BigInt(5)]);
  });

  it("reassignment in outer scope after defining inner is visible to inner", async () => {
    const pythonCode = `
def outer():
    x = 1
    def inner():
        return x
    x = 9
    return inner()
outer()
`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([0, BigInt(9)]);
  });

  it("nested closure can access variable from grandparent scope", async () => {
    const pythonCode = `
def grandparent():
    a = 10
    def parent():
        b = 5
        def child():
            return a + b
        return child
    return parent

f = grandparent()
g = f()
g()
`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([0, BigInt(15)]);
  });

  it("each call to outer creates a new environment", async () => {
    const pythonCode = `
def make_number(n):
    def get():
        return n
    return get

a = make_number(3)
b = make_number(10)
a() + b()
`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([0, BigInt(13)]);
  });

  it("function returned from outer retains access to outer variable", async () => {
    const pythonCode = `
def outer():
    x = 7
    def inner():
        return x
    return inner

f = outer()
f()
`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([0, BigInt(7)]);
  });

  it("returned function reflects reassignment in outer before return", async () => {
    const pythonCode = `
def outer():
    x = 3
    def inner():
        return x
    x = 8
    return inner

f = outer()
f()
`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([0, BigInt(8)]);
  });

  it("different closures capture independent variables", async () => {
    const pythonCode = `
def make_adder(n):
    def add(x):
        return n + x
    return add

add1 = make_adder(1)
add2 = make_adder(5)
add1(3) + add2(3)
`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([0, BigInt(12)]);
  });

  it("reusing same closure multiple times uses same environment", async () => {
    const pythonCode = `
def outer():
    x = 4
    def inner():
        return x
    return inner

f = outer()
f() + f()
`;
    const result = await compileToWasmAndRun(pythonCode);
    expect(result).toEqual([0, BigInt(8)]);
  });
});
