import { i32, wasm } from "@sourceacademy/wasm-util";
import { compileToWasmAndRun } from "../../engines/wasm";
import { insertInArray, isFunctionCall, isFunctionOfName } from "../../engines/wasm/irHelpers";
import {
  APPLY_FX_NAME,
  ERROR_MAP,
  MAKE_LIST_FX,
  PEEK_SHADOW_STACK_FX,
  SET_CONTIGUOUS_BLOCK_FX,
  SHADOW_STACK_TAG,
  SILENT_PUSH_SHADOW_STACK_FX,
  TYPE_TAG,
} from "../../engines/wasm/runtime";
import { CompileOptions } from "../../engines/wasm/types";
import linkedList from "../../stdlib/linked-list";
import list from "../../stdlib/list";
import pairMutator from "../../stdlib/pairmutator";
import mce from "../../stdlib/parser";

it = it.concurrent;

describe("Shadow stack manipulation tests", () => {
  const expectShadowStackToEqual = async (
    pythonCode: string,
    expectedTags: number[],
    compileOptions: CompileOptions = {},
    interactiveMode: boolean = true,
  ) => {
    const results = interactiveMode
      ? await compileToWasmAndRun(pythonCode, true, {
          ...compileOptions,
          groups: [linkedList, pairMutator, list, mce],
        })
      : await compileToWasmAndRun(pythonCode, false, {
          ...compileOptions,
          groups: [linkedList, pairMutator, list, mce],
        });

    // Check each frame's tag on the stack
    expectedTags.forEach((expectedTag, index) =>
      expect(results.debugFunctions.peekShadowStack(index)[0]).toBe(expectedTag),
    );

    // Verify accessing one position past the stack throws STACK_UNDERFLOW
    expect(() => results.debugFunctions.peekShadowStack(expectedTags.length)).toThrow(
      new Error(ERROR_MAP.STACK_UNDERFLOW),
    );

    return results;
  };

  describe("simple expression statement cleanup (non-interactive)", () => {
    it("last simple expression statement with list literal leaves stack clean", async () => {
      const pythonCode = `[1, 2, 3]`;
      await expectShadowStackToEqual(pythonCode, [], {}, false);
    });

    it("last simple expression statement with GCable variable access leaves stack clean", async () => {
      const pythonCode = `
x = [1, 2, 3]
x
`;
      await expectShadowStackToEqual(pythonCode, [], {}, false);
    });

    it("multiple simple expression statements with GCable finals leave stack clean", async () => {
      const pythonCode = `
1
"hello"
[1, 2, 3]
`;
      await expectShadowStackToEqual(pythonCode, [], {}, false);
    });
  });

  describe("simple expression statement cleanup (interactive)", () => {
    it("keeps only the final GCable expression on stack", async () => {
      const pythonCode = `
[1]
"hello"
[2, 3]
`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("keeps stack clean when final expression is non-GCable", async () => {
      const pythonCode = `
[1, 2]
"hello"
42
`;
      await expectShadowStackToEqual(pythonCode, []);
    });
  });

  describe("MAKE_* tests", () => {
    it("MAKE_STRING pushes returned string to stack top", async () => {
      await expectShadowStackToEqual(`"hello"`, [TYPE_TAG.STRING]);
    });

    it("MAKE_COMPLEX pushes returned complex to stack top", async () => {
      await expectShadowStackToEqual(`2j`, [TYPE_TAG.COMPLEX]);
    });

    it("MAKE_CLOSURE pushes returned closure to stack top", async () => {
      await expectShadowStackToEqual(`lambda x: x + 1`, [TYPE_TAG.CLOSURE]);
    });

    it("MAKE_LIST pushes returned list to stack top", async () => {
      await expectShadowStackToEqual(`[1, 2, 3]`, [TYPE_TAG.LIST]);
    });

    it("MAKE_PAIR pushes returned pair to stack top", async () => {
      await expectShadowStackToEqual(`pair(1, 2)`, [TYPE_TAG.LIST]);
    });

    it("adding non-complex with complex pushes result to stack top", async () => {
      await expectShadowStackToEqual(`3 + 2j`, [TYPE_TAG.COMPLEX]);
    });
  });

  describe("binary operator tests", () => {
    it("adding two complexes pushes result to stack top", async () => {
      await expectShadowStackToEqual(`2j + 3j`, [TYPE_TAG.COMPLEX]);
    });

    it("concatenating two strings pushes result to stack top", async () => {
      await expectShadowStackToEqual(`"foo" + "bar"`, [TYPE_TAG.STRING]);
    });
  });

  describe("GET/SET_LEX_ADDRESS", () => {
    it("setting variable to GCable object should pop GCable object off stack", async () => {
      const pythonCode = `x = [1, 2, 3]`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("getting GCable variable should push variable's value onto stack", async () => {
      const pythonCode = `
x = [1, 2, 3]
x
`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("getting non-GCable variable should push not push anything onto stack", async () => {
      const pythonCode = `
x = 42
x
`;
      await expectShadowStackToEqual(pythonCode, []);
    });
  });

  describe("list-related tests", () => {
    it("LIST_STATE tracks stable pointer and total length during list construction", async () => {
      const pythonCode = `[1, 2, 3]`;

      const log = wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0)));

      const afterListStatePush = insertInArray(
        node => isFunctionCall(node, MAKE_LIST_FX) && node.arguments,
        instruction => isFunctionCall(instruction, SILENT_PUSH_SHADOW_STACK_FX),
        [log],
      );
      const afterSet0 = insertInArray(
        node => isFunctionCall(node, MAKE_LIST_FX) && node.arguments,
        instruction => isFunctionCall(instruction, SET_CONTIGUOUS_BLOCK_FX),
        [log],
        { matchIndex: 0 },
      );
      const afterSet1 = insertInArray(
        node => isFunctionCall(node, MAKE_LIST_FX) && node.arguments,
        instruction => isFunctionCall(instruction, SET_CONTIGUOUS_BLOCK_FX),
        [log],
        { matchIndex: 1 },
      );
      const afterSet2 = insertInArray(
        node => isFunctionCall(node, MAKE_LIST_FX) && node.arguments,
        instruction => isFunctionCall(instruction, SET_CONTIGUOUS_BLOCK_FX),
        [log],
        { matchIndex: 2 },
      );

      const { rawOutputs, rawResult } = await expectShadowStackToEqual(
        pythonCode,
        [TYPE_TAG.LIST],
        { irPasses: [afterListStatePush, afterSet0, afterSet1, afterSet2] },
      );

      expect(rawOutputs).toHaveLength(4);
      rawOutputs.forEach(([tag]) => expect(tag).toBe(SHADOW_STACK_TAG.LIST_STATE));

      rawOutputs.forEach(([, val]) => {
        const pointer = (val >> 32n) & 0xffffffffn;
        const length = Number(val & 0xffffffffn);

        expect(pointer).toBe(rawResult![1] >> 32n);
        expect(length).toBe(3);
      });
    });

    it("while creating list, list pointer should be on stack until SET_CONTIGUOUS", async () => {
      const pythonCode = `[1, 2, 3]`;

      const irPass = insertInArray(
        node => isFunctionCall(node, MAKE_LIST_FX) && node.arguments,
        instruction => isFunctionCall(instruction, SILENT_PUSH_SHADOW_STACK_FX),
        [wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0)))],
      );

      const { rawOutputs } = await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST], {
        irPasses: [irPass],
      });

      expect(rawOutputs[0][0]).toBe(SHADOW_STACK_TAG.LIST_STATE);
    });

    it("GCable element in list should NOT be on stack (already popped by SET_CONTIGUOUS)", async () => {
      const pythonCode = `[1, 2, [3, 4]]`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("accessing list element that is not GCable should not push anything onto stack", async () => {
      const pythonCode = `x = [10, 20, 30]
x[1]
`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("accessing list element that is GCable should push element onto stack", async () => {
      const pythonCode = `
x = [10, [1, 2], 30]
x[1]
`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("accessing list element that is GCable should push element onto stack (direct access)", async () => {
      const pythonCode = `[10, [1, 2], 30][1]`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("setting list element should not push anything onto stack", async () => {
      const pythonCode = `
x = [10, 20, 30]
x[1] = 25
`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("setting list element that is GCable (list) should not push anything onto stack", async () => {
      const pythonCode = `
x = [10, 20, 30]
x[1] = [3, 4]
`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("setting list element that is GCable (string) should not push anything onto stack", async () => {
      const pythonCode = `
x = [10, 20, 30]
x[1] = "hello"
`;
      await expectShadowStackToEqual(pythonCode, []);
    });
  });

  describe("closure-related tests", () => {
    it("while calling function: before PRE_APPLY, return address should be on stack", async () => {
      const pythonCode = `
def f(x):
    return x + 1
f(10)
`;

      const irPass = insertInArray(
        node => isFunctionCall(node, APPLY_FX_NAME) && node.arguments,
        instruction => isFunctionCall(instruction, SILENT_PUSH_SHADOW_STACK_FX),
        [wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0)))],
      );

      const { rawOutputs } = await expectShadowStackToEqual(pythonCode, [], {
        irPasses: [irPass],
      });

      expect(rawOutputs[0][0]).toBe(SHADOW_STACK_TAG.CALL_RETURN_ADDR);
    });

    it("while calling function: after PRE_APPLY, return address + callee value should be on stack", async () => {
      const pythonCode = `
def f(x):
    return x + 1
f(10)
`;

      const irPass = insertInArray(
        node => {
          const secondPush =
            isFunctionCall(node, APPLY_FX_NAME) &&
            node.arguments &&
            node.arguments.filter(arg => isFunctionCall(arg, SILENT_PUSH_SHADOW_STACK_FX))[1];

          return secondPush && secondPush.arguments;
        },
        instruction =>
          instruction != null &&
          typeof instruction === "object" &&
          "op" in instruction &&
          instruction.op === "i64.shl",
        [
          wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0))),
          wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(1))),
        ],
      );

      const { rawOutputs } = await expectShadowStackToEqual(pythonCode, [], {
        irPasses: [irPass],
      });

      expect(rawOutputs[0][0]).toBe(TYPE_TAG.CLOSURE);
      expect(rawOutputs[1][0]).toBe(SHADOW_STACK_TAG.CALL_RETURN_ADDR);
    });

    it("while calling function: before SET_CONTIGUOUS_BLOCK, return address + callee value + new env pointer should be on stack", async () => {
      const pythonCode = `
def f(x):
    return x + 1
f(10)
`;

      const irPass = insertInArray(
        node => isFunctionCall(node, APPLY_FX_NAME) && node.arguments,
        instruction => isFunctionCall(instruction, SILENT_PUSH_SHADOW_STACK_FX),
        [
          wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0))),
          wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(1))),
          wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(2))),
        ],
        { matchIndex: 1 },
      );

      const { rawOutputs } = await expectShadowStackToEqual(pythonCode, [], {
        irPasses: [irPass],
      });

      expect(rawOutputs[0][0]).toBe(SHADOW_STACK_TAG.CALL_NEW_ENV);
      expect(rawOutputs[1][0]).toBe(TYPE_TAG.CLOSURE);
      expect(rawOutputs[2][0]).toBe(SHADOW_STACK_TAG.CALL_RETURN_ADDR);
    });

    it("CALL_NEW_ENV tracks stable pointer during call setup", async () => {
      const pythonCode = `
def f(a, b, c):
    return a
f(10, 20, 30)
`;

      const log = wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0)));

      const afterCallStatePush = insertInArray(
        node => isFunctionCall(node, APPLY_FX_NAME) && node.arguments,
        instruction => isFunctionCall(instruction, SILENT_PUSH_SHADOW_STACK_FX),
        [log],
        { matchIndex: 1 },
      );
      const afterSet0 = insertInArray(
        node => isFunctionCall(node, APPLY_FX_NAME) && node.arguments,
        instruction => isFunctionCall(instruction, SET_CONTIGUOUS_BLOCK_FX),
        [log],
        { matchIndex: 0 },
      );
      const afterSet1 = insertInArray(
        node => isFunctionCall(node, APPLY_FX_NAME) && node.arguments,
        instruction => isFunctionCall(instruction, SET_CONTIGUOUS_BLOCK_FX),
        [log],
        { matchIndex: 1 },
      );
      const afterSet2 = insertInArray(
        node => isFunctionCall(node, APPLY_FX_NAME) && node.arguments,
        instruction => isFunctionCall(instruction, SET_CONTIGUOUS_BLOCK_FX),
        [log],
        { matchIndex: 2 },
      );

      const { rawOutputs } = await expectShadowStackToEqual(pythonCode, [], {
        irPasses: [afterCallStatePush, afterSet0, afterSet1, afterSet2],
      });

      expect(rawOutputs).toHaveLength(4);
      rawOutputs.forEach(([tag]) => expect(tag).toBe(SHADOW_STACK_TAG.CALL_NEW_ENV));

      const basePointer = (rawOutputs[0][1] >> 32n) & 0xffffffffn;

      rawOutputs.forEach(([, val]) => {
        const pointer = (val >> 32n) & 0xffffffffn;
        expect(pointer).toBe(basePointer);
      });
    });

    it("function definition should NOT push closure to stack", async () => {
      const pythonCode = `
def f(x):
    return x + 1
`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("function value should push closure to stack", async () => {
      const pythonCode = `
def f(x):
    return x + 1
f
`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.CLOSURE]);
    });

    it("creating lambda should push closure to stack", async () => {
      const pythonCode = `lambda x: x + 1`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.CLOSURE]);
    });

    it("calling non-GCable-producing function should not push anything onto stack", async () => {
      const pythonCode = `
def f(x):
    return x + 1
f(10)
`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("calling function that returns GCable should push returned GCable onto stack", async () => {
      const pythonCode = `
def f(x):
    return [x]
f(10)
`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("GCable argument should NOT be on stack (already popped by SET_CONTIGUOUS)", async () => {
      const pythonCode = `
def f(x):
    return
f([1, 2])
`;

      await expectShadowStackToEqual(pythonCode, []);
    });
  });

  describe("APPLY function special handling tests", () => {
    it("before any MALLOC in APPLY, stack should only contain return address", async () => {
      const pythonCode = `
def f(x):
    return x + 1
f(10)
`;

      const irPass = insertInArray(
        node => isFunctionOfName(node, APPLY_FX_NAME) && node.body,
        instruction =>
          instruction != null &&
          typeof instruction === "object" &&
          "op" in instruction &&
          instruction.op === "local.set",
        [wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0)))],
        { before: true },
      );

      const { rawOutputs } = await expectShadowStackToEqual(pythonCode, [], {
        irPasses: [irPass],
      });

      expect(rawOutputs[0][0]).toBe(SHADOW_STACK_TAG.CALL_RETURN_ADDR);
    });

    it("before any MALLOC in APPLY for varargs, stack should only contain return address", async () => {
      const pythonCode = `
def f(*x):
    return x[0]
f(10, 20)
    `;

      const irPass = insertInArray(
        node => isFunctionOfName(node, APPLY_FX_NAME) && node.body,
        instruction =>
          instruction != null &&
          typeof instruction === "object" &&
          "op" in instruction &&
          instruction.op === "if",
        [wasm.call("$_log_raw").args(wasm.call(PEEK_SHADOW_STACK_FX).args(i32.const(0)))],
        { matchIndex: 1, before: true },
      );

      const { rawOutputs } = await expectShadowStackToEqual(pythonCode, [], {
        irPasses: [irPass],
      });

      expect(rawOutputs[0][0]).toBe(SHADOW_STACK_TAG.CALL_RETURN_ADDR);
    });
  });

  describe("library function tests", () => {
    it("pair function with non-GCable arguments should push resultant list onto stack", async () => {
      const pythonCode = `pair(1, 2)`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("pair function with one GCable argument should push resultant list onto stack", async () => {
      const pythonCode = `pair(1, "test")`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("pair function with two GCable arguments should push resultant list onto stack", async () => {
      const pythonCode = `pair([1, 2], [3, 4])`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("nested pair should push resultant list onto stack (only one)", async () => {
      const pythonCode = `pair(1, pair(2, None))`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("is_pair function should leave stack clean (not push result onto stack)", async () => {
      const pythonCode = `is_pair(pair(1, 2))`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("head function should NOT push result onto stack if it's not GCable", async () => {
      const pythonCode = `head(pair(1, 2))`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("head function should push result onto stack if it's GCable", async () => {
      const pythonCode = `head(pair([1, 2], 3))`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("tail function should NOT push result onto stack if it's not GCable", async () => {
      const pythonCode = `tail(pair(1, 2))`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("tail function should push result onto stack if it's GCable", async () => {
      const pythonCode = `tail(pair(3, [1, 2]))`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("linked_list function should push resultant list onto stack", async () => {
      const pythonCode = `linked_list(1, 2, 3)`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("is_linked_list function should leave stack clean (not push result onto stack)", async () => {
      const pythonCode = `is_linked_list(linked_list(1, 2, 3))`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("set_head function should NOT push anything onto stack if new head is not GCable", async () => {
      const pythonCode = `
x = pair(1, 2)
set_head(x, 3)
`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("set_head function should NOT push new head onto stack if it's GCable", async () => {
      const pythonCode = `
x = pair(1, 2)
set_head(x, [3, 4])
`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("set_tail function should NOT push anything onto stack if new tail is not GCable", async () => {
      const pythonCode = `
x = pair(1, 2)
set_tail(x, 3)
`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("set_tail function should NOT push new tail onto stack if it's GCable", async () => {
      const pythonCode = `
x = pair(1, 2)
set_tail(x, [3, 4])
`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("list_length function should leave stack clean (not push result onto stack)", async () => {
      const pythonCode = `list_length([1, 2, 3])`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("is_list function should leave stack clean (not push result onto stack)", async () => {
      const pythonCode = `is_list([1, 2, 3])`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("bool function should leave stack clean (not push result onto stack)", async () => {
      const pythonCode = `bool([1, 2, 3])`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("is_none function with GC argument should leave stack clean (not push result onto stack)", async () => {
      const pythonCode = `is_none([1, 2, 3])`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("is_none function with non-GC argument should leave stack clean (not push result onto stack)", async () => {
      const pythonCode = `is_none(42)`;
      await expectShadowStackToEqual(pythonCode, []);
    });

    it("tokenize function should push resultant list onto stack", async () => {
      const pythonCode = `tokenize("1 + 2")`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("parse function should push resultant list onto stack", async () => {
      const pythonCode = `parse("1 + 2")`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });

    it("more complex parse should push resultant list onto stack", async () => {
      const pythonCode = `parse("def f():\\n    nonlocal x\\n    x = 5\\n    return x")`;
      await expectShadowStackToEqual(pythonCode, [TYPE_TAG.LIST]);
    });
  });
});
