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
 * A genuine Python-authored callable (a `lambda`/`def`, or a bare reference to a static built-in —
 * see `isPythonCallable`) *can* be forwarded into a module call (py-slang#423, e.g. `rune`'s
 * `connect_ends` sampling a Python-authored curve function): `pythonCallableToModule` wraps it in a
 * module closure whose body re-enters the substitution reducer for real, via `applyPythonCallable` —
 * a callback threaded in from `reduce.ts`'s `contractCall` (not imported directly, to avoid a
 * circular `reduce.ts` ⇄ `moduleInterop.ts` dependency) that fully reduces `fn(...args)` to a value
 * using the exact same `reduceExpr` loop the outer step sequence itself runs on, just scoped to one
 * call expression and producing no visible steps of its own. This is a much lighter mechanism than
 * CSE's `modules.ts` (whose `"closure"` case re-enters its own control/stash loop) or py2js's (which
 * recurses into its own async interpreter entry point) need, precisely because the substitution
 * model's "apply and get the result" already *is* just more reduction — there is no separate
 * environment/continuation to re-enter. A `ModuleFunction` value (an *already* module-owned closure —
 * see `ast.ts`) is forwarded even more simply: passing it back never re-enters Python at all, only the
 * module's own native call machinery.
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
  moduleGeneratedFunction,
  numberLiteral,
  opaqueValue,
  type StepNode,
  stringLiteral,
} from "./ast";
import { applyBuiltin, isBuiltinFunctionName } from "./builtins";

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

/**
 * The global-registry key a module may attach a zero-argument stepper-thumbnail render hook under,
 * on the object it passes to `opaque_make` (e.g. `rune`'s `attachThumbnailHook`) — see
 * source-academy/modules's `docs/src/modules/5-advanced/conductor-interop/6-opaque-thumbnails.md`.
 * Hardcoded here, rather than imported from that convention's defining package
 * (`@sourceacademy/modules-lib`), because that package is private to the modules repo's own
 * workspace and never published — per the convention, only this string (not the export) is the
 * actual cross-repo contract: `Symbol.for` returns the identical symbol for any two packages that
 * call it with the same string, so a module and this stepper agree on the key without sharing an
 * import.
 */
const RENDER_THUMBNAIL_SYMBOL = Symbol.for("source-academy.stepper.renderThumbnail");

/**
 * Calls an opaque payload's stepper-thumbnail hook, if it carries one — see
 * `RENDER_THUMBNAIL_SYMBOL`. Resolves to `undefined` (never rejects) whenever a thumbnail isn't
 * available: no hook attached, the hook itself resolves to `undefined` (rendering wasn't possible in
 * the module's realm), or — defensively, since the hook is a convention rather than a typed
 * interface — it throws or resolves to a non-string. A broken/misbehaving thumbnail must never
 * surface as a stepper fault, only as the existing `<label>` fallback.
 */
async function renderThumbnail(payload: unknown): Promise<string | undefined> {
  if (payload === null || typeof payload !== "object") return undefined;
  try {
    // The property read itself, not just the call, is inside the try: a throwing getter or Proxy
    // trap on this key is just as much "a broken thumbnail" as a throwing hook function.
    const hook = (payload as Record<symbol, unknown>)[RENDER_THUMBNAIL_SYMBOL];
    if (typeof hook !== "function") return undefined;
    const result = await (hook as () => unknown)();
    return typeof result === "string" ? result : undefined;
  } catch {
    return undefined;
  }
}

/** A genuine Python-authored callable — a `lambda`/`def`, or a bare reference to a static built-in —
 * the one value shape `stepNodeToModule` needs `applyPythonCallable` to forward into a module call.
 * See the module doc comment. */
function isPythonCallable(node: StepNode): boolean {
  return (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionDeclaration" ||
    (node.type === "Identifier" && isBuiltinFunctionName(String(node.name)))
  );
}

