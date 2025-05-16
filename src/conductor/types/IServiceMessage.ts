// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import type { ServiceMessageType } from "./ServiceMessageType";

export interface IServiceMessage {
    readonly type: ServiceMessageType;
    readonly data?: any;
}
