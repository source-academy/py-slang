export enum OpCodes {
  NOP = 0,
  LDCI = 1, // integer
  LGCI = 2, // integer
  LDCF32 = 3, // 32-bit float
  LGCF32 = 4, // 32-bit float
  LDCF64 = 5, // 64-bit float
  LGCF64 = 6, // 64-bit float
  LDCB0 = 7,
  LDCB1 = 8,
  LGCB0 = 9,
  LGCB1 = 10,
  LGCU = 11,
  LGCN = 12,
  LGCS = 13, // string
  POPG = 14,
  POPB = 15,
  POPF = 16,
  ADDG = 17,
  ADDF = 18,
  SUBG = 19,
  SUBF = 20,
  MULG = 21,
  MULF = 22,
  DIVG = 23,
  DIVF = 24,
  MODG = 25,
  MODF = 26,
  NOTG = 27,
  NOTB = 28,
  LTG = 29,
  LTF = 30,
  GTG = 31,
  GTF = 32,
  LEG = 33,
  LEF = 34,
  GEG = 35,
  GEF = 36,
  EQG = 37,
  EQF = 38,
  EQB = 39,
  NEWC = 40, // Address of function
  NEWA = 41,
  LDLG = 42, // index in current env
  LDLF = 43, // index in current env
  LDLB = 44, // index in current env
  STLG = 45, // index in current env
  STLB = 46, // index in current env
  STLF = 47, // index in current env
  LDPG = 48, // index in env, index of parent relative to current env
  LDPF = 49, // index in env, index of parent relative to current env
  LDPB = 50, // index in env, index of parent relative to current env
  STPG = 51, // index in env, index of parent relative to current env
  STPB = 52, // index in env, index of parent relative to current env
  STPF = 53, // index in env, index of parent relative to current env
  LDAG = 54,
  LDAB = 55,
  LDAF = 56,
  STAG = 57,
  STAB = 58,
  STAF = 59,
  BRT = 60, // Offset
  BRF = 61, // Offset
  BR = 62, // Offset
  JMP = 63, // Address
  CALL = 64, // number of arguments
  CALLT = 65, // number of arguments
  CALLP = 66, // id of primitive function, number of arguments
  CALLTP = 67, // id of primitive function, number of arguments
  CALLV = 68, // id of vm-internal function, number of arguments
  CALLTV = 69, // id of vm-internal function, number of arguments
  RETG = 70,
  RETF = 71,
  RETB = 72,
  // Returns JS `undefined` -- not Python's `None` (that's RETG/RETN with a
  // real value already on the stack) -- for a caller that has no return
  // value to speak of at all, not even a Python one. Requires nothing on
  // the stack itself (see PVMLIRBuilder's STACK_EFFECTS[RETU] = 0): the
  // interpreter pushes `undefined` internally before returning. Used by
  // PVMLCompiler's visitFileInputStmt, since a whole Python script (exec(),
  // not a function call) has no return value at all in this dialect.
  RETU = 73,
  RETN = 74,
  DUP = 75,
  NEWENV = 76, // number of locals in new environment
  POPENV = 77,
  NEWCP = 78,
  NEWCV = 79,
  NEGG = 80,
  NEGF = 81,
  NEQG = 82,
  NEQF = 83,
  NEQB = 84,
  EQP = 85, // pointer/identity equality (is)
  NEQP = 86, // pointer/identity inequality (is not)
  FLOORDIVG = 87,
  FLOORDIVF = 88,
  NEWITER = 89,
  FOR_ITER = 90,
  // §1/§2-restricted comparison opcodes: bool (and, for EQG12/NEQG12, function)
  // operands are rejected outright, matching docs/specs/python_typing_middle_12.tex
  // (bool/function excluded from ==/!=; ordering never admits bool). The
  // unqualified EQG/NEQG/LTG/GTG/LEG/GEG opcodes are the §3/§4 semantics
  // instead (bool participates as the int it is — python_typing_middle_34.tex).
  // The PVML compiler picks between the two based on the chapter it's
  // compiling for, so neither the compiler's downstream consumers nor the
  // interpreter need a runtime "which chapter is this" check — see
  // PVMLCompiler's `variant` field and getCompareOpCode().
  EQG12 = 91,
  NEQG12 = 92,
  LTG12 = 93,
  GTG12 = 94,
  LEG12 = 95,
  GEG12 = 96,
  // Name-indexed global variable access, distinct from LDLG/LDPG/STLG/STPG's
  // fixed-size-array-slot model: Python's module/global scope can gain brand
  // new names at any time (`global x` introducing a name with no top-level
  // assignment; a REPL session where chunk N+1 defines a name chunk N didn't
  // have), which a statically-sized array can't accommodate without knowing
  // every global up front. LDGG/STGG instead read/write a dynamically-growable
  // name-indexed store (see PVMLInterpreter's globalEnv), so the interpreter/VM
  // never needs to know a program's full set of globals ahead of time. Opt-in
  // at the compiler level (PVMLCompiler's `useGlobalMap`, off by default) —
  // only py-slang's own PVMLInterpreter, for its incremental/persistent
  // (browser REPL) use case, ever needs this; every other consumer (native
  // Pynter's single-shot prelude+script compilation, the test suite) keeps
  // using the plain slot-based module environment unchanged.
  LDGG = 97,
  STGG = 98,
  // Loads an arbitrary-precision int literal from the bigint constant pool
  // (PVMLIR's `bigints`, indexed by this opcode's arg1 — mirrors LGCS's
  // string-constant-pool encoding, needed because arg1s is a Float64Array
  // and can't carry a bigint payload beyond float64 precision directly).
  // Browser-pathway only, matching the CSE machine's own bigint/number int-
  // float split (full-power desktop browser use case — see PVMLCompiler's
  // visitBigIntLiteralExpr). Native Pynter has no equivalent and isn't meant
  // to: its NaN-boxed ints are a deliberately narrow 20-bit range (embedded/
  // microcontroller target), nowhere near needing arbitrary precision.
  LGCBI = 99,
  // Loads a complex literal from the complex constant pool (PVMLIR's
  // `complexes`, indexed by this opcode's arg1 — mirrors LGCBI's bigint-
  // constant-pool encoding exactly, needed because arg1s (Float64Array)
  // can't carry a real+imaginary pair). Browser-pathway only, matching the
  // CSE machine's own complex-number support (full-power desktop browser
  // use case — see PVMLCompiler's visitComplexExpr). Native Pynter has zero
  // complex-number support and isn't meant to gain any.
  LGCC = 100,
  // Generic exponentiation (`**`), all numeric types (int/float/complex) —
  // added alongside complex numbers since raising to a complex power, or a
  // number to a complex power, is a real, non-corner-case operation
  // (see PVMLInterpreter's powArith). No chapter-gated variant needed: `**`
  // has no bool-exclusion rule distinguishing §1/§2 from §3/§4, unlike
  // ==/!=/ordering (see EQG12 etc. above).
  POWG = 101,
  // Call with the argument list taken from a runtime array rather than a
  // compile-time-fixed count of stack slots (contrast CALL/CALLT's `numArgs`
  // operand) — needed for call-site argument spreading (`f(*xs)`), where the
  // spread source's length isn't known until runtime. Stack layout: [...
  // func argsArray] with argsArray on top; pops both, dispatches exactly
  // like CALL/CALLT would with argsArray.elements as the argument list (see
  // PVMLInterpreter's dispatchCall). Deliberately *not* CALL/CALLT
  // themselves gaining a "dynamic count" mode: those are opcodes ≤
  // PYNTER_OPCODE_MAX, shared with native Pynter, whose semantics can't
  // change. Nullary — no operand at all, unlike every other CALL* opcode,
  // since both the callee and the argument list are already runtime values
  // on the stack by the time this executes. Browser-pathway only; native
  // Pynter has no representation for a runtime-variable-arity call (see
  // PVMLCompiler's visitStarredExpr / visitCallExpr's spread-argument path).
  CALLA = 102,
  CALLTA = 103,
}