/** Fully reduces `fn(...args)` to a value — `reduce.ts`'s own `applyPythonCallable`, bound to the
 * current `StepperContext`, threaded in as a plain callback rather than imported directly so this
 * module never needs to import from `reduce.ts` (which already imports from here). See the module
 * doc comment. */
export type ApplyPythonCallable = (fn: StepNode, args: StepNode[]) => Promise<StepNode>;

/**
 * Wraps a genuine Python-authored callable (`node`, satisfying {@link isPythonCallable}) as a module
 * closure, so a module can call it back for real (py-slang#423). Arity is read the same way `arity()`
 * itself reports it (`applyBuiltin("arity", ...)`, which already handles a `def`/`lambda`'s exact
 * parameter count and a builtin's own `minArgs` uniformly).
 *
 * A bare builtin reference (`print`, `min`, `max`, `round`, ...) is often genuinely variadic — `arity`
 * above is only its *minimum* argument count — so it's reported to `closure_make` as vararg via a
 * fourth argument `IDataHandler`'s own public contract doesn't declare (every concrete implementation
 * in this codebase, `GenericDataHandler`, accepts it anyway — the same escape hatch
 * `callModuleFunction`'s `closure_call_sync` cast below uses for an equally undeclared method), so a
 * module calling the wrapped builtin through the *checked* `closure_call` (which enforces `isVararg`
 * before invoking, unlike `closure_call_unchecked`) still accepts extra arguments instead of raising a
 * spurious `InvalidArityError`. A `def`/`lambda`'s own parameter count is always exact regardless of
 * this, since the stepper's own chapters 1-2 forbid `*args` in the first place
 * (`NoRestParamsValidator`) — `isVararg: false` there is simply correct, not a limitation.
 */
async function pythonCallableToModule(
  evaluator: IDataHandler,
  node: StepNode,
  applyPythonCallable: ApplyPythonCallable,
): Promise<TypedValue<DataType.CLOSURE>> {
  const arity = Number(applyBuiltin("arity", [node]).value as bigint);
  async function* pyCallbackFunc(
    ...args: TypedValue<DataType>[]
  ): AsyncGenerator<void, TypedValue<DataType>, undefined> {
    const argNodes = await Promise.all(args.map(a => moduleToStepNode(evaluator, a)));
    const result = await applyPythonCallable(node, argNodes);
    return stepNodeToModule(evaluator, result, applyPythonCallable);
  }
  const isVararg = node.type === "Identifier";
  return (
    evaluator as IDataHandler & {
      closure_make: (
        sig: { returnType: DataType; args: DataType[] },
        func: typeof pyCallbackFunc,
        dependsOn: undefined,
        isVararg: boolean,
      ) => Promise<TypedValue<DataType.CLOSURE>>;
    }
  ).closure_make(
    { returnType: DataType.ANY, args: Array(arity).fill(DataType.ANY) },
    pyCallbackFunc,
    undefined,
    isVararg,
  );
}

/** Converts a stepper value into a conductor `TypedValue`, for passing into a module call as an
 * argument. Mirrors `pythonToModule` in `src/engines/cse/modules.ts`. Throws
 * `ModuleInteropUnsupportedError` for anything it cannot convert. */
