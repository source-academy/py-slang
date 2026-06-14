import { parse } from "../parser/parser-adapter";
import { SVMLCompiler } from "../engines/svml/svml-compiler";

function compilePython(code: string) {
  const ast = parse(code + "\n");
  const compiler = SVMLCompiler.fromProgram(ast);
  return compiler.compileProgram(ast);
}

describe("SVML Compiler - Debug + Smoke Tests", () => {

  test("basic program compiles", () => {
    const program = compilePython(`
x = 1
y = 2
x + y
`);

    console.log("=== BASIC PROGRAM ===");
    console.dir(program, { depth: null });

    expect(program).toBeDefined();
  });

  test("while loop compiles and prints SVML", () => {
    const program = compilePython(`
x = 0
while x < 3:
    x = x + 1
x
`);

    console.log("=== WHILE LOOP ===");
    console.dir(program, { depth: null });

    // Optional: focus on functions only
    if ((program as any).functions) {
      console.log("=== FUNCTIONS ===");
      (program as any).functions.forEach((fn: any, i: number) => {
        console.log("FUNCTION", i);
        console.dir(fn, { depth: null });
      });
    }

    expect(program).toBeDefined();
  });

  test("for loop compiles and prints SVML", () => {
    const program = compilePython(`
xs = [10, 20, 30]
total = 0
for x in xs:
    total = total + x
total
`);

    console.log("=== FOR LOOP ===");
    console.dir(program, { depth: null });

    if ((program as any).functions) {
      console.log("=== FUNCTIONS ===");
      (program as any).functions.forEach((fn: any, i: number) => {
        console.log("FUNCTION", i);
        console.dir(fn, { depth: null });
      });
    }

    expect(program).toBeDefined();
  });

  test("for loop with break", () => {
    const program = compilePython(`
xs = [1, 2, 3]
for x in xs:
    break
0
`);

    console.log("=== FOR BREAK ===");
    console.dir(program, { depth: null });

    expect(program).toBeDefined();
  });

  test("for loop with continue", () => {
    const program = compilePython(`
xs = [1, 2, 3]
for x in xs:
    continue
0
`);

    console.log("=== FOR CONTINUE ===");
    console.dir(program, { depth: null });

    expect(program).toBeDefined();
  });

  test("nested loops", () => {
    const program = compilePython(`
xs = [1, 2]
ys = [3, 4]
total = 0
for x in xs:
    for y in ys:
        total = total + x
total
`);

    console.log("=== NESTED LOOPS ===");
    console.dir(program, { depth: null });

    expect(program).toBeDefined();
  });

  test("function with loop", () => {
    const program = compilePython(`
def f(xs):
    total = 0
    for x in xs:
        total = total + x
    return total

f([1, 2, 3])
`);

    console.log("=== FUNCTION LOOP ===");
    console.dir(program, { depth: null });

    expect(program).toBeDefined();
  });

  test("function with loop can use non-local variable", () => {
    const program = compilePython(`
bonus = 5

def f(xs):
    total = 0
    for x in xs:
        total = total + x + bonus
    return total

f([1, 2, 3])
`);

    console.log("=== FUNCTION LOOP WITH NON-LOCAL ===");
    console.dir(program, { depth: null });

    if ((program as any).functions) {
      console.log("=== FUNCTIONS ===");
      (program as any).functions.forEach((fn: any, i: number) => {
        console.log("FUNCTION", i);
        console.dir(fn, { depth: null });
      });
    }

    expect(program).toBeDefined();
  });

});