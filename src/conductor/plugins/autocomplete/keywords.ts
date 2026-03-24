export const getKeywords = (variant: number): string[] => {
  let keywords = [
    "and",
    "def",
    "elif",
    "else",
    "from",
    "global",
    "if",
    "import",
    "lambda",
    "not",
    "or",
    "pass",
    "return",
    "nonlocal",
  ];

  if (variant >= 3) {
    keywords = keywords.concat(["while", "for", "break", "continue"]);
  }
  return keywords;
};

export const getIllegalKeywords = (variant: number): string[] => {
  let illegalKeywords = [
    "as",
    "assert",
    "class",
    "del",
    "except",
    "finally",
    "is",
    "match",
    "case",
    "raise",
    "try",
    "with",
    "yield",
    "async",
    "await",
  ];

  if (variant < 3) {
    illegalKeywords = illegalKeywords.concat(["while", "for", "break", "continue"]);
  }
  return illegalKeywords;
};
