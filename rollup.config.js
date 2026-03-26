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
    input: "src/pyodide/index.ts",
    output: {
      file: "dist/pyodide-evaluator.cjs",
      format: "cjs",
      name: "PyodideEvaluator",
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: plugins(),
  },
];

export default config;
