/**
 * Module interop for the Python substitution stepper (`from X import Y`, py-slang#385).
 *
 * The stepper's own `StepNode`-flavoured sibling of `src/engines/cse/modules.ts`'s
 * `moduleToPython`/`pythonToModule` — and, like `src/engines/py2js/moduleInterop.ts`, a second proof
 * that conductor's module protocol doesn't require the CSE machine's own control/stash re-entrant
 * instruction loop to consume: a plain recursive `async`/`await` conversion layer is enough, as long
 * as the engine calling it has an `async` path of its own to await from (see `reduce.ts`'s
 * `contractCall`, which is what this module is called from).
 *
 * Scope, deliberately narrower than the other two engines: a Python-authored callable (a `lambda`/
 * `def`, or a bare reference to a static built-in) is never converted into a module argument — see
 * `isPythonCallable`. Forwarding one would require the module to call back into Python mid-call,
 * which (unlike CSE's `modules.ts`, whose `"closure"` case re-enters its own control/stash loop, or
 * py2js's, which recurses into its own async interpreter entry point) the substitution reducer has no
 * way to do without re-entering its own step machinery — out of scope for this pass. A call shaped
 * that way simply doesn't reduce (irreducible → "Evaluation stuck"), the same honest degrade
 * `builtins.ts` already documents for `input()`/`time_time()`. A `ModuleFunction` value (an *already*
 * module-owned closure — see `ast.ts`) is fine to forward: passing it back never re-enters Python,
 * only the module's own native call machinery.
 *
 * `callModuleFunction` tries `IDataHandler.closure_call_sync` first (a genuinely synchronous escape
 * hatch a module's exported closure may opt into — see `GenericDataHandler.closure_call_sync`'s doc
 * comment) before falling back to draining the mandatory `closure_call_unchecked` async generator.
 * Per that same doc comment essentially no module (including presumably `rune`) opts in today, so
 * this doesn't remove the need for the `async` path, but it costs nothing to prefer it when available.
 */

import { DataType, type IDataHandler, type TypedValue } from "@sourceacademy/conductor/types";
import { ModuleLoaderRunnerPlugin } from "@sourceacademy/runner-module-loader";

import type { StmtNS } from "../../ast-types";
import { RELATIVE_IMPORT_NOT_SUPPORTED_MESSAGE } from "../../errors";
import {
  literal,
  moduleFunction,
  numberLiteral,
  opaqueValue,
  type StepNode,
  stringLiteral,
  substitute,
} from "./ast";
import { isBuiltinFunctionName } from "./builtins";

/** Thrown for a student-actionable import problem (module not found, name not exported, a relative
 * import) — surfaced by `getSteps.ts`'s callers the same way a preprocessing error is, rather than
 * left to manifest later as a confusing "Evaluation stuck" deep into a run. `cause` (when the loader
 * itself rejected, e.g. a module-not-found case) is set as a plain field rather than via `Error`'s
 * two-argument constructor: this project's `lib` target predates `ErrorOptions`/`cause`. */
export class ModuleImportError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.cause = options?.cause;
  }
  readonly cause?: unknown;
}

/** Thrown internally by `stepNodeToModule` for a value shape this interop layer cannot cross the
 * module boundary with. Turned into a graceful "Evaluation stuck" by `contractCall`, exactly like any
 * other runtime fault the reducer raises — never allowed to escape as an unhandled rejection. */
class ModuleInteropUnsupportedError extends Error {}

/** A genuine Python-authored callable — the one value shape `stepNodeToModule` declines to forward
 * into a module call. See the module doc comment. */
function isPythonCallable(node: StepNode): boolean {
  return (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionDeclaration" ||
    (node.type === "Identifier" && isBuiltinFunctionName(String(node.name)))
  );
}

/** Converts a stepper value into a conductor `TypedValue`, for passing into a module call as an
 * argument. Mirrors `pythonToModule` in `src/engines/cse/modules.ts`, restricted per the module doc
 * comment above. Throws `ModuleInteropUnsupportedError` for anything it cannot convert. */
