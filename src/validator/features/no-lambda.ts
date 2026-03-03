import { ExprNS } from '../../ast-types';
import { ASTNode, FeatureValidator, FeatureNotSupportedError } from '../types';

export const NoLambdaValidator: FeatureValidator = {
    validate(node: ASTNode): void {
        if (node instanceof ExprNS.Lambda) {
            throw new FeatureNotSupportedError('lambda expressions', node);
        }
        if (node instanceof ExprNS.MultiLambda) {
            throw new FeatureNotSupportedError('multi-line lambda expressions', node);
        }
    }
};
