import { Value } from "../cse-machine/stash";
import { runCSEMachine } from "./utils";
import { toPythonString } from "../stdlib";

// add
test('Operation: python adding 2 int (ts adding 2 bigint)', () => {
    const code = `
a = 200
b = 300
x = a + b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('500');
});

test('Operation: python adding 2 infinite int (ts adding 2 infinite bigint)', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 66666666666666666666666666666666666666666666666666
x = a + b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('99999999999999999999999999999999999999999999999999');
});

test('Operation: python adding 2 minus infinite int (ts adding 2 minus infinite bigint)', () => {
    const code = `
a = -33333333333333333333333333333333333333333333333333
b = -66666666666666666666666666666666666666666666666666
x = a + b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('-99999999999999999999999999999999999999999999999999');
});

test('Operation: python adding 2 float (ts adding 2 number)', () => {
    const code = `
a = 123.456
b = 100.0001
x = a + b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('223.4561');
});

test('Operation: python adding near infinite float (ts adding near infinite number)', () => {
    const code = `
a = 1.7976931348623157e308
b = 1e292
x = a + b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('inf');
});

test('Operation: python adding infinite float (ts adding infinite number)', () => {
    const code = `
a = 1e309
b = 100.001
x = a + b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('inf');
});

test('Operation: python adding near minus infinite float (ts adding minus infinite number)', () => {
    const code = `
a = -1.7976931348623157e308
b = -1e292
x = a + b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('-inf');
});

test('Operation: python adding minus infinite float (ts adding minus infinite number)', () => {
    const code = `
a = -1e309
b = -1.0
x = a + b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('-inf');
});

test('Operation: python adding near zero float (ts adding near zero number)', () => {
    const code = `
a = 1e-323
b = -1e-323
x = a + b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('0.0');
});

test('Operation: python add complex', () => {
    const code = `
a = 9 + 13J
b = 5.234e10 + 3e-7J
x = a + b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(52340000009+13.0000003j)');
});

// py convers all type to float then calculate
test('Operation: python adding int and float (ts adding bigint and number)', () => {
    const code = `
a = 10000000
b = 123.45678
x = a + b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('10000123.45678');
});

test('Operation: python adding infinite int and float (ts adding bigint and number)', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 0.3
x = a + b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('3.333333333333333e+49');
});

test('Operation: python adding int and infinite float (ts adding bigint and number)', () => {
    const code = `
a = 1e309
b = 100
x = a + b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('inf');
});

test('Operation: python adding int and complex', () => {
    const code = `
a = 3333333
b = 46572.01 + 7.0J
x = a + b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(3379905.01+7j)');
});

test('Operation: python adding infinite int and complex', () => {
    const code = `
a = 333333333333333333333333333333333333333333
b = 46572.01 + 7.0J
x = a + b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(3.3333333333333332e+41+7j)');
});

test('Operation: python adding float and complex', () => {
    const code = `
a = 5.0
b = 46572.01 + 7.0J
x = a + b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(46577.01+7j)');
});

// minus
test('Operation: python minus 2 int (ts minus 2 bigint)', () => {
    const code = `
a = 200
b = 300
x = a - b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('-100');
});

test('Operation: python minus 2 infinite int (ts minus 2 infinite bigint)', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 66666666666666666666666666666666666666666666666666
x = a - b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('-33333333333333333333333333333333333333333333333333');
});

test('Operation: python minus 2 minus infinite int (ts minus 2 minus infinite bigint)', () => {
    const code = `
a = -33333333333333333333333333333333333333333333333333
b = -66666666666666666666666666666666666666666666666666
x = a - b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('33333333333333333333333333333333333333333333333333');
});

test('Operation: python minus 2 float (ts minus 2 number)', () => {
    const code = `
a = 123.456
b = 100.0001
x = a - b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('23.4559');
});

test('Operation: python minus near infinite float (ts minus near infinite number)', () => {
    const code = `
a = 1.7976931348623157e308
b = -1e292
x = a - b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('inf');
});

test('Operation: python minus infinite float (ts minus infinite number)', () => {
    const code = `
a = 1e309
b = -100.001
x = a - b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('inf');
});

test('Operation: python minus near minus infinite float (ts minus minus infinite number)', () => {
    const code = `
a = -1.7976931348623157e308
b = 1e292
x = a - b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('-inf');
});

test('Operation: python minus infinite float (ts minus minus infinite number)', () => {
    const code = `
a = -1e309
b = 1.0
x = a - b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('-inf');
});

test('Operation: python minus near zero float (ts minus near zero number)', () => {
    const code = `
a = 1e-323
b = 1e-323
x = a - b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('0.0');
});

