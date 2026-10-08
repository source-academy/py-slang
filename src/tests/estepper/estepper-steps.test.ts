/**
 * The e-stepper's steps (py-slang#508): explanations, the store shown at each step, and the
 * consistency of the protocol data the web plugin draws.
 */
import type {
  EStepperStep,
  EStepperValue,
  SerializedStepperNode,
} from "@sourceacademy/common-e-stepper";

import { NO_INPUT_MESSAGE } from "../../conductor/estepper/engine";
import { EStepperProgramError, runEStepper } from "../../conductor/estepper/getSteps";
import { parse } from "../../parser";

const run = (code: string, chapter = 3, stepLimit?: number) =>
  runEStepper(parse(code), code, chapter, stepLimit);

/** The explanations of the start step, every after step and the final step. */
const story = (steps: EStepperStep[]): string[] =>
  steps
    .filter(s => s.markers?.[0]?.redexType !== "beforeMarker")
    .map(s => s.markers?.[0]?.explanation ?? "");

const show = (v: EStepperValue): string =>
  v.kind === "primitive"
    ? v.display
    : v.kind === "ref"
      ? v.objectId
      : v.kind === "builtin"
        ? v.name
        : "-";

/** A compact view of the frames: `E1(g): balance=100 withdraw=#2`. */
const frames = (step: EStepperStep): string[] =>
  step.frames.map(
    f =>
      `${f.id}${f.isGarbage ? "(g)" : ""}${f.parentId ? `<${f.parentId}` : ""}: ${f.bindings
        .map(b => `${b.name}=${show(b.value)}`)
        .join(" ")}`,
  );

const MAKE_WITHDRAW = `def make_withdraw(balance):
    def withdraw(amount):
        nonlocal balance
        if balance >= amount:
            balance = balance - amount
            return balance
        else:
            return 'Insufficient funds'
    return withdraw

W1 = make_withdraw(100)
W1(50)
`;

describe("make_withdraw (SICPy 3.1.1)", () => {
  test("the explanations tell the environment-model story", async () => {
    const { steps, output, error } = await run(MAKE_WITHDRAW);
    expect(error).toBeUndefined();
    expect(output).toBe("");
    expect(story(steps)).toEqual([
      "Start of evaluation",
      "Defined make_withdraw: function object #1 in the global frame",
      "Called make_withdraw(100): new frame E1 extends the global frame (make_withdraw is function object #1 in Global)",
      "Defined withdraw: function object #2 in frame E1",
      "Returned withdraw from E1 (withdraw is function object #2 in E1)",
      "Assigned W1 = withdraw in the global frame",
      "Called withdraw(50): new frame E2 extends E1 (W1 is function object #2 in Global)",
      "Evaluated nonlocal declaration: balance refers to an enclosing frame",
      "Evaluated balance >= amount: True (balance is 100 in E1, amount is 50 in E2)",
      "Evaluated if statement: condition is True",
      "Evaluated balance - amount: 50 (balance is 100 in E1, amount is 50 in E2)",
      "Assigned balance = 50 in frame E1",
      "Returned 50 from E2 (balance is 50 in E1)",
      "Finished the expression statement: its value 50 is not used",
      "Evaluation complete",
    ]);
  });

  test("the store: E1 outlives its call, E2 becomes garbage", async () => {
    const { steps } = await run(MAKE_WITHDRAW);
    const last = steps[steps.length - 1];
    expect(frames(last)).toEqual([
      "Global: make_withdraw=#1 W1=#2",
      "E1<Global: balance=50 withdraw=#2",
      "E2(g)<E1: amount=50",
    ]);
    expect(last.heap).toEqual([
      expect.objectContaining({
        kind: "function",
        id: "#1",
        name: "make_withdraw",
        envId: "Global",
      }),
      expect.objectContaining({
        kind: "function",
        id: "#2",
        name: "withdraw",
        envId: "E1",
        params: ["amount"],
      }),
    ]);
    expect(last.heap[1]).toMatchObject({
      source: expect.stringContaining("def withdraw(amount):"),
    });
  });

  test("the function body under evaluation is an EnvBlock in its frame, and that frame is active", async () => {
    const { steps } = await run(MAKE_WITHDRAW);
    const inCall = steps.find(s => s.activeFrameId === "E2")!;
    const blocks: SerializedStepperNode[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) node.forEach(walk);
      else if (node && typeof node === "object") {
        if ((node as SerializedStepperNode).type === "EnvBlock")
          blocks.push(node as SerializedStepperNode);
        Object.values(node).forEach(walk);
      }
    };
    walk(inCall.ast);
    expect(blocks.map(b => b.envId)).toEqual(["E2"]);
  });
});

