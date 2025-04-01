import { Value } from "../cse-machine/stash";
import {runCSEMachine} from "./utils";
import { toPythonString } from "../stdlib";

test('Operation: python comparing 2 int', () => {
    const code = `
a = 200
b = 300
x = a > b
x
`;
    
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 int (negative, positive)', () => {
    const code = `
a = -100
b = 0
x = a > b
x
`;
    
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 big int', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 66666666666666666666666666666666666666666666666666
x = a > b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 minus big int', () => {
    const code = `
a = -33333333333333333333333333333333333333333333333333
b = -66666666666666666666666666666666666666666666666666
x = a > b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 float', () => {
    const code = `
a = 123.456
b = 100.0001
x = a > b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing near infinite float', () => {
    const code = `
a = 1.7976931348623157e308
b = 1.7976931348623156e308
x = a > b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing infinite float with finite float', () => {
    const code = `
a = 1e309   # => inf in Python
b = 1e292
x = a > b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing infinite float with infinite float', () => {
    const code = `
a = 1e310   # => inf
b = 1e309   # => inf
x = a > b
x
`;
    
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing negative infinite float with finite float', () => {
    const code = `
a = -1e309  # => -inf
b = -1e292
x = a > b
x
`;
    
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing near zero float', () => {
    const code = `
a = 1e-323
b = 0
x = a > b
x
`;
    
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing int and float', () => {
    const code = `
a = 100
b = 123.456
x = a > b
x
`;
    
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing big int and float', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 3.3333333333333333333333333e49
x = a > b
x
`;
    
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing big int and infinite float', () => {
    const code = `
a = 10 ** 10000
b = 1e309  # => inf
x = a > b
x
`;

    // in real world 1e10000 > 1e309
    // but in python 1e10000 < 1e309 = Infinity
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 string (simple)', () => {
    const code = `
a = "abc"
b = "abd"
x = a > b
x
`;
    
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 string (case sensitive)', () => {
    const code = `
a = "abc"
b = "ABC"
x = a > b
x
`;

    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 string (length difference)', () => {
    const code = `
a = "abc"
b = "ab"
x = a > b
x
`;

    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 string (empty string)', () => {
    const code = `
a = ""
b = "abcdef"
x = a > b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

// >=
test('Operation: python comparing 2 int (simple greater)', () => {
    const code = `
a = 300
b = 200
x = a >= b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 int (equal)', () => {
    const code = `
a = 200
b = 200
x = a >= b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 int (negative)', () => {
    const code = `
a = -100
b = 0
x = a >= b
x
`;
    // -100 >= 0 => False
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 big int (greater)', () => {
    const code = `
a = 66666666666666666666666666666666666666666666666666
b = 33333333333333333333333333333333333333333333333333
x = a >= b
x
`;
    // a > b => True
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 big int (equal)', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 33333333333333333333333333333333333333333333333333
x = a >= b
x
`;
    // a == b => True
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 minus big int', () => {
    const code = `
a = -33333333333333333333333333333333333333333333333333
b = -66666666666666666666666666666666666666666666666666
x = a >= b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 float (greater)', () => {
    const code = `
a = 123.456
b = 100.0001
x = a >= b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 float (equal)', () => {
    const code = `
a = 123.456
b = 123.456
x = a >= b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing near infinite float', () => {
    const code = `
a = 1.7976931348623157e308
b = 1.7976931348623156e308
x = a >= b
x
`;
    // a > b => True
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing infinite float with finite float', () => {
    const code = `
a = 1e309   # => inf in Python
b = 1e292
x = a >= b
x
`;
    // inf >= finite => True
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing infinite float with infinite float (equal)', () => {
    const code = `
a = 1e310   # => inf
b = 1e311   # => inf
x = a >= b
x
`;
    // inf >= inf => True (they are equal infinities)
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing negative infinite float with finite float', () => {
    const code = `
a = -1e309  # => -inf
b = -1e292
x = a >= b
x
`;
    // -inf >= negative finite => False
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing int and float (greater)', () => {
    const code = `
a = 200
b = 123.456
x = a >= b
x
`;
    // 200 >= 123.456 => True
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing int and float (equal)', () => {
    const code = `
a = 100
b = 100.0
x = a >= b
x
`;
    // 100 >= 100.0 => True
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing int and float (less)', () => {
    const code = `
a = 100
b = 123.456
x = a >= b
x
`;
    // 100 >= 123.456 => False
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing big int and float (greater)', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 3.3333333333333333333333333e49
x = a >= b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing big int and float (greater)', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 3.3333333333333333333333333e49
x = b >= a
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing big int and float (equal)', () => {
    const code = `
a = 9007199254740992
b = 9007199254740992.0
x = a >= b
x
`;
    // Python sees them as equal => True
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing big int and infinite float', () => {
    const code = `
a = 10 ** 10000
b = 1e309  # => inf
x = a >= b
x
`;
    // Real world: 10^10000 >> 10^309
    // But in Python, 1e309 => inf => any finite number < inf => => a < inf => => False for >=
    // => a >= inf => False
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 string (simple greater)', () => {
    const code = `
a = "abd"
b = "abc"
x = a >= b
x
`;
    // "abd" >= "abc" => True
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 string (equal)', () => {
    const code = `
a = "hello"
b = "hello"
x = a >= b
x
`;
    // "hello" == "hello" => True
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 string (case sensitive)', () => {
    const code = `
a = "abc"
b = "ABC"
x = a >= b
x
`;
    // 'a'(97) > 'A'(65) => "abc" > "ABC" => so >= => True
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 string (length difference)', () => {
    const code = `
a = "ab"
b = "abc"
x = a >= b
x
`;
    // "ab" < "abc" => so a>=b => False
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 string (empty string)', () => {
    const code = `
a = "ab"
b = ""
x = a >= b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

// <
test('Operation: python comparing 2 int', () => {
    const code = `
a = 200
b = 300
x = a < b
x
`;
    
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 int (negative, positive)', () => {
    const code = `
a = -100
b = 0
x = a < b
x
`;
    
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 big int', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 66666666666666666666666666666666666666666666666666
x = a < b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 minus big int', () => {
    const code = `
a = -33333333333333333333333333333333333333333333333333
b = -66666666666666666666666666666666666666666666666666
x = b < a
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 float', () => {
    const code = `
a = 123.456
b = 100.0001
x = a < b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing near infinite float', () => {
    const code = `
a = 1.7976931348623156e308
b = 1.7976931348623157e308
x = a < b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing infinite float with finite float', () => {
    const code = `
a = 1e309   # => inf in Python
b = 1e292
x = a < b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing infinite float with infinite float', () => {
    const code = `
a = 1e310   # => inf
b = 1e309   # => inf
x = a < b
x
`;
    
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing negative infinite float with finite float', () => {
    const code = `
a = -1e309  # => -inf
b = -1e292
x = a < b
x
`;
    
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing near zero float', () => {
    const code = `
a = 1e-323
b = 0
x = a < b
x
`;
    
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing int and float', () => {
    const code = `
a = 100
b = 123.456
x = a < b
x
`;
    
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing big int and float', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 3.3333333333333333333333333e49
x = a < b
x
`;
    
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing big int and infinite float', () => {
    const code = `
a = 10 ** 10000
b = 1e309  # => inf
x = a < b
x
`;

    // in real world 1e10000 > 1e309
    // but in python 1e10000 < 1e309 = Infinity
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 string (simple)', () => {
    const code = `
a = "abc"
b = "abd"
x = a < b
x
`;
    
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 string (case sensitive)', () => {
    const code = `
a = "abc"
b = "ABC"
x = a < b
x
`;

    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 string (length difference)', () => {
    const code = `
a = "abc"
b = "ab"
x = a < b
x
`;

    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 string (empty string)', () => {
    const code = `
a = ""
b = "abcdef"
x = a < b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

// >=
test('Operation: python comparing 2 int (simple greater)', () => {
    const code = `
a = 300
b = 200
x = a <= b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 int (equal)', () => {
    const code = `
a = 200
b = 200
x = a <= b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 int (negative)', () => {
    const code = `
a = -100
b = 0
x = a <= b
x
`;
    // -100 >= 0 => False
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 big int (greater)', () => {
    const code = `
a = 66666666666666666666666666666666666666666666666666
b = 33333333333333333333333333333333333333333333333333
x = a <= b
x
`;
    // a > b => True
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 big int (equal)', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 33333333333333333333333333333333333333333333333333
x = a <= b
x
`;
    // a == b => True
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 minus big int', () => {
    const code = `
a = -33333333333333333333333333333333333333333333333333
b = -66666666666666666666666666666666666666666666666666
x = a <= b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 float (greater)', () => {
    const code = `
a = 123.456
b = 100.0001
x = a <= b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 float (equal)', () => {
    const code = `
a = 123.456
b = 123.456
x = a <= b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing near infinite float', () => {
    const code = `
a = 1.7976931348623157e308
b = 1.7976931348623156e308
x = a <= b
x
`;
    // a > b => True
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing infinite float with finite float', () => {
    const code = `
a = 1e309   # => inf in Python
b = 1e292
x = a <= b
x
`;
    // inf >= finite => True
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing infinite float with infinite float (equal)', () => {
    const code = `
a = 1e310   # => inf
b = 1e311   # => inf
x = a <= b
x
`;
    // inf >= inf => True (they are equal infinities)
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing negative infinite float with finite float', () => {
    const code = `
a = -1e309  # => -inf
b = -1e292
x = a <= b
x
`;
    // -inf >= negative finite => False
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing int and float (greater)', () => {
    const code = `
a = 200
b = 123.456
x = a <= b
x
`;
    // 200 >= 123.456 => True
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing int and float (equal)', () => {
    const code = `
a = 100
b = 100.0
x = a <= b
x
`;
    // 100 >= 100.0 => True
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing int and float (less)', () => {
    const code = `
a = 100
b = 123.456
x = a <= b
x
`;
    // 100 >= 123.456 => False
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing big int and float (greater)', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 3.3333333333333333333333333e49
x = a <= b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing big int and float (greater)', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 3.3333333333333333333333333e49
x = b <= a
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing big int and float (equal)', () => {
    const code = `
# pick a big int that can be exactly represented as float
# e.g. 2^53 = 9007199254740992 => float(2^53) is still integer in python, but 2^53+1 won't be
a = 9007199254740992
b = 9007199254740992.0
x = a <= b
x
`;
    // Python sees them as equal => True
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing big int and infinite float', () => {
    const code = `
a = 10 ** 10000
b = 1e309  # => inf
x = a <= b
x
`;
    // Real world: 10^10000 >> 10^309
    // But in Python, 1e309 => inf => any finite number < inf => => a < inf => => False for >=
    // => a >= inf => False
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 string (simple greater)', () => {
    const code = `
a = "abd"
b = "abc"
x = a <= b
x
`;
    // "abd" >= "abc" => True
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 string (equal)', () => {
    const code = `
a = "hello"
b = "hello"
x = a <= b
x
`;
    // "hello" == "hello" => True
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 string (case sensitive)', () => {
    const code = `
a = "abc"
b = "ABC"
x = a <= b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 string (length difference)', () => {
    const code = `
a = "ab"
b = "abc"
x = a <= b
x
`;
    // "ab" < "abc" => so a>=b => False
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 string (empty string)', () => {
    const code = `
a = "ab"
b = ""
x = a <= b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

// equal
test('Operation: python comparing 2 int (equal)', () => {
    const code = `
a = 200
b = 200
x = a == b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});
  
test('Operation: python comparing 2 int (not equal)', () => {
    const code = `
a = 200
b = 300
x = a == b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});
  
test('Operation: python comparing negative int and positive int', () => {
const code = `
a = -100
b = 0
x = a == b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});
  
test('Operation: python comparing 2 big int (equal)', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 33333333333333333333333333333333333333333333333333
x = a == b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});
  
test('Operation: python comparing 2 big int (not equal)', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 66666666666666666666666666666666666666666666666666
x = a == b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});
  
