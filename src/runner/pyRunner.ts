import { PyContext } from '../cse-machine/py_context'
import { PyCSEResultPromise, PyEvaluate } from '../cse-machine/py_interpreter'
import { RecursivePartial, Result } from '../types'
import { Tokenizer } from '../tokenizer'
import { Parser } from '../parser'
import { Resolver } from '../resolver'
import { StmtNS } from '../ast-types'

type Stmt = StmtNS.Stmt

export interface IOptions {
  isPrelude: boolean
  envSteps: number
  stepLimit: number
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
  const ast = await runPyAST(code, 1, true)
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
