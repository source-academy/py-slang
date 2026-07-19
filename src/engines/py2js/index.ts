/**
 * py2js engine — entry point.
 *
 * Pipeline: parse (the shared py-slang parser) -> resolve with the chapter's
 * validators (same Resolver the other engines use) -> compile to a JS source
 * string (compiler.ts) -> instantiate via new Function / AsyncFunction ->
 * run against a fresh Py2JsRuntime, collecting print() output.
 *
 * Exec-style only, like the PVML-in-browser pathway: a program has no "final
 * value" — everything observable goes through print(). Currently chapter 1
 * only; the runtime's operator helpers implement the §1 typing rules
 * (docs/specs/python_typing_front.tex, python_typing_middle_12.tex,
 * python_typing_back.tex), pinned against the CSE machine by
 * src/tests/operator-conformance-py2js.test.ts.
 */
import { parse } from "../../parser";
import { Resolver } from "../../resolver";
import { makeValidatorsForChapter } from "../../validator";
import { CompileMode, compileProgram, Py2JsCompileError } from "./compiler";
import { Py2JsRuntime, Py2JsRuntimeError, PyValue } from "./runtime";

export { Py2JsCompileError, Py2JsRuntime, Py2JsRuntimeError };
export type { CompileMode, PyValue };

/** Mirrors runner.ts's RunError contract so callers can distinguish phases. */
export class Py2JsRunError extends Error {
  constructor(
    public readonly kind: "parse" | "analysis" | "runtime",
    message: string,
  ) {
    super(message);
    this.name = "Py2JsRunError";
  }
}

export interface RunPy2JsOptions {
  /**
   * Extra builtin bindings (typically conductor-module functions), merged
   * over the runtime's native set before compilation; pass a factory when
   * the bindings need the runtime itself (to call back into Python via
   * callSync / acall).
   */
  extraBuiltins?: Record<string, PyValue> | ((rt: Py2JsRuntime) => Record<string, PyValue>);
}

export interface RunPy2JsResult {
  /** Everything the program printed via print(), concatenated. */
  output: string;
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
  ...args: string[]
) => (rt: Py2JsRuntime) => Promise<void>;

function prepare(
  code: string,
  variant: number,
  mode: CompileMode,
  options: RunPy2JsOptions,
): { rt: Py2JsRuntime; js: string } {
  if (variant !== 1) {
    throw new Py2JsRunError("parse", `py2js currently supports chapter 1 only (got ${variant})`);
  }

  const rt = new Py2JsRuntime();
  const extra = options.extraBuiltins;
  Object.assign(rt.builtins, typeof extra === "function" ? extra(rt) : (extra ?? {}));

  const script = code.endsWith("\n") ? code : code + "\n";
  let ast;
  try {
    ast = parse(script);
  } catch (e: unknown) {
    throw new Py2JsRunError("parse", String((e as { message?: string })?.message ?? e));
  }

  // Same static pipeline as the other engines: the Resolver checks names and
  // enforces the chapter's feature validators. The runtime's builtin names
  // are passed as prelude names so they resolve without a stdlib group.
  const resolver = new Resolver(
    script,
    ast,
    makeValidatorsForChapter(variant),
    [],
    Object.keys(rt.builtins),
  );
  const errors = resolver.resolve(ast);
  if (errors.length > 0) {
    throw new Py2JsRunError("analysis", errors.map(e => e.message).join("\n"));
  }

  let js;
  try {
    js = compileProgram(ast, Object.keys(rt.builtins), { mode });
  } catch (e: unknown) {
    if (e instanceof Py2JsCompileError) throw new Py2JsRunError("analysis", e.message);
    throw e;
  }
  return { rt, js };
}

/**
 * Evaluate `code` as a SICPy program at the given `variant` in sync mode,
 * returning its print() output. Throws Py2JsRunError on any failure.
 */
export function runCodePy2Js(
  code: string,
  variant: number,
  options: RunPy2JsOptions = {},
): RunPy2JsResult {
  const { rt, js } = prepare(code, variant, "sync", options);
  try {
    new Function("__py", js)(rt);
  } catch (e: unknown) {
    throw new Py2JsRunError("runtime", String((e as { message?: string })?.message ?? e));
  }
  return { output: rt.output.join("") };
}

/**
 * Evaluate `code` in dual mode: the program's spine is async (module calls
 * can await frontend round-trips) while every user function also carries a
 * sync body that TS modules can call back at full speed (rt.callSync).
 */
export async function runCodePy2JsDual(
  code: string,
  variant: number,
  options: RunPy2JsOptions = {},
): Promise<RunPy2JsResult> {
  const { rt, js } = prepare(code, variant, "dual", options);
  try {
    await new AsyncFunction("__py", js)(rt);
  } catch (e: unknown) {
    throw new Py2JsRunError("runtime", String((e as { message?: string })?.message ?? e));
  }
  return { output: rt.output.join("") };
}

/** Compile only (for inspection/debugging of generated code). */
export function compilePy2Js(code: string, variant = 1, mode: CompileMode = "sync"): string {
  const { js } = prepare(code, variant, mode, {});
  return js;
}
