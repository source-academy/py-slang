import { SyntaxHighlightData } from "@sourceacademy/autocomplete";
import PythonHighlightRules from "./highlight-rules";
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
  id: "ace/mode/python" + variant,
  snippetFileId: "ace/snippets/python" + variant,
});
