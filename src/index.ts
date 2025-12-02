import { initialise } from '@sourceacademy/conductor/runner'
import PyEvaluator from './conductor/PyEvaluator'

const { runnerPlugin, conduit } = initialise(PyEvaluator)
