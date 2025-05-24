// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

export const enum RunnerStatus {
    ONLINE,     // Runner is online
    EVAL_READY, // Evaluator is ready
    RUNNING,    // I am running some code
    WAITING,    // I am waiting for inputs
    BREAKPOINT, // I have reached a debug breakpoint
    STOPPED,    // I have exited, crashed, etc.; the environment is no longer valid
    ERROR,      // I have stopped unexpectedly
};
