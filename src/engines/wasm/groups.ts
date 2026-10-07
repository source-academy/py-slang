import linkedList from "../../stdlib/linked-list";
import list from "../../stdlib/list";
import pairmutator from "../../stdlib/pairmutator";
import mce from "../../stdlib/parser";
import stream from "../../stdlib/stream";
import { Group } from "../../stdlib/utils";
import { WASM_STREAM_PRELUDE } from "./wasmPrelude";

/** The stream group as the WASM engine sees it: the shared prelude plus the
 * `stream` function that the CSE stdlib implements in TypeScript. */
const wasmStream: Group = { ...stream, prelude: stream.prelude + WASM_STREAM_PRELUDE };

/** The library groups each SICPy chapter gets in the WASM engine (misc is
 * added by compileToWasmAndRun itself). Shared by the browser evaluators and
 * the CLI so the two cannot drift. */
export const WASM_GROUPS: Record<number, Group[]> = {
  1: [],
  2: [linkedList],
  3: [linkedList, pairmutator, list, wasmStream],
  4: [linkedList, pairmutator, list, wasmStream, mce],
};
