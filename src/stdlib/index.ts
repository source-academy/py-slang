import { BuiltInFunctions, builtInConstants, builtIns } from '../stdlib';
import { Value } from '../cse-machine/stash';
import { ControlItem } from '../cse-machine/control';
import { Context } from '../cse-machine/context';

// Chapter 1: Basic Python functions (SOURCE_1 equivalent)
export const chapter_1 = {
  // Basic functions
  _int: BuiltInFunctions._int,
  _int_from_string: BuiltInFunctions._int_from_string,
  abs: BuiltInFunctions.abs,
  error: BuiltInFunctions.error,
  isinstance: BuiltInFunctions.isinstance,
  str: BuiltInFunctions.str,
  print: BuiltInFunctions.print,
  input: BuiltInFunctions.input,
  
  // Math functions
  math_acos: BuiltInFunctions.math_acos,
  math_acosh: BuiltInFunctions.math_acosh,
  math_asin: BuiltInFunctions.math_asin,
  math_asinh: BuiltInFunctions.math_asinh,
  math_atan: BuiltInFunctions.math_atan,
  math_atan2: BuiltInFunctions.math_atan2,
  math_atanh: BuiltInFunctions.math_atanh,
  math_cos: BuiltInFunctions.math_cos,
  math_cosh: BuiltInFunctions.math_cosh,
  math_degrees: BuiltInFunctions.math_degrees,
  math_erf: BuiltInFunctions.math_erf,
  math_erfc: BuiltInFunctions.math_erfc,
  char_at: BuiltInFunctions.char_at,
  math_comb: BuiltInFunctions.math_comb,
  math_factorial: BuiltInFunctions.math_factorial,
  math_gcd: BuiltInFunctions.math_gcd,
  math_isqrt: BuiltInFunctions.math_isqrt,
  math_lcm: BuiltInFunctions.math_lcm,
  math_perm: BuiltInFunctions.math_perm,
  math_ceil: BuiltInFunctions.math_ceil,
  math_fabs: BuiltInFunctions.math_fabs,
  math_floor: BuiltInFunctions.math_floor,
  math_fma: BuiltInFunctions.math_fma,
  math_fmod: BuiltInFunctions.math_fmod,
  math_remainder: BuiltInFunctions.math_remainder,
  math_trunc: BuiltInFunctions.math_trunc,
  math_copysign: BuiltInFunctions.math_copysign,
  math_isfinite: BuiltInFunctions.math_isfinite,
  math_isinf: BuiltInFunctions.math_isinf,
  math_isnan: BuiltInFunctions.math_isnan,
  math_ldexp: BuiltInFunctions.math_ldexp,
  math_nextafter: BuiltInFunctions.math_nextafter,
  math_ulp: BuiltInFunctions.math_ulp,
  math_cbrt: BuiltInFunctions.math_cbrt,
  math_exp: BuiltInFunctions.math_exp,
  math_exp2: BuiltInFunctions.math_exp2,
  math_expm1: BuiltInFunctions.math_expm1,
  math_gamma: BuiltInFunctions.math_gamma,
  math_lgamma: BuiltInFunctions.math_lgamma,
  math_log: BuiltInFunctions.math_log,
  math_log10: BuiltInFunctions.math_log10,
  math_log1p: BuiltInFunctions.math_log1p,
  math_log2: BuiltInFunctions.math_log2,
  math_pow: BuiltInFunctions.math_pow,
  math_radians: BuiltInFunctions.math_radians,
  math_sin: BuiltInFunctions.math_sin,
  math_sinh: BuiltInFunctions.math_sinh,
  math_tan: BuiltInFunctions.math_tanh,
  math_tanh: BuiltInFunctions.math_tanh,
  math_sqrt: BuiltInFunctions.math_sqrt,
  max: BuiltInFunctions.max,
  min: BuiltInFunctions.min,
  random_random: BuiltInFunctions.random_random,
  round: BuiltInFunctions.round,
  time_time: BuiltInFunctions.time_time,
};

// Chapter 2: List functions (SOURCE_2 equivalent)
export const chapter_2 = {
  ...chapter_1,  // Inherit all chapter 1 functions
  pair: BuiltInFunctions.pair,
  head: BuiltInFunctions.head,
  tail: BuiltInFunctions.tail,
  is_null: BuiltInFunctions.is_null,
  is_pair: BuiltInFunctions.is_pair,
  list: BuiltInFunctions.list,
  length: BuiltInFunctions.length,
  map: BuiltInFunctions.map,
  filter: BuiltInFunctions.filter,
  accumulate: BuiltInFunctions.accumulate,
  append: BuiltInFunctions.append,
  reverse: BuiltInFunctions.reverse,
  list_ref: BuiltInFunctions.list_ref,
  member: BuiltInFunctions.member,
  remove: BuiltInFunctions.remove,
  remove_all: BuiltInFunctions.remove_all,
  equal: BuiltInFunctions.equal,
  build_list: BuiltInFunctions.build_list,
  for_each: BuiltInFunctions.for_each,
  enum_list: BuiltInFunctions.enum_list,
};

// Chapter 3: Advanced features (SOURCE_3 equivalent)
export const chapter_3 = {
  ...chapter_2,  // Inherit all chapter 2 functions
  // Add more advanced functions here as they're implemented
};

// Chapter 4: Full Python features (SOURCE_4 equivalent)
export const chapter_4 = {
  ...chapter_3,  // Inherit all chapter 3 functions
  // Add full Python features here
};

// Library parser chapter
export const library_parser = {
  ...chapter_4,  // Inherit all chapter 4 functions
  // Add library-specific functions here
};

// Type definitions for chapters
export type Chapter = 1 | 2 | 3 | 4 | 'LIBRARY_PARSER';

// Function to get chapter functions
export function getChapterFunctions(chapter: Chapter) {
  switch (chapter) {
    case 1:
      return chapter_1;
    case 2:
      return chapter_2;
    case 3:
      return chapter_3;
    case 4:
      return chapter_4;
    case 'LIBRARY_PARSER':
      return library_parser;
    default:
      throw new Error(`Unknown chapter: ${chapter}`);
  }
}

// Function to get chapter constants
export function getChapterConstants(chapter: Chapter) {
  // All chapters have the same constants for now
  return builtInConstants;
}

// Helper function to define builtin in context
export function defineBuiltin(
  context: Context,
  name: string,
  func: (...args: any[]) => any,
  arity?: number
) {
  const closure = {
    type: 'closure' as const,
    node: null,
    environment: null,
    predefined: true,
    apply: (ctx: Context, args: Value[]) => {
      return func(args, '', {} as ControlItem, ctx);
    }
  };
  
  context.nativeStorage.builtins.set(name, closure);
}

// Function to import builtins for a specific chapter
export function importBuiltins(context: Context, chapter: Chapter) {
  const functions = getChapterFunctions(chapter);
  
  for (const [name, func] of Object.entries(functions)) {
    defineBuiltin(context, name, func);
  }
  
  // Import constants
  const constants = getChapterConstants(chapter);
  for (const [name, value] of constants) {
    context.nativeStorage.builtins.set(name, value);
  }
} 