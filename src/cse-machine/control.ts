import { Stack } from './stack';
import { Instr, Node } from './types';
import { StatementSequence } from './types'; //TODO
// import { isEnvDependent } from './utils' // TODO
import { StmtNS } from '../ast-types';

export type ControlItem = (Node | Instr) & {
  isEnvDependent?: boolean
  skipEnv?: boolean
}

export class Control extends Stack<ControlItem> {
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

  // TODO: to implement after ready for stepper
  // public pop(): ControlItem | undefined {
  //     const item = super.pop();
  //     if (item !== undefined && isEnvDependent(item)) {
  //       this.numEnvDependentItems--;
  //     }
  //     return item;
  //   }
  // public push(...items: ControlItem[]): void {
  //   const itemsNew: ControlItem[] = Control.simplifyBlocksWithoutDeclarations(...items)
  //   itemsNew.forEach((item: ControlItem) => {
  //     if (isEnvDependent(item)) {
  //       this.numEnvDependentItems++
  //     }
  //   })
  //   super.push(...itemsNew)
  // }

  //   /**
  //    * Before pushing block statements on the control stack, we check if the block statement has any declarations.
  //    * If not, the block is converted to a StatementSequence.
  //    * @param items The items being pushed on the control.
  //    * @returns The same set of control items, but with block statements without declarations converted to StatementSequences.
  //    * NOTE: this function handles any case where StatementSequence has to be converted back into BlockStatement due to type issues
  //    */
  //   private static simplifyBlocksWithoutDeclarations(...items: ControlItem[]): ControlItem[] {
  //     const itemsNew: ControlItem[] = []
  //     items.forEach(item => {
  //       if (isNode(item) && isBlockStatement(item) && !hasDeclarations(item)) {
  //         // Push block body as statement sequence
  //         const seq: StatementSequence = statementSequence(item.body, item.loc)
  //         itemsNew.push(seq)
  //       } else {
  //         itemsNew.push(item)
  //       }
  //     })
  //     return itemsNew
  //   }

  public copy(): Control {
    const newControl = new Control()
    const stackCopy = super.getStack()
    newControl.push(...stackCopy)
    return newControl
  }
}
