import { ExprNS } from "../../ast-types";
import { UnsupportedOperandTypeError, ZeroDivisionError } from "../../errors/errors";
import { TokenType } from "../../tokenizer";
import { PyComplexNumber } from "../../types";
import { Context } from "./context";
import { handleRuntimeError } from "./error";
import { BigIntValue, NumberValue, Value } from "./stash";
import { operatorTranslator } from "./types";
import { isCoercedComplex, isNumeric, numericCompare, pythonMod } from "./utils";

export type BinaryOperator =
  | "=="
  | "!="
  | "==="
  | "!=="
  | "<"
  | "<="
  | ">"
  | ">="
  | "<<"
  | ">>"
  | ">>>"
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "**"
  | "|"
  | "^"
  | "&"
  | "in"
  | "instanceof";

/**
 * Evaluates a unary expression with the given operator and operand value, following Python semantics.
 * @param code The original source code being evaluated
 * @param command The AST node corresponding to the unary expression
 * @param context The global context state
 * @param operator The operator of the unary expression (e.g., TokenType.MINUS for negation)
 * @param value The operand value to apply the unary operator to
 * @returns The result of the unary operation
 */
export function evaluateUnaryExpression(
  code: string,
  command: ExprNS.Unary,
  context: Context,
  operator: TokenType,
  value: Value,
): Value {
  switch (operator) {
    case TokenType.NOT:
      // The `not` operator can only be applied to booleans
      if (value.type === "bool") {
        return { type: "bool", value: isFalsy(value) };
      }
      handleRuntimeError(
        context,
        new UnsupportedOperandTypeError(
          code,
          command,
          value.type,
          "",
          operatorTranslator(operator),
        ),
      );

    case TokenType.MINUS:
      switch (value.type) {
        case "number":
          return { type: "number", value: -value.value };
        case "bigint":
          return { type: "bigint", value: -value.value };
        case "complex":
          return {
            type: "complex",
            value: new PyComplexNumber(-value.value.real, -value.value.imag),
          };
        default:
          handleRuntimeError(
            context,
            new UnsupportedOperandTypeError(
              code,
              command,
              value.type,
              "",
              operatorTranslator(operator),
            ),
          );
      }
    case TokenType.PLUS:
      switch (value.type) {
        case "number":
        case "bigint":
        case "complex":
          return value;
        default:
          handleRuntimeError(
            context,
            new UnsupportedOperandTypeError(
              code,
              command,
              value.type,
              "",
              operatorTranslator(operator),
            ),
          );
      }
    default:
      handleRuntimeError(
        context,
        new UnsupportedOperandTypeError(
          code,
          command,
          value.type,
          "",
          operatorTranslator(operator),
        ),
      );
  }
}

/** A float NaN value; NaN is unequal to everything, including itself, as in CPython. */
function isNaNValue(value: Value): boolean {
  return value.type === "number" && Number.isNaN(value.value);
}

/**
 * As in CPython, where bool is a subclass of int, booleans participate in
 * equality and ordering comparisons as the ints they are: coerce a boolean
 * to its int value and leave every other value untouched.
 */
function asIntIfBool(value: Value): Value {
  return value.type === "bool" ? { type: "bigint", value: value.value ? 1n : 0n } : value;
}

/**
 * Whether a value is a valid operand for numeric ordering comparisons
 * (int, float or bool — bool as the int it is under CPython's rules).
 */
function isOrderable(value: Value): boolean {
  return value.type === "bigint" || value.type === "number" || value.type === "bool";
}

