import type { SyntaxHighlightData } from "@sourceacademy/common-autocomplete";
import PythonHighlightRules from "./highlight-rules";
import { FULL_PYTHON_VARIANT } from "./keywords";
export default (variant: number): SyntaxHighlightData => ({
  highlightRules: PythonHighlightRules(variant),
  foldingRules: {
    hookFrom: "ace/mode/folding/pythonic",
    args: ["\\:"],
  },
  lineCommentStart: "#",
  pairQuotesAfter: {
    "'": /[ruf]/i,
    '"': /[ruf]/i,
  },
  indents: {
    hookFrom: "ace/mode/python",
  },
  outdents: {
    hookFrom: "ace/mode/python",
  },
  autoOutdent: {
    hookFrom: "ace/mode/python",
  },
  id: `ace/mode/python${variant === FULL_PYTHON_VARIANT ? "full" : variant}`,
  snippetFileId: "ace/snippets/python",
});
