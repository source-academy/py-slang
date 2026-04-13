#!/usr/bin/env tsx
import { select } from "@inquirer/prompts";
import { spawn } from "child_process";
import { Command } from "commander";

// Keep in sync with src/conductor/index.ts exports.
const allTargets = [
  "PyCseEvaluator1",
  "PyCseEvaluator2",
  "PyCseEvaluator3",
  "PyCseEvaluator4",
  "PyWasmEvaluator",
  "PySvmlEvaluator",
  "PySvmlSinterEvaluator",
] as const;

type EvaluatorName = string;

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

  return choice === "all" ? [...allTargets] : [choice as EvaluatorName];
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
    await Promise.all(targets.map(target => buildTarget(target, extraArgs)));
  }
}

main().catch(() => process.exit(1));
