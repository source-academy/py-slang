import type { ModuleDescription } from "../module-description";

const words = { array: "string" } as const;
const letters = { array: { array: "string" } } as const;

/**
 * TEMPORARY: the types of `scrabble`, written by hand from the plugin's `initialise()` (index.ts): it
 * has no functions, and exports its four arrays when it is loaded (so they are not in `exportedNames`).
 * `scrabble_words` is an array of strings; `scrabble_letters` an array with, for each word, the array of
 * its letters. To be removed when the module publishes its own description (source-academy/modules#996).
 */
export const SCRABBLE: ModuleDescription = {
  version: 1,
  module: "scrabble",
  opaqueTypes: [],
  functions: [],
  constants: [
    { name: "scrabble_words", type: words },
    { name: "scrabble_letters", type: letters },
    { name: "scrabble_words_tiny", type: words },
    { name: "scrabble_letters_tiny", type: letters },
  ],
};
