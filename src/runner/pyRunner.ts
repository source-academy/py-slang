import { ErrorType } from "@sourceacademy/conductor/common";
import { StmtNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { CSEResultPromise, evaluate } from "../engines/cse/interpreter";
import { displayError } from "../engines/cse/streams";
import { parse } from "../parser/parser-adapter";
import { analyze } from "../resolver/analysis";
import { Group } from "../stdlib/utils";
import { RecursivePartial, Result } from "../types";

type Stmt = StmtNS.Stmt;

export interface IOptions {
  isPrelude: boolean;
  groups: Group[];
  envSteps: number;
  stepLimit: number;
  variant: number;
}

function runPyAST(
  code: string,
  variant: number = 1,
  doValidate: boolean = false,
  groups: Group[] = [],
  preludeNames: string[] = [],
): Stmt {
  const script = code + "\n";
  const ast = parse(script);
  if (doValidate) {
    analyze(ast, script, variant, groups, preludeNames);
  }
  return ast;
}

export async function loadGroupsIntoContext(
  context: Context,
  groups: Group[],
  options: RecursivePartial<IOptions> = {},
) {
  if (options.isPrelude || !options.groups) return;
  let prelude = "";
  for (const group of groups) {
    for (const [name, value] of group.builtins) {
      context.nativeStorage.builtins.set(name, value);
    }
    prelude += group.prelude + "\n";
  }
  await runInContext(prelude, context, { ...options, isPrelude: true, groups: [] });
}

export async function runInContext(
  code: string,
  context: Context,
  options: RecursivePartial<IOptions> = {},
): Promise<Result> {
  await loadGroupsIntoContext(context, options.groups as Group[], options);
  let pyAst: Stmt;
  try {
    pyAst = runPyAST(
      code,
      options.variant,
      !options.isPrelude,
      options.groups as Group[],
      Object.keys(context.runtime.environments[0].head),
    );
  } catch (error) {
    await displayError(context, error, ErrorType.EVALUATOR_SYNTAX);
    return CSEResultPromise(context, { type: "error", message: String(error) });
  }
  const result = runCSEMachine(code, pyAst, context, options);
  return result;
}

export async function runCSEMachine(
  code: string,
  program: Stmt,
  context: Context,
  options: RecursivePartial<IOptions> = {},
): Promise<Result> {
  const result = await evaluate(code, program, context, options as IOptions);
  return CSEResultPromise(context, result);
}
