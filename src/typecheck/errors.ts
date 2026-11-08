import type { TypeDiagnostic } from "./diagnostics";

/**
 * A type error of a program, to be reported like any other error: the conductor's `EvaluatorError`
 * takes `name`, `message` and `line` and `col` from it (see src/conductor/errors.ts).
 */
export class StaticTypeError extends Error {
  readonly line: number;
  readonly col: number;
  readonly endLine: number;
  readonly endCol: number;

  constructor(diagnostic: TypeDiagnostic) {
    super(diagnostic.message);
    this.name = "StaticTypeError";
    this.line = diagnostic.line;
    this.col = diagnostic.column;
    this.endLine = diagnostic.endLine;
    this.endCol = diagnostic.endColumn;
  }

  /**
   * The message with its place in the program, as the errors of the CSE machine have it (it has no
   * other way to say where): the line, the text of the line with what is wrong marked, and the message.
   *
   *     StaticTypeError at line 2
   *
   *         x: int = "a"
   *                  ^~~
   *     Type "str" is not assignable to declared type "int"
   */
  describe(source: string): string {
    const text = source.split("\n")[this.line - 1] ?? "";
    const width = Math.max(1, (this.endLine === this.line ? this.endCol : text.length) - this.col);
    const marker = "^" + "~".repeat(width - 1);
    return `${this.name} at line ${this.line}\n\n    ${text}\n    ${" ".repeat(this.col)}${marker}\n${this.message}`;
  }
}

/** All the type errors of a program: it is not run, and each is reported. */
export class StaticTypeErrors extends Error {
  readonly errors: StaticTypeError[];

  constructor(diagnostics: TypeDiagnostic[]) {
    const errors = diagnostics.map(d => new StaticTypeError(d));
    super(errors.length === 1 ? errors[0].message : `${errors.length} type errors`);
    this.name = "StaticTypeErrors";
    this.errors = errors;
  }
}

/** The type checker could not be loaded or did not work: a program that is not checked is not run. */
export class TypeCheckerUnavailableError extends Error {
  constructor(cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(
      `The type checker could not be started (${reason}). Typed Python §4 does not run a program ` +
        `that has not been checked: try again.`,
    );
    this.name = "TypeCheckerUnavailableError";
  }
}
