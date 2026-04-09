import {
  transferBinaryOp,
  transferUnaryNeg,
  transferCompare,
  transferNot,
  negSign,
  addSigns,
  subSigns,
  mulSigns,
  divSigns,
  modSigns,
  gtSigns,
  ltSigns,
  geSigns,
  leSigns,
  eqSigns,
  neqSigns,
  notBoolRef,
} from "../specialization/transfer";
import {
  positiveInteger,
  negativeInteger,
  zeroInteger,
  trueValue,
  falseValue,
  positiveFloat,
  negativeFloat,
  zeroFloat,
  complexValue,
  stringValue,
  TOP,
} from "../types/lattice-ops";
import {
  IntRef,
  BoolRef,
  INT_BIT,
  BOOL_BIT,
  FLOAT_BIT,
  COMPLEX_BIT,
} from "../types/abstract-value";

describe("transferBinaryOp", () => {
  test("pos + pos = pos", () => {
    const result = transferBinaryOp("+", positiveInteger(), positiveInteger());
    expect(result.sound.kinds).toBe(INT_BIT);
    expect(result.sound.intRef).toBe(IntRef.Pos);
  });

  test("pos + neg = int (top refinement)", () => {
    const result = transferBinaryOp("+", positiveInteger(), negativeInteger());
    expect(result.sound.kinds).toBe(INT_BIT);
    expect(result.sound.intRef).toBe(IntRef.Top);
  });

  test("unknown + unknown = unknown", () => {
    const result = transferBinaryOp("+", TOP, TOP);
    expect(result.sound.kinds).toBe(TOP.sound.kinds);
  });
});

describe("transferCompare", () => {
  test("pos > zero = true", () => {
    const result = transferCompare(">", positiveInteger(), zeroInteger());
    expect(result.sound.kinds).toBe(BOOL_BIT);
    expect(result.sound.boolRef).toBe(BoolRef.True);
  });

  test("pos > pos = bool (unknown)", () => {
    const result = transferCompare(">", positiveInteger(), positiveInteger());
    expect(result.sound.kinds).toBe(BOOL_BIT);
    expect(result.sound.boolRef).toBe(BoolRef.Top);
  });
});

describe("transferNot", () => {
  test("not True = False", () => {
    const result = transferNot(trueValue());
    expect(result.sound.boolRef).toBe(BoolRef.False);
  });

  test("not False = True", () => {
    const result = transferNot(falseValue());
    expect(result.sound.boolRef).toBe(BoolRef.True);
  });
});

describe("transferUnaryNeg", () => {
  test("-pos = neg", () => {
    const result = transferUnaryNeg(positiveInteger());
    expect(result.sound.intRef).toBe(IntRef.Neg);
  });

  test("-zero = zero", () => {
    const result = transferUnaryNeg(zeroInteger());
    expect(result.sound.intRef).toBe(IntRef.Zero);
  });
});

const ALL_INT_REFS: IntRef[] = [
  IntRef.Bottom,
  IntRef.Neg,
  IntRef.Zero,
  IntRef.Pos,
  IntRef.NonZero,
  IntRef.NonNeg,
  IntRef.NonPos,
  IntRef.Top,
];
const ALL_BOOL_REFS: BoolRef[] = [BoolRef.Bottom, BoolRef.True, BoolRef.False, BoolRef.Top];

