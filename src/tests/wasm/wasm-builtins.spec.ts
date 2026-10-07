/**
 * py-slang#488: the stdlib builtins the WASM engine provides, checked against
 * the CSE machine (the reference implementation) rather than hard-coded
 * expectations, plus a sweep that every builtin a chapter offers resolves.
 */
import { compileToWasmAndRun } from "../../engines/wasm";
import { WASM_UNSUPPORTED_BUILTINS } from "../../engines/wasm/bridgedBuiltins";
import { WASM_GROUPS } from "../../engines/wasm/groups";
import { runCode, VARIANT_GROUPS } from "../../runner";

it = it.concurrent;
jest.setTimeout(60000);

async function runWasm(code: string, chapter = 4): Promise<{ output: string; error?: string }> {
  const { prints, errors } = await compileToWasmAndRun(code, false, {
    chapter,
    groups: WASM_GROUPS[chapter],
  });
  return { output: prints.map(p => p + "\n").join(""), error: errors[0]?.message };
}

async function runCse(code: string, chapter = 4): Promise<{ output: string; error?: string }> {
  try {
    return { output: await runCode(code, chapter) };
  } catch (e) {
    const err = e as { output?: string; message?: string };
    return { output: err.output ?? "", error: err.message };
  }
}

/** The error's kind word ("ValueError", "TypeError", ...), which both engines
 * put first in the message, ignoring engine-specific position/detail text. */
const errorKind = (error: string | undefined) => error?.match(/[A-Za-z]+Error/)?.[0];

const expectSameAsCse = async (code: string, chapter = 4) => {
  const [wasm, cse] = await Promise.all([runWasm(code, chapter), runCse(code, chapter)]);
  expect(errorKind(wasm.error)).toBe(errorKind(cse.error));
  expect(wasm.output).toBe(cse.output);
};

/** Runs `setup` followed by each print line as its own program. File mode
 * currently corrupts evaluation after a print of a heap value (string, list)
 * that is not the program's last statement (py-slang#431), so such prints
 * cannot share a program. */
const expectEachSameAsCse = async (setup: string, prints: string[], chapter = 4) => {
  for (const line of prints) await expectSameAsCse(`${setup}${line}\n`, chapter);
};

describe("bridged numeric builtins agree with CSE", () => {
  const expressions = [
    "abs(-3)",
    "abs(-2.5)",
    "abs(3 + 4j)",
    "abs(True)",
    "round(2.5)",
    "round(3.5)",
    "round(-0.5)",
    "round(3.14159, 2)",
    "round(1234, -2)",
    "real(3 + 4j)",
    "imag(3 + 4j)",
    "is_number(2.5)",
    "is_number(3 + 4j)",
    "is_number(True)",
    "is_integer(3)",
    "is_integer(3.0)",
    "complex(1, 2)",
    "complex(3)",
    "math_sqrt(16)",
    "math_sqrt(-1)",
    "math_pow(2, 10)",
    "math_pow(0, -1)",
    "math_log(8, 2)",
    "math_log(100)",
    "math_log(0)",
    "math_perm(5)",
    "math_perm(5, 2)",
    "math_comb(5, 2)",
    "math_factorial(10)",
    "math_factorial(-1)",
    "math_gcd(12, 18)",
    "math_gcd(12, 18, 27)",
    "math_gcd()",
    "math_lcm(4, 6)",
    "math_lcm()",
    "math_floor(2.7)",
    "math_ceil(2.1)",
    "math_trunc(-2.7)",
    "math_fma(2, 3, 4)",
    "math_atan2(1, 1)",
    "math_isnan(math_nan)",
    "math_isinf(math_inf)",
    "math_pi",
    "math_e",
    "math_tau",
    "math_inf",
    "math_nan",
    "math_sin(math_pi / 2)",
    "math_cos(0)",
    "math_exp(1)",
    "math_gamma(5)",
    "math_erf(0.5)",
    "math_copysign(3, -0.0)",
    "math_ldexp(1.5, 3)",
    "math_fmod(7, 3)",
    "math_remainder(7, 3)",
    "math_degrees(math_pi)",
    "math_isqrt(17)",
    "math_cbrt(27)",
    "math_sqrt('a')",
    "math_sqrt()",
    "math_sqrt(1, 2)",
    "abs('a')",
    "round(1, 2, 3)",
  ];

  for (const expression of expressions) {
    it(expression, async () => {
      await expectSameAsCse(`print(${expression})\n`);
    });
  }

  it("random_random and time_time return floats", async () => {
    const { output, error } = await runWasm(
      "x = random_random()\nprint(x >= 0.0 and x < 1.0)\nprint(time_time() > 0.0)\n",
    );
    expect(error).toBeUndefined();
    expect(output).toBe("True\nTrue\n");
  });
});

