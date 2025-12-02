import { Stack } from './stack'
import { PyNode, Instr } from './py_types'
import { StmtNS } from '../ast-types'
import { isEnvDependent } from './utils' // TODO
import { StatementSequence } from './py_types'

export type PyControlItem = (PyNode | Instr) & {
  isEnvDependent?: boolean
  skipEnv?: boolean
}

export class PyControl extends Stack<PyControlItem> {
  private numEnvDependentItems: number
  public constructor(program?: StmtNS.Stmt) {
    super()
    this.numEnvDependentItems = 0
    // Load program into control stack
    program ? this.push(program) : null
  }

  public canAvoidEnvInstr(): boolean {
    return this.numEnvDependentItems === 0
  }

  // For testing purposes
  public getNumEnvDependentItems(): number {
    return this.numEnvDependentItems
  }

  // TODO in the future
  //   public pop(): PyControlItem | undefined {
  //       const item = super.pop();
  //       if (item !== undefined && isEnvDependent(item)) {
  //         this.numEnvDependentItems--;
  //       }
  //       return item;
  //     }
  //   public push(...items: PyControlItem[]): void {
  //     items.forEach((item: PyControlItem) => {
  //     // We keep this logic for future use with the stepper.
  //     if (isEnvDependent(item)) {
  //         this.numEnvDependentItems++;
  //     }
  //     });
  //   super.push(...items);
  //   }

  public copy(): PyControl {
    const newControl = new PyControl()
    const stackCopy = super.getStack()
    newControl.push(...stackCopy)
    return newControl
  }
}
