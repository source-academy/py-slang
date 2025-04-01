import { BasicEvaluator } from "../BasicEvaluator";
import { IRunnerPlugin } from "./IRunnerPlugin";
export declare class PyEvaluator extends BasicEvaluator {
    private context;
    private options;
    constructor(conductor: IRunnerPlugin);
    evaluateChunk(chunk: string): Promise<void>;
}
