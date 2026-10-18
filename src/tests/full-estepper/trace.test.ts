/**
 * The trace of the full e-stepper: what it explains, the frames and heap objects it shows, and the
 * errors that stop it; and the constructs that it does not support yet.
 */

import { evaluate, formatTrace, runFullEStepper } from "../../conductor/full-estepper/run";

const explanations = (code: string): string[] =>
  runFullEStepper(code).steps.map(s => s.explanation);

describe("the shape of a trace", () => {
  test("step 0 is the start; every contraction adds the step before it and the step after it", () => {
    const trace = runFullEStepper("x = 1 + 2\nprint(x)\n");
    const steps = trace.steps.map(s => s.explanation);
    expect(steps[0]).toBe("Start of evaluation");
    expect(steps[steps.length - 1]).toBe("Evaluation complete");
    expect((steps.length - 2) % 2).toBe(0);
    // each pair: the present continuous, then the past tense
    expect(steps.slice(1, 5)).toEqual([
      "Evaluating 1 + 2",
      "Evaluated 1 + 2: 3",
      "Assigning x = 3",
      "Assigned x = 3 in the global frame",
    ]);
  });

  test("the program shrinks as it is evaluated", () => {
    const trace = runFullEStepper("x = 1 + 2\nprint(x)\n");
    expect(trace.steps.map(s => s.program)).toEqual([
      "x = 1 + 2; print(x)",
      "x = 1 + 2; print(x)",
      "x = 3; print(x)",
      "x = 3; print(x)",
      "print(x)",
      "print(x)",
      "print(3)",
      "print(3)",
      "",
      "",
    ]);
  });

  test("what the program prints is in the trace", () => {
    const trace = runFullEStepper("print(1)\nprint('two', 3)\n");
    expect(trace.output).toBe("1\ntwo 3\n");
    expect(trace.error).toBeNull();
    expect(trace.truncated).toBe(false);
  });

  test("the step limit stops the program", () => {
    const trace = runFullEStepper("while True:\n    pass\n", 50);
    expect(trace.truncated).toBe(true);
    expect(trace.steps).toHaveLength(1 + 2 * 50);
    expect(evaluate("while True:\n    pass\n", 100).truncated).toBe(true);
  });

  test("a trace has a text form", () => {
    const text = formatTrace(runFullEStepper("x = 1\n"));
    expect(text).toContain("0: Start of evaluation");
    expect(text).toContain("Assigned x = 1 in the global frame");
    expect(text).toContain("Global: x = 1");
  });
});

describe("explanations", () => {
  test("every name is looked up in a step of its own, left to right", () => {
    expect(explanations("a = 1\nb = 2\nc = a + b\n").slice(5)).toEqual([
      "Looking up a",
      "Looked up a in the global frame: 1",
      "Looking up b",
      "Looked up b in the global frame: 2",
      "Evaluating 1 + 2",
      "Evaluated 1 + 2: 3",
      "Assigning c = 3",
      "Assigned c = 3 in the global frame",
      "Evaluation complete",
    ]);
  });

  test("the names of built-ins are looked up in the step that uses them", () => {
    expect(explanations("print(1)\n")).toEqual([
      "Start of evaluation",
      "Calling print(1)",
      "Called print(1): None",
      "Evaluation complete",
    ]);
  });

  test("a while loop unfolds into the textbook's if statement", () => {
    const steps = explanations("i = 0\nwhile i < 1:\n    i += 1\n");
    expect(steps).toContain("Unfolding the while loop");
    expect(steps).toContain(
      "Unfolded the while loop into an if statement whose body ends with the loop",
    );
    expect(steps).toContain("Evaluated if statement: condition is True, run the loop body");
    expect(steps).toContain("Finished the loop body, back to the loop");
    expect(steps).toContain("Evaluated if statement: condition is False, the loop ends");
    // the loop stays in the program, in full, while its test is evaluated
    const unfolded = runFullEStepper("i = 0\nwhile i < 1:\n    i += 1\n").steps.find(s =>
      s.explanation.startsWith("Unfolded"),
    );
    expect(unfolded?.program).toBe("if i < 1: { i += 1; while i < 1: { i += 1 } }");
  });

  test("a for loop takes one element at a time", () => {
    const steps = explanations("for x in [10, 20]:\n    pass\n");
    expect(steps).toContain("Evaluated for statement: run the body with x = 10");
    expect(steps).toContain("Evaluated for statement: run the body with x = 20");
    expect(steps).toContain("Evaluated for statement: #1 has no more elements, the loop ends");
  });

  test("break and continue", () => {
    const steps = explanations("for i in range(3):\n    if i == 0:\n        continue\n    break\n");
    expect(steps).toContain("Evaluated continue: back to the loop");
    expect(steps).toContain("Evaluated break: the loop ends");
  });

  test("and, or and conditional expressions say what decided", () => {
    expect(explanations("x = 0 and 1\n")).toContain("Evaluated 0 and 1: the left operand decides");
    expect(explanations("x = 1 and 2\n")).toContain(
      "Evaluated 1 and 2: continue with the right operand",
    );
    expect(explanations("x = 1 if 0 else 2\n")).toContain(
      "Evaluated conditional expression: condition is 0 counts as False",
    );
    expect(explanations("x = 1 if [] else 2\n")).toContain(
      "Evaluated conditional expression: condition is list #1 counts as False",
    );
    expect(explanations("x = 1 if True else 2\n")).toContain(
      "Evaluated conditional expression: condition is True",
    );
  });

  test("a value that is not a bool is called true or false in an if statement", () => {
    expect(explanations("if 'x':\n    pass\n")).toContain(
      "Evaluated if statement: condition is 'x' counts as True",
    );
  });
});

