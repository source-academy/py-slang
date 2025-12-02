/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@sourceacademy/conductor/types$': '<rootDir>/node_modules/@sourceacademy/conductor/dist/conductor/types/index.js',
    '^@sourceacademy/conductor/runner$': '<rootDir>/node_modules/@sourceacademy/conductor/dist/conductor/runner/index.js',
  },
  transform: {
    '^.+\.tsx?$': 'ts-jest',
    '^.+\.js$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!@sourceacademy/conductor)',
  ],
};