#!/usr/bin/env tsx
/**
 * Builds the worker of the Typed Python §4 type checker: dist/TypedPy4Checker.js (see
 * src/typecheck/bundler/). `--force` builds it even if it is up to date.
 */
import { buildTypedPython4Checker } from "../src/typecheck/bundler/typed4";

const report = buildTypedPython4Checker(undefined, { force: process.argv.includes("--force") });
const mb = (report.bytes / 1e6).toFixed(2);
console.log(
  report.built
    ? `Built ${report.file} (${mb} MB; ${report.kept} typeshed files kept, ${report.dropped} dropped)`
    : `${report.file} is up to date (${mb} MB)`,
);
