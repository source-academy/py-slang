import { TypeError } from "../errors";
import { ParserErrors } from "../parser/errors";
import { generateTestCases, TestCases } from "./utils";

describe('Standard Library Tests', () => {
    describe('Chapter 1 Builtins', () => {
        const mathTests: TestCases = {
            'abs': [
                ["abs(-5)", 5n],
                ["abs(5)", 5n],
                ["abs(-3.14)", 3.14],
                ["abs(3.14)", 3.14],
                ["abs(0)", 0n],
                ["abs(-2147483648)", 2147483648n],
                ["abs(2147483647)", 2147483647n],
                ["abs(\"\")", TypeError],
                ["abs(True)", TypeError],
            ],
            'round': [
                ["round(3.14)", 3n],
                ["round(3.5)", 4n],
                ["round(3.6)", 4n],
                ["round(2.5)", 2n],
                ["round(-2.5)", -2n],
                ["round(-3.5)", -4n],
                ["round(3.14159, 2)", 3.14],
                ["round(3.14159, 3)", 3.142],
                ["round(3.14159, 0)", 3.0],
                ["round(0, 2)", 0n],
                ["round(1, 2)", 1n],
                ["round(\"\")", TypeError],
                ["round(True)", TypeError],
                ["round(33.14, -1)", 30.0],
                ["round(33.14, 1.5)", TypeError],
            ],
            'math_sin': [
                ["math_sin(0)", 0.0],
                ["math_sin(3.141592653589793)", 1.2246467991473532e-16],
                ["math_sin(-3.4)", 0.2555411020268312],
                ["math_sin(0.0)", 0.0],
                ["math_sin(lambda x : x)", TypeError],
                ["math_sin(True)", TypeError],
                ["math_sin(\"\")", TypeError],
            ],
            'math_cos': [
                ["math_cos(0)", 1.0],
                ["math_cos(3.141592653589793)", -1.0],
                ["math_cos(-3.4)", -0.9667981925794611],
                ["math_cos(0.0)", 1.0],
                ["math_cos(lambda x : x)", TypeError],
                ["math_cos(True)", TypeError],
                ["math_cos(\"\")", TypeError],
            ]

        };
        const miscTests: TestCases = {
            'equality': [
                ["1 == 1", true],
                ["1 == 2", false],
                ["3.14 == 3.14", true],
                ["1.0 == 1", true],
                ["1.0 == 2", false],
                ["True == True", true],
                ["None == None", true],
                ["[] == []", ParserErrors.GenericUnexpectedSyntaxError], // list literals are not supported
            ]
        }

        generateTestCases(mathTests, 1, []);
        generateTestCases(miscTests, 1, []);
        
    });

   
}); 