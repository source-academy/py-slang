import math from "../stdlib/math";
import misc from "../stdlib/misc";
import list from "../stdlib/list";
import linkedList from "../stdlib/linked-list";
import { generateTestCases, toPythonAstAndResolve } from "./utils";
import { FeatureNotSupportedError } from "../validator";
import { FreeVariableUnboundError, UnboundLocalError } from "../errors/errors";

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

    "nonlocal — binding via if-nested assignment after the nested def resolves at runtime": [
      [
        `
def outer():
    def inner():
        nonlocal x
        x = 1
    inner()
    if True:
        x = 99
    return x
outer()
`,
        99n,
        null,
      ],
    ],

    "nonlocal — binding via for-loop target after the nested def resolves at runtime": [
      [
        `
def outer():
    def inner():
        nonlocal x
        x = 1
    inner()
    for x in range(1):
        pass
    return x
outer()
`,
        0n,
        null,
      ],
    ],

    "nonlocal — write via nested function whose only outer binding is a for-loop target": [
      [
        `
def outer():
    def inner():
        nonlocal i
        i = 5
    inner()
    for i in range(3):
        pass
    return i
outer()
`,
        2n,
        null,
      ],
    ],

    "for-loop target alone (no other assignment) shadows an outer variable of the same name": [
      [
        `
i = 100
def f():
    for i in range(3):
        pass
    return i
result_inside = f()
result_outside = i
[result_inside, result_outside]
`,
        [2n, 100n],
        null,
      ],
    ],

    "reading a for-loop target before the loop runs raises UnboundLocalError, not an outer lookup":
      [
        [
          `
i = 100
def f():
    print(i)
    for i in range(3):
        pass
f()
`,
          UnboundLocalError,
          null,
        ],
      ],

    "reading a nonlocal before its for-loop-target binding executes raises FreeVariableUnboundError, not UnboundLocalError":
      [
        [
          `
def outer():
    def inner():
        nonlocal i
        print(i)
        i = 5
    inner()
    for i in range(3):
        pass
    return i
outer()
`,
          FreeVariableUnboundError,
          null,
        ],
      ],

    "when the for-loop runs before inner() is called (textually earlier in outer), i is already bound — no error":
      [
        [
          `
def outer():
    def inner():
        nonlocal i
        print(i)
        i = 5
    for i in range(3):
        pass
    inner()
    return i
outer()
`,
          5n,
          ["2"],
        ],
      ],

    "nonlocal can target a directly-enclosing function's parameter (not just an assigned/for-target local)":
      [
        [
          `
def outer(x):
    def inner():
        nonlocal x
        x = 100
    inner()
    return x
outer(1)
`,
          100n,
          null,
        ],
      ],

    "nonlocal can target a parameter of a function further out, skipping an unrelated intermediate function":
      [
        [
          `
def grandouter(x):
    def outer():
        def inner():
            nonlocal x
            x = 100
        inner()
    outer()
    return x
grandouter(1)
`,
          100n,
          null,
        ],
      ],

    "implicit (non-nonlocal) closure read of an enclosing local raises FreeVariableUnboundError when read before that scope's own def executes":
      [
        [
          `
def outer():
    def inner():
        return helper()
    result = inner()
    def helper():
        return 42
    return result
outer()
`,
          FreeVariableUnboundError,
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

// global / nonlocal / parameter must be mutually distinct sets (per-name), not just
// checked pairwise at the top level of the function body.
describe("scope conflicts — global/nonlocal/parameter are mutually distinct sets", () => {
  test("name that is simultaneously parameter, global and nonlocal is rejected (#178)", () => {
    const code = `
def f(x):
    def g():
        nonlocal x
        global x
        x = 1
    g()
`;
    expect(() => toPythonAstAndResolve(code, 3)).toThrow(/nonlocal and global/);
  });

  test("global declared only inside an elif branch still conflicts with a parameter (#180)", () => {
    const code = `
def f(x):
    if True:
        pass
    elif False:
        global x
    else:
        pass
`;
    expect(() => toPythonAstAndResolve(code, 3)).toThrow(/parameter and global/);
  });

  test("nonlocal declared only inside an elif branch still conflicts with a parameter (#179)", () => {
    const code = `
def outer():
    x = 1
    def f(x):
        if True:
            pass
        elif False:
            nonlocal x
    f(1)
`;
    expect(() => toPythonAstAndResolve(code, 3)).toThrow(/parameter and nonlocal/);
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

// `nonlocal x` must resolve against the enclosing function's *whole* body (any binding
// construct anywhere in it), not just names seen so far in textual-order resolution.
describe("nonlocal — binding construct can appear anywhere in the enclosing function", () => {
  test("binding via assignment nested in an if-block, after the nested def", () => {
    const code = `
def outer():
    def inner():
        nonlocal x
        x = 1
    inner()
    if True:
        x = 99
    return x
outer()
`;
    expect(() => toPythonAstAndResolve(code, 3)).not.toThrow();
  });

  test("binding via a for-loop target, after the nested def", () => {
    const code = `
def outer():
    def inner():
        nonlocal x
        x = 1
    inner()
    for x in range(1):
        pass
outer()
`;
    expect(() => toPythonAstAndResolve(code, 3)).not.toThrow();
  });

  test("binding via a direct assignment statement that comes after the nested def", () => {
    const code = `
def outer():
    def inner():
        nonlocal x
        x = 1
    inner()
    x = 5
outer()
`;
    expect(() => toPythonAstAndResolve(code, 3)).not.toThrow();
  });

  test("nonlocal skips an intermediate function that doesn't mention the name at all", () => {
    const code = `
def grandouter():
    x = 1
    def outer():
        def inner():
            nonlocal x
            x = 2
        inner()
        return x
    return outer()
grandouter()
`;
    expect(() => toPythonAstAndResolve(code, 3)).not.toThrow();
  });

  test("nonlocal chains through an intermediate function that also declares it nonlocal", () => {
    const code = `
def grandouter():
    x = 1
    def outer():
        nonlocal x
        def inner():
            nonlocal x
            x = 2
        inner()
        return x
    return outer()
grandouter()
`;
    expect(() => toPythonAstAndResolve(code, 3)).not.toThrow();
  });

  test("nonlocal cannot skip past an intermediate function that declares the name global", () => {
    const code = `
def grandouter():
    x = 1
    def outer():
        global x
        x = 99
        def inner():
            nonlocal x
            x = 2
        inner()
    outer()
grandouter()
`;
    expect(() => toPythonAstAndResolve(code, 3)).toThrow(SyntaxError);
  });

  test("nonlocal with no binding construct anywhere in any enclosing function is still rejected", () => {
    const code = `
def outer():
    def inner():
        nonlocal x
        x = 1
    inner()
outer()
`;
    expect(() => toPythonAstAndResolve(code, 3)).toThrow(SyntaxError);
  });
});
