/**
 * py2js experiment — entry point.
 *
 * parse (py-slang's existing parser) -> compile to a JS source string ->
 * `new Function` -> run against a fresh Py2JsRuntime, collecting print output.
 */
import { parse } from "../../src/parser";
import { CompileMode, compileProgram, Py2JsCompileError } from "./compiler";
import { Py2JsRuntime, PyRuntimeError, PyValue } from "./runtime";

export { Py2JsCompileError, PyRuntimeError };

/** Compile SICPy chapter-1 code to JS source (for inspection). */
export function compilePy2Js(code: string, mode: CompileMode = "sync"): string {
  const script = code.endsWith("\n") ? code : code + "\n";
  const ast = parse(script);
  const builtinNames = Object.keys(new Py2JsRuntime().builtins);
  return compileProgram(ast, builtinNames, mode);
}

export interface Py2JsResult {
  output: string;
  /** Milliseconds spent in parse+compile vs. execution. */
  compileMs: number;
  runMs: number;
}

/** Compile and run, returning everything print() wrote. */
export function runPy2Js(code: string, extraBuiltins: ExtraBuiltins = {}): Py2JsResult {
  const t0 = performance.now();
  const rt = new Py2JsRuntime();
  Object.assign(rt.builtins, typeof extraBuiltins === "function" ? extraBuiltins(rt) : extraBuiltins);
  const script = code.endsWith("\n") ? code : code + "\n";
  const js = compileProgram(parse(script), Object.keys(rt.builtins), "sync");
  const runner = new Function("__py", js);
  const t1 = performance.now();
  runner(rt);
  const t2 = performance.now();
  return { output: rt.output.join(""), compileMs: t1 - t0, runMs: t2 - t1 };
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
  ...args: string[]
) => (rt: Py2JsRuntime) => Promise<void>;

/**
 * Dual-mode compile and run: the program's spine is async (module calls can
 * await frontend round-trips) while every user function also carries a sync
 * body that TS modules can call back at full speed (rt.callSync).
 * `extraBuiltins` simulates conductor-module bindings for experiments; pass a
 * factory when the module functions need the runtime (to call back into
 * Python via rt.callSync / rt.acall).
 */
export type ExtraBuiltins =
  | Record<string, PyValue>
  | ((rt: Py2JsRuntime) => Record<string, PyValue>);

export async function runPy2JsDual(
  code: string,
  extraBuiltins: ExtraBuiltins = {},
): Promise<Py2JsResult> {
  const t0 = performance.now();
  const rt = new Py2JsRuntime();
  Object.assign(rt.builtins, typeof extraBuiltins === "function" ? extraBuiltins(rt) : extraBuiltins);
  const script = code.endsWith("\n") ? code : code + "\n";
  const js = compileProgram(parse(script), Object.keys(rt.builtins), "dual");
  const runner = new AsyncFunction("__py", js);
  const t1 = performance.now();
  await runner(rt);
  const t2 = performance.now();
  return { output: rt.output.join(""), compileMs: t1 - t0, runMs: t2 - t1 };
}
