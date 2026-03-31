/**
 * A simplified version of the Python built-in <CODE>print</CODE> function.
 * This function takes any number of parameters <CODE>*object</CODE>, converts them to their
 * <CODE>string</CODE> representations using <CODE>str()</CODE>, and writes them to the standard
 * output (<CODE>sys.stdout</CODE>), followed by a newline character. See the official Python
 * documentation for <CODE>print</CODE>.
 *
 * @param {any} <CODE>*object</CODE> - object(s) to be printed to the standard output
 * @returns {NoneType} the <CODE>None</CODE> value
 */
function print(...object) {}

/**
 * Prints the provided <CODE>*object</CODE> arguments to the standard output (similar to a simplified
 * <CODE>print</CODE>) and then raises an exception. This function accepts a variable number of arguments,
 * converts them to their <CODE>string</CODE> representations using <CODE>str()</CODE>, outputs them (with a
 * newline) just like what <CODE>print</CODE> does, and immediately halts execution by raising an exception.
 *
 * @param {any} <CODE>*object</CODE> - Objects to be printed to the standard output
 * @returns {NoneType} the <CODE>None</CODE> value
 */
function error(...object) {}

/**
 * Return the number of milliseconds elapsed since <CODE>January 1, 1970 00:00:00 UTC</CODE>.
 *
 * @returns {float} current time in milliseconds
 */
function time_time() {}

/**
 * Return the absolute value of <CODE>x</CODE>.
 * For an <CODE>int</CODE> input, it returns the non-negative integer equivalent.
 * For a <CODE>float</CODE> input, it returns the positive floating-point number representing its magnitude.
 * For a <CODE>complex</CODE> input, it computes and returns the modulus (the square root of the sum of the
 * squares of the real and imaginary parts) as a <CODE>float</CODE>.
 *
 * @param {int | float | complex} <CODE>x</CODE> - The number whose absolute value is computed.
 * @returns {int | float | complex} the absolute value of <CODE>x</CODE>
 */
function abs(x) {}

/**
 * Returns the largest of the provided values. If multiple items are equal to the maximum,
 * the first encountered is returned. All values should be mutually comparable.
 *
 * @param {int | float | string} <CODE>arg1</CODE> - The first item to compare.
 * @param {int | float | string} <CODE>arg2</CODE> - The second item to compare.
 * @param {int | float | string} <CODE>*args</CODE> - Additional items to compare.
 * @returns {int | float | string} the largest of the provided values
 */
function max(arg1, arg2, ...args) {}

/**
 * Returns the smallest of the provided values. If multiple items are equal to the minimum,
 * the first encountered is returned. All values should be mutually comparable.
 *
 * @param {int | float | string} <CODE>arg1</CODE> - The first item to compare.
 * @param {int | float | string} <CODE>arg2</CODE> - The second item to compare.
 * @param {int | float | string} <CODE>*args</CODE> - Additional items to compare.
 * @returns {int | float | string} the smallest of the provided values
 */
function min(arg1, arg2, ...args) {}

/**
 * Return <CODE>number</CODE> rounded to <CODE>ndigits</CODE> precision after the decimal point. If
 * <CODE>ndigits</CODE> is omitted or is <CODE>None</CODE>, it returns the nearest integer
 * to its input.
 *
 * @param {int | float} <CODE>number</CODE> - The value to be rounded.
 * @param {int} <CODE>ndigits</CODE> - The number of digits to round to after the decimal point. If omitted
 * or <CODE>None</CODE>, the function rounds to the nearest integer.
 * @returns {float} the number rounded to <CODE>ndigits</CODE> precision
 */
function round(number, ndigits) {}

/**
 * Return the next random floating-point number in the range <CODE>0.0 ≤ X < 1.0</CODE>.
 *
 * @returns {float} the next random floating-point number in the range <CODE>0.0 ≤ X < 1.0</CODE>
 */
function random_random() {}

/**
 * Return an integer object constructed from a <CODE>value</CODE>, or return <CODE>0</CODE>
 * if no arguments are given.
 *
 * @param {int | float | string | bool} <CODE>value</CODE> - If <CODE>value</CODE> is an <CODE>int</CODE> or
 * a <CODE>float</CODE>, it is converted to an integer by truncating toward <CODE>0</CODE>.
 * If <CODE>value</CODE> is a <CODE>string</CODE>, it is parsed as an integer in base 10.
 * If omitted, it defaults to <CODE>0</CODE>.
 * @returns {int} an integer object constructed from the given <CODE>value</CODE>
 */
function int(value = 0) {}

