import { friendlyTypeName, typeTranslator } from "../engines/cse/types";

describe("typeTranslator", () => {
  test("translates known CSE Value type tags to Python names", () => {
    expect(typeTranslator("bigint")).toBe("int");
    expect(typeTranslator("list")).toBe("list");
    expect(typeTranslator("none")).toBe("NoneType");
    expect(typeTranslator("builtin")).toBe("builtin_function_or_method");
  });

  // Gemini review on #273: widening this function's parameter to
  // Value["type"] | string (so errors.ts's TypeError class, which only ever
  // has a plain string, can call it) means it can be called with something
  // that isn't a genuine Value type tag -- the default case must pass that
  // through unchanged rather than collapsing it to "unknown", or an
  // already-valid Python type name would get silently mangled.
  test("passes an unrecognized input through unchanged, not 'unknown'", () => {
    expect(typeTranslator("already_a_python_name")).toBe("already_a_python_name");
    expect(typeTranslator("int")).toBe("int");
  });
});

describe("friendlyTypeName", () => {
  test("spells out CPython's abbreviations", () => {
    expect(friendlyTypeName("int")).toBe("integer");
    expect(friendlyTypeName("bool")).toBe("boolean");
    expect(friendlyTypeName("str")).toBe("string");
    expect(friendlyTypeName("NoneType")).toBe("None");
    expect(friendlyTypeName("builtin_function_or_method")).toBe("function");
  });

  test("leaves already-plain-English names unchanged", () => {
    expect(friendlyTypeName("float")).toBe("float");
    expect(friendlyTypeName("complex")).toBe("complex");
    expect(friendlyTypeName("function")).toBe("function");
  });

  test("passes an unrecognized input through unchanged", () => {
    expect(friendlyTypeName("something_custom")).toBe("something_custom");
  });

  describe("chapter-aware pair vs list", () => {
    test("says 'pair' at chapters 1-2, where list-literal syntax doesn't exist", () => {
      expect(friendlyTypeName("list", 1)).toBe("pair");
      expect(friendlyTypeName("list", 2)).toBe("pair");
    });

    test("says 'list' at chapters 3-4, where the value is genuinely ambiguous", () => {
      expect(friendlyTypeName("list", 3)).toBe("list");
      expect(friendlyTypeName("list", 4)).toBe("list");
    });

    test("defaults to 'list' when no variant is given", () => {
      expect(friendlyTypeName("list")).toBe("list");
    });
  });
});
