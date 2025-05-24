// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import type { IDataHandler } from "./IDataHandler";

export type StdlibFunction<Arg extends any[], Ret> = (this: IDataHandler, ...args: Arg) => Ret;
