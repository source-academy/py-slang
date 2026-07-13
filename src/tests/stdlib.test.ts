import {
  MissingRequiredPositionalError,
  RecursionError,
  TypeError,
  UnsupportedOperandTypeError,
  ValueError,
  ZeroDivisionError,
} from "../errors";
import linkedList from "../stdlib/linked-list";
import list from "../stdlib/list";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import pairmutator from "../stdlib/pairmutator";
import stream from "../stdlib/stream";
import { PyComplexNumber } from "../types";
import { FeatureNotSupportedError } from "../validator";
import {
  generateNativePynterTestCases,
  generatePvmlInBrowserTestCases,
  generateTestCases,
  TestCases,
} from "./utils";

describe("Standard Library Tests", () => {
  describe("Chapter 1 Builtins", () => {
    const mathTests: TestCases = {
      abs: [
        ["abs(-5)", 5n, null],
        ["abs(5)", 5n, null],
        ["abs(-3.14)", 3.14, null],
        ["abs(3.14)", 3.14, null],
        ["abs(0)", 0n, null],
        ["abs(-2147483648)", 2147483648n, null],
        ["abs(2147483647)", 2147483647n, null],
        ['abs("")', TypeError, null],
        ["abs(True)", TypeError, null],
      ],
      round: [
        ["round(3.14)", 3n, null],
        ["round(3.5)", 4n, null],
        ["round(3.6)", 4n, null],
        ["round(2.5)", 2n, null],
        ["round(-2.5)", -2n, null],
        ["round(-3.5)", -4n, null],
        ["round(3.14159, 2)", 3.14, null],
        ["round(3.14159, 3)", 3.142, null],
        ["round(3.14159, 0)", 3.0, null],
        ["round(0, 2)", 0n, null],
        ["round(1, 2)", 1n, null],
        ['round("")', TypeError, null],
        ["round(True)", TypeError, null],
        ["round(33.14, -1)", 30.0, null],
        ["round(33.14, 1.5)", TypeError, null],
      ],
      math_sin: [
        ["math_sin(0)", 0.0, null],
        ["math_sin(3.141592653589793)", 1.2246467991473532e-16, null],
        ["math_sin(-3.4)", 0.2555411020268312, null],
        ["math_sin(0.0)", 0.0, null],
        ["math_sin(lambda x : x)", TypeError, null],
        ["math_sin(True)", TypeError, null],
        ['math_sin("")', TypeError, null],
      ],
      math_cos: [
        ["math_cos(0)", 1.0, null],
        ["math_cos(3.141592653589793)", -1.0, null],
        ["math_cos(-3.4)", -0.9667981925794611, null],
        ["math_cos(0.0)", 1.0, null],
        ["math_cos(lambda x : x)", TypeError, null],
        ["math_cos(True)", TypeError, null],
        ['math_cos("")', TypeError, null],
      ],
    };
    const miscTests: TestCases = {
      equality: [
        ["1 == 1", true, null], // int == int
        ["1 == 2", false, null], // int == diff int
        ["1 == 1+0j", true, null], // int == complex
        ["1 == 1.0+0j", true, null], // int == complex
        ["1 == 1+1j", false, null], // int == complex
        ["1 == 1.0", true, null], // int == float
        ["1 == 2.0", false, null], // int == diff float
        ["3.14 == 3.14", true, null], // float == float
        ["3.14 == 3.15", false, null], // float == diff float
        ["1.0 == 1", true, null], // float == int
        ["1.0 == 2", false, null], // float == diff int
        ["1.0 == 1+0j", true, null], // float == complex
        ["1+0j == 1+0j", true, null], // complex == complex
        ["1+0j == 1+1j", false, null], // complex == complex with diff imaginary
        ["1.2+0j == 1+0j", false, null], // complex == complex with diff real
        ["1.2+0j == 1+1.2j", false, null], // complex == diff complex
        ["1+0j == 1", true, null], // complex == int
        ["1.0+0j == 1", true, null], // complex with float real == int
        ["1+0j == 1.0", true, null], // complex == float
        ["1.5+0j == 1.5", true, null], // complex with float real == float
        ["1.5+1j == 1.5", false, null], // complex == diff float
        // `==`/`!=` take any x any at Python §1 too (unified with §2 — see
        // docs/specs/python_typing_middle_12.tex), except bool and function operands, which
        // remain an error; None and cross-type comparisons now compare structurally instead.
        ["True == True", UnsupportedOperandTypeError, null], // bool == bool
        ["1 == True", UnsupportedOperandTypeError, null], // int == bool
        ["1 == None", false, null], // int == None
        ["True == 1", UnsupportedOperandTypeError, null], // bool == int
        ["None == 1", false, null], // None == int
        ["None == None", true, null], // None == None
        ["[] == []", FeatureNotSupportedError, null], // list literals are not supported,
        ["(lambda x: x) == (lambda x: x)", UnsupportedOperandTypeError, null], // function == diff function
        ["1 == (lambda x: x)", UnsupportedOperandTypeError, null], // int == function
        ["def a():\n    return 2\na == a", UnsupportedOperandTypeError, null], // function == function
        ["'' == ''", true, null], // empty string == empty string
        ["hello = 'hello'\nhello == 'hello'", true, null], // string == string
        ["hello = 'hello'\nhello == 'Hello'", false, null], // string == diff string
        ["1 == ''", false, null], // int == string
        ["'' == 1", false, null], // string == int
        ["'' == True", UnsupportedOperandTypeError, null], // string == bool
        ["'' == None", false, null], // string == None
        ["'' == (lambda x: x)", UnsupportedOperandTypeError, null], // string == function
        ["'' == 1.0", false, null], // string == float
        ["'' == 1+0j", false, null], // string == complex
      ],
      inequality: [
        ["1 != 1", false, null], // int != int
        ["1 != 2", true, null], // int != diff int
        ["1 != 1+0j", false, null], // int != complex
        ["1 != 1.0+0j", false, null], // int != complex
        ["1 != 1+1j", true, null], // int != complex
        ["1 != 1.0", false, null], // int != float
        ["1 != 2.0", true, null], // int != diff float
        ["3.14 != 3.14", false, null], // float != float
        ["3.14 != 3.15", true, null], // float != diff float
        ["1.0 != 1", false, null], // float != int
        ["1.0 != 2", true, null], // float != diff int
        ["1.0 != 1+0j", false, null], // float != complex
        ["1+0j != 1+0j", false, null], // complex != complex
        ["1+0j != 1+1j", true, null], // complex != complex with diff imaginary
        ["1.2+0j != 1+0j", true, null], // complex != complex with diff real
        ["1.2+0j != 1+1.2j", true, null], // complex != diff complex
        ["1+0j != 1", false, null], // complex != int
        ["1.0+0j != 1", false, null], // complex with float real != int
        ["1+0j != 1.0", false, null], // complex != float
        ["1.5+0j != 1.5", false, null], // complex with float real != float
        ["1.5+1j != 1.5", true, null], // complex != diff float
        ["True != True", UnsupportedOperandTypeError, null], // bool != bool
        ["1 != True", UnsupportedOperandTypeError, null], // int != bool
        ["1 != None", true, null], // int != None
        ["True != 1", UnsupportedOperandTypeError, null], // bool != int
        ["None != 1", true, null], // None != int
        ["None != None", false, null], // None != None
        ["(lambda x: x) != (lambda x: x)", UnsupportedOperandTypeError, null], // function != diff function
        ["(1 != (lambda x: x))", UnsupportedOperandTypeError, null], // int != function
        ["def a():\n    return 2\na != a", UnsupportedOperandTypeError, null], // function != function,
        ["'' != ''", false, null], // empty string != empty string
        ["hello = 'hello'\nhello != 'hello'", false, null], // string != string
        ["hello = 'hello'\nhello != 'Hello'", true, null], // string != diff string
        ["1 != ''", true, null], // int != string
        ["'' != 1", true, null], // string != int
        ["'' != True", UnsupportedOperandTypeError, null], // string != bool
        ["'' != None", true, null], // string != None
        ["'' != (lambda x: x)", UnsupportedOperandTypeError, null], // string != function
        ["'' != 1.0", true, null], // string != float
        ["'' != 1+0j", true, null], // string != complex
      ],
      "gt, gte, lt, lte": [
        ["1 > 1", false, null], // int > int
        ["2 > 1", true, null], // int > diff int
        ["1 > 1+0j", UnsupportedOperandTypeError, null], // int > complex
        ["1 > 1.0+0j", UnsupportedOperandTypeError, null], // int > complex
        ["1 > 1+1j", UnsupportedOperandTypeError, null], // int > complex
        ["1 > 1.0", false, null], // int > float
        ["1 > 2.0", false, null], // int > diff float
        ["3.14 > 3.14", false, null], // float > float
        ["3.15 > 3.14", true, null], // float > diff float
        ["1.0 > 1", false, null], // float > int
        ["1.0 > 2", false, null], // float > diff int
        ["1.0 > 1+0j", UnsupportedOperandTypeError, null], // float > complex
        ["1+0j > 1+0j", UnsupportedOperandTypeError, null], // complex > complex
        ["1+0j > 1+1j", UnsupportedOperandTypeError, null], // complex > complex with diff imaginary
        ["1.2+0j > 1+0j", UnsupportedOperandTypeError, null], // complex > complex with diff real
        ["1.2+0j > 1+1.2j", UnsupportedOperandTypeError, null], // complex > diff complex
        ["1+0j > 1", UnsupportedOperandTypeError, null], // complex > int
        ["1.0+0j > 1", UnsupportedOperandTypeError, null], // complex with float real > int
        ["1+0j > 1.0", UnsupportedOperandTypeError, null], // complex > float
        ["1.5+0j > 1.5", UnsupportedOperandTypeError, null], // complex with float real > float
        ["1.5+1j > 1.5", UnsupportedOperandTypeError, null], // complex > diff float
        ["True > True", UnsupportedOperandTypeError, null], // bool > bool
        ["1 > True", UnsupportedOperandTypeError, null], // int > bool
        ["1 > None", UnsupportedOperandTypeError, null], // int > None
        ["True > 1", UnsupportedOperandTypeError, null], // bool > int
        ["None > 1", UnsupportedOperandTypeError, null], // None > int
        ["None > None", UnsupportedOperandTypeError, null], // None > None
        ["(lambda x: x) > (lambda x: x)", UnsupportedOperandTypeError, null], // function > diff function
        ["(1 > (lambda x: x))", UnsupportedOperandTypeError, null], // int > function
        ["def a():\n    return 2\na > a", UnsupportedOperandTypeError, null], // function > function,
        ["'' > ''", false, null], // empty string > empty string
        ["hello = 'hello'\nhello > 'hello'", false, null], // string > string
        ["hello = 'hello'\nhello > 'Hello'", true, null], // string > diff string
        ["'a' > 'abc'", false, null], // string > longer string
        ["'a' > 'A'", true, null], // string > string with diff case
        ["'#' > '$'", false, null], // string > string with diff character
        ["1 > ''", UnsupportedOperandTypeError, null], // int > string
        ["'' > 1", UnsupportedOperandTypeError, null], // string > int
        ["'' > True", UnsupportedOperandTypeError, null], // string > bool
        ["'' > None", UnsupportedOperandTypeError, null], // string > None
        ["'' > (lambda x: x)", UnsupportedOperandTypeError, null], // string > function
        ["'' > 1.0", UnsupportedOperandTypeError, null], // string > float
        ["'' > 1+0j", UnsupportedOperandTypeError, null], // string > complex

        ["1 >= 1", true, null], // int >= int
        ["2 >= 1", true, null], // int >= diff int
        ["1 >= 1+0j", UnsupportedOperandTypeError, null], // int >= complex
        ["1 >= 1.0+0j", UnsupportedOperandTypeError, null], // int >= complex
        ["1 >= 1+1j", UnsupportedOperandTypeError, null], // int >= complex
        ["1 >= 1.0", true, null], // int >= float
        ["1 >= 2.0", false, null], // int >= diff float
        ["3.14 >= 3.14", true, null], // float >= float
        ["3.15 >= 3.14", true, null], // float >= diff float
        ["1.0 >= 1", true, null], // float >= int
        ["1.0 >= 2", false, null], // float >= diff int
        ["1.0 >= 1+0j", UnsupportedOperandTypeError, null], // float >= complex
        ["1+0j >= 1+0j", UnsupportedOperandTypeError, null], // complex >= complex
        ["1+0j >= 1+1j", UnsupportedOperandTypeError, null], // complex >= complex with diff imaginary
        ["1.2+0j >= 1+0j", UnsupportedOperandTypeError, null], // complex >= complex with diff real
        ["1.2+0j >= 1+1.2j", UnsupportedOperandTypeError, null], // complex >= diff complex
        ["1+0j >= 1", UnsupportedOperandTypeError, null], // complex >= int
        ["1.0+0j >= 1", UnsupportedOperandTypeError, null], // complex with float real >= int
        ["1+0j >= 1.0", UnsupportedOperandTypeError, null], // complex >= float
        ["1.5+0j >= 1.5", UnsupportedOperandTypeError, null], // complex with float real >= float
        ["1.5+1j >= 1.5", UnsupportedOperandTypeError, null], // complex >= diff float
        ["True >= True", UnsupportedOperandTypeError, null], // bool >= bool
        ["1 >= True", UnsupportedOperandTypeError, null], // int >= bool
        ["1 >= None", UnsupportedOperandTypeError, null], // int >= None
        ["True >= 1", UnsupportedOperandTypeError, null], // bool >= int
        ["None >= 1", UnsupportedOperandTypeError, null], // None >= int
        ["None >= None", UnsupportedOperandTypeError, null], // None >= None
        ["(lambda x: x) >= (lambda x: x)", UnsupportedOperandTypeError, null], // function >= diff function
        ["(1 >= (lambda x: x))", UnsupportedOperandTypeError, null], // int >= function
        ["def a():\n    return 2\na >= a", UnsupportedOperandTypeError, null], // function >= function,
        ["'' >= ''", true, null], // empty string >= empty string
        ["hello = 'hello'\nhello >= 'hello'", true, null], // string >= string
        ["hello = 'hello'\nhello >= 'Hello'", true, null], // string >= diff string
        ["'a' >= 'abc'", false, null], // string >= longer string
        ["'a' >= 'A'", true, null], // string >= string with diff case
        ["'#' >= '$'", false, null], // string >= string with diff character
        ["1 >= ''", UnsupportedOperandTypeError, null], // int >= string
        ["'' >= 1", UnsupportedOperandTypeError, null], // string >= int
        ["'' >= True", UnsupportedOperandTypeError, null], // string >= bool
        ["'' >= None", UnsupportedOperandTypeError, null], // string >= None
        ["'' >= (lambda x: x)", UnsupportedOperandTypeError, null], // string >= function
        ["'' >= 1.0", UnsupportedOperandTypeError, null], // string >= float
        ["'' >= 1+0j", UnsupportedOperandTypeError, null], // string >= complex

        ["1 < 1", false, null], // int < int
        ["1 < 2", true, null], // int < diff int
        ["1 < 1+0j", UnsupportedOperandTypeError, null], // int < complex
        ["1 < 1.0+0j", UnsupportedOperandTypeError, null], // int < complex
        ["1 < 1+1j", UnsupportedOperandTypeError, null], // int < complex
        ["1 < 1.0", false, null], // int < float
        ["1 < 2.0", true, null], // int < diff float
        ["3.14 < 3.14", false, null], // float < float
        ["3.14 < 3.15", true, null], // float < diff float
        ["1.0 < 1", false, null], // float < int
        ["1.0 < 2", true, null], // float < diff int
        ["1.0 < 1+0j", UnsupportedOperandTypeError, null], // float < complex
        ["1+0j < 1+0j", UnsupportedOperandTypeError, null], // complex < complex
        ["1+0j < 1+1j", UnsupportedOperandTypeError, null], // complex < complex with diff imaginary
        ["1.2+0j < 1+0j", UnsupportedOperandTypeError, null], // complex < complex with diff real
        ["1.2+0j < 1+1.2j", UnsupportedOperandTypeError, null], // complex < diff complex
        ["1+0j < 1", UnsupportedOperandTypeError, null], // complex < int
        ["1.0+0j < 1", UnsupportedOperandTypeError, null], // complex with float real < int
        ["1+0j < 1.0", UnsupportedOperandTypeError, null], // complex < float
        ["1.5+0j < 1.5", UnsupportedOperandTypeError, null], // complex with float real < float
        ["1.5+1j < 1.5", UnsupportedOperandTypeError, null], // complex < diff float
        ["True < True", UnsupportedOperandTypeError, null], // bool < bool
        ["1 < True", UnsupportedOperandTypeError, null], // int < bool
        ["1 < None", UnsupportedOperandTypeError, null], // int < None
        ["True < 1", UnsupportedOperandTypeError, null], // bool < int
        ["None < 1", UnsupportedOperandTypeError, null], // None < int
        ["None < None", UnsupportedOperandTypeError, null], // None < None
        ["(lambda x: x) < (lambda x: x)", UnsupportedOperandTypeError, null], // function < diff function
        ["(1 < (lambda x: x))", UnsupportedOperandTypeError, null], // int < function
        ["def a():\n    return 2\na < a", UnsupportedOperandTypeError, null], // function < function,
        ["'' < ''", false, null], // empty string < empty string
        ["hello = 'hello'\nhello < 'hello'", false, null], // string < string
        ["hello = 'hello'\nhello < 'Hello'", false, null], // string < diff string
        ["'a' < 'abc'", true, null], // string < longer string
        ["'a' < 'A'", false, null], // string < string with diff case
        ["'#' < '$'", true, null], // string < string with diff character
        ["1 < ''", UnsupportedOperandTypeError, null], // int < string
        ["'' < 1", UnsupportedOperandTypeError, null], // string < int
        ["'' < True", UnsupportedOperandTypeError, null], // string < bool
        ["'' < None", UnsupportedOperandTypeError, null], // string < None
        ["'' < (lambda x: x)", UnsupportedOperandTypeError, null], // string < function
        ["'' < 1.0", UnsupportedOperandTypeError, null], // string < float
        ["'' < 1+0j", UnsupportedOperandTypeError, null], // string < complex

        ["1 <= 1", true, null], // int <= int
        ["1 <= 2", true, null], // int <= diff int
        ["1 <= 1+0j", UnsupportedOperandTypeError, null], // int <= complex
        ["1 <= 1.0+0j", UnsupportedOperandTypeError, null], // int <= complex
        ["1 <= 1+1j", UnsupportedOperandTypeError, null], // int <= complex
        ["1 <= 1.0", true, null], // int <= float
        ["1 <= 2.0", true, null], // int <= diff float
        ["3.14 <= 3.14", true, null], // float <= float
        ["3.14 <= 3.15", true, null], // float <= diff float
        ["1.0 <= 1", true, null], // float <= int
        ["1.0 <= 2", true, null], // float <= diff int
        ["1.0 <= 1+0j", UnsupportedOperandTypeError, null], // float <= complex
        ["1+0j <= 1+0j", UnsupportedOperandTypeError, null], // complex <= complex
        ["1+0j <= 1+1j", UnsupportedOperandTypeError, null], // complex <= complex with diff imaginary
        ["1.2+0j <= 1+0j", UnsupportedOperandTypeError, null], // complex <= complex with diff real
        ["1.2+0j <= 1+1.2j", UnsupportedOperandTypeError, null], // complex <= diff complex
        ["1+0j <= 1", UnsupportedOperandTypeError, null], // complex <= int
        ["1.0+0j <= 1", UnsupportedOperandTypeError, null], // complex with float real <= int
        ["1+0j <= 1.0", UnsupportedOperandTypeError, null], // complex <= float
        ["1.5+0j <= 1.5", UnsupportedOperandTypeError, null], // complex with float real <= float
        ["1.5+1j <= 1.5", UnsupportedOperandTypeError, null], // complex <= diff
        ["True <= True", UnsupportedOperandTypeError, null], // bool <= bool
        ["1 <= True", UnsupportedOperandTypeError, null], // int <= bool
        ["1 <= None", UnsupportedOperandTypeError, null], // int <= None
        ["True <= 1", UnsupportedOperandTypeError, null], // bool <= int
        ["None <= 1", UnsupportedOperandTypeError, null], // None <= int
        ["None <= None", UnsupportedOperandTypeError, null], // None <= None
        ["(lambda x: x) <= (lambda x: x)", UnsupportedOperandTypeError, null], // function <= diff function
        ["(1 <= (lambda x: x))", UnsupportedOperandTypeError, null], // int <= function
        ["def a():\n    return 2\na <= a", UnsupportedOperandTypeError, null], // function <= function
        ["'' <= ''", true, null], // empty string <= empty string
        ["hello = 'hello'\nhello <= 'hello'", true, null], // string <= string
        ["hello = 'hello'\nhello <= 'Hello'", false, null], // string <= diff string
        ["'a' <= 'abc'", true, null], // string <= longer string
        ["'a' <= 'A'", false, null], // string <= string with diff case
        ["'#' <= '$'", true, null], // string <= string with diff character
        ["1 <= ''", UnsupportedOperandTypeError, null], // int <= string
        ["'' <= 1", UnsupportedOperandTypeError, null], // string <= int
        ["'' <= True", UnsupportedOperandTypeError, null], // string <= bool
        ["'' <= None", UnsupportedOperandTypeError, null], // string <= None
        ["'' <= (lambda x: x)", UnsupportedOperandTypeError, null], // string <= function
        ["'' <= 1.0", UnsupportedOperandTypeError, null], // string <= float
        ["'' <= 1+0j", UnsupportedOperandTypeError, null], // string <= complex
      ],
      "add, sub, mul": [
        ["1 + 1", 2n, null], // int + int
        ["2 + 1", 3n, null], // int + diff int
        ["1 + (1+0j)", PyComplexNumber.fromBigInt(2n), null], // int + complex
        ["1 + (1.0+0j)", PyComplexNumber.fromBigInt(2n), null], // int + complex
        ["1 + (1+1j)", new PyComplexNumber(2, 1), null], // int + complex
        ["1 + 1.0", 2.0, null], // int + float
        ["1 + 2.0", 3.0, null], // int + diff float
        ["3.14 + 3.14", 6.28, null], // float + float
        ["3.15 + 3.14", 6.29, null], // float + diff float
        ["1.0 + 1", 2.0, null], // float + int
        ["1.0 + 2", 3.0, null], // float + diff int
        ["1.0 + (1+0j)", PyComplexNumber.fromBigInt(2n), null], // float + complex
        ["(1+0j) + (1+0j)", PyComplexNumber.fromBigInt(2n), null], // complex + complex
        ["(1+0j) + (1+1j)", new PyComplexNumber(2, 1), null], // complex + complex with diff imaginary
        ["(1.2+0j) + (1+0j)", new PyComplexNumber(2.2, 0), null], // complex + complex with diff real
        ["(1.2+0j) + (1+1.2j)", new PyComplexNumber(2.2, 1.2), null], // complex + diff complex
        ["(1+0j) + 1", new PyComplexNumber(2, 0), null], // complex + int
        ["(1.0+0j) + 1", new PyComplexNumber(2, 0), null], // complex with float real + int
        ["(1+0j) + 1.0", new PyComplexNumber(2, 0), null], // complex + float
        ["(1.5+0j) + 1.5", new PyComplexNumber(3, 0), null], // complex with float real + float
        ["(1.5+1j) + 1.5", new PyComplexNumber(3, 1), null], // complex + diff float
        ["True + True", UnsupportedOperandTypeError, null], // bool + bool
        ["1 + True", UnsupportedOperandTypeError, null], // int + bool
        ["1 + None", UnsupportedOperandTypeError, null], // int + None
        ["True + 1", UnsupportedOperandTypeError, null], // bool + int
        ["None + 1", UnsupportedOperandTypeError, null], // None + int
        ["None + None", UnsupportedOperandTypeError, null], // None + None
        ["(lambda x: x) + (lambda x: x)", UnsupportedOperandTypeError, null], // function + diff function
        ["(1 + (lambda x: x))", UnsupportedOperandTypeError, null], // int + function
        ["def a():\n    return 2\na + a", UnsupportedOperandTypeError, null], // function + function,
        ["'' + ''", "", null], // empty string + empty string
        ["hello = 'hello'\nhello + 'hello'", "hellohello", null], // string + string
        ["hello = 'hello'\nhello + 'Hello'", "helloHello", null], // string + diff string
        ["'a' + 'abc'", "aabc", null], // string + longer string
        ["'a' + 'A'", "aA", null], // string + string with diff case
        ["'#' + '$'", "#$", null], // string + string with diff character
        ["1 + ''", UnsupportedOperandTypeError, null], // int + string
        ["'' + 1", UnsupportedOperandTypeError, null], // string + int
        ["'' + True", UnsupportedOperandTypeError, null], // string + bool
        ["'' + None", UnsupportedOperandTypeError, null], // string + None
        ["'' + (lambda x: x)", UnsupportedOperandTypeError, null], // string + function
        ["'' + 1.0", UnsupportedOperandTypeError, null], // string + float
        ["'' + 1+0j", UnsupportedOperandTypeError, null], // string + complex

        ["1 - 1", 0n, null], // int - int
        ["2 - 1", 1n, null], // int - diff int
        ["1 - (1+0j)", PyComplexNumber.fromBigInt(0n), null], // int - complex
        ["1 - (1.0+0j)", PyComplexNumber.fromBigInt(0n), null], // int - complex
        ["1 - (1+1j)", new PyComplexNumber(0, -1), null], // int - complex
        ["1 - 1.0", 0.0, null], // int - float
        ["1 - 2.0", -1.0, null], // int - diff float
        ["3.14 - 3.14", 0.0, null], // float - float
        ["3.15 - 3.14", 0.01, null], // float - diff float
        ["1.0 - 1", 0.0, null], // float - int
        ["1.0 - 2", -1.0, null], // float - diff int
        ["1.0 - (1+0j)", PyComplexNumber.fromBigInt(0n), null], // float - complex
        ["(1+0j) - (1+0j)", PyComplexNumber.fromBigInt(0n), null], // complex - complex
        ["(1+0j) - (1+1j)", new PyComplexNumber(0, -1), null], // complex - complex with diff imaginary
        ["(1.2+0j) - (1+0j)", new PyComplexNumber(0.2, 0), null], // complex - complex with diff real
        ["(1.2+0j) - (1+1.2j)", new PyComplexNumber(0.2, -1.2), null], // complex - diff complex
        ["(1+0j) - 1", new PyComplexNumber(0, 0), null], // complex - int
        ["(1.0+0j) - 1", new PyComplexNumber(0, 0), null], // complex with float real - int
        ["(1+0j) - 1.0", new PyComplexNumber(0, 0), null], // complex - float
        ["(1.5+0j) - 1.5", new PyComplexNumber(0, 0), null], // complex with float real - float
        ["(1.5+1j) - 1.5", new PyComplexNumber(0, 1), null], // complex - diff float
        ["True - True", UnsupportedOperandTypeError, null], // bool - bool
        ["1 - True", UnsupportedOperandTypeError, null], // int - bool
        ["1 - None", UnsupportedOperandTypeError, null], // int - None
        ["True - 1", UnsupportedOperandTypeError, null], // bool - int
        ["None - 1", UnsupportedOperandTypeError, null], // None - int
        ["None - None", UnsupportedOperandTypeError, null], // None - None
        ["(lambda x: x) - (lambda x: x)", UnsupportedOperandTypeError, null], // function - diff function
        ["(1 - (lambda x: x))", UnsupportedOperandTypeError, null], // int - function
        ["def a():\n    return 2\na - a", UnsupportedOperandTypeError, null], // function - function,
        ["'' - ''", UnsupportedOperandTypeError, null], // empty string - empty string
        ["hello = 'hello'\nhello - 'hello'", UnsupportedOperandTypeError, null], // string - string
        ["hello = 'hello'\nhello - 'Hello'", UnsupportedOperandTypeError, null], // string - diff string
        ["'a' - 'abc'", UnsupportedOperandTypeError, null], // string - longer string
        ["'a' - 'A'", UnsupportedOperandTypeError, null], // string - string with diff case
        ["'#' - '$'", UnsupportedOperandTypeError, null], // string - string with diff character
        ["1 - ''", UnsupportedOperandTypeError, null], // int - string
        ["'' - 1", UnsupportedOperandTypeError, null], // string - int
        ["'' - True", UnsupportedOperandTypeError, null], // string - bool
        ["'' - None", UnsupportedOperandTypeError, null], // string - None
        ["'' - (lambda x: x)", UnsupportedOperandTypeError, null], // string - function
        ["'' - 1.0", UnsupportedOperandTypeError, null], // string - float
        ["'' - 1+0j", UnsupportedOperandTypeError, null], // string - complex

        ["1 * 1", 1n, null], // int * int
        ["2 * 1", 2n, null], // int * int
        ["1 * (1+0j)", new PyComplexNumber(1, 0), null], // int * complex
        ["2 * (1.0+0j)", new PyComplexNumber(2, 0), null], // int * complex
        ["3 * (1+1j)", new PyComplexNumber(3, 3), null], // int * complex
        ["1 * 1.0", 1.0, null], // int * float
        ["1 * 2.0", 2.0, null], // int * diff float
        ["3.14 * 3.14", 9.8596, null], // float * float
        ["3.15 * 3.14", 9.891, null], // float * diff float
        ["1.0 * 1", 1.0, null], // float * int
        ["1.0 * 2", 2.0, null], // float * diff int
        ["1.0 * (1+0j)", PyComplexNumber.fromBigInt(1n), null], // float * complex
        ["(1+0j) * (1+0j)", PyComplexNumber.fromBigInt(1n), null], // complex * complex
        ["(1+0j) * (1+1j)", new PyComplexNumber(1, 1), null], // complex * complex with diff imaginary
        ["(1.2+0j) * (1+0j)", new PyComplexNumber(1.2, 0), null], // complex * complex with diff real
        ["(1.2+1j) * (1.2+1.2j)", new PyComplexNumber(0.24, 2.64), null], // complex * diff complex
        ["(1+0j) * 1", new PyComplexNumber(1, 0), null], // complex * int
        ["(1.0+0j) * 1", new PyComplexNumber(1.0, 0), null], // complex with float real * int
        ["(1+0j) * 1.0", new PyComplexNumber(1.0, 0), null], // complex * float
        ["(1.5+0j) * 1.5", new PyComplexNumber(2.25, 0), null], // complex with float real * float
        ["(1.5+1j) * 1.5", new PyComplexNumber(2.25, 1.5), null], // complex * diff float
        ["True * True", UnsupportedOperandTypeError, null], // bool * bool
        ["1 * True", UnsupportedOperandTypeError, null], // int * bool
        ["1 * None", UnsupportedOperandTypeError, null], // int * None
        ["True * 1", UnsupportedOperandTypeError, null], // bool * int
        ["None * 1", UnsupportedOperandTypeError, null], // None * int
        ["None * None", UnsupportedOperandTypeError, null], // None * None
        ["(lambda x: x) * (lambda x: x)", UnsupportedOperandTypeError, null], // function * diff function
        ["(1 * (lambda x: x))", UnsupportedOperandTypeError, null], // int * function
        ["def a():\n    return 2\na * a", UnsupportedOperandTypeError, null], // function * function,
        ["'' * ''", UnsupportedOperandTypeError, null], // empty string * empty string
        ["hello = 'hello'\nhello * 'hello'", UnsupportedOperandTypeError, null], // string * string
        ["hello = 'hello'\nhello * 'Hello'", UnsupportedOperandTypeError, null], // string * diff string
        ["'a' * 'abc'", UnsupportedOperandTypeError, null], // string * longer string
        ["'a' * 'A'", UnsupportedOperandTypeError, null], // string * string with diff case
        ["'#' * '$'", UnsupportedOperandTypeError, null], // string * string with diff character
        ["1 * ''", UnsupportedOperandTypeError, null], // int * string
        ["'' * 1", UnsupportedOperandTypeError, null], // string * int
        ["'' * True", UnsupportedOperandTypeError, null], // string * bool
        ["'' * None", UnsupportedOperandTypeError, null], // string * None
        ["'' * (lambda x: x)", UnsupportedOperandTypeError, null], // string * function
        ["'' * 1.0", UnsupportedOperandTypeError, null], // string * float
        ["'' * 1+0j", UnsupportedOperandTypeError, null], // string * complex
      ],
      "div and mod": [
        ["1 / 1", 1.0, null], // int / int
        ["2 / 1", 2.0, null], // int / int
        ["1 / (1+0j)", new PyComplexNumber(1, 0), null], // int / complex
        ["2 / (1.0+0j)", new PyComplexNumber(2, 0), null], // int / complex
        ["3 / (1+1j)", new PyComplexNumber(1.5, -1.5), null], // int / complex
        ["1 / 1.0", 1.0, null], // int / float
        ["1 / 2.0", 0.5, null], // int / diff float
        ["3.14 / 3.14", 1.0, null], // float / float
        ["3.15 / 3.14", 1.003184713375796, null], // float / diff float
        ["1.0 / 1", 1.0, null], // float / int
        ["1.0 / 2", 0.5, null], // float / diff int
        ["1.0 / (1+0j)", PyComplexNumber.fromBigInt(1n), null], // float / complex
        ["(1+0j) / (1+0j)", PyComplexNumber.fromBigInt(1n), null], // complex / complex
        ["-(1+0j) / (1+1j)", new PyComplexNumber(-0.5, 0.5), null], // complex / complex with diff imaginary
        ["(1.2+0j) / (1+0j)", new PyComplexNumber(1.2, 0), null], // complex / complex with diff real
        ["(1.2+1j) / (1.2+1.2j)", new PyComplexNumber(11 / 12, -1 / 12), null], // complex / diff complex
        ["(1+0j) / 1", new PyComplexNumber(1, 0), null], // complex / int
        ["(1.0+0j) / 1", new PyComplexNumber(1.0, 0), null], // complex with float real / int
        ["(1+0j) / 1.0", new PyComplexNumber(1.0, 0), null], // complex / float
        ["(1.5+0j) / 1.5", new PyComplexNumber(1.0, 0), null], // complex with float real / float
        ["(1.5+1j) / 1.5", new PyComplexNumber(1.0, 2 / 3), null], // complex / diff float
        ["True / True", UnsupportedOperandTypeError, null], // bool / bool
        ["1 / True", UnsupportedOperandTypeError, null], // int / bool
        ["1 / None", UnsupportedOperandTypeError, null], // int / None
        ["True / 1", UnsupportedOperandTypeError, null], // bool / int
        ["None / 1", UnsupportedOperandTypeError, null], // None / int
        ["None / None", UnsupportedOperandTypeError, null], // None / None
        ["(lambda x: x) / (lambda x: x)", UnsupportedOperandTypeError, null], // function / diff function
        ["(1 / (lambda x: x))", UnsupportedOperandTypeError, null], // int / function
        ["def a():\n    return 2\na / a", UnsupportedOperandTypeError, null], // function / function,
        ["'' / ''", UnsupportedOperandTypeError, null], // empty string / empty string
        ["hello = 'hello'\nhello / 'hello'", UnsupportedOperandTypeError, null], // string / string
        ["hello = 'hello'\nhello / 'Hello'", UnsupportedOperandTypeError, null], // string / diff string
        ["'a' / 'abc'", UnsupportedOperandTypeError, null], // string / longer string
        ["'a' / 'A'", UnsupportedOperandTypeError, null], // string / string with diff case
        ["'#' / '$'", UnsupportedOperandTypeError, null], // string / string with diff character
        ["1 / ''", UnsupportedOperandTypeError, null], // int / string
        ["'' / 1", UnsupportedOperandTypeError, null], // string / int
        ["'' / True", UnsupportedOperandTypeError, null], // string / bool
        ["'' / None", UnsupportedOperandTypeError, null], // string / None
        ["'' / (lambda x: x)", UnsupportedOperandTypeError, null], // string / function
        ["'' / 1.0", UnsupportedOperandTypeError, null], // string / float
        ["'' / (1+0j)", UnsupportedOperandTypeError, null], // string / complex
        ["1 / 0", ZeroDivisionError, null], // int / zero
        ["1 / 0.0", ZeroDivisionError, null], // int / zero
        ["1 / (0+0j)", ZeroDivisionError, null], // int / zero

        ["1 % 1", 0n, null], // int % int
        ["2 % 1", 0n, null], // int % int
        ["1 % (1+0j)", UnsupportedOperandTypeError, null], // int % complex
        ["2 % (1.0+0j)", UnsupportedOperandTypeError, null], // int % complex
        ["3 % (1+1j)", UnsupportedOperandTypeError, null], // int % complex
        ["1 % 1.0", 0.0, null], // int % float
        ["3.5 % 2.0", 1.5, null], // int % diff float
        ["3.14 % 3.14", 0.0, null], // float % float
        ["3.15 % 3.14", 0.01, null], // float % diff float
        ["1.0 % 1", 0, null], // float % int
        ["1.0 % 2", 1, null], // float % diff int
        ["-4 % 3", 2n, null], // negative int % int
        ["-4.0 % 3.0", 2.0, null], // negative float % float
        ["1.0 % (1+0j)", UnsupportedOperandTypeError, null], // float % complex
        ["(1+0j) % (1+0j)", UnsupportedOperandTypeError, null], // complex % complex
        ["-(1+0j) % (1+1j)", UnsupportedOperandTypeError, null], // complex % complex with diff imaginary
        ["(1.2+0j) % (1+0j)", UnsupportedOperandTypeError, null], // complex % complex with diff real
        ["(1.2+1j) % (1.2+1.2j)", UnsupportedOperandTypeError, null], // complex % diff complex
        ["(1+0j) % 1", UnsupportedOperandTypeError, null], // complex % int
        ["(1.0+0j) % 1", UnsupportedOperandTypeError, null], // complex with float real % int
        ["(1+0j) % 1.0", UnsupportedOperandTypeError, null], // complex % float
        ["(1.5+0j) % 1.5", UnsupportedOperandTypeError, null], // complex with float real % float
        ["(1.5+1j) % 1.5", UnsupportedOperandTypeError, null], // complex % diff float
        ["True % True", UnsupportedOperandTypeError, null], // bool % bool
        ["1 % True", UnsupportedOperandTypeError, null], // int % bool
        ["1 % None", UnsupportedOperandTypeError, null], // int % None
        ["True % 1", UnsupportedOperandTypeError, null], // bool % int
        ["None % 1", UnsupportedOperandTypeError, null], // None % int
        ["None % None", UnsupportedOperandTypeError, null], // None % None
        ["(lambda x: x) % (lambda x: x)", UnsupportedOperandTypeError, null], // function % diff function
        ["(1 % (lambda x: x))", UnsupportedOperandTypeError, null], // int % function
        ["def a():\n    return 2\na % a", UnsupportedOperandTypeError, null], // function % function,
        ["'' % ''", UnsupportedOperandTypeError, null], // empty string % empty string
        ["hello = 'hello'\nhello % 'hello'", UnsupportedOperandTypeError, null], // string % string
        ["hello = 'hello'\nhello % 'Hello'", UnsupportedOperandTypeError, null], // string % diff string
        ["'a' % 'abc'", UnsupportedOperandTypeError, null], // string % longer string
        ["'a' % 'A'", UnsupportedOperandTypeError, null], // string % string with diff case
        ["'#' % '$'", UnsupportedOperandTypeError, null], // string % string with diff character
        ["1 % ''", UnsupportedOperandTypeError, null], // int % string
        ["'' % 1", UnsupportedOperandTypeError, null], // string % int
        ["'' % True", UnsupportedOperandTypeError, null], // string % bool
        ["'' % None", UnsupportedOperandTypeError, null], // string % None
        ["'' % (lambda x: x)", UnsupportedOperandTypeError, null], // string % function
        ["'' % 1.0", UnsupportedOperandTypeError, null], // string % float
        ["'' % 1+0j", UnsupportedOperandTypeError, null], // string % complex
      ],
      "** operator": [
        ["1 ** 1", 1n, null], // int ** int
        ["2 ** 1", 2n, null], // int ** int
        ["1 ** (1+0j)", new PyComplexNumber(1, 0), null], // int ** complex
        ["2 ** (1.0+0j)", new PyComplexNumber(2, 0), null], // int ** complex
        ["3 ** (1+1j)", new PyComplexNumber(1.364497268479829, 2.6717311250032414), null], // int ** complex
        ["1 ** 1.0", 1.0, null], // int ** float
        ["3.5 ** 2.0", 12.25, null], // int ** diff float
        ["3.14 ** 3.14", 36.33783888017471, null], // float ** float
        ["3.15 ** -3.14", 0.027246132299496836, null], // float ** diff float
        ["1.0 ** 1", 1.0, null], // float ** int
        ["1.0 ** 2", 1.0, null], // float ** diff int
        ["-4 ** 3", -64n, null], // negative int ** int
        ["4 ** -3", 0.015625, null], // int ** negative int
        ["1 ** -1.0", 1.0, null], // int ** negative float
        ["-4.0 ** 3.0", -64.0, null], // negative float ** float
        ["1.0 ** (1+0j)", new PyComplexNumber(1, 0), null], // float ** complex
        ["(1+0j) ** (1+0j)", new PyComplexNumber(1, 0), null], // complex ** complex
        ["-(1+0j) ** (1+1j)", new PyComplexNumber(-1, -0), null], // complex ** complex with diff imaginary
        ["(1.2+0j) ** (1+0j)", new PyComplexNumber(1.2, 0), null], // complex ** complex with diff real
        [
          "(1.2+1j) ** (1.2+1.2j)",
          new PyComplexNumber(0.14879042300637976, 0.7268673514247604),
          null,
        ], // complex ** diff complex
        ["(1+0j) ** 1", new PyComplexNumber(1, 0), null], // complex ** int
        ["(1.0+0j) ** 1", new PyComplexNumber(1, 0), null], // complex with float real ** int
        ["(1+0j) ** 1.0", new PyComplexNumber(1, 0), null], // complex ** float
        ["(1.5+0j) ** 1.5", new PyComplexNumber(1.8371173070873836, 0), null], // complex with float real ** float
        ["(1.5+1j) ** 1.5", new PyComplexNumber(1.538509152171183, 1.8686921660119655), null], // complex ** diff float
        ["(1.5+1j) ** -1.5", new PyComplexNumber(0.2625881011088203, -0.31894274189888794), null], // complex ** negative float
        ["True ** True", UnsupportedOperandTypeError, null], // bool ** bool
        ["1 ** True", UnsupportedOperandTypeError, null], // int ** bool
        ["1 ** None", UnsupportedOperandTypeError, null], // int ** None
        ["True ** 1", UnsupportedOperandTypeError, null], // bool ** int
        ["None ** 1", UnsupportedOperandTypeError, null], // None ** int
        ["None ** None", UnsupportedOperandTypeError, null], // None ** None
        ["(lambda x: x) ** (lambda x: x)", UnsupportedOperandTypeError, null], // function ** diff function
        ["(1 ** (lambda x: x))", UnsupportedOperandTypeError, null], // int ** function
        ["def a():\n    return 2\na ** a", UnsupportedOperandTypeError, null], // function ** function,
        ["'' ** ''", UnsupportedOperandTypeError, null], // empty string ** empty string
        ["hello = 'hello'\nhello ** 'hello'", UnsupportedOperandTypeError, null], // string ** string
        ["hello = 'hello'\nhello ** 'Hello'", UnsupportedOperandTypeError, null], // string ** diff string
        ["'a' ** 'abc'", UnsupportedOperandTypeError, null], // string ** longer string
        ["'a' ** 'A'", UnsupportedOperandTypeError, null], // string ** string with diff case
        ["'#' ** '$'", UnsupportedOperandTypeError, null], // string ** string with diff character
        ["1 ** ''", UnsupportedOperandTypeError, null], // int ** string
        ["'' ** 1", UnsupportedOperandTypeError, null], // string ** int
        ["'' ** True", UnsupportedOperandTypeError, null], // string ** bool
        ["'' ** None", UnsupportedOperandTypeError, null], // string ** None
        ["'' ** (lambda x: x)", UnsupportedOperandTypeError, null], // string ** function
        ["'' ** 1.0", UnsupportedOperandTypeError, null], // string ** float
        ["'' ** 1+0j", UnsupportedOperandTypeError, null], // string ** complex
      ],

      "and, or, not": [
        ["True and True", true, null], // bool and bool
        ["True and False", false, null], // bool and bool
        ["False and True", false, null], // bool and bool
        ["False and False", false, null], // bool and bool
        ["True or True", true, null], // bool or bool
        ["True or False", true, null], // bool or bool
        ["False or True", true, null], // bool or bool
        ["False or False", false, null], // bool or bool
        ["not True", false, null], // not bool
        ["not False", true, null], // not bool
        ["not 1", UnsupportedOperandTypeError, null], // not int
        ["not 1.0", UnsupportedOperandTypeError, null], // not float
        ["not (1+0j)", UnsupportedOperandTypeError, null], // not complex
        ["not None", UnsupportedOperandTypeError, null], // not None
        ["not (lambda x: x)", UnsupportedOperandTypeError, null], // not function
        ["not ''", UnsupportedOperandTypeError, null], // not string
        ["'abc' and 1", UnsupportedOperandTypeError, null], // string and int
        ["True and 1", 1n, null], // bool and int
        ["False and 1", false, null], // bool and int
        ["'abc' or 1", UnsupportedOperandTypeError, null], // string or int
        ["True or 1", true, null], // bool or int
        ["False or 1", 1n, null], // bool or int
        ["(lambda x: x) and 1", UnsupportedOperandTypeError, null], // function and int
        ["(lambda x: x) or 1", UnsupportedOperandTypeError, null], // function or int
        ["'' and 1", UnsupportedOperandTypeError, null], // string and int
        ["'' or 1", UnsupportedOperandTypeError, null], // string or int
        ["None and 1", UnsupportedOperandTypeError, null], // None and int
        ["None or 1", UnsupportedOperandTypeError, null], // None or int
        ["1 and 1", UnsupportedOperandTypeError, null], // int and int
        ["1 or 1", UnsupportedOperandTypeError, null], // int or int
      ],
      "unary minus": [
        ["-1", -1n, null], // unary minus int
        ["-1.0", -1.0, null], // unary minus float
        ["-(1+0j)", new PyComplexNumber(-1, 0), null], // unary minus complex
        ["-True", UnsupportedOperandTypeError, null], // unary minus bool
        ["-None", UnsupportedOperandTypeError, null], // unary minus None
        ["-(lambda x: x)", UnsupportedOperandTypeError, null], // unary minus function
        ["-''", UnsupportedOperandTypeError, null], // unary minus string
      ],

      "str and repr": [
        ["str(1)", "1", null],
        ["str(3.14)", "3.14", null],
        ["str(True)", "True", null],
        ["str(None)", "None", null],
        ["str(lambda x: x)", "<function (anonymous)>", null],
        ['str("")', "", null],
        ['str("abc\\ndef\\tghi\\"jkl\\\'mno\\\\pqr")', "abc\ndef\tghi\"jkl'mno\\pqr", null],
        ["str('\"\\\\\\'')", "\"\\\'", null],
        [
          "str('\\'\\\\\\'\"\\\\\\\\\\\\\\'\\\\\\\\\\\\\\'\"\\\\\\'\\'')",
          "'\\'\"\\\\\\'\\\\\\'\"\\''",
          null,
        ],
        ["str(1+2j)", "(1+2j)", null],
        ["repr(1)", "1", null],
        ["repr(3.14)", "3.14", null],
        ["repr(True)", "True", null],
        ["repr(None)", "None", null],
        ["repr(lambda x: x)", "<function (anonymous)>", null],
        ['repr("")', "''", null],
        [
          'repr("abc\\ndef\\tghi\\"jkl\\\'mno\\\\pqr")',
          "'abc\\ndef\\tghi\"jkl\\'mno\\\\pqr'",
          null,
        ],
        ["repr('\"\\\\\\'')", "'\"\\\\\\''", null],
        [
          "repr('\\'\\\\\\'\"\\\\\\\\\\\\\\'\\\\\\\\\\\\\\'\"\\\\\\'\\'')",
          "'\\'\\\\\\'\"\\\\\\\\\\\\\\'\\\\\\\\\\\\\\'\"\\\\\\'\\''",
          null,
        ],
        ["repr(1+2j)", "(1+2j)", null],
      ],
      "boundary tests": [
        ["a = 18446744073709551616\nstr(a)", "18446744073709551616", null],
        ["a = 18446744073709551616\nrepr(a)", "18446744073709551616", null],
        ["a = 18446744073709551616\nb = 2**64\na == b", true, null],
        ["a = 18446744073709551616\nb = 18446744073709551615\na != b", true, null],
        ["def f(x): return 1 + f(x)\nf(2)", RecursionError, null],
        ["def f(x): return f(x - 1) if x > 0 else 0\nf(10240)", 0n, null],
      ],
      "is functions": [
        ["is_integer(1)", true, null],
        ["is_integer(1.0)", false, null],
        ["is_integer(3.14)", false, null],
        ["is_integer(True)", false, null],
        ["is_integer(None)", false, null],
        ["is_integer(lambda x: x)", false, null],
        ["is_integer(print)", false, null],
        ["is_integer(1+0j)", false, null],
        ['is_integer("abc")', false, null],

        ["is_number(1)", true, null],
        ["is_number(1.0)", true, null],
        ["is_number(3.14)", true, null],
        ["is_number(1+0j)", true, null],
        ["is_number(True)", false, null],
        ["is_number(None)", false, null],
        ["is_number(lambda x: x)", false, null],
        ["is_number(print)", false, null],
        ['is_number("abc")', false, null],

        ["is_float(1)", false, null],
        ["is_float(1.0)", true, null],
        ["is_float(3.14)", true, null],
        ["is_float(True)", false, null],
        ["is_float(None)", false, null],
        ["is_float(lambda x: x)", false, null],
        ["is_float(print)", false, null],
        ["is_float(1+0j)", false, null],
        ['is_float("abc")', false, null],

        ["is_boolean(1)", false, null],
        ["is_boolean(1.0)", false, null],
        ["is_boolean(3.14)", false, null],
        ["is_boolean(True)", true, null],
        ["is_boolean(False)", true, null],
        ["is_boolean(None)", false, null],
        ["is_boolean(print)", false, null],
        ["is_boolean(lambda x: x)", false, null],
        ["is_boolean(1+0j)", false, null],
        ['is_boolean("abc")', false, null],

        ["is_none(1)", false, null],
        ["is_none(1.0)", false, null],
        ["is_none(3.14)", false, null],
        ["is_none(True)", false, null],
        ["is_none(None)", true, null],
        ["is_none(print)", false, null],
        ["is_none(lambda x: x)", false, null],
        ["is_none(1+0j)", false, null],
        ['is_none("abc")', false, null],

        ["is_function(1)", false, null],
        ["is_function(1.0)", false, null],
        ["is_function(3.14)", false, null],
        ["is_function(True)", false, null],
        ["is_function(None)", false, null],
        ["is_function(lambda x: x)", true, null],
        ["is_function(print)", true, null],
        ["is_function(is_function)", true, null],
        ["is_function(1+0j)", false, null],
        ['is_function("abc")', false, null],

        ["is_string(1)", false, null],
        ["is_string(1.0)", false, null],
        ["is_string(3.14)", false, null],
        ["is_string(True)", false, null],
        ["is_string(None)", false, null],
        ["is_string(lambda x: x)", false, null],
        ["is_string(print)", false, null],
        ['is_string("")', true, null],
        ['is_string("abc")', true, null],

        ["is_none(1)", false, null],
        ["is_none(1.0)", false, null],
        ["is_none(3.14)", false, null],
        ["is_none(True)", false, null],
        ["is_none(None)", true, null],
        ["is_none(print)", false, null],
        ["is_none(lambda x: x)", false, null],
        ["is_none(1+0j)", false, null],
        ['is_none("abc")', false, null],

        ["is_function(1)", false, null],
        ["is_function(1.0)", false, null],
        ["is_function(3.14)", false, null],
        ["is_function(True)", false, null],
        ["is_function(None)", false, null],
        ["is_function(lambda x: x)", true, null],
        ["is_function(print)", true, null],
        ["is_function(is_function)", true, null],
        ["is_function(1+0j)", false, null],
        ['is_function("abc")', false, null],

        ["is_string(1)", false, null],
        ["is_string(1.0)", false, null],
        ["is_string(3.14)", false, null],
        ["is_string(True)", false, null],
        ["is_string(None)", false, null],
        ["is_string(lambda x: x)", false, null],
        ["is_string(print)", false, null],
        ['is_string("")', true, null],
        ['is_string("abc")', true, null],
      ],

      coercing: [
        ["complex()", new PyComplexNumber(0, 0), null], // complex() with no arguments returns 0j
        ["complex(1)", PyComplexNumber.fromBigInt(1n), null],
        ["complex(1.0)", PyComplexNumber.fromNumber(1), null],
        ["complex(3.14)", PyComplexNumber.fromNumber(3.14), null],
        ["complex(True)", PyComplexNumber.fromNumber(1), null],
        ["complex(False)", PyComplexNumber.fromNumber(0), null],
        ["complex(None)", TypeError, null],
        ["complex(print)", TypeError, null],
        ["complex(lambda x: x)", TypeError, null],
        ["complex(1+0j)", PyComplexNumber.fromBigInt(1n), null],
        ['complex("abc")', ValueError, null],
        ['complex("1+0j")', PyComplexNumber.fromNumber(1), null],
        ['complex("1+2j")', new PyComplexNumber(1, 2), null],
        ['complex("1.5+2.5j")', new PyComplexNumber(1.5, 2.5), null],
        ['complex("1.5-2.5j")', new PyComplexNumber(1.5, -2.5), null],
        ['complex("-1.5-2.5j")', new PyComplexNumber(-1.5, -2.5), null],
        ['complex("-1.5+2.5j")', new PyComplexNumber(-1.5, 2.5), null],
        ['complex("-1.5")', new PyComplexNumber(-1.5, 0), null],
        ['complex("-1.5e+2")', new PyComplexNumber(-150, 0), null],
        ['complex("-1.5e-2")', new PyComplexNumber(-0.015, 0), null],
        ['complex("1_000")', new PyComplexNumber(1000, 0), null],
        ['complex("1_000e+2-2.5e-2j")', new PyComplexNumber(100000, -0.025), null],
        ['complex("1-j")', new PyComplexNumber(1, -1), null],
        ['complex("nanj")', new PyComplexNumber(0, NaN), null],
        ['complex("+infinity+nanj")', new PyComplexNumber(Infinity, NaN), null],
        ['complex("")', ValueError, null],
        ['complex(" ")', ValueError, null],
        ['complex("1e-5+infj")', new PyComplexNumber(1e-5, Infinity), null],
        ['complex(1, "2")', TypeError, null],
        ["complex(1, 2.5)", new PyComplexNumber(1, 2.5), null],
        ["complex(1, 2)", new PyComplexNumber(1, 2), null],
        ["complex(1, True)", new PyComplexNumber(1, 1), null],
        ["complex(1, False)", new PyComplexNumber(1, 0), null],
        ["complex(1, None)", TypeError, null],
        ["complex(1, lambda x: x)", TypeError, null],
        ["complex(0, 1j)", new PyComplexNumber(-1, 0), null],
      ],
      arity: [
        ["arity(abs)", 1n, null],
        ["arity(arity)", 1n, null],
        ["arity(complex)", 0n, null],
        ["arity(error)", 0n, null],
        ["arity(imag)", 1n, null],
        ["arity(math_acos)", 1n, null],
        ["arity(math_acosh)", 1n, null],
        ["arity(math_asin)", 1n, null],
        ["arity(math_asinh)", 1n, null],
        ["arity(math_atan)", 1n, null],
        ["arity(math_atan2)", 2n, null],
        ["arity(math_atanh)", 1n, null],
        ["arity(math_cos)", 1n, null],
        ["arity(math_cosh)", 1n, null],
        ["arity(math_degrees)", 1n, null],
        ["arity(math_erf)", 1n, null],
        ["arity(math_erfc)", 1n, null],
        ["arity(math_comb)", 2n, null],
        ["arity(math_factorial)", 1n, null],
        ["arity(math_gcd)", 0n, null],
        ["arity(math_isqrt)", 1n, null],
        ["arity(math_lcm)", 0n, null],
        ["arity(math_perm)", 1n, null],
        ["arity(math_ceil)", 1n, null],
        ["arity(math_fabs)", 1n, null],
        ["arity(math_floor)", 1n, null],
        ["arity(math_fma)", 3n, null],
        ["arity(math_fmod)", 2n, null],
        ["arity(math_remainder)", 2n, null],
        ["arity(math_trunc)", 1n, null],
        ["arity(math_copysign)", 2n, null],
        ["arity(math_isfinite)", 1n, null],
        ["arity(math_isinf)", 1n, null],
        ["arity(math_isnan)", 1n, null],
        ["arity(math_ldexp)", 2n, null],
        ["arity(math_nextafter)", 2n, null],
        ["arity(math_ulp)", 1n, null],
        ["arity(math_cbrt)", 1n, null],
        ["arity(math_exp)", 1n, null],
        ["arity(math_exp2)", 1n, null],
        ["arity(math_expm1)", 1n, null],
        ["arity(math_gamma)", 1n, null],
        ["arity(math_lgamma)", 1n, null],
        ["arity(math_log)", 1n, null],
        ["arity(math_log10)", 1n, null],
        ["arity(math_log1p)", 1n, null],
        ["arity(math_log2)", 1n, null],
        ["arity(math_pow)", 2n, null],
        ["arity(math_radians)", 1n, null],
        ["arity(math_sin)", 1n, null],
        ["arity(math_sinh)", 1n, null],
        ["arity(math_tan)", 1n, null],
        ["arity(math_tanh)", 1n, null],
        ["arity(math_sqrt)", 1n, null],
        ["arity(is_none)", 1n, null],
        ["arity(is_boolean)", 1n, null],
        ["arity(is_complex)", 1n, null],
        ["arity(is_string)", 1n, null],
        ["arity(is_function)", 1n, null],
        ["arity(is_float)", 1n, null],
        ["arity(is_integer)", 1n, null],
        ["arity(len)", 1n, null],
        ["arity(max)", 2n, null],
        ["arity(min)", 2n, null],
        ["arity(random_random)", 0n, null],
        ["arity(real)", 1n, null],
        ["arity(round)", 1n, null],
        ["arity(time_time)", 0n, null],
        ["arity(str)", 0n, null],
        ["arity(repr)", 1n, null],
        ["arity(print)", 0n, null],
        ["arity(input)", 0n, null],
        ["arity(lambda x : x)", 1n, null],
        ["arity((lambda x, y: x + y))", 2n, null],
        ["arity(1)", TypeError, null],
        ["arity(1.0)", TypeError, null],
        ["arity(1+0j)", TypeError, null],
        ["arity(None)", TypeError, null],
        ["arity('abc')", TypeError, null],
        ["arity(True)", TypeError, null],
      ],
      len: [
        ["len('')", 0n, null],
        ["len('abc')", 3n, null],
        ["len('hello world')", 11n, null],
        ["len('こんにちは')", 5n, null],
        ["len('👋🌍')", 2n, null],
        ["len(1)", TypeError, null],
        ["len(1.0)", TypeError, null],
        ["len(1+0j)", TypeError, null],
        ["len(None)", TypeError, null],
        ["len(True)", TypeError, null],
        ["len(lambda x: x)", TypeError, null],
        ["len(print)", TypeError, null],
      ],
      "max/min": [
        ["max(1, 7, 3)", 7n, null],
        ["min(4, 2, 9)", 2n, null],
        ["max(1.5, 2.5)", 2.5, null],
        ["max('a', 'c', 'b')", "c", null],
        // Unlike CPython's max()/min(), which accept a single iterable
        // argument (max([1, 2, 3]) == 3), this dialect's max/min always
        // require >= 2 direct arguments -- there is no single-iterable form
        // (see the chapter-3 "max/min: no single-iterable form" test below
        // for the pair/list borderline case).
        ["max(5)", MissingRequiredPositionalError, null],
        ["min(5)", MissingRequiredPositionalError, null],
        ["max()", MissingRequiredPositionalError, null],
        ["min()", MissingRequiredPositionalError, null],
      ],
      "CRLF tests": [
        ["hello = 'hello'\r\nhello", "hello", null],
        ["hello = 'hello'\r\nhello\r\n", "hello", null],
        ["hello = 'hello'\r\n\r\nhello", "hello", null],
        ["hello = 'hello'\r\n# This is a comment\r\nhello", "hello", null],
      ],
      "predefined variables": [["a = 1\n__program__", "a = 1\n__program__", null]],
    };

    generateTestCases(mathTests, 1, [misc, math]);
    generateTestCases(miscTests, 1, [misc, math]);
    // Pynter only supports Python §3 (see pynter/README.md). mathTests is
    // chapter-agnostic builtin behaviour (e.g. `abs(True)` is a TypeError
    // regardless of chapter), so it's still valid to run at §3. miscTests,
    // however, asserts §1-*specific* restrictions (bool/None/function
    // excluded from ==/!=/ordering, list literals rejected) that are only
    // true at §1/§2 — genuinely false at §3, not just "untested" there — so
    // it's deliberately not run through Pynter at all here.
    // Known Pynter gaps below (round()'s two-arg form, banker's rounding),
    // see py-slang#259. abs(±2^31-ish) is a newly-found, separate gap: native
    // Pynter's small-int range is only 21 bits (NANBOX_INTMAX/MIN, see
    // nanbox.h), narrower than the compiler's 32-bit LGCI-vs-LGCF64 encoding
    // decision (I32_MIN/I32_MAX in pvml-compiler.ts) — a literal this large
    // still compiles to LGCI, but native Pynter's own NANBOX_WRAP_INT then
    // silently falls back to a float at runtime once it's out of the 21-bit
    // range, so abs() of a value already at the edge of int32 comes back as
    // a float instead of an int.
    generateNativePynterTestCases(mathTests, 3, undefined, [
      "round(2.5)",
      "round(-2.5)",
      "round(3.14159, 2)",
      "round(3.14159, 3)",
      "round(33.14, -1)",
      "round(33.14, 1.5)",
      "abs(-2147483648)",
      "abs(2147483647)",
    ]);
    // Unlike native Pynter, PVML-in-browser isn't restricted to §3, so
    // miscTests' §1-specific restrictions can be checked directly at §1.
    generatePvmlInBrowserTestCases(mathTests, 1, [misc, math]);
    generatePvmlInBrowserTestCases(miscTests, 1, [misc, math]);
  });

  describe("Chapter 3 Builtins", () => {
    const miscTests: TestCases = {
      // `is` now applies to any x any at Python §3/§4 (docs/specs/python_typing_middle_34.tex),
      // not just the reference types (list, function, None): numbers, strings and booleans are
      // valid operands too. Since this interpreter has no real object identity for immutable
      // primitives (each is a freshly wrapped value, not a boxed object) they compare by their
      // underlying value instead, the same simplification `==` already makes for these types.
      "is operator": [
        ["1 is 1", true, null], // int is int, same value
        ["1 is 1.0", false, null], // int is float — different types, never identical
        ["3.14 is 3.14", true, null], // float is float, same value
        ["(1+0j) is (1+0j)", true, null], // complex is complex, same value
        ["True is True", true, null], // bool is bool, same value
        ["1 is True", false, null], // int is bool — different types, never identical
        ["hello = 'hello'\nhello is 'hello'", true, null], // string is string, same value
        ["1 is None", false, null], // number x reference — different types, never identical
        ["None is 1", false, null],
        ["'' is None", false, null],
        ["'' is (lambda x: x)", false, null],
        ["[1,2,3] is ''", false, null],
        ["1 is (lambda x: x)", false, null],
        ["a = [1,2,3]\na is 1", false, null],
        ["None is None", true, null], // None is None
        ["(lambda x: x) is (lambda x: x)", false, null], // function is diff function
        ["def a():\n    return 2\na is a", true, null], // function is same function
        ["f = lambda x: x\ng = f\nf is g", true, null], // function is its alias
        ["a = [1,2,3]\na is None", false, null], // list is None (the Python idiom)
        ["(lambda x: x) is None", false, null], // function is None
        ["None is []", false, null], // None is list
        ["[1,2,3] is [1,2,3]", false, null], // list is list with same elements
        ["a = [1,2,3]\na is a", true, null], // list is itself
        ["a = [1,2,3]\nb = a\na is b", true, null], // list is its alias
        ["a = [1,2,3]\na is [1,2,3]", false, null], // list is different list with same elements
        ["[1,2,3] is [1,2,4]", false, null], // list is different list with different elements
        ["[1,2,3] is [1,2]", false, null], // list is different list with different length
        ["[1,2,3] is (lambda x: x)", false, null], // list is function
      ],
      // math_nan is a shared singleton value; as in CPython, nan == nan is
      // False even for the identical object, while a list containing that nan
      // equals itself (container comparison checks identity per element first)
      "NaN comparisons": [
        ["math_nan == math_nan", false, null],
        ["math_nan != math_nan", true, null],
        ["math_nan < 1", false, null],
        ["math_nan >= math_nan", false, null],
        ["[math_nan] == [math_nan]", true, null],
        ["x = [math_nan]\nx == x", true, null],
        // `is` identity must hold regardless of what value-equality says about the same object:
        // math_nan is math_nan is the same binding, so it's identical, even though it is not
        // structurally equal to itself (== is False, per IEEE 754 — see above).
        ["math_nan is math_nan", true, null],
        ["x = math_nan\nx is x", true, null],
        ["x = complex(math_nan, 0)\nx is x", true, null],
        // NaN-ness propagates component-wise into complex: a complex value with a NaN real or
        // imaginary part is unequal to everything, including itself, same as a plain float NaN —
        // but (as with math_nan above) a *shared* NaN-complex nested in a container still equals
        // itself, since container comparison checks identity per element first.
        ["x = complex(math_nan, 0)\nx == x", false, null],
        ["x = complex(math_nan, 0)\nx != x", true, null],
        ["x = complex(0, math_nan)\nx == x", false, null],
        ["complex(math_nan, 0) == complex(math_nan, 0)", false, null],
        ["c = complex(math_nan, 0)\n[c] == [c]", true, null],
        ["[complex(math_nan, 0)] == [complex(math_nan, 0)]", false, null],
      ],
      // `is not` is the negation of `is` (regression: it used to parse as plain `is`)
      "is not operator": [
        ["1 is not 1", false, null],
        ["'x' is not 'x'", false, null],
        ["None is not None", false, null],
        ["a = [1,2,3]\na is not a", false, null],
        ["a = [1,2,3]\nb = [1,2,3]\na is not b", true, null],
        ["a = [1,2,3]\na is not None", true, null],
        ["(lambda x: x) is not (lambda x: x)", true, null],
      ],
      arity: [
        ["arity((lambda *args: args))", 0n, null],
        ["arity((lambda x, *args: args))", 1n, null],
        ["def f(x, y, *args, z):\n    pass\narity(f)", 2n, null],
        ["def f(*args, x, y, z):\n    pass\narity(f)", 0n, null],
        ["arity([1, 2, 3])", TypeError, null],
      ],
      len: [
        ["len([1, 2, 3])", 3n, null], // len list
        ["len([])", 0n, null], // len empty list
      ],
      "List access": [
        ["a = 'abc'\na[0]", "a", null],
        ["a = '🎊🎉🔔❤️‍🩹'\na[0]", "🎊", null],
        ["a = '👨‍👩‍👧‍👦'\na[0]", "👨", null],
        ["a = '👨‍👩‍👧‍👦'\na[1]", "\u200d", null],
      ],
      // Unlike CPython's max()/min(), which accept a single iterable argument
      // (max([1, 2, 3]) == 3), this dialect's max/min always require >= 2
      // direct arguments. A list or pair is the borderline case: it *looks*
      // like the single-iterable form CPython supports, but is rejected the
      // same way max(5) is (see the chapter-1 "max/min" tests above), since
      // it's still just one argument — a pair is a two-element Python list
      // under the hood, so both forms hit the same arity check.
      "max/min: no single-iterable form": [
        ["max([1, 5])", MissingRequiredPositionalError, null],
        ["max(pair(1, 5))", MissingRequiredPositionalError, null],
      ],
    };
    generateTestCases(miscTests, 3, [misc, math, linkedList, stream, list, pairmutator]);
    // Known Pynter gaps below (real is/is not identity bugs, NaN identity/
    // equality — a structural consequence of Pynter's unboxed number
    // representation, arity() miscounting *args-then-keyword-only params
    // and lambda *args, and missing string indexing — verified to fault
    // even on plain ASCII, not just multi-codepoint characters as originally
    // filed) are tracked in py-slang#259. ("1 is 1.0" removed: fixed by the
    // visitLiteralExpr float-literal compiler fix, verified against the
    // native binary.)
    generateNativePynterTestCases(miscTests, 3, undefined, [
      "hello = 'hello'\nhello is 'hello'",
      "math_nan == math_nan",
      "math_nan != math_nan",
      "math_nan < 1",
      "math_nan >= math_nan",
      "[math_nan] == [math_nan]",
      "x = [math_nan]\nx == x",
      "math_nan is math_nan",
      "x = math_nan\nx is x",
      "x = complex(math_nan, 0)\nx is x",
      "x = complex(math_nan, 0)\nx == x",
      "x = complex(math_nan, 0)\nx != x",
      "x = complex(0, math_nan)\nx == x",
      "complex(math_nan, 0) == complex(math_nan, 0)",
      "c = complex(math_nan, 0)\n[c] == [c]",
      "[complex(math_nan, 0)] == [complex(math_nan, 0)]",
      "'x' is not 'x'",
      "arity((lambda *args: args))",
      "arity((lambda x, *args: args))",
      "def f(x, y, *args, z):\n    pass\narity(f)",
      "def f(*args, x, y, z):\n    pass\narity(f)",
      "a = 'abc'\na[0]",
      "a = '🎊🎉🔔❤️‍🩹'\na[0]",
      "a = '👨‍👩‍👧‍👦'\na[0]",
      "a = '👨‍👩‍👧‍👦'\na[1]",
    ]);
    // PVML has no keyword-only parameters at all, by design (a rest
    // parameter must be the closure's last one — see PVMLIR's
    // `hasRestParam` doc comment and PVMLCompiler's fromFunctionNode, which
    // rejects `def f(x, *args, z): ...` at compile time). The two
    // `*args`-then-keyword-only arity() entries in miscTests.arity assert
    // CSE's real-Python keyword-only arity (2/0) — correct for CSE (tested
    // above), meaningless for this pathway, so they're dropped from the
    // table passed here entirely rather than run and skipped: this isn't a
    // gap PVML-in-browser could ever close, not even in principle.
    const miscTestsForPvmlInBrowser: TestCases = {
      ...miscTests,
      arity: miscTests.arity.filter(
        ([code]) =>
          code !== "def f(x, y, *args, z):\n    pass\narity(f)" &&
          code !== "def f(*args, x, y, z):\n    pass\narity(f)",
      ),
    };
    generatePvmlInBrowserTestCases(miscTestsForPvmlInBrowser, 3, [
      misc,
      math,
      linkedList,
      stream,
      list,
      pairmutator,
    ]);
  });
});
