import { Value } from "../cse-machine/stash";
import { runCSEMachine } from "./utils";
import { toPythonString } from "../stdlib";

test('Variable definition: int (ts bigint)', () => {
    const code = `
x = 10000
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('10000');
});

test('Variable definition: int zero (ts bigint)', () => {
    const code = `
x = 0
x
`;

    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('0');
});

test('Variable definition: int minus zero (ts bigint)', () => {
    const code = `
x = -0
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('0');
});

test('Variable definition: infinite int (ts bigint)', () => {
    const code = `
x = 99999999999999999999999999999999999999999999999999
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('99999999999999999999999999999999999999999999999999');
});

test('Variable definition: infinite negative int (ts bigint)', () => {
    const code = `
x = -99999999999999999999999999999999999999999999999999
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('-99999999999999999999999999999999999999999999999999');
});

test('Variable definition: binary', () => {
    const code = `
x = 0b1011
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('11');
});

test('Variable definition: octal', () => {
    const code = `
x = 0o345
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('229');
});

test('Variable definition: hexadecimal', () => {
    const code = `
x = 0xFF
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('255');
});

test('Variable definition: simple float (ts number)', () => {
    const code = `
x = 123.456
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('123.456');
});

test('Variable definition: float zero (ts number)', () => {
    const code = `
x = 0.00
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('0.0');
});

test('Variable definition: float minus zero (ts number)', () => {
    const code = `
x = -0.00
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('-0.0');
});

test('Variable definition: scientific notation float (ts number)', () => {
    const code = `
x = 1.23456e3
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('1234.56');
});

test('Variable definition: near infinite float (ts number)', () => {
    const code = `
x = 1.7976931348623157e308
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('1.7976931348623157e+308');
});

test('Variable definition: near infinite negative float (ts number)', () => {
    const code = `
x = -1.7976931348623157e308
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('-1.7976931348623157e+308');
});

test('Variable definition: infinite float (ts number)', () => {
    const code = `
x = 1e309
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('inf');
});

test('Variable definition: minus infinite float (ts number)', () => {
    const code = `
x = -1e309
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('-inf');
});

test('Variable definition: near infinite small float (ts number)', () => {
    const code = `
x = 1e-323
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('1e-323');
});

test('Variable definition: near minus infinite small float (ts number)', () => {
    const code = `
x = -1e-323
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('-1e-323');
});

test('Variable definition: infinite small float (ts number)', () => {
    const code = `
x = 1e-324
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('0.0');
});

test('Variable definition: minus infinite small float (ts number)', () => {
    const code = `
x = -1e-324
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('-0.0');
});

test('Variable definition: single quotes', () => {
    const code = `
x = 'single_quoted_string'
x
    `;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('single_quoted_string');
});

test('Variable definition: double quotes', () => {
    const code = `
x = "double_quoted_string"
x
    `;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('double_quoted_string');
});

test('Variable definition: empty single quotes', () => {
    const code = `
x = ''
x
    `;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('');
});

test('Variable definition: empty double quotes', () => {
    const code = `
x = ""
x
    `;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('');
});

test('cnmVariable definition: string with common escape sequences', () => {
    const code = `
x = "Line1\\nLine2\\tTabbed"
x
    `;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("Line1\nLine2\tTabbed");
});

test('Variable definition: multiline triple quotes', () => {
    const code = `
x = """Hello
World"""
x
    `;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("Hello\nWorld");
});

test('Variable definition: triple-quoted string with multiple lines', () => {
    const code = `
x = """Line1
Line2
Line3"""
x
    `;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("Line1\nLine2\nLine3");
});

test('String with \n (newline)', () => {
    const code = `
x = "Line1\\nLine2"
x
    `;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("Line1\nLine2");
});

test('String with \t (horizontal tab)', () => {
    const code = `
x = "Tabbed\\tString"
x
    `;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("Tabbed\tString");
});

test('String with \r (carriage return)', () => {
    const code = `
x = "Carriage\\rReturn"
x
    `;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("Carriage\rReturn");
});

test('String with \b (backspace)', () => {
    const code = `
x = "Back\\bspace"
x
    `;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("Back\bspace");
});

test('String with \a (bell/alarm)', () => {
    const code = `
x = "Alert\\aSound"
x
    `;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("Alert\aSound");
});

test('String with \f (form feed)', () => {
    const code = `
x = "Form\\fFeed"
x
    `;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("Form\fFeed");
});

test('String with \v (vertical tab)', () => {
    const code = `
x = "Vertical\\vTab"
x
    `;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("Vertical\vTab");
});

test('String with \\ (backslash)', () => {
    const code = `
x = "Escape\\\\Backslash"
x
    `;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("Escape\\Backslash");
});

test('String with \' (escaped single quote)', () => {
    const code = `
x = 'It\\'s a single quote'
x
    `;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe("It\'s a single quote");
});

test('String with \" (escaped double quote)', () => {
    const code = `
x = "He said: \\"Hello\\""
x
    `;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('He said: \"Hello\"');
});

test('Nested string', () => {
    const code = `
x = 'He said: "Hello"'
x
    `;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('He said: \"Hello\"');
});

test('Nested 3 quote string', () => {
    const code = `
x = '''He said: "Hello" 
''hi'' '''
x
    `;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('He said: \"Hello\" \n\'\'hi\'\' ');
});

test('Variable definition: unicode charactors', () => {
    const code = `
x = '你好 こんにちは'
x
`;
  
    const result = runCSEMachine(code);
    expect((result as Value).value).toBe('你好 こんにちは');
});

test('Variable definition: bool true', () => {
    const code = `
x = True
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('True');
});

