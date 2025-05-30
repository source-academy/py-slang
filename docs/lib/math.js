/**
 * 
 * The Number value for e, Euler's number,
 * which is approximately 2.718281828459045.
 * @const {float}
 * 
 */
const math_e = 2.718281828459045;

/**
 * 
 * The name inf refers to float value positive infinity. 
 * (For negative infinity, use -math.inf.) Equivalent to 
 * the output of float('inf').
 * See also <a href="https://docs.python.org/3/library/math.html#math.inf">Python 3.13 Documentation</a>.
 * @const {float}
 * 
 */
const math_inf = 1 / 0;

/**
 * 
 * A floating-point “not a number” (nan) value. 
 * Equivalent to the output of float('nan').  
 * See also <a href="https://docs.python.org/3/library/math.html#math.nan">Python 3.13 Documentation</a>.
 * @const {float}
 * 
 */
const math_nan = NaN;

/**
 * 
 * The float value of <CODE>π</CODE>, 
 * the ratio of the circumference of a circle to its diameter, 
 * which is approximately 3.1415926535897932.
 * @const {float}
 * 
 */
const math_pi = undefined;

/**
 * 
 * Tau is a circle constant equals to <CODE>2π</CODE>, 
 * the ratio of a circle’s circumference to its radius, 
 * which is approximately 6.283185307179586.
 * @const {float}
 * 
 */
const math_tau = undefined;

/**
 * 
 * An object frequently used to represent the absence of a value. 
 * See also <a href="https://docs.python.org/3.13/library/constants.html#None">Python 3.13 Documentation</a>.
 * @const {NoneType}
 * 
 */
const None = undefined;

/** 
 * 
 * The true value of the bool type.
 * @const {bool}
 * 
 */
const True =  true;

/** 
 * 
 * The false value of the bool type.
 * @const {bool}
 * 
 */
const False =  false;

/**
 *
 * Return the absolute value of a number as a float. 
 * Unlike the built-in <CODE>abs()</CODE>, <CODE>math_fabs()</CODE> always returns a float, 
 * even when the input is an integer. 
 * It only accepts int or float types (complex numbers are not supported).
 * 
 * @param {int | float} <CODE>x</CODE> - The number whose absolute value is computed.
 * @returns {float} absolute value of <CODE>x</CODE>
*/
function math_fabs( x ) {}

/**
 * Return the number of ways to choose <CODE>k</CODE> items from <CODE>n</CODE> items 
 * without repetition and without order. 
 * Returns zero when <CODE>k > n</CODE>.
 * 
 * @param {int} <CODE>n</CODE> - Total number of items (must be a non-negative integer).
 * @param {int} <CODE>k</CODE> - Number of items to choose (must be a non-negative integer).
 * @returns {int} the binomial coefficient of <CODE>n</CODE> and <CODE>k</CODE>
 */
function math_comb( n, k )	{}
 
/**
 * Return <CODE>n</CODE> factorial as an integer.
 * 
 * @param {int} <CODE>n</CODE> - A non-negative integer whose factorial is to be computed.
 * @returns {int} the factorial of <CODE>n</CODE>
 */
function math_factorial(n) {}

/**
 * Return the greatest common divisor of the specified <CODE>*integers</CODE> arguments.
 * If any of the arguments is nonzero, then the returned value is the largest positive
 * integer that is a divisor of all arguments.
 * If all arguments are <CODE>0</CODE>, then the returned value is <CODE>0</CODE>.
 * <CODE>gcd()</CODE> without arguments returns <CODE>0</CODE>.
 * If any of the provided integers is negative, the function treats it as its
 * absolute value when computing the GCD.
 * 
 * @param {int} <CODE>*integers</CODE> - A variable number of integer arguments for
 * which to compute the greatest common divisor.
 * @returns {int} the greatest common divisor of the given <CODE>integers</CODE> as a positive
 * integer
 */
function math_gcd(...integers) {}

/**
 * Return the integer square root of the non-negative <CODE>n</CODE>.
 * 
 * @param {int} <CODE>n</CODE> - A non-negative integer for which to compute the
 * integer square root.
 * @returns {int} the integer square root of <CODE>n</CODE>
 */
function math_isqrt(n) {}

