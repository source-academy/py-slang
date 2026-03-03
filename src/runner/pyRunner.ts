import { Context } from "../cse-machine/context";
import { CSEResultPromise, evaluate } from "../cse-machine/interpreter";
import { RecursivePartial, Result } from "../types";
import { Tokenizer } from "../tokenizer";
import { Parser } from "../parser";
import { Resolver } from "../resolver";
import { StmtNS } from "../ast-types";
import { Group } from "../stdlib/utils";
import { Environment } from "../cse-machine/environment";

type Stmt = StmtNS.Stmt

export interface IOptions {
  isPrelude: boolean;
  groups: Group[];
  envSteps: number;
  stepLimit: number;
}

function runPyAST(
  code: string,
  variant: number = 1,
  doValidate: boolean = false,
  groups: Group[] = [],
  preludeNames: string[] = []
): Stmt {
  const script = code + "\n";
  const tokenizer = new Tokenizer(script);
  const tokens = tokenizer.scanEverything();
  const pyParser = new Parser(script, tokens);
  const ast = pyParser.parse();
  if (doValidate) {
    new Resolver(script, ast, groups, preludeNames).resolve(ast);
  }
  return ast;
}

export async function loadGroupsIntoContext(context: Context, groups: Group[], options: RecursivePartial<IOptions> = {}) {
  if (options.isPrelude || !options.groups) 
    return;

  for (const group of groups as Group[]) {
    for (const [name, value] of group.builtins) {
      context.nativeStorage.builtins.set(name, value);
    }
    await runInContext(group.prelude, context, { ...options, isPrelude: true, groups: [] });
  }
}

export async function runInContext(
  code: string,
  context: Context,
  options: RecursivePartial<IOptions> = {}
): Promise<Result> {
  await loadGroupsIntoContext(context, options.groups as Group[], options);
  const pyAst = runPyAST(code, 1, !options.isPrelude, options.groups as Group[], Object.keys(context.runtime.environments[0].head));
  const result = runCSEMachine(code, pyAst, context, options);
  return result;
}

export async function runCSEMachine(
  code: string,
  program: Stmt,
  context: Context,
  options: RecursivePartial<IOptions> = {}
): Promise<Result> {
  const result = evaluate(code, program, context, options as IOptions);
  return CSEResultPromise(context, await result);
}
