import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import nodePolyfills from "rollup-plugin-polyfill-node";

/**
 * @type {import('rollup').RollupOptions}
 */
const config = [
  {
    input: "src/conductor/PyEvaluator.ts",
    output: {
      file: "dist/python-evaluator.cjs",
      format: "cjs",
      name: "PySlangEvaluator",
      sourcemap: true,
    },
    plugins: [
      nodeResolve({ browser: true }),
      commonjs({
        include: /node_modules/,
      }),
      json(),
      typescript(),
    ],
  },
  {
    input: "src/index.ts",
    output: {
      file: "dist/worker.js",
      format: "iife",
      name: "PySlangWorker",
      sourcemap: true,
    },
    plugins: [
      nodeResolve({ browser: true }),
      commonjs({
        include: /node_modules/,
      }),
      json(),
      typescript(),
    ],
  },

  // wasm
  {
    plugins: [
      nodeResolve({ browser: true }),
      commonjs({
        include: "node_modules/**",
      }),
      json(),
      typescript(),
      nodePolyfills(),
    ],
    input: "src/conductor/PyWasmEvaluator.ts",
    output: {
      plugins: [terser()],
      file: "dist/pywasm-evaluator.js",
      format: "iife",
      sourcemap: true,
    },
  },
];

export default config;
