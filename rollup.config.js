import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { readFileSync } from "fs";

/** Plugin: import .py files as strings. */
function rawPy() {
  return {
    name: "raw-py",
    load(id) {
      if (id.endsWith(".py")) {
        const text = readFileSync(id, "utf-8");
        return `export default ${JSON.stringify(text)};`;
      }
    },
  };
}

function plugins() {
  return [
    rawPy(),
    nodeResolve({ browser: true }),
    commonjs({ include: /node_modules/ }),
    json(),
    typescript(),
  ];
}

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
    plugins: plugins(),
  },
  {
    input: "src/index.ts",
    output: {
      file: "dist/worker.js",
      format: "iife",
      name: "PySlangWorker",
      sourcemap: true,
    },
    plugins: plugins(),
  },
  {
    input: "src/pyodide/evaluators/full.ts",
    output: {
      file: "dist/pyodide-evaluator-full.js",
      format: "iife",
      name: "PyodideEvaluatorFull",
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: plugins(),
  },
  {
    input: "src/pyodide/evaluators/chapter1.ts",
    output: {
      file: "dist/pyodide-evaluator-1.js",
      format: "iife",
      name: "PyodideEvaluator1",
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: plugins(),
  },
  {
    input: "src/pyodide/evaluators/chapter2.ts",
    output: {
      file: "dist/pyodide-evaluator-2.js",
      format: "iife",
      name: "PyodideEvaluator2",
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: plugins(),
  },
  {
    input: "src/pyodide/evaluators/chapter3.ts",
    output: {
      file: "dist/pyodide-evaluator-3.js",
      format: "iife",
      name: "PyodideEvaluator3",
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: plugins(),
  },
  {
    input: "src/pyodide/evaluators/chapter4.ts",
    output: {
      file: "dist/pyodide-evaluator-4.js",
      format: "iife",
      name: "PyodideEvaluator4",
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: plugins(),
  },
];

export default config;
