import { ExprNS } from "../ast-types";
import { TokenType } from "../tokens";
import type { AbstractValue } from "../types/abstract-value";
import { BOOL_BIT, BoolRef, STR_BIT } from "../types/abstract-value";
import {
  boolean as booleanValue,
  closureValue,
  complexValue,
  falseValue,
  floatValue,
  join,
  meet,
  leq,
  negativeFloat,
  negativeInteger,
  nullValue,
  positiveFloat,
  positiveInteger,
  stringValue,
  TOP,
  BOTTOM,
  trueValue,
  zeroFloat,
  zeroInteger,
} from "../types/lattice-ops";
import { transferBinaryOp, transferCompare, transferNot, transferUnaryNeg } from "./transfer";
import type { AnalysisModule, HintTable, OptimizationHint } from "./analysis-module";
import type { SlotLookup } from "./types";

/**
 * Maps Python binary operator token types to the string expected by transfer functions.
 */
const BINARY_OP_MAP: ReadonlyMap<TokenType, string> = new Map([
  [TokenType.PLUS, "+"],
  [TokenType.MINUS, "-"],
  [TokenType.STAR, "*"],
  [TokenType.SLASH, "/"],
  [TokenType.DOUBLESLASH, "//"],
  [TokenType.PERCENT, "%"],
]);

const COMPARE_OP_MAP: ReadonlyMap<TokenType, string> = new Map([
  [TokenType.LESS, "<"],
  [TokenType.GREATER, ">"],
  [TokenType.LESSEQUAL, "<="],
  [TokenType.GREATEREQUAL, ">="],
  [TokenType.DOUBLEEQUAL, "=="],
  [TokenType.NOTEQUAL, "!="],
]);

/**
 * Implements ExprNS.Visitor<AbstractValue>, replacing the hand-threaded switch-dispatch
 * in the legacy ASTSpecializationVisitor. TypeScript enforces exhaustiveness: every
 * expression node type must have a corresponding visitXxx method. Missing a node type
 * is a compile error, unlike the switch on expr.kind which is unchecked.
 */
export class TypeAnalysisVisitor implements ExprNS.Visitor<AbstractValue> {
  constructor(
    private readonly hints: HintTable,
    private readonly slotTypes: readonly (AbstractValue | undefined)[],
    private readonly slotLookup: SlotLookup,
  ) {}

  private annotate(node: ExprNS.Expr, val: AbstractValue): AbstractValue {
    const existing = this.hints.get(node);
    this.hints.set(node, { ...existing, type: val });
    return val;
  }

  visitLiteralExpr(expr: ExprNS.Literal): AbstractValue {
    const value = expr.value;
    if (typeof value === "number") {
      if (Number.isInteger(value) && Number.isFinite(value)) {
        const info = value > 0 ? positiveInteger() : value < 0 ? negativeInteger() : zeroInteger();
        return this.annotate(expr, info);
      }
      if (Number.isNaN(value)) return this.annotate(expr, floatValue());
      const info = value > 0 ? positiveFloat() : value < 0 ? negativeFloat() : zeroFloat();
      return this.annotate(expr, info);
    } else if (typeof value === "boolean") {
      return this.annotate(expr, value ? trueValue() : falseValue());
    } else if (typeof value === "string") {
      return this.annotate(expr, stringValue());
    }
    return this.annotate(expr, TOP);
  }

  visitBigIntLiteralExpr(expr: ExprNS.BigIntLiteral): AbstractValue {
    const n = Number(expr.value);
    const info = n > 0 ? positiveInteger() : n < 0 ? negativeInteger() : zeroInteger();
    return this.annotate(expr, info);
  }

  visitVariableExpr(expr: ExprNS.Variable): AbstractValue {
    const info = this.slotLookup(expr.name);
    if (info.isPrimitive) return this.annotate(expr, TOP);
    if (info.envLevel === 0) {
      const slotInfo = this.slotTypes[info.slot] ?? TOP;
      return this.annotate(expr, slotInfo);
    }
    return this.annotate(expr, TOP);
  }

  visitBinaryExpr(expr: ExprNS.Binary): AbstractValue {
    const left = expr.left.accept(this);
    const right = expr.right.accept(this);

    // String concatenation: handled before numeric dispatch so str+str → string, not TOP.
    if (
      expr.operator.type === TokenType.PLUS &&
      left.sound.kinds === STR_BIT &&
      right.sound.kinds === STR_BIT
    ) {
      return this.annotate(expr, stringValue());
    }

    const opStr = BINARY_OP_MAP.get(expr.operator.type);
    if (opStr !== undefined) {
      return this.annotate(expr, transferBinaryOp(opStr, left, right));
    }

    return this.annotate(expr, TOP);
  }

