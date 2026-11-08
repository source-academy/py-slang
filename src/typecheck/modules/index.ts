import type { ModuleDescription } from "../module-description";
import { RUNE } from "./rune";

/** Where the checker gets the description of a module that a program imports: none if it has none. */
export type DescriptionSource = (module: string) => ModuleDescription | undefined;

/** TEMPORARY: the descriptions that py-slang carries until the modules publish their own. */
const TEMPORARY: Record<string, ModuleDescription> = { rune: RUNE };

export const temporaryDescriptions: DescriptionSource = module => TEMPORARY[module];
