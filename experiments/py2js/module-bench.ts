/**
 * py2js experiment — the "sound module" scenario.
 *
 * Source Academy's sound module represents sounds as functions of time and
 * samples them at 44100 Hz: the TS module calls the *user-defined Python*
 * wave function once per sample. This is the case where module-side speed
 * matters most, and the motivation for dual compilation: the program's spine
 * is async (conductor channels), but modules call back into Python through
 * the sync bodies (rt.callSync) — no promises in the hot loop.
 *
 * Measures, for 10 seconds of "audio" (441 000 wave-function calls):
 *   1. dual compile, module samples via callSync   <- the proposed design
 *   2. dual compile, module samples via acall      <- what async-only forces
 *   3. sync compile, module samples via callSync   <- no-async reference
 *   4. native JS wave function                     <- floor
 * plus the asyncOnly guard (a wave that does a frontend round-trip must fail
 * loudly on the sync path, not return a bogus Promise).
 *
 * Run with:  yarn tsx experiments/py2js/module-bench.ts
 */
import "./conductor-alias";
import { runPy2Js, runPy2JsDual } from "./index";
import { Py2JsRuntime, PyRuntimeError, PyValue } from "./runtime";

const SAMPLE_RATE = 44100;

/** The fake sound module: sums wave(t) over all samples as a checksum. */
function soundModule(rt: Py2JsRuntime): Record<string, PyValue> {
  const playSync = rt.def("play", 2, (wave, seconds) => {
    const n = SAMPLE_RATE * Number(seconds as bigint);
    let acc = 0;
    for (let i = 0; i < n; i++) {
      acc += rt.callSync(wave!, [i / SAMPLE_RATE]) as number;
    }
    return acc;
  });
  playSync.pyBuiltin = true;

  const playAsync = rt.def("play_async", 2, (async (wave: PyValue, seconds: PyValue) => {
    const n = SAMPLE_RATE * Number(seconds as bigint);
    let acc = 0;
    for (let i = 0; i < n; i++) {
      acc += (await rt.acall(wave, [i / SAMPLE_RATE])) as number;
    }
    return acc;
  }) as never);
  playAsync.pyBuiltin = true;

  // A module function that needs an async frontend round-trip (simulated):
  // legal on the async spine, must be *rejected* inside a sync callback.
  const channelRequest = rt.def("channel_request", 1, (async (x: PyValue) => {
    await new Promise(resolve => setTimeout(resolve, 0));
    return x;
  }) as never);
  channelRequest.pyBuiltin = true;
  channelRequest.asyncOnly = true;

  return { play: playSync, play_async: playAsync, channel_request: channelRequest };
}

const waveProgram = (play: string, seconds: number) => `
def wave(t):
    return math_sin(2.0 * math_pi * 440.0 * t)

def scaled(f, k):
    return lambda t: k * f(t)

print(${play}(scaled(wave, 0.5), ${seconds}))
`;

async function main() {
  const seconds = 10;
  const calls = SAMPLE_RATE * seconds;

  const dualSync = await runPy2JsDual(waveProgram("play", seconds), soundModule);
  const dualAsync = await runPy2JsDual(waveProgram("play_async", seconds), soundModule);
  const syncSync = runPy2Js(waveProgram("play", seconds), soundModule);

  const t0 = performance.now();
  let acc = 0;
  const k = 2.0 * Math.PI * 440.0;
  for (let i = 0; i < calls; i++) acc += 0.5 * Math.sin(k * (i / SAMPLE_RATE));
  const nativeMs = performance.now() - t0;

  const outputs = new Set([
    dualSync.output,
    dualAsync.output,
    syncSync.output,
    acc.toString() + "\n",
  ]);
  console.log(`${seconds}s of audio = ${calls} Python wave-function calls from the TS module`);
  console.log(`outputs ${outputs.size === 1 ? "agree" : `DIFFER: ${[...outputs].join(" ")}`}\n`);

  const rows: [string, number][] = [
    ["dual compile + callSync (proposed)", dualSync.runMs],
    ["dual compile + acall per sample", dualAsync.runMs],
    ["sync compile + callSync (reference)", syncSync.runMs],
    ["native JS wave (floor)", nativeMs],
  ];
  const best = Math.min(...rows.map(([, ms]) => ms));
  for (const [name, ms] of rows) {
    console.log(
      `  ${name.padEnd(38)} ${ms.toFixed(1).padStart(9)} ms   (${(ms / best).toFixed(1)}x)`,
    );
  }
  console.log(
    `  -> per-sample callback cost: sync ${((dualSync.runMs / calls) * 1e6).toFixed(0)} ns, async ${((dualAsync.runMs / calls) * 1e6).toFixed(0)} ns`,
  );

  // The guard: a wave function that performs a frontend round-trip inside a
  // synchronously sampled callback must raise, not misbehave.
  const guardProgram = `
def bad_wave(t):
    return channel_request(t)
print(play(bad_wave, 1))
`;
  try {
    await runPy2JsDual(guardProgram, soundModule);
    console.log("\nasyncOnly guard: FAILED (no error raised)");
  } catch (e) {
    const ok = e instanceof PyRuntimeError;
    console.log(`\nasyncOnly guard: ${ok ? "ok" : "unexpected error"} — ${(e as Error).message}`);
  }

  // ...while the same round-trip is fine on the program's async spine.
  const spineProgram = `print(channel_request(42))`;
  const spine = await runPy2JsDual(spineProgram, soundModule);
  console.log(`async spine round-trip: ${JSON.stringify(spine.output)} (expected "42\\n")`);
}

main();
