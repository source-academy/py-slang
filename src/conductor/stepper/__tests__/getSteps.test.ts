import { expressionStatement, identifier } from "../ast";
import { isBuiltinConstantName } from "../builtins";
import { parse } from "../../../parser";
import { evaluatePython, getPythonSteps } from "../getSteps";
import { preprocessPython } from "../preprocess";

// `chapter` defaults to 2 so the existing §2 (list-library) tests resolve those names; the
// chapter-gating tests pass an explicit chapter (1 to forbid §2 names, 2 to allow them).
function preprocess(src: string, chapter = 2) {
  const script = src + "\n";
  return preprocessPython(parse(script), script, chapter);
}

function steps(src: string) {
  return getPythonSteps(parse(src + "\n"));
}

function result(src: string) {
  return evaluatePython(parse(src + "\n"));
}

function explanations(src: string) {
  return steps(src).map(s => s.markers?.[0]?.explanation ?? "");
}

/** Collect every nodeId present in a serialized step's AST. */
function nodeIds(ast: unknown): Set<string> {
  const ids = new Set<string>();
  (function walk(value: any) {
    if (value && typeof value === "object") {
      if (typeof value.nodeId === "string") ids.add(value.nodeId);
      for (const key of Object.keys(value)) walk(value[key]);
    }
  })(ast);
  return ids;
}

/** First node in a serialized step's AST (depth-first) for which `pred` holds. */
function findNode(ast: unknown, pred: (node: any) => boolean): any {
  let found: any;
  (function walk(value: any) {
    if (found !== undefined || !value || typeof value !== "object") return;
    if (typeof value.type === "string" && pred(value)) {
      found = value;
      return;
    }
    for (const key of Object.keys(value)) walk(value[key]);
  })(ast);
  return found;
}

describe("Python stepper — final values", () => {
  test("arithmetic respects precedence", () => {
    expect(result("1 + 2 * 3")).toBe("7");
  });

  test("true division yields a float repr", () => {
    expect(result("7 / 2")).toBe("3.5");
    expect(result("4 / 2")).toBe("2.0");
  });

  test("floor division and modulo", () => {
    expect(result("7 // 2")).toBe("3");
    expect(result("7 % 3")).toBe("1");
  });

  test("power", () => {
    expect(result("2 ** 10")).toBe("1024");
  });

  test("comparisons produce Python booleans", () => {
    expect(result("1 < 2")).toBe("True");
    expect(result("2 == 3")).toBe("False");
  });

  test("assignment binds by substitution", () => {
    expect(result("x = 5\nx + 1")).toBe("6");
  });

  test("lambda application", () => {
    expect(result("f = lambda x: x + 1\nf(10)")).toBe("11");
  });

  test("function definition application", () => {
    expect(result("def square(n):\n  return n * n\nsquare(4)")).toBe("16");
  });

  test("a multi-statement body with if/else reduces to the taken return", () => {
    const f = "def f(x):\n  if x == 1:\n    return x + 1\n  else:\n    return x + 2\n";
    expect(result(f + "f(2)")).toBe("4");
    expect(result(f + "f(1)")).toBe("2");
  });

  test("a body with a local binding before the return", () => {
    expect(result("def g(x):\n  y = x + 1\n  return y * 2\ng(3)")).toBe("8");
  });

  test("a function that falls off the end evaluates to None", () => {
    expect(result("def noop(x):\n  pass\nnoop(5)")).toBe("None");
  });

  test("a bare `return` yields None", () => {
    expect(result("def early(x):\n  if x > 0:\n    return\n  else:\n    return x\nearly(3)")).toBe(
      "None",
    );
  });

  test("recursion (a function may call itself)", () => {
    const fact = "def fact(n):\n  return 1 if n == 0 else n * fact(n - 1)\n";
    expect(result(fact + "fact(0)")).toBe("1");
    expect(result(fact + "fact(4)")).toBe("24");
    // A recursive call renders as a compact mu-term (carries the function name), not an inline body.
    const recursiveCall = steps(fact + "fact(3)").some(s =>
      findNode(
        s.ast,
        n =>
          n.type === "CallExpression" &&
          n.callee?.type === "FunctionDeclaration" &&
          n.callee.name === "fact",
      ),
    );
    expect(recursiveCall).toBe(true);
  });

  test("ternary selects a branch", () => {
    expect(result("1 if 2 > 1 else 99")).toBe("1");
    expect(result("1 if 2 < 1 else 99")).toBe("99");
  });

  test("if-statement selects a branch and binds", () => {
    expect(result("if 1 < 2:\n  x = 10\nelse:\n  x = 20\nx + 1")).toBe("11");
  });

  test("unary negation and not", () => {
    expect(result("-5 + 2")).toBe("-3");
    expect(result("not (1 < 2)")).toBe("False");
  });
});

describe("Python stepper — short-circuit", () => {
  test("`and` returns the right operand when the left is truthy", () => {
    expect(result("True and (1 < 2)")).toBe("True");
  });

  test("`and` short-circuits on a falsy left without touching the right", () => {
    // `undefined_name` is a free variable; it must never be reduced.
    expect(result("False and undefined_name")).toBe("False");
  });

  test("`or` short-circuits on a truthy left", () => {
    expect(result("True or undefined_name")).toBe("True");
  });
});

describe("Python stepper — built-in functions and constants", () => {
  test("math constants evaluate to their float value", () => {
    expect(result("math_pi")).toBe(String(Math.PI));
    expect(result("math_e")).toBe(String(Math.E));
    expect(result("math_tau")).toBe(String(2 * Math.PI));
    expect(result("math_inf")).toBe("inf");
    expect(result("math_nan")).toBe("nan");
  });

  test("a constant is substituted in before stepping (renders as its value, not the name)", () => {
    expect(result("math_pi * 0")).toBe("0.0");
    // Mirrors js-slang's substitution stepper: the constant is replaced up front, so there is no
    // "math_pi is …" contraction step and the first rendered program already shows the value.
    expect(explanations("math_pi").some(e => e.includes("math_pi is"))).toBe(false);
    const firstAst = steps("math_pi")[0].ast as unknown;
    expect(
      findNode(firstAst, n => n.type === "Identifier" && n.name === "math_pi"),
    ).toBeUndefined();
    expect(findNode(firstAst, n => n.type === "Literal")).toBeDefined();
  });

  test("math functions compute on value arguments", () => {
    expect(result("math_sqrt(16)")).toBe("4.0");
    expect(result("math_floor(3.7)")).toBe("3");
    expect(result("math_ceil(3.2)")).toBe("4");
    expect(result("math_trunc(-3.7)")).toBe("-3");
    expect(result("math_factorial(5)")).toBe("120");
    expect(result("math_gcd(12, 18)")).toBe("6");
    expect(result("math_log(1)")).toBe("0.0");
    expect(result("math_isnan(math_nan)")).toBe("True");
  });

  test('math function call explanation is "<name> runs"', () => {
    expect(explanations("math_sqrt(9)")).toContain("Running math_sqrt");
  });

  test("numeric MISC builtins", () => {
    expect(result("abs(-5)")).toBe("5");
    expect(result("abs(-2.5)")).toBe("2.5");
    expect(result("round(2.5)")).toBe("2"); // banker's rounding
    expect(result("round(3.5)")).toBe("4");
    expect(result("round(3.14159, 2)")).toBe("3.14");
    expect(result("max(1, 7, 3)")).toBe("7");
    expect(result("min(4, 2, 9)")).toBe("2");
    expect(result('len("hello")')).toBe("5");
  });

  test("type conversions", () => {
    expect(result("int(3.9)")).toBe("3");
    expect(result('int("42")')).toBe("42");
    expect(result("float(5)")).toBe("5.0");
    expect(result("str(42)")).toBe("'42'");
    expect(result("bool(0)")).toBe("False");
    expect(result("bool(3)")).toBe("True");
    expect(result('repr("hi")')).toBe("\"'hi'\"");
  });

  test("type predicates", () => {
    expect(result("is_int(5)")).toBe("True");
    expect(result("is_float(5)")).toBe("False");
    expect(result("is_float(5.0)")).toBe("True");
    expect(result('is_string("a")')).toBe("True");
    expect(result("is_boolean(True)")).toBe("True");
    expect(result("is_none(None)")).toBe("True");
    expect(result("is_function(abs)")).toBe("True");
    expect(result("is_function(math_sqrt)")).toBe("True");
    expect(result("is_complex(3)")).toBe("False");
  });

  test("arity reports parameter counts", () => {
    expect(result("arity(lambda x, y: x + y)")).toBe("2");
    expect(result("def f(a, b, c):\n  return a\narity(f)")).toBe("3");
  });

  test("builtins compose with user code and arithmetic", () => {
    expect(result("abs(-3) + math_floor(2.9)")).toBe("5");
    expect(result('len("ab") * 3')).toBe("6");
    expect(result("f = lambda x: abs(x)\nf(-8)")).toBe("8");
  });

  test("print returns None", () => {
    expect(result('print("hi")')).toBe("None");
  });

  test("error() and misuse make evaluation stuck", () => {
    expect(explanations('error("boom")').pop()).toBe("Evaluation stuck");
    expect(explanations('abs("text")').pop()).toBe("Evaluation stuck"); // TypeError
    expect(explanations("math_sqrt(1, 2)").pop()).toBe("Evaluation stuck"); // wrong arity
  });

  test("a bare built-in function name is a value (complete, not stuck)", () => {
    expect(explanations("abs").pop()).toBe("Evaluation complete");
    expect(explanations("math_sqrt").pop()).toBe("Evaluation complete");
  });

  test("unsupported/interactive builtins stay stuck", () => {
    // random_random / time_time / input are intentionally not modelled by the stepper.
    expect(explanations("random_random()").pop()).toBe("Evaluation stuck");
  });
});