export async function stepNodeToModule(
  evaluator: IDataHandler,
  node: StepNode,
  applyPythonCallable: ApplyPythonCallable,
): Promise<TypedValue<DataType>> {
  if (isPythonCallable(node)) {
    return pythonCallableToModule(evaluator, node, applyPythonCallable);
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
        (node.elements as StepNode[]).map(el =>
          stepNodeToModule(evaluator, el, applyPythonCallable),
        ),
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
 * returning another as its result). `fromCall` distinguishes a value bound directly by a
 * `from X import Y` statement (`false`, the default — see `resolveImports` below) from one produced
 * by actually *calling* a module function (`true` — see `callModuleFunction` below): only in the
 * latter case does a nested `DataType.CLOSURE` get {@link moduleGeneratedFunction}'s
 * `_from_`-prefixed name and distinct hover text rather than {@link moduleFunction}'s plain one
 * (py-slang#407). Threaded through the `DataType.PAIR`/`DataType.ARRAY` recursion below so a closure
 * nested inside a call's result (e.g. `make_sound`'s `(wave, duration)` pair) is marked
 * module-generated too, not just one returned bare. */
export async function moduleToStepNode(
  evaluator: IDataHandler,
  value: TypedValue<DataType>,
  name = "<module function>",
  fromCall = false,
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
      const dataUrl = await renderThumbnail(payload);
      return opaqueValue(ctorName ?? "opaque", value, dataUrl);
    }
    case DataType.CLOSURE: {
      const [minArgs, isVararg] = await Promise.all([
        evaluator.closure_arity(value),
        evaluator.closure_is_vararg(value),
      ]);
      return fromCall
        ? moduleGeneratedFunction(name, value, minArgs, isVararg)
        : moduleFunction(name, value, minArgs, isVararg);
    }
    case DataType.PAIR:
    case DataType.ARRAY: {
      // Untyped and recursive, uniformly for both — mirrors CSE's/py2js's identical non-distinction
      // between a PAIR and an ARRAY (e.g. sound's Sound is a (wave, duration) dotted pair).
      const elements = await readCompoundElements(evaluator, value);
      const converted = await Promise.all(
        elements.map(el => moduleToStepNode(evaluator, el, name, fromCall)),
      );
      return { type: "ArrayExpression", elements: converted };
    }
  }
}

/**
 * Collects every {@link moduleGeneratedFunction} node in `node`'s subtree, left to right — the only
 * `ModuleFunction`-typed nodes a call result's own tree can contain, since a call result is built
 * with `fromCall: true` throughout (see `moduleToStepNode`) and the only other node type its
 * `ArrayExpression` wrapping recurses through is itself. Used by `disambiguateGeneratedFunctions`
 * below.
 */
function collectGeneratedFunctions(node: StepNode, out: StepNode[]): void {
  if (node.type === "ModuleFunction") {
    out.push(node);
  } else if (node.type === "ArrayExpression") {
    for (const el of node.elements as StepNode[]) collectGeneratedFunctions(el, out);
  }
}

/**
 * A single module call can return more than one closure at once (e.g. `rune`'s `make_sound` handing
 * back a `(wave, duration)` pair where `wave` is itself callable) — `moduleToStepNode` names every one
 * of them identically (`_from_${name}`, since none of them individually knows about its siblings).
 * Distinguishes same-call siblings by appending a `_1`, `_2`, ... suffix (in left-to-right tree order)
 * once more than one is found; a lone generated function is left exactly as `moduleToStepNode` named
 * it. Mutates the fresh nodes in place (safe: `result`'s tree is newly built by this same call, not
 * shared with anything else yet) and returns `result` for chaining. The hover text — read separately
 * off `hoverText`, not `name` — already names the generator itself (see `ast.ts`'s
 * `moduleGeneratedFunction`), so it stays identical and unsuffixed across every sibling (py-slang#407):
 * the `name` suffix exists only to tell the *values* apart on screen, not to claim they came from
 * differently-named generators.
 */
function disambiguateGeneratedFunctions(result: StepNode): StepNode {
  const generated: StepNode[] = [];
  collectGeneratedFunctions(result, generated);
  if (generated.length > 1) {
    generated.forEach((node, i) => {
      node.name = `${node.name}_${i + 1}`;
    });
  }
  return result;
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
  applyPythonCallable: ApplyPythonCallable,
): Promise<StepNode> {
  const moduleArgs = await Promise.all(
    args.map(a => stepNodeToModule(evaluator, a, applyPythonCallable)),
  );
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
    return disambiguateGeneratedFunctions(
      await moduleToStepNode(evaluator, syncResult, name, true),
    );
  }
  const gen = evaluator.closure_call_unchecked(closure, moduleArgs);
  let step = await gen.next();
  while (!step.done) step = await gen.next();
  return disambiguateGeneratedFunctions(await moduleToStepNode(evaluator, step.value, name, true));
}