/**
 * Structural equality between any two values, following Python semantics
 * (see docs/specs/python_typing_middle_34.tex: `==,!=` take any x any at Python §3/§4).
 * Numbers compare across int/float/complex, and booleans participate as in
 * CPython, where bool is a subclass of int (True == 1 is True); `None == None`
 * is true; lists compare element-wise (recursively), as in Python; values of
 * other differing types are unequal; remaining same-type values compare by
 * value where they carry one, and by reference otherwise.
 *
 * The identity shortcut mirrors CPython's container comparison, which checks
 * `x is y` before `x == y` per element — so a list containing NaN equals
 * itself, while distinct NaN values are unequal. (Top-level `nan == nan` on
 * the very same object is CPython-False; handleExpandedEquality guards that
 * case before calling this function.)
 *
 * Self-referential lists without shared identity exhaust the stack, mirroring
 * CPython's RecursionError on such comparisons.
 *
 * When `restrictChapter2` is set, every operand pair — including elements
 * reached by recursing into lists — is re-checked against
 * excludedFromChapter2Equality: §2 excludes bool/function from `==`/`!=`
 * everywhere the comparison reaches, not just at the top level, so
 * `pair(1, 2) == pair(True, 3)` and `pair(head, 2) == pair(head, 2)` are
 * errors at §2, not silently-wrong bools.
 */
function structuralEquals(
  code: string,
  command: ExprNS.Binary,
  context: Context,
  operator: TokenType,
  left: Value,
  right: Value,
  restrictChapter2: boolean,
): boolean {
  if (
    restrictChapter2 &&
    (excludedFromChapter2Equality(left) || excludedFromChapter2Equality(right))
  ) {
    handleRuntimeError(
      context,
      new UnsupportedOperandTypeError(
        code,
        command,
        left.type,
        right.type,
        operatorTranslator(operator),
      ),
    );
  }

  // Identity shortcut: also lets comparisons of shared substructure terminate early.
  if (left === right) {
    return true;
  }

  // As in CPython, booleans compare as the ints they are (True == 1, False == 0.0)
  left = asIntIfBool(left);
  right = asIntIfBool(right);

  // NaN is unequal to everything, including another NaN (identity shortcut above
  // deliberately wins for the same object, matching CPython's container rule)
  if (isNaNValue(left) || isNaNValue(right)) {
    return false;
  }

  // Complex number equality, coercing ints and floats
  if (left.type == "complex" || right.type == "complex") {
    if (!isCoercedComplex(left) || !isCoercedComplex(right)) {
      return false;
    }
    return PyComplexNumber.fromValue(context, code, command, left.value).equals(
      PyComplexNumber.fromValue(context, code, command, right.value),
    );
  }

  // Ints and floats compare across types (1 == 1.0 is True)
  if (isNumeric(left) && isNumeric(right)) {
    return pyCompare(left, right) === 0;
  }

  // If two types are different, they are not equal
  if (left.type != right.type) {
    return false;
  }

  // None == None is true, as in Python
  if (left.type == "none") {
    return true;
  }

  // Lists compare element-wise, recursively, as in Python
  if (left.type == "list" && right.type == "list") {
    return (
      left.value.length === right.value.length &&
      left.value.every((element, i) =>
        structuralEquals(
          code,
          command,
          context,
          operator,
          element,
          right.value[i],
          restrictChapter2,
        ),
      )
    );
  }

  // Remaining same-type values: by value where they carry one (e.g. strings),
  // by reference otherwise (e.g. closures).
  if ("value" in left && "value" in right) {
    return left.value === right.value;
  }
  return left == right;
}

/**
 * Whether a value is excluded from Python §2's any x any equality: bool (avoiding
 * CPython's bool-as-int equality, e.g. `True == 1`, as a directly written §2
 * comparison) and function values — both user-defined closures and library
 * builtins (equality without `is` is left undefined until §3/§4 introduces it).
 * See docs/specs/python_typing_middle_2.tex:
 * `==,!= bool,function x any -> error`, `==,!= any x bool,function -> error`.
 */
function excludedFromChapter2Equality(value: Value): boolean {
  return value.type === "bool" || value.type === "closure" || value.type === "builtin";
}

