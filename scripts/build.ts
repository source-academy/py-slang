#!/usr/bin/env tsx
import { select } from "@inquirer/prompts";
import { spawn } from "child_process";
import { Command } from "commander";
import { cpus } from "os";

// Keep in sync with src/conductor/index.ts exports.
const allTargets = [
  "PyCseEvaluator1",
  "PyCseEvaluator2",
  "PyCseEvaluator3",
  "PyCseEvaluator4",
  "PyWasmEvaluator1",
  "PyWasmEvaluator2",
  "PyWasmEvaluator3",
  "PyWasmEvaluator4",
  "PyPvmlEvaluator1",
  "PyPvmlEvaluator2",
  "PyPvmlEvaluator3",
  "PyPvmlEvaluator4",
  "PyPvmlPynterEvaluator",
  "PyodideEvaluator1",
  "PyodideEvaluator2",
  "PyodideEvaluator3",
  "PyodideEvaluator4",
  "PyodideEvaluatorFull",
  "Py2JsEvaluator1",
  "Py2JsEvaluator2",
  "Py2JsEvaluator3",
  "Py2JsEvaluator4",
  "PyStepperEvaluator1",
  "PyStepperEvaluator2",
] as const;

type EvaluatorName = (typeof allTargets)[number];

function buildTarget(target: EvaluatorName, extraArgs: string[] = []): Promise<void> {
  console.log(`\nBuilding ${target}...\n`);
  return new Promise((resolve, reject) => {
    const child = spawn("rollup", ["-c", "rollup.config.mjs", ...extraArgs], {
      env: { ...process.env, EVALUATOR: target },
      stdio: "inherit",
    });
    child.on("close", code => {
      if (code === 0) resolve();
      else reject(new Error(`Build failed for ${target} (exit ${code})`));
    });
  });
}

/**
 * Runs `tasks` with at most `limit` running at once, rather than spawning
 * every one of them simultaneously. `--all` builds 19 targets, each its own
 * `rollup` child process; on a GitHub Actions runner (2 vCPUs) firing all 19
 * at once oversubscribes the CPU/memory badly enough that individual builds
 * — which normally take well under a second — occasionally ballooned to
 * 5+ minutes, and the whole job would eventually die with "The operation
 * was canceled" (the runner itself losing its heartbeat under memory
 * pressure, not an actual external cancellation). Capping concurrency to
 * the host's own core count keeps every worker actually running instead of
 * fighting over the same handful of cores, and scales up for free on a
 * developer's own, usually much larger, machine.
 */
async function runWithConcurrencyLimit<T>(
  limit: number,
  tasks: readonly (() => Promise<T>)[],
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  async function worker(): Promise<void> {
    for (let i = next++; i < tasks.length; i = next++) {
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

function watchTarget(target: EvaluatorName) {
  console.log(`\nWatching ${target}...\n`);
  const child = spawn("rollup", ["-c", "rollup.config.mjs", "--watch"], {
    env: { ...process.env, EVALUATOR: target },
    stdio: "inherit",
  });
  return child;
}

async function resolveTargets(evaluator?: string, all?: boolean): Promise<EvaluatorName[]> {
  if (all) return [...allTargets];

  if (evaluator) {
    if (!allTargets.includes(evaluator as EvaluatorName)) {
      console.error(`Invalid target: ${evaluator}. Expected: ${allTargets.join(", ")}`);
      process.exit(1);
    }
    return [evaluator as EvaluatorName];
  }

  if (!process.stdin.isTTY) return [...allTargets];

  const choice = await select({
    message: "Select build target:",
    choices: [
      ...allTargets.map(value => ({ name: value, value })),
      { name: "all", value: "all" as const },
    ],
    default: "all",
  });

  return choice === "all" ? [...allTargets] : [choice];
}

async function main() {
  const program = new Command()
    .option("--evaluator <name>", `Build target: ${allTargets.join(", ")}`)
    .option("--all", "Build all targets")
    .option("--watch", "Watch for changes and rebuild")
    .parse();

  const opts = program.opts();
  const extraArgs = program.args;
  const targets = await resolveTargets(opts.evaluator, opts.all);

  if (opts.watch) {
    if (targets.length > 1) {
      console.error("Watch mode only supports a single target. Use --evaluator <name>.");
      process.exit(1);
    }
    const child = watchTarget(targets[0]);
    process.on("SIGINT", () => {
      child.kill();
      process.exit(0);
    });
  } else {
    await runWithConcurrencyLimit(
      cpus().length,
      targets.map(target => () => buildTarget(target, extraArgs)),
    );
  }
}

main().catch(() => process.exit(1));
