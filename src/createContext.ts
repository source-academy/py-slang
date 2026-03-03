import { createProgramEnvironment, pushEnvironment } from './cse-machine/environment';
//import * as list from './stdlib/list'
import { listPrelude } from './stdlib/list.prelude';
//import * as misc from './stdlib/misc'
import { builtIns, builtInConstants } from './stdlib';
//import * as pylib from './stdlib/pylib'
import { streamPrelude } from './stdlib/stream.prelude';
import { createTypeEnvironment, tForAll, tVar } from './typeChecker/utils';

//import type { Context, CustomBuiltIns, Environment, NativeStorage, Value } from './types'
import type { NativeStorage, CustomBuiltIns } from './types';
import { Context } from './cse-machine/context';
import type { Environment } from './cse-machine/environment';
import { Heap } from './cse-machine/heap';
import type { Node } from './cse-machine/types';
import { Value } from './cse-machine/stash';


//import * as operators from './utils/operators';
import { EnvTree, EnvTreeNode } from './cse-machine/context';
import { CseError } from './cse-machine/error';

//import * as stringify from 'js-slang/dist/utils/stringify';
import { stringify } from './utils/stringify';

/*
const createEmptyRuntime = () => ({
  break: false,
  debuggerOn: true,
  isRunning: false,
  environmentTree: new EnvTree(),
  environments: [] as Environment[],
  value: undefined,
  nodes: [] as Node[],
  control: null,
  stash: null,
  transformers: new Transformers(),
  objectCount: 0,
  envSteps: -1,
  envStepsTotal: 0,
  breakpointSteps: [] as number[],
  changepointSteps: [] as number[]
})

const createGlobalEnvironment = (): Environment => ({
    tail: null,
    name: 'global',
    head: {},
    heap: new Heap(),
    id: '-1'
  })
    */
/*
const createEmptyDebugger = () => ({
  observers: { callbacks: Array<() => void>() },
  status: false,
  state: { it: (function* (): any { return })() }
})


const createNativeStorage = (): NativeStorage => ({
  builtins: new Map(),
  previousProgramsIdentifiers: new Set(),
  operators: new Map(Object.entries(operators)),
  maxExecTime: JSSLANG_PROPERTIES.maxExecTime,
  //evaller: null,
  loadedModules: {},
  loadedModuleTypes: {}
})
*/
/*
export const createEmptyContext = <T>(
  chapter: Chapter,
  variant: Variant = Variant.DEFAULT,
  languageOptions: LanguageOptions = {},
  externalSymbols: string[],
  externalContext?: T
): Context => {
  const runtime = createEmptyRuntime()  

  const globalEnvironment = createGlobalEnvironment()
  runtime.environments.push(globalEnvironment)
  runtime.environmentTree.insert(globalEnvironment)

  return {
    chapter,
    externalSymbols,
    errors: [],
    externalContext,
    runtime,
    numberOfOuterEnvironments: 1,
    prelude: null,
    debugger: createEmptyDebugger(),
    nativeStorage: createNativeStorage(),
    executionMethod: 'auto',
    variant,
    languageOptions,
    moduleContexts: {}, // Python FFI container
    unTypecheckedCode: [],
    typeEnvironment: createTypeEnvironment(chapter),
    previousPrograms: [],
    shouldIncreaseEvaluationTimeout: false
  }
}
*/
/*

//Found to be redundant
export const ensureGlobalEnvironmentExist = (context: Context) => {
  if (!context.runtime) context.runtime = createEmptyRuntime()
  if (!context.runtime.environments) context.runtime.environments = []
  if (!context.runtime.environmentTree) context.runtime.environmentTree = new EnvTree()
  if (context.runtime.environments.length === 0) {
    const globalEnvironment = createGlobalEnvironment()
    context.runtime.environments.push(globalEnvironment)
    context.runtime.environmentTree.insert(globalEnvironment)
  }
}
*/

