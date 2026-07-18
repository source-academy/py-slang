import { ConductorError } from "@sourceacademy/conductor/common";
import { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { IDataHandler } from "@sourceacademy/conductor/types";
import { StmtNS } from "../../ast-types";
import { RuntimeSourceError } from "../../errors";
import { NativeStorage } from "../../types";
import { Control } from "./control";
import { Environment } from "./environment";
import { BuiltinValue, Stash } from "./stash";
import { InputStreamContext, WritableContext } from "./streams";
import { Node } from "./types";

/**
 * Stores the global context of the CSE engine,
 * including the control and stash, as well as other relevant information
 * such as the environment tree and loaded modules. This context is passed around and mutated during the evaluation of a program.
 */
export class Context {
  public control: Control;
  public stash: Stash;

  public conductor: IRunnerPlugin | null = null;
  public evaluator: IDataHandler | null = null;

  public streams:
    | {
        initialised: false;
      }
    | {
        initialised: true;
        stdout: WritableContext<string>;
        stderr: WritableContext<ConductorError>;
        stdin: InputStreamContext;
        /** Forces any output buffered by the current stdout stream out to the host immediately. */
        flushStdout?: () => void;
      };
  public errors: RuntimeSourceError[] = [];
  public prelude: string | null = null;
  /** The SICPy chapter (1-4) currently running — stamped once by evaluate()
   * (interpreter.ts). Lets error construction sites (e.g.
   * UnsupportedOperandTypeError) phrase a type name chapter-appropriately
   * (a "pair" and a length-2 "list" are the exact same runtime value here,
   * with no way to tell them apart from the value alone — the chapter is
   * what makes that call unambiguous: chapters 1-2 have no list-literal
   * syntax at all, per NoListsValidator, so any array-shaped value there
   * can only have come from pair()). Defaults to 4 (unrestricted), matching
   * IOptions' own default. */
  public variant: number = 4;
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
