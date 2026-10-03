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
import { PyComplexNumber } from "../types";
import { makeValidatorsForChapter } from "../validator";
import {
  BINARY_OPS_12,
  BINARY_OPS_34,
  literalFor,
  PyType,
  universeForChapter,
} from "./operator-spec";
import { generateMockStreams, isCloseToFloat32 } from "./utils";

type CseOutcome = { kind: "value"; stashType: string; value: unknown } | { kind: "error" };

/**
 * Evaluates `code` through the CSE machine to get the reference outcome.
 * A trimmed copy of operator-conformance.test.ts's own `run()`: that one
 * distinguishes resolve- vs runtime-errors by class name for its own
 * assertions, which this file doesn't need — any error means "the operation
 * is rejected", matching how generateNativePynterTestCases treats CSE error
 * expectations elsewhere.
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
    value: lastPopped && "value" in lastPopped ? lastPopped.value : undefined,
  };
}

/** CSE stash types this sweep can produce a value for (see universeForChapter/literalFor). */
const PVML_SUPPORTED_STASH_TYPES = new Set([
  "bigint",
  "number",
  "bool",
  "string",
  "complex",
  "list",
]);

/**
 * Compares a CSE stash value against the text native Pynter's own print()
 * produced for the same expression (via captureLastExpression — see
 * runCodePvmlDetailed). There's no reliable machine-readable result-type
 * trailer on `main` (see pvml-runner.ts's captureLastExpression doc comment),
 * so the only signal available is the printed text itself, matching the
 * approach generateNativePynterTestCases (utils.ts) also uses.
 */
function pvmlValueMatches(wantType: string, wantValue: unknown, capturedResult: string): boolean {
  if (!PVML_SUPPORTED_STASH_TYPES.has(wantType)) return false;
  switch (wantType) {
    case "bigint":
      return Number(capturedResult) === Number(wantValue);
    case "number":
      return isCloseToFloat32(Number(capturedResult), Number(wantValue));
    case "bool":
      // Pynter's printer emits Python's "True"/"False" (see display.h).
      return (capturedResult === "True") === wantValue;
    case "string":
      return capturedResult === wantValue;
    case "complex": {
      // Native Pynter's complex components are float32 (unlike
      // PyComplexNumber's own double precision) and its printer doesn't
      // attempt CPython's exact scientific-notation formatting, only
      // enough to round-trip through PyComplexNumber.fromString() — compare
      // componentwise with tolerance, not exact text (mirrors the "float"
      // case above). NaN still needs an exact match (never "close to"
      // anything, including itself).
      const want = wantValue as PyComplexNumber;
      if (Number.isNaN(want.real) || Number.isNaN(want.imag)) {
        return capturedResult === want.toString();
      }
      const actual = PyComplexNumber.fromString(capturedResult);
      return isCloseToFloat32(actual.real, want.real) && isCloseToFloat32(actual.imag, want.imag);
    }
    case "list":
      // wantValue is the raw CSE Value[] a list-typed stash entry carries
      // (cseOutcome's own `lastPopped.value`) — reconstruct the full Value
      // and render it through the same toPythonString every other engine's
      // list-typed comparisons use (see generateNativePynterTestCases in
      // utils.ts), matching native Pynter's own printer exactly (confirmed:
      // both print `[1, 2, 1, 2]` for `[1, 2] * 2`, no format differences to
      // account for the way complex/float need tolerance above).
      return capturedResult === toPythonString({ type: "list", value: wantValue as Value[] });
    default:
      return false;
  }
}

type PvmlOutcome = { kind: "value"; capturedResult: string } | { kind: "error" };

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
    return { kind: "value", capturedResult: result.capturedResult ?? "" };
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
      expect(pvmlValueMatches(wanted.stashType, wanted.value, actual.capturedResult)).toBe(true);
    }
  } else {
    expect(actual.kind).toBe("error");
  }
}

/**
 * Asserts `actual` is a genuine boolean result (either "True" or "False"),
 * without pinning which one — used for `is`/`is not` between two strings,
 * where the result *type* is guaranteed (every `is`/`is not` pair returns
 * bool — see MIDDLE_34 in operator-spec.ts), but the specific value isn't:
 * Python's language spec makes no promise about string identity at all
 * (CPython's small-string/literal interning is its own implementation
 * detail), so pinning a specific True/False here — the way expectMatch's
 * exact-value comparison would — would assert behavior the spec doesn't
 * actually require. Mirrors the "and"/"or"/"not" sweeps below, which
 * likewise check success/type without pinning "any"'s specific value.
 */
function expectBooleanResult(wanted: CseOutcome, actual: PvmlOutcome): void {
  expect(wanted.kind).toBe("value");
  expect(actual.kind).toBe("value");
  if (actual.kind === "value") {
    expect(["True", "False"]).toContain(actual.capturedResult);
  }
}

const pynterPath = process.env.PYNTER_RUNNER_PATH;
const describeBlock = pynterPath ? describe : describe.skip;

/**
 * Reasons a native-Pynter operator-conformance case is skipped, mirroring
 * NATIVE_PYNTER_SKIP_REASONS in utils.ts — same rationale, different file
 * since this suite computes its own `code` strings from the operator/type
 * cross product rather than a shared TestCases table. Nothing currently
 * needs this (py-slang#309's list*int gap closed — pvmlValueMatches now
 * decodes list-typed results) — kept as the extension point for whatever
 * genuine skip the next audit finds, rather than removed and re-added.
 */
function nativePynterSkipReason(_op: string, _left: PyType, _right: PyType): string | undefined {
  return undefined;
}

/** `is`/`is not` between two strings: the *type* (bool) is spec-guaranteed and worth checking
 * (see MIDDLE_34), but the specific value isn't — see expectBooleanResult's own doc comment. */
function isUnspecifiedStringIdentity(op: string, left: PyType, right: PyType): boolean {
  return (op === "is" || op === "is not") && left === "str" && right === "str";
}

for (const chapter of [3]) {
  describeBlock(`[pvml/pynter] Operator conformance at Python §${chapter}`, () => {
    const ops = chapter <= 2 ? BINARY_OPS_12 : BINARY_OPS_34;
    const universe = universeForChapter(chapter);
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
            const skipReason = nativePynterSkipReason(op, left, right);
            const t = skipReason ? test.skip : test;
            const checkTypeOnly = isUnspecifiedStringIdentity(op, left, right);
            t(skipReason ? `${code} (${skipReason})` : code, async () => {
              const wanted = await cseOutcome(code, chapter, groups);
              const actual = await runPvml(code, chapter, groups, pynterPath!);
              if (checkTypeOnly) {
                expectBooleanResult(wanted, actual);
              } else {
                expectMatch(wanted, actual);
              }
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