export const defineSymbol = (context: Context, name: string, value: Value) => {
  const globalEnvironment = context.runtime.environments[0]
  Object.defineProperty(globalEnvironment.head, name, {
    value, writable: false, enumerable: true
  })
  context.nativeStorage.builtins.set(name, value)
}

// BUGFIX 3: Proper TypeScript optional parameter typing for function overloading
export function defineBuiltin(
  context: Context,
  name: string,
  value: Value,
  minArgsNeeded: undefined | number = undefined
) {
  function extractName(name: string): string { return name.split('(')[0].trim() }
  function extractParameters(name: string): string[] {
    if (!name.includes('(')) return []
    return name.split('(')[1].split(')')[0].split(',').map(s => s.trim())
  }

  if (typeof value === 'function') {
    const funName = extractName(name)
    const funParameters = extractParameters(name)
    const repr = `function ${name} {\n\t[native py-slang builtin]\n}`
    value.toString = () => repr
    value.minArgsNeeded = minArgsNeeded
    value.funName = funName
    value.funParameters = funParameters
    defineSymbol(context, funName, value)
  } else {
    defineSymbol(context, name, value)
  }
}

export const importExternalSymbols = (context: Context, externalSymbols: string[]) => {
  //ensureGlobalEnvironmentExist(context)
  externalSymbols.forEach(symbol => {
    defineSymbol(context, symbol, GLOBAL[symbol as keyof typeof GLOBAL])
  })
}

export const importBuiltins = (context: Context, externalBuiltIns: CustomBuiltIns) => {
  //ensureGlobalEnvironmentExist(context)
  
  const rawDisplay = (v: Value, ...s: string[]) => externalBuiltIns.rawDisplay(v, s[0], context.externalContext)
  const display = (v: Value, ...s: string[]) => {
    if (s.length === 1 && s[0] !== undefined && typeof s[0] !== 'string') throw new TypeError('display expects the second argument to be a string')
    return (rawDisplay(stringify(v), s[0]), v)
  }
  const prompt = (v: Value) => {
    const start = Date.now()
    const promptResult = externalBuiltIns.prompt(v, '', context.externalContext)
    context.nativeStorage.maxExecTime += Date.now() - start
    return promptResult
  }
  const visualiseList = (...v: Value) => {
    externalBuiltIns.visualiseList(v, context.externalContext)
    return v[0]
  }

  
  for (const [name, valueObj] of builtInConstants.entries()) {
    defineBuiltin(context, name, valueObj)
  }

  for (const [name, value] of builtIns.entries()) {
    // Note: 'value' here is an object like { type: 'builtin', name: 'abs', func: [Function] }
    // which CSE machine shouldknows how to execute natively!
    defineBuiltin(context, name, value)
  }

}

function importPrelude(context: Context) {
  // Load preludes unconditionally for py-slang to ensure full list/stream support
  let prelude = ''
  prelude += listPrelude
  prelude += streamPrelude
  
  if (prelude !== '') {
    context.prelude = prelude
  }
}

const defaultBuiltIns: CustomBuiltIns = {
  rawDisplay: misc.rawDisplay,
  prompt: misc.rawDisplay,
  alert: misc.rawDisplay,
  visualiseList: (_v: Value) => { throw new Error('List visualizer is not enabled') }
}

const createContext = <T>(
  chapter: Chapter = Chapter.PYTHON_1, // Defaulting safely to Python
  variant: Variant = Variant.DEFAULT,
  languageOptions: LanguageOptions = {},
  externalSymbols: string[] = [],
  externalContext?: T,
  externalBuiltIns: CustomBuiltIns = defaultBuiltIns
): Context => {

  /*const context = createEmptyContext(
    chapter, variant, languageOptions, externalSymbols, externalContext
  )
  */

  const context = new Context()

  importBuiltins(context, externalBuiltIns)
  importPrelude(context)
  importExternalSymbols(context, externalSymbols)

  return context
}

export default createContext

