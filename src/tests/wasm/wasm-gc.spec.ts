import { i32, wasm } from "@sourceacademy/wasm-util";
import { compileToWasmAndRun } from "../../engines/wasm";
import {
  insertInArray,
  isFunctionCall,
  isFunctionOfName,
  isIfInstruction,
} from "../../engines/wasm/irHelpers";
import {
  APPLY_FX_NAME,
  ARITHMETIC_OP_FX,
  COLLECT_FX,
  ERROR_MAP,
  GET_LAST_EXPR_RESULT_FX,
  GET_LEX_ADDR_FX,
  MAKE_CLOSURE_FX,
  MAKE_COMPLEX_FX,
  MAKE_LIST_FX,
  MAKE_STRING_FX,
  PEEK_SHADOW_STACK_FX,
  SET_CONTIGUOUS_BLOCK_FX,
  SHADOW_STACK_TAG,
  TYPE_TAG,
} from "../../engines/wasm/runtime";
import linkedList from "../../stdlib/linked-list";

describe("GC collect/copy tests", () => {
  const topOfShadowStack = wasm
    .call("$_log_raw")
    .args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0)));

  it("moves list payload and preserves logical value", async () => {
    const pythonCode = `[1, 2, 3]`;

    const forceCollectAfterListCreate = insertInArray(
      node => isFunctionCall(node, GET_LAST_EXPR_RESULT_FX) && node.arguments,
      instruction => isFunctionCall(instruction, MAKE_LIST_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
    );

    const {
      rawOutputs,
      rawResult,
      renderedResult,
      debugFunctions: { getListElement },
    } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectAfterListCreate],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(TYPE_TAG.LIST);
    expect(rawOutputs[1][0]).toBe(TYPE_TAG.LIST);

    const beforePtr = rawOutputs[0][1] >> 32n;
    const afterPtr = rawOutputs[1][1] >> 32n;
    const beforeLen = Number(rawOutputs[0][1] & 0xffffffffn);
    const afterLen = Number(rawOutputs[1][1] & 0xffffffffn);

    // GC copies from FROM-space to TO-space. TO-space is initially at a higher base address, so
    // forwarded pointers should increase after collection.
    expect(afterPtr).toBeGreaterThan(beforePtr);
    expect(afterLen).toBe(beforeLen);
    expect(rawResult[0]).toBe(TYPE_TAG.LIST);
    expect(renderedResult).toBe("[1, 2, 3]");

    expect(getListElement(TYPE_TAG.LIST, rawResult[1], 0)).toEqual([TYPE_TAG.INT, 1n]);
    expect(getListElement(TYPE_TAG.LIST, rawResult[1], 1)).toEqual([TYPE_TAG.INT, 2n]);
    expect(getListElement(TYPE_TAG.LIST, rawResult[1], 2)).toEqual([TYPE_TAG.INT, 3n]);
  });

  it("moves list payload even when first element value at +4 matches forwarding bit", async () => {
    // For a list element layout [tag:i32][value:i64], ptr + 4 reads the lower 32 bits
    // of the first element's i64 value. 1073741824 = 0x40000000 matches the forwarding bit.
    const pythonCode = `[1073741824, 1]`;

    const forceCollectAfterListCreate = insertInArray(
      node => isFunctionCall(node, GET_LAST_EXPR_RESULT_FX) && node.arguments,
      instruction => isFunctionCall(instruction, MAKE_LIST_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
    );

    const {
      rawOutputs,
      rawResult,
      renderedResult,
      debugFunctions: { getListElement },
    } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectAfterListCreate],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(TYPE_TAG.LIST);
    expect(rawOutputs[1][0]).toBe(TYPE_TAG.LIST);

    const beforePtr = rawOutputs[0][1] >> 32n;
    const afterPtr = rawOutputs[1][1] >> 32n;
    const beforeLen = Number(rawOutputs[0][1] & 0xffffffffn);
    const afterLen = Number(rawOutputs[1][1] & 0xffffffffn);

    expect(afterPtr).toBeGreaterThan(beforePtr);
    expect(afterLen).toBe(beforeLen);
    expect(rawResult[0]).toBe(TYPE_TAG.LIST);
    expect(renderedResult).toBe("[1073741824, 1]");

    expect(getListElement(TYPE_TAG.LIST, rawResult[1], 0)).toEqual([TYPE_TAG.INT, 1073741824n]);
    expect(getListElement(TYPE_TAG.LIST, rawResult[1], 1)).toEqual([TYPE_TAG.INT, 1n]);
  });

  it("copies LIST_STATE root even when list payload at +4 matches forwarding bit", async () => {
    const pythonCode = `[1073741824, 1]`;

    const forceCollectDuringListBuild = insertInArray(
      node => isFunctionCall(node, MAKE_LIST_FX) && node.arguments,
      instruction => isFunctionCall(instruction, SET_CONTIGUOUS_BLOCK_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
      { matchIndex: 0 },
    );

    const {
      rawOutputs,
      rawResult,
      renderedResult,
      debugFunctions: { getListElement },
    } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectDuringListBuild],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(SHADOW_STACK_TAG.LIST_STATE);
    expect(rawOutputs[1][0]).toBe(SHADOW_STACK_TAG.LIST_STATE);

    const beforePtr = rawOutputs[0][1] >> 32n;
    const afterPtr = rawOutputs[1][1] >> 32n;
    const beforeLen = Number(rawOutputs[0][1] & 0xffffffffn);
    const afterLen = Number(rawOutputs[1][1] & 0xffffffffn);

    expect(afterPtr).toBeGreaterThan(beforePtr);
    expect(beforeLen).toBe(2);
    expect(afterLen).toBe(2);

    expect(rawResult[0]).toBe(TYPE_TAG.LIST);
    expect(renderedResult).toBe("[1073741824, 1]");
    expect(getListElement(TYPE_TAG.LIST, rawResult[1], 0)).toEqual([TYPE_TAG.INT, 1073741824n]);
    expect(getListElement(TYPE_TAG.LIST, rawResult[1], 1)).toEqual([TYPE_TAG.INT, 1n]);
  });

  it("preserves list capacity when GC runs during LIST_STATE build", async () => {
    const pythonCode = `
x = [11, 99]
"a" + "b"
x[1]
`;

    const forceCollectDuringListBuild = insertInArray(
      node => isFunctionCall(node, MAKE_LIST_FX) && node.arguments,
      instruction => isFunctionCall(instruction, SET_CONTIGUOUS_BLOCK_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
      { matchIndex: 0 },
    );

    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectDuringListBuild],
    });

    // expect(rawOutputs).toHaveLength(2);
    // expect(rawOutputs[0][0]).toBe(SHADOW_STACK_TAG.LIST_STATE);
    // expect(rawOutputs[1][0]).toBe(SHADOW_STACK_TAG.LIST_STATE);

    // const beforePtr = rawOutputs[0][1] >> 32n;
    // const afterPtr = rawOutputs[1][1] >> 32n;
    // const beforeLen = Number(rawOutputs[0][1] & 0xffffffffn);
    // const afterLen = Number(rawOutputs[1][1] & 0xffffffffn);

    // expect(afterPtr).toBeGreaterThan(beforePtr);
    // expect(beforeLen).toBe(2);
    // expect(afterLen).toBe(2);

    // Correct behavior: GC during list construction must preserve full backing capacity.
    // The later heap allocation for string concat must not overlap list slots.
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("99");
  });

  it("preserves argument capacity when GC runs during CALL_NEW_ENV build", async () => {
    const pythonCode = `
def second(a, b):
    return b

x = second(11, 99)
"a" + "b"
x
`;

    const forceCollectDuringCallBuild = insertInArray(
      node => isFunctionCall(node, APPLY_FX_NAME) && node.arguments,
      instruction => isFunctionCall(instruction, SET_CONTIGUOUS_BLOCK_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
      { matchIndex: 0 },
    );

    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectDuringCallBuild],
    });

    // expect(rawOutputs).toHaveLength(2);
    // expect(rawOutputs[0][0]).toBe(SHADOW_STACK_TAG.CALL_NEW_ENV);
    // expect(rawOutputs[1][0]).toBe(SHADOW_STACK_TAG.CALL_NEW_ENV);

    // const beforePtr = rawOutputs[0][1] >> 32n;
    // const afterPtr = rawOutputs[1][1] >> 32n;
    // const beforeLen = Number(rawOutputs[0][1] & 0xffffffffn);
    // const afterLen = Number(rawOutputs[1][1] & 0xffffffffn);

    // expect(afterPtr).toBeGreaterThan(beforePtr);
    // expect(beforeLen).toBe(2);
    // expect(afterLen).toBe(2);

    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(renderedResult).toBe("99");
  });

  it("moves tuple payload from variadic call even when first element value at +4 matches forwarding bit", async () => {
    const pythonCode = `
def f(*args):
    return args

f(1073741824, 1)
`;

    const forceCollectAfterApply = insertInArray(
      node => isFunctionCall(node, GET_LAST_EXPR_RESULT_FX) && node.arguments,
      instruction => isFunctionCall(instruction, APPLY_FX_NAME),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
    );

    const {
      rawOutputs,
      rawResult,
      renderedResult,
      debugFunctions: { getListElement },
    } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectAfterApply],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(TYPE_TAG.TUPLE);
    expect(rawOutputs[1][0]).toBe(TYPE_TAG.TUPLE);

    const beforePtr = rawOutputs[0][1] >> 32n;
    const afterPtr = rawOutputs[1][1] >> 32n;
    const beforeLen = Number(rawOutputs[0][1] & 0xffffffffn);
    const afterLen = Number(rawOutputs[1][1] & 0xffffffffn);

    expect(afterPtr).toBeGreaterThan(beforePtr);
    expect(afterLen).toBe(beforeLen);
    expect(rawResult[0]).toBe(TYPE_TAG.TUPLE);
    expect(renderedResult).toBe("[1073741824, 1]");

    expect(getListElement(TYPE_TAG.TUPLE, rawResult[1], 0)).toEqual([TYPE_TAG.INT, 1073741824n]);
    expect(getListElement(TYPE_TAG.TUPLE, rawResult[1], 1)).toEqual([TYPE_TAG.INT, 1n]);
  });

  it("moves heap string payload and preserves bytes", async () => {
    const pythonCode = `"foo" + "bar"`;

    const forceCollectAfterConcat = insertInArray(
      node => isFunctionCall(node, GET_LAST_EXPR_RESULT_FX) && node.arguments,
      instruction => isFunctionCall(instruction, ARITHMETIC_OP_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
    );

    const { rawOutputs, rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectAfterConcat],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(TYPE_TAG.STRING);
    expect(rawOutputs[1][0]).toBe(TYPE_TAG.STRING);

    const beforePtr = rawOutputs[0][1] >> 32n;
    const afterPtr = rawOutputs[1][1] >> 32n;
    const beforeLen = Number(rawOutputs[0][1] & 0xffffffffn);
    const afterLen = Number(rawOutputs[1][1] & 0xffffffffn);

    expect(afterPtr).toBeGreaterThan(beforePtr);
    expect(beforeLen).toBe(6);
    expect(afterLen).toBe(6);
    expect(rawResult[0]).toBe(TYPE_TAG.STRING);
    expect(renderedResult).toBe("foobar");
  });

  it("keeps both string operands on shadow stack until concat malloc", async () => {
    const pythonCode = `"foo" + "bar"`;

    const inspectShadowStackBeforeConcatMalloc = insertInArray(
      node => {
        const body = isFunctionOfName(node, ARITHMETIC_OP_FX) && node.body;
        const ifBody = body && body.filter(isIfInstruction)[0];
        return ifBody && ifBody.thenBody;
      },
      instruction =>
        instruction != null &&
        typeof instruction === "object" &&
        "op" in instruction &&
        instruction.op === "local.set",
      [
        wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0))),
        wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(1))),
      ],
      { before: true },
    );

    const { rawOutputs, rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [inspectShadowStackBeforeConcatMalloc],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(TYPE_TAG.STRING);
    expect(rawOutputs[1][0]).toBe(TYPE_TAG.STRING);
    expect(Number(rawOutputs[0][1] & 0xffffffffn)).toBe(3);
    expect(Number(rawOutputs[1][1] & 0xffffffffn)).toBe(3);
    expect(rawResult[0]).toBe(TYPE_TAG.STRING);
    expect(renderedResult).toBe("foobar");
  });

  it("moves heap string payload even when bytes at +4 match forwarding bit", async () => {
    // Resulting heap string bytes are:
    // 0x10 0x00 0x00 0x00 0x00 0x00 0x00 0x40
    // so i32.load(ptr + 4) == 0x40000000 (same as forwarding bit pattern).
    const pythonCode = `"\x00\x00\x00\x00" + "\x00\x00\x00@"`;

    const forceCollectAfterConcat = insertInArray(
      node => isFunctionCall(node, GET_LAST_EXPR_RESULT_FX) && node.arguments,
      instruction => isFunctionCall(instruction, ARITHMETIC_OP_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
    );

    const { rawOutputs, rawResult } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectAfterConcat],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(TYPE_TAG.STRING);
    expect(rawOutputs[1][0]).toBe(TYPE_TAG.STRING);

    const beforePtr = rawOutputs[0][1] >> 32n;
    const afterPtr = rawOutputs[1][1] >> 32n;
    const beforeLen = Number(rawOutputs[0][1] & 0xffffffffn);
    const afterLen = Number(rawOutputs[1][1] & 0xffffffffn);

    expect(afterPtr).toBeGreaterThan(beforePtr);
    expect(afterLen).toBe(beforeLen);
    expect(beforeLen).toBe(8);
    expect(rawResult[0]).toBe(TYPE_TAG.STRING);
  });

  it("moves complex payload and preserves numeric value", async () => {
    const pythonCode = `2j`;

    const forceCollectAfterComplexCreate = insertInArray(
      node => isFunctionCall(node, GET_LAST_EXPR_RESULT_FX) && node.arguments,
      instruction => isFunctionCall(instruction, MAKE_COMPLEX_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
    );

    const { rawOutputs, rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectAfterComplexCreate],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(TYPE_TAG.COMPLEX);
    expect(rawOutputs[1][0]).toBe(TYPE_TAG.COMPLEX);

    const beforePtr = rawOutputs[0][1];
    const afterPtr = rawOutputs[1][1];

    expect(afterPtr).toBeGreaterThan(beforePtr);
    expect(rawResult[0]).toBe(TYPE_TAG.COMPLEX);
    expect(renderedResult).toBe("2j");
  });

  it("moves complex payload even when real f64 upper word matches forwarding bit at +4", async () => {
    // 2 as f64 is 0x4000000000000000, which means the upper word of the real
    // part will have the forwarding bit set. This tests that we don't
    // accidentally skip copying the complex number in this case due to a false
    // forwarding pointer match.
    const pythonCode = `2.0 + 3j`;

    const forceCollectAfterComplexCreate = insertInArray(
      node => isFunctionCall(node, GET_LAST_EXPR_RESULT_FX) && node.arguments,
      instruction => isFunctionCall(instruction, ARITHMETIC_OP_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
    );

    const { rawOutputs, rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectAfterComplexCreate],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(TYPE_TAG.COMPLEX);
    expect(rawOutputs[1][0]).toBe(TYPE_TAG.COMPLEX);

    const beforePtr = rawOutputs[0][1];
    const afterPtr = rawOutputs[1][1];

    expect(afterPtr).toBeGreaterThan(beforePtr);
    expect(rawResult[0]).toBe(TYPE_TAG.COMPLEX);
    expect(renderedResult).toBe("2 + 3j");
  });

  it("does not forward complex aliases during collect (duplicate copies are expected)", async () => {
    // Complex forwarding is intentionally disabled. If we want to forward
    // complex numbers in the future, we need to add a dedicated complex
    // object header to hold forwarding metadata.

    // This is because it's rare that we would have multiple references to the
    // same complex number (complex numbers are probably themselves rare).
    // Not worth to handle forwarding logic and metadata updates for this edge
    // case.
    const pythonCode = `
z = 2j
[0, z, z]
`;

    const forceCollectAfterListCreate = insertInArray(
      node => isFunctionCall(node, GET_LAST_EXPR_RESULT_FX) && node.arguments,
      instruction => isFunctionCall(instruction, MAKE_LIST_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
    );

    const {
      rawOutputs,
      rawResult,
      renderedResult,
      debugFunctions: { getListElement },
    } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectAfterListCreate],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(TYPE_TAG.LIST);
    expect(rawOutputs[1][0]).toBe(TYPE_TAG.LIST);

    const beforeList = rawOutputs[0][1];
    const afterList = rawOutputs[1][1];

    // LIST forwarding metadata might overwrite from-space bytes at ptr+0/+4.
    // Keep a dummy first element so the complex numbers under test are at
    // indices 1 and 2 and are protected no matter what.
    const beforeElem1 = getListElement(TYPE_TAG.LIST, beforeList, 1);
    const beforeElem2 = getListElement(TYPE_TAG.LIST, beforeList, 2);
    const afterElem1 = getListElement(TYPE_TAG.LIST, afterList, 1);
    const afterElem2 = getListElement(TYPE_TAG.LIST, afterList, 2);

    expect(beforeElem1[0]).toBe(TYPE_TAG.COMPLEX);
    expect(beforeElem2[0]).toBe(TYPE_TAG.COMPLEX);
    expect(afterElem1[0]).toBe(TYPE_TAG.COMPLEX);
    expect(afterElem2[0]).toBe(TYPE_TAG.COMPLEX);

    // Before collect, both list entries alias the same complex payload.
    expect(beforeElem1[1]).toBe(beforeElem2[1]);

    // Without forwarding, each aliased reference is copied independently.
    expect(afterElem1[1]).not.toBe(afterElem2[1]);
    expect(afterElem1[1]).toBeGreaterThan(beforeElem1[1]);
    expect(afterElem2[1]).toBeGreaterThan(beforeElem2[1]);

    expect(rawResult[0]).toBe(TYPE_TAG.LIST);
    expect(renderedResult).toBe("[0, 2j, 2j]");
  });

  it("rewrites closure parent env after collect", async () => {
    const pythonCode = `lambda x: x + 1`;

    const forceCollectAfterClosureCreate = insertInArray(
      node => isFunctionCall(node, GET_LAST_EXPR_RESULT_FX) && node.arguments,
      instruction => isFunctionCall(instruction, MAKE_CLOSURE_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
    );

    const { rawOutputs, rawResult } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectAfterClosureCreate],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(TYPE_TAG.CLOSURE);
    expect(rawOutputs[1][0]).toBe(TYPE_TAG.CLOSURE);

    const beforeMeta = rawOutputs[0][1] & 0xffffffff00000000n;
    const afterMeta = rawOutputs[1][1] & 0xffffffff00000000n;
    const beforeParent = Number(rawOutputs[0][1] & 0xffffffffn);
    const afterParent = Number(rawOutputs[1][1] & 0xffffffffn);

    expect(afterMeta).toBe(beforeMeta);
    expect(beforeParent).not.toBe(afterParent);
    expect(afterParent).toBeGreaterThan(beforeParent);
    expect(rawResult[0]).toBe(TYPE_TAG.CLOSURE);
  });

  it("does not move data-section string payload during collect", async () => {
    const pythonCode = `"hello"`;

    const forceCollectAfterLiteral = insertInArray(
      node => isFunctionCall(node, GET_LAST_EXPR_RESULT_FX) && node.arguments,
      instruction => isFunctionCall(instruction, MAKE_STRING_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
    );

    const { rawOutputs, rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectAfterLiteral],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(TYPE_TAG.STRING);
    expect(rawOutputs[1][0]).toBe(TYPE_TAG.STRING);
    expect(rawOutputs[1][1]).toBe(rawOutputs[0][1]);
    expect(rawResult[0]).toBe(TYPE_TAG.STRING);
    expect(renderedResult).toBe("hello");
  });

  it("rewrites closure parent env after collect for function declaration closure", async () => {
    const pythonCode = `
def inc(x):
    return x + 1
inc
`;

    const forceCollectAfterFunctionValueRead = insertInArray(
      node => isFunctionCall(node, GET_LAST_EXPR_RESULT_FX) && node.arguments,
      instruction => isFunctionCall(instruction, GET_LEX_ADDR_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
    );

    const { rawOutputs, rawResult } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [forceCollectAfterFunctionValueRead],
    });

    expect(rawOutputs).toHaveLength(2);
    expect(rawOutputs[0][0]).toBe(TYPE_TAG.CLOSURE);
    expect(rawOutputs[1][0]).toBe(TYPE_TAG.CLOSURE);

    const beforeMeta = rawOutputs[0][1] & 0xffffffff00000000n;
    const afterMeta = rawOutputs[1][1] & 0xffffffff00000000n;
    const beforeParent = Number(rawOutputs[0][1] & 0xffffffffn);
    const afterParent = Number(rawOutputs[1][1] & 0xffffffffn);

    expect(afterMeta).toBe(beforeMeta);
    expect(beforeParent).not.toBe(afterParent);
    expect(afterParent).toBeGreaterThan(beforeParent);
    expect(rawResult[0]).toBe(TYPE_TAG.CLOSURE);
  });

  it("nested lists survive collect after outer list creation (testing recursive copy)", async () => {
    const pythonCode = `[[1, 2], [3, 4]]`;

    const collectAfterOuterCreation = insertInArray(
      node => isFunctionCall(node, GET_LAST_EXPR_RESULT_FX) && node.arguments,
      instruction => isFunctionCall(instruction, MAKE_LIST_FX),
      [topOfShadowStack, wasm.call(COLLECT_FX), topOfShadowStack],
    );

    const {
      rawOutputs,
      rawResult,
      renderedResult,
      debugFunctions: { getListElement },
    } = await compileToWasmAndRun(pythonCode, true, {
      irPasses: [collectAfterOuterCreation],
    });

    const beforeOuterValue = rawOutputs[0];
    const afterOuterValue = rawOutputs[1];

    expect(rawResult[0]).toBe(TYPE_TAG.LIST);
    expect(renderedResult).toBe("[[1, 2], [3, 4]]");

    expect(rawOutputs).toHaveLength(2);
    expect(beforeOuterValue[0]).toBe(TYPE_TAG.LIST);
    expect(afterOuterValue[0]).toBe(TYPE_TAG.LIST);

    // Verify outer list pointer is different after collect
    expect(afterOuterValue[1] >> 32n).toBeGreaterThan(beforeOuterValue[1] >> 32n);

    const beforeInner1 = getListElement(TYPE_TAG.LIST, beforeOuterValue[1], 0);
    const beforeInner2 = getListElement(TYPE_TAG.LIST, beforeOuterValue[1], 1);

    const afterInner1 = getListElement(TYPE_TAG.LIST, afterOuterValue[1], 0);
    const afterInner2 = getListElement(TYPE_TAG.LIST, afterOuterValue[1], 1);

    // Verify inner values are still lists (after, not before: forwarding metadata)
    expect(afterInner1[0]).toBe(TYPE_TAG.LIST);
    expect(afterInner2[0]).toBe(TYPE_TAG.LIST);

    // Verify inner list pointers are different after collect
    expect(afterInner1[1] >> 32n).toBeGreaterThan(beforeInner1[1] >> 32n);
    expect(afterInner2[1] >> 32n).toBeGreaterThan(beforeInner2[1] >> 32n);
  });

  it("fib(30) with GC should work", async () => {
    const pythonCode = `
def fib(n):
    if n <= 1:
        return n
    else:
        return fib(n-1) + fib(n-2)
fib(30)
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true);
    expect(rawResult[0]).toBe(TYPE_TAG.INT);
    expect(rawResult[1]).toBe(832040n);
    expect(renderedResult).toBe("832040");
  });

  it("fib(30) without GC should OOM", async () => {
    const pythonCode = `
def fib(n):
    if n <= 1:
        return n
    else:
        return fib(n-1) + fib(n-2)
fib(30)
`;
    await expect(compileToWasmAndRun(pythonCode, false, { disableGC: true })).rejects.toThrow(
      new Error(ERROR_MAP.OUT_OF_MEMORY),
    );
  });

  it("native reverse(50) with GC should work", async () => {
    const pythonCode = `
def append(xs, ys):
    if is_none(xs):
        return ys
    return pair(head(xs), append(tail(xs), ys))


def reverse(xs):
    if is_none(xs):
        return None
    return append(reverse(tail(xs)), pair(head(xs), None))

reverse(linked_list(${[...Array(50).keys()].join(", ")}))
`;
    const { rawResult, renderedResult } = await compileToWasmAndRun(pythonCode, true, {
      groups: [linkedList],
    });
    expect(rawResult[0]).toBe(TYPE_TAG.LIST);

    const frontPart = [...Array(50).keys()].map(i => `[${49 - i}`).join(", ");
    expect(renderedResult).toBe(`${frontPart}, None${"]".repeat(50)}`);
  });

  it("native reverse(50) without GC should OOM", async () => {
    const pythonCode = `
def append(xs, ys):
    if is_none(xs):
        return ys
    return pair(head(xs), append(tail(xs), ys))

def reverse(xs):
    if is_none(xs):
        return None
    return append(reverse(tail(xs)), pair(head(xs), None))

reverse(linked_list(${[...Array(50).keys()].join(", ")}))
`;
    await expect(
      compileToWasmAndRun(pythonCode, false, { disableGC: true, groups: [linkedList] }),
    ).rejects.toThrow(new Error(ERROR_MAP.OUT_OF_MEMORY));
  });
});
