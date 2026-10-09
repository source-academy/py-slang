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
import { collectSnapshots } from "../../conductor/plugins/PyCseMachinePlugin";
import { Context } from "../../engines/cse/context";
import { Control } from "../../engines/cse/control";
import { Stash } from "../../engines/cse/stash";
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
      "Looked up make_withdraw in the global frame: function object #1",
      "Called make_withdraw(100): new frame E1 extends the global frame",
      "Defined withdraw: function object #2 in frame E1",
      "Looked up withdraw in frame E1: function object #2",
      "Returned withdraw from E1",
      "Assigned W1 = withdraw in the global frame",
      "Looked up W1 in the global frame: function object #2",
      "Called withdraw(50): new frame E2 extends E1, without a binding for nonlocal balance",
      "Looked up balance in frame E1: 100",
      "Looked up amount in frame E2: 50",
      "Evaluated 100 >= 50: True",
      "Evaluated if statement: condition is True",
      "Looked up balance in frame E1: 100",
      "Looked up amount in frame E2: 50",
      "Evaluated 100 - 50: 50",
      "Assigned balance = 50 in frame E1",
      "Looked up balance in frame E1: 50",
      "Returned 50 from E2",
      "Finished the expression statement: its value 50 is not used",
      "Evaluation complete",
    ]);
  });

  test("declarations are not evaluated, but stay in the program while its body runs", async () => {
    const { steps } = await run(MAKE_WITHDRAW);
    const inE2 = steps.filter(s => s.activeFrameId === "E2");
    expect(inE2.length).toBeGreaterThan(1);
    for (const step of inE2) expect(JSON.stringify(step.ast)).toContain("NonlocalStatement");
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

describe("negative values", () => {
  test("a negative number is shown as unary minus, so it keeps its parentheses as a receiver", async () => {
    const { steps } = await run("y = -1\nz = y[0]\n");
    const json = steps.map(st => JSON.stringify(st.ast));
    // Substituted for `y`, -1 is `-` applied to the literal 1, never a literal with raw "-1".
    expect(json.some(j => j.includes('"raw":"-1"'))).toBe(false);
    expect(
      json.some(j =>
        /"MemberExpression","nodeId":"[^"]*","object":\{"type":"UnaryExpression"/.test(j),
      ),
    ).toBe(true);
  });
});

describe("lookups", () => {
  test("every name is looked up in a step of its own, which reports the binding read", async () => {
    const { steps } = await run(`x = 1\ny = x + 2\n`);
    expect(story(steps)).toEqual([
      "Start of evaluation",
      "Assigned x = 1 in the global frame",
      "Looked up x in the global frame: 1",
      "Evaluated 1 + 2: 3",
      "Assigned y = 3 in the global frame",
      "Evaluation complete",
    ]);
    const lookup = steps.find(s => s.markers?.[0]?.explanation === "Looking up x")!;
    expect(lookup.lookups).toEqual([{ frameId: "Global", name: "x" }]);
  });

  test("names are looked up left to right, before a later operand could change them", async () => {
    const { steps, output } = await run(`x = 1
def bump():
    global x
    x = x + 10
    return 0
print(x + bump())
`);
    expect(output).toBe("1\n");
    const story_ = story(steps);
    expect(story_.indexOf("Looked up x in the global frame: 1")).toBeLessThan(
      story_.indexOf("Looked up bump in the global frame: function object #1"),
    );
  });

  test("the predicate of a while loop looks names up like any other expression", async () => {
    const { steps } = await run(`i = 0\nwhile i < 1:\n    i = i + 1\n`);
    expect(story(steps)).toContain("Looked up i in the global frame: 0");
    expect(story(steps)).toContain("Evaluated 0 < 1: True");
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
      "Looked up i in the global frame: 0",
      "Ran print(0)",
      "Finished the loop body, back to the loop",
      "Evaluated for statement: run the body with i = 1",
      "Assigned i = 1 in the global frame",
      "Looked up i in the global frame: 1",
      "Ran print(1)",
      "Finished the loop body, back to the loop",
      "Evaluated for statement: 2 is not in the range, the loop ends",
      "Evaluation complete",
    ]);
  });

  test("a while loop unfolds into an if statement whose body ends with the loop", async () => {
    const { steps, output } = await run(`i = 0\nwhile i < 2:\n    i = i + 1\nprint(i)\n`);
    expect(output).toBe("2\n");
    const iteration = [
      "Unfolded the while loop into an if statement whose body ends with the loop",
      "Looked up i in the global frame: N",
      "Evaluated N < 2: True",
      "Evaluated if statement: condition is True, run the loop body",
      "Looked up i in the global frame: N",
      "Evaluated N + 1: M",
      "Assigned i = M in the global frame",
      "Finished the loop body, back to the loop",
    ];
    const nth = (n: number) =>
      iteration.map(s => s.replace(/N/g, `${n}`).replace(/M/g, `${n + 1}`));
    expect(story(steps)).toEqual([
      "Start of evaluation",
      "Assigned i = 0 in the global frame",
      ...nth(0),
      ...nth(1),
      "Unfolded the while loop into an if statement whose body ends with the loop",
      "Looked up i in the global frame: 2",
      "Evaluated 2 < 2: False",
      "Evaluated if statement: condition is False, the loop ends",
      "Looked up i in the global frame: 2",
      "Ran print(2)",
      "Evaluation complete",
    ]);
    // While the test is evaluated, the loop is in the program in full, test included: in the if
    // statement's body, after the loop body.
    const testing = steps.find(s => s.markers?.[0]?.explanation === "Evaluated 0 < 2: True")!;
    const find = (node: unknown, type: string): SerializedStepperNode | undefined => {
      if (Array.isArray(node)) {
        for (const n of node) {
          const found = find(n, type);
          if (found) return found;
        }
      } else if (node && typeof node === "object") {
        if ((node as SerializedStepperNode).type === type) return node as SerializedStepperNode;
        for (const n of Object.values(node)) {
          const found = find(n, type);
          if (found) return found;
        }
      }
      return undefined;
    };
    const unfolded = find(testing.ast, "IfStatement")!;
    expect(find(unfolded.test, "Literal")).toMatchObject({ raw: "True" });
    const loop = find(unfolded.consequent, "WhileStatement")!;
    expect(loop.test).toMatchObject({
      type: "BinaryExpression",
      left: { type: "Identifier", name: "i" },
    });
  });

  test("a while loop's condition must be a bool, as in the CSE machine", async () => {
    const { error } = await run(`while 1:\n    break\n`);
    expect(error).toMatch(/TypeError/);
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

describe("the store as a CSE machine snapshot", () => {
  type CseStep = EStepperStep & {
    cse: {
      stepIndex: number;
      control: unknown[];
      stash: unknown[];
      environments: {
        name: string;
        isActive: boolean;
        bindings: { name: string; value: { displayValue: string } }[];
      }[];
    };
  };
  /** Frames by name, with their bindings, in a comparable form. */
  const framesOf = (environments: CseStep["cse"]["environments"]) =>
    environments
      .map(e => `${e.name}: ${e.bindings.map(b => `${b.name}=${b.value.displayValue}`).join(" ")}`)
      .sort();

  test("every step carries one", async () => {
    const steps = (await run(MAKE_WITHDRAW)).steps as CseStep[];
    steps.forEach((step, i) => expect(step.cse.stepIndex).toBe(i));
    // Inside the call of withdraw, its frame is the active one, as in the CSE machine.
    const inCall = steps.find(s => s.activeFrameId === "E2")!;
    expect(inCall.cse.environments.find(e => e.isActive)?.name).toBe("withdraw");
  });

  type Roots = {
    control: { displayText: string; metadata: { envId: string } }[];
    stash: { displayValue: string; metadata?: { closureFrameId?: string } }[];
  };
  const roots = (step: EStepperStep) => step.cse as unknown as Roots;

  test("its control holds a frame for each function body under evaluation", async () => {
    const program = `def g(x):\n    return x + 1\ndef f(y):\n    return g(y) * 2\nf(1)\n`;
    const { steps } = await run(program);
    // While g runs inside f's body, f's frame (E1) is waiting for g's result: not the active
    // frame, but still in use, as an ENVIRONMENT instruction would keep it in the CSE machine.
    const inG = steps.find(s => s.activeFrameId === "E2")!;
    expect(
      roots(inG)
        .control.map(c => c.metadata.envId)
        .sort(),
    ).toEqual(["E1", "E2"]);
    expect(roots(inG).control.every(c => c.displayText === "ENVIRONMENT")).toBe(true);
    // After both calls, nothing is under evaluation.
    expect(roots(steps[steps.length - 1]).control).toEqual([]);
  });

  test("its stash holds the values in the program, e.g. a function just returned", async () => {
    const program = `def make_adder(n):\n    return lambda x: x + n\nprint(make_adder(3)(4))\n`;
    const { steps } = await run(program);
    // Once make_adder has returned, its frame (E1) is kept alive only by the returned function,
    // which is in the program, waiting to be called: on the stash, pointing to E1.
    const returned = steps.find(
      s =>
        roots(s).stash.some(v => v.metadata?.closureFrameId === "E1") &&
        !roots(s).control.some(c => c.metadata.envId === "E1"),
    );
    expect(returned).toBeDefined();
  });

  test("an object shown once stays shown, as garbage, once nothing refers to it", async () => {
    const program = `xs = [None] * 3\ndef f():\n    return lambda x: x\nf()\n`;
    const { steps } = await run(program);
    const last = steps[steps.length - 1];
    // The list [None] (#1) is garbage once [None] * 3 (#2) has been made, and so is the function
    // f's call returned: both are still drawn, greyed out.
    expect(last.heap.filter(o => o.isGarbage).map(o => o.id)).toEqual(["#1", "#4"]);
    // In the CSE snapshot, each is in the heap of its frame, which nothing refers to.
    type Frame = { id: string; heapObjects?: { objectId?: string }[] };
    const heapObjects = (last.cse!.environments as Frame[]).map(f => [
      f.id,
      (f.heapObjects ?? []).map(o => o.objectId),
    ]);
    expect(heapObjects).toContainEqual(["Global", ["#1"]]);
    expect(heapObjects).toContainEqual(["E1", ["#4"]]);
    expect(roots(last).stash).toEqual([]);
  });

  test("the final snapshot shows the same frames as the CSE machine's own", async () => {
    const program = `def make_withdraw(balance):
    def withdraw(amount):
        nonlocal balance
        balance = balance - amount
        return balance
    return withdraw
W1 = make_withdraw(100)
W1(50)
`;
    const steps = (await runEStepper(parse(program), program, 3)).steps as CseStep[];
    const { snapshots } = await collectSnapshots(
      new Context(),
      new Control(parse(program)),
      new Stash(),
      -1,
      3,
      program,
    );
    const cseFinal = snapshots[snapshots.length - 1] as unknown as CseStep["cse"];
    expect(framesOf(steps[steps.length - 1].cse.environments)).toEqual(
      framesOf(cseFinal.environments),
    );
  });
});

describe("frame labels in the CSE machine snapshots", () => {
  test("use Python's names for the module and builtins frames, and none for others", async () => {
    const steps = await run(MAKE_WITHDRAW);
    const environments = steps.steps[steps.steps.length - 1].cse!.environments as {
      name: string;
      label?: string;
    }[];
    const labelOf = (name: string) => environments.find(e => e.name === name)?.label;
    expect(labelOf("programEnvironment")).toBe("Global");
    expect(
      environments.filter(e => e.name !== "programEnvironment" && e.name !== "global"),
    ).not.toHaveLength(0);
    for (const e of environments) {
      if (e.name !== "programEnvironment" && e.name !== "global") expect(e.label).toBeUndefined();
    }
  });

  test("a function named like the program's frame gets no label", async () => {
    const program = `def programEnvironment(x):\n    return x\nprogramEnvironment(1)\n`;
    const result = await runEStepper(parse(program), program, 3);
    const frames = result.steps.flatMap(s => s.cse!.environments) as {
      name: string;
      label?: string;
      isActive: boolean;
    }[];
    const labels = new Set(
      frames.filter(e => e.name === "programEnvironment").map(e => e.label ?? "(none)"),
    );
    // The program's own frame is "Global"; the call's frame, also named programEnvironment, is not.
    expect(labels).toEqual(new Set(["Global", "(none)"]));
  });

  test("a function named like an Object method gets no label", async () => {
    const program = `def constructor(x):\n    return x\nconstructor(1)\n`;
    const result = await runEStepper(parse(program), program, 3);
    const frames = result.steps.flatMap(s => s.cse!.environments) as {
      name: string;
      label?: string;
    }[];
    const call = frames.find(e => e.name === "constructor");
    expect(call).toBeDefined();
    expect(call!.label).toBeUndefined();
  });
});

describe("frame ids in the CSE machine snapshots", () => {
  type Frame = {
    id: string;
    name: string;
    parentId: string | null;
    bindings: { value: { metadata?: { closureFrameId?: string } } }[];
  };

  test("are the e-stepper's frame labels, wherever a frame is referred to", async () => {
    const { steps } = await run(MAKE_WITHDRAW);
    for (const step of steps) {
      const environments = step.cse!.environments as Frame[];
      const ids = new Set(environments.map(e => e.id));
      // Every live frame the e-stepper shows is in the snapshot under the same id (garbage
      // frames are left out of snapshots; a host shows them as dead frames from earlier steps)...
      for (const f of step.frames) if (!f.isGarbage) expect(ids.has(f.id)).toBe(true);
      // ...and parents and closures refer to frames by those ids.
      for (const e of environments) {
        if (e.parentId !== null) expect(ids.has(e.parentId)).toBe(true);
        for (const b of e.bindings) {
          const closureFrameId = b.value.metadata?.closureFrameId;
          if (closureFrameId !== undefined) expect(ids.has(closureFrameId)).toBe(true);
        }
      }
    }
    const inCall = steps.find(s => s.activeFrameId === "E2")!;
    const withdraw = (inCall.cse!.environments as (Frame & { isActive: boolean })[]).find(
      e => e.isActive,
    )!;
    expect(withdraw).toMatchObject({ id: "E2", name: "withdraw", parentId: "E1" });
  });

  test("the CSE machine's own snapshots keep the environments' ids", async () => {
    const program = `def f(x):\n    return x\nf(1)\n`;
    const { snapshots } = await collectSnapshots(
      new Context(),
      new Control(parse(program)),
      new Stash(),
      -1,
      3,
      program,
    );
    const ids = snapshots.flatMap(s => s.environments.map(e => e.id));
    expect(ids.some(id => /^E\d+$|^Global$/.test(id))).toBe(false);
  });
});

describe("function bodies in the CSE machine snapshots", () => {
  const PROGRAM = `x = 1
def f(y):
    return x
def g(n):
    if n == 0:
        return 'done'
    else:
        a = n * 2
        return a
h = lambda z: z + 1
`;
  type Fn = { name: string; value: { metadata?: { params?: string[]; body?: string } } };
  const functions = (environments: unknown[]) =>
    new Map(
      (environments as { bindings: Fn[] }[])
        .flatMap(e => e.bindings)
        .filter(b => b.value.metadata?.params !== undefined)
        .map(b => [b.name, b.value.metadata!]),
    );

  test("carry the source of each function's body, dedented", async () => {
    const { snapshots } = await collectSnapshots(
      new Context(),
      new Control(parse(PROGRAM)),
      new Stash(),
      -1,
      3,
      PROGRAM,
    );
    const fns = functions(snapshots[snapshots.length - 1].environments);
    expect(fns.get("f")).toMatchObject({ params: ["y"], body: "return x" });
    expect(fns.get("g")!.body).toBe(
      "if n == 0:\n    return 'done'\nelse:\n    a = n * 2\n    return a",
    );
    expect(fns.get("h")).toMatchObject({ params: ["z"], body: "z + 1" });
  });

  test("keep the whitespace inside a multi-line string", async () => {
    const program = `def f():\n    s = """a\n  b"""\n    return s\n`;
    const { snapshots } = await collectSnapshots(
      new Context(),
      new Control(parse(program)),
      new Stash(),
      -1,
      3,
      program,
    );
    const fns = functions(snapshots[snapshots.length - 1].environments);
    expect(fns.get("f")!.body).toBe('s = """a\n  b"""\nreturn s');
  });

  test("of a function from an earlier chunk (REPL), from that chunk's source", async () => {
    const context = new Context();
    const first = `def f(y):\n    return y + 1\n`;
    const second = `zzzzzzzzzzzzzzzzzzzzzzzzzzz = 0\nf(1)\n`;
    await collectSnapshots(context, new Control(parse(first)), new Stash(), -1, 3, first);
    const { snapshots } = await collectSnapshots(
      context,
      new Control(parse(second)),
      new Stash(),
      -1,
      3,
      second,
    );
    const fns = functions(snapshots[snapshots.length - 1].environments);
    expect(fns.get("f")!.body).toBe("return y + 1");
  });

  test("in the e-stepper's snapshots too", async () => {
    const { steps } = await run(PROGRAM);
    const fns = functions(steps[steps.length - 1].cse!.environments);
    expect(fns.get("f")!.body).toBe("return x");
  });
});

describe("self-referential lists", () => {
  const PROGRAM = `xs = [0]\nxs[0] = xs\nprint(xs)\n`;
  type Serialized = {
    displayValue: string;
    objectId?: string;
    metadata?: { id?: number; elements?: Serialized[]; backReference?: boolean };
  };
  const xsIn = (environments: { name: string; bindings: { name: string; value: unknown }[] }[]) =>
    environments.flatMap(e => e.bindings).find(b => b.name === "xs")!.value as Serialized;

  test("are stepped through, and their snapshots end the cycle with a back reference", async () => {
    const result = await runEStepper(parse(PROGRAM), PROGRAM, 3);
    expect(result.error).toBeUndefined();
    expect(result.output).toBe("[[...]]\n");
    const last = result.steps[result.steps.length - 1] as EStepperStep & {
      cse: { environments: Parameters<typeof xsIn>[0] };
    };
    const xs = xsIn(last.cse.environments);
    expect(xs.displayValue).toBe("[[...]]");
    const inner = xs.metadata!.elements![0];
    expect(inner).toMatchObject({
      displayValue: "[...]",
      objectId: xs.objectId,
      metadata: { id: xs.metadata!.id, elements: [], backReference: true },
    });
  });

  test("do not break the CSE machine's own snapshots", async () => {
    // (A bare Context has no builtins, hence no print.)
    const CYCLE = `xs = [0]\nxs[0] = xs\n`;
    const { snapshots } = await collectSnapshots(
      new Context(),
      new Control(parse(CYCLE)),
      new Stash(),
      -1,
      3,
      CYCLE,
    );
    const xs = xsIn(snapshots[snapshots.length - 1].environments);
    expect(xs.metadata!.elements![0].metadata!.backReference).toBe(true);
    expect(xs.objectId).toBeUndefined();
  });
});

describe("object ids in the CSE machine snapshots", () => {
  test("are the e-stepper's labels of the objects the program pane shows", async () => {
    const steps = (await run(MAKE_WITHDRAW)).steps;
    for (const step of steps) {
      const labels = new Set(step.heap.map(o => o.id));
      const ids = (step.cse!.environments as { bindings: { value: { objectId?: string } }[] }[])
        .flatMap(e => e.bindings.map(b => b.value.objectId))
        .filter((id): id is string => id !== undefined);
      for (const id of ids) expect(labels.has(id)).toBe(true);
    }
    // The global frame's make_withdraw is named, as in the program pane.
    const last = steps[steps.length - 1];
    const makeWithdraw = last.heap.find(o => o.kind === "function" && o.name === "make_withdraw")!;
    const binding = (
      last.cse!.environments as {
        name: string;
        bindings: { name: string; value: { objectId?: string } }[];
      }[]
    )
      .flatMap(e => e.bindings)
      .find(b => b.name === "make_withdraw")!;
    expect(binding.value.objectId).toBe(makeWithdraw.id);
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

describe("global and nonlocal declarations", () => {
  test("take no step of their own, wherever they are in the body", async () => {
    const program = `count = 0
def bump(n):
    if n > 0:
        global count
    count = count + n
    return count
bump(2)
`;
    const { steps, error } = await run(program);
    expect(error).toBeUndefined();
    const explanations = story(steps);
    expect(explanations.join("\n")).not.toMatch(/declaration/);
    expect(explanations).toContainEqual(
      expect.stringMatching(
        /^Called bump\(2\): new frame E1 extends the global frame, without a binding for global count/,
      ),
    );
    expect(explanations).toContainEqual(
      expect.stringMatching(/^Assigned count = 2 in the global frame/),
    );
    // The `if` whose branch holds the declaration is evaluated; the declaration is shown until
    // the branch is done.
    const branch = steps.find(s => JSON.stringify(s.ast).includes("GlobalStatement"));
    expect(branch).toBeDefined();
  });
});

describe("apply_in_underlying_python (§4)", () => {
  test("becomes a call of the function on the list's elements, which then steps as usual", async () => {
    const program = `def f(a, b):\n    return a * b\nprint(apply_in_underlying_python(f, llist(6, 7)))\n`;
    const { steps, output, error } = await run(program, 4);
    expect(error).toBeUndefined();
    expect(output).toBe("42\n");
    const explanations = story(steps);
    const applied = explanations.findIndex(e => e.startsWith("Ran apply_in_underlying_python("));
    expect(applied).toBeGreaterThan(-1);
    expect(explanations[applied]).toContain("apply the function to the elements of the list");
    // The call that follows is an ordinary call: a new frame for f.
    expect(explanations[applied + 1]).toMatch(/^Called f\(6, 7\): new frame E1/);
  });
});
