import { DataType, IDataHandler, TypedValue } from "@sourceacademy/conductor/types";
import {
  PVMLBoxType,
  PVMLExtern,
  PVMLHostCall,
  getPVMLType,
  isPVMLObject,
  pvmlListLiteralArrays,
} from "./types";

/**
 * Conversion layer between PVML runtime values and the conductor module
 * protocol's TypedValues — PVML's analogue of src/engines/cse/modules.ts's
 * pythonToModule/moduleToPython pair, and deliberately mirrors its mapping
 * decisions (NUMBER<->float, none<->EMPTY_LIST, PAIR<->2-element array,
 * CLOSURE<->callable wrapper) so a module behaves identically whichever
 * engine the student is running on.
 *
 * The one structural difference from the CSE converters: no Context/machine
 * state is involved. A module function becomes a self-contained PVMLExtern
 * whose `fn` closes over the IDataHandler, and the reverse direction (a PVML
 * closure handed to a module) closes over the `callPvml` re-entry hook the
 * interpreter passes to every extern call (see PVMLHostCall's doc comment in
 * types.ts) — so conversion needs no access to the interpreter itself.
 */

/** Converts a conductor module value into a PVML runtime value. `name` is
 * the module export's symbol, used only to label the resulting extern for
 * display/error messages. */
export async function moduleToPvml(
  dh: IDataHandler,
  value: TypedValue<DataType> | undefined | null,
  name: string,
): Promise<PVMLBoxType> {
  // A void-returning module function's generator settles with its final
  // step.value left undefined -- matches DataType.VOID's own null-mapping
  // below (both mean Python's None), not a malformed module response.
  if (value === undefined || value === null) {
    return null;
  }
  switch (value.type) {
    case DataType.NUMBER:
      return value.value;
    case DataType.INTEGER:
      // py-slang never produces DataType.INTEGER itself (see pvmlToModule's bigint case below) -
      // per Martin, integers stay out of the module interface entirely, numbers crossing a module
      // boundary are always floats. Only here for switch exhaustiveness over conductor's DataType.
      return Number(value.value);
    case DataType.BOOLEAN:
      return value.value;
    case DataType.CONST_STRING:
      return value.value;
    case DataType.VOID:
    case DataType.EMPTY_LIST:
      // Matches CSE's moduleToPython: both a module function's void return
      // and the empty list map onto Python's None (SICPy's empty list).
      return null;
    case DataType.PAIR:
      // PVML represents a pair as a 2-element array — the same shape
      // pair()/vectorToPvmlList build (see builtins.ts).
      return {
        type: "array",
        elements: [
          await moduleToPvml(dh, await dh.pair_head(value), name),
          await moduleToPvml(dh, await dh.pair_tail(value), name),
        ],
      };
    case DataType.ARRAY: {
      const length = await dh.array_length(value);
      return {
        type: "array",
        elements: await Promise.all(
          Array.from({ length }, async (_, i) =>
            moduleToPvml(dh, await dh.array_get(value, i), name),
          ),
        ),
      };
    }
    case DataType.OPAQUE:
      return { type: "opaque", value };
    case DataType.CLOSURE: {
      const closureValue = value;
      const extern: PVMLExtern = {
        type: "extern",
        name,
        fn: async (args: PVMLBoxType[], callPvml: PVMLHostCall) => {
          const converted = await Promise.all(args.map(a => pvmlToModule(dh, a, callPvml)));
          // Drive the module function's async generator to completion. Its
          // yields exist so a machine-pumping evaluator (the CSE machine)
          // can interleave steps; PVML callbacks re-enter synchronously via
          // callPvml instead, so the yields are simply awaited past.
          const gen = dh.closure_call_unchecked(closureValue, converted);
          let step = await gen.next();
          while (!step.done) {
            step = await gen.next();
          }
          return moduleToPvml(dh, step.value, name);
        },
        // Carries the exact conductor closure identity through - see PVMLExtern's doc comment for
        // why (pvmlToModule's fast path when this same value later crosses back into a module).
        originalClosure: closureValue,
      };
      return extern;
    }
  }
}

/** Converts a PVML runtime value into a conductor module value — the reverse
 * of moduleToPvml, used for the arguments of an extern (module function)
 * call. `callPvml` re-enters the interpreter when the module later invokes a
 * converted PVML closure/primitive. */
