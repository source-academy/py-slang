import { ExprNS, StmtNS } from "../../ast-types";
import { ResolverErrors } from "../../resolver/errors";
import { Environment } from "../../resolver/resolver";
import { Token } from "../../tokenizer";
import { ASTNode, FeatureValidator } from "../types";

const RESERVED_NAME = "range";

/**
 * Rejects every way of binding the name `range`: assignment, `def`, parameters (including rest
 * parameters and lambda parameters), a `for` target, and `from X import range [as ...]`.
 *
 * `range` is not an ordinary name in chapters 3 and 4: `for x in range(...)` is hard-wired in the
 * grammar and in every engine (see ForRangeOnlyValidator), so a user binding of the same name
 * would only affect ordinary calls like `range(3)`, never the loop header — the name would mean two
 * different things within one program. Reserving it makes that impossible. It is only registered
 * for the chapters that have `for` loops (see `sublanguages.ts`); in chapters 1-2 `range` does not
 * exist at all.
 *
 * Needs the Resolver's environment only for its `source` text, used to render the error.
 */
export const NoRangeRedeclarationValidator: FeatureValidator = {
  validate(node: ASTNode, env?: Environment): void {
    if (!env) return;

    const check = (token: Token): void => {
      if (token.lexeme !== RESERVED_NAME) return;
      throw new ResolverErrors.ReservedNameError(
        RESERVED_NAME,
        token.line,
        token.col,
        env.source,
        token.indexInSource,
        token.indexInSource + RESERVED_NAME.length,
      );
    };

    if (node instanceof StmtNS.Assign) {
      if (node.target instanceof ExprNS.Variable) check(node.target.name);
    } else if (node instanceof StmtNS.AnnAssign) {
      check(node.target.name);
    } else if (node instanceof StmtNS.FunctionDef) {
      check(node.name);
      node.parameters.forEach(check);
    } else if (node instanceof ExprNS.Lambda || node instanceof ExprNS.MultiLambda) {
      node.parameters.forEach(check);
    } else if (node instanceof StmtNS.For) {
      check(node.target);
    } else if (node instanceof StmtNS.FromImport) {
      for (const spec of node.names) check(spec.alias ?? spec.name);
    }
  },
};
