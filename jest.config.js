/** @type {import('ts-jest').JsWithTsEsmPreset} */
module.exports = {
  preset: "ts-jest/presets/js-with-ts-esm",
  testEnvironment: "node",
  transformIgnorePatterns: [
    "/node_modules/(?!(@sourceacademy/wasm-util)/).+\\.js$",
  ],
  coverageReporters: ["lcov"]
};
