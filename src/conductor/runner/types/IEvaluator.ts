/**
 * The IEvaluator interface exposes methods used by Conductor to interact with evaluators.
 */
export interface IEvaluator {
    /**
     * Starts this evaluator.
     * @param entryPoint The entry point file to start running from.
     * @returns A promise that resolves when the evaluator has terminated.
     */
    startEvaluator(entryPoint: string): Promise<any>;
}