describe("Sign lattice algebraic properties", () => {
  // Negation is self-inverse
  test.each(ALL_INT_REFS)("negSign(negSign(%s)) = %s", a => {
    expect(negSign(negSign(a))).toBe(a);
  });

  // Comparison duality: gt(a,b) = lt(b,a)
  const INT_PAIRS = ALL_INT_REFS.flatMap(a => ALL_INT_REFS.map(b => [a, b] as [IntRef, IntRef]));
  test.each(INT_PAIRS)("gtSigns(%s, %s) === ltSigns(%s, %s)", (a, b) => {
    expect(gtSigns(a, b)).toBe(ltSigns(b, a));
  });

  // ge = not(lt), le = not(gt)
  test.each(INT_PAIRS)("geSigns(%s, %s) === notBoolRef(ltSigns(%s, %s))", (a, b) => {
    expect(geSigns(a, b)).toBe(notBoolRef(ltSigns(a, b)));
  });
  test.each(INT_PAIRS)("leSigns(%s, %s) === notBoolRef(gtSigns(%s, %s))", (a, b) => {
    expect(leSigns(a, b)).toBe(notBoolRef(gtSigns(a, b)));
  });

  // neq = not(eq)
  test.each(INT_PAIRS)("neqSigns(%s, %s) === notBoolRef(eqSigns(%s, %s))", (a, b) => {
    expect(neqSigns(a, b)).toBe(notBoolRef(eqSigns(a, b)));
  });

  // eq is symmetric
  test.each(INT_PAIRS)("eqSigns(%s, %s) === eqSigns(%s, %s)", (a, b) => {
    expect(eqSigns(a, b)).toBe(eqSigns(b, a));
  });

  // Addition is commutative
  test.each(INT_PAIRS)("addSigns(%s, %s) === addSigns(%s, %s)", (a, b) => {
    expect(addSigns(a, b)).toBe(addSigns(b, a));
  });

  // Multiplication is commutative
  test.each(INT_PAIRS)("mulSigns(%s, %s) === mulSigns(%s, %s)", (a, b) => {
    expect(mulSigns(a, b)).toBe(mulSigns(b, a));
  });

  // Zero is additive identity
  test.each(ALL_INT_REFS)("addSigns(%s, zero) = %s", a => {
    expect(addSigns(a, IntRef.Zero)).toBe(a);
  });

  // Zero * anything = zero (except bottom)
  test.each(ALL_INT_REFS.filter(a => a !== IntRef.Bottom))("mulSigns(%s, zero) = zero", a => {
    expect(mulSigns(a, IntRef.Zero)).toBe(IntRef.Zero);
  });

  // Bottom propagates through all arithmetic
  test.each(ALL_INT_REFS)("addSigns(bottom, %s) = bottom", a => {
    expect(addSigns(IntRef.Bottom, a)).toBe(IntRef.Bottom);
  });
  test.each(ALL_INT_REFS)("mulSigns(bottom, %s) = bottom", a => {
    expect(mulSigns(IntRef.Bottom, a)).toBe(IntRef.Bottom);
  });

  // not is self-inverse for booleans
  test.each(ALL_BOOL_REFS)("notBoolRef(notBoolRef(%s)) = %s", a => {
    expect(notBoolRef(notBoolRef(a))).toBe(a);
  });

  // sub(a,b) = add(a, neg(b))
  test.each(INT_PAIRS)("subSigns(%s, %s) === addSigns(%s, negSign(%s))", (a, b) => {
    expect(subSigns(a, b)).toBe(addSigns(a, negSign(b)));
  });
});

describe("divSigns golden table", () => {
  // Floor division: 1//3=0, so pos//pos is nonneg, not pos
  const DIV_TABLE: Array<[IntRef, IntRef, IntRef]> = [
    // a,              b,              expected
    [IntRef.Pos, IntRef.Pos, IntRef.NonNeg],
    [IntRef.Neg, IntRef.Neg, IntRef.NonNeg],
    [IntRef.Pos, IntRef.Neg, IntRef.NonPos],
    [IntRef.Neg, IntRef.Pos, IntRef.NonPos],
    [IntRef.Zero, IntRef.Pos, IntRef.Zero],
    [IntRef.Zero, IntRef.Neg, IntRef.Zero],
    [IntRef.Pos, IntRef.Zero, IntRef.Top], // division by zero
    [IntRef.Neg, IntRef.Zero, IntRef.Top], // division by zero
    [IntRef.Zero, IntRef.Zero, IntRef.Top], // 0/0
    [IntRef.NonNeg, IntRef.Pos, IntRef.NonNeg],
    [IntRef.NonPos, IntRef.Neg, IntRef.NonNeg],
    [IntRef.NonNeg, IntRef.Neg, IntRef.NonPos],
    [IntRef.NonPos, IntRef.Pos, IntRef.NonPos],
    [IntRef.Top, IntRef.Pos, IntRef.Top],
    [IntRef.Pos, IntRef.Top, IntRef.Top],
    [IntRef.Bottom, IntRef.Pos, IntRef.Bottom],
    [IntRef.Pos, IntRef.Bottom, IntRef.Bottom],
  ];

  test.each(DIV_TABLE)("divSigns(%s, %s) = %s", (a, b, expected) => {
    expect(divSigns(a, b)).toBe(expected);
  });
});

