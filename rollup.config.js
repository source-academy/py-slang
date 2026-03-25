import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

/**
 * @type {import('rollup').RollupOptions}
 */
const config = [...[1, 2, 3].map(v => ({
  input: `src/conductor/PyCSEEvaluator${v}.ts`,
  output: [{
    file: `dist/worker${v}.js`,
    format: 'iife',
    name: 'PySlangWorker',
    sourcemap: true
  }, {
    file: `dist/python-evaluator-${v}.cjs`,
    format: 'cjs',
    name: 'PySlangEvaluator',
    sourcemap: true
  }],
  plugins: [
    nodeResolve({ browser: true }),
    commonjs({
      include: /node_modules/
    }),
    json(),
    typescript()
  ]
})), {
  input: `src/conductor/PyWasmEvaluator.ts`,
  output: [{
    file: `dist/worker-wasm.js`,
    format: 'iife',
    name: 'PySlangWorker',
    sourcemap: true
  }, {
    file: `dist/python-evaluator-wasm.cjs`,
    format: 'cjs',
    name: 'PySlangEvaluator',
    sourcemap: true
  }],
  plugins: [
    nodeResolve({ browser: true }),
    commonjs({
      include: /node_modules/
    }),
    json(),
    typescript()
  ]
}];

export default config;
