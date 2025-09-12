// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { PyRunInContext } from "../../../";
import { Context } from "../../../cse-machine/context";
import { BasicEvaluator } from "../BasicEvaluator";
import { IRunnerPlugin } from "./IRunnerPlugin";
import { IOptions } from "../../../";

const defaultContext = new Context();
const defaultOptions: IOptions = {
    isPrelude: false,
    envSteps: 100000,
    stepLimit: 100000
};

export class PyEvaluator extends BasicEvaluator {
    private context: Context;
    private options: IOptions;
  
    constructor(conductor: IRunnerPlugin) {
        super(conductor);
        this.context = defaultContext;
        this.options = defaultOptions;
    }
  
    async evaluateChunk(chunk: string): Promise<void> {
        try {
            const result = await PyRunInContext(
                chunk,       // Code
                this.context,
                this.options
            );
            if ('status' in result && result.status === 'finished') {
                this.conductor.sendOutput(`${result.representation.toString(result.value)}`);
            }
        } catch (error) {
            this.conductor.sendOutput(`Error: ${error instanceof Error ? error.message : error}`);
        }
    }
}

// runInContext
// IOptions
// Context
// BasicEvaluator;
// IRunnerPlugin