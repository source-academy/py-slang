import { StmtNS } from '../../ast-types';
import { ASTNode, FeatureValidator, FeatureNotSupportedError } from '../types';

/**
 * Stateful validator that tracks declared names and throws if a name is assigned more than once.
 * Each call to create() returns a fresh validator instance for a single validation run.
 */
export function createNoReassignmentValidator(): FeatureValidator {
    const declared = new Set<string>();
    return {
        validate(node: ASTNode): void {
            if (node instanceof StmtNS.Assign) {
                const name = node.name.lexeme;
                if (declared.has(name)) {
                    throw new FeatureNotSupportedError(`reassignment of '${name}'`, node);
                }
                declared.add(name);
            }
        }
    };
}

/** Stateless singleton for convenience — only use if you know names won't repeat across calls. */
export const NoReassignmentValidator: FeatureValidator = createNoReassignmentValidator();
