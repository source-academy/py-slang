// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { PyRunInContext, IOptions } from '../runner/pyRunner'
import { PyContext } from '../cse-machine/py_context'
import { BasicEvaluator, IRunnerPlugin } from '@sourceacademy/conductor/runner'
import { Finished } from '../types'

const defaultContext = new PyContext()
const defaultOptions: IOptions = {
  isPrelude: false,
  envSteps: 100000,
  stepLimit: 100000
}

export default class PyEvaluator extends BasicEvaluator {
  private context: PyContext
  private options: IOptions

  constructor(conductor: IRunnerPlugin) {
    super(conductor)
    this.context = defaultContext
    this.options = defaultOptions
  }

  async evaluateChunk(chunk: string): Promise<void> {
    try {
      const result = await PyRunInContext(chunk, this.context, this.options)
      this.conductor.sendOutput(
        `${(result as Finished).representation.toString((result as Finished).value)}`
      )
    } catch (error) {
      this.conductor.sendOutput(`Error: ${error instanceof Error ? error.message : error}`)
    }
  }
}