describe("lookups", () => {
  test("bindings read by a step are reported for highlighting", async () => {
    const { steps } = await run(`x = 1\ny = x + 2\n`);
    const add = steps.find(s => s.markers?.[0]?.explanation === "Evaluating x + 2")!;
    expect(add.lookups).toEqual([{ frameId: "Global", name: "x" }]);
  });

  test("a name is looked up in its own step when a later operand could change it", async () => {
    const { steps } = await run(`x = 1
def bump():
    global x
    x = x + 10
    return 0
print(x + bump())
`);
    expect(story(steps)).toContain("Looked up x: 1");
    // ... and the addition uses the value read before the call, as Python does.
    expect(
      (
        await run(
          `x = 1\ndef bump():\n    global x\n    x = x + 10\n    return 0\nprint(x + bump())\n`,
        )
      ).output,
    ).toBe("1\n");
  });

  test("builtins need no lookup step", async () => {
    const { steps } = await run(`def f(x):\n    return x\nprint(f(1))\n`);
    expect(story(steps).some(s => s.startsWith("Looked up print"))).toBe(false);
  });
});

describe("loops", () => {
  test("a for loop assigns its target at the start of each iteration", async () => {
    const { steps, output } = await run(`for i in range(2):\n    print(i)\n`);
    expect(output).toBe("0\n1\n");
    expect(story(steps)).toEqual([
      "Start of evaluation",
      "Evaluated range: from 0 to 2 in steps of 1",
      "Evaluated for statement: run the body with i = 0",
      "Assigned i = 0 in the global frame",
      "Ran print(0) (i is 0 in Global)",
      "Finished the loop body, back to the loop",
      "Evaluated for statement: run the body with i = 1",
      "Assigned i = 1 in the global frame",
      "Ran print(1) (i is 1 in Global)",
      "Finished the loop body, back to the loop",
      "Evaluated for statement: 2 is not in the range, the loop ends",
      "Evaluation complete",
    ]);
  });

  test("break ends the loop, continue starts the next iteration", async () => {
    const { steps } = await run(`while True:\n    break\nfor i in range(1):\n    continue\n`);
    expect(story(steps)).toContain("Evaluated break: the loop ends");
    expect(story(steps)).toContain("Evaluated continue: back to the loop");
  });
});

describe("the heap", () => {
  test("lists are heap objects that the program and frames refer to", async () => {
    const { steps } = await run(`xs = [1, 2]\nys = xs\nys[0] = 10\n`);
    const last = steps[steps.length - 1];
    expect(frames(last)).toEqual(["Global: xs=#1 ys=#1"]);
    expect(last.heap).toEqual([
      {
        kind: "list",
        id: "#1",
        isGarbage: false,
        elements: [
          { kind: "primitive", display: "10", label: "int" },
          { kind: "primitive", display: "2", label: "int" },
        ],
      },
    ]);
  });

  test("library functions are applied in one step and shown by name", async () => {
    const { steps, output } = await run(`print(map(lambda x: x + 1, llist(1, 2)))\n`);
    expect(output).toBe("[2, [3, None]]\n");
    expect(story(steps)).toContain("Ran map(#1, #2)");
    // map's own frames are library internals and never drawn.
    expect(steps.every(s => s.frames.every(f => f.name !== "map" && f.name !== "_map"))).toBe(true);
  });
});

