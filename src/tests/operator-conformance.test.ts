/**
 * Spec-driven operator conformance tests.
 *
 * The tables below are a faithful transcription of the operator typing tables in
 * the language specifications — the human source of truth:
 *
 *   docs/specs/python_typing_front.tex      (rows common to all chapters)
 *   docs/specs/python_typing_middle_1.tex   (`==`/`!=` rows for Python §1)
 *   docs/specs/python_typing_middle_2.tex   (`==`/`!=` rows for Python §2)
 *   docs/specs/python_typing_middle_34.tex  (`==`/`!=`/`is` rows for Python §3/§4)
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
import { generateMockStreams } from "./utils";

// ---------------------------------------------------------------------------
// Type universe and representative operand literals
// ---------------------------------------------------------------------------

type PyType = "int" | "float" | "complex" | "bool" | "str" | "NoneType" | "list" | "function";

/**
 * List literals are rejected by the chapter 1/2 validators (NoListsValidator), so at
 * Python §2 a "list" (pair) value is instead constructed via the linked-list library's
 * `pair` builtin — the only way §2 code can produce one.
 */
const LITERAL: Record<PyType, string> = {
  int: "2",
  float: "2.5",
  complex: "(1+2j)",
  bool: "True",
  str: "'ab'",
  NoneType: "None",
  list: "[1, 2]",
  function: "(lambda x: x)",
};

function literalFor(type: PyType, chapter: number): string {
  return type === "list" && chapter === 2 ? "pair(1, 2)" : LITERAL[type];
}

/** Stash representation of each spec result type. */
const STASH_TYPE: Record<string, string> = {
  int: "bigint",
  float: "number",
  complex: "complex",
  bool: "bool",
  str: "string",
};

/** List literals are rejected by the chapter 1 validators, so the §1 universe excludes them. */
const UNIVERSE_1: PyType[] = ["int", "float", "complex", "bool", "str", "NoneType", "function"];
/** At §2 "list" is available as a pair, constructed via the linked-list library's `pair`. */
const UNIVERSE_WITH_LIST: PyType[] = [...UNIVERSE_1, "list"];

function universeForChapter(chapter: number): PyType[] {
  return chapter === 1 ? UNIVERSE_1 : UNIVERSE_WITH_LIST;
}

/** The linked-list library group, needed at §2 to resolve/evaluate the `pair` builtin. */
function groupsForChapter(chapter: number): Group[] {
  return chapter === 2 ? [linkedList] : [];
}

// ---------------------------------------------------------------------------
// The spec tables
// ---------------------------------------------------------------------------

type ResultType = "int" | "float" | "complex" | "bool" | "str";

interface Row {
  ops: string[];
  left: PyType[];
  right: PyType[];
  result: ResultType;
}

const NUMERIC: PyType[] = ["int", "float", "complex"];
const ANY_34 = UNIVERSE_WITH_LIST;
/** §2's `==`/`!=` universe: everything except bool and function (see MIDDLE_2 below). */
const CHAPTER_2_EQUALITY_TYPES: PyType[] = UNIVERSE_WITH_LIST.filter(
  type => type !== "bool" && type !== "function",
);

// docs/specs/python_typing_front.tex — common to all chapters
const FRONT: Row[] = [
  { ops: ["+", "-", "*", "%"], left: ["int"], right: ["int"], result: "int" },
  { ops: ["/"], left: ["int"], right: ["int"], result: "float" },
  { ops: ["+", "-", "*", "/", "%"], left: ["int"], right: ["float"], result: "float" },
  { ops: ["+", "-", "*", "/", "%"], left: ["float"], right: ["int", "float"], result: "float" },
  { ops: ["+", "-", "*", "/"], left: ["int"], right: ["complex"], result: "complex" },
  { ops: ["+", "-", "*", "/"], left: ["float"], right: ["complex"], result: "complex" },
  { ops: ["+", "-", "*", "/"], left: ["complex"], right: NUMERIC, result: "complex" },
  { ops: ["+"], left: ["str"], right: ["str"], result: "str" },
  // `**` int x int is value-dependent (int for exponent >= 0, float for < 0);
  // the sweep's representative exponent is nonnegative, and the signed cases
  // are covered by directed tests below.
  { ops: ["**"], left: ["int"], right: ["int"], result: "int" },
  { ops: ["**"], left: ["int"], right: ["float"], result: "float" },
  { ops: ["**"], left: ["int"], right: ["complex"], result: "complex" },
  { ops: ["**"], left: ["float"], right: ["int", "float"], result: "float" },
  { ops: ["**"], left: ["float"], right: ["complex"], result: "complex" },
  { ops: ["**"], left: ["complex"], right: NUMERIC, result: "complex" },
];

// docs/specs/python_typing_back.tex — common to all chapters
// (`and`, `or`, `not` and unary `-` are handled separately below)
const BACK: Row[] = [
  { ops: [">", ">=", "<", "<="], left: ["str"], right: ["str"], result: "bool" },
];

