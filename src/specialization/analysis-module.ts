import type { AbstractValue } from "../types/abstract-value";
import type { ExprNS, StmtNS } from "../ast-types";
import type { SlotLookup } from "./types";

export type PyASTNode = ExprNS.Expr | StmtNS.Stmt;

export interface OptimizationHint {
  type?: AbstractValue;
  // future dimensions: constVal, purity, escape, liveness
}

export type HintTable = WeakMap<PyASTNode, OptimizationHint>;

export interface AnalysisModule<L> {
  readonly name: string;
  top(): L;
  bottom(): L;
  join(a: L, b: L): L;
  meet(a: L, b: L): L;
  leq(a: L, b: L): boolean;
  readonly mergeKind: "may" | "must";
  readonly direction: "forward" | "backward";
  readonly field: keyof OptimizationHint;

  /**
   * Create the expression-level visitor for this analysis.
   * The DFA driver calls this per expression sub-tree; the returned visitor
   * reads from `env` and writes computed facts to `hints`.
   */
  makeExprVisitor(
    hints: HintTable,
    env: readonly (L | undefined)[],
    slotLookup: SlotLookup,
  ): ExprNS.Visitor<L>;
}
