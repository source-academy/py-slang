// Regression tests for https://github.com/source-academy/py-slang/issues/228.
//
// Kept in a file separate from PyCseMachinePlugin.test.ts, which currently has an
// unrelated pre-existing compile error (missing `globalNames` on
// CseSerializedEnvFrame) that prevents the whole file — and therefore any test added
// to it — from running.
import { serializeControlItem } from "../conductor/plugins/PyCseMachinePlugin";

describe("serializeControlItem — real vs synthetic nodes at source position 0", () => {
  it("a real single-token node whose token is the very first token of the source renders its real text and line info", () => {
    const code = "print";
    const result = serializeControlItem(
      {
        kind: "Variable",
        startToken: { indexInSource: 0, line: 1, lexeme: "print" },
        endToken: { indexInSource: 0, line: 1, lexeme: "print" },
      },
      code,
    );
    expect(result.displayText).toBe("print");
    expect((result.metadata as any)?.startLine).toBe(1);
    expect((result.metadata as any)?.endLine).toBe(1);
  });

  it("a synthetic single-token node pinned to position 0 falls back to the generic KIND_LABEL, not the real text at position 0", () => {
    const code = "print";
    const result = serializeControlItem(
      {
        kind: "Variable",
        startToken: { indexInSource: 0, line: 0, lexeme: "0", synthetic: true },
        endToken: { indexInSource: 0, line: 0, lexeme: "0", synthetic: true },
      },
      code,
    );
    expect(result.displayText).toBe("var");
    expect((result.metadata as any)?.startLine).toBeUndefined();
  });

  it("synthetic BigIntLiteral (e.g. implicit range() start/step bound) still shows its runtime value", () => {
    const result = serializeControlItem(
      {
        kind: "BigIntLiteral",
        value: 0n,
        startToken: { indexInSource: 0, line: 0, lexeme: "0", synthetic: true },
        endToken: { indexInSource: 0, line: 0, lexeme: "0", synthetic: true },
      },
      "for x in range(3):\n    pass\n",
    );
    expect(result.displayText).toBe("0");
  });

  it("a real multi-token node at position 0 is unaffected (already worked before the fix)", () => {
    const code = "x = 1 + 2\n";
    const result = serializeControlItem(
      {
        kind: "Assign",
        startToken: { indexInSource: 0, line: 1 },
        endToken: { indexInSource: 9, line: 1, lexeme: "" },
      },
      code,
    );
    expect(result.displayText).toBe("x = 1 + 2");
    expect((result.metadata as any)?.startLine).toBe(1);
  });
});
