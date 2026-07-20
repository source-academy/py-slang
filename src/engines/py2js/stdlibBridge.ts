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
 * (a 2-element PyList) round-trips to/from CSE's identically-shaped 2-element
 * list Value — chapter 2 has no list-literal syntax and no list.ts group, so
 * pair()/llist() (the only way to construct one) always produce exactly that
 * shape. A function crosses one way *as a value a builtin inspects* (a user function
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
import { GroupName } from "../../stdlib/utils";
import type { Group } from "../../stdlib/utils";
import { Context } from "../cse/context";
import type { Environment } from "../cse/environment";
import type { BuiltinValue, Value } from "../cse/stash";
import {
  isPairShaped,
  Py2JsRuntime,
  Py2JsRuntimeError,
  PyFunction,
  PyList,
  PyOpaque,
  pyTypeName,
  PyValue,
} from "./runtime";

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
      // CSE has no separate representation for a pair vs. an arbitrary-
      // length list (both are its flat `{type:"list", value: Value[]}` —
      // see src/engines/cse/stash.ts), so converting element-wise here
      // reproduces CSE's own is_list/list_length answers exactly, including
      // on a 2-element list (which CSE cannot tell apart from a pair
      // either — see runtime.ts's PyList doc comment).
      if (Array.isArray(v)) return toTaggedList(v);
      // No chapter-1/2 stdlib builtin accepts an opaque module value as an
      // argument (abs/math_sqrt/etc. all type-check against "opaque" being
      // absent from their accepted types), so this just needs to produce
      // *some* CSE Value the builtin's own dispatch will reject cleanly —
      // matching CSE's own opaque conversion shape (modules.ts).
      if (v instanceof PyOpaque) return { type: "opaque", value: v.typed };
      return { type: "complex", value: v };
  }
}

/**
 * Converts a PyList to CSE's nested list Value. A long proper list built via
 * pair()/llist() (or one built via chapter-3+ mutation into the same shape)
 * has its entire length along the "spine" (chained tail positions), so this
 * walks that spine iteratively rather than recursing — a naive
 * `{ type: "list", value: [toTagged(v[0]), toTagged(v[1])] }` applied
 * per-element via plain recursion would cost one JS stack frame per element
 * just to convert a single argument for one bridged call, and a list of a
 * few thousand elements already overflows the stack, regardless of how
 * tail-recursive the user's own Python is (its own tail calls go through
 * py2js's trampoline; this bridge conversion does not). The walk continues
 * exactly as long as the current node is itself a 2-element list (a chain
 * link); it stops — falling through to a plain `.map()` — the moment that
 * shape breaks, which correctly covers a flat N-element (N≠2) literal list
 * (zero iterations) and a pair whose tail isn't itself a pair (one
 * iteration) with no separate case needed for either. `heads[i]`/the final
 * tail are still converted via the ordinary (recursive) toTagged, since each
 * head is normally a scalar leaf; a list-of-lists nested arbitrarily deep
 * through a head position remains a (much rarer) recursion, same as before.
 */
