// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import type { RunnerStatus } from "./RunnerStatus";

export interface IStatusMessage {
    status: RunnerStatus;
    isActive: boolean;
}
