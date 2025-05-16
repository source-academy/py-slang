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
