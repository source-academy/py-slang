/**
 * Shared operator-typing spec tables, extracted from operator-conformance.test.ts
 * so both it and operator-conformance-pynter.test.ts can import them without
 * one `.test.ts` file importing another — Jest registers a test file's
 * top-level describe()/test() calls purely by loading the module, so
 * importing one test file from another double-registers its tests into
 * whatever suite imports it.
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
 */
import linkedList from "../stdlib/linked-list";
import { Group } from "../stdlib/utils";

// ---------------------------------------------------------------------------
// Type universe and representative operand literals
// ---------------------------------------------------------------------------

export type PyType =
  | "int"
  | "float"
  | "complex"
  | "bool"
  | "str"
  | "NoneType"
  | "list"
  | "function";

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

export function literalFor(type: PyType, chapter: number): string {
  return type === "list" && chapter === 2 ? "pair(1, 2)" : LITERAL[type];
}

/** Stash representation of each spec result type. */
export const STASH_TYPE: Record<string, string> = {
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

export function universeForChapter(chapter: number): PyType[] {
  return chapter === 1 ? UNIVERSE_1 : UNIVERSE_WITH_LIST;
}

/** The linked-list library group, needed at §2 to resolve/evaluate the `pair` builtin. */
export function groupsForChapter(chapter: number): Group[] {
  return chapter === 2 ? [linkedList] : [];
}

// ---------------------------------------------------------------------------
// The spec tables
// ---------------------------------------------------------------------------

export type ResultType = "int" | "float" | "complex" | "bool" | "str";

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

export const BINARY_OPS_12 = ["+", "-", "*", "/", "%", "**", ">", ">=", "<", "<=", "==", "!="];
export const BINARY_OPS_34 = [...BINARY_OPS_12, "is", "is not"];

/** The spec result type for `left op right` at the given chapter, or null if forbidden. */
export function specResult(
  op: string,
  left: PyType,
  right: PyType,
  chapter: number,
): ResultType | null {
  for (const row of tableForChapter(chapter)) {
    if (row.ops.includes(op) && row.left.includes(left) && row.right.includes(right)) {
      return row.result;
    }
  }
  return null;
}