export async function stepNodeToModule(
  evaluator: IDataHandler,
  node: StepNode,
): Promise<TypedValue<DataType>> {
  if (isPythonCallable(node)) {
    throw new ModuleInteropUnsupportedError(
      "a Python function value cannot be passed to an imported module function here",
    );
  }
  switch (node.type) {
    case "Literal": {
      const v = node.value;
      if (v === null) return { type: DataType.EMPTY_LIST, value: null };
      if (typeof v === "boolean") return { type: DataType.BOOLEAN, value: v };
      if (typeof v === "bigint") return { type: DataType.NUMBER, value: Number(v) };
      if (typeof v === "number") return { type: DataType.NUMBER, value: v };
      if (typeof v === "string") return { type: DataType.CONST_STRING, value: v };
      // A complex number: not supported crossing the module boundary, mirroring CSE's/py2js's
      // identical restriction.
      throw new ModuleInteropUnsupportedError("complex values are not supported in module interop");
    }
    case "ArrayExpression": {
      const elements = await Promise.all(
        (node.elements as StepNode[]).map(el => stepNodeToModule(evaluator, el)),
      );
      const array = await evaluator.array_make(DataType.ANY, elements.length, {
        type: DataType.VOID,
        value: undefined,
      });
      for (let i = 0; i < elements.length; i++) {
        await evaluator.array_set(
          array as unknown as TypedValue<DataType.ARRAY, DataType.VOID>,
          i,
          elements[i],
        );
      }
      return array;
    }
    case "Opaque":
      return node.handle as TypedValue<DataType.OPAQUE>;
    case "ModuleFunction":
      return node.closure as TypedValue<DataType.CLOSURE>;
    default:
      throw new ModuleInteropUnsupportedError(
        `a ${node.type} value cannot be passed to an imported module function here`,
      );
  }
}

/** Reads a PAIR or ARRAY's elements uniformly — see the identical helper's doc comment in
 * `src/engines/cse/modules.ts`. */
async function readCompoundElements(
  evaluator: IDataHandler,
  value: TypedValue<DataType.ARRAY> | TypedValue<DataType.PAIR>,
): Promise<TypedValue<DataType>[]> {
  if (value.type === DataType.PAIR) {
    return [await evaluator.pair_head(value), await evaluator.pair_tail(value)];
  }
  const length = await evaluator.array_length(value);
  return Promise.all(Array.from({ length }, (_, i) => evaluator.array_get(value, i)));
}

/** Converts a conductor `TypedValue` into a stepper value — a module export flowing into a Python
 * program, or a module function's return value. Mirrors `moduleToPython` in
 * `src/engines/cse/modules.ts`. `name` labels a `DataType.CLOSURE` result (the display name calls to
 * it render as); defaults to a generic label for one reached indirectly (e.g. a module function
 * returning another as its result). */
export async function moduleToStepNode(
  evaluator: IDataHandler,
  value: TypedValue<DataType>,
  name = "<module function>",
): Promise<StepNode> {
  switch (value.type) {
    case DataType.NUMBER:
      // A module number is always a float — mirrors CSE's/py2js's identical stance (integers stay
      // out of the module interface entirely).
      return numberLiteral(value.value, true);
    case DataType.INTEGER:
      // py-slang never produces DataType.INTEGER itself; only here for switch exhaustiveness over
      // conductor's DataType enum, mirroring the other two engines' identical case.
      return numberLiteral(Number(value.value), true);
    case DataType.BOOLEAN:
      return literal(value.value, value.value ? "True" : "False");
    case DataType.CONST_STRING:
      return stringLiteral(value.value);
    case DataType.VOID:
    case DataType.EMPTY_LIST:
      return literal(null, "None");
    case DataType.OPAQUE: {
      const payload = await evaluator.opaque_get(value);
      const ctorName =
        payload !== null && typeof payload === "object"
          ? (payload as { constructor?: { name?: string } }).constructor?.name
          : undefined;
      return opaqueValue(ctorName ?? "opaque", value);
    }
    case DataType.CLOSURE: {
      const [minArgs, isVararg] = await Promise.all([
        evaluator.closure_arity(value),
        evaluator.closure_is_vararg(value),
      ]);
      return moduleFunction(name, value, minArgs, isVararg);
    }
    case DataType.PAIR:
    case DataType.ARRAY: {
      // Untyped and recursive, uniformly for both — mirrors CSE's/py2js's identical non-distinction
      // between a PAIR and an ARRAY (e.g. sound's Sound is a (wave, duration) dotted pair).
      const elements = await readCompoundElements(evaluator, value);
      const converted = await Promise.all(
        elements.map(el => moduleToStepNode(evaluator, el, name)),
      );
      return { type: "ArrayExpression", elements: converted };
    }
  }
}

/**
 * Calls an imported module function. Tries the synchronous fast path first (see the module doc
 * comment), falling back to draining the mandatory async-generator call. Throws
 * `ModuleInteropUnsupportedError` (caught by `contractCall`, same as any other runtime fault) if an
 * argument can't cross the module boundary — see `stepNodeToModule`.
 */
