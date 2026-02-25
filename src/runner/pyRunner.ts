import { Context } from "../cse-machine/context";
import { CSEResultPromise, evaluate } from "../cse-machine/interpreter";
import { RecursivePartial, Result } from "../types";
import { parse } from '../parser/parser-adapter';
import { analyze } from "../resolver";
import { Program } from "estree";
import { Translator } from "../translator";
import * as es from "estree";

export interface IOptions {
  isPrelude: boolean;
  envSteps: number;
  stepLimit: number;
  chapter: number;
}

function parsePythonToEstreeAst(
  code: string,
  chapter: number = 4,
  doValidate: boolean = false
): Program {
  const script = code + "\n";
  const ast = parse(script);
  if (doValidate) {
    analyze(ast, script, chapter);
  }
  const translator = new Translator(script);
  return translator.resolve(ast) as unknown as Program;
}

export async function runInContext(
  code: string,
  context: Context,
  options: RecursivePartial<IOptions> = {}
): Promise<Result> {
  const estreeAst = parsePythonToEstreeAst(code, options.chapter ?? 4, true);
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
