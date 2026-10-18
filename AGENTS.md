# Instructions for AI agents

## Commands

Use the scripts in `package.json`, not the tools directly.

* Format: `yarn format` (Prettier; `yarn format:ci` lists unformatted files). The generated `src/parser/python-grammar.ts` is made by `yarn compile-grammar`, not edited.
* Lint: `yarn lint`
* Test: `yarn test` (Jest). Run the tests that concern the change, e.g. `yarn jest src/tests/full-estepper`; CI runs the whole suite.
* In a git worktree, install the dependencies there first.