describe("Python stepper — undefined variables are a preprocessing error", () => {
  test("an undefined name is reported (and would block the stepper)", () => {
    // Same message the default (CSE) evaluator reports for the same program: the analyzer's own
    // formatted `NameNotFoundError`, not a stepper-specific simplification.
    expect(preprocess("undefined_name")).toBe(
      "NameNotFoundError at line 1\n                   \nundefined_name\n" +
        " ^^^^^^^^^^^^^^ This name is not found in the current or enclosing environment(s).",
    );
    expect(preprocess("undefined_name + 1")).toContain("undefined_name");
  });

  test("bound names, builtins and constants resolve (no error)", () => {
    expect(preprocess("x = 5\nx + 1")).toBeNull();
    expect(preprocess("abs(-5)")).toBeNull();
    expect(preprocess("math_sqrt(2) + math_pi")).toBeNull();
    expect(preprocess("True and None")).toBeNull();
  });

  test("parameters and local bindings are in scope", () => {
    expect(preprocess("def f(n):\n  return n + 1\nf(3)")).toBeNull();
    expect(preprocess("def g(x):\n  y = x + 1\n  return y\ng(2)")).toBeNull();
    expect(preprocess("f = lambda a: a * 2\nf(4)")).toBeNull();
  });

  test("an undefined name inside a function body is caught", () => {
    expect(preprocess("def f(n):\n  return n + missing\nf(1)")).toBe(
      "NameNotFoundError at line 2\n                   \n  return n + missing\n" +
        "              ^^^^^^^ This name is not found in the current or enclosing environment(s).\n" +
        "                      Perhaps you meant to type 'is_int'?",
    );
    expect(preprocess("f = lambda x: x + y")).toBe(
      "NameNotFoundError at line 1\n                   \nf = lambda x: x + y\n" +
        "                   ^ This name is not found in the current or enclosing environment(s).\n" +
        "                     Perhaps you meant to type 'x'?",
    );
  });

  test("a recursive call resolves (the function name is in scope)", () => {
    expect(
      preprocess("def fact(n):\n  return 1 if n == 0 else n * fact(n - 1)\nfact(3)"),
    ).toBeNull();
  });

  test("a name bound only inside an if-branch is in module scope", () => {
    // Python has no block scope, so a name assigned in an if-branch leaks to the enclosing scope.
    expect(preprocess("if True:\n  x = 1\nx + 1")).toBeNull();
  });

  test("the chapter's feature-gates apply (no-reassignment in §1/§2)", () => {
    // Name resolution is delegated to py-slang's analyzer, so the stepper enforces the same per-chapter
    // restrictions as the default evaluator. Assigning the same name in both branches of an if/else is
    // a reassignment (no block scope → both branches share the enclosing scope), which §1/§2 forbid.
    expect(preprocess("if True:\n  x = 1\nelse:\n  x = 2\nx")).toContain("NameReassignmentError");
  });

  test("a name used before its assignment still counts as defined (hoisted scope)", () => {
    // Python module scope is not order-sensitive for *definedness* (this is not a NameError).
    expect(preprocess("y = x\nx = 5")).toBeNull();
  });
});

describe("Python stepper — Python §2 features are unavailable in Python §1 (chapter gating)", () => {
  // The stepper is a teaching tool: a student on the Python §1 sublanguage must not reach §2 features
  // (the pair / linked-list library) before they are taught. A §2 name used in a §1 program resolves
  // to nothing, so it is reported as an unknown name — the same NameError as an undefined variable.
  test("§1 rejects §2 list-library functions as unknown names", () => {
    expect(preprocess("pair(1, 2)", 1)).toBe(
      "NameNotFoundError at line 1\n                   \npair(1, 2)\n" +
        " ^^^^ This name is not found in the current or enclosing environment(s).\n" +
        "      Perhaps you meant to type 'abs'?",
    );
    expect(preprocess("llist(1, 2, 3)", 1)).toBe(
      "NameNotFoundError at line 1\n                   \nllist(1, 2, 3)\n" +
        " ^^^^^ This name is not found in the current or enclosing environment(s).\n" +
        "       Perhaps you meant to type 'int'?",
    );
    expect(preprocess("map_linked_list(lambda x: x, None)", 1)).toBe(
      "NameNotFoundError at line 1\n                   \nmap_linked_list(lambda x: x, None)\n" +
        " ^^^^^^^^^^^^^^^ This name is not found in the current or enclosing environment(s).",
    );
    expect(preprocess("is_pair(5)", 1)).toBe(
      "NameNotFoundError at line 1\n                   \nis_pair(5)\n" +
        " ^^^^^^^ This name is not found in the current or enclosing environment(s).",
    );
  });

  test("a §2 name in §1 is reported exactly like an undefined variable", () => {
    expect(preprocess("head(None)", 1)).toBe(
      "NameNotFoundError at line 1\n                   \nhead(None)\n" +
        " ^^^^ This name is not found in the current or enclosing environment(s).\n" +
        "      Perhaps you meant to type 'real'?",
    );
    expect(preprocess("undefined_name", 1)).toBe(
      "NameNotFoundError at line 1\n                   \nundefined_name\n" +
        " ^^^^^^^^^^^^^^ This name is not found in the current or enclosing environment(s).",
    );
  });

  test("a §2 name is rejected wherever it appears in a §1 program", () => {
    expect(preprocess("xs = pair(1, 2)\nhead(xs)", 1)).toBe(
      "NameNotFoundError at line 1\n                   \nxs = pair(1, 2)\n" +
        "      ^^^^ This name is not found in the current or enclosing environment(s).\n" +
        "           Perhaps you meant to type 'abs'?",
    );
    expect(preprocess("def f(x):\n  return head(x)\nf(None)", 1)).toBe(
      "NameNotFoundError at line 2\n                   \n  return head(x)\n" +
        "          ^^^^ This name is not found in the current or enclosing environment(s).\n" +
        "               Perhaps you meant to type 'real'?",
    );
    expect(preprocess("g = lambda xs: tail(xs)", 1)).toBe(
      "NameNotFoundError at line 1\n                   \ng = lambda xs: tail(xs)\n" +
        "                ^^^^ This name is not found in the current or enclosing environment(s).\n" +
        "                     Perhaps you meant to type 'abs'?",
    );
  });

  test("§1 core (math, MISC predicates, conversions, user bindings) stays available in §1", () => {
    expect(preprocess("math_sqrt(2) + math_pi", 1)).toBeNull();
    expect(preprocess('abs(-5) + len("hi")', 1)).toBeNull();
    expect(preprocess("is_none(None)", 1)).toBeNull(); // is_none is a §1 MISC predicate
    expect(preprocess('int("3") + round(2.5)', 1)).toBeNull();
    expect(preprocess("x = 5\nx + 1", 1)).toBeNull();
  });

  test("the same §2 names resolve once Python §2 is selected", () => {
    expect(preprocess("pair(1, 2)", 2)).toBeNull();
    expect(preprocess("head(pair(1, 2))", 2)).toBeNull();
    expect(preprocess("map_linked_list(lambda x: x, llist(1, 2))", 2)).toBeNull();
    expect(preprocess("is_pair(pair(1, 2))", 2)).toBeNull();
  });

  test("is_none (§1) and is_pair (§2) are split by chapter", () => {
    expect(preprocess("is_none(5)", 1)).toBeNull(); // available in every chapter
    expect(preprocess("is_pair(5)", 1)).toBe(
      "NameNotFoundError at line 1\n                   \nis_pair(5)\n" +
        " ^^^^^^^ This name is not found in the current or enclosing environment(s).",
    );
    expect(preprocess("is_pair(5)", 2)).toBeNull();
  });
});