function toTaggedList(v: PyList): Value {
  if (!isPairShaped(v)) return { type: "list", value: v.map(toTagged) };
  const heads: PyValue[] = [];
  let current: PyValue = v;
  while (isPairShaped(current)) {
    heads.push(current[0]);
    current = current[1];
  }
  let tail = toTagged(current);
  for (let i = heads.length - 1; i >= 0; i--) {
    tail = { type: "list", value: [toTagged(heads[i]), tail] };
  }
  return tail;
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
    case "list": {
      // Mirrors toTaggedList's iterative spine-walk, in the opposite
      // direction: a long proper list/pair chain a bridged builtin returns
      // (enum_llist, reverse, map, …) is nested 2-element CSE list Values
      // all the way down, so reconstructing it via plain per-element
      // recursion (fromTagged on each tail) would cost one JS stack frame
      // per element — the same failure mode toTaggedList's own doc comment
      // describes, just crossing the boundary in the other direction.
      if (v.value.length !== 2) return v.value.map(el => fromTagged(name, el));
      const heads: PyValue[] = [];
      let current: Value = v;
      while (current.type === "list" && current.value.length === 2) {
        heads.push(fromTagged(name, current.value[0]));
        current = current.value[1];
      }
      let tail = fromTagged(name, current);
      for (let i = heads.length - 1; i >= 0; i--) {
        tail = [heads[i], tail];
      }
      return tail;
    }
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
 * set_head/set_tail (chapter 3's pair-mutators group): mutate an existing
 * 2-element list *in place*. This cannot go through the generic toTagged/
 * fromTagged round-trip like every other bridged builtin — that round-trip
 * converts the argument into a *fresh* CSE-side value, so a mutation the CSE
 * builtin performs on it (as pairmutator.ts does) would be silently lost
 * rather than visible on the original PyList the caller's Python variable
 * still points to.
 */
function nativeSetPairSlot(name: string, index: 0 | 1, sayPair: boolean): PyFunction {
  const f = ((...args: PyValue[]) => {
    const target = args[0];
    const value = args[1];
    if (isPairShaped(target)) {
      target[index] = value;
      return null;
    }
    throw new Py2JsRuntimeError(
      "TypeError",
      `${name}() expects a pair as first argument, got '${pyTypeName(target, sayPair)}'`,
    );
  }) as PyFunction;
  f.pyName = name;
  f.pyArity = 2;
  f.pyBuiltin = true;
  f.pyMinArgs = 2;
  return f;
}

/**
 * stream() (chapter 3's stream group): the one native primitive the group
 * needs — every other stream function (stream_map, stream_filter, …) is pure
 * Python in stream.prelude.ts, already runnable once pairs/closures work, so
 * it never touches this. Not bridged generically because CSE's own
 * StreamBuiltins.stream fabricates a brand new closure (the lazy tail thunk)
 * on every call — the bridge's toTagged/fromTagged round-trip only handles
 * function values that either originated in py2js or pass through
 * unchanged, not ones a CSE builtin invents on the spot — so it's
 * reimplemented directly against py2js's own PyList/PyFunction instead,
 * mirroring StreamBuiltins.stream's recursion exactly.
 *
 * `build` takes an index rather than re-slicing `args` on every lazy step:
 * `args.slice(1)` would copy the remaining N-1 elements at each of N steps,
 * O(N^2) time and space for an N-element stream.
 */
function nativeStream(rt: Py2JsRuntime): PyFunction {
  const build = (args: PyValue[], index: number): PyValue => {
    if (index >= args.length) return null;
    const tail = rt.def("anonymous stream", 0, () => build(args, index + 1));
    tail.pyBuiltin = true;
    return [args[index], tail];
  };
  const f = ((...args: PyValue[]) => build(args, 0)) as PyFunction;
  f.pyName = "stream";
  f.pyArity = -1;
  f.pyBuiltin = true;
  f.pyMinArgs = 0;
  return f;
}

/**
 * apply_in_underlying_python(f, xs) (chapter 4's parser/"mce" group): calls
 * `f` with the arguments in linked-list `xs`. CSE's own implementation
 * (ParserBuiltins.apply_in_underlying_python in src/stdlib/parser.ts) pushes
 * onto its own control/stash for the CSE step loop to pick up later, rather
 * than returning a value — semantically incompatible with bridgeBuiltin's
 * generic path, which expects a builtin to return a Value synchronously (a
 * generic bridge attempt would silently no-op: it would run against a fresh,
 * throwaway Context whose control/stash nothing ever steps). Reimplemented
 * natively instead: walk the argument list exactly as permissively as CSE
 * does (any 2-element-list-shaped chain, terminated by anything that isn't,
 * not strictly requiring a None tail) and invoke `f` through the runtime's
 * own synchronous call trampoline (the same
 * one a TS module uses to call back into Python — see Py2JsRuntime.callSync).
 *
 * `parse`/`tokenize` need no such native treatment: both just transform a
 * string into CSE's tagged parse tree (transform() in src/stdlib/parser.ts),
 * built entirely out of 2-element cons cells, which the existing
 * toTagged/fromTagged round-trip already reconstructs correctly as nested
 * PyLists — so they go through the ordinary generic bridge above unchanged.
 */
function walkArgList(xs: PyValue): PyValue[] {
  const args: PyValue[] = [];
  // Cycle guard: set_tail/set_head (chapter 3's pair mutators) can build a
  // genuinely self-referential pair (`p = pair(1, 2); set_tail(p, p)`).
  // Without this, a circular argument list would spin forever, growing
  // `args` without bound until the process runs out of memory — visited
  // tracks list *nodes* by identity (not values), so only an actual cycle
  // back to a node already on this walk trips it, not e.g. two
  // separately-built pairs that happen to compare equal.
  const visited = new Set<object>();
  let current = xs;
  while (isPairShaped(current)) {
    if (visited.has(current)) {
      throw new Py2JsRuntimeError("RuntimeError", "circular list structure in arguments");
    }
    visited.add(current);
    args.push(current[0]);
    current = current[1];
  }
  return args;
}

function nativeApplyInUnderlyingPython(rt: Py2JsRuntime): PyFunction {
  const f = ((...args: PyValue[]) => rt.callSync(args[0], walkArgList(args[1]))) as PyFunction;
  f.pyName = "apply_in_underlying_python";
  f.pyArity = 2;
  f.pyBuiltin = true;
  f.pyMinArgs = 2;
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
    // See nativeSetPairSlot/nativeStream's doc comments for why these two
    // groups' primitives are reimplemented natively instead of left as the
    // generic bridge produced above.
    if (group.name === GroupName.PAIRMUTATORS) {
      out.set_head = nativeSetPairSlot("set_head", 0, variant <= 2);
      out.set_tail = nativeSetPairSlot("set_tail", 1, variant <= 2);
    }
    if (group.name === GroupName.STREAMS) {
      out.stream = nativeStream(rt);
    }
    if (group.name === GroupName.MCE) {
      out.apply_in_underlying_python = nativeApplyInUnderlyingPython(rt);
    }
  }
  return out;
}
