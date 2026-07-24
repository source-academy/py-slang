import { ConductorError } from "@sourceacademy/conductor/common";
import { Identifier } from "@sourceacademy/conductor/types";
import { ExprNS } from "../ast-types";
import { createErrorIndicator, getFullLine, RuntimeSourceError } from "../errors";

/**
 * Wraps any caught value as a ConductorError suitable for conductor.sendError().
 * Preserves name, message, and source-location when available.
 */
export class EvaluatorError extends ConductorError {
  line?: number;
  column?: number;

  constructor(e: unknown) {
    super(e instanceof Error ? e.message : String(e));
    this.name = e instanceof Error ? e.name : "Error";
    const se = e as { location?: { start?: { line: number; column: number } } };
    if (se.location?.start) {
      this.line = se.location.start.line;
      this.column = se.location.start.column;
    }
  }
}

export abstract class ModuleInterfaceError extends RuntimeSourceError {
  /**
   * Stores the module which called the interface error. This is used to provide more context in the error message.
   * If the module name is not available (called by the evaluator), it will be undefined.
   */
  public readonly moduleName: string | undefined;

  /**
   * Indicates whether the error message is user-friendly. If true, it will be displayed to the user.
   * If false, it will prompt the user to report the error to the developers.
   */
  public readonly expectedBehavior: boolean;

  constructor(
    node: ExprNS.Call | undefined,
    source: string | undefined,
    moduleName: string | undefined,
    message: string,
    expectedBehavior: boolean,
  ) {
    super(node);
    this.moduleName = moduleName;
    this.expectedBehavior = expectedBehavior;
    const hint =
      `${this.constructor.name}: ${message}` +
      (this.moduleName ? `Called from ${this.moduleName}` : "") +
      (this.expectedBehavior
        ? ""
        : "Please report this error (along with the code sample) on EdStem");
    if (!node || !source) {
      this.message = hint;
      return;
    }
    const index = node.startToken.indexInSource;
    const { lineIndex, fullLine } = getFullLine(source, index);
    const snippet = source.substring(
      node.startToken.indexInSource,
      node.endToken.indexInSource + node.endToken.lexeme.length,
    );
    const offset = fullLine.indexOf(snippet);
    const adjustedOffset = offset >= 0 ? offset : 0;
    const errorPos = node.endToken.indexInSource - node.startToken.indexInSource;
    const indicator = createErrorIndicator(snippet, errorPos);

    this.message =
      this.constructor.name +
      " at line " +
      lineIndex +
      "\n\n    " +
      fullLine +
      "\n    " +
      " ".repeat(adjustedOffset) +
      indicator +
      "\n" +
      hint;
  }
}

export class InvalidIdentifierError extends ModuleInterfaceError {
  constructor(
    node: ExprNS.Call | undefined,
    source: string | undefined,
    moduleName: string | undefined,
    public readonly identifier: Identifier,
    public readonly identifierType: "array" | "pair" | "closure" | "opaque",
  ) {
    super(node, source, moduleName, `Invalid ${identifierType} identifier: ${identifier}`, false);
  }
}

export class InvalidTypeError extends ModuleInterfaceError {
  constructor(
    node: ExprNS.Call | undefined,
    source: string | undefined,
    moduleName: string | undefined,
    public readonly noun: string,
    public readonly expected: string,
    public readonly actual: string,
  ) {
    super(node, source, moduleName, `Expected ${noun} type of ${expected}, got ${actual}`, true);
  }
}

export class InvalidLengthError extends ModuleInterfaceError {
  constructor(
    node: ExprNS.Call | undefined,
    source: string | undefined,
    moduleName: string | undefined,
    public readonly noun: string,
    public readonly expected: number,
    public readonly actual: number,
  ) {
    super(node, source, moduleName, `Expected ${noun} length of ${expected}, got ${actual}`, true);
  }
}

export class InvalidArityError extends ModuleInterfaceError {
  constructor(
    node: ExprNS.Call | undefined,
    source: string | undefined,
    moduleName: string | undefined,
    public readonly expected: number,
    public readonly actual: number,
  ) {
    super(node, source, moduleName, `Expected ${expected} arguments, got ${actual}`, true);
  }
}

export class InvalidOpaqueUpdateError extends ModuleInterfaceError {
  constructor(
    node: ExprNS.Call | undefined,
    source: string | undefined,
    moduleName: string | undefined,
    public readonly identifier: Identifier,
  ) {
    super(node, source, moduleName, `Immutable opaque value: ${identifier}`, false);
  }
}

export class InvalidArrayCreationError extends ModuleInterfaceError {
  constructor(
    node: ExprNS.Call | undefined,
    source: string | undefined,
    moduleName: string | undefined,
    type: string,
  ) {
    super(node, source, moduleName, `Cannot create an array of ${type} without specifying a default value`, false);
  }
}
