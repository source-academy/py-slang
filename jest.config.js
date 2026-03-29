/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest/presets/js-with-ts-esm",
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        diagnostics: {
          exclude: ["**/python-grammar.ts"],
        },
      },
    ],
    "\\.py$": "<rootDir>/src/tests/raw-text-transformer.js",
  },
  transformIgnorePatterns: ["/node_modules/(?!(@sourceacademy/wasm-util)/).+\\.js$"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  coverageReporters: ["lcov"],
};
