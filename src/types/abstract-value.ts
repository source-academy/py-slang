// src/types/abstract-value.ts

// Kind bitmask constants
export const INT_BIT = 1;
export const BOOL_BIT = 2;
export const STR_BIT = 4;
export const NULL_BIT = 8;
export const CLOSURE_BIT = 16;
export const FLOAT_BIT = 32;
export const COMPLEX_BIT = 64;
export const ALL_KINDS_MASK =
  INT_BIT | BOOL_BIT | STR_BIT | NULL_BIT | CLOSURE_BIT | FLOAT_BIT | COMPLEX_BIT;

// Power-set bitmask: join = OR, meet = AND
export const enum IntRef {
  Bottom = 0,
  Neg = 1,
  Zero = 2,
  Pos = 4,
  NonPos = Neg | Zero, // 3
  NonZero = Neg | Pos, // 5
  NonNeg = Zero | Pos, // 6
  Top = Neg | Zero | Pos, // 7
}

export const enum BoolRef {
  Bottom = 0,
  True = 1,
  False = 2,
  Top = True | False, // 3
}

export interface SoundType {
  readonly kinds: number;
  readonly intRef: IntRef;
  readonly boolRef: BoolRef;
  readonly floatRef: IntRef; // reuses IntRef enum for sign refinement
}

export interface AbstractValue {
  readonly sound: SoundType;
}

export type TypeEnv = ReadonlyMap<number, AbstractValue>;