describe("modSigns golden table (Python floor-mod semantics)", () => {
  const cases: [string, IntRef, IntRef, IntRef][] = [
    ["pos % pos = nonneg", 4 as IntRef, 4 as IntRef, 6 as IntRef],
    ["neg % pos = nonneg", 1 as IntRef, 4 as IntRef, 6 as IntRef],
    ["pos % neg = nonpos", 4 as IntRef, 1 as IntRef, 3 as IntRef],
    ["neg % neg = nonpos", 1 as IntRef, 1 as IntRef, 3 as IntRef],
    ["zero % pos = zero", 2 as IntRef, 4 as IntRef, 2 as IntRef],
    ["zero % neg = zero", 2 as IntRef, 1 as IntRef, 2 as IntRef],
    ["pos % zero = unknown", 4 as IntRef, 2 as IntRef, 7 as IntRef],
    ["any % unknown = unknown", 4 as IntRef, 7 as IntRef, 7 as IntRef],
  ];
  test.each(cases)("%s", (_, a, b, expected) => {
    expect(modSigns(a, b)).toBe(expected);
  });
});

describe("Comparison edge cases", () => {
  // Cases that are definite (not top)
  test("pos > zero = true", () => expect(gtSigns(IntRef.Pos, IntRef.Zero)).toBe(BoolRef.True));
  test("pos > neg = true", () => expect(gtSigns(IntRef.Pos, IntRef.Neg)).toBe(BoolRef.True));
  test("pos > nonpos = true", () => expect(gtSigns(IntRef.Pos, IntRef.NonPos)).toBe(BoolRef.True));
  test("nonneg > neg = true", () => expect(gtSigns(IntRef.NonNeg, IntRef.Neg)).toBe(BoolRef.True));
  test("zero > neg = true", () => expect(gtSigns(IntRef.Zero, IntRef.Neg)).toBe(BoolRef.True));

  test("neg < zero = true", () => expect(ltSigns(IntRef.Neg, IntRef.Zero)).toBe(BoolRef.True));
  test("neg < pos = true", () => expect(ltSigns(IntRef.Neg, IntRef.Pos)).toBe(BoolRef.True));

  test("zero == zero = true", () => expect(eqSigns(IntRef.Zero, IntRef.Zero)).toBe(BoolRef.True));
  test("pos == neg = false", () => expect(eqSigns(IntRef.Pos, IntRef.Neg)).toBe(BoolRef.False));
  test("pos == zero = false", () => expect(eqSigns(IntRef.Pos, IntRef.Zero)).toBe(BoolRef.False));
  test("pos != neg = true", () => expect(neqSigns(IntRef.Pos, IntRef.Neg)).toBe(BoolRef.True));
  test("zero != zero = false", () =>
    expect(neqSigns(IntRef.Zero, IntRef.Zero)).toBe(BoolRef.False));

  // Cases that MUST be top (soundness)
  test("pos > pos = top", () => expect(gtSigns(IntRef.Pos, IntRef.Pos)).toBe(BoolRef.Top));
  test("nonneg > zero = top", () => expect(gtSigns(IntRef.NonNeg, IntRef.Zero)).toBe(BoolRef.Top));
  test("nonneg > nonneg = top", () =>
    expect(gtSigns(IntRef.NonNeg, IntRef.NonNeg)).toBe(BoolRef.Top));
  test("top > top = top", () => expect(gtSigns(IntRef.Top, IntRef.Top)).toBe(BoolRef.Top));
  test("pos == pos = top", () => expect(eqSigns(IntRef.Pos, IntRef.Pos)).toBe(BoolRef.Top));

  // Cases from bug we found: nonneg > zero must NOT be "true" (0 > 0 is false)
  test("nonneg > zero is NOT true (0 > 0 = false)", () => {
    expect(gtSigns(IntRef.NonNeg, IntRef.Zero)).not.toBe(BoolRef.True);
  });
});