describe("calls, frames and the heap: make_withdraw", () => {
  const code = [
    "def make_withdraw(balance):",
    "    def withdraw(amount):",
    "        nonlocal balance",
    "        if balance >= amount:",
    "            balance = balance - amount",
    "            return balance",
    "        else:",
    "            return 'Insufficient funds'",
    "    return withdraw",
    "",
    "W1 = make_withdraw(100)",
    "print(W1(50))",
    "",
  ].join("\n");
  const trace = runFullEStepper(code);
  const at = (explanation: string) => {
    const step = trace.steps.find(s => s.explanation === explanation);
    if (!step) throw new Error(`no step "${explanation}"`);
    return step;
  };

  test("the program prints the new balance", () => {
    expect(trace.output).toBe("50\n");
    expect(trace.error).toBeNull();
  });

  test("a def creates a function object in the frame that runs it", () => {
    expect(at("Defined make_withdraw: function object #1 in the global environment")).toBeDefined();
    expect(at("Defined withdraw: function object #2 in environment E1")).toBeDefined();
  });

  test("a call creates a frame that extends the frame of the definition", () => {
    const first = at(
      "Called make_withdraw(100): new environment E1, whose enclosing environment is the global environment",
    );
    expect(first.program).toContain("W1 = ⟦E1: ");
    expect(first.frames.map(f => [f.label, f.parent])).toEqual([
      ["Global", null],
      ["E1", "Global"],
    ]);
    // the locals of the frame are there from the start, unassigned
    expect(first.frames[1].bindings).toEqual([
      { name: "balance", value: "100" },
      { name: "withdraw", value: "unassigned" },
    ]);

    // the call of W1: its frame extends E1 (where withdraw was defined), not the global frame
    const second = at("Called withdraw(50): new environment E2, whose enclosing environment is E1");
    expect(second.frames.map(f => [f.label, f.parent])).toEqual([
      ["Global", null],
      ["E1", "Global"],
      ["E2", "E1"],
    ]);
    // nonlocal balance: the frame of the call has no balance of its own
    expect(second.frames[2].bindings).toEqual([{ name: "amount", value: "50" }]);
  });

  test("a nonlocal assignment changes the enclosing frame", () => {
    const step = at("Assigned balance = 50 in frame E1");
    expect(step.frames[1].bindings[0]).toEqual({ name: "balance", value: "50" });
  });

  test("lookups say where the name was found", () => {
    expect(at("Looked up balance in frame E1: 100")).toBeDefined();
    expect(at("Looked up amount in frame E2: 50")).toBeDefined();
    expect(at("Looked up W1 in the global frame: function object #2")).toBeDefined();
  });

  test("bindings show function objects by their label", () => {
    const last = trace.steps[trace.steps.length - 1];
    const global = last.frames[0].bindings;
    expect(global).toEqual([
      { name: "make_withdraw", value: "#1" },
      { name: "W1", value: "#2" },
    ]);
    expect(last.objects.map(o => [o.label, o.text])).toEqual([
      ["#1", "def make_withdraw(balance)"],
      ["#2", "def withdraw(amount)"],
    ]);
  });

  test("a return replaces the call by its value", () => {
    expect(at("Returned withdraw from E1").program).toContain("W1 = withdraw");
  });
});

describe("frames without bindings are not drawn", () => {
  test("the body of a function that has no parameters and no locals runs in the frame it extends", () => {
    const trace = runFullEStepper("def f():\n    return 1\nx = f()\n");
    const call = trace.steps.find(s => s.explanation.startsWith("Called f()"));
    expect(call?.explanation).toBe(
      "Called f(): the new frame would have no bindings, so the body runs in the global environment",
    );
    expect(call?.frames.map(f => f.label)).toEqual(["Global"]);
    expect(call?.program).toBe("x = ⟦Global: return 1⟧");
  });

  test("frames are numbered in the order in which a drawn frame is created, with no gaps", () => {
    const trace = runFullEStepper(
      "def f():\n    return 1\ndef g(a):\n    return a\nprint(f(), g(1), f(), g(2))\n",
    );
    const labels = new Set(trace.steps.flatMap(s => s.frames.map(f => f.label)));
    expect([...labels].sort()).toEqual(["E1", "E2", "Global"]);
  });
});

