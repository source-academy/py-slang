import type { ModuleDescription } from "../module-description";
import { BINARY_TREE } from "./binary_tree";
import { CURVE } from "./curve";
import { RUNE } from "./rune";
import { SOUND } from "./sound";

/** Where the checker gets the description of a module that a program imports: none if it has none. */
export type DescriptionSource = (module: string) => ModuleDescription | undefined;

/** TEMPORARY: the descriptions that py-slang carries until the modules publish their own. */
const TEMPORARY: Record<string, ModuleDescription> = {
  binary_tree: BINARY_TREE,
  curve: CURVE,
  rune: RUNE,
  sound: SOUND,
};

export const temporaryDescriptions: DescriptionSource = module => TEMPORARY[module];
