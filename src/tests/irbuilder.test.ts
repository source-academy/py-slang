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

    expect(ir1.arg1s[1]).toBe(3); // BRF at index 1, target at index 4
    expect(ir1.arg1s[1]).toBe(ir2.arg1s[1]);
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
  test("FLOORDIVG has stack effect -1", () => {
    SVMLIRBuilder.resetIndex();
    const builder = new SVMLIRBuilder(0);
    builder.emitUnary(OpCodes.LDCI, 7);
    builder.emitUnary(OpCodes.LDCI, 2);
    builder.emitNullary(OpCodes.FLOORDIVG);
    builder.emitUnary(OpCodes.LDCI, 0); // post-FLOORDIVG push: depth 2 if effect=-1, depth 3 if effect=0
    builder.emitNullary(OpCodes.RETG);

    const ir = builder.build();
    expect(ir.opcodes[2]).toBe(OpCodes.FLOORDIVG);
    expect(ir.stackSize).toBe(2);
  });

  test("FLOORDIVF has stack effect -1", () => {
    SVMLIRBuilder.resetIndex();
    const builder = new SVMLIRBuilder(0);
    builder.emitUnary(OpCodes.LDCF32, 7.0);
    builder.emitUnary(OpCodes.LDCF32, 2.0);
    builder.emitNullary(OpCodes.FLOORDIVF);
    builder.emitUnary(OpCodes.LDCI, 0); // post-FLOORDIVF push: depth 2 if effect=-1, depth 3 if effect=0
    builder.emitNullary(OpCodes.RETG);

    const ir = builder.build();
    expect(ir.opcodes[2]).toBe(OpCodes.FLOORDIVF);
    expect(ir.stackSize).toBe(2);
  });
});

describe("NEWITER / FOR_ITER stack effects (regression: OOB write when numbered 1054/1055)", () => {
  test("FOR_ITER registers a +1 stack effect", () => {
    SVMLIRBuilder.resetIndex();
    const builder = new SVMLIRBuilder(0);
    builder.emitUnary(OpCodes.LDCI, 1);
    builder.emitNullary(OpCodes.NEWITER);
    const doneLabel = builder.getNextLabel();
    builder.emitJump(OpCodes.FOR_ITER, doneLabel);
    builder.markLabel(doneLabel);
    builder.emitNullary(OpCodes.RETG);

    const ir = builder.build();
    expect(ir.stackSize).toBe(2);
  });
});
