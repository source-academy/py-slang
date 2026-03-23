import PythonHighlightRules from "./highlight-rules";
export default {
  highlightRules: PythonHighlightRules(1),
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
  id: "ace/mode/pythonBetaDefault",
  snippetFileId: "ace/snippets/pythonBetaDefault",
};
