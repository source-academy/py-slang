export declare const enum RunnerStatus {
    ONLINE = 0,// Runner is online
    EVAL_READY = 1,// Evaluator is ready
    RUNNING = 2,// I am running some code
    WAITING = 3,// I am waiting for inputs
    BREAKPOINT = 4,// I have reached a debug breakpoint
    STOPPED = 5,// I have exited, crashed, etc.; the environment is no longer valid
    ERROR = 6
}