/**
 * Handles equality and inequality comparisons using structural equality, total over all types.
 * At Python §3/§4 this applies to any operand pair (see evaluateBinaryExpression). At Python §2
 * it is used for any operand pair where neither side is excluded (see
 * excludedFromChapter2Equality) — every other §1/§2 operand combination is unaffected by this
 * function.
 *
 * @param code The original source code being evaluated
 * @param command The AST node corresponding to the binary expression
 * @param context The global context state
 * @param operator The operator of the binary expression (either TokenType.DOUBLEEQUAL for equality or TokenType.NOTEQUAL for inequality)
 * @param left The left operand value
 * @param right The right operand value
 * @param restrictChapter2 When true, re-applies excludedFromChapter2Equality at every level of
 * recursion (not just the top-level operands), so nested bool/function values inside lists are
 * also errors at §2. Unset (false) at §3/§4, where equality is unconditionally total.
 * @returns The result of the equality comparison
 */
export function handleExpandedEquality(
  code: string,
  command: ExprNS.Binary,
  context: Context,
  operator: TokenType,
  left: Value,
  right: Value,
  restrictChapter2 = false,
): Value {
  // A top-level NaN operand is unequal to everything — even the identical
  // object (CPython: nan == nan is False). Checked here rather than in
  // structuralEquals so that the identity shortcut still applies to NaN
  // *elements* inside lists, as in CPython's container comparison.
  if (isNaNValue(left) || isNaNValue(right)) {
    return { type: "bool", value: operator == TokenType.NOTEQUAL };
  }
  return {
    type: "bool",
    value:
      (operator == TokenType.NOTEQUAL) !==
      structuralEquals(code, command, context, operator, left, right, restrictChapter2),
  };
}

/**
 * A value whose identity is unobservable: numbers (int, float, complex),
 * strings and booleans. Applying `is` to these is an error
 * (see docs/specs/python_typing_middle_34.tex): whether `1 is 1` holds is
 * unspecified in Python (interning), so the operator is restricted to the
 * reference types (list, function, None) where identity is meaningful.
 */
function hasUnobservableIdentity(value: Value): boolean {
  switch (value.type) {
    case "number":
    case "bigint":
    case "complex":
    case "string":
    case "bool":
      return true;
    default:
      return false;
  }
}

/**
 * Identity (`is`) between two values of reference type (list, function or
 * None), following Python §3/§4 semantics
 * (see docs/specs/python_typing_middle_34.tex). Lists and function values
 * compare by reference — `is` is what makes sharing of structure observable —
 * and `None is None` is true. Values of different types are never identical
 * (so `xs is None` is simply false for a list `xs`).
 */
function pyIdentical(left: Value, right: Value): boolean {
  if (left.type !== right.type) {
    return false;
  }
  switch (left.type) {
    case "none":
      return true;
    case "list":
      return left === right;
    default:
      // Function values: closures compare by their underlying closure;
      // everything else (builtins etc.) by reference.
      if ("closure" in left && "closure" in right) {
        return left.closure === right.closure;
      }
      return left === right;
  }
}

/**
 * The main function for evaluating a binary expression, which dispatches to the appropriate logic based on the operator and operand types.
 * This includes handling of complex numbers, string concatenation and comparison, numeric operations, and expanded
 * equality semantics for Python §3/§4 (any x any) and §2 (any x any except bool/function).
 * @param code The original source code being evaluated
 * @param command The AST node corresponding to the binary expression
 * @param context The global context state
 * @param operator The operator of the binary expression (e.g., TokenType.PLUS for addition)
 * @param left The left operand value
 * @param right The right operand value
 * @param variant The Python variant being evaluated (1, 2, 3 or 4), which may affect the semantics of certain operators (e.g., equality)
 * @returns The result of the binary operation
 */
