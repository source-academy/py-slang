import type * as es from 'estree';
import { Stack } from './stack';
import { Node, StatementSequence, Instr } from './types';
export type ControlItem = (Node | Instr) & {
    isEnvDependent?: boolean;
    skipEnv?: boolean;
};
export declare class Control extends Stack<ControlItem> {
    private numEnvDependentItems;
    constructor(program?: es.Program | StatementSequence);
    canAvoidEnvInstr(): boolean;
    getNumEnvDependentItems(): number;
    pop(): ControlItem | undefined;
    push(...items: ControlItem[]): void;
    /**
     * Before pushing block statements on the control stack, we check if the block statement has any declarations.
     * If not, the block is converted to a StatementSequence.
     * @param items The items being pushed on the control.
     * @returns The same set of control items, but with block statements without declarations converted to StatementSequences.
     * NOTE: this function handles any case where StatementSequence has to be converted back into BlockStatement due to type issues
     */
    private static simplifyBlocksWithoutDeclarations;
    copy(): Control;
}
