/**
 * Spec-driven operator conformance tests.
 *
 * The tables below are a faithful transcription of the operator typing tables in
 * the language specifications — the human source of truth:
 *
 *   docs/specs/python_typing_front.tex      (rows common to all chapters)
 *   docs/specs/python_typing_middle_12.tex  (`==`/`!=` rows for Python §1/§2)
 *   docs/specs/python_typing_middle_34.tex  (`==`/`!=`/`is`/`is not` rows for Python §3/§4)
 *   docs/specs/python_typing_back.tex       (rows common to all chapters)
 *
 * When a `.tex` table changes, update the transcription here in the same PR.
 * Do not parse the `.tex` at runtime.
 *
 * For every operator we sweep the full cross product of operand types, per
 * chapter. Combinations the table allows must produce a value of the specified
 * result type (value correctness is covered by the other test suites);
 * everything else must raise UnsupportedOperandTypeError. This checks the
 * negative space — the restrictions — which hand-enumerated positive tests
 * do not.
 *
 * Not covered by the spec table (excluded from the sweep, see #198):
 *   - `//` floor division (implemented, but has no row in the table)
 *   - unary `+` (implemented, but has no row in the table)
 */
import { StmtNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { evaluate } from "../engines/cse/interpreter";
import { Stash, Value } from "../engines/cse/stash";
import { UnsupportedOperandTypeError } from "../errors";
import { parse } from "../parser/parser-adapter";
import { Resolver } from "../resolver";
import linkedList from "../stdlib/linked-list";
import { Group } from "../stdlib/utils";
import { FeatureNotSupportedError, makeValidatorsForChapter } from "../validator";
import {
  BINARY_OPS_12,
  BINARY_OPS_34,
  groupsForChapter,
  literalFor,
  PyType,
  ResultType,
  specResult,
  STASH_TYPE,
  universeForChapter,
} from "./operator-spec";
import { generateMockStreams } from "./utils";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

type Outcome =
  | { kind: "value"; stashType: string; value: unknown }
  | { kind: "runtime-error"; name: string }
  | { kind: "resolve-error"; name: string };

async function run(code: string, chapter: number, groups: Group[] = []): Promise<Outcome> {
  const script = code + "\n";
  let ast: StmtNS.Stmt;
  try {
    ast = parse(script);
    const resolver = new Resolver(script, ast, makeValidatorsForChapter(chapter), groups, []);
    const errors = resolver.resolve(ast);
    if (errors.length > 0) {
      throw errors[0];
    }
  } catch (error) {
    return { kind: "resolve-error", name: (error as Error).constructor.name };
  }
  const context = new Context();
  generateMockStreams(context, []);
  for (const group of groups) {
    for (const [name, value] of group.builtins) {
      context.nativeStorage.builtins.set(name, value);
    }
  }
  // The value of the final expression statement is observed as the last value
  // popped off the stash (same jest.spyOn technique as generateTestCases in utils.ts).
  const spy = jest.spyOn(Stash.prototype, "pop");
  let lastPopped: Value | undefined;
  try {
    await evaluate(code, ast, context, { variant: chapter });
    // Read results before mockRestore(), which also clears them (like mockReset()).
    lastPopped = spy.mock.results.at(-1)?.value as Value | undefined;
  } finally {
    spy.mockRestore();
  }
  if (context.errors.length > 0) {
    return { kind: "runtime-error", name: context.errors[0].constructor.name };
  }
  return {
    kind: "value",
    stashType: lastPopped?.type ?? "none",
    value: lastPopped && "value" in lastPopped ? lastPopped.value : undefined,
  };
}

function describeOutcome(outcome: Outcome): string {
  switch (outcome.kind) {
    case "value":
      return `value of stash type ${outcome.stashType}`;
    default:
      return `${outcome.kind} ${outcome.name}`;
  }
}

/**
 * Sweeps `left op right` over the full type cross product for one operator at
 * one chapter and returns a report line for every combination that does not
 * behave as the spec table requires.
 */
async function sweepBinaryOperator(op: string, chapter: number): Promise<string[]> {
  const universe = universeForChapter(chapter);
  const groups = groupsForChapter(chapter);
  const mismatches: string[] = [];
  for (const left of universe) {
    for (const right of universe) {
      const code = `${literalFor(left, chapter)} ${op} ${literalFor(right, chapter)}`;
      const expected = specResult(op, left, right, chapter);
      const outcome = await run(code, chapter, groups);
      if (expected !== null) {
        if (outcome.kind !== "value" || outcome.stashType !== STASH_TYPE[expected]) {
          mismatches.push(
            `${code} @ chapter ${chapter}: spec says ${expected}, got ${describeOutcome(outcome)}`,
          );
        }
      } else {
        if (outcome.kind !== "runtime-error" || outcome.name !== UnsupportedOperandTypeError.name) {
          mismatches.push(
            `${code} @ chapter ${chapter}: spec says error, got ${describeOutcome(outcome)}`,
          );
        }
      }
    }
  }
  return mismatches;
}

// ---------------------------------------------------------------------------
// The conformance sweeps
// ---------------------------------------------------------------------------

for (const chapter of [1, 2, 3, 4]) {
  describe(`Operator conformance at Python §${chapter}`, () => {
    const ops = chapter <= 2 ? BINARY_OPS_12 : BINARY_OPS_34;

    test.each(ops.map(op => [op] as [string]))("%s", async op => {
      expect(await sweepBinaryOperator(op, chapter)).toStrictEqual([]);
    });

    test("unary -", async () => {
      const universe = universeForChapter(chapter);
      const groups = groupsForChapter(chapter);
      const allowed: Partial<Record<PyType, ResultType>> = {
        int: "int",
        float: "float",
        complex: "complex",
      };
      const mismatches: string[] = [];
      for (const operand of universe) {
        const code = `-${literalFor(operand, chapter)}`;
        const expected = allowed[operand] ?? null;
        const outcome = await run(code, chapter, groups);
        if (expected !== null) {
          if (outcome.kind !== "value" || outcome.stashType !== STASH_TYPE[expected]) {
            mismatches.push(`${code}: spec says ${expected}, got ${describeOutcome(outcome)}`);
          }
        } else if (
          outcome.kind !== "runtime-error" ||
          outcome.name !== UnsupportedOperandTypeError.name
        ) {
          mismatches.push(`${code}: spec says error, got ${describeOutcome(outcome)}`);
        }
      }
      expect(mismatches).toStrictEqual([]);
    });

    test("not", async () => {
      const universe = universeForChapter(chapter);
      const groups = groupsForChapter(chapter);
      const mismatches: string[] = [];
      for (const operand of universe) {
        const code = `not ${literalFor(operand, chapter)}`;
        const outcome = await run(code, chapter, groups);
        if (operand === "bool") {
          if (outcome.kind !== "value" || outcome.stashType !== "bool") {
            mismatches.push(`${code}: spec says bool, got ${describeOutcome(outcome)}`);
          }
        } else if (
          outcome.kind !== "runtime-error" ||
          outcome.name !== UnsupportedOperandTypeError.name
        ) {
          mismatches.push(`${code}: spec says error, got ${describeOutcome(outcome)}`);
        }
      }
      expect(mismatches).toStrictEqual([]);
    });

    // `and` / `or` require a bool left operand; the result is the value of one
    // of the operands ("any"), so only error-vs-success is asserted.
    test.each([["and"], ["or"]])("%s", async op => {
      const universe = universeForChapter(chapter);
      const groups = groupsForChapter(chapter);
      const mismatches: string[] = [];
      for (const left of universe) {
        for (const right of universe) {
          const code = `${literalFor(left, chapter)} ${op} ${literalFor(right, chapter)}`;
          const outcome = await run(code, chapter, groups);
          if (left === "bool") {
            if (outcome.kind !== "value") {
              mismatches.push(`${code}: spec says any, got ${describeOutcome(outcome)}`);
            }
          } else if (
            outcome.kind !== "runtime-error" ||
            outcome.name !== UnsupportedOperandTypeError.name
          ) {
            mismatches.push(`${code}: spec says error, got ${describeOutcome(outcome)}`);
          }
        }
      }
      expect(mismatches).toStrictEqual([]);
    });
  });
}

// ---------------------------------------------------------------------------
// Chapter gating and value-dependent cases
// ---------------------------------------------------------------------------

describe("Operator conformance: directed cases", () => {
  test.each([[1], [2]])(
    "`is` and `is not` are rejected at validation at Python §%d",
    async chapter => {
      for (const code of ["1 is 1", "1 is not 1"]) {
        const outcome = await run(code, chapter);
        expect(outcome).toStrictEqual({
          kind: "resolve-error",
          name: FeatureNotSupportedError.name,
        });
      }
    },
  );

  test("`**` int x int is int for nonnegative exponents and float for negative ones", async () => {
    expect(await run("2 ** 3", 1)).toStrictEqual({ kind: "value", stashType: "bigint", value: 8n });
    expect(await run("2 ** 0", 1)).toStrictEqual({ kind: "value", stashType: "bigint", value: 1n });
    expect(await run("2 ** (-3)", 1)).toStrictEqual({
      kind: "value",
      stashType: "number",
      value: 0.125,
    });
  });

  // As in CPython, where bool is a subclass of int, booleans participate in
  // `==`/`!=` as the ints they are at Python §3/§4. (At §1/§2 booleans are not
  // valid `==` operands at all — the sweep above pins that.)
  test.each([[3], [4]])("bool compares as its int value under == at Python §%d", async chapter => {
    const cases: [string, boolean][] = [
      ["True == 1", true],
      ["True == 1.0", true],
      ["True == (1+0j)", true],
      ["False == 0", true],
      ["True == 2", false],
      ["False == 1", false],
      ["True == True", true],
      ["True == False", false],
      ["True != 1", false],
      ["[True] == [1]", true],
      ["True == 'True'", false],
    ];
    for (const [code, expected] of cases) {
      expect([code, await run(code, chapter)]).toStrictEqual([
        code,
        { kind: "value", stashType: "bool", value: expected },
      ]);
    }
  });

  // As in CPython, booleans participate in ordering comparisons as ints at
  // Python §3/§4 (the sweep pins that they error at §1/§2).
  test.each([[3], [4]])("bool orders as its int value at Python §%d", async chapter => {
    const cases: [string, boolean][] = [
      ["False < True", true],
      ["True < 2", true],
      ["True <= 1", true],
      ["2.5 > True", true],
      ["True > 1", false],
      ["False >= 1", false],
      ["0.5 < True", true],
    ];
    for (const [code, expected] of cases) {
      expect([code, await run(code, chapter)]).toStrictEqual([
        code,
        { kind: "value", stashType: "bool", value: expected },
      ]);
    }
  });

  // `is`/`is not` at Python §3/§4 now take any x any (see MIDDLE_34 above), not
  // just the reference types (list, function, None): numbers, strings and
  // booleans are valid operands too. `xs is xs` (the same list) is True, two
  // separately-built pairs are not identical even with equal contents, and
  // immutable values (which have no real object identity in this interpreter)
  // compare by their underlying value instead — the sweep above pins the
  // stash *type* (always bool); this pins the actual boolean value.
  test.each([[3], [4]])("`is` / `is not` identity semantics at Python §%d", async chapter => {
    const cases: [string, boolean][] = [
      ["None is None", true],
      ["1 is 1", true],
      ["1 is 1.0", false],
      ["1.5 is 1.5", true],
      ["'ab' is 'ab'", true],
      ["True is True", true],
      ["True is 1", false],
      ["x = [1, 2]\ny = x\nx is y", true],
      ["[1, 2] is [1, 2]", false],
      ["(lambda x: x) is (lambda x: x)", false],
      ["f = lambda x: x\ng = f\nf is g", true],
      ["1 is not 2", true],
      ["1 is not 1", false],
    ];
    for (const [code, expected] of cases) {
      expect([code, await run(code, chapter)]).toStrictEqual([
        code,
        { kind: "value", stashType: "bool", value: expected },
      ]);
    }
  });

  // Structural equality on lists at Python §3/§4, as in Python
  test.each([[3], [4]])("lists compare structurally under == at Python §%d", async chapter => {
    const cases: [string, boolean][] = [
      ["[1, 2] == [1, 2]", true],
      ["[1, [2, 3]] == [1, [2, 3]]", true],
      ["[1] == [1.0]", true],
      ["[1] == [2]", false],
      ["[1] == [1, 2]", false],
      ["x = [1, 2]\ny = x\nx == y", true],
      ["[] == []", true],
      ["[1, 2] != [1, 2]", false],
      ["[None] == [None]", true],
    ];
    for (const [code, expected] of cases) {
      expect([code, await run(code, chapter)]).toStrictEqual([
        code,
        { kind: "value", stashType: "bool", value: expected },
      ]);
    }
  });

  // At Python §1/§2, == and != compare structurally over any x any except bool
  // and function (see MIDDLE_12 above): cross-type comparisons, pairs (via
  // `pair`) and None all participate — including at §1, now that §1/§2 share
  // one unified equality rule (`pair` remains reachable at §1 despite list
  // *literals* being syntactically blocked there, since NoListsValidator only
  // rejects `[...]`/subscript syntax, not calling a library function).
  test.each([[1], [2]])(
    "pairs, None and cross-type values compare structurally under == at Python §%d",
    async chapter => {
      const cases: [string, boolean][] = [
        ["pair(1, 2) == pair(1, 2)", true],
        ["pair(1, pair(2, 3)) == pair(1, pair(2, 3))", true],
        ["pair(1, 2) == pair(1.0, 2)", true],
        ["pair(1, 2) == pair(2, 2)", false],
        ["pair(1, 2) != pair(1, 2)", false],
        ["x = pair(1, 2)\ny = x\nx == y", true],
        ["None == None", true],
        ["None != None", false],
        ["pair(1, 2) == None", false],
        ["None == pair(1, 2)", false],
        ["1 == 'ab'", false],
        ["1 != 'ab'", true],
        ["None == 1", false],
        ["1 == 1", true],
        ["'ab' == 'ab'", true],
      ];
      for (const [code, expected] of cases) {
        expect([code, await run(code, chapter, [linkedList])]).toStrictEqual([
          code,
          { kind: "value", stashType: "bool", value: expected },
        ]);
      }
    },
  );

  // bool and function are excluded from §1/§2's ==/!= entirely (the sweep above
  // pins this for the full type cross product); spelled out here for the
  // specific "does True == 1 hold" question the exclusion exists to avoid.
  // "function" covers both closures (lambdas) and library builtins (e.g.
  // `head`) — excludedFromChapter12Equality must reject both.
  test.each([[1], [2]])(
    "bool and function are not valid == / != operands at Python §%d",
    async chapter => {
      for (const code of [
        "True == 1",
        "1 == True",
        "True == True",
        "True == None",
        "None == True",
        "(lambda x: x) == (lambda x: x)",
        "(lambda x: x) == 1",
        "head == head",
        "head == 1",
      ]) {
        expect([code, await run(code, chapter, [linkedList])]).toStrictEqual([
          code,
          { kind: "runtime-error", name: UnsupportedOperandTypeError.name },
        ]);
      }
    },
  );

  // The bool/function exclusion applies wherever `==`/`!=` reaches, including
  // elements found by recursing into pairs — not just the top-level operands.
  test.each([[1], [2]])(
    "bool and function are not valid == / != operands even nested inside pairs at Python §%d",
    async chapter => {
      for (const code of ["pair(1, 2) == pair(True, 3)", "pair(head, 2) == pair(head, 2)"]) {
        expect([code, await run(code, chapter, [linkedList])]).toStrictEqual([
          code,
          { kind: "runtime-error", name: UnsupportedOperandTypeError.name },
        ]);
      }
    },
  );

  // None == None is True at every chapter, as in Python (the §1/§2 case is also
  // covered, alongside cross-type/pair comparisons, by the directed test above)
  test.each([[3], [4]])("None equality at Python §%d", async chapter => {
    const cases: [string, boolean][] = [
      ["None == None", true],
      ["None != None", false],
      ["None == 1", false],
      ["None == []", false],
    ];
    for (const [code, expected] of cases) {
      expect([code, await run(code, chapter)]).toStrictEqual([
        code,
        { kind: "value", stashType: "bool", value: expected },
      ]);
    }
  });

  // NaN is unordered and unequal to everything, including itself, as in CPython.
  // 1.0e400 overflows to inf (as in CPython), so 1.0e400 - 1.0e400 produces NaN
  // without needing any builtin. These semantics hold at every chapter.
  test.each([[1], [2], [3], [4]])("NaN comparisons at Python §%d", async chapter => {
    const nan = "nan = 1.0e400 - 1.0e400\n";
    const cases: [string, boolean][] = [
      [nan + "nan == nan", false],
      [nan + "nan != nan", true],
      [nan + "nan == 1", false],
      [nan + "nan != 1", true],
      [nan + "nan < 1", false],
      [nan + "nan <= 1", false],
      [nan + "nan > 1", false],
      [nan + "nan >= 1", false],
      [nan + "nan < nan", false],
      [nan + "nan >= nan", false],
    ];
    for (const [code, expected] of cases) {
      expect([code, await run(code, chapter)]).toStrictEqual([
        code,
        { kind: "value", stashType: "bool", value: expected },
      ]);
    }
  });
});