test('Operation: python comparing 2 minus big int (not equal)', () => {
    const code = `
a = -33333333333333333333333333333333333333333333333333
b = -66666666666666666666666666666666666666666666666666
x = a == b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});
  
test('Operation: python comparing 2 float (equal)', () => {
    const code = `
a = 123.456
b = 123.456
x = a == b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});
  
test('Operation: python comparing 2 float (not equal)', () => {
    const code = `
a = 123.456
b = 100.0001
x = a == b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});
  
test('Operation: python comparing infinite float with infinite float (both +inf)', () => {
    const code = `
a = 1e309   # => inf
b = 1e310   # => inf
x = a == b
x
`;
    // inf == inf => True
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});
  
test('Operation: python comparing -inf with +inf', () => {
    const code = `
a = -1e309  # => -inf
b = 1e309   # => inf
x = a == b
x
`;
    // -inf != inf => False
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});
  
test('Operation: python comparing int and float (equal)', () => {
    const code = `
a = 100
b = 100.0
x = a == b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});
  
test('Operation: python comparing int and float (not equal)', () => {
    const code = `
a = 100
b = 123.456
x = a == b
x
`;
    // 100 != 123.456 => False
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing big int and float (not equal)', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 3.333333333333333e+49
x = a == b
x
`;
    // 100 != 123.456 => False
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing big int and float (equal)', () => {
    const code = `
a = 9007199254740992
b = 9007199254740992.0
x = a == b
x
`;
    // Python sees them as the same numeric value => True
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing big int and float (not equal)', () => {
    const code = `
a = 9007199254740992
b = 9007199254740992.01
x = a == b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});
  
