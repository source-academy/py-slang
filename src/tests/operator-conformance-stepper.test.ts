/**
 * Stepper parity sweep for operator-conformance.test.ts.
 *
 * Reuses that suite's spec tables/type universe (see operator-spec.ts; the human source of truth is
 * still the four docs/specs/python_typing_*.tex fragments) and sweeps the same operator × type ×
 * type cross product, through the substitution-model stepper (src/conductor/stepper/) instead of the
 * CSE machine. For each combination, the CSE machine's own result is computed fresh and used as the
 * expected value — same rationale as the native-Pynter/pynter-wasm suites: this pins the stepper
 * against the *actual* reference implementation, not a second hand-written copy that could drift.
 *
 * Only Python §1/§2 are swept — the stepper never covers §3/§4 (no `is`/`is not`, no plan to add
 * them: identity has no clean meaning in a substitution model with no persistent object identity,
 * and `PyStepperEvaluator1`/`PyStepperEvaluator2` are the only stepper evaluators that exist — see
 * scripts/build.ts). `reduce.ts`'s binary-operator reduction (`contractBinary`/`structuralEquals`)
 * deliberately takes no chapter parameter at all: chapter only flows into `preprocessPython` for
 * name/feature-gating. This is correct, not an oversight — docs/specs/python_typing_middle_12.tex
 * already specifies identical `==`/`!=` semantics for §1 and §2 (any × any → bool, except bool/
 * function operands), so there is no chapter distinction for the stepper to make in the first place.
 * This sweep exists to pin that invariant down concretely (§1 and §2 must keep agreeing), not to
 * test a chapter differentiation the implementation was never meant to have.
 *
 * Three possible outcomes per case (not two, unlike the other conformance suites):
 *   - "value": the stepper reduced to a normal form.
 *   - "error": a genuine Python-level error was thrown mid-reduction (e.g. a TypeError), shown to the
 *     user before a terminal "Evaluation stuck" step.
 *   - "stuck": reduction halted with *no* error and *no* value — reduce.ts's own doc comments
 *     describe this as the deliberate fallback for "unmodelled-but-valid" Python (this dialect's own
 *     restrictions, like excluding bool from every operator, still produce a proper error via
 *     reportBinaryTypeError; only real Python features this teaching stepper doesn't implement at
 *     all — string repetition, %-formatting — fall through to a silent "stuck").
 *
 * Where CSE expects a value, the stepper must produce the *same* value — "stuck" doesn't count,
 * even though it's a safe failure mode, because it means the case was silently never checked rather
 * than genuinely agreeing. Where CSE expects an error, either a matching error *or* "stuck" satisfies
 * it (both mean "did not silently produce a wrong value") — matching reportBinaryTypeError's own
 * documented philosophy of treating "stuck" as an acceptable fallback for a case it doesn't
 * specifically diagnose.
 *
 * Besides the binary-operator and unary `-` sweeps, also covers `not`/`and`/`or` (mirroring the
 * native-Pynter/pynter-wasm suites' own blocks for these): since `and`/`or` produce "any" (one of the
 * operands, whichever short-circuiting picks) and `not` only ever produces bool, the binary-operator
 * sweep above already pins the operand-type restrictions that matter via CSE parity — these blocks
 * only check success-vs-error, not the exact value.
 */
import { StmtNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { evaluate } from "../engines/cse/interpreter";
import { Stash, Value } from "../engines/cse/stash";
import { evaluatePython, getPythonSteps } from "../conductor/stepper/getSteps";
import { preprocessPython } from "../conductor/stepper/preprocess";
import { parse } from "../parser";
import { Resolver } from "../resolver";
import { toPythonString } from "../stdlib/utils";
import { Group } from "../stdlib/utils";
import { makeValidatorsForChapter } from "../validator";
import { BINARY_OPS_12, groupsForChapter, literalFor, universeForChapter } from "./operator-spec";
import { generateMockStreams } from "./utils";

type CseOutcome = { kind: "value"; text: string } | { kind: "error" };

/**
 * Evaluates `code` through the CSE machine to get the reference outcome. A trimmed copy of
 * operator-conformance.test.ts's own `run()` — see operator-conformance-pynter.test.ts's identical
 * helper for why (any error counts as agreement; exact error class isn't the point here).
 */
async function cseOutcome(code: string, chapter: number, groups: Group[]): Promise<CseOutcome> {
  const script = code + "\n";
  let ast: StmtNS.Stmt;
  try {
    ast = parse(script);
    const resolver = new Resolver(script, ast, makeValidatorsForChapter(chapter), groups, []);
    if (resolver.resolve(ast).length > 0) {
      return { kind: "error" };
    }
  } catch {
    return { kind: "error" };
  }

  const context = new Context();
  generateMockStreams(context, []);
  for (const group of groups) {
    for (const [name, value] of group.builtins) {
      context.nativeStorage.builtins.set(name, value);
    }
  }
  const spy = jest.spyOn(Stash.prototype, "pop");
  let lastPopped: Value | undefined;
  try {
    await evaluate(code, ast, context, { variant: chapter });
    lastPopped = spy.mock.results.at(-1)?.value as Value | undefined;
  } finally {
    spy.mockRestore();
  }
  if (context.errors.length > 0) {
    return { kind: "error" };
  }
  return {
    // repr, not str: matches evaluatePython's own final-value text (e.g. quoted strings), since
    // that's what the stepper actually renders as its terminal "Evaluation complete" value.
    kind: "value",
    text: lastPopped ? toPythonString(lastPopped, true) : "None",
  };
}

type StepperOutcome = { kind: "value"; text: string } | { kind: "error" } | { kind: "stuck" };

/**
 * Evaluates `code` through the stepper, classifying the outcome via the exact same "Evaluation
 * complete"/"Evaluation stuck" distinction getPythonSteps() itself reports on its terminal step (see
 * getSteps.ts's own `isComplete` and its runtime-error branch) — not re-derived independently, so
 * this can't drift from what the stepper actually shows a user. A caught runtime error pushes the
 * thrown message as the second-to-last step's explanation, immediately before the terminal
 * "Evaluation stuck" — distinguishing "error" from a genuine "stuck" (no preceding error-shaped
 * explanation) this way.
 */
function stepperOutcome(code: string, chapter: number): StepperOutcome {
  const script = code + "\n";
  let ast: StmtNS.FileInput;
  try {
    ast = parse(script);
  } catch {
    return { kind: "error" };
  }
  if (preprocessPython(ast, script, chapter) !== null) {
    return { kind: "error" };
  }

  const steps = getPythonSteps(ast);
  const last = steps[steps.length - 1];
  if (last.markers?.[0]?.explanation === "Evaluation complete") {
    return { kind: "value", text: evaluatePython(ast) };
  }
  const secondLast = steps[steps.length - 2];
  const secondLastExplanation = secondLast?.markers?.[0]?.explanation;
  if (secondLastExplanation !== undefined && /Error:/.test(secondLastExplanation)) {
    return { kind: "error" };
  }
  return { kind: "stuck" };
}

/** See file header for why "stuck" satisfies a CSE "error" expectation but never a "value" one. */
function expectMatch(wanted: CseOutcome, actual: StepperOutcome): void {
  if (wanted.kind === "value") {
    expect(actual.kind).toBe("value");
    if (actual.kind === "value") {
      expect(actual.text).toBe(wanted.text);
    }
  } else {
    expect(["error", "stuck"]).toContain(actual.kind);
  }
}

/**
 * Exact `code` strings known to currently diverge from the CSE machine — real Python features this
 * teaching stepper deliberately does not model (see reduce.ts's own doc comments on
 * `reportBinaryTypeError`/`stringBinary`), not value-mismatch bugs. Empty until the sweep below is
 * run and any real ones are found and explained here, same convention as the native-Pynter/
 * pynter-wasm suites' own KNOWN_GAPS.
 */
const KNOWN_GAPS = new Set<string>([]);

/** `test`, or `test.skip` when `code` is a known gap. */
function testOrSkip(code: string): typeof test {
  return KNOWN_GAPS.has(code) ? test.skip : test;
}

for (const chapter of [1, 2]) {
  describe(`[stepper] Operator conformance at Python §${chapter}`, () => {
    const ops = BINARY_OPS_12;
    const universe = universeForChapter(chapter);
    // The stepper compiles no separate prelude, so only cseOutcome needs this: it's what the CSE
    // machine requires to resolve `pair`/list-library names (the §2 universe includes "list", built
    // via `pair(1, 2)`) at this chapter.
    const groups: Group[] = groupsForChapter(chapter);

    for (const op of ops) {
      describe(op, () => {
        for (const left of universe) {
          for (const right of universe) {
            const code = `${literalFor(left, chapter)} ${op} ${literalFor(right, chapter)}`;
            testOrSkip(code)(code, async () => {
              const wanted = await cseOutcome(code, chapter, groups);
              const actual = stepperOutcome(code, chapter);
              expectMatch(wanted, actual);
            });
          }
        }
      });
    }

    describe("unary -", () => {
      for (const operand of universe) {
        const code = `-${literalFor(operand, chapter)}`;
        testOrSkip(code)(code, async () => {
          const wanted = await cseOutcome(code, chapter, groups);
          const actual = stepperOutcome(code, chapter);
          expectMatch(wanted, actual);
        });
      }
    });

    // `and`/`or` produce "any" (one of the operands), and `not` only ever produces bool — the binary
    // sweep above already pins operand-type restrictions for these via CSE parity, so only
    // success-vs-error is checked here, same convention as the native-Pynter/pynter-wasm suites'
    // own "not"/"and"/"or" blocks.
    describe("not", () => {
      for (const operand of universe) {
        const code = `not ${literalFor(operand, chapter)}`;
        testOrSkip(code)(code, async () => {
          const wanted = await cseOutcome(code, chapter, groups);
          const actual = stepperOutcome(code, chapter);
          if (wanted.kind === "value") {
            expect(actual.kind).toBe("value");
          } else {
            expect(["error", "stuck"]).toContain(actual.kind);
          }
        });
      }
    });

    for (const op of ["and", "or"]) {
      describe(op, () => {
        for (const left of universe) {
          for (const right of universe) {
            const code = `${literalFor(left, chapter)} ${op} ${literalFor(right, chapter)}`;
            testOrSkip(code)(code, async () => {
              const wanted = await cseOutcome(code, chapter, groups);
              const actual = stepperOutcome(code, chapter);
              if (wanted.kind === "value") {
                expect(actual.kind).toBe("value");
              } else {
                expect(["error", "stuck"]).toContain(actual.kind);
              }
            });
          }
        }
      });
    }
  });
}
