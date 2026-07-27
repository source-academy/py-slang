/**
 * PVML-in-browser parity sweep for operator-conformance.test.ts.
 *
 * Reuses that suite's spec tables/type universe (see operator-spec.ts; the
 * human source of truth is still the four docs/specs/python_typing_*.tex
 * fragments) and sweeps the same operator × type × type cross product,
 * through PVMLInterpreter — the pure-TypeScript "PVML-in-browser" bytecode
 * VM (see pvml-runner.ts's runCodePvmlInterpreterDetailed), not the CSE
 * machine and not native Pynter. For each combination, the CSE machine's own
 * result is computed fresh and used as the expected value — so this pins the
 * in-browser PVML pathway against the *actual* reference implementation, not
 * a second hand-written copy of it that could drift. Mirrors
 * operator-conformance-pynter.test.ts's approach for native Pynter.
 *
 * Unlike native Pynter (§3 only, no runtime notion of "chapter"), the
 * in-browser interpreter supports all four SICPy chapters (matching
 * PyPvmlEvaluator1..4), so — like operator-conformance.test.ts itself — this
 * sweeps chapters 1-4.
 *
 * The in-browser pathway is exec-mode only (see pvml-compiler.ts's
 * visitFileInputStmt doc comment): a script has no "final value" of its own,
 * not even anything resembling native Pynter's resultType/resultValue fault
 * register (that's a native-Pynter-VM-specific concept; PVMLInterpreter has
 * nothing analogous, deliberately). So each combination's code is wrapped in
 * `print(...)` and observed via captured output text, exactly like every
 * other PVML-in-browser test (see utils.ts's wrapLastExpressionInPrint) —
 * compared against the CSE reference value formatted with the very same
 * toPythonString() the PVML print() builtin itself uses (see builtins.ts
 * case 5), so two engines agreeing on the underlying value is guaranteed to
 * agree on text too, with no separate float-tolerance machinery needed (both
 * engines do plain JS `number` arithmetic — unlike native Pynter, there's no
 * second floating-point implementation in the loop to drift from it).
 *
 * No native binary, no PYNTER_RUNNER_PATH gate — runs unconditionally.
 *
 * Unlike native Pynter, the in-browser interpreter *does* support complex
 * numbers (PVMLCompiler.visitComplexExpr only rejects complex literals when
 * `targetsPynter` — native Pynter's own NaN-boxed representation has no
 * complex tag at all; the ordinary in-browser compilation path emits a
 * genuine LGCC constant-pool load), so — unlike
 * operator-conformance-pynter.test.ts — this sweeps the full type
 * universe, `complex` included.
 */
import { StmtNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { evaluate } from "../engines/cse/interpreter";
import { Stash, Value } from "../engines/cse/stash";
import { parse } from "../parser/parser-adapter";
import { runCodePvmlInterpreterDetailed } from "../pvml-runner";
import { Resolver } from "../resolver";
import { RunError, VARIANT_GROUPS } from "../runner";
import { Group, toPythonString } from "../stdlib/utils";
import { makeValidatorsForChapter } from "../validator";
import { BINARY_OPS_12, BINARY_OPS_34, literalFor, universeForChapter } from "./operator-spec";
import { generateMockStreams } from "./utils";

type Outcome = { kind: "value"; text: string } | { kind: "error" };

/**
 * Evaluates `code` through the CSE machine to get the reference outcome, as
 * Python str() text (see toPythonString) — the same textual convention the
 * PVML side's own result is observed through (print() output), so the two
 * can be compared directly.
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
 * Evaluates `code` through PVMLInterpreter (in-browser), wrapping it in
 * `print(...)` to observe its value as captured output text — see file
 * header for why (exec mode has no other way to observe a value).
 */
async function pvmlOutcome(code: string, chapter: number, groups: Group[]): Promise<Outcome> {
  try {
    const { output } = await runCodePvmlInterpreterDetailed(`print(${code})`, chapter, { groups });
    return { kind: "value", text: output.replace(/\n$/, "") };
  } catch (e) {
    if (e instanceof RunError) return { kind: "error" };
    throw e;
  }
}

function expectMatch(wanted: Outcome, actual: Outcome): void {
  expect(actual).toStrictEqual(wanted);
}

for (const chapter of [1, 2, 3, 4]) {
  describe(`[pvml-in-browser] Operator conformance at Python §${chapter}`, () => {
    const ops = chapter <= 2 ? BINARY_OPS_12 : BINARY_OPS_34;
    const universe = universeForChapter(chapter);
    // The *canonical* per-chapter group list (VARIANT_GROUPS), not
    // operator-spec.ts's own groupsForChapter() — see
    // operator-conformance-pynter.test.ts's identical comment: PVML compiles
    // prelude + script as one unit (or, in useGlobalMap/REPL mode, threads a
    // persistent globalEnv chunk to chunk), so a group's prelude needs its
    // own dependencies loaded too, or the whole program fails to compile.
    // Used for both sides so the CSE reference and the PVML actual always
    // see the same names in scope (e.g. `print` itself, from `misc`).
    const groups = VARIANT_GROUPS[chapter];

    for (const op of ops) {
      describe(op, () => {
        for (const left of universe) {
          for (const right of universe) {
            const code = `${literalFor(left, chapter)} ${op} ${literalFor(right, chapter)}`;
            test(code, async () => {
              const wanted = await cseOutcome(code, chapter, groups);
              const actual = await pvmlOutcome(code, chapter, groups);
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
          const actual = await pvmlOutcome(code, chapter, groups);
          expectMatch(wanted, actual);
        });
      }
    });

    // `and`/`or` result in "any" (one of the operands), and `not` only ever
    // produces bool — the sweeps above already pin the operand-type
    // restrictions for these via CSE parity; only success-vs-error is
    // checked here, as in the CSE and native-Pynter versions of this suite.
    describe("not", () => {
      for (const operand of universe) {
        const code = `not ${literalFor(operand, chapter)}`;
        test(code, async () => {
          const wanted = await cseOutcome(code, chapter, groups);
          const actual = await pvmlOutcome(code, chapter, groups);
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
              const actual = await pvmlOutcome(code, chapter, groups);
              expect(actual.kind).toBe(wanted.kind);
            });
          }
        }
      });
    }
  });
}