/**
 * Return the least common multiple of the specified integer arguments.
 * If all arguments are nonzero, then the returned value is the smallest positive
 * integer that is a multiple of all arguments.
 * If any of the arguments is <CODE>0</CODE>, then the returned value is <CODE>0</CODE>.
 * <CODE>lcm()</CODE> without arguments returns <CODE>1</CODE>.
 * If any of the input integers is negative, <CODE>math_lcm()</CODE> treats it
 * as its absolute value when computing the LCM, so the result is always
 * non-negative.
 * 
 * @param {int} <CODE>*integers</CODE> - A variable number of integer arguments for
 * which the least common multiple is computed.
 * @returns {int} the least common multiple of the given integers as a positive
 * integer
 */
function math_lcm(...integers) {}

/**
 * Return the number of ways to choose <CODE>k</CODE> items from <CODE>n</CODE> items without
 * repetition and with order.
 * Returns zero when <CODE>k > n</CODE>.
 * 
 * @param {int} <CODE>n</CODE> - Total number of items (must be a non-negative integer).
 * @param {int} <CODE>k</CODE> - Number of items to choose (must be a non-negative integer).
 * @returns {int} the permutations of <CODE>n</CODE> and <CODE>k</CODE>
 */
function math_perm(n, k) {}

/**
 * Return the ceiling of <CODE>x</CODE>, the smallest integer greater than or equal to 
 * <CODE>x</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The numeric value for which to compute the ceiling.
 * @returns {int} the ceiling of <CODE>x</CODE>
 */
function math_ceil(x) {}

/**
 * Return the floor of <CODE>x</CODE>, the largest integer less than or equal to 
 * <CODE>x</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The numeric value for which to compute the flooring.
 * @returns {int} the flooring of <CODE>x</CODE>
 */
function math_floor(x) {}

/**
 * Fused multiply–add operation. Return <CODE>(x * y) + z</CODE>, computed as though with infinite
 * precision and range followed by a single round to the <CODE>float</CODE> format.
 * This operation often provides better accuracy than the direct expression 
 * <CODE>(x * y) + z</CODE>.
 * This function follows the specification of the 
 * (<a href="https://en.wikipedia.org/wiki/Multiply%E2%80%93accumulate_operation#Fused_multiply%E2%80%93add" <CODE>fusedMultiplyAdd</CODE></a>) operation described in the <CODE>IEEE 754</CODE> standard.
 * The standard leaves one case implementation-defined, namely the result of 
 * <CODE>fma(0, inf, nan)</CODE> and <CODE>fma(inf, 0, nan)</CODE>.
 * In these cases, <CODE>math.fma</CODE> returns a <CODE>math.nan</CODE>, and does not raise any exception.
 * 
 * @param {int | float} <CODE>x</CODE> - The first multiplicand. It is multiplied by <CODE>y</CODE>.
 * @param {int | float} <CODE>y</CODE> - The second multiplicand. It is multiplied by <CODE>x</CODE>.
 * @param {int | float} <CODE>z</CODE> - The addend. The product of <CODE>x</CODE> and <CODE>y</CODE> 
 * is added to <CODE>z</CODE> using a fused multiply–add operation.
 * @returns {float} the float value of <CODE>(x * y) + z</CODE>
 */
function math_fma(x, y, z) {}

/**
 * Return the floating-point remainder of <CODE>x</CODE> / <CODE>y</CODE>, as defined by the
 * platform C library function <CODE>fmod(x, y)</CODE>. The sign of the result is the same as the
 * sign of <CODE>x</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The dividend. It will be converted to a <CODE>float</CODE>
 * if necessary.
 * @param {int | float} <CODE>y</CODE> - The divisor. It will be converted to a <CODE>float</CODE>
 * if necessary.
 * @returns {float} the platform C library function <CODE>fmod(x, y)</CODE> style remainder of
 * <CODE>x</CODE> divided by <CODE>y</CODE>
 */
function math_fmod(x, y) {}

