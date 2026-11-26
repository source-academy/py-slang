/**
 * The CSE machine hands its snapshots on in batches while the run goes on, so that a run the host
 * stops still leaves the snapshots taken so far. What goes out must be what a run sent whole has,
 * including the breakpoints, which the interpreter records one step after the snapshot they belong
 * to.
 */
import { collectSnapshots, SNAPSHOTS_PER_BATCH } from "../conductor/plugins/PyCseMachinePlugin";
import type { CseSnapshot } from "@sourceacademy/common-cse-machine";
import { Context } from "../engines/cse/context";
import { Control } from "../engines/cse/control";
import { Stash } from "../engines/cse/stash";
import { parse } from "../parser/parser-adapter";
import math from "../stdlib/math";
import misc from "../stdlib/misc";

type Batch = { snapshots: CseSnapshot[]; breakpointSteps: number[] };

const LOOP = "i = 0\nwhile i < 40:\n    i = i + 1\n";

async function run(code: string, maxSnapshots = 100000, batched = true) {
  const ctx = new Context();
  for (const [name, val] of [...math.builtins, ...misc.builtins]) {
    ctx.nativeStorage.builtins.set(name, val);
  }
  const ast = parse(code);
  const batches: Batch[] = [];
  const result = await collectSnapshots(
    ctx,
    new Control(ast),
    new Stash(),
    -1,
    3,
    code,
    maxSnapshots,
    batched
      ? (snapshots, breakpointSteps) => batches.push({ snapshots, breakpointSteps })
      : undefined,
  );
  return { batches, result };
}

const text = (value: unknown) =>
  JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v));

describe("collectSnapshots with batches", () => {
  test("the batches add up to all the snapshots, in order, SNAPSHOTS_PER_BATCH at a time", async () => {
    const { batches, result } = await run(LOOP);
    expect(batches.length).toBeGreaterThan(1);
    for (const batch of batches.slice(0, -1)) {
      expect(batch.snapshots.length).toBe(SNAPSHOTS_PER_BATCH);
    }
    const all = batches.flatMap(batch => batch.snapshots);
    expect(all).toEqual(result.snapshots);
    expect(all.map(s => s.stepIndex)).toEqual(all.map((_, i) => i));
  });

  test("batching changes nothing about what is collected", async () => {
    const batched = await run(LOOP);
    const whole = await run(LOOP, 100000, false);
    expect(text(batched.result)).toBe(text(whole.result));
    expect(whole.batches).toEqual([]);
  });

  test("a run that ends in the middle of a batch sends the rest", async () => {
    const { batches, result } = await run("1 + 1\n");
    expect(result.snapshots.length).toBeLessThan(SNAPSHOTS_PER_BATCH);
    expect(batches.length).toBe(1);
    expect(batches[0].snapshots).toEqual(result.snapshots);
  });

  test("says that the run was cut off, and only if it was", async () => {
    const total = (await run(LOOP)).result.snapshots.length;
    expect((await run(LOOP, 12)).result.cutOff).toBe(true);
    expect((await run(LOOP, 12)).result.snapshots).toHaveLength(12);
    expect((await run(LOOP)).result.cutOff).toBe(false);
    // A limit of exactly the number of steps is not a cut-off: the machine had nothing left.
    expect((await run(LOOP, total)).result.cutOff).toBe(false);
    expect((await run(LOOP, total - 1)).result.cutOff).toBe(true);
  });

  test("a program that fails still sends the snapshots up to the failure", async () => {
    const code = "i = 0\nwhile i < 40:\n    i = i + 1\n1 / 0\n";
    const ctx = new Context();
    for (const [name, val] of [...math.builtins, ...misc.builtins]) {
      ctx.nativeStorage.builtins.set(name, val);
    }
    const ast = parse(code);
    const sent: CseSnapshot[] = [];
    await collectSnapshots(ctx, new Control(ast), new Stash(), -1, 3, code, 100000, snapshots => {
      sent.push(...snapshots);
    }).catch(() => undefined);
    expect(sent.length).toBeGreaterThan(SNAPSHOTS_PER_BATCH);
  });

  test("a run with no batch callback sends nothing", async () => {
    const { batches, result } = await run(LOOP, 100000, false);
    expect(batches).toEqual([]);
    expect(result.snapshots.length).toBeGreaterThan(SNAPSHOTS_PER_BATCH);
  });
});

describe("breakpoint steps in batches", () => {
  /** A loop with `breakpoint()` in it, after `pad` lines that shift where the batches end. */
  const withBreakpoints = (pad: number) =>
    "x = 0\n".repeat(pad) + "i = 0\nwhile i < 12:\n    breakpoint()\n    i = i + 1\n";

  test("the breakpoint steps of the batches add up to those of the run, wherever the batches end", async () => {
    // Shifting the program by a line moves each breakpoint along the batch boundary, including onto
    // the last snapshot of a batch (whose breakpoint the interpreter has not recorded yet).
    for (let pad = 0; pad <= 30; pad++) {
      const { batches, result } = await run(withBreakpoints(pad));
      expect(result.breakpointSteps.length).toBeGreaterThan(5);
      expect(batches.flatMap(batch => batch.breakpointSteps)).toEqual(result.breakpointSteps);
    }
  });

  test("a breakpoint step goes out with the batch that has its snapshot, or a later one", async () => {
    for (let pad = 0; pad <= 30; pad++) {
      const { batches } = await run(withBreakpoints(pad));
      let snapshotsSent = 0;
      for (const batch of batches) {
        snapshotsSent += batch.snapshots.length;
        for (const step of batch.breakpointSteps) {
          expect(step).toBeLessThan(snapshotsSent);
        }
      }
    }
  });

  test("a breakpoint recorded after the last batch of a run still goes out", async () => {
    // A program that ends just after a breakpoint: its step is recorded as the machine finishes.
    for (let pad = 0; pad <= 30; pad++) {
      const code = "x = 0\n".repeat(pad) + "breakpoint()\n";
      const { batches, result } = await run(code);
      expect(result.breakpointSteps).toHaveLength(1);
      expect(batches.flatMap(batch => batch.breakpointSteps)).toEqual(result.breakpointSteps);
    }
  });
});
