import { Value } from "../cse-machine/stash";
import { toPythonString } from "../stdlib";
import { runCSEMachine } from "./utils";

// _int
test('No argument defaults to 0', () => {
    const code = `
_int()
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('0');
});

test('Positive integer input', () => {
    const code = `
_int(42)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('42');
});

test('Negative integer input', () => {
    const code = `
_int(-42)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('-42');
});

test('Zero input returns 0', () => {
    const code = `
_int(0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('0');
});

test('Positive float is truncated toward 0', () => {
    const code = `
_int(3.9)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('3');
});

test('Negative float is truncated toward 0', () => {
    const code = `
_int(-3.9)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('-3');
});

test('Large positive integer input', () => {
    const code = `
_int(987654321098765432109876543210987654321098765432109876543210)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('987654321098765432109876543210987654321098765432109876543210');
});

test('Large negative integer input', () => {
    const code = `
_int(-987654321098765432109876543210987654321098765432109876543210)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('-987654321098765432109876543210987654321098765432109876543210');
});

test('Large float truncated toward 0', () => {
    const code = `
_int(-9876543210987654321098765432109876543210987654321098765432.10)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('-9876543210987653968469877154705327859942496456145853480960');
});

// _int_from_string
test('Default base (decimal) with a simple number string', () => {
    const code = `
_int_from_string("123")
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('123');
});
  
test('Explicit default base (decimal) with a simple number string', () => {
    const code = `
_int_from_string("456", 10)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('456');
});

test('Whitespace around number in decimal', () => {
    const code = `
_int_from_string("   42  ", 10)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('42');
});

test('Underscores in decimal string', () => {
    const code = `
_int_from_string("1_234_567", 10)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('1234567');
});

test('Binary base=2', () => {
    const code = `
_int_from_string("1011", 2)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('11');
});

test('Octal base=8', () => {
    const code = `
_int_from_string("377", 8)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('255');
});
  
test('Hex base=16', () => {
    const code = `
_int_from_string("FF", 16)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('255');
});
  
test('Base=36', () => {
    const code = `
_int_from_string("Z", 36)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('35');
});

// abs
test('abs of a positive integer', () => {
    const code = `
abs(5)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("5");
});
  
test('abs of a negative integer', () => {
    const code = `
abs(-10)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("10");
});
  
test('abs of zero integer', () => {
    const code = `
abs(0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0");
});
  
test('abs of a positive float', () => {
    const code = `
abs(3.14)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("3.14");
});
  
test('abs of a negative float', () => {
    const code = `
abs(-2.718)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("2.718");
});
  
test('abs of minus float zero', () => {
    const code = `
abs(-0.0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.0");
});
  
test('abs of complex with positive real, positive imag', () => {
    const code = `
abs(3+4j)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("5.0");
});
  
test('abs of complex with negative real, positive imag', () => {
    const code = `
abs(-5+12j)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("13.0");
});
  
test('abs of complex zero', () => {
    const code = `
abs(0+0j)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.0");
});

// char_at
test('char_at with valid index (beginning of string)', () => {
    const code = `
char_at("hello", 0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("h");
});
  
test('char_at with valid index (end of string)', () => {
    const code = `
char_at("hello", 4)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("o");
});
  
test('char_at with valid index (middle of string)', () => {
    const code = `
char_at("hello", 1)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("e");
});
  
test('char_at with index equal to string length => None', () => {
    const code = `
char_at("hello", 5)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("None");
});
  
test('char_at with index > string length => None', () => {
    const code = `
char_at("hello", 10)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("None");
});
  
test('char_at with empty string', () => {
    const code = `
char_at("", 0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("None");
});

// error
test('error with single string argument throws an exception', () => {
    const code = `
error("Something went wrong!")
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("Error: Something went wrong!\n");
});

test('error with multiple arguments throws an exception', () => {
    const code = `
error(404, "Not Found")
`;

    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("Error: 404 Not Found\n");
});

// isinstance
test('isinstance(42, int) => True', () => {
    const code = `
isinstance(42, 'int')
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("True");
});
  
test('isinstance(3.14, float) => True', () => {
    const code = `
isinstance(3.14, 'float')
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("True");
});
  
test('isinstance("hello", string) => True', () => {
    const code = `
isinstance("hello", 'string')
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("True");
});
  
test('isinstance(2+3j, complex) => True', () => {
    const code = `
isinstance(2+3j, 'complex')
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("True");
});
  
test('isinstance(None, NoneType) => True', () => {
    const code = `
isinstance(None, 'NoneType')
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("True");
});
  
test('isinstance(True, bool) => True', () => {
    const code = `
isinstance(True, 'bool')
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("True");
});
  
test('isinstance("hello", int) => False', () => {
    const code = `
isinstance("hello", 'int')
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("False");
});

// math_acos
test('math_acos(1) => 0', () => {
    const code = `
math_acos(1)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.0");
});
  
test('math_acos(0) => pi/2', () => {
    const code = `
math_acos(0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1.5707963267948966");
});
  
// math_acosh
test('math_acosh(1) => 0', () => {
    const code = `
math_acosh(1)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.0");
});
  
test('math_acosh(2) => ~1.316957', () => {
    const code = `
math_acosh(2)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1.3169578969248166");
});

// math_asin
test('math_asin(0) => 0', () => {
    const code = `
math_asin(0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.0");
});
  
test('math_asin(1) => pi/2', () => {
    const code = `
math_asin(1)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1.5707963267948966");
});

//math_asinh
test('math_asinh(0) => 0', () => {
    const code = `
math_asinh(0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.0");
});
  
test('math_asinh(1) => ~0.881373', () => {
    const code = `
math_asinh(1)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.881373587019543");
});
  
// math_atan
test('math_atan(0) => 0', () => {
    const code = `
math_atan(0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.0");
});
  
test('math_atan(1) => pi/4', () => {
    const code = `
math_atan(1)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.7853981633974483");
});
  
// math_atan2
test('math_atan2(0, 1) => 0', () => {
    const code = `
math_atan2(0, 1)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.0");
});
  
test('math_atan2(1, 3)', () => {
    const code = `
math_atan2(1, 3)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.3217505543966422");
});

// math_atanh
test('math_atanh(0) => 0', () => {
    const code = `
math_atanh(0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.0");
});
  
test('math_atanh(0.5) => ~0.549306', () => {
    const code = `
math_atanh(0.5)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.5493061443340549");
});

// math_cbrt
test('math_cbrt: perfect cube positive (27 => 3)', () => {
    const code = `
math_cbrt(27)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("3.0");
});
  
test('math_cbrt: perfect cube negative (-8 => -2)', () => {
    const code = `
math_cbrt(-8)
`;
    const result = runCSEMachine(code);
    // -8 的立方根为 -2
    expect(toPythonString(result as Value)).toBe("-2.0");
});
  
test('math_cbrt: zero (0 => 0)', () => {
    const code = `
math_cbrt(0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.0");
});
  
test('math_cbrt: non-perfect cube positive (2)', () => {
    const code = `
math_cbrt(2)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1.2599210498948732");
});
  
// math_ceil
test('math_ceil: integer input (3 => 3)', () => {
    const code = `
math_ceil(3)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("3");
});
  
test('math_ceil: positive float (3.14 => 4)', () => {
    const code = `
math_ceil(3.14)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("4");
});
  
test('math_ceil: negative float (-3.14 => -3)', () => {
    const code = `
math_ceil(-3.14)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("-3");
});
  
test('math_ceil: zero (0 => 0)', () => {
    const code = `
math_ceil(0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0");
});
  
// math_comb(n, k)
test('math_comb: when k > n returns 0', () => {
    const code = `
math_comb(3, 5)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0");
});
  
test('math_comb: when k equals n returns 1', () => {
    const code = `
math_comb(5, 5)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1");
});
  
test('math_comb: choosing 0 items returns 1', () => {
    const code = `
math_comb(7, 0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1");
});
  
test('math_comb: choose 2 items out of 5 returns 10', () => {
    const code = `
math_comb(5, 2)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("10");
});
  
// math_copysign
test('math_copysign: positive x and negative y returns -x', () => {
    const code = `
math_copysign(3.14, -0.00000005657789)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("-3.14");
});
  
test('math_copysign: negative x and positive y returns positive magnitude', () => {
    const code = `
math_copysign(-5, 1)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("5.0");
});
  
// math_cos
test('math_cos: cosine of 0 radians returns 1', () => {
    const code = `
math_cos(0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1.0");
});
  
test('math_cos: cosine of pi returns -1', () => {
    const code = `
math_cos(3.141592653589793)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("-1.0");
});
  
// math_cosh(x)
test('math_cosh: hyperbolic cosine of 0 returns 1', () => {
    const code = `
math_cosh(0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1.0");
});
  
test('math_cosh: hyperbolic cosine of 1 returns approximately 1.5430806348152437', () => {
    const code = `
math_cosh(1)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1.5430806348152437");
});
  
// math_degrees(x)
test('math_degrees: convert 0 radians to 0 degrees', () => {
    const code = `
math_degrees(0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.0");
});
  
test('math_degrees: convert pi/2 radians to 90 degrees', () => {
    const code = `
math_degrees(1.5707963267948966)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("90.0");
});
  
test('math_degrees: convert pi/2 radians to ~45 degrees', () => {
    const code = `
math_degrees(0.8)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("45.836623610465864");
});

// math_erf(x)
test('math_erf: erf(0) returns 0', () => {
    const code = `
math_erf(0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.0");
});

test('math_erf: erf(1) returns approximately 0.8427007929497148', () => {
    const code = `
math_erf(1)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.8427007929497148");
});
  
test('math_erf: erf(0.3) returns approximately 0.32862675945912734', () => {
    const code = `
math_erf(0.3)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.32862675945912734");
});

// math_exp(x)
test('math_exp: exp(0) returns 1', () => {
    const code = `
math_exp(0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1.0");
});
  
test('math_exp: exp(1) returns approximately 2.718281828459045', () => {
    const code = `
math_exp(1)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("2.718281828459045");
});

test('math_exp: exp(1.5) returns approximately 4.4816890703380645', () => {
    const code = `
math_exp(1.5)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("4.4816890703380645");
});
  
// math_exp2
test('math_exp2: exp2(0) returns 1', () => {
    const code = `
math_exp2(0)
`;
const result = runCSEMachine(code);
expect(toPythonString(result as Value)).toBe("1.0");
});

test('math_exp2: exp2(1) returns 2', () => {
    const code = `
math_exp2(1)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("2.0");
});

test('math_exp2: exp2(1.5) returns 2.8284271247461903', () => {
    const code = `
math_exp2(1.5)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("2.8284271247461903");
});

// math_expm1(x)
test('math_expm1: expm1(0) returns 0', () => {
    const code = `
math_expm1(0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.0");
});
  
test('math_expm1: expm1(1) returns approximately 1.7182818284590453', () => {
    const code = `
math_expm1(1)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1.7182818284590453");
});
  
test('math_expm1: expm1(1.5)', () => {
    const code = `
math_expm1(1.5)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("3.481689070338065");
});

// math_fabs
test('math_fabs: fabs of a negative integer returns float', () => {
    const code = `
math_fabs(-3)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("3.0");
});
  
test('math_fabs: fabs of a positive float returns same value', () => {
    const code = `
math_fabs(4.2)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("4.2");
});
  
test('math_fabs: fabs of 0 returns 0.0', () => {
    const code = `
math_fabs(0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.0");
});

// math_factorial
test('math_factorial: factorial of 0 returns 1', () => {
    const code = `
math_factorial(0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1");
});

test('math_factorial: factorial of 5 returns 120', () => {
    const code = `
math_factorial(5)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("120");
});

// math_floor
test('math_floor: floor of 3.7 returns 3', () => {
    const code = `
math_floor(3.7)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("3");
});
  
test('math_floor: floor of -3.2 returns -4', () => {
    const code = `
math_floor(-3.2)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("-4");
});
  
test('math_floor: floor of 5 returns 5', () => {
    const code = `
math_floor(5)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("5");
});

// math_gcd
test('math_gcd: no arguments returns 0', () => {
    const code = `
math_gcd()
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0");
});
  
test('math_gcd: all zeros returns 0', () => {
    const code = `
math_gcd(0, 0, 0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0");
});

test('math_gcd: not all zeros', () => {
    const code = `
math_gcd(0, 0, 2)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("2");
});
  
test('math_gcd: gcd of 12 and 18 returns 6', () => {
    const code = `
math_gcd(12, 18)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("6");
});
  
test('math_gcd: gcd with negative numbers returns positive gcd', () => {
    const code = `
math_gcd(-12, 18)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("6");
});
  
test('math_gcd: gcd of 20, 30, and 50 returns 10', () => {
    const code = `
math_gcd(20, 30, 50)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("10");
});

// math_isfinite
test('math_isfinite: finite number returns True', () => {
    const code = `
math_isfinite(3.14)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("True");
});
  
test('math_isfinite: positive infinity returns False', () => {
    const code = `
math_isfinite(1e309)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("False");
});
  
test('math_isfinite: negative infinity returns False', () => {
    const code = `
math_isfinite(-1e309)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("False");
});

// isinf
test('math_isinf: finite number returns False', () => {
    const code = `
math_isinf(3.14)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("False");
});
  
test('math_isinf: positive infinity returns True', () => {
    const code = `
math_isinf(1e309)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("True");
});
  
test('math_isinf: negative infinity returns True', () => {
    const code = `
math_isinf(-1e309)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("True");
});

test('math_isinf: infinity returns True', () => {
    const code = `
math_isinf(math_inf)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("True");
});

// math_isnan
test('math_isnan: finite number returns False', () => {
    const code = `
math_isnan(3.14)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("False");
});

test('math_isnan: nan returns True', () => {
    const code = `
math_isnan(math_nan)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("True");
});

// math_isqrt
test('math_isqrt: isqrt(0) returns 0', () => {
    const code = `
math_isqrt(0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0");
});
  
test('math_isqrt: isqrt(10) returns 3', () => {
    const code = `
math_isqrt(10)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("3");
});

// math_lcm
test('math_lcm: no arguments returns 1', () => {
    const code = `
math_lcm()
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1");
});
  
test('math_lcm: all zeros returns 0', () => {
    const code = `
math_lcm(0, 0, 0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0");
});
  
test('math_lcm: lcm of 3 and 4 returns 12', () => {
    const code = `
math_lcm(3, 4)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("12");
});
  
test('math_lcm: lcm of -3 and 4 returns 12', () => {
    const code = `
math_lcm(-3, 4)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("12");
});

// math_log
test('math_log: natural logarithm returns correct value for one argument', () => {
    const code = `
math_log(20)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("2.995732273553991");
});
  
test('math_log: logarithm with given base returns correct value', () => {
    const code = `
math_log(20, 2)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("4.321928094887363");
});

// math_log10
test('math_log10: base-10 logarithm returns correct value', () => {
    const code = `
math_log10(20)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1.3010299956639813");
});

// math_log1p
test('math_log1p: logarithm of 1+x returns correct value for x = 1', () => {
    const code = `
math_log1p(1)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.6931471805599453");
});

test('math_log1p: logarithm of 1+0 returns 0', () => {
    const code = `
math_log1p(0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.0");
});

// math_log2
test('math_log2: base-2 logarithm returns correct value', () => {
    const code = `
math_log2(8)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("3.0");
});

// math_perm
test('math_perm: when k > n returns 0', () => {
    const code = `
math_perm(3, 5)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0");
});
  
test('math_perm: when k equals 0 returns 1', () => {
    const code = `
math_perm(5, 0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1");
});
  
test('math_perm: general case, math_perm(5, 3) returns 60', () => {
    const code = `
math_perm(5, 3)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("60");
});

// math_pow
test('math_pow: 2 raised to 3 returns 8.0', () => {
    const code = `
math_pow(2, 3)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("8.0");
});
  
test('math_pow: 2 raised to -1 returns 0.5', () => {
    const code = `
math_pow(2, -1)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.5");
});
  
test('math_pow: 2 raised to 0.7 returns ~1.62450479', () => {
    const code = `
math_pow(2, 0.7)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1.624504792712471");
});

// math_radians
test('math_radians: 0 degrees returns 0', () => {
    const code = `
math_radians(0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.0");
});
  
test('math_radians: 180 degrees returns pi', () => {
    const code = `
math_radians(180)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("3.141592653589793");
});
  
test('math_radians: 90 degrees returns pi/2', () => {
    const code = `
math_radians(90)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1.5707963267948966");
});

test('math_radians: 45 degrees returns pi/4', () => {
    const code = `
math_radians(45)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.7853981633974483");
});

// math_remainder
test('math_remainder: remainder(5, 3) returns -1.0', () => {
    const code = `
math_remainder(5, 3)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("-1.0");
});

test('math_remainder: remainder(7, 2) returns -1.0', () => {
    const code = `
math_remainder(7, 2)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("-1.0");
});

test('math_remainder: remainder(-5, 3) returns 1.0', () => {
    const code = `
math_remainder(-5, 3)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1.0");
});

// math_sin
test('math_sin: sine of 0 returns 0', () => {
    const code = `
math_sin(0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.0");
});
  
test('math_sin: sine of pi/2 returns 1.0', () => {
    const code = `
math_sin(1.5707963267948966)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1.0");
});

// math_sinh
test('math_sinh: hyperbolic sine of 0 returns 0', () => {
    const code = `
math_sinh(0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.0");
});
  
test('math_sinh: hyperbolic sine of 1 returns approximately 1.1752011936438014', () => {
    const code = `
math_sinh(1)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1.1752011936438014");
});

// math_sqrt
test('math_sqrt: square root of 4 returns 2.0', () => {
    const code = `
math_sqrt(4)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("2.0");
});
  
test('math_sqrt: square root of 2 returns approximately 1.4142135623730951', () => {
    const code = `
math_sqrt(2)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1.4142135623730951");
});

// math_tan
test('math_tan: tangent of 0 returns 0', () => {
    const code = `
math_tan(0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.0");
});
  
test('math_tan: tangent of pi/4 returns 0.9999999999999999', () => {
    const code = `
math_tan(0.7853981633974483)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.9999999999999999");
});

// math_tanh
test('math_tanh: hyperbolic tangent of 0 returns 0', () => {
    const code = `
math_tanh(0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.0");
});
  
test('math_tanh: hyperbolic tangent of 1 returns approximately 0.7615941559557649', () => {
    const code = `
math_tanh(1)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.7615941559557649");
});

// math_trunc
test('math_trunc: trunc of a positive number returns its integer part', () => {
    const code = `
math_trunc(3.7)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("3");
});

test('math_trunc: trunc of a negative number returns its integer part', () => {
    const code = `
math_trunc(-3.7)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("-3");
});

// max
test('max: integers - returns the largest integer', () => {
    const code = `
max(7, 3, 9, 1)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("9");
});
  
test('max: floats - returns the largest float', () => {
    const code = `
max(2.5, 3.1, 3.1, 1.8)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("3.1");
});
  
test('max: strings - returns the largest string', () => {
    const code = `
max("apple", "banana", "cherry")
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("cherry");
});

// min
test('min: integers - returns the smallest integer', () => {
    const code = `
min(7, 3, 9, 1)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1");
});
  
test('min: floats - returns the smallest float', () => {
    const code = `
min(2.5, 3.1, 1.8, 1.8)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1.8");
});
  
test('min: strings - returns the smallest string', () => {
    const code = `
min("apple", "banana", "cherry")
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("apple");
});

// round
test('round: round(3.14159, 2) returns 3.14', () => {
    const code = `
round(3.14159, 2)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("3.14");
});

test('round: round(3.14159, 0) returns 3.0', () => {
    const code = `
round(3.14159, 0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("3");
});

test('round: round(3.14159) returns 3.0', () => {
    const code = `
round(3.14159)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("3");
});

test('round: round(-2.5) returns -2.0', () => {
    const code = `
round(-2.5)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("-2");
});

test('round: round(327485.244154, -3) returns 327000.0', () => {
    const code = `
round(327485.244154, -3)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("327000.0");
});

test('round', () => {
    const code = `
round(327485.244154, 0)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("327485");
});

// str
test('str: no argument returns empty string', () => {
    const code = `
str()
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("");
});

test('str: integer conversion', () => {
    const code = `
str(123)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("123");
});

test('str: float conversion', () => {
    const code = `
str(3.14)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("3.14");
});

test('str: boolean conversion', () => {
    const code = `
str(True)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("True");
});

test('str: string conversion (idempotent)', () => {
    const code = `
str("hello")
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("hello");
});

test('str: function conversion', () => {
    const code = `
def f():
    return
str(f)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("<function f>");
});

test('str: nan conversion', () => {
    const code = `
str(math_nan)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("nan");
});

test('str: inf conversion', () => {
    const code = `
str(math_inf)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("inf");
});

test('str: None conversion', () => {
    const code = `
str(None)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("None");
});

// math_fma
test('math_fma: fused multiply-add for simple positive numbers returns 10.0', () => {
    const code = `
math_fma(2, 3, 4)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("10.0");
});

test('math_fma: fused multiply-add with negative multiplier returns -2.0', () => {
    const code = `
math_fma(-2, 3, 4)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("-2.0");
});
  
test('math_fma: fused multiply-add for (1e16, 1e-16, -1) returns 0.0', () => {
    // Why???
    const code = `
math_fma(1e16, 1e-16, -1)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("-2.0902213275965396e-17");
});

test('math_fma: fused multiply-add for (1.5, 2.5, 3.5) returns 7.25', () => {
    const code = `
math_fma(1.5, 2.5, 3.5)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("7.25");
});

test('math_fma: fused multiply-add with 0, infinity, nan returns nan', () => {
    const code = `
math_fma(0, math_inf, math_nan)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("nan");
});
  
test('math_fma: fused multiply-add with infinity, 0, nan returns nan', () => {
    const code = `
math_fma(math_inf, 0, math_nan)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("nan");
});

test('math_fma: better than * +', () => {
    const code = `
x = 1.0000000000000002
y = 1e16
z = -1e16
math_fma(x, y, z)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("2.220446049250313");
});

test('math_fmod: integer remainder (5 % 2)', () => {
    const code = `
x = 5
y = 2
math_fmod(x, y)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1.0");
});
  
test('math_fmod: negative dividend (-5.5 % 2) => -1.5', () => {
    const code = `
x = -5.5
y = 2
math_fmod(x, y)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("-1.5");
});
  
test('math_fmod: Infinity % 2 => NaN', () => {
    const code = `
x = 1e999999999  # Infinity
y = 2
math_fmod(x, y)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("nan");
});

test('math_ldexp: integer scale up (3.14 * 2^2)', () => {
    const code = `
x = 3.14
i = 2
math_ldexp(x, i)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("12.56");
});
  
test('math_ldexp: negative exponent (3.14 * 2^-2)', () => {
    const code = `
x = 3.14
i = -2
math_ldexp(x, i)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.785");
});
  
test('math_ldexp: bigint (3.14, 10)', () => {
    const code = `
x = 3.14
i = 10
math_ldexp(x, i)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("3215.36");
});
  
test('math_gamma: basic integer input (math_gamma(1) = 1)', () => {
    const code = `
x = 1
math_gamma(x)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1.0");
});
  
test('math_gamma: integer input (math_gamma(5) = 24)', () => {
    const code = `
x = 5
math_gamma(x)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("24.0");
});

test('math_gamma: non-integer input (math_gamma(2.5))', () => {
    const code = `
x = 2.5
math_gamma(x)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("1.329340388179137");
});

test('lgamma: integer input lgamma(1) = ln(Gamma(1)) = 0', () => {
    const code = `
x = 1
math_lgamma(x)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.0");
});
  
test('lgamma: integer input lgamma(5) = ln(Gamma(5)) = ln(24)', () => {
    const code = `
x = 5
math_lgamma(x)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("3.1780538303479444");
});
  
test('lgamma: fractional input (0.5)', () => {
    const code = `
x = 0.5
math_lgamma(x)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("0.5723649429247004");
});
  
test('lgamma: large input ~ potential overflow', () => {
    const code = `
x = 1000
math_lgamma(x)
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("5905.220423209181");
});