describe("bridged builtins are well-behaved inside larger programs", () => {
  it("keeps GC'able (complex) arguments consistent on the shadow stack", async () => {
    const code = `
def go(n, acc):
    if n == 0:
        return acc
    else:
        return go(n - 1, acc + abs(3 + 4j) + real(1 + 2j) + imag(1 + 2j))
print(go(200, 0.0))
`;
    await expectSameAsCse(code);
  });

  it("can be passed around as first-class values", async () => {
    await expectSameAsCse("f = math_sqrt\nprint(f(9))\nprint(is_function(f))\n");
  });

  it("can be shadowed by user definitions", async () => {
    const { output, error } = await runWasm("def abs(x):\n    return 42\nprint(abs(-1))\n");
    expect(error).toBeUndefined();
    expect(output).toBe("42\n");
  });
});

describe("min and max", () => {
  it("two arguments, numbers and strings, in every chapter", async () => {
    for (const chapter of [1, 2, 3, 4]) {
      await expectEachSameAsCse(
        "",
        ["print(min(3, 1))", "print(max(1.5, 2))", "print(max('a', 'c'))", "print(min(2, 2.0))"],
        chapter,
      );
    }
  });

  it("any number of arguments from chapter 3", async () => {
    await expectEachSameAsCse(
      "",
      ["print(min(3, 1, 2))", "print(max(1, 5, 3, 4))", "print(max('a', 'c', 'b'))"],
      3,
    );
  });

  it("mixed types are an error", async () => {
    const wasm = await runWasm("print(max(1, 'a'))\n");
    expect(wasm.error).toMatch(/TypeError/);
  });
});

describe("streams (chapters 3 and 4)", () => {
  const prints = [
    "print(head(stream_tail(s)))",
    "print(is_stream(s))",
    "print(stream_ref(integers_from(5), 3))",
    "print(eval_stream(stream_map(lambda x: x * 2, s), 3))",
    "print(stream_to_llist(s))",
    "print(eval_stream(enum_stream(1, 5), 5))",
  ];

  it("builds and consumes streams", async () => {
    await expectEachSameAsCse("s = stream(1, 2, 3)\n", prints, 3);
    await expectEachSameAsCse("s = stream(1, 2, 3)\n", prints, 4);
  });

  it("the empty stream is None", async () => {
    await expectEachSameAsCse("", ["print(stream())", "print(is_stream(stream()))"], 3);
  });
});

describe("lambdas restore the caller's environment", () => {
  it("a lambda call used as an argument (file mode)", async () => {
    const code = "h = lambda x: x + 1\nprint(h(1))\nprint(h(h(1)))\n";
    const { output, error } = await runWasm(code, 1);
    expect(error).toBeUndefined();
    expect(output).toBe("2\n3\n");
  });

  it("a zero-argument lambda captured in a closure", async () => {
    const code = "def f(n):\n    return lambda: n + 1\nprint(f(1)())\nprint(f(f(1)())())\n";
    const { output, error } = await runWasm(code, 1);
    expect(error).toBeUndefined();
    expect(output).toBe("2\n3\n");
  });
});

describe("every builtin a chapter offers is available", () => {
  for (const chapter of [1, 2, 3, 4]) {
    it(`chapter ${chapter}`, async () => {
      const names = new Set<string>();
      for (const group of VARIANT_GROUPS[chapter]) {
        for (const name of group.builtins.keys()) names.add(name);
        for (const match of group.prelude.matchAll(/^def ([A-Za-z0-9]\w*)/gm)) names.add(match[1]);
      }
      // draw_data needs the data visualizer, which the WASM engine has no
      // connection to (see the headless-CLI work in #478).
      const expectedMissing = new Set([...WASM_UNSUPPORTED_BUILTINS, "draw_data"]);

      const missing: string[] = [];
      for (const name of names) {
        if (name.startsWith("_") || expectedMissing.has(name)) continue;
        const { error } = await runWasm(`f = ${name}\n`, chapter);
        if (error !== undefined) missing.push(name);
      }
      expect(missing).toEqual([]);
    }, 120000);
  }

  it("unsupported builtins say so instead of claiming the name is undefined", async () => {
    const { error } = await runWasm("f = input\n");
    expect(error).toBe("NameError: 'input' is not supported by the WASM engine");
  });
});
