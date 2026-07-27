/**
 * WASM-engine parity sweep for operator-conformance.test.ts.
 *
 * Reuses that suite's spec tables/type universe (see operator-spec.ts; the
 * human source of truth is still the four docs/specs/python_typing_*.tex
 * fragments) and sweeps the same operator × type × type cross product,
 * through compileToWasmAndRun (interactive mode) — the WASM compiler +
 * runtime pathway PyWasmEvaluator1..4 use in the Conductor pathway. For each
 * combination, the CSE machine's own result is computed fresh and used as
 * the expected value — so this pins WASM against the *actual* reference
 * implementation, not a second hand-written copy of it that could drift.
 * Mirrors operator-conformance-pvml.test.ts's approach.
 *
 * Unlike PVML-in-browser's exec-mode-only compiler, compileToWasmAndRun's
 * interactive mode (see engines/wasm/index.ts) evaluates the program's final
 * expression directly and renders it via the runtime's own log_* host
 * imports, without needing a print()-wrapping trick.
 *
 * Comparison is *value*-aware, not raw-text: the runtime's log_float host
 * import renders whole-number floats via plain JS Number#toString (e.g.
 * "2"), not toPythonFloat's Python-style "2.0" -- and log_complex renders
 * "re + imj" instead of toPythonString's "(re+imj)". Both are display-format
 * differences, not value differences, so float/complex results are compared
 * numerically instead of as exact text (ints/bools/strings, which the
 * runtime already renders in Python-compatible form, are still compared as
 * exact text). See the two-run investigation in this file's originating
 * conversation for the concrete "2" vs "2.0" / "1 + 2j" vs "(1+2j)" cases.
 *
 * The WASM engine's group set per chapter mirrors PyWasmEvaluator1..4 (see
 * conductor/PyWasmEvaluator.ts) rather than runner.ts's VARIANT_GROUPS: WASM
 * doesn't yet wire up the `math`/`stream` stdlib groups the CSE/PVML
 * pathways get from VARIANT_GROUPS, so using that table here would ask the
 * WASM compiler to load preludes it doesn't support. `misc` is added
 * automatically by compileToWasmAndRun itself and must not be duplicated
 * here.
 *
 * compileToWasmAndRun's interactive-mode main() call isn't wrapped in
 * try/catch (see engines/wasm/index.ts) -- a runtime trap (e.g. an
 * operand-type error) rejects the returned promise instead of populating
 * `errors`, unlike the non-interactive path. wasmOutcome() below catches
 * that directly, the same way pvmlOutcome() catches RunError.
 */
import { StmtNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { evaluate } from "../engines/cse/interpreter";
import { Stash, Value } from "../engines/cse/stash";
import { compileToWasmAndRun } from "../engines/wasm";
import { parse } from "../parser/parser-adapter";
import { Resolver } from "../resolver";
import linkedList from "../stdlib/linked-list";
import list from "../stdlib/list";
import pairmutator from "../stdlib/pairmutator";
import parserGroup from "../stdlib/parser";
import { Group, toPythonString } from "../stdlib/utils";
import { PyComplexNumber } from "../types/value-types";
import { makeValidatorsForChapter } from "../validator";
import { BINARY_OPS_12, BINARY_OPS_34, literalFor, universeForChapter } from "./operator-spec";
import { generateMockStreams } from "./utils";

/** Mirrors PyWasmEvaluator1..4's own per-chapter group list, not VARIANT_GROUPS (see file header). */
const WASM_GROUPS_BY_CHAPTER: Record<number, Group[]> = {
  1: [],
  2: [linkedList],
  3: [linkedList, pairmutator, list],
  4: [linkedList, pairmutator, list, parserGroup],
};

type CseOutcome =
  | { kind: "value"; type: Value["type"]; text: string; value: unknown }
  | { kind: "error" };

/**
 * Evaluates `code` through the CSE machine to get the reference outcome —
 * a trimmed copy of operator-conformance-pvml.test.ts's own cseOutcome that
 * additionally keeps the popped Value's raw `type`/`value` (not just its
 * formatted text), so expectMatch() below can decide how to compare the
 * WASM side per-type instead of always doing an exact text comparison.
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
  if (context.errors.length > 0 || lastPopped === undefined) {
    return { kind: "error" };
  }
  return {
    kind: "value",
    type: lastPopped.type,
    text: toPythonString(lastPopped),
    value: "value" in lastPopped ? lastPopped.value : undefined,
  };
}

type WasmOutcome = { kind: "value"; text: string } | { kind: "error" };

/**
 * Evaluates `code` through compileToWasmAndRun in interactive mode, whose
 * renderedResult is the last expression's value already rendered by the
 * runtime's own log_* host imports — no print()-wrapping needed, unlike
 * PVML-in-browser's exec-mode-only compiler.
 */
async function wasmOutcome(code: string, chapter: number, groups: Group[]): Promise<WasmOutcome> {
  try {
    const result = await compileToWasmAndRun(code, true, { chapter, groups });
    if (result.errors.length > 0) return { kind: "error" };
    return { kind: "value", text: result.renderedResult };
  } catch {
    return { kind: "error" };
  }
}

/**
 * Parses the runtime's log_complex format ("{imag}j" when the real part is
 * zero, else "{real} {+|-} {|imag|}j" — see hostImports.ts) back into a
 * PyComplexNumber, so a complex result can be compared numerically against
 * the CSE reference instead of as exact text (see file header).
 */
function parseWasmComplex(text: string): PyComplexNumber {
  const pureImag = text.match(/^(-?[\d.]+(?:e[+-]?\d+)?)j$/);
  if (pureImag) return new PyComplexNumber(0, Number(pureImag[1]));

  const signed = text.match(/^(-?[\d.]+(?:e[+-]?\d+)?) ([+-]) ([\d.]+(?:e[+-]?\d+)?)j$/);
  if (!signed) throw new Error(`Cannot parse WASM complex output: ${JSON.stringify(text)}`);
  const real = Number(signed[1]);
  const imag = Number(signed[3]) * (signed[2] === "-" ? -1 : 1);
  return new PyComplexNumber(real, imag);
}

function expectMatch(wanted: CseOutcome, actual: WasmOutcome): void {
  if (wanted.kind === "error") {
    expect(actual.kind).toBe("error");
    return;
  }
  expect(actual.kind).toBe("value");
  if (actual.kind !== "value") return;

  if (wanted.type === "number") {
    // Ignores the runtime's missing toPythonFloat-style ".0" suffix on
    // whole-number floats -- see file header.
    expect(Number(actual.text)).toBe(wanted.value as number);
  } else if (wanted.type === "complex") {
    const expected = wanted.value as PyComplexNumber;
    const parsed = parseWasmComplex(actual.text);
    expect(parsed.real).toBeCloseTo(expected.real);
    expect(parsed.imag).toBeCloseTo(expected.imag);
  } else {
    expect(actual.text).toBe(wanted.text);
  }
}

for (const chapter of [1, 2, 3, 4]) {
  describe(`[wasm] Operator conformance at Python §${chapter}`, () => {
    const ops = chapter <= 2 ? BINARY_OPS_12 : BINARY_OPS_34;
    const universe = universeForChapter(chapter);
    const groups = WASM_GROUPS_BY_CHAPTER[chapter];

    for (const op of ops) {
      describe(op, () => {
        for (const left of universe) {
          for (const right of universe) {
            const code = `${literalFor(left, chapter)} ${op} ${literalFor(right, chapter)}`;
            test(code, async () => {
              const wanted = await cseOutcome(code, chapter, groups);
              const actual = await wasmOutcome(code, chapter, groups);
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
          const actual = await wasmOutcome(code, chapter, groups);
          expectMatch(wanted, actual);
        });
      }
    });

    // `and`/`or` result in "any" (one of the operands), and `not` only ever
    // produces bool -- the sweeps above already pin the operand-type
    // restrictions for these via CSE parity; only success-vs-error is
    // checked here, as in the CSE/PVML/native-Pynter versions of this suite.
    describe("not", () => {
      for (const operand of universe) {
        const code = `not ${literalFor(operand, chapter)}`;
        test(code, async () => {
          const wanted = await cseOutcome(code, chapter, groups);
          const actual = await wasmOutcome(code, chapter, groups);
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
              const actual = await wasmOutcome(code, chapter, groups);
              expect(actual.kind).toBe(wanted.kind);
            });
          }
        }
      });
    }
  });
}
