import { Context } from "../cse-machine/context";
import { CSEResultPromise, evaluate } from "../cse-machine/interpreter";
import { RecursivePartial, Result } from "../types";
import { Tokenizer } from "../tokenizer";
import { Parser } from "../parser";
import { Resolver } from "../resolver";
import { Program } from "estree";
import { Translator } from "../translator";
import * as es from "estree";

export interface IOptions {
  isPrelude: boolean;
  envSteps: number;
  stepLimit: number;
}

function parsePythonToEstreeAst(
  code: string,
  variant: number = 1,
  doValidate: boolean = false
): Program {
  const script = code + "\n";
  const tokenizer = new Tokenizer(script);
  const tokens = tokenizer.scanEverything();
  const pyParser = new Parser(script, tokens);
  const ast = pyParser.parse();
  if (doValidate) {
    new Resolver(script, ast).resolve(ast);
  }
  const translator = new Translator(script);
  return translator.resolve(ast) as unknown as Program;
}

export async function runInContext(
  code: string,
  context: Context,
  options: RecursivePartial<IOptions> = {}
): Promise<Result> {
  const estreeAst = parsePythonToEstreeAst(code, 1, true);
  const result = runCSEMachine(code, estreeAst, context, options);
  return result;
}

export function runCSEMachine(
  code: string,
  program: es.Program,
  context: Context,
  options: RecursivePartial<IOptions> = {}
): Promise<Result> {
  const result = evaluate(code, program, context, options);
  return CSEResultPromise(context, result);
}
