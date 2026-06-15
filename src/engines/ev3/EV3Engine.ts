import { parse } from '../../parser/parser-adapter'
import { SVMLCompiler } from '../svml/svml-compiler'
import { slingClient } from './slingClient'
import type { EV3ExecutionResult } from './types'

class EV3Engine {
  private slingClient: slingClient

  constructor() {
    this.slingClient = new slingClient()
  }

  async execute(code: string): Promise<EV3ExecutionResult> {
    try {
      const ast = parse(code + '\n')

      const compiler = SVMLCompiler.fromProgram(ast)
      const svmlProgram = compiler.compileProgram(ast)

      return await this.slingClient.run({
        code,
        svml: svmlProgram
      })
    } catch (err) {
      return {
        status: 'error',
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }
}

export { EV3Engine }