// docs/specs/python_typing_middle_1.tex — Python §1 only
const MIDDLE_1: Row[] = [
  { ops: ["==", "!="], left: NUMERIC, right: NUMERIC, result: "bool" },
  { ops: ["==", "!="], left: ["str"], right: ["str"], result: "bool" },
  { ops: [">", ">=", "<", "<="], left: ["int", "float"], right: ["int", "float"], result: "bool" },
];

// docs/specs/python_typing_middle_2.tex — Python §2 only.
// `==`/`!=` compare structurally over any x any *except* bool and function,
// which are excluded entirely (`bool x any -> error`, `any x bool -> error`,
// `function x any -> error`, `any x function -> error`): a §2 comparison never
// has to answer whether `True == 1` holds, or what function equality means
// before `is` is introduced at §3/§4. Every other combination — including
// cross-type and pair/None comparisons — is `bool`.
// Ordering comparisons are unaffected: still int,float x int,float only.
const MIDDLE_2: Row[] = [
  {
    ops: ["==", "!="],
    left: CHAPTER_2_EQUALITY_TYPES,
    right: CHAPTER_2_EQUALITY_TYPES,
    result: "bool",
  },
  { ops: [">", ">=", "<", "<="], left: ["int", "float"], right: ["int", "float"], result: "bool" },
];

// docs/specs/python_typing_middle_34.tex — Python §3/§4 only.
// `==`/`!=` take any x any; `is` is restricted to the reference types
// (list, function, None) and errors whenever either operand is a number,
// string or boolean (identity of immutable values is unobservable).
// The error rows of the table are the sweep's default expectation.
// Ordering comparisons admit booleans (as in CPython, bool being an int).
const REFERENCE_TYPES: PyType[] = ["NoneType", "list", "function"];
const MIDDLE_34: Row[] = [
  { ops: ["==", "!="], left: ANY_34, right: ANY_34, result: "bool" },
  { ops: ["is", "is not"], left: REFERENCE_TYPES, right: REFERENCE_TYPES, result: "bool" },
  {
    ops: [">", ">=", "<", "<="],
    left: ["int", "float", "bool"],
    right: ["int", "float", "bool"],
    result: "bool",
  },
];

const TABLE_1: Row[] = [...FRONT, ...MIDDLE_1, ...BACK];
const TABLE_2: Row[] = [...FRONT, ...MIDDLE_2, ...BACK];
const TABLE_34: Row[] = [...FRONT, ...MIDDLE_34, ...BACK];

function tableForChapter(chapter: number): Row[] {
  if (chapter === 1) return TABLE_1;
  if (chapter === 2) return TABLE_2;
  return TABLE_34;
}

const BINARY_OPS_12 = ["+", "-", "*", "/", "%", "**", ">", ">=", "<", "<=", "==", "!="];
const BINARY_OPS_34 = [...BINARY_OPS_12, "is", "is not"];

/** The spec result type for `left op right` at the given chapter, or null if forbidden. */
function specResult(op: string, left: PyType, right: PyType, chapter: number): ResultType | null {
  for (const row of tableForChapter(chapter)) {
    if (row.ops.includes(op) && row.left.includes(left) && row.right.includes(right)) {
      return row.result;
    }
  }
  return null;
}

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

  // At Python §2, == and != compare structurally over any x any except bool
  // and function (see MIDDLE_2 above): cross-type comparisons, pairs (via
  // `pair`) and None all participate. (At §1, == on None or a cross-type pair
  // is an UnsupportedOperandTypeError — the sweep above pins that.)
  test("pairs, None and cross-type values compare structurally under == at Python §2", async () => {
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
      expect([code, await run(code, 2, [linkedList])]).toStrictEqual([
        code,
        { kind: "value", stashType: "bool", value: expected },
      ]);
    }
  });

  // bool and function are excluded from §2's ==/!= entirely (the sweep above
  // pins this for the full type cross product); spelled out here for the
  // specific "does True == 1 hold" question the exclusion exists to avoid.
  // "function" covers both closures (lambdas) and library builtins (e.g.
  // `head`) — excludedFromChapter2Equality must reject both.
  test("bool and function are not valid == / != operands at Python §2", async () => {
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
      expect([code, await run(code, 2, [linkedList])]).toStrictEqual([
        code,
        { kind: "runtime-error", name: UnsupportedOperandTypeError.name },
      ]);
    }
  });

  // The bool/function exclusion applies wherever `==`/`!=` reaches, including
  // elements found by recursing into pairs — not just the top-level operands.
  test("bool and function are not valid == / != operands even nested inside pairs at Python §2", async () => {
    for (const code of ["pair(1, 2) == pair(True, 3)", "pair(head, 2) == pair(head, 2)"]) {
      expect([code, await run(code, 2, [linkedList])]).toStrictEqual([
        code,
        { kind: "runtime-error", name: UnsupportedOperandTypeError.name },
      ]);
    }
  });

  // None == None is True at Python §3/§4, as in Python
  // (at §1, == on None is an UnsupportedOperandTypeError — the sweep pins that)
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
