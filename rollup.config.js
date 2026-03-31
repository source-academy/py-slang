import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import nodePolyfills from "rollup-plugin-polyfill-node";

const generateConfig = variant => ({
  input: `src/conductor/PyCSEEvaluator${variant}.ts`,
  output: [
    {
      file: `dist/worker${variant}.js`,
      format: "iife",
      name: "PySlangWorker",
      sourcemap: true,
    },
    {
      file: `dist/python-evaluator-${variant}.cjs`,
      format: "cjs",
      name: "PySlangEvaluator",
      sourcemap: true,
    },
  ],
  plugins: [
    nodeResolve({ browser: true }),
    commonjs({
      include: /node_modules/,
    }),
    json(),
    typescript(),
  ],
});

const variants = [1, 2, 3].map(v => generateConfig(v));

/**
 * @type {import('rollup').RollupOptions}
 */
const config = [
  ...variants,
  {
    input: `src/conductor/PyWasmEvaluator.ts`,
    output: [
      {
        file: `dist/worker-wasm.js`,
        format: "iife",
        name: "PySlangWorker",
        sourcemap: true,
      },
      {
        file: `dist/python-evaluator-wasm.cjs`,
        format: "cjs",
        name: "PySlangEvaluator",
        sourcemap: true,
      },
    ],
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
