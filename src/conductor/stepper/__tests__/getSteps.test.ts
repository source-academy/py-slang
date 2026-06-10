import { parse } from '../../../parser';
import { evaluatePython, getPythonSteps } from '../getSteps';

function steps(src: string) {
  return getPythonSteps(parse(src + '\n'));
}

function result(src: string) {
  return evaluatePython(parse(src + '\n'));
}

function explanations(src: string) {
  return steps(src).map(s => s.markers?.[0]?.explanation ?? '');
}

/** Collect every nodeId present in a serialized step's AST. */
function nodeIds(ast: unknown): Set<string> {
  const ids = new Set<string>();
  (function walk(value: any) {
    if (value && typeof value === 'object') {
      if (typeof value.nodeId === 'string') ids.add(value.nodeId);
      for (const key of Object.keys(value)) walk(value[key]);
    }
  })(ast);
  return ids;
}

describe('Python stepper — final values', () => {
  test('arithmetic respects precedence', () => {
    expect(result('1 + 2 * 3')).toBe('7');
  });

  test('true division yields a float repr', () => {
    expect(result('7 / 2')).toBe('3.5');
    expect(result('4 / 2')).toBe('2.0');
  });

  test('floor division and modulo', () => {
    expect(result('7 // 2')).toBe('3');
    expect(result('7 % 3')).toBe('1');
  });

  test('power', () => {
    expect(result('2 ** 10')).toBe('1024');
  });

  test('comparisons produce Python booleans', () => {
    expect(result('1 < 2')).toBe('True');
    expect(result('2 == 3')).toBe('False');
  });

  test('assignment binds by substitution', () => {
    expect(result('x = 5\nx + 1')).toBe('6');
  });

  test('lambda application', () => {
    expect(result('f = lambda x: x + 1\nf(10)')).toBe('11');
  });

  test('function definition application', () => {
    expect(result('def square(n):\n  return n * n\nsquare(4)')).toBe('16');
  });

  test('ternary selects a branch', () => {
    expect(result('1 if 2 > 1 else 99')).toBe('1');
    expect(result('1 if 2 < 1 else 99')).toBe('99');
  });

  test('if-statement selects a branch and binds', () => {
    expect(result('if 1 < 2:\n  x = 10\nelse:\n  x = 20\nx + 1')).toBe('11');
  });

  test('unary negation and not', () => {
    expect(result('-5 + 2')).toBe('-3');
    expect(result('not (1 < 2)')).toBe('False');
  });
});

describe('Python stepper — short-circuit', () => {
  test('`and` returns the right operand when the left is truthy', () => {
    expect(result('True and (1 < 2)')).toBe('True');
  });

  test('`and` short-circuits on a falsy left without touching the right', () => {
    // `undefined_name` is a free variable; it must never be reduced.
    expect(result('False and undefined_name')).toBe('False');
  });

  test('`or` short-circuits on a truthy left', () => {
    expect(result('True or undefined_name')).toBe('True');
  });
});

describe('Python stepper — step structure', () => {
  test('begins with a "Start of evaluation" step and alternates before/after', () => {
    const e = explanations('1 + 2 * 3');
    expect(e[0]).toBe('Start of evaluation');
    expect(steps('1 + 2 * 3')[1].markers?.[0]?.redexType).toBe('beforeMarker');
    expect(steps('1 + 2 * 3')[2].markers?.[0]?.redexType).toBe('afterMarker');
  });

  test('innermost redex reduces first (2 * 3 before 1 + 6)', () => {
    const e = explanations('1 + 2 * 3');
    expect(e[1]).toContain('2 * 3');
    expect(e[3]).toContain('1 + 6');
  });

  test('every before-marker redexId resolves to a node in that step AST', () => {
    for (const step of steps('1 + 2 * 3\nx = 4\nx * x')) {
      const marker = step.markers?.[0];
      if (marker?.redexId != null) {
        expect(nodeIds(step.ast).has(marker.redexId)).toBe(true);
      }
    }
  });

  test('serialized steps are structured-clone safe (survive the channel)', () => {
    expect(() => structuredClone(steps('f = lambda x: x + 1\nf(10)'))).not.toThrow();
  });

  test('the serialized AST is estree-shaped for the host renderer', () => {
    const ast = steps('1 + 2')[0].ast as any;
    expect(ast.type).toBe('Program');
    expect(ast.body[0].type).toBe('ExpressionStatement');
    expect(ast.body[0].expression.type).toBe('BinaryExpression');
    expect(ast.body[0].expression).toMatchObject({ operator: '+' });
  });
});
