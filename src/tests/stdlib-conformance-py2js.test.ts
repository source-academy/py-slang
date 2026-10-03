/**
 * py2js stdlib-bridge parity sweep.
 *
 * The py2js engine runs the *same* stdlib builtin implementations as the CSE
 * machine, through the value-conversion bridge in
 * src/engines/py2js/stdlibBridge.ts. This suite pins that bridge: every
 * builtin and constant of the chapter's stdlib groups is swept over
 * representative argument tuples drawn from the chapter's type universe, and
 * the outcome (printed text, or error) is compared against the CSE machine
 * evaluating the identical program via runner.ts's runCode — the reference
 * implementation, computed fresh, exactly as the operator conformance sweeps
 * do.
 *
 * Argument tuples per builtin: the empty call, one argument of each type in
 * the chapter's universe, and int/float pairs — enough to exercise every
 * @Validate arity gate, every per-type dispatch arm, and the bridge's
 * conversions in both directions. Value outcomes compare full printed text
 * (both engines format through toPythonString/pyStr conventions); error
 * outcomes compare that both engines raised.
 *
 * Exclusions:
 *  - input: needs a real requestInput round-trip (see runtime.ts/
 *    Py2JsEvaluator.ts), which only the conductor evaluator wires up —
 *    runCodePy2Js here has none, so it raises RuntimeError, while the CSE
 *    reference (via runCode, also conductor-less) blocks on (closed) stdin
 *    and returns "" — no comparable outcome either way.
 *  - set_timeout / clear_all_timeout: implemented only by py2js so far
 *    (source-academy/py-slang#311) — the CSE reference always raises "not
 *    yet supported by the CSE machine" (src/stdlib/misc.ts), a permanent,
 *    expected mismatch rather than a bridge bug.
 *  - random_random / time_time: nondeterministic values; success-vs-error
 *    only (KIND_ONLY).
 *  - print_llist on a *proper* list (llist(...) rendering, as opposed to the
 *    bracket-notation rendering a flat single-literal call already reaches):
 *    no flat argument tuple builds one, so that path — and the rest of the
 *    linked-list prelude (map/filter/reduce/append/…) — is covered by the
 *    directed cases below instead.
 */
import { Py2JsRunError, runCodePy2Js } from "../engines/py2js";
import { RunError, runCode } from "../runner";
import linkedList from "../stdlib/linked-list";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import type { Group } from "../stdlib/utils";

/** Representative literal per chapter-1 type (operator-spec.ts's set, minus
 * list, which chapter 1 rejects). */
const LITERALS = ["2", "2.5", "(1+2j)", "True", "'ab'", "None", "(lambda x: x)"];

/** Chapter 2 adds "list" — always a pair, per operator-spec.ts's literalFor. */
const CH2_LITERALS = [...LITERALS, "pair(1, 2)"];

// input: see above. set_timeout/clear_all_timeout: implemented only by
// py2js so far (source-academy/py-slang#311) — the CSE reference always
// throws "not yet supported", a permanent, expected mismatch, not a bridge
// bug to catch.
const SKIP = new Set(["input", "set_timeout", "clear_all_timeout"]);
const KIND_ONLY = new Set(["random_random", "time_time"]);

type Outcome = { kind: "value"; text: string } | { kind: "error" };

async function cseOutcome(code: string, variant: number): Promise<Outcome> {
  try {
    return { kind: "value", text: await runCode(code, variant) };
  } catch (e) {
    if (e instanceof RunError) return { kind: "error" };
    throw e;
  }
}

function py2jsOutcome(code: string, variant: number): Outcome {
  try {
    return { kind: "value", text: runCodePy2Js(code, variant).output };
  } catch (e) {
    if (e instanceof Py2JsRunError) return { kind: "error" };
    throw e;
  }
}

async function expectParity(code: string, variant = 1, kindOnly = false): Promise<void> {
  const wanted = await cseOutcome(code, variant);
  const actual = py2jsOutcome(code, variant);
  if (kindOnly) {
    expect(actual.kind).toBe(wanted.kind);
  } else {
    expect(actual).toStrictEqual(wanted);
  }
}

