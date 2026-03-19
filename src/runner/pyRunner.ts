import { Context } from "../cse-machine/context";
import { CSEResultPromise, evaluate } from "../cse-machine/interpreter";
import { RecursivePartial, Result } from "../types";
import { parse } from "../parser/parser-adapter";
import { analyze } from "../resolver/analysis";
import { StmtNS } from "../ast-types";

type Stmt = StmtNS.Stmt

export interface IOptions {
  isPrelude: boolean;
  envSteps: number;
  stepLimit: number;
  chapter?: number;
}

function runPyAST(
  code: string,
  chapter: number = 4,
  doValidate: boolean = false
): Stmt {
  const script = code + "\n";
  const ast = parse(script) as StmtNS.FileInput;
  if (doValidate) {
    analyze(ast, script, chapter);
  }
  return ast;
}

export async function runInContext(
  code: string,
  context: Context,
  options: RecursivePartial<IOptions> = {}
): Promise<Result> {
  const pyAst = runPyAST(code, options.chapter ?? 4, true);
  const result = runCSEMachine(code, pyAst, context, options);
  return result;
}

export function runCSEMachine(
  code: string,
  program: Stmt,
  context: Context,
  options: RecursivePartial<IOptions> = {}
): Promise<Result> {
  const result = evaluate(code, program, context, options as IOptions);
  return CSEResultPromise(context, result);
}
