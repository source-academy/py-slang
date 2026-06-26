/**
 * Rollup config for the standalone CLI (dist/repl.cjs).
 * Unlike the evaluator bundles, this targets Node.js (no browser polyfills,
 * no IIFE wrapper) and marks node built-ins as external.
 */
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import commonjs from "@rollup/plugin-commonjs";
import replace from "@rollup/plugin-replace";

const NODE_BUILTINS = [
  "fs", "path", "os", "util", "stream", "buffer",
  "readline", "events", "child_process", "crypto",
  "http", "https", "net", "tls", "zlib",
  "module", "url", "assert", "string_decoder",
  "perf_hooks", "worker_threads", "tty",
];

/**
 * @type {import('rollup').RollupOptions}
 */
export default {
  input: "src/repl.ts",
  output: {
    file: "dist/repl.cjs",
    format: "cjs",
    exports: "auto",
    banner: "#!/usr/bin/env node",
    sourcemap: true,
  },
  external: [
    ...NODE_BUILTINS,
    // Keep commander external so its help output works correctly.
    "commander",
    // Inquirer prompts are only needed for the interactive build script.
    "@inquirer/prompts",
  ],
  plugins: [
    replace({
      preventAssignment: true,
      // Not building a specific evaluator, but the replace plugin is harmless here.
      values: {},
    }),
    commonjs({ include: ["node_modules/**"] }),
    json(),
    typescript(),
    nodeResolve({ preferBuiltins: true }),
  ],
};
