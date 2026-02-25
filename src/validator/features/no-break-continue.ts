import { StmtNS } from '../../ast-types';
import { ASTNode, FeatureValidator, FeatureNotSupportedError } from '../types';

export const NoBreakContinueValidator: FeatureValidator = {
    validate(node: ASTNode): void {
        if (node instanceof StmtNS.Break) {
            throw new FeatureNotSupportedError('break statements', node);
        }
        if (node instanceof StmtNS.Continue) {
            throw new FeatureNotSupportedError('continue statements', node);
        }
    }
};
