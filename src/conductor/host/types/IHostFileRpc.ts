// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

export interface IHostFileRpc {
    requestFile(fileName: string): Promise<string | undefined>;
}