/**
 * Return the IEEE 754-style remainder of <CODE>x</CODE> with respect to <CODE>y</CODE>. For finite
 * <CODE>x</CODE> and finite nonzero <CODE>y</CODE>, this is the difference <CODE>x - n*y</CODE>, where
 * <CODE>n</CODE> is the closest integer to the exact value of the quotient <CODE>x / y</CODE>.
 * If <CODE>x / y</CODE> is exactly halfway between two consecutive <CODE>integers</CODE>, the nearest
 * even integer is used for <CODE>n</CODE>. The remainder <CODE>r</CODE> = <CODE>remainder(x, y)</CODE>
 * thus always satisfies <CODE>abs(r) <= 0.5 * abs(y)</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The dividend. It will be converted to a <CODE>float</CODE>
 * if necessary.
 * @param {int | float} <CODE>y</CODE> - The divisor. It will be converted to a <CODE>float</CODE>
 * if necessary.
 * @returns {float} the IEEE 754-style remainder of <CODE>x</CODE> divided by <CODE>y</CODE>
 */
function math_remainder(x, y) {}

/**
 * Return <CODE>x</CODE> with the fractional part removed, leaving the integer part.
 * <CODE>trunc()</CODE> is equivalent to <CODE>floor()</CODE> for positive <CODE>x</CODE>, and equivalent
 * to <CODE>ceil()</CODE> for negative <CODE>x</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The numeric value from which the fractional part is removed,
 * returning the integral part (i.e. <CODE>x</CODE> rounded toward <CODE>0</CODE>).
 * @returns {int} the integer part of <CODE>x</CODE>
 */
function math_trunc(x) {}

/**
 * Return a <CODE>float</CODE> with the magnitude (absolute value) of <CODE>x</CODE>
 * but the sign of <CODE>y</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The value whose magnitude (<CODE>absolute value</CODE>) will be used.
 * @param {int | float} <CODE>y</CODE> - The value whose sign will be applied to <CODE>x</CODE>'s magnitude.
 * @returns {float} a <CODE>float</CODE> with the absolute value of <CODE>x</CODE> but with the sign of
 * <CODE>y</CODE>
 */
function math_copysign(x, y) {}

/**
 * Return <CODE>True</CODE> if <CODE>x</CODE> is neither an <CODE>infinity</CODE> nor a <CODE>nan</CODE>,
 * and <CODE>False</CODE> otherwise.
 * 
 * @param {int | float} <CODE>x</CODE> - A numeric value. It is converted to <CODE>float</CODE> if necessary.
 * @returns {bool} the <CODE>True</CODE> if <CODE>x</CODE> is finite; otherwise, <CODE>False</CODE>
 */
function math_isfinite(x) {}

/**
 * Return <CODE>True</CODE> if <CODE>x</CODE> is a positive or negative <CODE>infinity</CODE>,
 * and <CODE>False</CODE> otherwise.
 * 
 * @param {int | float} <CODE>x</CODE> - A numeric value. It is converted to <CODE>float</CODE> if necessary.
 * @returns {bool} the <CODE>True</CODE> if <CODE>x</CODE> is an <CODE>infinity</CODE> (positive or negative); 
 * otherwise, <CODE>False</CODE>
 */
function math_isinf(x) {}

/**
 * Return <CODE>True</CODE> if <CODE>x</CODE> is a <CODE>nan</CODE> (not a number),
 * and <CODE>False</CODE> otherwise.
 * 
 * @param {int | float} <CODE>x</CODE> - A numeric value. It is converted to <CODE>float</CODE> if necessary.
 * @returns {bool} the <CODE>True</CODE> if <CODE>x</CODE> is <CODE>nan</CODE>; otherwise, <CODE>False</CODE>
 */
function math_isnan(x) {}

/**
 * Return <CODE>x * (2**i)</CODE>. This is essentially the inverse of function 
 * <CODE>frexp()</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - A numeric value (the significand). It is converted to 
 * <CODE>float</CODE> if necessary.
 * @param {int} <CODE>i</CODE> - An integer exponent.
 * @returns {float} the result of <CODE>x</CODE> multiplied by <CODE>2</CODE> raised to the power 
 * <CODE>i</CODE>
 */
function math_ldexp(x, i) {}