describe("protocol consistency", () => {
  const PROGRAMS = [
    MAKE_WITHDRAW,
    `def f(xs):\n    xs[0] = pair(1, None)\n    return lambda: xs\nys = [0]\ng = f(ys)\nprint(g()[0])\n`,
    `s = stream(1, 2)\nprint(stream_tail(s))\n`,
  ];

  test.each(PROGRAMS)("every frame and object referred to is shown: %#", async code => {
    const { steps } = await run(code);
    for (const step of steps) {
      const frameIds = new Set(step.frames.map(f => f.id));
      const objectIds = new Set(step.heap.map(o => o.id));
      expect(frameIds.has(step.activeFrameId)).toBe(true);
      for (const f of step.frames) if (f.parentId) expect(frameIds.has(f.parentId)).toBe(true);
      const values: EStepperValue[] = [
        ...step.frames.flatMap(f => f.bindings.map(b => b.value)),
        ...step.heap.flatMap(o => (o.kind === "list" ? o.elements : [])),
      ];
      for (const v of values) if (v.kind === "ref") expect(objectIds.has(v.objectId)).toBe(true);
      for (const o of step.heap)
        if (o.kind === "function") expect(frameIds.has(o.envId)).toBe(true);
      const walk = (node: unknown): void => {
        if (Array.isArray(node)) node.forEach(walk);
        else if (node && typeof node === "object") {
          const n = node as SerializedStepperNode;
          if (n.type === "EnvBlock") expect(frameIds.has(n.envId as string)).toBe(true);
          if (n.type === "Ref") expect(objectIds.has(n.objectId as string)).toBe(true);
          Object.values(node).forEach(walk);
        }
      };
      walk(step.ast);
      // Everything crosses the channel as plain JSON.
      expect(structuredClone(step)).toEqual(step);
    }
  });

  test("markers refer to nodes of their own step", async () => {
    const { steps } = await run(MAKE_WITHDRAW);
    for (const step of steps) {
      const ids = new Set<string>();
      const walk = (node: unknown): void => {
        if (Array.isArray(node)) node.forEach(walk);
        else if (node && typeof node === "object") {
          if (typeof (node as SerializedStepperNode).nodeId === "string")
            ids.add((node as SerializedStepperNode).nodeId);
          Object.values(node).forEach(walk);
        }
      };
      walk(step.ast);
      for (const m of step.markers ?? []) if (m.redexId) expect(ids.has(m.redexId)).toBe(true);
    }
  });
});

describe("input()", () => {
  const PROGRAM = `name = input("Name? ")\nage = input()\nprint(name, age)\n`;

  test("asks the host for each line, with its prompt", async () => {
    const prompts: (string | undefined)[] = [];
    const answers = ["Ada", "36"];
    const result = await runEStepper(parse(PROGRAM), PROGRAM, 3, undefined, prompt => {
      prompts.push(prompt);
      return Promise.resolve(answers.shift()!);
    });
    expect(result.error).toBeUndefined();
    expect(prompts).toEqual(["Name? ", undefined]);
    // As in CPython and the CSE machine, input(prompt) writes the prompt to the output.
    expect(result.output).toBe("Name? Ada 36\n");
  });

  test("without a host, input() stops evaluation instead of reading an empty line", async () => {
    const result = await run(PROGRAM);
    expect(result.error).toBe(NO_INPUT_MESSAGE);
    expect(result.output).toBe("Name? ");
  });
});

describe("limits and rejected programs", () => {
  test("the step limit stops a non-terminating program", async () => {
    const result = await run(`while True:\n    pass\n`, 3, 50);
    expect(result.truncated).toBe(true);
    expect(story(result.steps).at(-1)).toBe("Maximum number of steps exceeded");
  });

  test("a runtime error is the last explanation before 'Evaluation stuck'", async () => {
    const { steps, error } = await run(`print(1)\nprint(1 // 0)\n`);
    expect(error).toMatch(/^ZeroDivisionError/);
    expect(steps.at(-2)?.markers?.[0]?.explanation).toBe(error);
    expect(steps.at(-1)?.markers?.[0]?.explanation).toBe("Evaluation stuck");
    expect(steps.at(-1)?.output).toBe("1\n");
  });

  test("a program the CSE evaluator rejects is rejected before stepping", async () => {
    await expect(run(`print(undefined_name)\n`)).rejects.toBeInstanceOf(EStepperProgramError);
    // Python §3 only has for loops over range(...).
    await expect(run(`for x in [1, 2]:\n    pass\n`)).rejects.toBeInstanceOf(EStepperProgramError);
  });
});
