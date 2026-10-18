/**
 * Python's strings as CPython treats them, shared by the engines (py-slang#580). A JavaScript string
 * is a sequence of UTF-16 code units; Python's is a sequence of code points. The differences that
 * show: `<` compares code points (U+10000 is greater than U+FFFF, not less, as its surrogate pair
 * would make it), and `repr` escapes the characters that are not printable (`'\x85'`).
 */

/**
 * The first code unit that differs decides, after moving the surrogates (U+D800–U+DFFF, which make up
 * the code points above U+FFFF) above U+E000–U+FFFF, where they belong by code point.
 */
const byCodePoint = (unit: number): number =>
  unit >= 0xe000 ? unit - 0x800 : unit >= 0xd800 ? unit + 0x2000 : unit;

/** -1, 0 or 1 as `a` is less than, equal to or greater than `b` by code point, as in Python. */
export function compareCodePoints(a: string, b: string): number {
  if (a === b) return 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a.charCodeAt(i);
    const y = b.charCodeAt(i);
    if (x !== y) return byCodePoint(x) < byCodePoint(y) ? -1 : 1;
  }
  return a.length < b.length ? -1 : 1;
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
