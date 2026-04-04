import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import commonjs from "@rollup/plugin-commonjs";
import nodePolyfills from "rollup-plugin-polyfill-node";
import replace from "@rollup/plugin-replace";
import wasm from "@rollup/plugin-wasm";

// Build-time evaluator selection via environment variables.
// Set by scripts/build.ts; defaults to CSE.
const EVALUATOR = process.env.EVALUATOR || "PyCSEEvaluator";

const outputName = {
  PyCSEEvaluator: "cse",
  PyWasmEvaluator: "wasm",
}[EVALUATOR] ?? EVALUATOR.toLowerCase();

const replacePlugin = replace({
  preventAssignment: true,
  values: {
    __EVALUATOR__: JSON.stringify(EVALUATOR),
  },
});

function plugins(terserConfig) {
  return [
    replacePlugin,
    commonjs(),
    json(),
    wasm({ maxFileSize: 100_000 }),
    typescript(),
    nodeResolve(),
    nodePolyfills(),
    terserConfig,
  ];
}

// Browser bundle
const terserBrowser = terser({
  compress: { drop_console: true, dead_code: true, passes: 3 },
});

// Node.js bundle (readable)
const terserNode = terser({
  compress: { defaults: false, unused: true, dead_code: true },
  mangle: false,
  format: { beautify: true },
});

/**
 * @type {import('rollup').RollupOptions}
 */
const config = [
  {
    input: "src/index.ts",
    output: {
      file: `dist/worker-${outputName}.js`,
      format: "iife",
      name: "PySlangWorker",
      sourcemap: true,
    },
    plugins: plugins(terserBrowser),
  },
  {
    input: "src/index.ts",
    output: {
      file: `dist/evaluator-${outputName}.cjs`,
      format: "cjs",
      name: "PySlangEvaluator",
      sourcemap: true,
    },
    plugins: plugins(terserNode),
  },
];

export default config;
