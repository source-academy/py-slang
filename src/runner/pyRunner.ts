import { Context } from "../cse-machine/context";
import { CSEResultPromise, evaluate } from "../cse-machine/interpreter";
import { RecursivePartial, Result } from "../types";
import { Tokenizer } from "../tokenizer";
import { Parser } from "../parser";
import { Resolver } from "../resolver";
import { StmtNS } from "../ast-types";

type Stmt = StmtNS.Stmt

export interface IOptions {
  isPrelude: boolean;
  envSteps: number;
  stepLimit: number;
}

function runPyAST(
  code: string,
  variant: number = 1,
  doValidate: boolean = false
): Stmt {
  const script = code + "\n";
  const tokenizer = new Tokenizer(script);
  const tokens = tokenizer.scanEverything();
  const pyParser = new Parser(script, tokens);
  const ast = pyParser.parse();
  if (doValidate) {
    new Resolver(script, ast).resolve(ast);
  }
  return ast;
}

export async function runInContext(
  code: string,
  context: Context,
  options: RecursivePartial<IOptions> = {}
): Promise<Result> {
  const pyAst = runPyAST(code, 1, true);
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
