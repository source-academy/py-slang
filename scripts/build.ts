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

function buildBackend(backend: BackendChoice) {
  const evaluator = evaluatorMap[backend];
  console.log(`\nBuilding backend=${backend} (evaluator=${evaluator})...\n`);
  execSync("rollup -c --bundleConfigAsCjs", {
    env: { ...process.env, EVALUATOR: evaluator },
    stdio: "inherit",
  });
}

async function main() {
  const program = new Command()
    .option("--backend <type>", "Backend engine: cse, wasm")
    .option("--all", "Build all backends")
    .parse();

  const opts = program.opts();
  const valid = BACKENDS.map(b => b.value) as readonly string[];

  if (opts.all) {
    for (const backend of BACKENDS.map(b => b.value)) {
      buildBackend(backend);
    }
    return;
  }

  if (opts.backend) {
    if (!valid.includes(opts.backend)) {
      console.error(`Invalid backend: ${opts.backend}. Expected: ${valid.join(", ")}`);
      process.exit(1);
    }
    buildBackend(opts.backend as BackendChoice);
    return;
  }

  // No args: non-interactive default to --all
  if (process.stdin.isTTY) {
    const backend = (await select({
      message: "Select backend (or Ctrl+C to build all):",
      choices: [...BACKENDS, { name: "all  - Build all backends", value: "all" as const }],
      default: "all",
    })) as BackendChoice | "all";

    if (backend === "all") {
      for (const b of BACKENDS.map(b => b.value)) {
        buildBackend(b);
      }
    } else {
      buildBackend(backend);
    }
  } else {
    // Non-interactive (CI): build all
    for (const backend of BACKENDS.map(b => b.value)) {
      buildBackend(backend);
    }
  }
}

main().catch(() => process.exit(1));