export function evaluateBinaryExpression(
  code: string,
  command: ExprNS.Binary,
  context: Context,
  operator: TokenType,
  left: Value,
  right: Value,
  variant: number,
): Value {
  // Handle expanded equality semantics for Python §3/§4,
  // where equality and inequality comparisons take any x any (structural equality)
  if ((operator == TokenType.DOUBLEEQUAL || operator == TokenType.NOTEQUAL) && variant >= 3) {
    return handleExpandedEquality(code, command, context, operator, left, right);
  }

  // At Python §2, == and != compare structurally over anything allowed in §2 —
  // including cross-type comparisons, pairs and None — except bool and function
  // values, which are excluded entirely (see excludedFromChapter2Equality and
  // docs/specs/python_typing_middle_2.tex). At §1, == and != keep the narrower
  // rule enforced below.
  if (
    (operator == TokenType.DOUBLEEQUAL || operator == TokenType.NOTEQUAL) &&
    variant == 2 &&
    !excludedFromChapter2Equality(left) &&
    !excludedFromChapter2Equality(right)
  ) {
    return handleExpandedEquality(code, command, context, operator, left, right, true);
  }

  // At Python §3/§4, booleans participate in ordering comparisons as the ints
  // they are, as in CPython (True < 2 is True); see the
  // `>,>=,<,<= int,float,bool` row of docs/specs/python_typing_middle_34.tex.
  // At §1/§2 booleans are not valid ordering operands (python_typing_middle_12.tex).
  // The coercion is gated on both operands already being orderable so that an
  // unsupported comparison (e.g. `True < 'abc'`) reports 'bool', not 'int', in
  // its error message.
  if (
    variant >= 3 &&
    isOrderable(left) &&
    isOrderable(right) &&
    (operator == TokenType.LESS ||
      operator == TokenType.LESSEQUAL ||
      operator == TokenType.GREATER ||
      operator == TokenType.GREATEREQUAL)
  ) {
    left = asIntIfBool(left);
    right = asIntIfBool(right);
  }

  // Handle identity semantics for `is` / `is not`, which apply to values of
  // reference type (list, function, None) and are an error whenever either
  // operand is a number, string or boolean (identity of immutable values is
  // unobservable). The `is` operator only exists at Python §3/§4; chapters 1
  // and 2 reject it at validation time (NoIsOperatorValidator), and the
  // variant gate here keeps the runtime as an independent backstop (at §1/§2
  // the operator falls through to the generic unsupported-operand error).
  if ((operator == TokenType.IS || operator == TokenType.ISNOT) && variant >= 3) {
    if (hasUnobservableIdentity(left) || hasUnobservableIdentity(right)) {
      handleRuntimeError(
        context,
        new UnsupportedOperandTypeError(
          code,
          command,
          left.type,
          right.type,
          operatorTranslator(operator),
        ),
      );
    }
    return {
      type: "bool",
      value: (operator == TokenType.ISNOT) !== pyIdentical(left, right),
    };
  }

  // Handle Complex numbers
  if (left.type === "complex" || right.type === "complex") {
    if (!isCoercedComplex(right) || !isCoercedComplex(left)) {
      handleRuntimeError(
        context,
        new UnsupportedOperandTypeError(
          code,
          command,
          left.type,
          right.type,
          operatorTranslator(operator),
        ),
      );
    }
    const leftComplex = PyComplexNumber.fromValue(context, code, command, left.value);
    const rightComplex = PyComplexNumber.fromValue(context, code, command, right.value);
    let result: PyComplexNumber;

    switch (operator) {
      case TokenType.PLUS:
        result = leftComplex.add(rightComplex);
        break;
      case TokenType.MINUS:
        result = leftComplex.sub(rightComplex);
        break;
      case TokenType.STAR:
        result = leftComplex.mul(rightComplex);
        break;
      case TokenType.SLASH:
        result = leftComplex.div(code, command, context, rightComplex);
        break;
      case TokenType.DOUBLESTAR:
        result = leftComplex.pow(rightComplex);
        break;
      case TokenType.DOUBLEEQUAL:
        return { type: "bool", value: leftComplex.equals(rightComplex) };
      case TokenType.NOTEQUAL:
        return { type: "bool", value: !leftComplex.equals(rightComplex) };
      default:
        handleRuntimeError(
          context,
          new UnsupportedOperandTypeError(
            code,
            command,
            left.type,
            right.type,
            operatorTranslator(operator),
          ),
        );
    }
    return { type: "complex", value: result };
  }

  // Handle comparisons with None (represented as 'none' type)
  if (left.type === "none" || right.type === "none") {
    handleRuntimeError(
      context,
      new UnsupportedOperandTypeError(
        code,
        command,
        left.type,
        right.type,
        operatorTranslator(operator),
      ),
    );
  }

  // Handle list operations (`is`, `is not`, and §3/§4 `==`/`!=` are handled above;
  // everything else on lists is an error)
  if (left.type == "list" || right.type == "list") {
    handleRuntimeError(
      context,
      new UnsupportedOperandTypeError(
        code,
        command,
        left.type,
        right.type,
        operatorTranslator(operator),
      ),
    );
  }

  // Handle string operations
  if (left.type === "string" || right.type === "string") {
    if (operator === TokenType.PLUS) {
      if (left.type === "string" && right.type === "string") {
        return { type: "string", value: left.value + right.value };
      } else {
        handleRuntimeError(
          context,
          new UnsupportedOperandTypeError(
            code,
            command,
            left.type,
            right.type,
            operatorTranslator(operator),
          ),
        );
      }
    }
    if (left.type === "string" && right.type === "string") {
      switch (operator) {
        case TokenType.DOUBLEEQUAL:
          return { type: "bool", value: left.value === right.value };
        case TokenType.NOTEQUAL:
          return { type: "bool", value: left.value !== right.value };
        case TokenType.LESS:
          return { type: "bool", value: left.value < right.value };
        case TokenType.LESSEQUAL:
          return { type: "bool", value: left.value <= right.value };
        case TokenType.GREATER:
          return { type: "bool", value: left.value > right.value };
        case TokenType.GREATEREQUAL:
          return { type: "bool", value: left.value >= right.value };
      }
    }
    // TypeError: Reached if one is a string and the other is not
    handleRuntimeError(
      context,
      new UnsupportedOperandTypeError(
        code,
        command,
        left.type,
        right.type,
        operatorTranslator(operator),
      ),
    );
  }

  if (!isNumeric(left) || !isNumeric(right)) {
    handleRuntimeError(
      context,
      new UnsupportedOperandTypeError(
        code,
        command,
        left.type,
        right.type,
        operatorTranslator(operator),
      ),
    );
  }

  // Numeric Operations (number or bigint)
  switch (operator) {
    case TokenType.PLUS:
    case TokenType.MINUS:
    case TokenType.STAR:
    case TokenType.SLASH:
    case TokenType.DOUBLESLASH:
    case TokenType.PERCENT:
    case TokenType.DOUBLESTAR:
      // If either operand is a number, perform the operation with numbers (with potential loss of precision for bigints),
      // otherwise perform the operation using bigints if both operands are bigints. This mimics Python's behavior of coercing to float for mixed int/float operations,
      // while allowing for arbitrary precision with bigints.
      if (left.type === "number" || right.type === "number") {
        const l = Number(left.value);
        const r = Number(right.value);
        switch (operator) {
          case TokenType.PLUS:
            return { type: "number", value: l + r };
          case TokenType.MINUS:
            return { type: "number", value: l - r };
          case TokenType.STAR:
            return { type: "number", value: l * r };
          case TokenType.SLASH:
            if (r === 0) {
              handleRuntimeError(context, new ZeroDivisionError(code, command));
            }
            return { type: "number", value: l / r };
          case TokenType.DOUBLESLASH:
            if (r === 0) {
              handleRuntimeError(context, new ZeroDivisionError(code, command));
            }
            return { type: "number", value: Math.floor(l / r) };
          case TokenType.PERCENT:
            if (r === 0) {
              handleRuntimeError(context, new ZeroDivisionError(code, command));
            }
            const mod = pythonMod(l, r);
            if (typeof mod === "bigint") {
              return { type: "bigint", value: mod };
            }
            return { type: "number", value: mod };
          case TokenType.DOUBLESTAR:
            if (l === 0 && r < 0) {
              handleRuntimeError(context, new ZeroDivisionError(code, command));
            }
            return { type: "number", value: l ** r };
        }
      }
      if (left.type === "bigint" && right.type === "bigint") {
        const l = left.value;
        const r = right.value;
        switch (operator) {
          case TokenType.PLUS:
            return { type: "bigint", value: l + r };
          case TokenType.MINUS:
            return { type: "bigint", value: l - r };
          case TokenType.STAR:
            return { type: "bigint", value: l * r };
          case TokenType.SLASH:
            if (r === 0n) {
              handleRuntimeError(context, new ZeroDivisionError(code, command));
            }
            return { type: "number", value: Number(l) / Number(r) };
          case TokenType.DOUBLESLASH:
            if (r === 0n) {
              handleRuntimeError(context, new ZeroDivisionError(code, command));
            }
            return { type: "bigint", value: (l - pythonMod(l, r)) / r };
          case TokenType.PERCENT:
            if (r === 0n) {
              handleRuntimeError(context, new ZeroDivisionError(code, command));
            }
            const mod = pythonMod(l, r);
            if (typeof mod === "bigint") {
              return { type: "bigint", value: mod };
            }
            return { type: "number", value: mod };
          case TokenType.DOUBLESTAR:
            if (l === 0n && r < 0n) {
              handleRuntimeError(context, new ZeroDivisionError(code, command));
            }
            if (r < 0n) return { type: "number", value: Number(l) ** Number(r) };
            return { type: "bigint", value: l ** r };
        }
      }
      break;

    // Comparison Operators
    case TokenType.DOUBLEEQUAL:
    case TokenType.NOTEQUAL:
    case TokenType.LESS:
    case TokenType.LESSEQUAL:
    case TokenType.GREATER:
    case TokenType.GREATEREQUAL: {
      // As in CPython, NaN is unordered and unequal to everything, including
      // itself: every comparison with a NaN operand is False except !=
      if (isNaNValue(left) || isNaNValue(right)) {
        return { type: "bool", value: operator == TokenType.NOTEQUAL };
      }
      const cmp = pyCompare(left, right);
      let result: boolean;
      switch (operator) {
        case TokenType.DOUBLEEQUAL:
          result = cmp === 0;
          break;
        case TokenType.NOTEQUAL:
          result = cmp !== 0;
          break;
        case TokenType.LESS:
          result = cmp < 0;
          break;
        case TokenType.LESSEQUAL:
          result = cmp <= 0;
          break;
        case TokenType.GREATER:
          result = cmp > 0;
          break;
        case TokenType.GREATEREQUAL:
          result = cmp >= 0;
          break;
        default:
          return { type: "error", message: "Unreachable in evaluateBinaryExpression - comparison" };
      }
      return { type: "bool", value: result };
    }
  }
  handleRuntimeError(
    context,
    new UnsupportedOperandTypeError(
      code,
      command,
      left.type,
      right.type,
      operatorTranslator(operator),
    ),
  );
}

/**
 * Compares a Python-style big integer with a float, returning -1, 0, or 1 for
 * less-than, equal, or greater-than. The actual numeric algorithm (safe-range
 * conversion, magnitude approximation for values outside it) lives in
 * `numericCompare` in ./utils, shared with the PVML engine's interpreter so
 * both engines agree on cross-type (bigint vs float) ordering.
 */
function pyCompare(val1: NumberValue | BigIntValue, val2: NumberValue | BigIntValue): number {
  return numericCompare(val1.value, val2.value);
}

export function isFalsy(value: Value): boolean {
  switch (value.type) {
    case "bigint":
      return value.value === 0n;
    case "number":
      return value.value === 0;
    case "bool":
      return !value.value;
    case "string":
      return value.value === "";
    case "complex":
      return value.value.real === 0 && value.value.imag == 0;
    case "none": // Represents None
      return true;
    default:
      // All other objects are considered truthy
      return false;
  }
}
