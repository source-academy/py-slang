import { StmtNS } from "../../ast-types";
import { Stack } from "./stack";
import { Instr, InstrType, Node } from "./types";
import { isEnvDependent, isInstr } from "./utils";

export type ControlItem = Node | Instr;

/**
 * The control stores the remaining instructions to be executed
 */
export class Control extends Stack<ControlItem> {
  private numEnvDependentItems: number;
  private numFunctionResets: number = 0;
  public constructor(program?: StmtNS.Stmt) {
    super();
    this.numEnvDependentItems = 0;
    this.numFunctionResets = 0;
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

  public getNumFunctionResets(): number {
    return this.numFunctionResets;
  }

  public pop(): ControlItem | undefined {
    const item = super.pop();
    if (item !== undefined && isEnvDependent(item)) {
      this.numEnvDependentItems--;
    }
    if (item !== undefined && isInstr(item) && item.instrType === InstrType.RESET) {
      this.numFunctionResets--;
    }
    return item;
  }

  public push(...items: ControlItem[]): void {
    items.forEach((item: ControlItem) => {
      if (isEnvDependent(item)) {
        this.numEnvDependentItems++;
      }
      if (isInstr(item) && item.instrType === InstrType.RESET) {
        this.numFunctionResets++;
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
