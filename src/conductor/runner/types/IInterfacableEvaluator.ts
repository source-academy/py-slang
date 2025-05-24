// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import type { IDataHandler } from "../../types";
import type { IEvaluator } from "./IEvaluator";

export type IInterfacableEvaluator = IEvaluator & IDataHandler;
