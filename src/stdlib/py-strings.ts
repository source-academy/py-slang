/**
 * Python's strings as CPython treats them, shared by the engines (py-slang#580). A JavaScript string
 * is a sequence of UTF-16 code units; Python's is a sequence of code points. The differences that
 * show: `<` compares code points (U+10000 is greater than U+FFFF, not less, as its surrogate pair
 * would make it), and `repr` escapes the characters that are not printable (`'\x85'`).
 */

/**
 * -1, 0 or 1 as `a` is less than, equal to or greater than `b` by code point, as in Python. A pair of
 * surrogates is one code point above U+FFFF; a surrogate on its own is the code point of that
 * value (below U+E000), as in a Python string such as `'\ud800'`.
 */
export function compareCodePoints(a: string, b: string): number {
  if (a === b) return 0;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const x = a.codePointAt(i) as number;
    const y = b.codePointAt(j) as number;
    if (x !== y) return x < y ? -1 : 1;
    i += x > 0xffff ? 2 : 1;
    j += y > 0xffff ? 2 : 1;
  }
  return i < a.length ? 1 : j < b.length ? -1 : 0;
}

/** The characters that Python's `repr` escapes: control, format, surrogate, private-use, unassigned,
 * and the separators other than the space. */
const NOT_PRINTABLE = /^[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}\p{Zs}]$/u;

function escapeCodePoint(code: number): string {
  if (code < 0x100) return `\\x${code.toString(16).padStart(2, "0")}`;
  if (code < 0x10000) return `\\u${code.toString(16).padStart(4, "0")}`;
  return `\\U${code.toString(16).padStart(8, "0")}`;
}

/** `repr` of a string: single quotes, unless the string has a single quote and no double quote. */
export function pythonStringRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = quote;
  for (const ch of s) {
    const code = ch.codePointAt(0) as number;
    if (ch === quote || ch === "\\") out += `\\${ch}`;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (code < 0x20 || code === 0x7f || (ch !== " " && NOT_PRINTABLE.test(ch))) {
      out += escapeCodePoint(code);
    } else out += ch;
  }
  return out + quote;
}
