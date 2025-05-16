// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { IEvaluator } from "./IEvaluator";
import { IInterfacableEvaluator } from "./IInterfacableEvaluator";
import { IRunnerPlugin } from "./IRunnerPlugin";

export type EvaluatorClass<Arg extends any[] = []> = new (conductor: IRunnerPlugin, ...arg: Arg) => IEvaluator | IInterfacableEvaluator;
