import { DataType, type TypedValue } from "@sourceacademy/conductor/types";
import { ModuleLoaderRunnerPlugin } from "@sourceacademy/runner-module-loader";

import { markBreakpoints } from "../../../breakpoints";
import { parse } from "../../../parser";
import { GenericDataHandler } from "../../GenericDataHandler";
import {
  emptyList,
  expressionStatement,
  identifier,
  literal,
  pairNode,
  type StepNode,
} from "../ast";
import { isBuiltinConstantName } from "../builtins";
import { evaluatePython, getPythonSteps } from "../getSteps";
import { formatPrintLlistOutput } from "../lists";
import { preprocessPython } from "../preprocess";

/** A fake `IModulePlugin` export — mirrors `src/tests/py2js-from-import.test.ts`'s identical type. */
type FakeExport = { symbol: string; value: TypedValue<DataType> };

// `chapter` defaults to 2 so the existing §2 (list-library) tests resolve those names; the
// chapter-gating tests pass an explicit chapter (1 to forbid §2 names, 2 to allow them).
function preprocess(src: string, chapter = 2) {
  const script = src + "\n";
  return preprocessPython(parse(script), script, chapter);
}

async function steps(src: string) {
  return getPythonSteps(parse(src + "\n"));
}

async function result(src: string) {
  return evaluatePython(parse(src + "\n"));
}

async function explanations(src: string) {
  return (await steps(src)).map(s => s.markers?.[0]?.explanation ?? "");
}

/** The program's cumulative output (everything print/print_llist has written) on its last step; see
 * the "cumulative print output per step" describe block below for the field's full behaviour. */
