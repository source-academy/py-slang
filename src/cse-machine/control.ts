import { ExprNS, StmtNS } from '../ast-types';
import { Token } from '../tokenizer';
import type * as es from 'estree';
import { Stack } from './stack';
import { isNode, isBlockStatement, hasDeclarations, statementSequence } from './ast-helper';
import { Environment } from './environment';
import { Node, StatementSequence, Instr } from './types';
import { isEnvDependent } from './utils';

export type ControlItem = (Node | Instr) & {
  isEnvDependent?: boolean;
  skipEnv?: boolean;
};

export class Control extends Stack<ControlItem> {
  private numEnvDependentItems: number
  public constructor(program?: es.Program | StatementSequence) {
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

  public pop(): ControlItem | undefined {
    const item = super.pop()
    if (item !== undefined && isEnvDependent(item)) {
      this.numEnvDependentItems--
    }
    return item
  }

  public push(...items: ControlItem[]): void {
    const itemsNew: ControlItem[] = Control.simplifyBlocksWithoutDeclarations(...items)
    itemsNew.forEach((item: ControlItem) => {
      if (isEnvDependent(item)) {
        this.numEnvDependentItems++
      }
    })
    super.push(...itemsNew)
  }

  /**
   * Before pushing block statements on the control stack, we check if the block statement has any declarations.
   * If not, the block is converted to a StatementSequence.
   * @param items The items being pushed on the control.
   * @returns The same set of control items, but with block statements without declarations converted to StatementSequences.
   * NOTE: this function handles any case where StatementSequence has to be converted back into BlockStatement due to type issues
   */
  private static simplifyBlocksWithoutDeclarations(...items: ControlItem[]): ControlItem[] {
    const itemsNew: ControlItem[] = []
    items.forEach(item => {
      if (isNode(item) && isBlockStatement(item) && !hasDeclarations(item)) {
        // Push block body as statement sequence
        const seq: StatementSequence = statementSequence(item.body, item.loc)
        itemsNew.push(seq)
      } else {
        itemsNew.push(item)
      }
    })
    return itemsNew
  }

  public copy(): Control {
    const newControl = new Control()
    const stackCopy = super.getStack()
    newControl.push(...stackCopy)
    return newControl
  }
}