/**
 * Return the floating-point value <CODE>steps</CODE> steps after <CODE>x</CODE> towards 
 * <CODE>y</CODE>. If <CODE>x</CODE> is equal to <CODE>y</CODE>, return <CODE>y</CODE>, unless 
 * <CODE>steps</CODE> is <CODE>0</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The starting floating-point number from which the stepping begins.
 * @param {int | float} <CODE>y</CODE> - The target value that determines the direction. The function will 
 * return a value toward <CODE>y</CODE> from <CODE>x</CODE>.
 * @param {int} <CODE>steps</CODE> - The number of representable floating-point values to step from 
 * <CODE>x</CODE> toward <CODE>y</CODE> (default is <CODE>1</CODE>).
 * @returns {float} the floating-point number that is exactly <CODE>steps</CODE> representable numbers 
 * away from <CODE>x</CODE> in the direction of <CODE>y</CODE>
 */
function math_nextafter(x, y, steps = 1) {}

/**
 * Return the value of the least significant bit of the <CODE>float x</CODE>.
 * If <CODE>x</CODE> is a <CODE>NaN</CODE> (not a number), return <CODE>x</CODE>.
 * If <CODE>x</CODE> is negative, return <CODE>ulp(-x)</CODE>.
 * If <CODE>x</CODE> is a positive <CODE>infinity</CODE>, return <CODE>x</CODE>.
 * If <CODE>x</CODE> is equal to <CODE>0</CODE>, return the smallest positive denormalized
 * representable <CODE>float</CODE> (smaller than the minimum positive normalized <CODE>float</CODE>,
 * <CODE>sys.float_info.min</CODE>, approximately <CODE>1.7976931348623157e+308</CODE>).
 * If <CODE>x</CODE> is equal to the largest positive representable <CODE>float</CODE>, return the value
 * of the least significant bit of <CODE>x</CODE>, such that the first <CODE>float</CODE> smaller than 
 * <CODE>x</CODE> is <CODE>x - ulp(x)</CODE>.
 * Otherwise (when <CODE>x</CODE> is a positive finite number), return the value of the least significant
 * bit of <CODE>x</CODE>, such that the first <CODE>float</CODE> bigger than <CODE>x</CODE> is 
 * <CODE>x + ulp(x)</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The numeric value (typically a <CODE>float</CODE>) for which to compute 
 * the <CODE>ULP</CODE> (Unit in the Last Place). The function returns the value of the least significant 
 * bit of <CODE>x</CODE>, handling special cases (<CODE>NaN</CODE>, <CODE>infinities</CODE>, <CODE>0</CODE>, etc.)
 * as specified by <CODE>IEEE 754</CODE>.
 * @returns {float} the spacing between <CODE>x</CODE> and the next representable <CODE>float</CODE> in the 
 * direction defined by <CODE>x</CODE>'s sign
 */
function math_ulp(x) {}

/**
 * Return the cube root of <CODE>x</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The numeric value for which to compute the cube root.
 * @returns {float} the cube root of <CODE>x</CODE>
 */
function math_cbrt(x) {}

/**
 * Return <CODE>e</CODE> raised to the power <CODE>x</CODE>, where <CODE>e = 2.718281…</CODE> 
 * is the base of natural logarithms.
 * 
 * @param {int | float} <CODE>x</CODE> - The exponent for which to compute <CODE>e^x</CODE>.
 * @returns {float} the value of <CODE>e</CODE> raised to the power <CODE>x</CODE> with high accuracy
 */
function math_exp(x) {}

/**
 * Return <CODE>2</CODE> raised to the power <CODE>x</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The exponent for which to compute <CODE>2^x</CODE>.
 * @returns {float} the value of <CODE>2</CODE> raised to the power <CODE>x</CODE> with high accuracy
 */
function math_exp2(x) {}

/**
 * Return <CODE>e</CODE> raised to the power <CODE>x</CODE>, minus <CODE>1</CODE>. Here <CODE>e</CODE> is 
 * the base of natural logarithms. For small <CODE>x</CODE>, the subtraction in 
 * <CODE>exp(x) - 1</CODE> can result in a significant loss of precision; the <CODE>expm1()</CODE> function 
 * provides a way to compute this quantity to full precision.
 * 
 * @param {int | float} <CODE>x</CODE> - The exponent for which to compute <CODE>e^x</CODE>.
 * @returns {float} the value of <CODE>e</CODE> raised to the power <CODE>x</CODE> minus <CODE>1</CODE> with high accuracy
 */
function math_expm1(x) {}