describe("Python stepper — unsupported operators are a preprocessing error", () => {
  test("identity and membership operators are rejected up front", () => {
    // `is`/`is not`/`in`/`not in` parse, but the substitution stepper has no rule for them, so they
    // are reported as a preprocessing error rather than silently getting "stuck" mid-reduction.
    expect(preprocess("1 is 1")).toBe("Operator 'is' is not allowed.");
    expect(preprocess("1 is not 2")).toBe("Operator 'is not' is not allowed.");
    expect(preprocess("1 in 2")).toBe("Operator 'in' is not allowed.");
    expect(preprocess("1 not in 2")).toBe("Operator 'not in' is not allowed.");
  });

  test("rejected wherever they appear (nested, function bodies, conditions, lambdas)", () => {
    expect(preprocess("x = 5\nx is None")).toBe("Operator 'is' is not allowed.");
    expect(preprocess("def f(a, b):\n  return a in b\nf(1, 2)")).toBe(
      "Operator 'in' is not allowed.",
    );
    expect(preprocess("y = 1 if 2 is 3 else 4")).toBe("Operator 'is' is not allowed.");
    expect(preprocess("g = lambda a: a is not None")).toBe("Operator 'is not' is not allowed.");
  });

  test("the operator is reported even alongside an undefined name", () => {
    // The operator check runs first: this construct is unsupported regardless of its operands.
    expect(preprocess("undefined_thing in undefined_other")).toBe("Operator 'in' is not allowed.");
  });

  test("supported comparison operators are unaffected", () => {
    expect(preprocess("1 == 2")).toBeNull();
    expect(preprocess("1 != 2")).toBeNull();
    expect(preprocess("1 < 2")).toBeNull();
    expect(preprocess("1 >= 2")).toBeNull();
  });
});

describe("Python stepper — step structure", () => {
  test('begins with a "Start of evaluation" step and alternates before/after', () => {
    const e = explanations("1 + 2 * 3");
    expect(e[0]).toBe("Start of evaluation");
    expect(steps("1 + 2 * 3")[1].markers?.[0]?.redexType).toBe("beforeMarker");
    expect(steps("1 + 2 * 3")[2].markers?.[0]?.redexType).toBe("afterMarker");
  });

  test("innermost redex reduces first (2 * 3 before 1 + 6)", () => {
    const e = explanations("1 + 2 * 3");
    expect(e[1]).toContain("2 * 3");
    expect(e[3]).toContain("1 + 6");
  });

  test("every before-marker redexId resolves to a node in that step AST", () => {
    for (const step of steps("1 + 2 * 3\nx = 4\nx * x")) {
      const marker = step.markers?.[0];
      if (marker?.redexId != null) {
        expect(nodeIds(step.ast).has(marker.redexId)).toBe(true);
      }
    }
  });

  test("serialized steps are structured-clone safe (survive the channel)", () => {
    expect(() => structuredClone(steps("f = lambda x: x + 1\nf(10)"))).not.toThrow();
  });

  test("the serialized AST is estree-shaped for the host renderer", () => {
    const ast = steps("1 + 2")[0].ast as any;
    expect(ast.type).toBe("Program");
    expect(ast.body[0].type).toBe("ExpressionStatement");
    expect(ast.body[0].expression.type).toBe("BinaryExpression");
    expect(ast.body[0].expression).toMatchObject({ operator: "+" });
  });

  test('closes with a terminal "Evaluation complete" step, like Source', () => {
    const e = explanations("1 + 2");
    expect(e[e.length - 1]).toBe("Evaluation complete");
  });

  test("the final line's value disappears before completion (a program yields no value)", () => {
    // Unlike Source/js-slang, a Python program has no value: the last line's value is discarded just
    // like every other line's, so the run ends on an *empty* program rather than lingering on it. It is
    // shown highlighted green (still present) one last time — the discard step's *after* step — before
    // that happens; see "green flash before discard" below for the fully worked-out step sequence.
    const e = explanations("1 + 1");
    expect(e[e.length - 1]).toBe("Evaluation complete");
    expect(e[e.length - 2]).toBe("Evaluated 2"); // the discard step's after (green) step, as for any statement
    expect(e[e.length - 3]).toBe("Evaluating 2"); // ...and its before (red) step

    const s = steps("1 + 1");
    const lastVisible = s[s.length - 2].ast as any; // the green "2" step, one before the terminal step
    expect(lastVisible.body).toHaveLength(1); // "2" is still there, not yet discarded
    const terminal = s[s.length - 1].ast as any;
    expect(terminal.type).toBe("Program");
    expect(terminal.body).toHaveLength(0); // nothing rendered at completion

    // A program ending in an assignment already completed empty; the two now behave identically.
    const assign = steps("x = 1");
    expect((assign[assign.length - 1].ast as any).body).toHaveLength(0);

    // The REPL still echoes the final value, even though the stepper no longer lingers on it.
    expect(result("1 + 1")).toBe("2");
  });

  test("green flash before discard: a finished value is shown green once before it disappears", () => {
    // The user-facing spec this implements: every contraction's before-step reads "… evaluating"
    // (about to happen) and its after-step reads "… evaluated" (just happened, dropping the old
    // "finished evaluating" wording) — and a contraction that discards a whole finished statement
    // (an evaluated expression, a name binding, `pass`, an inlined `if` branch) shows it highlighted
    // green, still present in the tree, on its after-step; only the *next* contraction's before-step
    // shows it actually gone. Worked out fully for "1 + 1\n1 + 2\n" (ten steps total).
    const e = explanations("1 + 1\n1 + 2");
    expect(e).toEqual([
      "Start of evaluation",
      "Evaluating binary expression 1 + 1",
      "Evaluated binary expression 1 + 1",
      "Evaluating 2",
      "Evaluated 2",
      "Evaluating binary expression 1 + 2",
      "Evaluated binary expression 1 + 2",
      "Evaluating 3",
      "Evaluated 3",
      "Evaluation complete",
    ]);

    const s = steps("1 + 1\n1 + 2");
    const bodyLengths = s.map(step => (step.ast as any).body.length);
    // Step 5 (index 4, the "Evaluated 2" green step) still has both statements — "2" has not yet been
    // discarded — and step 9 (index 8, "Evaluated 3") still has its one statement, for the same reason.
    expect(bodyLengths).toEqual([2, 2, 2, 2, 2, 1, 1, 1, 1, 0]);
  });
});

