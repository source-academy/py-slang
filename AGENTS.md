# Instructions for AI agents

## Commands

Use the scripts in `package.json`, not the tools directly.

* Format: `yarn format` (Prettier; `yarn format:ci` lists unformatted files). The generated `src/parser/python-grammar.ts` is made by `yarn compile-grammar`, not edited.
* Lint: `yarn lint`
* Test: `yarn test` (Jest). Run the tests that concern the change, e.g. `yarn jest src/tests/full-estepper`; CI runs the whole suite.
* In a git worktree, install the dependencies there first.

## Comments

* Write no comment by default. Add one only to say why: a constraint, a non-obvious decision, a workaround, an invariant, or a trap.
* Never say what the code already says. Never tell history: no issue or pull request numbers (a TODO is the exception, below), review findings, "used to" or "previously". That belongs in the commit message and the pull request.
* No commented-out code. Delete it; git remembers.
* Documentation comments only on exported API (`yarn jsdoc` builds the API documentation from them), one to three lines unless they state a contract.
* A TODO links an issue: `TODO(#123): ...`. This is the one place for an issue number in a comment, because the link is what keeps the TODO from rotting.
* When you change or delete code, fix or delete the comments about it.
* Generated, never hand-edited: `src/parser/python-grammar.ts` (`yarn compile-grammar`) and `docs/python`, the output of `yarn jsdoc` (not committed).
* Leave alone when cleaning up comments: the JSDoc template in `docs/jsdoc` (a vendored copy of JSDoc's default template), and `docs/lib`, the library definitions that `yarn jsdoc` reads: their comments are the API documentation, so keep them.
* To clean up existing comments, follow the guide in the documentation repository: `../documentation/app/docs/contributing/comment-cleanup.md` in a sibling checkout, or <https://github.com/source-academy/documentation/blob/main/app/docs/contributing/comment-cleanup.md>.
