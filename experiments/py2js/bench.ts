/**
 * py2js experiment — benchmark against the CSE machine and the PVML
 * interpreter (PVML-in-browser, pure TS).
 *
 * Part 1 runs the same chapter-1 programs on all three engines (sizes chosen
 * so the CSE machine finishes in reasonable time). Part 2 runs py2js alone on
 * much larger sizes, next to a hand-written native-JS baseline, to show the
 * headroom.
 *
 * Run with:  yarn tsx experiments/py2js/bench.ts
 */
import "./conductor-alias";
import { PVMLCompiler } from "../../src/engines/pvml/pvml-compiler";
import { PVMLInterpreter } from "../../src/engines/pvml/pvml-interpreter";
import { parse } from "../../src/parser";
import { analyzeWithEnvironments } from "../../src/resolver";
import { runCode, VARIANT_GROUPS } from "../../src/runner";
import { runPy2Js } from "./index";

/**
 * Same harness as runCodePvmlInterpreterSync (src/pvml-runner.ts) but with
 * the safety caps raised — the stock 1M-instruction / 1000-call-depth limits
 * are far too small for benchmark workloads.
 */
function runPvmlUncapped(code: string, variant: number): string {
  const source = code.endsWith("\n") ? code : code + "\n";
  const ast = parse(source);
  const { errors, environments } = analyzeWithEnvironments(
    ast,
    source,
    variant,
    VARIANT_GROUPS[variant],
    [],
    [],
  );
  if (errors.length > 0) throw new Error(errors.map(e => e.message).join("\n"));
  const program = PVMLCompiler.fromProgram(ast, variant, environments, true).compileProgram(ast);
  const outputs: string[] = [];
  const interpreter = new PVMLInterpreter(program, {
    sendOutput: msg => outputs.push(msg + "\n"),
    programText: source,
    variant,
    maxInstructions: 1_000_000_000,
    maxCallDepth: 1_000_000_000,
    maxStackSize: 1_000_000_000,
  });
  interpreter.execute();
  return outputs.join("");
}

const fib = (n: number) => `
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)
print(fib(${n}))
`;

const tailSum = (n: number) => `
def sum_to(n, acc):
    return acc if n == 0 else sum_to(n - 1, acc + n)
print(sum_to(${n}, 0))
`;

// Float-heavy tail recursion: fixed-count Newton iteration for sqrt(2).
const newton = (n: number) => `
def improve(guess, x):
    return (guess + x / guess) / 2.0
def iterate(guess, x, n):
    return guess if n == 0 else iterate(improve(guess, x), x, n - 1)
print(iterate(1.0, 2.0, ${n}))
`;

interface Timed {
  ms: number;
  output: string;
}

async function timed(fn: () => Promise<string> | string): Promise<Timed> {
  const t0 = performance.now();
  const output = await fn();
  return { ms: performance.now() - t0, output };
}

function report(name: string, results: Record<string, Timed>) {
  const outputs = new Set(Object.values(results).map(r => r.output));
  const agree = outputs.size === 1 ? "outputs agree" : `OUTPUTS DIFFER: ${[...outputs].join(" vs ")}`;
  console.log(`\n${name}  (${agree})`);
  const fastest = Math.min(...Object.values(results).map(r => r.ms));
  for (const [engine, r] of Object.entries(results)) {
    const rel = r.ms / fastest;
    console.log(`  ${engine.padEnd(18)} ${r.ms.toFixed(1).padStart(9)} ms   (${rel.toFixed(1)}x)`);
  }
}

async function main() {
  console.log("=== Part 1: all three engines, moderate sizes ===");
  const part1: [string, string][] = [
    ["fib(20)", fib(20)],
    ["tail sum 100k", tailSum(100_000)],
    ["newton 100k", newton(100_000)],
  ];
  for (const [name, code] of part1) {
    report(name, {
      "cse machine": await timed(() => runCode(code, 1, { envSteps: 1_000_000_000 })),
      "pvml interpreter": await timed(() => runPvmlUncapped(code, 1)),
      py2js: await timed(() => runPy2Js(code).output),
    });
  }

  console.log("\n=== Part 2: py2js headroom, large sizes ===");

  const nativeFib = (n: bigint): bigint => (n < 2n ? n : nativeFib(n - 1n) + nativeFib(n - 2n));
  report("fib(27)", {
    py2js: await timed(() => runPy2Js(fib(27)).output),
    "native JS (bigint)": await timed(() => nativeFib(27n).toString() + "\n"),
  });

  const nativeSum = (n: bigint): bigint => {
    let acc = 0n;
    for (let i = n; i > 0n; i--) acc += i;
    return acc;
  };
  report("tail sum 3M", {
    py2js: await timed(() => runPy2Js(tailSum(3_000_000)).output),
    "native JS (loop)": await timed(() => nativeSum(3_000_000n).toString() + "\n"),
  });

  const { compileMs, runMs } = runPy2Js(fib(20));
  console.log(
    `\npy2js parse+compile vs run for fib(20): ${compileMs.toFixed(1)} ms compile, ${runMs.toFixed(1)} ms run`,
  );
}

main();
