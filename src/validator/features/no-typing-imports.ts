import { StmtNS } from "../../ast-types";
import { ASTNode, FeatureNotSupportedError, FeatureValidator } from "../types";

/** The modules of Python's standard library that have the names of types. */
const TYPING_MODULES = new Set(["typing", "typing_extensions", "collections.abc"]);

/**
 * Typed Python §4: types need no import. `Callable`, `Pair`, `LList` and `Stream` are predeclared,
 * and there is no `Any` (the specification, "Static Type Checking"). So `from typing import …` is
 * rejected with that said, and not with a missing module at run time. (A local file with that name,
 * `from .typing import x`, is not meant.)
 */
export const NoTypingImportsValidator: FeatureValidator = {
  validate(node: ASTNode): void {
    if (
      node instanceof StmtNS.FromImport &&
      node.level === 0 &&
      TYPING_MODULES.has(node.module.lexeme)
    ) {
      throw new FeatureNotSupportedError(
        `imports of types from ${node.module.lexeme} (Callable, Pair, LList and Stream are predeclared, and there is no Any)`,
        node,
      );
    }
  },
};