describe('Python stepper — runtime errors end with "Evaluation stuck"', () => {
  test("a thrown runtime error (division by zero) ends stuck and shows the message", () => {
    const e = explanations("7 // 0");
    expect(e[e.length - 1]).toBe("Evaluation stuck");
    // The penultimate step explains why it is stuck.
    expect(e[e.length - 2]).toContain("ZeroDivisionError");
  });

  test("a runtime error inside a function body ends stuck", () => {
    expect(explanations("def f(x):\n  return x // 0\nf(5)").pop()).toBe("Evaluation stuck");
  });

  test("calling a non-function is stuck, not complete", () => {
    expect(explanations("5(3)").pop()).toBe("Evaluation stuck");
  });

  test("an unbound name left over is stuck, not a value", () => {
    expect(explanations("undefined_name + 1").pop()).toBe("Evaluation stuck");
  });

  test('a successful run still ends "Evaluation complete"', () => {
    expect(explanations("def f(x):\n  return x + 1\nf(4)").pop()).toBe("Evaluation complete");
    expect(explanations("7 // 2").pop()).toBe("Evaluation complete");
  });

  test("evaluatePython surfaces a runtime error as its message (never throws)", () => {
    expect(result("7 // 0")).toContain("ZeroDivisionError");
    expect(() => result("7 // 0")).not.toThrow();
  });

  test("short-circuit still completes (the dead operand is never reached)", () => {
    expect(explanations("False and undefined_name").pop()).toBe("Evaluation complete");
  });
});

describe("Python stepper — a runtime error is named in the step before the stuck step", () => {
  // Like ZeroDivisionError, the specific error appears as the step immediately before the terminal
  // "Evaluation stuck" (the driver turns a thrown error into a beforeMarker step then the stuck step).
  // This covers the errors the reducer used to swallow into a bare, message-less "Evaluation stuck".
  const errorStep = (src: string): string | undefined => {
    const e = explanations(src);
    expect(e[e.length - 1]).toBe("Evaluation stuck");
    return e[e.length - 2];
  };

  test("calling a non-callable value reports a TypeError", () => {
    expect(errorStep("5(3)")).toBe("TypeError: 'int' object is not callable");
    expect(errorStep("(3.5)(1)")).toBe("TypeError: 'float' object is not callable");
    expect(errorStep("None()")).toBe("TypeError: 'NoneType' object is not callable");
    expect(errorStep('"hi"()')).toBe("TypeError: 'str' object is not callable");
  });

  test("wrong number of arguments to a user function reports a TypeError", () => {
    expect(errorStep("f = lambda x: x\nf(1, 2)")).toBe(
      "TypeError: f() takes 1 argument(s) but 2 were given",
    );
    expect(errorStep("def g(a, b):\n  return a + b\ng(1)")).toBe(
      "TypeError: g() takes 2 argument(s) but 1 were given",
    );
    expect(errorStep("(lambda a: a)(1, 2, 3)")).toBe(
      "TypeError: <lambda>() takes 1 argument(s) but 3 were given",
    );
  });

  test("unsupported binary operand types report a TypeError", () => {
    expect(errorStep('1 + "a"')).toBe(
      "TypeError: unsupported operand type(s) for +: 'int' and 'str'",
    );
    expect(errorStep('"a" - "b"')).toBe(
      "TypeError: unsupported operand type(s) for -: 'str' and 'str'",
    );
    expect(errorStep("None + 1")).toBe(
      "TypeError: unsupported operand type(s) for +: 'NoneType' and 'int'",
    );
    expect(errorStep("x = lambda a: a\nx - 1")).toBe(
      "TypeError: unsupported operand type(s) for -: 'function' and 'int'",
    );
  });

  test("unsupported ordering comparisons report a TypeError", () => {
    expect(errorStep("None < 1")).toBe(
      "TypeError: '<' not supported between instances of 'NoneType' and 'int'",
    );
    expect(errorStep('1 < "a"')).toBe(
      "TypeError: '<' not supported between instances of 'int' and 'str'",
    );
  });

  test("unary minus/plus on a non-numeric reports a TypeError", () => {
    expect(errorStep('-"a"')).toBe("TypeError: bad operand type for unary -: 'str'");
    expect(errorStep("-None")).toBe("TypeError: bad operand type for unary -: 'NoneType'");
  });

  test("legal-but-unmodelled operations stay a silent stuck (never a false error)", () => {
    // These are valid Python the teaching stepper just does not evaluate (string repetition,
    // %-formatting); they must remain a plain "Evaluation stuck" with no TypeError step. (String
    // ordering, unlike these, *is* modelled — see "string ordering (< > <= >=)" below.)
    for (const src of ['"ab" * 2', '2 * "ab"', '"a" % "b"']) {
      const e = explanations(src);
      expect(e[e.length - 1]).toBe("Evaluation stuck");
      expect(e.some(x => x.includes("TypeError"))).toBe(false);
    }
  });

  test("the REPL value surfaces the same error message", () => {
    expect(result("5(3)")).toBe("TypeError: 'int' object is not callable");
    expect(result('1 + "a"')).toBe("TypeError: unsupported operand type(s) for +: 'int' and 'str'");
    expect(() => result("5(3)")).not.toThrow();
  });
});

describe("Python stepper — function values render as mu-terms (not inline bodies)", () => {
  // A substituted `def` must NOT expand its whole body at every use: it is substituted as a *named*
  // value (the `name` marker) so the host collapses it to a hoverable mu-term, exactly like Source.
  test("a def is substituted as a named function value, not expanded inline", () => {
    const s = steps("def square(n):\n  return n * n\nsquare(4)");

    // Some step shows the call with `square` substituted in as a named FunctionDeclaration value.
    const collapsed = s.some(step => {
      const call = findNode(step.ast, n => n.type === "CallExpression");
      return call?.callee?.type === "FunctionDeclaration" && call.callee.name === "square";
    });
    expect(collapsed).toBe(true);

    // The declaration site (first step) keeps its full `def` form — no mu-term `name` marker.
    const declSite = findNode(s[0].ast, n => n.type === "FunctionDeclaration");
    expect(declSite.name).toBeUndefined();
  });

  test("a lambda bound to a name is substituted as a named function value", () => {
    const s = steps("f = lambda x: x + 1\nf(10)");

    const collapsed = s.some(step => {
      const call = findNode(step.ast, n => n.type === "CallExpression");
      return call?.callee?.type === "ArrowFunctionExpression" && call.callee.name === "f";
    });
    expect(collapsed).toBe(true);

    // The binding site's lambda is still anonymous (renders inline as `lambda x: x + 1`).
    const declInit = (s[0].ast as any).body[0].declarations[0].init;
    expect(declInit.type).toBe("ArrowFunctionExpression");
    expect(declInit.name).toBeUndefined();
  });

  test("an anonymous lambda argument stays anonymous (rendered inline)", () => {
    const lambda = findNode(
      steps("(lambda x: x + 1)(5)")[0].ast,
      n => n.type === "ArrowFunctionExpression",
    );
    expect(lambda.name).toBeUndefined();
  });
});

