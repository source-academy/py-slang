// src/types/lattice-ops.ts
import {
  type IntRef,
  type BoolRef,
  type SoundType,
  type AbstractValue,
  INT_BIT,
  BOOL_BIT,
  STR_BIT,
  NULL_BIT,
  CLOSURE_BIT,
  FLOAT_BIT,
  COMPLEX_BIT,
  ALL_KINDS_MASK,
} from "./abstract-value";

// Re-export IntRef and BoolRef for consumers that import from lattice-ops
export { IntRef, BoolRef } from "./abstract-value";

// ---- Lattice operations (pure bitwise) ----

export function joinIntRef(a: IntRef, b: IntRef): IntRef {
  return a | b;
}
export function meetIntRef(a: IntRef, b: IntRef): IntRef {
  return a & b;
}
export function leqIntRef(a: IntRef, b: IntRef): boolean {
  return (a & b) === a;
}

export function joinBoolRef(a: BoolRef, b: BoolRef): BoolRef {
  return a | b;
}
export function meetBoolRef(a: BoolRef, b: BoolRef): BoolRef {
  return a & b;
}
export function leqBoolRef(a: BoolRef, b: BoolRef): boolean {
  return (a & b) === a;
}

// ---- SoundType operations ----

function joinSound(a: SoundType, b: SoundType): SoundType {
  const kinds = a.kinds | b.kinds;
  const intRef = kinds & INT_BIT ? joinIntRef(a.intRef, b.intRef) : (0 as IntRef);
  const boolRef = kinds & BOOL_BIT ? joinBoolRef(a.boolRef, b.boolRef) : (0 as BoolRef);
  const floatRef = kinds & FLOAT_BIT ? joinIntRef(a.floatRef, b.floatRef) : (0 as IntRef);
  return { kinds, intRef, boolRef, floatRef };
}

function meetSound(a: SoundType, b: SoundType): SoundType {
  const kinds = a.kinds & b.kinds;
  const intRef = kinds & INT_BIT ? meetIntRef(a.intRef, b.intRef) : (0 as IntRef);
  const boolRef = kinds & BOOL_BIT ? meetBoolRef(a.boolRef, b.boolRef) : (0 as BoolRef);
  const floatRef = kinds & FLOAT_BIT ? meetIntRef(a.floatRef, b.floatRef) : (0 as IntRef);
  return { kinds, intRef, boolRef, floatRef };
}

function leqSound(a: SoundType, b: SoundType): boolean {
  if ((a.kinds & ~b.kinds) !== 0) return false;
  if (a.kinds & INT_BIT && !leqIntRef(a.intRef, b.intRef)) return false;
  if (a.kinds & BOOL_BIT && !leqBoolRef(a.boolRef, b.boolRef)) return false;
  if (a.kinds & FLOAT_BIT && !leqIntRef(a.floatRef, b.floatRef)) return false;
  return true;
}

// ---- AbstractValue operations ----

export function join(a: AbstractValue, b: AbstractValue): AbstractValue {
  if (a === b) return a;
  return { sound: joinSound(a.sound, b.sound) };
}

export function meet(a: AbstractValue, b: AbstractValue): AbstractValue {
  if (a === b) return a;
  return { sound: meetSound(a.sound, b.sound) };
}

export function leq(a: AbstractValue, b: AbstractValue): boolean {
  if (a === b) return true;
  return leqSound(a.sound, b.sound);
}

// ---- Frozen singletons ----

function makeSingleton(
  kinds: number,
  intRef: IntRef,
  boolRef: BoolRef,
  floatRef: IntRef = 0 as IntRef,
): AbstractValue {
  return Object.freeze({ sound: Object.freeze({ kinds, intRef, boolRef, floatRef }) });
}

const INT_SINGLETONS: AbstractValue[] = [];
for (let r = 0; r < 8; r++) {
  INT_SINGLETONS[r] = makeSingleton(INT_BIT, r as IntRef, 0 as BoolRef);
}

const BOOL_SINGLETONS: AbstractValue[] = [];
for (let r = 0; r < 4; r++) {
  BOOL_SINGLETONS[r] = makeSingleton(BOOL_BIT, 0 as IntRef, r as BoolRef);
}

const FLOAT_SINGLETONS: AbstractValue[] = [];
for (let r = 0; r < 8; r++) {
  FLOAT_SINGLETONS[r] = makeSingleton(FLOAT_BIT, 0 as IntRef, 0 as BoolRef, r as IntRef);
}

export const TOP: AbstractValue = makeSingleton(
  ALL_KINDS_MASK,
  7 as IntRef,
  3 as BoolRef,
  7 as IntRef,
);
export const BOTTOM: AbstractValue = makeSingleton(0, 0 as IntRef, 0 as BoolRef);
export const STRING_VAL: AbstractValue = makeSingleton(STR_BIT, 0 as IntRef, 0 as BoolRef);
export const NULL_VAL: AbstractValue = makeSingleton(NULL_BIT, 0 as IntRef, 0 as BoolRef);
export const CLOSURE_VAL: AbstractValue = makeSingleton(CLOSURE_BIT, 0 as IntRef, 0 as BoolRef);
export const COMPLEX_VAL: AbstractValue = makeSingleton(COMPLEX_BIT, 0 as IntRef, 0 as BoolRef);

// ---- Constructor functions (zero allocation — singleton lookups) ----

export function integer(intRef: IntRef = 7 as IntRef): AbstractValue {
  return INT_SINGLETONS[intRef];
}
export function positiveInteger(): AbstractValue {
  return INT_SINGLETONS[4];
} // IntRef.Pos
export function negativeInteger(): AbstractValue {
  return INT_SINGLETONS[1];
} // IntRef.Neg
export function zeroInteger(): AbstractValue {
  return INT_SINGLETONS[2];
} // IntRef.Zero

export function boolean(boolRef: BoolRef = 3 as BoolRef): AbstractValue {
  return BOOL_SINGLETONS[boolRef];
}
export function trueValue(): AbstractValue {
  return BOOL_SINGLETONS[1];
} // BoolRef.True
export function falseValue(): AbstractValue {
  return BOOL_SINGLETONS[2];
} // BoolRef.False

/** Default IntRef.Top covers NaN (no meaningful sign). */
export function floatValue(floatRef: IntRef = 7 as IntRef): AbstractValue {
  return FLOAT_SINGLETONS[floatRef];
}
export function positiveFloat(): AbstractValue {
  return FLOAT_SINGLETONS[4]; // IntRef.Pos
}
export function negativeFloat(): AbstractValue {
  return FLOAT_SINGLETONS[1]; // IntRef.Neg
}
export function zeroFloat(): AbstractValue {
  return FLOAT_SINGLETONS[2]; // IntRef.Zero
}

export function complexValue(): AbstractValue {
  return COMPLEX_VAL;
}

export function stringValue(): AbstractValue {
  return STRING_VAL;
}
export function nullValue(): AbstractValue {
  return NULL_VAL;
}
export function closureValue(): AbstractValue {
  return CLOSURE_VAL;
}
