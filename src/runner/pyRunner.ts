import { StmtNS } from "../ast-types";
import { Context } from "../cse-machine/context";
import { CSEResultPromise, evaluate } from "../cse-machine/interpreter";
import { Parser } from "../parser";
import { Resolver } from "../resolver";
import { Group } from "../stdlib/utils";
import { Tokenizer } from "../tokenizer";
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
  const tokenizer = new Tokenizer(script);
  const tokens = tokenizer.scanEverything();
  const pyParser = new Parser(script, tokens);
  const ast = pyParser.parse();
  if (doValidate) {
    new Resolver(script, ast, variant, groups, preludeNames).resolve(ast);
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
  for (const group of groups as Group[]) {
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
  const result = evaluate(code, program, context, options as IOptions);
  return CSEResultPromise(context, await result);
}
