import { parse } from './parser/parser-adapter';

const code = `if True:
    if True:
        x = 1
    else:
        x = 2
else:
    x = 3
`;

console.log('Testing nested if/else parsing...');
console.log('Code:');
console.log(code);
console.log('\n=== Testing Nearley Parser ===');

try {
  const ast = parse(code);
  console.log('✓ Parser succeeded!');
  console.log('AST type:', (ast as any).constructor.name);
} catch (e: any) {
  console.log('✗ Parser failed!');
  console.log('Error:', e.message);
  console.log('At line:', e.line, 'col:', e.col);
}
