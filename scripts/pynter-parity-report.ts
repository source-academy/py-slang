#!/usr/bin/env tsx
/**
 * Reports pass/fail counts for the native Pynter parity suite
 * (generateNativePynterTestCases in src/tests/utils.ts), broken down by test
 * file, as a Markdown table — so it's easy to see what to work on next, and
 * to paste straight into a PR description.
 *
 * Usage:
 *   PYNTER_RUNNER_PATH=<path to Pynter's runner binary> yarn pynter:report
 *   PYNTER_RUNNER_PATH=<path> yarn pynter:report --failures   # also list failing tests
 */
import { spawnSync } from "child_process";
import { Command } from "commander";

const TAG = "[pvml/pynter]";

interface AssertionResult {
  ancestorTitles: string[];
  fullName: string;
  status: "passed" | "failed" | "pending" | "skipped" | "todo";
  failureMessages: string[];
}

interface JestTestResult {
  name: string;
  assertionResults: AssertionResult[];
}

interface JestJson {
  testResults: JestTestResult[];
}

function suiteNameFor(filePath: string): string {
  return (
    filePath
      .split("/")
      .pop()
      ?.replace(/\.test\.ts$/, "") ?? filePath
  );
}

function runJest(): JestJson {
  // Deliberately not using jest's own -t filter: it marks non-matching tests
  // as "pending" rather than excluding them, which would be indistinguishable
  // from a genuine (e.g. complex-number) skip. Filter by ancestor title below
  // instead, over the full (unfiltered) result set.
  const result = spawnSync("npx", ["jest", "--json"], {
    encoding: "utf-8",
    maxBuffer: 1024 * 1024 * 100,
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    console.error(result.stderr);
    throw new Error("Failed to parse `jest --json` output (see stderr above).");
  }
}

function main() {
  const program = new Command()
    .option("--failures", "Also list failing test names, grouped by suite")
    .parse();
  const { failures: listFailures } = program.opts<{ failures?: boolean }>();

  if (!process.env.PYNTER_RUNNER_PATH) {
    console.error(
      "PYNTER_RUNNER_PATH is not set, so the native Pynter suite would be entirely skipped.\n" +
        "Build Pynter's `runner` binary (see " +
        "https://github.com/source-academy/pynter#build-locally) and set PYNTER_RUNNER_PATH to " +
        "it, e.g.:\n\n" +
        "  PYNTER_RUNNER_PATH=../pynter/build/runner/runner yarn pynter:report\n",
    );
    process.exit(1);
  }

  const report = runJest();

  type Row = { suite: string; passed: number; failed: number; skipped: number };
  const rows: Row[] = [];
  const failuresBySuite = new Map<string, string[]>();

  for (const testResult of report.testResults) {
    const tagged = testResult.assertionResults.filter(a =>
      a.ancestorTitles.some(t => t.startsWith(TAG)),
    );
    if (tagged.length === 0) continue;

    const suite = suiteNameFor(testResult.name);
    const passed = tagged.filter(a => a.status === "passed").length;
    const failed = tagged.filter(a => a.status === "failed").length;
    const skipped = tagged.length - passed - failed;
    rows.push({ suite, passed, failed, skipped });

    if (listFailures && failed > 0) {
      failuresBySuite.set(
        suite,
        tagged.filter(a => a.status === "failed").map(a => a.fullName),
      );
    }
  }

  if (rows.length === 0) {
    console.error(
      `No tests tagged "${TAG}" ran. Did the build pick up PYNTER_RUNNER_PATH correctly?`,
    );
    process.exit(1);
  }

  rows.sort((a, b) => a.suite.localeCompare(b.suite));
  const totals = rows.reduce(
    (acc, r) => ({
      passed: acc.passed + r.passed,
      failed: acc.failed + r.failed,
      skipped: acc.skipped + r.skipped,
    }),
    { passed: 0, failed: 0, skipped: 0 },
  );

  const pct = (passed: number, attempted: number) =>
    attempted === 0 ? "n/a" : `${Math.round((passed / attempted) * 100)}%`;

  const toRow = (suite: string, passed: number, failed: number, skipped: number) => {
    const attempted = passed + failed;
    return [suite, `${passed}/${attempted}`, String(skipped), pct(passed, attempted)];
  };

  const header = ["Suite", "Pass/Attempted", "Skipped (complex numbers)", "Pass rate"];
  const body = rows.map(r => toRow(r.suite, r.passed, r.failed, r.skipped));
  body.push(
    toRow("**Total**", totals.passed, totals.failed, totals.skipped).map((cell, i) =>
      i === 0 ? cell : `**${cell}**`,
    ) as string[],
  );

  console.log(`| ${header.join(" | ")} |`);
  console.log(`|${header.map(() => " --- ").join("|")}|`);
  for (const row of body) {
    console.log(`| ${row.join(" | ")} |`);
  }

  if (listFailures && failuresBySuite.size > 0) {
    console.log("\nFailing tests:\n");
    for (const [suite, names] of failuresBySuite) {
      console.log(`${suite}:`);
      for (const name of names) {
        console.log(`  - ${name}`);
      }
    }
  }
}

main();