test('Operation: python comparing big int and float (not equal)', () => {
    const code = `
a = 10**5
b = 1.00001e5
x = a == b
x
`;
    // 10^5 = 100000, 1.00001e5 = 100001 => Not equal => False
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});
  
test('Operation: python comparing big int and infinite float', () => {
    const code = `
a = 10 ** 10000
b = 1e10000  # => inf
x = a == b
x
`;
    // a is a huge but finite integer, b is Infinity => Not equal => False
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

// string
test('Operation: python comparing 2 string (equal)', () => {
    const code = `
a = "hello"
b = "hello"
x = a == b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});
  
test('Operation: python comparing 2 string (case sensitive)', () => {
    const code = `
a = "abc"
b = "ABC"
x = a == b
x
`;
    // 'abc' != 'ABC' => False
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});
  
test('Operation: python comparing 2 string (length difference)', () => {
    const code = `
a = "abc"
b = "ab"
x = a == b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});
  
test('Operation: python comparing 2 empty string', () => {
    const code = `
a = ""
b = ""
x = a == b
x
`;
    // "" == "" => True
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});
  
// complex
test('Operation: python comparing 2 complex', () => {
    const code = `
a = 3 + 4j
b = 3.0 + 4.00J
x = a == b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 complex (imag not equal)', () => {
    const code = `
a = 3 + 5.3467j
b = 3.0 + 4.00J
x = a == b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 complex (real not equal)', () => {
    const code = `
a = 6 + 4j
b = 3.0 + 4.00J
x = a == b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 complex (imag zero)', () => {
    const code = `
a = 3 + 0.0j
b = 3.0 + 0j
x = a == b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 complex (real zero)', () => {
    const code = `
a = 9j
b = 0 + 9.0j
x = a == b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 complex (zero)', () => {
    const code = `
a = 0.0j
b = 0j
x = a == b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 complex', () => {
    const code = `
a = 3333333333333333333333333333333333333333333333333 + 1j
b = 3.3333333333333334e48 + 1j
x = a == b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 complex (big int mismatch in imag)', () => {
    const code = `
c = 1 + 9007199254740992j
d = 1 + 9007199254740994j
x = c == d
x
`; 
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});


test('Operation: python comparing 2 complex', () => {
    const code = `
a = 1 + 9007199254740992j
b = 1.00 + 9007199254740992.1j
x = a == b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 complex', () => {
    const code = `
a = -1e324 + 1j
b = -1e345 + 1j
x = a == b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 complex (imag part mismatch)', () => {
    const code = `
a = 3.333333333333333e48 + 1j
b = 3.333333333333333e48 + 1.0000000000001j
x = a == b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

// not equal
test('Operation: python comparing 2 int (equal)', () => {
    const code = `
a = 200
b = 200
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});
  
test('Operation: python comparing 2 int (not equal)', () => {
    const code = `
a = 200
b = 300
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing negative int and positive int', () => {
const code = `
a = -100
b = 0
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});
  
test('Operation: python comparing 2 big int (equal)', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 33333333333333333333333333333333333333333333333333
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});
  
test('Operation: python comparing 2 big int (not equal)', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 66666666666666666666666666666666666666666666666666
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});
  
test('Operation: python comparing 2 minus big int (not equal)', () => {
    const code = `
a = -33333333333333333333333333333333333333333333333333
b = -66666666666666666666666666666666666666666666666666
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});
  
test('Operation: python comparing 2 float (equal)', () => {
    const code = `
a = 123.456
b = 123.456
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});
  
test('Operation: python comparing 2 float (not equal)', () => {
    const code = `
a = 123.456
b = 100.0001
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});
  
test('Operation: python comparing infinite float with infinite float (both +inf)', () => {
    const code = `
a = 1e309   # => inf
b = 1e310   # => inf
x = a != b
x
`;
    // inf == inf => True
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});
  
test('Operation: python comparing -inf with +inf', () => {
    const code = `
a = -1e309  # => -inf
b = 1e309   # => inf
x = a != b
x
`;
    // -inf != inf => False
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});
  
test('Operation: python comparing int and float (equal)', () => {
    const code = `
a = 100
b = 100.0
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});
  
test('Operation: python comparing int and float (not equal)', () => {
    const code = `
a = 100
b = 123.456
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing big int and float (not equal)', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 3.333333333333333e49
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing big int and float (equal)', () => {
    const code = `
a = 9007199254740992
b = 9007199254740992.0
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing big int and float (not equal)', () => {
    const code = `
a = 9007199254740992
b = 9007199254740992.1
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});
  
test('Operation: python comparing big int and float (not equal)', () => {
    const code = `
a = 10**5
b = 1.00001e5
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});
  
test('Operation: python comparing big int and infinite float', () => {
    const code = `
a = 10 ** 10000
b = 1e10000  # => inf
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

// string
test('Operation: python comparing 2 string (equal)', () => {
    const code = `
a = "hello"
b = "hello"
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});
  
test('Operation: python comparing 2 string (case sensitive)', () => {
    const code = `
a = "abc"
b = "ABC"
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});
  
test('Operation: python comparing 2 string (length difference)', () => {
    const code = `
a = "abc"
b = "ab"
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});
  
test('Operation: python comparing 2 empty string', () => {
    const code = `
a = ""
b = ""
x = a != b
x
`;
    // "" != "" => True
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});
  
// complex
test('Operation: python comparing 2 complex', () => {
    const code = `
a = 3 + 4j
b = 3.0 + 4.00J
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 complex (imag not equal)', () => {
    const code = `
a = 3 + 5.3467j
b = 3.0 + 4.00J
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 complex (real not equal)', () => {
    const code = `
a = 6 + 4j
b = 3.0 + 4.00J
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python comparing 2 complex (imag zero)', () => {
    const code = `
a = 3 + 0.0j
b = 3.0 + 0j
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 complex (real zero)', () => {
    const code = `
a = 9j
b = 0 + 9.0j
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 complex (zero)', () => {
    const code = `
a = 0.0j
b = 0j
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 complex', () => {
    const code = `
a = 3333333333333333333333333333333333333333333333333 + 1j
b = 3.3333333333333334e48 + 1j
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 complex (big int mismatch in imag)', () => {
    const code = `
c = 1 + 9007199254740992j
d = 1 + 9007199254740994j
x = c != d
x
`; 
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});


test('Operation: python comparing 2 complex', () => {
    const code = `
a = 1 + 9007199254740992j
b = 1.00 + 9007199254740992.1j
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 complex', () => {
    const code = `
a = -1e324 + 1j
b = -1e345 + 1j
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python comparing 2 complex (imag part mismatch)', () => {
    const code = `
a = 3.333333333333333e48 + 1j
b = 3.333333333333333e48 + 1.0000000000001j
x = a != b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

// and (bool)
test('Logical operation: python and', () => {
    const code = `
a = True
b = True
x = a and b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Logical operation: python and', () => {
    const code = `
a = True
b = False
x = a and b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Logical operation: python and', () => {
    const code = `
a = False
b = True
x = a and b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Logical operation: python and', () => {
    const code = `
a = False
b = False
x = a and b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

// or
test('Logical operation: python or', () => {
    const code = `
a = True
b = True
x = a or b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Logical operation: python or', () => {
    const code = `
a = True
b = False
x = a or b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Logical operation: python or', () => {
    const code = `
a = False
b = True
x = a or b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Logical operation: python or', () => {
    const code = `
a = False
b = False
x = a or b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

// not
test('Logical operation: python not with bool (True)', () => {
    const code = `
a = True
x = not a
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Logical operation: python not with bool (False)', () => {
    const code = `
a = False
x = not a
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python logical precedence #1 (True or not False and False)', () => {
    const code = `
a = True or not False and False
x = a
x
`;
    
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python logical precedence #2 (True and not True or False)', () => {
    const code = `
a = True and not True or False
x = a
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Operation: python logical precedence #3 (not True and True or True)', () => {
    const code = `
a = not True and True or True
x = a
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Operation: python logical precedence #4 (not (True and True) or False)', () => {
    const code = `
a = not (True and True) or False
x = a
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});
