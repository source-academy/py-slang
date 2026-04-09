// src/specialization/transfer.ts
import {
  type IntRef,
  BoolRef,
  type AbstractValue,
  INT_BIT,
  BOOL_BIT,
  FLOAT_BIT,
  COMPLEX_BIT,
} from "../types/abstract-value";
import {
  TOP,
  integer,
  boolean,
  floatValue,
  complexValue as complexVal,
} from "../types/lattice-ops";

// ========================================================================
// Sign arithmetic transfer functions (operate on IntRef bitmasks)
// ========================================================================

/** Negate a sign: swap Neg (bit 0) and Pos (bit 2), keep Zero (bit 1). */
export function negSign(a: IntRef): IntRef {
  return ((a & 2) | ((a & 1) << 2) | ((a & 4) >> 2)) as IntRef;
}

/** Sign of (a + b). */
export function addSigns(a: IntRef, b: IntRef): IntRef {
  if (a === 0 || b === 0) return 0 as IntRef; // bottom propagates
  if (a === 2) return b; // zero + b = b     (IntRef.Zero = 2)
  if (b === 2) return a; // a + zero = a
  // pos + pos = pos
  if (a === 4 && b === 4) return 4 as IntRef;
  // neg + neg = neg
  if (a === 1 && b === 1) return 1 as IntRef;
  // pos + nonneg = pos, nonneg + pos = pos
  if ((a === 4 && b === 6) || (a === 6 && b === 4)) return 4 as IntRef;
  // nonneg + nonneg = nonneg
  if (a === 6 && b === 6) return 6 as IntRef;
  // neg + nonpos = neg, nonpos + neg = neg
  if ((a === 1 && b === 3) || (a === 3 && b === 1)) return 1 as IntRef;
  // nonpos + nonpos = nonpos
  if (a === 3 && b === 3) return 3 as IntRef;
  return 7 as IntRef; // Top
}

/** Sign of (a - b). */
export function subSigns(a: IntRef, b: IntRef): IntRef {
  return addSigns(a, negSign(b));
}

/** Sign of (a * b). */
export function mulSigns(a: IntRef, b: IntRef): IntRef {
  if (a === 0 || b === 0) return 0 as IntRef; // bottom
  if (a === 2 || b === 2) return 2 as IntRef; // zero * x = zero (IntRef.Zero = 2)
  // Signs of atoms: Neg=1, Pos=4
  // pos*pos=pos, neg*neg=pos
  if ((a === 4 && b === 4) || (a === 1 && b === 1)) return 4 as IntRef;
  // pos*neg=neg, neg*pos=neg
  if ((a === 4 && b === 1) || (a === 1 && b === 4)) return 1 as IntRef;
  // nonneg*nonneg=nonneg, nonpos*nonpos=nonneg
  if ((a === 6 && b === 6) || (a === 3 && b === 3)) return 6 as IntRef;
  // nonneg*nonpos=nonpos, nonpos*nonneg=nonpos
  if ((a === 6 && b === 3) || (a === 3 && b === 6)) return 3 as IntRef;
  // pos*nonneg=nonneg, nonneg*pos=nonneg
  if ((a === 4 && b === 6) || (a === 6 && b === 4)) return 6 as IntRef;
  // neg*nonpos=nonneg, nonpos*neg=nonneg
  if ((a === 1 && b === 3) || (a === 3 && b === 1)) return 6 as IntRef;
  // pos*nonpos=nonpos, nonpos*pos=nonpos
  if ((a === 4 && b === 3) || (a === 3 && b === 4)) return 3 as IntRef;
  // neg*nonneg=nonpos, nonneg*neg=nonpos
  if ((a === 1 && b === 6) || (a === 6 && b === 1)) return 3 as IntRef;
  // nonzero*nonzero=nonzero
  if (a === 5 && b === 5) return 5 as IntRef;
  return 7 as IntRef; // Top
}

/** Sign of (a // b). Floor division — result can be zero, so use nonneg/nonpos. */
export function divSigns(a: IntRef, b: IntRef): IntRef {
  if (a === 0 || b === 0) return 0 as IntRef; // bottom propagates
  if (b === 2) return 7 as IntRef; // div by zero → top (conservative)
  if (a === 2) return 2 as IntRef; // zero / x = zero
  // pos/pos=nonneg, neg/neg=nonneg
  if ((a === 4 && b === 4) || (a === 1 && b === 1)) return 6 as IntRef;
  // pos/neg=nonpos, neg/pos=nonpos
  if ((a === 4 && b === 1) || (a === 1 && b === 4)) return 3 as IntRef;
  // nonneg/(pos|nonneg)=nonneg
  if (a === 6 && (b === 4 || b === 6)) return 6 as IntRef;
  // nonpos/(neg|nonpos)=nonneg
  if (a === 3 && (b === 1 || b === 3)) return 6 as IntRef;
  // nonneg/(neg|nonpos)=nonpos
  if (a === 6 && (b === 1 || b === 3)) return 3 as IntRef;
  // nonpos/(pos|nonneg)=nonpos
  if (a === 3 && (b === 4 || b === 6)) return 3 as IntRef;
  return 7 as IntRef;
}

