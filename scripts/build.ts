#!/usr/bin/env tsx
import { execSync } from "child_process";
import { Command } from "commander";
import { select } from "@inquirer/prompts";

const BACKENDS = [
  { name: "cse  - CSE machine (default)", value: "cse" },
  { name: "wasm - WebAssembly backend", value: "wasm" },
] as const;

type BackendChoice = (typeof BACKENDS)[number]["value"];

const evaluatorMap: Record<BackendChoice, string> = {
  cse: "PyCSEEvaluator",
  wasm: "PyWasmEvaluator",
};

async function main() {
  const program = new Command()
    .option("--backend <type>", "Backend engine: cse, wasm", "cse")
    .parse();

  let backend: BackendChoice;

  if (process.argv.length > 2) {
    backend = program.opts().backend as BackendChoice;
    const valid = BACKENDS.map(b => b.value) as readonly string[];
    if (!valid.includes(backend)) {
      console.error(`Invalid backend: ${backend}. Expected: ${valid.join(", ")}`);
      process.exit(1);
    }
  } else {
    backend = (await select({
      message: "Select backend:",
      choices: [...BACKENDS],
      default: "cse",
    })) as BackendChoice;
  }

  const evaluator = evaluatorMap[backend];
  console.log(`\nBuilding with backend=${backend} (evaluator=${evaluator})...\n`);

  try {
    execSync("rollup -c --bundleConfigAsCjs", {
      env: { ...process.env, EVALUATOR: evaluator },
      stdio: "inherit",
    });
  } catch {
    process.exit(1);
  }
}

main();
