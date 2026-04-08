import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import commonjs from "@rollup/plugin-commonjs";
import nodePolyfills from "rollup-plugin-polyfill-node";
import replace from "@rollup/plugin-replace";
import wasm from "@rollup/plugin-wasm";

// Env EVALUATOR are set by scripts/build.ts.
const EVALUATOR = process.env.EVALUATOR;
if (!EVALUATOR) {
  throw new Error("EVALUATOR env vars must be set. Use scripts/build.ts.");
}

const replacePlugin = replace({
  preventAssignment: true,
  values: {
    __EVALUATOR__: JSON.stringify(EVALUATOR),
  },
});

function plugins() {
  return [
    replacePlugin,
    commonjs({ include: "node_modules/**" }),
    json(),
    wasm({ maxFileSize: 100_000 }),
    typescript(),
    nodeResolve(),
    nodePolyfills(),
    terser({
      compress: { drop_console: true, dead_code: true, passes: 3 },
    }),
  ];
}

/**
 * @type {import('rollup').RollupOptions}
 */
const config = [
  {
    input: "src/index.ts",
    output: {
      file: `dist/${EVALUATOR}.js`,
      format: "iife",
      name: "PySlangWorker",
      sourcemap: true,
    },
    plugins: plugins(),
  },
  {
    input: "src/index.ts",
    output: {
      file: `dist/${EVALUATOR}.cjs`,
      format: "cjs",
      name: "PySlangEvaluator",
      sourcemap: true,
    },
    plugins: plugins(),
  },
];

export default config;