test('Operation: python minus complex', () => {
    const code = `
a = 9 + 13J
b = 5.234e10 + 3e-7J
x = a - b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(-52339999991+12.9999997j)');
});

// py convers all type to float then calculate
test('Operation: python minus int and float (ts minus bigint and number)', () => {
    const code = `
a = 10000000
b = 123.45678
x = a - b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('9999876.54322');
});

test('Operation: python minus infinite int and float (ts minus bigint and number)', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 0.3
x = a - b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('3.333333333333333e+49');
});

test('Operation: python minus int and infinite float (ts minus bigint and number)', () => {
    const code = `
a = 1e309
b = -100
x = a - b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('inf');
});

test('Operation: python minus int and complex', () => {
    const code = `
a = 3333333
b = 46572.01 + 7.0J
x = a - b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(3286760.99-7j)');
});

test('Operation: python minus infinite int and complex', () => {
    const code = `
a = 333333333333333333333333333333333333333333
b = 46572.01 + 7.0J
x = a - b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(3.3333333333333332e+41-7j)');
});

test('Operation: python minus float and complex', () => {
    const code = `
a = 5.0
b = 46572.01 + 7.0J
x = a - b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(-46567.01-7j)');
});

// multiply
test('Operation: python multiply 2 int (ts multiply 2 bigint)', () => {
    const code = `
a = 200
b = 300
x = a * b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('60000');
});

test('Operation: python multiply 2 infinite int (ts multiply 2 infinite bigint)', () => {
    const code = `
a = 33333333333333333333
b = 66666666666666666666
x = a * b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('2222222222222222222177777777777777777778');
});

test('Operation: python multiply 2 minus infinite int (ts multiply 2 minus infinite bigint)', () => {
    const code = `
a = -33333333333333333333
b = -66666666666666666666
x = a * b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('2222222222222222222177777777777777777778');
});

test('Operation: python multiply 2 float (ts multiply 2 number)', () => {
    const code = `
a = 123.456
b = 100.0001
x = a * b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('12345.6123456');
});

test('Operation: python multiply near infinite float (ts multiply near infinite number)', () => {
    const code = `
a = 1.7976931348623157e308
b = 1.2
x = a * b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('inf');
});

test('Operation: python multiply infinite float (ts multiply infinite number)', () => {
    const code = `
a = 1e309
b = -100
x = a * b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('-inf');
});

test('Operation: python multiply near minus infinite float (ts multiply near minus infinite number)', () => {
    const code = `
a = -1.7976931348623157e308
b = 1.001
x = a * b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('-inf');
});

test('Operation: python multiply infinite float (ts multiply minus infinite number)', () => {
    const code = `
a = -1e309
b = -1
x = a * b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('inf');
});

test('Operation: python mulpitly near zero float (ts multiply near zero number)', () => {
    const code = `
a = 1e-323
b = 0.1
x = a * b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('0.0');
});

test('Operation: python mulpitly complex', () => {
    const code = `
a = 1.413567e7 + 9e-3j
b = 3.00 + 7J
x = a * b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(42407009.937+98949690.027j)');
});

// py convers all type to float then calculate
test('Operation: python multiply int and float (ts multiply bigint and number)', () => {
    const code = `
a = 10000000
b = 123.45678
x = a * b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('1234567800.0');
});

test('Operation: python multiply infinite int and float (ts multiply bigint and number)', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 0.3
x = a * b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('1e+49');
});

test('Operation: python multiply int and infinite float (ts multiply bigint and number)', () => {
    const code = `
a = 1e309
b = 1
x = a * b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('inf');
});

test('Operation: python multiply int and complex', () => {
    const code = `
a = 3333333
b = 46572.01 + 7.0J
x = a * b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(155240017809.33002+23333331j)');
});

test('Operation: python multiply infinite int and complex', () => {
    const code = `
a = 333333333333333333333333333333333333333333
b = 46572.01 + 7.0J
x = a * b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(1.5524003333333333e+46+2.3333333333333332e+42j)');
});

test('Operation: python multiply float and complex', () => {
    const code = `
a = 5.0
b = 46572.01 + 7.0J
x = a * b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(232860.05000000002+35j)');
});

//divide
test('Operation: python divide 2 int (ts divide 2 bigint)', () => {
    const code = `
a = 200
b = 300
x = a / b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('0.6666666666666666');
});

test('Operation: python divide 2 infinite int (ts divide 2 infinite bigint)', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 3
x = a / b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('1.1111111111111111e+49');
});

