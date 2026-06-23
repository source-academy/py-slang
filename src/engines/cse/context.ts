import { ConductorError } from "@sourceacademy/conductor/common";
import { StmtNS } from "../../ast-types";
import { RuntimeSourceError } from "../../errors";
import { ModuleContext, NativeStorage } from "../../types";
import { Control } from "./control";
import { Environment } from "./environment";
import { BuiltinValue, Stash } from "./stash";
import { ReadableContext, WritableContext } from "./streams";
import { Node } from "./types";

/**
 * Stores the global context of the CSE engine,
 * including the control and stash, as well as other relevant information
 * such as the environment tree and loaded modules. This context is passed around and mutated during the evaluation of a program.
 */
export class Context {
  public control: Control;
  public stash: Stash;

  public streams:
    | {
        initialised: false;
      }
    | {
        initialised: true;
        stdout: WritableContext<string>;
        stderr: WritableContext<ConductorError>;
        stdin: ReadableContext<string>;
      };
  public errors: RuntimeSourceError[] = [];
  public moduleContexts: { [name: string]: ModuleContext };
  public prelude: string | null = null;
  runtime: {
    break: boolean;
    debuggerOn: boolean;
    isRunning: boolean;
    environments: Environment[];
    nodes: Node[];
    control: Control | null;
    stash: Stash | null;
    objectCount: number;
    envStepsTotal: number;
    breakpointSteps: number[];
    changepointSteps: number[];
  };

  /**
   * Used for storing the native context and other values
   */
  nativeStorage: NativeStorage;

  constructor(program?: StmtNS.Stmt) {
    this.control = new Control(program);
    this.stash = new Stash();
    this.runtime = this.createEmptyRuntime();
    this.moduleContexts = {};
    //this.environment = createProgramEnvironment(context || this, false);
    if (this.runtime.environments.length === 0) {
      const globalEnvironment = this.createGlobalEnvironment();
      this.runtime.environments.push(globalEnvironment);
    }
    this.streams = this.createEmptyStreams();
    this.nativeStorage = {
      builtins: new Map<string, BuiltinValue>(),
      maxExecTime: 1000,
      loadedModules: {},
      loadedModuleTypes: {},
    };
  }

  createGlobalEnvironment = (): Environment => ({
    tail: null,
    name: "global",
    head: {},
    id: "-1",
  });

  createEmptyRuntime = () => ({
    break: false,
    debuggerOn: true,
    isRunning: false,
    environments: [],
    value: undefined,
    nodes: [],
    control: null,
    stash: null,
    objectCount: 0,
    envSteps: -1,
    envStepsTotal: 0,
    breakpointSteps: [],
    changepointSteps: [],
  });

  createEmptyStreams = (): { initialised: false } => ({
    initialised: false,
  });

  public reset(program?: StmtNS.Stmt): void {
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
      callExpression: env.callExpression,
      closure: env.closure,
    };
    return newEnv;
  }
}
