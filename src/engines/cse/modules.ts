import {
  ClosureIdentifier,
  DataType,
  OpaqueIdentifier,
  TypedValue,
} from "@sourceacademy/conductor/types";
import { ModuleLoaderRunnerPlugin } from "@sourceacademy/runner-module-loader";
import { ExprNS } from "../../ast-types";
import { RuntimeSourceError } from "../../errors";
import { Context } from "./context";
import { handleRuntimeError } from "./error";
import { appInstr } from "./instrCreator";
import { BuiltinValue, ListValue, Value } from "./stash";
import { ModuleFunctionGenerator } from "./types";

/**
 * Marks a freshly-built list Value as a genuine Python list literal (as opposed to a value built by
 * pair()/llist(), or one round-tripped from a module's DataType.PAIR) - see the "list" case in
 * pythonToModule for why this distinction can't be made from shape alone. A side-tag rather than a
 * shape change so nothing else that already treats list literals as a flat array (indexing, len(),
 * iteration, etc.) needs to change.
 */
export const listLiteralValues = new WeakSet<ListValue>();

export class ModuleNotFoundError extends RuntimeSourceError {
  constructor(public readonly moduleName: string) {
    super();
    this.message = `Module "${moduleName}" not found.`;
  }
}

export async function loadModules(context: Context, moduleNames: string[]): Promise<void> {
  await Promise.all(
    moduleNames.map(async moduleName => {
      try {
        if (!ModuleLoaderRunnerPlugin.instance) {
          throw new Error("ModuleLoaderRunnerPlugin is not initialized");
        }
        const pluginObj = await ModuleLoaderRunnerPlugin.instance.requestModule(moduleName);
        context.nativeStorage.loadedModules[moduleName] = Object.fromEntries(
          pluginObj?.exports.map(t => [t.symbol, t]) || [],
        );
      } catch {
        handleRuntimeError(context, new ModuleNotFoundError(moduleName));
      }
    }),
  );
}

export async function pythonToModule(
  context: Context,
  code: string,
  command: ExprNS.Call | undefined,
  value: Value,
): Promise<TypedValue<DataType>> {
  if (!context.evaluator) {
    throw new Error("Context is not properly initialized with evaluator");
  }
  switch (value.type) {
    case "number":
      return { type: DataType.NUMBER, value: value.value };
    case "bool":
      return { type: DataType.BOOLEAN, value: value.value };
    case "string":
      return { type: DataType.CONST_STRING, value: value.value };
    case "none":
      return { type: DataType.EMPTY_LIST, value: null };
    case "list": {
      // A list literal (tagged at construction in the InstrType.LIST microcode) is unambiguously a
      // Source list, of any length including 2 - fold it into a proper PAIR/EMPTY_LIST chain, or
      // list-typed module parameters (e.g. sound's consecutively/simultaneously/stacking_adsr
      // envelopes) would silently see zero (or the wrong) elements instead of the list the student
      // actually wrote. The length !== 2 check is a defensive fallback only - pair()/llist()/module
      // round-trips always produce exactly 2-element links, so an untagged value should never
      // actually hit it, but building a chain is still the safer default if one somehow did.
      if (listLiteralValues.has(value) || value.value.length !== 2) {
        let chain: TypedValue<DataType> = { type: DataType.EMPTY_LIST, value: null };
        for (let i = value.value.length - 1; i >= 0; i--) {
          chain = await context.evaluator.pair_make(
            await pythonToModule(context, code, command, value.value[i]),
            chain,
          );
        }
        return chain;
      }
      // Otherwise this came from pair()/llist(), or a module PAIR round-tripped through
      // moduleToPython - both always produce exactly 2-element links, reconstructed here as a single
      // pair_make(head, tail) without requiring the chain to terminate in None, since a module PAIR
      // need not be a proper list (e.g. sound's Sound is (wavesPair, duration), a dotted pair whose
      // second element is a number, not another list link).
      const [head, tail] = value.value;
      return context.evaluator.pair_make(
        await pythonToModule(context, code, command, head),
        await pythonToModule(context, code, command, tail),
      );
    }
    case "opaque":
      return { type: DataType.OPAQUE, value: value.value as OpaqueIdentifier };
    case "builtin":
      if ("id" in value.func && typeof value.func.id === "number" && value.func.id !== null) {
        return { type: DataType.CLOSURE, value: value.func.id as ClosureIdentifier<DataType> };
      }
      async function* builtinFunc(...args: TypedValue<DataType>[]): ModuleFunctionGenerator {
        const result = await (value as BuiltinValue).func(
          await Promise.all(args.map(arg => moduleToPython(context, code, command, arg))),
          code,
          command as ExprNS.Call,
          context,
        );
        if (result === undefined) {
          return { type: DataType.VOID, value: undefined };
        }
        if ("next" in result) {
          return yield* result;
        }
        return pythonToModule(context, code, command, result);
      }

      return context.evaluator.closure_make<DataType[], DataType>(
        { returnType: DataType.VOID, args: Array(value.minArgs).fill(DataType.VOID) },
        builtinFunc,
      );
    case "bigint":
      return { type: DataType.NUMBER, value: Number(value.value) };
    case "closure":
      const value2 = value;
      async function* closureFunc(...args: TypedValue<DataType>[]): ModuleFunctionGenerator {
        context.control.push(appInstr(args.length, command as ExprNS.Call));
        context.stash.push(value2);
        for (const arg of args) {
          context.stash.push(await moduleToPython(context, code, command, arg));
        }
        yield;
        return pythonToModule(context, code, command, context.stash.pop()!);
      }
      const arity =
        (value.closure.node.parameters.findIndex(p => p.isStarred) + 1 ||
          value.closure.node.parameters.length + 1) - 1;
      return context.evaluator.closure_make<DataType[], DataType>(
        {
          returnType: DataType.VOID,
          args: Array(arity).fill(DataType.VOID),
        },
        closureFunc,
      );
    case "complex":
    case "multi_lambda":
    case "error":
    case "function":
      throw new Error("This construct is not supported in module interop");
  }
}

