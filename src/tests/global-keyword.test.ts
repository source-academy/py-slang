import { FeatureNotSupportedError } from "../validator";
import { generateTestCases, toPythonAstAndResolve } from "./utils";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import list from "../stdlib/list";
import linkedList from "../stdlib/linked-list";

// ── Resolver: global is rejected in chapters 1 and 2 ────────────────────────

describe("global keyword — validator", () => {
  test("global inside a function is rejected in chapter 1", () => {
    const code = `
def f():
    global x
    x = 1
`;
    expect(() => toPythonAstAndResolve(code, 1)).toThrow(FeatureNotSupportedError);
  });

  test("global inside a function is rejected in chapter 2", () => {
    const code = `
def f():
    global x
    x = 1
`;
    expect(() => toPythonAstAndResolve(code, 2)).toThrow(FeatureNotSupportedError);
  });

  test("global inside a function is accepted in chapter 3", () => {
    const code = `
x = 0
def f():
    global x
    x = 1
`;
    expect(() => toPythonAstAndResolve(code, 3)).not.toThrow();
  });

  test("global inside a function is accepted in chapter 4", () => {
    const code = `
x = 0
def f():
    global x
    x = 1
`;
    expect(() => toPythonAstAndResolve(code, 4)).not.toThrow();
  });

  test("global for a name not yet declared at module level is accepted by resolver", () => {
    // The name is introduced by the global declaration itself; no pre-existing binding required
    const code = `
def f():
    global x
    x = 1
`;
    expect(() => toPythonAstAndResolve(code, 3)).not.toThrow();
  });
});

// ── CSE interpreter: runtime semantics ───────────────────────────────────────

const ch3 = [misc, math, linkedList, list];

generateTestCases(
  {
    "global keyword — basic write": [
      [
        `
x = 0
def f():
    global x
    x = 42
f()
x
`,
        42n,
        null,
      ],
    ],

    "global keyword — read before local assignment": [
      [
        `
x = 99
def f():
    global x
    x
f()
x
`,
        99n,
        null,
      ],
    ],

    "global keyword — write then read at module level": [
      [
        `
x = 1
def increment():
    global x
    x = x + 1
increment()
increment()
increment()
x
`,
        4n,
        null,
      ],
    ],

    "global keyword — does not affect local of same name in other function": [
      [
        `
x = 10
def uses_global():
    global x
    x = 20
def uses_local():
    x = 99
uses_global()
uses_local()
x
`,
        20n,
        null,
      ],
    ],

    "global keyword — nested function: global skips enclosing scope": [
      [
        `
x = 1
def outer():
    x = 100
    def inner():
        global x
        x = 2
    inner()
outer()
x
`,
        2n,
        null,
      ],
    ],

    "global keyword — declared in if branch inside function": [
      [
        `
x = 0
def f():
    global x
    if True:
        x = 7
f()
x
`,
        7n,
        null,
      ],
    ],

    "global keyword — global name created by function (not pre-existing)": [
      [
        `
def f():
    global y
    y = 55
f()
y
`,
        55n,
        null,
      ],
    ],

    "global keyword — print output uses global value": [
      [
        `
count = 0
def bump():
    global count
    count = count + 1
bump()
bump()
print(count)
`,
        null,
        ["2"],
      ],
    ],
  },
  3,
  ch3,
);
