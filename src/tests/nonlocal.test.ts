import math from "../stdlib/math";
import misc from "../stdlib/misc";
import list from "../stdlib/list";
import linkedList from "../stdlib/linked-list";
import { generateTestCases, toPythonAstAndResolve } from "./utils";
import { FeatureNotSupportedError } from "../validator";

// ── Issue #177: nonlocal keyword — resolver acceptance ───────────────────────

describe("nonlocal keyword — resolver acceptance", () => {
  test("nonlocal is rejected in chapter 1", () => {
    const code = `
def outer():
    x = 1
    def inner():
        nonlocal x
        x = 2
    inner()
`;
    expect(() => toPythonAstAndResolve(code, 1)).toThrow(FeatureNotSupportedError);
  });

  test("nonlocal is rejected in chapter 2", () => {
    const code = `
def outer():
    x = 1
    def inner():
        nonlocal x
        x = 2
    inner()
`;
    expect(() => toPythonAstAndResolve(code, 2)).toThrow(FeatureNotSupportedError);
  });

  test("nonlocal is accepted in chapter 3", () => {
    const code = `
def outer():
    x = 1
    def inner():
        nonlocal x
        x = 2
    inner()
`;
    expect(() => toPythonAstAndResolve(code, 3)).not.toThrow();
  });

  test("nonlocal is accepted in chapter 4", () => {
    const code = `
def outer():
    x = 1
    def inner():
        nonlocal x
        x = 2
    inner()
`;
    expect(() => toPythonAstAndResolve(code, 4)).not.toThrow();
  });
});

// ── Issue #177: nonlocal keyword — runtime semantics ─────────────────────────

const ch3 = [misc, math, linkedList, list];

generateTestCases(
  {
    "nonlocal — basic write modifies enclosing scope": [
      [
        `
def outer():
    x = 1
    def inner():
        nonlocal x
        x = 42
    inner()
    return x
outer()
`,
        42n,
        null,
      ],
    ],

    "nonlocal — read from enclosing scope": [
      [
        `
def outer():
    x = 99
    def inner():
        nonlocal x
        x
    inner()
    return x
outer()
`,
        99n,
        null,
      ],
    ],

    "nonlocal — write then read at enclosing scope": [
      [
        `
def outer():
    x = 0
    def increment():
        nonlocal x
        x = x + 1
    increment()
    increment()
    increment()
    return x
outer()
`,
        3n,
        null,
      ],
    ],

    "nonlocal — returned closure captures modified nonlocal": [
      [
        `
def make_counter():
    count = 0
    def inc():
        nonlocal count
        count = count + 1
        return count
    return inc
result = make_counter()
result()
result()
result()
`,
        3n,
        null,
      ],
    ],

    "nonlocal — three levels of nesting": [
      [
        `
def a():
    x = 1
    def b():
        nonlocal x
        x = 2
        def c():
            nonlocal x
            x = 3
        c()
    b()
    return x
a()
`,
        3n,
        null,
      ],
    ],

    "nonlocal — does not affect global scope": [
      [
        `
x = 100
def outer():
    x = 10
    def inner():
        nonlocal x
        x = 20
    inner()
    return x
outer()
x
`,
        100n,
        null,
      ],
    ],

    "nonlocal — skips intermediate scopes without the binding": [
      [
        `
def a():
    x = 1
    def b():
        def c():
            nonlocal x
            x = 99
        c()
    b()
    return x
a()
`,
        99n,
        null,
      ],
    ],

    "nonlocal — print uses modified value": [
      [
        `
def outer():
    val = 0
    def set_val(v):
        nonlocal val
        val = v
    set_val(7)
    print(val)
outer()
`,
        null,
        ["7"],
      ],
    ],

    "nonlocal — global and nonlocal in different nested functions": [
      [
        `
g = 0
def outer():
    x = 10
    def write_global():
        global g
        g = 5
    def write_nonlocal():
        nonlocal x
        x = 20
    write_global()
    write_nonlocal()
    return x
outer()
`,
        20n,
        null,
      ],
    ],
  },
  3,
  ch3,
);

// ── Issues #178–#181: scope conflict validators ───────────────────────────────
// These are always SyntaxErrors regardless of chapter; tested with chapter 3.

describe("scope conflicts — same name global and nonlocal (#178)", () => {
  test("nonlocal and global on the same name is a SyntaxError (ch 3)", () => {
    const code = `
def outer():
    x = 1
    def inner():
        nonlocal x
        global x
    inner()
`;
    expect(() => toPythonAstAndResolve(code, 3)).toThrow(SyntaxError);
  });

  test("error message says 'nonlocal and global' (#178)", () => {
    const code = `
def outer():
    x = 1
    def inner():
        nonlocal x
        global x
    inner()
`;
    expect(() => toPythonAstAndResolve(code, 3)).toThrow(/nonlocal and global/);
  });

  test("global and nonlocal on the same name is a SyntaxError (order reversed, ch 4)", () => {
    const code = `
def outer():
    x = 1
    def inner():
        global x
        nonlocal x
    inner()
`;
    expect(() => toPythonAstAndResolve(code, 4)).toThrow(SyntaxError);
  });
});