  visitCompareExpr(expr: ExprNS.Compare): AbstractValue {
    const left = expr.left.accept(this);
    const right = expr.right.accept(this);

    const opStr = COMPARE_OP_MAP.get(expr.operator.type);
    if (opStr !== undefined) {
      return this.annotate(expr, transferCompare(opStr, left, right));
    }

    return this.annotate(expr, booleanValue(BoolRef.Top));
  }

  visitBoolOpExpr(expr: ExprNS.BoolOp): AbstractValue {
    const left = expr.left.accept(this);
    const right = expr.right.accept(this);

    const leftIsBool = left.sound.kinds === BOOL_BIT;

    if (expr.operator.type === TokenType.AND) {
      if (leftIsBool && left.sound.boolRef === BoolRef.False) return this.annotate(expr, falseValue());
      if (leftIsBool && left.sound.boolRef === BoolRef.True) return this.annotate(expr, right);
      return this.annotate(expr, booleanValue(BoolRef.Top));
    } else if (expr.operator.type === TokenType.OR) {
      if (leftIsBool && left.sound.boolRef === BoolRef.True) return this.annotate(expr, trueValue());
      if (leftIsBool && left.sound.boolRef === BoolRef.False) return this.annotate(expr, right);
      return this.annotate(expr, booleanValue(BoolRef.Top));
    }

    return this.annotate(expr, TOP);
  }

  visitUnaryExpr(expr: ExprNS.Unary): AbstractValue {
    const operand = expr.right.accept(this);

    switch (expr.operator.type) {
      case TokenType.MINUS:
        return this.annotate(expr, transferUnaryNeg(operand));
      case TokenType.NOT:
        return this.annotate(expr, transferNot(operand));
      case TokenType.PLUS:
        return this.annotate(expr, operand);
      default:
        return this.annotate(expr, TOP);
    }
  }

  visitTernaryExpr(expr: ExprNS.Ternary): AbstractValue {
    expr.predicate.accept(this);
    expr.consequent.accept(this);
    expr.alternative.accept(this);
    return this.annotate(expr, TOP);
  }

  visitCallExpr(expr: ExprNS.Call): AbstractValue {
    expr.callee.accept(this);
    for (const arg of expr.args) {
      arg.accept(this);
    }
    return this.annotate(expr, TOP);
  }

  visitGroupingExpr(expr: ExprNS.Grouping): AbstractValue {
    return expr.expression.accept(this);
  }

  visitLambdaExpr(expr: ExprNS.Lambda): AbstractValue {
    return this.annotate(expr, closureValue());
  }

  visitMultiLambdaExpr(expr: ExprNS.MultiLambda): AbstractValue {
    return this.annotate(expr, closureValue());
  }

  visitNoneExpr(expr: ExprNS.None): AbstractValue {
    return this.annotate(expr, nullValue());
  }

  visitListExpr(expr: ExprNS.List): AbstractValue {
    for (const el of expr.elements) {
      el.accept(this);
    }
    return this.annotate(expr, TOP);
  }

  visitSubscriptExpr(expr: ExprNS.Subscript): AbstractValue {
    expr.value.accept(this);
    expr.index.accept(this);
    return this.annotate(expr, TOP);
  }

  visitStarredExpr(expr: ExprNS.Starred): AbstractValue {
    expr.value.accept(this);
    return this.annotate(expr, TOP);
  }

  visitComplexExpr(expr: ExprNS.Complex): AbstractValue {
    return this.annotate(expr, complexValue());
  }
}

/**
 * Type analysis AnalysisModule: wraps TypeAnalysisVisitor transfer functions
 * in the AnalysisModule interface. Lattice operations delegate to lattice-ops.ts.
 *
 * This is a forward May analysis: merge = join (least upper bound).
 * At join points (if/else, loop headers) the env takes the union of possible types,
 * so we specialize only when the type is known to be numeric on ALL incoming paths.
 */
export class TypeAnalysisModule implements AnalysisModule<AbstractValue> {
  readonly name = "type";
  readonly mergeKind = "may" as const;
  readonly direction = "forward" as const;
  readonly field = "type" as const satisfies keyof OptimizationHint;

  top(): AbstractValue { return TOP; }
  bottom(): AbstractValue { return BOTTOM; }
  join(a: AbstractValue, b: AbstractValue): AbstractValue { return join(a, b); }
  meet(a: AbstractValue, b: AbstractValue): AbstractValue { return meet(a, b); }
  leq(a: AbstractValue, b: AbstractValue): boolean { return leq(a, b); }

  makeExprVisitor(
    hints: HintTable,
    env: readonly (AbstractValue | undefined)[],
    slotLookup: SlotLookup,
  ): ExprNS.Visitor<AbstractValue> {
    return new TypeAnalysisVisitor(hints, env, slotLookup);
  }
}
