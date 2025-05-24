// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

export const enum ErrorType {
    UNKNOWN = "__unknown",
    INTERNAL = "__internal",
    EVALUATOR = "__evaluator",
    EVALUATOR_SYNTAX = "__evaluator_syntax",
    EVALUATOR_TYPE = "__evaluator_type",
    EVALUATOR_RUNTIME = "__evaluator_runtime",
}
