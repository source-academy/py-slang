/**
 * py2js stdlib-bridge parity sweep.
 *
 * The py2js engine runs the *same* stdlib builtin implementations as the CSE
 * machine, through the value-conversion bridge in
 * src/engines/py2js/stdlibBridge.ts. This suite pins that bridge: every
 * chapter-1 builtin and constant of the misc/math groups is swept over
 * representative argument tuples drawn from the chapter-1 type universe, and
 * the outcome (printed text, or error) is compared against the CSE machine
 * evaluating the identical program via runner.ts's runCode — the reference
 * implementation, computed fresh, exactly as the operator conformance sweeps
 * do.
 *
 * Argument tuples per builtin: the empty call, one argument of each
 * chapter-1 type, and int/float pairs — enough to exercise every @Validate
 * arity gate, every per-type dispatch arm, and the bridge's conversions in
 * both directions. Value outcomes compare full printed text (both engines
 * format through toPythonString/pyStr conventions); error outcomes compare
 * that both engines raised.
 *
 * Exclusions:
 *  - input: stream-based; py2js deliberately raises "not supported yet"
 *    while the CSE runner blocks on (closed) stdin — no comparable outcome.
 *  - random_random / time_time: nondeterministic values; success-vs-error
 *    only (KIND_ONLY).
 */
import { Py2JsRunError, runCodePy2Js } from "../engines/py2js";
import { RunError, runCode } from "../runner";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import type { Group } from "../stdlib/utils";

/** Representative literal per chapter-1 type (operator-spec.ts's set, minus
 * list, which chapter 1 rejects). */
const LITERALS = ["2", "2.5", "(1+2j)", "True", "'ab'", "None", "(lambda x: x)"];

const SKIP = new Set(["input"]);
const KIND_ONLY = new Set(["random_random", "time_time"]);

type Outcome = { kind: "value"; text: string } | { kind: "error" };

async function cseOutcome(code: string): Promise<Outcome> {
  try {
    return { kind: "value", text: await runCode(code, 1) };
  } catch (e) {
    if (e instanceof RunError) return { kind: "error" };
    throw e;
  }
}

function py2jsOutcome(code: string): Outcome {
  try {
    return { kind: "value", text: runCodePy2Js(code, 1).output };
  } catch (e) {
    if (e instanceof Py2JsRunError) return { kind: "error" };
    throw e;
  }
}

async function expectParity(code: string, kindOnly = false): Promise<void> {
  const wanted = await cseOutcome(code);
  const actual = py2jsOutcome(code);
  if (kindOnly) {
    expect(actual.kind).toBe(wanted.kind);
  } else {
    expect(actual).toStrictEqual(wanted);
  }
}

const argTuples: string[][] = [
  [],
  ...LITERALS.map(l => [l]),
  ["2", "2"],
  ["2", "2.5"],
  ["2.5", "2"],
  ["2.5", "2.5"],
];

for (const group of [misc, math] as Group[]) {
  describe(`[py2js] stdlib parity: ${group.name}`, () => {
    for (const [name, value] of group.builtins) {
      if (SKIP.has(name)) continue;

      if (value.type !== "builtin") {
        test(`constant ${name}`, async () => {
          await expectParity(`print(${name})`);
        });
        continue;
      }

      describe(name, () => {
        for (const args of argTuples) {
          const code = `print(${name}(${args.join(", ")}))`;
          test(code, async () => {
            await expectParity(code, KIND_ONLY.has(name));
          });
        }
      });
    }
  });
}

describe("[py2js] stdlib parity: directed cases", () => {
  const cases = [
    // arity must agree across user functions, lambdas, native and bridged builtins
    `def f(a, b):\n    return a\nprint(arity(f))`,
    `print(arity(lambda x: x))`,
    `print(arity(abs))`,
    `print(arity(print))`,
    `print(arity(complex))`,
    // function values rendered through bridged str/repr
    `def f(a):\n    return a\nprint(str(f))`,
    `print(str(abs))`,
    // results flow back into the program as native values
    `print(max(2, 3) + abs(-4))`,
    `print(math_sqrt(abs(complex(-3, 4))))`,
    `print(round(2.675, 2) + 1.0)`,
    `print(complex(1, 2) + complex(3, -1))`,
    `print(real(complex(1.5, 2)) + imag(complex(1.5, 2)))`,
    `print(is_function(lambda x: x), is_function(abs), is_function(2))`,
    `print(len('hello') + 1)`,
    // user-level error builtin
    `error("boom")`,
  ];
  for (const code of cases) {
    test(JSON.stringify(code), async () => {
      await expectParity(code);
    });
  }
});
