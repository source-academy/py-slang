// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

/** A subscriber of a channel. */
export type Subscriber<T> = (data: T) => void;
