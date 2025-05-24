// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

export type Remote<IOther> = {
    [K in keyof IOther]: IOther[K] extends (...args: infer Args) => infer Ret
        ? K extends `$${infer _N}`
            ? Ret extends void
                ? IOther[K]
                : (...args: Args) => void
            : Ret extends Promise<any>
                ? IOther[K]
                : (...args: Args) => Promise<Ret>
        : never
}
