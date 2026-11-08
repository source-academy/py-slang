# Spike: a language-neutral description of a module's types (rune)

Evidence for source-academy/modules#996. Not meant to be merged. Paths in the scripts are those of the
machine that ran it (`/Users/henz/...`): change them to run it.

* `describe.mjs`: reads the `rune` bundle of the `modules` repository two ways: the **coarse** description
  from what the conductor plugin declares (`exportedNames`, `attachModuleMethod`, class fields), and the
  **precise** one from the TypeScript compiler's types for `functions.ts`.
  Output: `rune.coarse.json`, `rune.precise.json`.
* `to-pyi.mjs`: the mapper for Typed Python §4: a description to the text of a Python stub
  (`rune.coarse.pyi`, `rune.precise.pyi`). The precise one needs six functions written by hand
  (`show`, `anaglyph`, `hollusion`, `hollusion_magnitude`, `animate_rune`, `animate_anaglyph`: they are
  defined on the plugin class, with conductor types only).
* `check.ts`: gives each stub to the Typed Python §4 checker and runs correct programs and programs with
  a mistake (needs `dist/TypedPy4Checker.js`: `yarn build:typecheck`).
