import { SyntaxHighlightData } from "@sourceacademy/autocomplete";
import PythonHighlightRules from "./highlight-rules";
export default (variant: number, evaluatorName: string): SyntaxHighlightData => ({
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
  id: `ace/mode/${evaluatorName}`,
  snippetFileId: `ace/snippets/${evaluatorName}`,
});
