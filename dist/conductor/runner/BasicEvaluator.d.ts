import { IEvaluator, IRunnerPlugin } from "./types";
export declare abstract class BasicEvaluator implements IEvaluator {
    readonly conductor: IRunnerPlugin;
    startEvaluator(entryPoint: string): Promise<void>;
    /**
     * Evaluates a file.
     * @param fileName The name of the file to be evaluated.
     * @param fileContent The content of the file to be evaluated.
     * @returns A promise that resolves when the evaluation is complete.
     */
    evaluateFile(fileName: string, fileContent: string): Promise<void>;
    /**
     * Evaluates a chunk.
     * @param chunk The chunk to be evaluated.
     * @returns A promise that resolves when the evaluation is complete.
     */
    abstract evaluateChunk(chunk: string): Promise<void>;
    constructor(conductor: IRunnerPlugin);
}
