/**
 * Takes a <CODE>string</CODE> <CODE>s</CODE> as the first argument and a nonnegative
 * integer <CODE>i</CODE> as the second argument. If <CODE>i</CODE> is less than
 * the length of <CODE>s</CODE>, this function returns a one-character <CODE>string</CODE> that
 * contains the character of <CODE>s</CODE> at position <CODE>i</CODE>, counting from <CODE>0</CODE>.
 * If <CODE>i</CODE> is larger than or equal to the length of <CODE>s</CODE>, this function returns
 * <CODE>None</CODE>.
 *
 * @param {string} <CODE>s</CODE> - the given <CODE>string</CODE>
 * @param {int} <CODE>i</CODE> - the <CODE>index</CODE>
 * @returns {string} one-character <CODE>string</CODE> or <CODE>None</CODE>
 */
declare function char_at(s: any, i: any): string;
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
declare function print(...object: any[]): NoneType;
/**
 * Prints the provided <CODE>*object</CODE> arguments to the standard output (similar to a simplified
 * <CODE>print</CODE>) and then raises an exception. This function accepts a variable number of arguments,
 * converts them to their <CODE>string</CODE> representations using <CODE>str()</CODE>, outputs them (with a
 * newline) just like what <CODE>print</CODE> does, and immediately halts execution by raising an exception.
 *
 * @param {any} <CODE>*object</CODE> - Objects to be printed to the standard output
 * @returns {NoneType} the <CODE>None</CODE> value
 */
declare function error(...object: any[]): NoneType;
/**
 * Return the number of milliseconds elapsed since <CODE>January 1, 1970 00:00:00 UTC</CODE>.
 *
 * @returns {float} current time in milliseconds
 */
declare function time_time(): float;
/**
 * Return <CODE>True</CODE> if <CODE>object</CODE> is an instance of <CODE>classinfo</CODE>.
 * <CODE>classinfo</CODE> can be <CODE>None</CODE>, <CODE>int</CODE>, <CODE>float</CODE>, <CODE>string</CODE>,
 * <CODE>bool</CODE>, and <CODE>complex</CODE>.
 *
 * @param {any} <CODE>object</CODE> - The object to be checked, i.e. the one to determine whether it is an
 * instance of the specified type.
 * @param {string} <CODE>classinfo</CODE> - The name of a single class (<CODE>type</CODE>). The type information used to test
 * the object's type.
 * @returns {bool} indicating whether <CODE>object</CODE> is an instance of <CODE>classinfo</CODE>
 */
declare function isinstance(object: any, classinfo: any): bool;
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
declare function abs(x: any): int | float | complex;
/**
 * Returns the largest of the provided values. If multiple items are equal to the maximum,
 * the first encountered is returned. All values should be mutually comparable.
 *
 * @param {int | float | string} <CODE>arg1</CODE> - The first item to compare.
 * @param {int | float | string} <CODE>arg2</CODE> - The second item to compare.
 * @param {int | float | string} <CODE>*args</CODE> - Additional items to compare.
 * @returns {int | float | string} the largest of the provided values
 */
declare function max(arg1: any, arg2: any, ...args: any[]): int | float | string;
/**
 * Returns the smallest of the provided values. If multiple items are equal to the minimum,
 * the first encountered is returned. All values should be mutually comparable.
 *
 * @param {int | float | string} <CODE>arg1</CODE> - The first item to compare.
 * @param {int | float | string} <CODE>arg2</CODE> - The second item to compare.
 * @param {int | float | string} <CODE>*args</CODE> - Additional items to compare.
 * @returns {int | float | string} the smallest of the provided values
 */
declare function min(arg1: any, arg2: any, ...args: any[]): int | float | string;
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
declare function round(number: any, ndigits: any): float;
/**
 * Return the next random floating-point number in the range <CODE>0.0 ≤ X < 1.0</CODE>.
 *
 * @returns {float} the next random floating-point number in the range <CODE>0.0 ≤ X < 1.0</CODE>
 */
declare function random_random(): float;
/**
 * Return an integer object constructed from a <CODE>number</CODE>, or return <CODE>0</CODE>
 * if no arguments are given.
 *
 * @param {int | float} <CODE>number</CODE> - The numeric value from which to construct the
 * integer. If provided, it is converted to an integer by truncating toward <CODE>0</CODE>.
 * If omitted, it defaults to <CODE>0</CODE>.
 * @returns {int} an integer object constructed from the given <CODE>number</CODE>
 */
declare function _int(number?: number): int;
/**
 * Return an integer object constructed from a <CODE>string</CODE>. If <CODE>base</CODE> is given,
 * the <CODE>string</CODE> is parsed as an integer in radix <CODE>base</CODE>. The <CODE>string</CODE>
 * may include optional whitespace, a leading sign (<CODE>+</CODE> or <CODE>-</CODE>), and underscores between digits.
 *
 * @param {string} <CODE>string</CODE> - A <CODE>string</CODE> representing an integer in a given base.
 * The string may include optional whitespace, a leading sign, and underscores between digits.
 * @param {int} <CODE>base</CODE> - The base (radix) for conversion. It must be <CODE>0</CODE>
 * or an integer in the range <CODE>2</CODE>–<CODE>36</CODE>. The default is <CODE>10</CODE>.
 * @returns {int} an integer object parsed from the provided <CODE>string</CODE> using the specified <CODE>base</CODE>
 */
declare function _int_from_string(string: any, base?: number): int;
/**
 * If the <CODE>prompt</CODE> argument is present, it is written to standard output without a trailing newline.
 * The function then reads a line from input, converts it to a <CODE>string</CODE> (stripping a trailing newline),
 * and returns that.
 *
 * @param {string} <CODE>prompt</CODE> - An optional <CODE>string</CODE> that is written to standard output
 * (without a trailing newline) before input is read.
 * @returns {string} the input read from the user as a <CODE>string</CODE>, with any trailing newline removed
 */
declare function input(prompt: any): string;
/**
 * Return a <CODE>string</CODE> version of <CODE>object</CODE>. If <CODE>object</CODE> is not provided, returns
 * the empty <CODE>string</CODE>.
 *
 * @param {any} <CODE>object</CODE> - The object to be converted to a <CODE>string</CODE>.
 * If not provided, an empty <CODE>string</CODE> is returned.
 * @returns {string} the informal <CODE>string</CODE> representation of <CODE>object</CODE>
 */
declare function str(object?: string): string;