export const OPCODE_MAX = 103;

/**
 * Pynter's maximum supported opcode (op_neq_p = 0x56). Opcodes above this
 * value (FLOORDIVG/FLOORDIVF/NEWITER/FOR_ITER, and the EQG12/NEQG12/LTG12/
 * GTG12/LEG12/GEG12 §1/§2-restricted comparisons) are py-slang extensions not
 * implemented natively by Pynter (nor by the WASM Sinter/Pynter port). The
 * §1/§2 comparison opcodes in particular will never need to be, since the
 * native Pynter pathway is permanently gated to Python §3 only (see
 * pvml-runner.ts) — only py-slang's own PVMLInterpreter ever executes them.
 * EQP/NEQP (is/is not) are below this threshold — Pynter implements them.
 */
export const PYNTER_OPCODE_MAX = 0x56; // 86

const UNSUPPORTED_OPCODE_FEATURES: Record<number, string> = {
  [OpCodes.FLOORDIVG]: "floor division (//)",
  [OpCodes.FLOORDIVF]: "floor division (//)",
  [OpCodes.NEWITER]: "for loops",
  [OpCodes.FOR_ITER]: "for loops",
  [OpCodes.EQG12]: "§1/§2 comparison semantics",
  [OpCodes.NEQG12]: "§1/§2 comparison semantics",
  [OpCodes.LTG12]: "§1/§2 comparison semantics",
  [OpCodes.GTG12]: "§1/§2 comparison semantics",
  [OpCodes.LEG12]: "§1/§2 comparison semantics",
  [OpCodes.GEG12]: "§1/§2 comparison semantics",
  [OpCodes.LDGG]: "incremental/persistent global variables",
  [OpCodes.STGG]: "incremental/persistent global variables",
  [OpCodes.LGCBI]: "arbitrary-precision integers",
  [OpCodes.LGCC]: "complex numbers",
  [OpCodes.POWG]: "exponentiation (**)",
  [OpCodes.CALLA]: "call-site argument spreading (*args)",
  [OpCodes.CALLTA]: "call-site argument spreading (*args)",
};

