import { Context } from "../cse-machine/context";
import { CSEResultPromise, evaluate } from "../cse-machine/interpreter";
import { RecursivePartial, Result } from "../types";
import { Tokenizer } from "../tokenizer";
import { NearleyParser } from "../parser/parser-adapter";
import { Resolver } from "../resolver";
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
  const tokenizer = new Tokenizer(script);
  const tokens = tokenizer.scanEverything();
  const parser = new NearleyParser(script, tokens);
  const ast = parser.parse();
  if (doValidate) {
    const resolver = new Resolver(script, ast);
    resolver.resolve(ast);
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
