import type { RunnerStatus } from "./RunnerStatus";

export interface IStatusMessage {
    status: RunnerStatus;
    isActive: boolean;
}
