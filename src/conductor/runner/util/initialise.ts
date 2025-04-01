import { RunnerPlugin } from "..";
import { Conduit, IConduit, ILink } from "../../../conduit";
import { EvaluatorClass, IRunnerPlugin } from "../types";

/**
 * Initialise this runner with the evaluator to be used.
 * @param evaluatorClass The Evaluator to be used on this runner.
 * @param link The underlying communication link.
 * @returns The initialised `runnerPlugin` and `conduit`.
 */
export function initialise(evaluatorClass: EvaluatorClass, link: ILink = self as ILink): { runnerPlugin: IRunnerPlugin, conduit: IConduit } {
    const conduit = new Conduit(link, false);
    const runnerPlugin = conduit.registerPlugin(RunnerPlugin, evaluatorClass);
    return { runnerPlugin, conduit };
}