/**
 * Returns a human-readable description of an opcode that exceeds
 * Pynter's supported range, or a generic fallback.
 */
export function unsupportedOpcodeMessage(opcode: number): string {
  const feature = UNSUPPORTED_OPCODE_FEATURES[opcode];
  const name = OpCodes[opcode] ?? `opcode ${opcode}`;
  if (feature) {
    return `${name}: ${feature} is not supported by the Pynter backend`;
  }
  return `${name} (opcode ${opcode}) is not supported by the Pynter backend`;
}

export function getInstructionSize(opcode: OpCodes): number {
  switch (opcode) {
    case OpCodes.LDLG:
    case OpCodes.LDLF:
    case OpCodes.LDLB:
    case OpCodes.STLG:
    case OpCodes.STLF:
    case OpCodes.STLB:
    case OpCodes.CALL:
    case OpCodes.CALLT:
    case OpCodes.NEWENV:
    case OpCodes.NEWCP:
    case OpCodes.NEWCV:
      return 2;

    case OpCodes.LDPG:
    case OpCodes.LDPF:
    case OpCodes.LDPB:
    case OpCodes.STPG:
    case OpCodes.STPF:
    case OpCodes.STPB:
    case OpCodes.CALLP:
    case OpCodes.CALLTP:
    case OpCodes.CALLV:
    case OpCodes.CALLTV:
      return 3;

    case OpCodes.LDCI:
    case OpCodes.LGCI:
    case OpCodes.LDCF32:
    case OpCodes.LGCF32:
    case OpCodes.LGCS:
    case OpCodes.NEWC:
    case OpCodes.BRF:
    case OpCodes.BRT:
    case OpCodes.BR:
    case OpCodes.JMP:
    case OpCodes.FOR_ITER:
    case OpCodes.LDGG:
    case OpCodes.STGG:
    case OpCodes.LGCBI:
    case OpCodes.LGCC:
      return 5;

    case OpCodes.LDCF64:
    case OpCodes.LGCF64:
      return 9;

    default:
      return 1;
  }
}

export default OpCodes;