describe("Python stepper — explanations mirror Source phrasing", () => {
  test("binary expression", () => {
    expect(explanations("1 + 2")).toContain("Evaluated binary expression 1 + 2");
  });

  test("function declaration and application", () => {
    const e = explanations("def square(n):\n  return n * n\nsquare(4)");
    expect(e).toContain("Declaring and substituting square into the rest of the block");
    expect(e).toContain("Substituted 4 into n of square");
  });

  test("name binding", () => {
    expect(explanations("x = 5\nx")).toContain(
      "Declared and substituted x into the rest of the block",
    );
  });

  test("if statement", () => {
    expect(explanations("if 1 < 2:\n  x = 1\nelse:\n  x = 2\nx")).toContain(
      "Evaluated if statement, condition true, will proceed to if block",
    );
  });

  test("short-circuit and conditional", () => {
    expect(explanations("True and False")).toContain(
      "Evaluated AND expression, left of operator is truthy, will evaluate right of operator",
    );
    expect(explanations("1 if 2 > 1 else 9")).toContain(
      "Evaluated conditional expression, condition is true, will evaluate consequent",
    );
  });
});

describe("Python stepper — pairs and linked lists (Python §2)", () => {
  // A pair renders in box-and-pointer notation `[head, tail]`, like Source; the empty list is `None`.
  test("pair construction and accessors", () => {
    expect(result("pair(1, 2)")).toBe("[1, 2]");
    expect(result("head(pair(1, 2))")).toBe("1");
    expect(result("tail(pair(1, 2))")).toBe("2");
    expect(result("head(tail(pair(1, pair(2, 3))))")).toBe("2");
  });

  test("pair predicates", () => {
    expect(result("is_pair(pair(1, 2))")).toBe("True");
    expect(result("is_pair(5)")).toBe("False");
    expect(result("is_pair(None)")).toBe("False");
    expect(result("is_none(None)")).toBe("True");
    expect(result("is_none(pair(1, 2))")).toBe("False");
  });

  test("llist builds nested pairs ending in None", () => {
    expect(result("llist(1, 2, 3)")).toBe("[1, [2, [3, None]]]");
    expect(result("llist()")).toBe("None");
    expect(result("llist(42)")).toBe("[42, None]");
  });

  test("is_linked_list distinguishes proper lists from improper pairs", () => {
    expect(result("is_linked_list(llist(1, 2, 3))")).toBe("True");
    expect(result("is_linked_list(None)")).toBe("True");
    expect(result("is_linked_list(pair(1, 2))")).toBe("False");
    expect(result("is_linked_list(5)")).toBe("False");
  });

  test("length, ref and member", () => {
    expect(result("length_linked_list(llist(1, 2, 3, 4))")).toBe("4");
    expect(result("length_linked_list(None)")).toBe("0");
    expect(result("ref_linked_list(llist(10, 20, 30), 1)")).toBe("20");
    expect(result("member_linked_list(2, llist(1, 2, 3))")).toBe("[2, [3, None]]");
    expect(result("member_linked_list(9, llist(1, 2))")).toBe("None");
  });

  test("map, filter and accumulate", () => {
    expect(result("map_linked_list(lambda x: x * x, llist(1, 2, 3))")).toBe("[1, [4, [9, None]]]");
    expect(result("filter_linked_list(lambda x: x > 1, llist(1, 2, 3))")).toBe("[2, [3, None]]");
    expect(result("accumulate_linked_list(lambda x, y: x + y, 0, llist(1, 2, 3))")).toBe("6");
  });

  test("reverse, append, enum and build", () => {
    expect(result("reverse_linked_list(llist(1, 2, 3))")).toBe("[3, [2, [1, None]]]");
    expect(result("append_linked_list(llist(1, 2), llist(3, 4))")).toBe("[1, [2, [3, [4, None]]]]");
    expect(result("enum_linked_list(1, 4)")).toBe("[1, [2, [3, [4, None]]]]");
    expect(result("build_linked_list(lambda i: i * 2, 3)")).toBe("[0, [2, [4, None]]]");
  });

  test("remove and remove_all", () => {
    expect(result("remove_linked_list(2, llist(1, 2, 3, 2))")).toBe("[1, [3, [2, None]]]");
    expect(result("remove_all_linked_list(2, llist(2, 1, 2, 3))")).toBe("[1, [3, None]]");
  });

  test("equal compares structure and leaf values", () => {
    expect(result("equal(llist(1, 2, 3), llist(1, 2, 3))")).toBe("True");
    expect(result("equal(llist(1, 2), llist(1, 3))")).toBe("False");
    expect(result("equal(pair(1, pair(2, None)), llist(1, 2))")).toBe("True");
    expect(result("equal(None, None)")).toBe("True");
  });

  test("linked_list_to_string and for_each", () => {
    expect(result("linked_list_to_string(llist(1, 2))")).toBe("'[1, [2, None]]'");
    expect(result("for_each_linked_list(lambda x: x, llist(1, 2, 3))")).toBe("True");
  });

  test("list functions are first-class values", () => {
    expect(result("is_function(pair)")).toBe("True");
    expect(result("is_function(map_linked_list)")).toBe("True");
    expect(result("arity(pair)")).toBe("2");
    expect(result("arity(accumulate_linked_list)")).toBe("3");
    // A bare list-function name is a complete value, not stuck.
    expect(explanations("head").pop()).toBe("Evaluation complete");
  });

  test("a fully-evaluated list is a complete result", () => {
    expect(explanations("llist(1, 2, 3)").pop()).toBe("Evaluation complete");
    expect(explanations("map_linked_list(lambda x: x + 1, llist(1, 2))").pop()).toBe(
      "Evaluation complete",
    );
  });

  test("misusing a list primitive is stuck, not a wrong answer", () => {
    expect(explanations("head(5)").pop()).toBe("Evaluation stuck"); // not a pair
    expect(explanations("tail(None)").pop()).toBe("Evaluation stuck"); // empty list has no tail
    expect(explanations("pair(1)").pop()).toBe("Evaluation stuck"); // wrong arity
  });

  test("the list reduction shows pairs/lists, not the helper implementation noise", () => {
    // `pair` contracts in one labelled step, like Source's primitives.
    expect(explanations("pair(1, 2)")).toContain("Running pair");
    // A pair value serialises as an estree `ArrayExpression` for the host's `[...]` template. It shows
    // as the contraction result and is then discarded before the terminal (empty) "Evaluation
    // complete" step — a Python statement yields no program value — so search across the steps for it.
    const value = steps("pair(1, 2)")
      .map(s => findNode(s.ast, (n: any) => n.type === "ArrayExpression"))
      .find(Boolean);
    expect(value).toBeDefined();
    expect(value.elements.map((e: any) => e.raw)).toEqual(["1", "2"]);
  });

  test("list library names resolve in preprocessing (not undefined)", () => {
    expect(preprocess("map_linked_list(lambda x: x, llist(1, 2))")).toBeNull();
    expect(preprocess("xs = llist(1, 2)\nhead(xs)")).toBeNull();
    expect(preprocess("accumulate_linked_list(lambda a, b: a + b, 0, None)")).toBeNull();
  });

  test("user code composes with the list library", () => {
    const program =
      "def sum_list(xs):\n" +
      "  return 0 if is_none(xs) else head(xs) + sum_list(tail(xs))\n" +
      "sum_list(llist(1, 2, 3, 4))";
    expect(result(program)).toBe("10");
  });

  test("structured-clone safe with pairs (survives the channel)", () => {
    expect(() =>
      structuredClone(steps("map_linked_list(lambda x: x * 2, llist(1, 2, 3))")),
    ).not.toThrow();
    for (const step of steps("reverse_linked_list(llist(1, 2))")) {
      const marker = step.markers?.[0];
      if (marker?.redexId != null) expect(nodeIds(step.ast).has(marker.redexId)).toBe(true);
    }
  });
});

