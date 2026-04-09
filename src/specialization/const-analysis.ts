import { ExprNS } from "../ast-types";
import { TokenType } from "../tokens";
import type { AnalysisModule, HintTable, ConstLattice, OptimizationHint } from "./analysis-module";
import { CONST_BOTTOM, CONST_TOP, constOf } from "./analysis-module";
import type { SlotLookup } from "./types";

// ── Lattice operations ────────────────────────────────────────────────────────

export function constLeq(a: ConstLattice, b: ConstLattice): boolean {
  if (a.tag === "bottom") return true;
  if (b.tag === "top") return true;
  if (a.tag === "top") return false;   // top ≤ b only if b === top (handled above)
  if (b.tag === "bottom") return false;
  return a.value === b.value;           // const(v) ≤ const(w) iff v === w
}

export function constJoin(a: ConstLattice, b: ConstLattice): ConstLattice {
  if (a.tag === "bottom") return b;
  if (b.tag === "bottom") return a;
  if (a.tag === "top" || b.tag === "top") return CONST_TOP;
  return a.value === b.value ? a : CONST_TOP;
}

export function constMeet(a: ConstLattice, b: ConstLattice): ConstLattice {
  if (a.tag === "top") return b;
  if (b.tag === "top") return a;
  if (a.tag === "bottom" || b.tag === "bottom") return CONST_BOTTOM;
  return a.value === b.value ? a : CONST_BOTTOM;
}

// ── Expression-level visitor ──────────────────────────────────────────────────

class ConstAnalysisVisitor implements ExprNS.Visitor<ConstLattice> {
  constructor(
    private readonly hints: HintTable,
    private readonly constEnv: readonly (ConstLattice | undefined)[],
    private readonly slotLookup: SlotLookup,
  ) {}

  private annotate(node: ExprNS.Expr, val: ConstLattice): ConstLattice {
    const existing = this.hints.get(node);
    this.hints.set(node, { ...existing, constVal: val });
    return val;
  }