async function finalOutput(src: string): Promise<string | undefined> {
  const s = await steps(src);
  return (s[s.length - 1] as { output?: string }).output;
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
  test("arithmetic respects precedence", async () => {
    expect(await result("1 + 2 * 3")).toBe("7");
  });

  test("true division yields a float repr", async () => {
    expect(await result("7 / 2")).toBe("3.5");
    expect(await result("4 / 2")).toBe("2.0");
  });

  test("floor division and modulo", async () => {
    expect(await result("7 // 2")).toBe("3");
    expect(await result("7 % 3")).toBe("1");
  });

  test("power", async () => {
    expect(await result("2 ** 10")).toBe("1024");
  });

  test("comparisons produce Python booleans", async () => {
    expect(await result("1 < 2")).toBe("True");
    expect(await result("2 == 3")).toBe("False");
  });

  test("assignment binds by substitution", async () => {
    expect(await result("x = 5\nx + 1")).toBe("6");
  });

  test("lambda application", async () => {
    expect(await result("f = lambda x: x + 1\nf(10)")).toBe("11");
  });

  test("function definition application", async () => {
    expect(await result("def square(n):\n  return n * n\nsquare(4)")).toBe("16");
  });

  test("a multi-statement body with if/else reduces to the taken return", async () => {
    const f = "def f(x):\n  if x == 1:\n    return x + 1\n  else:\n    return x + 2\n";
    expect(await result(f + "f(2)")).toBe("4");
    expect(await result(f + "f(1)")).toBe("2");
  });

  test("a body with a local binding before the return", async () => {
    expect(await result("def g(x):\n  y = x + 1\n  return y * 2\ng(3)")).toBe("8");
  });

  test("a function that falls off the end evaluates to None", async () => {
    expect(await result("def noop(x):\n  pass\nnoop(5)")).toBe("None");
  });

  test("a bare `return` yields None", async () => {
    expect(
      await result("def early(x):\n  if x > 0:\n    return\n  else:\n    return x\nearly(3)"),
    ).toBe("None");
  });

  test("recursion (a function may call itself)", async () => {
    const fact = "def fact(n):\n  return 1 if n == 0 else n * fact(n - 1)\n";
    expect(await result(fact + "fact(0)")).toBe("1");
    expect(await result(fact + "fact(4)")).toBe("24");
    // A recursive call renders as a compact mu-term (carries the function name), not an inline body.
    const recursiveCall = (await steps(fact + "fact(3)")).some(s =>
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

  test("ternary selects a branch", async () => {
    expect(await result("1 if 2 > 1 else 99")).toBe("1");
    expect(await result("1 if 2 < 1 else 99")).toBe("99");
  });

  test("if-statement selects a branch and binds", async () => {
    expect(await result("if 1 < 2:\n  x = 10\nelse:\n  x = 20\nx + 1")).toBe("11");
  });

  test("unary negation and not", async () => {
    expect(await result("-5 + 2")).toBe("-3");
    expect(await result("not (1 < 2)")).toBe("False");
  });
});

describe("Python stepper — short-circuit", () => {
  test("`and` returns the right operand when the left is truthy", async () => {
    expect(await result("True and (1 < 2)")).toBe("True");
  });

  test("`and` short-circuits on a falsy left without touching the right", async () => {
    // `undefined_name` is a free variable; it must never be reduced.
    expect(await result("False and undefined_name")).toBe("False");
  });

  test("`or` short-circuits on a truthy left", async () => {
    expect(await result("True or undefined_name")).toBe("True");
  });
});

describe("Python stepper — built-in functions and constants", () => {
  test("math constants evaluate to their float value", async () => {
    expect(await result("math_pi")).toBe(String(Math.PI));
    expect(await result("math_e")).toBe(String(Math.E));
    expect(await result("math_tau")).toBe(String(2 * Math.PI));
    expect(await result("math_inf")).toBe("inf");
    expect(await result("math_nan")).toBe("nan");
  });

  test("a constant is substituted in before stepping (renders as its value, not the name)", async () => {
    expect(await result("math_pi * 0")).toBe("0.0");
    // Mirrors js-slang's substitution stepper: the constant is replaced up front, so there is no
    // "math_pi is …" contraction step and the first rendered program already shows the value.
    expect((await explanations("math_pi")).some(e => e.includes("math_pi is"))).toBe(false);
    const firstAst = (await steps("math_pi"))[0].ast as unknown;
    expect(
      findNode(firstAst, n => n.type === "Identifier" && n.name === "math_pi"),
    ).toBeUndefined();
    expect(findNode(firstAst, n => n.type === "Literal")).toBeDefined();
  });

  test("math functions compute on value arguments", async () => {
    expect(await result("math_sqrt(16)")).toBe("4.0");
    expect(await result("math_floor(3.7)")).toBe("3");
    expect(await result("math_ceil(3.2)")).toBe("4");
    expect(await result("math_trunc(-3.7)")).toBe("-3");
    expect(await result("math_factorial(5)")).toBe("120");
    expect(await result("math_gcd(12, 18)")).toBe("6");
    expect(await result("math_log(1)")).toBe("0.0");
    expect(await result("math_isnan(math_nan)")).toBe("True");
  });

  test('math function call explanation is "<name> runs"', async () => {
    expect(await explanations("math_sqrt(9)")).toContain("Running math_sqrt");
  });

  test("numeric MISC builtins", async () => {
    expect(await result("abs(-5)")).toBe("5");
    expect(await result("abs(-2.5)")).toBe("2.5");
    expect(await result("round(2.5)")).toBe("2"); // banker's rounding
    expect(await result("round(3.5)")).toBe("4");
    expect(await result("round(3.14159, 2)")).toBe("3.14");
    expect(await result("max(1, 7, 3)")).toBe("7");
    expect(await result("min(4, 2, 9)")).toBe("2");
    expect(await result('len("hello")')).toBe("5");
  });

  // Unlike CPython's max()/min(), which accept a single iterable argument
  // (max([1, 2, 3]) == 3), this dialect's max/min always require >= 2 direct
  // arguments -- there is no single-iterable form. A pair is a two-element
  // Python list under the hood, so max(pair(1, 5)) is the borderline case:
  // it *looks* like the single-iterable form CPython supports, but is
  // rejected the same way max(5) is, since it's still just one argument.
  test("max/min require at least 2 direct arguments — no single-iterable form", async () => {
    expect((await explanations("max(5)")).pop()).toBe("Evaluation stuck");
    expect((await explanations("min(5)")).pop()).toBe("Evaluation stuck");
    expect(await result("max(5)")).toContain("takes at least 2 argument(s) but 1 were given");
    expect((await explanations("max(pair(1, 5))")).pop()).toBe("Evaluation stuck");
    expect(await result("max(pair(1, 5))")).toContain(
      "takes at least 2 argument(s) but 1 were given",
    );
    expect(await result("arity(max)")).toBe("2");
    expect(await result("arity(min)")).toBe("2");
  });

  test("type conversions", async () => {
    expect(await result("str(42)")).toBe("'42'");
    expect(await result('repr("hi")')).toBe("\"'hi'\"");
  });

  test("type predicates", async () => {
    expect(await result("is_integer(5)")).toBe("True");
    expect(await result("is_float(5)")).toBe("False");
    expect(await result("is_float(5.0)")).toBe("True");
    expect(await result('is_string("a")')).toBe("True");
    expect(await result("is_boolean(True)")).toBe("True");
    expect(await result("is_none(None)")).toBe("True");
    expect(await result("is_function(abs)")).toBe("True");
    expect(await result("is_function(math_sqrt)")).toBe("True");
    expect(await result("is_complex(3)")).toBe("False");
    expect(await result("is_number(5)")).toBe("True");
    expect(await result("is_number(5.0)")).toBe("True");
    expect(await result("is_number(1+2j)")).toBe("True");
    expect(await result("is_number(True)")).toBe("False");
    expect(await result('is_number("a")')).toBe("False");
  });

  test("arity reports parameter counts", async () => {
    expect(await result("arity(lambda x, y: x + y)")).toBe("2");
    expect(await result("def f(a, b, c):\n  return a\narity(f)")).toBe("3");
  });

  test("builtins compose with user code and arithmetic", async () => {
    expect(await result("abs(-3) + math_floor(2.9)")).toBe("5");
    expect(await result('len("ab") * 3')).toBe("6");
    expect(await result("f = lambda x: abs(x)\nf(-8)")).toBe("8");
  });

  test("print returns None", async () => {
    expect(await result('print("hi")')).toBe("None");
  });

  test("error() and misuse make evaluation stuck", async () => {
    expect((await explanations('error("boom")')).pop()).toBe("Evaluation stuck");
    expect((await explanations('abs("text")')).pop()).toBe("Evaluation stuck"); // TypeError
    expect((await explanations("math_sqrt(1, 2)")).pop()).toBe("Evaluation stuck"); // wrong arity
  });

  test("a bare built-in function name is a value (complete, not stuck)", async () => {
    expect((await explanations("abs")).pop()).toBe("Evaluation complete");
    expect((await explanations("math_sqrt")).pop()).toBe("Evaluation complete");
  });

  test("unsupported interactive builtins stay stuck", async () => {
    // random_random / time_time are intentionally not modelled by the stepper — unlike input()
    // (py-slang#191, see the "input()" describe block below), there's no real host capability for
    // "the current time"/"a random number" to round-trip through, so these stay genuinely absent
    // rather than degrading gracefully for a missing capability.
    expect((await explanations("random_random()")).pop()).toBe("Evaluation stuck");
  });

  test("input() with no requestInput wired up degrades to stuck, not a hard error", async () => {
    // Mirrors an unresolved ModuleFunction call with no evaluator: the name resolves fine (input is
    // in the preprocessing vocabulary — see getAvailableBuiltinNames), but actually placing the call
    // has nothing to round-trip through, so it simply doesn't finish — the same honest degrade as
    // the interactive builtins above, not the hard "not defined" error a missing module import gets
    // (an import is always resolvable in principle; a host with no requestInput wired up is a real,
    // if unusual, configuration, not a student mistake).
    expect((await explanations('input("name? ")')).pop()).toBe("Evaluation stuck");
  });

  test("a bare 'input' name is a value (complete, not stuck)", async () => {
    expect((await explanations("input")).pop()).toBe("Evaluation complete");
  });
});

describe("Python stepper — input() (py-slang#191)", () => {
  test("resolves the mocked answer as a Python string, and evaluation completes", async () => {
    const requestInput = jest.fn(() => Promise.resolve("Ada"));
    const ast = parse('input("Write your string here: ")\n');
    const allSteps = await getPythonSteps(ast, undefined, { requestInput });
    expect(allSteps.at(-1)?.markers?.[0]?.explanation).toBe("Evaluation complete");
    expect(requestInput).toHaveBeenCalledWith("Write your string here: ");
  });

  test("the answer is usable like any other string — printed, concatenated", async () => {
    const requestInput = jest.fn(() => Promise.resolve("Ada"));
    const ast = parse('print(input("Write your string here: "))\n');
    const allSteps = await getPythonSteps(ast, undefined, { requestInput });
    // Output is cumulative (see "cumulative print output per step" above), so the prompt itself is
    // still there ahead of the print's own output.
    expect((allSteps.at(-1) as { output?: string } | undefined)?.output).toBe(
      "Write your string here: Ada\n",
    );
  });

  test("the prompt appears as this call's own output, with no trailing newline (unlike print)", async () => {
    // Matches CPython's input(prompt): the prompt is written to stdout exactly as given, with no
    // newline appended — the answer that follows is expected on the same line in a real terminal.
    // Mirrors the CSE machine's own displayOutput(context, prompt) call — see streams.ts.
    const requestInput = jest.fn(() => Promise.resolve("answer"));
    const ast = parse('input("Name: ")\n');
    const allSteps = await getPythonSteps(ast, undefined, { requestInput });
    const ranStep = allSteps.find(s => s.markers?.[0]?.explanation === "Ran input");
    expect(ranStep).toBeDefined();
    expect((ranStep as unknown as { output?: string }).output).toBe("Name: ");
  });

  test("input() with no argument writes nothing and calls requestInput with undefined", async () => {
    const requestInput = jest.fn(() => Promise.resolve("hi"));
    const ast = parse("input()\n");
    const allSteps = await getPythonSteps(ast, undefined, { requestInput });
    expect(requestInput).toHaveBeenCalledWith(undefined);
    expect(allSteps.some(s => (s as { output?: string }).output)).toBe(false);
  });

  test("a non-string prompt is converted via str() before being sent", async () => {
    const requestInput = jest.fn(() => Promise.resolve(""));
    await getPythonSteps(parse("input(5)\n"), undefined, { requestInput });
    expect(requestInput).toHaveBeenCalledWith("5");
  });

  test("multiple input() calls are answered in program order, one prompt per call", async () => {
    const answers = ["Ada", "Grace"];
    const requestInput = jest.fn(() => Promise.resolve(answers.shift()!));
    const ast = parse('x = input("first: ")\ny = input("second: ")\nx + y\n');
    expect(await evaluatePython(ast, undefined, { requestInput })).toBe("'AdaGrace'");
    expect(requestInput).toHaveBeenNthCalledWith(1, "first: ");
    expect(requestInput).toHaveBeenNthCalledWith(2, "second: ");
  });

  test("wrong arity is a proper TypeError, and never reaches requestInput", async () => {
    const requestInput = jest.fn();
    const ast = parse('input("a", "b")\n');
    const allSteps = await getPythonSteps(ast, undefined, { requestInput });
    expect(allSteps.at(-2)?.markers?.[0]?.explanation).toBe(
      "TypeError: input() takes 0 to 1 argument(s) but 2 were given",
    );
    expect(allSteps.at(-1)?.markers?.[0]?.explanation).toBe("Evaluation stuck");
    expect(requestInput).not.toHaveBeenCalled();
  });

  test("aliasing works, like every other built-in: p = input; p(...)", async () => {
    const requestInput = jest.fn(() => Promise.resolve("aliased"));
    const ast = parse('p = input\np("prompt")\n');
    expect(await evaluatePython(ast, undefined, { requestInput })).toBe("'aliased'");
    expect(requestInput).toHaveBeenCalledWith("prompt");
  });

  test("arity(input) is 0 (an optional prompt, like print's own optional arguments)", async () => {
    expect(await evaluatePython(parse("arity(input)\n"))).toBe("0");
  });

  test("is_function(input) is True", async () => {
    expect(await evaluatePython(parse("is_function(input)\n"))).toBe("True");
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
        "              ^^^^^^^ This name is not found in the current or enclosing environment(s).",
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
        "       Perhaps you meant to type 'print'?",
    );
    expect(preprocess("map(lambda x: x, None)", 1)).toBe(
      "NameNotFoundError at line 1\n                   \nmap(lambda x: x, None)\n" +
        " ^^^ This name is not found in the current or enclosing environment(s).\n" +
        "     Perhaps you meant to type 'max'?",
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
    expect(preprocess("complex(1) + round(2.5)", 1)).toBeNull(); // complex/str conversions stay in §1
    expect(preprocess("x = 5\nx + 1", 1)).toBeNull();
  });

  test("the same §2 names resolve once Python §2 is selected", () => {
    expect(preprocess("pair(1, 2)", 2)).toBeNull();
    expect(preprocess("head(pair(1, 2))", 2)).toBeNull();
    expect(preprocess("map(lambda x: x, llist(1, 2))", 2)).toBeNull();
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
  test('begins with a "Start of evaluation" step and alternates before/after', async () => {
    const e = await explanations("1 + 2 * 3");
    expect(e[0]).toBe("Start of evaluation");
    const s = await steps("1 + 2 * 3");
    expect(s[1].markers?.[0]?.redexType).toBe("beforeMarker");
    expect(s[2].markers?.[0]?.redexType).toBe("afterMarker");
  });

  test("innermost redex reduces first (2 * 3 before 1 + 6)", async () => {
    const e = await explanations("1 + 2 * 3");
    expect(e[1]).toContain("2 * 3");
    expect(e[3]).toContain("1 + 6");
  });

  test("every before-marker redexId resolves to a node in that step AST", async () => {
    for (const step of await steps("1 + 2 * 3\nx = 4\nx * x")) {
      const marker = step.markers?.[0];
      if (marker?.redexId != null) {
        expect(nodeIds(step.ast).has(marker.redexId)).toBe(true);
      }
    }
  });

  test("serialized steps are structured-clone safe (survive the channel)", async () => {
    const s = await steps("f = lambda x: x + 1\nf(10)");
    expect(() => structuredClone(s)).not.toThrow();
  });

  test("the serialized AST is estree-shaped for the host renderer", async () => {
    const ast = (await steps("1 + 2"))[0].ast as any;
    expect(ast.type).toBe("Program");
    expect(ast.body[0].type).toBe("ExpressionStatement");
    expect(ast.body[0].expression.type).toBe("BinaryExpression");
    expect(ast.body[0].expression).toMatchObject({ operator: "+" });
  });

  test('closes with a terminal "Evaluation complete" step, like Source', async () => {
    const e = await explanations("1 + 2");
    expect(e[e.length - 1]).toBe("Evaluation complete");
  });

  test("the final line's value disappears before completion (a program yields no value)", async () => {
    // Unlike Source/js-slang, a Python program has no value: the last line's value is discarded just
    // like every other line's, so the run ends on an *empty* program rather than lingering on it. The
    // discard step's own after-step already shows it gone — matching the following (terminal) step, per
    // the after == next-before invariant (see `ReduceResult.node`'s doc comment); see "a discard's after
    // step already shows the redex gone" below for the fully worked-out step sequence.
    const e = await explanations("1 + 1");
    expect(e[e.length - 1]).toBe("Evaluation complete");
    expect(e[e.length - 2]).toBe("Evaluated 2"); // the discard step's after step
    expect(e[e.length - 3]).toBe("Evaluating 2"); // ...and its before step

    const s = await steps("1 + 1");
    const lastVisible = s[s.length - 2].ast as any; // the "Evaluated 2" after step
    expect(lastVisible.body).toHaveLength(0); // "2" is already gone, same as the terminal step
    const terminal = s[s.length - 1].ast as any;
    expect(terminal.type).toBe("Program");
    expect(terminal.body).toHaveLength(0); // nothing rendered at completion

    // A program ending in an assignment already completed empty; the two now behave identically.
    const assign = await steps("x = 1");
    expect((assign[assign.length - 1].ast as any).body).toHaveLength(0);

    // The REPL still echoes the final value, even though the stepper never lingers on it.
    expect(await result("1 + 1")).toBe("2");
  });

  test("a discard's after step already shows the redex gone", async () => {
    // The user-facing spec this implements: every contraction's before-step reads "… evaluating" (about
    // to happen) and its after-step reads "… evaluated" (just happened) — and a contraction that
    // discards a whole finished statement (an evaluated expression, a name binding, `pass`, an inlined
    // `if` branch) shows it *already gone* on its own after-step, identical to the following
    // contraction's before-step; only the highlighted redex (and its color) differs between the two.
    // Worked out fully for "1 + 1\n1 + 2\n" (ten steps total).
    const e = await explanations("1 + 1\n1 + 2");
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

    const s = await steps("1 + 1\n1 + 2");
    const bodyLengths = s.map(step => (step.ast as any).body.length);
    // Step 5 (index 4, the "Evaluated 2" after step) already has just the one remaining statement — "2"
    // is discarded on its own step, not the next — and step 9 (index 8, "Evaluated 3") is already empty
    // for the same reason, matching the terminal step right after it.
    expect(bodyLengths).toEqual([2, 2, 2, 2, 1, 1, 1, 1, 0, 0]);
  });
});

describe('Python stepper — runtime errors end with "Evaluation stuck"', () => {
  test("a thrown runtime error (division by zero) ends stuck and shows the message", async () => {
    const e = await explanations("7 // 0");
    expect(e[e.length - 1]).toBe("Evaluation stuck");
    // The penultimate step explains why it is stuck.
    expect(e[e.length - 2]).toContain("ZeroDivisionError");
  });

  test("a runtime error inside a function body ends stuck", async () => {
    expect((await explanations("def f(x):\n  return x // 0\nf(5)")).pop()).toBe("Evaluation stuck");
  });

  test("calling a non-function is stuck, not complete", async () => {
    expect((await explanations("5(3)")).pop()).toBe("Evaluation stuck");
  });

  test("an unbound name left over is stuck, not a value", async () => {
    expect((await explanations("undefined_name + 1")).pop()).toBe("Evaluation stuck");
  });

  test('a successful run still ends "Evaluation complete"', async () => {
    expect((await explanations("def f(x):\n  return x + 1\nf(4)")).pop()).toBe(
      "Evaluation complete",
    );
    expect((await explanations("7 // 2")).pop()).toBe("Evaluation complete");
  });

  test("evaluatePython surfaces a runtime error as its message (never throws)", async () => {
    // A runtime fault (as opposed to a preprocessing/import error — see getSteps.ts's own doc comment
    // on `evaluatePython`) resolves to a message string; it must never reject.
    await expect(result("7 // 0")).resolves.toContain("ZeroDivisionError");
  });

  test("short-circuit still completes (the dead operand is never reached)", async () => {
    expect((await explanations("False and undefined_name")).pop()).toBe("Evaluation complete");
  });
});

describe("Python stepper — a runtime error is named in the step before the stuck step", () => {
  // Like ZeroDivisionError, the specific error appears as the step immediately before the terminal
  // "Evaluation stuck" (the driver turns a thrown error into a beforeMarker step then the stuck step).
  // This covers the errors the reducer used to swallow into a bare, message-less "Evaluation stuck".
  const errorStep = async (src: string): Promise<string | undefined> => {
    const e = await explanations(src);
    expect(e[e.length - 1]).toBe("Evaluation stuck");
    return e[e.length - 2];
  };

  test("calling a non-callable value reports a TypeError", async () => {
    expect(await errorStep("5(3)")).toBe("TypeError: 'int' object is not callable");
    expect(await errorStep("(3.5)(1)")).toBe("TypeError: 'float' object is not callable");
    expect(await errorStep("None()")).toBe("TypeError: 'NoneType' object is not callable");
    expect(await errorStep('"hi"()')).toBe("TypeError: 'str' object is not callable");
  });

  test("wrong number of arguments to a user function reports a TypeError", async () => {
    expect(await errorStep("f = lambda x: x\nf(1, 2)")).toBe(
      "TypeError: f() takes 1 argument(s) but 2 were given",
    );
    expect(await errorStep("def g(a, b):\n  return a + b\ng(1)")).toBe(
      "TypeError: g() takes 2 argument(s) but 1 were given",
    );
    expect(await errorStep("(lambda a: a)(1, 2, 3)")).toBe(
      "TypeError: <lambda>() takes 1 argument(s) but 3 were given",
    );
  });

  test("unsupported binary operand types report a TypeError", async () => {
    expect(await errorStep('1 + "a"')).toBe(
      "TypeError: unsupported operand type(s) for +: 'int' and 'str'",
    );
    expect(await errorStep('"a" - "b"')).toBe(
      "TypeError: unsupported operand type(s) for -: 'str' and 'str'",
    );
    expect(await errorStep("None + 1")).toBe(
      "TypeError: unsupported operand type(s) for +: 'NoneType' and 'int'",
    );
    expect(await errorStep("x = lambda a: a\nx - 1")).toBe(
      "TypeError: unsupported operand type(s) for -: 'function' and 'int'",
    );
  });

  test("unsupported ordering comparisons report a TypeError", async () => {
    expect(await errorStep("None < 1")).toBe(
      "TypeError: '<' not supported between instances of 'NoneType' and 'int'",
    );
    expect(await errorStep('1 < "a"')).toBe(
      "TypeError: '<' not supported between instances of 'int' and 'str'",
    );
  });

  test("unary minus/plus on a non-numeric reports a TypeError", async () => {
    expect(await errorStep('-"a"')).toBe("TypeError: bad operand type for unary -: 'str'");
    expect(await errorStep("-None")).toBe("TypeError: bad operand type for unary -: 'NoneType'");
  });

  test("legal-but-unmodelled operations stay a silent stuck (never a false error)", async () => {
    // These are valid Python the teaching stepper just does not evaluate (string repetition,
    // %-formatting); they must remain a plain "Evaluation stuck" with no TypeError step. (String
    // ordering, unlike these, *is* modelled — see "string ordering (< > <= >=)" below.)
    for (const src of ['"ab" * 2', '2 * "ab"', '"a" % "b"']) {
      const e = await explanations(src);
      expect(e[e.length - 1]).toBe("Evaluation stuck");
      expect(e.some(x => x.includes("TypeError"))).toBe(false);
    }
  });

  test("the REPL value surfaces the same error message", async () => {
    expect(await result("5(3)")).toBe("TypeError: 'int' object is not callable");
    expect(await result('1 + "a"')).toBe(
      "TypeError: unsupported operand type(s) for +: 'int' and 'str'",
    );
  });
});

describe("Python stepper — function values render as mu-terms (not inline bodies)", () => {
  // A substituted `def` must NOT expand its whole body at every use: it is substituted as a *named*
  // value (the `name` marker) so the host collapses it to a hoverable mu-term, exactly like Source.
  test("a def is substituted as a named function value, not expanded inline", async () => {
    const s = await steps("def square(n):\n  return n * n\nsquare(4)");

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

  test("a lambda bound to a name is substituted as a named function value", async () => {
    const s = await steps("f = lambda x: x + 1\nf(10)");

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

  test("an anonymous lambda argument stays anonymous (rendered inline)", async () => {
    const lambda = findNode(
      (await steps("(lambda x: x + 1)(5)"))[0].ast,
      n => n.type === "ArrowFunctionExpression",
    );
    expect(lambda.name).toBeUndefined();
  });
});

describe("Python stepper — a binding's substitution is visible on its own step, and the binding is already gone", () => {
  // A name binding (`VariableDeclaration`/`FunctionDeclaration`) substitutes its value into the rest of
  // the block *and* disappears on the same contraction that declares it — matching how a call
  // expression's argument substitution is already visible on its own "Substituted ..." step
  // (`contractCall`), and how every other statement-discarding contraction (`pass`, an inlined `if`
  // branch, a finished top-level expression) leaves nothing lingering on its own after-step (see
  // `ReduceResult.node`'s doc comment on the after == next-before invariant).

  test("a variable's bound value already appears in the rest, and the declaration is already gone, on its own 'Declared and substituted' step", async () => {
    const s = await steps("x = 5\nx + 1");
    const i = s.findIndex(
      step =>
        step.markers?.[0]?.explanation === "Declared and substituted x into the rest of the block",
    );
    expect(i).toBeGreaterThan(-1);

    // The declaration is already gone on this same after-step...
    expect(findNode(s[i].ast, n => n.type === "VariableDeclaration")).toBeUndefined();
    // ...and the rest's binary expression already has the literal substituted in, not a reference.
    const bin = findNode(s[i].ast, n => n.type === "BinaryExpression");
    expect(bin.left).toMatchObject({ type: "Literal", raw: "5" });

    // The following before-step shows the identical (declaration-free) tree — only the highlight moves.
    expect(s[i + 1].ast).toEqual(s[i].ast);
  });

  test("a def's mu-term already appears in the rest, and the declaration is already gone, on its own 'Declared and substituted' step", async () => {
    const s = await steps("def square(n):\n  return n * n\nsquare(4)");
    const i = s.findIndex(
      step =>
        step.markers?.[0]?.explanation ===
        "Declared and substituted square into the rest of the block",
    );
    expect(i).toBeGreaterThan(-1);

    // The declaration site (its full, un-named form) is already gone on this same after-step...
    expect(
      findNode(s[i].ast, n => n.type === "FunctionDeclaration" && n.name === undefined),
    ).toBeUndefined();
    // ...and the call in the rest already shows `square` substituted as the named mu-term value.
    const call = findNode(s[i].ast, n => n.type === "CallExpression");
    expect(call.callee).toMatchObject({ type: "FunctionDeclaration", name: "square" });

    // The following before-step shows the identical (declaration-free) tree — only the highlight moves.
    expect(s[i + 1].ast).toEqual(s[i].ast);
  });

  test("a local binding inside a function body substitutes into the rest on the same step", async () => {
    // def f(x):
    //   y = x + 1
    //   return y
    // f(1)
    const s = await steps("def f(x):\n  y = x + 1\n  return y\nf(1)");
    const i = s.findIndex(
      step =>
        step.markers?.[0]?.explanation === "Declared and substituted y into the rest of the block",
    );
    expect(i).toBeGreaterThan(-1);

    // `y`'s declaration is already gone on this same after-step...
    expect(findNode(s[i].ast, n => n.type === "VariableDeclaration")).toBeUndefined();
    // ...and `return` already shows the substituted value, not a leftover `y` reference.
    const ret = findNode(s[i].ast, n => n.type === "ReturnStatement");
    expect(ret.argument).toMatchObject({ type: "Literal", raw: "2" });

    // The following before-step shows the identical (declaration-free) tree — only the highlight moves.
    expect(s[i + 1].ast).toEqual(s[i].ast);
  });
});

describe("Python stepper — explanations mirror Source phrasing", () => {
  test("binary expression", async () => {
    expect(await explanations("1 + 2")).toContain("Evaluated binary expression 1 + 2");
  });

  test("function declaration and application", async () => {
    const e = await explanations("def square(n):\n  return n * n\nsquare(4)");
    expect(e).toContain("Declaring and substituting square into the rest of the block");
    expect(e).toContain("Substituted 4 into n of square");
  });

  test("name binding", async () => {
    expect(await explanations("x = 5\nx")).toContain(
      "Declared and substituted x into the rest of the block",
    );
  });

  test("if statement", async () => {
    expect(await explanations("if 1 < 2:\n  x = 1\nelse:\n  x = 2\nx")).toContain(
      "Evaluated if statement, condition true, will proceed to if block",
    );
  });

  test("short-circuit and conditional", async () => {
    expect(await explanations("True and False")).toContain(
      "Evaluated AND expression, left of operator is truthy, will evaluate right of operator",
    );
    expect(await explanations("1 if 2 > 1 else 9")).toContain(
      "Evaluated conditional expression, condition is true, will evaluate consequent",
    );
  });
});

describe("Python stepper — a built-in used as a bare value displays as Builtin (py-slang#404)", () => {
  // `reduce.ts` never sees this distinction — it keeps reducing a built-in name as a plain "Identifier"
  // throughout, exactly as before; only `getSteps.ts`'s serialization relabels a *surviving* one
  // "Builtin" for display, giving the host a node it can hang a hover popover off (see
  // syntaxProfile.ts's `hoverText` rule) without changing anything about how the program evaluates.

  test("a built-in passed around as a value (not called) is a Builtin node with hover text", async () => {
    const s = await steps("is_function(print)");
    const printArg = findNode(s[0].ast, n => n.type === "Builtin" && n.name === "print");
    expect(printArg).toBeDefined();
    expect(printArg.hoverText).toBe("built-in function print");

    // The call's own callee (`is_function`) is exactly the same kind of node, for the same reason.
    const callee = findNode(s[0].ast, n => n.type === "Builtin" && n.name === "is_function");
    expect(callee).toBeDefined();
    expect(callee.hoverText).toBe("built-in function is_function");
  });

  test("a called built-in's callee is also a Builtin node (not just a bare-value reference)", async () => {
    const s = await steps("print(1)");
    const callee = findNode(s[0].ast, n => n.type === "CallExpression").callee;
    expect(callee).toMatchObject({ type: "Builtin", name: "print" });
  });

  test("a program never using a built-in name has no Builtin nodes at all", async () => {
    const s = await steps("x = 1\nx + 2");
    for (const step of s) {
      expect(findNode(step.ast, n => n.type === "Builtin")).toBeUndefined();
    }
  });

  test("shadowing a built-in name with a local def hides the builtin, not just its name", async () => {
    // Once the local `print` has been declared-and-substituted, every remaining occurrence of the name
    // `print` in the rest of the program is that local FunctionDeclaration/mu-term, not the builtin —
    // so it should never again display as "Builtin" (see the describe block's shadowing-safety note).
    // `is_function` is a different, unshadowed name and legitimately keeps displaying as "Builtin" once
    // the local `print` is actually called and its body is substituted in — this test only asserts about
    // the shadowed name itself, not about every "Builtin" node in these steps.
    const s = await steps("def print(x):\n  return is_function(print)\nprint(1)");
    const i = s.findIndex(
      step =>
        step.markers?.[0]?.explanation ===
        "Declared and substituted print into the rest of the block",
    );
    expect(i).toBeGreaterThan(-1);
    for (const step of s.slice(i)) {
      expect(findNode(step.ast, n => n.type === "Builtin" && n.name === "print")).toBeUndefined();
    }
    // Somewhere in the run, the recursive `print` inside the body renders as the mu-term (a
    // FunctionDeclaration value) — confirming it really did get substituted, not just left as a plain
    // Identifier that happened to dodge relabeling.
    expect(
      s.some(step =>
        findNode(step.ast, n => n.type === "FunctionDeclaration" && n.name === "print"),
      ),
    ).toBe(true);
  });

  test("a later sibling statement referencing a not-yet-declared shadowing name is never mislabelled, even at step 0", async () => {
    // At "Start of evaluation" nothing has been substituted yet, so a generic child-by-child walk would
    // have no way to know the second statement's `print` is about to be shadowed by the first — see
    // markBuiltins's doc comment on why Program/BlockStatement are walked left to right instead.
    const s = await steps("def print(x):\n  return is_function(print)\nprint(1)");
    expect(s[0].markers?.[0]?.explanation).toBe("Start of evaluation");
    expect(findNode(s[0].ast, n => n.type === "Builtin" && n.name === "print")).toBeUndefined();
  });

  test("a VariableDeclaration's own declared name is never mislabelled, even before its declaring statement is processed", async () => {
    // Two distinct risks in one program: `print` shadowed by a local assignment (not a `def`), and that
    // shadowing happening *inside* a function body, both checked at step 0 (nothing substituted yet).
    const s = await steps("def f():\n  print = 5\n  return print\nf()");
    expect(s[0].markers?.[0]?.explanation).toBe("Start of evaluation");
    expect(findNode(s[0].ast, n => n.type === "Builtin" && n.name === "print")).toBeUndefined();
  });
});

describe("Python stepper — a §2 library function used as a value gets a real Function definition popup (py-slang#405)", () => {
  // Unlike a true native builtin (`print`, `head`, `pair`, …), a §2 pre-declared list-library function
  // (`map`, `_map`, `llist_ref`, …) has a real Python-level body (see `lists.ts`'s `library`), so it
  // must NOT get the opaque `Builtin`+hoverText treatment #404 gives true builtins — it should collapse
  // to a mu-term with the *actual* "Function definition" hover popover a user-defined function gets.
  // `applyLibrary`'s existing one-step-per-call expansion (i.e. how these functions actually evaluate)
  // is untouched by any of this — only their display when referenced as a bare value changes.

  test("llist_ref passed around as a value is a real ArrowFunctionExpression mu-term, not Builtin", async () => {
    const s = await steps("is_function(llist_ref)");
    const arg = findNode(s[0].ast, n => n.name === "llist_ref");
    expect(arg).toMatchObject({ type: "ArrowFunctionExpression", name: "llist_ref" });
    // It has a real body to hover, unlike a Builtin node.
    expect(arg.body).toBeDefined();
    expect(findNode(s[0].ast, n => n.type === "Builtin" && n.name === "llist_ref")).toBeUndefined();
  });

  test("llist_ref's own recursive self-reference stays a plain Identifier (no infinite/duplicate mu-term)", async () => {
    const s = await steps("is_function(llist_ref)");
    const value = findNode(
      s[0].ast,
      n => n.type === "ArrowFunctionExpression" && n.name === "llist_ref",
    );
    // The self-call inside its own body is left as an ordinary Identifier — the host's own existing
    // recursive-mu-term rendering (matching an Identifier's name against the enclosing function's own
    // name) handles it from here, exactly like any other recursive user-defined function.
    const selfRef = findNode(value.body, n => n.name === "llist_ref");
    expect(selfRef.type).toBe("Identifier");
  });

  test("a private helper (_map) referenced only inside map's own body is also a real, independently hoverable mu-term", async () => {
    const s = await steps("is_function(map)");
    const mapValue = findNode(
      s[0].ast,
      n => n.type === "ArrowFunctionExpression" && n.name === "map",
    );
    const helperRef = findNode(mapValue.body, n => n.name === "_map");
    expect(helperRef).toMatchObject({ type: "ArrowFunctionExpression", name: "_map" });
    expect(helperRef.body).toBeDefined();
  });

  test("a caller's local parameter of the same name as a library helper does not leak into the library template's own (lexically independent) scope", async () => {
    // `f`'s own parameter `_map` has nothing to do with the library's `_map` cross-referenced *inside*
    // `map`'s body once resolved — a library template is a global definition, not nested within
    // whatever local scope happened to be in effect at the call site that referenced it.
    const s = await steps("def f(_map):\n  return is_function(map)\nf(1)");
    const mapValue = findNode(
      s[0].ast,
      n => n.type === "ArrowFunctionExpression" && n.name === "map",
    );
    expect(mapValue).toBeDefined();
    const helperRef = findNode(mapValue.body, n => n.name === "_map");
    expect(helperRef).toMatchObject({ type: "ArrowFunctionExpression", name: "_map" });
    expect(helperRef.body).toBeDefined();
  });

  test("a public library function calling another public one (map -> _map -> reverse) resolves the whole chain", async () => {
    // `_map`'s body calls `reverse` (another *public* library function, not a `_`-prefixed helper) —
    // confirms the mu-term chain keeps resolving across a public-to-public cross-reference too, not
    // just public-to-private, and that evaluation itself (which goes through `reverse` for real) is
    // completely unaffected by this purely-for-display relabeling.
    const s = await steps("is_function(map)");
    const mapValue = findNode(
      s[0].ast,
      n => n.type === "ArrowFunctionExpression" && n.name === "map",
    );
    const mapHelper = findNode(mapValue.body, n => n.name === "_map");
    const reverseValue = findNode(mapHelper.body, n => n.name === "reverse");
    expect(reverseValue).toMatchObject({ type: "ArrowFunctionExpression", name: "reverse" });
    expect(reverseValue.body).toBeDefined();

    expect(await result("llist_to_string(map(lambda x: x + 1, llist(1, 2, 3)))")).toBe(
      "'[2, [3, [4, None]]]'",
    );
  });

  test("a called library function's callee is also the real mu-term (not Builtin)", async () => {
    const s = await steps("llist_ref(llist(1, 2, 3), 1)");
    const callee = findNode(s[0].ast, n => n.type === "CallExpression").callee;
    expect(callee).toMatchObject({ type: "ArrowFunctionExpression", name: "llist_ref" });
  });

  test("shadowing a library name with a local def hides the library function, not just its name", async () => {
    const s = await steps(
      "def llist_ref(xs, n):\n  return is_function(llist_ref)\nllist_ref(1, 1)",
    );
    const i = s.findIndex(
      step =>
        step.markers?.[0]?.explanation ===
        "Declared and substituted llist_ref into the rest of the block",
    );
    expect(i).toBeGreaterThan(-1);
    for (const step of s.slice(i)) {
      expect(
        findNode(step.ast, n => n.name === "llist_ref" && n.type === "ArrowFunctionExpression"),
      ).toBeUndefined();
    }
    // The shadowing local def's own FunctionDeclaration mu-term is what actually renders instead.
    expect(
      s.some(step =>
        findNode(step.ast, n => n.type === "FunctionDeclaration" && n.name === "llist_ref"),
      ),
    ).toBe(true);
  });

  test("a true native primitive (pair/head/tail/llist) still gets the Builtin treatment, not a library popup", async () => {
    const s = await steps("is_function(llist)");
    const arg = findNode(s[0].ast, n => n.name === "llist");
    expect(arg).toMatchObject({ type: "Builtin", hoverText: "built-in function llist" });
  });
});

describe("Python stepper — pairs and linked lists (Python §2)", () => {
  // A pair renders in box-and-pointer notation `[head, tail]`, like Source; the empty list is `None`.
  test("pair construction and accessors", async () => {
    expect(await result("pair(1, 2)")).toBe("[1, 2]");
    expect(await result("head(pair(1, 2))")).toBe("1");
    expect(await result("tail(pair(1, 2))")).toBe("2");
    expect(await result("head(tail(pair(1, pair(2, 3))))")).toBe("2");
  });

  test("pair predicates", async () => {
    expect(await result("is_pair(pair(1, 2))")).toBe("True");
    expect(await result("is_pair(5)")).toBe("False");
    expect(await result("is_pair(None)")).toBe("False");
    expect(await result("is_none(None)")).toBe("True");
    expect(await result("is_none(pair(1, 2))")).toBe("False");
  });

  test("llist builds nested pairs ending in None", async () => {
    expect(await result("llist(1, 2, 3)")).toBe("[1, [2, [3, None]]]");
    expect(await result("llist()")).toBe("None");
    expect(await result("llist(42)")).toBe("[42, None]");
  });

  test("is_llist distinguishes proper lists from improper pairs", async () => {
    expect(await result("is_llist(llist(1, 2, 3))")).toBe("True");
    expect(await result("is_llist(None)")).toBe("True");
    expect(await result("is_llist(pair(1, 2))")).toBe("False");
    expect(await result("is_llist(5)")).toBe("False");
  });

  test("length, ref and member", async () => {
    expect(await result("length(llist(1, 2, 3, 4))")).toBe("4");
    expect(await result("length(None)")).toBe("0");
    expect(await result("llist_ref(llist(10, 20, 30), 1)")).toBe("20");
    expect(await result("member(2, llist(1, 2, 3))")).toBe("[2, [3, None]]");
    expect(await result("member(9, llist(1, 2))")).toBe("None");
  });

  test("map, filter and reduce", async () => {
    expect(await result("map(lambda x: x * x, llist(1, 2, 3))")).toBe("[1, [4, [9, None]]]");
    expect(await result("filter(lambda x: x > 1, llist(1, 2, 3))")).toBe("[2, [3, None]]");
    expect(await result("reduce(lambda x, y: x + y, 0, llist(1, 2, 3))")).toBe("6");
  });

  test("reverse, append, enum and build", async () => {
    expect(await result("reverse(llist(1, 2, 3))")).toBe("[3, [2, [1, None]]]");
    expect(await result("append(llist(1, 2), llist(3, 4))")).toBe("[1, [2, [3, [4, None]]]]");
    expect(await result("enum_llist(1, 4)")).toBe("[1, [2, [3, [4, None]]]]");
    expect(await result("build_llist(lambda i: i * 2, 3)")).toBe("[0, [2, [4, None]]]");
  });

  test("remove and remove_all", async () => {
    expect(await result("remove(2, llist(1, 2, 3, 2))")).toBe("[1, [3, [2, None]]]");
    expect(await result("remove_all(2, llist(2, 1, 2, 3))")).toBe("[1, [3, None]]");
  });

  test("== compares structure and leaf values", async () => {
    expect(await result("llist(1, 2, 3) == llist(1, 2, 3)")).toBe("True");
    expect(await result("llist(1, 2) == llist(1, 3)")).toBe("False");
    expect(await result("pair(1, pair(2, None)) == llist(1, 2)")).toBe("True");
    expect(await result("None == None")).toBe("True");
  });

  test("llist_to_string and for_each", async () => {
    expect(await result("llist_to_string(llist(1, 2))")).toBe("'[1, [2, None]]'");
    expect(await result("for_each(lambda x: x, llist(1, 2, 3))")).toBe("True");
  });

  // print_llist renders box-and-pointer notation as text ("llist(...)" for a proper list, "[head,
  // tail]" for an improper pair), like the CSE machine's and PVML's print_llist — unlike
  // llist_to_string above, which always uses bracket notation.
  test("print_llist renders llist(...) for a proper list and [head, tail] otherwise", async () => {
    expect(await finalOutput("print_llist(llist(1, 2, 3))")).toBe("llist(1, 2, 3)\n");
    expect(await finalOutput("print_llist(None)")).toBe("llist()\n");
    expect(await finalOutput("print_llist(pair(1, 2))")).toBe("[1, 2]\n");
    expect(await finalOutput("print_llist(llist('a', 'b'))")).toBe("llist('a', 'b')\n");
    expect(await result("print_llist(llist(1, 2, 3))")).toBe("None"); // print_llist's own return value
  });

  test("print_llist: a proper-list element nested in an improper pair still renders as llist(...)", async () => {
    expect(await finalOutput("print_llist(pair(llist(1, 2, 3), llist(4, 5, 6)))")).toBe(
      "llist(llist(1, 2, 3), 4, 5, 6)\n",
    );
  });

  // Regression test for source-academy/js-slang#1124 (display_list rendered the wrong notation for
  // a value reachable via two different paths in the same structure). print_llist's algorithm is
  // plain recursion with no identity-keyed memoization, so it can't reproduce that bug: the same
  // pair object is re-derived fresh from its own structure every time it's visited, regardless of
  // which parent reached it.
  test("print_llist does not misrender a shared sub-list (js-slang#1124)", async () => {
    expect(
      await finalOutput("x1 = llist(2, 3)\nx2 = llist(x1, pair(1, x1))\nprint_llist(x2)"),
    ).toBe("llist(llist(2, 3), llist(1, 2, 3))\n");
  });

  // Regression test for the O(N^2)/stack-overflow bug caught in review on #250: printLlistText used
  // to re-run a *recursive* isProperLlist on every tail suffix while unrolling an improper
  // structure's bracket notation, making the whole walk O(N^2) -- and that recursive isProperLlist
  // could itself overflow the stack on a long chain even on its own. Built directly via the AST
  // constructors (bypassing the stepper's per-statement execution, which has its own, unrelated
  // scaling limits) so this isolates printLlistText's own complexity. `improperN` is well past where
  // the old O(N^2) behavior would have made this test time out, but -- unlike the proper-list case
  // below -- still bounded by the bracket notation's own inherent O(N) nesting depth (acknowledged,
  // accepted limitation; matches the CSE machine's equivalent recursion-depth ceiling).
  test("print_llist stays fast and stack-safe on large structures", () => {
    const intLit = (n: number): StepNode => literal(BigInt(n), String(n), false);

    const improperN = 3000;
    let improperChain: StepNode = intLit(999);
    for (let i = improperN; i >= 1; i--) improperChain = pairNode(intLit(i), improperChain);
    const improperOutput = formatPrintLlistOutput([improperChain]);
    expect(improperOutput.startsWith("[1, [2, [3,")).toBe(true);
    expect(improperOutput.endsWith("999" + "]".repeat(improperN) + "\n")).toBe(true);

    const properN = 50000;
    let properChain: StepNode = emptyList();
    for (let i = properN; i >= 1; i--) properChain = pairNode(intLit(i), properChain);
    const properOutput = formatPrintLlistOutput([properChain]);
    expect(properOutput.startsWith("llist(1, 2, 3,")).toBe(true);
    expect(properOutput.endsWith(`${properN - 1}, ${properN})\n`)).toBe(true);
  });

  test("print_llist requires exactly 1 argument", async () => {
    expect((await explanations("print_llist()")).pop()).toBe("Evaluation stuck");
    expect((await explanations("print_llist(1, 2)")).pop()).toBe("Evaluation stuck");
  });

  test("list functions are first-class values", async () => {
    expect(await result("is_function(pair)")).toBe("True");
    expect(await result("is_function(map)")).toBe("True");
    expect(await result("arity(pair)")).toBe("2");
    expect(await result("arity(reduce)")).toBe("3");
    // A bare list-function name is a complete value, not stuck.
    expect((await explanations("head")).pop()).toBe("Evaluation complete");
  });

  test("a fully-evaluated list is a complete result", async () => {
    expect((await explanations("llist(1, 2, 3)")).pop()).toBe("Evaluation complete");
    expect((await explanations("map(lambda x: x + 1, llist(1, 2))")).pop()).toBe(
      "Evaluation complete",
    );
  });

  test("misusing a list primitive is stuck, not a wrong answer", async () => {
    expect((await explanations("head(5)")).pop()).toBe("Evaluation stuck"); // not a pair
    expect((await explanations("tail(None)")).pop()).toBe("Evaluation stuck"); // empty list has no tail
    expect((await explanations("pair(1)")).pop()).toBe("Evaluation stuck"); // wrong arity
  });

  test("the list reduction shows pairs/lists, not the helper implementation noise", async () => {
    // `pair` contracts in one labelled step, like Source's primitives.
    expect(await explanations("pair(1, 2)")).toContain("Running pair");
    // A pair value serialises as an estree `ArrayExpression` for the host's `[...]` template. It shows
    // as the contraction result and is then discarded before the terminal (empty) "Evaluation
    // complete" step — a Python statement yields no program value — so search across the steps for it.
    const value = (await steps("pair(1, 2)"))
      .map(s => findNode(s.ast, (n: any) => n.type === "ArrayExpression"))
      .find(Boolean);
    expect(value).toBeDefined();
    expect(value.elements.map((e: any) => e.raw)).toEqual(["1", "2"]);
  });

  test("list library names resolve in preprocessing (not undefined)", () => {
    expect(preprocess("map(lambda x: x, llist(1, 2))")).toBeNull();
    expect(preprocess("xs = llist(1, 2)\nhead(xs)")).toBeNull();
    expect(preprocess("reduce(lambda a, b: a + b, 0, None)")).toBeNull();
  });

  test("user code composes with the list library", async () => {
    const program =
      "def sum_list(xs):\n" +
      "  return 0 if is_none(xs) else head(xs) + sum_list(tail(xs))\n" +
      "sum_list(llist(1, 2, 3, 4))";
    expect(await result(program)).toBe("10");
  });

  test("structured-clone safe with pairs (survives the channel)", async () => {
    const s = await steps("map(lambda x: x * 2, llist(1, 2, 3))");
    expect(() => structuredClone(s)).not.toThrow();
    for (const step of await steps("reverse(llist(1, 2))")) {
      const marker = step.markers?.[0];
      if (marker?.redexId != null) expect(nodeIds(step.ast).has(marker.redexId)).toBe(true);
    }
  });
});

describe("Python stepper — floating-point arithmetic (float operands)", () => {
  // Any float operand promotes the operation to float (Python semantics), so a `.0` repr is kept.
  test("float add, subtract and multiply", async () => {
    expect(await result("1.5 + 2.5")).toBe("4.0");
    expect(await result("5.5 - 2.0")).toBe("3.5");
    expect(await result("2.5 * 2.0")).toBe("5.0");
  });

  test("float true division, floor division and modulo", async () => {
    expect(await result("7.0 / 2")).toBe("3.5");
    expect(await result("7.5 // 2")).toBe("3.0"); // floored, but stays a float
    expect(await result("7.5 % 2")).toBe("1.5");
  });

  test("float power", async () => {
    expect(await result("2.0 ** 3")).toBe("8.0");
  });

  test("float comparisons produce Python booleans", async () => {
    expect(await result("1.5 < 2.0")).toBe("True");
    expect(await result("2.5 > 1.0")).toBe("True");
    expect(await result("1.5 <= 1.5")).toBe("True");
    expect(await result("2.5 >= 3.0")).toBe("False");
    expect(await result("1.5 == 1.5")).toBe("True");
    expect(await result("1.5 != 2.0")).toBe("True");
  });
});

describe("Python stepper — integer comparisons and edge arithmetic", () => {
  test("the remaining ordering/inequality operators on ints", async () => {
    expect(await result("1 <= 2")).toBe("True");
    expect(await result("2 <= 2")).toBe("True");
    expect(await result("2 >= 1")).toBe("True");
    expect(await result("1 != 2")).toBe("True");
    expect(await result("1 != 1")).toBe("False");
  });

  test("zero raised to a negative power is a ZeroDivisionError (int and float paths)", async () => {
    expect(await result("0 ** -1")).toContain("ZeroDivisionError");
    expect(await result("0.0 ** -1")).toContain("ZeroDivisionError");
    expect((await explanations("0 ** -1")).pop()).toBe("Evaluation stuck");
  });

  test("string ordering (< > <= >=) compares lexicographically", async () => {
    expect(await result('"a" < "b"')).toBe("True");
    expect(await result('"b" < "a"')).toBe("False");
    expect(await result('"apple" < "banana"')).toBe("True");
    expect(await result('"a" > "b"')).toBe("False");
    expect(await result('"abc" <= "abc"')).toBe("True");
    expect(await result('"abd" >= "abc"')).toBe("True");
    expect((await explanations('"a" < "b"')).pop()).toBe("Evaluation complete"); // modelled, not stuck
  });

  test("== / != are structural over any x any at §1/§2, except bool and function operands", async () => {
    // `==`/`!=` take any x any at Python §1/§2 (see docs/specs/python_typing_middle_12.tex): None,
    // pairs and mismatched types all compare structurally rather than erroring.
    const cases: [string, string][] = [
      ["None == None", "True"],
      ["None == 1", "False"],
      ["None != None", "False"],
      ["None != 1", "True"],
      ["1 == '1'", "False"],
      ["1 != '1'", "True"],
    ];
    for (const [src, expected] of cases) {
      expect(await result(src)).toBe(expected);
      expect((await explanations(src)).pop()).toBe("Evaluation complete");
    }
  });

  test("bool and function operands are still excluded from == / != at §1/§2", async () => {
    for (const src of [
      "True == 1",
      "True == True",
      "None == True",
      "(lambda x: x) == (lambda x: x)",
      // The exclusion applies wherever `==`/`!=` reaches, including elements found by recursing
      // into pairs — not just the top-level operands.
      "pair(1, True) == pair(1, True)",
      "pair(1, 2) == pair(1, (lambda x: x))",
    ]) {
      expect((await explanations(src)).pop()).toBe("Evaluation stuck");
      expect(await result(src)).toContain("TypeError");
    }
  });

  test("pairs compare structurally, recursively, under == at §2", async () => {
    const cases: [string, string][] = [
      ["pair(1, 2) == pair(1, 2)", "True"],
      ["pair(1, 2) == pair(1.0, 2)", "True"],
      ["pair(1, 2) == pair(2, 2)", "False"],
      ["pair(1, pair(2, 3)) == pair(1, pair(2, 3))", "True"],
      ["pair(1, 2) == None", "False"],
      ["pair(1, 2) != pair(1, 2)", "False"],
      // Ints nested inside a pair compare exactly (bigint ===), not via a float-precision-losing
      // `Number()` conversion — these two big ints round to the same IEEE-754 double but are unequal.
      ["pair(100000000000000000001, 1) == pair(100000000000000000002, 1)", "False"],
      ["pair(100000000000000000001, 1) == pair(100000000000000000001, 1)", "True"],
    ];
    for (const [src, expected] of cases) {
      expect(await result(src)).toBe(expected);
    }
  });
});

describe("Python stepper — and/or/not require a strict bool operand", () => {
  // Unlike native Python's truthiness, this dialect's `and`/`or`/`not` require a genuine `bool`
  // operand (matching the real, non-stepper evaluator's BOOL_OP/NOT instructions): `1 and 1`, `not 5`,
  // `None and 1` are all TypeErrors here, not truthy-evaluated.
  test("and/or short-circuit on a bool left operand; the right operand's type is unrestricted", async () => {
    expect(await result("True and 1")).toBe("1"); // left truthy → right returned, any type
    expect(await result("False and 1")).toBe("False"); // left falsy → short-circuits, right never touched
    expect(await result("True or 1")).toBe("True"); // left truthy → short-circuits
    expect(await result("False or 1")).toBe("1"); // left falsy → right returned, any type
  });

  test("a non-bool left operand to and/or is a TypeError (stuck), not truthy-evaluated", async () => {
    for (const src of ['"abc" and 1', "1 and 1", "None and 1", "(lambda x: x) and 1", "0 or 1"]) {
      expect((await explanations(src)).pop()).toBe("Evaluation stuck");
    }
    expect(await result("1 and 1")).toContain("TypeError");
  });

  test("not requires a bool argument; a non-bool value is a TypeError (stuck)", async () => {
    for (const src of ["not 1", "not 1.0", "not None", "not ''", "not (lambda x: x)"]) {
      expect((await explanations(src)).pop()).toBe("Evaluation stuck");
    }
    expect(await result("not 1")).toContain("TypeError");
  });
});

describe("Python stepper — the rest of the math library", () => {
  test("binary math functions compute on two arguments", async () => {
    expect(await result("math_pow(2, 10)")).toBe("1024.0");
    expect(await result("math_atan2(0, 1)")).toBe("0.0");
    expect(await result("math_hypot(3, 4)")).toBe("5.0");
    expect(await result("math_fmod(7, 3)")).toBe("1.0");
    expect(await result("math_copysign(3, -1)")).toBe("-3.0");
    expect(await result("math_remainder(7, 3)")).toBe("1.0");
  });

  test("angle conversion (degrees/radians)", async () => {
    expect(await result("math_degrees(0)")).toBe("0.0");
    expect(await result("math_radians(0)")).toBe("0.0");
    expect(parseFloat(await result("math_degrees(math_pi)"))).toBeCloseTo(180);
    expect(parseFloat(await result("math_radians(180)"))).toBeCloseTo(Math.PI);
  });

  test("infinity / finiteness predicates", async () => {
    expect(await result("math_isinf(math_inf)")).toBe("True");
    expect(await result("math_isinf(1.0)")).toBe("False");
    expect(await result("math_isfinite(1.0)")).toBe("True");
    expect(await result("math_isfinite(math_inf)")).toBe("False");
  });

  test("a math function on a non-number is a TypeError (stuck)", async () => {
    expect(await result("math_floor(None)")).toContain("TypeError");
    expect((await explanations("math_floor(None)")).pop()).toBe("Evaluation stuck");
  });
});

describe("Python stepper — bool is not an int subtype in this dialect", () => {
  // Unlike native Python, `bool` participates in no arithmetic, comparison or equality operator, and
  // no numeric builtin, here — it is only valid to `and`/`or`/`not` and to explicit conversions like
  // `int()`/`float()`/`str()`. This matches the real, non-stepper evaluator (e.g. `True == True`,
  // `True + 1` and `abs(True)` are all TypeErrors there too), even though native Python allows them.
  test("bool is rejected by every binary arithmetic/comparison/equality operator", async () => {
    for (const src of ["True + 1", "1 + True", "True * True", "True / 1", "True - True"]) {
      expect((await explanations(src)).pop()).toBe("Evaluation stuck");
      expect(await result(src)).toContain("TypeError");
    }
    for (const src of ["True == True", "True == 1", "True > 1", "1 > True", "True <= True"]) {
      expect((await explanations(src)).pop()).toBe("Evaluation stuck");
      expect(await result(src)).toContain("TypeError");
    }
  });

  test("unary minus/plus on a bool is a TypeError (stuck)", async () => {
    expect((await explanations("-True")).pop()).toBe("Evaluation stuck");
    expect(await result("-True")).toContain("TypeError");
  });

  test("abs/round/math functions reject a bool argument", async () => {
    for (const src of ["abs(True)", "round(True)", "math_sqrt(True)", "math_floor(False)"]) {
      expect((await explanations(src)).pop()).toBe("Evaluation stuck");
      expect(await result(src)).toContain("TypeError");
    }
  });

  test("min/max reject a bool argument", async () => {
    expect((await explanations("min(True, 1)")).pop()).toBe("Evaluation stuck");
    expect((await explanations("max(1, False)")).pop()).toBe("Evaluation stuck");
  });

  test("str and is_boolean still accept a bool", async () => {
    // Conversions/predicates are where `bool` is still accepted — they use its representation rather
    // than treating it as a numeric operand.
    expect(await result("str(True)")).toBe("'True'");
    expect(await result("is_boolean(True)")).toBe("True");
  });
});

describe("Python stepper — str/repr and bool of compound values", () => {
  test("str of a pair renders box-and-pointer with repr'd elements", async () => {
    expect(await result("str(pair(1, 2))")).toBe("'[1, 2]'");
    expect(await result('str(pair("a", None))')).toBe("\"['a', None]\""); // string element shows quoted
  });

  test("str/repr of function values", async () => {
    expect(await result("str(lambda x: x)")).toBe("'<function <lambda>>'");
    expect(await result("str(abs)")).toBe("'<built-in function abs>'");
    expect(await result("repr(math_sqrt)")).toBe("'<built-in function math_sqrt>'");
  });
});

describe("Python stepper — constructs outside the reducible subset degrade gracefully", () => {
  // These parse but sit outside the substitution stepper's faithfully-modelled subset. `translate`
  // either renders them as a value (a list literal) or degrades them to an inert placeholder identifier
  // that simply gets stuck, instead of failing the whole run. (The preprocessing gate would reject most
  // of these in production; the stepper's `getPythonSteps` translates them regardless.) Complex numbers
  // are *not* in this category — they are a fully-modelled value type; see "complex numbers" below.
  test("a list literal reduces to an array value", async () => {
    expect(await result("[1, 2, 3]")).toBe("[1, 2, 3]");
    expect(await result("[]")).toBe("[]");
    expect(await result('["a", 1]')).toBe("['a', 1]"); // elements use repr, so a string shows quoted
  });

  test("an unsupported expression becomes an inert placeholder (stuck)", async () => {
    expect((await explanations("x[0]")).pop()).toBe("Evaluation stuck"); // subscript is not modelled
  });

  test("an assignment to a non-variable target is an inert placeholder (stuck)", async () => {
    expect((await explanations("x[0] = 5")).pop()).toBe("Evaluation stuck");
  });

  test("an unsupported statement becomes an inert placeholder (stuck)", async () => {
    for (const src of ["assert True", "while False:\n  pass", "for i in x:\n  pass"]) {
      expect((await explanations(src)).pop()).toBe("Evaluation stuck");
    }
  });

  test("a program left stuck at a leading non-value statement is 'stuck', not 'complete'", async () => {
    // Two statements where the first cannot reduce and is not a value: the whole run is stuck.
    expect((await explanations("x[0]\n1")).pop()).toBe("Evaluation stuck");
  });
});

describe("Python stepper — list library edge built-ins", () => {
  test("draw_data returns its first argument (there is no drawing canvas)", async () => {
    expect(await result("draw_data(5)")).toBe("5");
    expect(await result("draw_data(pair(1, 2))")).toBe("[1, 2]");
  });

  test("draw_data with no arguments is stuck (it needs at least one)", async () => {
    expect((await explanations("draw_data()")).pop()).toBe("Evaluation stuck");
    expect(await result("draw_data()")).toContain("at least 1 argument");
  });

  test("a library function called with the wrong argument count is stuck", async () => {
    expect((await explanations("map(lambda x: x)")).pop()).toBe("Evaluation stuck");
    expect(await result("append(None)")).toContain("takes 2 argument(s) but 1 were given");
  });
});

describe("Python stepper — step limit", () => {
  test("stops with 'Maximum number of steps exceeded' when the step limit is reached", async () => {
    // stepLimit 2 → one contraction allowed; a longer program is cut off with the limit marker.
    const limited = await getPythonSteps(parse("1 + 2 + 3 + 4\n"), 2);
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
  test("float division by zero is a ZeroDivisionError (stuck)", async () => {
    expect(await result("1.5 / 0")).toContain("ZeroDivisionError");
    expect((await explanations("1.5 % 0")).pop()).toBe("Evaluation stuck");
  });

  test("unary plus on a number is the number itself", async () => {
    expect(await result("+5")).toBe("5"); // int
    expect(await result("+5.0")).toBe("5.0"); // float
  });

  test("factorial of a negative is a ValueError (stuck)", async () => {
    expect(await result("math_factorial(-1)")).toContain("ValueError");
    expect((await explanations("math_factorial(-1)")).pop()).toBe("Evaluation stuck");
  });

  test("len / arity misuse is a TypeError (stuck)", async () => {
    expect(await result("len(5)")).toContain("TypeError");
    expect(await result("arity(5)")).toContain("TypeError");
    expect((await explanations("len(5)")).pop()).toBe("Evaluation stuck");
  });
});

describe("Python stepper — complex numbers", () => {
  // A `<real>±<imag>j` literal is one token (parsed straight into real/imag by py-slang's parser), but
  // `2 + 3j` (with an operator) is an ordinary int-plus-complex expression — both must produce the same
  // value, so both forms are exercised throughout.
  test("a bare complex literal displays like Python's repr (no parens when the real part is zero)", async () => {
    expect(await result("1j")).toBe("1j");
    expect(await result("3j")).toBe("3j");
    expect(await result("-3j")).toBe("-3j");
    expect(await result("0j")).toBe("0j");
    expect(await result("-4.5j")).toBe("-4.5j");
    expect((await explanations("3j")).pop()).toBe("Evaluation complete");
  });

  test("a real+imaginary literal displays parenthesised, with an explicit sign", async () => {
    expect(await result("2+3j")).toBe("(2+3j)");
    expect(await result("2-3j")).toBe("(2-3j)");
  });

  test("int/float promote to complex when combined with one via an operator", async () => {
    expect(await result("2 + 3j")).toBe("(2+3j)"); // int + complex
    expect(await result("3j + 2")).toBe("(2+3j)"); // complex + int, same value
    expect(await result("1.5 + 2j")).toBe("(1.5+2j)"); // float + complex
  });

  test("complex arithmetic: +, -, *, /", async () => {
    expect(await result("(1+2j) + (3+4j)")).toBe("(4+6j)");
    expect(await result("(1+2j) - (3+4j)")).toBe("(-2-2j)");
    expect(await result("(1+2j) * (3+4j)")).toBe("(-5+10j)");
    expect(await result("(1+2j) / (3+4j)")).toBe("(0.44+0.08j)");
  });

  test("complex power (via the polar-form algorithm, like the real evaluator)", async () => {
    // `(1+2j) ** 2` is not exactly `-3+4j` here because the general complex power path always goes
    // through log/exp/trig, picking up float noise even for an integer exponent — this exactly mirrors
    // `PyComplexNumber.pow` in the real, non-stepper evaluator (same formula, same imprecision).
    const s = await result("(1+2j) ** 2");
    expect(s.startsWith("(-3+4.0")).toBe(true);
    expect(s.endsWith("j)")).toBe(true);
    expect(await result("0j ** 2")).toBe("0j");
  });

  test("0 to a negative or non-real power is a ZeroDivisionError (stuck)", async () => {
    for (const src of ["0j ** -1", "0j ** (1+1j)"]) {
      expect(await result(src)).toContain("ZeroDivisionError");
      expect((await explanations(src)).pop()).toBe("Evaluation stuck");
    }
  });

  test("complex division by zero is a ZeroDivisionError (stuck), for a plain-int or complex zero", async () => {
    for (const src of ["1j / 0", "1j / 0j"]) {
      expect(await result(src)).toContain("ZeroDivisionError");
      expect((await explanations(src)).pop()).toBe("Evaluation stuck");
    }
  });

  test("== / != hold between any mix of int, float and complex", async () => {
    expect(await result("(1+2j) == (1+2j)")).toBe("True");
    expect(await result("(1+2j) == (1+3j)")).toBe("False");
    expect(await result("(1+2j) != (1+3j)")).toBe("True");
    expect(await result("1 == 1+0j")).toBe("True");
    expect(await result("1.0 == 1+0j")).toBe("True");
    expect(await result("1+0j == 1")).toBe("True");
  });

  test("ordering (<, <=, >, >=), // and % are not defined for complex — a TypeError (stuck)", async () => {
    for (const src of ["(1+2j) < (3+4j)", "(1+2j) // 2", "(1+2j) % 2"]) {
      expect((await explanations(src)).pop()).toBe("Evaluation stuck");
      expect(await result(src)).toContain("TypeError");
    }
  });

  test("unary minus/plus on complex", async () => {
    expect(await result("-(1+2j)")).toBe("(-1-2j)");
    expect(await result("+(1+2j)")).toBe("(1+2j)");
  });

  test("abs() returns the modulus as a non-negative float", async () => {
    expect(await result("abs(3+4j)")).toBe("5.0");
    expect(await result("abs(0j)")).toBe("0.0");
    expect(await result("abs(1j)")).toBe("1.0");
  });

  test("str/repr of a complex value (repr matches str, unlike a string's quoting)", async () => {
    expect(await result("str(1+2j)")).toBe("'(1+2j)'");
    expect(await result("repr(1+2j)")).toBe("'(1+2j)'");
    expect(await result("str(2j)")).toBe("'2j'");
    expect(await result("str(-2j)")).toBe("'-2j'");
  });

  test("complex() constructs from a number, bool, string, or (real, imag) pair", async () => {
    expect(await result("complex()")).toBe("0j");
    expect(await result("complex(5)")).toBe("(5+0j)");
    expect(await result("complex(5.5)")).toBe("(5.5+0j)");
    expect(await result("complex(True)")).toBe("(1+0j)"); // the one place bool is still accepted
    expect(await result("complex(1+2j)")).toBe("(1+2j)");
    expect(await result("complex(1, 2)")).toBe("(1+2j)");
    expect(await result("complex(1.5, 2.5)")).toBe("(1.5+2.5j)");
  });

  test("complex(str) parses a Python complex-literal string", async () => {
    expect(await result("complex('1+2j')")).toBe("(1+2j)");
    expect(await result("complex('-4.5j')")).toBe("-4.5j");
    expect(await result("complex('inf')")).toBe("(inf+0j)");
  });

  test("complex(str) rejects a malformed string with a ValueError (stuck)", async () => {
    expect(await result("complex('not a number')")).toContain("ValueError");
    expect((await explanations("complex('not a number')")).pop()).toBe("Evaluation stuck");
  });

  test("complex(str) rejects prototype-chain property names as malformed, not as special values", async () => {
    // Regression: a bare `in` against the plain-object `specials` lookup used to match inherited
    // Object.prototype keys, so e.g. complex('constructorj') smuggled the Object constructor
    // function through as the imaginary part instead of being rejected.
    expect(await result("complex('constructorj')")).toContain("ValueError");
    expect(await result("complex('__proto__j')")).toContain("ValueError");
  });

  test("real()/imag() extract the components; they require an actual complex argument", async () => {
    expect(await result("real(1+2j)")).toBe("1.0");
    expect(await result("imag(1+2j)")).toBe("2.0");
    expect((await explanations("real(5)")).pop()).toBe("Evaluation stuck"); // int is not "complex" here
    expect(await result("real(5)")).toContain("TypeError");
  });

  test("is_complex distinguishes complex values from everything else", async () => {
    expect(await result("is_complex(1+2j)")).toBe("True");
    expect(await result("is_complex(5)")).toBe("False");
    expect(await result("is_complex(5.0)")).toBe("False");
  });

  test("complex is a valid and/or *right* operand (its type is never checked there)", async () => {
    expect(await result("True and (1+2j)")).toBe("(1+2j)");
  });

  test("complex is rejected as and/or's left operand, and by not — a TypeError (stuck)", async () => {
    expect((await explanations("(1+2j) and True")).pop()).toBe("Evaluation stuck");
    expect(await result("(1+2j) and True")).toContain("TypeError");
    expect((await explanations("not (1+2j)")).pop()).toBe("Evaluation stuck");
    expect(await result("not (1+2j)")).toContain("TypeError");
  });

  test("min/max/round/math_* all reject complex — a TypeError (stuck), like bool", async () => {
    for (const src of ["min(1+2j, 3)", "round(1+2j)", "math_sqrt(1+2j)"]) {
      expect((await explanations(src)).pop()).toBe("Evaluation stuck");
      expect(await result(src)).toContain("TypeError");
    }
  });

  test("mixing complex with an incompatible type (str) is a TypeError (stuck)", async () => {
    expect((await explanations("'a' + (1+2j)")).pop()).toBe("Evaluation stuck");
    expect(await result("'a' + (1+2j)")).toContain("TypeError");
  });

  test("a pair may hold a complex element, formatted like any other pair element", async () => {
    expect(await result("pair(1+2j, 2)")).toBe("[(1+2j), 2]");
    expect(await result("str(pair(1+2j, 2))")).toBe("'[(1+2j), 2]'");
  });

  test("complex arithmetic composes with user code", async () => {
    expect(await result("f = lambda z: z * z\nf(1+1j)")).toBe("2j");
  });
});

describe("Python stepper — breakpoint() marks a debugger breakpoint (#188)", () => {
  // Python's `breakpoint()` is the stepper's analogue of JavaScript's `debugger;`: a no-op for
  // evaluation (like `pass`) that the host's breakpoint navigation (the double-arrow) can jump to. The
  // host recognises a breakpoint step by a marker whose `redexNodeType` is "DebuggerStatement" (see the
  // web-stepper host's `stepNextBreakpoint`). Unlike every other marker field, this one is *not* simply
  // the redex's actual node type: `breakpoint()` stays an ordinary `CallExpression`/`ExpressionStatement`
  // (see `translate.ts`), detected by *resolved identity* at reduction time in `stepHead` (reduce.ts) —
  // `redexNodeType` is set explicitly there (see `serializeMarker` in getSteps.ts) rather than derived
  // from the tree. That is what makes aliasing (`bp = breakpoint; bp()`) behave exactly like a direct
  // `breakpoint()` call, the same way `p = print; p(1)` already behaves exactly like `print(1)`.

  test("preprocessing accepts breakpoint() in every chapter (it is a built-in name)", () => {
    expect(preprocess("breakpoint()")).toBeNull();
    expect(preprocess("breakpoint()", 1)).toBeNull();
    expect(preprocess("breakpoint()\nx = 1\nx + 1")).toBeNull();
  });

  test("evaluates as a no-op, exactly like pass (never affects the result)", async () => {
    expect(await result("breakpoint()\n1 + 1")).toBe("2");
    expect(await result("x = 5\nbreakpoint()\nx + 1")).toBe("6");
    // Inside a function body too (a breakpoint before the return); the return value is unchanged.
    expect(await result("def f(x):\n  breakpoint()\n  return x + 1\nf(4)")).toBe("5");
  });

  test("produces a before/after pair reading 'Evaluating'/'Evaluated breakpoint statement'", async () => {
    expect(await explanations("breakpoint()\n1 + 1")).toEqual([
      "Start of evaluation",
      "Evaluating breakpoint statement",
      "Evaluated breakpoint statement",
      "Evaluating binary expression 1 + 1",
      "Evaluated binary expression 1 + 1",
      "Evaluating 2",
      "Evaluated 2",
      "Evaluation complete",
    ]);
  });

  test("only the 'Evaluating' step is a breakpoint target — never the 'Evaluated' one (#188)", async () => {
    // The double-arrow must land on "Evaluating breakpoint statement", not the following "Evaluated
    // breakpoint statement". The host picks a target by `redexNodeType === "DebuggerStatement"`, so the
    // *before* step must carry it and the *after* step must not — for every breakpoint, including when
    // there are several. (`stepNextBreakpoint` scans forward for the next such marker, so a flagged
    // after step would make it stop on the wrong, post-reduction step.)
    const s = await steps("breakpoint()\nx = 1\nbreakpoint()\nx");
    const flagged = s
      .filter(step => step.markers?.[0]?.redexNodeType === "DebuggerStatement")
      .map(step => step.markers?.[0]?.explanation);
    expect(flagged).toEqual(["Evaluating breakpoint statement", "Evaluating breakpoint statement"]);

    const before = s.find(
      step => step.markers?.[0]?.explanation === "Evaluating breakpoint statement",
    );
    expect(before?.markers?.[0]?.redexType).toBe("beforeMarker");
    // The redex id resolves to a node in that step's tree (it is highlighted).
    expect(nodeIds(before!.ast).has(before!.markers![0].redexId!)).toBe(true);

    const after = s.find(
      step => step.markers?.[0]?.explanation === "Evaluated breakpoint statement",
    );
    expect(after?.markers?.[0]?.redexType).toBe("afterMarker");
    expect(after?.markers?.[0]?.redexNodeType).toBeUndefined();
  });

  test("a discard's after step already shows the statement gone, like pass", async () => {
    // Like `pass`, the after step ("Evaluated breakpoint statement") already shows the call gone — no
    // redex survives to highlight, so the afterMarker carries no redexId — matching the following
    // before step exactly (see `ReduceResult.node`'s doc comment on the after == next-before invariant).
    const s = await steps("breakpoint()\n1 + 1");
    const beforeIdx = s.findIndex(
      step => step.markers?.[0]?.explanation === "Evaluating breakpoint statement",
    );
    const before = s[beforeIdx];
    const after = s[beforeIdx + 1];
    expect(after.markers?.[0]?.explanation).toBe("Evaluated breakpoint statement");

    // Before (red) still contains the breakpoint call, highlighted via a resolvable redexId — an
    // ordinary ExpressionStatement/CallExpression, not a dedicated node type (see reduce.ts's stepHead).
    expect((before.ast as any).body[0].type).toBe("ExpressionStatement");
    expect(before.markers?.[0]?.redexType).toBe("beforeMarker");
    expect(nodeIds(before.ast).has(before.markers![0].redexId!)).toBe(true);

    // After (green) already shows only `1 + 1` — the breakpoint call is gone, no redexId to resolve.
    expect((after.ast as any).body[0].expression).toMatchObject({ operator: "+" });
    expect(after.markers?.[0]?.redexType).toBe("afterMarker");
    expect(after.markers?.[0]?.redexId).toBeUndefined();

    // The following before step shows the identical (already-discarded) tree.
    expect(s[beforeIdx + 2].ast).toEqual(after.ast);
  });

  test("renders as the breakpoint() call the student typed (an ordinary CallExpression)", async () => {
    // No dedicated node type: `breakpoint()` translates to a plain CallExpression (see translate.ts)
    // and renders through the same CallExpression template as any other built-in call. Its callee is a
    // genuine `BUILTIN_FUNCTIONS` entry (see builtins.ts), so — like `print`/`is_function` (py-slang#404)
    // — it displays as "Builtin", not "Identifier", picking up the same built-in hover popover.
    const stmt = ((await steps("breakpoint()\n1"))[0].ast as any).body[0];
    expect(stmt.type).toBe("ExpressionStatement");
    expect(stmt.expression.type).toBe("CallExpression");
    expect(stmt.expression.callee.type).toBe("Builtin");
    expect(stmt.expression.callee.name).toBe("breakpoint");
    expect(stmt.expression.arguments).toEqual([]);
  });

  test("used as an expression it degrades to a no-op returning None (not the debugger form)", async () => {
    // Only the bare-statement form is the debugger; in expression position `breakpoint()` is an
    // ordinary built-in call that yields None, so the program still resolves rather than getting stuck.
    expect(await result("x = breakpoint()\nx")).toBe("None");
    expect((await explanations("x = breakpoint()\nx")).pop()).toBe("Evaluation complete");
  });

  test("aliased via a variable behaves exactly like breakpoint() itself, just as p = print; p(1) does", async () => {
    // The bug this fixes: detection used to match the student's literal source text ("breakpoint()"),
    // so an alias silently lost the debugger behaviour. It is now resolved identity at reduction time
    // (stepHead in reduce.ts): `bp`, once substituted to the `breakpoint` builtin, is indistinguishable
    // from writing `breakpoint()` directly — same wording, same nav target, same no-op evaluation.
    const src = "bp = breakpoint\nbp()\n1 + 1";
    expect(await result(src)).toBe("2");
    expect(await explanations(src)).toEqual([
      "Start of evaluation",
      "Declaring and substituting bp into the rest of the block",
      "Declared and substituted bp into the rest of the block",
      "Evaluating breakpoint statement",
      "Evaluated breakpoint statement",
      "Evaluating binary expression 1 + 1",
      "Evaluated binary expression 1 + 1",
      "Evaluating 2",
      "Evaluated 2",
      "Evaluation complete",
    ]);
    const flagged = (await steps(src)).filter(
      step => step.markers?.[0]?.redexNodeType === "DebuggerStatement",
    );
    expect(flagged).toHaveLength(1);
    expect(flagged[0].markers?.[0]?.explanation).toBe("Evaluating breakpoint statement");
  });

  test("aliasing also works inside a function body", async () => {
    const src = "def f(x):\n  bp = breakpoint\n  bp()\n  return x + 1\nf(4)";
    expect(await result(src)).toBe("5");
    const flagged = (await steps(src)).filter(
      step => step.markers?.[0]?.redexNodeType === "DebuggerStatement",
    );
    expect(flagged).toHaveLength(1);
  });

  test("aliased and used as an expression still degrades to a no-op (not a breakpoint target)", async () => {
    // Aliasing must not *widen* what counts as the debugger form either: `bp()` in expression position
    // degrades exactly like `breakpoint()` does in the direct case above.
    const src = "bp = breakpoint\nx = bp()\nx";
    expect(await result(src)).toBe("None");
    const flagged = (await steps(src)).filter(
      step => step.markers?.[0]?.redexNodeType === "DebuggerStatement",
    );
    expect(flagged).toHaveLength(0);
  });

  // Real Python's breakpoint(*args, **kws) takes any number of arguments (forwarded to
  // sys.breakpointhook); the stepper's own no-op breakpoint entry already ignores them regardless
  // (see builtins.ts), so the bare-statement form should still be recognised as a debugger target
  // for any arity, not just zero (issue #257).
  test.each([
    ["one literal argument", "breakpoint(5)"],
    ["several literal arguments", "breakpoint(1, 2, 3)"],
  ])(
    "%s: still evaluates as a no-op and is flagged as a breakpoint target",
    async (_desc, call) => {
      expect(await result(`${call}\n1 + 1`)).toBe("2");
      const flagged = (await steps(`${call}\n1 + 1`)).filter(
        step => step.markers?.[0]?.redexNodeType === "DebuggerStatement",
      );
      expect(flagged).toHaveLength(1);
      expect(flagged[0].markers?.[0]?.explanation).toBe("Evaluating breakpoint statement");
    },
  );

  test("an argument that is itself reducible is stepped through first, then flagged once all arguments are values", async () => {
    // breakpoint(1 + 2): the argument isn't a value yet, so the statement must not be flagged as the
    // debugger target on the very first encounter — only once `1 + 2` has itself reduced to `3` (the
    // point analogous to the CSE machine's APPLICATION instruction actually firing).
    const src = "breakpoint(1 + 2)\n1 + 1";
    const flagged = (await steps(src)).filter(
      step => step.markers?.[0]?.redexNodeType === "DebuggerStatement",
    );
    expect(flagged).toHaveLength(1);
    expect(flagged[0].markers?.[0]?.explanation).toBe("Evaluating breakpoint statement");
    // Confirm the argument really was reduced before the flagged step: the flagged step's own tree
    // already shows `3`, not `1 + 2`.
    const args = (flagged[0].ast as any).body[0].expression.arguments;
    expect(args).toHaveLength(1);
    expect(args[0].type).toBe("Literal");
    expect(args[0].value).toBe(3n);
  });

  test("aliased and called with arguments is still flagged as a breakpoint target", async () => {
    const src = "bp = breakpoint\nbp(1, 2)\n1 + 1";
    expect(await result(src)).toBe("2");
    const flagged = (await steps(src)).filter(
      step => step.markers?.[0]?.redexNodeType === "DebuggerStatement",
    );
    expect(flagged).toHaveLength(1);
  });
});

describe("Python stepper — gutter-click breakpoints (#383)", () => {
  // A gutter click only carries a line number, not an AST node: `markBreakpoints` (../../../breakpoints)
  // resolves it to the closest enclosing statement and flags it; `translate.ts` copies that flag onto
  // the corresponding StepNode, and `reduce.ts` folds it into the same `isBreakpoint` field the
  // breakpoint() detection above uses — so it surfaces identically, via `redexNodeType ===
  // "DebuggerStatement"` on the *before* marker.

  async function stepsWithBreakpoints(src: string, lines: number[]) {
    const ast = parse(src + "\n");
    markBreakpoints(ast, lines);
    return getPythonSteps(ast);
  }

  async function flaggedExplanations(src: string, lines: number[]) {
    return (await stepsWithBreakpoints(src, lines))
      .filter(step => step.markers?.[0]?.redexNodeType === "DebuggerStatement")
      .map(step => step.markers?.[0]?.explanation);
  }

  test("a click on a plain statement's line marks it as a breakpoint target", async () => {
    expect(await flaggedExplanations("x = 1\ny = 2", [1])).toEqual([
      "Declaring and substituting x into the rest of the block",
    ]);
  });

  test("a click on a blank line snaps to the next statement", async () => {
    expect(await flaggedExplanations("x = 1\n\ny = 2", [2])).toEqual([
      "Declaring and substituting y into the rest of the block",
    ]);
  });

  test("a click inside a function body marks that statement, not the def line", async () => {
    // Fires on the *first* step that reaches the `y = x + 1` line (`x` already substituted to `4`
    // by the call, so the first step is reducing `4 + 1`) — not the later "declared and
    // substituted" step, matching a debugger stopping the moment execution reaches the line.
    const src = "def f(x):\n  y = x + 1\n  return y\nf(4)";
    expect(await flaggedExplanations(src, [2])).toEqual(["Evaluating binary expression 4 + 1"]);
  });

  test("a multi-step statement is only a breakpoint target once, not on every step it takes", async () => {
    // `y`'s initializer takes three expression steps (1 + 2, then + 3, then bind); a naive
    // "the whole statement is flagged" check would mark all of them. Only the first should carry
    // `redexNodeType === "DebuggerStatement"`.
    const flagged = await flaggedExplanations("y = 1 + 2 + 3", [1]);
    expect(flagged).toHaveLength(1);
  });

  test("a click past the end of the program marks nothing", async () => {
    expect(await flaggedExplanations("x = 1", [50])).toEqual([]);
  });

  test("composes with an explicit breakpoint() call elsewhere in the same program", async () => {
    const flagged = await flaggedExplanations("breakpoint()\nx = 1\ny = 2", [3]);
    expect(flagged).toEqual([
      "Evaluating breakpoint statement",
      "Declaring and substituting y into the rest of the block",
    ]);
  });
});

describe("Python stepper — cumulative print output per step", () => {
  // Each serialized step carries the program's cumulative textual output (everything `print` has
  // written) up to that step, so the host can show a running output panel that grows with the slider.
  // The field is a runner addition to the serialized step (see getSteps.ts); read it via a cast.
  const outputs = async (src: string): Promise<(string | undefined)[]> =>
    (await steps(src)).map(s => (s as { output?: string }).output);

  // Each step's explanation paired with that step's cumulative output.
  const rows = async (src: string): Promise<[string, string | undefined][]> =>
    (await steps(src)).map(s => [
      s.markers?.[0]?.explanation ?? "",
      (s as { output?: string }).output,
    ]);

  test("a print's text appears on its 'Ran print' step, not its 'Running print' step", async () => {
    const r = await rows('print("hello")');
    const running = r.find(([e]) => e === "Running print");
    const ran = r.find(([e]) => e === "Ran print");
    expect(running?.[1]).toBeUndefined(); // before the print runs, no output yet
    expect(ran?.[1]).toBe("hello\n"); // the output appears exactly on the "Ran print" step
  });

  test("output is cumulative: each print appends to everything printed before it", async () => {
    // Two separate prints — the second's step output includes the first's, in order.
    const ranOutputs = (await rows('print("a")\nprint(1, 2)'))
      .filter(([e]) => e === "Ran print")
      .map(([, o]) => o);
    expect(ranOutputs).toEqual(["a\n", "a\n1 2\n"]);
  });

  test("once printed, the output persists on every later step through 'Evaluation complete'", async () => {
    const o = await outputs('print("x")\n1 + 1');
    expect(o[o.length - 1]).toBe("x\n"); // still present on the terminal step
    // Every step from the "Ran print" step onward carries it; none of them drops back to empty.
    const firstWithOutput = o.findIndex(x => x === "x\n");
    expect(firstWithOutput).toBeGreaterThan(-1);
    expect(o.slice(firstWithOutput).every(x => x === "x\n")).toBe(true);
  });

  test("formatting mirrors CPython defaults: space-separated args, trailing newline, print() is blank", async () => {
    const ran = async (src: string) =>
      (await rows(src)).filter(([e]) => e === "Ran print").map(([, o]) => o);
    expect(await ran('print("a", "b", "c")')).toEqual(["a b c\n"]); // sep=' '
    expect(await ran("print()")).toEqual(["\n"]); // just the end='\n'
    expect(await ran("print(3 * 4)")).toEqual(["12\n"]); // the argument is reduced to a value first
    expect(await ran("print(True)\nprint(None)")).toEqual(["True\n", "True\nNone\n"]); // Python reprs
  });

  test("a program that never prints carries no output field on any step", async () => {
    expect((await outputs("1 + 1\nx = 2\nx * x")).every(o => o === undefined)).toBe(true);
  });

  test("output accumulates across a print inside a function body and a later top-level print", async () => {
    const ran = (await rows('def f(x):\n  print(x)\n  return x + 1\nf(5)\nprint("done")'))
      .filter(([e]) => e === "Ran print")
      .map(([, o]) => o);
    expect(ran).toEqual(["5\n", "5\ndone\n"]);
  });
});

describe("Python stepper — import statements", () => {
  // See py-slang#385: a program with any `from X import Y` used to report "Evaluation stuck" the
  // instant it reached the import line, regardless of whether the imported name was ever used.
  test("an unused import is a no-op: the program still reaches Evaluation complete", async () => {
    expect((await explanations("from rune import circle")).pop()).toBe("Evaluation complete");
    expect((await explanations("from rune import circle\n1 + 1")).pop()).toBe(
      "Evaluation complete",
    );
  });

  test("the import line itself steps as a no-op, like `pass`", async () => {
    const e = await explanations("from rune import circle\n1 + 1");
    expect(e).toContain("Evaluating import statement");
    expect(e).toContain("Evaluated import statement");
  });

  test("a used import gets stuck at the point of use, not at the import line", async () => {
    // Preprocessing accepts it (the resolver binds imported names — see resolver.ts's
    // visitFromImportStmt); real module resolution isn't wired up yet, so the name is simply unbound
    // once stepping reaches it, same as any other undefined name at reduction time.
    expect(preprocess("from rune import circle\ncircle", 1)).toBeNull();
    const e = await explanations("from rune import circle\ncircle");
    expect(e.pop()).toBe("Evaluation stuck");
    expect(e).toContain("Evaluated import statement"); // it got past the import line first
  });

  test("an aliased import renders its original source text, not `pass`", async () => {
    const withAlias = (await steps("from rune import circle as c\n1 + 1"))[0].ast as unknown as {
      body: { raw?: string }[];
    };
    expect(withAlias.body[0].raw).toBe("from rune import circle as c");
  });

  test("a relative import is a student-actionable error, not a silent no-op", async () => {
    // Mirrors the CSE machine's own RelativeImportNotSupportedError: local-file imports are a
    // separate, unimplemented feature for the stepper (see py-slang#379's py2js support, which the
    // stepper does not share), not something that should silently degrade to "stuck" once used.
    // Determined from the AST alone, so this rejects even with no module loader wired up (see
    // resolveImports's own doc comment).
    await expect(steps("from .rune import circle\n1 + 1")).rejects.toThrow(/relative import/i);
  });
});

describe("Python stepper — real module resolution (py-slang#385)", () => {
  // Exercises moduleInterop.ts's resolveImports/moduleToStepNode/callModuleFunction end to end,
  // against the same GenericDataHandler + ModuleLoaderRunnerPlugin.instance every other engine's own
  // module-interop tests use (see src/tests/py2js-from-import.test.ts's identical setup) — not a
  // stepper-specific mock, so a bug here would also mean the conductor plumbing itself is broken.
  function installFakeModule(exportsByModule: Record<string, FakeExport[]>) {
    ModuleLoaderRunnerPlugin.instance = {
      requestModule: (name: string) => {
        const exports = exportsByModule[name];
        if (!exports) return Promise.reject(new Error(`no such module: ${name}`));
        return Promise.resolve({ exports });
      },
    } as unknown as ModuleLoaderRunnerPlugin;
  }

  afterEach(() => {
    ModuleLoaderRunnerPlugin.instance = null;
  });

  test("a constant export is substituted as a literal, like a built-in constant", async () => {
    const dh = new GenericDataHandler(2);
    installFakeModule({
      physics: [{ symbol: "GRAVITY", value: { type: DataType.NUMBER, value: 9.8 } }],
    });
    const ast = parse("from physics import GRAVITY\nGRAVITY * 2\n");
    expect(await evaluatePython(ast, undefined, { evaluator: dh })).toBe("19.6");
  });

  test("a function export is called through, sync-fast-path or not, and its result is usable", async () => {
    const dh = new GenericDataHandler(2);
    async function* doubleFunc(
      a: TypedValue<DataType>,
    ): AsyncGenerator<void, TypedValue<DataType>, undefined> {
      await Promise.resolve(); // conductor's ExternCallable contract requires an async generator
      return { type: DataType.NUMBER, value: (a as TypedValue<DataType.NUMBER>).value * 2 };
    }
    const double = await dh.closure_make(
      { returnType: DataType.NUMBER, args: [DataType.NUMBER] },
      doubleFunc,
    );
    installFakeModule({ mathmod: [{ symbol: "double", value: double }] });
    const ast = parse("from mathmod import double\ndouble(21) + 1\n");
    expect(await evaluatePython(ast, undefined, { evaluator: dh })).toBe("43.0");
  });

  test("an opaque return value completes the program (renders as its label, never inspected)", async () => {
    const dh = new GenericDataHandler(2);
    class Thing {}
    async function* makeThingFunc(): AsyncGenerator<void, TypedValue<DataType>, undefined> {
      await Promise.resolve();
      return dh.opaque_make(new Thing());
    }
    const makeThing = await dh.closure_make(
      { returnType: DataType.OPAQUE, args: [] },
      makeThingFunc,
    );
    installFakeModule({ visualmod: [{ symbol: "make_thing", value: makeThing }] });
    // `explanations`/`steps` (this file's own helpers) never pass an evaluator through — calling
    // getPythonSteps directly here, as every test in this describe block does, is what actually wires
    // `dh` in.
    const ast = parse("from visualmod import make_thing\nmake_thing()\n");
    const stepped = await getPythonSteps(ast, undefined, { evaluator: dh });
    expect(stepped.at(-1)?.markers?.[0]?.explanation).toBe("Evaluation complete");
    const last = stepped.at(-1)!.ast as unknown as { body: unknown[] };
    expect(last.body).toEqual([]); // the opaque value was discarded like any other statement value

    // A *used* opaque value (assigned, not just created-and-discarded) renders as its label.
    const usedAst = parse("from visualmod import make_thing\nx = make_thing()\nx\n");
    const usedSteps = await getPythonSteps(usedAst, undefined, { evaluator: dh });
    const withOpaque = usedSteps.find(s => findNode(s.ast, (n: any) => n.type === "Opaque"));
    expect(withOpaque).toBeDefined();
    const opaqueNode = findNode(withOpaque!.ast, (n: any) => n.type === "Opaque");
    expect(opaqueNode.label).toBe("Thing");
    // No thumbnail hook attached — `dataUrl` stays unset so the host falls back to `<label>`.
    expect(opaqueNode.dataUrl).toBeUndefined();
  });

  // The global-registry symbol a module attaches a stepper-thumbnail render hook under — mirrors
  // `moduleInterop.ts`'s own `RENDER_THUMBNAIL_SYMBOL` (and modules-lib's, which defines the actual
  // cross-repo convention); redeclared here, not imported, for the same reason `moduleInterop.ts`
  // hardcodes it — see source-academy/modules's
  // `docs/src/modules/5-advanced/conductor-interop/6-opaque-thumbnails.md`.
  const RENDER_THUMBNAIL_SYMBOL = Symbol.for("source-academy.stepper.renderThumbnail");

  test("an opaque value with a thumbnail hook renders with its dataUrl set", async () => {
    const dh = new GenericDataHandler(2);
    class Rune {}
    async function* makeRuneFunc(): AsyncGenerator<void, TypedValue<DataType>, undefined> {
      await Promise.resolve();
      const rune = new Rune();
      Object.defineProperty(rune, RENDER_THUMBNAIL_SYMBOL, {
        value: () => Promise.resolve("data:image/png;base64,AAAA"),
        enumerable: false,
        configurable: true,
      });
      return dh.opaque_make(rune);
    }
    const makeRune = await dh.closure_make({ returnType: DataType.OPAQUE, args: [] }, makeRuneFunc);
    installFakeModule({ visualmod: [{ symbol: "make_rune", value: makeRune }] });
    const ast = parse("from visualmod import make_rune\nx = make_rune()\nx\n");
    const stepped = await getPythonSteps(ast, undefined, { evaluator: dh });
    const withOpaque = stepped.find(s => findNode(s.ast, (n: any) => n.type === "Opaque"));
    const opaqueNode = findNode(withOpaque!.ast, (n: any) => n.type === "Opaque");
    expect(opaqueNode.label).toBe("Rune");
    expect(opaqueNode.dataUrl).toBe("data:image/png;base64,AAAA");
  });

  /** Runs a program returning a single opaque `Broken` value whose thumbnail hook is `hookImpl`,
   * and returns the resulting `Opaque` step node — shared by the "throws" and "non-string result"
   * cases below, which differ only in `hookImpl`. */
  async function stepBrokenOpaqueHook(hookImpl: () => unknown) {
    const dh = new GenericDataHandler(2);
    class Broken {}
    async function* makeBrokenFunc(): AsyncGenerator<void, TypedValue<DataType>, undefined> {
      await Promise.resolve();
      const broken = new Broken();
      Object.defineProperty(broken, RENDER_THUMBNAIL_SYMBOL, {
        value: hookImpl,
        enumerable: false,
        configurable: true,
      });
      return dh.opaque_make(broken);
    }
    const makeBroken = await dh.closure_make(
      { returnType: DataType.OPAQUE, args: [] },
      makeBrokenFunc,
    );
    installFakeModule({ visualmod: [{ symbol: "make_broken", value: makeBroken }] });
    const ast = parse("from visualmod import make_broken\nx = make_broken()\nx\n");
    const stepped = await getPythonSteps(ast, undefined, { evaluator: dh });
    const withOpaque = stepped.find(s => findNode(s.ast, (n: any) => n.type === "Opaque"));
    return findNode(withOpaque!.ast, (n: any) => n.type === "Opaque");
  }

  test("a thumbnail hook that throws degrades to no dataUrl, not a stepper fault", async () => {
    const opaqueNode = await stepBrokenOpaqueHook(() => {
      throw new Error("rendering failed");
    });
    expect(opaqueNode.label).toBe("Broken");
    expect(opaqueNode.dataUrl).toBeUndefined();
  });

  test("a thumbnail hook that resolves to a non-string degrades to no dataUrl, not a stepper fault", async () => {
    const opaqueNode = await stepBrokenOpaqueHook(() => Promise.resolve(42));
    expect(opaqueNode.label).toBe("Broken");
    expect(opaqueNode.dataUrl).toBeUndefined();
  });

  test("an opaque value round-trips: one module call's result passed into another", async () => {
    // stepNodeToModule reads an Opaque node's `handle` back out (see its "Opaque" case) so a value
    // created by one imported function can be forwarded, unchanged, as an argument to another —
    // never converted to/from any stepper-representable form along the way.
    const dh = new GenericDataHandler(2);
    class Thing {}
    const theThing = new Thing();
    async function* makeThingFunc(): AsyncGenerator<void, TypedValue<DataType>, undefined> {
      await Promise.resolve();
      return dh.opaque_make(theThing);
    }
    async function* isSameThingFunc(
      x: TypedValue<DataType>,
    ): AsyncGenerator<void, TypedValue<DataType>, undefined> {
      await Promise.resolve();
      const payload = await dh.opaque_get(x as TypedValue<DataType.OPAQUE>);
      return { type: DataType.BOOLEAN, value: payload === theThing };
    }
    const makeThing = await dh.closure_make(
      { returnType: DataType.OPAQUE, args: [] },
      makeThingFunc,
    );
    const isSameThing = await dh.closure_make(
      { returnType: DataType.BOOLEAN, args: [DataType.OPAQUE] },
      isSameThingFunc,
    );
    installFakeModule({
      visualmod: [
        { symbol: "make_thing", value: makeThing },
        { symbol: "is_same_thing", value: isSameThing },
      ],
    });
    const ast = parse(
      "from visualmod import make_thing, is_same_thing\nis_same_thing(make_thing())\n",
    );
    expect(await evaluatePython(ast, undefined, { evaluator: dh })).toBe("True");

    // Bound to a name first, not nested directly as a call argument: `x`'s value substitutes into
    // `is_same_thing(x)` via `substitute`'s Identifier case, which — unlike the direct-nesting form
    // above (plain object-spread rebuilding, no `substitute` involved) — `clone()`s the Opaque node
    // being substituted in. `clone` deep-copies `handle`'s wrapper object, so this only round-trips
    // correctly because `TypedValue<DataType.OPAQUE>.value` (`OpaqueIdentifier`, an `Identifier &
    // {...}` brand — see conductor's own types) is a plain `number` at runtime: the clone is a new
    // object with the same primitive id, and `GenericDataHandler.opaqueMap` looks values up by that
    // id, not by object reference — so a structurally-cloned handle still resolves to the original.
    const boundAst = parse(
      "from visualmod import make_thing, is_same_thing\nx = make_thing()\nis_same_thing(x)\n",
    );
    expect(await evaluatePython(boundAst, undefined, { evaluator: dh })).toBe("True");
  });

  test("arity() reports an imported function's real parameter count", async () => {
    const dh = new GenericDataHandler(2);
    async function* addFunc(): AsyncGenerator<void, TypedValue<DataType>, undefined> {
      await Promise.resolve();
      return { type: DataType.NUMBER, value: 0 };
    }
    const add = await dh.closure_make(
      { returnType: DataType.NUMBER, args: [DataType.NUMBER, DataType.NUMBER] },
      addFunc,
    );
    installFakeModule({ mathmod: [{ symbol: "add", value: add }] });
    const ast = parse("from mathmod import add\narity(add)\n");
    expect(await evaluatePython(ast, undefined, { evaluator: dh })).toBe("2");
  });

  test("calling an imported function with the wrong arity is a Python-style TypeError, not a native crash", async () => {
    const dh = new GenericDataHandler(2);
    async function* doubleFunc(): AsyncGenerator<void, TypedValue<DataType>, undefined> {
      await Promise.resolve();
      throw new Error("should never be invoked — arity is checked before the call is placed");
    }
    const double = await dh.closure_make(
      { returnType: DataType.NUMBER, args: [DataType.NUMBER] },
      doubleFunc,
    );
    installFakeModule({ mathmod: [{ symbol: "double", value: double }] });
    const ast = parse("from mathmod import double\ndouble(1, 2)\n");
    const steps = await getPythonSteps(ast, undefined, { evaluator: dh });
    const secondLast = steps.at(-2);
    expect(secondLast?.markers?.[0]?.explanation).toBe(
      "TypeError: double() takes 1 argument(s) but 2 were given",
    );
    expect(steps.at(-1)?.markers?.[0]?.explanation).toBe("Evaluation stuck");
  });

  test("reports GenericDataHandler errors at the imported module call site", async () => {
    const dh = new GenericDataHandler(2);
    const outOfBounds = await dh.closure_make(
      { returnType: DataType.VOID, args: [] },
      async function* (): AsyncGenerator<void, TypedValue<DataType>, undefined> {
        const array = await dh.array_make(DataType.NUMBER, 1, {
          type: DataType.NUMBER,
          value: 0,
        });
        await dh.array_get(array, 3);
        return { type: DataType.VOID, value: undefined };
      },
    );
    installFakeModule({ validation: [{ symbol: "out_of_bounds", value: outOfBounds }] });
    const source = "from validation import out_of_bounds\nout_of_bounds()\n";
    dh.setCurrentSource(source);

    const value = await evaluatePython(parse(source), undefined, { evaluator: dh });

    expect(value).toContain("IndexError at line 2");
    expect(value).toContain("out_of_bounds()");
    expect(value).toContain("list index out of range");
  });

  test("a Python closure argument is declined — the call stays stuck, not silently wrong", async () => {
    // See moduleInterop.ts's module doc comment: forwarding a Python-authored callable into a module
    // call would need the module to call back into Python, which this design explicitly doesn't
    // support yet — an honest "Evaluation stuck", the same degrade `input()` already gets.
    const dh = new GenericDataHandler(2);
    async function* applyFunc(): AsyncGenerator<void, TypedValue<DataType>, undefined> {
      await Promise.resolve();
      throw new Error("should never be invoked — the call must stay stuck before reaching here");
    }
    const apply = await dh.closure_make(
      { returnType: DataType.NUMBER, args: [DataType.ANY] },
      applyFunc,
    );
    installFakeModule({ hofmod: [{ symbol: "apply", value: apply }] });
    const ast = parse("from hofmod import apply\napply(lambda x: x)\n");
    const steppedResult = await getPythonSteps(ast, undefined, { evaluator: dh });
    expect(steppedResult.at(-1)?.markers?.[0]?.explanation).toBe("Evaluation stuck");
  });

  test("a missing module is a clear error, not a silent unbound name", async () => {
    const dh = new GenericDataHandler(2);
    installFakeModule({});
    const ast = parse("from nosuchmodule import x\nx\n");
    await expect(getPythonSteps(ast, undefined, { evaluator: dh })).rejects.toThrow(/not found/i);

    // The loader's own rejection reason survives as `cause`, not just the generic "not found" text —
    // see moduleInterop.ts's resolveImports.
    let caught: unknown;
    try {
      await getPythonSteps(parse("from nosuchmodule import x\nx\n"), undefined, { evaluator: dh });
    } catch (error) {
      caught = error;
    }
    expect((caught as { cause?: unknown }).cause).toBeInstanceOf(Error);
    expect(((caught as { cause?: Error }).cause as Error).message).toBe(
      "no such module: nosuchmodule",
    );
  });

  test("a name a module doesn't export is a clear error", async () => {
    const dh = new GenericDataHandler(2);
    installFakeModule({
      mathmod: [{ symbol: "double", value: { type: DataType.NUMBER, value: 1 } }],
    });
    const ast = parse("from mathmod import triple\ntriple\n");
    await expect(getPythonSteps(ast, undefined, { evaluator: dh })).rejects.toThrow(
      /cannot import name 'triple'/,
    );
  });
});
