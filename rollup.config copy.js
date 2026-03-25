import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

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
];

export default config;