  visitLiteralExpr(expr: ExprNS.Literal): ConstLattice {
    const v = expr.value;
    if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") {
      return this.annotate(expr, constOf(v));
    }
    return this.annotate(expr, CONST_TOP);
  }

  visitBigIntLiteralExpr(expr: ExprNS.BigIntLiteral): ConstLattice {
    return this.annotate(expr, constOf(Number(expr.value)));
  }

  visitVariableExpr(expr: ExprNS.Variable): ConstLattice {
    const info = this.slotLookup(expr.name);
    if (info.isPrimitive || info.envLevel !== 0) return this.annotate(expr, CONST_TOP);
    return this.annotate(expr, this.constEnv[info.slot] ?? CONST_TOP);
  }

  visitBinaryExpr(expr: ExprNS.Binary): ConstLattice {
    const left  = expr.left.accept(this);
    const right = expr.right.accept(this);

    if (left.tag !== "const" || right.tag !== "const") {
      return this.annotate(expr, CONST_TOP);
    }

    const lv = left.value;
    const rv = right.value;

    if (typeof lv === "number" && typeof rv === "number") {
      switch (expr.operator.type) {
        case TokenType.PLUS:
          return this.annotate(expr, constOf(lv + rv));
        case TokenType.MINUS:
          return this.annotate(expr, constOf(lv - rv));
        case TokenType.STAR:
          return this.annotate(expr, constOf(lv * rv));
        case TokenType.SLASH:
          if (rv === 0) return this.annotate(expr, CONST_TOP);
          return this.annotate(expr, constOf(lv / rv));
        case TokenType.DOUBLESLASH:
          if (rv === 0) return this.annotate(expr, CONST_TOP);
          return this.annotate(expr, constOf(Math.floor(lv / rv)));
        case TokenType.PERCENT: {
          if (rv === 0) return this.annotate(expr, CONST_TOP);
          // Python modulo: result has same sign as divisor
          return this.annotate(expr, constOf(lv - Math.floor(lv / rv) * rv));
        }
      }
    }

    if (
      typeof lv === "string" && typeof rv === "string" &&
      expr.operator.type === TokenType.PLUS
    ) {
      return this.annotate(expr, constOf(lv + rv));
    }

    return this.annotate(expr, CONST_TOP);
  }

  visitCompareExpr(expr: ExprNS.Compare): ConstLattice {
    const left  = expr.left.accept(this);
    const right = expr.right.accept(this);

    if (left.tag !== "const" || right.tag !== "const") {
      return this.annotate(expr, CONST_TOP);
    }

    const lv = left.value;
    const rv = right.value;

    switch (expr.operator.type) {
      case TokenType.LESS:          return this.annotate(expr, constOf(lv <  rv));
      case TokenType.GREATER:       return this.annotate(expr, constOf(lv >  rv));
      case TokenType.LESSEQUAL:     return this.annotate(expr, constOf(lv <= rv));
      case TokenType.GREATEREQUAL:  return this.annotate(expr, constOf(lv >= rv));
      case TokenType.DOUBLEEQUAL:   return this.annotate(expr, constOf(lv === rv));
      case TokenType.NOTEQUAL:      return this.annotate(expr, constOf(lv !== rv));
      default:                      return this.annotate(expr, CONST_TOP);
    }
  }

  visitUnaryExpr(expr: ExprNS.Unary): ConstLattice {
    const operand = expr.right.accept(this);
    if (operand.tag !== "const") return this.annotate(expr, CONST_TOP);
    const v = operand.value;
    switch (expr.operator.type) {
      case TokenType.MINUS:
        if (typeof v === "number") return this.annotate(expr, constOf(-v));
        break;
      case TokenType.PLUS:
        if (typeof v === "number") return this.annotate(expr, constOf(+v));
        break;
      case TokenType.NOT:
        return this.annotate(expr, constOf(!v));
    }
    return this.annotate(expr, CONST_TOP);
  }

  visitBoolOpExpr(expr: ExprNS.BoolOp): ConstLattice {
    const left = expr.left.accept(this);
    // Evaluate right regardless to annotate its sub-expressions
    const right = expr.right.accept(this);
    if (left.tag !== "const") return this.annotate(expr, CONST_TOP);
    if (expr.operator.type === TokenType.AND) {
      return this.annotate(expr, left.value ? right : left);
    }
    if (expr.operator.type === TokenType.OR) {
      return this.annotate(expr, left.value ? left : right);
    }
    return this.annotate(expr, CONST_TOP);
  }

  visitGroupingExpr(expr: ExprNS.Grouping): ConstLattice {
    return expr.expression.accept(this);
  }

  visitTernaryExpr(expr: ExprNS.Ternary): ConstLattice {
    expr.predicate.accept(this);
    expr.consequent.accept(this);
    expr.alternative.accept(this);
    return this.annotate(expr, CONST_TOP);
  }

  visitCallExpr(expr: ExprNS.Call): ConstLattice {
    expr.callee.accept(this);
    for (const arg of expr.args) arg.accept(this);
    return this.annotate(expr, CONST_TOP);
  }

  visitListExpr(expr: ExprNS.List): ConstLattice {
    for (const el of expr.elements) el.accept(this);
    return this.annotate(expr, CONST_TOP);
  }

  visitSubscriptExpr(expr: ExprNS.Subscript): ConstLattice {
    expr.value.accept(this);
    expr.index.accept(this);
    return this.annotate(expr, CONST_TOP);
  }

  visitStarredExpr(expr: ExprNS.Starred): ConstLattice {
    expr.value.accept(this);
    return this.annotate(expr, CONST_TOP);
  }

  visitNoneExpr(expr: ExprNS.None): ConstLattice {
    return this.annotate(expr, CONST_TOP);
  }

  visitComplexExpr(expr: ExprNS.Complex): ConstLattice {
    return this.annotate(expr, CONST_TOP);
  }

  visitLambdaExpr(expr: ExprNS.Lambda): ConstLattice {
    return this.annotate(expr, CONST_TOP);
  }

  visitMultiLambdaExpr(expr: ExprNS.MultiLambda): ConstLattice {
    return this.annotate(expr, CONST_TOP);
  }
}

// ── AnalysisModule ────────────────────────────────────────────────────────────

/**
 * Constant-propagation AnalysisModule.
 *
 * Tracks whether each expression evaluates to a statically known constant.
 * mergeKind = "may" (join at control-flow merge points) so the existing
 * DFAStatementDriver runs it correctly without modification.
 */
export class ConstAnalysisModule implements AnalysisModule<ConstLattice> {
  readonly name      = "const";
  readonly mergeKind = "may"     as const;
  readonly direction = "forward" as const;
  readonly field     = "constVal" as const satisfies keyof OptimizationHint;

  top():    ConstLattice { return CONST_TOP; }
  bottom(): ConstLattice { return CONST_BOTTOM; }
  join(a: ConstLattice, b: ConstLattice): ConstLattice { return constJoin(a, b); }
  meet(a: ConstLattice, b: ConstLattice): ConstLattice { return constMeet(a, b); }
  leq(a: ConstLattice,  b: ConstLattice): boolean      { return constLeq(a, b); }

  makeExprVisitor(
    hints: HintTable,
    env: readonly (ConstLattice | undefined)[],
    slotLookup: SlotLookup,
  ): ExprNS.Visitor<ConstLattice> {
    return new ConstAnalysisVisitor(hints, env, slotLookup);
  }
}
