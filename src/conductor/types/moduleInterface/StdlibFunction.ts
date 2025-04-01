import type { IDataHandler } from "./IDataHandler";

export type StdlibFunction<Arg extends any[], Ret> = (this: IDataHandler, ...args: Arg) => Ret;