describe("Python stepper — floating-point arithmetic (float operands)", () => {
  // Any float operand promotes the operation to float (Python semantics), so a `.0` repr is kept.
  test("float add, subtract and multiply", () => {
    expect(result("1.5 + 2.5")).toBe("4.0");
    expect(result("5.5 - 2.0")).toBe("3.5");
    expect(result("2.5 * 2.0")).toBe("5.0");
  });

  test("float true division, floor division and modulo", () => {
    expect(result("7.0 / 2")).toBe("3.5");
    expect(result("7.5 // 2")).toBe("3.0"); // floored, but stays a float
    expect(result("7.5 % 2")).toBe("1.5");
  });

  test("float power", () => {
    expect(result("2.0 ** 3")).toBe("8.0");
  });

  test("float comparisons produce Python booleans", () => {
    expect(result("1.5 < 2.0")).toBe("True");
    expect(result("2.5 > 1.0")).toBe("True");
    expect(result("1.5 <= 1.5")).toBe("True");
    expect(result("2.5 >= 3.0")).toBe("False");
    expect(result("1.5 == 1.5")).toBe("True");
    expect(result("1.5 != 2.0")).toBe("True");
  });
});

describe("Python stepper — integer comparisons and edge arithmetic", () => {
  test("the remaining ordering/inequality operators on ints", () => {
    expect(result("1 <= 2")).toBe("True");
    expect(result("2 <= 2")).toBe("True");
    expect(result("2 >= 1")).toBe("True");
    expect(result("1 != 2")).toBe("True");
    expect(result("1 != 1")).toBe("False");
  });

  test("zero raised to a negative power is a ZeroDivisionError (int and float paths)", () => {
    expect(result("0 ** -1")).toContain("ZeroDivisionError");
    expect(result("0.0 ** -1")).toContain("ZeroDivisionError");
    expect(explanations("0 ** -1").pop()).toBe("Evaluation stuck");
  });

  test("string ordering (< > <= >=) compares lexicographically", () => {
    expect(result('"a" < "b"')).toBe("True");
    expect(result('"b" < "a"')).toBe("False");
    expect(result('"apple" < "banana"')).toBe("True");
    expect(result('"a" > "b"')).toBe("False");
    expect(result('"abc" <= "abc"')).toBe("True");
    expect(result('"abd" >= "abc"')).toBe("True");
    expect(explanations('"a" < "b"').pop()).toBe("Evaluation complete"); // modelled, not stuck
  });

  test("== / != are narrow in this dialect: only (numeric, numeric) or (string, string) succeed", () => {
    // Unlike native Python, equality is not defined for every pair of values here — None, functions,
    // and mismatched types are all a TypeError (stuck), not a structural/identity comparison.
    for (const src of ["None == None", "None == 1", "None != None", "None != 1", "1 == '1'"]) {
      expect(explanations(src).pop()).toBe("Evaluation stuck");
      expect(result(src)).toContain("TypeError");
    }
    expect(explanations("(lambda x: x) == (lambda x: x)").pop()).toBe("Evaluation stuck");
  });
});

describe("Python stepper — and/or/not require a strict bool operand", () => {
  // Unlike native Python's truthiness, this dialect's `and`/`or`/`not` require a genuine `bool`
  // operand (matching the real, non-stepper evaluator's BOOL_OP/NOT instructions): `1 and 1`, `not 5`,
  // `None and 1` are all TypeErrors here, not truthy-evaluated.
  test("and/or short-circuit on a bool left operand; the right operand's type is unrestricted", () => {
    expect(result("True and 1")).toBe("1"); // left truthy → right returned, any type
    expect(result("False and 1")).toBe("False"); // left falsy → short-circuits, right never touched
    expect(result("True or 1")).toBe("True"); // left truthy → short-circuits
    expect(result("False or 1")).toBe("1"); // left falsy → right returned, any type
  });

  test("a non-bool left operand to and/or is a TypeError (stuck), not truthy-evaluated", () => {
    for (const src of ['"abc" and 1', "1 and 1", "None and 1", "(lambda x: x) and 1", "0 or 1"]) {
      expect(explanations(src).pop()).toBe("Evaluation stuck");
    }
    expect(result("1 and 1")).toContain("TypeError");
  });

  test("not requires a bool argument; a non-bool value is a TypeError (stuck)", () => {
    for (const src of ["not 1", "not 1.0", "not None", "not ''", "not (lambda x: x)"]) {
      expect(explanations(src).pop()).toBe("Evaluation stuck");
    }
    expect(result("not 1")).toContain("TypeError");
  });
});

describe("Python stepper — the rest of the math library", () => {
  test("binary math functions compute on two arguments", () => {
    expect(result("math_pow(2, 10)")).toBe("1024.0");
    expect(result("math_atan2(0, 1)")).toBe("0.0");
    expect(result("math_hypot(3, 4)")).toBe("5.0");
    expect(result("math_fmod(7, 3)")).toBe("1.0");
    expect(result("math_copysign(3, -1)")).toBe("-3.0");
    expect(result("math_remainder(7, 3)")).toBe("1.0");
  });

  test("angle conversion (degrees/radians)", () => {
    expect(result("math_degrees(0)")).toBe("0.0");
    expect(result("math_radians(0)")).toBe("0.0");
    expect(parseFloat(result("math_degrees(math_pi)"))).toBeCloseTo(180);
    expect(parseFloat(result("math_radians(180)"))).toBeCloseTo(Math.PI);
  });

  test("infinity / finiteness predicates", () => {
    expect(result("math_isinf(math_inf)")).toBe("True");
    expect(result("math_isinf(1.0)")).toBe("False");
    expect(result("math_isfinite(1.0)")).toBe("True");
    expect(result("math_isfinite(math_inf)")).toBe("False");
  });

  test("a math function on a non-number is a TypeError (stuck)", () => {
    expect(result("math_floor(None)")).toContain("TypeError");
    expect(explanations("math_floor(None)").pop()).toBe("Evaluation stuck");
  });
});

describe("Python stepper — bool is not an int subtype in this dialect", () => {
  // Unlike native Python, `bool` participates in no arithmetic, comparison or equality operator, and
  // no numeric builtin, here — it is only valid to `and`/`or`/`not` and to explicit conversions like
  // `int()`/`float()`/`str()`. This matches the real, non-stepper evaluator (e.g. `True == True`,
  // `True + 1` and `abs(True)` are all TypeErrors there too), even though native Python allows them.
  test("bool is rejected by every binary arithmetic/comparison/equality operator", () => {
    for (const src of ["True + 1", "1 + True", "True * True", "True / 1", "True - True"]) {
      expect(explanations(src).pop()).toBe("Evaluation stuck");
      expect(result(src)).toContain("TypeError");
    }
    for (const src of ["True == True", "True == 1", "True > 1", "1 > True", "True <= True"]) {
      expect(explanations(src).pop()).toBe("Evaluation stuck");
      expect(result(src)).toContain("TypeError");
    }
  });

  test("unary minus/plus on a bool is a TypeError (stuck)", () => {
    expect(explanations("-True").pop()).toBe("Evaluation stuck");
    expect(result("-True")).toContain("TypeError");
  });

  test("abs/round/math functions reject a bool argument", () => {
    for (const src of ["abs(True)", "round(True)", "math_sqrt(True)", "math_floor(False)"]) {
      expect(explanations(src).pop()).toBe("Evaluation stuck");
      expect(result(src)).toContain("TypeError");
    }
  });

  test("min/max reject a bool argument", () => {
    expect(explanations("min(True, 1)").pop()).toBe("Evaluation stuck");
    expect(explanations("max(1, False)").pop()).toBe("Evaluation stuck");
  });

  test("explicit conversions (int, float, str, bool, is_boolean) still accept bool", () => {
    // Conversions are the one place `bool` is still accepted — they convert its representation rather
    // than using it as a numeric operand.
    expect(result("int(True)")).toBe("1");
    expect(result("float(True)")).toBe("1.0");
    expect(result("str(True)")).toBe("'True'");
    expect(result("bool(True)")).toBe("True");
    expect(result("is_boolean(True)")).toBe("True");
  });
});

