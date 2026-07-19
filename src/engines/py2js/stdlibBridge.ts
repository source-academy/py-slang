/**
 * py2js engine — stdlib bridge.
 *
 * The stdlib groups (src/stdlib/misc.ts, math.ts, …) are written against the
 * CSE machine's tagged Value union with `(args, source, command, context)`
 * signatures. This bridge exposes them to py2js by converting the engine's
 * native (unboxed) values to tagged Values at the call boundary and back for
 * the result — so both engines run the *same* builtin implementations, and
 * stdlib semantics can never drift between them. Conformance is pinned by
 * src/tests/stdlib-conformance-py2js.test.ts.
 *
 * What crosses the boundary at chapters 1-2: int/float/bool/str/None/complex
 * round-trip losslessly (complex is a PyComplexNumber on both sides); a pair
 * (PyPair) round-trips recursively to/from CSE's flat 2-element list Value —
 * chapter 2 has no list-literal syntax and no list.ts group, so pair()/
 * llist() (the only way to construct one) always produce exactly that shape.
 * A function crosses one way *as a value a builtin inspects* (a user function
 * becomes a minimal FunctionValue, so is_function answers True and error
 * messages say 'function'; a py2js builtin becomes a stub BuiltinValue —
 * neither is callable from stdlib code, which no chapter-1/2 builtin
 * attempts) — but it can still flow back out *unchanged*, e.g.
 * `head(pair(1, f))` or `llist(f)`, since no chapter-1/2 builtin fabricates a
 * genuinely new function value, only passes an argument through structurally
 * (into/out of a pair). `functionOrigin` (a WeakMap from the synthetic tagged
 * stand-in back to the real PyFunction) is what makes that round-trip
 * lossless without reconstructing a function from its printable stand-in,
 * which is impossible in general.
 *
 * Error handling: stdlib builtins raise through handleRuntimeError, which
 * records on the bridge's Context and throws the error class — the throw
 * propagates out of the compiled py2js program and is wrapped into a
 * Py2JsRunError by index.ts, preserving the error-class name. The `command`
 * node each builtin receives is a synthetic Call whose callee token carries
 * the builtin's name, so messages that name the callee ("unsupported argument
 * type for math_sin…") stay accurate; source positions point at the program
 * start until py2js grows real error locations.
 *
 * Async builtins (print, input — the stream-based ones) are NOT bridged:
 * their sync py2js replacements live in runtime.ts's native core, and the
 * bridge's Promise guard below is the backstop for any future async stdlib
 * addition. `arity` is also native (py2js functions are not CSE closures);
 * bridged builtins carry pyMinArgs so it reports the same numbers the CSE
 * machine does.
 */
import { ExprNS } from "../../ast-types";
import { Token, TokenType } from "../../tokenizer";
import type { Group } from "../../stdlib/utils";
import { Context } from "../cse/context";
import type { Environment } from "../cse/environment";
import type { BuiltinValue, Value } from "../cse/stash";
import { Py2JsRuntime, Py2JsRuntimeError, PyFunction, PyPair, PyValue } from "./runtime";

function syntheticCallNode(name: string): ExprNS.Call {
  const token = new Token(TokenType.NAME, name, 1, 0, 0);
  token.synthetic = true;
  const callee = new ExprNS.Variable(token, token, token);
  return new ExprNS.Call(token, token, callee, []);
}

/** Maps a synthetic tagged stand-in (built below) back to the real PyFunction
 * it stands in for — see the file header's note on lossless pass-through. */
const functionOrigin = new WeakMap<object, PyFunction>();