describe("scope conflicts — parameter and nonlocal (#179)", () => {
  test("function parameter also declared nonlocal is a SyntaxError (ch 3)", () => {
    const code = `
def outer():
    x = 1
    def inner(x):
        nonlocal x
    inner(5)
`;
    expect(() => toPythonAstAndResolve(code, 3)).toThrow(SyntaxError);
  });

  test("error message says 'parameter and nonlocal' (#179)", () => {
    const code = `
def outer():
    x = 1
    def inner(x):
        nonlocal x
    inner(5)
`;
    expect(() => toPythonAstAndResolve(code, 3)).toThrow(/parameter and nonlocal/);
  });

  test("error on ch 4 too (#179)", () => {
    const code = `
def outer():
    x = 1
    def inner(x):
        nonlocal x
    inner(5)
`;
    expect(() => toPythonAstAndResolve(code, 4)).toThrow(SyntaxError);
  });
});

describe("scope conflicts — parameter and global (#180)", () => {
  test("function parameter also declared global is a SyntaxError (ch 3)", () => {
    const code = `
def f(x):
    global x
    x = 1
`;
    expect(() => toPythonAstAndResolve(code, 3)).toThrow(SyntaxError);
  });

  test("error message says 'parameter and global' (#180)", () => {
    const code = `
def f(x):
    global x
    x = 1
`;
    expect(() => toPythonAstAndResolve(code, 3)).toThrow(/parameter and global/);
  });

  test("error on ch 4 too (#180)", () => {
    const code = `
def f(x):
    global x
`;
    expect(() => toPythonAstAndResolve(code, 4)).toThrow(SyntaxError);
  });
});

describe("scope conflicts — textual order (#181)", () => {
  test("assignment before global declaration is a SyntaxError (ch 3)", () => {
    const code = `
def f():
    x = 1
    global x
`;
    expect(() => toPythonAstAndResolve(code, 3)).toThrow(SyntaxError);
  });

  test("error message says 'assigned to before global declaration' (#181)", () => {
    const code = `
def f():
    x = 1
    global x
`;
    expect(() => toPythonAstAndResolve(code, 3)).toThrow(/assigned to before global declaration/);
  });

  test("use before global declaration is a SyntaxError (#181)", () => {
    const code = `
def f():
    print(x)
    global x
`;
    expect(() => toPythonAstAndResolve(code, 3)).toThrow(SyntaxError);
  });

  test("error message says 'used prior to global declaration' (#181)", () => {
    const code = `
def f():
    print(x)
    global x
`;
    expect(() => toPythonAstAndResolve(code, 3)).toThrow(/used prior to global declaration/);
  });

  test("assignment before nonlocal declaration is a SyntaxError (#181)", () => {
    const code = `
def outer():
    x = 0
    def inner():
        x = 1
        nonlocal x
    inner()
`;
    expect(() => toPythonAstAndResolve(code, 3)).toThrow(SyntaxError);
  });

  test("error message says 'assigned to before nonlocal declaration' (#181)", () => {
    const code = `
def outer():
    x = 0
    def inner():
        x = 1
        nonlocal x
    inner()
`;
    expect(() => toPythonAstAndResolve(code, 3)).toThrow(/assigned to before nonlocal declaration/);
  });

  test("use before nonlocal declaration is a SyntaxError (#181)", () => {
    const code = `
def outer():
    x = 0
    def inner():
        print(x)
        nonlocal x
    inner()
`;
    expect(() => toPythonAstAndResolve(code, 3)).toThrow(SyntaxError);
  });

  test("error message says 'used prior to nonlocal declaration' (#181)", () => {
    const code = `
def outer():
    x = 0
    def inner():
        print(x)
        nonlocal x
    inner()
`;
    expect(() => toPythonAstAndResolve(code, 3)).toThrow(/used prior to nonlocal declaration/);
  });

  test("assignment inside if block before global is a SyntaxError (#181)", () => {
    const code = `
def f():
    if True:
        x = 1
    global x
`;
    expect(() => toPythonAstAndResolve(code, 3)).toThrow(SyntaxError);
  });

  test("global before assignment is valid — no error (#181)", () => {
    const code = `
x = 0
def f():
    global x
    x = 1
`;
    expect(() => toPythonAstAndResolve(code, 3)).not.toThrow();
  });

  test("nonlocal before assignment is valid — no error (#181)", () => {
    const code = `
def outer():
    x = 0
    def inner():
        nonlocal x
        x = 1
    inner()
`;
    expect(() => toPythonAstAndResolve(code, 3)).not.toThrow();
  });

  test("ch 4 also catches textual order violations (#181)", () => {
    const code = `
def f():
    x = 1
    global x
`;
    expect(() => toPythonAstAndResolve(code, 4)).toThrow(SyntaxError);
  });
});
