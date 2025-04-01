import { runInContext } from "../../../";
import { Context } from "../../../cse-machine/context";
import { BasicEvaluator } from "../BasicEvaluator";
import { IRunnerPlugin } from "./IRunnerPlugin";
import { IOptions } from "../../../";
import { Finished } from "../../../types";

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
            const result = await runInContext(
                chunk,       // Code
                this.context,
                this.options
            );
            this.conductor.sendOutput(`${(result as Finished).representation.toString((result as Finished).value)}`);
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