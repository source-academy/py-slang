import { Stack } from './stack';
import { Instr, Node } from './types';
import { isEnvDependent } from './utils';
import { StmtNS } from '../ast-types';

export type ControlItem = (Node | Instr) & {
  isEnvDependent?: boolean;
  skipEnv?: boolean;
};

export class Control extends Stack<ControlItem> {
  private numEnvDependentItems: number;
  public constructor(program?: StmtNS.Stmt) {
    super();
    this.numEnvDependentItems = 0;
    // Load program into control stack
    if (program) this.push(program);
  }

  public canAvoidEnvInstr(): boolean {
    return this.numEnvDependentItems === 0;
  }

  // For testing purposes
  public getNumEnvDependentItems(): number {
    return this.numEnvDependentItems;
  }

  public pop(): ControlItem | undefined {
    const item = super.pop();
    if (item !== undefined && isEnvDependent(item)) {
      this.numEnvDependentItems--;
    }
    return item;
  }

  public push(...items: ControlItem[]): void {
    items.forEach((item: ControlItem) => {
      if (isEnvDependent(item)) {
        this.numEnvDependentItems++;
      }
    });
    super.push(...items);
  }

  public copy(): Control {
    const newControl = new Control();
    const stackCopy = super.getStack();
    newControl.push(...stackCopy);
    return newControl;
  }
}
