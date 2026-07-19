/**
 * py2js-engine parity sweep for operator-conformance.test.ts.
 *
 * Reuses that suite's spec tables/type universe (see operator-spec.ts; the
 * human source of truth is still the docs/specs/python_typing_*.tex
 * fragments) and sweeps the same operator × type × type cross product,
 * through the py2js engine (src/engines/py2js) — compile-to-JavaScript, sync
 * mode. For each combination, the CSE machine's own result is computed fresh
 * and used as the expected value, so this pins py2js against the *actual*
 * reference implementation, not a second hand-written copy of it that could
 * drift. Mirrors operator-conformance-pvml.test.ts's approach.
 *
 * py2js is exec-style only (no "final value" of a script, matching Python
 * semantics), so each combination's code is wrapped in `print(...)` and
 * observed via captured output text — exactly like the PVML-in-browser
 * sweep. The py2js print() formats values with the very same toPythonFloat /
 * PyComplexNumber#toString the CSE machine's toPythonString uses (see
 * engines/py2js/runtime.ts's pyStr), so two engines agreeing on the
 * underlying value is guaranteed to agree on text too — no float-tolerance
 * machinery needed (both sides do plain JS `number` arithmetic).
 *
 * Chapter 1 only for now: the py2js runtime implements the §1 operator
 * typing rules; extend the chapter list as the engine grows into §2+.
 */
import { StmtNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { evaluate } from "../engines/cse/interpreter";
import { Stash, Value } from "../engines/cse/stash";
import { runCodePy2Js, Py2JsRunError } from "../engines/py2js";
import { parse } from "../parser/parser-adapter";
import { Resolver } from "../resolver";
import { VARIANT_GROUPS } from "../runner";
import { Group, toPythonString } from "../stdlib/utils";
import { makeValidatorsForChapter } from "../validator";
import { BINARY_OPS_12, literalFor, universeForChapter } from "./operator-spec";
import { generateMockStreams } from "./utils";

const PY2JS_CHAPTERS = [1];

type Outcome = { kind: "value"; text: string } | { kind: "error" };

/**
 * Evaluates `code` through the CSE machine to get the reference outcome, as
 * Python str() text (see toPythonString) — the same textual convention the
 * py2js side's own result is observed through (print() output), so the two
 * can be compared directly. Same technique as the PVML/wasm sweeps.
 */
async function cseOutcome(code: string, chapter: number, groups: Group[]): Promise<Outcome> {
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
  // The value of the final expression statement is observed as the last
  // value popped off the stash (same jest.spyOn technique as
  // generateTestCases in utils.ts and operator-conformance.test.ts's run()).
  const spy = jest.spyOn(Stash.prototype, "pop");
  let lastPopped: Value | undefined;
  try {
    await evaluate(code, ast, context, { variant: chapter });
    lastPopped = spy.mock.results.at(-1)?.value as Value | undefined;
  } finally {
    spy.mockRestore();
  }
  if (context.errors.length > 0 || lastPopped === undefined) {
    return { kind: "error" };
  }
  return { kind: "value", text: toPythonString(lastPopped) };
}

/**
 * Evaluates `code` through the py2js engine, wrapping it in `print(...)` to
 * observe its value as captured output text — py2js is exec-style, so print
 * is the only way to observe a value (see file header).
 */
function py2jsOutcome(code: string, chapter: number): Outcome {
  try {
    const { output } = runCodePy2Js(`print(${code})`, chapter);
    return { kind: "value", text: output.replace(/\n$/, "") };
  } catch (e) {
    if (e instanceof Py2JsRunError) return { kind: "error" };
    throw e;
  }
}

for (const chapter of PY2JS_CHAPTERS) {
  describe(`[py2js] Operator conformance at Python §${chapter}`, () => {
    const ops = BINARY_OPS_12;
    const universe = universeForChapter(chapter);
    // The canonical per-chapter group list for the CSE reference side (so
    // e.g. `print` itself resolves there); the py2js side uses its own
    // native builtins (see engines/py2js/runtime.ts).
    const groups = VARIANT_GROUPS[chapter];

    for (const op of ops) {
      describe(op, () => {
        for (const left of universe) {
          for (const right of universe) {
            const code = `${literalFor(left, chapter)} ${op} ${literalFor(right, chapter)}`;
            test(code, async () => {
              const wanted = await cseOutcome(code, chapter, groups);
              const actual = py2jsOutcome(code, chapter);
              expect(actual).toStrictEqual(wanted);
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
          const actual = py2jsOutcome(code, chapter);
          expect(actual).toStrictEqual(wanted);
        });
      }
    });

    // `and`/`or` result in "any" (one of the operands), and `not` only ever
    // produces bool — the sweeps above already pin the operand-type
    // restrictions for these via CSE parity; only success-vs-error is
    // checked here, as in the CSE/PVML/native-Pynter versions of this suite.
    describe("not", () => {
      for (const operand of universe) {
        const code = `not ${literalFor(operand, chapter)}`;
        test(code, async () => {
          const wanted = await cseOutcome(code, chapter, groups);
          const actual = py2jsOutcome(code, chapter);
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
              const actual = py2jsOutcome(code, chapter);
              expect(actual.kind).toBe(wanted.kind);
            });
          }
        }
      });
    }
  });
}
