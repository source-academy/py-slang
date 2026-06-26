/**
 * Rollup config for the Node.js library bundle (dist/index.cjs).
 * Exports runCode() and RunError so external scripts (e.g. sicp/scripts/test.js)
 * can import py-slang as a library instead of spawning a subprocess.
 */
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import commonjs from "@rollup/plugin-commonjs";

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
  input: "src/index.ts",
  output: {
    file: "dist/index.cjs",
    format: "cjs",
    exports: "named",
    sourcemap: true,
  },
  external: NODE_BUILTINS,
  plugins: [
    commonjs({ include: ["node_modules/**"] }),
    json(),
    typescript(),
    nodeResolve({ preferBuiltins: true }),
  ],
};