/** A single `from X import Y [as Z]` binding, resolved to its stepper value — attached to the
 * corresponding `ImportStatement` node's `bindings` field by {@link resolveImports} for `reduce.ts`'s
 * `"ImportStatement"` case to actually substitute in, once that statement's own step is reached. */
export interface ImportBinding {
  name: string;
  value: StepNode;
}

/**
 * Resolves every `FromImport` a program uses, before stepping begins — mirroring
 * `src/engines/cse/modules.ts`'s `loadModules`/`evaluateImports` (module loading happens once, ahead
 * of running/stepping the program itself, matching every other py-slang evaluator's two-phase model).
 * Resolving is *not* the same as binding, though (py-slang#417): each import statement's resolved
 * {@link ImportBinding}s are attached to its own translated `ImportStatement` node (`program.body[i]`,
 * matching `fileInput.statements[i]` 1:1 — `translateProgram` preserves that correspondence) rather
 * than substituted into the program immediately. `reduce.ts`'s `"ImportStatement"` case is what
 * actually performs the substitution, once — and only once — that statement's own step is reached,
 * exactly like a `def`/assignment's own `stepHead` contraction. Before this fix, substituting
 * everywhere up front meant a name a program imports showed its resolved value (and hover popover)
 * from the very first step, even *before* the import statement's own "Evaluating import statement"
 * step had run — Chapters 1-2's substitution model promises that nothing is bound until the statement
 * that binds it actually executes; an import is no exception.
 *
 * `evaluator` is `undefined` when no module loader is wired up (e.g. a bare `getPythonSteps()` call in
 * a test, or `PyStepperEvaluatorBase` in a host that hasn't registered `ModuleLoaderRunnerPlugin`) —
 * every imported name is then simply left unbound (no `ImportStatement` node gets a `bindings` field
 * at all), exactly matching this file's absence: a program that never uses the name still reaches
 * "Evaluation complete" (`translate.ts`'s `FromImport` → a no-op statement), one that does gets stuck
 * at the point of use, not here. A relative import, a missing module, or a name a module doesn't
 * export are all *student-actionable* mistakes, though, so once an evaluator genuinely is available
 * those throw `ModuleImportError` rather than degrading — mirrors how CSE
 * (`RelativeImportNotSupportedError`/`ModuleNotFoundError`) and py2js (`loadChunkImports`) both treat
 * the identical cases as hard errors, not silent no-ops. This still happens entirely up front, unlike
 * the binding itself: a program-wide "can this even load" check belongs to preprocessing, not to
 * however far the student has stepped when a given import statement happens to run.
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

  // Each statement's own bindings are still computed sequentially in source order (not concurrently),
  // so a value that needs an extra microtask hop to convert (see moduleToStepNode's DataType.CLOSURE
  // case) can't finish out of order relative to a plainer one from a later import — mirrors py2js's
  // `loadChunkImports`' identical ordering rationale. Program-order "last import wins" itself no
  // longer depends on this, though: once attached, each ImportStatement's bindings are substituted in
  // by reduce.ts strictly in the order statements actually step, which is program order by
  // construction.
  const body = (program.body as StepNode[]).slice();
  for (let i = 0; i < fileInput.statements.length; i++) {
    if (fileInput.statements[i].kind !== "FromImport") continue;
    const stmt = fileInput.statements[i] as StmtNS.FromImport;
    const moduleName = stmt.module.lexeme;
    const exportsByName = new Map(plugins.get(moduleName)!.exports.map(e => [e.symbol, e.value]));
    const bindings: ImportBinding[] = [];
    for (const spec of stmt.names) {
      const exportValue = exportsByName.get(spec.name.lexeme);
      if (exportValue === undefined) {
        throw new ModuleImportError(
          `cannot import name '${spec.name.lexeme}' from '${moduleName}'`,
        );
      }
      const name = (spec.alias ?? spec.name).lexeme;
      const value = await moduleToStepNode(evaluator, exportValue, spec.name.lexeme);
      bindings.push({ name, value });
    }
    body[i] = { ...body[i], bindings };
  }
  return { ...program, body };
}