/** Sign of (a % b). Python: result sign = divisor sign (floor-mod). */
export function modSigns(a: IntRef, b: IntRef): IntRef {
  if (a === 0 || b === 0) return 0 as IntRef; // bottom propagates
  if (b === 2) return 7 as IntRef; // mod by zero → unknown
  if (a === 2) return 2 as IntRef; // zero % x = zero
  // Python: result sign = divisor sign
  if (b === 4 || b === 6) return 6 as IntRef; // pos/nonneg divisor → nonneg result
  if (b === 1 || b === 3) return 3 as IntRef; // neg/nonpos divisor → nonpos result
  return 7 as IntRef;
}

// ========================================================================
// Boolean transfer functions (operate on BoolRef bitmasks)
// ========================================================================

export function notBoolRef(t: BoolRef): BoolRef {
  if (t === 0) return 0 as BoolRef; // bottom
  // Swap True (bit 0) and False (bit 1) — same bit-swap as negSign
  return (((t & 1) << 1) | ((t & 2) >> 1)) as BoolRef;
}

/** BoolRef of (l > r) based on signs. */
export function gtSigns(l: IntRef, r: IntRef): BoolRef {
  if (l === 0 || r === 0) return 0 as BoolRef; // bottom

  // Definitely true cases
  if (l === 4 && (r === 2 || r === 1 || r === 3)) return 1 as BoolRef; // pos > (zero|neg|nonpos)
  if (l === 6 && r === 1) return 1 as BoolRef; // nonneg > neg
  if (l === 2 && r === 1) return 1 as BoolRef; // zero > neg

  // Definitely false cases
  if (l === 1 && (r === 2 || r === 4 || r === 6)) return 2 as BoolRef; // neg !> (zero|pos|nonneg)
  if (l === 2 && (r === 2 || r === 4 || r === 6)) return 2 as BoolRef; // zero !> (zero|pos|nonneg)
  if (l === 3 && (r === 4 || r === 6)) return 2 as BoolRef; // nonpos !> (pos|nonneg)
  if (l === 3 && r === 6) return 2 as BoolRef; // nonpos !> nonneg

  return 3 as BoolRef; // top
}

export function ltSigns(l: IntRef, r: IntRef): BoolRef {
  return gtSigns(r, l);
}
export function geSigns(l: IntRef, r: IntRef): BoolRef {
  return notBoolRef(ltSigns(l, r));
}
export function leSigns(l: IntRef, r: IntRef): BoolRef {
  return notBoolRef(gtSigns(l, r));
}

/** BoolRef of (l === r) based on signs. */
export function eqSigns(l: IntRef, r: IntRef): BoolRef {
  if (l === 0 || r === 0) return 0 as BoolRef;
  if (l === 2 && r === 2) return 1 as BoolRef; // zero == zero → true
  // Disjoint sign sets → definitely not equal
  if (l === 4 && (r === 2 || r === 1 || r === 3)) return 2 as BoolRef;
  if (l === 1 && (r === 2 || r === 4 || r === 6)) return 2 as BoolRef;
  if (l === 2 && (r === 4 || r === 1 || r === 5)) return 2 as BoolRef;
  if (l === 3 && r === 4) return 2 as BoolRef; // nonpos vs pos
  if (l === 6 && r === 1) return 2 as BoolRef; // nonneg vs neg
  if (l === 5 && r === 2) return 2 as BoolRef; // nonzero vs zero
  if (r === 5 && l === 2) return 2 as BoolRef; // zero vs nonzero
  return 3 as BoolRef;
}

export function neqSigns(l: IntRef, r: IntRef): BoolRef {
  return notBoolRef(eqSigns(l, r));
}

// ========================================================================
// Top-level transfer functions operating on AbstractValue
// ========================================================================

