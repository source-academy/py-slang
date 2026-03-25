import { StmtNS } from "../ast-types";
import { Context } from "../cse-machine/context";
import { CSEResultPromise, evaluate } from "../cse-machine/interpreter";
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

function runPyAST(code: string, chapter: number = 4, doValidate: boolean = false, group: Group[] = [], prelude: string[] = []): Stmt {
  const script = code + "\n";
  // console.log("parsing");
  const ast = parse(script);
  // console.log(script);
  if (doValidate) {
    // console.log("analyzing");
    // console.log(group.length);
    analyze(ast, script, chapter, group, prelude);
  }
  // console.log("finished analyzing");
  return ast;
}

export async function loadGroupsIntoContext(context: Context, chapter: number, groups: Group[], options: RecursivePartial<IOptions> = {}) {
  //console.log("loading in loadGroupsIntoContext");
  //console.log(groups);
  if (options.isPrelude || !options.groups) 
    return;
  let prelude = "";
  for (const group of groups) {
    for (const [name, value] of group.builtins) {
      //console.log(name)
      //console.log(value)
      context.nativeStorage.builtins.set(name, value);
    }
    prelude += group.prelude + "\n";
  }
  await runInContext(prelude, chapter, context, { ...options, isPrelude: true, groups: [] });
}


export async function runInContext(
  code: string,
  chapter: number,
  context: Context,
  options: RecursivePartial<IOptions> = {},
): Promise<Result> {
  // 1. Load the prelude
  await loadGroupsIntoContext(context, chapter, options.groups as Group[], options);
  // console.log(context.runtime.environments[0].head)
  let pyAst: Stmt;
  try {
    pyAst = runPyAST(
      code, 
      chapter, 
      !options.isPrelude, // ✅ FIX: Skip validation for the prelude!
      options.groups as Group[], 
      Object.keys(context.runtime.environments[0].head) // ✅ Naturally works now!
    );
  } catch (error) {
    // ✅ FIX: Catch validation errors so they format nicely in the frontend
    return CSEResultPromise(context, { type: 'error', message: String(error) });
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
  // console.log("before evaluate in line 72");
  // console.log(code);
  const result = await evaluate(code, program, context, options as IOptions);
  // console.log("done evaluating");
  // console.log(result);
  return CSEResultPromise(context, result);
}
