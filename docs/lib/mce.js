/**
 * returns the parse tree that results from parsing
 * the string <CODE>str</CODE> as a Python program. The format
 * of the parse tree is described in chapter 4 of
 * the textbook
 * in <a href="https://sourceacademy.org/sicpjs/">Structure and
 * Interpretation of Computer Programs, JavaScript Adaptation</a> (SICP).
 * @param {str} x - given program as a string
 * @returns {value} parse tree
 */
function parse(str) {}

/**
 * returns the list of tokens that results from lexing the string <CODE>s</CODE>
 * @param {str} s - given program as a string
 * @returns {linked_list} linked list of tokens
 */
function tokenize(str) {}

/**
 * calls the function <CODE>f</CODE>
 * with arguments given in linked list <CODE>xs</CODE>. For example: <PRE><CODE>def times(x, y):
 *     return x * y
 * 
 * apply_in_underlying_python(times, list(2, 3)); # returns 6</CODE></PRE>
 * @param {function} f - function to be applied
 * @param {linked_list} xs - arguments given in list
 * @returns {value} whatever <CODE>f</CODE> returns
 */
function apply_in_underlying_python(f, xs) {}
