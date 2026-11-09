/**
 * The prelude (src/typecheck/prelude.pyi) declares the names of Python §4 that Python itself does not
 * have: every name that Python §4 provides is known to the checker, and the prelude declares no name
 * that Python §4 lacks.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { VARIANT_GROUPS } from "../runner";
import { TypedPythonChecker } from "../typecheck";
import { CHECKER_SETUP_TIMEOUT_MS, startTypedChecker } from "./typecheck-harness";

// The checker runs in a worker thread: when many test files compete for the processor, a check takes
// much longer than the 5 seconds that a test has by default.
jest.setTimeout(60_000);

/** The names of Python §4: what its groups define as builtins, and the functions of their preludes. */
function pythonFourNames(): Set<string> {
  const names = new Set<string>();
  for (const group of VARIANT_GROUPS[4]) {
    for (const name of group.builtins.keys()) names.add(name);
    for (const match of (group.prelude ?? "").matchAll(/^def ([A-Za-z0-9_]+)/gm))
      names.add(match[1]);
  }
  // `_length` and the like are helpers of the preludes, not names for programs.
  return new Set([...names].filter(name => !name.startsWith("_")));
}

/** The types that the prelude declares (they are not values of Python §4). */
const TYPES = new Set(["Pair", "LList", "Stream"]);

/** The names that the prelude declares: functions and variables, and the types. */
function preludeNames(): Set<string> {
  const text = readFileSync(join(__dirname, "../typecheck/prelude.pyi"), "utf8");
  const names = new Set<string>();
  for (const match of text.matchAll(/^(?:def|class|type) ([A-Za-z0-9_]+)|^([A-Za-z0-9_]+): /gm)) {
    const name = match[1] ?? match[2];
    if (!name.startsWith("_")) names.add(name);
  }
  return names;
}

/**
 * Their types are not fixed yet (#631): the specification leaves `tokenize`, `parse` and
 * `apply_in_underlying_python` open, so a program that uses them is not accepted for now.
 */
const PENDING = new Set(["parse", "tokenize", "apply_in_underlying_python"]);

describe("the prelude", () => {
  let checker: TypedPythonChecker;
  beforeAll(async () => {
    checker = await startTypedChecker();
  }, CHECKER_SETUP_TIMEOUT_MS);
  afterAll(() => checker.dispose());

  test("every name of Python §4 is known to the checker", async () => {
    const names = [...pythonFourNames()].filter(name => !PENDING.has(name)).sort();
    expect(names.length).toBeGreaterThan(100);
    const diagnostics = await checker.check(names.map(name => `_ = ${name}`).join("\n") + "\n");
    const unknown = diagnostics.filter(d => d.severity === "error").map(d => d.original);
    expect(unknown).toEqual([]);
  });

  test("the names that are pending are not known yet", async () => {
    const diagnostics = await checker.check(
      [...PENDING].map(name => `_ = ${name}`).join("\n") + "\n",
    );
    expect(diagnostics.filter(d => d.severity === "error")).toHaveLength(PENDING.size);
  });

  test("the prelude declares only names of Python §4", () => {
    const provided = pythonFourNames();
    const extra = [...preludeNames()].filter(name => !provided.has(name) && !TYPES.has(name));
    expect(extra.sort()).toEqual([]);
  });
});