describe("errors", () => {
  test("an error stops the trace at the program that raised it", () => {
    const trace = runFullEStepper("print(1)\nprint(1 / 0)\nprint(2)\n");
    expect(trace.error).toEqual({ kind: "ZeroDivisionError", message: "division by zero" });
    expect(trace.output).toBe("1\n");
    const last = trace.steps[trace.steps.length - 1];
    expect(last.explanation).toBe("ZeroDivisionError: division by zero");
    expect(last.program).toBe("print(1 / 0); print(2)");
  });

  test("a syntax error stops before anything runs", () => {
    const trace = runFullEStepper("print(1)\nx = \n");
    expect(trace.steps).toHaveLength(0);
    expect(trace.error?.kind).toBe("SyntaxError");
  });

  test("return outside a function is reported before anything runs, as CPython does", () => {
    const trace = runFullEStepper("print(1)\nreturn 2\n");
    expect(trace.steps).toHaveLength(0);
    expect(trace.output).toBe("");
    expect(trace.error).toEqual({ kind: "SyntaxError", message: "'return' outside function" });
  });

  test("a local is unassigned until its assignment", () => {
    const trace = runFullEStepper("x = 1\ndef f():\n    print(x)\n    x = 2\nf()\n");
    expect(trace.error?.kind).toBe("UnboundLocalError");
    const call = trace.steps.find(s => s.explanation.startsWith("Called f()"));
    expect(call?.frames[1].bindings).toEqual([{ name: "x", value: "unassigned" }]);
  });

  test("the depth of calls is limited, as in CPython", () => {
    const result = evaluate("def f(n):\n    return f(n + 1)\nf(0)\n");
    expect(result.error?.kind).toBe("RecursionError");
  });

  test("there is no tail call elimination: Python has none", () => {
    // 1100 nested tail calls: a recursion error in CPython, and here
    const result = evaluate("def f(n):\n    return 0 if n == 0 else f(n - 1)\nf(1100)\n");
    expect(result.error?.kind).toBe("RecursionError");
  });
});

describe("what is not supported yet", () => {
  test.each<[string, string, string]>([
    ["x = (1, 2)", "tuples", "a tuple"],
    ["x = {1: 2}", "dictionaries", "a dictionary"],
    ["x = {1, 2}", "set displays", "a set"],
    ["a, b = 1, 2", "assignment to several names", "tuple assignment"],
    ["def f(a, b=1):\n    pass", "default values of parameters", "a default value"],
    ["def f(*args):\n    pass", "*args parameters", "*args"],
    ["def f(**kw):\n    pass", "**kwargs parameters", "**kwargs"],
    ["g = lambda x=1: x", "default values of parameters", "a default value of a lambda"],
    ["def f(a):\n    pass\nf(a=1)", "keyword arguments", "a keyword argument"],
    ["def f(a):\n    pass\nf(*[1])", "unpacking with *", "an unpacked argument"],
    ["x = [1, 2]\nx[0:1]", "slices", "a slice"],
    ["x = [1]\nx[0:1] = [2]", "slices", "a slice assignment"],
    ["x = [*[1], 2]", "unpacking with *", "an unpacked list element"],
    ["1 < 2 < 3", "chained comparisons", "a chained comparison"],
    ["x = [i for i in [1]]", "comprehensions", "a comprehension"],
    ["x = 1j", "complex numbers", "a complex number"],
    ["x = [].append", "attribute access", "an attribute"],
    ["class A:\n    pass", "classes", "a class"],
    ["try:\n    pass\nexcept:\n    pass", "try statements", "try"],
    ["with a as b:\n    pass", "with statements", "with"],
    ["import m", "import statements", "import"],
    ["assert True", "assert statements", "assert"],
    ["del x", "del statements", "del"],
    ["for a, b in [1]:\n    pass", "unpacking in for loops", "for with unpacking"],
    ["(-8) ** 0.5", "complex numbers", "a complex result"],
    ["x = 'a %s' % 1", "formatting a string with %", "% formatting"],
    ["x = 1 << 2", "the operator <<", "a shift"],
  ])("%s", (code, feature) => {
    const result = evaluate(`${code}\n`);
    expect(result.error?.kind).toBe("NotImplementedError");
    expect(result.error?.message).toContain(feature);
  });

  test("an unsupported construct stops the program only when it is reached", () => {
    const result = evaluate("print('before')\nx = (1, 2)\nprint('after')\n");
    expect(result.output).toBe("before\n");
    expect(result.error?.kind).toBe("NotImplementedError");
    expect(evaluate("if False:\n    x = (1, 2)\nprint('fine')\n")).toMatchObject({
      output: "fine\n",
      error: null,
    });
  });
});

describe("long values in a trace", () => {
  test("a string of more than 200 characters is shortened, and print still writes all of it", () => {
    const trace = runFullEStepper("s = 'x' * 1000\nprint(len(s))\ns\n", 1000);
    const text = JSON.stringify(trace.steps);
    expect(text).not.toContain("x".repeat(300));
    expect(text).toContain("1000 characters");
    expect(trace.output).toBe("1000\n");
    expect(evaluate("print('x' * 300)", 100).output).toBe(`${"x".repeat(300)}\n`);
  });

  test("a string of 200 characters is shown in full", () => {
    const trace = runFullEStepper("s = 'y' * 200\ns\n", 1000);
    expect(JSON.stringify(trace.steps)).toContain("y".repeat(200));
  });
});