/**
 * With one argument, return the natural logarithm of <CODE>x</CODE> (to base <CODE>e</CODE>).
 * With two arguments, return the logarithm of <CODE>x</CODE> to the given <CODE>base</CODE>,
 * calculated as <CODE>log(x)/log(base)</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The numeric value for which to compute the logarithm.
 * @param {int | float} <CODE>base</CODE>(optional) - The base of the logarithm. If provided, the result is computed as 
 * <CODE>log(x)</CODE>/<CODE>log(base)</CODE>. If omitted, the natural logarithm (base <CODE>e</CODE>) is returned.
 * @returns {float} a float representing the logarithm of <CODE>x</CODE> (either natural logarithm when 
 * <CODE>base</CODE> is not provided, or logarithm with the given <CODE>base</CODE> otherwise)
 */
function math_log(x, base) {}

/**
 * Return the natural logarithm of <CODE>1+x</CODE> (base <CODE>e</CODE>). The result is calculated in a way
 * which is accurate for <CODE>x</CODE> near <CODE>0</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The number to be added to <CODE>1</CODE>. The function returns the natural 
 * logarithm of (<CODE>1+x</CODE>), computed in a way that is accurate for values of <CODE>x</CODE> near <CODE>0</CODE>.
 * @returns {float} the natural logarithm of <CODE>1+x</CODE> (base <CODE>e</CODE>)
 */
function math_log1p(x) {}

/**
 * Return the base-2 logarithm of <CODE>x</CODE>. This is usually more accurate than 
 * <CODE>log(x, 2)</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - A positive number. The function returns the logarithm of 
 * <CODE>x</CODE> to base 2.
 * @returns {float} the base-2 logarithm of <CODE>x</CODE>
 */
function math_log2(x) {}

/**
 * Return the base-10 logarithm of <CODE>x</CODE>. This is usually more accurate than 
 * <CODE>log(x, 10)</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - A positive number. The function returns the logarithm of 
 * <CODE>x</CODE> to base 10.
 * @returns {float} the base-10 logarithm of <CODE>x</CODE>
 */
function math_log10(x) {}

/**
 * Return <CODE>x</CODE> raised to the power <CODE>y</CODE>. Unlike the built-in 
 * <CODE>**</CODE> operator, <CODE>math_pow()</CODE> converts both its arguments to type <CODE>float</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The base value. Both <CODE>x</CODE> and <CODE>y</CODE> are converted 
 * to <CODE>float</CODE> before the operation.
 * @param {int | float} <CODE>y</CODE> - The exponent value. The function computes <CODE>x</CODE> raised to the power 
 * <CODE>y</CODE>, following IEEE 754 rules for special cases.
 * @returns {float} the value of <CODE>x</CODE> raised to the power <CODE>y</CODE>
 */
function math_pow(x, y) {}

/**
 * Return the square root of <CODE>x</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - A non-negative number. <CODE>x</CODE> is converted to a <CODE>float</CODE> 
 * if necessary.
 * @returns {float} the square root of <CODE>x</CODE>
 */
function math_sqrt(x) {}

/**
 * Convert angle <CODE>x</CODE> from radians to degrees.
 * 
 * @param {int | float} <CODE>x</CODE> - The angle in radians to be converted to degrees.
 * @returns {float} the angle, in degrees, corresponding to the given radians
 */
function math_degrees(x) {}

/**
 * Convert angle <CODE>x</CODE> from degrees to radians.
 * 
 * @param {int | float} <CODE>x</CODE> - The angle in degrees to be converted to radians.
 * @returns {float} the angle, in radians, corresponding to the given degrees
 */
function math_radians(x) {}

/**
 * Return the arc cosine of <CODE>x</CODE>, in radians. The result is between <CODE>0</CODE> and <CODE>pi</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The value whose arc cosine is to be computed. Must be in the interval 
 * <CODE>[-1, 1]</CODE>.
 * @returns {float} the arc cosine of <CODE>x</CODE> in radians
 */
function math_acos(x) {}

/**
 * Return the arc sine of <CODE>x</CODE>, in radians. The result is between <CODE>-pi/2</CODE> and <CODE>pi/2</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The value whose arc sine is to be computed. Must be in the interval 
 * <CODE>[-1, 1]</CODE>.
 * @returns {float} the arc sine of <CODE>x</CODE> in radians
 */
function math_asin(x) {}

