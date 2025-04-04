import * as es from 'estree';
import { Stash, Value } from './stash';
import { Control, ControlItem } from './control';
import { createSimpleEnvironment, createProgramEnvironment, Environment } from './environment';
import { CseError } from './error';
import { Heap } from './heap';
import {
  AppInstr,
  Instr,
  InstrType,
  BranchInstr,
  WhileInstr,
  ForInstr,
  Node,
  StatementSequence
} from './types'
import { NativeStorage } from '../types';

export class Context {
  public control: Control;
  public stash: Stash;
  //public environment: Environment;
  public errors: CseError[] = [];

  runtime: {
    break: boolean
    debuggerOn: boolean
    isRunning: boolean
    environmentTree: EnvTree
    environments: Environment[]
    nodes: Node[]
    control: Control | null
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

  constructor(program?: es.Program | StatementSequence, context?: Context) {
    this.control = new Control(program);
    this.stash = new Stash();
    this.runtime = this.createEmptyRuntime();
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
      evaller: null,
      loadedModules: {},
      loadedModuleTypes: {}
    }
  }

  createGlobalEnvironment = (): Environment => ({
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

  public reset(program?: es.Program | StatementSequence): void {
    this.control = new Control(program);
    this.stash = new Stash();
    //this.environment = createProgramEnvironment(this, false);
    this.errors = []; 
  }

  public copy(): Context {
    const newContext = new Context();
    newContext.control = this.control.copy();
    newContext.stash = this.stash.copy();
    //newContext.environments = this.copyEnvironment(this.environments);
    return newContext;
  }

  private copyEnvironment(env: Environment): Environment {
    const newTail = env.tail ? this.copyEnvironment(env.tail) : null;
    const newEnv: Environment = {
      id: env.id, 
      name: env.name,
      tail: newTail,
      head: { ...env.head },
      heap: new Heap(),
      callExpression: env.callExpression, 
      thisContext: env.thisContext
    };
    return newEnv;
  }
}

export class EnvTree {
  private _root: EnvTreeNode | null = null
  private map = new Map<Environment, EnvTreeNode>()

  get root(): EnvTreeNode | null {
    return this._root
  }

  public insert(environment: Environment): void {
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

  public getTreeNode(environment: Environment): EnvTreeNode | undefined {
    return this.map.get(environment)
  }
}

export class EnvTreeNode {
  private _children: EnvTreeNode[] = []

  constructor(readonly environment: Environment, public parent: EnvTreeNode | null) {}

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