function toTagged(v: PyValue): Value {
  switch (typeof v) {
    case "bigint":
      return { type: "bigint", value: v };
    case "number":
      return { type: "number", value: v };
    case "boolean":
      return { type: "bool", value: v };
    case "string":
      return { type: "string", value: v };
    case "function": {
      // See file header: functions cross as inspectable, non-callable
      // stand-ins. The fallbacks cover bare JS functions that bypassed
      // annotateHostFunction (index.ts establishes the metadata invariant
      // for extraBuiltins; Function#name can be "", hence || not ??).
      const name = v.pyName ?? (v.name || "(anonymous)");
      const tagged: Value = v.pyBuiltin
        ? {
            type: "builtin",
            name,
            minArgs: v.pyMinArgs ?? Math.max(0, v.pyArity ?? v.length),
            func: () => {
              throw new Py2JsRuntimeError(
                "SystemError",
                `stdlib bridge: ${name} cannot be called from a bridged builtin`,
              );
            },
          }
        : {
            type: "function",
            name,
            params: [],
            body: [],
            env: undefined as unknown as Environment,
          };
      functionOrigin.set(tagged, v);
      return tagged;
    }
    default:
      if (v === null) return { type: "none" };
      if (v instanceof PyPair) {
        return { type: "list", value: [toTagged(v.head), toTagged(v.tail)] };
      }
      return { type: "complex", value: v };
  }
}

function fromTagged(name: string, v: Value): PyValue {
  switch (v.type) {
    case "bigint":
    case "number":
    case "string":
    case "complex":
      return v.value;
    case "bool":
      return v.value;
    case "none":
      return null;
    case "list":
      // Chapter 2 has no list-literal syntax and no list.ts group (chapter
      // 3+), so pair()/llist() — the only way to construct one — always
      // produce exactly a 2-element cons cell; anything else would mean
      // list.ts got bridged ahead of chapter-3 support actually landing.
      if (v.value.length !== 2) {
        throw new Py2JsRuntimeError(
          "SystemError",
          `stdlib bridge: ${name}() returned a non-pair list value (length ${v.value.length}), not yet supported`,
        );
      }
      return new PyPair(fromTagged(name, v.value[0]), fromTagged(name, v.value[1]));
    case "function":
    case "builtin": {
      // A function value only ever flows back out as one of THIS bridge's
      // own synthetic stand-ins passed through unchanged (see file header;
      // e.g. head(pair(1, f)) or llist(f)) — never a genuinely new closure a
      // builtin fabricated, which no chapter-1/2 builtin does. Recover the
      // original PyFunction rather than trying to reconstruct one.
      const original = functionOrigin.get(v);
      if (original !== undefined) return original;
      throw new Py2JsRuntimeError(
        "SystemError",
        `stdlib bridge: ${name}() returned a function value the bridge did not itself produce`,
      );
    }
    default:
      // No chapter-1/2 stdlib builtin returns a closure or list-family value
      // other than a pair; reaching this means the bridge needs extending,
      // not that user code is wrong.
      throw new Py2JsRuntimeError(
        "SystemError",
        `stdlib bridge: ${name}() returned an unbridgeable '${v.type}' value`,
      );
  }
}

function bridgeBuiltin(
  rt: Py2JsRuntime,
  name: string,
  builtin: BuiltinValue,
  context: Context,
  source: string,
): PyFunction {
  const command = syntheticCallNode(name);
  const call = builtin.func as (
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ) => Value | undefined | Promise<Value | undefined>;
  // pyArity -1: argument-count validation is the builtin's own @Validate
  // wrapper, so arity errors carry the CSE machine's exact messages.
  const f = rt.def(name, -1, (...args: PyValue[]) => {
    const result = call(args.map(toTagged), source, command, context);
    if (result instanceof Promise) {
      throw new Py2JsRuntimeError(
        "RuntimeError",
        `${name}() is asynchronous and not yet supported by the py2js engine`,
      );
    }
    return result === undefined ? null : fromTagged(name, result);
  });
  f.pyBuiltin = true;
  f.pyMinArgs = builtin.minArgs;
  return f;
}

/**
 * Bridge every builtin (and constant) of the given stdlib groups into py2js
 * native values. `source` is the program text, used by stdlib error
 * constructors for their (currently synthetic) location info.
 */
export function bridgeStdlibGroups(
  rt: Py2JsRuntime,
  groups: Group[],
  source: string,
  variant: number,
): Record<string, PyValue> {
  const context = new Context();
  context.variant = variant;
  const out: Record<string, PyValue> = {};
  for (const group of groups) {
    for (const [name, value] of group.builtins) {
      out[name] =
        value.type === "builtin"
          ? bridgeBuiltin(rt, name, value, context, source)
          : fromTagged(name, value);
    }
  }
  return out;
}
