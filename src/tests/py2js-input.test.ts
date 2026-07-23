/**
 * py2js's input() (source-academy/py-slang#338): dual-bodied (def2) and
 * asyncOnly, exactly like an imported module function — round-trips through
 * the conductor evaluator's requestInput hook (Py2JsEvaluator.ts ->
 * Py2JsSession -> Py2JsRuntime.requestInput, mirroring the CSE machine's
 * createInputStream/receiveInput contract in src/engines/cse/streams.ts).
 *
 * A chunk that calls input() forces dual-mode compilation even with no
 * imports of its own — Py2JsSession.runChunk detects this via
 * Resolver.referencedNames (populated by every Variable reference the
 * resolver visits, at any nesting depth) rather than a second AST walk.
 */
import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { Py2JsEvaluator1 } from "../conductor/Py2JsEvaluator";
import { Py2JsSession } from "../engines/py2js";

function makeMockConductor(responses: string[]) {
  const errors: { name: string; message: string }[] = [];
  const outputs: string[] = [];
  const prompts: (string | undefined)[] = [];
  let call = 0;
  const conductor = {
    sendResult: () => undefined,
    sendError: (e: unknown) => errors.push(e as { name: string; message: string }),
    sendOutput: (m: string) => outputs.push(m),
    registerPlugin: () => undefined,
    requestInput: (prompt?: string) => {
      prompts.push(prompt);
      return Promise.resolve(responses[call++]);
    },
  } as unknown as IRunnerPlugin;
  return { conductor, errors, outputs, prompts };
}

describe("Py2JsEvaluator: input()", () => {
  test("with a prompt: sends the prompt via sendOutput and binds the typed value", async () => {
    const { conductor, errors, outputs, prompts } = makeMockConductor(["world"]);
    const evaluator = new Py2JsEvaluator1(conductor);

    await evaluator.evaluateChunk('name = input("Name: ")\nprint(name)\n');

    expect(errors).toEqual([]);
    expect(prompts).toEqual(["Name: "]);
    expect(outputs).toEqual(["Name: ", "world"]);
  });

  test("with no prompt: requests input with an undefined prompt", async () => {
    const { conductor, errors, outputs, prompts } = makeMockConductor(["42"]);
    const evaluator = new Py2JsEvaluator1(conductor);

    await evaluator.evaluateChunk("print(input())\n");

    expect(errors).toEqual([]);
    expect(prompts).toEqual([undefined]);
    expect(outputs).toEqual(["42"]);
  });

  test("too many arguments is a TypeError, matching the stdlib's @Validate(0, 1, ...) gate", async () => {
    const { conductor, errors, outputs } = makeMockConductor([]);
    const evaluator = new Py2JsEvaluator1(conductor);

    await evaluator.evaluateChunk('input("a", "b")\n');

    expect(outputs).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].name).toBe("TypeError");
    expect(errors[0].message).toContain("input() takes at most 1 argument (2 given)");
  });

  test("a call to input() nested inside a user function still compiles in dual mode (no import in the chunk)", async () => {
    const { conductor, errors, outputs, prompts } = makeMockConductor(["world"]);
    const evaluator = new Py2JsEvaluator1(conductor);

    await evaluator.evaluateChunk(
      "def ask():\n    return input('N: ')\nprint(ask() + '!')\n",
    );

    expect(errors).toEqual([]);
    expect(prompts).toEqual(["N: "]);
    expect(outputs).toEqual(["N: ", "world!"]);
  });

  test("later chunks in the same session still see earlier bindings after a dual-mode input() chunk", async () => {
    const { conductor, errors, outputs } = makeMockConductor(["hi"]);
    const evaluator = new Py2JsEvaluator1(conductor);

    await evaluator.evaluateChunk("x = input()\n");
    await evaluator.evaluateChunk("print(x + '!')\n");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["hi!"]);
  });
});

describe("Py2JsSession: input() without a requestInput hook", () => {
  test("raises RuntimeError instead of hanging (standalone/test use with no conductor)", async () => {
    const session = new Py2JsSession(1);
    await expect(session.runChunk("print(input())\n")).rejects.toMatchObject({
      name: "RuntimeError",
    });
  });
});
