/** @type {import('ts-jest').JsWithTsEsmPreset} */
module.exports = {
  preset: "ts-jest/presets/js-with-ts-esm",
  testEnvironment: "node",
  // finicky workaround for wasm imports in tests
  // from Gemini: migrate to Vitest resolves this issue uses Vite's resolver, which fully supports exports maps natively
  moduleNameMapper: {
    "\\.wasm$": "<rootDir>/src/tests/__mocks__/wasm.js",
    "^@sourceacademy/conductor/common$":
      "<rootDir>/node_modules/@sourceacademy/conductor/dist/common/index.js",
    "^@sourceacademy/conductor/conduit$":
      "<rootDir>/node_modules/@sourceacademy/conductor/dist/conduit/index.js",
    "^@sourceacademy/conductor/module$":
      "<rootDir>/node_modules/@sourceacademy/conductor/dist/conductor/module/index.js",
    "^@sourceacademy/conductor/runner$":
      "<rootDir>/node_modules/@sourceacademy/conductor/dist/conductor/runner/index.js",
    "^@sourceacademy/conductor/types$":
      "<rootDir>/node_modules/@sourceacademy/conductor/dist/conductor/types/index.js",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          paths: {
            "@sourceacademy/conductor/common": [
              "node_modules/@sourceacademy/conductor/dist/common/index.d.ts",
            ],
            "@sourceacademy/conductor/conduit": [
              "node_modules/@sourceacademy/conductor/dist/conduit/index.d.ts",
            ],
            "@sourceacademy/conductor/module": [
              "node_modules/@sourceacademy/conductor/dist/conductor/module/index.d.ts",
            ],
            "@sourceacademy/conductor/runner": [
              "node_modules/@sourceacademy/conductor/dist/conductor/runner/index.d.ts",
            ],
            "@sourceacademy/conductor/types": [
              "node_modules/@sourceacademy/conductor/dist/conductor/types/index.d.ts",
            ],
          },
        },
        diagnostics: {
          exclude: ["**/python-grammar.ts"],
        },
      },
    ],
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(@sourceacademy/wasm-util|@sourceacademy/conductor)/).+\\.js$",
  ],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  coverageReporters: ["lcov"],
};
