// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

export interface ILink {
    postMessage: typeof Worker.prototype.postMessage;
    addEventListener: typeof Worker.prototype.addEventListener;
    terminate?: typeof Worker.prototype.terminate;
}
