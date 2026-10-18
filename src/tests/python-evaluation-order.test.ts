/**
 * Evaluation order and the scope of `global` (py-slang#580): the same results as CPython's. In
 * `obj()[idx()] = rhs()` Python evaluates the right-hand side first, then the list, then the index;
 * a name that an enclosing function declares `global` is the module's name for the functions nested
 * in it too. CPython's answers are computed with `python3`; the tests skip themselves without it.
 *
 * PVML and wasm are not covered: their bytecode and code generator fix the order of the operands of
 * a list assignment (the native Pynter implements the same bytecode), and wasm has no `global` in
 * nested functions yet (#488).
 */
import { spawnSync } from "child_process";
import { runEStepper } from "../conductor/estepper/getSteps";
import { runCodePy2Js } from "../engines/py2js";
import { parse } from "../parser";
import { runCode } from "../runner";

const python = spawnSync("python3", ["--version"]).status === 0;
const describeIfPython = python ? describe : describe.skip;

const PROGRAMS: [string, string][] = [
  [
    "a list assignment evaluates the right-hand side first",
    `lst = [0, 1, 2]
def obj():
    print('obj')
    return lst
def idx():
    print('idx')
    return 0
def rhs():
    print('rhs')
    return 5
obj()[idx()] = rhs()
print(lst)
`,
  ],
  [
    "the right-hand side sees the list and the index as they were before it ran",
    `lst = [0, 1, 2]
i = 0
def rhs():
    global i
    i = 2
    return 9
lst[i] = rhs()
print(lst)
`,
  ],
  [
    "the right-hand side may change the list that is assigned to",
    `lst = [0, 1, 2]
def get():
    global lst
    lst = [7, 8, 9]
    return 5
lst[0] = get()
print(lst)
`,
  ],
  [
    "a name declared global in an enclosing function is global in the nested function",
    `x = 'module'
def outer():
    x = 'outer'
    def middle():
        global x
        def inner():
            return x
        return inner()
    return middle()
print(outer())
`,
  ],
  [
    "...also in a lambda",
    `x = 'module'
def outer():
    x = 'outer'
    def middle():
        global x
        return (lambda: x)()
    return middle()
print(outer())
`,
  ],
  [
    "...unless a function in between binds the name",
    `x = 'module'
def outer():
    global x
    def middle():
        x = 'middle'
        def inner():
            return x
        return inner()
    return middle()
print(outer())
`,
  ],
  [
    "...and a nested function that assigns the name has its own",
    `x = 'module'
def outer():
    global x
    def inner():
        x = 'inner'
        return x
    return inner() + x
print(outer())
`,
  ],
];

function cpython(code: string): string {
  return spawnSync("python3", ["-I", "-c", code], { encoding: "utf8" }).stdout;
}

describeIfPython("evaluation order and scoping", () => {
  describe.each(PROGRAMS)("%s", (_, code) => {
    const expected = cpython(code);
    test("cse", async () => {
      expect(await runCode(code, 4)).toBe(expected);
    });
    test("py2js", () => {
      expect(runCodePy2Js(code, 4).output).toBe(expected);
    });
    test("estepper", async () => {
      const run = await runEStepper(parse(code), code, 4);
      expect(run.output).toBe(expected);
    });
  });
});
