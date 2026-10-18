/**
 * Random arithmetic: expressions over ints, booleans and floats with every operator, evaluated by
 * CPython (all in one process) and by the engine. The `repr` of the result, or the name of the
 * exception, must be the same.
 */

import { spawnSync } from "child_process";
import { evaluate } from "../../conductor/full-estepper/run";
import { cpythonAvailable } from "./cpython";

const describeIfCPython = cpythonAvailable ? describe : describe.skip;

/** A small deterministic generator, so that a failure can be reproduced. */
function generator(seed: number) {
  let state = seed;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  return <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)];
}

const INTS = [
  "0",
  "1",
  "2",
  "3",
  "5",
  "7",
  "10",
  "-1",
  "-2",
  "-3",
  "-7",
  "100",
  "255",
  "10**15",
  "2**53",
  "2**60+1",
  "-(2**70)",
  "3**50",
  "True",
  "False",
];
const FLOATS = [
  "0.5",
  "1.5",
  "2.0",
  "0.1",
  "0.3",
  "-0.5",
  "-2.5",
  "1e3",
  "1e-3",
  "3.14",
  "1e16",
  "-0.0",
  "0.0",
  "1e308",
  "5e-324",
  "123456.789",
];
const ATOMS = [...INTS, ...FLOATS];
const OPERATORS = ["+", "-", "*", "/", "//", "%", "<", "<=", "==", "!=", ">", ">="];
const EXPONENTS = [
  "0",
  "1",
  "2",
  "3",
  "-1",
  "-2",
  "0.5",
  "10",
  "50",
  "True",
  "2.0",
  "-3",
  "-5",
  "100",
  "-100",
];

function expressions(count: number, seed: number): string[] {
  const pick = generator(seed);
  const out: string[] = [];
  for (let n = 0; n < count; n++) {
    const kind = pick(["binary", "binary", "nested", "unary", "power", "compare", "logic"]);
    const a = pick(ATOMS);
    const b = pick(ATOMS);
    const c = pick(ATOMS);
    switch (kind) {
      case "binary":
        out.push(`(${a}) ${pick(OPERATORS)} (${b})`);
        break;
      case "nested":
        out.push(`((${a}) ${pick(OPERATORS.slice(0, 7))} (${b})) ${pick(OPERATORS)} (${c})`);
        break;
      case "unary":
        out.push(`${pick(["-", "+", "not ", "~"])}(${a}) ${pick(OPERATORS)} (${b})`);
        break;
      case "power":
        out.push(`(${a}) ** (${pick(EXPONENTS)})`);
        break;
      case "compare":
        out.push(`(${a}) ${pick(["<", "<=", ">", ">=", "==", "!="])} (${b})`);
        break;
      case "logic":
        out.push(`(${a}) ${pick(["and", "or"])} (${b}) ${pick(["and", "or"])} (${c})`);
        break;
    }
  }
  return out;
}

function cpythonValues(exprs: string[]): string[] {
  const script = `
import sys, json
for e in json.load(sys.stdin):
    try:
        print(repr(eval(e)))
    except BaseException as ex:
        print("ERR " + type(ex).__name__)
`;
  const result = spawnSync("python3", ["-I", "-W", "ignore", "-c", script], {
    input: JSON.stringify(exprs),
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  return result.stdout.split("\n").slice(0, exprs.length);
}

function engineValue(expression: string): string {
  const { output, error } = evaluate(`print(repr(${expression}))\n`);
  return error ? `ERR ${error.kind}` : output.replace(/\n$/, "");
}

// FUZZ_SEEDS=10 runs seeds 1 to 10 (to look for more differences); the default is quick.
const SEEDS = Array.from({ length: Number(process.env.FUZZ_SEEDS ?? 3) }, (_, i) => [i + 1]);

describeIfCPython("random arithmetic", () => {
  test.each(SEEDS)("seed %d: the same values and the same errors as CPython", seed => {
    const exprs = expressions(700, seed);
    const expected = cpythonValues(exprs);
    const mismatches: string[] = [];
    exprs.forEach((e, i) => {
      const actual = engineValue(e);
      // A complex result (a negative number to a fractional power) is not supported yet.
      if (actual === "ERR NotImplementedError" && expected[i].includes("j)")) return;
      if (actual !== expected[i])
        mismatches.push(`${e}\n    CPython: ${expected[i]}\n    engine:  ${actual}`);
    });
    expect(mismatches.slice(0, 10)).toEqual([]);
  });
});
