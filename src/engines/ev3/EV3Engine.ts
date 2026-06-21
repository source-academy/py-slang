import { parse } from '../../parser/parser-adapter'
import { SVMLCompiler } from '../svml/svml-compiler'
import type { EV3ExecutionResult } from './types'

class EV3Engine {
  async execute(code: string): Promise<EV3ExecutionResult> {
    try {
      const ast = parse(code + '\n')
      const compiler = SVMLCompiler.fromProgram(ast)
      const svmlProgram = compiler.compileProgram(ast)

      return {
        status: 'finished',
        output: JSON.stringify(svmlProgram)
      }
    } catch (err) {
      return {
        status: 'error',
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }
}

export { EV3Engine }

