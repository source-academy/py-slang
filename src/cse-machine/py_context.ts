import { Stash, Value } from './stash'
import { PyControl, PyControlItem } from './py_control'
import { createSimpleEnvironment, createProgramEnvironment, PyEnvironment } from './py_environment'
import { CseError } from './error'
import { Heap } from './heap'
import { PyNode } from './py_types'
import { ModuleContext, NativeStorage } from '../types'
import { StmtNS } from '../ast-types'

export class PyContext {
  public control: PyControl
  public stash: Stash
  public output: string = ''
  //public environment: Environment;
  public errors: CseError[] = []
  public moduleContexts: { [name: string]: ModuleContext }

  runtime: {
    break: boolean
    debuggerOn: boolean
    isRunning: boolean
    environmentTree: EnvTree
    environments: PyEnvironment[]
    nodes: PyNode[]
    control: PyControl | null
    stash: Stash | null
    objectCount: number
    envStepsTotal: number
    breakpointSteps: number[]
    changepointSteps: number[]
  }

  /**
   * Used for storing the native context and other values
   */
  nativeStorage: NativeStorage

  constructor(program?: StmtNS.Stmt, context?: PyContext) {
    this.control = new PyControl(program)
    this.stash = new Stash()
    this.runtime = this.createEmptyRuntime()
    this.moduleContexts = {}
    //this.environment = createProgramEnvironment(context || this, false);
    if (this.runtime.environments.length === 0) {
      const globalEnvironment = this.createGlobalEnvironment()
      this.runtime.environments.push(globalEnvironment)
      this.runtime.environmentTree.insert(globalEnvironment)
    }
    this.nativeStorage = {
      builtins: new Map<string, Value>(),
      previousProgramsIdentifiers: new Set<string>(),
      operators: new Map<string, (...operands: Value[]) => Value>(),
      maxExecTime: 1000,
      //evaller: null,
      loadedModules: {},
      loadedModuleTypes: {}
    }
  }

  createGlobalEnvironment = (): PyEnvironment => ({
    tail: null,
    name: 'global',
    head: {},
    heap: new Heap(),
    id: '-1'
  })

  createEmptyRuntime = () => ({
    break: false,
    debuggerOn: true,
    isRunning: false,
    environmentTree: new EnvTree(),
    environments: [],
    value: undefined,
    nodes: [],
    control: null,
    stash: null,
    objectCount: 0,
    envSteps: -1,
    envStepsTotal: 0,
    breakpointSteps: [],
    changepointSteps: []
  })

  public reset(program?: StmtNS.Stmt): void {
    this.control = new PyControl(program)
    this.stash = new Stash()
    //this.environment = createProgramEnvironment(this, false);
    this.errors = []
  }

  public copy(): PyContext {
    const newContext = new PyContext()
    newContext.control = this.control.copy()
    newContext.stash = this.stash.copy()
    //newContext.environments = this.copyEnvironment(this.environments);
    return newContext
  }

  private copyEnvironment(env: PyEnvironment): PyEnvironment {
    const newTail = env.tail ? this.copyEnvironment(env.tail) : null
    const newEnv: PyEnvironment = {
      id: env.id,
      name: env.name,
      tail: newTail,
      head: { ...env.head },
      heap: new Heap(),
      callExpression: env.callExpression,
      thisContext: env.thisContext
    }
    return newEnv
  }
}

export class EnvTree {
  private _root: EnvTreeNode | null = null
  private map = new Map<PyEnvironment, EnvTreeNode>()

  get root(): EnvTreeNode | null {
    return this._root
  }

  public insert(environment: PyEnvironment): void {
    const tailEnvironment = environment.tail
    if (tailEnvironment === null) {
      if (this._root === null) {
        this._root = new EnvTreeNode(environment, null)
        this.map.set(environment, this._root)
      }
    } else {
      const parentNode = this.map.get(tailEnvironment)
      if (parentNode) {
        const childNode = new EnvTreeNode(environment, parentNode)
        parentNode.addChild(childNode)
        this.map.set(environment, childNode)
      }
    }
  }

  public getTreeNode(environment: PyEnvironment): EnvTreeNode | undefined {
    return this.map.get(environment)
  }
}

export class EnvTreeNode {
  private _children: EnvTreeNode[] = []

  constructor(
    readonly environment: PyEnvironment,
    public parent: EnvTreeNode | null
  ) {}

  get children(): EnvTreeNode[] {
    return this._children
  }

  public resetChildren(newChildren: EnvTreeNode[]): void {
    this.clearChildren()
    this.addChildren(newChildren)
    newChildren.forEach(c => (c.parent = this))
  }

  private clearChildren(): void {
    this._children = []
  }

  private addChildren(newChildren: EnvTreeNode[]): void {
    this._children.push(...newChildren)
  }

  public addChild(newChild: EnvTreeNode): EnvTreeNode {
    this._children.push(newChild)
    return newChild
  }
}