/**
 * Return the arc tangent of <CODE>x</CODE>, in radians. The result is between <CODE>-pi/2</CODE> and <CODE>pi/2</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The value whose arc tangent is to be computed.
 * @returns {float} the arc tangent of <CODE>x</CODE> in radians
 */
function math_atan(x) {}

/**
 * Return <CODE>atan(y / x)</CODE>, in radians.
 * 
 * @param {int | float} <CODE>y</CODE> - The y-coordinate of the point.
 * @param {int | float} <CODE>x</CODE> - The x-coordinate of the point.
 * @returns {float} the arc tangent of <CODE>y/x</CODE> in radians
 */
function math_atan2(y, x) {}

/**
 * Return the cosine of <CODE>x</CODE> radians.
 * 
 * @param {int | float} <CODE>x</CODE> - The angle in radians for which the cosine is computed.
 * @returns {float} the cosine of <CODE>x</CODE>
 */
function math_cos(x) {}

/**
 * Return the sine of <CODE>x</CODE> radians.
 * 
 * @param {int | float} <CODE>x</CODE> - The angle in radians for which the sine is computed.
 * @returns {float} the sine of <CODE>x</CODE>
 */
function math_sin(x) {}

/**
 * Return the tangent of <CODE>x</CODE> radians.
 * 
 * @param {int | float} <CODE>x</CODE> - The angle in radians for which the tangent is computed.
 * @returns {float} the tangent of <CODE>x</CODE>
 */
function math_tan(x) {}

/**
 * Return the inverse hyperbolic cosine of <CODE>x</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The number for which to compute the inverse hyperbolic cosine.
 * (Typically, <CODE>x</CODE> must be <CODE>&ge; 1</CODE>.)
 * @returns {float} the inverse hyperbolic cosine of <CODE>x</CODE>
 */
function math_acosh(x) {}

/**
 * Return the inverse hyperbolic sine of <CODE>x</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The number for which to compute the inverse hyperbolic sine.
 * @returns {float} the inverse hyperbolic sine of <CODE>x</CODE>
 */
function math_asinh(x) {}

/**
 * Return the inverse hyperbolic tangent of <CODE>x</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The number for which to compute the inverse hyperbolic tangent.
 * (Must be in the interval <CODE>(-1, 1)</CODE>.)
 * @returns {float} the inverse hyperbolic tangent of <CODE>x</CODE>
 */
function math_atanh(x) {}

/**
 * Return the hyperbolic cosine of <CODE>x</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The angle in radians for which to compute <CODE>cosh(x)</CODE>.
 * @returns {float} the hyperbolic cosine of <CODE>x</CODE>
 */
function math_cosh(x) {}

/**
 * Return the hyperbolic sine of <CODE>x</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The angle in radians for which to compute <CODE>sinh(x)</CODE>.
 * @returns {float} the hyperbolic sine of <CODE>x</CODE>
 */
function math_sinh(x) {}

/**
 * Return the hyperbolic tangent of <CODE>x</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The angle in radians for which to compute <CODE>tanh(x)</CODE>.
 * @returns {float} the hyperbolic tangent of <CODE>x</CODE>
 */
function math_tanh(x) {}

/**
 * Return the error function at <CODE>x</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The value at which to evaluate the error function.
 * @returns {float} the error function value at <CODE>x</CODE>
 */
function math_erf(x) {}

/**
 * Return the complementary error function at <CODE>x</CODE>. The complementary error function is 
 * defined as <CODE>1.0 - erf(x)</CODE>. It is used for large values of <CODE>x</CODE> where a subtraction 
 * from one would cause a loss of significance.
 * 
 * @param {int | float} <CODE>x</CODE> - The value at which to evaluate the complementary error function.
 * @returns {float} the complementary error function at <CODE>x</CODE>
 */
function math_erfc(x) {}

/**
 * Return the Gamma function at <CODE>x</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The input value at which the Gamma function is computed.
 * @returns {float} the Gamma function at <CODE>x</CODE>
 */
function math_gamma(x) {}

/**
 * Return the natural logarithm of the absolute value of the Gamma function at <CODE>x</CODE>.
 * 
 * @param {int | float} <CODE>x</CODE> - The input value for which to compute the natural logarithm of the 
 * absolute Gamma function.
 * @returns {float} the natural logarithm of the absolute value of the Gamma function at <CODE>x</CODE>
 */
function math_lgamma(x) {}