function argTuplesFor(literals: string[]): string[][] {
  return [[], ...literals.map(l => [l]), ["2", "2"], ["2", "2.5"], ["2.5", "2"], ["2.5", "2.5"]];
}

const SWEEPS: { chapter: number; groups: Group[]; literals: string[] }[] = [
  { chapter: 1, groups: [misc, math], literals: LITERALS },
  { chapter: 2, groups: [misc, math, linkedList], literals: CH2_LITERALS },
];

for (const { chapter, groups, literals } of SWEEPS) {
  const argTuples = argTuplesFor(literals);
  describe(`[py2js] stdlib parity: chapter ${chapter}`, () => {
    for (const group of groups) {
      describe(group.name, () => {
        for (const [name, value] of group.builtins) {
          if (SKIP.has(name)) continue;

          if (value.type !== "builtin") {
            test(`constant ${name}`, async () => {
              await expectParity(`print(${name})`, chapter);
            });
            continue;
          }

          describe(name, () => {
            for (const args of argTuples) {
              const code = `print(${name}(${args.join(", ")}))`;
              test(code, async () => {
                await expectParity(code, chapter, KIND_ONLY.has(name));
              });
            }
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

describe("[py2js] stdlib parity: chapter 2 directed cases", () => {
  const cases = [
    // print_llist's "llist(...)" branch (a *proper* list) vs. the bracket
    // notation the flat-literal sweep above already reaches for a bare pair.
    `print_llist(pair(1, pair(2, pair(3, None))))`,
    `print_llist(pair(1, 2))`,
    `print(is_llist(pair(1, pair(2, None))))`,
    `print(is_llist(pair(1, 2)))`,
    `print(is_llist(None))`,
    // the linked-list prelude (SICPy source, compiled and run — not bridged)
    `print(length(pair(1, pair(2, pair(3, None)))))`,
    `xs = pair(1, pair(2, pair(3, None)))\nprint(map(lambda x: x * 2, xs))`,
    `xs = pair(1, pair(2, pair(3, None)))\nprint(filter(lambda x: x > 1, xs))`,
    `xs = pair(1, pair(2, pair(3, None)))\nprint(reduce(lambda a, b: a + b, 0, xs))`,
    `print(build_llist(lambda i: i * i, 5))`,
    `xs = pair(1, pair(2, None))\nfor_each(print, xs)`,
    `print(llist_to_string(pair(1, pair(2, None))))`,
    `xs = pair(1, pair(2, pair(3, None)))\nprint(reverse(xs))`,
    `print(append(pair(1, pair(2, None)), pair(3, pair(4, None))))`,
    `xs = pair(1, pair(2, pair(3, None)))\nprint(member(2, xs))`,
    `xs = pair(1, pair(2, pair(3, None)))\nprint(member(9, xs))`,
    `xs = pair(1, pair(2, pair(3, None)))\nprint(remove(2, xs))`,
    `xs = pair(2, pair(2, pair(3, None)))\nprint(remove_all(2, xs))`,
    `print(enum_llist(1, 5))`,
    `print(llist_ref(pair(10, pair(20, pair(30, None))), 1))`,
    `print(llist(1, 2, 3))`,
    `print(llist())`,
    // a function value round-trips through pair()/head()/llist() as the
    // exact original, callable object — not just a printable stand-in
    `f = pair(1, lambda x: x + 1)\nprint(head(f), tail(f)(41))`,
    `xs = llist(lambda x: x * 2)\nprint(head(xs)(21))`,
    // pair equality: structural, recursive, identity shortcut, and the §1/§2
    // bool exclusion re-applying inside nested elements (also swept
    // exhaustively by operator-conformance-py2js.test.ts; these are just a
    // couple of composed, human-legible cases here too)
    `print(pair(1, pair(2, None)) == pair(1, pair(2, None)))`,
    `print(pair(1, 2) == pair(1, 3))`,
    `xs = pair(1, 2)\nprint(xs == xs)`,
    `print(pair(True, 1) == pair(True, 1))`,
  ];
  for (const code of cases) {
    test(JSON.stringify(code), async () => {
      await expectParity(code, 2);
    });
  }
});