export async function pvmlToModule(
  dh: IDataHandler,
  value: PVMLBoxType,
  callPvml: PVMLHostCall,
): Promise<TypedValue<DataType>> {
  if (value === null || value === undefined) {
    return { type: DataType.EMPTY_LIST, value: null };
  }
  if (typeof value === "number") {
    return { type: DataType.NUMBER, value };
  }
  if (typeof value === "bigint") {
    // Matches CSE's pythonToModule bigint case: module signatures only know
    // NUMBER, so Python ints cross the boundary as floats.
    return { type: DataType.NUMBER, value: Number(value) };
  }
  if (typeof value === "boolean") {
    return { type: DataType.BOOLEAN, value };
  }
  if (typeof value === "string") {
    return { type: DataType.CONST_STRING, value };
  }
  if (isPVMLObject(value)) {
    switch (value.type) {
      case "opaque":
        // Round-trips the exact TypedValue the module handed out — see
        // PVMLOpaque's doc comment for why `value` is typed unknown.
        return value.value as TypedValue<DataType.OPAQUE>;
      case "array": {
        // A list literal (tagged at construction — see pvmlListLiteralArrays' doc comment in
        // types.ts) is unambiguously a Source list, of any length including 2 — fold it into a
        // proper PAIR/EMPTY_LIST chain, or list-typed module parameters (e.g. sound's
        // consecutively/simultaneously/stacking_adsr envelopes) would silently see zero (or the
        // wrong) elements instead of the list the student actually wrote. Otherwise, a 2-element
        // array is PVML's pair (see moduleToPvml's PAIR case), reconstructed as a single
        // pair_make(head, tail) — the chain need not terminate in None (e.g. sound's Sound is a
        // dotted pair). Any other length is unambiguously a flat Python list either way.
        if (!pvmlListLiteralArrays.has(value) && value.elements.length === 2) {
          const [head, tail] = value.elements;
          return dh.pair_make(
            await pvmlToModule(dh, head, callPvml),
            await pvmlToModule(dh, tail, callPvml),
          );
        }
        let chain: TypedValue<DataType> = { type: DataType.EMPTY_LIST, value: null };
        for (let i = value.elements.length - 1; i >= 0; i--) {
          chain = await dh.pair_make(await pvmlToModule(dh, value.elements[i], callPvml), chain);
        }
        return chain;
      }
      case "extern":
        // This extern already carries the exact conductor closure it was minted from (see
        // PVMLExtern's doc comment) - hand that back directly instead of wrapping it in a new
        // closure_make'd callback. Mirrors the CSE machine's own pythonToModule fast path ("case
        // builtin: if 'id' in value.func"). Without this, a closure that round-trips across the
        // module boundary (e.g. sound's sine_sound producing a wave that play() samples 44100
        // times/sec) pays a fresh dispatchCall/invokeValueAsync round trip on *every* sample
        // instead of a direct closureMap lookup - measured at ~2.4x the per-sample cost of the
        // equivalent CSE path for exactly this shape.
        if (value.originalClosure) {
          return value.originalClosure;
        }
      // No originalClosure (shouldn't happen for any extern moduleToPvml creates today, but fall
      // through to the general wrapping path below rather than assume it can't occur).
      case "closure":
      case "primitive": {
        // Any callable PVML value a module receives becomes a conductor
        // closure that re-enters the interpreter (see PVMLHostCall).
        // dispatchCall handles closure and primitive values uniformly.
        const arity = value.type === "closure" ? value.ir.numArgs : 0;
        async function* callback(
          ...args: TypedValue<DataType>[]
        ): AsyncGenerator<void, TypedValue<DataType>, undefined> {
          const pvmlArgs = await Promise.all(args.map(a => moduleToPvml(dh, a, "callback")));
          const result = await callPvml(value, pvmlArgs);
          return pvmlToModule(dh, result, callPvml);
        }
        return dh.closure_make(
          { returnType: DataType.VOID, args: Array(arity).fill(DataType.VOID) },
          callback,
        );
      }
    }
  }
  throw new Error(
    `This construct is not supported in module interop (PVML value of type '${getPVMLType(value)}')`,
  );
}
