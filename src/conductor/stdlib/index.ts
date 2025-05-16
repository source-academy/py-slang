import type { StdlibFunction } from "../types";
import { accumulate, is_list, length } from "./list";

export const stdlib = {
    is_list: is_list,
    accumulate: accumulate,
    length: length
} satisfies Record<string, StdlibFunction<any, any>>;

export { accumulate };
