#!/usr/bin/env tsx
/// <reference types="node" />
import { select } from "@inquirer/prompts";
import { execSync } from "child_process";
import { Command } from "commander";

const evaluatorMap = {
  cse: "PyCseEvaluator",
  wasm: "PyWasmEvaluator",
} as const;

type EvaluatorKey = keyof typeof evaluatorMap;
const evaluators = Object.keys(evaluatorMap) as EvaluatorKey[];

function buildEvaluator(name: EvaluatorKey, variant: string, extraArgs: string[] = []) {
  console.log(`\nBuilding evaluator=${name} variant=${variant} (${evaluatorMap[name]})...\n`);
  const rollupCmd = ["rollup -c --bundleConfigAsCjs", ...extraArgs].join(" ");
  execSync(rollupCmd, {
    env: { ...process.env, EVALUATOR: evaluatorMap[name], VARIANT: variant },
    stdio: "inherit",
  });
}

async function resolveTargets(evaluator?: string, all?: boolean): Promise<EvaluatorKey[]> {
  if (all) return evaluators;

  if (evaluator) {
    if (!(evaluator in evaluatorMap)) {
      console.error(`Invalid evaluator: ${evaluator}. Expected: ${evaluators.join(", ")}`);
      process.exit(1);
    }
    return [evaluator as EvaluatorKey];
  }

  if (!process.stdin.isTTY) return evaluators;

  const choice = await select({
    message: "Select evaluator:",
    choices: [...evaluators.map(value => ({ name: value, value })), { name: "all", value: "all" }],
    default: "all",
  });

  return choice === "all" ? evaluators : [choice as EvaluatorKey];
}

async function main() {
  const program = new Command()
    .option("--evaluator <type>", `Evaluator engine: ${evaluators.join(", ")}`)
    .option("--variant <number>", "Python variant (chapter)")
    .option("--all", "Build all evaluators")
    .allowUnknownOption()
    .parse();

  const opts = program.opts();
  const variant = opts.variant ?? 4;
  const extraArgs = program.args;
  const targets = await resolveTargets(opts.evaluator, opts.all);

  for (const target of targets) {
    buildEvaluator(target, variant, extraArgs);
  }
}

main().catch(() => process.exit(1));