test('Operation: python divide 2 minus infinite int (ts divide 2 minus infinite bigint)', () => {
    const code = `
a = -3333333333333333333333333333333333333333
b = -6666666666666666666666666666666666666666
x = a / b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('0.5');
});

test('Operation: python divide 2 float (ts divide 2 number)', () => {
    const code = `
a = 123.456
b = 100.0001
x = a / b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('1.2345587654412344');
});

test('Operation: python divide near infinite float (ts divide near infinite number)', () => {
    const code = `
a = 1.7976931348623157e308
b = 0.99
x = a / b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('inf');
});

test('Operation: python divide infinite float (ts divide infinite number)', () => {
    const code = `
a = 1e309
b = -1
x = a / b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('-inf');
});

test('Operation: python divide near minus infinite float (ts divide near minus infinite number)', () => {
    const code = `
a = -1.7976931348623157e308
b = 0.99
x = a / b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('-inf');
});

test('Operation: python divide infinite float (ts divide minus infinite number)', () => {
    const code = `
a = -1e309
b = -1
x = a / b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('inf');
});

test('Operation: python divide near zero float (ts divide near zero number)', () => {
    const code = `
a = 1e-323
b = 10.0
x = a / b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('0.0');
});

test('Operation: python divide complex', () => {
    const code = `
a = 1.345654234 + 7.7J
b = 1e7 + 5e4j
x = a / b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(1.3841196310092247e-07+7.693079401844954e-07j)');
});

// py convers all type to float then calculate
test('Operation: python divide int and float (ts divide bigint and number)', () => {
    const code = `
a = 10000000
b = 123.45678
x = a / b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('81000.00664200055');
});

test('Operation: python divide infinite int and float (ts divide bigint and number)', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 99999
x = a / b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('3.3333666670000034e+44');
});

test('Operation: python divide int and infinite float (ts divide bigint and number)', () => {
    const code = `
a = 1e309
b = 1
x = a / b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('inf');
});

test('Operation: python multiply int and complex', () => {
    const code = `
a = 3333333
b = 46572.01 + 7.0J
x = a / b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(71.57373977835243-0.010757881793129974j)');
});

test('Operation: python divide infinite int and complex', () => {
    const code = `
a = 46572.01 + 7.0J
b = 333333333333333333333333333333333333333333
x = a / b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(1.3971603e-37+2.1e-41j)');
});

test('Operation: python divide float and complex', () => {
    const code = `
a = 5.0
b = 46572.01 + 7.0J
x = a / b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(0.00010736062040359069-1.6136824303377388e-08j)');
});

// mod
test('Operation: python mod 2 int (ts mod 2 bigint)', () => {
    const code = `
a = 200
b = 66
x = a % b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('2');
});

test('Operation: python mod 2 infinite int (ts mod 2 infinite bigint)', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 2
x = a % b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('1');
});

test('Operation: python mod 2 minus infinite int (ts mod 2 minus infinite bigint)', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = -2
x = a % b
x
`;

    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('-1');
});

test('Operation: python mod 2 float (ts mod 2 number)', () => {
    const code = `
a = 123.456
b = 33.33
x = a % b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('23.466000000000008');
});

test('Operation: python mod near infinite float (ts mod near infinite number)', () => {
    const code = `
a = 1.7976931348623157e308
b = 1.5
x = a % b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('0.5');
});

test('Operation: python mod near minus infinite float (ts mod near minus infinite number)', () => {
    const code = `
a = -1.7976931348623157e308
b = 0.1
x = a % b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('0.04999999999999996');
});

test('Operation: python mod near zero float (ts mod near zero number)', () => {
    const code = `
a = 1e-323
b = 10.0
x = a % b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('1e-323');
});

// py convers all type to float then calculate
test('Operation: python mod int and float (ts mod bigint and number)', () => {
    const code = `
a = 10000000
b = 123.45678
x = a % b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('0.8200000004165986');
});

test('Operation: python mod infinite int and float (ts mod bigint and number)', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 2.0
x = a % b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('0.0');
});

// power
test('Operation: python power 2 int (ts power 2 bigint)', () => {
    const code = `
a = 12
b = 5
x = a ** b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('248832');
});

test('Operation: python power 2 infinite int (ts power 2 infinite bigint)', () => {
    const code = `
a = 3333333333
b = 11
x = a ** b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('564502926326723004369252654481870988519703974662500635066053616487982861691138799979677863582222674445517');
});

test('Operation: python power 2 int (exponent minus than 0)', () => {
    const code = `
a = 3
b = -11
x = a ** b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('5.645029269476762e-06');
});

test('Operation: python power 2 minus infinite int (ts power 2 minus infinite bigint)', () => {
    const code = `
a = -33333333333333333333333333333333333333333333333333
b = 2
x = a ** b
x
`;

    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('1111111111111111111111111111111111111111111111111088888888888888888888888888888888888888888888888889');
});

test('Operation: python power 2 float (ts power 2 number)', () => {
    const code = `
a = 123.456
b = 33.33
x = a ** b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('5.129814729698658e+69');
});

