import { DataType, TypedValue } from "@sourceacademy/conductor/types";
import { ModuleLoaderRunnerPlugin } from "@sourceacademy/runner-module-loader";
import { OpaqueIdentifier } from "../../../../conductor/dist/conductor/types/moduleInterface";
import { ExprNS } from "../../ast-types";
import { RuntimeSourceError } from "../../errors";
import { Context } from "./context";
import { handleRuntimeError } from "./error";
import { appInstr } from "./instrCreator";
import { BuiltinValue, Value } from "./stash";
import { ModuleFunctionGenerator } from "./types";

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
    case "list":
      const array = await context.evaluator.array_make(DataType.VOID, value.value.length);
      for (let i = 0; i < value.value.length; i++) {
        await context.evaluator.array_set(
          array,
          i,
          await pythonToModule(context, code, command, value.value[i]),
        );
      }
      return array;
    case "opaque":
      return { type: DataType.OPAQUE, value: value.value as OpaqueIdentifier };
    case "builtin":
      async function* builtinFunc(...args: TypedValue<DataType>[]): ModuleFunctionGenerator {
        const result = await (value as BuiltinValue).func(
          await Promise.all(args.map(arg => moduleToPython(context, code, command, arg))),
          code,
          command as ExprNS.Call,
          context,
        );
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
        for (const arg of args.reverse()) {
          context.stash.push(await moduleToPython(context, code, command, arg));
        }
        yield;
        return pythonToModule(context, code, command, context.stash.pop()!);
      }
      return context.evaluator.closure_make<DataType[], DataType>(
        // TODO: fix arity
        {
          returnType: DataType.VOID,
          args: Array(value.closure.node.parameters.length).fill(DataType.VOID),
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
    case DataType.BOOLEAN:
      return { type: "bool", value: value.value };
    case DataType.CONST_STRING:
      return { type: "string", value: value.value };
    case DataType.VOID:
    case DataType.EMPTY_LIST:
      return { type: "none" };
    case DataType.ARRAY:
      return {
        type: "list",
        value: await Promise.all(
          new Array(await context.evaluator.array_length(value)).map(async v =>
            moduleToPython(context, code, command, await context.evaluator!.array_get(value, v)),
          ),
        ),
      };
    case DataType.OPAQUE:
      return { type: "opaque", value: value.value };
    case DataType.PAIR:
      return {
        type: "list",
        value: [
          await moduleToPython(context, code, command, await context.evaluator.pair_head(value)),
          await moduleToPython(context, code, command, await context.evaluator.pair_tail(value)),
        ],
      };
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
      return {
        type: "builtin",
        minArgs: await context.evaluator.closure_arity(value),
        name: "closure",
        func: builtinGenerator,
      };
  }
}