/**
 * Reads a PAIR or ARRAY's elements uniformly: a PAIR is always exactly 2 (head, tail - whatever
 * they are, not necessarily a proper list continuation - e.g. sound's Sound is (wave, duration),
 * a dotted pair whose second element is a plain NUMBER), an ARRAY is however many array_length
 * reports. Deliberately NOT list_to_vec: that walks a chain expecting it to terminate in
 * EMPTY_LIST (a *proper list* invariant), which a raw dotted pair doesn't satisfy - this is a
 * flat "give me this compound value's N elements" read, nothing more.
 */
async function readCompoundElements(
  evaluator: NonNullable<Context["evaluator"]>,
  value: TypedValue<DataType.ARRAY> | TypedValue<DataType.PAIR>,
): Promise<TypedValue<DataType>[]> {
  if (value.type === DataType.PAIR) {
    return [await evaluator.pair_head(value), await evaluator.pair_tail(value)];
  }
  const length = await evaluator.array_length(value);
  return Promise.all(Array.from({ length }, (_, i) => evaluator.array_get(value, i)));
}

export async function moduleToPython(
  context: Context,
  code: string,
  command: ExprNS.Call | undefined,
  value: TypedValue<DataType>,
): Promise<Value> {
  if (!context.evaluator) {
    throw new Error("Context is not properly initialized with evaluator");
  }
  switch (value.type) {
    case DataType.NUMBER:
      return { type: "number", value: value.value }; // TODO: handle bigint
    case DataType.INTEGER:
      // py-slang never produces DataType.INTEGER itself (see pythonToModule's "bigint" case
      // above) - per Martin, integers stay out of the module interface entirely, numbers crossing
      // a module boundary are always floats. Only here for switch exhaustiveness over conductor's
      // DataType enum.
      return { type: "number", value: Number(value.value) };
    case DataType.BOOLEAN:
      return { type: "bool", value: value.value };
    case DataType.CONST_STRING:
      return { type: "string", value: value.value };
    case DataType.VOID:
    case DataType.EMPTY_LIST:
      return { type: "none" };
    case DataType.OPAQUE:
      return { type: "opaque", value: value.value };
    case DataType.ARRAY:
    case DataType.PAIR: {
      // Untyped and recursive, uniformly for both: per Martin, a PAIR is just a 2-element array,
      // not a distinct concept - one shared conversion, not a separate case per DataType.
      const elements = await readCompoundElements(context.evaluator, value);
      return {
        type: "list",
        value: await Promise.all(elements.map(el => moduleToPython(context, code, command, el))),
      };
    }
    case DataType.CLOSURE:
      async function* builtinGenerator(
        args: Value[],
        code: string,
        command: ExprNS.Call,
        context: Context,
      ): ModuleFunctionGenerator {
        const result = await context.evaluator!.closure_call_unchecked(
          value as TypedValue<DataType.CLOSURE>,
          await Promise.all(args.map(arg => pythonToModule(context, code, command, arg))),
        );
        return yield* result;
      }
      builtinGenerator.id = value.value;
      return {
        type: "builtin",
        minArgs: await context.evaluator.closure_arity(value),
        name: "closure",
        func: builtinGenerator,
      };
  }
}