describe("transferBinaryOp with floats", () => {
  test("float + float = float (sign top)", () => {
    const result = transferBinaryOp("+", positiveFloat(), negativeFloat());
    expect(result.sound.kinds).toBe(FLOAT_BIT);
    expect(result.sound.floatRef).toBe(IntRef.Top);
  });

  test("posFloat + posFloat = posFloat", () => {
    const result = transferBinaryOp("+", positiveFloat(), positiveFloat());
    expect(result.sound.kinds).toBe(FLOAT_BIT);
    expect(result.sound.floatRef).toBe(IntRef.Pos);
  });

  test("int + float = float (per spec: promotion)", () => {
    const result = transferBinaryOp("+", positiveInteger(), positiveFloat());
    expect(result.sound.kinds).toBe(FLOAT_BIT);
  });

  test("float / float = float", () => {
    const result = transferBinaryOp("/", positiveFloat(), positiveFloat());
    expect(result.sound.kinds).toBe(FLOAT_BIT);
  });

  test("int / int = float (per spec: true division)", () => {
    const result = transferBinaryOp("/", positiveInteger(), positiveInteger());
    expect(result.sound.kinds).toBe(FLOAT_BIT);
  });
});

describe("transferBinaryOp with complex", () => {
  test("complex + anything numeric = complex", () => {
    const result = transferBinaryOp("+", complexValue(), positiveInteger());
    expect(result.sound.kinds).toBe(COMPLEX_BIT);
  });

  test("int + complex = complex", () => {
    const result = transferBinaryOp("+", positiveInteger(), complexValue());
    expect(result.sound.kinds).toBe(COMPLEX_BIT);
  });

  test("float + complex = complex", () => {
    const result = transferBinaryOp("+", positiveFloat(), complexValue());
    expect(result.sound.kinds).toBe(COMPLEX_BIT);
  });

  test("complex // int = TOP (not valid per spec)", () => {
    const result = transferBinaryOp("//", complexValue(), positiveInteger());
    expect(result).toBe(TOP);
  });

  test("complex % int = TOP (not valid per spec)", () => {
    const result = transferBinaryOp("%", complexValue(), positiveInteger());
    expect(result).toBe(TOP);
  });

  test("complex + string = TOP (non-numeric)", () => {
    const result = transferBinaryOp("+", complexValue(), stringValue());
    expect(result).toBe(TOP);
  });
});

describe("transferCompare with floats", () => {
  test("posFloat > zeroFloat = true", () => {
    const result = transferCompare(">", positiveFloat(), zeroFloat());
    expect(result.sound.boolRef).toBe(BoolRef.True);
  });

  test("posInt > posFloat = top (both positive, could be either)", () => {
    const result = transferCompare(">", positiveInteger(), positiveFloat());
    expect(result.sound.kinds).toBe(BOOL_BIT);
    expect(result.sound.boolRef).toBe(BoolRef.Top);
  });

  test("posInt > zeroFloat = true (mixed int/float sign analysis)", () => {
    const result = transferCompare(">", positiveInteger(), zeroFloat());
    expect(result.sound.kinds).toBe(BOOL_BIT);
    expect(result.sound.boolRef).toBe(BoolRef.True);
  });

  test("posInt == negFloat = false (mixed int/float sign analysis)", () => {
    const result = transferCompare("==", positiveInteger(), negativeFloat());
    expect(result.sound.kinds).toBe(BOOL_BIT);
    expect(result.sound.boolRef).toBe(BoolRef.False);
  });
});

describe("transferUnaryNeg with float", () => {
  test("-posFloat = negFloat", () => {
    const result = transferUnaryNeg(positiveFloat());
    expect(result.sound.kinds).toBe(FLOAT_BIT);
    expect(result.sound.floatRef).toBe(IntRef.Neg);
  });
});
