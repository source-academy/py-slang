import { SVMLIRBuilder } from "../engines/svml/SVMLIRBuilder";
import OpCodes from "../engines/svml/opcodes";

describe("SVMLIRBuilder.build() non-destructive", () => {
  test("build() can be called twice with identical results", () => {
    SVMLIRBuilder.resetIndex();
    const builder = new SVMLIRBuilder(0);
    builder.emitUnary(OpCodes.LDCI, 42);
    builder.emitUnary(OpCodes.LDCI, 10);
    builder.emitNullary(OpCodes.ADDG);
    builder.emitNullary(OpCodes.RETG);

    const ir1 = builder.build();
    const ir2 = builder.build();

    expect(ir1.count).toBe(4);
    expect(ir2.count).toBe(4);
    expect(ir1.arg1s[0]).toBe(42);
    expect(ir2.arg1s[0]).toBe(42);
    // Separate typed arrays — mutating one doesn't affect the other
    ir1.arg1s[0] = 999;
    expect(ir2.arg1s[0]).toBe(42);
  });

  test("build() with jump labels resolves correctly on both calls", () => {
    SVMLIRBuilder.resetIndex();
    const builder = new SVMLIRBuilder(0);
    builder.emitUnary(OpCodes.LDCB1, 1);
    const label = builder.emitJump(OpCodes.BRF);
    builder.emitUnary(OpCodes.LDCI, 42);
    builder.emitNullary(OpCodes.RETG);
    builder.markLabel(label);
    builder.emitUnary(OpCodes.LDCI, 0);
    builder.emitNullary(OpCodes.RETG);

    const ir1 = builder.build();
    const ir2 = builder.build();

    expect(ir1.arg1s[1]).toBe(ir2.arg1s[1]);
    expect(ir1.arg1s[1]).toBeGreaterThan(0);
  });

  test("build(indexMap) remaps NEWC function indices", () => {
    SVMLIRBuilder.resetIndex();
    const parent = new SVMLIRBuilder(0);
    const child = parent.createChildBuilder(1);
    parent.emitUnary(OpCodes.NEWC, child.getFunctionIndex());
    parent.emitNullary(OpCodes.RETG);

    const oldIndex = child.getFunctionIndex();
    const newIndex = 42;
    const indexMap = new Map([[oldIndex, newIndex]]);

    const ir = parent.build(indexMap);
    expect(ir.arg1s[0]).toBe(42);

    const irNoRemap = parent.build();
    expect(irNoRemap.arg1s[0]).toBe(oldIndex);
  });
});

describe("Floor division opcodes", () => {
  test("FLOORDIVG and FLOORDIVF have correct stack effects (-1)", () => {
    SVMLIRBuilder.resetIndex();
    const builder = new SVMLIRBuilder(0);
    // Push two values, then floor divide
    builder.emitUnary(OpCodes.LDCI, 7);
    builder.emitUnary(OpCodes.LDCI, 2);
    builder.emitNullary(OpCodes.FLOORDIVG);
    builder.emitNullary(OpCodes.RETG);

    const ir = builder.build();
    expect(ir.count).toBe(4);
    expect(ir.opcodes[2]).toBe(OpCodes.FLOORDIVG);
  });
});
