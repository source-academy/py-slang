export const getKeywords = (variant: number): string[] => {
  let keywords = [
    "and",
    "def",
    "elif",
    "else",
    "from",
    "if",
    "import",
    "lambda",
    "not",
    "or",
    "return",
  ];

  if (variant >= 3) {
    keywords = keywords.concat([
      "while",
      "for",
      "in",
      "break",
      "continue",
      "is",
      "global",
      "nonlocal",
      "pass",
    ]);
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
    illegalKeywords = illegalKeywords.concat([
      "while",
      "for",
      "break",
      "continue",
      "in",
      "is",
      "global",
      "nonlocal",
      "pass",
    ]);
  }
  return illegalKeywords;
};