test('Operation: python power near infinite float (ts power near infinite number)', () => {
    const code = `
a = 1.7976931348623157e308
b = 1.0
x = a ** b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('1.7976931348623157e+308');
});

test('Operation: python power near minus infinite float (ts power near minus infinite number)', () => {
    const code = `
a = 1.7976931348623157e308
b = -2
x = a ** b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('0.0');
});

test('Operation: python power near zero float (ts power near zero number)', () => {
    const code = `
a = 1e-323
b = 10.0
x = a ** b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('0.0');
});

// py convers all type to float then calculate
test('Operation: python power int and float (ts power bigint and number)', () => {
    const code = `
a = 10000000
b = 1.45678
x = a ** b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('15756508932.502234');
});

test('Operation: python power infinite int and float (ts power bigint and number)', () => {
    const code = `
a = 33333333333333333333333333333333333333333333333333
b = 2.0
x = a ** b
x
`;
  
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('1.111111111111111e+99');
});

test('Operation: complex base ^ float exponent', () => {
    const code = `
a = 3.0 + 0j
b = 2.0
x = a ** b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(-7+24j)');
});
  
test('Operation: real float base ^ complex exponent', () => {
    const code = `
a = 2.3269000001
b = 9.354649e-3 + 1.36574432j
x = a ** b
x
  `;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(0.4085772300464849+0.9214069843584557j)');
});
  
test('Operation: complex ^ complex', () => {
    const code = `
a = 1.253e7 + 2.3483725e-17j
b = 3.332134 - 4347657487892.2j
x = a ** b
x
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('(2.2284387180224344e+22-4.474930181022476e+23j)');
});
  
// string concatenation
test('Operation: string concatenation', () => {
    const code = `
a = 'source'
b = 'academy'
x = a + b
x
`;
    const result = runCSEMachine(code);
    expect((result as Value).value).toBe('sourceacademy');
});

test('Operation: string concatenation', () => {
    const code = `
a = 'source'
b = ''
x = a + b
x
`;
    const result = runCSEMachine(code);
    expect((result as Value).value).toBe('source');
});

test('Operation: string concatenation', () => {
    const code = `
a = ''
b = ''
x = a + b
x
`;
    const result = runCSEMachine(code);
    expect((result as Value).value).toBe('');
});

// Priority
test('Operation: python precedence (+ vs *)', () => {
    const code = `
a = 2 + 3 * 4
a
`;
    // 3 * 4 = 12, then 2 + 12 => 14
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('14');
});

test('Operation: python precedence ((+)+*)', () => {
    const code = `
a = (2 + 3) * 4
a
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('20');
});

test('Operation: python precedence (** vs *)', () => {
    const code = `
a = 3 ** 2 * 2
a
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('18');
});

test('Operation: python precedence (**) with parentheses', () => {
    const code = `
a = 3 ** (2 * 2)
a
`;
    // (2*2)=4, 3^4=81
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('81');
});

test('Operation: python precedence (- vs /)', () => {
    const code = `
a = 10 - 4 / 2
a
`;
    // 4/2=2, then 10-2=8
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('8.0');
});

test('Operation: python precedence parentheses (- vs /)', () => {
    const code = `
a = (10 - 4) / 2
a
`;
    // (10-4)=6, then 6/2=3
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('3.0');
});

test('Operation: python precedence (% vs *)', () => {
    const code = `
a = 10 % 3 * 4
a
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('4');
});

test('Operation: python precedence (% with parentheses)', () => {
    const code = `
a = 10 % (3 * 4)
a
`;
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('10');
});

test('Operation: python precedence (+ vs **)', () => {
    const code = `
a = 2 + 3 ** 2
a
`;
    // 3**2=9, then 2+9=11
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('11');
});

test('Operation: python precedence ((+) vs **)', () => {
    const code = `
a = (2 + 3) ** 2
a
`;
    // (2+3)=5, then 5^2=25
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('25');
});

test('Operation: python precedence chaining ** (right-associativity)', () => {
    const code = `
a = 2 ** 3 ** 2
a
`;
    // 3**2=9, then 2**9=512
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('512');
});

test('Operation: python precedence (**) left vs right', () => {
    const code = `
a = (2 ** 3) ** 2
a
`;
    // (2**3)=8, then 8**2=64
    const result = runCSEMachine(code);
    expect(toPythonString(result as Value)).toBe('64');
});