describe("Python stepper — str/repr and bool of compound values", () => {
  test("str of a pair renders box-and-pointer with repr'd elements", () => {
    expect(result("str(pair(1, 2))")).toBe("'[1, 2]'");
    expect(result('str(pair("a", None))')).toBe("\"['a', None]\""); // string element shows quoted
  });

  test("str/repr of function values", () => {
    expect(result("str(lambda x: x)")).toBe("'<function <lambda>>'");
    expect(result("str(abs)")).toBe("'<built-in function abs>'");
    expect(result("repr(math_sqrt)")).toBe("'<built-in function math_sqrt>'");
  });

  test("bool uses the truthiness of strings and pairs", () => {
    expect(result('bool("")')).toBe("False");
    expect(result('bool("x")')).toBe("True");
    expect(result("bool(pair(1, 2))")).toBe("True");
  });
});

describe("Python stepper — constructs outside the reducible subset degrade gracefully", () => {
  // These parse but sit outside the substitution stepper's faithfully-modelled subset. `translate`
  // either renders them as a value (a list literal) or degrades them to an inert placeholder identifier
  // that simply gets stuck, instead of failing the whole run. (The preprocessing gate would reject most
  // of these in production; the stepper's `getPythonSteps` translates them regardless.) Complex numbers
  // are *not* in this category — they are a fully-modelled value type; see "complex numbers" below.
  test("a list literal reduces to an array value", () => {
    expect(result("[1, 2, 3]")).toBe("[1, 2, 3]");
    expect(result("[]")).toBe("[]");
    expect(result('["a", 1]')).toBe("['a', 1]"); // elements use repr, so a string shows quoted
  });

  test("an unsupported expression becomes an inert placeholder (stuck)", () => {
    expect(explanations("x[0]").pop()).toBe("Evaluation stuck"); // subscript is not modelled
  });

  test("an assignment to a non-variable target is an inert placeholder (stuck)", () => {
    expect(explanations("x[0] = 5").pop()).toBe("Evaluation stuck");
  });

  test("an unsupported statement becomes an inert placeholder (stuck)", () => {
    for (const src of ["assert True", "while False:\n  pass", "for i in x:\n  pass"]) {
      expect(explanations(src).pop()).toBe("Evaluation stuck");
    }
  });

  test("a program left stuck at a leading non-value statement is 'stuck', not 'complete'", () => {
    // Two statements where the first cannot reduce and is not a value: the whole run is stuck.
    expect(explanations("x[0]\n1").pop()).toBe("Evaluation stuck");
  });
});

describe("Python stepper — list library edge built-ins", () => {
  test("draw_data returns its first argument (there is no drawing canvas)", () => {
    expect(result("draw_data(5)")).toBe("5");
    expect(result("draw_data(pair(1, 2))")).toBe("[1, 2]");
  });

  test("draw_data with no arguments is stuck (it needs at least one)", () => {
    expect(explanations("draw_data()").pop()).toBe("Evaluation stuck");
    expect(result("draw_data()")).toContain("at least 1 argument");
  });

  test("a library function called with the wrong argument count is stuck", () => {
    expect(explanations("map_linked_list(lambda x: x)").pop()).toBe("Evaluation stuck");
    expect(result("equal(None)")).toContain("takes 2 argument(s) but 1 were given");
  });
});

describe("Python stepper — step limit", () => {
  test("stops with 'Maximum number of steps exceeded' when the step limit is reached", () => {
    // stepLimit 2 → one contraction allowed; a longer program is cut off with the limit marker.
    const limited = getPythonSteps(parse("1 + 2 + 3 + 4\n"), 2);
    expect(limited[limited.length - 1].markers?.[0]?.explanation).toBe(
      "Maximum number of steps exceeded",
    );
  });
});

describe("Python stepper — module helpers", () => {
  test("isBuiltinConstantName recognises the math constants only", () => {
    expect(isBuiltinConstantName("math_pi")).toBe(true);
    expect(isBuiltinConstantName("math_tau")).toBe(true);
    expect(isBuiltinConstantName("abs")).toBe(false); // a function, not a constant
    expect(isBuiltinConstantName("not_a_name")).toBe(false);
  });

  test("expressionStatement wraps an expression node", () => {
    const stmt = expressionStatement(identifier("x")) as any;
    expect(stmt.type).toBe("ExpressionStatement");
    expect(stmt.expression).toMatchObject({ type: "Identifier", name: "x" });
  });
});

describe("Python stepper — MISC conversions and their error paths", () => {
  test("float division by zero is a ZeroDivisionError (stuck)", () => {
    expect(result("1.5 / 0")).toContain("ZeroDivisionError");
    expect(explanations("1.5 % 0").pop()).toBe("Evaluation stuck");
  });

  test("unary plus on a number is the number itself", () => {
    expect(result("+5")).toBe("5"); // int
    expect(result("+5.0")).toBe("5.0"); // float
  });

  test("int() with an explicit base parses a string", () => {
    expect(result('int("ff", 16)')).toBe("255");
    expect(result('int("101", 2)')).toBe("5");
  });

  test("int() of an unconvertible type is a TypeError (stuck)", () => {
    expect(result("int(None)")).toContain("TypeError");
    expect(explanations("int(None)").pop()).toBe("Evaluation stuck");
  });

  test("float() parses strings, including the special values", () => {
    expect(result('float("1.5")')).toBe("1.5");
    expect(result('float("inf")')).toBe("inf");
    expect(result('float("-inf")')).toBe("-inf");
    expect(result('float("nan")')).toBe("nan");
  });

  test("float() of an unparseable string is a ValueError (stuck)", () => {
    expect(result('float("abc")')).toContain("ValueError");
    expect(explanations('float("abc")').pop()).toBe("Evaluation stuck");
  });

  test("float() rejects prototype-chain property names as malformed, not as special values", () => {
    // Same regression as complex(str) above: these must not resolve via inherited Object.prototype keys.
    expect(result('float("constructor")')).toContain("ValueError");
    expect(result('float("__proto__")')).toContain("ValueError");
  });

  test("factorial of a negative is a ValueError (stuck)", () => {
    expect(result("math_factorial(-1)")).toContain("ValueError");
    expect(explanations("math_factorial(-1)").pop()).toBe("Evaluation stuck");
  });

  test("len / arity misuse is a TypeError (stuck)", () => {
    expect(result("len(5)")).toContain("TypeError");
    expect(result("arity(5)")).toContain("TypeError");
    expect(explanations("len(5)").pop()).toBe("Evaluation stuck");
  });
});

