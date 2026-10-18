/**
 * Python's strings (py-slang#580): `<` compares code points, not UTF-16 code units, and `repr` (as
 * `print` shows the strings of a list) escapes the characters that are not printable. The same
 * answers as CPython's in every engine. CPython's answers are computed in one `python3` run; the
 * tests skip themselves without `python3`.
 */
import { spawnSync } from "child_process";
import { evaluatePython } from "../conductor/stepper/getSteps";
import { runCodePy2Js } from "../engines/py2js";
import { compileToWasmAndRun } from "../engines/wasm";
import { WASM_GROUPS } from "../engines/wasm/groups";
import { parse } from "../parser";
import { runCodePvmlInterpreter } from "../pvml-runner";
import { runCode } from "../runner";
import { compareCodePoints, pythonStringRepr } from "../stdlib/py-strings";

const python = spawnSync("python3", ["--version"]).status === 0;
const describeIfPython = python ? describe : describe.skip;

/** Python source for a string: printable ASCII as it is, `\xNN` and `\uNNNN` for the rest below
 * U+10000 (the engines read those escapes), and the character itself above that. */
function literal(s: string): string {
  let out = '"';
  for (const ch of s) {
    const code = ch.codePointAt(0) as number;
    if (ch === '"' || ch === "\\") out += `\\${ch}`;
    else if (code >= 0x20 && code < 0x7f) out += ch;
    else if (code < 0x100) out += `\\x${code.toString(16).padStart(2, "0")}`;
    else if (code < 0x10000) out += `\\u${code.toString(16).padStart(4, "0")}`;
    else out += ch;
  }
  return out + '"';
}

// The code points where UTF-16 order and code point order differ: a surrogate pair (above U+FFFF)
// against the code points from U+E000 to U+FFFF; lone surrogates (below U+E000); and neighbours.
const COMPARED = [
  "",
  "a",
  "ab",
  "b",
  "\ud800",
  "\udbff",
  "\udc00",
  "\udfff",
  "퟿",
  "",
  "",
  "～",
  "￿",
  "\u{10000}",
  "\u{1f600}",
  "\u{10ffff}",
  "a\u{10000}",
  "a￿",
  "\u{10000}a",
];
const REPRS = [
  "",
  "abc",
  "it's",
  'say "hi"',
  "both ' and \"",
  "back\\slash",
  "tab\there\nnew\rline",
  "\x00",
  "\x1f",
  "\x7f",
  "\x85",
  "\x9f",
  "\xa0",
  "\xad",
  "é",
  "​",
  " ",
  " ",
  "　",
  "",
  "﻿",
  "�",
  "\u{1f600}",
  "\u{e0001}",
  "\u{10ffff}",
];

type Run = (code: string) => Promise<string>;

const ENGINES: [string, Run][] = [
  ["cse", code => runCode(code, 4)],
  ["py2js", code => Promise.resolve(runCodePy2Js(code, 4).output)],
  ["pvml", code => runCodePvmlInterpreter(code, 4)],
  [
    "wasm",
    async code => {
      const { errors, prints } = await compileToWasmAndRun(code, false, {
        chapter: 4,
        groups: WASM_GROUPS[4],
      });
      if (errors.length > 0) throw new Error(errors.map(e => e.message).join("\n"));
      return prints.map(p => p + "\n").join("");
    },
  ],
];

function cpython(expressions: string[]): string[] {
  const script = `
import json, sys
print(json.dumps([str(eval(e)) for e in json.loads(sys.stdin.read())]))
`;
  const result = spawnSync("python3", ["-I", "-c", script], {
    input: JSON.stringify(expressions),
    encoding: "utf8",
    maxBuffer: 1 << 26,
  });
  return JSON.parse(result.stdout) as string[];
}

describe("the helpers", () => {
  test("compareCodePoints orders by code point", () => {
    const codePoints = (s: string): number[] => [...s].map(c => c.codePointAt(0) as number);
    for (const a of COMPARED) {
      for (const b of COMPARED) {
        const x = codePoints(a);
        const y = codePoints(b);
        let want = 0;
        for (let i = 0; i < Math.min(x.length, y.length) && want === 0; i++) {
          want = Math.sign(x[i] - y[i]);
        }
        if (want === 0) want = Math.sign(x.length - y.length);
        expect(compareCodePoints(a, b)).toBe(want);
      }
    }
  });
  test("pythonStringRepr", () => {
    expect(pythonStringRepr("it's")).toBe('"it\'s"');
    expect(pythonStringRepr("\x85")).toBe("'\\x85'");
    expect(pythonStringRepr("\u{10ffff}")).toBe("'\\U0010ffff'");
  });
});

describeIfPython("strings as in CPython", () => {
  const comparisons = COMPARED.flatMap(a =>
    COMPARED.flatMap(b => ["<", "<=", ">", ">="].map(op => `${literal(a)} ${op} ${literal(b)}`)),
  );
  const wantedComparisons = cpython(comparisons);
  const reprs = REPRS.map(s => `[${literal(s)}]`);
  const wantedReprs = cpython(reprs);

  describe.each(ENGINES)("%s", (engine, run) => {
    test("comparison by code point", async () => {
      // (wasm keeps its strings as UTF-8, which has no lone surrogates.)
      const cases = comparisons
        .map((c, i) => ({ expression: c, want: wantedComparisons[i] }))
        .filter(({ expression }) => engine !== "wasm" || !/\\u[dD][89a-fA-F]/.test(expression));
      const output = await run(cases.map(({ expression }) => `print(${expression})\n`).join(""));
      const got = output.trim().split("\n");
      const failures = cases
        .map(({ expression, want }, i) => (got[i] === want ? "" : `${expression}: ${got[i]}`))
        .filter(f => f !== "");
      expect(failures).toEqual([]);
    });
    test.each(REPRS.map((s, i) => [reprs[i], wantedReprs[i]] as const))(
      "repr of %s",
      async (expression, want) => {
        expect((await run(`print(${expression})\n`)).trim()).toBe(want);
      },
    );
  });

  test("the stepper compares by code point", async () => {
    const failures: string[] = [];
    for (let i = 0; i < comparisons.length; i++) {
      const got = await evaluatePython(parse(comparisons[i] + "\n"));
      if (got !== wantedComparisons[i]) failures.push(`${comparisons[i]}: ${got}`);
    }
    expect(failures).toEqual([]);
  });
});
