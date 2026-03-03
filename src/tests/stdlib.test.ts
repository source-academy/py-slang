import { Context } from "../cse-machine/context";
import { runInContext } from "../runner/pyRunner";

type Class<T> = new (...args: any[]) => T;
type MathTestType = {
    [name: string]: [string, bigint | number | Class<Error>][]
}
describe('Standard Library Tests', () => {
    describe('Chapter 1 Builtins', () => {
        const mathTests: MathTestType = {
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
            ]
        };
        for (const [funcName, tests] of Object.entries(mathTests)) {
            test.each(tests)(`${funcName}: %s should return %s`, (code, expected) => {
                const context = new Context();
                if (typeof expected === 'function' && (expected as Class<Error>).prototype instanceof Error) {
                    expect(() => runInContext(code, context)).rejects;
                } else {
                    return expect(runInContext(code, context)).resolves.toHaveProperty('value', {'type': typeof expected === 'bigint' ? 'bigint' : 'number', 'value': expected});
                }
            });
        }
        
    });

   
}); 