export function transferBinaryOp(
  op: string,
  left: AbstractValue,
  right: AbstractValue,
): AbstractValue {
  const lk = left.sound.kinds;
  const rk = right.sound.kinds;

  // Complex promotion: spec only defines +, -, *, / for complex.
  // // and % raise TypeError at runtime.
  if (lk === COMPLEX_BIT || rk === COMPLEX_BIT) {
    if (op === "//" || op === "%") return TOP;
    const otherKinds = lk === COMPLEX_BIT ? rk : lk;
    // complex op numeric = complex; complex op non-numeric = TOP
    if (otherKinds & ~(INT_BIT | FLOAT_BIT | COMPLEX_BIT)) return TOP;
    return complexVal();
  }

  const lIsFloat = lk === FLOAT_BIT;
  const rIsFloat = rk === FLOAT_BIT;
  const lIsInt = lk === INT_BIT;
  const rIsInt = rk === INT_BIT;

  // True division always returns float (per spec)
  if (op === "/") {
    if (lIsInt && rIsInt) {
      return floatValue(divSigns(left.sound.intRef, right.sound.intRef));
    }
    if ((lIsInt || lIsFloat) && (rIsInt || rIsFloat)) {
      const lRef = lIsFloat ? left.sound.floatRef : left.sound.intRef;
      const rRef = rIsFloat ? right.sound.floatRef : right.sound.intRef;
      return floatValue(divSigns(lRef, rRef));
    }
    return TOP;
  }

  // Float + int or float + float → float result
  if ((lIsFloat && rIsInt) || (lIsInt && rIsFloat) || (lIsFloat && rIsFloat)) {
    const lRef = lIsFloat ? left.sound.floatRef : left.sound.intRef;
    const rRef = rIsFloat ? right.sound.floatRef : right.sound.intRef;
    let resultRef: IntRef;
    switch (op) {
      case "+":
        resultRef = addSigns(lRef, rRef);
        break;
      case "-":
        resultRef = subSigns(lRef, rRef);
        break;
      case "*":
        resultRef = mulSigns(lRef, rRef);
        break;
      case "//":
        resultRef = divSigns(lRef, rRef);
        break;
      case "%":
        resultRef = modSigns(lRef, rRef);
        break;
      default:
        return TOP;
    }
    return floatValue(resultRef);
  }

  // Pure int op int
  if (!lIsInt || !rIsInt) return TOP;

  const lRef = left.sound.intRef;
  const rRef = right.sound.intRef;

  let resultRef: IntRef;
  switch (op) {
    case "+":
      resultRef = addSigns(lRef, rRef);
      break;
    case "-":
      resultRef = subSigns(lRef, rRef);
      break;
    case "*":
      resultRef = mulSigns(lRef, rRef);
      break;
    case "//":
      resultRef = divSigns(lRef, rRef);
      break;
    case "%":
      resultRef = modSigns(lRef, rRef);
      break;
    default:
      return TOP;
  }
  return integer(resultRef);
}

export function transferCompare(
  op: string,
  left: AbstractValue,
  right: AbstractValue,
): AbstractValue {
  const lk = left.sound.kinds;
  const rk = right.sound.kinds;

  // == and != work on any types
  if (op === "==" || op === "!=") {
    // Use sign analysis when both operands are numeric (int or float)
    if ((lk === INT_BIT || lk === FLOAT_BIT) && (rk === INT_BIT || rk === FLOAT_BIT)) {
      const lRef = lk === FLOAT_BIT ? left.sound.floatRef : left.sound.intRef;
      const rRef = rk === FLOAT_BIT ? right.sound.floatRef : right.sound.intRef;
      const ref = op === "==" ? eqSigns(lRef, rRef) : neqSigns(lRef, rRef);
      return boolean(ref);
    }
    return boolean(BoolRef.Top);
  }

  // Ordering comparisons: not valid on complex (raises TypeError at runtime)
  if (lk === COMPLEX_BIT || rk === COMPLEX_BIT) return TOP;

  // Ordering comparisons on any numeric types (int, float, mixed) — sign analysis applies
  // since int and float both use IntRef for their sign refinement.
  if ((lk === INT_BIT || lk === FLOAT_BIT) && (rk === INT_BIT || rk === FLOAT_BIT)) {
    const lRef = lk === FLOAT_BIT ? left.sound.floatRef : left.sound.intRef;
    const rRef = rk === FLOAT_BIT ? right.sound.floatRef : right.sound.intRef;
    let resultRef: BoolRef;
    switch (op) {
      case ">":  resultRef = gtSigns(lRef, rRef); break;
      case "<":  resultRef = ltSigns(lRef, rRef); break;
      case ">=": resultRef = geSigns(lRef, rRef); break;
      case "<=": resultRef = leSigns(lRef, rRef); break;
      default:   return boolean(BoolRef.Top);
    }
    return boolean(resultRef);
  }

  return boolean(BoolRef.Top);
}

export function transferUnaryNeg(operand: AbstractValue): AbstractValue {
  if (operand.sound.kinds === COMPLEX_BIT) return complexVal();
  if (operand.sound.kinds === FLOAT_BIT) return floatValue(negSign(operand.sound.floatRef));
  if (operand.sound.kinds === INT_BIT) return integer(negSign(operand.sound.intRef));
  return TOP;
}

export function transferNot(operand: AbstractValue): AbstractValue {
  if (!(operand.sound.kinds & BOOL_BIT)) return boolean(BoolRef.Top);
  return boolean(notBoolRef(operand.sound.boolRef));
}
