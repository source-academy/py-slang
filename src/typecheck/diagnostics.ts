import type { LspDiagnostic } from "./client";
import { studentMessage } from "./messages";

export type Severity = "error" | "warning" | "information" | "hint";

/** A problem that the type checker found in a program. */
export interface TypeDiagnostic {
  severity: Severity;
  /** The message for the student (see messages.ts). */
  message: string;
  /** Pyright's own message. */
  original: string;
  /** Where it starts: the line counts from 1, as in every error of py-slang, the column from 0. */
  line: number;
  column: number;
  /** Where it ends (exclusive). */
  endLine: number;
  endColumn: number;
  /** The pyright rule that reports it, such as `reportArgumentType`, if there is one. */
  rule?: string;
}

const SEVERITIES: Severity[] = ["error", "warning", "information", "hint"];

/**
 * A diagnostic of the language server as a {@link TypeDiagnostic}. `lineOffset` is the number of
 * lines that the checker put before the program (the imports of a REPL chunk).
 */
export function toTypeDiagnostic(diagnostic: LspDiagnostic, lineOffset = 0): TypeDiagnostic {
  const { start, end } = diagnostic.range;
  return {
    severity: SEVERITIES[(diagnostic.severity ?? 1) - 1],
    message: studentMessage(diagnostic.message),
    original: diagnostic.message,
    line: Math.max(1, start.line - lineOffset + 1),
    column: start.character,
    endLine: Math.max(1, end.line - lineOffset + 1),
    endColumn: end.character,
    ...(typeof diagnostic.code === "string" ? { rule: diagnostic.code } : {}),
  };
}

const UNKNOWN = /^reportUnknown/;

/**
 * Leaves out what follows from another mistake. A mistake in an expression gives it an unknown type,
 * which the rules about unknown types report as well (`y = 1 + "a"` makes `y` unknown): on a line
 * with another error, those are not shown. The rest is in the order of the program.
 */
export function tidy(diagnostics: TypeDiagnostic[]): TypeDiagnostic[] {
  const mistakes = new Set(
    diagnostics.filter(d => d.severity === "error" && !UNKNOWN.test(d.rule ?? "")).map(d => d.line),
  );
  return diagnostics
    .filter(d => !(UNKNOWN.test(d.rule ?? "") && mistakes.has(d.line)))
    .sort((a, b) => a.line - b.line || a.column - b.column);
}
