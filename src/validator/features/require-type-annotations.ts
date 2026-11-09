import { StmtNS } from "../../ast-types";
import { ASTNode, FeatureValidator, MissingTypeAnnotationError } from "../types";

/**
 * Python §4 Typed: every `def` annotates each of its parameters and its return type. (The parameters
 * of a lambda cannot be annotated, as in Python; their types come from the context.)
 */
export const RequireTypeAnnotationsValidator: FeatureValidator = {
  validate(node: ASTNode): void {
    if (!(node instanceof StmtNS.FunctionDef)) return;
    const name = node.name.lexeme;
    for (const param of node.parameters) {
      if (!param.annotation) {
        throw new MissingTypeAnnotationError(
          `parameter '${param.lexeme}' of function '${name}' needs a type, as in '${param.lexeme}: int'`,
          param,
        );
      }
    }
    if (!node.returns) {
      throw new MissingTypeAnnotationError(
        `function '${name}' needs a return type, as in 'def ${name}(...) -> int:'`,
        node.name,
      );
    }
  },
};
