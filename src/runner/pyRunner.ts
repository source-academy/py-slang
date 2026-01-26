import { ErrorValue } from '../cse-machine/stash'
import { PyContext } from '../cse-machine/py_context'
import { PyCSEResultPromise, PyEvaluate } from '../cse-machine/py_interpreter'
import { RecursivePartial, Result } from '../types'
import { Tokenizer } from '../tokenizer'
import { Parser } from '../parser'
import { Resolver } from '../resolver'
import { StmtNS } from '../ast-types'
import { preprocessFileImports } from '../modules/preprocessor/index'
import { createProgramEnvironment, pushEnvironment } from '../cse-machine/py_environment'

type Stmt = StmtNS.Stmt

export interface IOptions {
  isPrelude: boolean
  envSteps: number
  stepLimit: number
  importOptions?: any
  shouldAddFileName?: boolean
}

export async function runPyAST(
  code: string,
  variant: number = 1,
  doValidate: boolean = false
): Promise<Stmt> {
  const script = code + '\n'
  const tokenizer = new Tokenizer(script)
  const tokens = tokenizer.scanEverything()
  const pyParser = new Parser(script, tokens)
  const ast = pyParser.parse()
  if (doValidate) {
    new Resolver(code, ast).resolve(ast)
  }
  return ast
}

export async function PyRunInContext(
  code: string,
  context: PyContext,
  options: RecursivePartial<IOptions> = {}
): Promise<Result> {
  // TODO: Refactor to use createContext function similar to js-slang.
  // Ensure a global environment exists before any processing
  if (context.runtime.environments.length === 0) {
    pushEnvironment(context, createProgramEnvironment(context, options.isPrelude || false));
  }

  const ast = await runPyAST(code, 1, true)

  const entrypointFilePath = 'main.py';

  const preprocessResult = await preprocessFileImports(
    ast,
    entrypointFilePath,
    context,
    options as IOptions
  );

  if (!preprocessResult.ok) {
    const errorValue = { type: 'error', message: context.errors[0].explain() } as ErrorValue;
    return PyCSEResultPromise(context, errorValue);
  }
  const result = PyRunCSEMachine(code, ast, context, options)
  return result
}

export function PyRunCSEMachine(
  code: string,
  program: Stmt,
  context: PyContext,
  options: RecursivePartial<IOptions> = {}
): Promise<Result> {
  const result = PyEvaluate(code, program, context, options as IOptions)
  return PyCSEResultPromise(context, result)
}
