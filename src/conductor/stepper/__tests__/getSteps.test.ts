import { parse } from "../../../parser";
import { evaluatePython, getPythonSteps } from "../getSteps";
import { preprocessPython } from "../preprocess";

function preprocess(src: string) {
  return preprocessPython(parse(src + "\n"));
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
  test("math constants reduce to their float value", () => {
    expect(result("math_pi")).toBe(String(Math.PI));
    expect(result("math_e")).toBe(String(Math.E));
    expect(result("math_tau")).toBe(String(2 * Math.PI));
    expect(result("math_inf")).toBe("inf");
    expect(result("math_nan")).toBe("nan");
  });

  test("a constant is substituted before it is used", () => {
    expect(result("math_pi * 0")).toBe("0.0");
    // The reduction shows the constant resolving to its value.
    expect(explanations("math_pi")).toContain(`math_pi is ${Math.PI}`);
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
    expect(explanations("math_sqrt(9)")).toContain("math_sqrt runs");
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
    expect(preprocess("undefined_name")).toBe("NameError: name 'undefined_name' is not defined");
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
      "NameError: name 'missing' is not defined",
    );
    expect(preprocess("f = lambda x: x + y")).toBe("NameError: name 'y' is not defined");
  });

  test("a recursive call resolves (the function name is in scope)", () => {
    expect(
      preprocess("def fact(n):\n  return 1 if n == 0 else n * fact(n - 1)\nfact(3)"),
    ).toBeNull();
  });

  test("a name bound only inside an if-branch is in module scope", () => {
    expect(preprocess("if True:\n  x = 1\nelse:\n  x = 2\nx + 1")).toBeNull();
  });

  test("a name used before its assignment still counts as defined (hoisted scope)", () => {
    // Python module scope is not order-sensitive for *definedness* (this is not a NameError).
    expect(preprocess("y = x\nx = 5")).toBeNull();
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
    expect(explanations("1 + 2")).toContain("Binary expression 1 + 2 evaluated");
  });

  test("function declaration and application", () => {
    const e = explanations("def square(n):\n  return n * n\nsquare(4)");
    expect(e).toContain("Function square declared, parameter(s) n required");
    expect(e).toContain("4 substituted into n of square");
  });

  test("name binding", () => {
    expect(explanations("x = 5\nx")).toContain(
      "x declared and substituted into the rest of the program",
    );
  });

  test("if statement", () => {
    expect(explanations("if 1 < 2:\n  x = 1\nelse:\n  x = 2\nx")).toContain(
      "If statement evaluated, condition true, proceed to if block",
    );
  });

  test("short-circuit and conditional", () => {
    expect(explanations("True and False")).toContain(
      "AND operation evaluated, left of operator is truthy, continue evaluating right of operator",
    );
    expect(explanations("1 if 2 > 1 else 9")).toContain(
      "Conditional expression evaluated, condition is true, consequent evaluated",
    );
  });
});