describe("Python stepper — complex numbers", () => {
  // A `<real>±<imag>j` literal is one token (parsed straight into real/imag by py-slang's parser), but
  // `2 + 3j` (with an operator) is an ordinary int-plus-complex expression — both must produce the same
  // value, so both forms are exercised throughout.
  test("a bare complex literal displays like Python's repr (no parens when the real part is zero)", () => {
    expect(result("1j")).toBe("1j");
    expect(result("3j")).toBe("3j");
    expect(result("-3j")).toBe("-3j");
    expect(result("0j")).toBe("0j");
    expect(result("-4.5j")).toBe("-4.5j");
    expect(explanations("3j").pop()).toBe("Evaluation complete");
  });

  test("a real+imaginary literal displays parenthesised, with an explicit sign", () => {
    expect(result("2+3j")).toBe("(2+3j)");
    expect(result("2-3j")).toBe("(2-3j)");
  });

  test("int/float promote to complex when combined with one via an operator", () => {
    expect(result("2 + 3j")).toBe("(2+3j)"); // int + complex
    expect(result("3j + 2")).toBe("(2+3j)"); // complex + int, same value
    expect(result("1.5 + 2j")).toBe("(1.5+2j)"); // float + complex
  });

  test("complex arithmetic: +, -, *, /", () => {
    expect(result("(1+2j) + (3+4j)")).toBe("(4+6j)");
    expect(result("(1+2j) - (3+4j)")).toBe("(-2-2j)");
    expect(result("(1+2j) * (3+4j)")).toBe("(-5+10j)");
    expect(result("(1+2j) / (3+4j)")).toBe("(0.44+0.08j)");
  });

  test("complex power (via the polar-form algorithm, like the real evaluator)", () => {
    // `(1+2j) ** 2` is not exactly `-3+4j` here because the general complex power path always goes
    // through log/exp/trig, picking up float noise even for an integer exponent — this exactly mirrors
    // `PyComplexNumber.pow` in the real, non-stepper evaluator (same formula, same imprecision).
    const s = result("(1+2j) ** 2");
    expect(s.startsWith("(-3+4.0")).toBe(true);
    expect(s.endsWith("j)")).toBe(true);
    expect(result("0j ** 2")).toBe("0j");
  });

  test("0 to a negative or non-real power is a ZeroDivisionError (stuck)", () => {
    for (const src of ["0j ** -1", "0j ** (1+1j)"]) {
      expect(result(src)).toContain("ZeroDivisionError");
      expect(explanations(src).pop()).toBe("Evaluation stuck");
    }
  });

  test("complex division by zero is a ZeroDivisionError (stuck), for a plain-int or complex zero", () => {
    for (const src of ["1j / 0", "1j / 0j"]) {
      expect(result(src)).toContain("ZeroDivisionError");
      expect(explanations(src).pop()).toBe("Evaluation stuck");
    }
  });

  test("== / != hold between any mix of int, float and complex", () => {
    expect(result("(1+2j) == (1+2j)")).toBe("True");
    expect(result("(1+2j) == (1+3j)")).toBe("False");
    expect(result("(1+2j) != (1+3j)")).toBe("True");
    expect(result("1 == 1+0j")).toBe("True");
    expect(result("1.0 == 1+0j")).toBe("True");
    expect(result("1+0j == 1")).toBe("True");
  });

  test("ordering (<, <=, >, >=), // and % are not defined for complex — a TypeError (stuck)", () => {
    for (const src of ["(1+2j) < (3+4j)", "(1+2j) // 2", "(1+2j) % 2"]) {
      expect(explanations(src).pop()).toBe("Evaluation stuck");
      expect(result(src)).toContain("TypeError");
    }
  });

  test("unary minus/plus on complex", () => {
    expect(result("-(1+2j)")).toBe("(-1-2j)");
    expect(result("+(1+2j)")).toBe("(1+2j)");
  });

  test("abs() returns the modulus as a non-negative float", () => {
    expect(result("abs(3+4j)")).toBe("5.0");
    expect(result("abs(0j)")).toBe("0.0");
    expect(result("abs(1j)")).toBe("1.0");
  });

  test("str/repr of a complex value (repr matches str, unlike a string's quoting)", () => {
    expect(result("str(1+2j)")).toBe("'(1+2j)'");
    expect(result("repr(1+2j)")).toBe("'(1+2j)'");
    expect(result("str(2j)")).toBe("'2j'");
    expect(result("str(-2j)")).toBe("'-2j'");
  });

  test("complex() constructs from a number, bool, string, or (real, imag) pair", () => {
    expect(result("complex()")).toBe("0j");
    expect(result("complex(5)")).toBe("(5+0j)");
    expect(result("complex(5.5)")).toBe("(5.5+0j)");
    expect(result("complex(True)")).toBe("(1+0j)"); // the one place bool is still accepted
    expect(result("complex(1+2j)")).toBe("(1+2j)");
    expect(result("complex(1, 2)")).toBe("(1+2j)");
    expect(result("complex(1.5, 2.5)")).toBe("(1.5+2.5j)");
  });

  test("complex(str) parses a Python complex-literal string", () => {
    expect(result("complex('1+2j')")).toBe("(1+2j)");
    expect(result("complex('-4.5j')")).toBe("-4.5j");
    expect(result("complex('inf')")).toBe("(inf+0j)");
  });

  test("complex(str) rejects a malformed string with a ValueError (stuck)", () => {
    expect(result("complex('not a number')")).toContain("ValueError");
    expect(explanations("complex('not a number')").pop()).toBe("Evaluation stuck");
  });

  test("complex(str) rejects prototype-chain property names as malformed, not as special values", () => {
    // Regression: a bare `in` against the plain-object `specials` lookup used to match inherited
    // Object.prototype keys, so e.g. complex('constructorj') smuggled the Object constructor
    // function through as the imaginary part instead of being rejected.
    expect(result("complex('constructorj')")).toContain("ValueError");
    expect(result("complex('__proto__j')")).toContain("ValueError");
  });

  test("real()/imag() extract the components; they require an actual complex argument", () => {
    expect(result("real(1+2j)")).toBe("1.0");
    expect(result("imag(1+2j)")).toBe("2.0");
    expect(explanations("real(5)").pop()).toBe("Evaluation stuck"); // int is not "complex" here
    expect(result("real(5)")).toContain("TypeError");
  });

  test("is_complex distinguishes complex values from everything else", () => {
    expect(result("is_complex(1+2j)")).toBe("True");
    expect(result("is_complex(5)")).toBe("False");
    expect(result("is_complex(5.0)")).toBe("False");
  });

  test("bool()/truthiness: only exactly 0j is falsy", () => {
    expect(result("bool(0j)")).toBe("False");
    expect(result("bool(1j)")).toBe("True");
  });

  test("complex is a valid and/or *right* operand (its type is never checked there)", () => {
    expect(result("True and (1+2j)")).toBe("(1+2j)");
  });

  test("complex is rejected as and/or's left operand, and by not — a TypeError (stuck)", () => {
    expect(explanations("(1+2j) and True").pop()).toBe("Evaluation stuck");
    expect(result("(1+2j) and True")).toContain("TypeError");
    expect(explanations("not (1+2j)").pop()).toBe("Evaluation stuck");
    expect(result("not (1+2j)")).toContain("TypeError");
  });

  test("int()/float()/min/max/round/math_* all reject complex — a TypeError (stuck), like bool", () => {
    for (const src of [
      "int(1+2j)",
      "float(1+2j)",
      "min(1+2j, 3)",
      "round(1+2j)",
      "math_sqrt(1+2j)",
    ]) {
      expect(explanations(src).pop()).toBe("Evaluation stuck");
      expect(result(src)).toContain("TypeError");
    }
  });

  test("mixing complex with an incompatible type (str) is a TypeError (stuck)", () => {
    expect(explanations("'a' + (1+2j)").pop()).toBe("Evaluation stuck");
    expect(result("'a' + (1+2j)")).toContain("TypeError");
  });

  test("a pair may hold a complex element, formatted like any other pair element", () => {
    expect(result("pair(1+2j, 2)")).toBe("[(1+2j), 2]");
    expect(result("str(pair(1+2j, 2))")).toBe("'[(1+2j), 2]'");
  });

  test("complex arithmetic composes with user code", () => {
    expect(result("f = lambda z: z * z\nf(1+1j)")).toBe("2j");
  });
});
