import { ConductorInternalError } from "../../common/errors";
import { IEvaluator, IRunnerPlugin } from "./types";

export abstract class BasicEvaluator implements IEvaluator {
    readonly conductor: IRunnerPlugin;

    async startEvaluator(entryPoint: string): Promise<void> {
        const initialChunk = await this.conductor.requestFile(entryPoint);
        if (!initialChunk) throw new ConductorInternalError("Cannot load entrypoint file");
        await this.evaluateFile(entryPoint, initialChunk);
        while (true) {
            const chunk = await this.conductor.requestChunk();
            await this.evaluateChunk(chunk);
        }
    }

    /**
     * Evaluates a file.
     * @param fileName The name of the file to be evaluated.
     * @param fileContent The content of the file to be evaluated.
     * @returns A promise that resolves when the evaluation is complete.
     */
    async evaluateFile(fileName: string, fileContent: string): Promise<void> {
        return this.evaluateChunk(fileContent);
    }

    /**
     * Evaluates a chunk.
     * @param chunk The chunk to be evaluated.
     * @returns A promise that resolves when the evaluation is complete.
     */
    abstract evaluateChunk(chunk: string): Promise<void>;

    constructor(conductor: IRunnerPlugin) {
        this.conductor = conductor;
    }
}
