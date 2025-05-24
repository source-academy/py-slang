// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

export interface IPlugin {
    /** The name of the plugin. Can be undefined for an unnamed plugin. */
    readonly name?: string;

    /**
     * Perform any cleanup of the plugin (e.g. closing message queues).
     */
    destroy?(): void;
}
