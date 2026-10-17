import { StmtNS } from "../../ast-types";
import { ASTNode, FeatureValidator, FeatureNotSupportedError } from "../types";

/** The statements that only full Python has: no sublanguage (§1–§4) allows them. */
export const NoFullPythonStatementsValidator: FeatureValidator = {
  validate(node: ASTNode): void {
    const feature = featureOf(node);
    if (feature) throw new FeatureNotSupportedError(feature, node);
  },
};

function featureOf(node: ASTNode): string | undefined {
  if (node instanceof StmtNS.Class) return "classes";
  if (node instanceof StmtNS.Decorated) return "decorators";
  if (node instanceof StmtNS.Try) return "exceptions (try/except/finally)";
  if (node instanceof StmtNS.Raise) return "exceptions (raise)";
  if (node instanceof StmtNS.With) return "with statements";
  if (node instanceof StmtNS.Del) return "del statements";
  if (node instanceof StmtNS.Import) return "import statements (use from ... import ...)";
  if (node instanceof StmtNS.Assert && node.message) return "assertion messages";
  return undefined;
}
