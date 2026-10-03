/**
 * Rollup config for the EV3 execution worker (dist/ev3-remote-runner.js), served by the frontend
 * at public/evaluators/ev3-remote-runner.js and loaded into a browser Worker via
 * `new Worker(EV3_EVALUATOR_PATH)` (see createEv3Conductor.ts, source-academy/frontend).
 *
 * Unlike the main evaluator bundles (rollup.config.mjs), this only compiles Python source to PVML
 * bytecode in the browser (Ev3ExecutionPlugin -> EV3Engine) - actual execution happens on the real
 * device via a native pynter-ev3 binary, not in this worker - so it never touches pynter-wasm/WASM
 * loading at all, and doesn't need rollup.config.mjs's browser shims for that.
 */
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import commonjs from "@rollup/plugin-commonjs";

/**
 * @type {import('rollup').RollupOptions}
 */
export default {
  treeshake: {
    moduleSideEffects: false,
  },
  input: "src/engines/ev3/entry.ts",
  output: {
    file: "dist/ev3-remote-runner.js",
    format: "iife",
    sourcemap: true,
  },
  plugins: [
    commonjs({ include: ["node_modules/**"] }),
    json(),
    typescript(),
    nodeResolve(),
    terser({ compress: { dead_code: true, passes: 3 } }),
  ],
};
