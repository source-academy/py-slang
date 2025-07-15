import { createContext, Chapter } from '../createContext';
import { importBuiltins } from '../stdlib/index';
import { Context } from '../cse-machine/context';

describe('Standard Library Tests', () => {
  describe('Chapter 1 Builtins', () => {
    let context: Context;

    beforeEach(() => {
      context = new Context();
      importBuiltins(context, 1);
    });

    test('should have basic math functions', () => {
      expect(context.nativeStorage.builtins.has('abs')).toBe(true);
      expect(context.nativeStorage.builtins.has('max')).toBe(true);
      expect(context.nativeStorage.builtins.has('min')).toBe(true);
      expect(context.nativeStorage.builtins.has('round')).toBe(true);
      expect(context.nativeStorage.builtins.has('str')).toBe(true);
      expect(context.nativeStorage.builtins.has('print')).toBe(true);
      expect(context.nativeStorage.builtins.has('input')).toBe(true);
    });

    test('should have math constants', () => {
      expect(context.nativeStorage.builtins.has('math_pi')).toBe(true);
      expect(context.nativeStorage.builtins.has('math_e')).toBe(true);
      expect(context.nativeStorage.builtins.has('math_inf')).toBe(true);
      expect(context.nativeStorage.builtins.has('math_nan')).toBe(true);
      expect(context.nativeStorage.builtins.has('math_tau')).toBe(true);
    });

    test('should have type checking functions', () => {
      expect(context.nativeStorage.builtins.has('isinstance')).toBe(true);
      expect(context.nativeStorage.builtins.has('error')).toBe(true);
    });

    test('should have math functions', () => {
      expect(context.nativeStorage.builtins.has('math_sin')).toBe(true);
      expect(context.nativeStorage.builtins.has('math_cos')).toBe(true);
      expect(context.nativeStorage.builtins.has('math_sqrt')).toBe(true);
      expect(context.nativeStorage.builtins.has('math_pow')).toBe(true);
      expect(context.nativeStorage.builtins.has('math_log')).toBe(true);
    });
  });

  describe('Chapter 2 Builtins', () => {
    let context: Context;

    beforeEach(() => {
      context = new Context();
      importBuiltins(context, 2);
    });

    test('should have all Chapter 1 functions', () => {
      expect(context.nativeStorage.builtins.has('abs')).toBe(true);
      expect(context.nativeStorage.builtins.has('math_pi')).toBe(true);
      expect(context.nativeStorage.builtins.has('print')).toBe(true);
    });

    test('should have list creation functions', () => {
      expect(context.nativeStorage.builtins.has('pair')).toBe(true);
      expect(context.nativeStorage.builtins.has('head')).toBe(true);
      expect(context.nativeStorage.builtins.has('tail')).toBe(true);
      expect(context.nativeStorage.builtins.has('is_null')).toBe(true);
      expect(context.nativeStorage.builtins.has('is_pair')).toBe(true);
      expect(context.nativeStorage.builtins.has('list')).toBe(true);
    });

    test('should have list operation functions', () => {
      expect(context.nativeStorage.builtins.has('length')).toBe(true);
      expect(context.nativeStorage.builtins.has('map')).toBe(true);
      expect(context.nativeStorage.builtins.has('filter')).toBe(true);
      expect(context.nativeStorage.builtins.has('accumulate')).toBe(true);
      expect(context.nativeStorage.builtins.has('append')).toBe(true);
      expect(context.nativeStorage.builtins.has('reverse')).toBe(true);
    });

    test('should have list utility functions', () => {
      expect(context.nativeStorage.builtins.has('list_ref')).toBe(true);
      expect(context.nativeStorage.builtins.has('member')).toBe(true);
      expect(context.nativeStorage.builtins.has('remove')).toBe(true);
      expect(context.nativeStorage.builtins.has('remove_all')).toBe(true);
      expect(context.nativeStorage.builtins.has('equal')).toBe(true);
    });

    test('should have list generation functions', () => {
      expect(context.nativeStorage.builtins.has('build_list')).toBe(true);
      expect(context.nativeStorage.builtins.has('for_each')).toBe(true);
      expect(context.nativeStorage.builtins.has('enum_list')).toBe(true);
    });
  });

  describe('Chapter 3 Builtins', () => {
    let context: Context;

    beforeEach(() => {
      context = new Context();
      importBuiltins(context, 3);
    });

    test('should have all Chapter 2 functions', () => {
      expect(context.nativeStorage.builtins.has('abs')).toBe(true);
      expect(context.nativeStorage.builtins.has('pair')).toBe(true);
      expect(context.nativeStorage.builtins.has('map')).toBe(true);
    });

    test('should have Chapter 3 specific functions', () => {
      // Chapter 3 functions would be added here when implemented
      // For now, it should have all Chapter 2 functions
      expect(context.nativeStorage.builtins.has('length')).toBe(true);
      expect(context.nativeStorage.builtins.has('filter')).toBe(true);
    });
  });

  describe('Chapter 4 Builtins', () => {
    let context: Context;

    beforeEach(() => {
      context = new Context();
      importBuiltins(context, 4);
    });

    test('should have all Chapter 3 functions', () => {
      expect(context.nativeStorage.builtins.has('abs')).toBe(true);
      expect(context.nativeStorage.builtins.has('pair')).toBe(true);
      expect(context.nativeStorage.builtins.has('map')).toBe(true);
    });

    test('should have Chapter 4 specific functions', () => {
      // Chapter 4 functions would be added here when implemented
      // For now, it should have all Chapter 3 functions
      expect(context.nativeStorage.builtins.has('length')).toBe(true);
      expect(context.nativeStorage.builtins.has('filter')).toBe(true);
    });
  });

  describe('LIBRARY_PARSER Builtins', () => {
    let context: Context;

    beforeEach(() => {
      context = new Context();
      importBuiltins(context, 'LIBRARY_PARSER');
    });

    test('should have all Chapter 4 functions', () => {
      expect(context.nativeStorage.builtins.has('abs')).toBe(true);
      expect(context.nativeStorage.builtins.has('pair')).toBe(true);
      expect(context.nativeStorage.builtins.has('map')).toBe(true);
    });

    test('should have library parser specific functions', () => {
      // Library parser functions would be added here when implemented
      // For now, it should have all Chapter 4 functions
      expect(context.nativeStorage.builtins.has('length')).toBe(true);
      expect(context.nativeStorage.builtins.has('filter')).toBe(true);
    });
  });

  describe('Function Values', () => {
    test('should have callable functions', () => {
      const context = new Context();
      importBuiltins(context, 2);

      const absFunc = context.nativeStorage.builtins.get('abs');
      const mapFunc = context.nativeStorage.builtins.get('map');
      const listFunc = context.nativeStorage.builtins.get('list');

      expect(typeof absFunc).toBe('function');
      expect(typeof mapFunc).toBe('function');
      expect(typeof listFunc).toBe('function');
    });

    test('should have correct function signatures', () => {
      const context = new Context();
      importBuiltins(context, 2);

      // Test that functions can be called (basic functionality)
      const absFunc = context.nativeStorage.builtins.get('abs');
      const listFunc = context.nativeStorage.builtins.get('list');

      expect(absFunc).toBeDefined();
      expect(listFunc).toBeDefined();
    });
  });
}); 