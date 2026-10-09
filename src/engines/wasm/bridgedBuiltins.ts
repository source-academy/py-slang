/**
 * Stdlib builtins the WASM engine reuses from the TypeScript stdlib groups
 * (src/stdlib/misc.ts, math.ts) through the `builtin.call` host import,
 * rather than re-implementing each one as WASM codegen — so their numeric
 * semantics and error messages cannot drift from the CSE machine's (the same
 * approach as py2js's stdlibBridge.ts). Only numeric/bool arguments cross the
 * boundary, which is all these functions accept.
 *
 * `arity` is the number of fixed parameters of the WASM-level function. With
 * `variadic`, the function additionally takes a rest list (WASM's own
 * `hasVarArgs` mechanism, which — unlike Python `*args` syntax — needs no
 * sublanguage support, so it works in every chapter); the host expands the
 * list into trailing arguments, and the stdlib builtin's own validation
 * reports a wrong argument count exactly as the CSE machine does.
 *
 * The array index of an entry is its id in the compiled code and in the host
 * import.
 */
export type BridgedBuiltin = {
  name: string;
  group: "misc" | "math";
  arity: 0 | 1 | 2 | 3;
  variadic: boolean;
};

const entry = (
  group: BridgedBuiltin["group"],
  arity: BridgedBuiltin["arity"],
  names: string[],
  variadic = false,
): BridgedBuiltin[] => names.map(name => ({ name, group, arity, variadic }));

export const BRIDGED_BUILTINS: BridgedBuiltin[] = [
  ...entry("misc", 0, ["random_random", "time_time"]),
  ...entry("misc", 1, ["abs", "real", "imag", "is_number", "is_integer"]),
  ...entry("misc", 1, ["round"], true),
  ...entry("misc", 0, ["complex"], true),
  ...entry("math", 1, [
    "math_acos",
    "math_acosh",
    "math_asin",
    "math_asinh",
    "math_atan",
    "math_atanh",
    "math_cbrt",
    "math_ceil",
    "math_cos",
    "math_cosh",
    "math_degrees",
    "math_erf",
    "math_erfc",
    "math_exp",
    "math_exp2",
    "math_expm1",
    "math_fabs",
    "math_factorial",
    "math_floor",
    "math_gamma",
    "math_isfinite",
    "math_isinf",
    "math_isnan",
    "math_isqrt",
    "math_lgamma",
    "math_log10",
    "math_log1p",
    "math_log2",
    "math_radians",
    "math_sin",
    "math_sinh",
    "math_sqrt",
    "math_tan",
    "math_tanh",
    "math_trunc",
    "math_ulp",
  ]),
  ...entry("math", 2, [
    "math_atan2",
    "math_comb",
    "math_copysign",
    "math_fmod",
    "math_ldexp",
    "math_nextafter",
    "math_pow",
    "math_remainder",
  ]),
  ...entry("math", 3, ["math_fma"]),
  ...entry("math", 1, ["math_log", "math_perm"], true),
  ...entry("math", 0, ["math_gcd", "math_lcm"], true),
];

/**
 * Stdlib builtins the WASM engine does not implement (yet): the resolver still
 * accepts them, since the other engines provide them, so the compiler reports
 * them as unsupported instead of as an undefined name.
 */
export const WASM_UNSUPPORTED_BUILTINS: ReadonlySet<string> = new Set([
  "input",
  "breakpoint",
  "set_timeout",
  "clear_all_timeout",
  "print_llist",
  "apply_in_underlying_python",
]);
