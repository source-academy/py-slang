#!/usr/bin/env tsx
import { select } from "@inquirer/prompts";
import { execSync } from "child_process";
import { Command } from "commander";

const evaluatorMap = {
  cse: "PyCSEEvaluator",
  wasm: "PyWasmEvaluator",
} as const;

type EvaluatorKey = keyof typeof evaluatorMap;
const evaluators = Object.keys(evaluatorMap) as EvaluatorKey[];

function buildEvaluator(name: EvaluatorKey) {
  console.log(`\nBuilding evaluator=${name} (${evaluatorMap[name]})...\n`);
  execSync("rollup -c --bundleConfigAsCjs", {
    env: { ...process.env, EVALUATOR: evaluatorMap[name] },
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
    .option("--all", "Build all evaluators")
    .parse();

  const { evaluator, all } = program.opts();
  const targets = await resolveTargets(evaluator, all);

  for (const target of targets) {
    buildEvaluator(target);
  }
}

main().catch(() => process.exit(1));
