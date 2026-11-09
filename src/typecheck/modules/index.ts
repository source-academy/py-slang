import type { ModuleDescription } from "../module-description";
import { BINARY_TREE } from "./binary_tree";
import { CURVE } from "./curve";
import { MATRIX } from "./matrix";
import { REPEAT } from "./repeat";
import { RUNE } from "./rune";
import { SCRABBLE } from "./scrabble";
import { SOUND } from "./sound";

/** Where the checker gets the description of a module that a program imports: none if it has none. */
export type DescriptionSource = (module: string) => ModuleDescription | undefined;

/** TEMPORARY: the descriptions that py-slang carries until the modules publish their own. */
const TEMPORARY: Record<string, ModuleDescription> = {
  binary_tree: BINARY_TREE,
  curve: CURVE,
  matrix: MATRIX,
  repeat: REPEAT,
  rune: RUNE,
  scrabble: SCRABBLE,
  sound: SOUND,
};

export const temporaryDescriptions: DescriptionSource = module => TEMPORARY[module];
