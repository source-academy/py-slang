export { runCode, RunError, RunOptions, VARIANT_GROUPS } from "./runner";

// Additive exports so external consumers (e.g. the Source Academy `modules` repo's
// robot_simulation bundle) can drive py-slang's CSE machine step-by-step, the same way
// js-slang already exposes its own parser / Control / Stash / generateCSEMachineStateStream.
export { parse } from "./parser/parser-adapter";
export { analyze, analyzeWithEnvironments } from "./resolver/analysis";
export { Context } from "./engines/cse/context";
export { Control } from "./engines/cse/control";
export { Stash } from "./engines/cse/stash";
export { generateCSEMachineStateStream } from "./engines/cse/interpreter";

// Runtime value types, so an embedder can author its own builtins (a `BuiltinValue` registered
// into `Context.nativeStorage.builtins`) without reaching into py-slang's internal paths.
export type { BuiltinValue, Value } from "./engines/cse/stash";
