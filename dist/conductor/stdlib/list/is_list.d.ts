import { IDataHandler, List } from "../../types";
/**
 * Checks if a List is a true list (`tail(tail...(xs))` is empty-list).
 * @param xs The List to check.
 * @returns true if the provided List is a true list.
 */
export declare function is_list(this: IDataHandler, xs: List): boolean;
