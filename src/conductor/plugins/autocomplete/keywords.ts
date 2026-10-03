/** Sentinel variant for unrestricted "Python Full" (see PyodideEvaluatorFull)
 * — not a real chapter number, but a superset of every chapter, so every
 * `variant >= n` chapter-gate check in this file, resolver.ts, and
 * highlight-rules.ts naturally treats it as at least as capable as any
 * chapter. */
export const FULL_PYTHON_VARIANT = Infinity;

/** Keywords only meaningful once every chapter gate is off — real Python
 * keywords that no Source §x chapter grammar accepts (see the `forbidden_*`
 * tokens in lexer.ts), so they only belong in getKeywords/getIllegalKeywords
 * output for FULL_PYTHON_VARIANT. */
const fullOnlyKeywords = [
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

export const getKeywords = (variant: number): string[] => {
  let keywords = [
    "and",
    "as",
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

  if (variant === FULL_PYTHON_VARIANT) {
    keywords = keywords.concat(fullOnlyKeywords);
  }
  return keywords;
};

export const getIllegalKeywords = (variant: number): string[] => {
  // Python Full has no chapter feature gate (see PyodideEvaluatorFull) —
  // nothing is illegal.
  if (variant === FULL_PYTHON_VARIANT) return [];

  let illegalKeywords = [...fullOnlyKeywords];

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
