import { ExprNS, StmtNS } from "../../ast-types";
import { ResolverErrors } from "../../resolver/errors";
import { Environment } from "../../resolver/resolver";
import { ASTNode, FeatureValidator } from "../types";

const RANGE = "range";

/**
 * Rejects every use of the name `range` except as the callee of a for-loop header
 * (`for i in range(n):`).
 *
 * `range` is not a first-class function in these languages: the loop header is the only place it
 * means anything, and every engine hard-wires it there. But the resolver predeclares the name, so
 * without this check `x = range(3)`, `f = range` or `print(range(3))` pass validation and then fail
 * (or, on PVML, quietly work and produce an iterator value no other engine has) at run time, in a
 * different way per engine.
 *
 * Where there are no for loops (chapters 1 and 2) any use of `range` is just an unknown name, so
 * `forLoopsExist: false` reports the same NameNotFoundError the resolver gives any other undefined
 * name.
 *
 * The resolver validates a `for` statement before it resolves the header expression inside it, so by
 * the time it reaches the header's `range` callee, that callee is already in `headerCallees`.
 */
export function createRangeOnlyInForHeaderValidator(forLoopsExist: boolean): FeatureValidator {
  const headerCallees = new WeakSet<ExprNS.Expr>();

  return {
    validate(node: ASTNode, env?: Environment): void {
      if (node instanceof StmtNS.For) {
        const iter = node.iter;
        if (
          iter instanceof ExprNS.Call &&
          iter.callee instanceof ExprNS.Variable &&
          iter.callee.name.lexeme === RANGE
        ) {
          headerCallees.add(iter.callee);
        }
        return;
      }
      if (!(node instanceof ExprNS.Variable)) return;
      if (node.name.lexeme !== RANGE || headerCallees.has(node)) return;
      if (!env) return;

      const token = node.name;
      const end = token.indexInSource + RANGE.length;
      throw forLoopsExist
        ? new ResolverErrors.RangeOutsideForHeaderError(
            token.line,
            token.col,
            env.source,
            token.indexInSource,
            end,
          )
        : new ResolverErrors.NameNotFoundError(
            token.line,
            token.col,
            env.source,
            token.indexInSource,
            end,
            null,
          );
    },
  };
}
