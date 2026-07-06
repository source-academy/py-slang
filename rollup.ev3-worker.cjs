// rollup.ev3-worker.cjs
const nodeResolve = require("@rollup/plugin-node-resolve");
const terser = require("@rollup/plugin-terser");
const typescript = require("@rollup/plugin-typescript");
const json = require("@rollup/plugin-json");
const commonjs = require("@rollup/plugin-commonjs");
const nodePolyfills = require("rollup-plugin-polyfill-node");
const wasm = require("@rollup/plugin-wasm");

module.exports = {
  input: "src/engines/ev3/entry.ts",
  output: {
    file: "dist/ev3-remote-runner.js",
    format: "iife",
    sourcemap: true,
  },
  plugins: [
    commonjs({ include: ["node_modules/**", "src/engines/svml/sinter/sinterwasm.js"] }),
    json(),
    wasm({ maxFileSize: 100 * 1024 }),
    typescript(),
    nodeResolve(),
    nodePolyfills(),
    terser({ compress: { dead_code: true, passes: 3 } }),
  ],
};
