import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import commonjs from "@rollup/plugin-commonjs";
import nodePolyfills from "rollup-plugin-polyfill-node";
import replace from "@rollup/plugin-replace";

// Env EVALUATOR is set by scripts/build.ts.
const EVALUATOR = process.env.EVALUATOR;
if (!EVALUATOR) {
  throw new Error("EVALUATOR env var must be set. Use scripts/build.ts.");
}

function plugins() {
  return [
    replace({
      preventAssignment: true,
      values: { __EVALUATOR__: EVALUATOR },
    }),
    commonjs({ include: "node_modules/**" }),
    json(),
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
    treeshake: {
      moduleSideEffects: false,
    },
    input: "src/conductor/initialise.ts",
    output: {
      file: `dist/${EVALUATOR}.js`,
      format: "iife",
      name: "PySlangWorker",
      sourcemap: true,
    },
    plugins: plugins(),
  },
  {
    treeshake: {
      moduleSideEffects: false,
    },
    input: "src/conductor/evaluator.ts",
    output: {
      file: `dist/${EVALUATOR}.cjs`,
      format: "cjs",
      exports: "default",
      sourcemap: true,
    },
    plugins: plugins(),
  },
];

export default config;
