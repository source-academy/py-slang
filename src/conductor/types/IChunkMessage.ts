// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import type { Chunk } from "./Chunk";

export interface IChunkMessage {
    id: number;
    chunk: Chunk;
}
