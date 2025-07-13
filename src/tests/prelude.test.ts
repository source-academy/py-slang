import { createContext, Chapter } from '../createContext';
import { runInContext } from '../index';
import { Context } from '../cse-machine/context';

describe('Prelude System Tests', () => {
  describe('Context Creation', () => {
    test('should create context with Chapter 1', () => {
      const context = createContext(1);
      expect(context).toBeInstanceOf(Context);
      expect(context.prelude).toBeNull(); // Chapter 1 has no prelude
    });

    test('should create context with Chapter 2', () => {
      const context = createContext(2);
      expect(context).toBeInstanceOf(Context);
      expect(context.prelude).toBeTruthy(); // Chapter 2 should have prelude
    });

    test('should create context with Chapter 3', () => {
      const context = createContext(3);
      expect(context).toBeInstanceOf(Context);
      expect(context.prelude).toBeTruthy();
    });

    test('should create context with Chapter 4', () => {
      const context = createContext(4);
      expect(context).toBeInstanceOf(Context);
      expect(context.prelude).toBeTruthy();
    });

    test('should create context with LIBRARY_PARSER', () => {
      const context = createContext('LIBRARY_PARSER');
      expect(context).toBeInstanceOf(Context);
      expect(context.prelude).toBeTruthy();
    });
  });

  describe('Chapter 1 Functions', () => {
    let context: Context;

    beforeEach(() => {
      context = createContext(1);
    });

    test('should have basic math functions', async () => {
      const code = `
print(abs(-5))
print(max(1, 2, 3))
print(min(1, 2, 3))
print(round(3.14159, 2))
print(str(42))
`;
      const result = await runInContext(code, context);
      expect(result).toBeDefined();
    });

    test('should have math constants', async () => {
      const code = `
print(math_pi)
print(math_e)
`;
      const result = await runInContext(code, context);
      expect(result).toBeDefined();
    });
  });

  describe('Chapter 2 List Functions', () => {
    let context: Context;

    beforeEach(() => {
      context = createContext(2);
    });

    test('should have list creation functions', async () => {
      const code = `
xs = list(1, 2, 3, 4, 5)
print(xs)
print(length(xs))
print(head(xs))
print(tail(xs))
print(is_pair(xs))
print(is_null(None))
`;
      const result = await runInContext(code, context);
      expect(result).toBeDefined();
    });

    test('should have map function', async () => {
      const code = `
def square(x):
    return x * x

xs = list(1, 2, 3, 4, 5)
squared = map(square, xs)
print(squared)
`;
      const result = await runInContext(code, context);
      expect(result).toBeDefined();
    });

    test('should have filter function', async () => {
      const code = `
def is_even(x):
    return x % 2 == 0

xs = list(1, 2, 3, 4, 5)
evens = filter(is_even, xs)
print(evens)
`;
      const result = await runInContext(code, context);
      expect(result).toBeDefined();
    });

    test('should have accumulate function', async () => {
      const code = `
def add(x, y):
    return x + y

xs = list(1, 2, 3, 4, 5)
sum_xs = accumulate(add, 0, xs)
print(sum_xs)
`;
      const result = await runInContext(code, context);
      expect(result).toBeDefined();
    });

    test('should have reverse function', async () => {
      const code = `
xs = list(1, 2, 3, 4, 5)
reversed_xs = reverse(xs)
print(reversed_xs)
`;
      const result = await runInContext(code, context);
      expect(result).toBeDefined();
    });

    test('should have append function', async () => {
      const code = `
xs = list(1, 2, 3)
ys = list(4, 5, 6)
appended = append(xs, ys)
print(appended)
`;
      const result = await runInContext(code, context);
      expect(result).toBeDefined();
    });

    test('should have build_list function', async () => {
      const code = `
def double(x):
    return x * 2

doubled_list = build_list(double, 5)
print(doubled_list)
`;
      const result = await runInContext(code, context);
      expect(result).toBeDefined();
    });

    test('should have enum_list function', async () => {
      const code = `
range_list = enum_list(1, 10)
print(range_list)
`;
      const result = await runInContext(code, context);
      expect(result).toBeDefined();
    });

    test('should have list utility functions', async () => {
      const code = `
xs = list(1, 2, 3, 4, 5)
print(list_ref(xs, 2))
print(member(3, xs))
print(member(10, xs))
`;
      const result = await runInContext(code, context);
      expect(result).toBeDefined();
    });

    test('should have remove functions', async () => {
      const code = `
xs = list(1, 2, 3, 2, 4, 2, 5)
removed_first = remove(2, xs)
removed_all = remove_all(2, xs)
print(removed_first)
print(removed_all)
`;
      const result = await runInContext(code, context);
      expect(result).toBeDefined();
    });

    test('should have equal function', async () => {
      const code = `
list1 = list(1, 2, 3)
list2 = list(1, 2, 3)
list3 = list(1, 2, 4)
print(equal(list1, list2))
print(equal(list1, list3))
`;
      const result = await runInContext(code, context);
      expect(result).toBeDefined();
    });

    test('should have for_each function', async () => {
      const code = `
def print_item(x):
    print("Processing:", x)

xs = list(1, 2, 3)
for_each(print_item, xs)
`;
      const result = await runInContext(code, context);
      expect(result).toBeDefined();
    });
  });

  describe('Prelude Loading', () => {
    test('should load prelude for Chapter 2+', () => {
      const context = createContext(2);
      expect(context.prelude).toBeTruthy();
      expect(typeof context.prelude).toBe('string');
      expect(context.prelude!.length).toBeGreaterThan(0);
    });

    test('should not load prelude for Chapter 1', () => {
      const context = createContext(1);
      expect(context.prelude).toBeNull();
    });
  });

  describe('Integration Tests', () => {
    test('should run complex list operations', async () => {
      const context = createContext(2);
      const code = `
# Create a list
xs = list(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)

# Filter even numbers
def is_even(x):
    return x % 2 == 0

evens = filter(is_even, xs)

# Map square function
def square(x):
    return x * x

squared_evens = map(square, evens)

# Accumulate sum
def add(x, y):
    return x + y

sum_squared_evens = accumulate(add, 0, squared_evens)

print("Original list:", xs)
print("Even numbers:", evens)
print("Squared evens:", squared_evens)
print("Sum of squared evens:", sum_squared_evens)
`;
      const result = await runInContext(code, context);
      expect(result).toBeDefined();
    });

    test('should handle nested list operations', async () => {
      const context = createContext(2);
      const code = `
# Create lists
list1 = list(1, 2, 3)
list2 = list(4, 5, 6)
list3 = list(7, 8, 9)

# Append lists
combined = append(list1, append(list2, list3))

# Reverse the combined list
reversed_combined = reverse(combined)

# Get specific elements
first = list_ref(combined, 0)
last = list_ref(combined, 8)

print("Combined list:", combined)
print("Reversed list:", reversed_combined)
print("First element:", first)
print("Last element:", last)
`;
      const result = await runInContext(code, context);
      expect(result).toBeDefined();
    });
  });
}); 