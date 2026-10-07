/**
 * Python-level definitions the WASM engine adds to every program, for stdlib
 * values that are easier to express in Python than as WASM codegen: the math
 * constants and min/max. (The numeric functions are bridged host-side
 * instead — see bridgedBuiltins.ts.)
 *
 * The prelude is compiled together with the user's program, so it is subject
 * to the same sublanguage restrictions: rest parameters and subscripts are
 * only available from §3, which is why min/max take exactly two arguments in
 * §1–2 but any number (at least two) from §3 on.
 */
const CONSTANTS = `
math_pi = 3.141592653589793
math_e = 2.718281828459045
math_tau = 6.283185307179586
math_inf = 1e308 * 1e308
math_nan = math_inf - math_inf
`;

const MIN_MAX_TWO_ARGUMENTS = `
def max(first, second):
    if second > first:
        return second
    else:
        return first

def min(first, second):
    if second < first:
        return second
    else:
        return first
`;

const MIN_MAX_VARIADIC = `
def max(first, second, *rest):
    best = first
    if second > best:
        best = second
    i = 0
    while i < len(rest):
        if rest[i] > best:
            best = rest[i]
        i = i + 1
    return best

def min(first, second, *rest):
    best = first
    if second < best:
        best = second
    i = 0
    while i < len(rest):
        if rest[i] < best:
            best = rest[i]
        i = i + 1
    return best
`;

export const wasmMiscPrelude = (chapter: number): string =>
  CONSTANTS + (chapter >= 3 ? MIN_MAX_VARIADIC : MIN_MAX_TWO_ARGUMENTS);

/** `stream(a, b, ...)`: a TypeScript builtin in the CSE stdlib, so the shared
 * stream prelude (stdlib/stream.prelude.ts) does not define it. Only used from
 * §3, where rest parameters and subscripts are allowed. */
export const WASM_STREAM_PRELUDE = `
def stream(*xs):
    def build(i):
        if i == len(xs):
            return None
        else:
            return pair(xs[i], lambda: build(i + 1))
    return build(0)
`;