export async function callModuleFunction(
  evaluator: IDataHandler,
  closure: TypedValue<DataType.CLOSURE>,
  name: string,
  args: StepNode[],
): Promise<StepNode> {
  const moduleArgs = await Promise.all(args.map(a => stepNodeToModule(evaluator, a)));
  const syncCall = (
    evaluator as IDataHandler & {
      closure_call_sync?: (
        c: TypedValue<DataType.CLOSURE>,
        callArgs: TypedValue<DataType>[],
      ) => TypedValue<DataType> | undefined;
    }
  ).closure_call_sync?.bind(evaluator);
  const syncResult = syncCall?.(closure, moduleArgs);
  if (syncResult !== undefined) {
    return moduleToStepNode(evaluator, syncResult, name);
  }
  const gen = evaluator.closure_call_unchecked(closure, moduleArgs);
  let step = await gen.next();
  while (!step.done) step = await gen.next();
  return moduleToStepNode(evaluator, step.value, name);
}

/**
 * Resolves and binds every `FromImport` a program uses, before stepping begins — mirroring
 * `src/engines/cse/modules.ts`'s `loadModules`/`evaluateImports` (module loading happens once, ahead
 * of running/stepping the program itself, matching every other py-slang evaluator's two-phase model).
 * Each imported name is substituted directly into `program` (exactly like `substituteBuiltinConstants`
 * substitutes a built-in constant) rather than looked up by name at call time, so nothing needs
 * threading through the reducer beyond the one `evaluator` parameter `contractCall` needs to actually
 * place a call.
 *
 * `evaluator` is `undefined` when no module loader is wired up (e.g. a bare `getPythonSteps()` call in
 * a test, or `PyStepperEvaluatorBase` in a host that hasn't registered `ModuleLoaderRunnerPlugin`) —
 * every imported name is then simply left unbound, exactly matching this file's absence: a program
 * that never uses the name still reaches "Evaluation complete" (`translate.ts`'s `FromImport` → a
 * no-op statement), one that does gets stuck at the point of use, not here. A relative import, a
 * missing module, or a name a module doesn't export are all *student-actionable* mistakes, though, so
 * once an evaluator genuinely is available those throw `ModuleImportError` rather than degrading —
 * mirrors how CSE (`RelativeImportNotSupportedError`/`ModuleNotFoundError`) and py2js
 * (`loadChunkImports`) both treat the identical cases as hard errors, not silent no-ops.
 */
export async function resolveImports(
  fileInput: StmtNS.FileInput,
  evaluator: IDataHandler | undefined,
  program: StepNode,
): Promise<StepNode> {
  const imports = fileInput.statements.filter(
    (s): s is StmtNS.FromImport => s.kind === "FromImport",
  );
  if (imports.length === 0) return program;

  const offending = imports.find(s => s.level > 0);
  if (offending !== undefined) {
    throw new ModuleImportError(RELATIVE_IMPORT_NOT_SUPPORTED_MESSAGE);
  }

  if (evaluator === undefined || ModuleLoaderRunnerPlugin.instance === null) {
    return program;
  }
  const loader = ModuleLoaderRunnerPlugin.instance;

  const moduleNames = [...new Set(imports.map(s => s.module.lexeme))];
  // `allSettled`, not `all`: every module is requested regardless of whether an earlier one
  // rejects, so a second rejection is observed (and its promise handled) rather than becoming an
  // unhandled rejection racing the first one's `throw` below. `cause` preserves the loader's own
  // rejection reason (a genuine load failure, not just "not found") for diagnosis.
  const settled = await Promise.allSettled(moduleNames.map(name => loader.requestModule(name)));
  const plugins = new Map<string, Awaited<ReturnType<typeof loader.requestModule>>>();
  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    const moduleName = moduleNames[i];
    if (outcome.status === "rejected") {
      throw new ModuleImportError(`Module "${moduleName}" not found.`, { cause: outcome.reason });
    }
    plugins.set(moduleName, outcome.value);
  }

  // Binding runs sequentially in source order (not concurrently) so two imports binding the same
  // name resolve deterministically — last one in source order wins, matching plain reassignment —
  // rather than racing on whichever conversion happens to finish last; mirrors py2js's
  // `loadChunkImports`' identical ordering rationale.
  let result = program;
  for (const stmt of imports) {
    const moduleName = stmt.module.lexeme;
    const exportsByName = new Map(plugins.get(moduleName)!.exports.map(e => [e.symbol, e.value]));
    for (const spec of stmt.names) {
      const exportValue = exportsByName.get(spec.name.lexeme);
      if (exportValue === undefined) {
        throw new ModuleImportError(
          `cannot import name '${spec.name.lexeme}' from '${moduleName}'`,
        );
      }
      const bound = (spec.alias ?? spec.name).lexeme;
      const value = await moduleToStepNode(evaluator, exportValue, spec.name.lexeme);
      result = substitute(result, bound, value);
    }
  }
  return result;
}
