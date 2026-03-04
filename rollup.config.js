import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import sourcemaps from 'rollup-plugin-sourcemaps';

/**
 * @type {import('rollup').RollupOptions}
 */
const config = [{
  input: 'src/conductor/PyEvaluator.ts',
  output: {
    file: 'dist/python-evaluator.cjs',
    format: 'cjs',
    name: 'PySlangEvaluator',
    sourcemap: true
  },
  plugins: [
    nodeResolve({ browser: true }),
    commonjs({
      include: /node_modules/
    }),
    json(),
    typescript(),
    sourcemaps()
  ]
}, {
  input: 'src/index.ts',
  output: {
    file: 'dist/worker.js',
    format: 'iife',
    name: 'PySlangWorker',
    sourcemap: true
  },
  plugins: [
    nodeResolve({ browser: true }),
    commonjs({
      include: /node_modules/
    }),
    json(),
    typescript(),
    sourcemaps()
  ]
}];

export default config;
