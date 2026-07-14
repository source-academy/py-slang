/**
 * Native Pynter parity sweep for operator-conformance.test.ts.
 *
 * Reuses that suite's spec tables/type universe (see operator-spec.ts; the
 * human source of truth is still the four docs/specs/python_typing_*.tex
 * fragments) and sweeps the same operator × type × type cross product,
 * through the native Pynter `runner` binary instead of the CSE machine. For
 * each combination, the CSE machine's own result is computed fresh and used
 * as the expected value — so this pins native Pynter against the *actual*
 * reference implementation, not a second hand-written copy of it that could
 * drift.
 *
 * Pynter's target is Python (SICPy) §3 specifically (see pynter/README.md):
 * it implements that chapter's semantics unconditionally, with no runtime
 * notion of "chapter" to gate narrower/wider rules for §1/§2/§4. So unlike
 * operator-conformance.test.ts (which sweeps all four chapters against the
 * CSE machine), this file only ever exercises §3.
 *
 * One PVML-specific carve-out: `complex` is dropped from the type universe
 * entirely. PVMLCompiler.visitComplexExpr rejects complex literals outright
 * at compile time — there is no PVML complex-number representation to be
 * conformant *about* — so every complex-adjacent spec row is untestable here
 * by construction, not a gap worth enumerating.
 *
 * Opt-in: set PYNTER_RUNNER_PATH to a built `runner` binary, same as every
 * other native Pynter suite. Skipped entirely otherwise.
 */
import { StmtNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { evaluate } from "../engines/cse/interpreter";
import { Stash, Value } from "../engines/cse/stash";
import { parse } from "../parser/parser-adapter";
import { runCodePvmlDetailed } from "../pvml-runner";
import { Resolver } from "../resolver";
import { RunError, VARIANT_GROUPS } from "../runner";
import { Group, toPythonString } from "../stdlib/utils";
import { makeValidatorsForChapter } from "../validator";
import {
  BINARY_OPS_12,
  BINARY_OPS_34,
  literalFor,
  PyType,
  universeForChapter,
} from "./operator-spec";
import { generateMockStreams, isCloseToFloat32 } from "./utils";

/** PVML has no complex-number support at all; see file header. */
function pvmlUniverseForChapter(chapter: number): PyType[] {
  return universeForChapter(chapter).filter(type => type !== "complex");
}

type CseOutcome = { kind: "value"; stashType: string; text: string } | { kind: "error" };

/**
 * Evaluates `code` through the CSE machine to get the reference outcome.
 * A trimmed copy of operator-conformance.test.ts's own `run()`: that one
 * distinguishes resolve- vs runtime-errors by class name for its own
 * assertions, which this file doesn't need — any error means "the operation
 * is rejected", matching how generateNativePynterTestCases treats CSE error
 * expectations elsewhere. `text` is the exact string print() would produce
 * for the popped value (via toPythonString) — see runPvml's doc comment for
 * why this is what gets compared, rather than the value itself.
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
    kind: "value",
    stashType: lastPopped?.type ?? "none",
    text: lastPopped ? toPythonString(lastPopped) : "None",
  };
}

type PvmlOutcome = { kind: "value"; text: string } | { kind: "error" };

/**
 * Native Pynter's execution model is exec-mode only (see pvml-compiler.ts's
 * visitFileInputStmt doc comment) — a compiled program never leaves a value
 * on the stack, so `captureLastExpression` (print()-wrapping the last bare
 * expression) is the only way to observe one, mirroring
 * generateNativePynterTestCases' identical technique in src/tests/utils.ts.
 */
async function runPvml(
  code: string,
  chapter: number,
  groups: Group[],
  pynterPath: string,
): Promise<PvmlOutcome> {
  try {
    const result = await runCodePvmlDetailed(code, chapter, {
      pynterPath,
      groups,
      captureLastExpression: true,
    });
    return { kind: "value", text: result.capturedResult ?? "" };
  } catch (e) {
    if (e instanceof RunError) return { kind: "error" };
    throw e;
  }
}

/** Asserts `actual` matches `wanted` — a CSE value needs the same value from Pynter; a CSE error just needs any Pynter error. */
function expectMatch(wanted: CseOutcome, actual: PvmlOutcome): void {
  if (wanted.kind === "value") {
    expect(actual.kind).toBe("value");
    if (actual.kind === "value") {
      // Native Pynter's floats are single-precision, unlike the CSE
      // reference's float64 — compare numerically with tolerance rather
      // than exact text (see isCloseToFloat32's own doc comment).
      if (wanted.stashType === "number") {
        expect(isCloseToFloat32(Number(actual.text), Number(wanted.text))).toBe(true);
      } else {
        expect(actual.text).toBe(wanted.text);
      }
    }
  } else {
    expect(actual.kind).toBe("error");
  }
}

const pynterPath = process.env.PYNTER_RUNNER_PATH;
const describeBlock = pynterPath ? describe : describe.skip;

/**
 * Exact `code` strings known to currently fail against native Pynter — real
 * value bugs, not anything this sweep's own complex-number carve-out (see
 * file header) already explains. See py-slang#259 for the full writeup, and
 * generateNativePynterTestCases'/generatePvmlInBrowserTestCases' identical
 * `knownGaps` parameter (src/tests/utils.ts) for the same exact-match-over-
 * predicate rationale: these are uncategorized, one-off bugs, not a single
 * structural "Pynter can't represent X" rule.
 *
 * Previously included the `//`/`%`/`**` value-typing bugs fixed by
 * source-academy/pynter#16/#17 — empty now that those are merged and
 * pinned (see the CI workflow's pynter `ref`).
 */
const KNOWN_GAPS = new Set<string>([]);

/** `test`, or `test.skip` when `code` is a known gap. */
function testOrSkip(code: string): typeof test {
  return KNOWN_GAPS.has(code) ? test.skip : test;
}

/**
 * `is`/`is not` between two independently-constructed instances of an
 * immutable type with no language-guaranteed identity semantics. Python
 * doesn't specify whether `'ab' is 'ab'` is True or False — a conformant
 * runtime may intern/hash-cons identical string literals to save space, or
 * may just as legitimately allocate a fresh object for each occurrence (as
 * native Pynter's op_lgc_s currently does). Unlike KNOWN_GAPS above (real
 * bugs Pynter should eventually fix), there is no single "correct" answer
 * here to pin against whatever the CSE machine happens to do — but the
 * operation still must succeed and produce an actual bool, never an error
 * (see the dedicated relaxed-assertion test generated for these below).
 */
function isUnspecifiedIdentityCase(op: string, left: PyType, right: PyType): boolean {
  return (op === "is" || op === "is not") && left === right && left === "str";
}

for (const chapter of [3]) {
  describeBlock(`[pvml/pynter] Operator conformance at Python §${chapter}`, () => {
    const ops = chapter <= 2 ? BINARY_OPS_12 : BINARY_OPS_34;
    const universe = pvmlUniverseForChapter(chapter);
    // The *canonical* per-chapter group list (VARIANT_GROUPS), not
    // operator-spec.ts's own groupsForChapter(): that one only adds
    // whatever single extra group a given test needs on top of what the CSE
    // machine's core language operators already provide for free (e.g.
    // `linkedList` for `pair()` at §2). PVML has no such free core-language
    // path — it compiles prelude + script as one unit, so a group's prelude
    // (linked-list.prelude.ts calls `is_none`/`is_pair` from `misc`) needs
    // its own dependencies loaded too, or the whole program fails to
    // compile, not just the one feature the test cares about.
    const groups = VARIANT_GROUPS[chapter];

    for (const op of ops) {
      describe(op, () => {
        for (const left of universe) {
          for (const right of universe) {
            const code = `${literalFor(left, chapter)} ${op} ${literalFor(right, chapter)}`;
            if (isUnspecifiedIdentityCase(op, left, right)) {
              // No pinned expected value (see isUnspecifiedIdentityCase's doc
              // comment) — but the comparison itself is always well-typed and
              // must succeed with an actual bool, whichever way identity
              // happens to land.
              test(code, async () => {
                const actual = await runPvml(code, chapter, groups, pynterPath!);
                expect(actual.kind).toBe("value");
                if (actual.kind === "value") {
                  expect(["True", "False"]).toContain(actual.text);
                }
              });
              continue;
            }
            testOrSkip(code)(code, async () => {
              const wanted = await cseOutcome(code, chapter, groups);
              const actual = await runPvml(code, chapter, groups, pynterPath!);
              expectMatch(wanted, actual);
            });
          }
        }
      });
    }

    describe("unary -", () => {
      for (const operand of universe) {
        const code = `-${literalFor(operand, chapter)}`;
        test(code, async () => {
          const wanted = await cseOutcome(code, chapter, groups);
          const actual = await runPvml(code, chapter, groups, pynterPath!);
          expectMatch(wanted, actual);
        });
      }
    });

    // `and`/`or` result in "any" (one of the operands), and `not` only ever
    // produces bool — the sweeps above already pin the operand-type
    // restrictions for these via CSE parity; only success-vs-error is
    // checked here as elsewhere in the CSE version.
    describe("not", () => {
      for (const operand of universe) {
        const code = `not ${literalFor(operand, chapter)}`;
        test(code, async () => {
          const wanted = await cseOutcome(code, chapter, groups);
          const actual = await runPvml(code, chapter, groups, pynterPath!);
          expect(actual.kind).toBe(wanted.kind);
        });
      }
    });

    for (const op of ["and", "or"]) {
      describe(op, () => {
        for (const left of universe) {
          for (const right of universe) {
            const code = `${literalFor(left, chapter)} ${op} ${literalFor(right, chapter)}`;
            test(code, async () => {
              const wanted = await cseOutcome(code, chapter, groups);
              const actual = await runPvml(code, chapter, groups, pynterPath!);
              expect(actual.kind).toBe(wanted.kind);
            });
          }
        }
      });
    }
  });
}
