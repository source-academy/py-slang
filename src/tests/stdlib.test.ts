import { TypeError } from "../errors";
import { ParserErrors } from "../parser/errors";
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
                ["1 == 1", true, null],
                ["1 == 2", false, null],
                ["3.14 == 3.14", true, null],
                ["1.0 == 1", true, null],
                ["1.0 == 2", false, null],
                ["True == True", true, null],
                ["None == None", true, null],
                ["[] == []", ParserErrors.GenericUnexpectedSyntaxError, null], // list literals are not supported
            ]
        }

        generateTestCases(mathTests, 1, []);
        generateTestCases(miscTests, 1, []);
        
    });

   
}); 