/**
 * Return a floating point number constructed from a <CODE>value</CODE>, or return <CODE>0.0</CODE>
 * if no arguments are given.
 *
 * @param {int | float | string | bool} <CODE>value</CODE> - If possible, <CODE>value</CODE> is converted
 * to a floating point number.  If omitted, it defaults to <CODE>0.0</CODE>.
 * @returns {float} a floating point number constructed from the given <CODE>value</CODE>
 */
function float(value = 0) {}

/**
 * Return a boolean value constructed from a <CODE>value</CODE>, or return <CODE>False</CODE>
 * if no arguments are given.
 *
 * @param {any} <CODE>value</CODE> - The value to be converted to a boolean.
 * @returns {bool} a boolean value constructed from the given <CODE>value</CODE>
 */
function bool(value) {}

/**
 * Return a complex number constructed from a <CODE>value</CODE>, or return <CODE>0j</CODE>
 * if no arguments are given.
 *
 * @param {int | float | string | bool | complex} <CODE>value</CODE> - If possible, <CODE>value</CODE> is converted
 * to a complex number. If omitted, it defaults to <CODE>0j</CODE>.
 * @returns {complex} a complex number constructed from the given <CODE>value</CODE>
 */
function complex(value = 0) {}

/**
 * Return a <CODE>string</CODE> version of <CODE>object</CODE>. If <CODE>object</CODE> is not provided, returns
 * the empty <CODE>string</CODE>.
 *
 * @param {any} <CODE>object</CODE> - The object to be converted to a <CODE>string</CODE>.
 * If not provided, an empty <CODE>string</CODE> is returned.
 * @returns {string} the informal <CODE>string</CODE> representation of <CODE>object</CODE>
 */
function str(object = "") {}

/**
 * If the <CODE>prompt</CODE> argument is present, it is written to standard output without a trailing newline.
 * The function then reads a line from input, converts it to a <CODE>string</CODE> (stripping a trailing newline),
 * and returns that.
 *
 * @param {string} <CODE>prompt</CODE> - An optional <CODE>string</CODE> that is written to standard output
 * (without a trailing newline) before input is read.
 * @returns {string} the input read from the user as a <CODE>string</CODE>, with any trailing newline removed
 */
function input(prompt) {}

/**
 * Returns True if x is an integer, and False otherwise.
 *
 * @param {any} <CODE>x</CODE> - given value
 * @returns {bool} whether x is an integer
 */
function is_int(x) {}

/**
 * Returns True if x is a floating-point number, and False otherwise.
 *
 * @param {any} <CODE>x</CODE> - given value
 * @returns {bool} whether x is a floating-point number
 */
function is_float(x) {}

/**
 * Returns True if x is a complex number, and False otherwise.
 *
 * @param {any} <CODE>x</CODE> - given value
 * @returns {bool} whether x is a complex number
 */
function is_complex(x) {}

/**
 * Returns True if x is a string, and False otherwise.
 *
 * @param {any} <CODE>x</CODE> - given value
 * @returns {bool} whether x is a string
 */
function is_string(x) {}

/**
 * Returns True if x is a boolean, and False otherwise.
 *
 * @param {any} <CODE>x</CODE> - given value
 * @returns {bool} whether x is a boolean
 */
function is_bool(x) {}

/**
 * Returns True if x is a function, and False otherwise.
 *
 * @param {any} <CODE>x</CODE> - given value
 * @returns {bool} whether x is a function
 */
function is_function(x) {}

/**
 * Returns True if x is the None value, and False otherwise.
 *
 * @param {any} <CODE>x</CODE> - given value
 * @returns {bool} whether x is the None value
 */
function is_none(x) {}

/**
 * Returns the number of parameters the given function <CODE>f</CODE> expects, excluding the rest parameter.
 *
 * @param {function} <CODE>f</CODE> - given function
 * @returns {int} the number of arguments accepted by <CODE>f</CODE>
 */
function arity(f) {}

/**
 * Return the real part of a complex number <CODE>x</CODE>.
 * 
 * @param {complex} <CODE>x</CODE> - a complex number
 * @returns {float} the real part of <CODE>x</CODE>
 */
function real(x) {}

/**
 * Return the imaginary part of a complex number <CODE>x</CODE>.
 * 
 * @param {complex} <CODE>x</CODE> - a complex number
 * @returns {float} the imaginary part of <CODE>x</CODE>
 */
function imag(x) {}

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
const True = true;

/**
 *
 * The false value of the bool type.
 * @const {bool}
 *
 */
const False = false;