test('Variable definition: bool false', () => {
    const code = `
x = False
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('False');
});

test('Variable definition: python None', () => {
    const code = `
x = None
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('None');
});

// float representation
test('Float representation: non-scientific notation upper limit', () => {
    const code = `
x = 1e16
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('1e+16');
});

test('Float representation: near non-scientific notation upper limit 1', () => {
    const code = `
x = 1e16-1
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('1e+16');
});

test('Float representation: near non-scientific notation upper limit 2', () => {
    const code = `
x = 1e16-10
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('9999999999999990.0');
});

test('Float representation: non-scientific notation', () => {
    const code = `
x = 1.344326524463e7
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('13443265.24463');
});

test('Float representation: non-scientific notation lower limit', () => {
    const code = `
x = 9.9999e-5
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('9.9999e-05');
});

test('Float representation: near non-scientific notation lower limit', () => {
    const code = `
x = 1e-4
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('0.0001');
});

test('Float representation: non-scientific notation minus', () => {
    const code = `
x = -4.56731549e-3
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('-0.00456731549');
});

test('Float representation: scientific notation', () => {
    const code = `
x = 9357645728394584323840993590459437.0
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('9.357645728394584e+33');
});

test('Float representation: scientific notation larger than e-09', () => {
    const code = `
x = 0.000000006452754367285356
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('6.452754367285356e-09');
});

test('Float representation: scientific notation smaller than e-09', () => {
    const code = `
x = 0.00000000006452754367285356
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('6.452754367285356e-11');
});

// complex
test('Complex definition: 0j (pure imaginary zero)', () => {
    const code = `
x = 0.0j
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('0j');
});

test('Complex definition: pure imaginary', () => {
    const code = `
x = 3j
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('3j');
});
  
test('Complex definition: real + imaginary', () => {
    const code = `
x = 2 + 3j
x
`;

    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(2+3j)');
});
  
test('Complex definition: float real + float imaginary', () => {
    const code = `
x = 2.5 + 4.5j
x
`;

    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(2.5+4.5j)');
});

test('Complex definition: float real + float imaginary (representation)', () => {
    const code = `
x = 2.0 + 4.5j
x
`;

    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(2+4.5j)');
});

test('Complex definition: float real + float imaginary within non-scientific notation boundary', () => {
    const code = `
x = 1.346758e9 + 4.5999999999e-3j
x
`;

    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(1346758000+0.0045999999999j)');
});

test('Complex definition: float real + float imaginary near non-scientific notation boundary', () => {
    const code = `
x = 1e16-100 + 1e-4j
x
`;

    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(9999999999999900+0.0001j)');
});

test('Complex definition: float real + float imaginary of non-scientific notation boundary', () => {
    const code = `
x = 1e16 + 9.999e-5j
x
`;

    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(1e+16+9.999e-05j)');
});

test('Complex definition: float real + float imaginary within scientific notation boundary', () => {
    const code = `
x = 1.346758e123 - 4.5999999999e-8j
x
`;

    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(1.346758e+123-4.5999999999e-08j)');
});

test('Complex definition: infinity real + float imaginary', () => {
    const code = `
x = 1.346758e999 - 4.5999999999e-8j
x
`;

    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(inf-4.5999999999e-08j)');
});

test('Float definition', () => {
    const code = `
x = 1.
x
`;

    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('1.0');
});

test('Int definition with underscore', () => {
    const code = `
x = 1_000_000
x
`;

    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('1000000');
});

test('Float definition with underscores (simple)', () => {
    const code = `
x = 1_000.0
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('1000.0');
});

test('Float definition with underscores (fraction and exponent)', () => {
    const code = `
x = 1_2.4_67e-3_5
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('1.2467e-34');
});

test('Integer with underscores (bigint-like)', () => {
    const code = `
x = 123_456_789_012_345
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('123456789012345');
});

test('Float with underscores (positive exponent)', () => {
    const code = `
x = 9_87_654.321e+1_0  # should be x = 9_87_654.321e+1_0
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('9876543210000000.0');
});

test('Float with underscores (negative exponent)', () => {
    const code = `
x = 3.1_41_59_26e-0_5
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('3.1415926e-05');
});
