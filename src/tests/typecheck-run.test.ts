/**
 * A program that the type checker accepts runs: every correct program of src/tests/typecheck-cases/
 * (the `ok_` files), with its types erased, runs on the CSE machine and on py2js without an error, and
 * prints the same. So the checker does not accept what the engines reject (an error at run time that
 * the types should have prevented), and the Source rules in its builtins follow the engines'.
 *
 * With `CPYTHON_PATH` set to a `python3` (3.12 or later: the programs use `def f[A]`), the programs run
 * unchanged under CPython with `from sicp import *`, with the type names of python/sicp, and print the
 * same: Python §4 Typed programs are Python programs.
 */
import { spawnSync } from "child_process";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { runCodePy2Js } from "../engines/py2js";
import * as parserAdapter from "../parser/parser-adapter";
import { runCode } from "../runner";
import { eraseTypes } from "../typecheck";

const CASES = join(__dirname, "typecheck-cases");
const programs = readdirSync(CASES).filter(file => file.startsWith("ok_") && file.endsWith(".py"));

describe("the correct programs run", () => {
  const realParse = parserAdapter.parse;
  beforeAll(() => {
    // The engines parse the text that they are given: erase the types of what they parse, as the
    // Python §4 Typed evaluator will.
    jest
      .spyOn(parserAdapter, "parse")
      .mockImplementation((source: string) => eraseTypes(realParse(source)));
  });
  afterAll(() => jest.restoreAllMocks());

  test.each(programs)("%s", async file => {
    const source = readFileSync(join(CASES, file), "utf8");
    const cse = await runCode(source, 4);
    const py2js = runCodePy2Js(source, 4).output;
    expect(py2js).toBe(cse);
  });
});

const python = process.env.CPYTHON_PATH;
(python ? describe : describe.skip)("the correct programs run under CPython", () => {
  test.each(programs)("%s", async file => {
    const source = readFileSync(join(CASES, file), "utf8");
    const result = spawnSync(python!, ["-c", `from sicp import *\n${source}`], {
      env: { ...process.env, PYTHONPATH: join(__dirname, "..", "..", "python") },
      encoding: "utf8",
    });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    // The engines, with the types erased as above.
    const realParse = parserAdapter.parse;
    const spy = jest
      .spyOn(parserAdapter, "parse")
      .mockImplementation((text: string) => eraseTypes(realParse(text)));
    try {
      expect(result.stdout).toBe(await runCode(source, 4));
    } finally {
      spy.mockRestore();
    }
  });
});
