import { TypeError } from "../errors";
import { ResolverErrors } from "../resolver/errors";
import { PyComplexNumber } from "../types";
import { generateTestCases, TestCases } from "./utils";

describe('Standard Library Tests', () => {
    describe('Chapter 1 Builtins', () => {
        const mathTests: TestCases = {
            'abs': [
                ["abs(-5)", 5n, null],
                ["abs(5)", 5n, null],
                ["abs(-3.14)", 3.14, null],
                ["abs(3.14)", 3.14, null],
                ["abs(0)", 0n, null],
                ["abs(-2147483648)", 2147483648n, null],
                ["abs(2147483647)", 2147483647n, null],
                ["abs(\"\")", TypeError, null],
                ["abs(True)", TypeError, null],
            ],
            'round': [
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
                ["round(\"\")", TypeError, null],
                ["round(True)", TypeError, null],
                ["round(33.14, -1)", 30.0, null],
                ["round(33.14, 1.5)", TypeError, null],
            ],
            'math_sin': [
                ["math_sin(0)", 0.0, null],
                ["math_sin(3.141592653589793)", 1.2246467991473532e-16, null],
                ["math_sin(-3.4)", 0.2555411020268312, null],
                ["math_sin(0.0)", 0.0, null],
                ["math_sin(lambda x : x)", TypeError, null],
                ["math_sin(True)", TypeError, null],
                ["math_sin(\"\")", TypeError, null],
            ],
            'math_cos': [
                ["math_cos(0)", 1.0, null],
                ["math_cos(3.141592653589793)", -1.0, null],
                ["math_cos(-3.4)", -0.9667981925794611, null],
                ["math_cos(0.0)", 1.0, null],
                ["math_cos(lambda x : x)", TypeError, null],
                ["math_cos(True)", TypeError, null],
                ["math_cos(\"\")", TypeError, null],
            ]

        };
        const miscTests: TestCases = {
            'equality': [
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
                ["True == True", TypeError, null], // bool == bool
                ["1 == True", TypeError, null], // int == bool
                ["1 == None", TypeError, null], // int == None
                ["True == 1", TypeError, null], // bool == int
                ["None == 1", TypeError, null], // None == int
                ["None == None", TypeError, null], // None == None
                ["[] == []", ResolverErrors.UnsupportedFeatureError, null], // list literals are not supported,
                ["(lambda x: x) == (lambda x: x)", TypeError, null], // function == diff function
                ["1 == (lambda x: x)", TypeError, null], // int == function
                ["def a():\n    return 2\na == a", TypeError, null], // function == function
                ["'' == ''", true, null], // empty string == empty string
                ["hello = 'hello'\nhello == 'hello'", true, null], // string == string
                ["hello = 'hello'\nhello == 'Hello'", false, null], // string == diff string
                ["1 == ''", TypeError, null], // int == string
                ["'' == 1", TypeError, null], // string == int
                ["'' == True", TypeError, null], // string == bool
                ["'' == None", TypeError, null], // string == None
                ["'' == (lambda x: x)", TypeError, null], // string == function
                ["'' == 1.0", TypeError, null], // string == float
                ["'' == 1+0j", TypeError, null], // string == complex
            ],
            "inequality": [
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
                ["True != True", TypeError, null], // bool != bool
                ["1 != True", TypeError, null], // int != bool
                ["1 != None", TypeError, null], // int != None
                ["True != 1", TypeError, null], // bool != int
                ["None != 1", TypeError, null], // None != int
                ["None != None", TypeError, null], // None != None
                ["(lambda x: x) != (lambda x: x)", TypeError, null], // function != diff function
                ["(1 != (lambda x: x))", TypeError, null], // int != function
                ["def a():\n    return 2\na != a", TypeError, null], // function != function,
                ["'' != ''", false, null], // empty string != empty string
                ["hello = 'hello'\nhello != 'hello'", false, null], // string != string
                ["hello = 'hello'\nhello != 'Hello'", true, null], // string != diff string
                ["1 != ''", TypeError, null], // int != string
                ["'' != 1", TypeError, null], // string != int
                ["'' != True", TypeError, null], // string != bool
                ["'' != None", TypeError, null], // string != None
                ["'' != (lambda x: x)", TypeError, null], // string != function
                ["'' != 1.0", TypeError, null], // string != float
                ["'' != 1+0j", TypeError, null], // string != complex
            ],
            "gt, gte, lt, lte": [
                ["1 > 1", false, null], // int > int
                ["2 > 1", true, null], // int > diff int
                ["1 > 1+0j", TypeError, null], // int > complex
                ["1 > 1.0+0j", TypeError, null], // int > complex
                ["1 > 1+1j", TypeError, null], // int > complex
                ["1 > 1.0", false, null], // int > float
                ["1 > 2.0", false, null], // int > diff float
                ["3.14 > 3.14", false, null], // float > float
                ["3.15 > 3.14", true, null], // float > diff float
                ["1.0 > 1", false, null], // float > int
                ["1.0 > 2", false, null], // float > diff int
                ["1.0 > 1+0j", TypeError, null], // float > complex
                ["1+0j > 1+0j", TypeError, null], // complex > complex
                ["1+0j > 1+1j", TypeError, null], // complex > complex with diff imaginary
                ["1.2+0j > 1+0j", TypeError, null], // complex > complex with diff real
                ["1.2+0j > 1+1.2j", TypeError, null], // complex > diff complex
                ["1+0j > 1", TypeError, null], // complex > int
                ["1.0+0j > 1", TypeError, null], // complex with float real > int
                ["1+0j > 1.0", TypeError, null], // complex > float
                ["1.5+0j > 1.5", TypeError, null], // complex with float real > float
                ["1.5+1j > 1.5", TypeError, null], // complex > diff float
                ["True > True", TypeError, null], // bool > bool
                ["1 > True", TypeError, null], // int > bool
                ["1 > None", TypeError, null], // int > None
                ["True > 1", TypeError, null], // bool > int
                ["None > 1", TypeError, null], // None > int
                ["None > None", TypeError, null], // None > None
                ["(lambda x: x) > (lambda x: x)", TypeError, null], // function > diff function
                ["(1 > (lambda x: x))", TypeError, null], // int > function
                ["def a():\n    return 2\na > a", TypeError, null], // function > function,
                ["'' > ''", false, null], // empty string > empty string
                ["hello = 'hello'\nhello > 'hello'", false, null], // string > string
                ["hello = 'hello'\nhello > 'Hello'", true, null], // string > diff string
                ["'a' > 'abc'", false, null], // string > longer string
                ["'a' > 'A'", true, null], // string > string with diff case
                ["'#' > '$'", false, null], // string > string with diff character
                ["1 > ''", TypeError, null], // int > string
                ["'' > 1", TypeError, null], // string > int
                ["'' > True", TypeError, null], // string > bool
                ["'' > None", TypeError, null], // string > None
                ["'' > (lambda x: x)", TypeError, null], // string > function
                ["'' > 1.0", TypeError, null], // string > float
                ["'' > 1+0j", TypeError, null], // string > complex

                ["1 >= 1", true, null], // int >= int
                ["2 >= 1", true, null], // int >= diff int
                ["1 >= 1+0j", TypeError, null], // int >= complex
                ["1 >= 1.0+0j", TypeError, null], // int >= complex
                ["1 >= 1+1j", TypeError, null], // int >= complex
                ["1 >= 1.0", true, null], // int >= float
                ["1 >= 2.0", false, null], // int >= diff float
                ["3.14 >= 3.14", true, null], // float >= float
                ["3.15 >= 3.14", true, null], // float >= diff float
                ["1.0 >= 1", true, null], // float >= int
                ["1.0 >= 2", false, null], // float >= diff int
                ["1.0 >= 1+0j", TypeError, null], // float >= complex
                ["1+0j >= 1+0j", TypeError, null], // complex >= complex
                ["1+0j >= 1+1j", TypeError, null], // complex >= complex with diff imaginary
                ["1.2+0j >= 1+0j", TypeError, null], // complex >= complex with diff real
                ["1.2+0j >= 1+1.2j", TypeError, null], // complex >= diff complex
                ["1+0j >= 1", TypeError, null], // complex >= int
                ["1.0+0j >= 1", TypeError, null], // complex with float real >= int
                ["1+0j >= 1.0", TypeError, null], // complex >= float
                ["1.5+0j >= 1.5", TypeError, null], // complex with float real >= float
                ["1.5+1j >= 1.5", TypeError, null], // complex >= diff float
                ["True >= True", TypeError, null], // bool >= bool
                ["1 >= True", TypeError, null], // int >= bool
                ["1 >= None", TypeError, null], // int >= None
                ["True >= 1", TypeError, null], // bool >= int
                ["None >= 1", TypeError, null], // None >= int
                ["None >= None", TypeError, null], // None >= None
                ["(lambda x: x) >= (lambda x: x)", TypeError, null], // function >= diff function
                ["(1 >= (lambda x: x))", TypeError, null], // int >= function
                ["def a():\n    return 2\na >= a", TypeError, null], // function >= function,
                ["'' >= ''", true, null], // empty string >= empty string
                ["hello = 'hello'\nhello >= 'hello'", true, null], // string >= string
                ["hello = 'hello'\nhello >= 'Hello'", true, null], // string >= diff string
                ["'a' >= 'abc'", false, null], // string >= longer string
                ["'a' >= 'A'", true, null], // string >= string with diff case
                ["'#' >= '$'", false, null], // string >= string with diff character
                ["1 >= ''", TypeError, null], // int >= string
                ["'' >= 1", TypeError, null], // string >= int
                ["'' >= True", TypeError, null], // string >= bool
                ["'' >= None", TypeError, null], // string >= None
                ["'' >= (lambda x: x)", TypeError, null], // string >= function
                ["'' >= 1.0", TypeError, null], // string >= float
                ["'' >= 1+0j", TypeError, null], // string >= complex

                ["1 < 1", false, null], // int < int
                ["1 < 2", true, null], // int < diff int
                ["1 < 1+0j", TypeError, null], // int < complex
                ["1 < 1.0+0j", TypeError, null], // int < complex
                ["1 < 1+1j", TypeError, null], // int < complex
                ["1 < 1.0", false, null], // int < float
                ["1 < 2.0", true, null], // int < diff float
                ["3.14 < 3.14", false, null], // float < float
                ["3.14 < 3.15", true, null], // float < diff float
                ["1.0 < 1", false, null], // float < int
                ["1.0 < 2", true, null], // float < diff int
                ["1.0 < 1+0j", TypeError, null], // float < complex
                ["1+0j < 1+0j", TypeError, null], // complex < complex
                ["1+0j < 1+1j", TypeError, null], // complex < complex with diff imaginary
                ["1.2+0j < 1+0j", TypeError, null], // complex < complex with diff real
                ["1.2+0j < 1+1.2j", TypeError, null], // complex < diff complex
                ["1+0j < 1", TypeError, null], // complex < int
                ["1.0+0j < 1", TypeError, null], // complex with float real < int
                ["1+0j < 1.0", TypeError, null], // complex < float
                ["1.5+0j < 1.5", TypeError, null], // complex with float real < float
                ["1.5+1j < 1.5", TypeError, null], // complex < diff float
                ["True < True", TypeError, null], // bool < bool
                ["1 < True", TypeError, null], // int < bool
                ["1 < None", TypeError, null], // int < None
                ["True < 1", TypeError, null], // bool < int
                ["None < 1", TypeError, null], // None < int
                ["None < None", TypeError, null], // None < None
                ["(lambda x: x) < (lambda x: x)", TypeError, null], // function < diff function
                ["(1 < (lambda x: x))", TypeError, null], // int < function
                ["def a():\n    return 2\na < a", TypeError, null], // function < function,
                ["'' < ''", false, null], // empty string < empty string
                ["hello = 'hello'\nhello < 'hello'", false, null], // string < string
                ["hello = 'hello'\nhello < 'Hello'", false, null], // string < diff string
                ["'a' < 'abc'", true, null], // string < longer string
                ["'a' < 'A'", false, null], // string < string with diff case
                ["'#' < '$'", true, null], // string < string with diff character
                ["1 < ''", TypeError, null], // int < string
                ["'' < 1", TypeError, null], // string < int
                ["'' < True", TypeError, null], // string < bool
                ["'' < None", TypeError, null], // string < None
                ["'' < (lambda x: x)", TypeError, null], // string < function
                ["'' < 1.0", TypeError, null], // string < float
                ["'' < 1+0j", TypeError, null], // string < complex

                ["1 <= 1", true, null], // int <= int
                ["1 <= 2", true, null], // int <= diff int
                ["1 <= 1+0j", TypeError, null], // int <= complex
                ["1 <= 1.0+0j", TypeError, null], // int <= complex
                ["1 <= 1+1j", TypeError, null], // int <= complex
                ["1 <= 1.0", true, null], // int <= float
                ["1 <= 2.0", true, null], // int <= diff float
                ["3.14 <= 3.14", true, null], // float <= float
                ["3.14 <= 3.15", true, null], // float <= diff float
                ["1.0 <= 1", true, null], // float <= int
                ["1.0 <= 2", true, null], // float <= diff int
                ["1.0 <= 1+0j", TypeError, null], // float <= complex
                ["1+0j <= 1+0j", TypeError, null], // complex <= complex
                ["1+0j <= 1+1j", TypeError, null], // complex <= complex with diff imaginary
                ["1.2+0j <= 1+0j", TypeError, null], // complex <= complex with diff real
                ["1.2+0j <= 1+1.2j", TypeError, null], // complex <= diff complex
                ["1+0j <= 1", TypeError, null], // complex <= int
                ["1.0+0j <= 1", TypeError, null], // complex with float real <= int
                ["1+0j <= 1.0", TypeError, null], // complex <= float
                ["1.5+0j <= 1.5", TypeError, null], // complex with float real <= float
                ["1.5+1j <= 1.5", TypeError, null], // complex <= diff
                ["True <= True", TypeError, null], // bool <= bool
                ["1 <= True", TypeError, null], // int <= bool
                ["1 <= None", TypeError, null], // int <= None
                ["True <= 1", TypeError, null], // bool <= int
                ["None <= 1", TypeError, null], // None <= int
                ["None <= None", TypeError, null], // None <= None
                ["(lambda x: x) <= (lambda x: x)", TypeError, null], // function <= diff function
                ["(1 <= (lambda x: x))", TypeError, null], // int <= function
                ["def a():\n    return 2\na <= a", TypeError, null], // function <= function
                ["'' <= ''", true, null], // empty string <= empty string
                ["hello = 'hello'\nhello <= 'hello'", true, null], // string <= string
                ["hello = 'hello'\nhello <= 'Hello'", false, null], // string <= diff string
                ["'a' <= 'abc'", true, null], // string <= longer string
                ["'a' <= 'A'", false, null], // string <= string with diff case
                ["'#' <= '$'", true, null], // string <= string with diff character
                ["1 <= ''", TypeError, null], // int <= string
                ["'' <= 1", TypeError, null], // string <= int
                ["'' <= True", TypeError, null], // string <= bool
                ["'' <= None", TypeError, null], // string <= None
                ["'' <= (lambda x: x)", TypeError, null], // string <= function
                ["'' <= 1.0", TypeError, null], // string <= float
                ["'' <= 1+0j", TypeError, null], // string <= complex
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
                ["True + True", TypeError, null], // bool + bool
                ["1 + True", TypeError, null], // int + bool
                ["1 + None", TypeError, null], // int + None
                ["True + 1", TypeError, null], // bool + int
                ["None + 1", TypeError, null], // None + int
                ["None + None", TypeError, null], // None + None
                ["(lambda x: x) + (lambda x: x)", TypeError, null], // function + diff function
                ["(1 + (lambda x: x))", TypeError, null], // int + function
                ["def a():\n    return 2\na + a", TypeError, null], // function + function,
                ["'' + ''", "", null], // empty string + empty string
                ["hello = 'hello'\nhello + 'hello'", "hellohello", null], // string + string
                ["hello = 'hello'\nhello + 'Hello'", "helloHello", null], // string + diff string
                ["'a' + 'abc'", "aabc", null], // string + longer string
                ["'a' + 'A'", "aA", null], // string + string with diff case
                ["'#' + '$'", "#$", null], // string + string with diff character
                ["1 + ''", TypeError, null], // int + string
                ["'' + 1", TypeError, null], // string + int
                ["'' + True", TypeError, null], // string + bool
                ["'' + None", TypeError, null], // string + None
                ["'' + (lambda x: x)", TypeError, null], // string + function
                ["'' + 1.0", TypeError, null], // string + float
                ["'' + 1+0j", TypeError, null], // string + complex

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
                ["True - True", TypeError, null], // bool - bool
                ["1 - True", TypeError, null], // int - bool
                ["1 - None", TypeError, null], // int - None
                ["True - 1", TypeError, null], // bool - int
                ["None - 1", TypeError, null], // None - int
                ["None - None", TypeError, null], // None - None
                ["(lambda x: x) - (lambda x: x)", TypeError, null], // function - diff function
                ["(1 - (lambda x: x))", TypeError, null], // int - function
                ["def a():\n    return 2\na - a", TypeError, null], // function - function,
                ["'' - ''", TypeError, null], // empty string - empty string
                ["hello = 'hello'\nhello - 'hello'", TypeError, null], // string - string
                ["hello = 'hello'\nhello - 'Hello'", TypeError, null], // string - diff string
                ["'a' - 'abc'", TypeError, null], // string - longer string
                ["'a' - 'A'", TypeError, null], // string - string with diff case
                ["'#' - '$'", TypeError, null], // string - string with diff character
                ["1 - ''", TypeError, null], // int - string
                ["'' - 1", TypeError, null], // string - int
                ["'' - True", TypeError, null], // string - bool
                ["'' - None", TypeError, null], // string - None
                ["'' - (lambda x: x)", TypeError, null], // string - function
                ["'' - 1.0", TypeError, null], // string - float
                ["'' - 1+0j", TypeError, null], // string - complex

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
                ["True * True", TypeError, null], // bool * bool
                ["1 * True", TypeError, null], // int * bool
                ["1 * None", TypeError, null], // int * None
                ["True * 1", TypeError, null], // bool * int
                ["None * 1", TypeError, null], // None * int
                ["None * None", TypeError, null], // None * None
                ["(lambda x: x) * (lambda x: x)", TypeError, null], // function * diff function
                ["(1 * (lambda x: x))", TypeError, null], // int * function
                ["def a():\n    return 2\na * a", TypeError, null], // function * function,
                ["'' * ''", TypeError, null], // empty string * empty string
                ["hello = 'hello'\nhello * 'hello'", TypeError, null], // string * string
                ["hello = 'hello'\nhello * 'Hello'", TypeError, null], // string * diff string
                ["'a' * 'abc'", TypeError, null], // string * longer string
                ["'a' * 'A'", TypeError, null], // string * string with diff case
                ["'#' * '$'", TypeError, null], // string * string with diff character
                ["1 * ''", TypeError, null], // int * string
                ["'' * 1", TypeError, null], // string * int
                ["'' * True", TypeError, null], // string * bool
                ["'' * None", TypeError, null], // string * None
                ["'' * (lambda x: x)", TypeError, null], // string * function
                ["'' * 1.0", TypeError, null], // string * float
                ["'' * 1+0j", TypeError, null], // string * complex
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
                ["(1.2+1j) / (1.2+1.2j)", new PyComplexNumber(11/12, -1/12), null], // complex / diff complex
                ["(1+0j) / 1", new PyComplexNumber(1, 0), null], // complex / int
                ["(1.0+0j) / 1", new PyComplexNumber(1.0, 0), null], // complex with float real / int
                ["(1+0j) / 1.0", new PyComplexNumber(1.0, 0), null], // complex / float
                ["(1.5+0j) / 1.5", new PyComplexNumber(1.0, 0), null], // complex with float real / float
                ["(1.5+1j) / 1.5", new PyComplexNumber(1.0, 2/3), null], // complex / diff float
                ["True / True", TypeError, null], // bool / bool
                ["1 / True", TypeError, null], // int / bool
                ["1 / None", TypeError, null], // int / None
                ["True / 1", TypeError, null], // bool / int
                ["None / 1", TypeError, null], // None / int
                ["None / None", TypeError, null], // None / None
                ["(lambda x: x) / (lambda x: x)", TypeError, null], // function / diff function
                ["(1 / (lambda x: x))", TypeError, null], // int / function
                ["def a():\n    return 2\na / a", TypeError, null], // function / function,
                ["'' / ''", TypeError, null], // empty string / empty string
                ["hello = 'hello'\nhello / 'hello'", TypeError, null], // string / string
                ["hello = 'hello'\nhello / 'Hello'", TypeError, null], // string / diff string
                ["'a' / 'abc'", TypeError, null], // string / longer string
                ["'a' / 'A'", TypeError, null], // string / string with diff case
                ["'#' / '$'", TypeError, null], // string / string with diff character
                ["1 / ''", TypeError, null], // int / string
                ["'' / 1", TypeError, null], // string / int
                ["'' / True", TypeError, null], // string / bool
                ["'' / None", TypeError, null], // string / None
                ["'' / (lambda x: x)", TypeError, null], // string / function
                ["'' / 1.0", TypeError, null], // string / float
                ["'' / 1+0j", TypeError, null], // string / complex

                ["1 % 1", 0n, null], // int % int
                ["2 % 1", 0n, null], // int % int
                ["1 % (1+0j)", TypeError, null], // int % complex
                ["2 % (1.0+0j)", TypeError, null], // int % complex
                ["3 % (1+1j)", TypeError, null], // int % complex
                ["1 % 1.0", 0.0, null], // int % float
                ["3.5 % 2.0", 1.5, null], // int % diff float
                ["3.14 % 3.14", 0.0, null], // float % float
                ["3.15 % 3.14", 0.01, null], // float % diff float
                ["1.0 % 1", 0, null], // float % int
                ["1.0 % 2", 1, null], // float % diff int
                ["-4 % 3", 2n, null], // negative int % int
                ["-4.0 % 3.0", 2.0, null], // negative float % float
                ["1.0 % (1+0j)", TypeError, null], // float % complex
                ["(1+0j) % (1+0j)", TypeError, null], // complex % complex
                ["-(1+0j) % (1+1j)", TypeError, null], // complex % complex with diff imaginary
                ["(1.2+0j) % (1+0j)", TypeError, null], // complex % complex with diff real
                ["(1.2+1j) % (1.2+1.2j)", TypeError, null], // complex % diff complex
                ["(1+0j) % 1", TypeError, null], // complex % int
                ["(1.0+0j) % 1", TypeError, null], // complex with float real % int
                ["(1+0j) % 1.0", TypeError, null], // complex % float
                ["(1.5+0j) % 1.5", TypeError, null], // complex with float real % float
                ["(1.5+1j) % 1.5", TypeError, null], // complex % diff float
                ["True % True", TypeError, null], // bool % bool
                ["1 % True", TypeError, null], // int % bool
                ["1 % None", TypeError, null], // int % None
                ["True % 1", TypeError, null], // bool % int
                ["None % 1", TypeError, null], // None % int
                ["None % None", TypeError, null], // None % None
                ["(lambda x: x) % (lambda x: x)", TypeError, null], // function % diff function
                ["(1 % (lambda x: x))", TypeError, null], // int % function
                ["def a():\n    return 2\na % a", TypeError, null], // function % function,
                ["'' % ''", TypeError, null], // empty string % empty string
                ["hello = 'hello'\nhello % 'hello'", TypeError, null], // string % string
                ["hello = 'hello'\nhello % 'Hello'", TypeError, null], // string % diff string
                ["'a' % 'abc'", TypeError, null], // string % longer string
                ["'a' % 'A'", TypeError, null], // string % string with diff case
                ["'#' % '$'", TypeError, null], // string % string with diff character
                ["1 % ''", TypeError, null], // int % string
                ["'' % 1", TypeError, null], // string % int
                ["'' % True", TypeError, null], // string % bool
                ["'' % None", TypeError, null], // string % None
                ["'' % (lambda x: x)", TypeError, null], // string % function
                ["'' % 1.0", TypeError, null], // string % float
                ["'' % 1+0j", TypeError, null], // string % complex
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
                ["(1.2+1j) ** (1.2+1.2j)", new PyComplexNumber(0.14879042300637976, 0.7268673514247604), null], // complex ** diff complex
                ["(1+0j) ** 1", new PyComplexNumber(1, 0), null], // complex ** int
                ["(1.0+0j) ** 1", new PyComplexNumber(1, 0), null], // complex with float real ** int
                ["(1+0j) ** 1.0", new PyComplexNumber(1, 0), null], // complex ** float
                ["(1.5+0j) ** 1.5", new PyComplexNumber(1.8371173070873836, 0), null], // complex with float real ** float
                ["(1.5+1j) ** 1.5", new PyComplexNumber(1.538509152171183,1.8686921660119655), null], // complex ** diff float
                ["(1.5+1j) ** -1.5", new PyComplexNumber(0.2625881011088203,-0.31894274189888794), null], // complex ** negative float
                ["True ** True", TypeError, null], // bool ** bool
                ["1 ** True", TypeError, null], // int ** bool
                ["1 ** None", TypeError, null], // int ** None
                ["True ** 1", TypeError, null], // bool ** int
                ["None ** 1", TypeError, null], // None ** int
                ["None ** None", TypeError, null], // None ** None
                ["(lambda x: x) ** (lambda x: x)", TypeError, null], // function ** diff function
                ["(1 ** (lambda x: x))", TypeError, null], // int ** function
                ["def a():\n    return 2\na ** a", TypeError, null], // function ** function,
                ["'' ** ''", TypeError, null], // empty string ** empty string
                ["hello = 'hello'\nhello ** 'hello'", TypeError, null], // string ** string
                ["hello = 'hello'\nhello ** 'Hello'", TypeError, null], // string ** diff string
                ["'a' ** 'abc'", TypeError, null], // string ** longer string
                ["'a' ** 'A'", TypeError, null], // string ** string with diff case
                ["'#' ** '$'", TypeError, null], // string ** string with diff character
                ["1 ** ''", TypeError, null], // int ** string
                ["'' ** 1", TypeError, null], // string ** int
                ["'' ** True", TypeError, null], // string ** bool
                ["'' ** None", TypeError, null], // string ** None
                ["'' ** (lambda x: x)", TypeError, null], // string ** function
                ["'' ** 1.0", TypeError, null], // string ** float
                ["'' ** 1+0j", TypeError, null], // string ** complex
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
                ["not 1", TypeError, null], // not int
                ["not 1.0", TypeError, null], // not float
                ["not (1+0j)", TypeError, null], // not complex
                ["not None", TypeError, null], // not None
                ["not (lambda x: x)", TypeError, null], // not function
                ["not ''", TypeError, null], // not string
                ["'abc' and 1", TypeError, null], // string and int
                ["True and 1", 1n, null], // bool and int
                ["False and 1", false, null], // bool and int
                ["'abc' or 1", TypeError, null], // string or int
                ["True or 1", true, null], // bool or int
                ["False or 1", 1n, null], // bool or int
                ["(lambda x: x) and 1", TypeError, null], // function and int
                ["(lambda x: x) or 1", TypeError, null], // function or int
                ["'' and 1", TypeError, null], // string and int
                ["'' or 1", TypeError, null], // string or int
                ["None and 1", TypeError, null], // None and int
                ["None or 1", TypeError, null], // None or int
                ["1 and 1", TypeError, null], // int and int
                ["1 or 1", TypeError, null], // int or int
            ],
            "unary minus": [
                ["-1", -1n, null], // unary minus int
                ["-1.0", -1.0, null], // unary minus float
                ["-(1+0j)", new PyComplexNumber(-1, 0), null], // unary minus complex
                ["-True", TypeError, null], // unary minus bool
                ["-None", TypeError, null], // unary minus None
                ["-(lambda x: x)", TypeError, null], // unary minus function
                ["-''", TypeError, null], // unary minus string
            ],

            "str and repr": [
                ["str(1)", "1", null],
                ["str(3.14)", "3.14", null],
                ["str(True)", "True", null],
                ["str(None)", "None", null],
                ["str(lambda x: x)", "<function (anonymous)>", null],
                ["str(\"\")", "", null],
                ["str(\"abc\\ndef\\tghi\\\"jkl\\'mno\\\\pqr\")", "abc\ndef\tghi\"jkl'mno\\pqr", null],
                ["str('\"\\\\\\'')", "\"\\\'", null],
                ['str(\'\\\'\\\\\\\'"\\\\\\\\\\\\\\\'\\\\\\\\\\\\\\\'"\\\\\\\'\\\'\')', '\'\\\'"\\\\\\\'\\\\\\\'"\\\'\'', null],
                ["str(1+2j)", "(1+2j)", null],
                ["repr(1)", "1", null],
                ["repr(3.14)", "3.14", null],
                ["repr(True)", "True", null],
                ["repr(None)", "None", null],
                ["repr(lambda x: x)", "<function (anonymous)>", null],
                ["repr(\"\")", "''", null],
                ["repr(\"abc\\ndef\\tghi\\\"jkl\\'mno\\\\pqr\")", '\'abc\\ndef\\tghi"jkl\\\'mno\\\\pqr\'', null],
                ["repr('\"\\\\\\'')", '\'"\\\\\\\'\'', null],
                ['repr(\'\\\'\\\\\\\'"\\\\\\\\\\\\\\\'\\\\\\\\\\\\\\\'"\\\\\\\'\\\'\')', '\'\\\'\\\\\\\'"\\\\\\\\\\\\\\\'\\\\\\\\\\\\\\\'"\\\\\\\'\\\'\'', null],
                ["repr(1+2j)", "(1+2j)", null],
            ],
            "is functions": [
                ["is_int(1)", true, null],
                ["is_int(1.0)", false, null],
                ["is_int(3.14)", false, null],
                ["is_int(True)", false, null],
                ["is_int(None)", false, null],
                ["is_int(lambda x: x)", false, null],
                ["is_int(print)", false, null],
                ["is_int(1+0j)", false, null],
                ["is_int(\"abc\")", false, null],

                ["is_float(1)", false, null],
                ["is_float(1.0)", true, null],
                ["is_float(3.14)", true, null],
                ["is_float(True)", false, null],
                ["is_float(None)", false, null],
                ["is_float(lambda x: x)", false, null],
                ["is_float(print)", false, null],
                ["is_float(1+0j)", false, null],
                ["is_float(\"abc\")", false, null],

                ["is_boolean(1)", false, null],
                ["is_boolean(1.0)", false, null],
                ["is_boolean(3.14)", false, null],
                ["is_boolean(True)", true, null],
                ["is_boolean(False)", true, null],
                ["is_boolean(None)", false, null],
                ["is_boolean(print)", false, null],
                ["is_boolean(lambda x: x)", false, null],
                ["is_boolean(1+0j)", false, null],
                ["is_boolean(\"abc\")", false, null],

                ["is_none(1)", false, null],
                ["is_none(1.0)", false, null],
                ["is_none(3.14)", false, null],
                ["is_none(True)", false, null],
                ["is_none(None)", true, null],
                ["is_none(print)", false, null],
                ["is_none(lambda x: x)", false, null],
                ["is_none(1+0j)", false, null],
                ["is_none(\"abc\")", false, null],

                ["is_function(1)", false, null],
                ["is_function(1.0)", false, null],
                ["is_function(3.14)", false, null],
                ["is_function(True)", false, null],
                ["is_function(None)", false, null],
                ["is_function(lambda x: x)", true, null],
                ["is_function(print)", true, null],
                ["is_function(is_function)", true, null],
                ["is_function(1+0j)", false, null],
                ["is_function(\"abc\")", false, null],

                ["is_string(1)", false, null],
                ["is_string(1.0)", false, null],
                ["is_string(3.14)", false, null],
                ["is_string(True)", false, null],
                ["is_string(None)", false, null],
                ["is_string(lambda x: x)", false, null],
                ["is_string(print)", false, null],
                ["is_string(\"\")", true, null],
                ["is_string(\"abc\")", true, null],
            ],

        }

        generateTestCases(mathTests, 1, []);
        generateTestCases(miscTests, 1, []);

    });


}); 