import { ExprNS } from "../../ast-types";
import { MissingRequiredPositionalError, TooManyPositionalArgumentsError } from "../../errors";
import { Closure } from "./closure";
import { Context } from "./context";
import { handleRuntimeError } from "./error";
import { listLiteralValues } from "./modules";
import { ListValue, Value } from "./stash";

/**
 * Sentinel stored in a Frame for a local variable that has been allocated (by CALL,
 * per its owning function's static scan of assignments/def/for-targets) but not yet
 * assigned a value. Distinguishes "declared, no value yet" from "no such local" so
 * reads can raise the correct Python-shaped error instead of silently resolving to an
 * unrelated binding of the same name further up the environment chain.
 */
export const UNASSIGNED = Symbol("unassigned");

export interface Frame {
  [name: string]: Value | typeof UNASSIGNED;
}

/**
 * An Environment represents a scope in the execution of the program.
 */
export interface Environment {
  readonly id: string;

  /**
   * The name of the environment, for debugging purposes.
   * For example, the global environment is named "global", the environment created by a function call is named after the function, and block environments are named "blockEnvironment".
   */
  name: string;

  /**
   * The parent environment, or null if this is the global environment.
   * Environments form a linked list, with the global environment at the end.
   */
  tail: Environment | null;

  /**
   * The expression that led to the creation of this environment, if applicable.
   */
  callExpression?: ExprNS.Call;

  /**
   * The variable bindings created in the innermost scope.
   */
  head: Frame;

  /**
   * The closure associated with this environment, if this environment was created as part of a function call.
   */
  closure?: Closure;
}

export const uniqueId = (context: Context): string => {
  return `${context.runtime.objectCount++}`;
};

export const createEnvironment = (
  source: string,
  context: Context,
  closure: Closure,
  args: Value[],
  callExpression: ExprNS.Call,
): Environment => {
  const environment: Environment = {
    name: closure.node.kind === "FunctionDef" ? closure.node.name.lexeme : "lambda",
    tail: closure.environment,
    head: {},
    id: uniqueId(context),
    callExpression: callExpression,
    closure: closure,
  };

  const isVariadic = closure.node.parameters.some(param => param.isStarred);
  let consumed = false;
  closure.node.parameters.forEach((paramToken, index) => {
    if (consumed) {
      return;
    }
    const paramName = paramToken.lexeme;
    if (paramToken.isStarred) {
      // Rest parameter: collect remaining args into a list value.
      // Spread flattening in the Application handler detects these via
      // val.type === "list" and expands val.value inline.
      const restArgs: ListValue = { type: "list", value: args.slice(index) };
      // A flat, arbitrary-length collection - the same category as a bracket literal (visitListExpr/
      // InstrType.LIST), not a pair()/llist() chain - so module interop (pythonToModule) needs the
      // same tag to reconstruct it as a proper PAIR/EMPTY_LIST chain rather than misreading an
      // exactly-2-arg case as a dotted pair. See listLiteralValues' definition in modules.ts.
      listLiteralValues.add(restArgs);
      environment.head[paramName] = restArgs;
      consumed = true;
      return;
    }
    if (index >= args.length) {
      handleRuntimeError(
        context,
        new MissingRequiredPositionalError(
          source,
          callExpression,
          environment.name,
          isVariadic ? index + 1 : closure.node.parameters.length,
          args,
          isVariadic,
        ),
      );
    }
    if (!consumed) {
      // If we have already consumed the rest argument, the remaining are keyword-only arguments
      environment.head[paramName] = args[index];
    }
  });
  if (!isVariadic && args.length > closure.node.parameters.length) {
    handleRuntimeError(
      context,
      new TooManyPositionalArgumentsError(
        source,
        callExpression,
        environment.name,
        closure.node.parameters.length,
        args,
        isVariadic,
      ),
    );
  }

  // Allocate every local of this function (assignment/def/for targets, minus params
  // already bound above) as UNASSIGNED right now, at CALL time — not lazily, whenever
  // its first assignment happens to execute. This makes reads that race ahead of their
  // binding (temporal-dead-zone reads, including free-variable reads from a nested
  // closure) find an unassigned cell owned by this frame instead of falling through to
  // an unrelated binding of the same name further up the chain (e.g. a global).
  for (const name of closure.localVariables) {
    if (!Object.prototype.hasOwnProperty.call(environment.head, name)) {
      environment.head[name] = UNASSIGNED;
    }
  }

  return environment;
};

export const createSimpleEnvironment = (
  context: Context,
  name: string,
  tail: Environment | null = null,
): Environment => {
  return {
    id: uniqueId(context),
    name,
    tail,
    head: {},
    // TODO: callExpression is optional and can be provided as needed.
  };
};

export const createProgramEnvironment = (context: Context, isPrelude: boolean): Environment => {
  return createSimpleEnvironment(
    context,
    isPrelude ? "prelude" : "programEnvironment",
    isPrelude
      ? getGlobalEnvironment(context)
      : getPreludeEnvironment(context) || getGlobalEnvironment(context),
  );
};

export const createBlockEnvironment = (
  context: Context,
  name = "blockEnvironment",
): Environment => {
  return {
    name,
    tail: currentEnvironment(context),
    head: {},
    id: uniqueId(context),
  };
};

export const currentEnvironment = (context: Context): Environment => {
  return context.runtime.environments[0];
};

export const getGlobalEnvironment = (context: Context): Environment | null => {
  const envs = context.runtime.environments;
  return envs.length > 0 ? envs[envs.length - 1] : null;
};

export const getPreludeEnvironment = (context: Context): Environment | null => {
  const envs = context.runtime.environments;
  return envs.length > 1 ? envs[envs.length - 2] : null;
};

export const popEnvironment = (context: Context) => context.runtime.environments.shift();

export const pushEnvironment = (context: Context, environment: Environment) => {
  context.runtime.environments.unshift(environment);
};
