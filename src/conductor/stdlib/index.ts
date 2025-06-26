// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import type { StdlibFunction } from "../types";
import { accumulate, is_list, length, pair, is_pair, head, tail } from "./list";

export const stdlib = {
    is_list: is_list,
    accumulate: accumulate,
    length: length,
    pair: pair,
    is_pair: is_pair,
    head: head,
    tail: tail
} satisfies Record<string, StdlibFunction<any, any>>;

export { accumulate };
