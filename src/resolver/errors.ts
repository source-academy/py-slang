import { getFullLine } from "../errors";

/**
 * The source line containing `start`, and a caret line under the span [start, current) followed
 * by `message`. The caret column is computed from the source offsets rather than from
 * `Token.col`: `col` is the token's *end* column counted from 1 (not the 0-based start its
 * docstring claims), so using it as a start column put every caret one column too far right
 * (py-slang#475).
 */
function underline(
  source: string,
  start: number,
  current: number,
  message: string,
): { lineIndex: number; fullLine: string; indent: number; hint: string } {
  const { lineIndex, fullLine, lineStart } = getFullLine(source, start);
  const indent = start - lineStart;
  const hint = " ".repeat(indent) + "^".repeat(current - start) + ` ${message}`;
  return { lineIndex, fullLine, indent: indent + (current - start), hint };
}

export namespace ResolverErrors {
  export class BaseResolverError extends SyntaxError {
    line: number;
    col: number;

    constructor(name: string, message: string, line: number, col: number) {
      super(`${name} at line ${line}
                   ${message}`);
      this.line = line;
      this.col = col;
      this.name = "BaseResolverError";
    }
  }
  export class NameNotFoundError extends BaseResolverError {
    constructor(
      line: number,
      col: number,
      source: string,
      start: number,
      current: number,
      suggestion: string | null,
    ) {
      const underlined = underline(
        source,
        start,
        current,
        "This name is not found in the current or enclosing environment(s).",
      );
      const { lineIndex, fullLine } = underlined;
      let hint = underlined.hint;
      if (suggestion !== null) {
        // Aligned with the message text, one space after the carets.
        hint +=
          "\n" + " ".repeat(underlined.indent) + ` Perhaps you meant to type '${suggestion}'?`;
      }
      const name = "NameNotFoundError";
      super(name, "\n" + fullLine + "\n" + hint, lineIndex, col);
      this.name = "NameNotFoundError";
    }
  }

  export class NameReassignmentError extends BaseResolverError {
    constructor(line: number, col: number, source: string, start: number, current: number) {
      const { lineIndex, fullLine, hint } = underline(
        source,
        start,
        current,
        "A name has been reassigned here.",
      );
      const name = "NameReassignmentError";
      super(name, "\n" + fullLine + "\n" + hint, lineIndex, col);
      this.name = "NameReassignmentError";
    }
  }

  export class ReservedNameError extends BaseResolverError {
    constructor(
      name: string,
      line: number,
      col: number,
      source: string,
      start: number,
      current: number,
    ) {
      const { lineIndex, fullLine } = getFullLine(source, start);
      let hint = ` '${name}' is reserved and cannot be redefined.`;
      const diff = current - start;
      hint = hint.padStart(hint.length + diff - MAGIC_OFFSET + 1, "^");
      hint = hint.padStart(hint.length + col - diff, " ");
      const errorName = "SyntaxError";
      super(errorName, "\n" + fullLine + "\n" + hint, lineIndex, col);
      this.name = errorName;
    }
  }

  export class ScopeConflictError extends BaseResolverError {
    constructor(
      line: number,
      col: number,
      source: string,
      start: number,
      current: number,
      message: string,
    ) {
      const { lineIndex, fullLine, hint } = underline(source, start, current, message);
      const name = "SyntaxError";
      super(name, "\n" + fullLine + "\n" + hint, lineIndex, col);
      this.name = name;
    }
  }
}
