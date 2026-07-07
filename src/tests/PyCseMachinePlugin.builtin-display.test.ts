// Regression tests for https://github.com/source-academy/py-slang/issues/229.
//
// Kept in a file separate from PyCseMachinePlugin.test.ts, which currently has an
// unrelated pre-existing compile error (missing `globalNames` on
// CseSerializedEnvFrame) that prevents the whole file — and therefore any test added
// to it — from running. The corresponding assertions there were updated in place too.
import { formatValue, serializeValue } from "../conductor/plugins/PyCseMachinePlugin";
import type { Value } from "../engines/cse/stash";

const builtin = (name: string): Value => ({
  type: "builtin",
  name,
  func: () => undefined,
  minArgs: 0,
});

describe("builtin value display (CSE Machine stash/control chips)", () => {
  it("formatValue shows just the builtin's name, not a Python repr()-style wrapper", () => {
    expect(formatValue(builtin("print"))).toBe("print");
    expect(formatValue(builtin("abs"))).toBe("abs");
  });

  it("serializeValue carries the 'builtin' fact in label, distinct from user-defined closures", () => {
    const v = serializeValue(builtin("print"));
    expect(v.displayValue).toBe("print");
    expect(v.label).toBe("builtin_function_or_method");
    expect(v.label).not.toBe("function"); // "function" is what closures get
  });
});
